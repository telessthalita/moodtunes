
import React from 'react';
import { useTranslation } from "../contexts/LanguageContext";

interface ChatProgressIndicatorProps {
  userMessageCount: number;
}

const ChatProgressIndicator = ({ userMessageCount }: ChatProgressIndicatorProps) => {
  const { t } = useTranslation();
  
  // Progress text based on number of messages
  const getProgressText = () => {
    const remaining = 5 - userMessageCount;
    
    if (remaining <= 0) {
      return t("chat.creatingPlaylist");
    } else if (remaining === 1) {
      return t("chat.oneMoreMessage");
    } else {
      return t("chat.messagesRemaining", { count: remaining });
    }
  };

  return (
    <div className="bg-[#2D2254] px-4 py-2 text-center">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="text-sm text-gray-300">{getProgressText()}</div>
        <div className="flex gap-1">
          {[...Array(5)].map((_, index) => (
            <div 
              key={index} 
              className={`w-4 h-1 rounded-full ${index < userMessageCount ? 'bg-[#1DB954]' : 'bg-gray-600'}`}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatProgressIndicator;
