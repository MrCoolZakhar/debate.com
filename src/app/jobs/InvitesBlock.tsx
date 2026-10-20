'use client';

// ── Invites to apply, on /jobs My Applications (Job Board prompt 11) ───────
//
// Conferences can invite people who turned on "Open to team roles" (opt in,
// at most 3 invites a week reach anyone). Each invite: a compact JobCard,
// "Invited by <name> at <short>", the organizer's note in quotes, and for an
// invite not yet answered a quiet "Not interested" (talent_invite_respond,
// in place, optimistic with rollback). Applied invites read "You applied";
// declined ones are greyed with "Not interested".

import { useRef, useState } from 'react';
import { Check, Mail, XCircle } from 'lucide-react';
import { respondToInvite, type JobInvite } from '@/lib/jobBoard';
import JobCard from './JobCard';

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; message: string } | null>(null);
  const busyRef = useRef(false);

  if (invites.length === 0) return null;

  const decline = async (inv: JobInvite) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(inv.invite_id);
    setErr(null);
    const before = invites;
    onChange(invites.map((i) => (i.invite_id === inv.invite_id ? { ...i, invite_status: 'not_interested' } : i)));
    try {
      const r = await respondToInvite(inv.invite_id, 'not_interested');
      if (!r.ok) {
        onChange(before);
        setErr({ id: inv.invite_id, message: r.message });
      }
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Invites" style={{ fontFamily: FONT, marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Mail size={16} strokeWidth={2.4} aria-hidden style={{ color: FOREST }} />
        Invites
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {invites.map((inv) => {
          const declined = inv.invite_status === 'not_interested';
          const applied = inv.invite_status === 'applied';
          const short = inv.conference.short || inv.conference.name || 'the conference';
          return (
            <li key={inv.invite_id} style={{ opacity: declined ? 0.55 : 1, transition: 'opacity 160ms ease' }}>
              <JobCard
                card={inv}
                compact
                onSelect={onSelect}
                closed={!inv.open}
                status={
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: INK_SOFT, overflowWrap: 'anywhere' }}>
                      Invited by {inv.invited_by || 'the organizers'} at {short}
                    </span>
                    {inv.message?.trim() && (
                      <span style={{ fontSize: 13.5, fontStyle: 'italic', color: INK, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                        &ldquo;{inv.message.trim()}&rdquo;
                      </span>
                    )}
                    {applied && (
                      <span className="inline-flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 700, color: FOREST }}>
                        <Check size={14} strokeWidth={2.6} aria-hidden /> You applied
                      </span>
                    )}
                    {declined && (
                      <span className="inline-flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 700, color: INK_SOFT }}>
                        <XCircle size={14} strokeWidth={2.4} aria-hidden /> Not interested
                      </span>
                    )}
                  </span>
                }
              />
              {!applied && !declined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, paddingLeft: 4 }}>
                  <button
                    type="button"
                    onClick={() => { void decline(inv); }}
                    disabled={busyId === inv.invite_id}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
                    style={{ background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: INK_SOFT, textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    Not interested
                  </button>
                  {err?.id === inv.invite_id && <span role="alert" style={{ fontSize: 13, color: '#9E2A12' }}>{err.message}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
