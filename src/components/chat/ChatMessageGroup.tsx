'use client';

import { NEU, OUTFIT, EASE } from '@/components/neu';
import { ChatAvatar } from './ChatAvatar';
import { CHAT, formatTime, type ChatGroup, type TFn } from './chatTokens';

/**
 * One run of consecutive messages from a single sender inside the grouping window.
 *
 * Sender label + avatar render on the FIRST bubble only, the timestamp on the LAST, and the
 * bubble tail (the squared-off corner) only on the last — so a group reads as one utterance.
 * Intra-group gap 2px, inter-group spacing is owned by the thread.
 */
export default function ChatMessageGroup({
  group,
  isChairSender,
  onRetry,
  t,
}: {
  group: ChatGroup;
  isChairSender: boolean;
  onRetry?: (outboxId: string) => void;
  t: TFn;
}) {
  const { isMe, sender, items } = group;

  return (
    <div className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`} style={{ marginTop: 12 }}>
      {/* Incoming groups get an avatar disc beside the first bubble. */}
      {!isMe && (
        <span style={{ paddingTop: 18 }}>
          <ChatAvatar kind={isChairSender ? 'chair' : 'delegate'} name={sender} size={24} />
        </span>
      )}

      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`} style={{ maxWidth: '78%', minWidth: 0 }}>
        {!isMe && (
          <span
            style={{
              fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, marginBottom: 3,
              color: isChairSender ? NEU.deepGold : NEU.muted,
              letterSpacing: '0.03em',
            }}
          >
            {sender}{isChairSender ? ` ${t('chat_chair_badge')}` : ''}
          </span>
        )}

        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          const failed = it.delivery === 'failed';
          const sending = it.delivery === 'sending';
          return (
            <div key={it.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`} style={{ marginTop: i === 0 ? 0 : 2, maxWidth: '100%' }}>
              <div
                style={{
                  padding: '8px 13px',
                  borderRadius: 16,
                  // Tail only on the last bubble of the group.
                  borderEndEndRadius: isMe && isLast ? 5 : 16,
                  borderEndStartRadius: !isMe && isLast ? 5 : 16,
                  backgroundColor: isMe ? NEU.forest : CHAT.bubbleIn,
                  color: isMe ? NEU.base : NEU.ink,
                  border: failed
                    ? `1.5px solid ${CHAT.danger}`
                    : isMe ? 'none' : `1px solid ${CHAT.hairline}`,
                  opacity: sending ? 0.6 : 1,
                  fontSize: 13,
                  lineHeight: 1.42,
                  // A long URL must never be able to widen the layout.
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  transition: `opacity 160ms ${EASE}`,
                  boxShadow: isMe ? '0 1px 3px rgba(27,56,40,0.18)' : 'none',
                }}
              >
                {it.content}
              </div>

              {failed && it.outboxId && (
                <button
                  onClick={() => onRetry?.(it.outboxId!)}
                  className="focus:outline-none"
                  style={{
                    marginTop: 3, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, color: CHAT.danger,
                  }}
                >
                  {t('chat_not_delivered')} · <span style={{ textDecoration: 'underline' }}>{t('chat_retry')}</span>
                </button>
              )}

              {/* Timestamp on the last bubble only; "Sending…" replaces it while in flight. */}
              {isLast && !failed && (
                <span
                  style={{
                    marginTop: 3, fontFamily: OUTFIT, fontSize: 9.5,
                    color: sending ? NEU.amber : NEU.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {sending ? t('chat_sending') : formatTime(it.timestamp)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
