'use client';

// ── The Job Board's card look (CLAUDE.md §8, 22 Oct 2026) ─────────────────
//
// The same look as the assignment seat board: white cards with a soft
// forest-tinted shadow, a gold top edge on the focus card (Your Listings),
// icons in style A (Lucide, fine line in bare ink, no tile), light secondary
// buttons with at most one solid forest button per view, counts as a big
// number with the word beside it. Presentation only: the page keeps its
// sections, order and behaviour.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { InfoHint } from '../settings/applicationsUi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

/** Style A: fine line, bare ink. */
export const ICON_STROKE = 1.6;

export function BoardCard({ title, hint, icon: Icon, focus = false, className, children }: {
  title: string;
  hint: string;
  icon: LucideIcon;
  /** The page's focus card: a gold top edge. */
  focus?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`gv-jk-card${focus ? ' gv-jk-focus' : ''}${className ? ` ${className}` : ''}`} aria-label={title}>
      <div className="gv-jk-head">
        <Icon size={22} strokeWidth={ICON_STROKE} aria-hidden className="gv-jk-icon" />
        <h2 className="gv-jk-title">{title}</h2>
        <InfoHint label={`About ${title}`} text={hint} size={16} />
      </div>
      {children}
    </section>
  );
}

/** A count: the big number with its word beside it, an optional style A icon first. */
export function JobCount({ n, word, icon: Icon }: { n: number; word: string; icon?: LucideIcon }) {
  return (
    <span className="gv-jk-count">
      {Icon && <Icon size={17} strokeWidth={ICON_STROKE} aria-hidden className="gv-jk-count-icon" />}
      <b>{n.toLocaleString('en-US')}</b>
      <span>{word}</span>
    </span>
  );
}

export const JOB_KIT_CSS = `
.gv-jk-card{position:relative;background:#FFFFFF;border-radius:20px;padding:20px 22px 20px;font-family:${FONT};
  box-shadow:0 1px 2px rgba(27,56,40,0.06),0 8px 24px rgba(27,56,40,0.08)}
.gv-jk-focus{box-shadow:inset 0 1px 0 #F8EBBE,inset 0 4px 0 #DFC164,inset 0 0 0 1px rgba(182,135,31,0.20),0 1px 2px rgba(27,56,40,0.08),0 12px 28px -10px rgba(27,56,40,0.26);padding-top:24px}
.gv-jk-head{display:flex;align-items:center;gap:10px;margin:0 0 14px}
.gv-jk-icon{flex-shrink:0;color:${INK}}
.gv-jk-title{margin:0;font-size:18px;font-weight:800;letter-spacing:-0.01em;line-height:1.25;color:${INK}}
.gv-jk-count{display:inline-flex;align-items:baseline;gap:6px;font-family:${FONT}}
.gv-jk-count b{font-size:24px;font-weight:700;line-height:1;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums}
.gv-jk-count span{font-size:13.5px;color:${INK_SOFT}}
.gv-jk-count-icon{align-self:center;color:${INK_SOFT}}
/* Light secondary buttons, as on the seat board (SOFT_BTN_CLASS); the one solid forest button stays gv-st-forest. */
.gv-jb .gv-st-outline{background:#FFFFFF;color:${FOREST};font-weight:600;border:1px solid rgba(27,56,40,0.20);box-shadow:0 1px 2px rgba(27,56,40,0.07);transition:background-color 150ms cubic-bezier(0.22,1,0.36,1),border-color 150ms cubic-bezier(0.22,1,0.36,1),box-shadow 150ms cubic-bezier(0.22,1,0.36,1),transform 150ms cubic-bezier(0.22,1,0.36,1)}
.gv-jb .gv-st-outline:hover:not(:disabled){background:#F4F0E6;border-color:rgba(27,56,40,0.45);box-shadow:0 2px 8px rgba(27,56,40,0.12)}
.gv-jb .gv-st-outline:active:not(:disabled){transform:scale(0.96)}
`;
