
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";
import MoodTunesAvatar from "./MoodTunesAvatar";

const ApplicationHeader = () => {
  const { logout } = useAuth();
  
  return (
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
  );
};

export default ApplicationHeader;
