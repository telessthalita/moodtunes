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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_BASE_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

SYSTEM_PROMPT = """Você é o MoodTunes, um DJ-terapeuta de bolso: caloroso, minimalista, assertivo e empático, com humor sutil. Na primeira resposta, apresente-se brevemente como “MoodTunes, seu DJ-terapeuta” e convide a usuária a desabafar em uma frase.
Objetivo: em ATÉ 5 turnos da usuária, entender humor e contexto e, somente no fechamento, emitir um JSON final com ATÉ 5 músicas específicas.
Diretrizes de estilo:
- Sempre em português do Brasil. Trate a usuária por “Senhorita TT”.
- Respostas curtíssimas, calmas e confiantes. Uma pergunta por turno.
- Tom acolhedor e terapêutico, sem jargão clínico. Metáforas musicais leves.
- Não ofereça listas de músicas durante a conversa.
Coleta rápida:
1) Humor/energia (ex.: relaxar, foco, euforia)
2) Contexto (atividade, momento do dia)
3) Preferências e restrições (gêneros/artistas a evitar)
4) Idioma/década desejada
5) Instrumental ou com voz
Política de saída:
- Durante a conversa: NUNCA use JSON, chaves, colchetes ou aspas em formato de estrutura.
- Quando instruída pelo sistema para finalizar: produza SOMENTE o JSON no formato exato:
{
  "mood": "string",
  "rationale": "string",
  "songs": ["Artista - Título", ... (máx 5)]
}
Nada antes ou depois do JSON.
"""

FINALIZE_KEYWORDS = [
    "cria a playlist","pode criar","finaliza","finalizar","manda ver",
    "bora","fechar playlist","tá pronta","criar playlist","ok fecha","segue","pode fechar"
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

def looks_like_song_json(text: str) -> bool:
    t = (text or "").strip()
    return ('"songs"' in t and t.startswith("{") and t.endswith("}")) or ("```" in t and '"songs"' in t)

def visible_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    clean = []
    for m in messages:
        if m.get("role") == "assistant" and looks_like_song_json(m.get("content", "")):
            continue
        clean.append(m)
    return clean

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
        raw_songs = parsed.get("songs", [])[:5]
        s["songs"] = raw_songs
        if not s["token"]:
            suggestions = [{"query": q} for q in raw_songs]
            s["messages"].append({"role": "assistant", "content": "Entendi sua vibe. Conecte o Spotify para eu criar sua playlist automaticamente."})
            return ChatSendResponse(messages=visible_messages(s["messages"]), pending=False, suggestions=suggestions, finalized=False, playlist=None)
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
            pl = create_playlist(access, user_id, name=f"MoodTunes • {s['mood'] or 'Mood'}", description="Gerada automaticamente pelo MoodTunes.", public=False)
            add_tracks_to_playlist(access, pl["id"], uris)
            playlist_url = pl.get("external_urls", {}).get("spotify")
            playlist_info = {"id": pl["id"], "url": playlist_url, "name": pl.get("name")}
            finalized = True
            s["messages"].append({"role": "assistant", "content": f"Playlist criada: {playlist_info['name']}."})
        else:
            s["messages"].append({"role": "assistant", "content": "Não consegui resolver as faixas. Pode ajustar os títulos?"})
    else:
        if not looks_like_song_json(reply):
            s["messages"].append({"role": "assistant", "content": reply})
    return ChatSendResponse(messages=visible_messages(s["messages"]), pending=not bool(parsed), suggestions=suggestions, finalized=finalized, playlist=playlist_info)
