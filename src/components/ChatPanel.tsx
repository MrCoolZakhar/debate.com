'use client';

import { useState, useRef, useEffect } from 'react';
import { Committee } from '@/lib/types';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';
import { sendMessage as sendMessageToDB } from '@/lib/committeeService';

const QUICK_PHRASES = [
  '👍 Strong speech',
  '🤝 Let\'s collaborate',
  '📝 I support this',
  '❓ I have a question',
  '💡 Point of information',
];

function isSpeechComment(content: string): boolean {
  return content.startsWith('[🎙️] ');
}

function displayContent(content: string): string {
  return content.startsWith('[🎙️] ') ? content.slice(5) : content;
}

function isSystemLog(content: string): boolean {
  return content.startsWith('__log__:');
}

export default function ChatPanel({
  committee,
  senderName,
  isChair = false,
}: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
}) {
  const [msg, setMsg] = useState('');
  const [recipient, setRecipient] = useState('Everyone');
  const [refSpeech, setRefSpeech] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const presentDelegates = committee.delegates.filter((d) => d.status !== 'absent');
  const isChairName = (name: string) => committee.chairNames.includes(name);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [committee.messages.length]);

  // Filter messages visible to this user
  const visibleMessages = committee.messages.filter((m) => {
    if (isSystemLog(m.content)) return false; // never show system logs in chat
    if (!m.isPrivate) return true; // public messages visible to all
    // Private: visible if I'm the sender, or the recipient matches me / my role
    if (m.sender === senderName) return true;
    if (m.recipient === senderName) return true;
    if (isChair && m.recipient === 'Chairs') return true;
    if (!isChair && m.recipient === 'Everyone') return true;
    return false;
  });

  const handleSend = async (text?: string) => {
    const content = (text ?? msg).trim();
    if (!content || sending) return;

    setSending(true);
    let isPrivate = false;
    let recipientField: string | undefined;
    let finalContent = refSpeech && !text ? `[🎙️] ${content}` : content;

    if (recipient === 'Everyone') {
      isPrivate = false;
    } else if (recipient === 'Chairs') {
      isPrivate = true;
      recipientField = 'Chairs';
    } else {
      isPrivate = true;
      recipientField = recipient;
    }

    await sendMessageToDB(committee.id, senderName, finalContent, isPrivate, recipientField);
    if (!text) {
      setMsg('');
      setRefSpeech(false);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const flagFor = (country: string) => {
    const c = getCountryByName(country);
    return c ? getFlagEmoji(c.code) : '🌐';
  };

  return (
    <div className="flex flex-col h-full bg-[#0D0906]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2E1E0F] shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Committee Chat</h3>
          <span className="text-[#7A5A38] text-xs font-mono">
            {visibleMessages.length} messages
          </span>
        </div>
        {committee.currentSpeaker && (
          <div className="mt-1.5 text-xs text-[#7A5A38] flex items-center gap-1.5">
            <span>🎙️</span>
            <span className="text-[#C4A882] font-medium">{committee.currentSpeaker.country}</span>
            <span>has the floor</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
        {visibleMessages.length === 0 ? (
          <div className="text-center py-10 text-[#7A5A38] text-sm">
            <div className="text-2xl mb-2">💬</div>
            No messages yet
          </div>
        ) : (
          visibleMessages.map((m) => {
            const isMe = m.sender === senderName;
            const isChairMsg = isChairName(m.sender);
            const speechRef = isSpeechComment(m.content);
            const text = displayContent(m.content);

            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {/* Sender + meta */}
                  <div className={`flex items-center gap-1.5 text-[10px] flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <span className="font-mono">{flagFor(m.sender)}</span>
                    )}
                    <span className={`font-bold ${isChairMsg ? 'text-[#B8844A]' : isMe ? 'text-[#7B4A1E]' : 'text-[#C4A882]'}`}>
                      {isMe ? 'You' : m.sender}
                      {isChairMsg && ' · Chair'}
                    </span>
                    {m.recipient && m.recipient !== 'Everyone' && (
                      <span className="text-[#7A5A38]">
                        → {m.recipient === 'Chairs' ? '🪑 Chairs' : `${flagFor(m.recipient)} ${m.recipient}`}
                      </span>
                    )}
                    {speechRef && (
                      <span className="text-[#7B4A1E] flex items-center gap-0.5">
                        🎙️ <span className="text-[#7A5A38]">re: speech</span>
                      </span>
                    )}
                    <span className="text-[#7A5A38]">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {/* Bubble */}
                  <div className={`rounded-2xl px-3 py-2 text-sm leading-snug ${
                    isMe
                      ? 'bg-[#7B4A1E] text-white rounded-br-sm'
                      : isChairMsg
                      ? 'bg-[#3D2A15]/60 border border-[#7B4A1E]/30 text-[#E8D5B7] rounded-bl-sm'
                      : speechRef
                      ? 'bg-[#1A1209] border border-[#7B4A1E]/20 text-[#E8D5B7] rounded-bl-sm'
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

      {/* Compose area */}
      <div className="px-3 pb-3 pt-2 border-t border-[#2E1E0F] space-y-2 shrink-0">
        {/* Quick phrases */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              onClick={() => handleSend(phrase)}
              disabled={sending}
              className="text-[10px] bg-[#150F09] border border-[#2E1E0F] text-[#C4A882] rounded-lg px-2 py-1 hover:border-[#7B4A1E] hover:text-white transition-colors"
            >
              {phrase}
            </button>
          ))}
        </div>

        {/* Recipient + speech-ref row */}
        <div className="flex gap-2">
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="flex-1 bg-[#150F09] border border-[#2E1E0F] text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#7B4A1E]"
          >
            <option value="Everyone">📢 Everyone</option>
            <option value="Chairs">🪑 Chairs only</option>
            {presentDelegates
              .filter((d) => d.country !== senderName)
              .sort((a, b) => a.country.localeCompare(b.country))
              .map((d) => (
                <option key={d.id} value={d.country}>
                  {flagFor(d.country)} {d.country}
                </option>
              ))}
          </select>

          {/* Speech reference toggle */}
          {committee.currentSpeaker && (
            <button
              onClick={() => setRefSpeech((v) => !v)}
              title={refSpeech ? 'Referencing current speech' : 'Click to reference current speech'}
              className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                refSpeech
                  ? 'bg-[#7B4A1E] border-[#7B4A1E] text-white'
                  : 'bg-[#150F09] border-[#2E1E0F] text-[#7A5A38] hover:border-[#7B4A1E] hover:text-[#C4A882]'
              }`}
            >
              🎙️
            </button>
          )}
        </div>

        {/* Message input + send */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder={
              refSpeech
                ? `Comment on ${committee.currentSpeaker?.country}'s speech…`
                : recipient === 'Chairs'
                ? 'Message to chairs…'
                : recipient === 'Everyone'
                ? 'Message the committee…'
                : `Message to ${recipient}…`
            }
            className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E] placeholder-[#7A5A38] transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={!msg.trim() || sending}
            className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
