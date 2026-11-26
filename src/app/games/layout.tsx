import type { ReactNode } from 'react';
import { Press_Start_2P, VT323 } from 'next/font/google';

// /games carries its own pixel typefaces (owner, 26 Nov 2026: MUNillion takes
// Krillion's pixel feel). Press Start 2P for labels, numbers and buttons; VT323
// for prompts, answers and text. Loaded here only, so the rest of the site stays Inter.
const pixel = Press_Start_2P({ subsets: ['latin'], weight: '400', variable: '--font-pixel', display: 'swap' });
const pixelBody = VT323({ subsets: ['latin'], weight: '400', variable: '--font-pixel-body', display: 'swap' });

export default function GamesLayout({ children }: { children: ReactNode }) {
  return <div className={`${pixel.variable} ${pixelBody.variable}`}>{children}</div>;
}
