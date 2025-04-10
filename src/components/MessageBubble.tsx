
import { cn } from "../lib/utils";

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
}

const MessageBubble = ({ message, isUser }: MessageBubbleProps) => {
  return (
    <div className={cn(
      "flex",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3",
        isUser 
          ? "bg-[#1DB954] text-white rounded-tr-none" 
          : "bg-[#2D2254] text-white rounded-tl-none"
      )}>
        <p className="whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
};

export default MessageBubble;
