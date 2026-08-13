'use client';

import { useRef } from 'react';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { chatConvUnread, type ChatConvKey } from '@/lib/chatConversations';
import type { ChatMessage } from '@/lib/types';
import { ChatAvatar, avatarKindFor } from './ChatAvatar';
import { CHAT, displayContent, formatTime, type TFn } from './chatTokens';

export interface ConvSummary {
  key: ChatConvKey;
  label: string;
  messages: ChatMessage[];
}

export default function ChatConversationList({
  conversations,
  activeConv,
  readCounts,
  senderName,
  chairNames,
  onSelect,
  onOpenNewDm,
  newDmOpen,
  newDmTriggerRef,
  t,
}: {
  conversations: ConvSummary[];
  activeConv: ChatConvKey;
  readCounts: Record<string, number>;
  senderName: string;
  chairNames: string[];
  onSelect: (key: ChatConvKey) => void;
  onOpenNewDm: () => void;
  newDmOpen: boolean;
  newDmTriggerRef: React.RefObject<HTMLButtonElement | null>;
  t: TFn;
}) {
  const hoverRef = useRef<string | null>(null);

  return (
    <div
      className="relative z-10 flex flex-col shrink-0 h-full"
      style={{ width: 280, backgroundColor: NEU.base, borderInlineEnd: `1px solid ${CHAT.hairline}` }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3">
        <h3
          style={{
            fontFamily: OUTFIT, fontWeight: 900, fontSize: 13, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: NEU.ink,
          }}
        >
          {t('chat_messages_header')}
        </h3>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-2 space-y-1.5">
        {conversations.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>
              {t('chat_no_conversations')}
            </p>
            <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, marginTop: 4 }}>
              {t('chat_no_conversations_hint')}
            </p>
          </div>
        ) : conversations.map((conv) => {
          const last = conv.messages[conv.messages.length - 1];
          const isActive = conv.key === activeConv;
          const unread = chatConvUnread({ key: conv.key, messages: conv.messages }, readCounts, senderName);
          return (
            <button
              key={conv.key}
              onClick={() => onSelect(conv.key)}
              className="w-full text-start focus:outline-none flex items-center gap-2.5"
              style={{
                padding: '9px 11px',
                borderRadius: 14,
                // Active row reads as a pressed-in well; resting rows are raised cards.
                backgroundColor: isActive ? NEU.base : NEU.surface,
                boxShadow: isActive ? NEU.inSm : NEU.outSm,
                transition: `box-shadow 160ms ${EASE}, transform 160ms ${EASE}`,
                cursor: 'pointer',
                border: 'none',
              }}
              onMouseEnter={(e) => { if (!isActive) { hoverRef.current = String(conv.key); (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; } }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
            >
              <ChatAvatar kind={avatarKindFor(String(conv.key), chairNames)} name={String(conv.key)} size={22} />

              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span
                    className="truncate"
                    style={{
                      fontFamily: OUTFIT, fontSize: 12.5,
                      fontWeight: unread > 0 ? 900 : 700,
                      color: NEU.ink,
                    }}
                  >
                    {conv.label}
                  </span>
                  {last && (
                    <span
                      className="shrink-0"
                      style={{ fontFamily: OUTFIT, fontSize: 9.5, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatTime(last.timestamp)}
                    </span>
                  )}
                </span>
                <span className="flex items-center justify-between gap-2" style={{ marginTop: 1 }}>
                  <span
                    className="truncate"
                    style={{ fontFamily: OUTFIT, fontSize: 11, color: unread > 0 ? NEU.ink : NEU.muted }}
                  >
                    {last
                      ? `${last.sender === senderName ? t('chat_you_prefix') : last.sender}: ${displayContent(last.content)}`
                      : ''}
                  </span>
                  {unread > 0 && !isActive && (
                    <span
                      className="shrink-0 inline-flex items-center justify-center"
                      style={{
                        minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                        background: `linear-gradient(135deg, ${NEU.gold}, ${NEU.deepGold})`,
                        color: NEU.forest, fontFamily: OUTFIT, fontWeight: 900, fontSize: 10,
                        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* New message trigger — the picker itself is portaled (see NewDmPicker). */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <button
          ref={newDmTriggerRef}
          onClick={onOpenNewDm}
          className="w-full focus:outline-none"
          style={{
            padding: '9px 12px',
            borderRadius: 999,
            backgroundColor: newDmOpen ? NEU.base : NEU.surface,
            boxShadow: newDmOpen ? NEU.inSm : NEU.outSm,
            color: NEU.ink,
            fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.04em',
            border: 'none', cursor: 'pointer',
            transition: `box-shadow 160ms ${EASE}`,
          }}
        >
          {t('chat_new_message_btn')}
        </button>
      </div>
    </div>
  );
}
