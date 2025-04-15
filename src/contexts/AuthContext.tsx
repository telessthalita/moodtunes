import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from './LanguageContext';

const API_BASE_URL = 'https://moodtunes-backend.onrender.com';

type AuthContextType = {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  checkSession: (userId: string) => Promise<boolean>;
  loginError: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('userId'));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Efeito para verificar autenticação inicial e capturar o user_id do redirecionamento
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');

    if (userId) {
      // Limpa a URL mantendo apenas o path
      window.history.replaceState({}, document.title, window.location.pathname);

      // Processa o login
      handleLoginSuccess(userId);
    } else if (localStorage.getItem('userId')) {
      // Verifica sessão existente ao carregar o app
      checkSession(localStorage.getItem('userId')!);
    }
  }, []);

  const handleLoginSuccess = (userId: string) => {
    localStorage.setItem('userId', userId);
    setUserId(userId);
    setIsAuthenticated(true);
    setLoginError(null);
    setIsLoading(false);
    navigate('/chat'); // Redireciona para a página de chat
  };

  const login = useCallback(() => {
    setLoginError(null);
    setIsLoading(true);
    window.location.href = `${API_BASE_URL}/spotify/login`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    setUserId(null);
    setIsAuthenticated(false);
    setLoginError(null);
    navigate('/');
  }, [navigate]);

  const checkSession = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/session_user?user_id=${id}`);

      if (response.ok) {
        handleLoginSuccess(id);
        return true;
      } else {
        const errorText = await response.text();
        console.error("Session check failed:", errorText);
        logout();
        toast.error(t("error.sessionExpired"));
        return false;
      }
    } catch (error) {
      console.error("Session check error:", error);
      setLoginError("Erro de conexão");
      toast.error(t("error.connectionFailed"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [logout, t]);

  const contextValue = {
    userId,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkSession,
    loginError
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};