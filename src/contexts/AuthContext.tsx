
import React, { createContext, useContext, useState, useCallback } from 'react';
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

  // Login function - redirects to Spotify auth
  const login = useCallback(() => {
    window.location.href = `${API_BASE_URL}/spotify/login`;
  }, []);

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
