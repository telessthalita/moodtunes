
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Music, Sparkles, AlertCircle } from "lucide-react";
import Footer from "../components/Footer";
import LanguageSwitcher from "../components/LanguageSwitcher";
import MoodTunesAvatar from "../components/MoodTunesAvatar";
import { toast } from "sonner";
import { useIsMobile } from "../hooks/use-mobile";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, isLoading, checkSession, isAuthenticated, loginError } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check if the URL contains a user_id parameter (from callback)
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user_id");

    if (userId) {
      console.log("Found user_id in URL");
      toast.info("Verificando autenticação...");
      checkSession(userId)
        .then(success => {
          console.log("Session check result:", success);
          if (success) {
            toast.success("Autenticação bem-sucedida!");
            navigate("/chat", { replace: true });
          } else {
            toast.error("Falha na autenticação. Por favor, tente novamente.");
          }
        })
        .catch(err => {
          console.error("Session check error:", err);
          toast.error("Erro ao verificar sessão: " + (err.message || "Erro desconhecido"));
        });
    }
  }, [checkSession, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/chat");
    }
    
    // Check if we were in the middle of authentication (for mobile flow)
    const authInProgress = sessionStorage.getItem('authInProgress');
    if (authInProgress) {
      const lastAuthAttempt = sessionStorage.getItem('lastAuthAttempt');
      const now = new Date().getTime();
      
      // Only show toast if the last attempt was recent (within 3 minutes)
      if (lastAuthAttempt && now - parseInt(lastAuthAttempt, 10) < 180000) {
        toast.info("Verificando status da autenticação...");
      } else {
        // Clear stale auth progress data
        sessionStorage.removeItem('authInProgress');
        sessionStorage.removeItem('lastAuthAttempt');
      }
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = () => {
    console.log("Login button clicked");
    login();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#1E1B2E] via-[#241e36] to-[#1a172a] text-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#1DB954]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-purple-900/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-900/20 rounded-full blur-3xl"></div>

        {/* Floating music notes */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-[#1DB954]/20"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              fontSize: `${Math.random() * 30 + 20}px`,
              animation: `float ${Math.random() * 10 + 15}s infinite ease-in-out ${Math.random() * 5}s`,
              opacity: 0.4
            }}
          >
            ♪
          </div>
        ))}
      </div>

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md mx-auto text-center px-4 z-10">
        <div className="relative mb-6">
          <MoodTunesAvatar size="xl" />
        </div>

        <div className="relative">
          <h1 className="text-6xl md:text-7xl font-bold mb-2 bg-gradient-to-r from-[#1DB954] via-teal-400 to-[#1DB954] bg-clip-text text-transparent animate-pulse-slow">
            MoodTunes
          </h1>
          <div className="absolute -top-10 -right-10 animate-spin-slow opacity-70">
            <Sparkles className="text-[#1DB954]" size={24} />
          </div>
        </div>

        <p className="text-xl md:text-2xl mb-12 text-gray-300 max-w-sm animate-fade-in">
          {t("landing.tagline")}
        </p>

        {loginError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-white flex items-center gap-2">
            <AlertCircle size={18} />
            <p className="text-sm">{loginError}</p>
          </div>
        )}

        <Button
          onClick={handleLogin}
          disabled={isLoading}
          className="bg-[#1DB954] hover:bg-[#1ed760] text-white font-bold py-4 px-10 rounded-full text-lg flex items-center gap-3 transition-all transform hover:scale-105 hover:shadow-[0_0_15px_rgba(29,185,84,0.5)] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Conectando...
            </>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" fill="#1DB954" />
                <path d="M16.7375 17.0125C16.5875 17.275 16.3125 17.4 16.05 17.4C15.9125 17.4 15.775 17.3625 15.65 17.2875C14.575 16.6375 13.3 16.2875 11.9625 16.2875C10.9 16.2875 9.85 16.5 8.8625 16.925C8.5 17.0625 8.0875 16.9125 7.9375 16.55C7.8 16.1875 7.95 15.775 8.3125 15.625C9.475 15.125 10.7125 14.8625 12 14.8625C13.575 14.8625 15.075 15.275 16.3625 16.05C16.7 16.25 16.7875 16.6875 16.7375 17.0125ZM17.8875 14.1C17.7 14.4375 17.35 14.6 16.9875 14.6C16.825 14.6 16.6625 14.5625 16.5125 14.4625C15.2125 13.675 13.6375 13.2625 11.9875 13.2625C10.675 13.2625 9.375 13.5125 8.2 14C7.775 14.15 7.3125 13.9 7.1625 13.475C7.0125 13.05 7.2625 12.5875 7.6875 12.4375C9.0625 11.8625 10.5125 11.5625 12.0125 11.5625C14 11.5625 15.8875 12.05 17.4625 13C17.8375 13.225 17.9875 13.7125 17.8875 14.1ZM19.1125 10.8375C18.9 11.2375 18.4875 11.4375 18.075 11.4375C17.8875 11.4375 17.7 11.3875 17.525 11.275C16 10.3625 14.0125 9.85 11.975 9.85C10.4875 9.85 9.025 10.125 7.6625 10.675C7.1875 10.85 6.675 10.5875 6.5 10.1125C6.325 9.6375 6.5875 9.125 7.0625 8.95C8.625 8.3125 10.3 8 12 8C14.35 8 16.6625 8.6 18.4375 9.6625C18.8625 9.925 19.0625 10.4125 19.1125 10.8375Z" fill="white" />
              </svg>
              {isMobile ? t("landing.loginButtonMobile") || "Continuar com Spotify" : t("landing.loginButton")}
            </>
          )}
        </Button>

        <p className="mt-8 text-sm text-gray-400 max-w-xs mx-auto animate-fade-in-delay">
          {isMobile ? t("landing.instructionMobile") || "Você será redirecionado para autenticar com o Spotify" : t("landing.instruction")}
        </p>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
