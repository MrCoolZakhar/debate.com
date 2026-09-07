'use client';

// ============================================================
// src/components/SeatFlag.tsx
//
// One render site, one component: draw whatever this seat's mark is.
//
// Before this existed every flag in the live session hand-rolled the same
// three steps — getCountryByName(name) → .code → <img src={getFlagUrl(code)}>
// with a globe fallback — about fifty times across fifteen files. A seat with
// a custom crest (a European Parliament group, a party bench, a school badge)
// would have needed all fifty patched. Now they all go through here.
//
// TWO WAYS TO CALL IT
//   1. You hold the Delegate       <SeatFlag seat={d} size={20} />
//   2. You hold only a name        <SeatFlag country={s.country} size={20} />
//      — which is the common case, because SpeakerEntry, motion.proposedBy,
//      document sponsors and caucus.currentSpeaker are all bare strings. The
//      crest is then resolved from <SeatArtProvider>'s roster index. Without a
//      provider it simply falls back to the national flag, which is exactly the
//      old behaviour, so an un-wrapped surface can never render wrong — only
//      un-crested.
//
// GEOMETRY IS THE CALL SITE'S, NOT OURS. `style` and `className` land on the
// outer box in both branches, so a converted site keeps its exact width,
// height, radius, ring and shadow. The only thing that changes is the source of
// the image.
// ============================================================

import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { FlagImg } from '@/components/FlagImg';
import {
  buildSeatLogoIndex,
  sessionSeatArtByName,
  type SeatLogoIndex,
  type SessionSeat,
  type SlotArt,
} from '@/lib/sessionFlags';

// ── Roster context ──────────────────────────────────────────────────────────

const SeatArtContext = createContext<SeatLogoIndex | null>(null);

/** Wrap a session surface in this once, with that committee's delegates, and
 *  every <SeatFlag country="…"> beneath it can find a seat's crest by name.
 *  The index is rebuilt only when the roster array identity changes. */
export function SeatArtProvider({ delegates, children }: { delegates: readonly SessionSeat[] | undefined | null; children: ReactNode }) {
  const index = useMemo(() => buildSeatLogoIndex(delegates), [delegates]);
  return <SeatArtContext.Provider value={index}>{children}</SeatArtContext.Provider>;
}

/** The roster crest index in scope, or null outside a provider. */
export function useSeatLogoIndex(): SeatLogoIndex | null {
  return useContext(SeatArtContext);
}

/** Resolve a seat's mark. `logoUrl`, when given, wins over the roster index —
 *  pass it whenever the call site already holds the Delegate. */
export function useSeatArt(country: string, logoUrl?: string | null): SlotArt {
  const index = useContext(SeatArtContext);
  if (logoUrl) return { kind: 'logo', url: logoUrl, label: country };
  return sessionSeatArtByName(country, index);
}

// ── The component ───────────────────────────────────────────────────────────

interface SeatFlagProps {
  /** The delegate, when the call site has one. Wins over `country`/`logoUrl`. */
  seat?: SessionSeat | null;
  /** The seat's country name, when that is all the call site has. */
  country?: string;
  /** An explicit crest. Overrides whatever the roster index says. */
  logoUrl?: string | null;
  /** Box size in px. Ignored for the width/height a `style` override sets. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Drawn when the seat resolves to neither a crest nor a known flag.
   *  Defaults to FlagImg's globe. */
  fallback?: ReactNode;
}

export function SeatFlag({ seat, country, logoUrl, size = 24, className = '', style, fallback }: SeatFlagProps) {
  const name = seat?.country ?? country ?? '';
  const art = useSeatArt(name, seat ? seat.logoUrl : logoUrl);

  if (art.kind === 'none' && fallback !== undefined) return <>{fallback}</>;

  return (
    <FlagImg
      code={art.kind === 'flag' ? art.code : ''}
      logoUrl={art.kind === 'logo' ? art.url : undefined}
      label={art.kind === 'logo' ? art.label : undefined}
      size={size}
      className={className}
      style={style}
    />
  );
}
