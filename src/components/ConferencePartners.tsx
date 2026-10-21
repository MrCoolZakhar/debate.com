'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ConferencePartners: the partner data shape, its order and the partner pop-up
// on a public conference page.
//
// A partner is one of two things (see the `conference_partners` table and its
// `conference_partners_one_shape` check constraint):
//
//   • another Gavelling conference, linked by id and mutually approved;
//   • a company the organiser typed in themselves: name, logo, description.
//
// Where partners show (owner, 21 Oct 2026): as small circles on the rim of the
// conference's round logo in the page header, drawn by `PartnerOrbit.tsx`. The
// old inline strip (logo + name buttons in a card in the Overview) is gone;
// this file keeps only what the orbit reuses:
//
//   • `PartnerEntry`, the one display shape the page's loader builds;
//   • `orderPartners`, featured first, then the organiser's sort order;
//   • `PartnerPopup`, the pop-up a circle opens. It shows one partner (logo,
//     name, full name beneath, description or location, View conference,
//     Visit website), or, from the orbit's "+N" circle, the full list. Picking
//     a partner in the list REPLACES the list with that partner and a back
//     button (a pop-up never opens another pop-up on top of itself).
//
// The pop-up follows the house popover rule (AGENTS.md → UI RULES): rendered
// through Portal at fixed viewport coordinates measured from the trigger, so no
// ancestor's overflow can clip it; flipped to the other side of the trigger
// near the viewport edge; clamped vertically and scrolling itself when taller
// than the viewport; closed on outside click and Escape; repositioned on
// scroll (capture) + resize and whenever its content changes.
//
// Colours are the conference's own theme variables (var(--gv-main) and
// friends), never Gavelling forest or gold. Names are never cut: they wrap.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ExternalLink } from 'lucide-react';
import Portal from '@/components/Portal';
import { LogoDisc } from '@/components/LogoDisc';

const EASE = 'cubic-bezier(0.22,1,0.36,1)';
const FONT = 'var(--font-brand), sans-serif';

export interface PartnerEntry {
  /** conference_partners.id, stable and unique across both shapes. */
  id: string;
  kind: 'conference' | 'company';
  /** The primary label: a conference's acronym, a company's name. */
  name: string;
  /** Spelled-out conference name, shown small beneath the acronym in the popup
   *  (UI RULES → long names show the acronym with the full name underneath).
   *  Null for companies, and null when it would just repeat `name`. */
  fullName: string | null;
  logoUrl: string | null;
  /** Companies only. Conference partners have no description of their own:
   *  the popup links through to their page instead of showing an empty box. */
  description: string | null;
  /** /conferences/{slug} for a conference partner, null for a company. */
  href: string | null;
  /** "City, Country" for a conference partner, if known. */
  location: string | null;
  /** Sorts first. Companies only in practice: the editor only offers the
   *  toggle on a company row, since a linked conference's logo and page
   *  belong to the other team. */
  featured: boolean;
  /** A company's own site, set by the organiser; the popup offers Visit
   *  website. Conferences use `href` instead and never carry this. */
  websiteUrl: string | null;
}

/** Featured first, then sort_order, then name. PartnerEntry doesn't carry
 *  sort_order itself: the array already arrives in that order (the loader's
 *  query is `.order('sort_order')`), so the original index is that column's
 *  stand-in. Spelled out as three levels so an unordered array still sorts
 *  right. */
export function orderPartners(partners: PartnerEntry[]): PartnerEntry[] {
  return partners
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.featured !== b.entry.featured) return a.entry.featured ? -1 : 1;
      if (a.index !== b.index) return a.index - b.index;
      return a.entry.name.localeCompare(b.entry.name);
    })
    .map(({ entry }) => entry);
}

const POP_W = 288;

// ── One partner ─────────────────────────────────────────────────────────────

function PartnerDetail({ entry, onClose }: { entry: PartnerEntry; onClose: () => void }) {
  const meta = entry.kind === 'company' ? 'PARTNER' : 'PARTNER CONFERENCE';
  return (
    <>
      <div className="flex items-center gap-3">
        <LogoDisc src={entry.logoUrl} alt={entry.name} size={52} fallbackText={entry.name.slice(0, 3)} />
        <div className="min-w-0">
          <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: 'var(--gv-accent)', margin: 0 }}>
            {meta}
          </p>
          <p
            style={{
              fontFamily: FONT, fontWeight: 800, fontSize: 16, color: 'var(--gv-on-surface)', margin: '2px 0 0 0', letterSpacing: '0.01em',
              overflowWrap: 'anywhere', lineHeight: 1.25,
            }}
          >
            {entry.name}
          </p>
          {/* Long conference names show the acronym above and the spelled-out
              name small beneath it, never the other way round. */}
          {entry.fullName && (
            <p style={{ fontFamily: FONT, fontWeight: 600, fontSize: 11, color: 'var(--gv-muted)', margin: '1px 0 0 0', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
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
            fontFamily: FONT, fontSize: 13, lineHeight: 1.7,
            color: 'var(--gv-on-surface)', margin: '14px 0 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          }}
        >
          {entry.description}
        </p>
      )}

      {!entry.description && entry.location && (
        <p style={{ fontFamily: FONT, fontSize: 12, color: 'var(--gv-muted)', margin: '12px 0 0 0' }}>
          {entry.location}
        </p>
      )}

      {(entry.href || entry.websiteUrl) && (
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {entry.href && (
            <Link
              href={entry.href}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 focus:outline-none"
              style={{
                backgroundColor: 'var(--gv-main)', color: 'var(--gv-on-main)', textDecoration: 'none',
                fontFamily: FONT, fontWeight: 700, fontSize: 12,
                transition: `background-color 200ms ${EASE}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--gv-main-mid)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--gv-main)'; }}
            >
              View conference
              <ArrowRight size={12} strokeWidth={2.2} />
            </Link>
          )}
          {entry.websiteUrl && (
            <a
              href={entry.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 focus:outline-none"
              style={{
                border: '1px solid var(--gv-main)', color: 'var(--gv-main)', textDecoration: 'none',
                fontFamily: FONT, fontWeight: 700, fontSize: 12,
                transition: `background-color 200ms ${EASE}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--gv-main) 8%, transparent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <ExternalLink size={12} strokeWidth={1.5} />
              Visit website
            </a>
          )}
        </div>
      )}
    </>
  );
}

// ── The full list (the orbit's "+N") ────────────────────────────────────────

function PartnerList({ entries, onPick }: { entries: PartnerEntry[]; onPick: (entry: PartnerEntry) => void }) {
  return (
    <>
      <p style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: 'var(--gv-on-surface)', margin: '0 0 8px 0' }}>
        Partners
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {entries.map(p => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="w-full flex items-center gap-3 rounded-[14px] text-left focus:outline-none"
              style={{ background: 'transparent', border: 'none', padding: '6px 8px', cursor: 'pointer', transition: `background-color 200ms ${EASE}` }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--gv-accent) 16%, transparent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <LogoDisc src={p.logoUrl} alt="" size={36} fallbackText={p.name.slice(0, 3)} />
              <span className="min-w-0 flex flex-col">
                <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: 'var(--gv-on-surface)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                  {p.name}
                </span>
                {p.fullName && (
                  <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 11, color: 'var(--gv-muted)', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                    {p.fullName}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Popup ───────────────────────────────────────────────────────────────────

export function PartnerPopup({
  entries, startWith, anchor, onClose,
}: {
  /** Every partner, already ordered: the list view shows them in this order. */
  entries: PartnerEntry[];
  /** One partner to show, or null to open on the full list. */
  startWith: PartnerEntry | null;
  /** The element the popup is measured from. Kept as an element rather than a
   *  cached rect so scrolling can re-measure instead of drifting. */
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement | null>(null);
  // The partner shown from the list; null = the list itself. A popup opened
  // on one partner never shows the list (no back button there).
  const [picked, setPicked] = useState<PartnerEntry | null>(null);
  const fromList = startWith === null;
  const shown = startWith ?? (picked && entries.some(p => p.id === picked.id) ? picked : null);

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
   *  own, so on the first commit it renders nothing at all and a layout effect
   *  would run against a null ref. A callback ref fires when the node actually
   *  attaches, whenever that turns out to be. */
  const attachPop = useCallback((node: HTMLDivElement | null) => {
    popRef.current = node;
    if (node) place();
  }, [place]);

  // List → partner → back changes the popup's height: measure again. (On the
  // first commit the ref is still null and this is a no-op; attachPop covers it.)
  useLayoutEffect(() => { place(); }, [shown, place]);

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

  return (
    <Portal>
      <div
        ref={attachPop}
        role="dialog"
        data-partner-pop=""
        aria-label={shown ? shown.name : 'Partners'}
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
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          backgroundColor: 'var(--gv-surface)',
          backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--gv-accent) 18%, transparent) 0%, color-mix(in srgb, var(--gv-accent) 0%, transparent) 62%)',
          border: '1px solid color-mix(in srgb, var(--gv-accent) 90%, transparent)',
          borderRadius: 20,
          boxShadow: '0 18px 46px color-mix(in srgb, var(--gv-main) 22%, transparent)',
          padding: 18,
          animation: `partnerPopIn 180ms ${EASE}`,
        }}
      >
        <style>{`@keyframes partnerPopIn { from { opacity: 0; transform: translateY(-6px) scale(0.985); } to { opacity: 1; transform: none; } } @media (prefers-reduced-motion: reduce) { [role="dialog"][data-partner-pop] { animation: none !important; } }`}</style>

        {shown ? (
          <>
            {fromList && (
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex items-center gap-1 mb-3 focus:outline-none"
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 12, color: 'var(--gv-main)' }}
              >
                <ChevronLeft size={14} strokeWidth={1.5} />
                All partners
              </button>
            )}
            <PartnerDetail entry={shown} onClose={onClose} />
          </>
        ) : (
          <PartnerList entries={entries} onPick={setPicked} />
        )}
      </div>
    </Portal>
  );
}
