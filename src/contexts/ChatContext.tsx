
import React, { createContext, useContext, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useTranslation } from './LanguageContext';

// Updated API base URL
const API_BASE_URL = 'https://moodtunes-htki.onrender.com';

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
  const { userId } = useAuth();
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
      return;
    }

    // Add user message to the chat
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/moodtalk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          message: content,
          lang: language
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const aiMessage: Message = { role: 'assistant', content: data.resposta };
      setMessages(prev => [...prev, aiMessage]);

      if (data.playlist_url) {
        setIsFinished(true);
        setMood(data.mood || null);
        setPlaylistUrl(data.playlist_url || null);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t("error.connectionFailed"));
    } finally {
      setIsLoading(false);
    }

  }, [userId, language, t]);

  // Load mood result from the backend
  const loadMoodResult = useCallback(async (userId: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/moodresult?user_id=${userId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMood(data.mood);
      setPlaylistUrl(data.playlist_url);
    } catch (error) {
      console.error('Error loading result:', error);
      toast.error(t("error.connectionFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Reset chat state
  const resetChat = useCallback(() => {
    setMessages([]);
    setIsFinished(false);
    setMood(null);
    setPlaylistUrl(null);
  }, []);

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
