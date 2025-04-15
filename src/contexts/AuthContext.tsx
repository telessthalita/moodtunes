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

  const handleLoginSuccess = useCallback((userId: string) => {
    localStorage.setItem('userId', userId);
    setUserId(userId);
    setIsAuthenticated(true);
    setLoginError(null);
    setIsLoading(false);
    navigate('/chat', { replace: true });
  }, [navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    setUserId(null);
    setIsAuthenticated(false);
    setLoginError(null);
    navigate('/', { replace: true });
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
  }, [handleLoginSuccess, logout, t]);

  useEffect(() => {
    // Verifica sessão existente ao carregar o app
    if (userId && !isAuthenticated) {
      checkSession(userId);
    }
  }, [userId, isAuthenticated, checkSession]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');

    if (userId) {
      console.log('User ID from URL:', userId);
      window.history.replaceState({}, '', window.location.pathname);
      handleLoginSuccess(userId);
    }
  }, [handleLoginSuccess]);

  const login = useCallback(() => {
    console.log("Starting login process...");
    setLoginError(null);
    setIsLoading(true);
    window.location.href = `${API_BASE_URL}/spotify/login`;
  }, []);

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