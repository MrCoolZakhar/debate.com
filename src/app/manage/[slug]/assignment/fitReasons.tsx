'use client';

// ============================================================
// src/app/manage/[slug]/assignment/fitReasons.tsx
//
// The WHY behind every fit indicator on the allocation portal.
//
// The engine in page.tsx (scorePrefAndExp, scoreSlot, scoreSocietyFit) writes a
// short tag per term it applied ("2ND CHOICE", "EXP TOO LOW -15", ...). A tag
// alone never said which way a mismatch went, so hovering or focusing a tag now
// opens a tooltip at once with the concrete reason, built from the SAME inputs
// the engine scored: the delegate's level, the committee's difficulty, their
// ranked preferences, the seat's importance and the delegation already seated.
//
//   explainReason(reason, ctx)   plain sentence for one tag, or null
//   <FitTip text>                immediate hover / focus tooltip (Portal, fixed
//                                coordinates, clamped, flipped near the edges)
// ============================================================

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Portal from '@/components/Portal';
import { NEU } from '@/components/neu';

const OUTFIT = "'Outfit', sans-serif";

/** Everything a reason sentence may need, already resolved by the caller. */
export interface ReasonContext {
  committeeName: string;
  /** Committee difficulty as stored (beginner / intermediate / advanced / expert), or null. */
  difficulty: string | null;
  countryName: string;
  /** Seat importance tier: high / medium / low / standard. */
  importance: string;
  /** The delegate's recorded level (application, else profile mirror), or null. */
  experienceLevel: string | null;
  /** 0-based rank of this committee in their preferences, -1 when not ranked. */
  prefIndex: number;
  /** The country they asked for with that preference, if any. */
  prefCountryName: string | null;
  /** Their delegation (society) name, null for an independent. */
  societyName: string | null;
}

const ORDINAL = ['1st', '2nd', '3rd'];
const ordinal = (i: number) => ORDINAL[i] ?? `${i + 1}th`;

function levelWord(s: string | null | undefined): string {
  const v = (s ?? '').trim().toLowerCase();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Unknown';
}

/** Points carried by a tag like "EXP TOO LOW -15" or "COMPLETES PAIR +35". */
function pointsOf(reason: string): string | null {
  const m = reason.match(/([+-]\d+)\s*$/);
  return m ? m[1] : null;
}

export function explainReason(reason: string, ctx: ReasonContext): string | null {
  const pts = pointsOf(reason);
  const tail = pts ? ` (${pts} points)` : '';
  const lvl = levelWord(ctx.experienceLevel);
  const diff = levelWord(ctx.difficulty);

  if (reason === '1ST CHOICE' || reason === '2ND CHOICE' || reason === '3RD CHOICE') {
    const i = reason.startsWith('1') ? 0 : reason.startsWith('2') ? 1 : 2;
    const points = i === 0 ? 50 : i === 1 ? 30 : 15;
    return `${ctx.committeeName} is their ${ordinal(i)} choice committee (+${points} points).`;
  }
  if (reason === 'COUNTRY PICK') {
    const which = ctx.prefIndex >= 0 ? `their ${ordinal(ctx.prefIndex)} choice` : 'their preferences';
    return `They asked for ${ctx.countryName} in ${ctx.committeeName} as ${which} (+25 points).`;
  }
  if (reason.startsWith('EXP MATCH')) {
    return `Experience fits: they are ${lvl}, and ${ctx.committeeName} is set to ${diff}${tail}.`;
  }
  if (reason.startsWith('EXP TOO LOW')) {
    return `Experience too low: they are ${lvl}, ${ctx.committeeName} asks for ${diff}${tail}.`;
  }
  if (reason.startsWith('EXP TOO HIGH')) {
    return `Experience too high: they are ${lvl}, ${ctx.committeeName} is set to ${diff}${tail}.`;
  }
  if (reason === 'HIGH PRIORITY') {
    return `${ctx.countryName} is a high-importance seat, so it is filled first (+18 points).`;
  }
  if (reason === 'PRIORITY SEAT') {
    return `${ctx.countryName} is a medium-importance seat, filled before standard ones (+10 points).`;
  }
  if (reason === 'NEEDS DELEGATES') {
    return `${ctx.committeeName} has fewer seats filled than the other committees.`;
  }
  if (reason.startsWith('COMPLETES PAIR')) {
    return `${ctx.societyName ?? 'Their delegation'} already holds the other seat of ${ctx.countryName}. This completes the pair${tail}.`;
  }
  if (reason.startsWith('DELEGATION CONCENTRATION')) {
    return `${ctx.societyName ?? 'Their delegation'} already has a delegate in ${ctx.committeeName}. Spreading a delegation out is preferred${tail}.`;
  }
  return null;
}

/** What the tags leave out, so a missing tag is explained too. Shown under the
 *  tag's own sentence in the tooltip. */
export function missingSignals(ctx: ReasonContext, reasons: string[]): string[] {
  const out: string[] = [];
  if (ctx.prefIndex < 0) out.push(`${ctx.committeeName} is not in their committee preferences.`);
  else if (!reasons.includes('COUNTRY PICK')) {
    out.push(ctx.prefCountryName
      ? `They asked for ${ctx.prefCountryName} here, not ${ctx.countryName}.`
      : `${ctx.countryName} is not the country they asked for.`);
  }
  if (!reasons.some(r => r.startsWith('EXP '))) {
    if (!ctx.experienceLevel || !ctx.difficulty) {
      out.push(!ctx.difficulty
        ? `${ctx.committeeName} has no difficulty set, so experience is not scored.`
        : 'Their experience level is not recorded, so experience is not scored.');
    } else {
      out.push(`Experience is one level off: they are ${levelWord(ctx.experienceLevel)}, ${ctx.committeeName} is ${levelWord(ctx.difficulty)} (0 points).`);
    }
  }
  return out;
}

// ── FitTip ────────────────────────────────────────────────────────────────────
// Opens on pointer enter and on keyboard focus with NO delay, closes on leave,
// blur and Escape. Rendered through Portal at fixed coordinates computed from
// the trigger, clamped inside the viewport and flipped above when the space
// below is short, so no card's overflow can clip it.

const TIP_W = 260;

export function FitTip({ text, lines, children }: { text: string | null; lines?: string[]; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = tipRef.current?.offsetHeight ?? 90;
    let left = r.left + r.width / 2 - TIP_W / 2;
    left = Math.max(8, Math.min(left, vw - 8 - TIP_W));
    const above = r.bottom + 8 + h > vh - 8 && r.top - 8 - h > 8;
    setPos({ top: above ? r.top - 8 - h : r.bottom + 8, left, above });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    // Second pass once the tooltip has a measured height.
    const raf = requestAnimationFrame(place);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  const extra = lines ?? [];
  if (!text && extra.length === 0) return <>{children}</>;

  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-label={[text, ...extra].filter(Boolean).join(' ')}
      className="inline-flex focus:outline-none"
      style={{ cursor: 'help', borderRadius: 999 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <Portal>
          <div
            ref={tipRef}
            role="tooltip"
            style={{
              position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: TIP_W, zIndex: 3000,
              padding: '9px 11px', borderRadius: 12,
              backgroundColor: 'var(--gv-main)', color: '#FAF6EA',
              border: '1px solid color-mix(in srgb, var(--gv-main) 70%, black)',
              boxShadow: '0 10px 26px -8px rgba(27,56,40,0.45)',
              fontFamily: OUTFIT, fontSize: 12, lineHeight: 1.45, fontWeight: 500,
              pointerEvents: 'none', textTransform: 'none', letterSpacing: 0,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {text && <p style={{ fontWeight: 700 }}>{text}</p>}
            {extra.map((l, i) => (
              <p key={i} style={{ marginTop: text || i > 0 ? 5 : 0, color: NEU.gold, opacity: 0.92 }}>{l}</p>
            ))}
          </div>
        </Portal>
      )}
    </span>
  );
}
