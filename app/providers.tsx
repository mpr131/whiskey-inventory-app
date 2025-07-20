'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { PrintQueueProvider } from '@/contexts/PrintQueueContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PrintQueueProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151',
            },
            success: {
              iconTheme: {
                primary: '#B87333',
                secondary: '#fff',
              },
            },
          }}
        />
      </PrintQueueProvider>
    </SessionProvider>
  );
}