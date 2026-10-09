'use client';

/**
 * The look of the Communications page (redesign, 9 Oct 2026).
 *
 * Built to the owner's 12-year-old rule: one obvious next step per screen,
 * plain words, no indicator that does not change a decision. White cards with
 * a soft forest shadow on the ivory page, duotone icons in a tinted disc,
 * sentence-case buttons in the forest gradient, Title Case titles with the
 * last word in the gold italic.
 */

import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';

export const FONT = 'var(--font-brand), sans-serif';
export const INK = '#1C1410';
export const SOFT_INK = '#5A4A3C';
export const FOREST = '#1B3828';
export const DANGER = '#8B2020';
export const EASE_OUT = 'cubic-bezier(0.22,1,0.36,1)';

export const CARD: CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: 18,
  boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 2px 4px rgba(27,56,40,0.05), 0 10px 26px -10px rgba(27,56,40,0.22)',
};

export const PRIMARY: CSSProperties = {
  background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)',
  color: '#FFFFFF', border: 'none', borderRadius: 11, cursor: 'pointer',
  fontFamily: FONT, fontWeight: 700, fontSize: 14, minHeight: 44, padding: '0 18px',
};

export const SECONDARY: CSSProperties = {
  background: '#FFFFFF', color: INK, border: `1.5px solid ${INK}`, borderRadius: 11, cursor: 'pointer',
  fontFamily: FONT, fontWeight: 700, fontSize: 14, minHeight: 44, padding: '0 16px',
};

/** A page or view title: Title Case, the last word in the gold italic. */
export function CommsTitle({ lead, gold, sub }: { lead: string; gold: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 style={{ fontFamily: FONT, fontWeight: 800, color: INK, fontSize: 'clamp(26px, 3vw, 36px)', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance' }}>
        {lead} <GoldWord>{gold}</GoldWord>
      </h1>
      {sub && (
        <p style={{ fontFamily: FONT, color: SOFT_INK, fontSize: 15, marginTop: 6, maxWidth: 620, textWrap: 'pretty' }}>{sub}</p>
      )}
    </div>
  );
}

/** "Back to Communications", the one way out of every view. */
export function BackLink({ onClick, label = 'Communications' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: FOREST }}
    >
      <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> {label}
    </button>
  );
}

/** A duotone icon on a soft tinted disc: forest line over a gold fill. */
export function DuoIcon({ icon: Icon, size = 52, tone = 'gold' }: { icon: LucideIcon; size?: number; tone?: 'gold' | 'green' | 'red' }) {
  const fill = tone === 'gold' ? 'rgba(238,217,138,0.55)' : tone === 'green' ? 'rgba(61,122,82,0.18)' : 'rgba(139,32,32,0.12)';
  const line = tone === 'red' ? DANGER : FOREST;
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: fill }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} style={{ color: line, fill: tone === 'gold' ? 'rgba(238,217,138,0.9)' : 'none' }} />
    </span>
  );
}

/**
 * One big choice on the home screen. The whole card is the button. `count`
 * is a big number with its word beside it, and only appears when it matters.
 */
export function ActionCard({
  icon, title, line, count, countWord, urgent, onClick, badge,
}: {
  icon: LucideIcon;
  title: string;
  line: string;
  count?: number;
  countWord?: string;
  urgent?: boolean;
  onClick: () => void;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="gv-comms-action w-full text-left flex items-start gap-4 p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{ ...CARD, cursor: 'pointer', border: 'none', transitionProperty: 'transform, box-shadow', transitionDuration: '200ms', transitionTimingFunction: EASE_OUT }}
    >
      <DuoIcon icon={icon} tone={urgent ? 'red' : 'gold'} />
      <span className="min-w-0 flex-1 block">
        <span className="flex items-start gap-2">
          <span className="block flex-1 min-w-0" style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, lineHeight: 1.25 }}>{title}</span>
          {badge}
        </span>
        <span className="block" style={{ fontFamily: FONT, fontSize: 14, color: SOFT_INK, marginTop: 4, lineHeight: 1.45, textWrap: 'pretty' }}>{line}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="flex items-baseline gap-1.5 mt-3">
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, lineHeight: 1, color: urgent ? DANGER : FOREST, fontVariantNumeric: 'tabular-nums' }}>{count.toLocaleString()}</span>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: urgent ? DANGER : SOFT_INK }}>{countWord}</span>
          </span>
        )}
      </span>
      <ChevronRight size={20} className="flex-shrink-0 self-center" style={{ color: SOFT_INK }} aria-hidden />
      <style>{`.gv-comms-action:hover{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(27,56,40,0.09),0 4px 8px rgba(27,56,40,0.06),0 16px 32px -12px rgba(27,56,40,0.28)!important}
@media (prefers-reduced-motion: reduce){.gv-comms-action{transition:none!important}.gv-comms-action:hover{transform:none}}`}</style>
    </button>
  );
}

/** A plain on/off switch with its own accessible name. */
export function OnOffSwitch({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="relative flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-full"
      style={{
        width: 50, height: 30, borderRadius: 999, border: 'none', cursor: disabled ? 'default' : 'pointer',
        backgroundColor: on ? '#2A5A3C' : '#CFC6B4', opacity: disabled ? 0.6 : 1,
        transitionProperty: 'background-color', transitionDuration: '180ms',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 3, insetInlineStart: on ? 23 : 3, width: 24, height: 24, borderRadius: 999,
          backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transitionProperty: 'inset-inline-start', transitionDuration: '180ms', transitionTimingFunction: EASE_OUT,
        }}
      />
    </button>
  );
}

/** A small plain text button with an underline, for second actions. */
export function TextLink({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
      style={{ background: 'none', border: 'none', padding: '6px 2px', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: danger ? DANGER : FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}
    >
      {children}
    </button>
  );
}
