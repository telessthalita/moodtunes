import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import os
import base64

load_dotenv()

class SpotifyClient:
    def __init__(self):
        self.sp_oauth = SpotifyOAuth(
            client_id=os.getenv("SPOTIFY_CLIENT_ID"),
            client_secret=os.getenv("SPOTIFY_CLIENT_SECRET"),
            redirect_uri=os.getenv("SPOTIFY_REDIRECT_URI"),
            scope="playlist-modify-private user-top-read",
            cache_path=".spotify_cache"
        )
        self.sp = None
    
    def authenticate(self, code=None):
        if code:
            token_info = self.sp_oauth.get_access_token(code)
            self.sp = spotipy.Spotify(auth=token_info['access_token'])
            return True
        return False

    def create_playlist(self, name: str, description: str, mood: str):
        try:
            playlist = self.sp.user_playlist_create(
                user=self.sp.current_user()['id'],
                name=name,
                public=False,
                description=description
            )
            
            recommendations = self._get_recommendations(mood)
            if recommendations:
                self.sp.playlist_add_items(playlist['id'], recommendations[:15])
            
            return playlist['external_urls']['spotify']
        
        except Exception as e:
            print(f"Erro ao criar playlist: {str(e)}")
            return None

    def _get_recommendations(self, mood: str):
        mood_profiles = {
            'feliz': {'target_valence': 0.8, 'seed_genres': 'pop,dance'},
            'triste': {'target_valence': 0.3, 'seed_genres': 'blues,sad'},
            'ansioso': {'target_energy': 0.5, 'seed_genres': 'classical,ambient'},
            'energético': {'target_energy': 0.9, 'seed_genres': 'rock,electronic'},
            'calmo': {'target_energy': 0.3, 'seed_genres': 'chill,jazz'}
        }
        
        params = mood_profiles.get(mood.lower(), {'seed_genres': 'pop'})
        
        try:
            top_tracks = self.sp.current_user_top_tracks(limit=3)['items']
            seed_tracks = [track['id'] for track in top_tracks[:3]] if top_tracks else None
            
            results = self.sp.recommendations(
                limit=15,
                seed_tracks=seed_tracks,
                **params
            )
            return [track['uri'] for track in results['tracks']]
            
        except Exception as e:
            print(f"Erro nas recomendações: {str(e)}")
            return None