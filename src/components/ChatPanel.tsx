'use client';

import React, { useState, useRef, useEffect, useMemo, ReactNode } from 'react';
import { Emoji } from '@/components/Emoji';
import { Committee, ChatMessage } from '@/lib/types';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { sendMessage as sendMessageToDB } from '@/lib/committeeService';

function isSystemLog(c: string) { return c.startsWith('__log__:'); }
function displayContent(c: string) { return c.startsWith('[🎙️] ') ? c.slice(5) : c; }
function flagFor(country: string): ReactNode { const c = getCountryByName(country); return c ? <img src={getFlagUrl(c.code)} alt={c.code} className="w-4 h-4 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1rem">🌐</Emoji>; }
function fmtTime(ts: Date) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

type ConvKey = 'everyone' | string;
interface Conversation { key: ConvKey; label: string; emoji: ReactNode; messages: ChatMessage[]; }
interface DmOption { id: string; key: string; label: string; emoji: ReactNode; }

export default function ChatPanel({ committee, senderName, isChair = false, onClose, speakerCard, initialReadCounts, onReadCountsChange, readOnly }: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
  onClose: () => void;
  speakerCard?: ReactNode;
  initialReadCounts?: Record<string, number>;
  onReadCountsChange?: (counts: Record<string, number>) => void;
  readOnly?: boolean;
}) {
  const [activeConv, setActiveConv] = useState<ConvKey>('everyone');
  const [msg, setMsg] = useState('');
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [dmHighlight, setDmHighlight] = useState(0);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  // convKey → count of received (not sent by me) messages that have been seen
  const [readCounts, setReadCounts] = useState<Record<string, number>>(initialReadCounts ?? {});
  const updateReadCounts = (updater: (prev: Record<string, number>) => Record<string, number>) => {
    setReadCounts((prev) => {
      const next = updater(prev);
      onReadCountsChange?.(next);
      return next;
    });
  };
  // Ephemeral draft thread: created when DM picker selects a new conversation with no messages yet.
  // Disappears if user navigates away without sending; persists once a message is sent.
  const [draftThread, setDraftThread] = useState<{ key: string; label: string; emoji: ReactNode } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { chairNames, currentSpeaker } = committee;

  // ---------------------------------------------------------------------------
  // Build conversation list
  // ---------------------------------------------------------------------------
  const conversations = useMemo<Conversation[]>(() => {
    const allMsgs = committee.messages.filter((m) => !isSystemLog(m.content));
    const everyoneMsgs = allMsgs.filter((m) => !m.isPrivate);

    // Collect 1-to-1 conversation partners
    const privatePartners = new Set<string>();

    if (isChair) {
      allMsgs.forEach((m) => {
        if (!m.isPrivate) return;
        // Delegate→Chairs group (all chairs see this under that delegate)
        if (m.recipient === 'Chairs' && !chairNames.includes(m.sender)) privatePartners.add(m.sender);
        // Delegate→this chair directly
        if (!chairNames.includes(m.sender) && m.recipient === senderName) privatePartners.add(m.sender);
        // Any chair→delegate (so all chairs can follow the conversation)
        if (chairNames.includes(m.sender) && m.recipient && !chairNames.includes(m.recipient) && m.recipient !== 'Chairs') {
          privatePartners.add(m.recipient);
        }
        // Chair↔Chair direct
        if (chairNames.includes(m.sender) && m.recipient && chairNames.includes(m.recipient)) {
          if (m.sender === senderName) privatePartners.add(m.recipient);
          if (m.recipient === senderName) privatePartners.add(m.sender);
        }
      });
      // Always show all other chairs in the left panel (even with no messages yet)
      chairNames.forEach((n) => { if (n !== senderName) privatePartners.add(n); });
    } else {
      allMsgs.forEach((m) => {
        if (!m.isPrivate) return;
        // Delegate↔Delegate direct (non-chair)
        if (m.sender === senderName && m.recipient && !chairNames.includes(m.recipient) && m.recipient !== 'Chairs') {
          privatePartners.add(m.recipient);
        }
        if (m.recipient === senderName && !chairNames.includes(m.sender)) privatePartners.add(m.sender);
        // Delegate↔Individual chair direct
        if (m.sender === senderName && m.recipient && chairNames.includes(m.recipient)) privatePartners.add(m.recipient);
        if (chairNames.includes(m.sender) && m.recipient === senderName) privatePartners.add(m.sender);
      });
      // Always show all chairs as individual conversation slots for delegates
      chairNames.forEach((n) => privatePartners.add(n));
    }

    const countryConvs: Conversation[] = Array.from(privatePartners).sort().map((partner) => {
      const isChairPartner = chairNames.includes(partner);
      let msgs: ChatMessage[];

      if (isChair) {
        if (isChairPartner) {
          // Chair↔Chair: only their direct exchange
          msgs = allMsgs.filter((m) => m.isPrivate &&
            ((m.sender === senderName && m.recipient === partner) ||
             (m.sender === partner && m.recipient === senderName))
          );
        } else {
          // Chair viewing a delegate thread:
          //   delegate→Chairs group | delegate→this chair directly | any chair→delegate
          msgs = allMsgs.filter((m) => m.isPrivate && (
            (m.sender === partner && m.recipient === 'Chairs') ||
            (m.sender === partner && m.recipient === senderName) ||
            (chairNames.includes(m.sender) && m.recipient === partner)
          ));
        }
      } else {
        // Delegate viewing individual thread (chair or fellow delegate):
        //   only their direct bilateral exchange
        msgs = allMsgs.filter((m) => m.isPrivate &&
          ((m.sender === senderName && m.recipient === partner) ||
           (m.sender === partner && m.recipient === senderName))
        );
      }

      return {
        key: partner,
        label: partner,
        emoji: isChairPartner ? '🪑' : flagFor(partner),
        messages: msgs,
      };
    });

    const result: Conversation[] = [
      { key: 'everyone', label: 'Everyone', emoji: '📢', messages: everyoneMsgs },
    ];
    result.push(...countryConvs);
    return result;
  }, [committee.messages, senderName, isChair, chairNames]);

  // Merge draft thread into left panel when it's for a truly new conversation
  const displayedConversations = useMemo(() => {
    if (!draftThread) return conversations;
    const exists = conversations.some((c) => c.key === draftThread.key);
    if (exists) return conversations;
    const draft: Conversation = { key: draftThread.key, label: draftThread.label, emoji: draftThread.emoji, messages: [] };
    const fixed = conversations.filter((c) => c.key === 'everyone');
    const dynamic = conversations.filter((c) => c.key !== 'everyone');
    return [...fixed, draft, ...dynamic];
  }, [conversations, draftThread]);

  const activeConvObj = displayedConversations.find((c) => c.key === activeConv) ?? displayedConversations[0];

  // ---------------------------------------------------------------------------
  // Optimistic messages: clear when real data arrives
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (localMessages.length === 0) return;
    setLocalMessages((prev) => prev.filter((local) => {
      return !committee.messages.some((real) =>
        real.sender === local.sender &&
        real.content === local.content &&
        real.recipient === local.recipient
      );
    }));
  }, [committee.messages]);

  // Merge real + local optimistic messages for display in the active thread
  const displayMessages = useMemo(() => {
    const relevant = localMessages.filter((m) => {
      if (activeConv === 'everyone') return !m.isPrivate;
      return m.isPrivate &&
        ((m.sender === senderName && m.recipient === activeConv) ||
         (m.sender === activeConv && m.recipient === senderName));
    });
    return [...activeConvObj.messages, ...relevant];
  }, [activeConvObj.messages, localMessages, activeConv, senderName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  // Auto-mark active conversation as read whenever messages or active conv changes
  useEffect(() => {
    const conv = displayedConversations.find((c) => c.key === activeConv);
    if (!conv) return;
    const received = conv.messages.filter((m) => m.sender !== senderName).length;
    updateReadCounts((prev) => ({ ...prev, [activeConv]: received }));
  }, [activeConv, committee.messages, senderName]);

  // Clear draft thread automatically once the real conversation appears
  useEffect(() => {
    if (!draftThread) return;
    const exists = conversations.some((c) => c.key === draftThread.key);
    if (exists) setDraftThread(null);
  }, [conversations, draftThread]);

  // ---------------------------------------------------------------------------
  // Unread count per conversation
  // ---------------------------------------------------------------------------
  function getUnread(conv: Conversation): number {
    const seen = readCounts[conv.key] ?? 0;
    const received = conv.messages.filter((m) => m.sender !== senderName).length;
    return Math.max(0, received - seen);
  }

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------
  const handleSend = () => {
    const content = msg.trim();
    if (!content) return;
    setMsg('');
    const isPrivate = activeConv !== 'everyone';
    const recipient = activeConv === 'everyone' ? undefined : activeConv;
    const optMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      sender: senderName,
      content,
      timestamp: new Date(),
      isPrivate,
      recipient,
    };
    setLocalMessages((prev) => [...prev, optMsg]);
    sendMessageToDB(committee.id, senderName, content, isPrivate, recipient);
    inputRef.current?.focus();
  };

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const selectConv = (key: ConvKey) => {
    // Mark as read immediately on click
    const conv = displayedConversations.find((c) => c.key === key);
    if (conv) {
      const received = conv.messages.filter((m) => m.sender !== senderName).length;
      updateReadCounts((prev) => ({ ...prev, [key]: received }));
    }
    // Discard draft thread if navigating away without having sent
    if (draftThread && draftThread.key !== key) setDraftThread(null);
    setActiveConv(key);
    setShowDmPicker(false);
    setDmSearch('');
    setDmHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ---------------------------------------------------------------------------
  // DM picker
  // ---------------------------------------------------------------------------
  const chairDmOptions: DmOption[] = isChair
    ? chairNames.filter((n) => n !== senderName).map((n) => ({ id: `chair-${n}`, key: n, label: n, emoji: '🪑' }))
    : chairNames.map((n) => ({ id: `chair-${n}`, key: n, label: n, emoji: '🪑' }));

  const delegateDmOptions: DmOption[] = committee.delegates
    .filter((d) => d.country !== senderName && !chairNames.includes(d.country) && d.status !== 'absent')
    .sort((a, b) => a.country.localeCompare(b.country))
    .map((d) => ({ id: d.id, key: d.country, label: d.country, emoji: flagFor(d.country) }));

  const allDmOptions: DmOption[] = [...chairDmOptions, ...delegateDmOptions];
  const filteredDm = dmSearch.trim()
    ? allDmOptions.filter((o) => o.label.toLowerCase().includes(dmSearch.toLowerCase()))
    : allDmOptions;

  const handleDmKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDmHighlight((h) => Math.min(h + 1, filteredDm.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDmHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredDm[dmHighlight];
      if (selected) startDmThread(selected);
    } else if (e.key === 'Escape') {
      setShowDmPicker(false);
      setDmSearch('');
    }
  };

  const startDmThread = (option: DmOption) => {
    // If conversation already exists in the left panel, just navigate
    const existing = conversations.find((c) => c.key === option.key);
    if (existing) {
      selectConv(option.key);
      return;
    }
    // New conversation: create a draft entry; it disappears if user leaves without sending
    setDraftThread({ key: option.key, label: option.label, emoji: option.emoji });
    setActiveConv(option.key);
    setShowDmPicker(false);
    setDmSearch('');
    setDmHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex w-full h-full bg-[#F6F1E9] overflow-hidden">

      {/* LEFT: conversation list — 280px, WhatsApp-style */}
      <div className="flex flex-col w-[280px] shrink-0 border-r border-[#DDD4C0] bg-[#0A0705]">

        {/* Delegate-only: countdown-to-speech card, pinned above conversation list */}
        {speakerCard && (
          <div className="shrink-0 border-b border-[#DDD4C0] p-3">
            {speakerCard}
          </div>
        )}

        <div className="px-3 py-3 border-b border-[#DDD4C0] shrink-0">
          <h3 className="font-black text-[#1C1410] text-base">Messages</h3>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {displayedConversations.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isActive = conv.key === activeConv;
            const unread = getUnread(conv);
            return (
              <button
                key={conv.key}
                type="button"
                onClick={() => selectConv(conv.key)}
                className={`w-full text-left px-3 py-3 border-b border-[#DDD4C0] transition-colors ${isActive ? 'bg-[#C8BAA8] border-l-2 border-l-[#1B3828]' : 'hover:bg-[#EDE7D8]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl shrink-0">{typeof conv.emoji === 'string' ? <Emoji size="1.25rem">{conv.emoji}</Emoji> : conv.emoji}</span>
                  <span className="text-sm font-bold text-[#1C1410] truncate flex-1">{conv.label}</span>
                  {unread > 0 && (
                    <span className="text-[10px] bg-[#1B3828] text-white rounded-full px-1.5 py-0.5 font-bold shrink-0 min-w-[18px] text-center">
                      {unread}
                    </span>
                  )}
                </div>
                {lastMsg ? (
                  <p className="text-xs text-[#9A8A78] truncate mt-1 pl-7">{displayContent(lastMsg.content)}</p>
                ) : conv.key === draftThread?.key ? (
                  <p className="text-xs text-[#9A8A78] truncate mt-1 pl-7 italic">New conversation…</p>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* DM picker — slides up above the new message button */}
        {showDmPicker && (
          <div className="border-t border-[#DDD4C0] px-3 py-2 bg-[#F6F1E9] shrink-0">
            <input
              type="text"
              value={dmSearch}
              onChange={(e) => { setDmSearch(e.target.value); setDmHighlight(0); }}
              onKeyDown={handleDmKeyDown}
              placeholder="Search…"
              autoFocus
              className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1.5 text-sm text-[#1C1410] focus:outline-none focus:border-[#1B3828] placeholder-[#9A8A78] mb-1"
            />
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {filteredDm.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => startDmThread(o)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm text-[#1C1410] flex items-center gap-2 transition-colors ${i === dmHighlight ? 'bg-[#C8BAA8]' : 'hover:bg-[#C8BAA8]'}`}
                >
                  <span className="text-base">{typeof o.emoji === 'string' ? <Emoji size="1rem">{o.emoji}</Emoji> : o.emoji}</span>
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
              {filteredDm.length === 0 && (
                <p className="text-xs text-[#9A8A78] px-2 py-2">No results</p>
              )}
            </div>
          </div>
        )}

        {/* New message button */}
        <button
          type="button"
          onClick={() => { setShowDmPicker((v) => !v); setDmSearch(''); setDmHighlight(0); }}
          className={`mx-3 mt-2 mb-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border ${showDmPicker ? 'bg-[#1B3828] border-[#2A5A3C] text-[#1C1410]' : 'bg-[#FAF8F3] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'}`}
        >
          <Emoji size="0.875rem">✏️</Emoji> New message
        </button>

        {/* Quick-jump to current speaker (chair only) */}
        {isChair && currentSpeaker && (
          <button
            type="button"
            onClick={() => selectConv(currentSpeaker.country)}
            className="mx-3 mb-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-900/20 border border-orange-700/30 text-orange-300 hover:bg-orange-800/30 transition-colors flex items-center gap-1.5"
          >
            <Emoji size="0.875rem">🎙️</Emoji>
            <span className="truncate">{currentSpeaker.country}</span>
          </button>
        )}
      </div>

      {/* RIGHT: full message thread */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Thread header */}
        <div className="px-4 py-3 border-b border-[#DDD4C0] shrink-0 flex items-center gap-2.5">
          <span className="text-2xl">{typeof activeConvObj.emoji === 'string' ? <Emoji size="1.5rem">{activeConvObj.emoji}</Emoji> : activeConvObj.emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-[#1C1410] text-base truncate">{activeConvObj.label}</h3>
            <p className="text-xs text-[#9A8A78]">{displayMessages.length} message{displayMessages.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#9A8A78] hover:text-[#1C1410] hover:bg-[#DDD4C0] transition-colors font-bold text-base"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {displayMessages.length === 0 ? (
            <div className="text-center py-12 text-[#9A8A78]">
              <div className="mb-3"><Emoji size="1.875rem">💬</Emoji></div>
              <p className="text-base">No messages yet</p>
            </div>
          ) : (
            displayMessages.map((m) => {
              const isMe = m.sender === senderName;
              const isChairMsg = chairNames.includes(m.sender);
              const text = displayContent(m.content);
              const isOptimistic = m.id.startsWith('opt-');
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <span className="text-2xl">{isChairMsg ? <Emoji size="1.5rem">🪑</Emoji> : flagFor(m.sender)}</span>
                      )}
                      <span className={`text-base font-black ${isChairMsg ? 'text-[#B6871F]' : isMe ? 'text-[#6A5A4A]' : 'text-[#1C1410]'}`}>
                        {isMe ? 'You' : m.sender}{isChairMsg && !isMe && ' · Chair'}
                      </span>
                      <span className="text-xs text-[#9A8A78]">{fmtTime(m.timestamp)}</span>
                      {isOptimistic && <span className="text-[10px] text-[#9A8A78]">sending…</span>}
                    </div>
                    <div className={`rounded-2xl px-4 py-3 text-base leading-relaxed break-words ${
                      isMe
                        ? 'bg-[#1B3828] text-white rounded-br-sm'
                        : isChairMsg
                        ? 'bg-[#C8BAA8]/60 border border-[#1B3828]/30 text-[#1C1410] rounded-bl-sm'
                        : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#1C1410] rounded-bl-sm'
                    } ${isOptimistic ? 'opacity-70' : ''}`}>
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
        {readOnly ? (
          <div className="px-4 py-3 text-xs text-[#9A8A78] text-center border-t border-[#DDD4C0]">Chat is view-only — session has ended.</div>
        ) : (
        <div className="px-4 pb-4 pt-3 shrink-0 border-t border-[#DDD4C0]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
              placeholder={activeConv === 'everyone' ? 'Message everyone…' : `Message ${activeConv}…`}
              className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-sm text-[#1C1410] focus:outline-none focus:border-[#1B3828] placeholder-[#9A8A78] transition-colors"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!msg.trim()}
              className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors shrink-0"
            >
              →
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
