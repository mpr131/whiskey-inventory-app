'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface QueuedBottle {
  _id: string;
  name: string;
  distillery: string;
  vaultBarcode?: string;
}

interface PrintQueueContextType {
  queue: QueuedBottle[];
  addToQueue: (bottle: QueuedBottle) => void;
  removeFromQueue: (bottleId: string) => void;
  clearQueue: () => void;
  isInQueue: (bottleId: string) => boolean;
  goToPrintQueue: () => void;
}

const PrintQueueContext = createContext<PrintQueueContextType | undefined>(undefined);

export function PrintQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedBottle[]>([]);
  const router = useRouter();

  const addToQueue = useCallback((bottle: QueuedBottle) => {
    setQueue(prev => {
      const exists = prev.some(b => b._id === bottle._id);
      if (exists) {
        toast.error('Bottle already in print queue');
        return prev;
      }
      toast.success(`Added ${bottle.name} to print queue`);
      return [...prev, bottle];
    });
  }, []);

  const removeFromQueue = useCallback((bottleId: string) => {
    setQueue(prev => prev.filter(b => b._id !== bottleId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    toast.success('Print queue cleared');
  }, []);

  const isInQueue = useCallback((bottleId: string) => {
    return queue.some(b => b._id === bottleId);
  }, [queue]);

  const goToPrintQueue = useCallback(() => {
    if (queue.length === 0) {
      toast.error('Print queue is empty');
      return;
    }
    router.push('/labels?queue=true');
  }, [queue, router]);

  return (
    <PrintQueueContext.Provider
      value={{
        queue,
        addToQueue,
        removeFromQueue,
        clearQueue,
        isInQueue,
        goToPrintQueue,
      }}
    >
      {children}
    </PrintQueueContext.Provider>
  );
}

export function usePrintQueue() {
  const context = useContext(PrintQueueContext);
  if (!context) {
    throw new Error('usePrintQueue must be used within a PrintQueueProvider');
  }
  return context;
}