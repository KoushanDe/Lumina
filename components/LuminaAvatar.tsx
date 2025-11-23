
import React from 'react';

export const LuminaAvatar: React.FC<{ size?: number, className?: string }> = ({ size = 200, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`rounded-2xl shadow-2xl ${className}`}
      style={{ boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)' }}
    >
      {/* DEFINITIONS */}
      <defs>
        <radialGradient id="bg_grad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        
        <radialGradient id="lumina_body" cx="0.35" cy="0.35" r="0.6">
          <stop offset="0%" stopColor="#e0ffff" />
          <stop offset="40%" stopColor="#00ffff" />
          <stop offset="100%" stopColor="#0066cc" />
        </radialGradient>

        <filter id="outer_glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 1 0 0 0  0 0 0 1 0" result="cyan_blur" />
          <feMerge>
            <feMergeNode in="cyan_blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        <filter id="sparkle_glow">
           <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>

      {/* BACKGROUND */}
      <rect width="512" height="512" fill="url(#bg_grad)" rx="64" />
      
      {/* BACKGROUND PARTICLES */}
      <circle cx="100" cy="100" r="2" fill="#ffffff" opacity="0.5" />
      <circle cx="400" cy="80" r="3" fill="#ffffff" opacity="0.3" />
      <circle cx="450" cy="400" r="2" fill="#ffffff" opacity="0.4" />
      <circle cx="50" cy="450" r="4" fill="#a78bfa" opacity="0.3" /> {/* Purple/Aura hint */}
      <circle cx="480" cy="200" r="2" fill="#f472b6" opacity="0.3" /> {/* Pink/Aura hint */}

      {/* PLATFORM (Silhouette) */}
      <path d="M 106 400 L 406 400 L 450 450 L 62 450 Z" fill="#222" opacity="0.8" />

      {/* MAIN CHARACTER (LUMINA) */}
      <g filter="url(#outer_glow)">
        {/* Core Body */}
        <circle cx="256" cy="256" r="90" fill="url(#lumina_body)" />
        
        {/* Eyes (Relatability) */}
        <ellipse cx="226" cy="245" rx="12" ry="22" fill="#003366" />
        <ellipse cx="286" cy="245" rx="12" ry="22" fill="#003366" />
        
        {/* Eye Highlights (Life) */}
        <circle cx="230" cy="238" r="5" fill="white" />
        <circle cx="290" cy="238" r="5" fill="white" />
        
        {/* Subtle Blush (Emotion) */}
        <ellipse cx="226" cy="270" rx="10" ry="5" fill="#00ffff" opacity="0.3" />
        <ellipse cx="286" cy="270" rx="10" ry="5" fill="#00ffff" opacity="0.3" />
      </g>

      {/* AURA REFLECTION (Subtle Pink light from the 'goal') */}
      <circle cx="400" cy="150" r="40" fill="#ff00ff" filter="url(#sparkle_glow)" opacity="0.1" />

      {/* FOREGROUND SPARKLES */}
      <circle cx="200" cy="350" r="3" fill="white" opacity="0.8" />
      <circle cx="312" cy="180" r="2" fill="white" opacity="0.6" />

    </svg>
  );
};
