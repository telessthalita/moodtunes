
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from './LanguageContext';
import { logInfo, logError, logWarning } from '../utils/logUtils';
import { API_BASE_URL, isSessionValid, clearAuthData, verifySession } from '../utils/authUtils';
import { useAuthPopup } from '../hooks/useAuthPopup';

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
      
      if (storedUserId && isSessionValid(sessionTimestamp)) {
        logInfo(`Restoring session for user: ${storedUserId}`);
        return storedUserId;
      } else {
        logInfo('Session expired or invalid, cleaning up');
        clearAuthData();
        return null;
      }
    } catch (err) {
      logError('Error restoring session', err);
      return null;
    }
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!userId);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check session validity with the API
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
      // Use the new session-info endpoint to verify the session
      const sessionInfo = await verifySession();
      
      logInfo("Session check response", sessionInfo);

      if (sessionInfo.authenticated && sessionInfo.userId) {
        logInfo("Session is valid");
        // Store the session with a timestamp
        localStorage.setItem('userId', sessionInfo.userId);
        localStorage.setItem('sessionTimestamp', String(new Date().getTime()));
        sessionStorage.removeItem('authInProgress');
        
        setUserId(sessionInfo.userId);
        setIsAuthenticated(true);
        setLoginError(null);
        
        setIsLoading(false);
        
        // Explicitly navigate to chat route on successful authentication
        navigate('/chat', { replace: true });
        return true;
      } else {
        logWarning(`Session invalid`);
        setLoginError(t("error.invalidSession"));
        toast.error(t("error.sessionExpired"));
        
        // Clean up any local session data
        clearAuthData();
        
        setUserId(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      logError("Session check error", error);
      setLoginError(`${t("error.connection")}: ${error instanceof Error ? error.message : String(error)}`);
      toast.error(t("error.connectionFailed"));
      setIsLoading(false);
      return false;
    }
  }, [userId, isAuthenticated, navigate, t]);

  const { launchAuthPopup, redirectToAuth } = useAuthPopup((id) => checkSession(id));

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
  }, [checkSession, navigate]);

  // Login function - getting auth_url from the API
  const login = useCallback(async () => {
    logInfo("Starting login process");
    // Reset any previous errors
    setLoginError(null);
    setIsLoading(true);

    try {
      // Get the auth URL from the API
      const response = await fetch(`${API_BASE_URL}/login`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Login request failed: ${response.status}`);
      }
      
      const data = await response.json();
      const authUrl = data.auth_url;
      
      if (!authUrl) {
        throw new Error('Auth URL not provided by server');
      }
      
      logInfo("Auth URL received", authUrl);

      // Check if we're on mobile
      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        redirectToAuth(authUrl);
        return;
      }

      // For desktop browsers, use popup
      launchAuthPopup(authUrl);
    } catch (error) {
      logError("Login error", error);
      setLoginError(`${t("error.login")}: ${error instanceof Error ? error.message : String(error)}`);
      toast.error(t("error.loginFailed"));
      setIsLoading(false);
    }
  }, [launchAuthPopup, redirectToAuth, t]);

  // Logout function
  const logout = useCallback(() => {
    logInfo("Logging out user", { userId });
    
    // Clear local storage
    clearAuthData();
    
    // Reset state
    setUserId(null);
    setIsAuthenticated(false);
    setLoginError(null);
    
    // Redirect to logout endpoint to clear server-side session
    window.location.href = `${API_BASE_URL}/logout`;
  }, [userId]);
  
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
