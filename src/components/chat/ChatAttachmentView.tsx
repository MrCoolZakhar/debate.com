'use client';

import { memo, useState } from 'react';
import { FileText } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { formatBytes, type ChatAttachment } from '@/lib/chatAttachments';
import type { TFn } from './chatTokens';

const MAX_W = 260;
const MAX_H = 300;

/** Fit natural dimensions into the bubble box; a square fallback when they are unknown. */
function fit(w?: number, h?: number, maxW = MAX_W, maxH = MAX_H): { width: number; height: number } {
  if (!w || !h) return { width: Math.min(maxW, 220), height: Math.min(maxH, 220) };
  const s = Math.min(1, maxW / w, maxH / h);
  return { width: Math.max(80, Math.round(w * s)), height: Math.max(60, Math.round(h * s)) };
}

/**
 * The media inside a chat bubble. Photos and GIFs render at their final size from the start
 * (dimensions travel in the message), so nothing shifts when they load. Images are lazy and
 * decode off the main thread.
 *
 * A click opens the picture in the app's own viewer (ChatLightbox), not a new tab: leaving the
 * page to look at a photo means leaving the committee. It stays an `<a href>` so the browser's
 * own affordances still work — middle-click, cmd/ctrl-click and "open in new tab" go to the
 * raw file exactly as before, and only a plain left click is taken over. A PDF is unchanged:
 * there is nothing for the viewer to do with it.
 */
function ChatAttachmentView({ a, isMe, t, timeSlot, onOpen }: {
  a: ChatAttachment;
  isMe: boolean;
  t: TFn;
  /** The time chip, positioned by the caller. */
  timeSlot: React.ReactNode;
  /** Open this photo in the in-app viewer. Absent (a Commenter-free surface, or a PDF) = link only. */
  onOpen?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  if (a.kind === 'pdf') {
    return (
      <div style={{ position: 'relative', paddingBottom: 16 }}>
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t('chat_pdf_open')}: ${a.name}`}
          className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
          style={{
            minWidth: 200, maxWidth: 280, padding: '8px 10px', borderRadius: 12, textDecoration: 'none',
            background: isMe ? 'rgba(246,241,228,0.12)' : 'rgba(27,56,40,0.06)',
            color: 'inherit',
          }}
        >
          <span className="shrink-0 inline-flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 10, background: isMe ? NEU.gold : NEU.forest, color: isMe ? NEU.forest : NEU.gold }}>
            <FileText size={20} strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 650 }}>{a.name}</span>
            <span className="block" style={{ fontFamily: OUTFIT, fontSize: 12, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              PDF{a.size ? ` · ${formatBytes(a.size)}` : ''}
            </span>
          </span>
        </a>
        {timeSlot}
      </div>
    );
  }

  const src = a.kind === 'gif' ? (a.preview ?? a.url) : a.url;
  const box = fit(a.width, a.height);
  return (
    <div style={{ position: 'relative' }}>
      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t('chat_attach_open')}: ${a.name}`}
        onClick={(e) => {
          if (!onOpen) return;
          // Leave every "open it somewhere else" gesture alone.
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          onOpen();
        }}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
        style={{
          width: box.width, height: box.height, maxWidth: '100%', borderRadius: 14, overflow: 'hidden',
          background: isMe ? 'rgba(246,241,228,0.10)' : 'rgba(27,56,40,0.07)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote user media, sized by the message; next/image would proxy GIPHY through our server */}
        <img
          src={src}
          alt={a.kind === 'gif' ? a.name : ''}
          loading="lazy"
          decoding="async"
          width={box.width}
          height={box.height}
          onLoad={() => setLoaded(true)}
          // A cached image can finish before React attaches onLoad.
          ref={(el) => { if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true); }}
          style={{
            display: 'block', width: '100%', height: '100%', objectFit: 'cover',
            opacity: loaded ? 1 : 0, transition: 'opacity 180ms ease-out',
            outline: '1px solid rgba(0,0,0,0.06)', outlineOffset: -1,
          }}
        />
      </a>
      {timeSlot}
      {a.kind === 'gif' && (
        <span aria-hidden style={{
          position: 'absolute', insetInlineStart: 8, top: 8, padding: '1px 6px', borderRadius: 6,
          background: 'rgba(5,8,20,0.55)', color: '#fff', fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em',
        }}>GIF</span>
      )}
    </div>
  );
}

export default memo(ChatAttachmentView);
