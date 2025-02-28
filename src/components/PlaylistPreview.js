import React from 'react';
import botImage from '../assets/moodtunes.jpeg'; 


const PlaylistPreview = ({ playlist, showPreview }) => {
  if (!playlist || !showPreview) return null;

  return (
    <div className="playlist-preview">
      {playlist.tracks && Array.isArray(playlist.tracks) ? (
        <div className="track-grid">
          {playlist.tracks.map((track, index) => (
            <div key={index} className="track-card">
              <span className="track-number">{index + 1}.</span>
              <span className="track-name">{track}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="message-container bot">
          <img src={botImage} alt="MoodTunes Bot" className="avatar" />
          <p className="bot-message">
            <span className="typewriter-text">
               Aqui vai a sua trilha sonora!
            </span>
          </p>
        </div>
      )}

      <iframe
        src={`https://open.spotify.com/embed/playlist/${playlist.id}`}
        width="100%"
        height="400"
        frameBorder="0"
        allowtransparency="true"
        allow="encrypted-media"
        title="Spotify Playlist"
        className="spotify-iframe"
      ></iframe>

      <button 
        className="spotify-button"
        onClick={() => window.open(playlist.url, '_blank')}
      >
        Ouvir no Spotify
      </button>
    </div>
  );
};

export default PlaylistPreview;