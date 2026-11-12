import os
import re
import json
import html
import time
import uuid
import secrets
import logging
from typing import Dict, Any, List, Optional

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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
GROQ_FALLBACK_MODEL = os.getenv("GROQ_FALLBACK_MODEL", "openai/gpt-oss-120b")

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

# Guarda opcional no Upstash Redis, para login e conversa sobreviverem a
# reinícios do servidor. Sem as variáveis, tudo fica só em memória.
UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
STORE_TTL_SECONDS = 30 * 24 * 60 * 60
STORED_FIELDS = ("messages", "token", "user", "mood", "songs", "all_songs")
MAX_STORED_MESSAGES = 60
SESSION_ID_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")

LAST_REDIS_ERROR = ""

def redis_cmd(*cmd: str):
    if not (UPSTASH_URL and UPSTASH_TOKEN):
        return None
    global LAST_REDIS_ERROR
    try:
        r = requests.post(UPSTASH_URL, json=list(cmd), headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"}, timeout=5)
        if r.status_code >= 400:
            # A resposta de erro do Upstash não traz o token, só o motivo.
            LAST_REDIS_ERROR = f"HTTP {r.status_code}: {r.text[:120]}"
            logger.error("Redis recusou %s: %s", cmd[0], LAST_REDIS_ERROR)
            return None
        LAST_REDIS_ERROR = ""
        return r.json().get("result")
    except Exception as e:
        LAST_REDIS_ERROR = type(e).__name__
        logger.exception("Falha ao falar com o Redis")
        return None

def load_session(session_id: str) -> Optional[Dict[str, Any]]:
    if not SESSION_ID_RE.match(session_id or ""):
        return None
    raw = redis_cmd("GET", f"moodtunes:session:{session_id}")
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except ValueError:
        return None

def save_session(session_id: str) -> None:
    s = SESSIONS.get(session_id)
    # Sessão vazia não vale a pena guardar.
    if not s or not (s.get("token") or s.get("messages")) or not SESSION_ID_RE.match(session_id):
        return
    data = {k: s.get(k) for k in STORED_FIELDS}
    data["messages"] = (data["messages"] or [])[-MAX_STORED_MESSAGES:]
    redis_cmd("SET", f"moodtunes:session:{session_id}", json.dumps(data), "EX", str(STORE_TTL_SECONDS))

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

SYSTEM_PROMPT = """Você é o MoodTunes, um DJ no estilo Tony Stark: confiante, sagaz, direto e acolhedor. Você conversa com a pessoa para montar uma playlist no Spotify.

Como conversar:
- Português do Brasil, informal. Respostas de 1 ou 2 frases curtas, em um parágrafo só. Humor rápido, sem arrogância. Sem emojis.
- Antes de responder, releia a conversa inteira. Nunca repita uma pergunta que já foi respondida e nunca peça de novo algo que a pessoa já contou, mesmo que ela tenha contado antes de você perguntar.
- Comece cada resposta reagindo em poucas palavras ao que a pessoa acabou de dizer. Depois faça UMA pergunta nova.
- Apresente-se como "DJ com armadura tecnológica" somente na sua primeira resposta. Depois disso, nunca mais se apresente.
- Se ainda não souber o nome, pergunte uma única vez. Quando souber, use o nome de vez em quando, sem exagero. Se a pessoa não quiser dizer, siga sem o nome.
- Se a pessoa reclamar que já respondeu, peça desculpa em poucas palavras, retome o que ela disse e siga para a próxima pergunta.

O que descobrir, pulando o que você já sabe:
1. humor e energia do momento
2. o que a pessoa vai fazer enquanto ouve
3. gêneros ou artistas que curte ou quer evitar
4. com voz ou instrumental, idioma ou época, só se fizer sentido
Não precisa de tudo. Com humor, contexto e uma preferência já dá para fechar.

Saída:
- Durante a conversa: texto simples. Nunca use JSON, chaves, colchetes ou listas.
- Nunca escreva a lista de músicas na conversa. A playlist é entregue pronta.
- Quando o sistema mandar finalizar, produza SOMENTE este JSON, sem nada antes ou depois:
{
  "mood": "duas ou três palavras para o nome da playlist",
  "rationale": "uma frase curta falando direto com a pessoa, explicando a escolha a partir do que ela contou",
  "songs": ["Artista - Título", "..."]
}
- Em "songs": de 8 a 10 músicas reais, que existem no Spotify, sem repetir nenhuma já sugerida.
"""

FINALIZE_KEYWORDS = [
    "cria a playlist","pode criar","finaliza","finalizar","manda ver",
    "bora criar","bora fechar","fechar playlist","tá pronta","criar playlist","ok fecha","pode fechar"
]

MIN_TURNS = 3
MAX_TURNS = 8
MAX_HISTORY = 30

def coverage_score(messages: List[Dict[str, str]]) -> int:
    txt = " ".join(m["content"].lower() for m in messages if m["role"] == "user")[-2000:]
    score = 0
    if any(w in txt for w in ["relax", "relaxar", "calmo", "calma", "foco", "focado", "euforia", "animado", "triste", "ansioso", "ansiosa", "dormir", "sono", "treino", "trabalho", "feliz", "alegre", "confiante", "cansad", "estressad", "pra baixo", "focar", "festa", "produtiv", "tranquil", "animada"]):
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
        }
        stored = load_session(session_id)
        if stored:
            for k in STORED_FIELDS:
                if stored.get(k) is not None:
                    SESSIONS[session_id][k] = stored[k]
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

def song_key(song: str) -> str:
    """Chave para comparar músicas ignorando maiúsculas, traços e '(Instrumental)'."""
    t = re.sub(r"\([^)]*\)", " ", song.lower())
    t = re.sub(r"[–—-]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

def final_message(parsed: Dict[str, Any]) -> str:
    rationale = str(parsed.get("rationale") or "").strip()
    closing = "Playlist pronta na sua conta. Aumenta o volume."
    if not rationale or len(rationale) > 240 or "{" in rationale:
        return closing
    if rationale[-1] not in ".!?":
        rationale += "."
    return f"{rationale} {closing}"

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

LOGIN_DONE_PAGE = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MoodTunes</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0F0E0D;color:#F3F0EA;font-family:system-ui,sans-serif;text-align:center;padding:24px}a{color:#A78BFA}</style>
</head><body><div><h2>Spotify conectado.</h2><p>Pode fechar esta janela. <a id="back" href="__TARGET__">Voltar pro MoodTunes</a></p></div>
<script>
window.close();
setTimeout(function(){ if(!window.closed){ location.replace(document.getElementById('back').href); } }, 1500);
</script></body></html>"""

@app.get("/health")
def health():
    """Diz se a API está de pé e onde as sessões estão sendo guardadas."""
    if not (UPSTASH_URL and UPSTASH_TOKEN):
        return {"ok": True, "store": "memory"}
    stamp = str(int(time.time()))
    redis_cmd("SET", "moodtunes:health", stamp, "EX", "60")
    ok = redis_cmd("GET", "moodtunes:health") == stamp
    if ok:
        return {"ok": True, "store": "redis"}
    return {"ok": False, "store": "redis_error", "detail": LAST_REDIS_ERROR}

@app.post("/session/start", response_model=StartSessionResponse)
def start_session():
    purge_expired()
    sid = str(uuid.uuid4())
    ensure_session(sid)
    return StartSessionResponse(session_id=sid)

@app.get("/session/status", response_model=StatusResponse)
def session_status(session_id: str = Query(...)):
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
    if not session_id or expires_at <= time.time():
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
    save_session(session_id)
    # A janela de login se fecha sozinha; a página principal percebe o login
    # consultando /session/status. Se não der para fechar (login aberto na
    # mesma aba), volta para o site.
    target = html.escape(f"{FRONTEND_BASE_URL}?session_id={session_id}&auth=ok", quote=True)
    return HTMLResponse(LOGIN_DONE_PAGE.replace("__TARGET__", target))

@app.get("/callback/")
def auth_callback_trailing(code: str = Query(None), state: str = Query(None)):
    return auth_callback(code, state)

@app.post("/chat/send", response_model=ChatSendResponse)
def chat_send(req: ChatSendRequest):
    try:
        return _chat_send(req)
    finally:
        save_session(req.session_id)

def _chat_send(req: ChatSendRequest) -> ChatSendResponse:
    s = ensure_session(req.session_id)
    s["messages"].append({"role": "user", "content": req.message})
    user_turns = sum(1 for m in s["messages"] if m["role"] == "user")
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    msgs += [m for m in s["messages"] if m["role"] in ("user", "assistant")][-MAX_HISTORY:]
    cov = coverage_score(s["messages"])
    finalize_intent = any(kw in req.message.lower() for kw in FINALIZE_KEYWORDS)
    force_json = (
        user_turns >= MIN_TURNS
        and (
            cov >= 3
            or user_turns >= MAX_TURNS
            or (finalize_intent and cov >= 1)
        )
    )
    if force_json:
        msgs.append({"role": "system", "content": "Hora de finalizar. Responda SOMENTE com o JSON descrito, com 8 a 10 músicas reais."})
    reply = ""
    # O modelo às vezes devolve uma saída que a Groq não consegue ler.
    # Tenta de novo e, na última, usa o modelo reserva.
    for model in (GROQ_MODEL, GROQ_MODEL, GROQ_FALLBACK_MODEL):
        try:
            resp = get_groq().chat.completions.create(
                model=model,
                messages=msgs,
                temperature=0.6,
                max_tokens=1500,
                # modelo com raciocínio: esforço baixo para sobrar espaço para a resposta
                extra_body={"reasoning_effort": "low"},
                # na hora de fechar, obriga a resposta a ser um JSON válido
                **({"response_format": {"type": "json_object"}} if force_json else {}),
            )
            reply = (resp.choices[0].message.content or "").strip()
            if reply:
                break
        except Exception:
            logger.exception("Falha na Groq com o modelo %s", model)
    if not reply:
        s["messages"].append({"role": "assistant", "content": "Deu um engasgo aqui do meu lado. Manda de novo?"})
        return ChatSendResponse(messages=visible_messages(s["messages"]), pending=True, suggestions=[], finalized=False, playlist=None)
    parsed = parse_llm_songs(reply)
    suggestions: List[Dict[str, Any]] = []
    finalized = False
    playlist_info: Optional[Dict[str, Any]] = None
    if parsed:
        s["mood"] = parsed.get("mood")
        raw_songs = [x.strip() for x in parsed.get("songs", []) if isinstance(x, str) and x.strip()][:10]
        already = set(s.get("all_songs", []))
        unique_songs = []
        for song in raw_songs:
            key = song_key(song)
            if key not in already:
                already.add(key)
                unique_songs.append(song)
        s["songs"] = unique_songs
        if not unique_songs:
            s["messages"].append({"role": "assistant", "content": "Essas faixas já foram usadas. Me diga um gênero/era diferente ou se prefere instrumental/voz para eu sugerir inéditas."})
            return ChatSendResponse(messages=visible_messages(s["messages"]), pending=False, suggestions=[], finalized=False, playlist=None)
        if not s["token"]:
            suggestions = [{"query": q} for q in unique_songs]
            s["messages"].append({"role": "assistant", "content": "Conecte seu Spotify para eu criar sua playlist automaticamente."})
            return ChatSendResponse(messages=visible_messages(s["messages"]), pending=False, suggestions=suggestions, finalized=False, playlist=None)
        used_keys = {song_key(x) for x in unique_songs}
        s["all_songs"].extend(used_keys)
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
            s["all_songs"] = [x for x in s["all_songs"] if x not in used_keys]
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
            s["messages"].append({"role": "assistant", "content": final_message(parsed)})
        else:
            s["messages"].append({"role": "assistant", "content": "Não encontrei essas faixas. Me dê outro direcionamento e eu recalculo em segundos."})
    else:
        if not looks_like_song_json(reply):
            s["messages"].append({"role": "assistant", "content": reply})
    return ChatSendResponse(messages=visible_messages(s["messages"]), pending=not bool(parsed), suggestions=suggestions, finalized=finalized, playlist=playlist_info)
