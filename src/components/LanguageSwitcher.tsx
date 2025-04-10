
import { useState } from "react";
import { useTranslation, Language } from "../contexts/LanguageContext";
import { Button } from "./ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../components/ui/dropdown-menu";
import { Globe } from "lucide-react";

const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
  };
  
  const languageOptions = [
    { code: 'en', label: t("language.english") },
    { code: 'pt', label: t("language.portuguese") },
    { code: 'es', label: t("language.spanish") }
  ];
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-gray-400 hover:text-white"
        >
          <Globe size={20} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#2D2254] border-[#1DB954]/30 text-white">
        {languageOptions.map((option) => (
          <DropdownMenuItem 
            key={option.code}
            className={`cursor-pointer ${language === option.code ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'hover:bg-[#1DB954]/10'}`}
            onClick={() => handleLanguageChange(option.code as Language)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
