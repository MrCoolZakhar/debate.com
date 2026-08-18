'use client';

import { forwardRef } from 'react';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { CHAT, useKeyboardInset, type TFn } from './chatTokens';

const ChatComposer = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  readOnly: boolean;
  t: TFn;
}>(function ChatComposer({ value, onChange, onSend, readOnly, t }, ref) {
  // The delegate chat lives inside FitToScreen's scaled root; on iOS the keyboard shrinks the
  // visual viewport without changing window.innerHeight, so absorb the overlap as bottom
  // padding to keep the input above the keyboard.
  const keyboardInset = useKeyboardInset();
  const canSend = value.trim().length > 0;

  return (
    <div
      className="px-4 pt-3 shrink-0"
      style={{
        paddingBottom: 14 + keyboardInset,
        borderTop: `1px solid ${CHAT.hairline}`,
        backgroundColor: NEU.surface,
        transition: `padding-bottom 160ms ${EASE}`,
      }}
    >
      {readOnly ? (
        <p className="text-center py-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted }}>
          {t('chat_view_only')}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={t('chat_placeholder')}
            enterKeyHint="send"
            autoComplete="off"
            className="flex-1 min-w-0 focus:outline-none"
            style={{
              padding: '10px 15px',
              borderRadius: 999,
              // Pressed-in well.
              backgroundColor: NEU.base,
              boxShadow: NEU.inSm,
              border: 'none',
              fontFamily: OUTFIT, color: NEU.ink,
              /* 16px is a hard floor, not a style choice, and it applies at every
                 width. iOS Safari auto-zooms the viewport on focus for ANY input
                 under 16px — that is the "zooms into the message field and cuts
                 off the right side" report; the page scales up and never scales
                 back. The other fix, maximum-scale=1 on the viewport, is banned
                 because it disables pinch zoom for everyone. Kept uniform rather
                 than mobile-only: a composer at 16px reads fine on desktop, and a
                 breakpoint here would be one more thing to get wrong. */
              fontSize: 16,
            }}
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            aria-label={t('chat_send')}
            className="shrink-0 inline-flex items-center justify-center focus:outline-none"
            style={{
              width: 36, height: 36, borderRadius: 999, border: 'none',
              background: canSend ? `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})` : CHAT.hairline,
              color: canSend ? NEU.gold : NEU.muted,
              boxShadow: canSend ? `0 4px 10px rgba(27,56,40,0.30), ${NEU.outSm}` : 'none',
              cursor: canSend ? 'pointer' : 'default',
              fontSize: 15, lineHeight: 1,
              transition: `background 160ms ${EASE}, box-shadow 160ms ${EASE}, transform 160ms ${EASE}`,
            }}
            onPointerDown={(e) => { if (canSend) (e.currentTarget as HTMLElement).style.transform = 'scale(0.94)'; }}
            onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <span className="inline-block rtl:-scale-x-100">↑</span>
          </button>
        </div>
      )}
    </div>
  );
});

export default ChatComposer;
