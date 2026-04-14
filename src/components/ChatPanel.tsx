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

type ConvKey = 'everyone' | 'chairs' | string;

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
}: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
}) {
  const [activeConv, setActiveConv] = useState<ConvKey>('everyone');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  // For chairs: DM search
  const [dmSearch, setDmSearch] = useState('');
  const [showDmSearch, setShowDmSearch] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { chairNames, currentSpeaker } = committee;

  // ── Build conversations ───────────────────────────────────────────────────

  const conversations = useMemo<Conversation[]>(() => {
    const allMsgs = committee.messages.filter((m) => !isSystemLog(m.content));
    const everyoneMsgs = allMsgs.filter((m) => !m.isPrivate);

    const chairsMsgs = isChair
      ? []
      : allMsgs.filter((m) => {
          if (!m.isPrivate) return false;
          if (m.sender === senderName && m.recipient === 'Chairs') return true;
          if (chairNames.includes(m.sender) && m.recipient === senderName) return true;
          return false;
        });

    const privatePartners = new Set<string>();
    if (isChair) {
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
        return { key: country, label: country, emoji: flagFor(country), messages: msgs };
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

  // Suggest current speaker when opening a new compose (chairs only)
  useEffect(() => {
    if (isChair && currentSpeaker && !msg && activeConv === 'everyone') {
      // Don't auto-fill; just a placeholder hint — handled in placeholder
    }
  }, [currentSpeaker, isChair, activeConv, msg]);

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
    setShowDmSearch(false);
    setDmSearch('');
    inputRef.current?.focus();
  };

  // Delegates available for new DM (chairs can DM anyone; delegates see peers)
  const dmCandidates = isChair
    ? committee.delegates
        .filter((d) => d.country !== senderName)
        .sort((a, b) => a.country.localeCompare(b.country))
    : committee.delegates
        .filter((d) => d.country !== senderName && !chairNames.includes(d.country))
        .sort((a, b) => a.country.localeCompare(b.country));

  const filteredDmCandidates = dmSearch.trim()
    ? dmCandidates.filter((d) => d.country.toLowerCase().includes(dmSearch.toLowerCase()))
    : dmCandidates;

  const compose = (
    <div className="shrink-0 border-t border-[#2E1E0F] px-3 py-3">
      {/* Suggest current speaker for chairs */}
      {isChair && currentSpeaker && activeConv === 'everyone' && (
        <button
          onClick={() => selectConv(currentSpeaker.country)}
          className="w-full mb-2 text-left px-3 py-2 bg-[#7B4A1E]/10 border border-[#7B4A1E]/30 rounded-lg text-xs text-[#B8844A] hover:bg-[#7B4A1E]/20 transition-colors flex items-center gap-2"
        >
          <span className="shrink-0">🎙️</span>
          <span className="truncate">Message current speaker: <strong>{currentSpeaker.country}</strong></span>
        </button>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder={
            activeConv === 'everyone'
              ? isChair ? 'Announce to committee…' : 'Message the committee…'
              : activeConv === 'chairs'
              ? 'Message to chairs…'
              : `Message to ${activeConv}…`
          }
          className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E] placeholder-[#7A5A38] transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!msg.trim() || sending}
          className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          {sending ? '…' : '→'}
        </button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  // Layout: LEFT = conversation list + compose | RIGHT = message thread

  return (
    <div className="flex h-full bg-[#0D0906] overflow-hidden">

      {/* ── Left pane: conversation list + compose ─────────────────────── */}
      <div className="flex flex-col w-52 shrink-0 border-r border-[#2E1E0F] bg-[#0D0906]">

        {/* Header */}
        <div className="px-3 py-3 border-b border-[#2E1E0F] shrink-0 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Messages</h3>
          <button
            onClick={() => { setShowDmSearch((v) => !v); setDmSearch(''); }}
            className="text-[#7A5A38] hover:text-[#C4A882] text-xs transition-colors"
            title="New DM"
          >
            ✏️
          </button>
        </div>

        {/* DM search (chairs: start new thread to any delegate) */}
        {showDmSearch && (
          <div className="px-3 py-2 border-b border-[#2E1E0F] shrink-0">
            <input
              type="text"
              value={dmSearch}
              onChange={(e) => setDmSearch(e.target.value)}
              placeholder="Search delegate…"
              autoFocus
              className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#7B4A1E] placeholder-[#7A5A38]"
            />
            <div className="mt-1 max-h-28 overflow-y-auto space-y-0.5">
              {filteredDmCandidates.slice(0, 8).map((d) => (
                <button
                  key={d.id}
                  onClick={() => selectConv(d.country)}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#3D2A15] text-xs text-[#E8D5B7] flex items-center gap-1.5 transition-colors"
                >
                  <span>{flagFor(d.country)}</span>
                  <span className="truncate">{d.country}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation rows */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {conversations.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isActive = conv.key === activeConv;
            const unread = conv.messages.length;
            return (
              <button
                key={conv.key}
                onClick={() => selectConv(conv.key)}
                className={`w-full text-left px-3 py-2.5 border-b border-[#2E1E0F] transition-colors ${
                  isActive ? 'bg-[#3D2A15] border-l-2 border-l-[#7B4A1E]' : 'hover:bg-[#1A1209]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm shrink-0">{conv.emoji}</span>
                  <span className="text-xs font-semibold text-white truncate flex-1">{conv.label}</span>
                  {unread > 0 && (
                    <span className="text-[9px] bg-[#7B4A1E] text-white rounded-full px-1.5 py-0.5 font-bold shrink-0">{unread}</span>
                  )}
                </div>
                {lastMsg && (
                  <p className="text-[10px] text-[#7A5A38] truncate mt-0.5 pl-5">
                    {displayContent(lastMsg.content)}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Compose — bottom of left pane */}
        {compose}
      </div>

      {/* ── Right pane: message thread only ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Thread header */}
        <div className="px-4 py-3 border-b border-[#2E1E0F] shrink-0 flex items-center gap-2">
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
                  <div className={`max-w-[90%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 text-[10px] flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && <span className="font-mono">{flagFor(m.sender)}</span>}
                      <span className={`font-bold ${isChairMsg ? 'text-[#B8844A]' : 'text-[#C4A882]'}`}>
                        {isMe ? 'You' : m.sender}
                        {isChairMsg && !isMe && ' · Chair'}
                      </span>
                      {speechRef && <span className="text-[#7B4A1E]">🎙️ <span className="text-[#7A5A38]">re: speech</span></span>}
                      <span className="text-[#7A5A38]">{formatTime(m.timestamp)}</span>
                    </div>
                    <div className={`rounded-2xl px-3 py-2 text-sm leading-snug break-words ${
                      isMe
                        ? 'bg-[#7B4A1E] text-white rounded-br-sm'
                        : isChairMsg
                        ? 'bg-[#3D2A15]/60 border border-[#7B4A1E]/30 text-[#E8D5B7] rounded-bl-sm'
                        : 'bg-[#1A1209] border border-[#2E1E0F] text-[#E8D5B7] rounded-bl-sm'
                    }`}>
                      {text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
