'use client';

// ── Who is behind a listing's numbers (prompt 72, 26 Nov 2026) ─────────────
//
// Opened from a listing row's funnel (Started or Applied). One pop-up (the
// Store shell, like the other Job Board pop-ups): the listing's title, three
// filters (Applied, Started, Not a match) with their numbers, and one row per
// person from job_listing_people: their avatar (opens their MUN CV), name,
// flag and when. An applied row links to the review in Team Applications;
// the others to their CV. Views and clicks are anonymous and never listed.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { CircleFlag } from '@/components/CircleFlag';
import { CvAvatar } from '@/app/conferences/[slug]/participant/delegation/leaderKit';
import { POSTING_CSS } from './PostingPopup';
import { dayLabel, jobListingPeople, type ListingPerson, type ListingPersonStage } from './jobsApi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

const GROUPS: { key: ListingPersonStage; label: string; when: string }[] = [
  { key: 'applied', label: 'Applied', when: 'Applied' },
  { key: 'started', label: 'Started', when: 'Started' },
  { key: 'not_a_match', label: 'Not a match', when: 'Not a match' },
];

export default function ListingPeoplePopup({ listingId, title, slug, initial, onClose }: {
  listingId: string;
  title: string;
  slug: string;
  initial: 'started' | 'applied';
  onClose: () => void;
}) {
  const [people, setPeople] = useState<ListingPerson[] | null>(null);
  const [err, setErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [group, setGroup] = useState<ListingPersonStage>(initial);

  useEffect(() => {
    let cancelled = false;
    void jobListingPeople(listingId).then((r) => {
      if (cancelled) return;
      if (r.ok) { setPeople(r.people); setErr(''); } else setErr(r.message);
    });
    return () => { cancelled = true; };
  }, [listingId, attempt]);

  const count = (k: ListingPersonStage) => (people ?? []).filter((p) => p.stage === k).length;
  const shown = (people ?? []).filter((p) => p.stage === group);
  const when = GROUPS.find((g) => g.key === group)?.when ?? '';

  return (
    <PurchaseShell tone="light" label={title} onClose={onClose} panelClass="gv-st-pop gv-jp gv-lpp" testId="job-listing-people">
      <style>{PURCHASE_CSS}{POSTING_CSS}{CSS}</style>
      <div className="gv-jp-col">
        <header className="gv-jp-head">
          <h2 className="gv-jp-title" style={{ marginTop: 0, overflowWrap: 'break-word' }}>{title}</h2>
        </header>

        <div className="gv-lpp-filters" role="group" aria-label="Show">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              aria-pressed={group === g.key}
              className={`gv-jp-offer${group === g.key ? ' gv-jp-offer-on' : ''}`}
              onClick={() => setGroup(g.key)}
            >
              {g.label} <span className="gv-lpp-n">{people ? count(g.key).toLocaleString('en-US') : ''}</span>
            </button>
          ))}
        </div>

        {err && !people ? (
          <p className="gv-jp-err gv-jp-err-block" role="alert">
            {err} <button type="button" className="gv-jp-a" onClick={() => { setErr(''); setAttempt((n) => n + 1); }}>Try again</button>
          </p>
        ) : !people ? (
          <ul className="gv-lpp-list" aria-busy="true" aria-label="Loading">
            {[0, 1, 2].map((i) => <li key={i} className="gv-lpp-skel" />)}
          </ul>
        ) : shown.length === 0 ? (
          <p className="gv-lpp-empty">No one yet</p>
        ) : (
          <ul className="gv-lpp-list">
            {shown.map((p) => (
              <li key={`${p.user_id}-${p.stage}`} className="gv-lpp-row">
                <CvAvatar userId={p.user_id} name={p.name ?? 'A Gavelling member'} url={p.avatar_url} size={44} />
                <div className="gv-lpp-id">
                  <p className="gv-lpp-name">
                    {p.name || 'A Gavelling member'}
                    {p.nationality && <CircleFlag country={p.nationality} size={16} decorative />}
                  </p>
                  {p.at && <p className="gv-lpp-when">{when} {dayLabel(p.at)}</p>}
                </div>
                {p.stage === 'applied' && p.application_id ? (
                  <Link href={`/manage/${slug}/team?tab=applications&app=${encodeURIComponent(p.application_id)}`} className="gv-lpp-link">Open application</Link>
                ) : (
                  <Link href={`/cv/${p.user_id}`} target="_blank" rel="noopener" className="gv-lpp-link">View CV</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-jp.gv-lpp{max-width:640px}
.gv-lpp-filters{display:flex;flex-wrap:wrap;gap:8px}
.gv-lpp-n{font-variant-numeric:tabular-nums;opacity:0.8;margin-left:4px}
.gv-lpp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.gv-lpp-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.07);font-family:${FONT}}
.gv-lpp-id{min-width:0;flex:1}
.gv-lpp-name{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:16px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:break-word}
.gv-lpp-when{margin:2px 0 0;font-size:13px;color:${INK_SOFT}}
.gv-lpp-link{flex-shrink:0;font-size:13.5px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px}
.gv-lpp-link:focus{outline:none}
.gv-lpp-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-lpp-skel{height:68px;border-radius:16px;background:rgba(28,20,16,0.08);animation:gvLppPulse 1.2s ease-in-out infinite}
@keyframes gvLppPulse{0%,100%{opacity:1}50%{opacity:0.55}}
@media (prefers-reduced-motion:reduce){.gv-lpp-skel{animation:none}}
.gv-lpp-empty{margin:4px 0;padding:18px;border-radius:16px;background:#FFFFFF;font-family:${FONT};font-size:15px;color:${INK_SOFT}}
`;
