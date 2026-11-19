'use client';

// Join the Team (Job Board prompt 4): this conference's live Job Board
// listings on its public page, drawn in the CONFERENCE's own colours (its
// theme variables), never Gavelling forest or gold, so /jobs's JobCard is not
// reused here. Read once on mount, keyed on the conference id; nothing
// renders until the read answers, and nothing at all when there are none.
// Every button goes to /jobs?listing=<id>: the screening runs there, and the
// card shape from job_conference_listings carries no outside_url, so an
// outside listing's own site is reached from the listing itself.
//
// A carousel since 18 Nov 2026 (owner; ten big cards in rows of three were
// too much): the "More from {short}" model of /jobs, copied here rather than
// imported. Three compact cards at a time on a computer (fewer only when fewer
// exist), sliding by ONE and wrapping at the end, with round Previous and
// Next buttons on the row's sides, hidden with 3 or fewer. With more than 3
// it advances one card every 10 seconds, pausing on hover, on keyboard focus
// inside it and while the tab is hidden, never with prefers-reduced-motion;
// an arrow press restarts the 10 seconds. Phones get a swipe row, no arrows.
// Wrap-around: the track holds the list plus its first 3 again; sliding past
// the end lands on the copy and jumps back to the start with no transition.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Star } from 'lucide-react';
import { fetchConferenceListings, fetchJobListing, jobOfferChips, jobAppliesOutside, recordJobEvent, JOB_ROLE_LABEL, type JobCard } from '@/lib/jobBoard';
import { JobRoleGlyph } from '@/lib/jobRoleIcon';
import { formatConferenceDates, DATES_TO_BE_DECIDED } from '@/lib/conferenceDates';
import { CONF_BUTTON_CSS } from './participant/dashboardKit';

const FONT = "var(--font-brand), sans-serif";
const ACCENT_INK = 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)';
const VISIBLE = 3;
const GAP = 14;
const AUTO_MS = 10_000;
const MAX_CHIPS = 2;

type Links = Record<string, { url: string | null; premiumApply: string | null }>;

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

export default function JoinTheTeam({ conferenceId }: { conferenceId: string }) {
  const [listings, setListings] = useState<{ conf: string; items: JobCard[] } | null>(null);
  // Outside and premium cards carry no link of their own: each one's listing
  // is read once so "Apply on their site" can open the site inside the click
  // (a new tab can only open there).
  const [links, setLinks] = useState<Links>({});
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [restart, setRestart] = useState(0);
  const phone = useIsPhone();

  useEffect(() => {
    let cancelled = false;
    void fetchConferenceListings(conferenceId).then((items) => {
      if (cancelled) return;
      setListings({ conf: conferenceId, items });
      items.filter((c) => c.kind !== 'gavelling').forEach((c) => {
        void fetchJobListing(c.id).then((r) => {
          if (cancelled || !r.ok) return;
          setLinks((m) => ({ ...m, [c.id]: { url: r.listing.outside_url, premiumApply: r.listing.premium_apply } }));
        });
      });
    });
    return () => { cancelled = true; };
  }, [conferenceId]);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === 'hidden');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReduced(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      mq.removeEventListener('change', onMq);
    };
  }, []);

  const items = listings && listings.conf === conferenceId ? listings.items : [];
  const n = items.length;
  const sliding = !phone && n > VISIBLE;

  // One card every 10 s, restarted by every move and by an arrow press.
  useEffect(() => {
    if (!sliding || hovered || focused || hidden || reduced) return;
    const t = window.setTimeout(() => setIdx((i) => i + 1), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [sliding, hovered, focused, hidden, reduced, idx, restart]);

  // Back from the copy at the end with no transition, then motion again.
  useEffect(() => {
    if (animate) return;
    const t = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setAnimate(true)));
    return () => window.cancelAnimationFrame(t);
  }, [animate]);

  if (n === 0) return null;

  const track = sliding ? [...items, ...items.slice(0, VISIBLE)] : items;
  const onEnd = () => {
    if (idx >= n) { setAnimate(false); setIdx(idx - n); }
  };
  const next = () => {
    setRestart((r) => r + 1);
    if (reduced) { setIdx((i) => (i + 1) % n); return; }
    setIdx((i) => i + 1);
  };
  const prev = () => {
    setRestart((r) => r + 1);
    if (reduced) { setIdx((i) => (i - 1 + n) % n); return; }
    if (idx === 0) {
      // Jump to the copy without motion, then slide one back.
      setAnimate(false);
      setIdx(n);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => { setAnimate(true); setIdx(n - 1); }));
    } else {
      setIdx((i) => i - 1);
    }
  };

  const cardWidth = `calc((100% - ${GAP * (VISIBLE - 1)}px) / ${VISIBLE})`;

  return (
    <section
      className="mb-6"
      aria-labelledby="join-the-team-title"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
    >
      <style>{CONF_BUTTON_CSS}</style>
      <style>{CSS}</style>
      <h2
        id="join-the-team-title"
        className="text-[19px] sm:text-[21px] font-bold"
        style={{ color: 'var(--gv-on-surface)', fontFamily: FONT, margin: '0 0 14px 0', letterSpacing: '-0.01em' }}
      >
        Join the Team
      </h2>
      {phone ? (
        <ul className="gv-jt-swipe">
          {items.map((card) => (
            <li key={card.id} className="gv-jt-swipe-cell"><TeamCard card={card} link={links[card.id] ?? null} /></li>
          ))}
        </ul>
      ) : (
        <div className="gv-jt-row">
          {sliding && (
            <button type="button" className="gv-jt-arrow gv-jt-prev" onClick={prev} aria-label="Previous roles">
              <ChevronLeft size={20} strokeWidth={2.2} aria-hidden />
            </button>
          )}
          <div className="gv-jt-viewport">
            <ul
              className={`gv-jt-track${animate ? ' gv-jt-anim' : ''}`}
              style={{ gap: GAP, transform: sliding ? `translateX(calc(-${idx} * (${cardWidth} + ${GAP}px)))` : undefined }}
              onTransitionEnd={onEnd}
            >
              {track.map((card, i) => {
                const off = sliding && (i < idx || i >= idx + VISIBLE);
                return (
                  <li
                    key={`${card.id}-${i}`}
                    className="gv-jt-cell"
                    style={{ flex: `0 0 ${cardWidth}` }}
                    aria-hidden={off ? true : undefined}
                    inert={off ? true : undefined}
                  >
                    <TeamCard card={card} link={links[card.id] ?? null} />
                  </li>
                );
              })}
            </ul>
          </div>
          {sliding && (
            <button type="button" className="gv-jt-arrow gv-jt-next" onClick={next} aria-label="Next roles">
              <ChevronRight size={20} strokeWidth={2.2} aria-hidden />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function TeamCard({ card, link }: { card: JobCard; link: { url: string | null; premiumApply: string | null } | null }) {
  const all = jobOfferChips(card.offers);
  const chips = all.slice(0, MAX_CHIPS);
  const rest = all.length - chips.length;
  // premium_apply comes from the listing's own read (the card has none); until
  // it lands, a premium listing reads as a Gavelling one and links to /jobs.
  const outside = jobAppliesOutside({ kind: card.kind, premium_apply: link?.premiumApply ?? null });
  const outsideUrl = outside ? link?.url ?? null : null;
  const href = `/jobs?listing=${encodeURIComponent(card.id)}`;
  const conf = card.conference;
  const dates = conf.start_date ? formatConferenceDates(conf.start_date, conf.end_date, { style: 'dmy-end-year' }) : DATES_TO_BE_DECIDED;
  const roleLabel = JOB_ROLE_LABEL[card.role] ?? 'Role';

  return (
    <div className="gv-jt-card">
      {card.promoted && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: ACCENT_INK, fontFamily: FONT }}>
          <Star size={11} strokeWidth={2.2} style={{ color: 'var(--gv-accent)', fill: 'var(--gv-accent)' }} aria-hidden />
          Promoted
        </span>
      )}
      <div className="flex items-start gap-2 min-w-0">
        <span role="img" aria-label={roleLabel} style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--gv-main)', marginTop: 1 }}>
          <JobRoleGlyph role={card.role} size={16} />
        </span>
        <p className="text-[15px] font-bold leading-snug [overflow-wrap:anywhere]" style={{ color: 'var(--gv-on-surface)', fontFamily: FONT, margin: 0, minWidth: 0 }}>
          {card.title}
        </p>
      </div>
      {card.committee && (
        <p className="text-[12.5px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--gv-main)', fontFamily: FONT, margin: 0 }}>
          {card.committee}
        </p>
      )}
      <p className="text-[12.5px] font-medium" style={{ color: 'var(--gv-muted)', fontFamily: FONT, margin: 0, whiteSpace: 'nowrap' }}>
        {dates}
      </p>
      {(chips.length > 0 || card.urgency) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold [overflow-wrap:anywhere]"
              style={{ color: 'var(--gv-main)', backgroundColor: 'color-mix(in srgb, var(--gv-main-light) 16%, transparent)', fontFamily: FONT }}
            >
              {c.label}
            </span>
          ))}
          {rest > 0 && (
            <span
              aria-label={`${rest} more`}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ color: 'var(--gv-main)', backgroundColor: 'color-mix(in srgb, var(--gv-main-light) 16%, transparent)', fontFamily: FONT }}
            >
              +{rest}
            </span>
          )}
          {card.urgency && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: 'var(--gv-on-surface)', fontFamily: FONT }}>
              <Clock size={11} strokeWidth={2.4} aria-hidden />
              {card.urgency}
            </span>
          )}
        </div>
      )}
      <div className="mt-auto pt-1">
        {outsideUrl ? (
          <button
            type="button"
            onClick={() => { recordJobEvent(card.id, 'click'); window.open(outsideUrl, '_blank', 'noopener,noreferrer'); }}
            className="gv-cf-main gv-lift inline-flex items-center justify-center rounded-xl px-4 py-2 text-[13px] font-bold focus:outline-none border-0 cursor-pointer"
            style={{ fontFamily: FONT }}
          >
            Apply on their site
          </button>
        ) : (
          <Link
            href={href}
            className="gv-cf-main gv-lift inline-flex items-center justify-center rounded-xl px-4 py-2 text-[13px] font-bold focus:outline-none"
            style={{ fontFamily: FONT, textDecoration: 'none' }}
          >
            {outside ? 'Apply on their site' : 'Apply'}
          </Link>
        )}
      </div>
    </div>
  );
}

const CSS = `
.gv-jt-card{height:100%;width:100%;display:flex;flex-direction:column;gap:6px;min-width:0;border-radius:16px;padding:14px 16px;
  background-color:var(--gv-surface);border:1px solid var(--gv-border);box-shadow:0 8px 24px color-mix(in srgb, var(--gv-main) 8%, transparent)}
.gv-jt-row{position:relative}
.gv-jt-viewport{overflow:hidden;padding:4px 2px 10px;margin:-4px -2px -10px}
.gv-jt-track{list-style:none;margin:0;padding:0;display:flex;width:100%}
.gv-jt-anim{transition:transform 420ms cubic-bezier(0.22,1,0.36,1)}
.gv-jt-cell{display:flex;min-width:0}
.gv-jt-arrow{position:absolute;top:50%;z-index:2;width:40px;height:40px;margin-top:-20px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
  color:var(--gv-main);background:var(--gv-surface);border:1px solid var(--gv-border);box-shadow:0 4px 14px color-mix(in srgb, var(--gv-main) 18%, transparent)}
.gv-jt-arrow:hover{background:color-mix(in srgb, var(--gv-main-light) 12%, var(--gv-surface))}
.gv-jt-arrow:focus{outline:none}
.gv-jt-arrow:focus-visible{outline:2px solid var(--gv-main);outline-offset:2px}
.gv-jt-prev{left:6px}
.gv-jt-next{right:6px}
.gv-jt-swipe{list-style:none;margin:0 -4px;padding:4px 4px 10px;display:flex;gap:${GAP}px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.gv-jt-swipe::-webkit-scrollbar{display:none}
.gv-jt-swipe-cell{flex:0 0 min(78vw,290px);scroll-snap-align:start;display:flex}
@media (prefers-reduced-motion:reduce){.gv-jt-anim{transition:none}}
`;
