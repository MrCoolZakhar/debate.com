// ── The small gold "Unlimited" mark beside an applicant's name ─────────────
//
// Job Board prompt 3: organizers see which applicants hold Gavelling
// Unlimited (conference_unlimited_applicants, team_applicants.unlimited).
// Presentational only. A word with a small infinity glyph, never a count.

import { Infinity as InfinityIcon } from 'lucide-react';

export default function UnlimitedMark({ size = 'sm', style }: { size?: 'xs' | 'sm'; style?: React.CSSProperties }) {
  const xs = size === 'xs';
  return (
    <span
      title="Gavelling Unlimited member"
      aria-label="Gavelling Unlimited member"
      role="img"
      className="inline-flex items-center flex-shrink-0 align-middle"
      style={{
        gap: 3, padding: xs ? '1px 6px' : '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap', lineHeight: 1.3,
        fontFamily: 'var(--font-brand), sans-serif', fontSize: xs ? 10.5 : 11.5, fontWeight: 700, color: '#4A3410',
        background: 'linear-gradient(145deg, #F3E3A1 0%, #EED98A 55%, #D9B44A 100%)',
        boxShadow: '0 1px 3px rgba(182,135,31,0.3)',
        ...style,
      }}
    >
      <InfinityIcon size={xs ? 11 : 12} strokeWidth={2.6} aria-hidden />
      Unlimited
    </span>
  );
}
