'use client';

import { usePrintQueue } from '@/contexts/PrintQueueContext';
import { Printer } from 'lucide-react';

export default function PrintQueueButton() {
  const { queue, goToPrintQueue } = usePrintQueue();

  if (queue.length === 0) {
    return null;
  }

  return (
    <button
      onClick={goToPrintQueue}
      className="fixed bottom-6 right-6 z-40 flex items-center space-x-2 bg-copper hover:bg-copper-light text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
      title="Go to print queue"
    >
      <Printer className="w-5 h-5" />
      <span className="font-medium">Print Queue</span>
      <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-sm font-bold">
        {queue.length}
      </span>
    </button>
  );
}