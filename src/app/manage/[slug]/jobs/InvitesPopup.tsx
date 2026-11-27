'use client';

// ── Check invite status (prompt 76, 26 Nov 2026) ───────────────────────────
//
// Every invite this conference sent (job_conference_invites, read by the
// Your Invites card), in one pop-up (the Store shell): a search by name,
// role filters (Chair, Secretariat, Staff, by the listing's role) and a
// listing picker. One row per invite: the person (avatar opens their MUN CV),
// the listing, who sent it, the date and the status as an icon and a word.

import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Clock, MailOpen, Search, Send, XCircle } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import GSelect from '@/components/GSelect';
import { CvAvatar } from '@/app/conferences/[slug]/participant/delegation/leaderKit';
import { JOB_ROLE_LABEL, type JobRole } from '@/lib/jobBoard';
import { POSTING_CSS } from './PostingPopup';
import { dayLabel, type SentInvite } from './jobsApi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

export const INVITE_STATUS: Record<string, { label: string; icon: typeof Send; color: string }> = {
  sent: { label: 'Sent', icon: Send, color: FOREST },
  queued: { label: 'Queued', icon: Clock, color: INK_SOFT },
  opened: { label: 'Opened', icon: MailOpen, color: FOREST },
  applied: { label: 'Applied', icon: CheckCircle2, color: FOREST },
  not_interested: { label: 'Not interested', icon: XCircle, color: INK_SOFT },
  cancelled: { label: 'Cancelled', icon: Ban, color: INK_SOFT },
};

const ROLES: JobRole[] = ['chair', 'secretariat', 'staff'];

export default function InvitesPopup({ invites, listings, onClose, onFindPeople }: {
  invites: SentInvite[];
  /** The conference's listings, for the role of each invite and the listing picker. */
  listings: { id: string; title: string; role: JobRole }[];
  onClose: () => void;
  onFindPeople: () => void;
}) {
  const [text, setText] = useState('');
  const [role, setRole] = useState<JobRole | null>(null);
  const [listingId, setListingId] = useState('');
  const roleOf = useMemo(() => new Map(listings.map((l) => [l.id, l.role] as const)), [listings]);
  const usedListings = useMemo(() => {
    const ids = new Set(invites.map((i) => i.listing_id));
    return listings.filter((l) => ids.has(l.id));
  }, [invites, listings]);

  const q = text.trim().toLowerCase();
  const shown = invites.filter((i) =>
    (!q || (i.name ?? '').toLowerCase().includes(q))
    && (!role || roleOf.get(i.listing_id) === role)
    && (!listingId || i.listing_id === listingId));

  return (
    <PurchaseShell tone="light" label="Your invites" onClose={onClose} panelClass="gv-st-pop gv-jp gv-ivp" testId="job-invites">
      <style>{PURCHASE_CSS}{POSTING_CSS}{CSS}</style>
      <div className="gv-jp-col">
        <header className="gv-jp-head">
          <h2 className="gv-jp-title" style={{ marginTop: 0 }}>Your Invites</h2>
        </header>

        {invites.length === 0 ? (
          <div className="gv-ivp-empty">
            <p>No invites yet. Use Find people to invite someone</p>
            <button type="button" className="gv-jp-second" onClick={onFindPeople}>Find people</button>
          </div>
        ) : (
          <>
            <div className="gv-ivp-filters">
              <label className="gv-ivp-search">
                <Search size={17} strokeWidth={1.5} aria-hidden className="gv-ivp-search-icon" />
                <input className="gv-jp-input gv-ivp-search-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by name" aria-label="Search by name" />
              </label>
              <div className="gv-ivp-row">
                <div className="gv-jp-offers" role="group" aria-label="Role">
                  {ROLES.map((r) => (
                    <button key={r} type="button" aria-pressed={role === r} className={`gv-jp-offer${role === r ? ' gv-jp-offer-on' : ''}`} onClick={() => setRole((cur) => (cur === r ? null : r))}>
                      {JOB_ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
                {usedListings.length > 1 && (
                  <div className="gv-ivp-listing">
                    <GSelect value={listingId} onChange={setListingId} aria-label="Listing"
                      options={[{ value: '', label: 'Every listing' }, ...usedListings.map((l) => ({ value: l.id, label: l.title }))]} />
                  </div>
                )}
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="gv-ivp-none">No invites match</p>
            ) : (
              <ul className="gv-ivp-list">
                {shown.map((i) => {
                  const s = INVITE_STATUS[i.status] ?? INVITE_STATUS.sent;
                  const Icon = s.icon;
                  return (
                    <li key={i.id} className="gv-ivp-item">
                      <CvAvatar userId={i.user_id} name={i.name ?? 'A Gavelling member'} url={i.avatar_url} size={40} />
                      <div className="gv-ivp-who">
                        <p className="gv-ivp-name">{i.name || 'A Gavelling member'}</p>
                        <p className="gv-ivp-sub">{i.title || 'A listing'}</p>
                        <p className="gv-ivp-sub">{dayLabel(i.created_at)}{i.invited_by ? ` · by ${i.invited_by}` : ''}</p>
                      </div>
                      <span className="gv-ivp-status" style={{ color: s.color }}>
                        <Icon size={15} strokeWidth={1.5} aria-hidden /> {s.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-jp.gv-ivp{max-width:760px}
.gv-ivp-filters{display:flex;flex-direction:column;gap:10px}
.gv-ivp-search{position:relative;display:block}
.gv-ivp-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:${INK_SOFT};pointer-events:none}
.gv-jp-input.gv-ivp-search-input{padding-left:42px}
.gv-ivp-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px}
.gv-ivp-listing{flex:1 1 220px;min-width:0}
.gv-ivp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.gv-ivp-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.07);font-family:${FONT}}
.gv-ivp-who{flex:1;min-width:0}
.gv-ivp-name{margin:0;font-size:15.5px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:break-word}
.gv-ivp-sub{margin:2px 0 0;font-size:13px;color:${INK_SOFT};overflow-wrap:break-word}
.gv-ivp-status{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;font-size:13.5px;font-weight:700}
.gv-ivp-empty{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:18px;border-radius:16px;background:#FFFFFF;font-family:${FONT};font-size:15px;color:${INK_SOFT}}
.gv-ivp-empty p{margin:0}
.gv-ivp-none{margin:4px 0;font-family:${FONT};font-size:14.5px;color:${INK_SOFT}}
@media (max-width:600px){.gv-ivp-item{flex-wrap:wrap}.gv-ivp-status{padding-left:52px}}
`;
