'use client';

/**
 * "You Already Have a Conference" (owner, 19 Oct 2026): before the creation
 * wizard, a signed-in organiser who already runs a conference that is not
 * taking applications yet is asked whether to finish that one instead. Some
 * people simply create a second conference instead of setting up the first.
 *
 * What counts is defined once in src/lib/unstartedConferences.ts (created
 * conferences only, never a wizard draft). It never blocks: "Create a new
 * conference anyway" (or Escape, or the backdrop) closes it and the wizard
 * carries on, because a second conference can be a real thing (next year's
 * edition). That choice is kept for this browser session, per account, so it
 * does not come back on a reload or a later step.
 *
 * NEVER shown:
 *   - to a visitor who opened the wizard signed out: they have nothing yet, and
 *     if they sign in at "Sign in to publish" the create runs at once. The
 *     visit is remembered for the session, so the remount after signing in
 *     cannot open it either.
 *   - while a "Sign in to publish" create is pending (readPendingCreate), on
 *     the reload after a redirect sign-in too
 *   - while the wizard is creating or its committee pop-up is open (`suppressed`)
 *   - while a root gate or the sign-in pop-up is deciding or open
 *     (useBasicsGateBlocking) or any other dialog is on screen: it waits, and
 *     opens only once nothing else is
 *   - when the read fails
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Construction } from 'lucide-react';
import { ModalOverlay } from '@/components/ModalOverlay';
import { LogoDisc } from '@/components/LogoDisc';
import { NEU, OUTFIT, NeuButton, Emoji3D } from '@/components/neu';
import { monogramFor } from '@/app/account/accountUi';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useBasicsGateBlocking } from '@/lib/basicsGateState';
import { readPendingCreate } from '@/lib/conferenceDrafts';
import { serverNow } from '@/lib/serverClock';
import { fetchUnstartedConferences, type UnstartedConference } from '@/lib/unstartedConferences';

const KEY_PREFIX = 'gavelling-existing-conference-prompt:';
const SIGNED_OUT_KEY = KEY_PREFIX + 'signed-out';

function readFlag(key: string): boolean {
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
}

function writeFlag(key: string): void {
  try { sessionStorage.setItem(key, '1'); } catch { /* private mode: it just may show again */ }
}

/** Any other dialog or full-screen layer on screen right now. */
function otherModalOnScreen(): boolean {
  if (typeof document === 'undefined') return false;
  const dialogs = document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"]');
  for (const el of Array.from(dialogs)) {
    if ((el as HTMLElement).getClientRects().length > 0) return true;
  }
  return false;
}

/** The short form a button can carry: the acronym, else the full name. */
function shortName(c: UnstartedConference): string {
  return c.acronym || c.full_name;
}

export function ExistingConferencePrompt({
  userId,
  suppressed,
}: {
  userId: string | null;
  suppressed: boolean;
}) {
  const router = useRouter();
  const gatesBlocking = useBasicsGateBlocking();
  const [found, setFound] = useState<UnstartedConference[] | null>(null);
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);

  // The read, keyed on the user id only (never the token or the session).
  useEffect(() => {
    if (!userId) {
      // Opened signed out: this session's wizard visit is theirs to finish.
      writeFlag(SIGNED_OUT_KEY);
      return;
    }
    if (readFlag(SIGNED_OUT_KEY) || readFlag(KEY_PREFIX + userId)) return;
    if (readPendingCreate()) return;
    let cancelled = false;
    (async () => {
      const sb = await getFreshAuthedClient();
      if (!sb || cancelled) return;
      const list = await fetchUnstartedConferences(sb, userId, serverNow());
      if (cancelled || !list || list.length === 0) return;
      setFound(list);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Open only when nothing else is on screen; check again every second until then.
  useEffect(() => {
    if (!found || open || closed || suppressed || gatesBlocking) return;
    const tryOpen = () => {
      if (readPendingCreate()) { setClosed(true); return true; }
      if (otherModalOnScreen()) return false;
      setOpen(true);
      return true;
    };
    if (tryOpen()) return;
    const id = window.setInterval(() => { if (tryOpen()) window.clearInterval(id); }, 1000);
    return () => window.clearInterval(id);
  }, [found, open, closed, suppressed, gatesBlocking]);

  function createAnyway() {
    if (userId) writeFlag(KEY_PREFIX + userId);
    setOpen(false);
    setClosed(true);
  }

  if (!open || !found || found.length === 0) return null;

  const first = found[0];
  const several = found.length > 1;

  return (
    <ModalOverlay
      onClose={createAnyway}
      labelledBy="existing-conference-title"
      scrimColor="rgba(27,20,16,0.42)"
    >
      <div
        className="w-full"
        style={{
          maxWidth: 460,
          borderRadius: 26,
          backgroundColor: NEU.surface,
          boxShadow: NEU.out,
          padding: '28px 26px 24px',
          fontFamily: OUTFIT,
        }}
      >
        <div className="flex justify-center" style={{ marginBottom: 12 }}>
          <span
            className="inline-flex items-center justify-center"
            style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
          >
            <Emoji3D name="Construction" size={34} fallback={Construction} fallbackColor={NEU.forest} />
          </span>
        </div>

        <h2
          id="existing-conference-title"
          className="text-center"
          style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em', color: NEU.ink }}
        >
          {several ? 'You Already Have Conferences' : 'You Already Have a Conference'}
        </h2>

        <p
          className="text-center [overflow-wrap:anywhere]"
          style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.55, color: NEU.inkSoft }}
        >
          {several
            ? 'These are not taking applications yet. Finish setting one up instead of starting a new one?'
            : `${first.full_name} is not taking applications yet. Finish setting it up instead of starting a new one?`}
        </p>

        <div
          style={{ borderRadius: 18, backgroundColor: NEU.base, boxShadow: NEU.in, padding: '4px 14px', marginBottom: 20 }}
        >
          {found.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => router.push(`/manage/${c.slug}`)}
              className="flex w-full items-center text-left focus:outline-none"
              style={{
                gap: 12,
                padding: '11px 0',
                border: 'none',
                borderTop: i > 0 ? NEU.hairline : 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: OUTFIT,
              }}
            >
              <LogoDisc src={c.logo_url} alt="" size={38} fallbackText={monogramFor(c.acronym || c.full_name)} />
              <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">
                <span className="block" style={{ fontSize: 15, fontWeight: 800, color: NEU.ink, lineHeight: 1.3 }}>
                  {shortName(c)}
                </span>
                {c.acronym && c.acronym !== c.full_name && (
                  <span className="block" style={{ fontSize: 12.5, fontWeight: 600, color: NEU.inkSoft, lineHeight: 1.35 }}>
                    {c.full_name}
                  </span>
                )}
              </span>
              <ArrowRight size={16} strokeWidth={2.4} className="flex-shrink-0" style={{ color: NEU.forest }} aria-hidden />
            </button>
          ))}
        </div>

        <div className="flex flex-col" style={{ gap: 10 }}>
          <NeuButton
            onClick={() => router.push(`/manage/${first.slug}`)}
            style={{ width: '100%', padding: '13px 22px', fontSize: 14, letterSpacing: 0, overflowWrap: 'anywhere' }}
          >
            {`Continue setting up ${shortName(first)}`}
          </NeuButton>
          <button
            type="button"
            onClick={createAnyway}
            className="inline-flex items-center justify-center w-full focus:outline-none"
            style={{
              borderRadius: 999,
              padding: '12px 18px',
              backgroundColor: NEU.base,
              boxShadow: NEU.outSm,
              border: 'none',
              color: NEU.ink,
              fontFamily: OUTFIT,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Create a new conference anyway
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
