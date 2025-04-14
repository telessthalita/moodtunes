import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  const authPopupRef = useRef<Window | null>(null);
  const popupCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const isMobile = useCallback(() => {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);


  const cleanupPopup = useCallback(() => {
    if (popupCheckIntervalRef.current) {
      clearInterval(popupCheckIntervalRef.current);
      popupCheckIntervalRef.current = null;
    }
    if (authPopupRef.current && !authPopupRef.current.closed) {
      authPopupRef.current.close();
    }
    authPopupRef.current = null;
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.user_id) {
        checkSession(event.data.user_id);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  const login = useCallback(() => {
    setLoginError(null);
    setIsLoading(true);

    const authUrl = `${API_BASE_URL}/spotify/login`;

    if (isMobile()) {

      window.location.href = authUrl;
      return;
    }

    const width = 450;
    const height = 730;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    try {
      cleanupPopup();

      const popup = window.open(
        authUrl,
        'SpotifyLogin',
        `width=${width},height=${height},top=${top},left=${left}`
      );

      if (!popup || popup.closed) {
        setLoginError(t("error.popupBlocked"));
        toast.error(t("error.popupBlocked"));
        setIsLoading(false);
        return;
      }

      authPopupRef.current = popup;
      popup.focus();

      popupCheckIntervalRef.current = setInterval(() => {
        try {
          if (popup.location.href.includes('user_id=')) {
            cleanupPopup();
            const url = new URL(popup.location.href);
            const userId = url.searchParams.get('user_id');
            if (userId) checkSession(userId);
          }
        } catch (e) {

        }
      }, 1000);

      setTimeout(() => {
        if (authPopupRef.current && !authPopupRef.current.closed) {
          setLoginError(t("error.authTimeout"));
          toast.error(t("error.authTimeout"));
          cleanupPopup();
        }
      }, 120000);

    } catch (error) {
      setLoginError(t("error.authWindow"));
      toast.error(t("error.authWindow"));
      setIsLoading(false);
    }
  }, [isMobile, cleanupPopup, t]);

  // Logout
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
        localStorage.setItem('userId', id);
        setUserId(id);
        setIsAuthenticated(true);
        setLoginError(null);
        toast.success(t("login.success"));
        cleanupPopup();
        navigate('/chat');
        return true;
      } else {
        const errorText = await response.text();
        setLoginError(t("error.sessionInvalid"));
        toast.error(t("error.sessionExpired"));
        logout();
        return false;
      }
    } catch (error) {
      setLoginError(t("error.connectionFailed"));
      toast.error(t("error.connectionFailed"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, logout, t, cleanupPopup]);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId && !isAuthenticated) {
      checkSession(storedUserId);
    }
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