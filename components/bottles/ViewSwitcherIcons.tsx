'use client';

import { LayoutGrid, List, Image as ImageIcon, Layers } from 'lucide-react';

interface ViewSwitcherIconsProps {
  currentView: 'grid' | 'list' | 'gallery' | 'shelf';
  onViewChange: (view: 'grid' | 'list' | 'gallery' | 'shelf') => void;
}

export default function ViewSwitcherIcons({ currentView, onViewChange }: ViewSwitcherIconsProps) {
  const views = [
    { id: 'grid', icon: LayoutGrid, label: 'Grid view' },
    { id: 'list', icon: List, label: 'List view' },
    { id: 'gallery', icon: ImageIcon, label: 'Gallery view' },
    { id: 'shelf', icon: Layers, label: 'Shelf view' },
  ] as const;

  return (
    <div className="flex items-center">
      {views.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          className={`
            relative p-2 transition-all duration-200
            ${currentView === id 
              ? 'text-copper' 
              : 'text-white/40 hover:text-white/70'
            }
          `}
          title={label}
        >
          <Icon className="w-3.5 h-3.5" />
          {currentView === id && (
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-0.5 bg-copper rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}