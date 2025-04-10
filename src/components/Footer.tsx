
import { useTranslation } from "../contexts/LanguageContext";

const Footer = () => {
  const { t } = useTranslation();
  
  return (
    <footer className="w-full py-4 text-center text-sm text-gray-400 border-t border-[#2D2254] mt-auto">
      <p>{t("footer.text")}</p>
    </footer>
  );
};

export default Footer;
