'use client';

import { Suspense } from 'react';
import LabelsContent from './LabelsContent';

export default function LabelsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    }>
      <LabelsContent />
    </Suspense>
  );
}