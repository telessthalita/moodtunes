
import { useMemo } from "react";
import { Button } from "./ui/button";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "../contexts/LanguageContext";
import { getPlaylistEmbedUrl } from "../utils/spotifyUtils";
import { logInfo } from "../utils/logUtils";

interface PlaylistEmbedProps {
  playlistId: string | null;
  playlistUrl: string | null;
}

const PlaylistEmbed = ({ playlistId, playlistUrl }: PlaylistEmbedProps) => {
  const { t } = useTranslation();
  
  // Memoized playlist embed URL for better performance
  const playlistEmbedUrl = useMemo(() => {
    return getPlaylistEmbedUrl(playlistId);
  }, [playlistId]);

  if (!playlistUrl) {
    return null;
  }

  return (
    <>
      {playlistEmbedUrl ? (
        <div className="w-full max-w-2xl aspect-video mb-6">
          <iframe
            title="Spotify Playlist"
            src={playlistEmbedUrl}
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
      
      <Button 
        onClick={() => {
          logInfo("Opening Spotify playlist in new tab", { playlistUrl });
          window.open(playlistUrl, "_blank");
        }}
        className="bg-[#1DB954] hover:bg-[#1ed760] text-white font-bold px-8 py-6 rounded-full text-lg flex items-center gap-2 transition-transform hover:scale-105"
      >
        <ExternalLink size={20} />
        {t("result.listenOnSpotify")}
      </Button>
    </>
  );
};

export default PlaylistEmbed;
