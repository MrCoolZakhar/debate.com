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
// organiser wrote lives behind a click, in a small popup, so the strip stays a
// quiet band of marks rather than a second column of prose.
//
// Placement: always inline, in the page flow. This used to also float as a
// fixed rail in the left gutter on wide screens, but the gutter it assumed was
// free is not: the Overview tab's committee slider is full bleed (100vw with
// negative margins), so it spans the entire viewport including both gutters,
// and the rail painted straight over it. There is no free gutter at any width,
// so the floating variant is gone; this always renders inline.
//
// The popup follows the house popover rule (AGENTS.md → UI RULES): rendered
// through Portal at fixed viewport coordinates measured from the trigger, so no
// ancestor's overflow can clip it; flipped to the other side of the trigger
// near the viewport edge; clamped vertically; closed on outside click, Escape
// and repositioned on scroll (capture) + resize.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';
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
  /** Renders larger, first, and with a star. Companies only in practice: the
   *  editor only offers the toggle on a company row, since a linked
   *  conference's logo and page belong to the other team. */
  featured: boolean;
  /** A company's own site, set by the organiser. When present the logo itself
   *  links out and the popup opens from the name instead (an anchor cannot
   *  nest inside the popup's button trigger). Conferences use `href` instead
   *  and never carry this. */
  websiteUrl: string | null;
}

const POP_W = 288;

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
    // The anchor can vanish under us (a refetch can remove the partner that
    // opened this popup while it's still open).
    if (r.width === 0 && r.height === 0) { onClose(); return; }
    const w = pop.offsetWidth || POP_W;
    const h = pop.offsetHeight || 200;
    const pad = 12;

    // Preferred side is to the RIGHT of the trigger. Flip to the left when
    // the popup would run off the right edge, then clamp so it can never
    // leave the viewport either way.
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
          backgroundColor: 'var(--gv-surface)',
          backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--gv-accent) 18%, transparent) 0%, color-mix(in srgb, var(--gv-accent) 0%, transparent) 62%)',
          border: '1px solid color-mix(in srgb, var(--gv-accent) 90%, transparent)',
          borderRadius: 20,
          boxShadow: '0 18px 46px color-mix(in srgb, var(--gv-main) 22%, transparent)',
          padding: 18,
          animation: `partnerPopIn 180ms ${EASE}`,
        }}
      >
        <style>{`@keyframes partnerPopIn { from { opacity: 0; transform: translateY(-6px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>

        <div className="flex items-center gap-3">
          <LogoDisc src={entry.logoUrl} alt={entry.name} size={52} fallbackText={entry.name.slice(0, 3)} />
          <div className="min-w-0">
            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: 'var(--gv-accent)', margin: 0 }}>
              {meta}
            </p>
            <p
              className="truncate"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 16, color: 'var(--gv-on-surface)', margin: '2px 0 0 0', letterSpacing: '0.01em' }}
            >
              {entry.name}
            </p>
            {/* Long conference names show the acronym above and the spelled-out
                name small beneath it, never the other way round. */}
            {entry.fullName && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--gv-muted)', margin: '1px 0 0 0', lineHeight: 1.35 }}>
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
              color: 'var(--gv-on-surface)', margin: '14px 0 0 0', whiteSpace: 'pre-wrap',
            }}
          >
            {entry.description}
          </p>
        )}

        {!entry.description && entry.location && (
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: 'var(--gv-muted)', margin: '12px 0 0 0' }}>
            {entry.location}
          </p>
        )}

        {entry.href && (
          <Link
            href={entry.href}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 mt-4 rounded-full px-3.5 py-2 focus:outline-none"
            style={{
              backgroundColor: 'var(--gv-main)', color: 'var(--gv-on-main)', textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
              transition: `background-color 200ms ${EASE}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--gv-main-mid)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--gv-main)'; }}
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
  entry, onOpen,
}: {
  entry: PartnerEntry;
  onOpen: (entry: PartnerEntry, el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const discSize = entry.featured ? 56 : 42;

  const disc = (
    <span className="relative inline-flex flex-shrink-0">
      <LogoDisc
        src={entry.logoUrl}
        alt={entry.name}
        size={discSize}
        fallbackText={entry.name.slice(0, 3)}
        // Merged last by LogoDisc, so this replaces its default hairline rim
        // with the conference's own accent, not the house gold — the ring is
        // the one thing the theme owns, not the brand.
        style={entry.featured ? { border: '1.5px solid var(--gv-accent)' } : undefined}
      />
      {entry.featured && (
        <span
          aria-hidden
          className="absolute flex items-center justify-center"
          style={{
            top: -2,
            right: -2,
            width: 20,
            height: 20,
            borderRadius: 9999,
            backgroundColor: 'var(--gv-surface)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}
        >
          <Star size={11} strokeWidth={2.4} fill="var(--gv-accent)" color="var(--gv-accent)" />
        </span>
      )}
    </span>
  );

  const name = (
    <span
      className="truncate"
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: '0.02em',
        color: 'var(--gv-on-surface)',
        maxWidth: '100%',
        textAlign: 'left',
      }}
    >
      {entry.name}
    </span>
  );

  const hoverIn = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.transform = 'translateY(-2px)';
    el.style.backgroundColor = 'color-mix(in srgb, var(--gv-accent) 18%, transparent)';
  };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.transform = 'none';
    el.style.backgroundColor = 'transparent';
  };

  // A partner with a website: the logo itself is a link out, and the popup
  // (which only ever held the description/location) opens from the name
  // instead. An anchor cannot nest inside the button that used to wrap both,
  // and shouldn't: it would break keyboard behaviour.
  if (entry.websiteUrl) {
    return (
      <div
        className="flex items-center gap-3 flex-shrink-0"
        style={{
          padding: '6px 10px 6px 6px',
          borderRadius: 999,
          maxWidth: 240,
          transition: `transform 240ms ${EASE}, background-color 240ms ${EASE}`,
        }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        <a
          href={entry.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={entry.name}
          style={{ display: 'inline-flex', flexShrink: 0 }}
        >
          {disc}
        </a>
        <button
          ref={ref}
          type="button"
          onClick={() => { if (ref.current) onOpen(entry, ref.current); }}
          aria-haspopup="dialog"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            maxWidth: 200,
          }}
        >
          {name}
        </button>
      </div>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => { if (ref.current) onOpen(entry, ref.current); }}
      aria-haspopup="dialog"
      className="flex items-center gap-3 flex-shrink-0"
      style={{
        background: 'transparent',
        border: 'none',
        padding: '6px 10px 6px 6px',
        borderRadius: 999,
        cursor: 'pointer',
        maxWidth: 240,
        transition: `transform 240ms ${EASE}, background-color 240ms ${EASE}`,
      }}
      onMouseEnter={hoverIn}
      onMouseLeave={hoverOut}
    >
      {disc}
      {name}
    </button>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

export default function ConferencePartners({ partners }: { partners: PartnerEntry[] }) {
  const [open, setOpen] = useState<{ entry: PartnerEntry; anchor: HTMLElement } | null>(null);

  // A partner can disappear under an open popup (the page refetches, the
  // organiser removes one). Derive the live entry instead of syncing state in
  // an effect: if it is gone, the popup simply stops rendering.
  const active = open && partners.some(p => p.id === open.entry.id) ? open : null;

  if (partners.length === 0) return null;

  // Featured first, then sort_order, then name. PartnerEntry doesn't carry
  // sort_order itself: the array already arrives in that order (the editor's
  // query is `.order('sort_order')`), so the original index is that column's
  // stand-in and a plain featured-only sort would land on the same result.
  // Spelled out as three levels anyway, so a future caller that hands in an
  // unordered array still gets the right answer.
  const ordered = partners
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.featured !== b.entry.featured) return a.entry.featured ? -1 : 1;
      if (a.index !== b.index) return a.index - b.index;
      return a.entry.name.localeCompare(b.entry.name);
    })
    .map(({ entry }) => entry);

  const heading = (
    <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: 'var(--gv-accent)', margin: 0 }}>
      PARTNERS
    </p>
  );

  const onOpen = (entry: PartnerEntry, el: HTMLElement) =>
    setOpen(prev => (prev?.entry.id === entry.id ? null : { entry, anchor: el }));

  return (
    <>
      <div className="mb-6">
        <div className="mb-3">{heading}</div>
        <div
          className="flex flex-wrap gap-2 rounded-[20px]"
          style={{
            backgroundColor: 'var(--gv-surface)',
            backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--gv-accent) 16%, transparent) 0%, color-mix(in srgb, var(--gv-accent) 0%, transparent) 60%)',
            border: '1px solid color-mix(in srgb, var(--gv-accent) 90%, transparent)',
            boxShadow: '0 10px 30px color-mix(in srgb, var(--gv-accent) 16%, transparent)',
            padding: 10,
          }}
        >
          {ordered.map(p => (
            <PartnerButton key={p.id} entry={p} onOpen={onOpen} />
          ))}
        </div>
      </div>

      {active && (
        <PartnerPopup entry={active.entry} anchor={active.anchor} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
