import { Press_Start_2P } from 'next/font/google';
import type { CSSProperties } from 'react';

// A small pixel bubble over a nav item (owner, 27 Nov 2026): "Daily" over Games in MUNillion's
// font, "Black Friday" over the Store while the sale runs. Not preloaded, so pages that never
// show the desktop pill pay nothing for the font until it draws.
const pixel = Press_Start_2P({ subsets: ['latin'], weight: '400', display: 'swap', preload: false });

export type NavBubbleTone = 'daily' | 'sale';

const TONES: Record<NavBubbleTone, CSSProperties> = {
  daily: { background: '#EED98A', color: '#1C1410', borderColor: '#1C1410' },
  sale: { background: '#0E0F0D', color: '#EED98A', borderColor: '#EED98A' },
};

const CSS = `
@keyframes gv-navbubble-bob { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -2px); } }
.gv-navbubble { animation: gv-navbubble-bob 1.6s steps(2, end) infinite; }
@media (prefers-reduced-motion: reduce) { .gv-navbubble { animation: none; } }
`;

/** `floating`: sits over the top edge of a desktop pill item. Otherwise it follows the label inline (the phone menu). */
export default function NavBubble({ text, tone, floating = false }: { text: string; tone: NavBubbleTone; floating?: boolean }) {
  const base: CSSProperties = {
    ...TONES[tone],
    fontFamily: pixel.style.fontFamily,
    fontWeight: 400,
    // the pill's columns are about 78px at 1024 and 105px at 1440, so the floating bubble scales with the screen
    fontSize: floating ? 'clamp(5px, 0.46vw, 6.5px)' : 8,
    lineHeight: 1,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    padding: floating ? '3px 4px 2px' : '4px 6px 3px',
    borderWidth: 2,
    borderStyle: 'solid',
    boxShadow: '2px 2px 0 #1C1410',
    pointerEvents: 'none',
  };
  if (floating) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <span
          aria-hidden
          className="gv-navbubble"
          style={{ ...base, position: 'absolute', top: -11, left: '50%', transform: 'translate(-50%, 0)', zIndex: 1 }}
        >
          {text}
        </span>
      </>
    );
  }
  return <span aria-hidden style={{ ...base, display: 'inline-block', marginInlineStart: 10 }}>{text}</span>;
}
