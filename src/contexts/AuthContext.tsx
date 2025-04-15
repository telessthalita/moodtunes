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
  const [authPopup, setAuthPopup] = useState<Window | null>(null);



  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      console.log("Received message:", event);

      if (event.data && event.data.user_id) {
        const userId = event.data.user_id;
        console.log("Received user_id:", userId);
        checkSession(userId);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    console.log("Auth message listener setup completed");

    return () => {
      window.removeEventListener('message', handleAuthMessage);
    };
  }, []);

  useEffect(() => {
    if (!authPopup || isAuthenticated) return;

    const timer = setInterval(() => {
      if (authPopup.closed) {
        console.log("Auth popup was closed by user");
        clearInterval(timer);
        setIsLoading(false);
        setAuthPopup(null);
      }
    }, 1000);

    const timeout = setTimeout(() => {
      clearInterval(timer);

      if (authPopup && !authPopup.closed) {
        authPopup.close();
      }

      setIsLoading(false);
      setLoginError("Tempo limite de autenticação excedido. Por favor, tente novamente.");
      toast.error("Tempo limite de autenticação excedido. Por favor, tente novamente.");
      setAuthPopup(null);
    }, 120000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [authPopup, isAuthenticated]);

  const login = useCallback(() => {
    console.log("Starting login process...");
    // Reset any previous errors
    setLoginError(null);

    window.location.href = `${API_BASE_URL}/spotify/login`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    setUserId(null);
    setIsAuthenticated(false);
    setLoginError(null);
    navigate('/');
    console.log("User logged out");
  }, [navigate]);

  const checkSession = useCallback(async (id: string): Promise<boolean> => {
    console.log("Checking session for ID:", id);
    try {
      setIsLoading(true);
      const sessionUrl = `${API_BASE_URL}/session_user?user_id=${id}`;
      console.log("Session check URL:", sessionUrl);

      const response = await fetch(sessionUrl);
      console.log("Session check response status:", response.status);

      if (response.ok) {
        console.log("Session is valid");
        localStorage.setItem('userId', id);
        setUserId(id);
        setIsAuthenticated(true);
        setLoginError(null);
        if (authPopup && !authPopup.closed) {
          authPopup.close();
          setAuthPopup(null);
        }

        setIsLoading(false);
        return true;
      } else {
        const errorText = await response.text();
        console.error("Session is invalid, status:", response.status, "Error:", errorText);
        setLoginError(`Sessão inválida (${response.status}): ${errorText || "Erro desconhecido"}`);
        toast.error(t("error.sessionExpired"));
        logout();
        return false;
      }
    } catch (error) {
      console.error("Session check error:", error);
      setLoginError("Erro de conexão: " + (error instanceof Error ? error.message : String(error)));
      toast.error(t("error.connectionFailed"));
      setIsLoading(false);
      return false;
    }
  }, [logout, t, authPopup]);

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