'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Committee, ChatMessage } from '@/lib/types';
import { getFlagEmoji, getCountryByName, getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { sendMessage as sendMessageToDB } from '@/lib/committeeService';
import { buildChatConversations, chatConvUnread, chatIncomingCount, type ChatConvKey } from '@/lib/chatConversations';
import { useT, useLanguage } from '@/contexts/LanguageContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function displayContent(content: string): string {
  return content.startsWith('[🎙️] ') ? content.slice(5) : content;
}

function flagFor(country: string): string {
  const c = getCountryByName(country);
  return c ? getFlagEmoji(c.code) : '🌐';
}

function formatTime(ts: Date): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Optimistic (not-yet-confirmed) outgoing message held locally until its realtime echo lands.
interface PendingMsg {
  id: string;
  convKey: ChatConvKey;
  sender: string;
  content: string;
  isPrivate: boolean;
  recipient?: string;
  timestamp: Date;
}

interface Conversation {
  key: ChatConvKey;
  label: string;
  emoji: string;
  messages: ChatMessage[];
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ChatPanel({
  committee,
  senderName,
  isChair = false,
  onClose,
  readOnly = false,
  readCounts = {},
  onReadCountsChange,
}: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
  onClose?: () => void;
  readOnly?: boolean;
  readCounts?: Record<string, number>;
  onReadCountsChange?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [activeConv, setActiveConv] = useState<ChatConvKey>('everyone');
  const [showThread, setShowThread] = useState(false); // mobile: false=list, true=thread
  const [msg, setMsg] = useState('');
  const [showNewDM, setShowNewDM] = useState(false);
  const [draftConv, setDraftConv] = useState<ChatConvKey | null>(null);
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [newPill, setNewPill] = useState(false);

  const { chairNames } = committee;

  const sendingLabel = language === 'ar' ? 'جارٍ الإرسال…' : language === 'fr' ? 'Envoi…' : language === 'es' ? 'Enviando…' : 'Sending…';
  const newMsgsLabel = language === 'ar' ? 'رسائل جديدة' : language === 'fr' ? 'Nouveaux messages' : language === 'es' ? 'Mensajes nuevos' : 'New messages';

  // ── Build conversations (shared grouping) ─────────────────────────────────
  const conversations = useMemo<Conversation[]>(() => {
    const labelFor = (key: ChatConvKey) => key === 'everyone' ? t('chat_everyone') : key === 'chairs' ? t('chat_chairs_label') : getCountryDisplayName(key, language);
    const emojiFor = (key: ChatConvKey) => key === 'everyone' ? '📢' : key === 'chairs' ? '🪑' : flagFor(key);
    const list: Conversation[] = buildChatConversations(committee.messages, senderName, isChair, chairNames)
      .map((c) => ({ key: c.key, messages: c.messages, label: labelFor(c.key), emoji: emojiFor(c.key) }));
    if (draftConv && !list.find((c) => c.key === draftConv)) {
      list.push({ key: draftConv, label: getCountryDisplayName(draftConv, language), emoji: flagFor(draftConv), messages: [] });
    }
    return list;
  }, [committee.messages, senderName, isChair, chairNames, draftConv, t, language]);

  const activeConvObj = conversations.find((c) => c.key === activeConv) ?? conversations[0];
  const activePending = pending.filter((p) => p.convKey === activeConv);

  // ── Reconcile optimistic messages once their real echo arrives ─────────────
  // Match only against newly-seen message ids so a delegate's historical duplicate
  // (or clock skew) can never prematurely clear a fresh pending bubble.
  useEffect(() => {
    const fresh = committee.messages.filter((m) => !seenIdsRef.current.has(m.id));
    fresh.forEach((m) => seenIdsRef.current.add(m.id));
    if (fresh.length === 0) return;
    setPending((prev) => prev.length === 0 ? prev : prev.filter((p) => !fresh.some((m) =>
      m.sender === p.sender &&
      m.content === p.content &&
      !!m.isPrivate === !!p.isPrivate &&
      (m.recipient ?? undefined) === (p.recipient ?? undefined)
    )));
  }, [committee.messages]);

  // ── Clear draftConv once real messages arrive ─────────────────────────────
  useEffect(() => {
    if (!draftConv) return;
    if ((conversations.find((c) => c.key === draftConv)?.messages.length ?? 0) > 0) setDraftConv(null);
  }, [conversations, draftConv]);

  // ── Mark the active conversation read (incoming high-water mark) ───────────
  const markRead = useCallback((key: ChatConvKey, conv?: Conversation) => {
    if (!onReadCountsChange) return;
    const c = conv ?? conversations.find((x) => x.key === key);
    if (!c) return;
    const incoming = chatIncomingCount(c, senderName);
    onReadCountsChange((prev) => (prev[key] === incoming ? prev : { ...prev, [key]: incoming }));
  }, [conversations, onReadCountsChange, senderName]);

  useEffect(() => {
    if (activeConvObj) markRead(activeConv, activeConvObj);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv, activeConvObj?.messages.length]);

  // ── Scroll handling: stick to bottom only when already there ───────────────
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    if (near) setNewPill(false);
  };

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    atBottomRef.current = true;
    setNewPill(false);
  };

  const totalShown = activeConvObj ? activeConvObj.messages.length + activePending.length : 0;
  const prevTotalRef = useRef(0);
  useEffect(() => {
    const grew = totalShown > prevTotalRef.current;
    prevTotalRef.current = totalShown;
    if (atBottomRef.current) scrollToBottom(false);
    else if (grew) setNewPill(true);
  }, [totalShown]);

  // Jump to bottom instantly when switching threads
  useEffect(() => {
    prevTotalRef.current = totalShown;
    scrollToBottom(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv]);

  // ── Send (optimistic) ──────────────────────────────────────────────────────
  const handleSend = () => {
    const content = msg.trim();
    if (!content || readOnly) return;

    let isPrivate = false;
    let recipient: string | undefined;
    if (activeConv === 'chairs') { isPrivate = true; recipient = 'Chairs'; }
    else if (activeConv !== 'everyone') { isPrivate = true; recipient = activeConv; }

    setPending((prev) => [...prev, {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      convKey: activeConv, sender: senderName, content, isPrivate, recipient, timestamp: new Date(),
    }]);
    setMsg('');
    atBottomRef.current = true;
    // Fire-and-forget, the bubble is already on screen; the echo will reconcile it.
    sendMessageToDB(committee.id, senderName, content, committee.code, isChair ? (committee.dbChairJoinSuffix ?? undefined) : undefined, isPrivate, recipient);
    requestAnimationFrame(() => { scrollToBottom(false); inputRef.current?.focus(); });
  };

  const selectConv = (key: ChatConvKey) => {
    setActiveConv(key);
    setShowThread(true);
    setShowNewDM(false);
    const conv = conversations.find((c) => c.key === key);
    if (conv) markRead(key, conv);
    else setDraftConv(key);
  };

  const goBack = () => { setShowThread(false); setShowNewDM(false); };

  // Delegates available for a new DM
  const dmCandidates = committee.delegates
    .filter((d) => d.country !== senderName && !chairNames.includes(d.country))
    .sort((a, b) => compareCountryNames(a.country, b.country, language));

  const coChairCandidates = isChair
    ? chairNames.filter((n) => n !== senderName).map((n) => ({ id: n, country: n }))
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden" style={{ backgroundColor: '#EDE7D8' }}>

      <div className="pointer-events-none absolute inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      {/* ── Left pane: conversation list ─────────────────────────────────── */}
      <div
        className={`relative z-10 flex flex-col shrink-0 w-64 ${showThread ? 'hidden sm:flex' : 'flex'}`}
        style={{ backgroundColor: '#1B3828', borderRight: '1px solid #3D7A52' }}
      >
        <div className="pointer-events-none absolute inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.07 }} />

        <div className="relative z-10 px-4 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
          <h3 className="font-black text-base tracking-wide" style={{ color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>{t('chat_messages_header')}</h3>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto min-h-0">
          {conversations.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isActive = conv.key === activeConv;
            const unread = chatConvUnread({ key: conv.key, messages: conv.messages }, readCounts, senderName);
            return (
              <button
                key={conv.key}
                onClick={() => selectConv(conv.key)}
                className="w-full text-start px-4 py-3 transition-colors focus:outline-none"
                style={{
                  backgroundColor: isActive ? 'rgba(238,217,138,0.12)' : 'transparent',
                  borderLeft: isActive ? '3px solid #EED98A' : '3px solid transparent',
                  borderBottom: '1px solid rgba(61,122,82,0.25)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-bold truncate" style={{ color: isActive ? '#EED98A' : unread > 0 ? '#EDE7D8' : '#A8C5B0' }}>{conv.label}</span>
                  </div>
                  {unread > 0 && !isActive && (
                    <span className="text-[10px] rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center font-black leading-none shrink-0" style={{ backgroundColor: '#EED98A', color: '#1B3828' }}>
                      {unread}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: unread > 0 && !isActive ? 'rgba(237,231,216,0.85)' : 'rgba(168,197,176,0.7)' }}>
                    {lastMsg.sender === senderName ? `${t('chat_you_prefix')}: ` : `${lastMsg.sender}: `}
                    {displayContent(lastMsg.content)}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative z-10 px-3 py-3 shrink-0" style={{ borderTop: '1px solid rgba(61,122,82,0.4)' }}>
          {showNewDM ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold" style={{ color: '#EED98A' }}>{t('chat_new_message')}</span>
                <button onClick={() => setShowNewDM(false)} className="text-xs focus:outline-none" style={{ color: '#A8C5B0' }}>✕</button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {isChair && coChairCandidates.length > 0 && (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest px-2 py-1" style={{ color: 'rgba(238,217,138,0.5)' }}>{t('chat_co_chairs')}</p>
                    {coChairCandidates.map((c) => (
                      <button key={c.id} onClick={() => selectConv(c.country)}
                        className="w-full text-start px-2 py-1.5 rounded-lg text-sm transition-colors focus:outline-none flex items-center gap-2"
                        style={{ color: '#EDE7D8' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(238,217,138,0.2)', color: '#EED98A' }}>{t('chat_chair_tag')}</span>
                        <span className="truncate">{getCountryDisplayName(c.country, language)}</span>
                      </button>
                    ))}
                    {dmCandidates.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest px-2 py-1 mt-1" style={{ color: 'rgba(238,217,138,0.5)' }}>{t('chat_delegates')}</p>}
                  </>
                )}
                {dmCandidates.map((d) => (
                  <button key={d.id} onClick={() => selectConv(d.country)}
                    className="w-full text-start px-2 py-1.5 rounded-lg text-sm transition-colors focus:outline-none"
                    style={{ color: '#EDE7D8' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                    <span className="truncate">{getCountryDisplayName(d.country, language)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewDM(true)}
              className="w-full text-xs py-2 rounded-lg transition-colors focus:outline-none font-semibold"
              style={{ color: '#EED98A', border: '1px solid rgba(238,217,138,0.3)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#EED98A'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(238,217,138,0.3)'; }}>
              {t('chat_new_message_btn')}
            </button>
          )}
        </div>
      </div>

      {/* ── Right pane: thread ────────────────────────────────────────────── */}
      <div className={`relative z-10 flex-1 flex flex-col min-w-0 ${showThread ? 'flex' : 'hidden sm:flex'}`}>

        <div className="px-5 py-4 shrink-0 flex items-center gap-3" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: 'rgba(250,248,243,0.6)' }}>
          <button onClick={goBack} className="sm:hidden text-lg leading-none focus:outline-none" style={{ color: '#1B3828' }} aria-label="Back"><span className="inline-block rtl:-scale-x-100">←</span></button>
          <div className="min-w-0">
            <h3 className="font-black text-base truncate" style={{ color: '#1B3828' }}>{activeConvObj?.label}</h3>
            <p className="text-xs" style={{ color: '#9A8A78' }}>{(activeConvObj?.messages.length ?? 0) === 1 ? t('chat_message_count_one') : t('chat_message_count_other').replace('{n}', String(activeConvObj?.messages.length ?? 0))}</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {(activeConvObj?.messages.length ?? 0) === 0 && activePending.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm font-semibold" style={{ color: '#9A8A78' }}>{t('chat_no_messages')}</p>
              <p className="text-xs mt-1" style={{ color: '#C8BAA8' }}>{t('chat_send_first')}</p>
            </div>
          ) : (
            <>
              {activeConvObj?.messages.map((m) => {
                const isMe = m.sender === senderName;
                const isChairMsg = chairNames.includes(m.sender);
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-1.5 text-[10px] flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && <span className="font-bold" style={{ color: isChairMsg ? '#B8844A' : '#6A5A4A' }}>{m.sender}{isChairMsg ? ` ${t('chat_chair_badge')}` : ''}</span>}
                        {isMe && <span className="font-bold" style={{ color: '#6A5A4A' }}>{t('chat_you_prefix')}</span>}
                        <span style={{ color: '#9A8A78' }}>{formatTime(m.timestamp)}</span>
                      </div>
                      <div className="rounded-2xl px-3.5 py-2 text-sm leading-snug break-words"
                        style={{ backgroundColor: isMe ? '#1B3828' : '#FAF8F3', color: isMe ? '#EDE7D8' : '#1C1410', border: isMe ? 'none' : '1px solid #DDD4C0', borderBottomRightRadius: isMe ? '4px' : '16px', borderBottomLeftRadius: isMe ? '16px' : '4px' }}>
                        {displayContent(m.content)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Optimistic (sending) bubbles */}
              {activePending.map((p) => (
                <div key={p.id} className="flex justify-end">
                  <div className="max-w-[78%] flex flex-col gap-0.5 items-end">
                    <div className="flex items-center gap-1.5 text-[10px] justify-end">
                      <span className="font-bold" style={{ color: '#6A5A4A' }}>{t('chat_you_prefix')}</span>
                      <span style={{ color: '#B8844A' }}>{sendingLabel}</span>
                    </div>
                    <div className="rounded-2xl px-3.5 py-2 text-sm leading-snug break-words" style={{ backgroundColor: '#1B3828', color: '#EDE7D8', opacity: 0.6, borderBottomRightRadius: '4px' }}>
                      {displayContent(p.content)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* New-messages pill (only when scrolled up) */}
        {newPill && (
          <button onClick={() => scrollToBottom(true)}
            className="absolute left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full text-xs font-black shadow-lg transition-colors focus:outline-none"
            style={{ bottom: '76px', backgroundColor: '#1B3828', color: '#EED98A' }}>
            ↓ {newMsgsLabel}
          </button>
        )}

        {/* Compose */}
        <div className="px-4 pb-4 pt-3 shrink-0" style={{ borderTop: '1px solid #DDD4C0', backgroundColor: 'rgba(250,248,243,0.6)' }}>
          {readOnly ? (
            <p className="text-xs text-center py-2" style={{ color: '#9A8A78' }}>{t('chat_view_only')}</p>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                placeholder={t('chat_placeholder')}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #DDD4C0', color: '#1C1410' }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              />
              <button
                onClick={handleSend}
                disabled={!msg.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-black transition-colors focus:outline-none"
                style={{ backgroundColor: msg.trim() ? '#1B3828' : '#DDD4C0', color: msg.trim() ? '#EDE7D8' : '#9A8A78' }}>
                <span className="inline-block rtl:-scale-x-100">→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
