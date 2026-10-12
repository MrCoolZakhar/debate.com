'use client';

// A press release: up to 600 characters and an optional photo, sent to the Everyone chat of
// every open committee room as "Press · <outlet>". Three in any 24 hours. Press seats and
// press chairs only (never observers). It is not a chat: nobody can answer it.
//
// Sending asks first in place ("This goes to every committee room. Send it now?"), because a
// release reaches every room at once and uses one of the three.

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { PRESS_RELEASE_MAX, PRESS_RELEASES_PER_DAY, sendPressRelease, uploadPressImage } from '@/lib/press';
import { CARD_SHADOW, FOREST, INK, INK_SOFT } from './pressKit';

const PRIMARY: React.CSSProperties = {
  minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(90deg, #1B3828 0%, #2A5A3C 100%)', color: '#FFFFFF',
  fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
};
const SECOND: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 10, background: '#FFFFFF', color: INK,
  border: '1.5px solid rgba(28,20,16,0.55)', fontFamily: OUTFIT, fontSize: 15, fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', gap: 8,
};

function timeOf(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export default function PressReleaseComposer({ conferenceId, label, releasesLeft, nextReleaseAt, onSent }: {
  conferenceId: string;
  /** What the release is signed with ("BBC"). */
  label: string | null;
  releasesLeft: number;
  nextReleaseAt: string | null;
  onSent: (left: number, next: string | null) => void;
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

  const trimmed = text.trim();
  const out = releasesLeft <= 0;
  const canSend = !!trimmed && trimmed.length <= PRESS_RELEASE_MAX && !uploading && !sending && !out;

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
    const r = await sendPressRelease(conferenceId, trimmed, imageUrl);
    setSending(false); setAsking(false);
    if (!r.ok) {
      setError(r.message);
      if (r.releasesLeft != null) onSent(r.releasesLeft, r.nextReleaseAt ?? null);
      return;
    }
    setText(''); setImageUrl(null); setImageName('');
    setDone(r.sentTo === 1 ? 'Sent to 1 committee room' : `Sent to ${r.sentTo} committee rooms`);
    onSent(r.releasesLeft, r.nextReleaseAt);
  }

  return (
    <section className="rounded-[20px] p-5 md:p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }} aria-labelledby="press-release-title">
      <div className="flex items-start gap-3">
        <span aria-hidden className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 46, height: 46, borderRadius: 999, backgroundColor: 'rgba(47,96,118,0.12)' }}>
          <Emoji3D name="Newspaper" size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="press-release-title" style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.25 }}>Send a Press Release</h2>
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: INK_SOFT, margin: '3px 0 0 0', lineHeight: 1.45 }}>
            It appears in every committee&apos;s Everyone chat{label ? <> as <strong style={{ color: INK }}>Press · {label}</strong></> : null}
          </p>
        </div>
      </div>

      <label htmlFor="press-release-text" className="sr-only">Press release</label>
      <textarea
        id="press-release-text"
        value={text}
        onChange={(e) => { setText(e.target.value.slice(0, PRESS_RELEASE_MAX)); setDone(''); setAsking(false); }}
        maxLength={PRESS_RELEASE_MAX}
        rows={4}
        disabled={out}
        placeholder={out ? 'You have used today’s press releases' : 'Breaking: the Security Council votes on a ceasefire draft at 3pm'}
        className="mt-4 w-full rounded-[12px] px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
        style={{ fontFamily: OUTFIT, fontSize: 16, lineHeight: 1.5, color: INK, backgroundColor: '#FBF8F1', border: '1.5px solid rgba(27,56,40,0.14)', resize: 'vertical', minHeight: 110 }}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" tabIndex={-1}
            onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          {imageUrl ? (
            <span className="inline-flex items-center gap-2 rounded-[10px] px-2 py-1" style={{ backgroundColor: 'rgba(27,56,40,0.05)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the photo just uploaded */}
              <img src={imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8 }} />
              <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, color: INK, maxWidth: 220 }} title={imageName}>{imageName || 'Photo'}</span>
              <button type="button" aria-label="Remove the photo" title="Remove the photo" onClick={() => { setImageUrl(null); setImageName(''); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#1B3828]/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]" style={{ color: INK_SOFT }}>
                <X size={15} />
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || out}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:opacity-50"
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {asking ? (
          <>
            <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: INK }}>This goes to every committee room. Send it now?</span>
            <button type="button" style={SECOND} onClick={() => setAsking(false)} disabled={sending} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]">Cancel</button>
            <button type="button" style={{ ...PRIMARY, opacity: sending ? 0.7 : 1 }} onClick={() => void send()} disabled={sending} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]">
              {sending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
              Send
            </button>
          </>
        ) : (
          <button type="button" style={{ ...PRIMARY, opacity: canSend ? 1 : 0.5 }} disabled={!canSend} onClick={() => { setDone(''); setAsking(true); }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]">
            <Send size={16} aria-hidden /> Send to all committees
          </button>
        )}
        <span style={{ fontFamily: OUTFIT, fontSize: 13.5, color: INK_SOFT }}>
          {out
            ? (nextReleaseAt ? `You can send another at ${timeOf(nextReleaseAt)}` : 'You have used today’s press releases')
            : <><strong style={{ color: INK, fontSize: 15 }}>{releasesLeft}</strong> of {PRESS_RELEASES_PER_DAY} left today</>}
        </span>
      </div>

      {error && <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: '#8E3A33', margin: '10px 0 0 0' }}>{error}</p>}
      <p role="status" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: FOREST, fontWeight: 600, margin: done ? '10px 0 0 0' : 0 }}>{done}</p>
    </section>
  );
}
