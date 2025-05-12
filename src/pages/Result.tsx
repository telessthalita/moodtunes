import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { Button } from "../components/ui/button";
import { Music, Loader, RefreshCw, ExternalLink, LogOut } from "lucide-react";
import Footer from "../components/Footer";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { getMoodEmoji } from "../utils/moodHelper";
import MoodTunesAvatar from "../components/MoodTunesAvatar";

// Regular expressions for extracting Spotify playlist ID
const SPOTIFY_PLAYLIST_REGEX = [
  /spotify\.com\/playlist\/([a-zA-Z0-9]{22})/,  // Standard URL format
  /spotify:playlist:([a-zA-Z0-9]{22})/,         // URI format
  /^([a-zA-Z0-9]{22})$/                         // Direct ID
];

const Result = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userId, logout } = useAuth();
  const { mood, playlistUrl, isLoading, loadMoodResult, resetChat } = useChat();
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  
  // Load result on mount if not already loaded
  useEffect(() => {
    if (userId && !mood && !isLoading) {
      console.log("🔵 Loading mood result for user:", userId);
      loadMoodResult(userId).catch(err => {
        console.error("🔴 Error loading mood result:", err);
      });
    }
  }, [userId, mood, isLoading, loadMoodResult]);
  
  // Extract and set playlist ID from URL
  useEffect(() => {
    if (playlistUrl) {
      const extractedId = getPlaylistId(playlistUrl);
      console.log("🔵 Extracted playlist ID:", extractedId);
      setPlaylistId(extractedId);
    }
  }, [playlistUrl]);

  // Improved function for extracting Spotify playlist ID 
  const getPlaylistId = useCallback((url: string): string | null => {
    console.log("🔵 Attempting to parse playlist URL:", url);
    
    try {
      // Try each regex pattern
      for (const regex of SPOTIFY_PLAYLIST_REGEX) {
        const match = url.match(regex);
        if (match && match[1]) {
          console.log("🔵 Matched playlist ID with pattern:", regex);
          return match[1];
        }
      }
      
      // Try parsing as URL
      try {
        const parsedUrl = new URL(url);
        const pathSegments = parsedUrl.pathname.split('/');
        const playlistIndex = pathSegments.indexOf('playlist');
        
        if (playlistIndex !== -1 && playlistIndex + 1 < pathSegments.length) {
          const id = pathSegments[playlistIndex + 1];
          if (id && id.length === 22) {
            console.log("🔵 Extracted ID from URL path segments:", id);
            return id;
          }
        }
      } catch (e) {
        console.warn("🟡 URL parsing failed:", e);
      }
      
      console.warn("🟡 Could not extract playlist ID from:", url);
      return null;
    } catch (e) {
      console.error("🔴 Error extracting playlist ID:", e);
      return null;
    }
  }, []);

  const handleStartOver = useCallback(() => {
    console.log("🔵 Starting over, resetting chat");
    resetChat();
    navigate("/chat", { replace: true });
  }, [resetChat, navigate]);

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
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </Button>
        </div>
      </div>

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
                      URL: {playlistUrl || t("result.noUrlAvailable")}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 justify-center mt-2">
                  <Button 
                    onClick={() => {
                      console.log("🔵 Opening Spotify playlist in new tab");
                      window.open(playlistUrl, "_blank");
                    }}
                    className="bg-[#1DB954] hover:bg-[#1ed760] text-white font-bold px-8 py-6 rounded-full text-lg flex items-center gap-2 transition-transform hover:scale-105"
                  >
                    <ExternalLink size={20} />
                    {t("result.listenOnSpotify")}
                  </Button>
                  
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
