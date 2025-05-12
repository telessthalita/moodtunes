
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from './LanguageContext';

// Updated API base URL
const API_BASE_URL = 'https://moodtunes-htki.onrender.com';

// Session timeout in milliseconds (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

// Improved log format for consistency
const logInfo = (message: string, data?: any) => {
  if (data) {
    console.log(`🔵 ${message}`, data);
  } else {
    console.log(`🔵 ${message}`);
  }
};

const logError = (message: string, error?: any) => {
  if (error) {
    console.error(`🔴 ${message}`, error);
  } else {
    console.error(`🔴 ${message}`);
  }
};

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
  // Initialize state from localStorage with proper session validation
  const [userId, setUserId] = useState<string | null>(() => {
    try {
      const storedUserId = localStorage.getItem('userId');
      const sessionTimestamp = localStorage.getItem('sessionTimestamp');
      
      if (storedUserId && sessionTimestamp) {
        const now = new Date().getTime();
        const timestamp = parseInt(sessionTimestamp, 10);
        
        if (now - timestamp < SESSION_TIMEOUT) {
          logInfo(`Restoring session for user: ${storedUserId}`);
          return storedUserId;
        } else {
          logInfo('Session expired, cleaning up');
          localStorage.removeItem('userId');
          localStorage.removeItem('sessionTimestamp');
          return null;
        }
      }
      return null;
    } catch (err) {
      logError('Error restoring session', err);
      return null;
    }
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
      logInfo("Found user_id in URL parameters", callbackUserId);
      checkSession(callbackUserId)
        .then(success => {
          if (success) {
            // Clean up URL parameters
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            navigate('/chat', { replace: true });
          }
        });
    }
  }, []);

  // Message event listener for auth popup
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      logInfo("Received message event", event.data);

      if (event.data && event.data.user_id) {
        const userId = event.data.user_id;
        logInfo("Received user_id from message", userId);
        checkSession(userId);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    logInfo("Auth message listener setup completed");

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      logInfo("Auth message listener removed");
    };
  }, []);

  // Handle popup window for authentication
  useEffect(() => {
    if (!authPopup || isAuthenticated) return;

    const timer = setInterval(() => {
      if (authPopup.closed) {
        logInfo("Auth popup was closed by user");
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
          logInfo("Detected user_id in URL after mobile auth", callbackUserId);
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
        logError("Error checking mobile redirect", e);
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
      setLoginError(t("error.authTimeout"));
      toast.error(t("error.authTimeout"));
      setAuthPopup(null);
    }, 120000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
      window.removeEventListener('focus', detectRedirect);
      logInfo("Auth popup listener cleanup completed");
    };
  }, [authPopup, isAuthenticated, t]);

  // Memoized login function to prevent unnecessary re-renders
  const login = useCallback(() => {
    logInfo("Starting login process");
    // Reset any previous errors
    setLoginError(null);

    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;
    const authUrl = `${API_BASE_URL}/spotify/login`;
    logInfo("Auth URL", authUrl);

    try {
      // Close any existing popup
      if (authPopup && !authPopup.closed) {
        authPopup.close();
      }

      if (isMobile) {
        // For mobile browsers, use direct redirect instead of popup
        logInfo("Using direct redirect for mobile authentication");
        setIsLoading(true);
        // Store that we're in the process of authentication
        sessionStorage.setItem('authInProgress', 'true');
        // Redirect directly to auth URL
        window.location.href = authUrl;
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
        logError("Popup was blocked or failed to open");
        setLoginError(t("error.popupBlocked"));
        toast.error(t("error.popupBlocked"));
        setIsLoading(false);
        return;
      }

      logInfo("Auth popup opened successfully");
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
                logInfo("Detected user_id in popup URL", userId);
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
        logError("Could not set up redirect detection", e);
      }
    } catch (error) {
      logError("Error opening auth popup", error);
      setLoginError(`${t("error.authPopup")}: ${error instanceof Error ? error.message : String(error)}`);
      toast.error(t("error.authPopup"));
      setIsLoading(false);
    }
  }, [authPopup, t]);

  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    localStorage.removeItem('sessionTimestamp');
    sessionStorage.removeItem('authInProgress');
    setUserId(null);
    setIsAuthenticated(false);
    setLoginError(null);
    logInfo("User logged out");
    navigate('/', { replace: true });
  }, [navigate]);

  const checkSession = useCallback(async (id: string): Promise<boolean> => {
    logInfo("Checking session for ID", id);

    // Check if we already have a valid session for this ID
    if (userId === id && isAuthenticated) {
      logInfo("Using existing valid session");
      setIsLoading(false);
      return true;
    }

    try {
      setIsLoading(true);
      const sessionUrl = `${API_BASE_URL}/session_user?user_id=${id}`;
      logInfo("Session check URL", sessionUrl);

      const response = await fetch(sessionUrl);
      logInfo("Session check response status", response.status);

      if (response.ok) {
        logInfo("Session is valid");
        // Store the session with a timestamp
        localStorage.setItem('userId', id);
        localStorage.setItem('sessionTimestamp', String(new Date().getTime()));
        sessionStorage.removeItem('authInProgress');
        
        setUserId(id);
        setIsAuthenticated(true);
        setLoginError(null);
        
        if (authPopup && !authPopup.closed) {
          authPopup.close();
          setAuthPopup(null);
        }

        setIsLoading(false);
        
        // Explicitly navigate to chat route on successful authentication
        navigate('/chat', { replace: true });
        return true;
      } else {
        const errorText = await response.text();
        logError(`Session invalid (${response.status})`, errorText);
        setLoginError(`${t("error.invalidSession")} (${response.status}): ${errorText || t("error.unknown")}`);
        toast.error(t("error.sessionExpired"));
        logout();
        return false;
      }
    } catch (error) {
      logError("Session check error", error);
      setLoginError(`${t("error.connection")}: ${error instanceof Error ? error.message : String(error)}`);
      toast.error(t("error.connectionFailed"));
      setIsLoading(false);
      return false;
    }
  }, [userId, isAuthenticated, navigate, logout, t, authPopup]);
  
  // Use memo to prevent unnecessary re-renders of context consumers
  const contextValue = useMemo(() => ({
    userId,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkSession,
    loginError
  }), [userId, isAuthenticated, isLoading, login, logout, checkSession, loginError]);

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
