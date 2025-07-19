'use client';

import { useState } from 'react';

interface BarrelRatingProps {
  value?: number;
  onChange: (rating: number) => void;
  max?: number;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function BarrelRating({ 
  value = 0, 
  onChange, 
  max = 10, 
  readonly = false,
  size = 'md' 
}: BarrelRatingProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  const handleClick = (rating: number) => {
    if (!readonly) {
      onChange(rating);
    }
  };
  
  const handleMouseEnter = (rating: number) => {
    if (!readonly) {
      setHoveredRating(rating);
    }
  };
  
  const handleMouseLeave = () => {
    setHoveredRating(null);
  };
  
  const displayRating = hoveredRating !== null ? hoveredRating : value;
  
  return (
    <div className="flex items-center space-x-1">
      {[...Array(max)].map((_, index) => {
        const rating = index + 1;
        const filled = rating <= displayRating;
        const partialFill = rating === Math.ceil(displayRating) && displayRating % 1 !== 0;
        const fillPercentage = partialFill ? (displayRating % 1) * 100 : 100;
        
        return (
          <button
            key={index}
            type="button"
            onClick={() => handleClick(rating)}
            onMouseEnter={() => handleMouseEnter(rating)}
            onMouseLeave={handleMouseLeave}
            disabled={readonly}
            className={`relative ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
          >
            <svg
              className={`${sizeClasses[size]} ${filled ? 'text-copper' : 'text-gray-600'}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              {/* Whiskey barrel icon */}
              <path d="M5 5C5 3.9 5.9 3 7 3H17C18.1 3 19 3.9 19 5V6H21V8H19V11H21V13H19V16H21V18H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V18H3V16H5V13H3V11H5V8H3V6H5V5M7 5V7H17V5H7M7 9V11H17V9H7M7 13V15H17V13H7M7 17V19H17V17H7Z" />
            </svg>
            {partialFill && (
              <svg
                className={`${sizeClasses[size]} absolute inset-0 text-copper`}
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ clipPath: `inset(0 ${100 - fillPercentage}% 0 0)` }}
              >
                <path d="M5 5C5 3.9 5.9 3 7 3H17C18.1 3 19 3.9 19 5V6H21V8H19V11H21V13H19V16H21V18H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V18H3V16H5V13H3V11H5V8H3V6H5V5M7 5V7H17V5H7M7 9V11H17V9H7M7 13V15H17V13H7M7 17V19H17V17H7Z" />
              </svg>
            )}
          </button>
        );
      })}
      {!readonly && (
        <span className="ml-2 text-sm text-gray-400">
          {displayRating > 0 ? displayRating.toFixed(1) : '0.0'} / {max}
        </span>
      )}
    </div>
  );
}