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

  const cleanupPopup = useCallback(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userIdFromUrl = params.get('user_id');

    if (userIdFromUrl) {
      checkSession(userIdFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const login = useCallback(() => {
    setLoginError(null);
    setIsLoading(true);
    window.location.href = `${API_BASE_URL}/spotify/login`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    setUserId(null);
    setIsAuthenticated(false);
    setLoginError(null);
    navigate('/');
  }, [navigate]);

  const checkSession = useCallback(async (userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/session_user?user_id=${userId}`);

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        setUserId(userId);
        setIsAuthenticated(true);
        setLoginError(null);
        toast.success(t("login.success"));
        navigate('/chat');
        return true;
      } else {
        throw new Error(t("error.sessionInvalid"));
      }
    } catch (error) {
      setLoginError(t("error.connectionFailed"));
      toast.error(t("error.connectionFailed"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, t]);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId && !isAuthenticated) {
      checkSession(storedUserId);
    }
  }, [isAuthenticated, checkSession]);

  const contextValue = {
    userId,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkSession,
    loginError,
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
