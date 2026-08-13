// ── Delegate coaching tips, derived from the delegate's OWN scoring ledger ─────
//
// "Make the delegate tip keys based on what they don't have enough scores in."
//
// Every tip is chosen from the existing `delegate_tip_*` corpus by comparing this
// delegation's per-source points against the rest of the room, using the committee's
// real scoring config. Nothing here re-implements scoring: the numbers come out of
// `computeSourceTotals` → `computeLedger` → `getScoringConfig`, which are pure
// functions of the committee row (AGENTS.md rule 14 — the delegate page must never
// touch the localStorage settings store).
//
// THE FOUR TRAPS THIS FILE EXISTS TO AVOID
//
//  1. Disabled sources. A disabled source produces no ledger rows for anyone, so it
//     also produces no candidate here — we iterate `cfg.sources.filter(s => s.enabled)`
//     and never hardcode the nine built-ins. A chair who turns off Right of Reply is
//     never contradicted by a tip telling delegates to use one.
//
//  2. Impossible-right-now advice. Every source carries a phase/feature gate
//     (`sourceIsActionable`). Documents and motions are only suggested while the floor
//     is open; "approach delegations during an unmoderated caucus" is only suggested
//     while one is actually running; a Tour de Table is only suggested when that motion
//     type is enabled.
//
//  3. Cold start. At minute zero everyone has zero, so "you are behind on everything"
//     is true and useless. Two defences: the room must be WARM (past roll call, with a
//     handful of scoring events already banked) before any gap ranking runs at all, and
//     the benchmark is the peer MEAN — in a silent room the mean is 0, so the gap is 0
//     and nothing fires. A cold room falls through to the onboarding tips instead.
//
//  4. Small committees. "Below average" in a room of five is noise, so the relative
//     trigger additionally requires at least TWO other delegations to have actually
//     earned from that source — proof the room does this thing — and a gap of at least
//     one whole unit of the source (`s.value`). Three foundational sources
//     (GSL speech, caucus speech, document sponsorship) keep an absolute floor so a
//     delegation that has done literally none of them is still told so.
//
// RANKING. Candidates are ranked by the gap measured IN POINTS. Because the ledger is
// already denominated in this committee's own configured values, a source worth 10
// produces ten-point gaps and one worth 1 produces one-point gaps — the "weight by what
// it is worth HERE" requirement falls out for free, with no second weighting factor.
// Output is capped at three.

import type { Committee, SessionPhase } from './types';
import type { TranslationKey } from './translations';
import { computeSourceTotals, getScoringConfig, parseLedgerEvents } from './scoring';
import { docName } from './docNames';
import { motionNames } from './committeeFlags';

export interface DelegateTip {
  key: TranslationKey;
  text: string;
}

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const MAX_TIPS = 3;

// The floor is open and a delegate can actually do something about their score.
const LIVE_PHASES: SessionPhase[] = ['speakers-list', 'moderated-caucus', 'unmoderated-caucus'];

// Sources where having none is a gap no matter what the room is doing.
const FOUNDATIONAL = new Set(['gslSpeech', 'caucusSpeech', 'wpSponsor']);

// Fixed tie-break order — earlier = suggested first when two gaps are equal.
const SOURCE_ORDER = [
  'gslSpeech', 'caucusSpeech', 'speakingTimePer10s', 'wpSponsor',
  'drSponsor', 'drPassed', 'motionRaised', 'rightOfReply',
];

interface Candidate { id: string; weight: number; value: number }

// When zero from a source is a gap on its own, without needing the room as evidence.
function absoluteFloorApplies(id: string, builtin: boolean, peersActive: number, myDrs: number): boolean {
  if (FOUNDATIONAL.has(id)) return true;
  // A draft this delegation sponsored that has not carried yet.
  if (id === 'drPassed') return myDrs > 0;
  // Chair-added source that at least one other delegation is already earning from.
  return !builtin && peersActive >= 1;
}

export function selectDelegateTips(
  committee: Committee,
  country: string,
  language: string,
  t: Translate,
): DelegateTip[] {
  const phase = committee.phase;

  // A closed committee and a live vote are both "nothing you can do right now".
  if (phase === 'adjourned' || phase === 'voting') return [];

  const cfg = getScoringConfig(committee);
  const settings = (committee.dbSettings ?? {}) as Record<string, unknown>;
  const enabledFlag = (key: string) => settings[key] !== false; // unset ⇒ enabled
  const moderatedEnabled = enabledFlag('motionModeratedCaucus');
  const tourEnabled = enabledFlag('motionTourDeTable');
  const hideScores = cfg.hideScoresFromDelegates === true;

  const mn = motionNames(committee, language);
  // Which caucus a delegate can actually ask for. Never name a motion type the chair
  // has switched off — that is the "impossible right now" trap in its purest form.
  const caucusLabel = moderatedEnabled ? mn.moderated : tourEnabled ? mn.tour : mn.unmoderated;
  const wp = docName(committee, 'working-paper', 'singular', t('documents_working_paper'));
  const wps = docName(committee, 'working-paper', 'plural', t('documents_working_papers_tab'));
  const dr = docName(committee, 'draft-resolution', 'singular', t('documents_draft_resolution'));
  const drs = docName(committee, 'draft-resolution', 'plural', t('documents_draft_resolutions_tab'));

  // ── The delegation's own picture ───────────────────────────────────────────
  const me = committee.delegates.find((d) => d.country === country);
  const myStatus = me?.status ?? 'absent';
  const nonAbsent = committee.delegates.filter((d) => d.status !== 'absent');
  const peers = nonAbsent.filter((d) => d.country !== country);

  const speeches = parseLedgerEvents(committee).filter((e) => (e.type ?? 'speech') === 'speech');
  const mySpeeches = speeches.filter((e) => e.country === country);
  const myGslCount = mySpeeches.filter((e) => e.context === 'speakers-list').length;
  const mySeconds = mySpeeches.reduce((s, e) => s + (e.seconds ?? 0), 0);
  const roomSpeeches = speeches.length;

  const allDocs = committee.documents ?? [];
  const myDocs = allDocs.filter((d) => d.sponsors.includes(country));
  const myWpDocs = myDocs.filter((d) => d.type === 'working-paper');
  const myWps = myWpDocs.length;
  const myDrs = myDocs.filter((d) => d.type === 'draft-resolution').length;
  // Widest bloc behind any of my working papers — a one-name paper is a different
  // problem from three competing papers.
  const myWidestWp = myWpDocs.reduce((n, d) => Math.max(n, d.sponsors.length), 0);
  const roomWps = allDocs.filter((d) => d.type === 'working-paper').length;
  const roomDrs = allDocs.filter((d) => d.type === 'draft-resolution').length;

  const onGsl = committee.speakersList.some((s) => s.country === country);
  const isCurrentSpeaker = committee.currentSpeaker?.country === country;

  // ── Cold start ────────────────────────────────────────────────────────────
  // The room has to have banked a few scoring events before "you are behind" means
  // anything. Attendance is deliberately excluded — everyone gets it for turning up.
  const roomActivity = speeches.length + allDocs.length;
  const roomWarm =
    LIVE_PHASES.includes(phase) &&
    roomActivity >= Math.max(3, Math.ceil(nonAbsent.length / 4));

  if (!roomWarm) {
    return onboardingTips({ t, cfg, myStatus, mySpeeches: mySpeeches.length, roomSpeeches, onGsl, isCurrentSpeaker, phase, docCount: allDocs.length });
  }

  // ── Gap analysis, one candidate per enabled + actionable source ────────────
  const totalsByCountry: Record<string, Record<string, number>> = {};
  for (const d of nonAbsent) totalsByCountry[d.country] = computeSourceTotals(committee, d.country);
  const mine = totalsByCountry[country] ?? computeSourceTotals(committee, country);

  const sourceIsActionable = (id: string): boolean => {
    switch (id) {
      // Handled separately below — attendance is a status, not a gap.
      case 'attendance': return false;
      case 'gslSpeech': return true;
      case 'caucusSpeech':
        return phase === 'moderated-caucus' || phase === 'unmoderated-caucus' || moderatedEnabled || tourEnabled;
      // Nothing to say about speech length before there is a speech.
      case 'speakingTimePer10s': return mySpeeches.length > 0;
      case 'motionRaised': return moderatedEnabled || tourEnabled;
      case 'rightOfReply': return true;
      case 'wpSponsor': return true;
      case 'drSponsor': return true;
      // "Get it passed" only means something once this delegation has one.
      case 'drPassed': return myDrs > 0;
      // Chair-added source — only surfaced when the delegate can see category names.
      default: return !hideScores;
    }
  };

  const candidates: Candidate[] = [];
  for (const s of cfg.sources) {
    if (!s.enabled || s.value <= 0) continue;
    if (!sourceIsActionable(s.id)) continue;

    const own = mine[s.id] ?? 0;
    const peerVals = peers.map((d) => totalsByCountry[d.country]?.[s.id] ?? 0);
    const peersActive = peerVals.filter((v) => v > 0).length;
    const benchmark = peerVals.length ? peerVals.reduce((a, b) => a + b, 0) / peerVals.length : 0;
    const gap = Math.max(0, benchmark - own);

    if (peersActive >= 2 && gap >= s.value / 2) {
      // Relative: at least two other delegations demonstrably do this, and the
      // shortfall against the peer mean is worth at least half an instance of it.
      // Half rather than a whole instance because the benchmark is a MEAN — with
      // four of five peers holding a draft resolution the mean already sits below
      // one, and that delegation is genuinely behind.
      candidates.push({ id: s.id, weight: gap, value: s.value });
    } else if (own === 0 && absoluteFloorApplies(s.id, s.builtin, peersActive, myDrs)) {
      // Absolute floor: none at all of something foundational, of a chair-added source
      // another delegation already earns from, or a sponsored draft that never passed.
      candidates.push({ id: s.id, weight: s.value, value: s.value });
    }
  }

  candidates.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.value !== a.value) return b.value - a.value;
    const ia = SOURCE_ORDER.indexOf(a.id), ib = SOURCE_ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const out: DelegateTip[] = [];
  const push = (key: TranslationKey, vars?: Record<string, string | number>) => {
    if (out.length >= MAX_TIPS || out.some((x) => x.key === key)) return;
    out.push({ key, text: t(key, vars) });
  };

  // An absent delegation earns nothing at all — that outranks every gap.
  if (myStatus === 'absent' && cfg.sources.some((s) => s.id === 'attendance' && s.enabled)) {
    push('delegate_tip_mark_present');
  }

  for (const c of candidates) {
    if (out.length >= MAX_TIPS) break;
    const own = mine[c.id] ?? 0;
    switch (c.id) {
      case 'gslSpeech':
        if (own === 0 && !onGsl && !isCurrentSpeaker) push('delegate_tip_gsl_request');
        else if (own === 0) push('delegate_tip_gsl_not_spoken');
        else if (roomDrs > 0) push('delegate_tip_synthesise', { dr });
        else push('delegate_tip_gsl_strategic', { dr });
        break;
      case 'caucusSpeech':
        if (own === 0 && myGslCount > 0) push('delegate_tip_caucus_sub', { mod: caucusLabel });
        else if (own === 0) push('delegate_tip_no_caucus', { mod: caucusLabel });
        else if (roomDrs > 0) push('delegate_tip_operative_clauses', { drs });
        else if (mySpeeches.length <= 2) push('delegate_tip_substance');
        else push('delegate_tip_rebut');
        break;
      case 'speakingTimePer10s':
        if (mySeconds / Math.max(1, mySpeeches.length) < 45) push('delegate_tip_speaking_time');
        else push('delegate_tip_full_time');
        break;
      case 'motionRaised':
        // Never name a motion type the chair disabled — `sourceIsActionable`
        // guarantees at least one of moderated / tour is available here.
        if (own === 0 && moderatedEnabled) push('delegate_tip_raise_motion', { mod: mn.moderated });
        else if (own === 0) push('delegate_tip_tdt', { tour: mn.tour });
        else if (roomDrs > 0) push('delegate_tip_closure', { end: mn.endDebate });
        else if (tourEnabled && phase === 'speakers-list') push('delegate_tip_tdt', { tour: mn.tour });
        else if (moderatedEnabled) push('delegate_tip_propose_caucus', { mod: mn.moderated });
        else push('delegate_tip_tdt', { tour: mn.tour });
        break;
      case 'rightOfReply':
        push('delegate_tip_right_of_reply');
        break;
      case 'wpSponsor':
        if (myWps === 0 && phase === 'unmoderated-caucus') push('delegate_tip_unmod_wp', { unmod: mn.unmoderated, wps });
        else if (myWps === 0 && myDrs === 0) push('delegate_tip_no_docs', { wp });
        else if (myWps === 0) push('delegate_tip_cosponsor');
        // A paper with barely any names on it needs a bloc before it needs a merger.
        else if (myWidestWp < 3) push('delegate_tip_wp_cosponsors', { wp });
        else if (roomWps >= 2) push('delegate_tip_consolidate', { wps });
        else push('delegate_tip_wp_cosponsors', { wp });
        break;
      case 'drSponsor':
        if (phase === 'unmoderated-caucus') push('delegate_tip_coordinate_bloc', { unmod: mn.unmoderated, dr });
        else if (myWps > 0 && myDrs === 0) push('delegate_tip_have_wp', { wp, dr });
        else push('delegate_tip_lead_dr', { dr });
        break;
      case 'drPassed':
        if (roomDrs >= 2) push('delegate_tip_passed_dr', { dr });
        else push('delegate_tip_legacy', { dr });
        break;
      default: {
        const src = cfg.sources.find((s) => s.id === c.id);
        if (src) push('delegate_tip_custom_source', { source: src.name });
        break;
      }
    }
  }

  // Contributing across every category the chairs score — say so rather than
  // inventing a weakness.
  if (out.length === 0) push('delegate_tip_all_round');

  return out;
}

// ── Cold-start / pre-session set ──────────────────────────────────────────────
// Non-score guidance for a room that has not produced anything to compare yet.
// Each entry is conditioned on something real so none of them is dead copy.
function onboardingTips(ctx: {
  t: Translate;
  cfg: ReturnType<typeof getScoringConfig>;
  myStatus: string;
  mySpeeches: number;
  roomSpeeches: number;
  onGsl: boolean;
  isCurrentSpeaker: boolean;
  phase: SessionPhase;
  docCount: number;
}): DelegateTip[] {
  const { t, cfg, myStatus, mySpeeches, roomSpeeches, onGsl, isCurrentSpeaker, phase, docCount } = ctx;
  const out: DelegateTip[] = [];
  const push = (key: TranslationKey) => {
    if (out.length < MAX_TIPS && !out.some((x) => x.key === key)) out.push({ key, text: t(key) });
  };

  const attendanceOn = cfg.sources.some((s) => s.id === 'attendance' && s.enabled);
  const gslOn = cfg.sources.some((s) => s.id === 'gslSpeech' && s.enabled);

  if (myStatus === 'absent' && attendanceOn) push('delegate_tip_mark_present');
  // About to speak for the first time — how to address the room.
  if (mySpeeches === 0 && (onGsl || isCurrentSpeaker)) push('delegate_tip_address');
  // Not queued and never spoken — get on the list.
  if (mySpeeches === 0 && gslOn && !onGsl && !isCurrentSpeaker) push('delegate_tip_gsl_request');
  // Nobody has spoken yet — the opening statement is still up for grabs.
  if (mySpeeches === 0 && roomSpeeches === 0) push('delegate_tip_opening');
  // Others have spoken and you have not — read the room first.
  if (mySpeeches === 0 && roomSpeeches > 0) push('delegate_tip_listen');
  // Bloc-building time: nothing has been drafted yet.
  if (docCount === 0 && (phase === 'pre-session' || phase === 'roll-call' || phase === 'unmoderated-caucus')) {
    push('delegate_tip_bloc');
  }

  return out;
}
