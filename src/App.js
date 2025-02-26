import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SpotifyAuth from './components/SpotifyAuth';
import Chat from './components/Chat';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/spotify/auth`);
        setIsAuthenticated(response.data.isAuthenticated);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // Usuário não autenticado
          setIsAuthenticated(false);
        } else {
          // Outro erro
          console.error('Erro ao verificar autenticação:', error);
          setError('Erro ao verificar autenticação. Tente novamente mais tarde.');
        }
      } finally {
        setIsLoading(false); // Finaliza o loading
      }
    };

    // Verifica a autenticação apenas uma vez ao carregar a página
    checkAuth();
  }, []); // Array de dependências vazio para executar apenas uma vez

  if (isLoading) {
    return (
      <div className="loading-container">
        <p>Verificando autenticação...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Recarregar</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {isAuthenticated ? <Chat /> : <SpotifyAuth />}
    </div>
  );
};

export default App;