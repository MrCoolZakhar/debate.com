'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MonogramMedallion — the fallback emblem for a committee with no artwork: a
// gradient disc with grain and gold initials, matching the public conference
// card. The tone follows the committee type, so a crisis room keeps its red
// seal and a custom (parliamentary) one its amber seal.
//
// It lived in CommitteeEditorModal.tsx until 23 Sep 2026 and moved here so the
// committee set-up kit can draw it without importing the editor back (a cycle).
// CommitteeEditorModal re-exports all three names, so every existing
// `import { MonogramMedallion } from '@/components/CommitteeEditorModal'`
// keeps working untouched.
// ─────────────────────────────────────────────────────────────────────────────

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

export type MedallionTone = 'forest' | 'crisis' | 'custom';

const MEDALLION_BG: Record<MedallionTone, string> = {
  forest: 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)',
  crisis: 'linear-gradient(135deg, #3C1414 0%, #6E1E1E 100%)',
  // Custom (parliamentary) committees: gold on dark amber.
  custom: 'linear-gradient(135deg, #5C3D10 0%, #9C6B1C 100%)',
};

export function medallionTone(committeeType: string | null | undefined): MedallionTone {
  return committeeType === 'crisis' ? 'crisis' : committeeType === 'custom' ? 'custom' : 'forest';
}

// `tone` wins when given; `isCrisis` is kept for the existing callers.
export function MonogramMedallion({ text, isCrisis = false, tone, size }: { text: string; isCrisis?: boolean; tone?: MedallionTone; size: number }) {
  const monogram = text.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || '–';
  const resolved: MedallionTone = tone ?? (isCrisis ? 'crisis' : 'forest');
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '9999px',
        background: MEDALLION_BG[resolved],
        boxShadow: '0 10px 24px rgba(27,56,40,0.26)',
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.12 }} />
      <span style={{ fontFamily: "var(--font-brand), sans-serif", fontSize: monogram.length > 4 ? Math.round(size * 0.135) : Math.round(size * 0.167), fontWeight: 700, color: '#EED98A', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
        {monogram}
      </span>
    </div>
  );
}
