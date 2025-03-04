import React, { useState, useEffect } from 'react';
import botImage from '../assets/moodtunes.jpeg';
import '../App.css'; 

const PlaylistPreview = ({ playlist, showPreview }) => {
  const [showMessage, setShowMessage] = useState(true); 
  useEffect(() => {
    if (playlist && showPreview) {
      const timer = setTimeout(() => {
        setShowMessage(false);
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [playlist, showPreview]);

  if (!playlist || !showPreview) {
    return (
      <div className="message-container bot">
        <img src={botImage} alt="MoodTunes Bot" className="avatar" />
        <p className="bot-message">
          <span className="typewriter-text">
            Gerando sua playlist... Aguarde um momento!
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="playlist-preview">
      <div className="playlist-content">
        {/* Exibe a mensagem antes de mostrar o iframe */}
        {showMessage && (
          <div className="message-container bot">
            <img src={botImage} alt="MoodTunes Bot" className="avatar" />
            <p className="bot-message">
              <span className="typewriter-text">
                Aqui vai a sua trilha sonora!
              </span>
            </p>
          </div>
        )}

        {/* Exibe o iframe do Spotify */}
        {playlist.id && (
          <div className="spotify-iframe-container">
            <iframe
              src={`https://open.spotify.com/embed/playlist/${playlist.id}`}
              width="100%"
              height="500" 
              frameBorder="0"
              allowtransparency="true"
              allow="encrypted-media"
              title="Spotify Playlist"
              className="spotify-iframe"
            ></iframe>
          </div>
        )}

        {/* Botão para abrir no Spotify */}
        <button
          className="spotify-button"
          onClick={() => window.open(playlist.url, '_blank')}
        >
          Ouvir no Spotify
        </button>
      </div>
    </div>
  );
};

export default PlaylistPreview;