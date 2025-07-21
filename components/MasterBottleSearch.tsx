'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface MasterBottle {
  _id: string;
  name: string;
  brand: string;
  distillery: string;
  category: string;
  type?: string;
  age?: number;
  proof?: number;
  msrp?: number;
  isUserBottle?: boolean;
  fillLevel?: number;
  status?: string;
}

interface MasterBottleSearchProps {
  placeholder?: string;
  onSelect?: (bottle: MasterBottle) => void;
  className?: string;
  redirectToBottle?: boolean;
}

export default function MasterBottleSearch({
  placeholder = 'Search your collection...',
  onSelect,
  className = '',
  redirectToBottle = true,
}: MasterBottleSearchProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<MasterBottle[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (search && search.length >= 2) {
        searchMasterBottles();
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const searchMasterBottles = async () => {
    setSearching(true);
    try {
      // Search both master bottles and user bottles
      const [masterResponse, userResponse] = await Promise.all([
        fetch(`/api/master-bottles/search?q=${encodeURIComponent(search)}`),
        fetch(`/api/user-bottles?search=${encodeURIComponent(search)}&limit=10`)
      ]);
      
      if (masterResponse.ok && userResponse.ok) {
        const masterData = await masterResponse.json();
        const userData = await userResponse.json();
        
        // Combine results, prioritizing user bottles
        const userBottles = userData.bottles || [];
        const masterBottles = masterData.bottles || [];
        
        // For user bottles, extract the master bottle data
        const userMasterBottles = userBottles.map((ub: any) => ({
          ...ub.masterBottleId,
          _id: ub._id, // Use user bottle ID for navigation
          isUserBottle: true,
          fillLevel: ub.fillLevel,
          status: ub.status
        }));
        
        // Filter out duplicates from master bottles
        const uniqueMasterBottles = masterBottles.filter((mb: any) => 
          !userMasterBottles.some((ub: any) => ub.masterBottleId === mb._id)
        );
        
        // Combine results
        const combinedResults = [...userMasterBottles, ...uniqueMasterBottles].slice(0, 10);
        
        setSearchResults(combinedResults);
        setShowDropdown(combinedResults.length > 0);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectBottle = (bottle: MasterBottle) => {
    if (onSelect) {
      onSelect(bottle);
    }
    
    if (redirectToBottle) {
      // Navigate to the bottle's detail page
      router.push(`/bottles/${bottle._id}`);
    }
    
    // Clear search
    setSearch('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          handleSelectBottle(searchResults[highlightedIndex]);
        } else if (searchResults.length === 1) {
          handleSelectBottle(searchResults[0]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      // If no specific bottle selected, go to bottles page with search
      router.push(`/bottles?search=${encodeURIComponent(search.trim())}`);
      setSearch('');
      setShowDropdown(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searchResults.length > 0) {
              setShowDropdown(true);
            }
          }}
          onBlur={() => {
            // Delay to allow click on dropdown items
            setTimeout(() => setShowDropdown(false), 200);
          }}
          placeholder={placeholder}
          className="input-premium w-full pl-12 pr-4 py-3 text-lg"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-copper"></div>
          </div>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute top-full mt-2 w-full glass-dark rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {searchResults.map((bottle, index) => (
            <button
              key={bottle._id}
              type="button"
              onClick={() => handleSelectBottle(bottle)}
              className={`w-full text-left px-4 py-3 transition-colors border-b border-white/5 last:border-0 ${
                index === highlightedIndex
                  ? 'bg-copper/20 text-copper-light'
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{bottle.name}</div>
                {bottle.isUserBottle && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    bottle.status === 'opened' ? 'bg-green-900/50 text-green-400' : 
                    bottle.status === 'unopened' ? 'bg-gray-700 text-gray-300' :
                    'bg-red-900/50 text-red-400'
                  }`}>
                    {bottle.status}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-400">
                {bottle.distillery} • {bottle.category}
                {bottle.age && ` • ${bottle.age} Year`}
                {bottle.proof && ` • ${bottle.proof} Proof`}
                {bottle.isUserBottle && bottle.fillLevel !== undefined && bottle.status === 'opened' && (
                  <span className="ml-2">• {bottle.fillLevel.toFixed(2)}% Full</span>
                )}
              </div>
            </button>
          ))}
          <div className="px-4 py-2 text-xs text-gray-500 bg-gray-800/50">
            Press Enter to search all bottles • Arrow keys to navigate
          </div>
        </div>
      )}
    </form>
  );
}