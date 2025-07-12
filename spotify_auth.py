import os
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import webbrowser
from urllib.parse import urlparse, parse_qs

load_dotenv()
handle_spotify_callback()

def authenticate_spotify():
    if not st.session_state.authenticated:
        sp_oauth = SpotifyOAuth(
            client_id=os.getenv("SPOTIFY_CLIENT_ID"),
            client_secret=os.getenv("SPOTIFY_CLIENT_SECRET"),
            redirect_uri=os.getenv("SPOTIFY_REDIRECT_URI"),
            scope="user-library-read playlist-modify-private"
        )
        auth_url = sp_oauth.get_authorize_url()
        js = f"""
        <script>
            window.open('{auth_url}', 'SpotifyAuth', 'width=500,height=700');
        </script>
        """
        st.components.v1.html(js)
        
        if st.button("Já autentiquei no popup"):
            st.session_state.sp = spotipy.Spotify(auth_manager=sp_oauth)
            st.session_state.user_info = st.session_state.sp.current_user()
            st.session_state.authenticated = True
            st.rerun()
        return False
    return True

def get_user_info(sp):
    """Obtém informações básicas do usuário"""
    user = sp.current_user()
    return user
