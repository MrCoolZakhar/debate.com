'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ConferencePartners — the partners section on a public conference page.
//
// A partner is one of two things (see the `conference_partners` table and its
// `conference_partners_one_shape` check constraint):
//
//   • another Gavelling conference, linked by id and mutually approved;
//   • a company the organiser typed in themselves — name, logo, description.
//
// Both render identically here: logo + name, nothing else. Everything the
// organiser wrote lives behind a click, in a small popup, so the rail stays a
// quiet band of marks rather than a second column of prose.
//
// Placement: on a wide screen the section FLOATS in the left gutter beside the
// 1200px content column (position: fixed, vertically centred). There is only
// room for that when the gutter is genuinely wide — below the threshold the
// same partners render inline in the page flow instead, because a fixed rail
// on a narrow screen would sit on top of the article.
//
// The popup follows the house popover rule (AGENTS.md → UI RULES): rendered
// through Portal at fixed viewport coordinates measured from the trigger, so no
// ancestor's overflow can clip it; flipped to the other side of the trigger
// near the viewport edge; clamped vertically; closed on outside click, Escape
// and repositioned on scroll (capture) + resize.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Portal from '@/components/Portal';
import { LogoDisc } from '@/components/LogoDisc';

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

export interface PartnerEntry {
  /** conference_partners.id — stable and unique across both shapes. */
  id: string;
  kind: 'conference' | 'company';
  /** The name shown under the logo: a conference's acronym, a company's name. */
  name: string;
  /** Spelled-out conference name, shown small beneath the acronym in the popup
   *  (UI RULES → long names show the acronym with the full name underneath).
   *  Null for companies, and null when it would just repeat `name`. */
  fullName: string | null;
  logoUrl: string | null;
  /** Companies only. Conference partners have no description of their own —
   *  the popup links through to their page instead of showing an empty box. */
  description: string | null;
  /** /conferences/{slug} for a conference partner, null for a company. */
  href: string | null;
  /** "City, Country" for a conference partner, if known. */
  location: string | null;
}

/** Content column is max-width 1200; the rail only floats when the leftover
 *  gutter can hold it without overlapping that column. */
const CONTENT_MAX = 1200;
const RAIL_W = 104;
const RAIL_GAP = 16;
const FLOAT_MIN_WIDTH = CONTENT_MAX + 2 * (RAIL_W + RAIL_GAP);

const POP_W = 288;

/** Scroll depth, in px, past which the floating rail appears. Roughly the
 *  height of the full-bleed hero + stat strip on a desktop viewport. */
const SHOW_RAIL_AFTER = 300;

// ── Popup ───────────────────────────────────────────────────────────────────

function PartnerPopup({
  entry, anchor, onClose,
}: {
  entry: PartnerEntry;
  /** The element the popup is measured from. Kept as an element rather than a
   *  cached rect so scrolling can re-measure instead of drifting. */
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement | null>(null);

  /** Position is written straight onto the node rather than held in state:
   *  scroll fires this on every frame, and a re-render per frame to move a
   *  fixed box would be pure waste. It also keeps placement out of React's
   *  commit order, so the popup is never painted at 0,0 first. */
  const place = useCallback(() => {
    const pop = popRef.current;
    if (!pop) return;
    const r = anchor.getBoundingClientRect();
    // The anchor can vanish under us (the rail and the inline strip swap at a
    // media-query breakpoint, so a resize can hide the button that opened this).
    if (r.width === 0 && r.height === 0) { onClose(); return; }
    const w = pop.offsetWidth || POP_W;
    const h = pop.offsetHeight || 200;
    const pad = 12;

    // Preferred side is to the RIGHT of the trigger (the rail hugs the left
    // edge). Flip to the left when the popup would run off the right edge,
    // then clamp so it can never leave the viewport either way.
    let left = r.right + 12;
    if (left + w > window.innerWidth - pad) left = r.left - 12 - w;
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));

    // Vertically centred on the trigger, clamped into view.
    let top = r.top + r.height / 2 - h / 2;
    top = Math.max(pad, Math.min(top, window.innerHeight - h - pad));

    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    pop.style.visibility = 'visible';
  }, [anchor, onClose]);

  /** Placement has to happen the moment the node exists, and a layout effect is
   *  NOT that moment: `Portal` resolves its mount target in an effect of its
   *  own, so on the first commit it renders nothing at all and this component's
   *  layout effect would run against a null ref — measured once, never again,
   *  and the popup stayed invisible at 0,0. A callback ref fires when the node
   *  actually attaches, whenever that turns out to be. */
  const attachPop = useCallback((node: HTMLDivElement | null) => {
    popRef.current = node;
    if (node) place();
  }, [place]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    // Capture phase: the trigger may live inside a scrolling ancestor whose
    // scroll events never reach window in the bubble phase.
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, onClose, place]);

  const meta = entry.kind === 'company' ? 'PARTNER' : 'PARTNER CONFERENCE';

  return (
    <Portal>
      <div
        ref={attachPop}
        role="dialog"
        aria-label={entry.name}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          // Hidden until `place` has measured it, so the pre-placement frame in
          // the corner is never seen.
          visibility: 'hidden',
          zIndex: 9999,
          width: POP_W,
          maxWidth: 'calc(100vw - 24px)',
          backgroundColor: '#FAF8F3',
          backgroundImage: 'linear-gradient(135deg, rgba(238,217,138,0.18) 0%, rgba(238,217,138,0) 62%)',
          border: '1px solid rgba(238,217,138,0.9)',
          borderRadius: 20,
          boxShadow: '0 18px 46px rgba(27,56,40,0.22)',
          padding: 18,
          animation: `partnerPopIn 180ms ${EASE}`,
        }}
      >
        <style>{`@keyframes partnerPopIn { from { opacity: 0; transform: translateY(-6px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>

        <div className="flex items-center gap-3">
          <LogoDisc src={entry.logoUrl} alt={entry.name} size={52} fallbackText={entry.name.slice(0, 3)} />
          <div className="min-w-0">
            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
              {meta}
            </p>
            <p
              className="truncate"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 16, color: '#1C1410', margin: '2px 0 0 0', letterSpacing: '0.01em' }}
            >
              {entry.name}
            </p>
            {/* Long conference names show the acronym above and the spelled-out
                name small beneath it, never the other way round. */}
            {entry.fullName && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 11, color: '#9A8A78', margin: '1px 0 0 0', lineHeight: 1.35 }}>
                {entry.fullName}
              </p>
            )}
          </div>
        </div>

        {/* Only what exists gets a row. A conference partner has no description
            of its own, so it gets its location and a way through to its page
            rather than an empty panel. */}
        {entry.description && (
          <p
            style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 13, lineHeight: 1.7,
              color: '#3B342C', margin: '14px 0 0 0', whiteSpace: 'pre-wrap',
            }}
          >
            {entry.description}
          </p>
        )}

        {!entry.description && entry.location && (
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: '#9A8A78', margin: '12px 0 0 0' }}>
            {entry.location}
          </p>
        )}

        {entry.href && (
          <Link
            href={entry.href}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 mt-4 rounded-full px-3.5 py-2 focus:outline-none"
            style={{
              backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
              transition: `background-color 200ms ${EASE}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            VIEW CONFERENCE
            <ArrowRight size={12} strokeWidth={2.6} />
          </Link>
        )}
      </div>
    </Portal>
  );
}

// ── Partner button (logo + name) ────────────────────────────────────────────

function PartnerButton({
  entry, onOpen, floating,
}: {
  entry: PartnerEntry;
  onOpen: (entry: PartnerEntry, el: HTMLElement) => void;
  /** The floating rail stacks logo-over-name; the inline strip sits them in a
   *  row, where horizontal space is what is spare. */
  floating: boolean;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => { if (ref.current) onOpen(entry, ref.current); }}
      aria-haspopup="dialog"
      className={floating ? 'flex flex-col items-center gap-1.5' : 'flex items-center gap-3 flex-shrink-0'}
      style={{
        background: 'transparent',
        border: 'none',
        padding: floating ? '8px 4px' : '6px 10px 6px 6px',
        borderRadius: floating ? 16 : 999,
        cursor: 'pointer',
        width: floating ? '100%' : undefined,
        maxWidth: floating ? undefined : 240,
        transition: `transform 240ms ${EASE}, background-color 240ms ${EASE}`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-2px)';
        el.style.backgroundColor = 'rgba(238,217,138,0.18)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'none';
        el.style.backgroundColor = 'transparent';
      }}
    >
      <LogoDisc src={entry.logoUrl} alt={entry.name} size={floating ? 46 : 42} fallbackText={entry.name.slice(0, 3)} />
      <span
        className={floating ? undefined : 'truncate'}
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800,
          fontSize: floating ? 10.5 : 13,
          lineHeight: floating ? 1.25 : undefined,
          letterSpacing: '0.02em',
          color: '#1C1410',
          maxWidth: '100%',
          textAlign: floating ? 'center' : 'left',
          // The rail is only ~104px wide, so a company name gets two lines
          // before it is cut — truncating "Verification Test Co" to one line
          // leaves barely a word.
          ...(floating
            ? { display: '-webkit-box', WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: 2, overflow: 'hidden', wordBreak: 'break-word' as const }
            : null),
        }}
      >
        {entry.name}
      </span>
    </button>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

export default function ConferencePartners({ partners }: { partners: PartnerEntry[] }) {
  const [open, setOpen] = useState<{ entry: PartnerEntry; anchor: HTMLElement } | null>(null);

  // The rail is fixed and vertically centred, but the hero above the content is
  // FULL-BLEED — its title runs edge to edge, so at the top of the page the
  // rail would sit on top of the conference's own name. It therefore only
  // appears once the reader has scrolled past the hero, where the page has
  // narrowed to the 1200px column and the gutter is genuinely empty.
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > SHOW_RAIL_AFTER;
      setPastHero(past);
      // Scrolling back up hides the rail; an open popup anchored to it would
      // otherwise hang in space beside nothing.
      if (!past) setOpen(null);
    };
    // Deferred rather than called inline: a restored scroll position should
    // still light the rail up, but a synchronous setState in an effect body is
    // a cascading render (and a lint error).
    const raf = requestAnimationFrame(onScroll);
    // Capture phase, like every other scroll listener in this codebase: it also
    // catches scrolls from a nested scroll container, should the page ever grow
    // one between the rail and the window.
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  // A partner can disappear under an open popup (the page refetches, the
  // organiser removes one). Derive the live entry instead of syncing state in
  // an effect: if it is gone, the popup simply stops rendering.
  const active = open && partners.some(p => p.id === open.entry.id) ? open : null;

  if (partners.length === 0) return null;

  const heading = (
    <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
      PARTNERS
    </p>
  );

  const onOpen = (entry: PartnerEntry, el: HTMLElement) =>
    setOpen(prev => (prev?.entry.id === entry.id ? null : { entry, anchor: el }));

  return (
    <>
      {/* Which of the two placements shows is a pure media-query decision, not
          React state: measuring the viewport in an effect would render the
          wrong one for a frame on every load, and re-render the whole section
          on every resize tick. Both are in the DOM; CSS picks one. */}
      <style>{`
        .gv-partner-rail { display: none; }
        .gv-partner-inline { display: block; }
        @media (min-width: ${FLOAT_MIN_WIDTH}px) {
          .gv-partner-rail { display: block; }
          .gv-partner-inline { display: none; }
        }
      `}</style>

      {/* Portaled to the body for the same reason the popup is: this section is
          rendered from inside the tab pane, which animates with a transform on
          tab switches, and a transformed ancestor becomes the containing block
          for position:fixed — the rail would ride the slide instead of staying
          put. Portaling puts it beside the page, where it belongs. */}
      <Portal>
        <aside
          className="gv-partner-rail"
          aria-hidden={!pastHero}
          aria-label="Partners"
          style={{
            position: 'fixed',
            left: RAIL_GAP,
            top: '50%',
            width: RAIL_W,
            // Long partner lists scroll inside the rail rather than growing off
            // screen. The popup is portaled, so this never clips it.
            maxHeight: '72vh',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            zIndex: 30,
            backgroundColor: 'rgba(250,248,243,0.86)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(238,217,138,0.85)',
            borderRadius: 22,
            boxShadow: '0 14px 38px rgba(182,135,31,0.18)',
            padding: '14px 8px',
            opacity: pastHero ? 1 : 0,
            // Not just invisible: an opacity-0 rail must not eat clicks aimed
            // at the hero underneath it. `aria-hidden` below is the same point
            // for assistive tech — opacity:0 still reads, unlike the
            // display:none the media query uses for the other variant, so
            // without it a screen reader announces the whole partner list
            // before it has visually appeared.
            pointerEvents: pastHero ? 'auto' : 'none',
            transform: pastHero ? 'translateY(-50%)' : 'translateY(-50%) translateX(-8px)',
            transition: `opacity 320ms ${EASE}, transform 320ms ${EASE}`,
          }}
        >
          <div className="flex justify-center mb-2">{heading}</div>
          <div className="flex flex-col items-center gap-1">
            {partners.map(p => (
              <PartnerButton key={p.id} entry={p} onOpen={onOpen} floating />
            ))}
          </div>
        </aside>
      </Portal>

      <div className="gv-partner-inline mb-6">
        <div className="mb-3">{heading}</div>
        <div
          className="flex flex-wrap gap-2 rounded-[20px]"
          style={{
            backgroundColor: '#FAF8F3',
            backgroundImage: 'linear-gradient(135deg, rgba(238,217,138,0.16) 0%, rgba(238,217,138,0) 60%)',
            border: '1px solid rgba(238,217,138,0.9)',
            boxShadow: '0 10px 30px rgba(182,135,31,0.16)',
            padding: 10,
          }}
        >
          {partners.map(p => (
            <PartnerButton key={p.id} entry={p} onOpen={onOpen} floating={false} />
          ))}
        </div>
      </div>

      {active && (
        <PartnerPopup entry={active.entry} anchor={active.anchor} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
