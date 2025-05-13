
import { logInfo, logError, logWarning } from './logUtils';

// API base URL
export const API_BASE_URL = 'https://moodtunes-end.onrender.com';

// Session timeout in milliseconds (24 hours)
export const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

// Check if the session is valid based on timestamp
export const isSessionValid = (timestamp: string | null): boolean => {
  if (!timestamp) return false;
  
  try {
    const now = new Date().getTime();
    const sessionTime = parseInt(timestamp, 10);
    return now - sessionTime < SESSION_TIMEOUT;
  } catch (err) {
    logError('Error validating session timestamp', err);
    return false;
  }
};

// Verify session with the API
export const verifySession = async (): Promise<{authenticated: boolean; userId: string | null}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/session-info`, {
      credentials: 'include' // Important for cookies
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        authenticated: data.authenticated,
        userId: data.authenticated ? data.user_id : null
      };
    }
    
    return { authenticated: false, userId: null };
  } catch (error) {
    logError('Error verifying session', error);
    return { authenticated: false, userId: null };
  }
};

// Handle authentication popups for desktop browsers
export const openAuthPopup = (authUrl: string): Window | null => {
  try {
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
      return null;
    }

    logInfo("Auth popup opened successfully");
    return popup;
  } catch (error) {
    logError("Error opening auth popup", error);
    return null;
  }
};

// Setup message listener for auth flow
export const setupAuthMessageListener = (callback: (userId: string) => void): () => void => {
  const handleAuthMessage = (event: MessageEvent) => {
    logInfo("Received message event", event.data);

    if (event.data && event.data.user_id) {
      const userId = event.data.user_id;
      logInfo("Received user_id from message", userId);
      callback(userId);
    }
  };

  window.addEventListener('message', handleAuthMessage);
  logInfo("Auth message listener setup completed");

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handleAuthMessage);
    logInfo("Auth message listener removed");
  };
};

// Clear authentication data from storage
export const clearAuthData = () => {
  localStorage.removeItem('userId');
  localStorage.removeItem('sessionTimestamp');
  sessionStorage.removeItem('authInProgress');
  logInfo("Auth data cleared");
};
