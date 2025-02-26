import React from 'react';

const SpotifyAuth = () => {
  const handleAuth = () => {
    const apiUrl = process.env.REACT_APP_API_URL;
    window.location.href = `${apiUrl}/spotify/auth`; 
  };

  return (
    <div className="auth-container">
      <h1>Bem-vindo ao MoodTunes!</h1>
      <p>Conecte-se ao Spotify para começar.</p>
      <button onClick={handleAuth}>Conectar ao Spotify</button>
    </div>
  );
};

export default SpotifyAuth;