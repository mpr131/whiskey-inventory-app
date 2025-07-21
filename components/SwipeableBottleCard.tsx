'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import Link from 'next/link';
import { Wine, Star } from 'lucide-react';

interface SwipeableBottleCardProps {
  bottleId: string;
  children: React.ReactNode;
  onQuickPour?: () => void;
  onQuickRate?: () => void;
  className?: string;
}

export default function SwipeableBottleCard({
  bottleId,
  children,
  onQuickPour,
  onQuickRate,
  className = ''
}: SwipeableBottleCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipingLeft, setIsSwipingLeft] = useState(false);
  const [isSwipingRight, setIsSwipingRight] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      console.log('Swiping:', eventData);
      const { deltaX, absX } = eventData;
      
      // Limit swipe distance
      const maxSwipe = 100;
      const offset = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
      setSwipeOffset(offset);
      
      // Show action backgrounds when swiping past threshold
      if (absX > 50) {
        setIsSwipingLeft(deltaX < -50);
        setIsSwipingRight(deltaX > 50);
      } else {
        setIsSwipingLeft(false);
        setIsSwipingRight(false);
      }
    },
    onSwipedLeft: (eventData) => {
      console.log('Swiped left!', eventData);
      if (eventData.absX > 75 && onQuickRate) {
        console.log('Triggering quick rate');
        onQuickRate();
      }
      // Reset
      setSwipeOffset(0);
      setIsSwipingLeft(false);
      setIsSwipingRight(false);
    },
    onSwipedRight: (eventData) => {
      console.log('Swiped right!', eventData);
      if (eventData.absX > 75 && onQuickPour) {
        console.log('Triggering quick pour');
        onQuickPour();
      }
      // Reset
      setSwipeOffset(0);
      setIsSwipingLeft(false);
      setIsSwipingRight(false);
    },
    onTap: () => {
      console.log('Tapped');
      // Reset on tap
      setSwipeOffset(0);
      setIsSwipingLeft(false);
      setIsSwipingRight(false);
    },
    trackMouse: true, // Enable for desktop testing
    trackTouch: true,
    rotationAngle: 0,
    swipeDuration: 500,
    delta: 10,
    preventScrollOnSwipe: true,
  });

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
        {...handlers}
        className="relative z-10"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
          touchAction: 'pan-y', // Allow vertical scroll but capture horizontal swipes
        }}
        onClick={(e) => {
          // Prevent click if we're swiping
          if (isSwipingLeft || isSwipingRight) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}