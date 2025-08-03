'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Share2, Edit, Copy, MapPin, Eye } from 'lucide-react';
import Link from 'next/link';

interface MoreActionsDropdownProps {
  bottleId: string;
  bottleName: string;
  onShare?: () => void;
  onDuplicate?: () => void;
  onMoveLocation?: () => void;
}

export default function MoreActionsDropdown({
  bottleId,
  bottleName,
  onShare,
  onDuplicate,
  onMoveLocation
}: MoreActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 text-gray-600 hover:text-gray-400 hover:bg-white/5 rounded-md transition-all duration-200"
        title="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-md shadow-xl z-30">
          <div className="py-1">
            {/* Share */}
            {onShare && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction(onShare);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share with Friend
              </button>
            )}

            {/* Edit */}
            <Link
              href={`/bottles/${bottleId}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Details
            </Link>

            {/* Move Location */}
            {onMoveLocation && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction(onMoveLocation);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Move Location
              </button>
            )}

            {/* Duplicate */}
            {onDuplicate && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction(onDuplicate);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Duplicate Bottle
              </button>
            )}

            {/* View History */}
            <Link
              href={`/bottles/${bottleId}`}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View History
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}