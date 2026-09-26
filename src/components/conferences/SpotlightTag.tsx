'use client';

// The two marks a public conference card can carry (25 Sep 2026):
//   <SpotlightTag />        the small "Spotlight" tag, top right, on a booked
//                           Gavelling Spotlight (homepage, Explore, region, country)
//   <CreditSponsoredMark /> "Credit sponsored" with a heart, right beside the fee,
//                           on a conference whose Store pays applicants' credit
// plus SPOTLIGHT_GLOW, the bright gold edge and glow a spotlight card wears
// (a gold edge, never a forest block).

import { Heart, Sparkles } from 'lucide-react';

const FONT = "var(--font-brand), sans-serif";

/** Gold edge + glow for a spotlight card, layered so it pops on ivory and on a photo. */
export const SPOTLIGHT_GLOW = '0 0 0 2px #EED98A, 0 0 0 3px rgba(182,135,31,0.55), 0 8px 26px rgba(238,217,138,0.45), 0 20px 50px rgba(182,135,31,0.28)';
export const SPOTLIGHT_GLOW_HOVER = '0 0 0 2px #F3E3A1, 0 0 0 3px rgba(182,135,31,0.7), 0 12px 32px rgba(238,217,138,0.55), 0 26px 60px rgba(182,135,31,0.34)';

export function SpotlightTag({ size = 'md', style }: { size?: 'sm' | 'md'; style?: React.CSSProperties }) {
  const sm = size === 'sm';
  return (
    <span
      title="A Gavelling Spotlight, booked by the conference"
      className="inline-flex items-center gap-1"
      style={{
        fontFamily: FONT, fontWeight: 800, fontSize: sm ? 9.5 : 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#4A3410', background: 'linear-gradient(145deg, #F3E3A1 0%, #EED98A 55%, #D9B44A 100%)',
        padding: sm ? '3px 8px' : '4px 10px', borderRadius: 9999,
        boxShadow: '0 2px 8px rgba(182,135,31,0.4), 0 0 0 1px rgba(255,255,255,0.5) inset',
        whiteSpace: 'nowrap', lineHeight: 1.2,
        ...style,
      }}
    >
      <Sparkles size={sm ? 10 : 12} strokeWidth={2.4} aria-hidden />
      Spotlight
    </span>
  );
}

/** "Credit sponsored" with a heart. `tone` names the ground it sits on. */
export function CreditSponsoredMark({ tone = 'light', size = 'md', style }: {
  tone?: 'light' | 'dark'; size?: 'sm' | 'md'; style?: React.CSSProperties;
}) {
  const sm = size === 'sm';
  const color = tone === 'dark' ? '#FFD1D8' : '#8B2020';
  return (
    <span
      title="The conference pays your Gavelling credit. Applying costs you nothing."
      className="inline-flex items-center gap-1"
      style={{ fontFamily: FONT, fontWeight: 700, fontSize: sm ? 11 : 12, color, whiteSpace: 'nowrap', lineHeight: 1.2, ...style }}
    >
      <Heart size={sm ? 11 : 13} strokeWidth={2.4} fill={tone === 'dark' ? 'rgba(255,209,216,0.5)' : 'rgba(139,32,32,0.18)'} aria-hidden />
      Credit sponsored
    </span>
  );
}
