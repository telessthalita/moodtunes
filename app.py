import os
import re
import time
import uuid
import secrets
import logging
from typing import Dict, Any, List, Optional

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

from spotify_client import (
    build_auth_url,
    exchange_code_for_token,
    ensure_token,
    get_current_user,
    search_track_full,
    create_playlist,
    add_tracks_to_playlist,
)

load_dotenv()

logger = logging.getLogger("moodtunes")

def get_groq():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("Defina GROQ_API_KEY no .env")
    return Groq(api_key=key)

# A Groq desligou o llama-3.1-8b-instant em 16/08/2026; este é o substituto indicado.
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "https://preview--moodtuness.lovable.app").rstrip("/")

app = FastAPI(title="MoodTunes API", version="1.0.0")

ALLOWED_ORIGINS = [
    FRONTEND_BASE_URL,
    "https://moodtunes.lovable.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https:\/\/preview--moodtune[s\-\.a-z0-9]*\.lovable\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
)

SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 6 * 60 * 60
MAX_SESSIONS = 5000

# state do OAuth -> (session_id, expira_em). Uso único, para o callback só
# aceitar logins que este backend iniciou.
OAUTH_STATES: Dict[str, tuple] = {}
OAUTH_STATE_TTL_SECONDS = 10 * 60

def purge_expired() -> None:
    now = time.time()
    for sid in [k for k, v in SESSIONS.items() if now - v.get("last_seen", now) > SESSION_TTL_SECONDS]:
        SESSIONS.pop(sid, None)
    for st in [k for k, v in OAUTH_STATES.items() if v[1] <= now]:
        OAUTH_STATES.pop(st, None)
    if len(SESSIONS) > MAX_SESSIONS:
        oldest = sorted(SESSIONS, key=lambda k: SESSIONS[k].get("last_seen", 0))
        for sid in oldest[: len(SESSIONS) - MAX_SESSIONS]:
            SESSIONS.pop(sid, None)

class StartSessionResponse(BaseModel):
    session_id: str

class StatusResponse(BaseModel):
    authenticated: bool
    user: Optional[Dict[str, Any]] = None

class ChatSendRequest(BaseModel):
    session_id: str
    message: str

class ChatSendResponse(BaseModel):
    messages: List[Dict[str, str]]
    pending: bool
    suggestions: List[Dict[str, Any]]
    finalized: bool
    playlist: Optional[Dict[str, Any]] = None

SYSTEM_PROMPT = """Você é o MoodTunes no estilo Tony Stark: confiante, sagaz, direto e acolhedor.
Primeiro turno: apresente-se como um “DJ com armadura tecnológica” e peça o NOME da pessoa de forma objetiva. Não avance até saber o nome.
Estilo:
- Português do Brasil. Frases curtas. Humor rápido, sem arrogância grosseira.
- Uma pergunta por turno. Tom seguro e eficiente.
- Use o nome informado de forma natural, sem exageros.
Objetivo:
- Após saber o nome, colete rápido: humor/energia, procure entender bem o humor contexto (atividade/momento), preferências e restrições, idioma/década, instrumental ou voz.
- Finalize assim que tiver informações suficientes para sugerir até 10 músicas. Sem esperar número fixo de turnos.
- Não repita músicas já oferecidas na conversa.
Saída:
- Durante a conversa: nunca use JSON nem estruturas com chaves/colchetes/aspas de objeto.
- Nunca envie a lista das músicas, apenas a playlist pronta
- Ao finalizar quando instruído pelo sistema: produza SOMENTE o JSON exato:
{
  "mood": "string",
  "rationale": "string",
  "songs": ["Artista - Título", ... (máx 10, todas inéditas)]
}
Nada antes ou depois do JSON.
"""

FINALIZE_KEYWORDS = [
    "cria a playlist","pode criar","finaliza","finalizar","manda ver",
    "bora criar","bora fechar","fechar playlist","tá pronta","criar playlist","ok fecha","pode fechar"
]

MIN_TURNS = 2
MAX_TURNS = 8

def coverage_score(messages: List[Dict[str, str]]) -> int:
    txt = " ".join(m["content"].lower() for m in messages if m["role"] == "user")[-2000:]
    score = 0
    if any(w in txt for w in ["relax", "relaxar", "calmo", "calma", "foco", "focado", "euforia", "animado", "triste", "ansioso", "ansiosa", "dormir", "sono", "treino", "trabalho"]):
        score += 1
    if any(w in txt for w in ["estudo", "trabalho", "corrida", "academia", "noite", "manhã", "tarde", "dirigindo", "cozinhando"]):
        score += 1
    if any(w in txt for w in ["gosto", "curto", "prefiro", "evita", "odeio", "não gosto", "pop", "rock", "mpb", "lofi", "jazz", "eletrônica", "funk", "sertanejo", "k-pop"]):
        score += 1
    if any(w in txt for w in ["inglês", "português", "espanhol", "anos 80", "anos 90", "2000", "2010", "2015"]):
        score += 1
    if any(w in txt for w in ["instrumental", "sem voz", "com voz", "vocal"]):
        score += 1
    return score

def ensure_session(session_id: str) -> Dict[str, Any]:
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {
            "messages": [],
            "token": None,
            "user": None,
            "mood": None,
            "songs": [],
            "all_songs": [],
            "name_known": False,
        }
    SESSIONS[session_id]["last_seen"] = time.time()
    return SESSIONS[session_id]


def parse_llm_songs(reply: str) -> Optional[Dict[str, Any]]:
    import json
    text = reply or ""
    if "```" in text:
        blocks = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.S)
        if blocks:
            try:
                return json.loads(blocks[-1])
            except Exception:
                pass
    pat = re.compile(r"\{[^{}]*\"songs\"\s*:\s*\[[\s\S]*?\][^{}]*\}", re.S)
    m = pat.search(text)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    t = text.strip()
    if t.startswith("{") and t.endswith("}") and '"songs"' in t:
        try:
            return json.loads(t)
        except Exception:
            pass
    return None

def looks_like_song_json(text: str) -> bool:
    t = (text or "").strip()
    return ('"songs"' in t and "{" in t and "}" in t) or ("```" in t and '"songs"' in t)

def visible_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    clean = []
    for m in messages:
        if m.get("role") == "assistant" and looks_like_song_json(m.get("content", "")):
            continue
        clean.append(m)
    return clean

NOT_A_NAME = {
    "oi", "olá", "ola", "oie", "eai", "e aí", "e ai", "opa", "hey", "hello", "hi",
    "bom dia", "boa tarde", "boa noite", "tudo bem", "tudo bem?", "blz", "beleza",
    "sim", "não", "nao", "ok", "bora", "vamos", "começar", "comecar",
}

def maybe_mark_name_known(session: Dict[str, Any], last_user_text: str):
    if session.get("name_known"):
        return
    txt = (last_user_text or "").strip()
    if not txt:
        return
    if re.search(r"\bmeu nome\b|\bme chama\b|\bchamo[- ]?me\b|\bsou (o|a)\b", txt, flags=re.I):
        session["name_known"] = True
        return
    # Resposta curta só conta como nome depois que o bot já perguntou,
    # e se não for só um cumprimento.
    bot_already_asked = any(m["role"] == "assistant" for m in session["messages"])
    cleaned = txt.lower().strip(" !.,?")
    if bot_already_asked and len(txt.split()) <= 3 and cleaned not in NOT_A_NAME and "?" not in txt:
        session["name_known"] = True

@app.post("/session/start", response_model=StartSessionResponse)
def start_session():
    purge_expired()
    sid = str(uuid.uuid4())
    ensure_session(sid)
    return StartSessionResponse(session_id=sid)

@app.get("/session/status", response_model=StatusResponse)
def session_status(session_id: str = Query(...)):
    if session_id not in SESSIONS:
        return StatusResponse(authenticated=False, user=None)
    s = ensure_session(session_id)
    return StatusResponse(authenticated=bool(s["token"]), user=s["user"])

@app.get("/auth/login")
def auth_login(session_id: str = Query(...)):
    purge_expired()
    ensure_session(session_id)
    state = secrets.token_urlsafe(32)
    OAUTH_STATES[state] = (session_id, time.time() + OAUTH_STATE_TTL_SECONDS)
    return {"auth_url": build_auth_url(state=state)}

@app.get("/callback")
def auth_callback(code: str = Query(None), state: str = Query(None)):
    if not code or not state:
        return HTMLResponse("<h3>Callback inválido (faltou code/state)</h3>", status_code=400)
    session_id, expires_at = OAUTH_STATES.pop(state, (None, 0))
    if not session_id or expires_at <= time.time() or session_id not in SESSIONS:
        return HTMLResponse("<h3>Login expirado ou inválido. Volte ao MoodTunes e conecte de novo.</h3>", status_code=400)
    s = ensure_session(session_id)
    try:
        token = exchange_code_for_token(code)
        me = get_current_user(token["access_token"])
    except Exception:
        logger.exception("Falha ao autenticar no Spotify")
        return HTMLResponse("<h3>Não consegui conectar ao Spotify. Volte ao MoodTunes e tente de novo.</h3>", status_code=400)
    s["token"] = token
    s["user"] = {"id": me.get("id"), "display_name": me.get("display_name")}
    target = f"{FRONTEND_BASE_URL}?session_id={session_id}&auth=ok"
    return RedirectResponse(url=target, status_code=302)

@app.get("/callback/")
def auth_callback_trailing(code: str = Query(None), state: str = Query(None)):
    return auth_callback(code, state)

@app.post("/chat/send", response_model=ChatSendResponse)
def chat_send(req: ChatSendRequest):
    s = ensure_session(req.session_id)
    maybe_mark_name_known(s, req.message)
    s["messages"].append({"role": "user", "content": req.message})
    user_turns = sum(1 for m in s["messages"] if m["role"] == "user")
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    if not s.get("name_known"):
        msgs += [m for m in s["messages"] if m["role"] in ("user","assistant")][-2:]
    else:
        msgs += s["messages"]
    cov = coverage_score(s["messages"])
    finalize_intent = any(kw in req.message.lower() for kw in FINALIZE_KEYWORDS)
    force_json = (
        bool(s.get("name_known"))
        and (
            cov >= 3
            or user_turns >= MAX_TURNS
            or (finalize_intent and (cov >= 2 or user_turns >= MIN_TURNS))
        )
    )
    if force_json:
        msgs.append({"role": "system", "content": "You must now output ONLY the JSON with up to 10 songs."})
    try:
        client = get_groq()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=msgs,
            temperature=0.6,
            max_tokens=1500,
            # modelo com raciocínio: esforço baixo para sobrar espaço para a resposta
            extra_body={"reasoning_effort": "low"},
        )
        reply = (resp.choices[0].message.content or "").strip()
        if not reply:
            raise RuntimeError("resposta vazia do modelo")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro Groq: {e}")
    parsed = parse_llm_songs(reply)
    suggestions: List[Dict[str, Any]] = []
    finalized = False
    playlist_info: Optional[Dict[str, Any]] = None
    if parsed:
        s["mood"] = parsed.get("mood")
        raw_songs = parsed.get("songs", [])[:10]
        already = set(s.get("all_songs", []))
        unique_songs = [song for song in raw_songs if song not in already]
        s["all_songs"].extend(unique_songs)
        s["songs"] = unique_songs
        if not unique_songs:
            s["messages"].append({"role": "assistant", "content": "Essas faixas já foram usadas. Me diga um gênero/era diferente ou se prefere instrumental/voz para eu sugerir inéditas."})
            return ChatSendResponse(messages=visible_messages(s["messages"]), pending=False, suggestions=[], finalized=False, playlist=None)
        if not s["token"]:
            suggestions = [{"query": q} for q in unique_songs]
            s["messages"].append({"role": "assistant", "content": "Conecte seu Spotify para eu criar sua playlist automaticamente."})
            return ChatSendResponse(messages=visible_messages(s["messages"]), pending=False, suggestions=suggestions, finalized=False, playlist=None)
        try:
            s["token"] = ensure_token(s["token"])
            access = s["token"]["access_token"]
            me = s.get("user") or get_current_user(access)
            user_id = me.get("id")
            track_objs = []
            uris = []
            for q in unique_songs:
                t = search_track_full(access, q)
                if t:
                    track_objs.append(t)
                    uris.append(t["uri"])
            pl = None
            if uris:
                pl = create_playlist(access, user_id, name=f"MoodTunes • {s['mood'] or 'Mood'}", description="Gerada automaticamente pelo MoodTunes.", public=False)
                add_tracks_to_playlist(access, pl["id"], uris)
        except (requests.RequestException, KeyError) as e:
            logger.exception("Falha ao falar com o Spotify")
            # Libera as faixas para uma nova tentativa.
            s["all_songs"] = [x for x in s["all_songs"] if x not in unique_songs]
            resp_err = getattr(e, "response", None)
            status = getattr(resp_err, "status_code", None)
            token_refresh_failed = status == 400 and "accounts.spotify.com" in (getattr(resp_err, "url", "") or "")
            if isinstance(e, KeyError) or status == 401 or token_refresh_failed:
                s["token"] = None
                s["user"] = None
                msg = "Sua conexão com o Spotify caiu. Conecte de novo e eu fecho a playlist."
            elif status == 429:
                msg = "O Spotify pediu um respiro. Espera uns segundos e manda de novo."
            else:
                msg = "O Spotify não respondeu agora. Tenta de novo em instantes."
            s["messages"].append({"role": "assistant", "content": msg})
            return ChatSendResponse(messages=visible_messages(s["messages"]), pending=False, suggestions=[{"query": q} for q in unique_songs], finalized=False, playlist=None)
        suggestions = track_objs
        if pl:
            playlist_url = pl.get("external_urls", {}).get("spotify")
            playlist_info = {"id": pl["id"], "url": playlist_url, "name": pl.get("name")}
            finalized = True
            s["messages"].append({"role": "assistant", "content": f"Playlist feita. Aumente o volume e testa a potência."})
        else:
            s["messages"].append({"role": "assistant", "content": "Não encontrei essas faixas. Me dê outro direcionamento e eu recalculo em segundos."})
    else:
        if not looks_like_song_json(reply):
            s["messages"].append({"role": "assistant", "content": reply})
    return ChatSendResponse(messages=visible_messages(s["messages"]), pending=not bool(parsed), suggestions=suggestions, finalized=finalized, playlist=playlist_info)
