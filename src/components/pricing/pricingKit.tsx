'use client';

// ── Shared pieces for the two pricing pages ──────────────────────────────────
// The palette, the focus rings, the button skins (every label UPPERCASE), the
// section blocks (forest / white / cream) and the "Got a question?" close.
// Presentational only; the pages own the actions.

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { OUTFIT } from '@/components/neu';

export const P = {
  cream: '#EDE7D8',
  ivory: '#FAF8F3',
  white: '#FFFFFF',
  forest: '#1B3828',
  forestDeep: '#14301F',
  forestMid: '#2A5A3C',
  forestLight: '#3D7A52',
  gold: '#EED98A',
  goldDeep: '#B6871F',
  ink: '#1C1410',
  inkSoft: '#5A5046',
} as const;

/** Forest ring, for anything on cream or white. */
export const FOCUS_RING = 'gv-fx-forest';
/** Gold ring, for anything on forest. */
export const FOCUS_RING_GOLD = 'gv-fx-gold';

/** The shared stylesheet both pages mount once. */
export function PricingStyles() {
  return (
    <style>{`
      .gv-p{font-family:${OUTFIT};color:${P.ink}}
      .gv-p *{box-sizing:border-box}
      .gv-fx-forest:focus{outline:none}
      .gv-fx-forest:focus-visible{outline:none;box-shadow:0 0 0 3px ${P.ivory},0 0 0 6px ${P.forest}}
      .gv-fx-gold:focus{outline:none}
      .gv-fx-gold:focus-visible{outline:none;box-shadow:0 0 0 3px ${P.forestDeep},0 0 0 6px ${P.gold}}
      .gv-p-block{border-radius:28px;padding:clamp(28px,4.5vw,56px)}
      .gv-p-block-forest{background:${P.forest};color:#FFFFFF}
      .gv-p-block-white{background:${P.white};color:${P.ink};box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
      .gv-p-block+.gv-p-block,.gv-p-block+.gv-p-open,.gv-p-open+.gv-p-block{margin-top:28px}
      .gv-p-h2{margin:0;font-size:clamp(32px,3.6vw,40px);font-weight:800;letter-spacing:-0.025em;line-height:1.05;color:${P.ink}}
      .gv-p-h2-on-forest{color:#FFFFFF}
      .gv-p-line{margin:10px 0 0;font-size:17px;line-height:1.5;color:${P.inkSoft};max-width:56ch}
      .gv-p-line-on-forest{color:rgba(255,255,255,0.82)}
      .gv-p-link{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px}
      .gv-p-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 26px;border-radius:14px;font-family:${OUTFIT};font-size:14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;cursor:pointer;border:2px solid transparent;transition:transform 160ms cubic-bezier(0.22,1,0.36,1),background-color 160ms ease-out,box-shadow 160ms ease-out}
      .gv-p-btn:hover{transform:translateY(-1px)}
      .gv-p-btn:active{transform:translateY(0)}
      .gv-p-btn[aria-disabled="true"],.gv-p-btn:disabled{cursor:not-allowed;opacity:0.6;transform:none}
      .gv-p-btn-big{min-height:60px;padding:0 34px;font-size:15.5px}
      .gv-p-btn-forest{background:${P.forest};color:${P.gold};box-shadow:0 12px 26px -16px rgba(27,56,40,0.7)}
      .gv-p-btn-forest:hover{background:${P.forestMid}}
      .gv-p-btn-gold{background:${P.gold};color:${P.ink};box-shadow:0 12px 26px -16px rgba(182,135,31,0.7)}
      .gv-p-btn-gold:hover{background:#F3E2A0}
      .gv-p-btn-outline{background:transparent;color:${P.forest};border-color:${P.forest}}
      .gv-p-btn-outline:hover{background:rgba(27,56,40,0.07)}
      .gv-p-btn-outline-ivory{background:transparent;color:${P.ivory};border-color:rgba(250,248,243,0.7)}
      .gv-p-btn-outline-ivory:hover{background:rgba(250,248,243,0.1);border-color:${P.ivory}}
      .gv-p-question{margin-top:28px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px 28px;padding:28px clamp(24px,4vw,40px);border-radius:24px;background:${P.ivory};border:1px solid rgba(27,56,40,0.12)}
      .gv-p-question h2{margin:0;font-size:26px;font-weight:800;letter-spacing:-0.02em;color:${P.ink}}
      .gv-p-question p{margin:6px 0 0;font-size:15.5px;line-height:1.5;color:${P.inkSoft}}
      @media (prefers-reduced-motion:reduce){.gv-p-btn{transition:none}.gv-p-btn:hover{transform:none}}
    `}</style>
  );
}

type Skin = 'forest' | 'gold' | 'outline' | 'outline-ivory';

function focusFor(skin: Skin) {
  return skin === 'outline-ivory' ? FOCUS_RING_GOLD : FOCUS_RING;
}

export function ActionButton({ skin = 'forest', onClick, children, disabled = false, big = false, style, ariaLabel, onForest = false }: {
  skin?: Skin;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  big?: boolean;
  style?: CSSProperties;
  ariaLabel?: string;
  /** The button sits on a forest ground: gold focus ring. */
  onForest?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`gv-p-btn gv-p-btn-${skin} ${big ? 'gv-p-btn-big' : ''} ${onForest ? FOCUS_RING_GOLD : focusFor(skin)}`}
      style={style}
    >
      {children}
    </button>
  );
}

export function ActionLink({ skin = 'outline', href, children, big = false, style, onForest = false }: {
  skin?: Skin;
  href: string;
  children: ReactNode;
  big?: boolean;
  style?: CSSProperties;
  onForest?: boolean;
}) {
  return (
    <Link href={href} className={`gv-p-btn gv-p-btn-${skin} ${big ? 'gv-p-btn-big' : ''} ${onForest ? FOCUS_RING_GOLD : focusFor(skin)}`} style={style}>
      {children}
    </Link>
  );
}

/** The close of every pricing page: a way to the help center. */
export function QuestionBox() {
  return (
    <aside className="gv-p-question gv-p-open" aria-labelledby="gv-p-question-title">
      <div>
        <h2 id="gv-p-question-title">Got a question?</h2>
        <p>
          Every pricing answer lives in the <Link href="/help#pricing" className={`gv-p-link ${FOCUS_RING}`}>help center</Link>
        </p>
      </div>
      <ActionLink href="/help#pricing" skin="forest">Contact us</ActionLink>
    </aside>
  );
}
