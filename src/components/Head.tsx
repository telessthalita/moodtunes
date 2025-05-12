
import React, { useEffect } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const Head = () => {
  const location = useLocation();
  const title = "MoodTunes - Music for your mood"; 
  const description = "Create playlists tailored to your mood with AI and Spotify.";
  const url = "https://moodtunes.app"; // Replace with your actual production URL when available
  const imageUrl = "/lovable-uploads/moodtunes-avatar.png"; // Logo or OG image

  // Update page title based on route
  useEffect(() => {
    let pageTitle = title;
    
    if (location.pathname === "/chat") {
      pageTitle = "Chat - MoodTunes";
    } else if (location.pathname === "/result") {
      pageTitle = "Your Playlist - MoodTunes";
    }
    
    document.title = pageTitle;
  }, [location]);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* OpenGraph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url + location.pathname} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url + location.pathname} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      
      {/* App specific */}
      <meta name="application-name" content="MoodTunes" />
      <meta name="apple-mobile-web-app-title" content="MoodTunes" />
      <meta name="theme-color" content="#1E1B2E" />
    </Helmet>
  );
};

export default Head;
