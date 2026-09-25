'use client';

// ── Small shared pieces for the two pricing pages ────────────────────────────
// Tokens, the section heading, the two button skins, the live / coming-soon
// status word, and the "Got a question?" box that closes each page. Every
// piece is presentational; the pages own the actions.

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import { Emoji3D, OUTFIT } from '@/components/neu';

export const P = {
  ivory: '#EDE7D8',
  surface: '#FAF8F3',
  border: '#DDD4C0',
  forest: '#1B3828',
  forestDeep: '#14301F',
  forestLight: '#3D7A52',
  gold: '#EED98A',
  goldDeep: '#B6871F',
  ink: '#1C1410',
  inkSoft: '#5A5046',
  muted: '#9A8A78',
} as const;

export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2';

/** The shared stylesheet both pages mount once. */
export function PricingStyles() {
  return (
    <style>{`
      .gv-p{font-family:${OUTFIT};color:${P.ink}}
      .gv-p *{box-sizing:border-box}
      .gv-p-section{padding:56px 0 0}
      .gv-p-section-tight{padding:40px 0 0}
      .gv-p-eyebrow{margin:0 0 10px;font-size:12.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${P.goldDeep}}
      .gv-p-h2{margin:0;font-size:clamp(26px,3.2vw,36px);font-weight:800;letter-spacing:-0.02em;line-height:1.08;color:${P.ink}}
      .gv-p-lead{margin:12px 0 0;font-size:17px;line-height:1.55;color:${P.inkSoft};max-width:62ch}
      .gv-p-body{margin:0;font-size:15.5px;line-height:1.6;color:${P.inkSoft};max-width:62ch}
      .gv-p-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 24px;border-radius:14px;font-family:${OUTFIT};font-size:16px;font-weight:700;letter-spacing:-0.005em;text-decoration:none;cursor:pointer;border:1px solid transparent;transition:transform 160ms cubic-bezier(0.22,1,0.36,1),background-color 160ms ease-out,box-shadow 160ms ease-out}
      .gv-p-btn:hover{transform:translateY(-1px)}
      .gv-p-btn:active{transform:translateY(0)}
      .gv-p-btn[aria-disabled="true"],.gv-p-btn:disabled{cursor:not-allowed;opacity:0.6;transform:none}
      .gv-p-btn-forest{background:${P.forest};color:#FAF8F3;box-shadow:0 10px 24px -14px rgba(27,56,40,0.55)}
      .gv-p-btn-forest:hover{background:#224634}
      .gv-p-btn-gold{background:${P.gold};color:${P.ink};box-shadow:0 10px 24px -14px rgba(182,135,31,0.6)}
      .gv-p-btn-gold:hover{background:#F3E2A0}
      .gv-p-btn-ghost{background:transparent;color:${P.forest};border-color:rgba(27,56,40,0.32)}
      .gv-p-btn-ghost:hover{background:rgba(27,56,40,0.06);border-color:${P.forest}}
      .gv-p-btn-ghost-gold{background:transparent;color:${P.gold};border-color:rgba(238,217,138,0.45)}
      .gv-p-btn-ghost-gold:hover{background:rgba(238,217,138,0.1);border-color:${P.gold}}
      .gv-p-status{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap}
      .gv-p-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
      .gv-p-status[data-live="true"]{color:${P.forestLight}}
      .gv-p-status[data-live="true"] .gv-p-status-dot{background:${P.forestLight}}
      .gv-p-status[data-live="false"]{color:${P.inkSoft}}
      .gv-p-status[data-live="false"] .gv-p-status-dot{border:2px solid ${P.inkSoft};width:9px;height:9px}
      .gv-p-question{margin-top:56px;display:flex;flex-wrap:wrap;align-items:center;gap:20px 28px;padding:28px;border-radius:22px;background:rgba(27,56,40,0.06)}
      .gv-p-question-text{flex:1 1 280px;min-width:0}
      .gv-p-question h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:${P.ink}}
      .gv-p-question p{margin:6px 0 0;font-size:15px;line-height:1.55;color:${P.inkSoft};max-width:52ch}
      .gv-p-rule{height:1px;background:rgba(27,56,40,0.14);border:0;margin:0}
      @media (prefers-reduced-motion:reduce){.gv-p-btn{transition:none}.gv-p-btn:hover{transform:none}}
    `}</style>
  );
}

export function SectionHeading({ eyebrow, title, lead, id, tight = false }: {
  eyebrow?: string;
  title: string;
  lead?: string;
  id?: string;
  tight?: boolean;
}) {
  return (
    <div className={tight ? 'gv-p-section-tight' : 'gv-p-section'} id={id} style={{ scrollMarginTop: 96 }}>
      {eyebrow && <p className="gv-p-eyebrow">{eyebrow}</p>}
      <h2 className="gv-p-h2">{title}</h2>
      {lead && <p className="gv-p-lead">{lead}</p>}
    </div>
  );
}

type Skin = 'forest' | 'gold' | 'ghost' | 'ghost-gold';

export function ActionButton({ skin = 'forest', onClick, children, disabled = false, style, ariaLabel }: {
  skin?: Skin;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`gv-p-btn gv-p-btn-${skin} ${FOCUS_RING}`}
      style={style}
    >
      {children}
    </button>
  );
}

export function ActionLink({ skin = 'ghost', href, children, style }: {
  skin?: Skin;
  href: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Link href={href} className={`gv-p-btn gv-p-btn-${skin} ${FOCUS_RING}`} style={style}>
      {children}
    </Link>
  );
}

/** "Live now" or "Coming soon": a filled or hollow dot beside the word, so it never reads by colour alone. */
export function StatusWord({ live }: { live: boolean }) {
  return (
    <span className="gv-p-status" data-live={live ? 'true' : 'false'}>
      <span className="gv-p-status-dot" aria-hidden />
      {live ? 'Live now' : 'Coming soon'}
    </span>
  );
}

/** The close of every pricing page: a way to the help center, never back to the page's own FAQ. */
export function QuestionBox() {
  return (
    <aside className="gv-p-question" aria-labelledby="gv-p-question-title">
      <div style={{ flexShrink: 0 }}>
        <Emoji3D name="Speech balloon" size={44} fallback={MessageCircle} fallbackColor={P.forest} />
      </div>
      <div className="gv-p-question-text">
        <h2 id="gv-p-question-title">Got a question?</h2>
        <p>The help center keeps every pricing answer in one place, and a way to reach us if yours is not there.</p>
      </div>
      <ActionLink href="/help#pricing" skin="ghost">Open the help center</ActionLink>
    </aside>
  );
}
