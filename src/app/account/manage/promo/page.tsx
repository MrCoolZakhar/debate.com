'use client';

// Manage account: Promo code. One very large code field, a Claim button that
// appears with the first character, the server's own sentence back in green
// on success or in red above the field on a refusal. The server trims and
// upper-cases the code and writes every message for a person.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { UserFacingError, friendlyError } from '@/lib/friendlyError';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { notifyUnlimitedChanged } from '@/lib/unlimitedStatus';
import { OUTFIT, T, W } from '../../accountUi';
import { PageHead, HelpLine, PrimaryButton } from '../manageUi';

type ClaimResult =
  | { ok: true; grant_kind: 'credits' | 'unlimited_days'; amount: number; message: string }
  | { ok: false; message: string };

export default function PromoCodePage() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [failure, setFailure] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = code.trim();

  // The success line stays until the next keystroke.
  useEffect(() => {
    if (code !== '') setSuccess('');
  }, [code]);

  async function claim() {
    if (busy || !trimmed) return;
    setBusy(true);
    setFailure('');
    try {
      const client = await getFreshAuthedClient();
      if (!client) throw new UserFacingError('Your session has expired. Refresh the page and sign in again.');
      const { data, error } = await client.rpc('claim_promo_code', { p_code: trimmed });
      if (error) throw error;
      const result = data as ClaimResult | null;
      if (!result) throw new Error('empty result');
      if (!result.ok) {
        setFailure(result.message || 'That code did not work. Check it and try again.');
        return;
      }
      setCode('');
      setSuccess(result.message || 'Done. Your account has been updated.');
      refreshCreditsEverywhere();
      if (result.grant_kind === 'unlimited_days') notifyUnlimitedChanged(user?.id);
    } catch (err) {
      setFailure(friendlyError(err, 'Could not check that code right now. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <style>{`
        @keyframes gvPromoRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .gv-promo-rise{animation:gvPromoRise 160ms ease-out both}
        @media (prefers-reduced-motion:reduce){.gv-promo-rise{animation:none}}
        .gv-promo-field::placeholder{color:#9A8A78;text-transform:none;letter-spacing:0.01em;font-weight:600}
      `}</style>

      <PageHead title="Promo code" lede="Got a code from a conference or from us? Enter it here and it lands on your account straight away." />

      <form
        onSubmit={(e) => { e.preventDefault(); void claim(); }}
        style={{ maxWidth: 640 }}
        aria-busy={busy}
      >
        {failure && (
          <p
            id="promo-error"
            role="alert"
            style={{ margin: '0 0 8px', fontFamily: OUTFIT, fontSize: 14, fontWeight: W.label, color: '#C13515' }}
          >
            {failure}
          </p>
        )}

        <label htmlFor="promo-code" className="sr-only">Promo code</label>
        <input
          ref={inputRef}
          id="promo-code"
          name="promo-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Enter Promo Code"
          aria-invalid={failure ? true : undefined}
          aria-describedby={failure ? 'promo-error' : success ? 'promo-success' : undefined}
          disabled={busy}
          className="gv-promo-field w-full focus:outline-none"
          style={{
            display: 'block',
            minHeight: 64,
            padding: '12px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${focused ? '#1B3828' : '#DDD4C0'}`,
            borderRadius: 0,
            fontFamily: OUTFIT,
            fontSize: 'clamp(24px, 6vw, 32px)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textAlign: 'left',
            color: '#1C1410',
            transition: 'border-color 150ms ease-out',
          }}
        />

        {success && (
          <p
            id="promo-success"
            role="status"
            className="gv-promo-rise"
            style={{ margin: '16px 0 0', fontFamily: OUTFIT, fontSize: 18, fontWeight: W.label, lineHeight: 1.4, color: '#2A5A3C' }}
          >
            {success}
          </p>
        )}

        {trimmed.length > 0 && (
          <div className="gv-promo-rise mt-6">
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? 'Checking' : 'Claim'}
            </PrimaryButton>
          </div>
        )}
      </form>

      <p style={{ margin: '24px 0 0', fontFamily: OUTFIT, fontSize: T.caption, color: '#5A5046', maxWidth: '60ch' }}>
        Codes are not case sensitive. A code adds credits or Unlimited days to this account only.
      </p>

      <HelpLine />
    </div>
  );
}
