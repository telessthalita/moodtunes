import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

// Define available languages
export type Language = 'pt' | 'en' | 'es';

// Translations type
type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

// Translations data
const translations: Translations = {
  pt: {
    "landing.tagline": "Descubra playlists que combinam com seu humor",
    "landing.loginButton": "Conectar com Spotify",
    "landing.instruction": "Faça login para começar a conversar e criar sua playlist personalizada.",

    "chat.welcome": "Olá! Vamos descobrir seu humor hoje.",
    "chat.startPrompt": "Conte-me como está se sentindo ou o que está acontecendo no seu dia...",
    "chat.inputPlaceholder": "Digite sua mensagem...",
    "chat.thinking": "Pensando...",

    "result.loading": "Analisando seu humor e gerando sua playlist...",
    "result.error": "Ocorreu um problema ao carregar seus resultados. Por favor, tente novamente.",
    "result.tryAgain": "Tentar novamente",
    "result.yourMood": "Seu humor é",
    "result.playlistReady": "Criamos uma playlist personalizada baseada no seu humor. Aproveite!",
    "result.spotifyPlaylist": "Sua Playlist Personalizada",
    "result.enjoyMusic": "Aprecie estas músicas selecionadas especialmente para você",
    "result.listenOnSpotify": "Ouvir no Spotify",
    "result.startOver": "Começar nova conversa",

    "chat.creatingPlaylist": "Criando sua playlist personalizada...",
    "chat.oneMoreMessage": "Mais uma mensagem para criar sua playlist!",
    "chat.messagesRemaining": "Faltam {count} mensagens para criar sua playlist",
    
    "footer.text": "Produzido por Thalita Teles utilizando tecnologias da Gemini AI e Spotify.",

    "error.sessionExpired": "Sua sessão expirou. Por favor, faça login novamente.",
    "error.connectionFailed": "Erro ao conectar com o Spotify. Por favor, tente novamente.",

    "language.english": "Inglês",
    "language.portuguese": "Português",
    "language.spanish": "Espanhol",
  },
  en: {
    "landing.tagline": "Discover playlists that match your mood",
    "landing.loginButton": "Connect with Spotify",
    "landing.instruction": "Log in to start chatting and create your personalized playlist.",

    "chat.welcome": "Hello! Let's discover your mood today.",
    "chat.startPrompt": "Tell me how you're feeling or what's happening in your day...",
    "chat.inputPlaceholder": "Type your message...",
    "chat.thinking": "Thinking...",

    "result.loading": "Analyzing your mood and generating your playlist...",
    "result.error": "There was an issue loading your results. Please try again.",
    "result.tryAgain": "Try again",
    "result.yourMood": "Your mood is",
    "result.playlistReady": "We've created a personalized playlist based on your mood. Enjoy!",
    "result.spotifyPlaylist": "Your Personalized Playlist",
    "result.enjoyMusic": "Enjoy these songs specially selected for you",
    "result.listenOnSpotify": "Listen on Spotify",
    "result.startOver": "Start new conversation",

    "chat.creatingPlaylist": "Creating your personalized playlist...",
    "chat.oneMoreMessage": "One more message to create your playlist!",
    "chat.messagesRemaining": "{count} more messages to create your playlist",
    
    "footer.text": "Produced by Thalita Teles using Gemini AI and Spotify technologies.",

    "error.sessionExpired": "Your session has expired. Please log in again.",
    "error.connectionFailed": "Failed to connect with Spotify. Please try again.",

    "language.english": "English",
    "language.portuguese": "Portuguese",
    "language.spanish": "Spanish",
  },
  es: {
    "landing.tagline": "Descubre playlists que coinciden con tu estado de ánimo",
    "landing.loginButton": "Conectar con Spotify",
    "landing.instruction": "Inicia sesión para comenzar a chatear y crear tu lista de reproducción personalizada.",

    "chat.welcome": "¡Hola! Vamos a descubrir tu humor hoy.",
    "chat.startPrompt": "Cuéntame cómo te sientes o qué está pasando en tu día...",
    "chat.inputPlaceholder": "Escribe tu mensaje...",
    "chat.thinking": "Pensando...",

    "result.loading": "Analizando tu estado de ánimo y generando tu lista de reproducción...",
    "result.error": "Hubo un problema al cargar tus resultados. Por favor, inténtalo de nuevo.",
    "result.tryAgain": "Intentar de nuevo",
    "result.yourMood": "Tu estado de ánimo es",
    "result.playlistReady": "Hemos creado una lista de reproducción personalizada basada en tu humor. ¡Disfrútala!",
    "result.spotifyPlaylist": "Tu Lista de Reproducción Personalizada",
    "result.enjoyMusic": "Disfruta estas canciones especialmente seleccionadas para ti",
    "result.listenOnSpotify": "Escuchar en Spotify",
    "result.startOver": "Iniciar nueva conversación",

    "chat.creatingPlaylist": "Creando tu lista de reproducción personalizada...",
    "chat.oneMoreMessage": "¡Un mensaje más para crear tu lista de reproducción!",
    "chat.messagesRemaining": "Faltan {count} mensajes para crear tu lista de reproducción",
    
    "footer.text": "Producido por Thalita Teles utilizando tecnologías de Gemini AI y Spotify.",

    "error.sessionExpired": "Tu sesión ha caducado. Por favor, inicia sesión de nuevo.",
    "error.connectionFailed": "Error al conectar con Spotify. Por favor, inténtalo de nuevo.",

    "language.english": "Inglés",
    "language.portuguese": "Portugués",
    "language.spanish": "Español",
  }
};

// Context type
type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, any>) => string;
};

// Create context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Provider component
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to get language from localStorage or default to 'pt'
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem('language') as Language) || 'pt'
  );

  // Set language and save to localStorage
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  }, []);

  // Translation function with parameter support
  const t = useCallback((key: string, options?: Record<string, any>): string => {
    let text = translations[language][key] || key;
    
    // Replace placeholders if options are provided
    if (options) {
      Object.keys(options).forEach(optionKey => {
        const placeholder = `{${optionKey}}`;
        text = text.replace(placeholder, options[optionKey].toString());
      });
    }
    
    return text;
  }, [language]);

  // Memoize context value
  const value = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook for using the language context
export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
