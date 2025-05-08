
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from './LanguageContext';

// Updated API base URL
const API_BASE_URL = 'https://moodtunes-htki.onrender.com';

// Session timeout in milliseconds (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

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
  const [userId, setUserId] = useState<string | null>(() => {
    // Check if session is still valid based on timestamp
    const storedUserId = localStorage.getItem('userId');
    const sessionTimestamp = localStorage.getItem('sessionTimestamp');
    
    if (storedUserId && sessionTimestamp) {
      const now = new Date().getTime();
      const timestamp = parseInt(sessionTimestamp, 10);
      
      if (now - timestamp < SESSION_TIMEOUT) {
        return storedUserId;
      } else {
        // Session expired, clean up
        localStorage.removeItem('userId');
        localStorage.removeItem('sessionTimestamp');
        return null;
      }
    }
    return null;
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!userId);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authPopup, setAuthPopup] = useState<Window | null>(null);

  // Handle direct callbacks from Spotify authentication
  useEffect(() => {
    // Check if the URL contains a user_id parameter (from redirect)
    const params = new URLSearchParams(window.location.search);
    const callbackUserId = params.get("user_id");

    if (callbackUserId) {
      console.log("Found user_id in URL parameters:", callbackUserId);
      checkSession(callbackUserId)
        .then(success => {
          if (success) {
            // Clean up URL parameters
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            navigate('/chat');
          }
        });
    }
  }, []);

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

  // Handle popup window for authentication
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

    // Special handling for mobile browsers
    const detectRedirect = () => {
      try {
        // For mobile browsers, check if we're back from authentication
        const params = new URLSearchParams(window.location.search);
        const callbackUserId = params.get("user_id");
        
        if (callbackUserId) {
          console.log("Detected user_id in URL after mobile auth:", callbackUserId);
          checkSession(callbackUserId)
            .then(success => {
              if (success) {
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            });
          
          // Close any existing popup
          if (authPopup && !authPopup.closed) {
            authPopup.close();
          }
          
          setAuthPopup(null);
          clearInterval(timer);
        }
      } catch (e) {
        console.warn("Error checking mobile redirect:", e);
      }
    };

    // Check for mobile redirects
    window.addEventListener('focus', detectRedirect);

    const timeout = setTimeout(() => {
      clearInterval(timer);
      window.removeEventListener('focus', detectRedirect);

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
      window.removeEventListener('focus', detectRedirect);
    };
  }, [authPopup, isAuthenticated]);

  const login = useCallback(() => {
    console.log("Starting login process...");
    // Reset any previous errors
    setLoginError(null);

    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;
    const authUrl = `${API_BASE_URL}/spotify/login`;
    console.log("Auth URL:", authUrl);

    try {
      // Close any existing popup
      if (authPopup && !authPopup.closed) {
        authPopup.close();
      }

      setIsLoading(true);
      
      if (isMobile) {
        // For mobile browsers, use direct redirect instead of popup
        console.log("Using direct redirect for mobile authentication");
        // Store that we're in the process of authentication
        sessionStorage.setItem('authInProgress', 'true');
        sessionStorage.setItem('lastAuthAttempt', String(new Date().getTime()));
        
        // Add a return_to parameter to tell the server where to redirect back
        const currentUrl = window.location.origin;
        const redirectAuthUrl = `${authUrl}?return_to=${encodeURIComponent(currentUrl)}`;
        console.log("Redirecting to:", redirectAuthUrl);
        
        // Redirect directly to auth URL
        window.location.href = redirectAuthUrl;
        return;
      }

      // For desktop browsers, use popup
      const width = 450;
      const height = 730;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'SpotifyLogin',
        `width=${width},height=${height},top=${top},left=${left}`
      );

      if (!popup || popup.closed) {
        console.error("Popup was blocked or failed to open");
        setLoginError("O popup foi bloqueado pelo navegador. Por favor, permita popups para este site.");
        toast.error("O popup foi bloqueado. Por favor, permita popups para este site.");
        setIsLoading(false);
        return;
      }

      console.log("Auth popup opened successfully");
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
                console.log("Detected user_id in popup URL:", userId);
                checkSession(userId);
                popup.close();
              }
            }
          } catch (e) {
            // Ignore cross-origin errors
          }
        }, 1000);

        setTimeout(() => clearInterval(checkRedirect), 120000);
      } catch (e) {
        console.warn("Could not set up redirect detection:", e);
      }
    } catch (error) {
      console.error("Error opening auth popup:", error);
      setLoginError("Erro ao abrir janela de autenticação: " + (error instanceof Error ? error.message : String(error)));
      toast.error("Erro ao abrir janela de autenticação");
      setIsLoading(false);
    }
  }, [authPopup]);

  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    localStorage.removeItem('sessionTimestamp');
    sessionStorage.removeItem('authInProgress');
    sessionStorage.removeItem('lastAuthAttempt');
    setUserId(null);
    setIsAuthenticated(false);
    setLoginError(null);
    navigate('/');
    console.log("User logged out");
  }, [navigate]);

  const checkSession = useCallback(async (id: string): Promise<boolean> => {
    console.log("Checking session for ID:", id);

    // Check if we already have a valid session for this ID
    if (userId === id && isAuthenticated) {
      console.log("Using existing valid session");
      setIsLoading(false);
      return true;
    }

    try {
      setIsLoading(true);
      const sessionUrl = `${API_BASE_URL}/session_user?user_id=${id}`;
      console.log("Session check URL:", sessionUrl);

      const response = await fetch(sessionUrl);
      console.log("Session check response status:", response.status);

      if (response.ok) {
        console.log("Session is valid");
        // Store the session with a timestamp
        localStorage.setItem('userId', id);
        localStorage.setItem('sessionTimestamp', String(new Date().getTime()));
        sessionStorage.removeItem('authInProgress');
        sessionStorage.removeItem('lastAuthAttempt');
        
        setUserId(id);
        setIsAuthenticated(true);
        setLoginError(null);
        
        if (authPopup && !authPopup.closed) {
          authPopup.close();
          setAuthPopup(null);
        }

        setIsLoading(false);
        
        // Explicitly navigate to chat route on successful authentication
        navigate('/chat');
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
  }, [userId, isAuthenticated, navigate, logout, t, authPopup]);
  
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
