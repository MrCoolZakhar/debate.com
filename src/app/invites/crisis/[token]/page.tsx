'use client';

// Gavelling Crisis: the page behind the emailed invite: staff (backroomer, Assistant Crisis Director, press), or a seat the
// Crisis Director already set up (a delegate's character or a chair's cabinet, part 46).
// Modelled on /invites/chair/[token]. The invite is read signed out through get_crisis_staff_invite (the token is the
// credential and the answer holds no names), so a visitor sees what they are joining before signing in. Signing in is the
// shared pop-up (openAuth) and brings them back here. Accepting adds them to the crisis on their Gavelling account.

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Landmark } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { friendlyError } from '@/lib/friendlyError';
import { getStaffInvite, respondStaffInvite, type StaffInvite } from '@/lib/crisis/api';
import { ROLE_LABEL } from '@/lib/crisis/types';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { Eyebrow, OUTFIT } from '@/app/account/accountUi';
import { NEU, NEU_GRADIENTS, NeuButton, NeuIconDisc } from '@/components/neu';
import { MonogramMedallion } from '@/components/MonogramMedallion';

type Ok = Extract<StaffInvite, { ok: true }>;

const AS_WORDS: Record<Ok['role'], string> = {
  director: 'a Crisis Director',
  backroomer: 'a backroomer',
  assistant_director: 'an Assistant Crisis Director',
  press: 'press',
  chair: 'a chair',
  delegate: 'a delegate',
};

/** A seat names itself: the character a delegate plays, the cabinet a chair runs. */
function asWords(ok: Ok): string {
  if (ok.role === 'delegate' && ok.character_name) return ok.character_name;
  if (ok.role === 'chair' && ok.cabinet_name) return `the chair of ${ok.cabinet_name}`;
  return AS_WORDS[ok.role] ?? 'a member';
}

const STATUS_COPY: Record<'accepted' | 'declined' | 'revoked', string> = {
  accepted: 'You already accepted this invite. Nothing else to do.',
  declined: 'You declined this invite. Ask the Crisis Director to send a new one.',
  revoked: 'The Crisis Director cancelled this invite.',
};

const primaryPillStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
  color: NEU.gold, textDecoration: 'none', fontFamily: OUTFIT, fontWeight: 800,
  boxShadow: `0 4px 10px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 30%, transparent), ${NEU.outSm}`,
};

export default function CrisisInvitePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user, signOut, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<StaffInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');
  const [wrongEmail, setWrongEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setInvite(await getStaffInvite(token));
      setLoadError('');
    } catch (e) {
      setLoadError(friendlyError(e, 'Could not load this invite.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function respond(accept: boolean) {
    if (!token || responding) return;
    setResponding(accept ? 'accept' : 'decline');
    setError('');
    setWrongEmail(null);
    try {
      const r = await respondStaffInvite(token, accept);
      if (r.ok) {
        if (r.accepted) { router.replace(`/crisis/${r.conference_slug}/${r.crisis_slug}`); return; }
        setInvite((prev) => (prev && prev.ok ? { ...prev, status: 'declined' } : prev));
        return;
      }
      switch (r.reason) {
        case 'signin':
          openAuth({ next: pathname });
          break;
        case 'wrong_account':
          setWrongEmail(r.invited_email ?? '');
          setError(`This invite is for ${r.invited_email ?? 'another email'}. Sign in with that email.`);
          break;
        case 'already_member':
          setError(`You are already in this crisis as ${ROLE_LABEL[(r.role as keyof typeof ROLE_LABEL) ?? 'backroomer'] ?? 'staff'}.`);
          break;
        case 'accepted':
        case 'declined':
        case 'revoked': {
          const status = r.reason;
          setInvite((prev) => (prev && prev.ok ? { ...prev, status } : prev));
          break;
        }
        default:
          setInvite({ ok: false, reason: 'not_found' });
      }
    } catch (e) {
      setError(friendlyError(e, 'Could not answer this invite. Try again.'));
    } finally {
      setResponding(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
        <Loader size={72} label="Loading invitation" />
      </div>
    );
  }

  const ok = invite && invite.ok ? invite : null;
  const closedCopy = ok && ok.status !== 'pending' ? STATUS_COPY[ok.status] : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav />
      <div className="relative z-10 flex-1 px-4 sm:px-6 py-10 sm:py-14 flex items-start justify-center">
        <div
          className="w-full rounded-[24px] px-6 sm:px-8 py-8 sm:py-10"
          style={{ maxWidth: 460, backgroundColor: NEU.surface, boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)` }}
        >
          {!ok ? (
            <>
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Landmark} size={52} style={{ marginBottom: 20 }} />
              <Eyebrow>Crisis Invite</Eyebrow>
              <h1 className="font-black text-xl mt-2 mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>Invite Not Found</h1>
              <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
                {loadError || "This invite link isn't valid. It may have been mistyped or removed."}
              </p>
              <Link href="/crisis" className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
                Go to Gavelling Crisis
              </Link>
            </>
          ) : (
            <>
              <div className="flex">
                {ok.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ok.logo_url} alt="" width={52} height={52} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <MonogramMedallion text={ok.acronym || ok.conference_name || '?'} isCrisis size={52} />
                )}
              </div>
              <div className="mt-5">
                <Eyebrow>{ok.conference_name}</Eyebrow>
                <h1 className="font-black text-xl mt-2 mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{ok.crisis_name}</h1>

                {closedCopy ? (
                  <>
                    <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>{closedCopy}</p>
                    {ok.status === 'accepted' && user && (
                      <Link href={`/crisis/${ok.conference_slug}/${ok.crisis_slug}`} className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 font-bold text-sm focus:outline-none" style={primaryPillStyle}>
                        Open the crisis
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm mb-6" style={{ color: '#6B5F52', fontFamily: OUTFIT, lineHeight: 1.55 }}>
                      You&apos;re invited to join as {asWords(ok)}. Accepting adds this crisis to your Gavelling account.
                    </p>

                    {error && (
                      <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ color: '#8B2020', fontFamily: OUTFIT, backgroundColor: 'rgba(139,32,32,0.07)', border: '1px solid rgba(139,32,32,0.25)' }}>
                        {error}
                      </p>
                    )}

                    {!user ? (
                      <NeuButton onClick={() => openAuth({ next: pathname, email: ok.email })} style={{ width: '100%' }}>
                        Log in or sign up to accept
                      </NeuButton>
                    ) : (
                      <>
                        {wrongEmail !== null && (
                          <div className="mb-4">
                            <button
                              type="button"
                              disabled={signingOut}
                              onClick={async () => {
                                if (signingOut) return;
                                setSigningOut(true);
                                try { await signOut(); setError(''); setWrongEmail(null); } finally { setSigningOut(false); }
                              }}
                              className="rounded-full px-5 py-2.5 font-bold text-sm focus:outline-none"
                              style={{ border: '1.5px solid rgba(27,56,40,0.35)', background: '#FFFFFF', color: NEU.ink, fontFamily: OUTFIT, cursor: signingOut ? 'default' : 'pointer' }}
                            >
                              {signingOut ? 'Signing out' : 'Sign out and switch account'}
                            </button>
                          </div>
                        )}
                        <div className="flex gap-3">
                          <button
                            onClick={() => void respond(false)}
                            disabled={responding !== null}
                            className="flex-1 rounded-full py-3 sm:py-2.5 font-bold text-sm focus:outline-none flex items-center justify-center gap-2"
                            style={{
                              border: 'none', color: NEU.ink, backgroundColor: NEU.surface,
                              boxShadow: responding !== null ? 'none' : NEU.outSm,
                              fontFamily: OUTFIT, cursor: responding !== null ? 'default' : 'pointer',
                            }}
                          >
                            <X size={14} /> {responding === 'decline' ? 'Declining' : 'Decline'}
                          </button>
                          <NeuButton icon={Check} onClick={() => void respond(true)} disabled={responding !== null} style={{ flex: 1 }}>
                            {responding === 'accept' ? 'Accepting' : 'Accept the invitation'}
                          </NeuButton>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
