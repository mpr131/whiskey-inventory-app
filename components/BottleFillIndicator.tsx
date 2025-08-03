'use client';

import { useMemo } from 'react';

interface BottleFillIndicatorProps {
  fillLevel: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  status?: 'unopened' | 'opened' | 'finished';
}

export default function BottleFillIndicator({ 
  fillLevel, 
  size = 'md', 
  showLabel = true,
  className = '',
  status = 'opened' 
}: BottleFillIndicatorProps) {
  const dimensions = {
    sm: { width: 20, height: 60 },
    md: { width: 28, height: 80 },
    lg: { width: 36, height: 100 }
  };

  const { width, height } = dimensions[size];
  
  const fillColor = useMemo(() => {
    if (fillLevel === 0) return 'rgba(107, 114, 128, 0.5)'; // Gray for empty
    if (fillLevel < 25) return 'rgba(239, 68, 68, 0.6)'; // Red for critical
    if (fillLevel < 50) return 'rgba(245, 158, 11, 0.6)'; // Amber for low
    if (fillLevel < 75) return 'rgba(252, 211, 77, 0.6)'; // Yellow for medium
    return 'rgba(16, 185, 129, 0.6)'; // Green for high/full
  }, [fillLevel]);

  const statusText = useMemo(() => {
    if (status === 'unopened') return 'Sealed';
    if (status === 'finished' || fillLevel === 0) return 'Empty';
    if (fillLevel < 25) return 'Critical';
    if (fillLevel < 50) return 'Low';
    if (fillLevel < 75) return 'Medium';
    if (fillLevel < 100) return 'High';
    return 'Full';
  }, [fillLevel, status]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative group">
        {/* Bottle SVG */}
        <svg
          width={width}
          height={height}
          viewBox="0 0 40 100"
          className="drop-shadow-sm"
        >
          {/* Bottle outline */}
          <path
            d="M15 20 L15 10 Q15 5 20 5 Q25 5 25 10 L25 20 Q30 25 30 35 L30 85 Q30 95 20 95 Q10 95 10 85 L10 35 Q10 25 15 20"
            fill={status === 'unopened' ? '#1F2937' : 'none'}
            stroke="#9CA3AF"
            strokeWidth="2"
            className={status === 'unopened' ? 'opacity-50' : 'opacity-30'}
          />
          
          {/* Fill level - only show if not unopened */}
          {status !== 'unopened' && (
            <>
              <clipPath id={`fill-${fillLevel}`}>
                <path
                  d="M15 20 L15 10 Q15 5 20 5 Q25 5 25 10 L25 20 Q30 25 30 35 L30 85 Q30 95 20 95 Q10 95 10 85 L10 35 Q10 25 15 20"
                />
              </clipPath>
              
              <rect
                x="0"
                y={100 - fillLevel}
                width="40"
                height={fillLevel}
                fill={fillColor}
                clipPath={`url(#fill-${fillLevel})`}
                className="transition-all duration-500"
              />
            </>
          )}
          
          {/* Cork/Cap */}
          <rect
            x="16"
            y="2"
            width="8"
            height="8"
            fill={status === 'unopened' ? '#D97706' : '#8B4513'}
            rx="1"
          />
          
          {/* Seal for unopened bottles */}
          {status === 'unopened' && (
            <g>
              <rect
                x="12"
                y="8"
                width="16"
                height="6"
                fill="#DC2626"
                opacity="0.8"
                rx="1"
              />
              <text
                x="20"
                y="12"
                textAnchor="middle"
                fill="white"
                fontSize="4"
                fontWeight="bold"
              >
                SEALED
              </text>
            </g>
          )}
          
          {/* Bottle highlight */}
          <path
            d="M13 30 Q13 25 13 35 L13 60"
            stroke="white"
            strokeWidth="1"
            opacity="0.3"
          />
        </svg>
        
        {/* Tooltip on hover */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {status === 'unopened' ? 'Unopened Bottle' : `${fillLevel}% Full`}
        </div>
      </div>
      
      {/* Status label */}
      {showLabel && (
        <span 
          className={`text-xs mt-1 font-medium`}
          style={{ color: status === 'unopened' ? '#D97706' : fillColor }}
        >
          {statusText}
        </span>
      )}
    </div>
  );
}