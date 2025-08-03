'use client';

import { LayoutGrid, List, Image as ImageIcon, Layers } from 'lucide-react';

interface ViewSwitcherProps {
  currentView: 'grid' | 'list' | 'gallery' | 'shelf';
  onViewChange: (view: 'grid' | 'list' | 'gallery' | 'shelf') => void;
}

export default function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const views = [
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'shelf', label: 'Shelf', icon: Layers },
  ] as const;

  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
      {views.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          className={`
            relative px-3 py-1.5 rounded transition-all duration-200
            ${currentView === id
              ? 'text-copper bg-white/5'
              : 'text-gray-500 hover:text-gray-300'
            }
          `}
          title={label}
        >
          <Icon className="w-4 h-4" />
          {currentView === id && (
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-copper rounded-full" />
          )}
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}