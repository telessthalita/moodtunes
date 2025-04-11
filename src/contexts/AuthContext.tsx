
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from './LanguageContext';

// Define API base URL
const API_BASE_URL = 'https://moodtunes-backend.onrender.com';

// Types
type AuthContextType = {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  checkSession: (userId: string) => Promise<boolean>;
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('userId'));
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Setup event listener for the popup message
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      console.log("Received message from:", event.origin);
      console.log("Message data:", event.data);
      
      // Verify origin for security - but log for debugging
      if (event.origin !== API_BASE_URL) {
        console.warn(`Origin mismatch: expected ${API_BASE_URL}, got ${event.origin}`);
        return;
      }
      
      // Check if the message contains a user_id
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

  // Login function - opens a popup for Spotify auth
  const login = useCallback(() => {
    console.log("Starting login process...");
    const width = 450;
    const height = 730;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const authUrl = `${API_BASE_URL}/spotify/login`;
    console.log("Auth URL:", authUrl);
    
    try {
      const popup = window.open(
        authUrl,
        'SpotifyLogin',
        `width=${width},height=${height},top=${top},left=${left}`
      );
      
      // Check if popup was blocked
      if (!popup || popup.closed) {
        console.error("Popup was blocked or failed to open");
        toast.error(t("error.popupBlocked"));
        return;
      }
      
      console.log("Auth popup opened successfully");
      setIsLoading(true);
      
      // Fallback for browsers that don't support postMessage
      const checkPopupClosed = setInterval(() => {
        if (popup?.closed) {
          console.log("Auth popup was closed");
          clearInterval(checkPopupClosed);
          setIsLoading(false);
          
          // Try to get userId from localStorage (if backend sets it)
          const storedUserId = localStorage.getItem('userId');
          if (storedUserId) {
            console.log("Found userId in localStorage:", storedUserId);
            checkSession(storedUserId);
          } else {
            console.log("No userId found in localStorage after popup closed");
            toast.error("Autenticação falhou ou foi cancelada. Por favor, tente novamente.");
          }
        }
      }, 500);
    } catch (error) {
      console.error("Error opening auth popup:", error);
      toast.error("Erro ao abrir janela de autenticação");
      setIsLoading(false);
    }
  }, [t]);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    setUserId(null);
    setIsAuthenticated(false);
    navigate('/');
    console.log("User logged out");
  }, [navigate]);

  // Check if session is valid
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
        return true;
      } else {
        // If response is not OK, session is invalid
        console.error("Session is invalid, status:", response.status);
        const errorText = await response.text();
        console.error("Error response:", errorText);
        toast.error(t("error.sessionExpired"));
        logout();
        return false;
      }
    } catch (error) {
      console.error("Session check error:", error);
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
    checkSession
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
