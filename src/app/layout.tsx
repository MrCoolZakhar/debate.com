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
      </head>
      <body className="min-h-full bg-[#0D0906] text-[#E8D5B7] antialiased">
        {children}
      </body>
    </html>
  );
}
