import os
import time
import base64
import requests
from urllib.parse import urlencode
from dotenv import load_dotenv

load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:8000/callback")
SPOTIFY_SCOPES = [
    "playlist-modify-public",
    "playlist-modify-private",
    "user-read-email",
]

AUTH_BASE = "https://accounts.spotify.com/authorize"
TOKEN_URL = "https://accounts.spotify.com/api/token"
API_BASE = "https://api.spotify.com/v1"

def _basic_auth_header() -> str:
    raw = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()
    return "Basic " + base64.b64encode(raw).decode()

def build_auth_url(state: str) -> str:
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": " ".join(SPOTIFY_SCOPES),
        "state": state,
        "show_dialog": "false",
    }
    return f"{AUTH_BASE}?{urlencode(params)}"

def exchange_code_for_token(code: str) -> dict:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
    }
    headers = {"Authorization": _basic_auth_header()}
    resp = requests.post(TOKEN_URL, data=data, headers=headers, timeout=30)
    resp.raise_for_status()
    token = resp.json()
    token["expires_at"] = int(time.time()) + int(token.get("expires_in", 3600))
    return token

def refresh_access_token(refresh_token: str) -> dict:
    data = {"grant_type": "refresh_token", "refresh_token": refresh_token}
    headers = {"Authorization": _basic_auth_header()}
    resp = requests.post(TOKEN_URL, data=data, headers=headers, timeout=30)
    resp.raise_for_status()
    token = resp.json()
    token["refresh_token"] = token.get("refresh_token", refresh_token)
    token["expires_at"] = int(time.time()) + int(token.get("expires_in", 3600))
    return token

def ensure_token(token: dict) -> dict:
    if not token:
        return token
    if token.get("expires_at", 0) - 60 <= int(time.time()):
        token = refresh_access_token(token["refresh_token"])
    return token

def api_get(access_token: str, path: str, params: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(f"{API_BASE}{path}", headers=headers, params=params or {}, timeout=30)
    resp.raise_for_status()
    return resp.json()

def api_post(access_token: str, path: str, body: dict) -> dict:
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    resp = requests.post(f"{API_BASE}{path}", headers=headers, json=body, timeout=30)
    resp.raise_for_status()
    return resp.json() if resp.text else {}

def get_current_user(access_token: str) -> dict:
    return api_get(access_token, "/me")

def search_track_full(access_token: str, query: str) -> dict | None:
    data = api_get(access_token, "/search", {"q": query, "type": "track", "limit": 1})
    items = data.get("tracks", {}).get("items", [])
    if not items:
        return None
    t = items[0]
    artists = ", ".join(a["name"] for a in t.get("artists", []))
    return {
        "uri": t["uri"],
        "name": t["name"],
        "artist": artists,
        "preview_url": t.get("preview_url"),
        "external_url": t.get("external_urls", {}).get("spotify"),
        "id": t.get("id"),
    }

def create_playlist(access_token: str, user_id: str, name: str, description: str = "", public: bool = False) -> dict:
    pl = api_post(access_token, f"/users/{user_id}/playlists", {
        "name": name, "description": description, "public": public,
    })
    return pl

def add_tracks_to_playlist(access_token: str, playlist_id: str, uris: list[str]) -> None:
    if not uris:
        return
    api_post(access_token, f"/playlists/{playlist_id}/tracks", {"uris": uris})
