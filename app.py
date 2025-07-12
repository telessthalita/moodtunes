import os
import streamlit as st
from groq_client import GroqClient
from spotify_client import SpotifyClient
from dotenv import load_dotenv

# Configuração inicial
load_dotenv()

# Carrega CSS
def load_styles():
    with open("style.css") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# Inicialização
def init_session():
    st.set_page_config(
        page_title="MoodTunes",
        page_icon="🎵",
        layout="wide",
        initial_sidebar_state="collapsed"
    )
    load_styles()
    
    if 'groq' not in st.session_state:
        st.session_state.groq = GroqClient()
    
    if 'spotify' not in st.session_state:
        st.session_state.spotify = SpotifyClient()
    
    if 'messages' not in st.session_state:
        st.session_state.messages = []

# Componentes da UI
def show_header():
    st.markdown("""
    <div class="header-container">
        <img src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_CMYK_Green.png" class="logo-spotify">
        <h1 class="titulo-principal">MoodTunes</h1>
    </div>
    """, unsafe_allow_html=True)

def show_chat_messages():
    for msg in st.session_state.messages:
        css_class = "mensagem-usuario" if msg["role"] == "user" else "mensagem-bot"
        st.markdown(f"""
        <div class="{css_class}">
            {msg["content"]}
        </div>
        """, unsafe_allow_html=True)

def show_auth_button():
    st.markdown(f"""
    <div style="text-align: center; margin-top: 50px;">
        <h3>Conecte-se ao Spotify para começar</h3>
        <a href="{st.session_state.spotify.sp_oauth.get_authorize_url()}">
            <button class="botao-primario">🔗 Conectar Spotify</button>
        </a>
    </div>
    """, unsafe_allow_html=True)

def show_footer():
    st.markdown("""
    <div class="rodape">
        MoodTunes desenvolvido com 💚 por TT 
    
    </div>
    """, unsafe_allow_html=True)

# Lógica principal
def main():
    init_session()
    show_header()
    
    # Autenticação
    if not st.session_state.spotify.authenticate(st.query_params.get("code")):
        show_auth_button()
        show_footer()
        st.stop()
    
    show_chat_messages()
    
    # Input do usuário
    if user_input := st.chat_input("Digite sua mensagem..."):
        process_user_message(user_input)
        st.rerun()
    
    show_footer()

def process_user_message(user_input):
    st.session_state.messages.append({"role": "user", "content": user_input})
    
    # Resposta do assistente
    bot_response = st.session_state.groq.generate_response(user_input)
    st.session_state.messages.append({"role": "assistant", "content": bot_response})
    
    # Cria playlist após 5 interações
    if st.session_state.groq.get_user_message_count() >= 5:
        create_playlist()

def create_playlist():
    with st.spinner("🎧 Analisando seu humor e criando playlist..."):
        try:
            mood = st.session_state.groq.analyze_mood()
            playlist_url = st.session_state.spotify.create_playlist(
                name=f"MoodTunes - {mood.capitalize()}",
                description=f"Playlist para seu humor {mood}",
                mood=mood
            )
            
            if playlist_url:
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": f"""
                    <div style="text-align: center;">
                        <h3 style="color: var(--verde-spotify);">🎉 Playlist criada com sucesso!</h3>
                        <a href="{playlist_url}" target="_blank" class="botao-primario" style="display: inline-block; margin-top: 10px;">
                            Ouvir no Spotify
                        </a>
                    </div>
                    """
                })
                st.session_state.groq.reset_conversation()
        except Exception as e:
            st.error(f"Erro ao criar playlist: {str(e)}")

if __name__ == "__main__":
    main()