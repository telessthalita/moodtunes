import os
import uuid
from typing import Dict, Any, List, Optional

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

def get_groq():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("Defina GROQ_API_KEY no .env")
    return Groq(api_key=key)

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
- Após saber o nome, colete rápido: humor/energia, contexto (atividade/momento), preferências e restrições, idioma/década, instrumental ou voz.
- Finalize assim que tiver informações suficientes para sugerir até 5 músicas. Sem esperar número fixo de turnos.
- Não repita músicas já oferecidas na conversa.
Saída:
- Durante a conversa: nunca use JSON nem estruturas com chaves/colchetes/aspas de objeto.
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
    "bora","fechar playlist","tá pronta","criar playlist","ok fecha","segue","pode fechar"
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
    return SESSIONS[session_id]

def parse_llm_songs(reply: str) -> Optional[Dict[str, Any]]:
    import json, re
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

def maybe_mark_name_known(session: Dict[str, Any], last_user_text: str):
    import re
    if session.get("name_known"):
        return
    txt = (last_user_text or "").strip()
    if not txt:
        return
    if re.search(r"\bmeu nome\b|\bme chama\b|\bchamo[- ]?me\b|\bsou (o|a)\b", txt, flags=re.I) or len(txt.split()) <= 3:
        session["name_known"] = True

@app.post("/session/start", response_model=StartSessionResponse)
def start_session():
    sid = str(uuid.uuid4())
    ensure_session(sid)
    return StartSessionResponse(session_id=sid)

@app.get("/session/status", response_model=StatusResponse)
def session_status(session_id: str = Query(...)):
    s = ensure_session(session_id)
    token = s["token"]
    user = s["user"]
    return StatusResponse(authenticated=bool(token), user=user)

@app.get("/auth/login")
def auth_login(session_id: str = Query(...)):
    url = build_auth_url(state=session_id)
    return {"auth_url": url}

@app.get("/callback")
def auth_callback(code: str = Query(None), state: str = Query(None)):
    if not code or not state:
        return HTMLResponse("<h3>Callback inválido (faltou code/state)</h3>", status_code=400)
    s = ensure_session(state)
    try:
        token = exchange_code_for_token(code)
        s["token"] = token
        me = get_current_user(token["access_token"])
        s["user"] = {"id": me.get("id"), "display_name": me.get("display_name")}
        target = f"{FRONTEND_BASE_URL}?session_id={state}&auth=ok"
        return RedirectResponse(url=target, status_code=302)
    except Exception as e:
        return HTMLResponse(f"<h3>Falha ao autenticar: {e}</h3>", status_code=400)

@app.get("/callback/")
def auth_callback_trailing(code: str = Query(None), state: str = Query(None)):
    return auth_callback(code, state)

@app.post("/chat/send", response_model=ChatSendResponse)
def chat_send(req: ChatSendRequest):
    s = ensure_session(req.session_id)
    s["messages"].append({"role": "user", "content": req.message})
    maybe_mark_name_known(s, req.message)
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
            model="llama-3.1-8b-instant",
            messages=msgs,
            temperature=0.6,
            max_tokens=512,
        )
        reply = resp.choices[0].message.content.strip()
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
        suggestions = track_objs
        if uris:
            pl = create_playlist(access, user_id, name=f"MoodTunes • {s['mood'] or 'Mood'}", description="Gerada automaticamente pelo MoodTunes.", public=False)
            add_tracks_to_playlist(access, pl["id"], uris)
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
