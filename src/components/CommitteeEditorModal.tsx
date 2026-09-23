'use client';

// Shared committee editor modal, extracted from manage/[slug]/committees/page.tsx
// so the organiser committees tab and the public conference page can share it.
// Exposes: CommitteeEditorModal (create + edit, with built-in type picker for the
// create flow), MonogramMedallion (fallback emblem), ModalOverlay (house modal
// backdrop) and mintConferenceSession (session minting for conference committees).

import { useState, useEffect, useCallback } from 'react';
import { X, UserPlus, Mail, Send, Landmark, Scale, Zap, Users2 } from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuButton, type NeuGradient } from '@/components/neu';
import { getAuthedClient } from '@/lib/supabase-auth';
import { sessionClient } from '@/lib/sessionClient';
import { useAuth } from '@/components/AuthProvider';
import { getCountryByName } from '@/lib/countries';
import {
  ConferenceRosterSelected,
  type RosterEntry,
} from '@/components/ConferenceRosterPicker';
import {
  CommitteeIdentityPreview,
  CommitteeSetupFields,
  SetupPrimaryButton,
  SetupGhostButton,
  committeeSetupPreview,
  CommitteeTypeGlyph,
  committeeTypeAccent,
  effectiveEmblem,
  resolveSeatArt,
  rosterModeOf,
  seatNounsOf,
  COMMITTEE_TYPE_LABEL,
  type CommitteeType,
  type CommitteeSetupDraft,
} from '@/components/committeeSetupKit';
import { type SlotGroup, parseGroups } from '@/lib/slotGroups';
import { uploadConferenceAsset } from '@/lib/conferenceAssets';
import { LogoCropModal } from '@/components/LogoCropModal';
import Portal from '@/components/Portal';
import Loader from '@/components/Loader';
import {
  sendChairInvite,
  findChairInviteRoleConflict,
  resendChairInvite,
  revokeChairInvite,
  pendingInviteName,
  type PendingChairInvite,
} from '@/lib/chairInvites';
import { queueEventEmail } from '@/lib/emailEvents';
import { friendlyError } from '@/lib/friendlyError';

// ── Design constants ──────────────────────────────────────────────────────────

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

// `inputStyle` / `labelStyle` lived here until 23 Sep 2026. Every field in the
// editor now uses the shared kit (SETUP_INPUT_CLS / SetupLabel), so both were
// dead. ConferenceRosterPicker keeps its own copies for its own controls.

// ── Types ─────────────────────────────────────────────────────────────────────

// Committee type governs rostering: GA + Specialised roster by country slots;
// Crisis rosters free-text character names. Custom is the parliamentary type
// (Model EP, Lok Sabha, Commons, Congress, youth parliaments): free-text seats
// like Crisis, plus seat GROUPS with their own flags (src/lib/slotGroups.ts). Crisis and
// Custom take the character path, the other two fall through to countries.
//
// Declared in @/components/committeeSetupKit (23 Sep 2026) so the shared set-up
// surface can read them without importing this file back. Re-exported, so every
// existing `import { CommitteeType, COMMITTEE_TYPE_LABEL } from
// '@/components/CommitteeEditorModal'` keeps working.
export { COMMITTEE_TYPE_LABEL };
export type { CommitteeType };

export interface EditableCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  session_id: string | null;
  logo_url: string | null;
  /** conference_committees.groups, raw. Optional: the editor fetches it itself. */
  groups?: unknown;
}

// ── Fallback emblem, gradient monogram disc with grain, matching the public card
// Moved to @/components/MonogramMedallion (23 Sep 2026) so the committee set-up
// kit can draw it without importing this file back. Re-exported so every
// existing `import { MonogramMedallion, medallionTone } from
// '@/components/CommitteeEditorModal'` keeps working.

import { MonogramMedallion, medallionTone, type MedallionTone } from '@/components/MonogramMedallion';
export { MonogramMedallion, medallionTone };
export type { MedallionTone };

// ── Shared modal overlay ──────────────────────────────────────────────────────
// Moved to @/components/ModalOverlay (background scroll lock + Escape + ARIA
// live there now, shared by every dialog in the app). Re-exported so the many
// existing `import { ModalOverlay } from '@/components/CommitteeEditorModal'`
// call sites keep working.

import { ModalOverlay, MODAL_PANEL_MAX_HEIGHT } from '@/components/ModalOverlay';
export { ModalOverlay, MODAL_PANEL_MAX_HEIGHT };

// ── Session minting ───────────────────────────────────────────────────────────

// ═══ WHICH CLIENT WRITES WHICH TABLE — READ THIS BEFORE ADDING A WRITE ═══════
//
// This file straddles two worlds. The CONFERENCE tables (conference_committees,
// committee_country_slots, conference_allocations, applications) are gated on
// `auth.uid()`, so the organiser's `getAuthedClient(token)` is the right client.
//
// The SESSION tables are NOT. `delegates`, `current_speaker` and UPDATEs to
// `committees` are gated purely on the session headers:
//     delegates        sess_ins    has_session_code(c) OR is_session_chair(c)
//                      sess_upd    is_session_chair(c) OR has_session_code(c)
//                      sess_del    is_session_chair(c)
//     current_speaker  sess_ins/upd/del   is_session_chair(c)
//     committees       sess_chair_update  is_session_chair(c)
// `has_session_code` reads the `x-session-code` header and `is_session_chair`
// reads `x-chair-suffix`. Neither looks at `auth.uid()`, so there is NO path an
// organiser's Authorization token can satisfy — and PostgREST reports an RLS
// mismatch on an UPDATE/DELETE as "0 rows changed", not as an error.
//
// That is exactly how this went unnoticed for two months: every delegates write
// from this editor was rejected, nothing threw, and chairs opening a committee
// created after the write gate landed found an EMPTY room.
//
// SO: any write to `delegates`, `current_speaker`, or `committees` from this
// file MUST go through `sessionClient(sessionCode, chairJoinSuffix)`, and MUST
// check `error` and surface it. `sessionCode` is `committees.code`; the suffix
// is `committees.settings.chairJoinSuffix` (see `sessionCommitteeClient` below).
// ════════════════════════════════════════════════════════════════════════════

/** Look up a minted session's code + chair suffix and return the header-carrying
 *  client that its RLS policies actually accept. Reads go through the organiser's
 *  client (committees.sess_select is `true`); only the WRITE needs the headers.
 *  Fetched once per save, not once per row.
 *
 *  `missing: true` distinguishes "the session row is already gone" from every
 *  other failure. A caller that is DELETING the session treats that as work
 *  already done; a caller that is UPDATING it treats it as an error like any
 *  other. Do not collapse the two — the committees page would otherwise refuse
 *  forever to delete a conference committee whose session row no longer exists.
 *
 *  Exported because the committees page deletes the live session and must use
 *  the same lookup: there is exactly one place that knows how to build a client
 *  RLS accepts, and a second copy would drift. */
export async function sessionCommitteeClient(
  supabase: ReturnType<typeof getAuthedClient>,
  sessionId: string,
): Promise<{ client: ReturnType<typeof sessionClient>; settings: Record<string, unknown>; topic: string | null } | { error: string; missing?: boolean }> {
  const { data, error } = await supabase
    .from('committees')
    .select('code, settings, topic')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) { console.error('[committee-editor]', error); return { error: 'the live session could not be read' }; }
  if (!data?.code) return { error: 'the live session row is missing', missing: true };
  const settings = (data.settings as Record<string, unknown> | null) ?? {};
  const suffix = settings.chairJoinSuffix;
  // The suffix is the only credential `is_session_chair` accepts. Without it
  // deletes and committees updates are rejected, so refuse rather than half-write.
  if (typeof suffix !== 'string' || !suffix) {
    return { error: 'the live session has no chair code, so it cannot be updated' };
  }
  // `settings` and `topic` ride along because the organiser re-sync needs the
  // chair's agenda choice from them. Read-only; never write settings back.
  return { client: sessionClient(data.code as string, suffix), settings, topic: (data.topic as string | null) ?? null };
}

// One seat handed to the minter. `name` is what `delegates.country` stores, the
// same string the roster and `committee_country_slots.country_name` carry.
//
// `logoUrl` is the seat's ALREADY RESOLVED art (its own flag, else its group's),
// resolved by the caller because only the caller has the groups in hand. It is
// resolved at WRITE time on purpose: the session client is anonymous and cannot
// read `committee_country_slots` (or `conference_committees.groups`) for a
// private conference, so the live session can never work out "own flag, else
// the party flag" for itself. `delegates.logo_url` carries the answer.
export interface MintSeat {
  name: string;
  logoUrl?: string | null;
}

// Mint a real, joinable session for a conference committee and link it back.
// Generates a unique 6-char code, retrying on a code-uniqueness collision.
// Returns the code, or null if the session row itself could not be created.
//
// CLIENTS: `committees.sess_insert` is WITH CHECK `true`, so the organiser's
// authed client mints the row. Everything after that — the current_speaker row
// and the delegate seats — is a session-header write and goes through
// `sessionClient(code, chairJoinSuffix)`. See the block comment above; the
// previous code used the authed client for both and both were silently dropped.
//
// `onProblem` reports a session that was created but not fully furnished. The
// code is still returned in that case (the row exists and is linked, so
// swallowing it would strand it), but the caller MUST surface the message.
export async function mintConferenceSession(
  supabase: ReturnType<typeof getAuthedClient>,
  confCommitteeId: string,
  name: string,
  topic: string,
  // Empty is normal and supported: the "generate code" button on the committees
  // page mints a bare session and seats nobody.
  seats: MintSeat[],
  // Names (countries or characters) flagged as observers. Mirrors the standalone
  // session flow: delegates.is_observer carries the flag on the live session, so
  // the chair/roll-call/voting views treat these rows as observers identically.
  observers: string[] = [],
  onProblem?: (message: string) => void,
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const chairJoinSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const { data: sessionRow, error: sErr } = await supabase
      .from('committees')
      .insert({
        code,
        name,
        topic: topic || 'TBD',
        chair_names: [],
        phase: 'pre-session',
        speaker_time_limit: 90,
        settings: { chairJoinSuffix, separateChairCode: true },
        session_origin: 'conference',
      })
      .select('id')
      .single();
    if (sErr) {
      if (sErr.code === '23505') continue; // code collision, try a new code
      console.error('Error minting conference session:', sErr);
      return null;
    }
    // SESSION-HEADER CLIENT from here on — the two writes below are gated on
    // is_session_chair / has_session_code, not on the organiser's token.
    const sessDb = sessionClient(code, chairJoinSuffix);
    const { error: csErr } = await sessDb.from('current_speaker').insert({
      committee_id: sessionRow.id,
      delegate_id: null,
      country: null,
      time_remaining: 90,
    });
    if (csErr) {
      console.error('[committee-editor] Error creating current_speaker for minted session:', csErr);
      onProblem?.('the speaker slot could not be created');
    }
    if (seats.length > 0) {
      const observerSet = new Set(observers.map((o) => o.toLowerCase()));
      const { error: dErr } = await sessDb.from('delegates').insert(
        seats.map((s) => ({
          committee_id: sessionRow.id,
          country: s.name,
          status: 'absent',
          is_observer: observerSet.has(s.name.toLowerCase()),
          logo_url: s.logoUrl ?? null,
        }))
      );
      if (dErr) {
        console.error('[committee-editor] Error seating delegates on minted session:', dErr);
        onProblem?.(`the ${seats.length} seats could not be added to the live session`);
      }
    }
    // THE LINK IS THE WHOLE POINT OF THE MINT. Without `session_id` the live
    // wall, the cross-committee scoreboard and awards can never find this room:
    // they all join through conference_committees.session_id, not through the
    // code. An unchecked update here hands the organiser a join code for a room
    // nothing on the conference side is attached to — a session that is orphaned
    // from birth. `.select('id')` because an RLS mismatch on an UPDATE reports
    // zero rows changed, not an error.
    const { data: linked, error: linkErr } = await supabase
      .from('conference_committees')
      .update({ session_id: sessionRow.id, session_code: code })
      .eq('id', confCommitteeId)
      .select('id');
    if (linkErr || !linked || linked.length === 0) {
      console.error('[committee-editor] Error linking minted session to conference committee:', linkErr);
      onProblem?.(
        'the session was created but not linked to the committee, so the live wall, the scoreboard and awards cannot see it',
      );
    }
    return code;
  }
  return null;
}

// ── ChairsDock (side popover, docked outside the main editor modal) ───────────
// A small distinct panel showing the committee's seated chairs (avatars), plus
// entry points to add an accepted applicant or invite a chair by email. Reuses
// the existing chair flow: the create_chair_invite RPC via sendChairInvite, and
// the chair_user_ids append the committees page assigns with.

interface DisplayChair { name: string; avatar_url: string | null }
interface ChairApplicant {
  id: string;
  user_id: string;
  assigned_committee_id: string | null;
  profiles: { display_name: string; email: string; avatar_url: string | null } | null;
}

function ChairsDock({ conferenceId, committeeId, committeeName }: {
  conferenceId: string;
  committeeId: string;
  committeeName: string;
}) {
  const { session } = useAuth();
  const [chairs, setChairs] = useState<DisplayChair[] | null>(null);
  const [chairIds, setChairIds] = useState<string[]>([]);
  // Invited, not yet accepted. A separate table from the seated dais on
  // purpose — see the note on PendingChairInvite in @/lib/chairInvites. This is
  // an organiser surface, so it shows them; the public page never does.
  const [invites, setInvites] = useState<PendingChairInvite[]>([]);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [applicants, setApplicants] = useState<ChairApplicant[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  // Two-roles warning, rendered inline below (neumorphic dialog) rather
  // than through the shared (flat) ConfirmModal.
  const [roleConflict, setRoleConflict] = useState<{ displayName: string; role: string; email: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const [{ data }, { data: inviteRows }] = await Promise.all([
      supabase
        .from('conference_committees')
        .select('display_chairs, chair_user_ids')
        .eq('id', committeeId)
        .single(),
      // Scoped to this committee rather than going through
      // fetchPendingChairInvites (conference-wide): the dock only ever renders
      // one dais, and it does not receive the conference's committee list.
      supabase
        .from('conference_chair_invites')
        .select('id, committee_id, email, invited_name, profiles (display_name, avatar_url)')
        .eq('committee_id', committeeId)
        .eq('status', 'pending'),
    ]);
    setChairs(((data?.display_chairs as DisplayChair[] | null) ?? []));
    setChairIds(((data?.chair_user_ids as string[] | null) ?? []));
    setInvites((inviteRows ?? []) as unknown as PendingChairInvite[]);
  }, [session, committeeId]);

  // Resend / withdraw, the same two actions the committees grid offers on a
  // pending face. Resend reuses the existing invite row and its token.
  async function handleResend(invite: PendingChairInvite) {
    if (!session || inviteBusyId) return;
    setInviteBusyId(invite.id); setErr(''); setNote('');
    const supabase = getAuthedClient(session.access_token);
    const res = await resendChairInvite(supabase, { conferenceId, committeeId, committeeName, email: invite.email });
    setInviteBusyId(null);
    if (!res.ok) { setErr(res.error ?? 'Could not resend that invite.'); return; }
    setNote(`Invite resent to ${pendingInviteName(invite)}.`);
  }

  async function handleRevoke(invite: PendingChairInvite) {
    if (!session || inviteBusyId) return;
    const label = pendingInviteName(invite);
    setInviteBusyId(invite.id); setErr(''); setNote('');
    // Optimistic: the pending row goes at once and returns if the write fails.
    setInvites(prev => prev.filter(i => i.id !== invite.id));
    const supabase = getAuthedClient(session.access_token);
    const ok = await revokeChairInvite(supabase, invite.id);
    setInviteBusyId(null);
    if (!ok) {
      setInvites(prev => (prev.some(i => i.id === invite.id) ? prev : [...prev, invite]));
      setErr(`Could not remove the invite to ${label}.`);
      return;
    }
    setNote(`Invite to ${label} removed.`);
  }

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!expanded || !session || applicants !== null) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('applications')
        .select('id, user_id, assigned_committee_id, profiles (display_name, email, avatar_url)')
        .eq('conference_id', conferenceId)
        .eq('role', 'chair')
        .in('status', ['accepted', 'assigned']);
      if (!cancelled) setApplicants((data ?? []) as unknown as ChairApplicant[]);
    })();
    return () => { cancelled = true; };
  }, [expanded, session, applicants, conferenceId]);

  async function doSend(em: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const res = await sendChairInvite(supabase, { conferenceId, committeeId, committeeName, email: em });
    if (!res.ok) { setErr(res.error ?? 'Could not invite that chair.'); return; }
    setNote(`Invited ${res.invitedName ?? em}.`);
    setEmail('');
    load();
  }

  async function invite() {
    const em = email.trim();
    if (!em || !session) return;
    setBusy(true); setErr(''); setNote('');
    const supabase = getAuthedClient(session.access_token);

    // Two-roles warning: this email already holds an active application in
    // another role, confirm before giving them a second one.
    const conflict = await findChairInviteRoleConflict(supabase, conferenceId, em);
    if (conflict) {
      setBusy(false);
      setRoleConflict({ ...conflict, email: em });
      return;
    }

    await doSend(em);
    setBusy(false);
  }

  async function handleProceedRoleConflict() {
    if (!roleConflict || confirmBusy) return;
    setConfirmBusy(true);
    await doSend(roleConflict.email);
    setConfirmBusy(false);
    setRoleConflict(null);
  }

  async function assign(app: ChairApplicant) {
    if (!session || chairIds.includes(app.user_id)) return;
    setBusy(true); setErr(''); setNote('');
    const supabase = getAuthedClient(session.access_token);
    const nextIds = Array.from(new Set([...chairIds, app.user_id]));
    const { error } = await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committeeId);
    if (error) { setBusy(false); setErr('Could not seat that chair.'); return; }
    await supabase.from('applications').update({ status: 'assigned', assigned_committee_id: committeeId, decided_by: session.user.id, decided_at: new Date().toISOString() }).eq('id', app.id);
    // The guard at the top of this function already ensures app.user_id
    // wasn't already seated, so every call here is a genuinely new chair.
    queueEventEmail(supabase, conferenceId, 'chair_assigned', [app.id]);
    setChairIds(nextIds);
    setApplicants((prev) => prev ? prev.filter((a) => a.id !== app.id) : prev);
    setBusy(false);
    setNote(`Seated ${app.profiles?.display_name ?? 'chair'}.`);
    load();
  }

  const visibleApplicants = (applicants ?? []).filter((a) => !chairIds.includes(a.user_id));

  return (
    <div
      className="rounded-2xl flex flex-col"
      /* Fills the docked rail rather than setting its own width — the rail is
         shared with the roster panel below and sizes both together. */
      style={{ width: '100%', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '40vh', overflowY: 'auto', flexShrink: 0, boxShadow: '0 12px 32px rgba(27,56,40,0.16)' }}
    >
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #EDE7D8' }}>
        <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#B6871F' }}>THE DAIS</p>
        <p className="font-bold text-[13.5px] mt-0.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Chairs</p>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2">
        {chairs === null ? (
          <div className="flex justify-center py-4"><div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} /></div>
        ) : chairs.length === 0 && invites.length === 0 ? (
          /* Guarded on BOTH lists. On `chairs` alone this printed "No chairs
             seated yet" directly above the pending invitee rendered a few
             lines below, so a dais with an invite out read as empty. */
          <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.45 }}>No chairs seated yet.</p>
        ) : (
          chairs.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {c.avatar_url ? (
                <img src={c.avatar_url} alt={c.name} style={{ width: 28, height: 28, borderRadius: '9999px', objectFit: 'cover', backgroundColor: '#EDE7D8', flexShrink: 0 }} />
              ) : (
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: '9999px', backgroundColor: '#1B3828', color: '#EED98A', fontSize: 11, fontWeight: 700, fontFamily: OUTFIT }}>{c.name.charAt(0)}</span>
              )}
              <span className="text-[12.5px] truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{c.name}</span>
            </div>
          ))
        )}

        {/* Invitees sit IN the chair list, not under a divider below it. An
            invited chair is already part of this dais as far as the
            secretariat is concerned, just not confirmed, and separating them
            made a committee with an invite out look chairless. Greyed, with
            the badge carrying the reason, and both actions kept: send the
            email again, or take it back. */}
        {invites.length > 0 && (
          <div className="flex flex-col gap-2">
            {invites.map((inv) => {
              const label = pendingInviteName(inv);
              const busy = inviteBusyId === inv.id;
              return (
                <div key={inv.id} className="flex items-center gap-2">
                  <span className="relative flex-shrink-0" style={{ lineHeight: 0 }}>
                    {inv.profiles?.avatar_url ? (
                      <img src={inv.profiles.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '9999px', objectFit: 'cover', backgroundColor: '#EDE7D8', opacity: 0.62 }} />
                    ) : (
                      <span className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.10)', color: '#7A5A10', fontSize: 11, fontWeight: 700, fontFamily: OUTFIT }}>{label.charAt(0).toUpperCase()}</span>
                    )}
                    <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ borderRadius: 9999, border: '1.5px dashed #B6871F' }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[12px] truncate" style={{ display: 'block', color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }} title={inv.email}>{label}</span>
                    <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em', color: '#7A5A10' }}>PENDING</span>
                  </span>
                  <button
                    onClick={() => handleResend(inv)}
                    disabled={busy}
                    title={`Resend the invite to ${label}`}
                    aria-label={`Resend the invite to ${label}`}
                    className="focus:outline-none flex-shrink-0"
                    style={{ color: busy ? '#C4B9A6' : '#1B3828', background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', lineHeight: 0 }}
                  >
                    <Send size={13} />
                  </button>
                  <button
                    onClick={() => handleRevoke(inv)}
                    disabled={busy}
                    title={`Remove the invite to ${label}`}
                    aria-label={`Remove the invite to ${label}`}
                    className="focus:outline-none flex-shrink-0"
                    style={{ color: busy ? '#C4B9A6' : '#9A8A78', background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', lineHeight: 0 }}
                    onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                    onMouseLeave={e => { if (!busy) (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                  >
                    <X size={13} strokeWidth={2.4} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 mt-auto">
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold text-[11px] focus:outline-none"
            style={{ border: '1.5px solid #1B3828', color: '#1B3828', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer', transition: `background-color 200ms ${EASE}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <UserPlus size={13} /> ADD CHAIR
          </button>
        ) : (
          <div className="flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid #EDE7D8' }}>
            {/* Invite by email */}
            <div>
              <p style={{ margin: '0 0 6px 0', fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>INVITE BY EMAIL</p>
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); invite(); } }}
                  placeholder="chair@example.com"
                  style={{ flex: 1, minWidth: 0, border: '1px solid #DDD4C0', borderRadius: 8, padding: '6px 9px', fontSize: 12, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none', fontFamily: OUTFIT }}
                />
                <button
                  onClick={invite}
                  disabled={busy || !email.trim()}
                  className="gv-lift rounded-lg px-2.5 flex items-center justify-center focus:outline-none flex-shrink-0"
                  style={{ backgroundColor: busy || !email.trim() ? '#DDD4C0' : '#1B3828', color: busy || !email.trim() ? '#9A8A78' : '#EED98A', cursor: 'pointer' }}
                  title="Send invite"
                >
                  <Mail size={13} />
                </button>
              </div>
            </div>
            {/* Accepted applicants to seat */}
            <div>
              <p style={{ margin: '0 0 6px 0', fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>ACCEPTED APPLICANTS</p>
              {applicants === null ? (
                <div className="flex justify-center py-3"><div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} /></div>
              ) : visibleApplicants.length === 0 ? (
                <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>None available.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {visibleApplicants.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => assign(app)}
                      disabled={busy}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left focus:outline-none"
                      style={{ border: '1px solid #EDE7D8', backgroundColor: 'rgba(237,231,216,0.3)', cursor: 'pointer' }}
                      title={`Seat ${app.profiles?.display_name ?? 'chair'}`}
                    >
                      {app.profiles?.avatar_url ? (
                        <img src={app.profiles.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '9999px', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: '9999px', backgroundColor: '#1B3828', color: '#EED98A', fontSize: 10, fontWeight: 700, fontFamily: OUTFIT }}>{(app.profiles?.display_name ?? '?').charAt(0)}</span>
                      )}
                      <span className="text-[11.5px] truncate flex-1 min-w-0" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{app.profiles?.display_name ?? 'Unknown'}</span>
                      <UserPlus size={12} style={{ color: '#1B3828', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {note && <p className="text-[10.5px] mt-2" style={{ color: '#2A5A3C', fontFamily: OUTFIT }}>{note}</p>}
        {err && <p className="text-[10.5px] mt-2" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{err}</p>}
      </div>
      {roleConflict && (
        <ModalOverlay onClose={() => { if (!confirmBusy) setRoleConflict(null); }}>
          <div
            className="p-6"
            style={{
              width: 'min(92vw, 420px)',
              backgroundColor: NEU.surface,
              borderRadius: 24,
              boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)`,
            }}
          >
            <p className="text-base mb-2" style={{ color: NEU.ink, fontWeight: 800, fontFamily: OUTFIT }}>
              This person already holds a role
            </p>
            <p className="text-sm mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
              {roleConflict.displayName} already has an active {roleConflict.role.replace(/-/g, ' ')} application at this conference. Accepting this chair invite will give them two roles.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRoleConflict(null)}
                disabled={confirmBusy}
                className="flex-1 rounded-full py-2.5 font-bold text-sm focus:outline-none"
                style={{
                  border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm,
                  fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: confirmBusy ? 'default' : 'pointer',
                }}
              >
                CANCEL
              </button>
              <NeuButton onClick={handleProceedRoleConflict} disabled={confirmBusy} style={{ flex: 1 }}>
                {confirmBusy ? 'PROCEEDING...' : 'PROCEED'}
              </NeuButton>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ── CommitteeEditor (create + edit) ───────────────────────────────────────────

function CommitteeEditor({ conferenceId, committeeType, existing, initialRoster, initialDelegationSize = 1, initialGroups, onClose, onSaved }: {
  conferenceId: string;
  committeeType: CommitteeType;
  existing?: EditableCommittee | null;
  initialRoster?: RosterEntry[];
  initialDelegationSize?: number;
  initialGroups?: SlotGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!existing;
  const effectiveType = existing ? existing.committee_type : committeeType;
  const isCustom = effectiveType === 'custom';
  const [name, setName] = useState(existing?.name ?? '');
  const [abbreviation, setAbbreviation] = useState(existing?.abbreviation ?? '');
  const [topics, setTopics] = useState<string[]>(existing?.topics ?? []);
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 'intermediate');
  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster ?? []);
  const [baselineRoster] = useState<RosterEntry[]>(initialRoster ?? []);
  // Seat groups (custom committees). Persisted whole into
  // conference_committees.groups; a slot references one by group_id.
  const [groups, setGroups] = useState<SlotGroup[]>(initialGroups ?? []);
  // The groups this committee was opened with, frozen at mount like
  // baselineRoster. Needed to tell whether a GROUP's flag changed during the
  // edit: that moves the art of every seat in it without touching any seat row.
  const [baselineGroups] = useState<SlotGroup[]>(initialGroups ?? []);
  // Committee-level toggle: off = every country/character seats one delegate
  // (delegation_size 1, today's behavior), on = every slot seats two. No
  // per-country control — this single toggle drives every slot's size.
  const [doubleDelegation, setDoubleDelegation] = useState<boolean>(initialDelegationSize === 2);
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number | null>(null);
  // Turning double delegation OFF is destructive when second seats are
  // occupied — count of affected delegates, shown in the danger confirm modal.
  const [pendingDoubleOffCount, setPendingDoubleOffCount] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(existing?.logo_url ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  // Once the organiser uploads, clears, or picks an emblem, we stop auto-filling
  // the default from the name. An existing committee that already has an emblem
  // counts as manually set.
  const [emblemManuallySet, setEmblemManuallySet] = useState<boolean>(!!existing?.logo_url);
  // The picked file, held while the organiser frames it in LogoCropModal — the
  // same drag-to-fit step the conference logo upload uses. Nothing is uploaded
  // until they save the crop.
  const [emblemCropFile, setEmblemCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Set when a create partially succeeded (committee written, live session not
  // furnished). Save is locked afterwards so a retry cannot mint a duplicate
  // committee on top of the one that already exists.
  const [createHalted, setCreateHalted] = useState(false);
  // A selected preset can force the roster path (ICC/ICJ/Crisis/HoC/Senate/Press
  // roster free-text seats even under a non-crisis type). Null → fall back to the
  // committee_type default. Cleared to 'country'/'character' on preset select.
  const [presetRosterMode, setPresetRosterMode] = useState<'country' | 'character' | null>(null);

  // ── THE SHARED DRAFT ────────────────────────────────────────────────────────
  // One view of this editor's own useStates, in the shape the shared set-up
  // surface speaks (`CommitteeSetupFields`, used identically by the creation
  // wizard). `patchDraft` fans a partial patch back out to the setters, so every
  // existing write path — doCreate, doEdit, the destructive confirms, the
  // baselines — is untouched and still reads the individual pieces of state.
  const draft: CommitteeSetupDraft = {
    name, abbreviation, topics, difficulty,
    roster, groups, doubleDelegation,
    logoUrl, emblemManuallySet, presetRosterMode,
  };
  const patchDraft = (p: Partial<CommitteeSetupDraft>) => {
    if (p.name !== undefined) setName(p.name);
    if (p.abbreviation !== undefined) setAbbreviation(p.abbreviation);
    if (p.topics !== undefined) setTopics(p.topics);
    if (p.difficulty !== undefined) setDifficulty(p.difficulty);
    if (p.roster !== undefined) setRoster(p.roster);
    if (p.groups !== undefined) setGroups(p.groups);
    if (p.doubleDelegation !== undefined) setDoubleDelegation(p.doubleDelegation);
    if (p.logoUrl !== undefined) setLogoUrl(p.logoUrl);
    if (p.emblemManuallySet !== undefined) setEmblemManuallySet(p.emblemManuallySet);
    if (p.presetRosterMode !== undefined) setPresetRosterMode(p.presetRosterMode);
  };

  const rosterMode = rosterModeOf(draft, effectiveType as CommitteeType);
  const isCharacterRoster = rosterMode === 'character';
  const { noun: seatNoun, plural: seatNounPlural } = seatNounsOf(effectiveType as CommitteeType, isCharacterRoster);

  // The live identity, the acronym suggestion and the emblem, all derived once
  // by the shared helper so the editor, the wizard and the saved row cannot
  // disagree. `previewEmblem` is what `logo_url` is written from: the
  // organiser's own choice, else whatever `matchPresetEmblem` resolves from the
  // name and acronym. It used to be an EFFECT that wrote `logoUrl` on every
  // keystroke (a cascading-render setState-in-effect that could also disagree
  // with what was about to be saved); it is a pure derivation now.
  const { primary: previewPrimary, secondary: previewSecondary, acronym: previewAcronym } = committeeSetupPreview(draft);
  const previewEmblem = effectiveEmblem(draft);

  // Committee type as an icon beside a plain word (no status pills, CLAUDE.md §8).
  const typeAccent = committeeTypeAccent(effectiveType as CommitteeType);

  // Mirrors the conference logo upload in manage/[slug]/settings, same bucket, own
  // folder — including the LogoCropModal step in front of it, so a committee emblem
  // is framed exactly the way a conference logo is. What arrives here is therefore
  // always the crop tool's flattened 512×512 transparent PNG.
  async function handleEmblemUpload(file: File) {
    if (!session) return;
    setLogoUploading(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    // `uploadConferenceAsset` is the ONE upload path (23 Sep 2026): same bucket
    // and folder as before, plus the 5MB guard and the client-side downscale the
    // conference logo already used. What arrives here is the crop tool's
    // flattened 512x512 transparent PNG, so the downscale is a no-op.
    const res = await uploadConferenceAsset(supabase, 'committee-emblems', conferenceId, file);
    if (res.url === undefined) { setError(res.error ?? 'Upload failed.'); setLogoUploading(false); return; }
    setLogoUrl(res.url);
    setEmblemManuallySet(true);
    setLogoUploading(false);
  }

  // Seat and group flags. Same bucket, their own folders; uploadConferenceAsset
  // downsizes to 512px PNG on the client first. Resolves to the public URL, or
  // null after surfacing the error in the editor's own error line.
  const handleFlagUpload = useCallback(async (file: File, kind: 'seat' | 'group'): Promise<string | null> => {
    if (!session) return null;
    const supabase = getAuthedClient(session.access_token);
    const res = await uploadConferenceAsset(supabase, kind === 'group' ? 'group-logos' : 'seat-logos', conferenceId, file);
    if (res.url === undefined) { setError(res.error ?? 'Upload failed.'); return null; }
    setError('');
    return res.url;
  }, [session, conferenceId]);

  // A slot only keeps a group_id that still names a live group.
  const validGroupId = (id: string | null | undefined): string | null =>
    id && groups.some((g) => g.id === id) ? id : null;

  // What a seat actually shows: its own flag, else its group's flag, else
  // nothing (the session falls back to the country flag on its own).
  //
  // ART IS RESOLVED HERE, AT WRITE TIME, and copied onto delegates.logo_url.
  // It cannot be resolved when the session renders: the session client is
  // anonymous, and committee_country_slots / conference_committees.groups are
  // not readable by it for a private conference. So a seat that inherits its
  // party's flag would render nothing on the floor. The organiser's client,
  // which has both in hand, does the resolving and stores the answer.
  //
  // `gs` is passed in rather than read from state so the same rule can be run
  // against the baseline groups to work out what a seat used to show.
  const resolvedSeatArt = (
    r: { name: string; logoUrl?: string | null; groupId?: string | null },
    gs: SlotGroup[],
  ): string | null => resolveSeatArt(r, gs, isCustom);

  // The topic draft and its error moved INTO the shared set-up surface
  // (CommitteeSetupFields, 23 Sep 2026): they are local to that control and
  // nothing else in this file read them.

  async function doCreate(supabase: ReturnType<typeof getAuthedClient>): Promise<boolean> {
    const delegationSize = doubleDelegation ? 2 : 1;
    const { data: created, error: err } = await supabase.from('conference_committees').insert({
      conference_id: conferenceId,
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      committee_type: committeeType,
      total_slots: roster.length,
      notification_email: null,
      logo_url: previewEmblem,
      delegation_size: delegationSize,
      groups: isCustom ? groups : [],
    }).select('id').single();
    if (err || !created) { setError(friendlyError(err, "Couldn't create the committee. Please try again.")); return false; }
    await supabase.from('committee_country_slots').insert(
      roster.map((r) => ({
        conference_committee_id: created.id,
        country_code: getCountryByName(r.name)?.code ?? r.name,
        country_name: r.name,
        delegation_size: delegationSize,
        importance: r.importance,
        is_observer: !!r.isObserver,
        logo_url: r.logoUrl ?? null,
        group_id: isCustom ? validGroupId(r.groupId) : null,
      }))
    );
    // A session that mints but cannot be seated is the exact failure this whole
    // file's session-client note is about: chairs would open an empty room and
    // nobody would be told. Surface it and stop, rather than closing on a lie.
    const mintProblems: string[] = [];
    await mintConferenceSession(
      supabase, created.id, name.trim(), topics[0] ?? '',
      roster.map((r) => ({ name: r.name, logoUrl: resolvedSeatArt(r, groups) })),
      roster.filter((r) => r.isObserver).map((r) => r.name),
      (msg) => { mintProblems.push(msg); },
    );
    if (mintProblems.length > 0) {
      // The committee itself exists, so saving again would duplicate it — the
      // only sane next action is Close, then delete and re-add the committee.
      setCreateHalted(true);
      setError(`"${name.trim()}" was created, but its live session was not set up: ${mintProblems.join('; ')}. Chairs would open an empty room. Close this dialog, then delete and re-add the committee.`);
      return false;
    }
    return true;
  }

  async function doEdit(supabase: ReturnType<typeof getAuthedClient>, forceRemoval: boolean, forceDoubleOff = false): Promise<'ok' | 'needs_confirm_removal' | 'needs_confirm_double_off' | 'fail'> {
    const ex = existing!;
    const baseNames = baselineRoster.map(r => r.name);
    const nextNames = roster.map(r => r.name);
    const baseTier = new Map(baselineRoster.map(r => [r.name, r.importance]));
    const baseObs = new Map(baselineRoster.map(r => [r.name, !!r.isObserver]));
    const baseLogo = new Map(baselineRoster.map(r => [r.name, r.logoUrl ?? null]));
    const baseGroup = new Map(baselineRoster.map(r => [r.name, r.groupId ?? null]));
    const added = roster.filter(r => !baseNames.includes(r.name));
    const removed = baseNames.filter(c => !nextNames.includes(c));
    // Rows kept across the edit whose importance tier the organiser changed.
    const retiered = roster.filter(r => baseTier.has(r.name) && baseTier.get(r.name) !== r.importance);
    // Rows kept across the edit whose observer flag the organiser toggled.
    const reobserved = roster.filter(r => baseObs.has(r.name) && baseObs.get(r.name) !== !!r.isObserver);
    // Rows kept across the edit whose flag or group changed. A group that was
    // removed in this edit reads as null here, so its seats are written back
    // ungrouped rather than pointing at an id that no longer exists.
    const rearted = roster.filter(r => baseLogo.has(r.name) && (
      baseLogo.get(r.name) !== (r.logoUrl ?? null) ||
      baseGroup.get(r.name) !== (isCustom ? validGroupId(r.groupId) : null)
    ));
    const turnedDoubleOn = initialDelegationSize === 1 && doubleDelegation;
    const turnedDoubleOff = initialDelegationSize === 2 && !doubleDelegation;

    if (removed.length > 0 && !forceRemoval) {
      const { data: allocs } = await supabase
        .from('conference_allocations')
        .select('id')
        .eq('conference_committee_id', ex.id)
        .in('country_name', removed);
      if ((allocs?.length ?? 0) > 0) {
        setPendingRemovalCount(allocs!.length);
        return 'needs_confirm_removal';
      }
    }

    // Turning double delegation OFF is destructive when second seats are
    // occupied — count and gate BEFORE any write, exactly like the removal
    // check above. Turning it ON only opens second seats, always safe.
    if (turnedDoubleOff && !forceDoubleOff) {
      const { data: seat2 } = await supabase
        .from('conference_allocations')
        .select('id')
        .eq('conference_committee_id', ex.id)
        .eq('seat', 2);
      if ((seat2?.length ?? 0) > 0) {
        setPendingDoubleOffCount(seat2!.length);
        return 'needs_confirm_double_off';
      }
    }

    // ── The live-session mirror ───────────────────────────────────────────────
    // Everything this function writes to `delegates` and `committees` needs the
    // session headers, not the organiser's token (see the block comment at the
    // top of this file). One lookup per save, reused by every mirror write below.
    //
    // Session failures are COLLECTED rather than aborted on: the conference-side
    // tables are the source of truth and are written in a fixed order, so bailing
    // out halfway would leave slots and allocations inconsistent with each other.
    // They are reported together at the end, and the save returns 'fail' so the
    // organiser sees it instead of the modal closing on a half-applied change.
    const sessErrors: string[] = [];
    let sessDb: ReturnType<typeof sessionClient> | null = null;
    let sessSettings: Record<string, unknown> = {};
    let sessTopic: string | null = null;
    if (ex.session_id) {
      const res = await sessionCommitteeClient(supabase, ex.session_id);
      if ('error' in res) sessErrors.push(res.error);
      else { sessDb = res.client; sessSettings = res.settings; sessTopic = res.topic; }
    }
    const noteSess = (what: string, message: string) => {
      console.error('[committee-editor]', message);
      sessErrors.push(what);
    };

    if (removed.length > 0) {
      await supabase.from('conference_allocations').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
      await supabase.from('committee_country_slots').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
      if (sessDb) {
        const { error: e } = await sessDb.from('delegates').delete().eq('committee_id', ex.session_id!).in('country', removed);
        if (e) noteSess(`${removed.length} removed ${removed.length === 1 ? 'seat is' : 'seats are'} still in the live room`, e.message);
      }
    }
    if (added.length > 0) {
      // Newly added countries always insert at the committee's current size.
      await supabase.from('committee_country_slots').insert(
        added.map((r) => ({
          conference_committee_id: ex.id,
          country_code: getCountryByName(r.name)?.code ?? r.name,
          country_name: r.name,
          delegation_size: doubleDelegation ? 2 : 1,
          importance: r.importance,
          is_observer: !!r.isObserver,
          logo_url: r.logoUrl ?? null,
          group_id: isCustom ? validGroupId(r.groupId) : null,
        }))
      );
      if (sessDb) {
        const { error: e } = await sessDb.from('delegates').insert(
          added.map((r) => ({
            committee_id: ex.session_id,
            country: r.name,
            status: 'absent',
            is_observer: !!r.isObserver,
            logo_url: resolvedSeatArt(r, groups),
          }))
        );
        if (e) noteSess(`${added.length} new ${added.length === 1 ? 'seat was' : 'seats were'} not added to the live room`, e.message);
      }
    }
    // Persist tier-only changes on existing slots (the allocator reads this column).
    for (const r of retiered) {
      await supabase.from('committee_country_slots')
        .update({ importance: r.importance })
        .eq('conference_committee_id', ex.id)
        .eq('country_name', r.name);
    }
    // Persist observer-flag changes on kept rows, on both the slot (edit-prefill
    // home) and the live session delegate (so the session treats it identically).
    for (const r of reobserved) {
      await supabase.from('committee_country_slots')
        .update({ is_observer: !!r.isObserver })
        .eq('conference_committee_id', ex.id)
        .eq('country_name', r.name);
      if (sessDb) {
        const { error: e } = await sessDb.from('delegates')
          .update({ is_observer: !!r.isObserver })
          .eq('committee_id', ex.session_id!)
          .eq('country', r.name);
        if (e) noteSess(`the observer flag for ${r.name} did not reach the live room`, e.message);
      }
    }

    // Persist flag / group changes on kept rows.
    for (const r of rearted) {
      await supabase.from('committee_country_slots')
        .update({ logo_url: r.logoUrl ?? null, group_id: isCustom ? validGroupId(r.groupId) : null })
        .eq('conference_committee_id', ex.id)
        .eq('country_name', r.name);
    }

    // …and mirror the RESOLVED art onto the live session's delegates, the same
    // way the observer flag above is mirrored onto both tables. Without this a
    // flag change never reaches a session that is already running.
    //
    // This compares resolved values rather than reusing `rearted`, because a
    // group's flag can change while no seat row changes at all: swapping one
    // party flag moves every seat in that party. Any kept seat whose resolved
    // art differs from what it resolved to at mount is rewritten, whether the
    // cause was its own flag, its group, or its group's flag.
    if (sessDb) {
      const baseRow = new Map(baselineRoster.map((r) => [r.name, r]));
      const movedArt = roster.filter((r) => {
        const before = baseRow.get(r.name);
        return before && resolvedSeatArt(before, baselineGroups) !== resolvedSeatArt(r, groups);
      });
      // Grouped by target url so a whole party is one write, not one per seat.
      const byArt = new Map<string | null, string[]>();
      for (const r of movedArt) {
        const url = resolvedSeatArt(r, groups);
        const names = byArt.get(url);
        if (names) names.push(r.name);
        else byArt.set(url, [r.name]);
      }
      for (const [url, names] of byArt) {
        const { error: e } = await sessDb.from('delegates')
          .update({ logo_url: url })
          .eq('committee_id', ex.session_id!)
          .in('country', names);
        if (e) noteSess(`the flag for ${names.length === 1 ? names[0] : `${names.length} seats`} did not reach the live room`, e.message);
      }
    }

    // Double delegation direction change, verified writes throughout.
    if (turnedDoubleOn) {
      const { data: cUpd, error: cErr } = await supabase.from('conference_committees')
        .update({ delegation_size: 2 })
        .eq('id', ex.id)
        .select('id');
      if (cErr || !cUpd || cUpd.length !== 1) {
        setDoubleDelegation(false);
        setError('Could not enable double delegation. Please try again.');
        return 'fail';
      }
      const { data: sUpd, error: sErr } = await supabase.from('committee_country_slots')
        .update({ delegation_size: 2 })
        .eq('conference_committee_id', ex.id)
        .select('id');
      if (sErr || !sUpd || sUpd.length !== nextNames.length) {
        setError('Double delegation was enabled, but some slots may not have updated. Please refresh and try again.');
        return 'fail';
      }
    } else if (turnedDoubleOff) {
      const { data: seat2Rows, error: fetchErr } = await supabase
        .from('conference_allocations')
        .select('id, application_id')
        .eq('conference_committee_id', ex.id)
        .eq('seat', 2);
      if (fetchErr) {
        setDoubleDelegation(true);
        setError('Could not turn off double delegation. Please try again.');
        return 'fail';
      }
      // Revert any linked application from 'assigned' back to 'accepted' before
      // the seat is removed, so it returns to the allocation pool.
      const appIds = (seat2Rows ?? []).map(r => r.application_id).filter((id): id is string => !!id);
      if (appIds.length > 0) {
        const { error: appErr } = await supabase.from('applications')
          .update({ status: 'accepted', assigned_committee_id: null, assigned_country_code: null, assigned_country_name: null, decided_by: session?.user.id ?? null, decided_at: new Date().toISOString() })
          .in('id', appIds)
          .eq('status', 'assigned');
        if (appErr) {
          setDoubleDelegation(true);
          setError('Could not revert affected applications. Please try again.');
          return 'fail';
        }
      }
      const { error: delErr } = await supabase.from('conference_allocations')
        .delete()
        .eq('conference_committee_id', ex.id)
        .eq('seat', 2)
        .select('id');
      if (delErr) {
        setDoubleDelegation(true);
        setError('Could not remove second-seat allocations. Please try again.');
        return 'fail';
      }
      const { data: cUpd, error: cErr } = await supabase.from('conference_committees')
        .update({ delegation_size: 1 })
        .eq('id', ex.id)
        .select('id');
      if (cErr || !cUpd || cUpd.length !== 1) {
        setDoubleDelegation(true);
        setError('Could not turn off double delegation. Please try again.');
        return 'fail';
      }
      const { data: sUpd, error: sErr } = await supabase.from('committee_country_slots')
        .update({ delegation_size: 1 })
        .eq('conference_committee_id', ex.id)
        .select('id');
      if (sErr || !sUpd || sUpd.length !== nextNames.length) {
        setError('Double delegation was turned off, but some slots may not have updated. Please refresh and try again.');
        return 'fail';
      }
    }

    // Checked: an RLS-rejected update resolves with error null and zero rows, and
    // this one used to report success regardless.
    const { data: ccUpd, error: ccErr } = await supabase.from('conference_committees').update({
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      total_slots: roster.length,
      logo_url: previewEmblem,
      groups: isCustom ? groups : [],
    }).eq('id', ex.id).select('id');
    if (ccErr || !ccUpd || ccUpd.length !== 1) {
      if (ccErr) console.error('[committee-editor]', ccErr);
      setError('Could not save the committee. Please try again.');
      return 'fail';
    }
    // `committees` UPDATE is gated on is_session_chair too — same client, same
    // reason. This was the third silently-dropped write in this function.
    //
    // The topic written is the one the CHAIR chose to debate, not blindly
    // topics[0]; resetting it to topic 1 on every organiser edit would silently
    // undo that choice. In order:
    //   1. the room's current topic text, if it is still one of the topics
    //      (survives a rename of the committee or a reorder of its topics);
    //   2. `committees.settings.agendaTopicIndex`, the chair's 0-based pick, if
    //      it still fits (covers the organiser rewording the chosen topic);
    //   3. topics[0].
    // Settings are only READ here; the chair page owns that key.
    //
    // `.select('id')` because an RLS-rejected update resolves with error null
    // and zero rows, which would otherwise pass for success.
    if (sessDb) {
      const rawIdx = sessSettings.agendaTopicIndex;
      const agendaIdx = typeof rawIdx === 'number' && Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < topics.length
        ? rawIdx
        : 0;
      const textIdx = sessTopic ? topics.indexOf(sessTopic) : -1;
      const resolvedIdx = textIdx >= 0 ? textIdx : agendaIdx;
      const sessionTopic = topics[resolvedIdx] ?? 'TBD';
      // When the chair has chosen, keep their stored index pointing at the topic the
      // room actually shows, or a later reword would follow a stale index to the wrong
      // topic. Merged into the blob read moments ago (chairJoinSuffix / headChair ride
      // along untouched). Never ADDED when absent: that would suppress the chair's picker.
      const chairChose = typeof rawIdx === 'number' && Number.isInteger(rawIdx);
      const sessPatch: Record<string, unknown> = { name: name.trim(), topic: sessionTopic };
      if (chairChose && rawIdx !== resolvedIdx) sessPatch.settings = { ...sessSettings, agendaTopicIndex: resolvedIdx };
      const { data: sessUpd, error: e } = await sessDb.from('committees')
        .update(sessPatch)
        .eq('id', ex.session_id!)
        .select('id');
      if (e) noteSess('the live session kept its old name and topic', e.message);
      else if (!sessUpd || sessUpd.length === 0) noteSess('the live session kept its old name and topic', 'the update was not accepted');
    }

    if (sessErrors.length > 0) {
      setError(`Committee saved, but the live session was not fully updated: ${sessErrors.join('; ')}. Chairs may see an out-of-date room.`);
      return 'fail';
    }
    return 'ok';
  }

  async function handleSave(forceRemoval = false, forceDoubleOff = false) {
    // The committee is already in the database; saving again would duplicate it.
    if (createHalted) return;
    if (!name.trim()) { setError('Committee name is required.'); return; }
    if (roster.length === 0) { setError(`Add at least one ${seatNoun}.`); return; }
    if (!session) return;
    setSaving(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    if (isEdit) {
      const res = await doEdit(supabase, forceRemoval, forceDoubleOff);
      setSaving(false);
      if (res === 'needs_confirm_removal' || res === 'needs_confirm_double_off') return;
      if (res !== 'ok') return;
    } else {
      const ok = await doCreate(supabase);
      setSaving(false);
      if (!ok) return;
    }
    onSaved();
    onClose();
  }

  // The primary action, /create's way round: the button says what is MISSING
  // rather than going dead, and a press on a blocked button takes the organiser
  // to the field that is missing instead of doing nothing.
  const missingName = !name.trim();
  const missingRoster = roster.length === 0;
  const saveState: 'ready' | 'blocked' | 'saving' =
    saving ? 'saving' : (createHalted || missingName || missingRoster) ? 'blocked' : 'ready';
  const saveSub = saving
    ? null
    : createHalted ? 'Close this dialog to carry on'
    : missingName && missingRoster ? `Needs a name and at least one ${seatNoun}`
    : missingName ? 'Needs a committee name'
    : missingRoster ? `Needs at least one ${seatNoun}`
    : null;
  const onPrimary = () => {
    if (saving || createHalted) return;
    if (missingName) { document.getElementById('ced-name')?.focus(); return; }
    void handleSave(false);
  };

  return (
    <>
    <ModalOverlay onClose={onClose}>
      {/* TWO COLUMNS, ONE BUDGET.
          The editor is a main panel plus a docked rail (chairs, then the
          selected roster). The pair is sized as a single `min()` box and the
          rail takes a clamped share of it, so the columns NEVER wrap: a
          wrapped rail would push the whole dialog past the viewport, and even
          though the backdrop scrolls now, a dialog that tall is miserable to
          work in.

          Widths at the three sizes this was checked at:
            1440 → box 980, rail 303, main 665
            1280 → box 980, rail 303, main 665
             900 → box 876, rail 271, main 593
          The main panel is deliberately narrower than the 920 it used to be:
          the room went to the roster list in the rail, which needs it far more
          than a column of single-line text fields did.

          BELOW 760px THERE IS NO ROOM FOR TWO COLUMNS. The rail's floor is
          250px and it does not shrink, so on a phone (390 → box 358) the main
          panel was being squeezed to ~96px of content: labels overlapped, the
          form scrolled sideways inside itself, and the editor was unusable.
          Under the breakpoint the pair therefore stacks — main first, rail
          beneath, both full width — and the SCROLL MOVES UP to this row, so the
          editor keeps its own scroller and its own edges instead of riding the
          backdrop's. The per-panel caps have to live in the same media query
          rather than inline, or their inline specificity would win and re-cap
          the stack.

          The caps are `dvh`, never `vh`: on iOS Safari `vh` is the LARGE
          viewport, i.e. the height the page would have with the address bar
          collapsed, so `88vh` was taller than the screen actually showed and
          the bottom of the editor sat under the toolbar. `--gv-modal-gutter`
          comes from the backdrop and already counts its padding and the safe
          area. */}
      <style>{`
        .gv-ced-row { flex-direction: column; max-height: calc(100dvh - var(--gv-modal-gutter, 88px)); overflow-y: auto; overscroll-behavior: contain; }
        .gv-ced-main { max-height: none; overflow-y: visible; }
        .gv-ced-rail { flex: 0 0 auto; max-height: none; }
        @media (min-width: 760px) {
          .gv-ced-row { flex-direction: row; max-height: none; overflow-y: visible; }
          .gv-ced-main { max-height: 88dvh; overflow-y: auto; }
          .gv-ced-rail { flex: 0 0 clamp(250px, 31%, 320px); max-height: 88dvh; }
        }
      `}</style>
      {/* 32px, not 24: ModalOverlay's backdrop is `px-4`, so a wider box
          overflows its flex line by the difference. */}
      <div className="gv-ced-row flex items-stretch gap-3" style={{ width: 'min(980px, calc(100vw - 32px))' }}>
      <div className="gv-ced-main rounded-2xl p-4" style={{ flex: '1 1 auto', minWidth: 0, backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
        {/* ── Header. The committee TYPE is an icon beside a plain word, never a
            status pill (CLAUDE.md §8). The type picker does not re-show in edit
            mode, so this is how an organiser tells what kind of room is open. */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: '#1C1410', margin: 0 }}>
              {isEdit ? 'Edit committee' : 'New committee'}
            </p>
            <span
              className="flex flex-shrink-0 items-center gap-1.5"
              title="Committee type"
              style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: typeAccent }}
            >
              <CommitteeTypeGlyph type={effectiveType as CommitteeType} />
              {COMMITTEE_TYPE_LABEL[effectiveType] ?? effectiveType}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 hover:bg-[#1B3828]/[0.07] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
            style={{ color: '#6E5F4E' }}
          >
            <X size={17} />
          </button>
        </div>

        {/* The live identity — the /create preview: the emblem in a white disc,
            the acronym big with the full name small beneath, then the topic.
            The organiser sees what the chair masthead and every card will show
            (committeeDisplayName) before anything is written. */}
        <CommitteeIdentityPreview
          src={previewEmblem}
          primary={previewPrimary}
          secondary={previewSecondary}
          placeholder="Untitled committee"
          topic={topics[0] ?? ''}
          topicLabel="Topic:"
          topicEmpty="No topic yet"
          tone={medallionTone(effectiveType)}
          monogramText={previewAcronym || name}
        />

        {/* Steps 1 and 2 are the SHARED set-up surface — the same component the
            creation wizard's step 7 renders, so the two can never drift (owner,
            23 Sep 2026: "it should always match"). Only the shell differs: here
            the selected roster is docked in the rail below, so `selectedInline`
            is off. Chairs stay out of it and keep their own rail card, because
            they need a committee id the wizard does not have yet. */}
        <CommitteeSetupFields
          draft={draft}
          onChange={patchDraft}
          committeeType={effectiveType as CommitteeType}
          isEdit={isEdit}
          nameInputId="ced-name"
          onUploadEmblem={() => document.getElementById('committee-emblem-upload')?.click()}
          emblemUploading={logoUploading}
        />
        <input
          id="committee-emblem-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) { setError('Emblem must be under 5MB.'); return; }
            setError('');
            setEmblemCropFile(f);
          }}
        />

        {error && <p role="alert" className="mt-3" style={{ color: '#8B2020', fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.5 }}>{error}</p>}
        <div className="mt-4 grid gap-2.5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)' }}>
          <SetupGhostButton label="Cancel" onClick={onClose} />
          <SetupPrimaryButton
            label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add committee'}
            sub={saveSub}
            state={saveState}
            onClick={onPrimary}
          />
        </div>
      </div>
      {/* THE DOCKED RAIL — bookmarks tabbed onto the panel, floating free of
          its bubble. Chairs on top (edit mode only: a real committee id is
          needed to seat or invite anyone), the selected roster beneath, which
          is where the extra width taken off the main panel went.

          The rail owns the 85vh budget for the pair: the chairs card is capped
          and does not shrink, the roster panel takes the rest and scrolls
          inside itself, so a 190-country roster can never push the dialog past
          the fold. */}
      <div
        className="gv-ced-rail flex flex-col gap-3"
        style={{ minHeight: 0 }}
      >
        {isEdit && existing && (
          <ChairsDock conferenceId={conferenceId} committeeId={existing.id} committeeName={name.trim() || existing.name} />
        )}
        <ConferenceRosterSelected
          mode={isCharacterRoster ? 'character' : 'country'}
          value={roster}
          onChange={setRoster}
          committeeType={effectiveType}
          groups={groups}
          onGroupsChange={isCustom ? setGroups : undefined}
          onUploadLogo={handleFlagUpload}
          className="rounded-2xl"
          style={{
            flex: '1 1 auto', minHeight: 220, padding: '14px 14px 12px',
            backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
            boxShadow: '0 12px 32px rgba(27,56,40,0.16)',
          }}
        />
      </div>
      </div>
    </ModalOverlay>
    {pendingRemovalCount !== null && (
      <ModalOverlay onClose={() => setPendingRemovalCount(null)}>
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380 }}>
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
            {pendingRemovalCount} of the {seatNounPlural} you removed {pendingRemovalCount === 1 ? 'has' : 'have'} an allocated delegate. Removing {pendingRemovalCount === 1 ? 'it' : 'them'} will return {pendingRemovalCount === 1 ? 'that delegate' : 'those delegates'} to the allocation pool. Proceed?
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPendingRemovalCount(null)} className="gv-lift flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
            <button onClick={() => { setPendingRemovalCount(null); handleSave(true); }} className="gv-lift flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>PROCEED</button>
          </div>
        </div>
      </ModalOverlay>
    )}
    {pendingDoubleOffCount !== null && (
      <ModalOverlay onClose={() => { setPendingDoubleOffCount(null); setDoubleDelegation(true); }}>
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380 }}>
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
            This action will affect the allocations of {pendingDoubleOffCount} delegates. It is irreversible. Are you sure you wish to continue?
          </p>
          <div className="flex gap-3">
            <button onClick={() => { setPendingDoubleOffCount(null); setDoubleDelegation(true); }} className="gv-lift flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
            <button onClick={() => { setPendingDoubleOffCount(null); handleSave(true, true); }} className="gv-lift flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>PROCEED</button>
          </div>
        </div>
      </ModalOverlay>
    )}
    {/* Drag-to-fit crop step, flattens the chosen framing into a square
        transparent PNG, then hands off to the existing upload path — the same
        two-step the conference logo uses. Portal'd for the same reason
        ModalOverlay is: the crop tool is `position: fixed`, and the manage
        layout's content wrapper is a stacking context that would trap it under
        the header. It mounts after the editor's own portal, so at equal z-index
        it paints above the editor rather than behind it. */}
    {emblemCropFile && (
      <Portal>
        <LogoCropModal
          file={emblemCropFile}
          /* Committee emblems ship transparent and render `LogoDisc bare`
             everywhere they appear, so the crop preview must not sit them on a
             white disc — the ring of disc showing around the artwork reads as a
             white outline baked into the file. Conference logos keep the disc:
             they genuinely render on one. */
          bare
          onCancel={() => setEmblemCropFile(null)}
          onSave={(blob) => {
            setEmblemCropFile(null);
            handleEmblemUpload(new File([blob], 'emblem.png', { type: 'image/png' }));
          }}
        />
      </Portal>
    )}
    </>
  );
}

// ── Committee-type picker card (neumorphic) ───────────────────────────────────
// One extruded ivory card per type. Selected = forest ring + gold-tinted seat +
// gradient icon disc lit; unselected = calm surface + soft-tinted icon seat.
// Hover lifts the card. Used only in the create flow's type chooser.

const TYPE_OPTIONS: {
  type: CommitteeType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  gradient: NeuGradient;
}[] = [
  { type: 'general-assembly', label: 'General Assembly', desc: 'Large committees, country delegates, formal debate.', icon: Landmark, gradient: NEU_GRADIENTS.forest },
  { type: 'specialised', label: 'Specialised', desc: 'Mid-size expert bodies (ECOSOC, HRC, legal).', icon: Scale, gradient: NEU_GRADIENTS.sage },
  { type: 'crisis', label: 'Crisis', desc: 'Fast-paced, character roles, live crises.', icon: Zap, gradient: NEU_GRADIENTS.amber },
  { type: 'custom', label: 'Custom', desc: 'Parliaments, party groups, any format with its own seats and flags.', icon: Users2, gradient: NEU_GRADIENTS.gold },
];

function TypeCard({ opt, onSelect }: { opt: (typeof TYPE_OPTIONS)[number]; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  const { label, desc, icon: Icon, gradient } = opt;
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3.5 text-left focus:outline-none w-full"
      style={{
        padding: '14px 16px',
        borderRadius: 18,
        border: `1.5px solid ${hovered ? NEU.forest : 'transparent'}`,
        backgroundColor: NEU.surface,
        boxShadow: hovered ? NEU.outHover : NEU.out,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}, border-color 200ms ${EASE}`,
        cursor: 'pointer',
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 44, height: 44, borderRadius: 14,
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          boxShadow: `0 4px 10px ${gradient[0]}44, ${NEU.outSm}`,
        }}
      >
        {/* Same rule as neu.tsx: forest ink on the gold gradient, white elsewhere. */}
        <Icon size={21} strokeWidth={2.2} style={{ color: gradient === NEU_GRADIENTS.gold ? NEU.forest : '#FFFFFF' }} />
      </span>
      <span className="flex flex-col min-w-0">
        <span style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: NEU.ink, letterSpacing: '0.01em' }}>{label}</span>
        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 500, color: NEU.muted, lineHeight: 1.35, marginTop: 2 }}>{desc}</span>
      </span>
    </button>
  );
}

// ── CommitteeEditorModal, public API ─────────────────────────────────────────
// committee = null → create flow (opens with the GA / Specialised / Crisis
// type picker); committee set → edit flow (self-loads the committee's slots).

export function CommitteeEditorModal({ conference, committee, onSaved, onClose }: {
  conference: { id: string };
  committee: EditableCommittee | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!committee;
  const [pendingType, setPendingType] = useState<CommitteeType | null>(
    committee ? (committee.committee_type as CommitteeType) : null
  );
  // Edit flow: null until the committee's current slots are fetched.
  const [initialRoster, setInitialRoster] = useState<RosterEntry[] | null>(committee ? null : []);
  // Edit flow: null until the committee's current delegation_size is fetched.
  const [initialDelegationSize, setInitialDelegationSize] = useState<number | null>(committee ? null : 1);
  // Edit flow: seat groups off the committee row, fetched with the slots.
  const [initialGroups, setInitialGroups] = useState<SlotGroup[]>(committee ? parseGroups(committee.groups) : []);

  useEffect(() => {
    if (!committee || !session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const [{ data: slots }, { data: committeeRow }] = await Promise.all([
        supabase
          .from('committee_country_slots')
          .select('country_name, importance, is_observer, logo_url, group_id')
          .eq('conference_committee_id', committee.id),
        supabase
          .from('conference_committees')
          .select('delegation_size, groups')
          .eq('id', committee.id)
          .single(),
      ]);
      if (!cancelled) {
        setInitialRoster(
          (slots ?? []).map((r: { country_name: string; importance: string | null; is_observer: boolean | null; logo_url: string | null; group_id: string | null }) => ({
            name: r.country_name,
            importance: (r.importance as RosterEntry['importance']) ?? 'standard',
            isObserver: r.is_observer ?? false,
            logoUrl: r.logo_url ?? null,
            groupId: r.group_id ?? null,
          }))
        );
        setInitialDelegationSize((committeeRow?.delegation_size as number | null) ?? 1);
        setInitialGroups(parseGroups(committeeRow?.groups));
      }
    })();
    return () => { cancelled = true; };
  }, [committee, session]);

  // Create flow, choose committee type first (GA / Specialised / Crisis / Custom).
  if (!isEdit && !pendingType) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-7 flex flex-col gap-5" style={{ backgroundColor: NEU.base, border: '1px solid #DDD4C0', width: 400 }}>
          <div className="flex items-center justify-between">
            <p className="text-base font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>Choose committee type</p>
            <button onClick={onClose} className="focus:outline-none" style={{ color: NEU.muted }}><X size={18} /></button>
          </div>
          <div className="flex flex-col gap-3.5 w-full">
            {TYPE_OPTIONS.map((opt) => (
              <TypeCard key={opt.type} opt={opt} onSelect={() => setPendingType(opt.type)} />
            ))}
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // Edit flow, brief spinner while the current slots load.
  if (isEdit && (initialRoster === null || initialDelegationSize === null)) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-10 flex items-center justify-center" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 200 }}>
          <Loader size={48} />
        </div>
      </ModalOverlay>
    );
  }

  return (
    <CommitteeEditor
      conferenceId={conference.id}
      committeeType={pendingType ?? 'general-assembly'}
      existing={committee}
      initialRoster={initialRoster ?? []}
      initialDelegationSize={initialDelegationSize ?? 1}
      initialGroups={initialGroups}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
