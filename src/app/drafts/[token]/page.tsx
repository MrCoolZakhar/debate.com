'use client';

// Unfinished-application draft landing — /drafts/[token]
//
// The token is `application_drafts.discard_token`, and it is the only thing
// this page has: it arrives in the `draft_reminder` email, in the two plain
// links at the foot of that email. Modelled on /invites/import/[token] — the
// established token-addressed, anon-viewable, login-gated action page.
//
// Three behaviours, and the split between them is deliberate:
//
//  1. GET /drafts/{token} — resolves anonymously through the
//     `peek_application_draft` RPC (granted to anon). Read-only: conference,
//     role, when it was last edited, and a MASKED email. The RPC never
//     returns `answers`, so a forwarded link leaks no application content.
//
//  2. DELETE — an explicit, signed-in, confirmed button calling
//     `discard_application_draft`, which requires the token AND
//     user_id = auth.uid(). Deliberately NOT a one-click GET: corporate mail
//     scanners and link-safety products fetch every URL in a message, and
//     forwarded mail carries the token, so a drive-by GET would silently bin
//     somebody's half-written application.
//
//  3. ?stop=1 — calls `snooze_draft_reminders` (granted to anon), which sets
//     reminder_opt_out and touches nothing else. Idempotent, non-destructive,
//     and safe for a scanner to trip. This is the honest List-Unsubscribe
//     affordance: "stop emailing me" must never require an account.
//
// A bad, already-used or already-discarded token renders a plain "no longer
// valid" card. Secondary copy uses NEU.inkSoft; NEU.muted is 2.71:1 and is
// decoration only.

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileClock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseAuthClient } from '@/lib/supabase-auth';
import SiteNav from '@/components/SiteNav';
import { Eyebrow, OUTFIT } from '@/app/account/accountUi';
import { NEU, NEU_GRADIENTS, NeuIconDisc, NeuButton } from '@/components/neu';
import { committeeDisplayName } from '@/lib/presetNames';

const DANGER = '#8B2020';

interface DraftConference {
  acronym: string;
  slug: string;
  full_name: string;
}

interface DraftPeek {
  ok: boolean;
  reason?: string;
  role?: string;
  updated_at?: string;
  reminder_opt_out?: boolean;
  email_masked?: string | null;
  conference?: DraftConference;
}

// Uppercase forest-and-gold pill, the primary link CTA — the same recipe as
// NeuButton's rendered (non-hover) state, usable as a <Link>.
const primaryPillStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
  color: NEU.gold, textDecoration: 'none', fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.05em',
  boxShadow: `0 4px 10px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}`,
};

const secondaryPillStyle: React.CSSProperties = {
  backgroundColor: NEU.surface, color: NEU.forest, textDecoration: 'none',
  fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.05em', boxShadow: NEU.outSm,
};

function roleLabel(role: string): string {
  return role.replace(/-/g, ' ').toUpperCase();
}

function formatEdited(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
    </div>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav />
      <div className="relative z-10 flex-1 px-4 sm:px-6 py-10 sm:py-14 flex items-start justify-center">
        <div
          className="w-full rounded-[24px] px-6 sm:px-8 py-8 sm:py-10"
          style={{
            maxWidth: 460,
            backgroundColor: NEU.surface,
            boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

type StopState = 'idle' | 'working' | 'done' | 'already' | 'error';

function DraftLandingInner() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { user, loading: authLoading } = useAuth();

  const wantsStop = searchParams.get('stop') === '1';

  const [state, setState] = useState<'loading' | 'invalid' | 'open' | 'discarded'>('loading');
  const [draft, setDraft] = useState<DraftPeek | null>(null);
  const [stopState, setStopState] = useState<StopState>('idle');
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState('');

  const nextPath = `/drafts/${token}${wantsStop ? '?stop=1' : ''}`;

  const resolve = useCallback(async () => {
    if (!token) { setState('invalid'); return; }
    const { data, error } = await supabaseAuthClient.rpc('peek_application_draft', { p_token: token });
    const result = (data ?? null) as DraftPeek | null;
    if (error || !result || !result.ok) { setState('invalid'); return; }
    setDraft(result);
    setState('open');

    // ?stop=1 runs without a session, on purpose. Already opted out: say so
    // rather than pretending to have acted.
    if (wantsStop) {
      if (result.reminder_opt_out) { setStopState('already'); return; }
      setStopState('working');
      const { data: stopData, error: stopError } = await supabaseAuthClient.rpc('snooze_draft_reminders', { p_token: token });
      const stopResult = (stopData ?? null) as { ok?: boolean } | null;
      setStopState(stopError || !stopResult?.ok ? 'error' : 'done');
    }
  }, [token, wantsStop]);

  useEffect(() => {
    // The peek is anon-safe either way; waiting for auth only keeps the CTA
    // block from flashing the signed-out variant at a signed-in reader.
    if (authLoading) return;
    resolve();
  }, [authLoading, resolve]);

  async function handleDiscard() {
    if (discarding) return;
    setDiscarding(true);
    setDiscardError('');
    const { data, error } = await supabaseAuthClient.rpc('discard_application_draft', { p_token: token });
    const result = (data ?? null) as { ok?: boolean; reason?: string } | null;
    setDiscarding(false);
    if (error || !result) {
      setDiscardError('Something went wrong deleting this draft. Please try again.');
      return;
    }
    if (result.ok) { setState('discarded'); return; }
    if (result.reason === 'unauthenticated') {
      setDiscardError('Please sign in again — your session has expired.');
      return;
    }
    // 'not_found' also covers a token that belongs to somebody else's draft:
    // the delete matches on token AND owner, so a signed-in stranger simply
    // finds nothing to delete.
    setDiscardError('This draft is not on your account, so it cannot be deleted from here.');
  }

  if (state === 'loading') return <Spinner />;

  if (state === 'invalid') {
    return (
      <CardShell>
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={FileClock} size={52} style={{ marginBottom: 20 }} />
        <Eyebrow>Unfinished application</Eyebrow>
        <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          This link is no longer valid
        </h1>
        <p className="text-sm mb-6" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, lineHeight: 1.55 }}>
          The draft this link points to has been submitted, deleted, or never existed. If you are still hoping to apply, you can start again from the conference page.
        </p>
        <Link href="/conferences" className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
          BROWSE CONFERENCES
        </Link>
      </CardShell>
    );
  }

  if (state === 'discarded') {
    return (
      <CardShell>
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={FileClock} size={52} style={{ marginBottom: 20 }} />
        <Eyebrow>Unfinished application</Eyebrow>
        <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          Draft deleted
        </h1>
        <p className="text-sm mb-6" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, lineHeight: 1.55 }}>
          Your saved answers are gone and you will not be reminded about them again. You can always start a fresh application from the conference page.
        </p>
        <Link href="/conferences" className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
          BROWSE CONFERENCES
        </Link>
      </CardShell>
    );
  }

  const conf = draft!.conference!;
  const primaryName = committeeDisplayName(conf.full_name, conf.acronym) || conf.acronym || conf.full_name;
  const showFullName = primaryName !== conf.full_name && !!conf.full_name;
  const edited = formatEdited(draft!.updated_at);
  const role = draft!.role ?? 'delegate';
  const applyHref = `/conferences/${conf.slug}/apply?role=${encodeURIComponent(role)}`;

  return (
    <CardShell>
      <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={FileClock} size={52} style={{ marginBottom: 20 }} />
      <Eyebrow>Unfinished application</Eyebrow>
      <h1 className="font-black text-2xl mt-2 mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
        {primaryName}
      </h1>
      {showFullName && (
        <p className="text-sm mb-5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, lineHeight: 1.45 }}>
          {conf.full_name}
        </p>
      )}

      {/* ?stop=1 outcome, stated plainly and never overclaimed. */}
      {wantsStop && (
        <div className="rounded-2xl px-4 py-3 mb-5" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
          <p className="text-sm" style={{ color: stopState === 'error' ? DANGER : NEU.ink, fontFamily: OUTFIT, lineHeight: 1.5 }}>
            {stopState === 'working' && 'Turning these reminders off…'}
            {stopState === 'done' && 'Done — we will not email you about this unfinished application again. Your saved answers are untouched.'}
            {stopState === 'already' && 'Reminders for this draft were already off. Nothing to change, and your saved answers are untouched.'}
            {stopState === 'error' && 'We could not turn these reminders off just now. Please try the link again.'}
          </p>
        </div>
      )}

      {/* Read-only summary. No answers here — the RPC never returns them. */}
      <div className="rounded-2xl px-5 py-4 mb-7" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
        <p className="text-xs" style={{ color: NEU.deepGold, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.1em' }}>
          {roleLabel(role)}
        </p>
        <p className="text-sm mt-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.5 }}>
          You started this application and did not submit it. Your answers are saved.
        </p>
        {edited && (
          <p className="text-xs mt-2.5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
            Last edited {edited}
          </p>
        )}
        {draft!.email_masked && (
          <p className="text-xs mt-1" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, overflowWrap: 'anywhere' }}>
            Saved to {draft!.email_masked}
          </p>
        )}
      </div>

      {user ? (
        <div className="flex flex-col gap-3">
          <Link
            href={applyHref}
            className="inline-flex items-center justify-center rounded-full py-3 px-5 text-sm focus:outline-none"
            style={primaryPillStyle}
          >
            FINISH MY APPLICATION
          </Link>

          {confirming ? (
            <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
              <p className="text-sm mb-3" style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.5 }}>
                Delete this draft for good? Your saved answers cannot be recovered.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <NeuButton gradient={NEU_GRADIENTS.amber} disabled={discarding} onClick={handleDiscard}>
                  {discarding ? 'DELETING…' : 'YES, DELETE IT'}
                </NeuButton>
                <button
                  onClick={() => setConfirming(false)}
                  className="inline-flex items-center justify-center rounded-full py-2.5 px-5 text-xs focus:outline-none"
                  style={{ ...secondaryPillStyle, border: 'none', cursor: 'pointer', fontSize: 13 }}
                >
                  KEEP IT
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setConfirming(true); setDiscardError(''); }}
              className="inline-flex items-center justify-center rounded-full py-3 px-5 text-sm focus:outline-none"
              style={{ ...secondaryPillStyle, color: DANGER, border: 'none', cursor: 'pointer' }}
            >
              DELETE THIS DRAFT
            </button>
          )}

          {discardError && (
            <p className="text-xs" style={{ color: DANGER, fontFamily: OUTFIT, lineHeight: 1.55 }}>
              {discardError}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            href={`/auth/signup?next=${encodeURIComponent(nextPath)}`}
            className="inline-flex items-center justify-center rounded-full py-3 px-5 text-sm focus:outline-none"
            style={primaryPillStyle}
          >
            CREATE MY ACCOUNT
          </Link>
          <Link
            href={`/auth/signin?next=${encodeURIComponent(nextPath)}`}
            className="inline-flex items-center justify-center rounded-full py-3 px-5 text-sm focus:outline-none"
            style={secondaryPillStyle}
          >
            I ALREADY HAVE AN ACCOUNT
          </Link>
          <p className="text-xs" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, lineHeight: 1.55 }}>
            Sign in with the address this draft was saved to if you want to finish it or delete it. Turning reminders off never needs an account.
          </p>
        </div>
      )}
    </CardShell>
  );
}

export default function DraftLandingPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <DraftLandingInner />
    </Suspense>
  );
}
