'use client';

// Imported delegate claim landing — /invites/import/[token]
//
// An imported applicant (roster uploaded by an organizer, no account yet)
// receives a personal link to this page in their invitation email. Unlike the
// delegation invite (which redirects immediately), this page shows a real
// landing first: it names the conference, their seat, and offers a claim CTA.
//
// Flow:
//  1. Resolve the token via the anon-callable `get_import_invite` RPC. The
//     token is the sole credential and lives in the path.
//  2. Signed out: CREATE MY ACCOUNT / I ALREADY HAVE AN ACCOUNT, both carrying
//     ?next back here so they return to claim after auth.
//  3. Signed in: CLAIM MY REGISTRATION calls `claim_import_invite`, which
//     attaches the application + allocations to the caller, then we land them
//     on the conference role view.
//  4. Invalid / already-claimed tokens show a clean, self-contained card.

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseAuthClient } from '@/lib/supabase-auth';
import { reportBlocked } from '@/lib/reportCrash';
import SiteNav from '@/components/SiteNav';
import { Eyebrow, OUTFIT } from '@/app/account/accountUi';
import { NEU, NEU_GRADIENTS, NeuIconDisc, NeuButton } from '@/components/neu';

const MONO_STACK = "'DM Mono', monospace";
const DANGER = '#8B2020';

interface InviteConference {
  slug: string;
  acronym: string;
  full_name: string;
  logo_url: string | null;
  banner_url: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_tbd: boolean;
  city: string;
  country: string;
  is_public: boolean;
  status: string;
}

interface InviteAllocation {
  committee: string;
  abbreviation: string | null;
  country_name: string;
  country_code: string;
}

interface ImportInvite {
  ok: boolean;
  reason?: string;
  claimed?: boolean;
  invited_name?: string | null;
  invited_email_masked?: string | null;
  role?: string;
  application_status?: string;
  conference?: InviteConference;
  allocation?: InviteAllocation | null;
}

// Uppercase forest-and-gold pill, the primary link CTA — the same recipe as
// NeuButton's rendered (non-hover) state, usable as a <Link>.
const primaryPillStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
  color: NEU.gold, textDecoration: 'none', fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.05em',
  boxShadow: `0 4px 10px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}`,
};

// Quieter secondary pill: surface fill, forest ink, soft extrusion.
const secondaryPillStyle: React.CSSProperties = {
  backgroundColor: NEU.surface, color: NEU.forest, textDecoration: 'none',
  fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.05em', boxShadow: NEU.outSm,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return start ? formatDate(start) : null;
  if (start === end) return formatDate(start);
  return `${formatDate(start)} to ${formatDate(end)}`;
}

function roleLabel(role: string): string {
  return role.replace(/-/g, ' ').toUpperCase();
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
    </div>
  );
}

// Shared card shell — the same recipe as the delegation-invite failure card.
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav />
      <div className="relative z-10 flex-1 px-6 py-14 flex items-start justify-center">
        <div
          className="w-full rounded-[24px] px-8 py-10"
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

export default function ImportInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<'loading' | 'invalid' | 'claimed' | 'open'>('loading');
  const [invite, setInvite] = useState<ImportInvite | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');

  const nextPath = `/invites/import/${token}`;

  const resolve = useCallback(async () => {
    if (!token) { setState('invalid'); return; }
    const { data, error } = await supabaseAuthClient.rpc('get_import_invite', { p_token: token });
    const result = (data ?? null) as ImportInvite | null;
    if (error || !result || !result.ok) { setState('invalid'); return; }
    setInvite(result);
    setState(result.claimed ? 'claimed' : 'open');
  }, [token]);

  useEffect(() => {
    // Wait for auth to settle so the CTA renders the right variant, but the
    // resolve RPC is anon-safe either way.
    if (authLoading) return;
    resolve();
  }, [authLoading, resolve]);

  async function handleClaim() {
    if (claiming) return;
    setClaiming(true);
    setClaimError('');
    const { data, error } = await supabaseAuthClient.rpc('claim_import_invite', { p_token: token });
    const result = (data ?? null) as { ok: boolean; reason?: string; slug?: string } | null;
    if (error || !result) {
      setClaiming(false);
      // An imported delegate cannot get into the conference they were
      // registered for, and this page is the only door they have.
      reportBlocked('claim imported registration', error ?? new Error('claim rpc returned no result'));
      setClaimError('Something went wrong claiming your registration. Please try again.');
      return;
    }
    if (result.ok && result.slug) {
      router.replace(`/conferences/${result.slug}/role`);
      return;
    }
    if (result.reason === 'claimed') {
      setClaiming(false);
      setState('claimed');
      return;
    }
    if (result.reason === 'auth_required') {
      router.replace(`/auth/signin?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    // Everything above this line is a NORMAL outcome — claimed already, or a
    // bounce through sign-in — and is deliberately not reported. Reaching here
    // means get_import_invite said the invite was open and the claim still
    // refused, which is a real fault.
    setClaiming(false);
    reportBlocked('claim imported registration', new Error(`claim refused: ${result.reason ?? 'no reason'}`), {
      reason: result.reason ?? null,
    });
    setClaimError('This invitation could not be claimed. Ask your conference organizer to send you a new one.');
  }

  if (state === 'loading') return <Spinner />;

  if (state === 'invalid') {
    return (
      <CardShell>
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Landmark} size={52} style={{ marginBottom: 20 }} />
        <Eyebrow>Imported delegate</Eyebrow>
        <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          Invitation not found
        </h1>
        <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
          This invitation link is not valid. It may have been claimed already or removed. Ask your conference organizer to send you a new one.
        </p>
        <Link href="/conferences" className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
          BROWSE CONFERENCES
        </Link>
      </CardShell>
    );
  }

  if (state === 'claimed') {
    return (
      <CardShell>
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Landmark} size={52} style={{ marginBottom: 20 }} />
        <Eyebrow>Imported delegate</Eyebrow>
        <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          Already claimed
        </h1>
        <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
          This invitation has already been claimed. If that was you, your conference is waiting in My Conferences.
        </p>
        <Link href="/my-conferences" className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
          GO TO MY CONFERENCES
        </Link>
      </CardShell>
    );
  }

  // Open invitation
  const conf = invite!.conference!;
  const alloc = invite!.allocation ?? null;
  const dateLine = conf.dates_tbd ? null : formatDateRange(conf.start_date, conf.end_date);
  const placeLine = [conf.city, conf.country].filter(Boolean).join(', ');
  const whenWhere = [dateLine, placeLine].filter(Boolean).join(' · ');

  return (
    <CardShell>
      {conf.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={conf.logo_url}
          alt={`${conf.acronym} logo`}
          width={56}
          height={56}
          style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', marginBottom: 20, boxShadow: NEU.outSm }}
        />
      ) : (
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Landmark} size={56} style={{ marginBottom: 20 }} />
      )}

      <Eyebrow>You are invited</Eyebrow>
      <h1 className="font-black text-2xl mt-2 mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.15 }}>
        {conf.full_name}
      </h1>
      {whenWhere && (
        <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          {whenWhere}
        </p>
      )}

      {/* Pressed-in details panel */}
      <div className="rounded-2xl px-5 py-4 mb-7" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
        <p className="font-black text-base" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          {invite!.invited_name || 'Your registration'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: NEU.deepGold, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.1em' }}>
          {roleLabel(invite!.role ?? 'delegate')}
        </p>
        {alloc && (
          <p className="text-sm mt-2.5 flex flex-wrap items-center gap-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Representing {alloc.country_name} in {alloc.committee}
            {alloc.abbreviation && (
              <span style={{ fontFamily: MONO_STACK, fontSize: 11, fontWeight: 700, color: NEU.deepGold, letterSpacing: '0.04em' }}>
                {alloc.abbreviation}
              </span>
            )}
          </p>
        )}
        {invite!.invited_email_masked && (
          <p className="text-xs mt-3" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            Invitation for {invite!.invited_email_masked}
          </p>
        )}
      </div>

      {/* CTAs */}
      {user ? (
        <>
          <NeuButton
            gradient={NEU_GRADIENTS.gold}
            disabled={claiming}
            onClick={handleClaim}
            style={{ width: '100%' }}
          >
            {claiming ? 'CLAIMING...' : 'CLAIM MY REGISTRATION'}
          </NeuButton>
          {claimError && (
            <p className="text-xs mt-3" style={{ color: DANGER, fontFamily: OUTFIT, lineHeight: 1.55 }}>
              {claimError}
            </p>
          )}
        </>
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
        </div>
      )}
    </CardShell>
  );
}
