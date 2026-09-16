'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ChevronLeft } from 'lucide-react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT } from '@/components/neu';
import type { ChatMessage } from '@/lib/types';
import type { OutboxMsg } from '@/lib/chatOutbox';
import type { ChatEntryKind } from '@/lib/chatConversations';
import ChatMessageGroup from './ChatMessageGroup';
import { ChatAvatar } from './ChatAvatar';
import ChatLightbox, { type LightboxItem } from './ChatLightbox';
import { buildChatRows, formatTime, portalFrame, type TFn } from './chatTokens';

/** Day separators and the "New messages" divider: a small frosted-look pill, centred. */
function Separator({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'unread' }) {
  const unread = tone === 'unread';
  return (
    <div className="flex justify-center" style={{ marginTop: 14, marginBottom: 2 }} role="separator" aria-label={label}>
      <span
        style={{
          padding: '4px 12px', borderRadius: 999,
          background: unread ? NEU.gold : 'rgba(255,253,248,0.92)',
          boxShadow: unread ? '0 1px 2px rgba(182,135,31,0.25)' : '0 1px 1px rgba(28,20,16,0.08), 0 0 0 0.5px rgba(28,20,16,0.06)',
          color: unread ? NEU.forest : NEU.inkSoft,
          fontFamily: OUTFIT, fontSize: 12, fontWeight: 600,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
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
  kind,
  label,
  subtitle,
  info,
  messages,
  outbox,
  senderName,
  chairNames,
  multiParty,
  labelForSender,
  unreadAnchor,
  onRetry,
  onBack,
  intro,
  t,
  locale,
}: {
  convKey: string;
  kind: ChatEntryKind;
  label: string;
  subtitle: string;
  info: string;
  messages: ChatMessage[];
  outbox: OutboxMsg[];
  senderName: string;
  chairNames: string[];
  /** Show sender name + avatar on incoming runs. */
  multiParty: boolean;
  labelForSender: (name: string) => string;
  unreadAnchor: number;
  onRetry: (outboxId: string) => void;
  /** Present on a phone, where the thread replaces the list. */
  onBack?: () => void;
  /** A line shown above the first message (a group's "X created this group"). */
  intro?: string;
  t: TFn;
  locale: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [newPill, setNewPill] = useState(false);

  const rows = useMemo(
    () => buildChatRows(messages, outbox, senderName, unreadAnchor, t, locale),
    [messages, outbox, senderName, unreadAnchor, t, locale],
  );

  const total = messages.length + outbox.length;
  const prevTotalRef = useRef(0);

  // ── The in-app photo viewer ───────────────────────────────────────────────
  // Every photo and GIF of THIS conversation, oldest first: that is what the arrow keys and a
  // swipe move through. Built from the rows already folded above, so the order on screen and
  // the order in the viewer can never disagree.
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const lightboxItems = useMemo<LightboxItem[]>(() => {
    const out: LightboxItem[] = [];
    for (const row of rows) {
      if (row.kind !== 'group') continue;
      for (const it of row.group.items) {
        const a = it.attachment;
        if (!a || a.kind === 'pdf') continue;
        const who = row.group.isMe ? t('chat_you_prefix') : labelForSender(row.group.sender);
        out.push({
          id: it.id,
          kind: a.kind,
          url: a.url,
          previewUrl: a.preview,
          name: a.name || t('chat_photo'),
          caption: `${who} · ${formatTime(it.timestamp, locale)}`,
          width: a.width,
          height: a.height,
        });
      }
    }
    return out;
  }, [rows, labelForSender, t, locale]);
  // Switching conversation closes the viewer: its photos are no longer on screen.
  useEffect(() => { setLightboxId(null); }, [convKey]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    atBottomRef.current = true;
    setNewPill(false);
  }, []);

  // Before paint, so opening a thread never flashes its top first.
  useLayoutEffect(() => {
    prevTotalRef.current = total;
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convKey]);

  useEffect(() => {
    const grew = total > prevTotalRef.current;
    prevTotalRef.current = total;
    if (atBottomRef.current) scrollToBottom(false);
    else if (grew) setNewPill(true);
  }, [total, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    if (near) setNewPill(false);
  };

  const empty = messages.length === 0 && outbox.length === 0;

  return (
    <div className="relative flex flex-col flex-1 min-h-0 min-w-0">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2.5 px-3" style={{ height: 64, background: 'var(--chat-bar)', boxShadow: 'var(--chat-bar-shadow)' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('chat_back')}
            className="shrink-0 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.07)] active:scale-[0.96]"
            style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: 'transparent', color: NEU.forest, cursor: 'pointer', marginInlineStart: -4, transitionProperty: 'background-color, transform', transitionDuration: '150ms' }}
          >
            <ChevronLeft size={26} strokeWidth={2.4} aria-hidden className="rtl:-scale-x-100" />
          </button>
        )}
        <ChatAvatar kind={kind} name={convKey} size={40} />
        <div className="min-w-0 flex-1" style={{ paddingInlineStart: onBack ? 0 : 2 }}>
          <h3 className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 750, fontSize: 16.5, color: NEU.ink, lineHeight: 1.2 }}>
            {label}
          </h3>
          {subtitle && (
            <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
              {subtitle}
            </p>
          )}
        </div>
        <InfoHint text={info} />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto min-h-0 px-3 sm:px-5 pb-3"
        style={{ overscrollBehavior: 'contain' }}
        role="log"
        aria-live="polite"
        aria-label={label}
      >
        {intro && <Separator label={intro} />}
        {empty ? (
          <div className="flex flex-col items-center justify-center text-center gap-1 px-6" style={{ minHeight: '70%' }}>
            <ChatAvatar kind={kind} name={convKey} size={64} />
            <p style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 750, color: NEU.ink, marginTop: 10 }}>{label}</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.inkSoft, textWrap: 'balance' }}>{t('chat_draft_empty')}</p>
          </div>
        ) : rows.map((row) => {
          if (row.kind === 'day') return <Separator key={row.key} label={row.label} />;
          if (row.kind === 'unread') return <Separator key={row.key} label={t('chat_new_messages')} tone="unread" />;
          const isChairSender = chairNames.includes(row.group.sender);
          return (
            <ChatMessageGroup
              key={row.key}
              group={row.group}
              isChairSender={isChairSender}
              showIdentity={multiParty}
              senderLabel={labelForSender(row.group.sender)}
              onRetry={onRetry}
              onOpenImage={setLightboxId}
              t={t}
              locale={locale}
            />
          );
        })}
      </div>

      {lightboxId && lightboxItems.length > 0 && (
        <ChatLightbox
          items={lightboxItems}
          openId={lightboxId}
          onOpenId={setLightboxId}
          onClose={() => setLightboxId(null)}
          t={t}
        />
      )}

      {/* Jump-to-latest pill */}
      {newPill && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.96]"
          style={{
            bottom: 12, padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})`,
            color: NEU.gold, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
            boxShadow: '0 6px 18px rgba(27,56,40,0.32)',
          }}
        >
          <ArrowDown size={15} strokeWidth={2.6} aria-hidden /> {t('chat_new_messages')}
        </button>
      )}
    </div>
  );
}
