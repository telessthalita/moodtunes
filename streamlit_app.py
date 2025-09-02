import json
import requests
import streamlit as st

st.set_page_config(page_title="MoodTunes — Test Harness", layout="centered")

st.title("🎧 MoodTunes — Test Harness")

# 1) Config: API base (pode ser localhost ou URL do ngrok/Render)
default_api_base = "http://localhost:8000"
api_base = st.text_input("API Base URL", value=default_api_base, help="Ex.: http://localhost:8000 ou https://SEU-TUNEL.ngrok-free.app")

st.caption("Dica: se o Spotify exigir HTTPS, use um túnel (ngrok) e coloque a URL aqui.")

# 2) OAuth helper
st.subheader("1) Autenticação Spotify")
oauth_url = f"{api_base}/auth/spotify"
st.markdown(f"[🔑 Abrir login do Spotify]({oauth_url})", help="Clique, autorize e depois copie o session_id da tela /welcome")

session_id = st.text_input("session_id (copie da tela /welcome)", value=st.session_state.get("session_id", ""))

col1, col2 = st.columns(2)
with col1:
    if st.button("Salvar session_id"):
        st.session_state["session_id"] = session_id
        st.success("session_id salvo na sessão.")

with col2:
    if st.button("Testar /health"):
        try:
            r = requests.get(f"{api_base}/health", timeout=10)
            st.write(r.status_code, r.json())
        except Exception as e:
            st.error(f"Falha no /health: {e}")

st.divider()

# 3) Chat (máx. 5 mensagens do usuário)
st.subheader("2) Chat → Criar Playlist")

if "messages" not in st.session_state:
    st.session_state["messages"] = []

# Caixa de entrada
user_msg = st.text_input("Mensagem do usuário (ex.: 'Quero algo feliz pra correr')", "")

colA, colB, colC = st.columns(3)
with colA:
    if st.button("Adicionar mensagem do usuário"):
        if user_msg.strip():
            # Cada clique adiciona um turno de 'user'
            st.session_state["messages"].append({"role": "user", "content": user_msg.strip()})
        else:
            st.warning("Digite algo antes de adicionar.")

with colB:
    if st.button("Adicionar resposta do assistente (opcional)"):
        if user_msg.strip():
            st.session_state["messages"].append({"role": "assistant", "content": user_msg.strip()})
        else:
            st.warning("Digite algo antes de adicionar.")

with colC:
    if st.button("Limpar mensagens"):
        st.session_state["messages"] = []
        st.info("Mensagens limpas.")

st.write("**Mensagens atuais** (máx. 5 do usuário no MVP):")
st.code(json.dumps(st.session_state["messages"], ensure_ascii=False, indent=2), language="json")

# 4) Disparo do /chat
if st.button("Enviar para /chat e criar playlist"):
    if not st.session_state.get("session_id"):
        st.error("Falta session_id. Faça login no Spotify e cole o session_id.")
    elif not st.session_state["messages"]:
        st.error("Faltam mensagens. Adicione ao menos uma mensagem do usuário.")
    else:
        try:
            payload = {
                "session_id": st.session_state["session_id"],
                "messages": st.session_state["messages"],
            }
            r = requests.post(f"{api_base}/chat", json=payload, timeout=30)
            if r.status_code != 200:
                st.error(f"Erro {r.status_code}: {r.text}")
            else:
                data = r.json()
                st.success("Playlist criada com sucesso!")
                st.json(data)

                # Embed da playlist
                embed_url = data.get("playlist", {}).get("embed_url")
                if embed_url:
                    st.markdown(
                        f"""
                        <iframe src="{embed_url}" width="100%" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
                        """,
                        unsafe_allow_html=True,
                    )
                else:
                    st.info("Embed URL não retornada.")
        except Exception as e:
            st.error(f"Falha ao chamar /chat: {e}")
