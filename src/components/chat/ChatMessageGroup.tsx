'use client';

import { NEU, OUTFIT } from '@/components/neu';
import { ChatAvatar } from './ChatAvatar';
import ChatAttachmentView from './ChatAttachmentView';
import { CHAT, formatTime, type ChatGroup, type TFn } from './chatTokens';

/**
 * One run of consecutive messages from a single sender inside the grouping window.
 *
 * Bubbles in the WhatsApp / Instagram manner: yours on the inline-end in forest, everyone
 * else's on the inline-start in white. In a multi-party thread (Everyone, the dais, a group,
 * a delegate thread the whole dais shares) an incoming run carries the sender's round flag
 * (or a chair's initials) beside its LAST bubble and their name above the FIRST. The time sits
 * inside every bubble's corner; the squared "tail" corner is on the last bubble only.
 */
export default function ChatMessageGroup({
  group,
  isChairSender,
  showIdentity,
  senderLabel,
  onRetry,
  t,
  locale,
}: {
  group: ChatGroup;
  isChairSender: boolean;
  /** Name + avatar on incoming runs. Off in a two-person thread, where they add nothing. */
  showIdentity: boolean;
  /** Display name of the sender (localised country name, or the chair's name). */
  senderLabel: string;
  onRetry?: (outboxId: string) => void;
  t: TFn;
  locale: string;
}) {
  const { isMe, items } = group;
  const withAvatar = !isMe && showIdentity;

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`} style={{ marginTop: 10 }}>
      {withAvatar && <ChatAvatar kind={isChairSender ? 'chair' : 'delegate'} name={group.sender} size={30} />}

      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`} style={{ maxWidth: 'min(76%, 560px)', minWidth: 0 }}>
        {withAvatar && (
          <span
            className="truncate max-w-full"
            style={{
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, marginBottom: 3, paddingInlineStart: 12,
              color: isChairSender ? 'color-mix(in srgb, var(--gv-accent, #B6871F) 60%, var(--gv-on-surface, #1C1410))' : NEU.inkSoft,
            }}
          >
            {senderLabel}{isChairSender ? ` ${t('chat_chair_badge')}` : ''}
          </span>
        )}

        {items.map((it, i) => {
          const isFirst = i === 0;
          const isLast = i === items.length - 1;
          const failed = it.delivery === 'failed';
          const sending = it.delivery === 'sending';
          const R = 18;
          const S = 6;
          return (
            <div key={it.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`} style={{ marginTop: isFirst ? 0 : 2, maxWidth: '100%' }}>
              {it.attachment ? (
                <div
                  style={{
                    position: 'relative',
                    padding: it.attachment.kind === 'pdf' ? '6px 6px 4px' : 3,
                    borderRadius: R,
                    borderEndStartRadius: !isMe ? S : R,
                    borderEndEndRadius: isMe ? S : R,
                    backgroundColor: isMe ? CHAT.bubbleOut : CHAT.bubbleIn,
                    color: isMe ? '#F6F1E4' : NEU.ink,
                    boxShadow: failed
                      ? `inset 0 0 0 1.5px ${CHAT.danger}`
                      : isMe ? '0 1px 1px rgba(27,56,40,0.22)' : '0 1px 1px rgba(28,20,16,0.08), 0 0 0 0.5px rgba(28,20,16,0.06)',
                    opacity: sending ? 0.7 : 1,
                    transition: 'opacity 160ms ease-out',
                    maxWidth: '100%',
                  }}
                >
                  <ChatAttachmentView
                    a={it.attachment}
                    isMe={isMe}
                    t={t}
                    timeSlot={(
                      <span
                        style={{
                          position: 'absolute', insetInlineEnd: 8, bottom: it.attachment.kind === 'pdf' ? 0 : 6,
                          padding: it.attachment.kind === 'pdf' ? 0 : '2px 6px', borderRadius: 8,
                          background: it.attachment.kind === 'pdf' ? 'transparent' : 'rgba(5,8,20,0.5)',
                          fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 500, lineHeight: 1.2, whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          color: it.attachment.kind !== 'pdf' ? '#fff' : isMe ? 'rgba(246,241,228,0.72)' : 'color-mix(in srgb, var(--gv-on-surface, #1C1410) 55%, white)',
                        }}
                      >
                        {sending ? t('chat_sending') : formatTime(it.timestamp, locale)}
                      </span>
                    )}
                  />
                </div>
              ) : (
              <div
                style={{
                  position: 'relative',
                  padding: '7px 12px 7px 13px',
                  borderRadius: R,
                  // A run reads as one utterance: inner corners on the sender's side are tighter.
                  borderStartStartRadius: !isMe && !isFirst ? S : R,
                  borderEndStartRadius: !isMe && !isLast ? S : (!isMe ? S : R),
                  borderStartEndRadius: isMe && !isFirst ? S : R,
                  borderEndEndRadius: isMe ? S : R,
                  backgroundColor: isMe ? CHAT.bubbleOut : CHAT.bubbleIn,
                  color: isMe ? '#F6F1E4' : NEU.ink,
                  boxShadow: failed
                    ? `inset 0 0 0 1.5px ${CHAT.danger}`
                    : isMe ? '0 1px 1px rgba(27,56,40,0.22)' : '0 1px 1px rgba(28,20,16,0.08), 0 0 0 0.5px rgba(28,20,16,0.06)',
                  opacity: sending ? 0.7 : 1,
                  transition: 'opacity 160ms ease-out',
                  fontFamily: OUTFIT,
                  fontSize: 15,
                  lineHeight: 1.38,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  textWrap: 'pretty',
                }}
              >
                {it.content}
                {/* The time floats in the bubble's last line, WhatsApp style. The invisible spacer
                    reserves room for it so it never overlaps the text. */}
                <span aria-hidden style={{ display: 'inline-block', width: sending ? 64 : 42 }} />
                <span
                  style={{
                    position: 'absolute', insetInlineEnd: 10, bottom: 5,
                    fontSize: 10.5, fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    color: isMe ? 'rgba(246,241,228,0.72)' : 'color-mix(in srgb, var(--gv-on-surface, #1C1410) 55%, white)',
                  }}
                >
                  {sending ? t('chat_sending') : formatTime(it.timestamp, locale)}
                </span>
              </div>
              )}

              {failed && it.outboxId && (
                <button
                  type="button"
                  onClick={() => onRetry?.(it.outboxId!)}
                  className="focus:outline-none focus-visible:underline"
                  style={{
                    marginTop: 3, background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer',
                    fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: CHAT.danger,
                  }}
                >
                  {t('chat_not_delivered')} · <span style={{ textDecoration: 'underline' }}>{t('chat_retry')}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
