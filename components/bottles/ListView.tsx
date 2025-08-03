'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Wine, Star, Tag, Trash2 } from 'lucide-react';
import BottleFillIndicator from '@/components/BottleFillIndicator';
import MoreActionsDropdown from './MoreActionsDropdown';

interface ListViewProps {
  bottles: any[];
  isUserBottle: (bottle: any) => boolean;
  isGroupedBottle: (bottle: any) => boolean;
  onQuickPour: (bottle: any) => void;
  onQuickRate: (bottle: any) => void;
  onDelete: (id: string) => void;
  addToQueue: (item: any) => void;
  isInQueue: (id: string) => boolean;
}

export default function ListView({
  bottles,
  isUserBottle,
  isGroupedBottle,
  onQuickPour,
  onQuickRate,
  onDelete,
  addToQueue,
  isInQueue
}: ListViewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-white/5">
          <tr className="text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">
            <th className="px-4 py-2 font-medium">Bottle</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Fill</th>
            <th className="px-4 py-2 font-medium">Location</th>
            <th className="px-4 py-2 font-medium">Last Pour</th>
            <th className="px-4 py-2 font-medium">Rating</th>
            <th className="px-4 py-2 font-medium">Price</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {bottles.map((bottle) => {
            const isUser = isUserBottle(bottle);
            const isGrouped = isGroupedBottle(bottle);
            const masterData = isUser ? bottle.masterBottleId : (isGrouped ? bottle.masterBottleId : bottle);
            
            if (isGrouped) {
              // Grouped view - show summary
              return (
                <tr key={bottle._id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/bottles/${bottle._id}`} className="flex items-center gap-3">
                      {bottle.userBottles.some(b => b.photos && b.photos.length > 0) && (
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <Image
                            src={bottle.userBottles.find(b => b.photos && b.photos.length > 0)?.photos[0] || ''}
                            alt={masterData.name}
                            fill
                            className="object-cover rounded"
                            sizes="48px"
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white hover:text-copper-light transition-colors">
                          {masterData.name}
                        </p>
                        <p className="text-sm text-gray-400">{masterData.distillery}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{masterData.category}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">
                      {bottle.totalCount} total ({bottle.openedCount} open)
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {bottle.userBottles
                        .filter(b => b.status === 'opened' && b.fillLevel !== undefined)
                        .slice(0, 3)
                        .map((b, index) => (
                          <BottleFillIndicator 
                            key={index}
                            fillLevel={b.fillLevel || 100} 
                            size="sm" 
                            showLabel={false}
                          />
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {bottle.locations.length} locations
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">-</td>
                  <td className="px-4 py-3">
                    {masterData.communityRating && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-copper">{masterData.communityRating.toFixed(1)}</span>
                        <Star className="w-3 h-3 text-copper fill-copper" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    ${bottle.averagePrice.toFixed(0)}
                  </td>
                  <td className="px-4 py-3">
                    <Link 
                      href={`/bottles/${bottle._id}`}
                      className="text-copper hover:text-copper-light text-sm"
                    >
                      View All
                    </Link>
                  </td>
                </tr>
              );
            } else {
              // Individual bottle view
              return (
                <tr key={bottle._id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/bottles/${bottle._id}`} className="flex items-center gap-3">
                      {isUser && bottle.photos && bottle.photos.length > 0 && (
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <Image
                            src={bottle.photos[0]}
                            alt={masterData.name}
                            fill
                            className="object-cover rounded"
                            sizes="48px"
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white hover:text-copper-light transition-colors">
                          {masterData.name}
                        </p>
                        <p className="text-sm text-gray-400">{masterData.distillery}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{masterData.category}</td>
                  <td className="px-4 py-3">
                    {isUser && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        bottle.status === 'unopened' ? 'bg-blue-500/20 text-blue-400' :
                        bottle.status === 'opened' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {bottle.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isUser && (
                      <BottleFillIndicator 
                        fillLevel={bottle.fillLevel || 100} 
                        size="sm" 
                        showLabel={false}
                        status={bottle.status}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {isUser && bottle.location && `${bottle.location.area} - ${bottle.location.bin}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {isUser && bottle.lastPourDate && new Date(bottle.lastPourDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {isUser && bottle.averageRating && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-copper">{bottle.averageRating.toFixed(1)}</span>
                        <Star className="w-3 h-3 text-copper fill-copper" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {isUser && bottle.purchasePrice && `$${bottle.purchasePrice}`}
                  </td>
                  <td className="px-4 py-3">
                    {isUser && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onQuickPour(bottle)}
                          className="p-1.5 text-green-400 hover:bg-green-500/10 rounded transition-colors"
                          title="Quick Pour"
                        >
                          <Wine className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onQuickRate(bottle)}
                          className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                          title="Quick Rate"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => addToQueue({
                            _id: bottle._id,
                            name: masterData.name,
                            distillery: masterData.distillery,
                            vaultBarcode: bottle.vaultBarcode
                          })}
                          disabled={isInQueue(bottle._id)}
                          className={`p-1.5 rounded transition-colors ${
                            isInQueue(bottle._id)
                              ? 'text-gray-500 cursor-not-allowed'
                              : 'text-copper hover:bg-copper/10'
                          }`}
                          title="Add to print queue"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                        <MoreActionsDropdown
                          bottleId={bottle._id}
                          bottleName={masterData.name}
                          onShare={() => {}}
                          onDuplicate={() => {}}
                          onMoveLocation={() => {}}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            }
          })}
        </tbody>
      </table>
    </div>
  );
}