
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useTranslation } from './LanguageContext';
import { logInfo, logError, logWarning } from '../utils/logUtils';

// Updated API base URL
const API_BASE_URL = 'https://moodtunes-end.onrender.com';

// Types for messages
type MessageRole = 'user' | 'assistant';

interface Message {
  role: MessageRole;
  content: string;
}

// Types for chat context
interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  isFinished: boolean;
  mood: string | null;
  playlistUrl: string | null;
  sendMessage: (content: string) => Promise<void>;
  loadMoodResult: (userId: string) => Promise<void>;
  resetChat: () => void;
}

// Create context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId, logout } = useAuth();
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [mood, setMood] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);

  // Send a message to the backend
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!userId) {
      toast.error(t("error.sessionExpired"));
      logout();
      return;
    }

    if (!content.trim()) {
      toast.error(t("error.emptyMessage"));
      return;
    }

    // Add user message to the chat
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      logInfo("Sending message to chat API", { userId, content });
      
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content
        }),
        credentials: 'include' // Important for cookies/session
      });

      if (response.status === 401) {
        logWarning("Authentication required - Session expired");
        toast.error(t("error.sessionExpired"));
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      logInfo("Received chat response", data);

      // Add AI response to messages
      const aiMessage: Message = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, aiMessage]);

      // Check if we've reached 5 messages (the new requirement)
      const newMessageCount = messages.length + 2; // +2 for the new user and AI messages
      
      if (newMessageCount >= 10) { // 5 user messages + 5 AI responses
        logInfo("Reached 5 interactions, creating playlist");
        await createPlaylist();
      }

    } catch (error) {
      logError('Error sending message:', error);
      toast.error(t("error.connectionFailed"));
    } finally {
      setIsLoading(false);
    }

  }, [userId, messages.length, t, logout]);

  // Create a playlist after 5 interactions
  const createPlaylist = useCallback(async (): Promise<void> => {
    if (!userId) {
      toast.error(t("error.sessionExpired"));
      return;
    }

    setIsLoading(true);
    try {
      logInfo("Creating playlist", { userId });
      
      const response = await fetch(`${API_BASE_URL}/create-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Important for cookies/session
      });

      if (response.status === 401) {
        logWarning("Authentication required for playlist creation");
        toast.error(t("error.sessionExpired"));
        logout();
        return;
      }

      if (response.status === 400) {
        const errorData = await response.json();
        logWarning("Cannot create playlist", errorData);
        toast.error(t("error.insufficientInteractions"));
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      logInfo("Playlist created successfully", data);

      if (data.success && data.playlist_url) {
        setIsFinished(true);
        setMood(data.mood || null);
        setPlaylistUrl(data.playlist_url || null);
        toast.success(t("success.playlistCreated"));
      } else {
        logWarning("Playlist creation response missing data", data);
        toast.error(t("error.playlistCreationFailed"));
      }
    } catch (error) {
      logError('Error creating playlist:', error);
      toast.error(t("error.connectionFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [userId, t, logout]);

  // Load mood result from the backend
  const loadMoodResult = useCallback(async (userId: string): Promise<void> => {
    setIsLoading(true);
    try {
      logInfo("Loading mood result", { userId });
      
      // This endpoint doesn't exist in the new API, so we're adapting
      // In a real situation, we'd implement proper session restoration or storage
      const moodData = localStorage.getItem(`mood_${userId}`);
      const playlistData = localStorage.getItem(`playlist_${userId}`);
      
      if (moodData && playlistData) {
        setMood(moodData);
        setPlaylistUrl(playlistData);
        logInfo("Loaded mood data from local storage", { mood: moodData, playlist: playlistData });
      } else {
        logWarning("No mood data found for user", { userId });
        setMood(null);
        setPlaylistUrl(null);
      }
    } catch (error) {
      logError('Error loading result:', error);
      toast.error(t("error.connectionFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Reset chat state
  const resetChat = useCallback(() => {
    logInfo("Resetting chat state");
    setMessages([]);
    setIsFinished(false);
    setMood(null);
    setPlaylistUrl(null);
    
    // Clear local storage mood data
    if (userId) {
      localStorage.removeItem(`mood_${userId}`);
      localStorage.removeItem(`playlist_${userId}`);
    }
  }, [userId]);

  // Store mood and playlist data when they change
  useEffect(() => {
    if (userId && mood && playlistUrl) {
      localStorage.setItem(`mood_${userId}`, mood);
      localStorage.setItem(`playlist_${userId}`, playlistUrl);
      logInfo("Saved mood data to local storage", { userId, mood });
    }
  }, [userId, mood, playlistUrl]);

  const contextValue: ChatContextType = {
    messages,
    isLoading,
    isFinished,
    mood,
    playlistUrl,
    sendMessage,
    loadMoodResult,
    resetChat
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook for using the chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
