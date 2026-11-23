'use client';

// ── Team Applications: the team decisions (owner, 14 Nov 2026; one page with Applications, 23 Nov 2026) ──
//
// Team Applications is the Applications page itself (applications/ApplicationsView.tsx
// with scope 'team'). This hook holds the decisions that page runs for chairs,
// secretariat and staff, moved here unchanged from team/TeamApplications.tsx:
//   - team_applicants_v2 (chairs included, their committees and preferences),
//     read once when Team Applications opens, for the review pop-up
// Accepting a chair opens the seat step inside the same pop-up
// (accept_chair_application: seated now, or later from Committees). Secretariat
// and staff keep accept_team_application through acceptTeamApplication. Both
// accepts run the role swap first (16 Nov 2026, roleSwap.ts): someone holding
// a role that does not combine is asked in place, and the swap removes it.
// Optimistic status while busy, rolled back on a failure (here and, through
// `optimistic`, on the page's list); a ref guards every button; errors are
// shown as written. Every decision that lands calls `onChanged` so the page
// re-reads its list and money.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { friendlyError, UserFacingError } from '@/lib/friendlyError';
import { bundlePermissions } from '@/lib/organizerPermissions';
import { acceptTeamApplication, swapTeamApplication, acceptFollowUps, rejectUpdates, writeReject, rejectFollowUps, type PushDraftNotice } from '../applications/teamDecisions';
import { checkRoleSwap, askFor, runRoleSwap, type SwapAsk } from '../applications/roleSwap';
import RoleSwapPanel from '../applications/RoleSwapPanel';
import TeamApplicantPopup, { type PopupStep } from '../settings/TeamApplicantPopup';
import {
  acceptChair, committeeShort, loadTeamApplicantsV2,
  type TeamApplicant, type TeamCommittee,
} from './teamApi';

export interface TeamRoleConfig { role: string; payment_timing: string | null; custom_questions: unknown }

export interface TeamDecisions {
  /** Can this organiser add someone to the team (the Team permission). */
  canAccept: boolean;
  /** Opens the pop-up on an application: 'seat' for a chair, 'access' for secretariat and staff, or 'review'. */
  openFor: (appId: string, step: PopupStep) => void;
  /** The pop-up (and nothing when closed). Mount it once. */
  popup: ReactNode;
}

export function useTeamDecisions({
  enabled, conferenceId, roleConfigs, pushDraftNotice, onChanged, optimistic,
}: {
  enabled: boolean;
  conferenceId: string | null;
  roleConfigs: TeamRoleConfig[];
  pushDraftNotice: PushDraftNotice;
  /** A decision landed: re-read the list. */
  onChanged: () => void;
  /** Patch the page's row to `status` at once; returns the rollback. */
  optimistic?: (appId: string, status: string) => () => void;
}): TeamDecisions {
  const { user } = useAuth();
  const [applicants, setApplicants] = useState<TeamApplicant[] | null>(null);
  const [committees, setCommittees] = useState<TeamCommittee[]>([]);
  const [canAccept, setCanAccept] = useState(false);
  const [open, setOpen] = useState<{ id: string; step: PopupStep } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Read once when Team Applications opens: the read also records that an
  // organiser reviewed applicants. After a decision it is read again.
  const load = useCallback(async () => {
    if (!enabled || !conferenceId) return;
    try {
      const res = await loadTeamApplicantsV2(conferenceId);
      setApplicants(res.applicants);
      setCommittees(res.committees);
      setCanAccept(res.canAccept);
    } catch (e) {
      notifyErr(friendlyError(e, 'Could not load the applicants. Please try again.'));
    }
  }, [enabled, conferenceId]);
  useEffect(() => { void load(); }, [load]);

  const patch = useCallback((id: string, p: Partial<TeamApplicant>) => {
    setApplicants(prev => prev ? prev.map(a => (a.application_id === id ? { ...a, ...p } : a)) : prev);
  }, []);

  const committeeById = useMemo(() => new Map(committees.map(c => [c.id, c] as const)), [committees]);
  const openApplicant = open ? (applicants ?? []).find(a => a.application_id === open.id) ?? null : null;
  const configOf = (role: string) => roleConfigs.find(rc => rc.role === role);

  const openFor = useCallback((appId: string, step: PopupStep) => {
    if (applicants && !applicants.some(a => a.application_id === appId)) void load();
    setOpen({ id: appId, step });
  }, [applicants, load]);

  // ── One accepted role per person (16 Nov 2026): the role swap ──────────
  // Both accepts ask accept_role_swap_check first (roleSwap.ts). Nothing held:
  // the accept exactly as before. Otherwise the pop-up's body and footer turn
  // into RoleSwapPanel in place: the server's sentence with Close, or the
  // confirm whose "Accept and remove" runs the swap. A chair is then seated
  // with accept_chair_application; secretariat and staff go through
  // swapTeamApplication with the permissions and public title already picked.
  type SwapFor =
    | { kind: 'chair'; committeeId: string | null }
    | { kind: 'team'; permissions: Record<string, unknown>; publicTitle: string | null };
  const [swap, setSwap] = useState<{ appId: string; ask: SwapAsk; busy: boolean; error: string; for: SwapFor } | null>(null);

  /** Checks for a role that does not combine. True when the swap panel took over (nothing else runs). */
  const askSwap = useCallback(async (a: TeamApplicant, forWhat: SwapFor, race: boolean): Promise<boolean> => {
    const base = { appId: a.application_id, busy: false, error: '', for: forWhat };
    setSwap({ ...base, ask: { phase: 'checking' } });
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
      const ask = askFor(await checkRoleSwap(supabase, a.application_id));
      if (ask) { setSwap({ ...base, ask }); return true; }
      if (race) {
        // Refused for a role the check no longer sees: say so, never loop.
        setSwap({ ...base, ask: { phase: 'blocked', message: 'Could not accept the application. Please try again.' } });
        return true;
      }
      setSwap(null);
      return false;
    } catch (e) {
      setSwap({ ...base, ask: { phase: 'blocked', message: friendlyError(e, 'Could not check this application. Please try again.') } });
      return true;
    }
  }, []);

  const isHoldsRole = (e: unknown) => (e as { hint?: unknown } | null)?.hint === 'holds_role';

  const accept = useCallback(async (a: TeamApplicant, picked: Set<string>, publicTitle: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusyId(a.application_id);
    const permissions = bundlePermissions('custom', Object.fromEntries([...picked].map(k => [k, true])));
    const title = publicTitle.trim() || null;
    const forWhat: SwapFor = { kind: 'team', permissions, publicTitle: title };
    try {
      if (await askSwap(a, forWhat, false)) return false;
      const before = { status: a.status, decided_at: a.decided_at, on_team: a.on_team };
      patch(a.application_id, { status: 'accepted' });
      const undoView = optimistic?.(a.application_id, 'accepted');
      try {
        const res = await acceptTeamApplication({
          conferenceId,
          appId: a.application_id,
          role: a.role,
          societyId: null,
          paymentTiming: roleConfigs.find(rc => rc.role === a.role)?.payment_timing ?? null,
          permissions,
          publicTitle: title,
          pushDraftNotice,
        });
        patch(a.application_id, { status: 'accepted', decided_at: new Date().toISOString(), on_team: true });
        notifyOk(`${a.name ?? 'They'} joined the team`);
        if (res.followUpFailed) notifyErr('Accepted, but a follow-up step (email / auto-cover) failed. Refresh to verify.');
        setOpen(null);
        onChanged();
        return true;
      } catch (e) {
        patch(a.application_id, before);
        undoView?.();
        // A race: they took a role that does not combine since the check.
        if (isHoldsRole(e)) { await askSwap(a, forWhat, true); return false; }
        notifyErr(friendlyError(e, 'Could not accept the application. Please try again.'));
        return false;
      }
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [conferenceId, patch, pushDraftNotice, roleConfigs, askSwap, optimistic, onChanged]);

  /** A chair: accept_chair_application, seated now (a committee) or later (null). */
  const acceptChairNow = useCallback(async (a: TeamApplicant, committeeId: string | null): Promise<string | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusyId(a.application_id);
    const forWhat: SwapFor = { kind: 'chair', committeeId };
    try {
      if (await askSwap(a, forWhat, false)) return null;
      const res = await acceptChair({ conferenceId, appId: a.application_id, committeeId, pushDraftNotice });
      if (!res.ok) return res.message;
      const c = res.committeeId ? committeeById.get(res.committeeId) : undefined;
      notifyOk(c ? `${a.name ?? 'They'} accepted and seated in ${committeeShort(c)}` : `${a.name ?? 'They'} accepted`);
      if (res.followUpFailed) notifyErr('Accepted, but the acceptance email could not be queued. Refresh to verify.');
      setOpen(null);
      await load();
      onChanged();
      return null;
    } catch (e) {
      if (isHoldsRole(e)) { await askSwap(a, forWhat, true); return null; }
      return friendlyError(e, 'Could not accept the application. Please try again.');
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [conferenceId, pushDraftNotice, committeeById, load, askSwap, onChanged]);

  /** "Accept and remove {role}": the swap, then what the plain accept runs after its write. */
  const confirmSwap = useCallback(async (a: TeamApplicant) => {
    if (busyRef.current || !swap || swap.appId !== a.application_id || swap.ask.phase !== 'confirm') return;
    busyRef.current = true;
    setBusyId(a.application_id);
    setSwap(prev => prev ? { ...prev, busy: true, error: '' } : prev);
    const forWhat = swap.for;
    try {
      if (forWhat.kind === 'team') {
        const res = await swapTeamApplication({
          conferenceId,
          appId: a.application_id,
          role: a.role,
          societyId: null,
          paymentTiming: roleConfigs.find(rc => rc.role === a.role)?.payment_timing ?? null,
          permissions: forWhat.permissions,
          publicTitle: forWhat.publicTitle,
          pushDraftNotice,
        });
        if (!res.ok) { setSwap(prev => prev ? { ...prev, busy: false, error: res.message } : prev); return; }
        setSwap(null);
        notifyOk(res.message);
        if (res.followUpFailed) notifyErr('Accepted, but a follow-up step (email / auto-cover) failed. Refresh to verify.');
      } else {
        const supabase = await getFreshAuthedClient();
        if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
        const res = await runRoleSwap(supabase, a.application_id);
        if (!res.ok) { setSwap(prev => prev ? { ...prev, busy: false, error: res.message } : prev); return; }
        setSwap(null);
        notifyOk(res.message);
        // Seat them when a committee was picked. A failure here leaves them accepted, never undone.
        if (forWhat.committeeId) {
          let seated = false;
          try {
            const seat = await acceptChair({ conferenceId, appId: res.application_id, committeeId: forWhat.committeeId, pushDraftNotice });
            seated = seat.ok;
          } catch {
            seated = false;
          }
          if (!seated) notifyErr('Accepted. Seat them from Committees.');
        }
        // The acceptance email and its follow-ups, once, for the application that now holds the role.
        const followUpFailed = await acceptFollowUps(supabase, {
          conferenceId, appId: res.application_id, role: a.role, societyId: null, pushDraftNotice,
        });
        if (followUpFailed) notifyErr('Accepted, but the acceptance email could not be queued. Refresh to verify.');
      }
      setOpen(null);
      await load();
      onChanged();
    } catch (e) {
      setSwap(prev => prev ? { ...prev, busy: false, error: friendlyError(e, 'Could not accept the application. Please try again.') } : prev);
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [swap, conferenceId, roleConfigs, pushDraftNotice, load, onChanged]);

  const reject = useCallback(async (a: TeamApplicant): Promise<boolean> => {
    if (busyRef.current) return false;
    if (!user) { notifyErr('Your session has expired, please refresh and sign in again.'); return false; }
    busyRef.current = true;
    setBusyId(a.application_id);
    const before = { status: a.status, decided_at: a.decided_at };
    patch(a.application_id, { status: 'rejected' });
    const undoView = optimistic?.(a.application_id, 'rejected');
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
      // Team roles never hold pool spots, so the row facts rejectUpdates reads
      // for a spot release are all empty. The existing note is kept.
      const updates = rejectUpdates({ role: a.role, payment_status: null, self_paid: null, society_id: null }, a.organizer_note ?? '');
      await writeReject(supabase, a.application_id, updates, user.id);
      // writeReject throws only on an error; a refused update returns none, so
      // read the row back before calling it done.
      const { data: check, error: checkError } = await supabase.from('applications').select('status').eq('id', a.application_id).maybeSingle();
      if (checkError) throw checkError;
      if (!check || (check as { status: string }).status !== 'rejected') {
        throw new UserFacingError('Could not reject the application. Please try again.');
      }
      patch(a.application_id, { status: 'rejected', decided_at: new Date().toISOString() });
      const problem = await rejectFollowUps(supabase, conferenceId, a.application_id, pushDraftNotice);
      if (problem) notifyErr(problem); else notifyOk('Application rejected');
      setOpen(null);
      onChanged();
      return true;
    } catch (e) {
      patch(a.application_id, before);
      undoView?.();
      notifyErr(friendlyError(e, 'Could not reject the application. Please try again.'));
      return false;
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [user, conferenceId, patch, pushDraftNotice, optimistic, onChanged]);

  const popup = openApplicant && open ? (
    <TeamApplicantPopup
      key={openApplicant.application_id}
      applicant={openApplicant}
      initialStep={open.step}
      canAccept={canAccept}
      busy={busyId === openApplicant.application_id}
      customQuestions={configOf(openApplicant.role)?.custom_questions ?? []}
      committees={committees}
      onAcceptChair={(committeeId) => acceptChairNow(openApplicant, committeeId)}
      onAccept={(picked, title) => accept(openApplicant, picked, title)}
      onReject={() => reject(openApplicant)}
      onClose={() => { setSwap(null); setOpen(null); }}
      swap={swap && swap.appId === openApplicant.application_id ? (
        <RoleSwapPanel
          ask={swap.ask}
          busy={swap.busy}
          error={swap.error}
          onConfirm={() => { void confirmSwap(openApplicant); }}
          onCancel={() => { if (!swap.busy) setSwap(null); }}
        />
      ) : null}
    />
  ) : null;

  return { canAccept, openFor, popup };
}
