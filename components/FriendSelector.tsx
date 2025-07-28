'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Users, Plus, Search, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { haptic } from '@/utils/haptics';

export interface Companion {
  type: 'friend' | 'text';
  friendId?: string;
  name: string;
  username?: string;
  avatar?: string;
}

interface FriendSuggestion {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  type: 'friend';
  pourCount?: number;
}

interface FriendSelectorProps {
  value: Companion[];
  onChange: (companions: Companion[]) => void;
  placeholder?: string;
  className?: string;
  maxCompanions?: number;
  onAddFriend?: (name: string) => void;
}

export default function FriendSelector({
  value = [],
  onChange,
  placeholder = 'Add friends or names...',
  className = '',
  maxCompanions = 10,
  onAddFriend,
}: FriendSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [recentCompanions, setRecentCompanions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search function
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  
  const searchFriends = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setRecentCompanions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.friends || []);
        setRecentCompanions(data.recentCompanions || []);
      }
    } catch (error) {
      console.error('Error searching friends:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchFriends(inputValue);
    }, 300);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputValue, searchFriends]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addCompanion = (companion: Companion) => {
    haptic.selection();
    
    // Check if already added
    const exists = value.some(c => 
      (c.type === 'friend' && companion.type === 'friend' && c.friendId === companion.friendId) ||
      (c.name === companion.name)
    );
    
    if (!exists && value.length < maxCompanions) {
      onChange([...value, companion]);
    }
    
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const removeCompanion = (index: number) => {
    haptic.light();
    const newCompanions = value.filter((_, i) => i !== index);
    onChange(newCompanions);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        // Select highlighted friend
        const friend = suggestions[highlightedIndex];
        addCompanion({
          type: 'friend',
          friendId: friend.id,
          name: friend.name,
          username: friend.username,
          avatar: friend.avatar,
        });
      } else if (inputValue.trim()) {
        // Add as free text
        addCompanion({
          type: 'text',
          name: inputValue.trim(),
        });
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < suggestions.length + recentCompanions.length - 1 ? prev + 1 : -1
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > -1 ? prev - 1 : suggestions.length + recentCompanions.length - 1
      );
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeCompanion(value.length - 1);
    }
  };

  const totalSuggestions = suggestions.length + recentCompanions.length;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="min-h-[48px] px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus-within:border-copper transition-colors">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Selected companions as chips */}
          {value.map((companion, index) => (
            <div
              key={`${companion.type}-${companion.friendId || companion.name}-${index}`}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                companion.type === 'friend'
                  ? 'bg-copper/20 text-copper-light border border-copper/30'
                  : 'bg-gray-700 text-gray-300 border border-gray-600'
              }`}
            >
              {companion.type === 'friend' && companion.avatar && (
                <Image
                  src={companion.avatar}
                  alt={companion.name}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              )}
              {companion.type === 'friend' ? (
                <Users className="w-3 h-3" />
              ) : (
                <span className="text-gray-500">&quot;</span>
              )}
              <span>{companion.name}</span>
              {companion.type === 'text' && (
                <>
                  <span className="text-gray-500">&quot;</span>
                  {onAddFriend && (
                    <button
                      onClick={() => {
                        haptic.light();
                        onAddFriend(companion.name);
                      }}
                      className="ml-1 p-0.5 hover:bg-gray-600 rounded-full transition-colors"
                      title="Add as friend"
                    >
                      <UserPlus className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => removeCompanion(index)}
                className="ml-1 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          
          {/* Input field */}
          {value.length < maxCompanions && (
            <div className="flex-1 min-w-[200px]">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setIsOpen(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={value.length === 0 ? placeholder : 'Add more...'}
                className="w-full bg-transparent outline-none text-white placeholder-gray-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (inputValue || suggestions.length > 0 || recentCompanions.length > 0) && (
        <div className="absolute z-[9999] w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="px-4 py-3 text-center text-gray-500">
                <Search className="w-4 h-4 inline animate-pulse" /> Searching...
              </div>
            )}
            
            {!loading && (
              <>
                {/* Friend suggestions */}
                {suggestions.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-900/50">
                      Friends
                    </div>
                    {suggestions.map((friend, index) => (
                      <button
                        key={friend.id}
                        onClick={() => addCompanion({
                          type: 'friend',
                          friendId: friend.id,
                          name: friend.name,
                          username: friend.username,
                          avatar: friend.avatar,
                        })}
                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
                          highlightedIndex === index ? 'bg-gray-700' : ''
                        }`}
                      >
                        {friend.avatar ? (
                          <Image
                            src={friend.avatar}
                            alt={friend.name}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <div className="text-left flex-1">
                          <div className="text-white">{friend.name}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {friend.username && <span>@{friend.username}</span>}
                            {friend.pourCount !== undefined && friend.pourCount > 0 && (
                              <span className="text-copper">
                                {friend.pourCount} pour{friend.pourCount !== 1 ? 's' : ''} together
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Recent companions */}
                {recentCompanions.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-900/50">
                      Recent Names
                    </div>
                    {recentCompanions.map((name, index) => {
                      const actualIndex = suggestions.length + index;
                      return (
                        <button
                          key={name}
                          onClick={() => addCompanion({ type: 'text', name })}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
                            highlightedIndex === actualIndex ? 'bg-gray-700' : ''
                          }`}
                        >
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-gray-500 text-xs">&quot;</span>
                          </div>
                          <span className="text-left text-white">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Add as free text option */}
                {inputValue.trim() && !suggestions.some(s => s.name.toLowerCase() === inputValue.toLowerCase()) && (
                  <button
                    onClick={() => addCompanion({ type: 'text', name: inputValue.trim() })}
                    className={`w-full px-4 py-3 flex items-center gap-3 border-t border-gray-700 hover:bg-gray-700 transition-colors ${
                      highlightedIndex === totalSuggestions ? 'bg-gray-700' : ''
                    }`}
                  >
                    <Plus className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">
                      Add &quot;<span className="text-white">{inputValue}</span>&quot; as text
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}