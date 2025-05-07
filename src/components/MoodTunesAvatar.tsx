
import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { Music } from "lucide-react";

interface MoodTunesAvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
}

const MoodTunesAvatar: React.FC<MoodTunesAvatarProps> = ({ size = "md" }) => {
  const sizeClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  };

  return (
    <Avatar className={`${sizeClass[size]} border-2 border-[#1DB954]`}>
      <AvatarImage 
        src="/lovable-uploads/ddab6411-6b81-4162-9bf4-8f5fb2e62f85.png" 
        alt="MoodTunes" 
      />
      <AvatarFallback className="bg-[#1E1B2E]">
        <Music className="text-[#1DB954]" />
      </AvatarFallback>
    </Avatar>
  );
};

export default MoodTunesAvatar;
