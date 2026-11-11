# MoodTunes API

Backend do MoodTunes. Um chat conversa com a pessoa, entende o humor do momento e cria uma playlist na conta dela no Spotify.

Feito com FastAPI, Groq (LLM) e a Web API do Spotify.

## Rodar localmente

1. Copie o arquivo de exemplo e preencha as chaves:
```bash
cp .env.example .env
```

2. Instale as dependências:
```bash
pip install -r requirements.txt
```

3. Suba a API:
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

A documentação interativa fica em `http://localhost:8000/docs`.

## Variáveis de ambiente

| Variável | Para que serve |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | Client ID do app no painel do Spotify |
| `SPOTIFY_CLIENT_SECRET` | Client Secret do mesmo app |
| `SPOTIFY_REDIRECT_URI` | Tem que ser igual à Redirect URI cadastrada no app do Spotify (termina em `/callback`) |
| `GROQ_API_KEY` | Chave da Groq |
| `FRONTEND_BASE_URL` | Endereço do front, para onde o login volta |
| `UPSTASH_REDIS_REST_URL` | Opcional. Endereço REST do banco no Upstash, para guardar login e conversa |
| `UPSTASH_REDIS_REST_TOKEN` | Opcional. Token REST do mesmo banco |
| `GROQ_MODEL` | Opcional. Modelo da Groq (padrão `openai/gpt-oss-20b`) |

## Rotas

| Rota | O que faz |
| --- | --- |
| `GET /health` | Diz se a API está de pé e se as sessões estão no Redis ou na memória |
| `POST /session/start` | Cria uma sessão e devolve o `session_id` |
| `GET /session/status?session_id=...` | Diz se a sessão já está conectada ao Spotify |
| `GET /auth/login?session_id=...` | Devolve a `auth_url` para abrir o login do Spotify |
| `GET /callback` | Retorno do Spotify. Mostra uma página que fecha a janela de login sozinha |
| `POST /chat/send` | Envia uma mensagem do chat. Quando há informação suficiente, cria a playlist |

## Onde as sessões ficam

Sem as variáveis do Upstash, as sessões ficam só na memória do servidor. Se o serviço reiniciar (no plano grátis do Render isso acontece quando ele dorme), as conversas e os logins se perdem.

Com as variáveis do Upstash preenchidas, o login do Spotify e a conversa ficam guardados por 30 dias e voltam sozinhos depois de um reinício.
