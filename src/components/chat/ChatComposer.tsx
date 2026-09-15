'use client';

import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Eye, FileText, Paperclip, X } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { CHAT_ACCEPT, formatBytes } from '@/lib/chatAttachments';
import type { GifItem } from '@/lib/gifClient';
import { CHAT, useKeyboardInset, type TFn } from './chatTokens';
import GifPicker from './GifPicker';

const MAX_H = 132;

/** A file picked in the composer, uploading or ready to send. Owned by ChatPanel. */
export interface AttachmentDraft {
  id: string;
  kind: 'image' | 'pdf';
  name: string;
  size: number;
  /** Object URL of the local file, images only (revoked by ChatPanel). */
  localUrl?: string;
  progress: number;
  status: 'uploading' | 'ready' | 'failed';
}

const roundBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 999, border: 'none', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  transitionProperty: 'background-color, color, transform', transitionDuration: '160ms',
};

/**
 * The composer, pinned to the bottom of the thread. A rounded field that grows to five lines
 * (Enter sends, Shift+Enter breaks the line), a paperclip for a photo or PDF, a GIF button
 * (only when the server has a GIPHY key) and a round forest send button that lights up when
 * there is something to send. A picked file shows above the field with its preview, upload
 * progress and a remove button. Read-only (session ended) swaps it all for a one-line notice.
 */
const ChatComposer = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  readOnly: boolean;
  t: TFn;
  draft?: AttachmentDraft | null;
  onPickFile?: (file: File) => void;
  onRemoveDraft?: () => void;
  /** A translated rejection or failure line shown above the field. */
  attachError?: string | null;
  gifsEnabled?: boolean;
  onSendGif?: (g: GifItem) => void;
  lang?: string;
}>(function ChatComposer({
  value, onChange, onSend, readOnly, t,
  draft = null, onPickFile, onRemoveDraft, attachError = null, gifsEnabled = false, onSendGif, lang = 'en',
}, ref) {
  // The delegate chat lives inside FitToScreen's scaled root; on iOS the keyboard shrinks the
  // visual viewport without changing window.innerHeight, so absorb the overlap as padding.
  const keyboardInset = useKeyboardInset();
  const draftReady = draft?.status === 'ready';
  const canSend = draft ? draftReady : value.trim().length > 0;
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [gifOpen, setGifOpen] = useState(false);

  // Auto-grow: one read and one write, only when the text changes (never per frame).
  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(MAX_H, el.scrollHeight)}px`;
  }, [value]);

  const toolBtn = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.08)] active:scale-[0.96] disabled:opacity-40';

  return (
    <div
      className="relative shrink-0 px-3 pt-2.5"
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
        <>
          {gifOpen && gifsEnabled && onSendGif && (
            <GifPicker
              lang={lang}
              t={t}
              onClose={() => setGifOpen(false)}
              onPick={(g) => { setGifOpen(false); onSendGif(g); }}
            />
          )}

          {attachError && (
            <p role="alert" className="px-1 pb-2" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: CHAT.danger }}>
              {attachError}
            </p>
          )}

          {draft && (
            <div
              className="mb-2 flex items-center gap-3"
              style={{ padding: 8, borderRadius: 16, background: '#FFFDF8', boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.10)' }}
            >
              <span
                className="relative shrink-0 inline-flex items-center justify-center overflow-hidden"
                style={{ width: 56, height: 56, borderRadius: 12, background: draft.kind === 'pdf' ? NEU.forest : 'rgba(27,56,40,0.08)', color: NEU.gold }}
              >
                {draft.kind === 'image' && draft.localUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={draft.localUrl} alt="" width={56} height={56} style={{ width: '100%', height: '100%', objectFit: 'cover', outline: '1px solid rgba(0,0,0,0.08)', outlineOffset: -1 }} />
                ) : (
                  <FileText size={24} strokeWidth={2} aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 650, color: NEU.ink }}>{draft.name}</span>
                <span
                  className="block"
                  aria-live="polite"
                  style={{ fontFamily: OUTFIT, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: draft.status === 'failed' ? CHAT.danger : NEU.inkSoft }}
                >
                  {draft.status === 'failed' ? t('chat_attach_failed')
                    : draft.status === 'ready' ? `${formatBytes(draft.size)} · ${t('chat_attach_ready')}`
                    : t('chat_attach_uploading', { n: Math.round(draft.progress * 100) })}
                </span>
                {draft.status === 'uploading' && (
                  <span
                    className="block mt-1.5 overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(draft.progress * 100)}
                    style={{ height: 4, borderRadius: 999, background: 'rgba(27,56,40,0.10)' }}
                  >
                    <span style={{
                      display: 'block', height: '100%', width: '100%', borderRadius: 999, background: NEU.forest,
                      transform: `scaleX(${Math.max(0.03, draft.progress)})`, transformOrigin: 'left',
                      transition: 'transform 180ms ease-out',
                    }} />
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={onRemoveDraft}
                aria-label={t('chat_attach_remove')}
                title={t('chat_attach_remove')}
                className={toolBtn}
                style={{ ...roundBtn, width: 36, height: 36, background: 'transparent', color: NEU.inkSoft, cursor: 'pointer' }}
              >
                <X size={18} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1.5">
            {onPickFile && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept={CHAT_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    // Reset, or picking the same file again fires no change event.
                    e.target.value = '';
                    if (f) onPickFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!!draft}
                  aria-label={t('chat_attach')}
                  title={t('chat_attach')}
                  className={toolBtn}
                  style={{ ...roundBtn, width: 40, background: 'transparent', color: NEU.inkSoft, cursor: draft ? 'default' : 'pointer' }}
                >
                  <Paperclip size={20} strokeWidth={2.2} aria-hidden />
                </button>
              </>
            )}
            {gifsEnabled && onSendGif && (
              <button
                type="button"
                onClick={() => setGifOpen((v) => !v)}
                aria-label={t('chat_gif')}
                aria-expanded={gifOpen}
                title={t('chat_gif')}
                className={toolBtn}
                style={{
                  ...roundBtn, width: 40, cursor: 'pointer',
                  background: gifOpen ? 'rgba(27,56,40,0.10)' : 'transparent',
                  color: gifOpen ? NEU.forest : NEU.inkSoft,
                  fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
                }}
              >
                <span aria-hidden style={{ padding: '2px 4px', borderRadius: 5, boxShadow: 'inset 0 0 0 1.6px currentColor', lineHeight: 1 }}>GIF</span>
              </button>
            )}
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
                ...roundBtn,
                background: canSend ? `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})` : 'rgba(28,20,16,0.08)',
                color: canSend ? NEU.gold : 'rgba(28,20,16,0.35)',
                boxShadow: canSend ? '0 2px 6px rgba(27,56,40,0.28)' : 'none',
                cursor: canSend ? 'pointer' : 'default',
              }}
            >
              <ArrowUp size={20} strokeWidth={2.6} aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default ChatComposer;
