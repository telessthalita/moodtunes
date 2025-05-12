
import { logInfo, logWarning, logError } from './logUtils';

// Regular expressions for extracting Spotify playlist ID
const SPOTIFY_PLAYLIST_REGEX = [
  /spotify\.com\/playlist\/([a-zA-Z0-9]{22})/,  // Standard URL format
  /spotify:playlist:([a-zA-Z0-9]{22})/,         // URI format
  /^([a-zA-Z0-9]{22})$/                         // Direct ID
];

/**
 * Extract a Spotify playlist ID from a URL or URI
 */
export const getPlaylistId = (url: string): string | null => {
  logInfo("Attempting to parse playlist URL:", url);
  
  try {
    // Try each regex pattern
    for (const regex of SPOTIFY_PLAYLIST_REGEX) {
      const match = url.match(regex);
      if (match && match[1]) {
        logInfo("Matched playlist ID with pattern:", regex);
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
          logInfo("Extracted ID from URL path segments:", id);
          return id;
        }
      }
    } catch (e) {
      logWarning("URL parsing failed:", e);
    }
    
    logWarning("Could not extract playlist ID from:", url);
    return null;
  } catch (e) {
    logError("Error extracting playlist ID:", e);
    return null;
  }
};

/**
 * Generate an embeddable Spotify URL for a playlist
 */
export const getPlaylistEmbedUrl = (playlistId: string | null): string | null => {
  if (!playlistId) return null;
  return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
};
