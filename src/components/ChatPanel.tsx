'use client';

import { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from 'react';
import { Committee } from '@/lib/types';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { sendMessage as sendMessageToDB } from '@/lib/committeeService';
import { markDelegateActivity } from '@/lib/delegateIdle';
import {
  buildChatConversations,
  chatIncomingCount,
  type ChatConvKey,
} from '@/lib/chatConversations';
import {
  useOutbox, addOutbox, markOutboxFailed, markOutboxSending,
  reconcileOutbox, newOutboxId, type OutboxMsg,
} from '@/lib/chatOutbox';
import { setViewingChatConversation, clearViewingChatConversation } from '@/lib/chatViewing';
import { dismissWhere, notifyKey } from '@/lib/sessionNotifications';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { NEU } from '@/components/neu';
import ChatConversationList, { type ConvSummary } from './chat/ChatConversationList';
import ChatThread from './chat/ChatThread';
import ChatComposer from './chat/ChatComposer';
import NewDmPicker from './chat/NewDmPicker';
import { CHAT } from './chat/chatTokens';

const LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES', fr: 'fr-FR', ar: 'ar' };

/* Tailwind's `sm` breakpoint. At and above it the list and the thread are side by side, so
   the active thread is on screen whether or not `showThread` is set; below it only one pane
   shows at a time. Must match the `sm:` classes in the render below. */
const WIDE_QUERY = '(min-width: 640px)';
function subscribeWide(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const getWide = () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE_QUERY).matches);

interface Conversation extends ConvSummary {
  key: ChatConvKey;
}

export default function ChatPanel({
  committee,
  senderName,
  isChair = false,
  readOnly = false,
  readCounts = {},
  onReadCountsChange,
}: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
  /** Retained for call-site compatibility; the panel no longer renders its own close control. */
  onClose?: () => void;
  readOnly?: boolean;
  readCounts?: Record<string, number>;
  onReadCountsChange?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  const t = useT();
  const { language } = useLanguage();
  const locale = LOCALES[language] ?? 'en-GB';

  const [activeConv, setActiveConv] = useState<ChatConvKey>('everyone');
  const [showThread, setShowThread] = useState(false); // mobile: false = list, true = thread
  const [msg, setMsg] = useState('');
  const [showNewDM, setShowNewDM] = useState(false);
  const [draftConv, setDraftConv] = useState<ChatConvKey | null>(null);
  // High-water mark captured when the thread was OPENED, so the "New messages" divider
  // survives the markRead that fires immediately on open.
  const [unreadAnchor, setUnreadAnchor] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const newDmTriggerRef = useRef<HTMLButtonElement>(null);

  const { chairNames } = committee;

  // Outbox is module-level and keyed by committee id, so in-flight and failed messages
  // survive this component unmounting (chat closing / delegate switching tab).
  const outbox = useOutbox(committee.id);

  // ── Conversations ─────────────────────────────────────────────────────────
  const conversations = useMemo<Conversation[]>(() => {
    const labelFor = (key: ChatConvKey) =>
      key === 'everyone' ? t('chat_everyone')
      : key === 'chairs' ? t('chat_chairs_label')
      : chairNames.includes(String(key)) ? String(key)
      : getCountryDisplayName(String(key), language);

    const list: Conversation[] = buildChatConversations(committee.messages, senderName, isChair, chairNames)
      .map((c) => ({ key: c.key, messages: c.messages, label: labelFor(c.key) }));

    if (draftConv && !list.find((c) => c.key === draftConv)) {
      list.push({ key: draftConv, label: labelFor(draftConv), messages: [] });
    }
    return list;
  }, [committee.messages, senderName, isChair, chairNames, draftConv, t, language]);

  const activeConvObj = conversations.find((c) => c.key === activeConv) ?? conversations[0];
  const activeKey = activeConvObj?.key ?? 'everyone';
  const activeOutbox = useMemo(
    () => outbox.filter((p) => p.convKey === activeKey),
    [outbox, activeKey],
  );

  // ── Retire outbox bubbles as their real rows arrive ───────────────────────
  // reconcileOutbox tracks seen ids itself, at module scope: only ids new to this committee
  // count, and each retires AT MOST ONE entry (RC5). Handing it the whole list is safe and is
  // what the parent pages' catch-up does too.
  useEffect(() => {
    reconcileOutbox(committee.id, committee.messages);
  }, [committee.messages, committee.id]);

  // ── Clear the draft thread once real messages land in it ──────────────────
  useEffect(() => {
    if (!draftConv) return;
    if ((conversations.find((c) => c.key === draftConv)?.messages.length ?? 0) > 0) setDraftConv(null);
  }, [conversations, draftConv]);

  // ── Is the active thread actually on screen? ─────────────────────────────
  // On a phone (the delegate sheet, a narrow chair window) the panel mounts on the LIST, with
  // `activeConv` still defaulting to 'everyone'. Treating that as "reading Everyone" marked the
  // thread read the instant the sheet opened and hid its badge, while the user was looking at
  // the list. Read-state and banner suppression both key off this instead of `activeConv`.
  const isWide = useSyncExternalStore(subscribeWide, getWide, () => true);
  const threadVisible = isWide || showThread;

  // ── Read state ────────────────────────────────────────────────────────────
  const markRead = useCallback((key: ChatConvKey, conv?: Conversation) => {
    if (!onReadCountsChange) return;
    const c = conv ?? conversations.find((x) => x.key === key);
    if (!c) return;
    const incoming = chatIncomingCount({ key: c.key, messages: c.messages }, senderName);
    onReadCountsChange((prev) => (prev[key] === incoming ? prev : { ...prev, [key]: incoming }));
  }, [conversations, onReadCountsChange, senderName]);

  // Re-marks on EVERY change to the visible thread's incoming count, not only on open, so a
  // message that lands while the user is reading it never leaves a badge behind. Keyed on
  // the incoming count rather than `messages.length` so it also re-runs when the thread is
  // replaced by one of equal length (a merge that swaps a row).
  const activeIncoming = activeConvObj ? chatIncomingCount({ key: activeConvObj.key, messages: activeConvObj.messages }, senderName) : 0;
  useEffect(() => {
    if (!threadVisible || !activeConvObj) return;
    markRead(activeConvObj.key, activeConvObj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvObj?.key, activeIncoming, threadVisible]);

  // ── Tell the notification producers which thread is on screen ────────────
  // Page effects read this to skip banners for the visible conversation; any banner already
  // raised for it is cleared the moment it comes into view. See src/lib/chatViewing.ts.
  const visibleKey = threadVisible ? activeKey : null;
  useEffect(() => {
    setViewingChatConversation(committee.id, visibleKey);
    if (visibleKey != null) dismissWhere(notifyKey.chatConversation(String(visibleKey)));
  }, [committee.id, visibleKey, activeIncoming]);
  useEffect(() => () => clearViewingChatConversation(committee.id), [committee.id]);

  // Anchor the unread divider for whichever thread is open on mount.
  const anchoredRef = useRef(false);
  useEffect(() => {
    if (anchoredRef.current) return;
    anchoredRef.current = true;
    setUnreadAnchor(readCounts[activeConv] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sending ───────────────────────────────────────────────────────────────
  const deliver = useCallback(async (entry: OutboxMsg) => {
    // RLS write-gate: this must keep going through sendMessage's sessionClient(code,
    // chairSuffix) routing with unchanged headers.
    const ok = await sendMessageToDB(
      committee.id, entry.sender, entry.content, committee.code,
      isChair ? (committee.dbChairJoinSuffix ?? undefined) : undefined,
      entry.isPrivate, entry.recipient,
    );
    // A failed send now renders a real failed state instead of a bubble that silently
    // evaporates on the next reconcile.
    if (!ok) markOutboxFailed(committee.id, entry.id);
  }, [committee.id, committee.code, committee.dbChairJoinSuffix, isChair]);

  const handleSend = () => {
    const content = msg.trim();
    if (!content || readOnly) return;
    // Counts as activity for the delegate idle logout. A no-op on every other surface.
    markDelegateActivity();

    let isPrivate = false;
    let recipient: string | undefined;
    if (activeConv === 'chairs') { isPrivate = true; recipient = 'Chairs'; }
    else if (activeConv !== 'everyone') { isPrivate = true; recipient = String(activeConv); }

    const entry: OutboxMsg = {
      id: newOutboxId(),
      convKey: activeConv,
      sender: senderName,
      content,
      isPrivate,
      recipient,
      timestamp: new Date(),
      status: 'sending',
    };
    addOutbox(committee.id, entry);
    setMsg('');
    void deliver(entry);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleRetry = useCallback((outboxId: string) => {
    const entry = outbox.find((o) => o.id === outboxId);
    if (!entry) return;
    markOutboxSending(committee.id, outboxId);
    void deliver({ ...entry, status: 'sending' });
  }, [outbox, committee.id, deliver]);

  // A failed bubble whose write actually landed (response lost) is retired by reconcileOutbox
  // itself, but only against a FRESH row — an older identical message can never mask a real
  // failure. See chatOutbox.reconcileOutbox.

  // ── Navigation ────────────────────────────────────────────────────────────
  const selectConv = (key: ChatConvKey) => {
    setUnreadAnchor(readCounts[key] ?? 0);
    setActiveConv(key);
    setShowThread(true);
    setShowNewDM(false);
    const conv = conversations.find((c) => c.key === key);
    if (conv) markRead(key, conv);
    else setDraftConv(key);
  };

  // ── DM candidates ─────────────────────────────────────────────────────────
  const dmDelegates = useMemo(() => committee.delegates
    .filter((d) => d.country !== senderName && !chairNames.includes(d.country))
    .sort((a, b) => compareCountryNames(a.country, b.country, language))
    .map((d) => d.country), [committee.delegates, senderName, chairNames, language]);

  const dmCoChairs = useMemo(
    () => (isChair ? chairNames.filter((n) => n !== senderName) : []),
    [isChair, chairNames, senderName],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden relative" style={{ backgroundColor: NEU.base }}>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', backgroundSize: '300px 300px',
          mixBlendMode: 'multiply', opacity: 0.14,
        }}
      />

      {/* Conversation list — hidden on mobile while a thread is open. */}
      <div className={`relative z-10 h-full ${showThread ? 'hidden sm:block' : 'block'} ${showThread ? '' : 'w-full sm:w-auto'}`}>
        <ChatConversationList
          conversations={conversations}
          /* On a phone the list and the thread never show together, so no row is "active"
             while the list is up — its badge must stay visible. */
          activeConv={threadVisible ? activeKey : ''}
          readCounts={readCounts}
          senderName={senderName}
          chairNames={chairNames}
          onSelect={selectConv}
          onOpenNewDm={() => setShowNewDM((v) => !v)}
          newDmOpen={showNewDM}
          newDmTriggerRef={newDmTriggerRef}
          t={t}
        />
      </div>

      {/* Thread */}
      <div
        className={`relative z-10 flex-1 flex flex-col min-w-0 ${showThread ? 'flex' : 'hidden sm:flex'}`}
        style={{ backgroundColor: CHAT.bubbleIn }}
      >
        {activeConvObj && (
          <ChatThread
            convKey={String(activeConvObj.key)}
            label={activeConvObj.label}
            messages={activeConvObj.messages}
            outbox={activeOutbox}
            senderName={senderName}
            chairNames={chairNames}
            unreadAnchor={unreadAnchor}
            onRetry={handleRetry}
            onBack={() => { setShowThread(false); setShowNewDM(false); }}
            isDraft={draftConv === activeConvObj.key}
            t={t}
            locale={locale}
          />
        )}
        <ChatComposer
          ref={inputRef}
          value={msg}
          onChange={setMsg}
          onSend={handleSend}
          readOnly={readOnly}
          t={t}
        />
      </div>

      {/* Portaled at fixed viewport coordinates — never clipped by the list's overflow. */}
      <NewDmPicker
        open={showNewDM}
        triggerRef={newDmTriggerRef}
        onClose={() => setShowNewDM(false)}
        onPick={selectConv}
        delegates={dmDelegates}
        coChairs={dmCoChairs}
        language={language}
        t={t}
      />
    </div>
  );
}
