'use client';

// Delegation invite landing: /invites/delegation/[token]
//
// A head delegate or faculty advisor shares this link from the top of their
// delegation portal (/delegation/[societyId]).
//
//  1. Signed out: the token is resolved anonymously (`resolve_delegation_invite`)
//     so the page can say which delegation and conference it is for, and the
//     sign-in pop-up opens (openAuth) with this page as `next`. After signing in
//     or up the visitor comes straight back here and step 2 runs.
//  2. Signed in: `delegation_join_via_invite(p_token, p_confirm_move)` decides.
//       apply          no application at that conference yet: go to the delegate
//                      application, delegation filled in
//                      (/conferences/<slug>/apply?role=delegate&delegation=<id>
//                      &delegationInvite=<token>; the slug is the conference's
//                      CURRENT slug, from the database)
//       joined         their existing application was added to the delegation
//       already        they are already in it
//       confirm_move   they are a delegate of ANOTHER delegation: say so, name any
//                      block seat they would give up, and move only on a press
//       leader / role  a head delegate, faculty advisor, chair or observer is never
//                      moved by a link; they are told who can do it

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CircleCheck, TriangleAlert, Users2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, supabaseAuthClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { openAuth } from '@/lib/authModal';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { NEU, OUTFIT } from '@/components/neu';

interface JoinResult {
  ok: boolean;
  reason?: 'invalid' | 'signin' | 'confirm_move' | 'leader' | 'role';
  action?: 'apply' | 'joined' | 'already';
  error?: string;
  society_id?: string;
  society_name?: string;
  conference_name?: string;
  slug?: string;
  role?: string;
  other_name?: string | null;
  seat?: string | null;
  moved_from?: string | null;
  released_seat?: string | null;
}

type View =
  | { kind: 'loading' }
  | { kind: 'signin'; r: JoinResult }
  | { kind: 'invalid'; message: string }
  | { kind: 'joined'; r: JoinResult }
  | { kind: 'already'; r: JoinResult }
  | { kind: 'confirm_move'; r: JoinResult }
  | { kind: 'blocked'; r: JoinResult }
  | { kind: 'error'; message: string };

const ROLE_WORD: Record<string, string> = {
  'head-delegate': 'head delegate', 'faculty-advisor': 'faculty advisor', chair: 'chair', observer: 'observer',
};

function applyUrl(r: JoinResult, token: string): string {
  const p = new URLSearchParams({ role: 'delegate' });
  if (r.society_id) p.set('delegation', r.society_id);
  p.set('delegationInvite', token);
  return `/conferences/${r.slug}/apply?${p.toString()}`;
}

export default function DelegationInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) ?? '';
  const { user, session, loading: authLoading } = useAuth();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const accessToken = session?.access_token ?? null;
  const userId = user?.id ?? null;

  const run = useCallback(async (confirmMove: boolean) => {
    if (!token) { setView({ kind: 'invalid', message: 'This invite link is missing its code.' }); return; }

    if (!userId || !accessToken) {
      const { data, error } = await supabaseAuthClient.rpc('resolve_delegation_invite', { p_token: token });
      const r = data as JoinResult | null;
      if (error) { setView({ kind: 'error', message: friendlyError(error, 'We could not open this invite. Try again.') }); return; }
      if (!r?.ok) { setView({ kind: 'invalid', message: r?.error ?? 'This invite link is not valid.' }); return; }
      setView({ kind: 'signin', r: { ...r, conference_name: r.conference_name } });
      openAuth({ next: `/invites/delegation/${encodeURIComponent(token)}`, apply: true });
      return;
    }

    const { data, error } = await getAuthedClient(accessToken).rpc('delegation_join_via_invite', { p_token: token, p_confirm_move: confirmMove });
    if (error) { setView({ kind: 'error', message: friendlyError(error, 'We could not open this invite. Try again.') }); return; }
    const r = data as JoinResult | null;
    if (!r) { setView({ kind: 'error', message: 'We could not open this invite. Try again.' }); return; }
    if (r.ok && r.action === 'apply') { router.replace(applyUrl(r, token)); return; }
    if (r.ok && r.action === 'joined') { setView({ kind: 'joined', r }); return; }
    if (r.ok && r.action === 'already') { setView({ kind: 'already', r }); return; }
    if (r.reason === 'invalid') { setView({ kind: 'invalid', message: r.error ?? 'This invite link is not valid.' }); return; }
    if (r.reason === 'confirm_move') { setView({ kind: 'confirm_move', r }); return; }
    if (r.reason === 'leader' || r.reason === 'role') { setView({ kind: 'blocked', r }); return; }
    setView({ kind: 'error', message: 'We could not open this invite. Try again.' });
  }, [token, userId, accessToken, router]);

  useEffect(() => {
    if (authLoading) return;
    void Promise.resolve().then(() => run(false));
  }, [authLoading, run]);

  if (view.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
        <Loader size={72} label="Opening your invitation" />
      </div>
    );
  }

  const conf = (r: JoinResult) => r.conference_name || 'the conference';
  let icon = Users2;
  let tone: string = NEU.forest;
  let title = '';
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  const primary = (label: string, onClick: () => void, disabled = false) => (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2"
      style={{ padding: '11px 18px', borderRadius: 12, border: 'none', backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      {label} <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
    </button>
  );
  const secondary = (label: string, href: string) => (
    <Link href={href} className="inline-flex items-center focus:outline-none focus-visible:ring-2"
      style={{ padding: '11px 18px', borderRadius: 12, border: NEU.hairline, color: NEU.forest, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none' }}>
      {label}
    </Link>
  );

  switch (view.kind) {
    case 'signin':
      title = `Join ${view.r.society_name ?? 'this delegation'}`;
      body = <>Sign in or create your account to apply to {conf(view.r)} as a delegate of {view.r.society_name}. If you already applied, you are added to the delegation.</>;
      actions = primary('Continue', () => openAuth({ next: `/invites/delegation/${encodeURIComponent(token)}`, apply: true }));
      break;
    case 'joined':
      icon = CircleCheck;
      title = `You joined ${view.r.society_name}`;
      body = (
        <>
          Your application to {conf(view.r)} is now part of {view.r.society_name}.
          {view.r.moved_from ? <> You left {view.r.moved_from}.</> : null}
          {view.r.released_seat ? <> Your seat in {view.r.released_seat} went back to {view.r.moved_from}.</> : null}
        </>
      );
      actions = secondary('Go to the conference', `/conferences/${view.r.slug}`);
      break;
    case 'already':
      icon = CircleCheck;
      title = `You are already in ${view.r.society_name}`;
      body = <>Nothing to do. Your application to {conf(view.r)} is already part of this delegation.</>;
      actions = secondary('Go to the conference', `/conferences/${view.r.slug}`);
      break;
    case 'confirm_move':
      icon = TriangleAlert;
      tone = '#8A5A1E';
      title = `Move to ${view.r.society_name}?`;
      body = (
        <>
          You applied to {conf(view.r)} with {view.r.other_name}. Moving takes your application out of {view.r.other_name} and puts it in {view.r.society_name}.
          {view.r.seat ? <> Your seat in {view.r.seat} belongs to {view.r.other_name} and goes back to them.</> : null}
        </>
      );
      actions = (
        <>
          {primary(busy ? 'Moving…' : `Move to ${view.r.society_name}`, async () => { setBusy(true); await run(true); setBusy(false); }, busy)}
          {secondary('Stay where I am', `/conferences/${view.r.slug}`)}
        </>
      );
      break;
    case 'blocked': {
      icon = TriangleAlert;
      tone = '#8A5A1E';
      const role = ROLE_WORD[view.r.role ?? ''] ?? view.r.role ?? 'participant';
      title = 'This link cannot move you';
      body = view.r.reason === 'leader'
        ? <>You applied to {conf(view.r)} as {role} of {view.r.other_name ?? 'another delegation'}. A delegation leader is never moved by a link. Ask the organiser if you need to change delegation.</>
        : <>You applied to {conf(view.r)} as a {role}, and delegations are for delegates. Ask the organiser if you need to change.</>;
      actions = secondary('Go to the conference', `/conferences/${view.r.slug}`);
      break;
    }
    case 'invalid':
      icon = TriangleAlert;
      tone = '#8B2020';
      title = /expired/i.test(view.message) ? 'This invite has expired' : 'This invite is not valid';
      body = <>Ask your head delegate for a new link.</>;
      actions = secondary('Browse conferences', '/conferences/explore');
      break;
    case 'error':
      icon = TriangleAlert;
      tone = '#8B2020';
      title = 'Something went wrong';
      body = view.message;
      actions = primary('Try again', () => { setView({ kind: 'loading' }); void run(false); });
      break;
  }

  const I = icon;
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav />
      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-14 flex items-start justify-center">
        <div className="w-full" style={{ maxWidth: 480, backgroundColor: NEU.surface, border: NEU.hairline, borderRadius: 22, padding: '28px 24px' }}>
          <I size={34} strokeWidth={2} aria-hidden style={{ color: tone, marginBottom: 14 }} />
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Delegation invite</p>
          <h1 style={{ fontFamily: OUTFIT, fontSize: 24, fontWeight: 800, color: NEU.ink, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 6, textWrap: 'balance' }}>{title}</h1>
          <p style={{ fontFamily: OUTFIT, fontSize: 15, color: NEU.inkSoft, lineHeight: 1.55, marginTop: 10 }}>{body}</p>
          <div className="flex flex-wrap gap-2 mt-6">{actions}</div>
        </div>
      </main>
    </div>
  );
}
