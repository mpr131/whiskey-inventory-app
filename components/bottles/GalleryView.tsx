'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Wine, Star } from 'lucide-react';
import BottleFillIndicator from '@/components/BottleFillIndicator';

interface GalleryViewProps {
  bottles: any[];
  isUserBottle: (bottle: any) => boolean;
  isGroupedBottle: (bottle: any) => boolean;
  onQuickPour: (bottle: any) => void;
  onQuickRate: (bottle: any) => void;
}

export default function GalleryView({
  bottles,
  isUserBottle,
  isGroupedBottle,
  onQuickPour,
  onQuickRate
}: GalleryViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {bottles.map((bottle) => {
        const isUser = isUserBottle(bottle);
        const isGrouped = isGroupedBottle(bottle);
        const masterData = isUser ? bottle.masterBottleId : (isGrouped ? bottle.masterBottleId : bottle);
        
        // Get the best photo available
        let photoUrl = null;
        if (isUser && bottle.photos && bottle.photos.length > 0) {
          photoUrl = bottle.photos[0];
        } else if (isGrouped && bottle.userBottles.some((b: any) => b.photos && b.photos.length > 0)) {
          photoUrl = bottle.userBottles.find((b: any) => b.photos && b.photos.length > 0)?.photos[0];
        }
        
        return (
          <Link key={bottle._id} href={`/bottles/${bottle._id}`} className="block group">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-800">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={masterData.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <Wine className="w-24 h-24 text-gray-700" />
                </div>
              )}
              
              {/* Overlay with bottle info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{masterData.name}</h3>
                  <p className="text-gray-300 mb-3">{masterData.distillery}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {isUser && (
                        <BottleFillIndicator 
                          fillLevel={bottle.fillLevel || 100} 
                          size="sm" 
                          showLabel={false}
                          status={bottle.status}
                        />
                      )}
                      {bottle.averageRating && (
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{bottle.averageRating.toFixed(1)}</span>
                          <Star className="w-4 h-4 fill-current" />
                        </div>
                      )}
                    </div>
                    
                    {isUser && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onQuickPour(bottle);
                          }}
                          className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-full transition-colors"
                        >
                          <Wine className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onQuickRate(bottle);
                          }}
                          className="p-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-full transition-colors"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isGrouped && (
                    <div className="mt-2 text-sm text-gray-300">
                      {bottle.totalCount} bottles in collection
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status badges */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {isUser && bottle.status === 'unopened' && (
                  <span className="px-2 py-1 bg-blue-500/80 text-white text-xs rounded">
                    Sealed
                  </span>
                )}
                {isUser && bottle.fillLevel && bottle.fillLevel < 25 && (
                  <span className="px-2 py-1 bg-red-500/80 text-white text-xs rounded animate-pulse">
                    Low
                  </span>
                )}
                {masterData.isStorePick && (
                  <span className="px-2 py-1 bg-purple-500/80 text-white text-xs rounded">
                    Store Pick
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}