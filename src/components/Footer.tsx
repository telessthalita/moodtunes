
import { Heart, Music } from "lucide-react";
import { useTranslation } from "../contexts/LanguageContext";

const Footer = () => {
  const { t } = useTranslation();
  
  return (
    <footer className="w-full py-6 text-center text-sm backdrop-blur-sm bg-[#1E1B2E]/50 border-t border-[#2D2254]/30 mt-auto relative z-10">
      <div className="flex items-center justify-center gap-2 text-gray-400 hover:text-gray-300 transition-colors">
        <p>{t("footer.text")}</p>
        <Heart className="w-3 h-3 text-[#1DB954] animate-pulse" />
        <Music className="w-3 h-3 text-[#1DB954]" />
      </div>
    </footer>
  );
};

export default Footer;
