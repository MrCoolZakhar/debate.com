'use client';

// ── Team > Team Applications (owner, 14 Nov 2026) ──────────────────────────
//
// Chairs, secretariat and staff are the people who run the conference, so they
// are decided here, never in Applications. Built from settings/TeamApplicants.tsx
// (the same list, filters, rejection flow, notices and guards) with:
//   - team_applicants_v2 (chairs included, their committees and preferences)
//   - role chips: All, Chairs, Secretariat, Staff
//   - what each person applied for: their Job Board picks, else a chair's
//     committee preferences in order
//   - a chair accepted but not seated reads "Needs a committee"
// Accepting a chair opens the seat step inside the same pop-up
// (accept_chair_application: seated now, or later from Committees). Secretariat
// and staff keep accept_team_application through acceptTeamApplication.
// Optimistic status while busy, rolled back on a failure; a ref guards every
// button; errors are shown as written.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { turnOnDefaultEmail } from '@/lib/emailEvents';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { friendlyError, UserFacingError } from '@/lib/friendlyError';
import { NEU, OUTFIT } from '@/components/neu';
import { bundlePermissions } from '@/lib/organizerPermissions';
import { acceptTeamApplication, rejectUpdates, writeReject, rejectFollowUps } from '../applications/teamDecisions';
import { fmtDay } from '../applications/ApplicantDetail/kit';
import { Group, TINT_GOLD_BG } from '../settings/panelKit';
import TeamApplicantPopup, { Face, primaryBtn, quietBtn, rejectBtn, type PopupStep } from '../settings/TeamApplicantPopup';
import {
  acceptChair, committeeShort, loadTeamApplicantsV2, teamRoleLabel,
  type TeamApplicant, type TeamCommittee,
} from './teamApi';

type Filter = 'waiting' | 'accepted' | 'rejected' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'waiting', label: 'Waiting' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

type RoleChip = 'all' | 'chair' | 'secretariat' | 'staff';
const ROLE_CHIPS: { id: RoleChip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'chair', label: 'Chairs' },
  { id: 'secretariat', label: 'Secretariat' },
  { id: 'staff', label: 'Staff' },
];

/** Accepted (or seated) counts as accepted in the filter. */
const isAccepted = (s: string) => s === 'accepted' || s === 'assigned' || s === 'checked-in';

export interface TeamRoleConfig { role: string; payment_timing: string | null; custom_questions: unknown }

const chipStyle = (on: boolean): React.CSSProperties => ({
  minHeight: 36, padding: '0 14px', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
  color: on ? '#EED98A' : '#1C1410', backgroundColor: on ? '#1B3828' : '#FFFFFF',
  border: on ? '1.5px solid #1B3828' : '1.5px solid #E4DAC4', cursor: 'pointer',
});

export default function TeamApplications({
  conferenceId, conferenceSlug, roleConfigs, onWaitingChange,
}: {
  conferenceId: string;
  conferenceSlug: string;
  roleConfigs: TeamRoleConfig[];
  /** Keeps the Team badge in step with the list. */
  onWaitingChange?: (n: number) => void;
}) {
  const { user, session } = useAuth();
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const [applicants, setApplicants] = useState<TeamApplicant[] | null>(null);
  const [committees, setCommittees] = useState<TeamCommittee[]>([]);
  const [canAccept, setCanAccept] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('waiting');
  const [roleChip, setRoleChip] = useState<RoleChip>('all');
  const [open, setOpen] = useState<{ id: string; step: PopupStep } | null>(null);
  const [rowAsk, setRowAsk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Read each time the tab opens (this component mounts with it): the read
  // also records that an organiser reviewed applicants.
  const load = useCallback(async () => {
    try {
      const res = await loadTeamApplicantsV2(conferenceId);
      setApplicants(res.applicants);
      setCommittees(res.committees);
      setCanAccept(res.canAccept);
      setLoadError('');
    } catch (e) {
      setLoadError(friendlyError(e, 'Could not load the applicants. Please try again.'));
    }
  }, [conferenceId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (applicants && onWaitingChange) onWaitingChange(applicants.filter(a => a.status === 'submitted').length);
  }, [applicants, onWaitingChange]);

  const patch = useCallback((id: string, p: Partial<TeamApplicant>) => {
    setApplicants(prev => prev ? prev.map(a => (a.application_id === id ? { ...a, ...p } : a)) : prev);
  }, []);

  const byStatus = useMemo(() => (applicants ?? []).filter(a =>
    filter === 'all' ? true
      : filter === 'waiting' ? a.status === 'submitted'
        : filter === 'accepted' ? isAccepted(a.status)
          : a.status === filter,
  ), [applicants, filter]);
  const roleCount = (r: RoleChip) => (r === 'all' ? byStatus.length : byStatus.filter(a => a.role === r).length);
  const shown = roleChip === 'all' ? byStatus : byStatus.filter(a => a.role === roleChip);

  const committeeById = useMemo(() => new Map(committees.map(c => [c.id, c] as const)), [committees]);
  const openApplicant = open ? (applicants ?? []).find(a => a.application_id === open.id) ?? null : null;
  const configOf = (role: string) => roleConfigs.find(rc => rc.role === role);

  /** What they applied for: Job Board picks (ranked), else a chair's committee preferences. */
  const appliedFor = (a: TeamApplicant): string | null => {
    const picks = [...(a.picks ?? [])].sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99)).map(p => p.title?.trim()).filter(Boolean);
    if (picks.length > 0) return picks.join(', ');
    if (a.role === 'chair') {
      const prefs = [...(a.committee_preferences ?? [])].sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99))
        .map(p => committeeById.get(p.committee_id)).filter((c): c is TeamCommittee => !!c).map(committeeShort);
      if (prefs.length > 0) return prefs.join(', ');
    }
    return null;
  };
  /** A chair's seat line: the committees they sit in, or "Needs a committee". */
  const seatLine = (a: TeamApplicant): { text: string; needs: boolean } | null => {
    if (a.role !== 'chair' || !isAccepted(a.status)) return null;
    const seated = (a.seated_committee_ids ?? []).map(id => committeeById.get(id)).filter((c): c is TeamCommittee => !!c);
    if (seated.length === 0) return { text: 'Needs a committee', needs: true };
    return { text: seated.map(c => c.name).join(', '), needs: false };
  };

  const accept = useCallback(async (a: TeamApplicant, picked: Set<string>, publicTitle: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusyId(a.application_id);
    const before = { status: a.status, decided_at: a.decided_at, on_team: a.on_team };
    patch(a.application_id, { status: 'accepted' });
    try {
      const res = await acceptTeamApplication({
        conferenceId,
        appId: a.application_id,
        role: a.role,
        societyId: null,
        paymentTiming: roleConfigs.find(rc => rc.role === a.role)?.payment_timing ?? null,
        permissions: bundlePermissions('custom', Object.fromEntries([...picked].map(k => [k, true]))),
        publicTitle: publicTitle.trim() || null,
        pushDraftNotice,
      });
      patch(a.application_id, { status: 'accepted', decided_at: new Date().toISOString(), on_team: true });
      notifyOk(`${a.name ?? 'They'} joined the team`);
      if (res.followUpFailed) notifyErr('Accepted, but a follow-up step (email / auto-cover) failed. Refresh to verify.');
      setOpen(null);
      return true;
    } catch (e) {
      patch(a.application_id, before);
      notifyErr(friendlyError(e, 'Could not accept the application. Please try again.'));
      return false;
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [conferenceId, patch, pushDraftNotice, roleConfigs]);

  /** A chair: accept_chair_application, seated now (a committee) or later (null). */
  const acceptChairNow = useCallback(async (a: TeamApplicant, committeeId: string | null): Promise<string | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusyId(a.application_id);
    try {
      const res = await acceptChair({ conferenceId, appId: a.application_id, committeeId, pushDraftNotice });
      if (!res.ok) return res.message;
      const c = res.committeeId ? committeeById.get(res.committeeId) : undefined;
      notifyOk(c ? `${a.name ?? 'They'} accepted and seated in ${committeeShort(c)}` : `${a.name ?? 'They'} accepted`);
      if (res.followUpFailed) notifyErr('Accepted, but the acceptance email could not be queued. Refresh to verify.');
      setOpen(null);
      await load();
      return null;
    } catch (e) {
      return friendlyError(e, 'Could not accept the application. Please try again.');
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [conferenceId, pushDraftNotice, committeeById, load]);

  const reject = useCallback(async (a: TeamApplicant): Promise<boolean> => {
    if (busyRef.current) return false;
    if (!user) { notifyErr('Your session has expired, please refresh and sign in again.'); return false; }
    busyRef.current = true;
    setBusyId(a.application_id);
    const before = { status: a.status, decided_at: a.decided_at };
    patch(a.application_id, { status: 'rejected' });
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
      setRowAsk(null);
      setOpen(null);
      return true;
    } catch (e) {
      patch(a.application_id, before);
      notifyErr(friendlyError(e, 'Could not reject the application. Please try again.'));
      return false;
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [user, conferenceId, patch, pushDraftNotice]);

  const notices = (
    <DraftNoticeList
      notices={draftNotices}
      conferenceSlug={conferenceSlug}
      onDismiss={dismissDraftNotice}
      onTurnOn={async (eventKey) => {
        if (!session) return;
        await turnOnDefaultEmail(getAuthedClient(session.access_token), conferenceId, eventKey);
      }}
    />
  );

  if (loadError && !applicants) {
    return (
      <div className="mb-6">
        <Group title="Team Applications" emoji="Inbox tray" icon={Inbox} tint={TINT_GOLD_BG}>
          <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: OUTFIT }}>
            <p style={{ margin: 0, fontSize: 14, color: '#8B2020' }}>{loadError}</p>
            <button type="button" className="focus:outline-none" style={quietBtn(false)} onClick={() => { void load(); }}>Try again</button>
          </div>
        </Group>
        {notices}
      </div>
    );
  }
  if (!applicants) {
    return <div className="rounded-[22px] animate-pulse" style={{ height: 120, backgroundColor: NEU.surface, boxShadow: NEU.out }} aria-busy="true" />;
  }

  return (
    <div className="mb-6">
      <Group title="Team Applications" emoji="Inbox tray" icon={Inbox} tint={TINT_GOLD_BG}>
        {applicants.length === 0 ? (
          <p style={{ margin: 0, padding: '6px 0 4px', fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>
            Nobody has applied to chair, the secretariat or the staff yet.
          </p>
        ) : (
        <>
        <div role="tablist" aria-label="Show applicants" className="flex flex-wrap gap-2" style={{ marginBottom: 10 }}>
          {FILTERS.map(f => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className="rounded-full focus:outline-none" style={chipStyle(filter === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Show roles" className="flex gap-2 overflow-x-auto" style={{ marginBottom: 14, paddingBottom: 2 }}>
          {ROLE_CHIPS.map(r => (
            <button key={r.id} type="button" role="tab" aria-selected={roleChip === r.id} onClick={() => setRoleChip(r.id)}
              className="rounded-full focus:outline-none flex-shrink-0" style={chipStyle(roleChip === r.id)}>
              {r.label} <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>{roleCount(r.id)}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p style={{ margin: 0, padding: '6px 0 4px', fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>
            {filter === 'waiting' ? 'Nobody is waiting for a decision.' : 'No applicants here.'}
          </p>
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {shown.map(a => {
              const waiting = a.status === 'submitted';
              const busy = busyId === a.application_id;
              const forWhat = appliedFor(a);
              const seat = seatLine(a);
              const asking = rowAsk === a.application_id;
              return (
                <li key={a.application_id} className="flex flex-col gap-3"
                  style={{ padding: '14px 16px', borderRadius: 16, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 4px 12px rgba(27,56,40,0.06)', fontFamily: OUTFIT, minWidth: 0 }}>
                  <div className="flex items-start gap-3 min-w-0">
                    <Face name={a.name} url={a.avatar_url} size={44} />
                    <div className="min-w-0 flex-1">
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1C1410', overflowWrap: 'anywhere' }}>{a.name ?? 'No name'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>
                        {[
                          teamRoleLabel(a.role),
                          a.submitted_at ? `Applied ${fmtDay(a.submitted_at)}` : null,
                          isAccepted(a.status) ? 'Accepted' : a.status === 'rejected' ? 'Rejected' : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {forWhat && (
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#1C1410', overflowWrap: 'anywhere' }}>
                          <span style={{ color: NEU.inkSoft }}>Applied for </span>{forWhat}
                        </p>
                      )}
                      {seat && (
                        <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: seat.needs ? '#9A6B2F' : '#1B3828', overflowWrap: 'anywhere' }}>{seat.text}</p>
                      )}
                    </div>
                  </div>
                  {asking ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1C1410', flex: '1 1 200px' }}>
                        Reject this application? They get the usual rejection email
                      </p>
                      <button type="button" className="focus:outline-none" style={quietBtn(busy)} disabled={busy} onClick={() => setRowAsk(null)}>Cancel</button>
                      <button type="button" className="focus:outline-none" style={rejectBtn(busy)} disabled={busy} onClick={() => { void reject(a); }}>
                        {busy ? 'Rejecting' : 'Yes, reject'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="focus:outline-none" style={quietBtn(busy)} disabled={busy}
                        onClick={() => setOpen({ id: a.application_id, step: 'review' })}>
                        Review
                      </button>
                      {waiting && (
                        <>
                          <button type="button" className="focus:outline-none" style={rejectBtn(busy)} disabled={busy} onClick={() => setRowAsk(a.application_id)}>
                            Reject
                          </button>
                          <button type="button" className="focus:outline-none" style={primaryBtn(busy || !canAccept)} disabled={busy || !canAccept}
                            title={canAccept ? undefined : 'Adding someone to the team needs the Team permission'}
                            onClick={() => setOpen({ id: a.application_id, step: a.role === 'chair' ? 'seat' : 'access' })}>
                            Accept
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!canAccept && shown.some(a => a.status === 'submitted') && (
          <p style={{ margin: '10px 0 0', fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>
            Adding someone to the team needs the Team permission
          </p>
        )}
        </>
        )}
      </Group>

      {openApplicant && open && (
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
          onClose={() => setOpen(null)}
        />
      )}
      {notices}
    </div>
  );
}
