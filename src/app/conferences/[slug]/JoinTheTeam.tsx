'use client';

// Join the Team (Job Board prompt 4): this conference's live Job Board
// listings on its public page, drawn in the CONFERENCE's own colours (its
// theme variables), never Gavelling forest or gold, so /jobs's JobCard is not
// reused here. Read once on mount, keyed on the conference id; nothing
// renders until the read answers, and nothing at all when there are none.
// Every button goes to /jobs?listing=<id>: the screening runs there, and the
// card shape from job_conference_listings carries no outside_url, so an
// outside listing's own site is reached from the listing itself.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { fetchConferenceListings, fetchJobListing, jobOfferChips, jobAppliesOutside, recordJobEvent, JOB_ROLE_LABEL, type JobCard } from '@/lib/jobBoard';
import { CONF_BUTTON_CSS } from './participant/dashboardKit';

const FONT = "var(--font-brand), sans-serif";
const ACCENT_INK = 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)';

export default function JoinTheTeam({ conferenceId }: { conferenceId: string }) {
  const [listings, setListings] = useState<{ conf: string; items: JobCard[] } | null>(null);
  // Outside and premium cards carry no link of their own: each one's listing
  // is read once so "Apply on their site" can open the site inside the click
  // (a new tab can only open there).
  const [links, setLinks] = useState<Record<string, { url: string | null; premiumApply: string | null }>>({});

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

  const items = listings && listings.conf === conferenceId ? listings.items : [];
  if (items.length === 0) return null;

  return (
    <section className="mb-6" aria-labelledby="join-the-team-title">
      <style>{CONF_BUTTON_CSS}</style>
      <h2
        id="join-the-team-title"
        className="text-[19px] sm:text-[21px] font-bold"
        style={{ color: 'var(--gv-on-surface)', fontFamily: FONT, margin: '0 0 14px 0', letterSpacing: '-0.01em' }}
      >
        Join the Team
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
        {items.map((card) => <TeamCard key={card.id} card={card} link={links[card.id] ?? null} />)}
      </ul>
    </section>
  );
}

function TeamCard({ card, link }: { card: JobCard; link: { url: string | null; premiumApply: string | null } | null }) {
  const chips = jobOfferChips(card.offers);
  // premium_apply comes from the listing's own read (the card has none); until
  // it lands, a premium listing reads as a Gavelling one and links to /jobs.
  const outside = jobAppliesOutside({ kind: card.kind, premium_apply: link?.premiumApply ?? null });
  const outsideUrl = outside ? link?.url ?? null : null;
  const href = `/jobs?listing=${encodeURIComponent(card.id)}`;
  const roleLine = [JOB_ROLE_LABEL[card.role], card.committee].filter(Boolean).join(' · ');

  return (
    <li className="min-w-0">
      <div
        className="h-full flex flex-col gap-3 rounded-[20px] p-5"
        style={{
          backgroundColor: 'var(--gv-surface)',
          border: '1px solid var(--gv-border)',
          boxShadow: '0 10px 30px color-mix(in srgb, var(--gv-main) 8%, transparent)',
        }}
      >
        {card.promoted && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: ACCENT_INK, fontFamily: FONT }}>
            <Star size={12} strokeWidth={2.2} style={{ color: 'var(--gv-accent)', fill: 'var(--gv-accent)' }} aria-hidden />
            Promoted
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[16px] font-bold leading-snug [overflow-wrap:anywhere]" style={{ color: 'var(--gv-on-surface)', fontFamily: FONT, margin: 0 }}>
            {card.title}
          </p>
          {roleLine && (
            <p className="mt-1 text-[13px] font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--gv-muted)', fontFamily: FONT, margin: '4px 0 0 0' }}>
              {roleLine}
            </p>
          )}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold [overflow-wrap:anywhere]"
                style={{ color: 'var(--gv-main)', backgroundColor: 'color-mix(in srgb, var(--gv-main-light) 16%, transparent)', fontFamily: FONT }}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}
        {card.urgency && (
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--gv-on-surface)', fontFamily: FONT, margin: 0 }}>
            {card.urgency}
          </p>
        )}
        <div className="mt-auto pt-1">
          {outsideUrl ? (
            <button
              type="button"
              onClick={() => { recordJobEvent(card.id, 'click'); window.open(outsideUrl, '_blank', 'noopener,noreferrer'); }}
              className="gv-cf-main gv-lift inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-[13.5px] font-bold focus:outline-none border-0 cursor-pointer"
              style={{ fontFamily: FONT }}
            >
              Apply on their site
            </button>
          ) : (
            <Link
              href={href}
              className="gv-cf-main gv-lift inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-[13.5px] font-bold focus:outline-none"
              style={{ fontFamily: FONT, textDecoration: 'none' }}
            >
              {outside ? 'Apply on their site' : 'Apply'}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
