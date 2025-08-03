'use client';

import { useState } from 'react';
import { X, ChevronDown, ChevronUp, RotateCcw, Package, Wine, AlertTriangle, Skull, MapPin, Calendar, DollarSign } from 'lucide-react';

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    category: string;
    status: string;
    proof: string;
    priceRange: string;
    age: string;
    location: string;
    attributes: string[];
  };
  onFilterChange: (filters: any) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  counts?: {
    unopened?: number;
    opened?: number;
    low?: number;
    empty?: number;
    recent?: number;
    locations?: Record<string, number>;
    categories?: Record<string, number>;
    proofRanges?: Record<string, number>;
    priceRanges?: Record<string, number>;
    attributes?: Record<string, number>;
    ages?: Record<string, number>;
  };
  locations?: string[];
}

export default function FilterSidebar({ 
  isOpen, 
  onClose, 
  filters, 
  onFilterChange,
  sortBy,
  onSortChange,
  counts = {},
  locations = []
}: FilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quickFilters: true,
    status: false,
    category: false,
    proof: false,
    price: false,
    attributes: false,
    age: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleQuickFilter = (filterType: string, value: string) => {
    const newFilters = { ...filters };
    
    switch (filterType) {
      case 'status':
        newFilters.status = filters.status === value ? '' : value;
        break;
      case 'location':
        newFilters.location = filters.location === value ? '' : value;
        break;
      case 'recent':
        // Handle recent filter - this would need backend support
        break;
    }
    
    onFilterChange(newFilters);
  };

  const handleCheckboxChange = (filterType: string, value: string) => {
    const newFilters = { ...filters };
    
    if (filterType === 'attributes') {
      const currentAttributes = filters.attributes || [];
      if (currentAttributes.includes(value)) {
        newFilters.attributes = currentAttributes.filter(attr => attr !== value);
      } else {
        newFilters.attributes = [...currentAttributes, value];
      }
    } else {
      // Handle non-array filter types
      const key = filterType as keyof typeof filters;
      if (key !== 'attributes') {
        (newFilters as any)[key] = filters[key] === value ? '' : value;
      }
    }
    
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    onFilterChange({
      category: '',
      status: '',
      proof: '',
      priceRange: '',
      age: '',
      location: '',
      attributes: []
    });
  };

  const activeFilterCount = Object.values(filters).filter(f => 
    Array.isArray(f) ? f.length > 0 : f !== ''
  ).length;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:sticky top-0 left-0 h-full lg:h-auto
        w-80 lg:w-64 xl:w-80
        bg-black/40 backdrop-blur-xl border-r border-white/5
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        z-50 lg:z-auto
        overflow-y-auto refined-scrollbar
      `}>
        <div className="p-4 lg:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-light text-white">Filters</h3>
              {activeFilterCount > 0 && (
                <span className="text-xs text-copper/60">{activeFilterCount} active</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                onClick={onClose}
                className="lg:hidden text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sort Options */}
          <div className="mb-6">
            <label className="block text-xs font-light text-gray-400 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full px-3 py-1.5 bg-transparent border border-white/10 rounded-full text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-copper/50 transition-colors"
            >
              <option value="-createdAt">Newest First</option>
              <option value="createdAt">Oldest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="-name">Name (Z-A)</option>
              <option value="-purchasePrice">Price (High to Low)</option>
              <option value="purchasePrice">Price (Low to High)</option>
              <option value="-proof">Proof (High to Low)</option>
              <option value="proof">Proof (Low to High)</option>
            </select>
          </div>

          {/* Quick Filters */}
          <div className="mb-6">
            <button
              onClick={() => toggleSection('quickFilters')}
              className="flex items-center justify-between w-full mb-3 text-xs font-light text-gray-400 hover:text-gray-200 transition-colors"
            >
              Quick Filters
              {expandedSections.quickFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {expandedSections.quickFilters && (
              <div className="space-y-2">
                <button
                  onClick={() => handleQuickFilter('status', 'unopened')}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border
                    ${filters.status === 'unopened' 
                      ? 'border-copper/30 bg-copper/5 text-copper' 
                      : 'border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'}`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Unopened
                  {counts.unopened && (
                    <span className="ml-auto text-xs opacity-60">{counts.unopened}</span>
                  )}
                </button>
                
                <button
                  onClick={() => handleQuickFilter('status', 'opened')}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border
                    ${filters.status === 'opened' 
                      ? 'border-copper/30 bg-copper/5 text-copper' 
                      : 'border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'}`}
                >
                  <Wine className="w-3.5 h-3.5" />
                  Open
                  {counts.opened && (
                    <span className="ml-auto text-xs opacity-60">{counts.opened}</span>
                  )}
                </button>
                
                <button
                  onClick={() => handleQuickFilter('status', 'low')}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border
                    ${filters.status === 'low' 
                      ? 'border-copper/30 bg-copper/5 text-copper' 
                      : 'border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Running Low
                  {counts.low && (
                    <span className="ml-auto text-xs opacity-60">{counts.low}</span>
                  )}
                </button>
                
                <button
                  onClick={() => handleQuickFilter('status', 'finished')}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border
                    ${filters.status === 'finished' 
                      ? 'border-copper/30 bg-copper/5 text-copper' 
                      : 'border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'}`}
                >
                  <Skull className="w-3.5 h-3.5" />
                  Finished
                  {counts.empty && (
                    <span className="ml-auto text-xs opacity-60">{counts.empty}</span>
                  )}
                </button>
                
                {locations.length > 0 && locations.slice(0, 3).map(location => (
                  <button
                    key={location}
                    onClick={() => handleQuickFilter('location', location)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border
                      ${filters.location === location 
                        ? 'border-copper/30 bg-copper/5 text-copper' 
                        : 'border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'}`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {location}
                    {counts.locations?.[location] && (
                      <span className="ml-auto text-xs opacity-60">{counts.locations[location]}</span>
                    )}
                  </button>
                ))}
                
                <button
                  onClick={() => handleQuickFilter('recent', '30')}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border
                    ${filters.age === 'recent' 
                      ? 'border-copper/30 bg-copper/5 text-copper' 
                      : 'border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'}`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Added Last 30 Days
                  {counts.recent && (
                    <span className="ml-auto text-xs opacity-60">{counts.recent}</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="mb-6">
            <button
              onClick={() => toggleSection('status')}
              className="flex items-center justify-between w-full mb-3 text-xs font-light text-gray-400 hover:text-gray-200 transition-colors"
            >
              Status
              {expandedSections.status ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {expandedSections.status && (
              <div className="space-y-2">
                {['unopened', 'opened', 'low', 'finished'].map(status => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.status === status}
                      onChange={() => handleCheckboxChange('status', status)}
                      className="rounded-sm w-3.5 h-3.5 border-gray-600 bg-transparent text-copper focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-gray-300 capitalize">
                      {status === 'low' ? 'Low (<25%)' : status}
                    </span>
                    {counts[status as keyof typeof counts] && (
                      <span className="ml-auto text-xs text-gray-500">
                        {counts[status as keyof typeof counts] as number}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <button
              onClick={() => toggleSection('category')}
              className="flex items-center justify-between w-full mb-3 text-xs font-light text-gray-400 hover:text-gray-200 transition-colors"
            >
              Category
              {expandedSections.category ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {expandedSections.category && (
              <div className="space-y-2">
                {['Bourbon', 'Rye', 'Scotch', 'Irish', 'Japanese', 'Other'].map(category => (
                  <label key={category} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.category === category}
                      onChange={() => handleCheckboxChange('category', category)}
                      className="rounded-sm w-3.5 h-3.5 border-gray-600 bg-transparent text-copper focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-gray-300">{category}</span>
                    {counts.categories?.[category] && (
                      <span className="ml-auto text-xs text-gray-500">
                        {counts.categories[category]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Proof Range Filter */}
          <div className="mb-6">
            <button
              onClick={() => toggleSection('proof')}
              className="flex items-center justify-between w-full mb-3 text-xs font-light text-gray-400 hover:text-gray-200 transition-colors"
            >
              Proof Range
              {expandedSections.proof ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {expandedSections.proof && (
              <div className="space-y-2">
                {['80-90', '90-100', '100-110', '110-120', '120+'].map(range => (
                  <label key={range} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.proof === range}
                      onChange={() => handleCheckboxChange('proof', range)}
                      className="rounded-sm w-3.5 h-3.5 border-gray-600 bg-transparent text-copper focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-gray-300">{range}</span>
                    {counts.proofRanges?.[range] && (
                      <span className="ml-auto text-xs text-gray-500">
                        {counts.proofRanges[range]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Price Range Filter */}
          <div className="mb-6">
            <button
              onClick={() => toggleSection('price')}
              className="flex items-center justify-between w-full mb-3 text-xs font-light text-gray-400 hover:text-gray-200 transition-colors"
            >
              Price Range
              {expandedSections.price ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {expandedSections.price && (
              <div className="space-y-2">
                {['0-50', '50-100', '100-250', '250-500', '500+'].map(range => (
                  <label key={range} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.priceRange === range}
                      onChange={() => handleCheckboxChange('priceRange', range)}
                      className="rounded-sm w-3.5 h-3.5 border-gray-600 bg-transparent text-copper focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-gray-300">
                      ${range === '500+' ? '500+' : range.replace('-', '-$')}
                    </span>
                    {counts.priceRanges?.[range] && (
                      <span className="ml-auto text-xs text-gray-500">
                        {counts.priceRanges[range]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Special Attributes */}
          <div className="mb-6">
            <button
              onClick={() => toggleSection('attributes')}
              className="flex items-center justify-between w-full mb-3 text-xs font-light text-gray-400 hover:text-gray-200 transition-colors"
            >
              Special Attributes
              {expandedSections.attributes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {expandedSections.attributes && (
              <div className="space-y-2">
                {['Store Pick', 'Limited Edition', 'Allocated', 'Daily Drinker', 'Special Occasion'].map(attr => (
                  <label key={attr} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.attributes.includes(attr)}
                      onChange={() => handleCheckboxChange('attributes', attr)}
                      className="rounded-sm w-3.5 h-3.5 border-gray-600 bg-transparent text-copper focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-gray-300">{attr}</span>
                    {counts.attributes?.[attr] && (
                      <span className="ml-auto text-xs text-gray-500">
                        {counts.attributes[attr]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Age Filter */}
          <div className="mb-6">
            <button
              onClick={() => toggleSection('age')}
              className="flex items-center justify-between w-full mb-3 text-xs font-light text-gray-400 hover:text-gray-200 transition-colors"
            >
              Age
              {expandedSections.age ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {expandedSections.age && (
              <div className="space-y-2">
                {['NAS', '4-6', '7-10', '12-15', '15+'].map(age => (
                  <label key={age} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.age === age}
                      onChange={() => handleCheckboxChange('age', age)}
                      className="rounded-sm w-3.5 h-3.5 border-gray-600 bg-transparent text-copper focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-gray-300">
                      {age === 'NAS' ? 'No Age Statement' : `${age} Years`}
                    </span>
                    {counts.ages?.[age] && (
                      <span className="ml-auto text-xs text-gray-500">
                        {counts.ages[age]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}