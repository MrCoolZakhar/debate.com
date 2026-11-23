'use client';
// Gavelling Crisis: press releases waiting for the crisis staff (News page, staff only).
// The press writes releases on the conference Press Desk; the crisis staff (director, assistant directors, backroomers with an
// account) approve or reject them here, through the same RPCs the Press Desk uses (src/lib/press.ts: press_releases_board and
// review_press_release). The press chair, if there is one, sees the same queue on the Press Desk like usual. Whoever acts first wins.
// The Crisis Director and assistant directors also get each release as a bottom card and in the "Waiting for a reply" list (ApprovalQueue.tsx).

import { Check, Clock, Megaphone, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardTitle, CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { WaitingItemView } from './ApprovalQueue';
import { usePressQueue } from './pressQueue';

const KEEP_DECIDED = 5;

function whenText(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export default function PressReleasesCard() {
  const v = useCrisis();
  const { user } = useAuth();
  const conferenceId = v.conference.id;
  const signedIn = !!user;
  // The same shared queue the bottom cards and the "Waiting for a reply" list read: one read for the whole tab.
  const { board, state, decided } = usePressQueue(conferenceId, signedIn && v.staff);

  if (!v.staff) return null;

  const title = <CardTitle icon={<Megaphone size={17} strokeWidth={1.5} />} sub="Written by the press on the Press Desk. The press chair sees the same list there.">Press Releases</CardTitle>;

  if (!signedIn) {
    return (
      <Card>
        {title}
        <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>Approving press releases needs a Gavelling account. Sign in with yours to review them.</p>
      </Card>
    );
  }
  if (state === 'loading') return <Card>{title}<Skeleton h={64} /></Card>;
  if (state !== 'ok' || !board) {
    return (
      <Card>
        {title}
        <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>
          {state === 'missing' ? 'Press releases are not switched on for this conference yet.'
            : state === 'denied' ? 'Your account cannot review press releases for this conference.'
              : 'Could not read the press releases. Try again in a moment.'}
        </p>
      </Card>
    );
  }

  const past = board.mine.filter((m) => m.status !== 'pending').slice(0, KEEP_DECIDED);
  return (
    <Card>
      {title}
      {board.pending.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>
          {board.approvalOn ? 'Nothing is waiting. Releases from the press appear here first.' : 'Releases go out as soon as the press sends them.'}
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {board.pending.map((r) => (
            <li key={r.id} style={{ listStyle: 'none' }}>
              <WaitingItemView item={{ kind: 'press', key: `p:${r.id}`, at: r.createdAt, r }} variant="row" conferenceId={conferenceId} onEdit={() => {}} onPublished={() => {}} cabinetsLabel={() => ''} />
            </li>
          ))}
        </ul>
      )}
      {(decided.length > 0 || past.length > 0) && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: CK.inkSoft }}>Recently decided</p>
          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {decided.map((d) => (
              <li key={d.id} className="flex items-start" style={{ gap: 8, listStyle: 'none', fontSize: 13, color: CK.inkSoft }}>
                {d.approved ? <Check size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.ok, flex: 'none', marginTop: 2 }} /> : <X size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.danger, flex: 'none', marginTop: 2 }} />}
                <span style={{ overflowWrap: 'anywhere' }}><b style={{ color: CK.ink }}>{d.label}</b>: {d.message}</span>
              </li>
            ))}
            {past.filter((m) => !decided.some((d) => d.id === m.id)).map((m) => (
              <li key={m.id} className="flex items-start" style={{ gap: 8, listStyle: 'none', fontSize: 13, color: CK.inkSoft }}>
                {m.status === 'sent' ? <Check size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.ok, flex: 'none', marginTop: 2 }} /> : m.status === 'rejected' ? <X size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.danger, flex: 'none', marginTop: 2 }} /> : <Clock size={15} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2 }} />}
                <span style={{ overflowWrap: 'anywhere' }}>{m.message} <span style={{ color: CK.muted }}>({whenText(m.createdAt)})</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
