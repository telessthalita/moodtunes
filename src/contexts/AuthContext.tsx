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

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('userId'));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authPopup, setAuthPopup] = useState<Window | null>(null);

  const popupCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.user_id) {
        const userId = event.data.user_id;
        checkSession(userId);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  useEffect(() => {
    if (!authPopup || isAuthenticated) return;

    popupCloseTimerRef.current = setInterval(() => {
      if (authPopup.closed) {
        clearInterval(popupCloseTimerRef.current!);
        popupCloseTimerRef.current = null;
        setIsLoading(false);
        setAuthPopup(null);
      }
    }, 1000);

    popupTimeoutRef.current = setTimeout(() => {
      clearInterval(popupCloseTimerRef.current!);
      popupCloseTimerRef.current = null;

      if (authPopup && !authPopup.closed) {
        authPopup.close();
      }

      setIsLoading(false);
      setLoginError("Tempo limite de autenticação excedido. Por favor, tente novamente.");
      toast.error("Tempo limite de autenticação excedido. Por favor, tente novamente.");
      setAuthPopup(null);
    }, 120000);

    return () => {
      if (popupCloseTimerRef.current) clearInterval(popupCloseTimerRef.current);
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    };
  }, [authPopup, isAuthenticated]);

  // Alteração aqui para mobile e desktop login
  const login = useCallback(() => {
    setLoginError(null);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); // Detect mobile device
    const authUrl = `${API_BASE_URL}/spotify/login`;

    if (isMobile) {
      // Para mobile, redirecionamos diretamente para a página de login do Spotify
      window.location.href = authUrl;
      setIsLoading(true);
    } else {
      // Para desktop, usamos popup
      const width = 450;
      const height = 730;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      try {
        if (authPopup && !authPopup.closed) {
          authPopup.close();
        }

        const popup = window.open(
          authUrl,
          'SpotifyLogin',
          `width=${width},height=${height},top=${top},left=${left}`
        );

        if (!popup || popup.closed) {
          setLoginError("O popup foi bloqueado pelo navegador. Por favor, permita popups para este site.");
          toast.error("O popup foi bloqueado. Por favor, permita popups para este site.");
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setAuthPopup(popup);
        popup.focus();

        try {
          const checkRedirect = setInterval(() => {
            try {
              if (popup.location.href.includes('user_id=')) {
                clearInterval(checkRedirect);
                const url = new URL(popup.location.href);
                const userId = url.searchParams.get('user_id');
                if (userId) {
                  checkSession(userId);
                  popup.close();
                }
              }
            } catch (e) { }
          }, 1000);

          setTimeout(() => clearInterval(checkRedirect), 120000);
        } catch (e) {
          console.warn("Redirect check setup falhou:", e);
        }
      } catch (error) {
        setLoginError("Erro ao abrir janela de autenticação: " + (error instanceof Error ? error.message : String(error)));
        toast.error("Erro ao abrir janela de autenticação");
        setIsLoading(false);
      }
    }
  }, [authPopup]);

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
      const sessionUrl = `${API_BASE_URL}/session_user?user_id=${id}`;

      const response = await fetch(sessionUrl);

      if (response.ok) {
        localStorage.setItem('userId', id);
        setUserId(id);
        setIsAuthenticated(true);
        setLoginError(null);

        toast.success(
          <div className="flex items-center gap-2 font-medium">
            <span>✅</span>
            <span>{t("Login realizado com sucesso!")}</span>
          </div>
        );

        // Redireciona para o chat
        navigate('/chat');

        if (authPopup && !authPopup.closed) {
          authPopup.close();
          setAuthPopup(null);
        }

        setIsLoading(false);
        return true;
      } else {
        const errorText = await response.text();
        setLoginError(`Sessão inválida (${response.status}): ${errorText || "Erro desconhecido"}`);
        toast.error(t("error.sessionExpired"));
        logout();
        return false;
      }
    } catch (error) {
      setLoginError("Erro de conexão: " + (error instanceof Error ? error.message : String(error)));
      toast.error(t("error.connectionFailed"));
      setIsLoading(false);
      return false;
    }
  }, [logout, t, authPopup, navigate]);

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
