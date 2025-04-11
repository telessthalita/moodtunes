
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
      // Verify origin for security
      if (event.origin !== API_BASE_URL) return;
      
      // Check if the message contains a user_id
      if (event.data && event.data.user_id) {
        const userId = event.data.user_id;
        checkSession(userId);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    
    return () => {
      window.removeEventListener('message', handleAuthMessage);
    };
  }, []);

  // Login function - opens a popup for Spotify auth
  const login = useCallback(() => {
    const width = 450;
    const height = 730;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      `${API_BASE_URL}/spotify/login`,
      'SpotifyLogin',
      `width=${width},height=${height},top=${top},left=${left}`
    );
    
    // Check if popup was blocked
    if (!popup || popup.closed) {
      toast.error(t("error.popupBlocked"));
    }
    
    setIsLoading(true);
    
    // Fallback for browsers that don't support postMessage
    const checkPopupClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopupClosed);
        setIsLoading(false);
        
        // Try to get userId from localStorage (if backend sets it)
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
          checkSession(storedUserId);
        }
      }
    }, 500);
  }, [t]);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    setUserId(null);
    setIsAuthenticated(false);
    navigate('/');
  }, [navigate]);

  // Check if session is valid
  const checkSession = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/session_user?user_id=${id}`);
      
      if (response.ok) {
        localStorage.setItem('userId', id);
        setUserId(id);
        setIsAuthenticated(true);
        return true;
      } else {
        // If response is not OK, session is invalid
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
