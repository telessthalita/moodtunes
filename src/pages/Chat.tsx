
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Send, LogOut, Loader, Sparkles } from "lucide-react";
import MessageBubble from "../components/MessageBubble";
import Footer from "../components/Footer";
import LanguageSwitcher from "../components/LanguageSwitcher";
import MoodTunesAvatar from "../components/MoodTunesAvatar";

const Chat = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userId, checkSession, logout } = useAuth();
  const { messages, sendMessage, isLoading, isFinished } = useChat();
  const [input, setInput] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messageSuggestions = [
    "I'm feeling really happy today!",
    "I had a tough day at work, feeling stressed",
    "Looking for something relaxing to help me unwind",
    "I want to dance and celebrate tonight!"
  ];

  useEffect(() => {
    // Show suggestion after a short delay if no messages
    if (messages.length === 0) {
      const timer = setTimeout(() => {
        setShowSuggestion(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (userId) checkSession(userId);
    }, 60000); // Check session every minute
    
    return () => clearInterval(interval);
  }, [userId, checkSession]);

  useEffect(() => {
    if (isFinished) {
      navigate("/result");
    }
  }, [isFinished, navigate]);

  useEffect(() => {
    // Scroll to bottom when new messages appear
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    // Maintain focus on input when messages are updated
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
      setShowSuggestion(false);
    }
  };

  const useSuggestion = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
    setShowSuggestion(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#1E1B2E] text-white">
      <div className="p-4 flex justify-between items-center border-b border-[#2D2254]">
        <div className="flex items-center gap-3">
          <MoodTunesAvatar size="sm" />
          <h1 className="text-xl font-bold text-[#1DB954]">MoodTunes</h1>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={logout}
            className="text-gray-400 hover:text-white"
          >
            <LogOut size={20} />
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto flex flex-col max-w-3xl mx-auto w-full">
        <div className="flex-1 space-y-4 mb-4">
          {messages.length === 0 ? (
            <div className="text-center py-10 animate-fade-in">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <MoodTunesAvatar size="lg" />
                  <div className="absolute -top-2 -right-2">
                    <Sparkles className="text-[#1DB954] animate-pulse" size={24} />
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-4">{t("chat.welcome")}</h2>
              <p className="text-gray-400">{t("chat.startPrompt")}</p>
              
              {/* Message suggestions */}
              {showSuggestion && (
                <div className="mt-8 space-y-2 animate-fade-in">
                  <p className="text-sm text-gray-500">Try one of these:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {messageSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => useSuggestion(suggestion)}
                        className="px-3 py-2 bg-[#2D2254] hover:bg-[#3D3264] text-sm rounded-full text-gray-300 transition-all border border-[#1DB954]/30"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, index) => (
              <MessageBubble 
                key={index} 
                message={msg.content} 
                isUser={msg.role === "user"}
              />
            ))
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader size={16} className="animate-spin" />
              <span>{t("chat.thinking")}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.inputPlaceholder")}
            disabled={isLoading}
            className="bg-[#2D2254] border-[#1DB954]/30 focus:border-[#1DB954] text-white"
            autoFocus
          />
          <Button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-[#1DB954] hover:bg-[#1ed760]"
          >
            <Send size={18} />
          </Button>
        </form>
      </div>
      
      <Footer />
    </div>
  );
};

export default Chat;
