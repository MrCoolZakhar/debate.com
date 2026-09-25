'use client';

// Manage Account: Promo Code. One very large code field that owns the page, a
// CLAIM button that appears with the first character, and on success the
// server's own sentence in large green where the field was, for about eight
// seconds (or a click), before the empty field comes back. A refusal is the
// small red line above the field. The server trims and upper-cases the code
// and writes every message for a person.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { UserFacingError, friendlyError } from '@/lib/friendlyError';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { notifyUnlimitedChanged } from '@/lib/unlimitedStatus';
import { GoldWord } from '@/components/BrandHeading';
import { OUTFIT, W } from '../../accountUi';
import { PageHead, HelpLine, PrimaryButton, ButtonStyles, FOREST, FOREST_MID, INK, RULE } from '../manageUi';

type ClaimResult =
  | { ok: true; grant_kind: 'credits' | 'unlimited_days'; amount: number; message: string }
  | { ok: false; message: string };

/** idle: the field. leaving: the field fading out. message: the sentence.
 *  messageLeaving: the sentence fading out before the field returns. */
type Phase = 'idle' | 'leaving' | 'message' | 'messageLeaving';

const FADE_MS = 240;
const MESSAGE_MS = 8000;

const INFO = 'Got a code from a conference or from us? Enter it here and it lands on your account straight away';

export default function PromoCodePage() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [success, setSuccess] = useState('');
  const [failure, setFailure] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = code.trim();

  const clearTimer = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fadeMs = () => (reduced() ? 0 : FADE_MS);

  /** message -> messageLeaving -> idle. Called by the timer or by a click. */
  const dismissMessage = useCallback(() => {
    clearTimer();
    setPhase('messageLeaving');
    timer.current = setTimeout(() => {
      setSuccess('');
      setPhase('idle');
    }, fadeMs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimer]);

  /** Success: field out, sentence in, wait, then back. */
  function showSuccess(message: string) {
    clearTimer();
    setPhase('leaving');
    timer.current = setTimeout(() => {
      setSuccess(message);
      setPhase('message');
      timer.current = setTimeout(dismissMessage, MESSAGE_MS);
    }, fadeMs());
  }

  async function claim() {
    if (busy || !trimmed || phase !== 'idle') return;
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
      showSuccess(result.message || 'Done. Your account has been updated.');
      refreshCreditsEverywhere();
      if (result.grant_kind === 'unlimited_days') notifyUnlimitedChanged(user?.id);
    } catch (err) {
      setFailure(friendlyError(err, 'Could not check that code right now. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  const fieldVisible = phase === 'idle' || phase === 'leaving';
  const messageVisible = phase === 'message' || phase === 'messageLeaving';

  return (
    <div>
      <ButtonStyles />
      <style>{`
        @keyframes gvPromoRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gvPromoIn{from{opacity:0}to{opacity:1}}
        .gv-promo-rise{animation:gvPromoRise 160ms ease-out both}
        .gv-promo-in{animation:gvPromoIn ${FADE_MS}ms ease-out both}
        .gv-promo-fade{transition:opacity ${FADE_MS}ms ease-out}
        .gv-promo-field::placeholder{color:rgba(90,80,70,0.5);text-transform:none;letter-spacing:0.01em;font-weight:700}
        .gv-promo-msg{background:none;border:none;padding:0;text-align:left;cursor:pointer}
        @media (prefers-reduced-motion:reduce){
          .gv-promo-rise,.gv-promo-in{animation:none}
          .gv-promo-fade{transition:none}
        }
      `}</style>

      <PageHead title={<>Promo <GoldWord>Code</GoldWord></>} info={INFO} />

      <div style={{ position: 'relative', minHeight: 96 }}>
        {fieldVisible && (
          <form
            onSubmit={(e) => { e.preventDefault(); void claim(); }}
            className="gv-promo-fade"
            style={{ opacity: phase === 'leaving' ? 0 : 1 }}
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
              aria-describedby={failure ? 'promo-error' : undefined}
              disabled={busy}
              className="gv-promo-field gv-promo-in w-full focus:outline-none"
              style={{
                display: 'block',
                minHeight: 96,
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: `3px solid ${focused ? FOREST : RULE}`,
                borderRadius: 0,
                fontFamily: OUTFIT,
                fontSize: 'clamp(36px, 6vw, 64px)',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textAlign: 'left',
                color: INK,
                transition: 'border-color 150ms ease-out',
              }}
            />

            {trimmed.length > 0 && (
              <div className="gv-promo-rise mt-6">
                <PrimaryButton type="submit" disabled={busy} height={52}>
                  {busy ? 'CHECKING' : 'CLAIM'}
                </PrimaryButton>
              </div>
            )}
          </form>
        )}

        {messageVisible && (
          <div role="status" aria-live="polite" className="gv-promo-fade" style={{ opacity: phase === 'messageLeaving' ? 0 : 1 }}>
            <button
              type="button"
              onClick={dismissMessage}
              className={`gv-promo-msg gv-promo-in w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 rounded`}
              style={{
                minHeight: 96,
                fontFamily: OUTFIT,
                fontSize: 'clamp(24px, 3vw, 36px)',
                fontWeight: 700,
                lineHeight: 1.25,
                color: FOREST_MID,
              }}
            >
              {success}
            </button>
          </div>
        )}
      </div>

      <HelpLine />
    </div>
  );
}
