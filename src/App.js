import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

const App = () => {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [playlist, setPlaylist] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const userId = localStorage.getItem('userId') || `user_${Date.now()}`;

  useEffect(() => {
    checkAuth();
    localStorage.setItem('userId', userId);
  }, [userId]);

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API_URL}/check`);
      setIsAuthenticated(res.data.isAuthenticated);
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const newChat = [...chat, { role: 'user', text: message }];
    setChat(newChat);

    try {
      const res = await axios.post(`${API_URL}/chat`, { userId, message });

      if (res.data.action === 'continue_chat') {
        setChat([...newChat, { role: 'bot', text: res.data.response }]);
      } else if (res.data.action === 'playlist_created') {
        setPlaylist(res.data.data.playlist);
        setShowPreview(true);
      }

      setMessage('');
    } catch (error) {
      console.error('Erro no chat:', error.response?.data || error.message);
    }
  };

  const loginWithSpotify = () => {
    window.location.href = `${API_URL}/auth`;
  };

  return (
    <div className="app-container">
      <div className="chat-container">
        <h1>MoodTunes</h1>
        <button onClick={loginWithSpotify} disabled={isAuthenticated}>
          {isAuthenticated ? 'Conectado ao Spotify' : 'Login com Spotify'}
        </button>

        <div className="chat-history">
          {chat.map((msg, index) => (
            <p key={index} className={msg.role === 'user' ? 'user-message' : 'bot-message'}>
              {msg.text}
            </p>
          ))}
        </div>

        <div className="chat-input">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage}>Enviar</button>
        </div>
      </div>

      <div className="playlist-container">
        {playlist && showPreview && (
          <div className="playlist-preview">
            {playlist.tracks && Array.isArray(playlist.tracks) ? (
              <ul>
                {playlist.tracks.map((track, index) => (
                  <li key={index}>{track}</li>
                ))}
              </ul>
            ) : (
              <p>Aqui está a sua trilha sonora </p>
            )}

            <iframe
              src={`https://open.spotify.com/embed/playlist/${playlist.id}`}
              width="100%"
              height="380"
              frameBorder="0"
              allowtransparency="true"
              allow="encrypted-media"
              title="Spotify Playlist"
            ></iframe>

            <button onClick={() => window.open(playlist.url, '_blank')}>
              Ouvir no Spotify
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;