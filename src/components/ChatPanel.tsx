'use client';

import { useState, useRef, useEffect } from 'react';
import { Committee } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

const QUICK_PHRASES = [
  '👍 Good speech',
  '💡 Liked your idea',
  '📋 Add me to the list',
  '🤝 Let\'s collaborate',
];

export default function ChatPanel({ committee, senderName }: { committee: Committee; senderName: string }) {
  const { sendMessage } = useCommitteeStore();
  const [msg, setMsg] = useState('');
  const [recipient, setRecipient] = useState('Everyone');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [committee.messages]);

  const presentDelegates = committee.delegates.filter((d) => d.status !== 'absent');

  const handleSend = (text?: string) => {
    const content = text ?? msg.trim();
    if (!content) return;

    let finalContent = content;
    let isPrivate = false;
    let recipientField: string | undefined;

    if (recipient === 'Everyone') {
      isPrivate = false;
    } else if (recipient === 'Chairs') {
      isPrivate = true;
      finalContent = `[To Chairs] ${content}`;
      recipientField = 'Chairs';
    } else {
      isPrivate = true;
      finalContent = `[To ${recipient}] ${content}`;
      recipientField = recipient;
    }

    sendMessage(committee.id, senderName, finalContent, isPrivate, recipientField);
    if (!text) setMsg('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#1e2540]">
        <h3 className="font-bold text-white">Committee Chat</h3>
        <p className="text-[#8892aa] text-xs mt-0.5">{committee.messages.length} messages</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {committee.messages.length === 0 ? (
          <div className="text-center py-8 text-[#4a5580] text-sm">No messages yet</div>
        ) : (
          committee.messages.map((m) => {
            const isChair = m.sender === committee.chairName;
            return (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold ${isChair ? 'text-blue-400' : 'text-[#c0c8d8]'}`}>
                    {m.sender} {isChair && '(Chair)'}
                  </span>
                  {m.recipient && (
                    <span className="text-[#7A5A38] text-xs">→ {m.recipient}</span>
                  )}
                  <span className="text-xs text-[#4a5580]">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`text-sm rounded-xl px-3 py-2 ${
                  isChair
                    ? 'bg-blue-900/30 border border-blue-800/20 text-blue-100'
                    : 'bg-[#141929] border border-[#1e2540] text-[#c0c8d8]'
                }`}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t border-[#1e2540] space-y-2">
        {/* Quick-send phrases */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              onClick={() => handleSend(phrase)}
              className="text-xs bg-[#150F09] border border-[#2E1E0F] text-[#C4A882] rounded-lg px-2.5 py-1 hover:border-[#7B4A1E] hover:text-white transition-colors"
            >
              {phrase}
            </button>
          ))}
        </div>

        {/* Recipient selector */}
        <select
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="w-full bg-[#150F09] border border-[#2E1E0F] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7B4A1E]"
        >
          <option value="Everyone">Everyone</option>
          <option value="Chairs">Chairs</option>
          {presentDelegates.map((d) => (
            <option key={d.id} value={d.country}>{d.country}</option>
          ))}
        </select>

        {/* Text input + send */}
        <div className="flex gap-2">
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600 placeholder-[#4a5580]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!msg.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
