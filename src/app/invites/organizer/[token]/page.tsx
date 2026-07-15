'use client';

// Organizer (secretariat) invite acceptance page — mirrors /invites/chair.
// Auth-gated: signed-out visitors get a choice (sign in or create account),
// both of which land back here with the token intact since it lives in the
// path, including through email confirmation via /auth/callback's next=.
// Loads the invite via the SECURITY DEFINER get_organizer_invite RPC (token
// is the sole credential) and resolves it with respond_organizer_invite,
// which inserts the conference_organizers row with default (empty)
// permissions and returns the slug so we can land straight on /manage/[slug].

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Users2, LogIn, UserPlus, LogOut } from 'lucide-react';
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
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  accepted: { title: "You're already on this team", body: 'This invitation was accepted earlier, no further action needed.' },
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

export default function OrganizerInvitePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user, session, loading: authLoading, signOut } = useAuth();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');
  const [switchingAccount, setSwitchingAccount] = useState(false);

  // Signed out visitors are never auto-redirected — the gate below offers a
  // choice (sign in vs. create account) and both paths preserve this exact
  // token URL through /auth/callback so the invite is right there afterward.

  async function handleSwitchAccount() {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    await signOut();
    // No explicit navigation needed: user becomes null and the signed-out
    // gate below renders in its place, still on this same token URL.
    setSwitchingAccount(false);
  }

  const load = useCallback(async () => {
    if (!session || !token) return;
    setLoading(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const { data, error: rpcErr } = await supabase.rpc('get_organizer_invite', { p_token: token });
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
    const { data, error: rpcErr } = await supabase.rpc('respond_organizer_invite', { p_token: token, p_accept: accept });
    setResponding(null);
    if (rpcErr) { setError(rpcErr.message || 'Could not respond to this invite.'); return; }
    const result = data as { ok: boolean; error?: string; slug?: string };
    if (!result.ok) { setError(result.error ?? 'Could not respond to this invite.'); return; }

    if (accept) {
      router.push(`/manage/${result.slug ?? invite?.slug ?? ''}?organizerInvite=accepted`);
    } else {
      setInvite(prev => (prev ? { ...prev, status: 'declined' } : prev));
    }
  }

  if (authLoading) return <Spinner />;

  if (!user) {
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
              <Users2 size={22} style={{ color: '#1B3828' }} />
            </span>

            <Eyebrow>Organizer Invite</Eyebrow>
            <h1 className="font-black text-xl mt-2 mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Sign in to view this invite
            </h1>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.55 }}>
              Sign in or create a free Gavelling account with the email address this invite was sent to, and you&apos;ll land right back here to accept it.
            </p>

            <div className="flex gap-3">
              <Link
                href={`/auth/signin?next=${encodeURIComponent(pathname)}`}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none flex items-center justify-center gap-2 transition-colors"
                style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, textDecoration: 'none' }}
              >
                <LogIn size={14} /> SIGN IN
              </Link>
              <Link
                href={`/auth/signup?next=${encodeURIComponent(pathname)}`}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none flex items-center justify-center gap-2 transition-colors"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, textDecoration: 'none' }}
              >
                <UserPlus size={14} /> CREATE ACCOUNT
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <Spinner />;

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
            <Users2 size={22} style={{ color: '#1B3828' }} />
          </span>

          {failed ? (
            <>
              <Eyebrow>Organizer Invite</Eyebrow>
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
                href="/my-conferences"
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
                Join the organizing team
              </h1>
              <p className="text-sm mb-6" style={{ color: '#6B5F52', fontFamily: OUTFIT, lineHeight: 1.55 }}>
                You&apos;ve been invited to help organize <strong style={{ color: '#1C1410' }}>{invite!.conference_name}</strong>.
                Accepting gives you access to the conference management dashboard.
              </p>

              {error && (
                <div className="mb-4">
                  <p className="text-xs rounded-lg px-3 py-2" style={{ color: '#8B2020', fontFamily: OUTFIT, backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)' }}>
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    disabled={switchingAccount}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold focus:outline-none"
                    style={{ color: switchingAccount ? '#C8BEA8' : '#8B2020', fontFamily: OUTFIT, background: 'none', border: 'none', cursor: switchingAccount ? 'not-allowed' : 'pointer', letterSpacing: '0.04em' }}
                  >
                    <LogOut size={12} /> {switchingAccount ? 'SIGNING OUT…' : 'SIGN OUT AND SWITCH ACCOUNT'}
                  </button>
                </div>
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
