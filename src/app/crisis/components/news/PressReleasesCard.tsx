'use client';
// Gavelling Crisis: press releases waiting for the crisis staff (News page, staff only).
// The press writes releases on the conference Press Desk; the crisis staff (director, assistant directors, backroomers with an
// account) approve or reject them here, through the same RPCs the Press Desk uses (src/lib/press.ts: press_releases_board and
// review_press_release). The press chair, if there is one, sees the same queue on the Press Desk like usual. Whoever acts first wins.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock, Megaphone, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { fetchReleasesBoard, reviewPressRelease, type PendingRelease, type ReleasesBoard } from '@/lib/press';
import { Btn, Card, CardTitle, CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { ZoomableImage } from './ImageLightbox';

const POLL_MS = 20_000;
const KEEP_DECIDED = 5;

function whenText(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

function roomsText(rooms: string[]): string {
  return rooms.length === 0 ? 'Every committee room' : rooms.join(', ');
}

interface Decided { id: string; label: string; message: string; approved: boolean; at: string }

function PendingRow({ r, i, onDecided }: { r: PendingRelease; i: number; onDecided: (r: PendingRelease, approved: boolean) => void }) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [asking, setAsking] = useState(false);
  const act = async (approve: boolean) => {
    if (busy) return;
    setBusy(approve ? 'approve' : 'reject');
    const res = await reviewPressRelease(r.id, approve);
    setBusy(null);
    setAsking(false);
    if (!res.ok) { notifyErr(res.message, 'crisis-press'); onDecided(r, approve); return; }
    notifyOk(approve ? (res.sentTo === 1 ? 'Sent to 1 committee room' : `Sent to ${res.sentTo} committee rooms`) : 'Press release rejected', 'crisis-press');
    onDecided(r, approve);
  };
  return (
    <li className="cm-rise" style={{ ['--i' as string]: i, background: CK.well, borderRadius: 14, padding: '10px 12px', listStyle: 'none' }}>
      <div className="flex items-start" style={{ gap: 10 }}>
        {r.imageUrl && <ZoomableImage src={r.imageUrl} alt="Press release picture" style={{ width: 64, height: 64, borderRadius: 10, flex: 'none' }} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{r.authorLabel || 'Press'}</b>
          <span style={{ fontSize: 12, color: CK.muted }}>{whenText(r.createdAt)} · {roomsText(r.rooms)}</span>
          <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.message}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 10 }}>
        {asking ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 700, color: CK.ink }}>Reject this release?</span>
            <Btn size="sm" tone="ghost" disabled={!!busy} onClick={() => setAsking(false)}>Keep it</Btn>
            <Btn size="sm" tone="red" icon={<X size={14} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => void act(false)}>{busy === 'reject' ? 'Rejecting' : 'Reject'}</Btn>
          </>
        ) : (
          <>
            <Btn size="sm" tone="green" icon={<Check size={14} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => void act(true)}>{busy === 'approve' ? 'Approving' : 'Approve and send'}</Btn>
            <Btn size="sm" tone="danger" icon={<X size={14} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => setAsking(true)}>Reject</Btn>
          </>
        )}
      </div>
    </li>
  );
}

export default function PressReleasesCard() {
  const v = useCrisis();
  const { user } = useAuth();
  const conferenceId = v.conference.id;
  const [board, setBoard] = useState<ReleasesBoard | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'denied' | 'error'>('loading');
  const [decided, setDecided] = useState<Decided[]>([]);
  const seq = useRef(0);
  const signedIn = !!user;

  const read = useCallback(async () => {
    if (!signedIn) return;
    const mine = ++seq.current;
    const r = await fetchReleasesBoard(conferenceId);
    if (mine !== seq.current) return;
    if (r.kind === 'ok') { setBoard(r.value); setState('ok'); } else setState((s) => (s === 'ok' ? s : r.kind));
  }, [conferenceId, signedIn]);

  useEffect(() => {
    if (!signedIn) return undefined;
    const first = window.setTimeout(() => { void read(); }, 0);
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void read(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void read(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(first); window.clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [read, signedIn]);

  const onDecided = (r: PendingRelease, approved: boolean) => {
    setDecided((d) => [{ id: r.id, label: r.authorLabel || 'Press', message: r.message, approved, at: new Date().toISOString() }, ...d].slice(0, KEEP_DECIDED));
    setBoard((b) => (b ? { ...b, pending: b.pending.filter((x) => x.id !== r.id) } : b));
    void read();
  };

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
          {board.pending.map((r, i) => <PendingRow key={r.id} r={r} i={i} onDecided={onDecided} />)}
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
