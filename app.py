import os
import uuid
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
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

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("Defina GROQ_API_KEY no .env")

client = Groq(api_key=GROQ_API_KEY)

app = FastAPI(title="MoodTunes API", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Memória em processo (dev)
# -------------------------
SESSIONS: Dict[str, Dict[str, Any]] = {}
# session: {
#   "messages": [{"role":"user"/"assistant","content":str}, ...],
#   "token": {access_token, refresh_token, expires_at, ...} | None,
#   "user": {id, display_name, ...} | None,
#   "mood": str | None,
#   "songs": [ "Artista - Título", ... ] | [],
# }

# -------------------------
# Models
# -------------------------
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

# -------------------------
# Helpers
# -------------------------
SYSTEM_PROMPT = """\
Você é oMoodTunes, concierge musical concisa, sagaz e empática.
Objetivo: entender o humor e o contexto da usuária em ATÉ 5 turnos e então responder com ATÉ 5 músicas específicas.
Regras:
- Responda SEMPRE em português do Brasil, chamando a usuária de "Senhorita TT".
- Mantenha mensagens curtas e colaborativas. Faça perguntas objetivas.
- Quando estiver pronta, responda APENAS com um JSON contendo:
  {
    "mood": "string",
    "rationale": "string",
    "songs": ["Artista - Título", ... (máx 5)]
  }
- Nunca inclua mais de 5 músicas.
- Após enviar o JSON, pare de falar.
"""

FINALIZE_KEYWORDS = [
    "cria a playlist","pode criar","finaliza","finalizar","manda ver",
    "bora","fechar playlist","tá pronta","criar playlist"
]

def ensure_session(session_id: str) -> Dict[str, Any]:
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {
            "messages": [],
            "token": None,
            "user": None,
            "mood": None,
            "songs": [],
        }
    return SESSIONS[session_id]

def parse_llm_songs(reply: str) -> Optional[Dict[str, Any]]:
    import json, re
    text = reply
    if "```" in reply:
        blocks = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", reply, flags=re.S)
        if blocks:
            text = blocks[-1]
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and "songs" in obj:
            return obj
    except Exception:
        pass
    return None

# -------------------------
# API
# -------------------------

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
        return HTMLResponse("<h3>Spotify conectado. Você pode voltar ao app.</h3>")
    except Exception as e:
        return HTMLResponse(f"<h3>Falha ao autenticar: {e}</h3>", status_code=400)

@app.post("/chat/send", response_model=ChatSendResponse)
def chat_send(req: ChatSendRequest):
    s = ensure_session(req.session_id)

    s["messages"].append({"role": "user", "content": req.message})

    user_turns = sum(1 for m in s["messages"] if m["role"] == "user")
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}] + s["messages"]

    force_json = user_turns >= 5 or any(kw in req.message.lower() for kw in FINALIZE_KEYWORDS)
    if force_json:
        msgs.append({"role": "system", "content": "You must now output ONLY the JSON with up to 5 songs."})

    try:
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
        raw_songs = parsed.get("songs", [])[:5]
        s["songs"] = raw_songs

        if not s["token"]:
            suggestions = [{"query": q} for q in raw_songs]
            s["messages"].append({"role": "assistant", "content": "Tenho a shortlist. Conecte o Spotify para eu criar a playlist automaticamente."})
            return ChatSendResponse(
                messages=s["messages"], pending=False, suggestions=suggestions, finalized=False, playlist=None
            )
        s["token"] = ensure_token(s["token"])
        access = s["token"]["access_token"]
        me = s.get("user") or get_current_user(access)
        user_id = me.get("id")

        track_objs = []
        uris = []
        for q in raw_songs:
            t = search_track_full(access, q)
            if t:
                track_objs.append(t)
                uris.append(t["uri"])

        suggestions = track_objs

        if uris:
            pl = create_playlist(
                access, user_id,
                name=f"MoodTunes • {s['mood'] or 'Mood'}",
                description="Gerada automaticamente pelo MoodTunes.",
                public=False
            )
            add_tracks_to_playlist(access, pl["id"], uris)
            playlist_url = pl.get("external_urls", {}).get("spotify")
            playlist_info = {"id": pl["id"], "url": playlist_url, "name": pl.get("name")}
            finalized = True
            s["messages"].append({"role": "assistant", "content": f"Playlist criada automaticamente: {playlist_info['name']}"})
        else:
            s["messages"].append({"role": "assistant", "content": "Não consegui resolver as faixas. Pode ajustar os títulos?"})

    else:
        s["messages"].append({"role": "assistant", "content": reply})

    return ChatSendResponse(
        messages=s["messages"],
        pending=not bool(parsed),
        suggestions=suggestions,
        finalized=finalized,
        playlist=playlist_info
    )
