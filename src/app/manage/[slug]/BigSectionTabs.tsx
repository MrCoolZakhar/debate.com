'use client';

// Big section tabs for organiser pages (11 Oct 2026, owner: "make the sections
// for overview, everyone and settings bigger, cmon its too small"). They
// replace the 11px NeuPill tab rows on Documents and Committees: one white card
// per section, a Fluent 3D emoji disc hanging over its top edge, an 18px label
// and one short line. The open card is lifted with a forest edge and a gold
// wash; the others sit quieter. A real tablist: arrow keys, Home and End move
// between the sections. Two to four sections fit side by side; on a phone they
// stack.

import type { LucideIcon } from 'lucide-react';
import { Emoji3D, OUTFIT } from '@/components/neu';

export type BigSectionTab<K extends string> = {
  key: K;
  label: string;
  /** One short line under the label. */
  sub: string;
  /** Fluent 3D emoji folder name. */
  emoji: string;
  /** Drawn if the emoji image cannot load. */
  lucide: LucideIcon;
  tone: 'gold' | 'green';
};

const TINT = {
  gold: 'linear-gradient(150deg, rgba(238,217,138,0.78), rgba(238,217,138,0.32))',
  green: 'linear-gradient(150deg, rgba(61,122,82,0.26), rgba(61,122,82,0.09))',
};

const CSS = `
.gv-bst{display:grid;grid-template-columns:repeat(var(--gv-bst-n),minmax(0,1fr));gap:16px;margin:34px 0 30px;max-width:calc(var(--gv-bst-n) * 340px)}
@media (max-width:760px){.gv-bst{grid-template-columns:minmax(0,1fr);gap:32px}}
.gv-bst-tab{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:112px;padding:44px 20px 18px;border:none;border-radius:22px;background:#FFFFFF;text-align:left;cursor:pointer;font-family:${OUTFIT};box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.40);transition:transform 180ms cubic-bezier(0.22,1,0.36,1),box-shadow 180ms ease}
.gv-bst-tab:hover{transform:translateY(-2px);box-shadow:0 1px 0 rgba(27,56,40,0.08),0 22px 44px -28px rgba(27,56,40,0.48)}
.gv-bst-tab:active{transform:scale(0.99)}
.gv-bst-tab:focus{outline:none}
.gv-bst-tab:focus-visible{outline:3px solid #1B3828;outline-offset:3px}
.gv-bst-tab[aria-selected="true"]{background:radial-gradient(120% 110% at 100% 0%,rgba(238,217,138,0.40) 0%,rgba(238,217,138,0) 60%),#FFFFFF;box-shadow:0 0 0 2px #1B3828,0 22px 44px -26px rgba(27,56,40,0.55);transform:translateY(-3px)}
.gv-bst-disc{position:absolute;top:-26px;left:18px;width:60px;height:60px;border-radius:19px;display:inline-flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.8),0 10px 20px -12px rgba(27,56,40,0.55)}
.gv-bst-tab[aria-selected="true"] .gv-bst-disc{box-shadow:inset 0 1px 0 rgba(255,255,255,0.8),0 0 0 2px #FFFFFF,0 12px 24px -12px rgba(27,56,40,0.6)}
.gv-bst-label{font-size:18px;font-weight:800;letter-spacing:-0.01em;line-height:1.2;color:#1C1410}
.gv-bst-tab[aria-selected="true"] .gv-bst-label{color:#1B3828}
.gv-bst-sub{font-size:13.5px;line-height:1.4;color:color-mix(in srgb,#1C1410 70%,#FFFFFF)}
.gv-bst[data-compact="true"]{gap:14px;margin:28px 0 24px;max-width:calc(var(--gv-bst-n) * 300px)}
@media (max-width:760px){.gv-bst[data-compact="true"]{grid-template-columns:repeat(2,minmax(0,1fr));gap:30px 12px}}
.gv-bst[data-compact="true"] .gv-bst-tab{min-height:84px;padding:34px 16px 14px;border-radius:20px}
.gv-bst[data-compact="true"] .gv-bst-disc{top:-22px;left:14px;width:50px;height:50px;border-radius:16px}
.gv-bst[data-compact="true"] .gv-bst-label{font-size:17px}
.gv-bst[data-compact="true"] .gv-bst-sub{font-size:13px}
@media (prefers-reduced-motion:reduce){.gv-bst-tab,.gv-bst-tab:hover,.gv-bst-tab[aria-selected="true"]{transition:none;transform:none}}
`;

export function BigSectionTabs<K extends string>({ tabs, value, onChange, label, compact = false }: {
  tabs: BigSectionTab<K>[];
  value: K;
  onChange: (key: K) => void;
  /** The tablist's accessible name. */
  label: string;
  /** A shorter card (a working page like Assignment, where the board below
   *  needs the height). Still 17px labels and a 50px disc. */
  compact?: boolean;
}) {
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex(t => t.key === value);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].key);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  return (
    <>
      <style>{CSS}</style>
      <div
        className="gv-bst"
        data-compact={compact}
        role="tablist"
        aria-label={label}
        onKeyDown={onKey}
        style={{ ['--gv-bst-n' as string]: String(tabs.length) } as React.CSSProperties}
      >
        {tabs.map(t => {
          const on = value === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              className="gv-bst-tab"
              onClick={() => onChange(t.key)}
            >
              <span className="gv-bst-disc" aria-hidden style={{ background: TINT[t.tone] }}>
                <Emoji3D name={t.emoji} size={compact ? 32 : 38} fallback={t.lucide} fallbackColor="#1B3828" />
              </span>
              <span className="gv-bst-label">{t.label}</span>
              <span className="gv-bst-sub">{t.sub}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
