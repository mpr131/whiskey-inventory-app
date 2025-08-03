'use client';

import { LayoutGrid, List, Image as ImageIcon, Layers } from 'lucide-react';

interface ViewSwitcherRefinedProps {
  currentView: 'grid' | 'list' | 'gallery' | 'shelf';
  onViewChange: (view: 'grid' | 'list' | 'gallery' | 'shelf') => void;
}

export default function ViewSwitcherRefined({ currentView, onViewChange }: ViewSwitcherRefinedProps) {
  const views = [
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'shelf', label: 'Shelf', icon: Layers },
  ] as const;

  return (
    <div className="flex items-center gap-4">
      {views.map(({ id, label, icon: Icon }, index) => (
        <div key={id} className="flex items-center">
          <button
            onClick={() => onViewChange(id)}
            className={`
              group relative flex items-center gap-2 transition-all duration-200
              ${currentView === id
                ? 'text-copper'
                : 'text-gray-500 hover:text-gray-300'
              }
            `}
            title={label}
          >
            <Icon className="w-4 h-4" />
            <span className={`
              text-xs font-medium transition-all duration-200
              ${currentView === id 
                ? 'opacity-100' 
                : 'opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-[50px] overflow-hidden'
              }
            `}>
              {label}
            </span>
            {currentView === id && (
              <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-copper/50 rounded-full" />
            )}
          </button>
          {index < views.length - 1 && (
            <span className="ml-4 text-gray-700 text-xs">·</span>
          )}
        </div>
      ))}
    </div>
  );
}