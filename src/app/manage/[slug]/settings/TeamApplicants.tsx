'use client';

// ── Settings > Team: Applicants ────────────────────────────────────────────
//
// Job Board prompt 3 (owner decision): secretariat and staff applicants land
// ONLY here. Accepting adds them to the organizing team with the sections the
// organizer ticks (all unticked by default) and the listing title as their
// public title. Every decision runs the shared code in
// applications/teamDecisions.ts:
//   accept  acceptTeamApplication (accept_team_application, then the same
//           acceptance email, payment_available and auto-cover as before)
//   reject  rejectUpdates + writeReject + rejectFollowUps: the SAME update,
//           the SAME rejection email and the SAME credit refund as the
//           Applications page.
// Optimistic status while busy, rolled back on a failure; a ref guards every
// button; errors are shown as written (friendlyError passes our sentences on).

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
import { Group, TINT_GOLD_BG } from './panelKit';
import TeamApplicantPopup, { Face, primaryBtn, quietBtn, rejectBtn, type PopupStep } from './TeamApplicantPopup';
import { loadTeamApplicants, teamRoleLabel, firstPickTitle, type TeamApplicant } from './teamApplicantsApi';

type Filter = 'waiting' | 'accepted' | 'rejected' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'waiting', label: 'Waiting' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export interface TeamRoleConfig { role: string; payment_timing: string | null; custom_questions: unknown }

export default function TeamApplicants({
  conferenceId, conferenceSlug, roleConfigs, onTeamChanged, onWaitingChange,
}: {
  conferenceId: string;
  conferenceSlug: string;
  roleConfigs: TeamRoleConfig[];
  /** Re-reads the organizing team (the settings page's loadOrganizers). */
  onTeamChanged: () => void;
  /** Keeps the Team tab's badge in step with the list. */
  onWaitingChange?: (n: number) => void;
}) {
  const { user, session } = useAuth();
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const [applicants, setApplicants] = useState<TeamApplicant[] | null>(null);
  const [canAccept, setCanAccept] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('waiting');
  const [open, setOpen] = useState<{ id: string; step: PopupStep } | null>(null);
  const [rowAsk, setRowAsk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Called each time the Team tab opens (this component mounts with it): the
  // read also records that an organizer reviewed applicants.
  const load = useCallback(async () => {
    try {
      const res = await loadTeamApplicants(conferenceId);
      setApplicants(res.applicants);
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

  const shown = useMemo(() => (applicants ?? []).filter(a =>
    filter === 'all' ? true
      : filter === 'waiting' ? a.status === 'submitted'
        : a.status === filter,
  ), [applicants, filter]);

  const openApplicant = open ? (applicants ?? []).find(a => a.application_id === open.id) ?? null : null;
  const configOf = (role: string) => roleConfigs.find(rc => rc.role === role);

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
      onTeamChanged();
      return true;
    } catch (e) {
      patch(a.application_id, before);
      notifyErr(friendlyError(e, 'Could not accept the application. Please try again.'));
      return false;
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }, [conferenceId, patch, pushDraftNotice, onTeamChanged, roleConfigs]);

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
        <Group title="Applicants" emoji="Inbox tray" icon={Inbox} tint={TINT_GOLD_BG}>
          <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: OUTFIT }}>
            <p style={{ margin: 0, fontSize: 14, color: '#8B2020' }}>{loadError}</p>
            <button type="button" className="focus:outline-none" style={quietBtn(false)} onClick={() => { void load(); }}>Try again</button>
          </div>
        </Group>
        {notices}
      </div>
    );
  }
  if (!applicants || applicants.length === 0) return notices;

  return (
    <div className="mb-6">
      <Group title="Applicants" emoji="Inbox tray" icon={Inbox} tint={TINT_GOLD_BG}>
        <div role="tablist" aria-label="Show applicants" className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
          {FILTERS.map(f => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.id)}
                className="rounded-full focus:outline-none"
                style={{
                  minHeight: 36, padding: '0 14px', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700,
                  color: on ? '#EED98A' : '#1C1410', backgroundColor: on ? '#1B3828' : '#FFFFFF',
                  border: on ? '1.5px solid #1B3828' : '1.5px solid #E4DAC4', cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <p style={{ margin: 0, padding: '6px 0 4px', fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>
            {filter === 'waiting' ? 'Nobody is waiting for a decision.' : 'No applicants here.'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map(a => {
              const waiting = a.status === 'submitted';
              const busy = busyId === a.application_id;
              const forTitle = firstPickTitle(a);
              const asking = rowAsk === a.application_id;
              return (
                <li key={a.application_id} className="flex flex-wrap items-center gap-3"
                  style={{ padding: '12px 14px', borderRadius: 16, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 4px 12px rgba(27,56,40,0.06)', fontFamily: OUTFIT }}>
                  <Face name={a.name} url={a.avatar_url} size={44} />
                  <div className="min-w-0" style={{ flex: '1 1 220px' }}>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1C1410' }}>
                      <span style={{ overflowWrap: 'anywhere' }}>{a.name ?? 'No name'}</span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>
                      {[
                        teamRoleLabel(a.role) + (forTitle ? ` for ${forTitle}` : ''),
                        a.submitted_at ? `Applied ${fmtDay(a.submitted_at)}` : null,
                        a.status === 'accepted' ? 'Accepted' : a.status === 'rejected' ? 'Rejected' : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {asking ? (
                    <div className="flex flex-wrap items-center gap-2" style={{ flex: '1 1 320px', justifyContent: 'flex-end' }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1C1410' }}>
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
                            onClick={() => setOpen({ id: a.application_id, step: 'access' })}>
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
      </Group>

      {openApplicant && open && (
        <TeamApplicantPopup
          key={openApplicant.application_id}
          applicant={openApplicant}
          initialStep={open.step}
          canAccept={canAccept}
          busy={busyId === openApplicant.application_id}
          customQuestions={configOf(openApplicant.role)?.custom_questions ?? []}
          onAccept={(picked, title) => accept(openApplicant, picked, title)}
          onReject={() => reject(openApplicant)}
          onClose={() => setOpen(null)}
        />
      )}
      {notices}
    </div>
  );
}
