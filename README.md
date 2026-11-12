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

## Redis (Upstash)

O Redis é opcional e serve para a pessoa continuar logada no Spotify depois de atualizar a página, mesmo que o servidor tenha reiniciado. O projeto usa o plano grátis do [Upstash](https://upstash.com), pela API REST, então não precisa instalar nenhuma biblioteca extra.

### O que fica guardado

Cada sessão vira uma chave `moodtunes:session:<session_id>`, com validade de 30 dias, contendo:

- o token do Spotify (acesso e renovação)
- o usuário conectado
- as últimas 60 mensagens da conversa
- as músicas já sugeridas

Sessão vazia (sem login e sem mensagem) não é gravada. O token do Spotify nunca vai para o navegador.

### Como configurar

1. Crie um banco Redis no [console do Upstash](https://console.upstash.com), no plano Free.
2. Abra o banco e vá na seção **Connect**, aba **REST**.
3. Deixe a opção **Read-Only Token** desmarcada.
4. Copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`, só o valor entre as aspas.
5. No Render, abra o serviço da API, vá em **Environment**, crie as duas variáveis com esses nomes e salve com deploy. Para rodar localmente, coloque as duas no `.env`.

### Como conferir

Abra `/health` na API:

| Resposta | O que significa |
| --- | --- |
| `"store": "redis"` | Tudo certo, gravando e lendo no Upstash |
| `"store": "memory"` | A API não achou as variáveis. Confira os nomes e se foram salvas no serviço certo |
| `"store": "redis_error"` | A API achou as variáveis, mas o Upstash recusou. O campo `detail` diz o motivo |

O erro mais comum é colar o token Read-Only: a leitura funciona, a gravação volta com 403 e nada é salvo.

### Se o Redis cair

A API continua funcionando com as sessões em memória. O que se perde é só a recuperação depois de um reinício.
