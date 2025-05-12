
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import Head from "./components/Head";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import Result from "./pages/Result";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

// Custom Router to ensure proper provider nesting
const AppRouter = () => (
  <BrowserRouter>
    <HelmetProvider>
      <LanguageProvider>
        <AuthProvider>
          <ChatProvider>
            <Head />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route 
                path="/chat" 
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/result" 
                element={
                  <ProtectedRoute>
                    <Result />
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ChatProvider>
        </AuthProvider>
      </LanguageProvider>
    </HelmetProvider>
  </BrowserRouter>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppRouter />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
