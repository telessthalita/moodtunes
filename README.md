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



```