'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Committee, ChatMessage } from '@/lib/types';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';
import { sendMessage as sendMessageToDB } from '@/lib/committeeService';
import { useT } from '@/contexts/LanguageContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isSpeechComment(content: string): boolean {
  return content.startsWith('[🎙️] ');
}

function displayContent(content: string): string {
  return content.startsWith('[🎙️] ') ? content.slice(5) : content;
}

function isSystemLog(content: string): boolean {
  return content.startsWith('__log__:');
}

function flagFor(country: string): string {
  const c = getCountryByName(country);
  return c ? getFlagEmoji(c.code) : '🌐';
}

function formatTime(ts: Date): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ConvKey = 'everyone' | 'chairs' | string; // string = countryName

interface Conversation {
  key: ConvKey;
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
  onConvRead,
}: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
  onClose?: () => void;
  readOnly?: boolean;
  onConvRead?: (key: string, count: number) => void;
  initialReadCounts?: Record<string, number>;
  onReadCountsChange?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  speakerCard?: React.ReactNode;
}) {
  const t = useT();
  const [activeConv, setActiveConv] = useState<ConvKey>('everyone');
  const [showThread, setShowThread] = useState(false); // mobile: false=list, true=thread
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [draftConv, setDraftConv] = useState<ConvKey | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { chairNames } = committee;

  // ── Build conversations ───────────────────────────────────────────────────

  const conversations = useMemo<Conversation[]>(() => {
    const allMsgs = committee.messages.filter((m) => !isSystemLog(m.content));

    // --- Everyone: public messages ---
    const everyoneMsgs = allMsgs.filter((m) => !m.isPrivate);

    // --- Chairs conversation (delegate view only) ---
    const chairsMsgs = isChair
      ? []
      : allMsgs.filter((m) => {
          if (!m.isPrivate) return false;
          // My messages to Chairs
          if (m.sender === senderName && m.recipient === 'Chairs') return true;
          // Chair messages back to me
          if (chairNames.includes(m.sender) && m.recipient === senderName) return true;
          return false;
        });

    // --- Per-country private threads ---
    // Collect all countries that have exchanged private messages with senderName
    const privatePartners = new Set<string>();

    if (isChair) {
      // Chairs see per-delegate threads: delegate->Chairs plus any chair->delegate
      allMsgs.forEach((m) => {
        if (!m.isPrivate) return;
        if (m.recipient === 'Chairs' && !chairNames.includes(m.sender)) {
          privatePartners.add(m.sender);
        }
        if (chairNames.includes(m.sender) && m.recipient && !chairNames.includes(m.recipient) && m.recipient !== 'Chairs') {
          privatePartners.add(m.recipient);
        }
      });
    } else {
      // Delegates see threads with other delegates (not chairs, that's the Chairs conv)
      allMsgs.forEach((m) => {
        if (!m.isPrivate) return;
        if (m.sender === senderName && m.recipient && m.recipient !== 'Chairs') {
          privatePartners.add(m.recipient);
        }
        if (m.recipient === senderName && !chairNames.includes(m.sender)) {
          privatePartners.add(m.sender);
        }
      });
    }

    const countryConvs: Conversation[] = Array.from(privatePartners)
      .sort()
      .map((country) => {
        let msgs: ChatMessage[];
        if (isChair) {
          msgs = allMsgs.filter(
            (m) =>
              m.isPrivate &&
              ((m.sender === country && m.recipient === 'Chairs') ||
                (chairNames.includes(m.sender) && m.recipient === country))
          );
        } else {
          msgs = allMsgs.filter(
            (m) =>
              m.isPrivate &&
              ((m.sender === senderName && m.recipient === country) ||
                (m.sender === country && m.recipient === senderName))
          );
        }
        return {
          key: country,
          label: country,
          emoji: flagFor(country),
          messages: msgs,
        };
      });

    const result: Conversation[] = [
      { key: 'everyone', label: 'Everyone', emoji: '📢', messages: everyoneMsgs },
    ];

    if (!isChair) {
      result.push({ key: 'chairs', label: 'Chairs', emoji: '🪑', messages: chairsMsgs });
    }

    result.push(...countryConvs);

    if (draftConv && !result.find((c) => c.key === draftConv)) {
      result.push({
        key: draftConv,
        label: draftConv,
        emoji: flagFor(draftConv),
        messages: [],
      });
    }

    return result;
  }, [committee.messages, senderName, isChair, chairNames, draftConv]);

  const activeConvObj = conversations.find((c) => c.key === activeConv) ?? conversations[0];

  // ── Clear draftConv once real messages arrive ─────────────────────────────
  useEffect(() => {
    if (!draftConv) return;
    const hasMessages = conversations.find((c) => c.key === draftConv)?.messages.length ?? 0;
    if (hasMessages > 0) setDraftConv(null);
  }, [conversations, draftConv]);

  // ── Notify parent when active conv messages change ────────────────────────
  useEffect(() => {
    if (activeConvObj) {
      onConvRead?.(activeConv, activeConvObj.messages.length);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvObj?.messages.length]);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvObj?.messages.length]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = msg.trim();
    if (!content || sending) return;

    setSending(true);

    let isPrivate = false;
    let recipient: string | undefined;

    if (activeConv === 'everyone') {
      isPrivate = false;
    } else if (activeConv === 'chairs') {
      isPrivate = true;
      recipient = 'Chairs';
    } else {
      isPrivate = true;
      recipient = activeConv;
    }

    await sendMessageToDB(committee.id, senderName, content, isPrivate, recipient);
    setMsg('');
    setSending(false);
    inputRef.current?.focus();
  };

  const selectConv = (key: ConvKey) => {
    setActiveConv(key);
    setShowThread(true);
    setShowNewDM(false);
    const conv = conversations.find((c) => c.key === key);
    if (conv) onConvRead?.(key, conv.messages.length);
    if (!conv) setDraftConv(key);
  };

  const goBack = () => {
    setShowThread(false);
    setShowNewDM(false);
  };

  // Delegates available for new DM
  const dmCandidates = committee.delegates
    .filter((d) => d.country !== senderName && !chairNames.includes(d.country))
    .sort((a, b) => a.country.localeCompare(b.country));

  // Co-chairs available for DM (chair view only) — other chairs in the committee
  const coChairCandidates = isChair
    ? chairNames.filter((n) => n !== senderName).map((n) => ({ id: n, country: n, isCoChair: true }))
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ backgroundColor: '#EDE7D8' }}>

      {/* Grain texture overlay */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      {/* ── Left pane: conversation list ─────────────────────────────────── */}
      <div
        className={`relative z-10 flex flex-col shrink-0 w-64 ${showThread ? 'hidden sm:flex' : 'flex'}`}
        style={{ backgroundColor: '#1B3828', borderRight: '1px solid #3D7A52' }}
      >
        {/* Grain on forest panel */}
        <div className="pointer-events-none absolute inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.07 }} />

        {/* List header */}
        <div className="relative z-10 px-4 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
          <h3 className="font-black text-base tracking-wide" style={{ color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>{t('chat_messages_header')}</h3>
        </div>

        {/* Conversation rows */}
        <div className="relative z-10 flex-1 overflow-y-auto min-h-0">
          {conversations.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isActive = conv.key === activeConv;
            const count = conv.messages.length;
            return (
              <button
                key={conv.key}
                onClick={() => selectConv(conv.key)}
                className="w-full text-left px-4 py-3 transition-colors focus:outline-none"
                style={{
                  backgroundColor: isActive ? 'rgba(238,217,138,0.12)' : 'transparent',
                  borderLeft: isActive ? '3px solid #EED98A' : '3px solid transparent',
                  borderBottom: '1px solid rgba(61,122,82,0.25)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-bold truncate" style={{ color: isActive ? '#EED98A' : '#A8C5B0' }}>{conv.label}</span>
                  </div>
                  {count > 0 && (
                    <span className="text-[10px] rounded-full px-1.5 py-0.5 font-black leading-none shrink-0" style={{ backgroundColor: '#EED98A', color: '#1B3828' }}>
                      {count}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(168,197,176,0.7)' }}>
                    {lastMsg.sender === senderName ? `${t('chat_you_prefix')}: ` : `${lastMsg.sender}: `}
                    {displayContent(lastMsg.content)}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* New private message — available to both chairs and delegates */}
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
                        className="w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors focus:outline-none flex items-center gap-2"
                        style={{ color: '#EDE7D8' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(238,217,138,0.2)', color: '#EED98A' }}>CHAIR</span>
                        <span className="truncate">{c.country}</span>
                      </button>
                    ))}
                    {dmCandidates.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest px-2 py-1 mt-1" style={{ color: 'rgba(238,217,138,0.5)' }}>{t('chat_delegates')}</p>}
                  </>
                )}
                {dmCandidates.map((d) => (
                  <button key={d.id} onClick={() => selectConv(d.country)}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors focus:outline-none"
                    style={{ color: '#EDE7D8' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                    <span className="truncate">{d.country}</span>
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

        {/* Thread header */}
        <div className="px-5 py-4 shrink-0 flex items-center gap-3" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: 'rgba(250,248,243,0.6)' }}>
          <button onClick={goBack} className="sm:hidden text-lg leading-none focus:outline-none" style={{ color: '#1B3828' }} aria-label="Back">←</button>
          <div className="min-w-0">
            <h3 className="font-black text-base truncate" style={{ color: '#1B3828' }}>{activeConvObj.label}</h3>
            <p className="text-xs" style={{ color: '#9A8A78' }}>{activeConvObj.messages.length === 1 ? t('chat_message_count_one') : t('chat_message_count_other').replace('{n}', String(activeConvObj.messages.length))}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {activeConvObj.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm font-semibold" style={{ color: '#9A8A78' }}>{t('chat_no_messages')}</p>
              <p className="text-xs mt-1" style={{ color: '#C8BAA8' }}>{t('chat_send_first')}</p>
            </div>
          ) : (
            activeConvObj.messages.map((m) => {
              const isMe = m.sender === senderName;
              const isChairMsg = chairNames.includes(m.sender);
              const text = displayContent(m.content);
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 text-[10px] flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && <span className="font-bold" style={{ color: isChairMsg ? '#B8844A' : '#6A5A4A' }}>{m.sender}{isChairMsg && !isMe ? ` ${t('chat_chair_badge')}` : ''}</span>}
                      {isMe && <span className="font-bold" style={{ color: '#6A5A4A' }}>{t('chat_you_prefix')}</span>}
                      <span style={{ color: '#9A8A78' }}>{formatTime(m.timestamp)}</span>
                    </div>
                    <div className="rounded-2xl px-3.5 py-2 text-sm leading-snug break-words"
                      style={{
                        backgroundColor: isMe ? '#1B3828' : '#FAF8F3',
                        color: isMe ? '#EDE7D8' : '#1C1410',
                        border: isMe ? 'none' : '1px solid #DDD4C0',
                        borderBottomRightRadius: isMe ? '4px' : '16px',
                        borderBottomLeftRadius: isMe ? '16px' : '4px',
                      }}>
                      {text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

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
                disabled={!msg.trim() || sending}
                className="px-4 py-2.5 rounded-xl text-sm font-black transition-colors focus:outline-none"
                style={{ backgroundColor: msg.trim() && !sending ? '#1B3828' : '#DDD4C0', color: msg.trim() && !sending ? '#EDE7D8' : '#9A8A78' }}>
                {sending ? '…' : '→'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
