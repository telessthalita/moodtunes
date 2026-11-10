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

## Rotas

| Rota | O que faz |
| --- | --- |
| `POST /session/start` | Cria uma sessão e devolve o `session_id` |
| `GET /session/status?session_id=...` | Diz se a sessão já está conectada ao Spotify |
| `GET /auth/login?session_id=...` | Devolve a `auth_url` para abrir o login do Spotify |
| `GET /callback` | Retorno do Spotify. Redireciona para o front com `?session_id=...&auth=ok` |
| `POST /chat/send` | Envia uma mensagem do chat. Quando há informação suficiente, cria a playlist |

## Limitações conhecidas

As sessões ficam só na memória do servidor. Se o serviço reiniciar (no plano grátis do Render isso acontece quando ele dorme), as conversas e os logins se perdem. Sessões paradas há mais de 6 horas são apagadas.
