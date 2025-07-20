import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

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
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}