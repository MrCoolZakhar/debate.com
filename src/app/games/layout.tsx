import type { ReactNode } from 'react';
import { Silkscreen, Pixelify_Sans } from 'next/font/google';

// /games carries its own pixel typefaces (owner, 26 Nov 2026: MUNillion takes
// Krillion's pixel feel). Loaded here only, so the rest of the site stays Inter.
const pixel = Silkscreen({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-pixel', display: 'swap' });
const pixelBody = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixel-body', display: 'swap' });

export default function GamesLayout({ children }: { children: ReactNode }) {
  return <div className={`${pixel.variable} ${pixelBody.variable}`}>{children}</div>;
}
