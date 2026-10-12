'use client';

/**
 * The wizard's first screen for a visitor who is NOT signed in (12 Oct 2026):
 * "Where should we save your conference?". The answer is where the draft lives
 * until they make an account at the end, and where its reminders go. Signed-in
 * organisers never see it (their account email is used).
 *
 * Shown only when the drafts SQL exists (useConferenceDraft `available`);
 * without it a signed-out visitor is sent to sign in, as before.
 */

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { WizardShell } from '@/components/wizard';
import { NEU, OUTFIT } from '@/components/neu';
import { openAuth } from '@/lib/authModal';
import { looksLikeEmail } from '@/lib/conferenceDrafts';

const FOREST_BUTTON = 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)';
const FIELD_BORDER = 'rgba(27,56,40,0.22)';

export function EmailStep({
  total, initialEmail, onSubmit, onDone,
}: {
  total: number;
  initialEmail: string;
  /** Creates (or updates) the draft. Resolves with a sentence on refusal. */
  onSubmit: (email: string) => Promise<{ ok: boolean; message?: string }>;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = looksLikeEmail(value);

  async function submit() {
    if (!valid) { setError('Enter a valid email address.'); return; }
    if (busy) return;
    setBusy(true);
    setError('');
    const r = await onSubmit(value.trim());
    setBusy(false);
    if (!r.ok) { setError(r.message || 'We could not save that just now. Please try again.'); return; }
    onDone();
  }

  return (
    <WizardShell
      step={0} total={total}
      title="Where Should We Save Your Conference?"
      sub="Your answers save as you go, so you can finish later on any device."
    >
      <form
        className="w-full"
        style={{ maxWidth: 460, margin: '0 auto' }}
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        noValidate
      >
        <label htmlFor="draft-email" style={{ display: 'block', fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.inkSoft, marginBottom: 6 }}>
          Your email
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: NEU.inkSoft }}>
            <Mail size={17} />
          </span>
          <input
            id="draft-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(''); }}
            placeholder="you@yourconference.org"
            aria-describedby="draft-email-privacy"
            aria-invalid={!!error}
            style={{
              width: '100%', padding: '15px 16px 15px 42px', borderRadius: 14,
              border: `1.5px solid ${error ? '#8B2020' : FIELD_BORDER}`, backgroundColor: '#FFFFFF',
              fontFamily: OUTFIT, fontSize: 16, color: NEU.ink, outline: 'none',
            }}
            onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = NEU.forest; }}
            onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = FIELD_BORDER; }}
          />
        </div>
        <p id="draft-email-privacy" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, lineHeight: 1.55, marginTop: 8 }}>
          We only use it to save your draft and remind you about it. You can unsubscribe any time.
        </p>
        {error && (
          <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', marginTop: 10, lineHeight: 1.5 }}>
            {error}
          </p>
        )}
        <div className="flex justify-center" style={{ marginTop: 24 }}>
          <button
            type="submit"
            disabled={!valid || busy}
            className="focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(27,56,40,0.35)]"
            style={{
              padding: '13px 34px', borderRadius: 10, border: 'none',
              background: FOREST_BUTTON, color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 15, fontWeight: 700,
              opacity: !valid || busy ? 0.5 : 1, cursor: !valid || busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Saving' : 'Continue'}
          </button>
        </div>
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, textAlign: 'center', marginTop: 18 }}>
          Already on Gavelling?{' '}
          <button
            type="button"
            onClick={() => openAuth({})}
            className="focus:outline-none"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.forest, textDecoration: 'underline' }}
          >
            Sign in
          </button>
        </p>
      </form>
    </WizardShell>
  );
}
