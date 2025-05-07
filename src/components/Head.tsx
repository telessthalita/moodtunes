
import React, { useEffect } from 'react';

const Head = () => {
  useEffect(() => {
    // Update the document title
    document.title = 'MoodTunes';
    
    // Update favicon link
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = '/lovable-uploads/moodtunes-avatar.png';
    link.type = 'image/png';
  }, []);

  return null; // This component doesn't render anything
};

export default Head;
