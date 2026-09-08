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
import { reportBlocked } from '@/lib/reportCrash';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { Eyebrow, OUTFIT } from '@/app/account/accountUi';
import { NEU, NEU_GRADIENTS, NeuButton, NeuIconDisc } from '@/components/neu';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';

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

// Uppercase forest-and-gold pill, the primary link CTA — same recipe as
// NeuButton's own (non-hover) rendered state, just usable as a <Link>.
const primaryPillStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
  color: NEU.gold, textDecoration: 'none', fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.05em',
  boxShadow: `0 4px 10px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}`,
};

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

  /** An organizer invite is keyed to an email address: respond_organizer_invite
   *  refuses unless the signed-in account's email matches (chair invites have
   *  no such gate, token possession is enough there, which is why only this
   *  page needs any of this).
   *
   *  We know both addresses the moment the invite loads, so there is no reason
   *  to let someone press ACCEPT and be told no. It used to do exactly that:
   *  the mismatch surfaced only as a red error AFTER the click, which is one
   *  blocked user and one crash alert every time. Most invitees hit this
   *  honestly rather than maliciously: 38 of the 49 pending organizer invites
   *  are addressed to someone with no Gavelling account at all, so they open
   *  the link on a device where they are already signed in as somebody else. */
  const inviteEmail = invite?.email?.trim() ?? '';
  const accountEmail = user?.email?.trim() ?? '';
  const emailMismatch =
    inviteEmail !== '' && accountEmail !== '' &&
    inviteEmail.toLowerCase() !== accountEmail.toLowerCase();

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
    const result = data as { ok: boolean; error?: string; slug?: string } | null;
    // One report for both failure branches — see the chair invite page for the
    // reasoning. Accept only: a failed decline costs nobody their access.
    if (rpcErr || !result?.ok) {
      // The wrong-account case is handled before the button is ever offered,
      // so if it still comes back it is a race (the invite was re-issued to
      // another address while this page was open), not a platform fault.
      // Alerting on it would page us about a user typing the wrong login.
      const wrongAccount = !rpcErr && !!result?.error && /Sign in with that email|different account/i.test(result.error);
      if (accept && !wrongAccount) {
        reportBlocked('accept organizer invite', rpcErr ?? new Error(result?.error ?? 'rpc returned ok:false'), {
          conferenceSlug: invite?.slug ?? null,
          inviteStatus: invite?.status ?? null,
        });
      }
      setError((rpcErr ? rpcErr.message : result?.error) || 'Could not respond to this invite.');
      return;
    }

    if (accept) {
      router.push(`/manage/${result.slug ?? invite?.slug ?? ''}?organizerInvite=accepted`);
    } else {
      setInvite(prev => (prev ? { ...prev, status: 'declined' } : prev));
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
        <Loader size={72} label="Loading invitation" />
      </div>
    );
  }

  if (!user) {
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

            <Eyebrow>Organizer Invite</Eyebrow>
            <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              Sign in to view this invite
            </h1>
            {/* If we already loaded the invite this session (the usual way to
                get here is SIGN OUT AND SWITCH ACCOUNT, which clears `user`
                but not this component's state), name the address instead of
                describing it. Signing out and being told "use the right email"
                without being told which one is how someone ends up going round
                this loop twice. We never fetch it while signed out, so a cold
                visitor is told no more than they were before. */}
            <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
              {inviteEmail
                ? <>Sign in as <strong style={{ color: NEU.ink }}>{inviteEmail}</strong>, or create a free Gavelling account with that address, and you&apos;ll land right back here to accept it.</>
                : <>Sign in or create a free Gavelling account with the email address this invite was sent to, and you&apos;ll land right back here to accept it.</>}
            </p>

            <div className="flex gap-3">
              <Link
                href={`/auth/signin?next=${encodeURIComponent(pathname)}`}
                className="flex-1 rounded-full py-2.5 font-bold text-sm focus:outline-none flex items-center justify-center gap-2"
                style={{ border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontFamily: OUTFIT, textDecoration: 'none' }}
              >
                <LogIn size={14} /> SIGN IN
              </Link>
              <Link
                href={`/auth/signup?next=${encodeURIComponent(pathname)}`}
                className="flex-1 inline-flex items-center gap-2 rounded-full py-2.5 font-bold text-sm focus:outline-none justify-center"
                style={primaryPillStyle}
              >
                <UserPlus size={14} /> CREATE ACCOUNT
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
        <Loader size={72} label="Loading invitation" />
      </div>
    );
  }

  const failed = !invite || !invite.ok;
  const resolvedCopy = invite?.status && invite.status !== 'pending' ? STATUS_COPY[invite.status] : null;

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
          {failed ? (
            <>
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Users2} size={52} style={{ marginBottom: 20 }} />
              <Eyebrow>Organizer Invite</Eyebrow>
              <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                Invite not found
              </h1>
              <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
                {invite?.error ?? error ?? "This invite link isn't valid. It may have been mistyped or already removed."}
              </p>
              <Link href="/my-conferences" className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
                GO TO MY CONFERENCES
              </Link>
            </>
          ) : resolvedCopy ? (
            <>
              <MonogramMedallion text={invite!.acronym || invite!.conference_name || '?'} isCrisis={false} size={52} />
              <div className="mt-5">
                <Eyebrow>{invite!.acronym}</Eyebrow>
                <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                  {resolvedCopy.title}
                </h1>
                <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
                  {resolvedCopy.body}
                </p>
                <Link href="/my-conferences" className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
                  GO TO MY CONFERENCES
                </Link>
              </div>
            </>
          ) : (
            <>
              <MonogramMedallion text={invite!.acronym || invite!.conference_name || '?'} isCrisis={false} size={52} />
              <div className="mt-5">
                <Eyebrow>{invite!.acronym}</Eyebrow>
                <h1 className="font-black text-xl mt-2 mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                  Join the organizing team
                </h1>
                <p className="text-sm mb-6" style={{ color: '#6B5F52', fontFamily: OUTFIT, lineHeight: 1.55 }}>
                  You&apos;ve been invited to help organize <strong style={{ color: NEU.ink }}>{invite!.conference_name}</strong>.
                  {emailMismatch
                    ? ' To accept it you need to be signed in as the person it was sent to.'
                    : ' Accepting gives you access to the conference management dashboard.'}
                </p>

                {/* Wrong account. Say so plainly, name both addresses so it is
                    obvious which one to use, and give them the way out instead
                    of an ACCEPT button that cannot work. */}
                {emailMismatch && (
                  <div
                    className="mb-6 rounded-xl px-4 py-3"
                    style={{ backgroundColor: 'rgba(184,132,74,0.08)', border: '1px solid rgba(184,132,74,0.28)' }}
                  >
                    <p className="text-xs mb-2" style={{ color: '#6B5F52', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                      This invite was sent to <strong style={{ color: NEU.ink }}>{inviteEmail}</strong>, but you&apos;re
                      signed in as <strong style={{ color: NEU.ink }}>{accountEmail}</strong>.
                    </p>
                    <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.6 }}>
                      Sign out and sign in with {inviteEmail}. If there is no account for it yet, you can create one
                      in a minute and come straight back here.
                    </p>
                  </div>
                )}

                {error && !emailMismatch && (
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

                {emailMismatch ? (
                  // No ACCEPT here: the RPC would refuse it. DECLINE is gone
                  // too, because this account has no standing to answer an
                  // invite addressed to someone else, and a stray click would
                  // burn the real invitee's invite.
                  <NeuButton
                    icon={LogOut}
                    onClick={handleSwitchAccount}
                    disabled={switchingAccount}
                    style={{ width: '100%' }}
                  >
                    {switchingAccount ? 'SIGNING OUT…' : 'SIGN OUT AND SWITCH ACCOUNT'}
                  </NeuButton>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => respond(false)}
                      disabled={responding !== null}
                      className="flex-1 rounded-full py-2.5 font-bold text-sm focus:outline-none flex items-center justify-center gap-2"
                      style={{
                        border: 'none', color: NEU.ink, backgroundColor: NEU.surface,
                        boxShadow: responding !== null ? 'none' : NEU.outSm,
                        fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: responding !== null ? 'default' : 'pointer',
                      }}
                    >
                      <X size={14} /> {responding === 'decline' ? 'DECLINING…' : 'DECLINE'}
                    </button>
                    <NeuButton icon={Check} onClick={() => respond(true)} disabled={responding !== null} style={{ flex: 1 }}>
                      {responding === 'accept' ? 'ACCEPTING…' : 'ACCEPT'}
                    </NeuButton>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
