'use client';

/**
 * A run of Secretariat messages in the Everyone thread: organiser broadcasts
 * (`session_broadcasts`), merged into the chat at render time by src/lib/broadcastMessages.ts.
 *
 * Never drawn as the reader's own bubble. Its own look: a forest disc with a gold megaphone
 * beside the last bubble, "Secretariat" in forest above the first, and per message what an
 * actionable broadcast asks the dais to do (icon + plain words, no pill), the text (pre-wrap),
 * the attached image at its real aspect (opens in the chat's own photo viewer, ChatLightbox,
 * exactly like a chat photo) and the time.
 *
 * Presentation only: no write, no committee state.
 */

import { useState } from 'react';
import { Flag, Megaphone, PauseCircle } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { trustedBroadcastImageUrl } from '@/lib/chatAttachments';
import { CHAT, formatTime, type ChatGroup, type TFn } from './chatTokens';

const MAX_W = 280;
const MAX_H = 320;

/** Natural sizes measured on load, by URL, so a re-render (or a remount after the thread
 *  closes and opens again) draws the box at its final size straight away. */
const measured = new Map<string, { width: number; height: number }>();

export function broadcastImageSize(url: string): { width: number; height: number } | undefined {
  return measured.get(url);
}

function fit(n?: { width: number; height: number }): { width: number; height: number } {
  if (!n) return { width: 240, height: 160 };
  const s = Math.min(1, MAX_W / n.width, MAX_H / n.height);
  return { width: Math.max(60, Math.round(n.width * s)), height: Math.max(40, Math.round(n.height * s)) };
}

export function SecretariatAvatar({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{
        width: size, height: size, borderRadius: 999, flexShrink: 0,
        background: `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})`, color: NEU.gold,
        boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.08)',
      }}
    >
      <Megaphone size={Math.round(size * 0.5)} strokeWidth={2.2} />
    </span>
  );
}

function BroadcastImage({ url, alt, onOpen, onLoaded }: {
  url: string;
  alt: string;
  onOpen?: () => void;
  onLoaded?: () => void;
}) {
  const [natural, setNatural] = useState(() => measured.get(url));
  const [failed, setFailed] = useState(false);
  const box = fit(natural);
  const take = (el: HTMLImageElement) => {
    if (!el.naturalWidth || !el.naturalHeight) return;
    const n = { width: el.naturalWidth, height: el.naturalHeight };
    measured.set(url, n);
    if (!natural || natural.width !== n.width || natural.height !== n.height) {
      setNatural(n);
      onLoaded?.();
    }
  };
  if (failed) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      aria-label={alt}
      onClick={(e) => {
        if (!onOpen) return;
        // Leave every "open it somewhere else" gesture alone, as chat photos do.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onOpen();
      }}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
      style={{
        width: box.width, height: box.height, maxWidth: '100%', borderRadius: 14, overflow: 'hidden',
        marginTop: 8, background: 'rgba(27,56,40,0.07)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- organiser upload in storage, sized on load */}
      <img
        src={url}
        alt={alt}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={(e) => take(e.currentTarget)}
        onError={() => setFailed(true)}
        // A cached image can finish before React attaches onLoad.
        ref={(el) => { if (el?.complete && el.naturalWidth > 0 && !natural) take(el); }}
        style={{
          display: 'block', width: '100%', height: '100%', objectFit: 'cover',
          opacity: natural ? 1 : 0, transition: 'opacity 180ms ease-out',
          outline: '1px solid rgba(0,0,0,0.06)', outlineOffset: -1,
        }}
      />
    </a>
  );
}

export default function SecretariatMessage({
  group, onOpenImage, onMediaLoaded, t, locale,
}: {
  group: ChatGroup;
  /** Open the image in the thread's photo viewer, by the item's id. */
  onOpenImage?: (itemId: string) => void;
  /** An image reached its real size: the thread keeps itself pinned to the bottom. */
  onMediaLoaded?: () => void;
  t: TFn;
  locale: string;
}) {
  const { items } = group;
  return (
    <div className="flex items-end gap-2 justify-start" style={{ marginTop: 10 }}>
      <SecretariatAvatar size={30} />
      <div className="flex flex-col items-start" style={{ maxWidth: 'min(80%, 560px)', minWidth: 0 }}>
        <span
          className="max-w-full [overflow-wrap:anywhere]"
          style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 750, marginBottom: 3, paddingInlineStart: 12, color: NEU.forest }}
        >
          {t('bc_secretariat')}
        </span>
        {items.map((it, i) => {
          const b = it.broadcast;
          const isFirst = i === 0;
          const action = b && b.kind === 'actionable' ? b.action : null;
          const ActionIcon = action === 'end' ? Flag : PauseCircle;
          const image = trustedBroadcastImageUrl(b?.imageUrl);
          return (
            <div
              key={it.id}
              style={{
                marginTop: isFirst ? 0 : 2, maxWidth: '100%', minWidth: 0,
                padding: '8px 12px 7px 13px', borderRadius: 18,
                // A run reads as one utterance: the inner corners on the sender's side are tighter.
                borderStartStartRadius: isFirst ? 18 : 6,
                borderEndStartRadius: 6,
                backgroundColor: CHAT.bubbleIn,
                // A faint forest ring marks it as the organisers', not a delegation's.
                boxShadow: '0 1px 1px rgba(28,20,16,0.08), 0 0 0 1px rgba(27,56,40,0.16)',
              }}
            >
              {action && (
                <p className="flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 650, color: '#8A3B12', marginBottom: 3 }}>
                  <ActionIcon size={15} strokeWidth={2.3} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
                  <span className="[overflow-wrap:anywhere]">
                    {t(action === 'end' ? 'bc_end' : 'bc_pause')}
                    {' · '}
                    {b?.actionAt ? t('bc_at', { time: formatTime(b.actionAt, locale) }) : t('bc_on_ack')}
                  </span>
                </p>
              )}
              <p
                className="whitespace-pre-wrap [overflow-wrap:anywhere]"
                style={{ fontFamily: OUTFIT, fontSize: 15, lineHeight: 1.38, color: NEU.ink, wordBreak: 'break-word', textWrap: 'pretty' }}
              >
                {it.content}
              </p>
              {image && (
                <BroadcastImage
                  url={image}
                  alt={t('bc_image')}
                  onOpen={onOpenImage ? () => onOpenImage(it.id) : undefined}
                  onLoaded={onMediaLoaded}
                />
              )}
              <p className="text-end" style={{ marginTop: 3, fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 500, color: 'color-mix(in srgb, var(--gv-on-surface, #1C1410) 55%, white)', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(it.timestamp, locale)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
