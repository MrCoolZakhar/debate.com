'use client';

// The press releases around the composer (owner, 23 Oct 2026):
//   • press chairs and organisers: the approval switch ("a setting they can turn off", on by
//     default) and the releases waiting for them, each with Approve and Reject;
//   • whoever writes releases: their own, newest first, with when, how many rooms it reached
//     and whether it is waiting, sent or rejected.
// Data: press_releases_board / review_press_release / set_press_release_approval
// (src/lib/press.ts, scratch-press-and-parties.sql PD and PE). Until that SQL is applied the
// board answers `missing` and this draws nothing.

import { useState } from 'react';
import { Check, Clock, Loader2, X } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { reviewPressRelease, setPressApproval, type MyRelease, type PendingRelease, type ReleasesBoard } from '@/lib/press';
import { CARD_SHADOW, FOREST, INK, INK_SOFT } from './pressKit';

function when(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function roomsLine(rooms: string[]): string {
  return rooms.length === 0 ? 'Every committee room' : rooms.join(', ');
}

const SMALL_BTN: React.CSSProperties = {
  minHeight: 38, padding: '0 14px', borderRadius: 10, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

function Photo({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a release photo in the public bucket
    <img src={url} alt="" referrerPolicy="no-referrer" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
  );
}

function Switch({ on, busy, onChange, label }: { on: boolean; busy: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className="relative inline-flex flex-shrink-0 items-center rounded-full transition-[background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] disabled:opacity-60"
      style={{ width: 46, height: 28, backgroundColor: on ? 'var(--gv-main)' : 'rgba(28,20,16,0.18)' }}
    >
      <span
        aria-hidden
        className="absolute rounded-full transition-transform duration-150"
        style={{ width: 22, height: 22, top: 3, left: 3, backgroundColor: '#FFFFFF', transform: on ? 'translateX(18px)' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
      />
    </button>
  );
}

function PendingRow({ r, onDone }: { r: PendingRelease; onDone: () => void }) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [asking, setAsking] = useState(false);
  async function act(approve: boolean) {
    setBusy(approve ? 'approve' : 'reject');
    const res = await reviewPressRelease(r.id, approve);
    setBusy(null); setAsking(false);
    if (!res.ok) { notifyErr(res.message); onDone(); return; }
    notifyOk(approve ? (res.sentTo === 1 ? 'Sent to 1 committee room' : `Sent to ${res.sentTo} committee rooms`) : 'Press release rejected');
    onDone();
  }
  return (
    <li className="flex flex-col gap-2 rounded-[14px] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--gv-main) 4%, transparent)' }}>
      <div className="flex items-start gap-3">
        <Photo url={r.imageUrl} />
        <div className="min-w-0 flex-1">
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: INK, margin: 0 }}>
            Press · {r.authorLabel || 'Press'}
            <span style={{ fontWeight: 500, color: INK_SOFT }}>{' · '}{when(r.createdAt)}</span>
          </p>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14.5, color: INK, margin: '4px 0 0 0', lineHeight: 1.45 }}>{r.message}</p>
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT, margin: '4px 0 0 0' }}>{roomsLine(r.rooms)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {asking ? (
          <>
            <span style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: INK }}>Reject this release?</span>
            <button type="button" onClick={() => setAsking(false)} disabled={!!busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
              style={{ ...SMALL_BTN, backgroundColor: '#FFFFFF', color: FOREST, border: '1px solid color-mix(in srgb, var(--gv-main) 18%, transparent)' }}>Keep it</button>
            <button type="button" onClick={() => void act(false)} disabled={!!busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
              style={{ ...SMALL_BTN, backgroundColor: '#8E3A33', color: '#FFFFFF', border: 'none' }}>
              {busy === 'reject' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <X size={15} aria-hidden />} Reject
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => void act(true)} disabled={!!busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
              style={{ ...SMALL_BTN, border: 'none', background: 'linear-gradient(90deg, var(--gv-main) 0%, var(--gv-main-mid) 100%)', color: 'var(--gv-on-main)' }}>
              {busy === 'approve' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Check size={15} aria-hidden />} Approve and send
            </button>
            <button type="button" onClick={() => setAsking(true)} disabled={!!busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
              style={{ ...SMALL_BTN, backgroundColor: '#FFFFFF', color: '#8E3A33', border: '1px solid rgba(142,58,51,0.28)' }}>
              <X size={15} aria-hidden /> Reject
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function statusWord(r: MyRelease): { icon: typeof Check; word: string; color: string } {
  if (r.status === 'pending') return { icon: Clock, word: 'Waiting for the press chair', color: '#7A5812' };
  if (r.status === 'rejected') return { icon: X, word: 'Not approved', color: '#8E3A33' };
  return { icon: Check, word: r.sentTo === 1 ? 'Sent to 1 room' : `Sent to ${r.sentTo} rooms`, color: FOREST };
}

export function PressReviewCard({ conferenceId, board, onChanged }: {
  conferenceId: string;
  board: ReleasesBoard;
  onChanged: (patch?: Partial<ReleasesBoard>) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!board.canReview) return null;
  async function flip(next: boolean) {
    setBusy(true);
    const r = await setPressApproval(conferenceId, next);
    setBusy(false);
    if (!r.ok) { notifyErr(r.message); return; }
    onChanged({ approvalOn: r.on });
  }
  return (
    <section className="rounded-[20px] p-5 md:p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }} aria-labelledby="press-review-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="press-review-title" style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.25 }}>Releases to Approve</h2>
        <label className="inline-flex items-center gap-2.5">
          <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: INK }}>Approve releases before they go out</span>
          <Switch on={board.approvalOn} busy={busy} onChange={(v) => void flip(v)} label="Approve releases before they go out" />
        </label>
      </div>
      {board.pending.length === 0 ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: '12px 0 0 0' }}>
          {board.approvalOn ? 'Nothing is waiting. Releases from your reporters appear here first' : 'Releases go out as soon as a reporter sends them'}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3" style={{ margin: '16px 0 0 0', padding: 0, listStyle: 'none' }}>
          {board.pending.map((r) => <PendingRow key={r.id} r={r} onDone={() => onChanged()} />)}
        </ul>
      )}
    </section>
  );
}

export function MyReleasesCard({ releases }: { releases: MyRelease[] }) {
  if (releases.length === 0) return null;
  return (
    <section className="rounded-[20px] p-5 md:p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }} aria-labelledby="press-mine-title">
      <h2 id="press-mine-title" style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.25 }}>Your Press Releases</h2>
      <ul className="flex flex-col gap-3" style={{ margin: '14px 0 0 0', padding: 0, listStyle: 'none' }}>
        {releases.map((r) => {
          const st = statusWord(r);
          const Icon = st.icon;
          return (
            <li key={r.id} className="flex items-start gap-3 rounded-[14px] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--gv-main) 4%, transparent)' }}>
              <Photo url={r.imageUrl} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: st.color, margin: 0 }}>
                  <span className="inline-flex items-center gap-1"><Icon size={13} strokeWidth={2.4} aria-hidden />{st.word}</span>
                  <span style={{ fontWeight: 500, color: INK_SOFT }}>{when(r.sentAt ?? r.createdAt)}</span>
                </p>
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14.5, color: INK, margin: '4px 0 0 0', lineHeight: 1.45 }}>{r.message}</p>
                <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT, margin: '4px 0 0 0' }}>{roomsLine(r.rooms)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
