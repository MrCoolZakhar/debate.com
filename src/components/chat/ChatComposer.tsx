'use client';

import { forwardRef, useLayoutEffect, useRef } from 'react';
import { ArrowUp, Eye } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { CHAT, useKeyboardInset, type TFn } from './chatTokens';

const MAX_H = 132;

/**
 * The composer, pinned to the bottom of the thread. A rounded field that grows to five lines
 * (Enter sends, Shift+Enter breaks the line) and a round forest send button that only lights
 * up when there is something to send. Read-only (session ended) swaps it for a one-line notice.
 */
const ChatComposer = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  readOnly: boolean;
  t: TFn;
}>(function ChatComposer({ value, onChange, onSend, readOnly, t }, ref) {
  // The delegate chat lives inside FitToScreen's scaled root; on iOS the keyboard shrinks the
  // visual viewport without changing window.innerHeight, so absorb the overlap as padding.
  const keyboardInset = useKeyboardInset();
  const canSend = value.trim().length > 0;
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow: one read and one write, only when the text changes (never per frame).
  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(MAX_H, el.scrollHeight)}px`;
  }, [value]);

  return (
    <div
      className="shrink-0 px-3 pt-2.5"
      style={{
        paddingBottom: 12 + keyboardInset,
        background: CHAT.bar,
        boxShadow: `inset 0 1px 0 ${CHAT.hairline}`,
      }}
    >
      {readOnly ? (
        <p className="flex items-center justify-center gap-2 py-2" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
          <Eye size={15} strokeWidth={2} aria-hidden />
          {t('chat_view_only')}
        </p>
      ) : (
        <div className="flex items-end gap-2">
          <textarea
            ref={(el) => {
              localRef.current = el;
              if (typeof ref === 'function') ref(el);
              else if (ref) ref.current = el;
            }}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); }
            }}
            placeholder={t('chat_placeholder')}
            aria-label={t('chat_placeholder')}
            enterKeyHint="send"
            autoComplete="off"
            className="flex-1 min-w-0 resize-none focus:outline-none"
            style={{
              padding: '10px 16px',
              borderRadius: 22,
              backgroundColor: '#FFFDF8',
              boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.10), 0 1px 2px rgba(28,20,16,0.04)',
              border: 'none',
              fontFamily: OUTFIT, color: NEU.ink, lineHeight: 1.35,
              maxHeight: MAX_H,
              /* 16px is a hard floor: iOS Safari zooms the viewport on focus for any field under
                 16px, and the page never zooms back. maximum-scale=1 is banned (kills pinch zoom). */
              fontSize: 16,
            }}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label={t('chat_send')}
            className="shrink-0 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] enabled:active:scale-[0.96]"
            style={{
              width: 44, height: 44, borderRadius: 999, border: 'none',
              background: canSend ? `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})` : 'rgba(28,20,16,0.08)',
              color: canSend ? NEU.gold : 'rgba(28,20,16,0.35)',
              boxShadow: canSend ? '0 2px 6px rgba(27,56,40,0.28)' : 'none',
              cursor: canSend ? 'pointer' : 'default',
              transitionProperty: 'background-color, color, transform',
              transitionDuration: '160ms',
            }}
          >
            <ArrowUp size={20} strokeWidth={2.6} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
});

export default ChatComposer;
