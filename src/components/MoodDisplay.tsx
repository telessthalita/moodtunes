
import React from 'react';
import { useTranslation } from "../contexts/LanguageContext";
import { getMoodEmoji } from "../utils/moodHelper";

interface MoodDisplayProps {
  mood: string;
}

const MoodDisplay = ({ mood }: MoodDisplayProps) => {
  const { t } = useTranslation();
  
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-2">{t("result.yourMood")}</h2>
      <div className="text-5xl my-4">
        {getMoodEmoji(mood)} <span className="font-medium">{mood}</span>
      </div>
      <p className="text-gray-400 max-w-lg mx-auto">{t("result.playlistReady")}</p>
    </div>
  );
};

export default MoodDisplay;
