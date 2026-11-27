'use client';

// ── Invites to apply, on /jobs My Applications (Job Board prompt 11) ───────
//
// Conferences can invite people who turned on "Open to team roles" (opt in,
// at most 3 invites a week reach anyone). Each invite: a compact JobCard and
// "Invited by <name> at <short>". A click opens the invite as a personal
// pop-up (InvitePopup, prompt 77) and marks it opened. "Not interested" lives
// only in that pop-up: once answered the invite leaves this list (the
// organiser still sees "Not interested"), so declined invites are never
// listed. Applied invites read "You applied".

import { useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { respondToInvite, type JobInvite } from '@/lib/jobBoard';
import JobCard from './JobCard';
import InvitePopup from './InvitePopup';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

export function unansweredInvites(invites: JobInvite[]): number {
  return invites.filter((i) => i.invite_status === 'sent' || i.invite_status === 'opened').length;
}

export default function InvitesBlock({ invites, onChange, onSelect }: {
  invites: JobInvite[];
  /** The list after a change (the page keeps it). */
  onChange: (next: JobInvite[]) => void;
  /** Opens the listing in place (the list's own select). */
  onSelect?: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = invites.filter((i) => i.invite_status !== 'not_interested');
  const openInvite = openId ? shown.find((i) => i.invite_id === openId) ?? null : null;

  if (shown.length === 0) return null;

  const open = (inv: JobInvite) => {
    setOpenId(inv.invite_id);
    if (inv.invite_status === 'sent') {
      onChange(invites.map((i) => (i.invite_id === inv.invite_id ? { ...i, invite_status: 'opened' } : i)));
      void respondToInvite(inv.invite_id, 'opened');
    }
  };

  return (
    <section aria-label="Invites" style={{ fontFamily: FONT, marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Mail size={16} strokeWidth={2.4} aria-hidden style={{ color: FOREST }} />
        Invites
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map((inv) => {
          const applied = inv.invite_status === 'applied';
          const short = inv.conference.short || inv.conference.name || 'the conference';
          return (
            <li key={inv.invite_id}>
              <JobCard
                card={inv}
                compact
                onSelect={() => open(inv)}
                closed={!inv.open}
                status={
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: INK_SOFT, overflowWrap: 'anywhere' }}>
                      Invited by {inv.invited_by || 'the organizers'} at {short}
                    </span>
                    {applied && (
                      <span className="inline-flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 700, color: FOREST }}>
                        <Check size={14} strokeWidth={2.6} aria-hidden /> You applied
                      </span>
                    )}
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
      {openInvite && (
        <InvitePopup
          invite={openInvite}
          onClose={() => setOpenId(null)}
          onViewListing={(id) => onSelect?.(id)}
          onDeclined={(inviteId) => onChange(invites.filter((i) => i.invite_id !== inviteId))}
        />
      )}
    </section>
  );
}
