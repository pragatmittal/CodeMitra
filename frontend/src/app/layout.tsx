import * as React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import '@/styles/globals.css';
import { Providers } from './providers';
import { ExtensionFix } from '@/components/ui/ExtensionFix';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CodeMitra - Real-time Collaborative Coding Platform',
  description: 'A real-time collaborative coding platform with secure rooms and live code execution',
  keywords: ['code', 'collaboration', 'real-time', 'programming', 'coding', 'editor'],
  authors: [{ name: 'CodeMitra Team' }],
  creator: 'CodeMitra Team',
  publisher: 'CodeMitra',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'CodeMitra',
    title: 'CodeMitra - Real-time Collaborative Coding Platform',
    description: 'A real-time collaborative coding platform with secure rooms and live code execution',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CodeMitra - Real-time Collaborative Coding Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeMitra - Real-time Collaborative Coding Platform',
    description: 'A real-time collaborative coding platform with secure rooms and live code execution',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script 
          src="/error-handler.js" 
          strategy="beforeInteractive"
          id="extension-error-handler" 
        />
      </head>
      <body className={inter.className}>
        <ExtensionFix />
        <Providers>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}