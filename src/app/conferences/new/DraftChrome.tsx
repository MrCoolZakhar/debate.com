'use client';

/**
 * The small pieces the wizard draws around its server-side draft
 * (useConferenceDraft, 12 Oct 2026):
 *   DraftStatusCard  a saved draft that cannot be opened here yet (it belongs
 *                    to an account: sign in; another account's; unreadable)
 *   DraftSavedNote   the quiet "Saved" line, bottom left
 *   DraftNotice      a one-line note above the wizard (reminders stopped,
 *                    a draft that was already created)
 */

import { Check, CloudOff, FileClock } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { openAuth } from '@/lib/authModal';
import type { DraftStatus, SaveState } from './useConferenceDraft';

const FOREST_BUTTON = 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)';
const CARD_SHADOW = '0 1px 2px rgba(27,56,40,0.06), 0 6px 20px -6px rgba(27,56,40,0.16)';

export function DraftStatusCard({
  status, maskedEmail, token, onStartFresh, onRetry,
}: {
  status: DraftStatus;
  maskedEmail: string | null;
  token: string | null;
  onStartFresh: () => void;
  onRetry: () => void;
}) {
  const title =
    status === 'needs_sign_in' ? 'Sign In to Continue'
    : status === 'not_yours' ? 'This Draft Is Not Yours'
    : 'We Could Not Open Your Draft';
  const body =
    status === 'needs_sign_in'
      ? `This draft is saved to an account${maskedEmail ? ` (${maskedEmail})` : ''}. Sign in to pick up where you left off.`
      : status === 'not_yours'
        ? 'It belongs to another Gavelling account. Sign in with that account to finish it, or start a new conference.'
        : 'Check your connection and try again. Nothing you saved is lost.';
  return (
    <div className="w-full flex justify-center" style={{ padding: '24px 0' }}>
      <div style={{ maxWidth: 460, width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, boxShadow: CARD_SHADOW, padding: '28px 26px', textAlign: 'center' }}>
        <span className="inline-flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: 'rgba(238,217,138,0.35)', color: NEU.forest, marginBottom: 14 }}>
          <FileClock size={24} />
        </span>
        <h1 style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 22, color: NEU.ink, margin: 0 }}>{title}</h1>
        <p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft, lineHeight: 1.55, marginTop: 8, overflowWrap: 'anywhere' }}>{body}</p>
        <div className="flex flex-col items-center gap-3" style={{ marginTop: 20 }}>
          {status === 'load_failed' ? (
            <button type="button" onClick={onRetry} className="focus:outline-none" style={primary}>Try again</button>
          ) : (
            <button
              type="button"
              onClick={() => openAuth({ next: token ? `/conferences/new?draft=${token}` : '/conferences/new' })}
              className="focus:outline-none"
              style={primary}
            >
              Sign in
            </button>
          )}
          {status !== 'needs_sign_in' && (
            <button type="button" onClick={onStartFresh} className="focus:outline-none" style={link}>
              Start a new conference
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const primary: React.CSSProperties = {
  padding: '12px 30px', borderRadius: 10, border: 'none', background: FOREST_BUTTON,
  color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, cursor: 'pointer',
};
const link: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT,
  fontSize: 13.5, fontWeight: 700, color: NEU.forest, textDecoration: 'underline',
};

export function DraftSavedNote({ state, error }: { state: SaveState; error: string }) {
  if (state === 'idle' && !error) return null;
  const failed = state === 'error' || !!error;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-4 bottom-20 lg:bottom-4 z-20 inline-flex items-center gap-1.5"
      style={{
        fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600,
        color: failed ? '#8B2020' : NEU.inkSoft, maxWidth: 'calc(100vw - 32px)',
        padding: '6px 11px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)',
        boxShadow: '0 1px 2px rgba(27,56,40,0.06)',
      }}
    >
      {failed ? <CloudOff size={13} /> : <Check size={13} />}
      {error || (state === 'saving' ? 'Saving' : state === 'saved' ? 'Saved' : 'Not saved yet. Trying again soon')}
    </div>
  );
}

export function DraftNotice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  if (!text) return null;
  return (
    <div className="w-full flex justify-center" style={{ marginBottom: 12 }}>
      <div
        role="status"
        className="inline-flex items-center gap-3"
        style={{ backgroundColor: '#FFFFFF', borderRadius: 14, boxShadow: CARD_SHADOW, padding: '10px 14px', maxWidth: 560 }}
      >
        <Check size={16} style={{ color: NEU.forest, flexShrink: 0 }} />
        <span style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink, lineHeight: 1.5 }}>{text}</span>
        <button type="button" onClick={onDismiss} className="focus:outline-none" style={{ ...link, fontSize: 12.5 }}>
          OK
        </button>
      </div>
    </div>
  );
}
