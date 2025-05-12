
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { Button } from "../components/ui/button";
import { Loader, RefreshCw } from "lucide-react";
import Footer from "../components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { getPlaylistId } from "../utils/spotifyUtils";
import { logInfo, logError } from "../utils/logUtils";
import ApplicationHeader from "../components/ApplicationHeader";
import MoodDisplay from "../components/MoodDisplay";
import PlaylistEmbed from "../components/PlaylistEmbed";

const Result = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { mood, playlistUrl, isLoading, loadMoodResult, resetChat } = useChat();
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  
  // Load result on mount if not already loaded
  useEffect(() => {
    if (userId && !mood && !isLoading) {
      logInfo("Loading mood result for user:", userId);
      loadMoodResult(userId).catch(err => {
        logError("Error loading mood result:", err);
      });
    }
  }, [userId, mood, isLoading, loadMoodResult]);
  
  // Extract and set playlist ID from URL
  useEffect(() => {
    if (playlistUrl) {
      const extractedId = getPlaylistId(playlistUrl);
      logInfo("Extracted playlist ID:", extractedId);
      setPlaylistId(extractedId);
    }
  }, [playlistUrl]);

  const handleStartOver = useCallback(() => {
    logInfo("Starting over, resetting chat");
    resetChat();
    navigate("/chat", { replace: true });
  }, [resetChat, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-[#1E1B2E] text-white">
      <ApplicationHeader />

      <div className="flex-1 p-4 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <Loader className="text-[#1DB954] animate-spin" size={50} />
            <p className="text-xl">{t("result.loading")}</p>
          </div>
        ) : !mood || !playlistUrl ? (
          <div className="text-center animate-fade-in">
            <p className="text-xl mb-4">{t("result.error")}</p>
            <Button 
              onClick={handleStartOver} 
              className="bg-[#1DB954] hover:bg-[#1ed760] transition-colors"
            >
              <RefreshCw className="mr-2" size={18} />
              {t("result.tryAgain")}
            </Button>
          </div>
        ) : (
          <div className="w-full space-y-8 animate-fade-in">
            <MoodDisplay mood={mood} />

            <Card className="bg-[#2D2254] border-[#1DB954]/30">
              <CardHeader>
                <CardTitle className="text-xl text-[#1DB954]">{t("result.spotifyPlaylist")}</CardTitle>
                <CardDescription>{t("result.enjoyMusic")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <PlaylistEmbed playlistId={playlistId} playlistUrl={playlistUrl} />
                
                <div className="flex flex-wrap gap-4 justify-center mt-6">
                  <Button 
                    variant="outline"
                    onClick={handleStartOver} 
                    className="border-[#1DB954]/50 text-[#1DB954] hover:bg-[#1DB954]/10 px-8 py-6 rounded-full text-lg transition-colors"
                  >
                    <RefreshCw size={20} className="mr-2" />
                    {t("result.startOver")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default Result;
