
import { useEffect, useState } from "react";
import { Progress } from "./ui/progress";

interface LoadingIndicatorProps {
  isLoading: boolean;
}

const LoadingIndicator = ({ isLoading }: LoadingIndicatorProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }

    // Reset progress when loading starts
    setProgress(0);

    // Simulate progress over time
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        // Progress more quickly at the start, then slow down
        if (prevProgress < 20) return prevProgress + 5;
        if (prevProgress < 50) return prevProgress + 3;
        if (prevProgress < 80) return prevProgress + 1;
        if (prevProgress < 95) return prevProgress + 0.5;
        return prevProgress;
      });
    }, 300);

    return () => {
      clearInterval(interval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="w-full max-w-md mx-auto mt-4">
      <Progress value={progress} className="h-1.5 bg-gray-700" />
    </div>
  );
};

export default LoadingIndicator;
