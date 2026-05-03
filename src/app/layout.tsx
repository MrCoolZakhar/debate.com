import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gavelling — Modern MUN Committee Software',
  description: 'Gavelling gives chairs and directors everything they need to run professional, efficient Model UN sessions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/favicon.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/favicon.jpg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full bg-[#EDE7D8] text-[#1C1410] antialiased">
        {children}
      </body>
    </html>
  );
}
