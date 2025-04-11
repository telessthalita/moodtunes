
import { cn } from "../lib/utils";
import { motion } from "framer-motion";

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
}

const MessageBubble = ({ message, isUser }: MessageBubbleProps) => {
  return (
    <motion.div 
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 shadow-md",
        isUser 
          ? "bg-gradient-to-br from-[#1DB954]/90 to-[#1DB954]/80 text-white rounded-tr-none backdrop-blur-sm" 
          : "card-glassmorphism text-white rounded-tl-none"
      )}>
        <p className="whitespace-pre-wrap">{message}</p>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
