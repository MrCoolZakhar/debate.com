'use client';

// Delegation invite landing — /invites/delegation/[token]
//
// A head delegate / faculty advisor generates one of these links from their
// delegation portal (/delegation/[societyId]) and shares it with their
// delegates. Opening it drops the visitor straight into the conference's
// delegate apply flow, pre-joined to that delegation.
//
// Flow (contract agreed with the apply-flow agent):
//  1. Resolve the token via the SECURITY DEFINER `resolve_delegation_invite`
//     RPC (granted to anon, so signed-out visitors can resolve too). The token
//     is the sole credential and lives in the path.
//  2. If valid, build the apply URL:
//       /conferences/[slug]/apply?role=delegate&delegationInvite=[token]
//     - signed in  → redirect straight there.
//     - signed out → redirect to /auth/signin?next=<apply URL> so they land on
//       apply after auth (the token rides along in the apply URL query param,
//       and the apply flow re-resolves it to pre-select the delegation).
//  3. Invalid / expired tokens show a clean, self-contained message.

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Users2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseAuthClient } from '@/lib/supabase-auth';
import SiteNav from '@/components/SiteNav';
import { Eyebrow, OUTFIT } from '@/app/account/accountUi';
import { NEU, NEU_GRADIENTS, NeuIconDisc } from '@/components/neu';

interface Resolved {
  ok: boolean;
  error?: string;
  society_id?: string;
  society_name?: string;
  conference_id?: string;
  slug?: string;
}

// Uppercase forest-and-gold pill, the primary link CTA — same recipe as
// NeuButton's own (non-hover) rendered state, just usable as a <Link>.
const primaryPillStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
  color: NEU.gold, textDecoration: 'none', fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.05em',
  boxShadow: `0 4px 10px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}`,
};

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
    </div>
  );
}

export default function DelegationInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { user, loading: authLoading } = useAuth();

  // 'idle' while we resolve + redirect; 'failed' when the token is bad/expired.
  const [state, setState] = useState<'idle' | 'failed'>('idle');
  const [error, setError] = useState('');

  const resolve = useCallback(async () => {
    if (!token) { setState('failed'); setError('This invite link is missing its token.'); return; }

    const { data, error: rpcErr } = await supabaseAuthClient.rpc('resolve_delegation_invite', { p_token: token });
    if (rpcErr) { setState('failed'); setError(rpcErr.message || 'Could not open this invite.'); return; }

    const result = (data ?? null) as Resolved | null;
    if (!result || !result.ok || !result.slug) {
      setState('failed');
      setError(result?.error ?? "This invite link isn't valid. It may have expired or been removed.");
      return;
    }

    const applyUrl = `/conferences/${result.slug}/apply?role=delegate&delegationInvite=${encodeURIComponent(token)}`;
    if (user) {
      router.replace(applyUrl);
    } else {
      router.replace(`/auth/signin?next=${encodeURIComponent(applyUrl)}`);
    }
  }, [token, user, router]);

  useEffect(() => {
    // Wait for auth to settle so we know whether to go straight to apply or via
    // sign-in — but resolve is anon-safe either way.
    if (authLoading) return;
    resolve();
  }, [authLoading, resolve]);

  if (state !== 'failed') return <Spinner />;

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
          <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Users2} size={52} style={{ marginBottom: 20 }} />

          <Eyebrow>Delegation Invite</Eyebrow>
          <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Invite not valid
          </h1>
          <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
            {error}
          </p>
          <Link href="/conferences" className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
            BROWSE CONFERENCES
          </Link>
        </div>
      </div>
    </div>
  );
}
