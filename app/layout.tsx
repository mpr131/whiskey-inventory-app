import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@/styles/refined.css';
import { Providers } from './providers';
import PrintQueueButton from '@/components/PrintQueueButton';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import OfflineIndicator from '@/components/OfflineIndicator';
import BottomNav from '@/components/BottomNav';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProfileSetupBanner from '@/components/ProfileSetupBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Whiskey Vault - Premium Inventory Management',
  description: 'A sophisticated whiskey collection management system for connoisseurs',
  keywords: ['whiskey', 'bourbon', 'scotch', 'inventory', 'collection', 'management'],
  authors: [{ name: 'Whiskey Vault' }],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/wv-favicon_256.png', sizes: '256x256', type: 'image/png' },
      { url: '/wv-favicon_256.png', sizes: '192x192', type: 'image/png' },
      { url: '/wv-favicon_256.png', sizes: '96x96', type: 'image/png' },
      { url: '/wv-favicon_256.png', sizes: '32x32', type: 'image/png' },
      { url: '/wv-favicon_256.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/wv-favicon_256.png', sizes: '180x180', type: 'image/png' },
      { url: '/wv-favicon_256.png', sizes: '152x152', type: 'image/png' },
      { url: '/wv-favicon_256.png', sizes: '120x120', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/wv-favicon_256.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#B87333" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <OfflineIndicator />
          <ProfileSetupBanner />
          {children}
          <ErrorBoundary>
            <BottomNav />
          </ErrorBoundary>
          <PrintQueueButton />
          <ServiceWorkerRegistration />
          <PWAInstallPrompt />
        </Providers>
      </body>
    </html>
  );
}