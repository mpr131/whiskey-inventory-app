'use client';

interface ViewSwitcherSegmentedProps {
  currentView: 'grid' | 'list' | 'gallery' | 'shelf';
  onViewChange: (view: 'grid' | 'list' | 'gallery' | 'shelf') => void;
}

export default function ViewSwitcherSegmented({ currentView, onViewChange }: ViewSwitcherSegmentedProps) {
  const views = [
    { id: 'grid', label: 'Grid' },
    { id: 'list', label: 'List' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'shelf', label: 'Shelf' },
  ] as const;

  return (
    <div className="inline-flex items-center h-7 p-0.5 bg-white/[0.03] rounded">
      {views.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          className={`
            px-3 h-6 text-xs rounded transition-all duration-200
            ${currentView === id
              ? 'bg-white/[0.07] text-white shadow-sm'
              : 'text-white/40 hover:text-white/60'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}