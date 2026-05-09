'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Committee, ChatMessage } from '@/lib/types';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';
import { sendMessage as sendMessageToDB } from '@/lib/committeeService';

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
}: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
  onClose?: () => void;
  readOnly?: boolean;
  initialReadCounts?: Record<string, number>;
  onReadCountsChange?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  speakerCard?: React.ReactNode;
}) {
  const [activeConv, setActiveConv] = useState<ConvKey>('everyone');
  const [showThread, setShowThread] = useState(false); // mobile: false=list, true=thread
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
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
    return result;
  }, [committee.messages, senderName, isChair, chairNames]);

  const activeConvObj = conversations.find((c) => c.key === activeConv) ?? conversations[0];

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
  };

  const goBack = () => {
    setShowThread(false);
    setShowNewDM(false);
  };

  // Delegates available for new DM
  const dmCandidates = committee.delegates
    .filter((d) => d.country !== senderName && !chairNames.includes(d.country))
    .sort((a, b) => a.country.localeCompare(b.country));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-[#0D0906] overflow-hidden">
      {/* ── Left pane: conversation list ─────────────────────────────────── */}
      <div
        className={`
          flex flex-col shrink-0 border-r border-[#2E1E0F] bg-[#0D0906]
          w-full sm:w-60
          ${showThread ? 'hidden sm:flex' : 'flex'}
        `}
      >
        {/* List header */}
        <div className="px-4 py-3 border-b border-[#2E1E0F] shrink-0">
          <h3 className="font-bold text-white text-sm">Messages</h3>
        </div>

        {/* Conversation rows */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {conversations.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isActive = conv.key === activeConv;
            const count = conv.messages.length;

            return (
              <button
                key={conv.key}
                onClick={() => selectConv(conv.key)}
                className={`
                  w-full text-left px-4 py-3 border-b border-[#2E1E0F] transition-colors
                  ${isActive
                    ? 'bg-[#3D2A15] border-l-2 border-l-[#7B4A1E]'
                    : 'hover:bg-[#1A1209]'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{conv.emoji}</span>
                    <span className="text-sm font-semibold text-white truncate">{conv.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {count > 0 && (
                      <span className="text-[10px] bg-[#7B4A1E] text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
                        {count}
                      </span>
                    )}
                  </div>
                </div>
                {lastMsg && (
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="text-xs text-[#C4A882] truncate">
                      {lastMsg.sender === senderName ? 'You: ' : `${lastMsg.sender}: `}
                      {displayContent(lastMsg.content)}
                    </p>
                    <span className="text-[10px] text-[#7A5A38] shrink-0">
                      {formatTime(lastMsg.timestamp)}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* New private message (delegate only) */}
        {!isChair && (
          <div className="px-3 py-3 border-t border-[#2E1E0F] shrink-0">
            {showNewDM ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#C4A882] font-semibold">New message to…</span>
                  <button
                    onClick={() => setShowNewDM(false)}
                    className="text-[#7A5A38] hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  {dmCandidates.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => selectConv(d.country)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#3D2A15] text-sm text-[#E8D5B7] flex items-center gap-2 transition-colors"
                    >
                      <span>{flagFor(d.country)}</span>
                      <span className="truncate">{d.country}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewDM(true)}
                className="w-full text-xs text-[#C4A882] border border-[#2E1E0F] rounded-lg py-2 hover:border-[#7B4A1E] hover:text-white transition-colors"
              >
                + New private message
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Right pane: thread ────────────────────────────────────────────── */}
      <div
        className={`
          flex-1 flex flex-col min-w-0
          ${showThread ? 'flex' : 'hidden sm:flex'}
        `}
      >
        {/* Thread header */}
        <div className="px-4 py-3 border-b border-[#2E1E0F] shrink-0 flex items-center gap-3">
          {/* Back button (mobile) */}
          <button
            onClick={goBack}
            className="sm:hidden text-[#C4A882] hover:text-white text-lg leading-none"
            aria-label="Back to conversations"
          >
            ←
          </button>
          <span className="text-base">{activeConvObj.emoji}</span>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm truncate">{activeConvObj.label}</h3>
            <p className="text-[10px] text-[#7A5A38]">
              {activeConvObj.messages.length} message{activeConvObj.messages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
          {activeConvObj.messages.length === 0 ? (
            <div className="text-center py-10 text-[#7A5A38] text-sm">
              <div className="text-2xl mb-2">💬</div>
              No messages yet
            </div>
          ) : (
            activeConvObj.messages.map((m) => {
              const isMe = m.sender === senderName;
              const isChairMsg = chairNames.includes(m.sender);
              const speechRef = isSpeechComment(m.content);
              const text = displayContent(m.content);

              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Sender + meta */}
                    <div className={`flex items-center gap-1.5 text-[10px] flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <span className="font-mono">{flagFor(m.sender)}</span>
                      )}
                      <span className={`font-bold ${isChairMsg ? 'text-[#B8844A]' : isMe ? 'text-[#C4A882]' : 'text-[#C4A882]'}`}>
                        {isMe ? 'You' : m.sender}
                        {isChairMsg && !isMe && ' · Chair'}
                      </span>
                      {speechRef && (
                        <span className="text-[#7B4A1E] flex items-center gap-0.5">
                          🎙️ <span className="text-[#7A5A38]">re: speech</span>
                        </span>
                      )}
                      <span className="text-[#7A5A38]">{formatTime(m.timestamp)}</span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-snug break-words ${
                        isMe
                          ? 'bg-[#7B4A1E] text-white rounded-br-sm'
                          : isChairMsg
                          ? 'bg-[#3D2A15]/60 border border-[#7B4A1E]/30 text-[#E8D5B7] rounded-bl-sm'
                          : 'bg-[#1A1209] border border-[#2E1E0F] text-[#E8D5B7] rounded-bl-sm'
                      }`}
                    >
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
        <div className="px-3 pb-3 pt-2 border-t border-[#2E1E0F] shrink-0">
          {readOnly ? (
            <p className="text-xs text-[#7A5A38] text-center py-2">Session ended — chat is view only</p>
          ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder={
                activeConv === 'everyone'
                  ? 'Message the committee…'
                  : activeConv === 'chairs'
                  ? 'Message to chairs…'
                  : `Message to ${activeConv}…`
              }
              className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E] placeholder-[#7A5A38] transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!msg.trim() || sending}
              className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              {sending ? '…' : '→'}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
