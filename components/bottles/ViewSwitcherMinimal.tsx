'use client';

interface ViewSwitcherMinimalProps {
  currentView: 'grid' | 'list' | 'gallery' | 'shelf';
  onViewChange: (view: 'grid' | 'list' | 'gallery' | 'shelf') => void;
}

export default function ViewSwitcherMinimal({ currentView, onViewChange }: ViewSwitcherMinimalProps) {
  const views = [
    { id: 'grid', label: 'Grid' },
    { id: 'list', label: 'List' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'shelf', label: 'Shelf' },
  ] as const;

  return (
    <div className="flex items-center gap-4 text-xs">
      {views.map(({ id, label }, index) => (
        <div key={id} className="flex items-center">
          <button
            onClick={() => onViewChange(id)}
            className={`
              transition-colors duration-200
              ${currentView === id 
                ? 'text-copper' 
                : 'text-white/40 hover:text-white/70'
              }
            `}
          >
            {label}
          </button>
          {index < views.length - 1 && (
            <span className="ml-4 text-white/20">·</span>
          )}
        </div>
      ))}
    </div>
  );
}