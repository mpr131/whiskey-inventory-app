'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check } from 'lucide-react';

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => Promise<void>;
  suggestions: string[];
  placeholder?: string;
  allowNew?: boolean;
  className?: string;
  required?: boolean;
}

export default function AutocompleteInput({
  label,
  value,
  onChange,
  onSearch,
  suggestions,
  placeholder = 'Type to search...',
  allowNew = true,
  className = '',
  required = false,
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Check if input matches any existing suggestion (case-insensitive)
  const exactMatch = suggestions.find(s => s.toLowerCase() === inputValue.toLowerCase());
  const showAddNew = allowNew && inputValue && !exactMatch;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (inputValue && isFocused) {
        onSearch(inputValue);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue, isFocused, onSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
    onChange(selectedValue);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && e.key === 'ArrowDown') {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    const totalOptions = filteredSuggestions.length + (showAddNew ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % totalOptions);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + totalOptions) % totalOptions);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (highlightedIndex === filteredSuggestions.length && showAddNew) {
            handleSelect(inputValue);
          } else {
            handleSelect(filteredSuggestions[highlightedIndex]);
          }
        } else if (inputValue) {
          // If no item is highlighted, select exact match or add new
          handleSelect(exactMatch || inputValue);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className="w-full px-4 py-3 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-copper transition-colors"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
      </div>

      {/* Dropdown */}
      {isOpen && (filteredSuggestions.length > 0 || showAddNew) && (
        <div className="absolute z-[9999] w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                onClick={() => handleSelect(suggestion)}
                className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${
                  index === highlightedIndex
                    ? 'bg-copper/20 text-copper-light'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span>{suggestion}</span>
                {suggestion.toLowerCase() === value.toLowerCase() && (
                  <Check className="w-4 h-4 text-copper" />
                )}
              </div>
            ))}
            
            {showAddNew && (
              <div
                onClick={() => handleSelect(inputValue)}
                className={`px-4 py-3 cursor-pointer flex items-center space-x-2 border-t border-gray-700 transition-colors ${
                  highlightedIndex === filteredSuggestions.length
                    ? 'bg-copper/20 text-copper-light'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Add new: &quot;{inputValue}&quot;</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}