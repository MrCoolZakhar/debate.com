'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import type { ChatMessage } from '@/lib/types';
import type { OutboxMsg } from '@/lib/chatOutbox';
import ChatMessageGroup from './ChatMessageGroup';
import { ChatAvatar, avatarKindFor } from './ChatAvatar';
import { CHAT, buildChatRows, portalFrame, type TFn } from './chatTokens';

function Separator({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'unread' }) {
  const unread = tone === 'unread';
  return (
    <div className="flex items-center gap-2.5" style={{ marginTop: 14, marginBottom: 2 }}>
      <span className="flex-1" style={{ height: 1, backgroundColor: unread ? 'rgba(182,135,31,0.35)' : CHAT.hairline }} />
      <span
        style={{
          padding: '3px 11px', borderRadius: 999,
          backgroundColor: unread ? NEU.gold : NEU.base,
          boxShadow: unread ? 'none' : NEU.inSm,
          color: unread ? NEU.forest : NEU.muted,
          fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 900,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span className="flex-1" style={{ height: 1, backgroundColor: unread ? 'rgba(182,135,31,0.35)' : CHAT.hairline }} />
    </div>
  );
}

/** Hover-revealed "i" explainer. UI RULE: informational hints open on HOVER, never on click.
 *  The badge sits at the very end of a `px-4` header inside a card with `overflow-hidden`,
 *  so an in-flow absolute panel is guaranteed to be clipped (and to run off the edge on a
 *  phone). It is therefore portaled at fixed coordinates measured from the badge, clamped
 *  into the visible frame and flipped above when there is no room below.
 *  Coordinates go through portalFrame(): Portal mounts into `#fit-root`, which FitToScreen
 *  transforms, so raw viewport pixels would land off-anchor by the scale factor. */
const HINT_W = 210;

function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = portalFrame();
    const M = 8;
    const top0 = f.toLocalY(r.top);
    const bottom0 = f.toLocalY(r.bottom);
    const left0 = f.toLocalX(r.left);
    const right0 = f.toLocalX(r.right);
    // Estimate before the panel exists; re-placed with the measured height once it mounts.
    const h = panelRef.current?.offsetHeight ?? 68;

    // Centre on the badge, then clamp inside the visible frame.
    const maxLeft = Math.max(f.minX + M, f.maxX - HINT_W - M);
    const left = Math.min(Math.max(f.minX + M, left0 + (right0 - left0) / 2 - HINT_W / 2), maxLeft);

    const below = bottom0 + 6;
    const flip = below + h > f.maxY - M && top0 - 6 - h > f.minY + M;
    setPos({ top: flip ? top0 - 6 - h : below, left });
  }, []);

  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); place(); setOpen(true); };
  // Small close delay so the pointer can travel from the badge into the panel.
  const hide = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 180); };

  // Re-place once the panel is in the DOM so the flip uses its real height.
  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    // `pos` is recomputed by show() before every open, so it is never stale on reveal.
    if (!open) return;
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // Outside click dismisses; the portaled panel is not a DOM descendant of the trigger.
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, place]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        role="note"
        aria-label={text}
        title={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex shrink-0 items-center justify-center focus:outline-none"
        style={{
          width: 16, height: 16, borderRadius: 999, cursor: 'help',
          backgroundColor: NEU.base, boxShadow: NEU.inSm,
          fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 900, color: NEU.muted,
        }}
      >
        i
      </span>
      {open && pos && (
        <Portal>
          <span
            ref={panelRef}
            onMouseEnter={show}
            onMouseLeave={hide}
            className="fixed block"
            style={{
              top: pos.top, left: pos.left, width: HINT_W, zIndex: 70,
              padding: '8px 11px', borderRadius: 12,
              backgroundColor: NEU.surface, boxShadow: `${NEU.out}, 0 10px 24px rgba(27,56,40,0.18)`,
              fontFamily: OUTFIT, fontSize: 10.5, lineHeight: 1.45, color: NEU.ink,
            }}
          >
            {text}
          </span>
        </Portal>
      )}
    </>
  );
}

export default function ChatThread({
  convKey,
  label,
  messages,
  outbox,
  senderName,
  chairNames,
  unreadAnchor,
  onRetry,
  onBack,
  isDraft,
  t,
  locale,
}: {
  convKey: string;
  label: string;
  messages: ChatMessage[];
  outbox: OutboxMsg[];
  senderName: string;
  chairNames: string[];
  unreadAnchor: number;
  onRetry: (outboxId: string) => void;
  onBack: () => void;
  isDraft: boolean;
  t: TFn;
  locale: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [newPill, setNewPill] = useState(false);

  const rows = buildChatRows(messages, outbox, senderName, unreadAnchor, t, locale);

  const total = messages.length + outbox.length;
  const prevTotalRef = useRef(0);

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    atBottomRef.current = true;
    setNewPill(false);
  };

  useEffect(() => {
    const grew = total > prevTotalRef.current;
    prevTotalRef.current = total;
    if (atBottomRef.current) scrollToBottom(false);
    else if (grew) setNewPill(true);
  }, [total]);

  useEffect(() => {
    prevTotalRef.current = total;
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convKey]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    if (near) setNewPill(false);
  };

  const empty = messages.length === 0 && outbox.length === 0;
  const kind = avatarKindFor(convKey, chairNames);

  return (
    <>
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${CHAT.hairline}`, backgroundColor: NEU.surface }}
      >
        <button
          onClick={onBack}
          className="sm:hidden focus:outline-none inline-flex items-center justify-center"
          aria-label="Back"
          style={{
            width: 30, height: 30, borderRadius: 999, border: 'none',
            backgroundColor: NEU.base, boxShadow: NEU.outSm, color: NEU.forest, cursor: 'pointer',
          }}
        >
          <span className="inline-block rtl:-scale-x-100">←</span>
        </button>

        <ChatAvatar kind={kind} name={convKey} size={24} />

        <div className="min-w-0 flex-1">
          <h3
            className="truncate"
            style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 14.5, color: NEU.ink, letterSpacing: '0.01em' }}
          >
            {label}
          </h3>
          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
            {messages.length === 1
              ? t('chat_message_count_one')
              : t('chat_message_count_other').replace('{n}', String(messages.length))}
          </p>
        </div>

        <InfoHint text={convKey === 'everyone' ? t('chat_everyone_info') : t('chat_thread_info')} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        {empty ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-1 px-6">
            <ChatAvatar kind={kind} name={convKey} size={30} />
            <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, marginTop: 8 }}>
              {isDraft ? t('chat_draft_empty') : t('chat_no_messages')}
            </p>
            {!isDraft && (
              <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted }}>{t('chat_send_first')}</p>
            )}
          </div>
        ) : rows.map((row) => {
          if (row.kind === 'day') return <Separator key={row.key} label={row.label} />;
          if (row.kind === 'unread') return <Separator key={row.key} label={t('chat_new_messages')} tone="unread" />;
          return (
            <ChatMessageGroup
              key={row.key}
              group={row.group}
              isChairSender={chairNames.includes(row.group.sender)}
              onRetry={onRetry}
              t={t}
            />
          );
        })}
      </div>

      {/* Jump-to-latest pill */}
      {newPill && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute left-1/2 -translate-x-1/2 z-20 focus:outline-none"
          style={{
            bottom: 84, padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})`,
            color: NEU.gold, fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 900,
            boxShadow: '0 6px 18px rgba(27,56,40,0.32)',
            transition: `transform 160ms ${EASE}`,
          }}
        >
          ↓ {t('chat_new_messages')}
        </button>
      )}
    </>
  );
}
