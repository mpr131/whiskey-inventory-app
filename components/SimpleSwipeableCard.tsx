'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Wine, Star } from 'lucide-react';

interface SimpleSwipeableCardProps {
  bottleId: string;
  children: React.ReactNode;
  onQuickPour?: () => void;
  onQuickRate?: () => void;
  className?: string;
}

export default function SimpleSwipeableCard({
  bottleId,
  children,
  onQuickPour,
  onQuickRate,
  className = ''
}: SimpleSwipeableCardProps) {
  const router = useRouter();
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipingLeft, setIsSwipingLeft] = useState(false);
  const [isSwipingRight, setIsSwipingRight] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    console.log('Touch start on bottle:', bottleId);
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    const currentSwipe = e.targetTouches[0].clientX - touchStart;
    console.log('Touch move, swipe distance:', currentSwipe);
    
    // Only track horizontal swipes
    if (Math.abs(currentSwipe) > 10) {
      setIsSwiping(true);
      e.preventDefault(); // Prevent vertical scroll when swiping horizontally
      
      // Limit swipe distance for visual effect
      const maxSwipe = 100;
      const offset = Math.max(-maxSwipe, Math.min(maxSwipe, currentSwipe));
      setSwipeOffset(offset);
      
      // Show action backgrounds when swiping past threshold
      if (Math.abs(currentSwipe) > 50) {
        setIsSwipingLeft(currentSwipe < -50);
        setIsSwipingRight(currentSwipe > 50);
      } else {
        setIsSwipingLeft(false);
        setIsSwipingRight(false);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !touchEnd) {
      // Reset if no swipe occurred
      resetSwipe();
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && onQuickRate) {
      console.log('Left swipe detected - showing rate modal');
      onQuickRate();
    }
    
    if (isRightSwipe && onQuickPour) {
      console.log('Right swipe detected - showing pour modal');
      onQuickPour();
    }

    resetSwipe();
  };

  const resetSwipe = () => {
    setSwipeOffset(0);
    setIsSwipingLeft(false);
    setIsSwipingRight(false);
    setIsSwiping(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Navigate on click if not swiping
    if (!isSwiping && bottleId !== 'test') {
      e.preventDefault();
      router.push(`/bottles/${bottleId}`);
    }
  };

  // For debugging
  if (typeof window !== 'undefined') {
    (window as any).debugSwipe = {
      touchStart,
      touchEnd,
      swipeOffset,
      isSwiping
    };
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      {/* Swipe action backgrounds */}
      {isSwipingRight && (
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-transparent flex items-center pl-4 z-0">
          <div className="flex items-center gap-2 text-green-400">
            <Wine className="w-6 h-6" />
            <span className="font-medium">Quick Pour</span>
          </div>
        </div>
      )}
      {isSwipingLeft && (
        <div className="absolute inset-0 bg-gradient-to-l from-amber-500/20 to-transparent flex items-center justify-end pr-4 z-0">
          <div className="flex items-center gap-2 text-amber-400">
            <span className="font-medium">Quick Rate</span>
            <Star className="w-6 h-6" />
          </div>
        </div>
      )}
      
      {/* Swipeable content */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className="relative z-10"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
          border: '2px solid lime', // DEBUG: Remove this after testing
        }}
      >
        {children}
      </div>
    </div>
  );
}