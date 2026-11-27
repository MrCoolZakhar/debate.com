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
// re-reads its list and money, and announces 'gv-team-waiting-changed' so the
// left menu re-reads its badges. A chair accept and a swap patch the page's
// row (status, committee) through `patchRow` the moment the RPC answers ok, so
// the card never shows the old status while the reload runs (prompt 73).
//
// Prompt 80 (26 Nov 2026): the swap question comes FIRST. Accept (openFor with
// 'seat' or 'access') runs accept_role_swap_check at once: a refusal shows in
// the pop-up before any committee step (a leader holding tickets gets Move
// tickets, Remove unpaid tickets and Contact Gavelling, then the check runs
// again); a swap shows "Accept {name} as {role}?" and only its confirm opens
// the committee (or access) step, whose choice runs the swap and the seat. The
// pop-up stays busy until the RPCs answer, then closes with the row patched.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { friendlyError, UserFacingError } from '@/lib/friendlyError';
import { bundlePermissions } from '@/lib/organizerPermissions';
import { acceptTeamApplication, swapTeamApplication, acceptFollowUps, rejectUpdates, writeReject, rejectFollowUps, type PushDraftNotice } from '../applications/teamDecisions';
import {
  checkRoleSwap, askFor, runRoleSwap, loadTicketHold, moveLeaderTickets, removeUnpaidTickets,
  type RoleSwapCheck, type SwapAsk,
} from '../applications/roleSwap';
import RoleSwapPanel, { type TicketHoldState } from '../applications/RoleSwapPanel';
import TeamApplicantPopup, { type PopupStep } from '../settings/TeamApplicantPopup';
import {
  acceptChair, committeeShort, loadTeamApplicantsV2,
  type TeamApplicant, type TeamCommittee,
} from './teamApi';

/** The left menu listens for this and re-reads its badges (manage/[slug]/layout.tsx). */
function announceTeamChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('gv-team-waiting-changed'));
}

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
  enabled, conferenceId: conferenceIdOrNull, roleConfigs, pushDraftNotice, onChanged, optimistic, patchRow,
}: {
  enabled: boolean;
  conferenceId: string | null;
  roleConfigs: TeamRoleConfig[];
  pushDraftNotice: PushDraftNotice;
  /** A decision landed: re-read the list. */
  onChanged: () => void;
  /** Patch the page's row to `status` at once; returns the rollback. */
  optimistic?: (appId: string, status: string) => () => void;
  /** Patch the page's row after a decision landed (no rollback: the reload confirms it). */
  patchRow?: (appId: string, p: { status: string; assigned_committee_id?: string | null }) => void;
}): TeamDecisions {
  const { user } = useAuth();
  // The decisions run only from the pop-up, which opens only after the list
  // loaded for a conference, so '' is never written.
  const conferenceId = conferenceIdOrNull ?? '';
  const [applicants, setApplicants] = useState<TeamApplicant[] | null>(null);
  const [committees, setCommittees] = useState<TeamCommittee[]>([]);
  const [canAccept, setCanAccept] = useState(false);
  const [open, setOpen] = useState<{ id: string; step: PopupStep } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Read once when Team Applications opens: the read also records that an
  // organiser reviewed applicants. After a decision it is read again.
  const load = useCallback(async () => {
    if (!enabled || !conferenceIdOrNull) return;
    try {
      const res = await loadTeamApplicantsV2(conferenceIdOrNull);
      setApplicants(res.applicants);
      setCommittees(res.committees);
      setCanAccept(res.canAccept);
    } catch (e) {
      notifyErr(friendlyError(e, 'Could not load the applicants. Please try again.'));
    }
  }, [enabled, conferenceIdOrNull]);
  useEffect(() => { void load(); }, [load]);

  const patch = useCallback((id: string, p: Partial<TeamApplicant>) => {
    setApplicants(prev => prev ? prev.map(a => (a.application_id === id ? { ...a, ...p } : a)) : prev);
  }, []);

  const committeeById = useMemo(() => new Map(committees.map(c => [c.id, c] as const)), [committees]);
  const openApplicant = open ? (applicants ?? []).find(a => a.application_id === open.id) ?? null : null;
  const configOf = (role: string) => roleConfigs.find(rc => rc.role === role);


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
  // `for` is null for the check that runs when Accept is pressed (prompt 80).
  const [swap, setSwap] = useState<{ appId: string; ask: SwapAsk; busy: boolean; error: string; for: SwapFor | null } | null>(null);
  // The swap the organiser already confirmed: the committee or access step then runs it.
  const [confirmed, setConfirmed] = useState<{ appId: string; check: RoleSwapCheck } | null>(null);
  const [tickets, setTickets] = useState<TicketHoldState | null>(null);

  /** A refusal because they hold their delegation's tickets: read the tickets and the other leaders. */
  const readTickets = useCallback(async (ask: SwapAsk) => {
    if (ask.phase !== 'blocked' || ask.code !== 'leader_tickets' || !ask.check) { setTickets(null); return; }
    setTickets({ state: 'loading' });
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
      const hold = await loadTicketHold(supabase, ask.check);
      setTickets(hold ? { state: 'ready', hold } : null);
    } catch (e) {
      setTickets({ state: 'error', message: friendlyError(e, 'Could not read their tickets. Please try again.') });
    }
  }, []);

  /** Accept pressed: the swap question first (prompt 80). No swap needed: the step shows as before. */
  const preCheck = useCallback(async (appId: string) => {
    setConfirmed(null);
    setTickets(null);
    const base = { appId, busy: false, error: '', for: null };
    setSwap({ ...base, ask: { phase: 'checking' } });
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
      const ask = askFor(await checkRoleSwap(supabase, appId));
      if (!ask) { setSwap(null); return; }
      setSwap({ ...base, ask });
      void readTickets(ask);
    } catch (e) {
      setSwap({ ...base, ask: { phase: 'blocked', message: friendlyError(e, 'Could not check this application. Please try again.') } });
    }
  }, [readTickets]);

  const openFor = useCallback((appId: string, step: PopupStep) => {
    if (applicants && !applicants.some(a => a.application_id === appId)) void load();
    setOpen({ id: appId, step });
    if (step === 'seat' || step === 'access') void preCheck(appId);
    else { setSwap(null); setConfirmed(null); setTickets(null); }
  }, [applicants, load, preCheck]);

  /** Checks for a role that does not combine. True when the swap panel took over (nothing else runs). */
  const askSwap = useCallback(async (a: TeamApplicant, forWhat: SwapFor, race: boolean): Promise<boolean> => {
    const base = { appId: a.application_id, busy: false, error: '', for: forWhat as SwapFor | null };
    setSwap({ ...base, ask: { phase: 'checking' } });
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
      const ask = askFor(await checkRoleSwap(supabase, a.application_id));
      if (ask) { setSwap({ ...base, ask }); void readTickets(ask); return true; }
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
  }, [readTickets]);

  /** The swap, then what the plain accept runs after its write. Resolves to a sentence on a
   *  refusal, or null once it landed (the pop-up then closes with the row patched). The caller
   *  holds the busy guard, so the pop-up stays busy until every RPC answered (prompt 80). */
  const runSwap = useCallback(async (a: TeamApplicant, forWhat: SwapFor): Promise<string | null> => {
    {
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
        if (!res.ok) return res.message;
        setSwap(null);
        patch(a.application_id, { status: 'accepted' });
        patchRow?.(a.application_id, { status: 'accepted' });
        setOpen(null);
        notifyOk(res.message);
        if (res.followUpFailed) notifyErr('Accepted, but a follow-up step (email / auto-cover) failed. Refresh to verify.');
      } else {
        const supabase = await getFreshAuthedClient();
        if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
        const res = await runRoleSwap(supabase, a.application_id);
        if (!res.ok) return res.message;
        // Seat them when a committee was picked, BEFORE the pop-up closes, so the committee
        // list never flashes back (prompt 80). A failure leaves them accepted, never undone.
        let seated = false;
        let seatStatus: string | null = null;
        let seatCommittee: string | null = null;
        if (forWhat.committeeId) {
          try {
            const seat = await acceptChair({ conferenceId, appId: res.application_id, committeeId: forWhat.committeeId, pushDraftNotice });
            seated = seat.ok;
            if (seat.ok) { seatStatus = seat.status; seatCommittee = seat.committeeId; }
          } catch {
            seated = false;
          }
        }
        setSwap(null);
        patchRow?.(res.application_id, seated && seatStatus ? { status: seatStatus, assigned_committee_id: seatCommittee } : { status: 'accepted' });
        setOpen(null);
        notifyOk(res.message);
        if (forWhat.committeeId && !seated) notifyErr('Accepted. Seat them from Committees.');
        // The acceptance email and its follow-ups, once, for the application that now holds the role.
        const followUpFailed = await acceptFollowUps(supabase, {
          conferenceId, appId: res.application_id, role: a.role, societyId: null, pushDraftNotice,
        });
        if (followUpFailed) notifyErr('Accepted, but the acceptance email could not be queued. Refresh to verify.');
      }
      setOpen(null);
      setConfirmed(null);
      await load();
      onChanged();
      announceTeamChange();
      return null;
    }
  }, [conferenceId, roleConfigs, pushDraftNotice, load, onChanged, patch, patchRow]);

  const isHoldsRole = (e: unknown) => (e as { hint?: unknown } | null)?.hint === 'holds_role';

  const accept = useCallback(async (a: TeamApplicant, picked: Set<string>, publicTitle: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusyId(a.application_id);
    const permissions = bundlePermissions('custom', Object.fromEntries([...picked].map(k => [k, true])));
    const title = publicTitle.trim() || null;
    const forWhat: SwapFor = { kind: 'team', permissions, publicTitle: title };
    try {
      // The swap was confirmed when Accept was pressed (prompt 80): run it now.
      if (confirmed?.appId === a.application_id) {
        try {
          const problem = await runSwap(a, forWhat);
          if (problem) { notifyErr(problem); return false; }
          return true;
        } catch (e) {
          notifyErr(friendlyError(e, 'Could not accept the application. Please try again.'));
          return false;
        }
      }
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
      announceTeamChange();
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
  }, [conferenceId, patch, pushDraftNotice, roleConfigs, askSwap, optimistic, onChanged, confirmed, runSwap]);

  /** A chair: accept_chair_application, seated now (a committee) or later (null). */
  const acceptChairNow = useCallback(async (a: TeamApplicant, committeeId: string | null): Promise<string | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusyId(a.application_id);
    const forWhat: SwapFor = { kind: 'chair', committeeId };
    try {
      // The swap was confirmed when Accept was pressed (prompt 80): the swap, then the seat.
      if (confirmed?.appId === a.application_id) return await runSwap(a, forWhat);
      if (await askSwap(a, forWhat, false)) return null;
      const res = await acceptChair({ conferenceId, appId: a.application_id, committeeId, pushDraftNotice });
      if (!res.ok) return res.message;
      patch(a.application_id, { status: res.status });
      patchRow?.(a.application_id, res.committeeId ? { status: res.status, assigned_committee_id: res.committeeId } : { status: res.status });
      const c = res.committeeId ? committeeById.get(res.committeeId) : undefined;
      // An already accepted chair was only seated (the Seat button, 24 Nov 2026).
      const wasAccepted = a.status === 'accepted';
      notifyOk(c ? (wasAccepted ? `${a.name ?? 'They'} seated in ${committeeShort(c)}` : `${a.name ?? 'They'} accepted and seated in ${committeeShort(c)}`) : `${a.name ?? 'They'} accepted`);
      if (res.followUpFailed) notifyErr('Accepted, but the acceptance email could not be queued. Refresh to verify.');
      setOpen(null);
      await load();
      onChanged();
      announceTeamChange();
      return null;
    } catch (e) {
      if (isHoldsRole(e)) { await askSwap(a, forWhat, true); return null; }
      return friendlyError(e, 'Could not accept the application. Please try again.');
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [conferenceId, pushDraftNotice, committeeById, load, askSwap, onChanged, patch, patchRow, confirmed, runSwap]);

  /** "Accept and remove {role}" on a swap asked during an accept (a race): the swap at once. */
  const confirmSwap = useCallback(async (a: TeamApplicant) => {
    if (busyRef.current || !swap || swap.appId !== a.application_id || swap.ask.phase !== 'confirm' || !swap.for) return;
    busyRef.current = true;
    setBusyId(a.application_id);
    setSwap(prev => prev ? { ...prev, busy: true, error: '' } : prev);
    try {
      const problem = await runSwap(a, swap.for);
      if (problem) setSwap(prev => prev ? { ...prev, busy: false, error: problem } : prev);
    } catch (e) {
      setSwap(prev => prev ? { ...prev, busy: false, error: friendlyError(e, 'Could not accept the application. Please try again.') } : prev);
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [swap, runSwap]);

  /** The ticket choices on a 'leader_tickets' refusal; each runs the check again on success. */
  const moveTickets = useCallback(async (appId: string, fromApp: string, toApp: string, toName: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSwap(prev => prev ? { ...prev, busy: true, error: '' } : prev);
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
      const r = await moveLeaderTickets(supabase, fromApp, toApp);
      if (!r.ok) { setSwap(prev => prev ? { ...prev, busy: false, error: r.message } : prev); return; }
      notifyOk(`${r.moved} ${r.moved === 1 ? 'ticket' : 'tickets'} moved to ${toName}`);
      busyRef.current = false;
      await preCheck(appId);
    } catch (e) {
      setSwap(prev => prev ? { ...prev, busy: false, error: friendlyError(e, 'Could not move the tickets. Please try again.') } : prev);
    } finally {
      busyRef.current = false;
    }
  }, [preCheck]);

  const removeTickets = useCallback(async (appId: string, ids: string[]) => {
    if (busyRef.current || ids.length === 0) return;
    busyRef.current = true;
    setSwap(prev => prev ? { ...prev, busy: true, error: '' } : prev);
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
      const removed = await removeUnpaidTickets(supabase, ids);
      if (removed > 0) notifyOk(`${removed} unpaid ${removed === 1 ? 'ticket' : 'tickets'} removed`);
      else notifyErr('No tickets could be removed. Please try again.');
      busyRef.current = false;
      await preCheck(appId);
    } catch (e) {
      setSwap(prev => prev ? { ...prev, busy: false, error: friendlyError(e, 'Could not remove the tickets. Please try again.') } : prev);
    } finally {
      busyRef.current = false;
    }
  }, [preCheck]);

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
      announceTeamChange();
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
      onClose={() => { setSwap(null); setConfirmed(null); setTickets(null); setOpen(null); }}
      swap={swap && swap.appId === openApplicant.application_id ? (
        <RoleSwapPanel
          ask={swap.ask}
          busy={swap.busy}
          error={swap.error}
          tickets={tickets}
          onConfirm={() => {
            // Asked when Accept was pressed: the confirm opens the committee (or access) step.
            if (!swap.for && swap.ask.phase === 'confirm') { setConfirmed({ appId: swap.appId, check: swap.ask.check }); setSwap(null); return; }
            void confirmSwap(openApplicant);
          }}
          // Close and Cancel close the pop-up (prompt 80), never back to the committee list.
          onCancel={() => { if (!swap.busy) { setSwap(null); setConfirmed(null); setTickets(null); setOpen(null); } }}
          onMoveTickets={tickets?.state === 'ready' ? (toApp, toName) => { void moveTickets(openApplicant.application_id, tickets.hold.leaderAppId, toApp, toName); } : undefined}
          onRemoveUnpaid={(ids) => { void removeTickets(openApplicant.application_id, ids); }}
        />
      ) : null}
    />
  ) : null;

  return { canAccept, openFor, popup };
}
