
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../contexts/LanguageContext';
import { logInfo, logError } from '../utils/logUtils';
import { openAuthPopup } from '../utils/authUtils';

export const useAuthPopup = (onSuccess: (userId: string) => void) => {
  const { t } = useTranslation();
  const [authPopup, setAuthPopup] = useState<Window | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Handle popup management
  useEffect(() => {
    if (!authPopup) return;

    const timer = setInterval(() => {
      if (authPopup.closed) {
        logInfo("Auth popup was closed by user");
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
      toast.error(t("error.authTimeout"));
      setAuthPopup(null);
    }, 120000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
      logInfo("Auth popup listener cleanup completed");
    };
  }, [authPopup, t]);

  // Message event listener for auth popup
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      logInfo("Received message event", event.data);

      if (event.data && event.data.user_id) {
        const userId = event.data.user_id;
        logInfo("Received user_id from message", userId);
        onSuccess(userId);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    logInfo("Auth message listener setup completed");

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      logInfo("Auth message listener removed");
    };
  }, [onSuccess]);

  const launchAuthPopup = useCallback((authUrl: string) => {
    // Close any existing popup
    if (authPopup && !authPopup.closed) {
      authPopup.close();
    }

    setIsLoading(true);
    const popup = openAuthPopup(authUrl);
    
    if (!popup) {
      toast.error(t("error.popupBlocked"));
      setIsLoading(false);
      return false;
    }
    
    setAuthPopup(popup);
    popup.focus();
    return true;
  }, [authPopup, t]);

  // Handle redirect for mobile devices
  const redirectToAuth = useCallback((authUrl: string) => {
    logInfo("Using direct redirect for mobile authentication");
    setIsLoading(true);
    // Store that we're in the process of authentication
    sessionStorage.setItem('authInProgress', 'true');
    // Redirect directly to auth URL
    window.location.href = authUrl;
  }, []);

  return {
    isLoading,
    launchAuthPopup,
    redirectToAuth,
    setIsLoading
  };
};
