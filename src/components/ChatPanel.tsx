'use client';

import { useState, useRef, useEffect, useMemo, ReactNode } from 'react';
import { Committee, ChatMessage } from '@/lib/types';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';
import { sendMessage as sendMessageToDB } from '@/lib/committeeService';

function isSystemLog(c: string) { return c.startsWith('__log__:'); }
function displayContent(c: string) { return c.startsWith('[🎙️] ') ? c.slice(5) : c; }
function flagFor(country: string) { const c = getCountryByName(country); return c ? getFlagEmoji(c.code) : '🌐'; }
function fmtTime(ts: Date) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

type ConvKey = 'everyone' | 'chairs' | string;
interface Conversation { key: ConvKey; label: string; emoji: string; messages: ChatMessage[]; }

export default function ChatPanel({ committee, senderName, isChair = false, onClose, speakerCard }: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
  onClose: () => void;
  speakerCard?: ReactNode;
}) {
  const [activeConv, setActiveConv] = useState<ConvKey>('everyone');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { chairNames, currentSpeaker } = committee;

  const conversations = useMemo<Conversation[]>(() => {
    const allMsgs = committee.messages.filter((m) => !isSystemLog(m.content));
    const everyoneMsgs = allMsgs.filter((m) => !m.isPrivate);
    const chairsMsgs = isChair ? [] : allMsgs.filter((m) => {
      if (!m.isPrivate) return false;
      if (m.sender === senderName && m.recipient === 'Chairs') return true;
      if (chairNames.includes(m.sender) && m.recipient === senderName) return true;
      return false;
    });
    const privatePartners = new Set<string>();
    if (isChair) {
      allMsgs.forEach((m) => {
        if (!m.isPrivate) return;
        // Delegate→Chairs thread: surfaced per delegate
        if (m.recipient === 'Chairs' && !chairNames.includes(m.sender)) privatePartners.add(m.sender);
        // Chair→Delegate direct thread
        if (chairNames.includes(m.sender) && m.recipient && !chairNames.includes(m.recipient) && m.recipient !== 'Chairs') privatePartners.add(m.recipient);
        // Chair↔Chair direct thread
        if (chairNames.includes(m.sender) && m.recipient && chairNames.includes(m.recipient)) {
          if (m.sender === senderName) privatePartners.add(m.recipient);
          if (m.recipient === senderName) privatePartners.add(m.sender);
        }
      });
    } else {
      allMsgs.forEach((m) => {
        if (!m.isPrivate) return;
        if (m.sender === senderName && m.recipient && m.recipient !== 'Chairs') privatePartners.add(m.recipient);
        if (m.recipient === senderName && !chairNames.includes(m.sender)) privatePartners.add(m.sender);
      });
    }
    const countryConvs: Conversation[] = Array.from(privatePartners).sort().map((partner) => {
      const isChairPartner = isChair && chairNames.includes(partner);
      const msgs = allMsgs.filter((m) => m.isPrivate && (
        isChair
          ? isChairPartner
            // Chair↔Chair: direct exchange
            ? ((m.sender === senderName && m.recipient === partner) || (m.sender === partner && m.recipient === senderName))
            // Chair↔Delegate: delegate sent to Chairs, or chair replied directly
            : ((m.sender === partner && m.recipient === 'Chairs') || (chairNames.includes(m.sender) && m.recipient === partner))
          : ((m.sender === senderName && m.recipient === partner) || (m.sender === partner && m.recipient === senderName))
      ));
      return { key: partner, label: partner, emoji: isChairPartner ? '🪑' : flagFor(partner), messages: msgs };
    });
    const result: Conversation[] = [{ key: 'everyone', label: 'Everyone', emoji: '📢', messages: everyoneMsgs }];
    if (!isChair) result.push({ key: 'chairs', label: 'Chairs', emoji: '🪑', messages: chairsMsgs });
    result.push(...countryConvs);
    return result;
  }, [committee.messages, senderName, isChair, chairNames]);

  const activeConvObj = conversations.find((c) => c.key === activeConv) ?? conversations[0];

  // Clear optimistic messages when real ones arrive
  useEffect(() => {
    if (localMessages.length > 0) setLocalMessages([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.messages.length]);

  // Merge real + local optimistic messages for display
  const displayMessages = useMemo(() => {
    const relevant = localMessages.filter((m) => {
      if (activeConv === 'everyone') return !m.isPrivate;
      if (activeConv === 'chairs') return m.isPrivate && m.recipient === 'Chairs';
      return m.isPrivate && (m.recipient === activeConv || m.sender === activeConv);
    });
    return [...activeConvObj.messages, ...relevant];
  }, [activeConvObj.messages, localMessages, activeConv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  const handleSend = () => {
    const content = msg.trim();
    if (!content || sending) return;
    setMsg('');
    const isPrivate = activeConv !== 'everyone';
    const recipient = activeConv === 'everyone' ? undefined : activeConv === 'chairs' ? 'Chairs' : activeConv;
    const optMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      sender: senderName,
      content,
      timestamp: new Date(),
      isPrivate,
      recipient,
    };
    setLocalMessages((prev) => [...prev, optMsg]);
    setSending(true);
    sendMessageToDB(committee.id, senderName, content, isPrivate, recipient)
      .finally(() => { setSending(false); inputRef.current?.focus(); });
  };

  const selectConv = (key: ConvKey) => {
    setActiveConv(key);
    setShowDmPicker(false);
    setDmSearch('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // DM candidates: for chairs, other chairs + all delegates; for delegates, other non-chair delegates
  const chairDmOptions = isChair
    ? chairNames.filter((n) => n !== senderName).map((n) => ({ id: `chair-${n}`, key: n, label: n, emoji: '🪑' }))
    : [];
  const delegateDmOptions = (isChair
    ? committee.delegates.filter((d) => d.country !== senderName)
    : committee.delegates.filter((d) => d.country !== senderName && !chairNames.includes(d.country))
  ).sort((a, b) => a.country.localeCompare(b.country))
   .map((d) => ({ id: d.id, key: d.country, label: d.country, emoji: flagFor(d.country) }));

  const allDmOptions = [...chairDmOptions, ...delegateDmOptions];
  const filteredDm = dmSearch.trim()
    ? allDmOptions.filter((o) => o.label.toLowerCase().includes(dmSearch.toLowerCase()))
    : allDmOptions;

  return (
    <div className="flex w-full h-full bg-[#0D0906] overflow-hidden">

      {/* LEFT: conversation list — 280px, WhatsApp-style */}
      <div className="flex flex-col w-[280px] shrink-0 border-r border-[#2E1E0F] bg-[#0A0705]">

        {/* Delegate-only: countdown-to-speech card, pinned above conversation list */}
        {speakerCard && (
          <div className="shrink-0 border-b border-[#2E1E0F] p-3">
            {speakerCard}
          </div>
        )}

        <div className="px-3 py-3 border-b border-[#2E1E0F] shrink-0">
          <h3 className="font-black text-white text-base">Messages</h3>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {conversations.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isActive = conv.key === activeConv;
            return (
              <button key={conv.key} type="button" onClick={() => selectConv(conv.key)}
                className={`w-full text-left px-3 py-3 border-b border-[#2E1E0F] transition-colors ${isActive ? 'bg-[#3D2A15] border-l-2 border-l-[#7B4A1E]' : 'hover:bg-[#1A1209]'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl shrink-0">{conv.emoji}</span>
                  <span className="text-sm font-bold text-white truncate flex-1">{conv.label}</span>
                  {conv.messages.length > 0 && (
                    <span className="text-[10px] bg-[#7B4A1E] text-white rounded-full px-1.5 py-0.5 font-bold shrink-0">{conv.messages.length}</span>
                  )}
                </div>
                {lastMsg && (
                  <p className="text-xs text-[#7A5A38] truncate mt-1 pl-7">{displayContent(lastMsg.content)}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* DM picker — above new message button */}
        {showDmPicker && (
          <div className="border-t border-[#2E1E0F] px-3 py-2 bg-[#0D0906] shrink-0">
            <input type="text" value={dmSearch} onChange={(e) => setDmSearch(e.target.value)}
              placeholder="Search…" autoFocus
              className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#7B4A1E] placeholder-[#7A5A38] mb-1" />
            <div className="max-h-36 overflow-y-auto space-y-0.5">
              {filteredDm.slice(0, 8).map((o) => (
                <button key={o.id} type="button" onClick={() => selectConv(o.key)}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#3D2A15] text-sm text-[#E8D5B7] flex items-center gap-2 transition-colors">
                  <span className="text-base">{o.emoji}</span>
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* New DM button */}
        <button type="button"
          onClick={() => { setShowDmPicker((v) => !v); setDmSearch(''); }}
          className={`mx-3 mt-2 mb-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border ${showDmPicker ? 'bg-[#7B4A1E] border-[#8B5A2B] text-white' : 'bg-[#150F09] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'}`}>
          ✏️ New message
        </button>

        {/* Current speaker shortcut (chair only) */}
        {isChair && currentSpeaker && (
          <button type="button" onClick={() => selectConv(currentSpeaker.country)}
            className="mx-3 mb-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-900/20 border border-orange-700/30 text-orange-300 hover:bg-orange-800/30 transition-colors flex items-center gap-1.5">
            <span>🎙️</span>
            <span className="truncate">{currentSpeaker.country}</span>
          </button>
        )}
      </div>

      {/* RIGHT: full message thread */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Thread header — close button top-right */}
        <div className="px-4 py-3 border-b border-[#2E1E0F] shrink-0 flex items-center gap-2.5">
          <span className="text-2xl">{activeConvObj.emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-white text-base truncate">{activeConvObj.label}</h3>
            <p className="text-xs text-[#7A5A38]">{displayMessages.length} message{displayMessages.length !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" onClick={onClose}
            className="ml-2 shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#7A5A38] hover:text-white hover:bg-[#2E1E0F] transition-colors font-bold text-base">
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {displayMessages.length === 0 ? (
            <div className="text-center py-12 text-[#7A5A38]">
              <div className="text-3xl mb-3">💬</div>
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
                      {!isMe && <span className="text-2xl">{flagFor(m.sender)}</span>}
                      <span className={`text-base font-black ${isChairMsg ? 'text-[#B8844A]' : isMe ? 'text-[#C4A882]' : 'text-white'}`}>
                        {isMe ? 'You' : m.sender}{isChairMsg && !isMe && ' · Chair'}
                      </span>
                      <span className="text-xs text-[#7A5A38]">{fmtTime(m.timestamp)}</span>
                      {isOptimistic && <span className="text-[10px] text-[#7A5A38]">sending…</span>}
                    </div>
                    <div className={`rounded-2xl px-4 py-3 text-base leading-relaxed break-words ${
                      isMe
                        ? 'bg-[#7B4A1E] text-white rounded-br-sm'
                        : isChairMsg
                        ? 'bg-[#3D2A15]/60 border border-[#7B4A1E]/30 text-[#E8D5B7] rounded-bl-sm'
                        : 'bg-[#1A1209] border border-[#2E1E0F] text-[#E8D5B7] rounded-bl-sm'
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

        {/* Compose — bottom of thread, not sidebar */}
        <div className="px-4 pb-4 pt-3 shrink-0 border-t border-[#2E1E0F]">
          <div className="flex gap-2">
            <input ref={inputRef} type="text" value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
              placeholder={activeConv === 'everyone' ? 'Message everyone…' : activeConv === 'chairs' ? 'Message chairs…' : `Message ${activeConv}…`}
              className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7B4A1E] placeholder-[#7A5A38] transition-colors" />
            <button type="button" onClick={handleSend} disabled={!msg.trim() || sending}
              className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors shrink-0">
              {sending ? '…' : '→'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
