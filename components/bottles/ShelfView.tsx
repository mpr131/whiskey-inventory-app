'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Wine } from 'lucide-react';
import BottleFillIndicator from '@/components/BottleFillIndicator';

interface ShelfViewProps {
  bottles: any[];
  isUserBottle: (bottle: any) => boolean;
  isGroupedBottle: (bottle: any) => boolean;
}

export default function ShelfView({
  bottles,
  isUserBottle,
  isGroupedBottle,
}: ShelfViewProps) {
  // Group bottles by location
  const bottlesByLocation = bottles.reduce((acc, bottle) => {
    const isUser = isUserBottle(bottle);
    const location = isUser && bottle.location 
      ? `${bottle.location.area}${bottle.location.bin ? ` - ${bottle.location.bin}` : ''}`
      : 'No Location';
    
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(bottle);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-8">
      {Object.entries(bottlesByLocation).map(([location, locationBottles]) => (
        <div key={location} className="card-premium">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-copper">📍</span>
            {location}
            <span className="text-sm text-gray-400 font-normal ml-2">
              ({locationBottles.length} bottles)
            </span>
          </h3>
          
          {/* Shelf visualization */}
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-4 overflow-x-auto">
            <div className="flex gap-3 min-w-fit pb-2">
              {locationBottles.map((bottle) => {
                const isUser = isUserBottle(bottle);
                const isGrouped = isGroupedBottle(bottle);
                const masterData = isUser ? bottle.masterBottleId : (isGrouped ? bottle.masterBottleId : bottle);
                
                return (
                  <Link 
                    key={bottle._id} 
                    href={`/bottles/${bottle._id}`}
                    className="group relative"
                  >
                    <div className="flex flex-col items-center">
                      {/* Bottle visual */}
                      <div className="relative mb-2">
                        <BottleFillIndicator 
                          fillLevel={isUser ? (bottle.fillLevel || 100) : 100} 
                          size="lg" 
                          showLabel={false}
                          status={isUser ? bottle.status : 'unopened'}
                        />
                        
                        {/* Hover info */}
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full bg-gray-900 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          <div className="font-semibold">{masterData.name}</div>
                          <div className="text-gray-400">{masterData.distillery}</div>
                          {isUser && bottle.purchasePrice && (
                            <div className="text-copper mt-1">${bottle.purchasePrice}</div>
                          )}
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Bottle label (abbreviated) */}
                      <div className="text-center max-w-[80px]">
                        <p className="text-xs text-gray-300 truncate">
                          {masterData.name.split(' ').slice(0, 2).join(' ')}
                        </p>
                        {isUser && bottle.vaultBarcode && (
                          <p className="text-xs text-copper font-mono mt-1">
                            {bottle.vaultBarcode.split('-')[1]}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          
          {/* Shelf edge */}
          <div className="h-2 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 rounded-b-lg"></div>
        </div>
      ))}
      
      {Object.keys(bottlesByLocation).length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No bottles with location information
        </div>
      )}
    </div>
  );
}