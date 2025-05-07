
import React, { useEffect, useRef } from "react";
import { useChat } from "../contexts/ChatContext";

const MoodVisualizer = () => {
  const { mood } = useChat();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Get visualization color based on mood
  const getMoodColor = () => {
    if (!mood) return "#1DB954"; // Default Spotify green
    
    const moodColors: Record<string, string> = {
      "happy": "#FFD700", // Gold
      "excited": "#FF4500", // Orange Red
      "energetic": "#FF1493", // Deep Pink
      "relaxed": "#4B0082", // Indigo
      "calm": "#00CED1", // Dark Turquoise
      "melancholic": "#483D8B", // Dark Slate Blue
      "sad": "#4682B4", // Steel Blue
      "angry": "#DC143C", // Crimson
      "romantic": "#FF69B4", // Hot Pink
    };
    
    // Convert mood to lowercase and check if it exists in our color map
    const moodLower = mood.toLowerCase();
    for (const [key, value] of Object.entries(moodColors)) {
      if (moodLower.includes(key)) {
        return value;
      }
    }
    
    // Default color
    return "#1DB954";
  };
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const centerX = canvas.width / 2;
    const baseRadius = Math.min(canvas.width, canvas.height) * 0.2;
    
    // Animation variables
    const particles: Array<{
      x: number;
      y: number;
      radius: number;
      speed: number;
      angle: number;
      opacity: number;
      color: string;
    }> = [];
    
    const moodColor = getMoodColor();
    
    // Create particles
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = baseRadius * (0.2 + Math.random() * 0.3);
      const distance = baseRadius * (0.5 + Math.random() * 0.5);
      
      particles.push({
        x: centerX + Math.cos(angle) * distance,
        y: canvas.height / 2 + Math.sin(angle) * distance,
        radius: radius,
        speed: 0.005 + Math.random() * 0.01,
        angle: angle,
        opacity: 0.4 + Math.random() * 0.6,
        color: moodColor
      });
    }
    
    let animationFrameId: number;
    
    // Animation function
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw and update particles
      particles.forEach(particle => {
        // Update angle
        particle.angle += particle.speed;
        
        // Calculate new position
        const distanceFromCenter = baseRadius * (0.5 + Math.sin(particle.angle) * 0.5);
        particle.x = centerX + Math.cos(particle.angle) * distanceFromCenter;
        particle.y = canvas.height / 2 + Math.sin(particle.angle) * distanceFromCenter * 0.5;
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${particle.color}${Math.floor(particle.opacity * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
      });
      
      animationFrameId = window.requestAnimationFrame(animate);
    };
    
    animate();
    
    // Clean up
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [mood]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-48 rounded-lg mb-4"
      aria-label="Music mood visualization"
    />
  );
};

export default MoodVisualizer;
