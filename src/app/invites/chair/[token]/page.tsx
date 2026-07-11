'use client';

// Chair invite acceptance page. Auth-gated like /my-conferences — signed-out
// visitors bounce to sign-in and land back here with the token intact since
// it lives in the path, not a query param. Loads the invite via the
// SECURITY DEFINER get_chair_invite RPC (token is the sole credential, so
// this must never leak invite details to the wrong account) and resolves it
// with respond_chair_invite.

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Gavel } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import SiteNav from '@/components/SiteNav';
import { Eyebrow, OUTFIT } from '@/app/account/accountUi';

interface InviteData {
  ok: boolean;
  error?: string;
  status?: 'pending' | 'accepted' | 'declined' | 'revoked';
  email?: string;
  conference_name?: string;
  acronym?: string;
  slug?: string;
  committee_name?: string;
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  accepted: { title: "You're already chairing this committee", body: 'This invitation was accepted earlier — no further action needed.' },
  declined: { title: 'Invitation declined', body: "You've declined this invitation. If that was a mistake, ask the organizer to send a new one." },
  revoked: { title: 'This invitation was revoked', body: 'The organizer withdrew this invite before it was answered.' },
};

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
    </div>
  );
}

export default function ChairInvitePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user, session, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');

  // ── Auth gate — preserves the token by redirecting back to this exact path.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  const load = useCallback(async () => {
    if (!session || !token) return;
    setLoading(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const { data, error: rpcErr } = await supabase.rpc('get_chair_invite', { p_token: token });
    setLoading(false);
    if (rpcErr) { setError(rpcErr.message || 'Could not load this invite.'); return; }
    setInvite(data as InviteData);
  }, [session, token]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, load]);

  async function respond(accept: boolean) {
    if (!session || !token) return;
    setResponding(accept ? 'accept' : 'decline');
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const { data, error: rpcErr } = await supabase.rpc('respond_chair_invite', { p_token: token, p_accept: accept });
    setResponding(null);
    if (rpcErr) { setError(rpcErr.message || 'Could not respond to this invite.'); return; }
    const result = data as { ok: boolean; error?: string };
    if (!result.ok) { setError(result.error ?? 'Could not respond to this invite.'); return; }

    if (accept) {
      router.push('/my-conferences?tab=chair&chairInvite=accepted');
    } else {
      setInvite(prev => (prev ? { ...prev, status: 'declined' } : prev));
    }
  }

  if (authLoading || !user || loading) return <Spinner />;

  const failed = !invite || !invite.ok;
  const resolvedCopy = invite?.status && invite.status !== 'pending' ? STATUS_COPY[invite.status] : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
      <SiteNav />
      <div className="relative z-10 flex-1 px-6 py-14 flex items-start justify-center">
        <div
          className="w-full rounded-[24px] px-8 py-10"
          style={{
            maxWidth: 460,
            backgroundColor: 'rgba(250,248,243,0.9)',
            backdropFilter: 'blur(14px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
            border: '1px solid #DDD4C0',
            boxShadow: '0 20px 50px rgba(27,56,40,0.12)',
          }}
        >
          <span
            className="flex items-center justify-center mb-5"
            style={{
              width: 52, height: 52, borderRadius: '9999px',
              background: 'linear-gradient(150deg, rgba(27,56,40,0.14), rgba(27,56,40,0.05))',
              border: '1.5px solid rgba(27,56,40,0.2)',
            }}
          >
            <Gavel size={22} style={{ color: '#1B3828' }} />
          </span>

          {failed ? (
            <>
              <Eyebrow>Chair Invite</Eyebrow>
              <h1 className="font-black text-xl mt-2 mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Invite not found
              </h1>
              <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.55 }}>
                {invite?.error ?? error ?? "This invite link isn't valid. It may have been mistyped or already removed."}
              </p>
              <Link
                href="/my-conferences"
                className="inline-flex items-center gap-2 rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em' }}
              >
                GO TO MY CONFERENCES
              </Link>
            </>
          ) : resolvedCopy ? (
            <>
              <Eyebrow>{invite!.acronym}</Eyebrow>
              <h1 className="font-black text-xl mt-2 mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                {resolvedCopy.title}
              </h1>
              <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.55 }}>
                {resolvedCopy.body}
              </p>
              <Link
                href="/my-conferences?tab=chair"
                className="inline-flex items-center gap-2 rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em' }}
              >
                GO TO MY CONFERENCES
              </Link>
            </>
          ) : (
            <>
              <Eyebrow>{invite!.acronym}</Eyebrow>
              <h1 className="font-black text-xl mt-2 mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Chair {invite!.committee_name}
              </h1>
              <p className="text-sm mb-6" style={{ color: '#6B5F52', fontFamily: OUTFIT, lineHeight: 1.55 }}>
                You&apos;ve been invited to chair <strong style={{ color: '#1C1410' }}>{invite!.committee_name}</strong> at{' '}
                <strong style={{ color: '#1C1410' }}>{invite!.conference_name}</strong>. Accepting adds this conference to your Gavelling account.
              </p>

              {error && (
                <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ color: '#8B2020', fontFamily: OUTFIT, backgroundColor: 'rgba(139,32,32,0.07)', border: '1px solid rgba(139,32,32,0.25)' }}>
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => respond(false)}
                  disabled={responding !== null}
                  className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none flex items-center justify-center gap-2"
                  style={{
                    border: '1.5px solid #DDD4C0', color: responding ? '#C8BEA8' : '#1C1410',
                    backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: responding ? 'not-allowed' : 'pointer',
                  }}
                >
                  <X size={14} /> {responding === 'decline' ? 'DECLINING…' : 'DECLINE'}
                </button>
                <button
                  onClick={() => respond(true)}
                  disabled={responding !== null}
                  className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: responding ? '#DDD4C0' : '#1B3828', color: responding ? '#9A8A78' : '#EED98A',
                    fontFamily: OUTFIT, cursor: responding ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Check size={14} /> {responding === 'accept' ? 'ACCEPTING…' : 'ACCEPT'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
