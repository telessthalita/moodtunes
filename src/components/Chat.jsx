import React, { useState } from 'react';
import axios from 'axios';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [playlist, setPlaylist] = useState(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/playlist`, {
        userId: '123', // Substitua por um ID único do usuário
        message: input,
      });

      if (response.data.action === 'create_playlist') {
        setPlaylist(response.data.data);
      } else {
        const botMessage = { text: response.data.response, sender: 'bot' };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Erro no chat:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
      </div>
      {playlist ? (
        <div className="playlist">
          <h2>{playlist.message}</h2>
          <a
            href={playlist.playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            className="playlist-button"
          >
            Ouvir Playlist no Spotify
          </a>
        </div>
      ) : (
        <div className="input-area">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Como foi o seu dia?"
          />
          <button onClick={handleSend}>Enviar</button>
        </div>
      )}
    </div>
  );
};

export default Chat;