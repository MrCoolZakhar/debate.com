import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MUN Command — Modern MUN Committee Software',
  description: 'The most powerful Model United Nations committee management platform for chairs, delegates, and directors.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#0a0e1a] text-[#e8eaf0] antialiased">
        {children}
      </body>
    </html>
  );
}
