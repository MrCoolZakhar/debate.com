'use client';

import { useState, useRef, useEffect } from 'react';
import { Committee } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

export default function ChatPanel({ committee, senderName }: { committee: Committee; senderName: string }) {
  const { sendMessage } = useCommitteeStore();
  const [msg, setMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [committee.messages]);

  const handleSend = () => {
    if (!msg.trim()) return;
    sendMessage(committee.id, senderName, msg.trim());
    setMsg('');
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
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isChair ? 'text-blue-400' : 'text-[#c0c8d8]'}`}>
                    {m.sender} {isChair && '(Chair)'}
                  </span>
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
      <div className="p-4 border-t border-[#1e2540]">
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
            onClick={handleSend}
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
