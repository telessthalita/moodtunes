import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Chat from './components/Chat';
import PlaylistPreview from './components/PlaylistPreview';

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
    <div className="app">
      <header className="app-header">
        <h1>MoodTunes</h1>
        <button
          className="auth-button"
          onClick={loginWithSpotify}
          disabled={isAuthenticated}
        >
          {isAuthenticated ? 'Conectado ao Spotify' : 'Faça login no Spotify para começar'}
        </button>
      </header>

      {isAuthenticated && (
        <main className="app-main">
          <section className="chat-section">
            <Chat
              chat={chat}
              message={message}
              setMessage={setMessage}
              sendMessage={sendMessage}
              isAuthenticated={isAuthenticated}
            />
          </section>
          <section className="playlist-section">
            <PlaylistPreview playlist={playlist} showPreview={showPreview} />
          </section>
        </main>
      )}
    </div>
  );
};

export default App;
