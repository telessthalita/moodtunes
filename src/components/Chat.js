import React, { useEffect, useRef } from 'react';
import botImage from '../assets/moodtunes.jpeg'; 

const Chat = ({ chat, message, setMessage, sendMessage, isAuthenticated }) => {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="chat-container">
      <div className="chat-history">
        {chat.map((msg, index) => (
          <div key={index} className={`message-container ${msg.role === 'user' ? 'user' : 'bot'}`}>
            {msg.role === 'bot' && (
              <img src={botImage} alt="MoodTunes Bot" className="avatar" />
            )}
            <p className={msg.role === 'user' ? 'user-message' : 'bot-message'}>
              {msg.text}
            </p>
          </div>
        ))}
        <div ref={chatEndRef} />
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
  );
};

export default Chat;
