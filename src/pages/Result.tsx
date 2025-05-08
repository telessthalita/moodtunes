
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { Button } from "../components/ui/button";
import { Music, Loader, RefreshCw } from "lucide-react";
import Footer from "../components/Footer";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { getMoodEmoji } from "../utils/moodHelper";

const Result = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userId, logout } = useAuth();
  const { mood, playlistUrl, isLoading, loadMoodResult, resetChat } = useChat();
  
  useEffect(() => {
    if (userId && !mood && !isLoading) {
      console.log("Loading mood result for user:", userId);
      loadMoodResult(userId);
    }
  }, [userId, mood, isLoading, loadMoodResult]);

  const handleStartOver = () => {
    resetChat();
    navigate("/chat");
  };

  // Melhoria: Função mais robusta para extrair o ID da playlist do Spotify
  const getPlaylistId = () => {
    if (!playlistUrl) {
      console.log("No playlist URL available");
      return null;
    }
    
    try {
      console.log("Extracting playlist ID from:", playlistUrl);
      
      // Tentar extrair usando a URL completa
      if (playlistUrl.includes('spotify.com/playlist/')) {
        const parts = playlistUrl.split('spotify.com/playlist/');
        if (parts.length > 1) {
          const id = parts[1].split('?')[0].split('/')[0];
          console.log("Extracted playlist ID:", id);
          return id;
        }
      }
      
      // Tentar extrair diretamente se parece ser apenas o ID
      if (playlistUrl.length > 10 && !playlistUrl.includes('/')) {
        console.log("Using direct ID:", playlistUrl);
        return playlistUrl;
      }
      
      // Última tentativa usando URL API
      const url = new URL(playlistUrl);
      const pathParts = url.pathname.split('/');
      const id = pathParts[pathParts.indexOf('playlist') + 1];
      console.log("Extracted ID from URL object:", id);
      return id;
    } catch (e) {
      console.error("Error extracting playlist ID:", e);
      // Se for um ID direto, retorná-lo
      if (playlistUrl && playlistUrl.match(/^[a-zA-Z0-9]{22}$/)) {
        return playlistUrl;
      }
      return null;
    }
  };

  const playlistId = getPlaylistId();
  console.log("Final playlist ID for embedding:", playlistId);

  return (
    <div className="min-h-screen flex flex-col bg-[#1E1B2E] text-white">
      <div className="p-4 flex justify-between items-center border-b border-[#2D2254]">
        <h1 className="text-xl font-bold text-[#1DB954]">MoodTunes</h1>
        <LanguageSwitcher />
      </div>

      <div className="flex-1 p-4 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader className="text-[#1DB954] animate-spin" size={50} />
            <p className="text-xl">{t("result.loading")}</p>
          </div>
        ) : !mood || !playlistUrl ? (
          <div className="text-center">
            <p className="text-xl mb-4">{t("result.error")}</p>
            <Button 
              onClick={handleStartOver} 
              className="bg-[#1DB954] hover:bg-[#1ed760]"
            >
              <RefreshCw className="mr-2" size={18} />
              {t("result.tryAgain")}
            </Button>
          </div>
        ) : (
          <div className="w-full space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">{t("result.yourMood")}</h2>
              <div className="text-5xl my-4">
                {getMoodEmoji(mood)} <span className="font-medium">{mood}</span>
              </div>
              <p className="text-gray-400 max-w-lg mx-auto">{t("result.playlistReady")}</p>
            </div>

            <Card className="bg-[#2D2254] border-[#1DB954]/30">
              <CardHeader>
                <CardTitle className="text-xl text-[#1DB954]">{t("result.spotifyPlaylist")}</CardTitle>
                <CardDescription>{t("result.enjoyMusic")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {playlistId ? (
                  <div className="w-full max-w-2xl aspect-video mb-6">
                    <iframe
                      title="Spotify Playlist"
                      src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-lg"
                    ></iframe>
                  </div>
                ) : (
                  <div className="text-center p-4 mb-6 border border-dashed border-[#1DB954]/30 rounded-lg">
                    <p className="text-[#1DB954]">
                      {t("result.playlistLoadingError")}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      URL: {playlistUrl || "Nenhuma URL disponível"}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 justify-center mt-2">
                  <Button 
                    onClick={() => window.open(playlistUrl, "_blank")} 
                    className="bg-[#1DB954] hover:bg-[#1ed760] text-white font-bold px-8 py-6 rounded-full text-lg flex items-center gap-2"
                  >
                    <Music size={20} />
                    {t("result.listenOnSpotify")}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={handleStartOver} 
                    className="border-[#1DB954]/50 text-[#1DB954] hover:bg-[#1DB954]/10 px-8 py-6 rounded-full text-lg"
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
