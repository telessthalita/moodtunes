
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Music } from "lucide-react";
import Footer from "../components/Footer";
import LanguageSwitcher from "../components/LanguageSwitcher";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, checkSession, isAuthenticated } = useAuth();

  useEffect(() => {
    // Check if the URL contains a user_id parameter (from callback)
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user_id");
    
    if (userId) {
      checkSession(userId);
    }
  }, [checkSession]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/chat");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1E1B2E] text-white p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md text-center">
        <h1 className="text-5xl font-bold mb-2 text-[#1DB954]">MoodTunes</h1>
        <p className="text-xl mb-10 text-gray-300">{t("landing.tagline")}</p>
        
        <div className="animate-pulse mb-12">
          <Music size={80} className="text-[#1DB954] mx-auto" />
        </div>
        
        <Button 
          onClick={login}
          className="bg-[#1DB954] hover:bg-[#1ed760] text-white font-bold py-3 px-8 rounded-full text-lg flex items-center gap-2 transition-all transform hover:scale-105"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" fill="#1DB954"/>
            <path d="M16.7375 17.0125C16.5875 17.275 16.3125 17.4 16.05 17.4C15.9125 17.4 15.775 17.3625 15.65 17.2875C14.575 16.6375 13.3 16.2875 11.9625 16.2875C10.9 16.2875 9.85 16.5 8.8625 16.925C8.5 17.0625 8.0875 16.9125 7.9375 16.55C7.8 16.1875 7.95 15.775 8.3125 15.625C9.475 15.125 10.7125 14.8625 12 14.8625C13.575 14.8625 15.075 15.275 16.3625 16.05C16.7 16.25 16.7875 16.6875 16.7375 17.0125ZM17.8875 14.1C17.7 14.4375 17.35 14.6 16.9875 14.6C16.825 14.6 16.6625 14.5625 16.5125 14.4625C15.2125 13.675 13.6375 13.2625 11.9875 13.2625C10.675 13.2625 9.375 13.5125 8.2 14C7.775 14.15 7.3125 13.9 7.1625 13.475C7.0125 13.05 7.2625 12.5875 7.6875 12.4375C9.0625 11.8625 10.5125 11.5625 12.0125 11.5625C14 11.5625 15.8875 12.05 17.4625 13C17.8375 13.225 17.9875 13.7125 17.8875 14.1ZM19.1125 10.8375C18.9 11.2375 18.4875 11.4375 18.075 11.4375C17.8875 11.4375 17.7 11.3875 17.525 11.275C16 10.3625 14.0125 9.85 11.975 9.85C10.4875 9.85 9.025 10.125 7.6625 10.675C7.1875 10.85 6.675 10.5875 6.5 10.1125C6.325 9.6375 6.5875 9.125 7.0625 8.95C8.625 8.3125 10.3 8 12 8C14.35 8 16.6625 8.6 18.4375 9.6625C18.8625 9.925 19.0625 10.4125 19.1125 10.8375Z" fill="white"/>
          </svg>
          {t("landing.loginButton")}
        </Button>
        
        <p className="mt-8 text-sm text-gray-400">{t("landing.instruction")}</p>
      </div>
      
      <Footer />
    </div>
  );
};

export default Index;
