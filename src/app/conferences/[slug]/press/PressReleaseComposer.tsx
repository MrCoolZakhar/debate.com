'use client';

// A press release: up to 600 characters and an optional photo, sent to the Everyone chat of
// the committee rooms the reporter picks (every open room by default, never the press room
// itself) as "Press · <outlet>". Three in any 24 hours. Press seats and press chairs only
// (never observers). It is not a chat: nobody can answer it. With the press chair's approval
// on (the default), a press seat's release waits for a press chair before it goes out.
//
// Sending asks first in place, because a release reaches every picked room at once and uses
// one of the three.

import { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Newspaper, Send, X } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { PRESS_RELEASE_MAX, PRESS_RELEASES_PER_DAY, sendPressRelease, uploadPressImage } from '@/lib/press';
import { CARD_SHADOW, FOREST, INK, INK_SOFT } from './pressKit';
import { startOfDayIso, endOfDayIso } from '@/lib/applicationWindow';
import { useNow } from '@/lib/useNow';

const PRIMARY: React.CSSProperties = {
  minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(90deg, var(--gv-main) 0%, var(--gv-main-mid) 100%)', color: 'var(--gv-on-main)',
  fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
};
const SECOND: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 10, background: '#FFFFFF', color: 'var(--gv-main)',
  border: '1px solid color-mix(in srgb, var(--gv-main) 18%, transparent)', fontFamily: OUTFIT, fontSize: 15, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', gap: 8,
};

// ── Only during the conference (owner, 23 Oct 2026) ─────────────────────────
// `send_press_release` refuses outside the conference's days: from 00:00 on the
// start day to 23:59 on the last day, conference time; dates to be decided:
// refused (scratch-conference-rooms.sql, section C6). The form mirrors it so
// nobody writes a release that cannot go. With no timezone stored the window is
// widened to the earliest and latest zones on earth: the form never hides when
// the server would accept, and the server's own sentence covers the rest.

export interface PressDates {
  start_date: string | null;
  end_date: string | null;
  dates_tbd: boolean | null;
  timezone: string | null;
}

function validZone(tz: string | null): string | null {
  if (!tz) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return null; }
}

/** null = open now; otherwise the one plain line that says why not. */
export function pressClosedLine(d: PressDates, now: number): string | null {
  const start = (d.start_date ?? '').slice(0, 10);
  const last = (d.end_date || d.start_date || '').slice(0, 10);
  if (d.dates_tbd || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return 'Press releases open once the conference has dates';
  const tz = validZone(d.timezone);
  const opens = Date.parse(startOfDayIso(start, tz ?? 'Etc/GMT-14'));
  const closes = Date.parse(endOfDayIso(last, tz ?? 'Etc/GMT+12')) + 59_999;
  if (now < opens) {
    const [y, m, day] = start.split('-').map(Number);
    const when = new Date(y, m - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    return `Press releases open when the conference starts on ${when}`;
  }
  if (now > closes) return 'The conference has ended, so press releases are closed';
  return null;
}

function timeOf(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export interface PressTargetRoom { id: string; label: string; full: string }

export default function PressReleaseComposer({ conferenceId, dates, label, releasesLeft, nextReleaseAt, onSent, rooms, canPick, needsApproval }: {
  conferenceId: string;
  dates: PressDates;
  /** What the release is signed with ("BBC"). */
  label: string | null;
  releasesLeft: number;
  nextReleaseAt: string | null;
  onSent: (left: number, next: string | null) => void;
  /** The open committee rooms a release can go to (never the press room). */
  rooms: PressTargetRoom[];
  /** Picking rooms needs the new send_press_release (scratch-press-and-parties.sql PC). */
  canPick: boolean;
  /** This release waits for a press chair before it goes out. */
  needsApproval: boolean;
}) {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // Picked rooms by conference_committees id; empty = every open room (the default).
  const [picked, setPicked] = useState<string[]>([]);
  const livePicked = picked.filter((id) => rooms.some((r) => r.id === id));
  const allRooms = !canPick || livePicked.length === 0;
  const toggleRoom = (id: string) => {
    setDone(''); setAsking(false);
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.filter((x) => rooms.some((r) => r.id === x)), id]));
  };
  const targetLine = allRooms
    ? 'every committee room'
    : livePicked.length === 1 ? (rooms.find((r) => r.id === livePicked[0])?.label ?? '1 committee room') : `${livePicked.length} committee rooms`;

  const trimmed = text.trim();
  const now = useNow(60_000);
  const closedLine = pressClosedLine(dates, now);
  const out = releasesLeft <= 0;
  const canSend = !!trimmed && trimmed.length <= PRESS_RELEASE_MAX && !uploading && !sending && !out && !closedLine;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(''); setDone('');
    setUploading(true);
    const r = await uploadPressImage(conferenceId, file);
    setUploading(false);
    if (r.error || !r.url) { setError(r.error ?? "Couldn't upload the image. Try a different one."); return; }
    setImageUrl(r.url); setImageName(file.name);
  }

  async function send() {
    if (!canSend) return;
    setSending(true); setError('');
    const r = await sendPressRelease(conferenceId, trimmed, imageUrl, allRooms ? null : livePicked);
    setSending(false); setAsking(false);
    if (!r.ok) {
      setError(r.message);
      if (r.releasesLeft != null) onSent(r.releasesLeft, r.nextReleaseAt ?? null);
      return;
    }
    setText(''); setImageUrl(null); setImageName('');
    setDone(r.pending
      ? 'Sent to your press chair. It goes out once they approve it'
      : r.sentTo === 1 ? 'Sent to 1 committee room' : `Sent to ${r.sentTo} committee rooms`);
    onSent(r.releasesLeft, r.nextReleaseAt);
  }

  return (
    <section className="rounded-[20px] p-5 md:p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }} aria-labelledby="press-release-title">
      <div className="flex items-start gap-3">
        <Newspaper size={30} strokeWidth={1.5} aria-hidden style={{ color: INK, flexShrink: 0, marginTop: 2 }} />
        <div className="min-w-0 flex-1">
          <h2 id="press-release-title" style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.25 }}>Send a Press Release</h2>
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: INK_SOFT, margin: '3px 0 0 0', lineHeight: 1.45 }}>
            It appears in the committees&apos; Everyone chat{label ? <> as <strong style={{ color: INK }}>Press · {label}</strong></> : null}
            {needsApproval ? '. Your press chair approves it first' : null}
          </p>
        </div>
      </div>

      {closedLine ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 600, color: INK, margin: '16px 0 0 0' }}>{closedLine}</p>
      ) : (<>
      <label htmlFor="press-release-text" className="sr-only">Press release</label>
      <textarea
        id="press-release-text"
        value={text}
        onChange={(e) => { setText(e.target.value.slice(0, PRESS_RELEASE_MAX)); setDone(''); setAsking(false); }}
        maxLength={PRESS_RELEASE_MAX}
        rows={4}
        disabled={out}
        placeholder={out ? 'You have used today’s press releases' : 'Breaking: the Security Council votes on a ceasefire draft at 3pm'}
        className="mt-4 w-full rounded-[12px] px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
        style={{ fontFamily: OUTFIT, fontSize: 16, lineHeight: 1.5, color: INK, backgroundColor: '#FBF8F1', border: '1.5px solid color-mix(in srgb, var(--gv-main) 14%, transparent)', resize: 'vertical', minHeight: 110 }}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" tabIndex={-1}
            onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          {imageUrl ? (
            <span className="inline-flex items-center gap-2 rounded-[10px] px-2 py-1" style={{ backgroundColor: 'color-mix(in srgb, var(--gv-main) 5%, transparent)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the photo just uploaded */}
              <img src={imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8 }} />
              <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, color: INK, maxWidth: 220 }} title={imageName}>{imageName || 'Photo'}</span>
              <button type="button" aria-label="Remove the photo" title="Remove the photo" onClick={() => { setImageUrl(null); setImageName(''); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--gv-main)]/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]" style={{ color: INK_SOFT }}>
                <X size={15} />
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || out}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] disabled:opacity-50"
              style={{ minHeight: 40, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: FOREST, textDecoration: 'underline' }}>
              {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
              {uploading ? 'Uploading' : 'Add a photo'}
            </button>
          )}
        </div>
        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: trimmed.length > PRESS_RELEASE_MAX - 40 ? '#8A3B12' : INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
          {text.length} / {PRESS_RELEASE_MAX}
        </span>
      </div>

      {canPick && rooms.length > 1 && (
        <fieldset className="mt-4" style={{ border: 'none', margin: '16px 0 0 0', padding: 0 }}>
          <legend style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: INK, marginBottom: 8 }}>Send to</legend>
          <div className="flex flex-wrap gap-2">
            {[{ id: '__all__', label: 'All committee rooms', full: 'All committee rooms' }, ...rooms].map((r) => {
              const on = r.id === '__all__' ? allRooms : livePicked.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  title={r.full !== r.label ? r.full : undefined}
                  disabled={out}
                  onClick={() => {
                    if (r.id !== '__all__') { toggleRoom(r.id); return; }
                    setPicked([]); setDone(''); setAsking(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] disabled:opacity-50 [overflow-wrap:anywhere]"
                  style={{
                    minHeight: 36, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: on ? 700 : 600,
                    color: on ? 'var(--gv-on-main)' : INK,
                    background: on ? 'linear-gradient(90deg, var(--gv-main) 0%, var(--gv-main-mid) 100%)' : '#FFFFFF',
                    border: on ? '1px solid transparent' : '1px solid color-mix(in srgb, var(--gv-main) 18%, transparent)',
                  }}
                >
                  {on && <Check size={14} strokeWidth={2.6} aria-hidden />}
                  {r.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {asking ? (
          <>
            <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: INK }}>
              {needsApproval ? `Your press chair approves it, then it goes to ${targetLine}. Send it now?` : `This goes to ${targetLine}. Send it now?`}
            </span>
            <button type="button" style={SECOND} onClick={() => setAsking(false)} disabled={sending} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]">Cancel</button>
            <button type="button" style={{ ...PRIMARY, opacity: sending ? 0.7 : 1 }} onClick={() => void send()} disabled={sending} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]">
              {sending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
              Send
            </button>
          </>
        ) : (
          <button type="button" style={{ ...PRIMARY, opacity: canSend ? 1 : 0.5 }} disabled={!canSend} onClick={() => { setDone(''); setAsking(true); }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]">
            <Send size={16} aria-hidden /> {needsApproval ? 'Send for approval' : allRooms ? 'Send to all committees' : 'Send to the rooms picked'}
          </button>
        )}
        <span style={{ fontFamily: OUTFIT, fontSize: 13.5, color: INK_SOFT }}>
          {out
            ? (nextReleaseAt ? `You can send another at ${timeOf(nextReleaseAt)}` : 'You have used today’s press releases')
            : <><strong style={{ color: INK, fontSize: 15 }}>{releasesLeft}</strong> of {PRESS_RELEASES_PER_DAY} left today</>}
        </span>
      </div>

      </>)}

      {error && <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: '#8E3A33', margin: '10px 0 0 0' }}>{error}</p>}
      <p role="status" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: FOREST, fontWeight: 600, margin: done ? '10px 0 0 0' : 0 }}>{done}</p>
    </section>
  );
}
