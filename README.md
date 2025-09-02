## Run locally
3. Install deps:
```bash
pip install -r requirements.txt
```
4. Start API (HTTP):
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```


### OAuth URLs
- Start: `GET /auth/spotify` → redirects to Spotify consent.
- Callback: configure the **Redirect URI** in your Spotify App to the same as `SPOTIFY_REDIRECT_URI` in `.env`.


### Chat Contract (Lovable)
- POST `/chat`
```json
{
"session_id": "<from /callback redirect>",
"messages": [
{"role": "user", "content": "Estou exausta mas quero manter foco"},
{"role": "assistant", "content": "Entendi. Quer algo instrumental?"},
{"role": "user", "content": "Sim, sem vocal"}
]
}
```
- Response
```json
{
"session_id": "abc.xyz",
"mood": "Focus",
"playlist": {
"id": "1x2y3z",
"name": "Radar de Foco Profundo",
"description": "Beats instrumentais para entrar em flow — Playlist criada pelo MoodTunes",
"cover_url": "...",
"external_url": "https://open.spotify.com/playlist/1x2y3z",
"embed_url": "https://open.spotify.com/embed/playlist/1x2y3z"
}
}
```