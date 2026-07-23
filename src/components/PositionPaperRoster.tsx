'use client';

// Shared position paper roster, one row per country of a committee. Reused
// by the chair participant view (ChairParticipant) and the organizer
// Documents Overview tab so both reviewer surfaces render the exact same
// row: flag + country, delegate name(s), status badge, LATE badge when the
// paper was submitted after the deadline, an unread badge for the reviewer
// side, and inline Approve/Reject. A row with a paper is a raised
// neumorphic card (clickable, chevron on the right); a country with no
// submission stays a flat, quiet row, the contrast itself signals which
// rows invite a click.

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByCode } from '@/lib/countries';
import { isPaperLate, countUnread, type PaperMessageStub } from '@/lib/positionPapers';
import { NEU, NeuCard } from '@/components/neu';

const OUTFIT = "'Outfit', sans-serif";

export interface RosterAllocation {
  country_code: string;
  user_id: string | null;
  display_name: string | null;
  /** From the seat's application row, when the seat hasn't been claimed by
   *  a user yet (an imported invite waiting to be accepted). */
  invited_name: string | null;
}

/** Claimed seat shows the delegate's name; an unclaimed import invite shows
 *  its invited name with a note; a bare reserved seat says so plainly. */
function seatLabel(seat: RosterAllocation): string {
  if (seat.display_name) return seat.display_name;
  if (seat.invited_name) return `${seat.invited_name} · invite not claimed`;
  return 'Seat not claimed';
}

export interface RosterPaper {
  id: string;
  country_code: string;
  status: string;
  submitted_at: string;
  reviewer_seen_at: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  submitted: { bg: 'rgba(238,217,138,0.2)', color: '#B8844A' },
  reviewed: { bg: 'rgba(154,138,120,0.15)', color: '#6E5F4E' },
  approved: { bg: 'rgba(61,122,82,0.12)', color: '#3D7A52' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status.toLowerCase()] ?? STATUS_STYLES.submitted;
  return (
    <span
      className="px-2.5 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color, fontSize: 10, fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.06em' }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function PositionPaperRoster({
  conferenceSlug, currentUserId, deadline, allocations, papers, messagesByPaper, busyIds, onApprove, onReject, statusFilter,
}: {
  conferenceSlug: string;
  currentUserId: string;
  deadline: string | null;
  allocations: RosterAllocation[];
  papers: RosterPaper[];
  messagesByPaper: Record<string, PaperMessageStub[]>;
  busyIds: Set<string>;
  onApprove: (paperId: string) => void;
  onReject: (paperId: string) => void;
  /** When set to anything other than 'ALL', only countries whose paper
   *  matches this status are shown (countries with no paper never match a
   *  specific status, so they drop out of a filtered view entirely). */
  statusFilter?: string;
}) {
  const router = useRouter();

  const byCountry = new Map<string, RosterAllocation[]>();
  for (const a of allocations) {
    const arr = byCountry.get(a.country_code);
    if (arr) arr.push(a); else byCountry.set(a.country_code, [a]);
  }
  let countries = Array.from(byCountry.keys()).sort((a, b) =>
    (getCountryByCode(a)?.name ?? a).localeCompare(getCountryByCode(b)?.name ?? b)
  );
  if (statusFilter && statusFilter !== 'ALL') {
    countries = countries.filter(code => papers.find(p => p.country_code === code)?.status.toUpperCase() === statusFilter);
  }

  if (countries.length === 0) {
    return (
      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78', textAlign: 'center', padding: '32px 0' }}>
        {statusFilter && statusFilter !== 'ALL' ? 'No papers match this filter.' : 'No delegates allocated to this committee yet.'}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {countries.map(code => {
        const cName = getCountryByCode(code)?.name ?? code;
        const seats = byCountry.get(code) ?? [];
        // Dedup repeated "Seat not claimed" placeholders (an unclaimed
        // double-delegation country would otherwise read as the phrase
        // twice), keeping every distinct claimed or invited name.
        const labels = seats.map(seatLabel);
        const firstUnclaimed = labels.indexOf('Seat not claimed');
        const names = labels.filter((label, i) => label !== 'Seat not claimed' || i === firstUnclaimed).join(' & ');
        const paper = papers.find(p => p.country_code === code) ?? null;
        const late = paper ? isPaperLate(paper.submitted_at, deadline) : false;
        const unread = paper ? countUnread(messagesByPaper[paper.id] ?? [], paper.reviewer_seen_at, currentUserId) : 0;
        const busy = paper ? busyIds.has(paper.id) : false;

        const rowBody = (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <FlagImg code={code} size={22} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 13, color: '#1C1410', margin: 0 }}>{cName}</p>
                {names && (
                  <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78', margin: '1px 0 0 0' }}>{names}</p>
                )}
              </div>

              <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
                {!paper ? (
                  <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: '#9A8A78' }}>No submission</span>
                ) : (
                  <>
                    {unread > 0 && (
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, backgroundColor: '#1B3828', color: '#EED98A', fontSize: 10, fontFamily: OUTFIT, fontWeight: 800 }}
                      >
                        {unread}
                      </span>
                    )}
                    {late && (
                      <span
                        className="px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: 'rgba(184,132,74,0.16)', color: '#8A5A2E', fontSize: 9, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.06em' }}
                      >
                        LATE
                      </span>
                    )}
                    <StatusBadge status={paper.status} />
                    <ChevronRight size={16} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
                  </>
                )}
              </div>
            </div>

            {paper && (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 10 }}>
                {paper.status !== 'approved' && (
                  <button
                    onClick={e => { e.stopPropagation(); onApprove(paper.id); }}
                    disabled={busy}
                    className="focus:outline-none"
                    style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, color: '#3D7A52', backgroundColor: 'rgba(61,122,82,0.12)', border: '1px solid rgba(61,122,82,0.3)', borderRadius: 8, padding: '5px 11px', cursor: busy ? 'default' : 'pointer' }}
                  >
                    APPROVE
                  </button>
                )}
                {paper.status !== 'rejected' && (
                  <button
                    onClick={e => { e.stopPropagation(); onReject(paper.id); }}
                    disabled={busy}
                    className="focus:outline-none"
                    style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 8, padding: '5px 11px', cursor: busy ? 'default' : 'pointer' }}
                  >
                    REJECT
                  </button>
                )}
              </div>
            )}
          </>
        );

        // Clickable rows get the raised neumorphic treatment (lift + deeper
        // shadow on hover, via NeuCard) so a submission obviously invites a
        // click; a country with nothing to review stays flat and quiet.
        return paper ? (
          <NeuCard
            key={code}
            hover
            onClick={() => router.push(`/conferences/${conferenceSlug}/papers/${paper.id}`)}
            style={{ padding: 14, borderRadius: 16 }}
          >
            {rowBody}
          </NeuCard>
        ) : (
          <div key={code} style={{ backgroundColor: 'rgba(154,138,120,0.06)', borderRadius: 16, padding: 14 }}>
            {rowBody}
          </div>
        );
      })}
    </div>
  );
}
