
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Loader } from "lucide-react";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Log route navigation for debugging
  useEffect(() => {
    console.log(`🔵 Protected route accessed: ${location.pathname} - Auth status: ${isAuthenticated ? 'Authenticated' : 'Not Authenticated'}`);
  }, [location.pathname, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1E1B2E] transition-opacity duration-300">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader className="text-[#1DB954] animate-spin" size={40} />
          <p className="text-[#1DB954] animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log("🔴 Authentication required - Redirecting to login");
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
