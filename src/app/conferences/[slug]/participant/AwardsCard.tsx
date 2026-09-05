'use client';

// The chair's awards slate for one committee, mounted per committee inside
// ChairCommitteeBlock. Three parts, top to bottom: the slate's state and the
// deadline; the quantitative record from the session scoreboard as EVIDENCE
// (never the verdict); and the slate editor itself, one row per configured
// slot, saving every change straight away. Nothing here is visible to
// delegates: the RLS on conference_awards only exposes published rows.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Send, Undo2, Lock, Megaphone, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { FlagImg } from '@/components/FlagImg';
import Loader from '@/components/Loader';
import { getCountryByName } from '@/lib/countries';
import {
  getAwardsConfig, committeeSlots, chairDeadline, slateState, chairCanEdit, slateCompleteness,
  suggestSlate, rankByHeadline,
  type AwardTypeConfig, type AwardTier, type ConferenceAwardRow, type PaperEvidence, type SlateState, type SlateStamps,
} from '@/lib/awards';
import {
  loadCommitteeAwards, createNomination, updateNomination, deleteNomination, submitSlate, withdrawSlate,
} from '@/lib/awardsService';
import { loadConferenceScoreboard, formatSpeakingTime, type ScoreboardDelegateRow } from '@/lib/conferenceScoreboard';
import { SectionCard, OUTFIT } from './shared';

// ── Props ────────────────────────────────────────────────────────────────────

export interface AwardsCardCommittee {
  id: string;
  name: string;
  session_id: string | null;
  awards_submitted_at: string | null;
  awards_approved_at: string | null;
  awards_return_note: string | null;
}

export interface AwardsCardConference {
  awards_config: unknown;
  awards_published_at: string | null;
  end_date: string | null;
}

export interface AwardsCardAllocation {
  id: string;
  country_code: string;
  country_name: string;
  user_id: string | null;
  display_name: string | null;
  invited_name: string | null;
}

// ── Small helpers ────────────────────────────────────────────────────────────

const TIER_DOT: Record<AwardTier, string> = {
  gold: 'linear-gradient(135deg, #EED98A, #B6871F)',
  silver: 'linear-gradient(135deg, #D6DCE4, #8C98A8)',
  bronze: 'linear-gradient(135deg, #CE9668, #96603A)',
  special: 'linear-gradient(135deg, #3F7A52, #1B3828)',
};

const PAPER_STYLES: Record<string, { bg: string; color: string }> = {
  submitted: { bg: 'rgba(238,217,138,0.2)', color: '#B8844A' },
  reviewed: { bg: 'rgba(154,138,120,0.15)', color: '#6E5F4E' },
  approved: { bg: 'rgba(61,122,82,0.12)', color: '#3D7A52' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDeadline(d: Date): string {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function countdown(deadline: Date, now: number): { label: string; past: boolean } {
  const ms = deadline.getTime() - now;
  if (ms <= 0) return { label: 'past the deadline', past: true };
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days >= 1) return { label: `${days} day${days === 1 ? '' : 's'} ${remHours} hour${remHours === 1 ? '' : 's'} left`, past: false };
  if (hours >= 1) return { label: `${hours} hour${hours === 1 ? '' : 's'} left`, past: false };
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return { label: `${mins} minute${mins === 1 ? '' : 's'} left`, past: false };
}

/** One option per delegation: a double delegation collapses its two seats into one entry. */
interface DelegationOption {
  code: string;
  name: string;
  recipientName: string | null;
  userId: string | null;
  allocationId: string | null;
}

function buildDelegations(allocations: AwardsCardAllocation[]): DelegationOption[] {
  const byCode = new Map<string, DelegationOption & { names: string[] }>();
  for (const a of allocations) {
    const name = a.display_name ?? a.invited_name ?? null;
    const cur = byCode.get(a.country_code);
    if (!cur) {
      byCode.set(a.country_code, {
        code: a.country_code, name: a.country_name, recipientName: null,
        userId: a.user_id, allocationId: a.id, names: name ? [name] : [],
      });
    } else {
      if (name) cur.names.push(name);
      if (!cur.userId && a.user_id) { cur.userId = a.user_id; cur.allocationId = a.id; }
    }
  }
  return [...byCode.values()]
    .map(({ names, ...d }) => ({ ...d, recipientName: names.length ? names.join(' & ') : null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const STATE_COPY: Record<SlateState, string> = {
  off: '',
  open: "Decide your committee's awards.",
  returned: 'The secretariat returned this slate.',
  submitted: 'Submitted to the secretariat. You can withdraw until it is approved.',
  approved: 'Approved by the secretariat. Locked.',
  published: 'Announced.',
};

const GUIDE_DIMENSIONS: { name: string; text: string }[] = [
  { name: 'Knowledge', text: 'research depth and fidelity to country policy' },
  { name: 'Diplomacy', text: 'bloc-building, compromise, bringing others in' },
  { name: 'Procedure', text: 'motions, points and the rules used to move the room' },
  { name: 'Contribution', text: 'drafting, amendments, leadership on paper' },
  { name: 'Consistency', text: 'the whole conference, not one speech' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function AwardsCard({ conferenceId, conferenceSlug, committee, conference, allocations, papers }: {
  conferenceId: string;
  conferenceSlug: string;
  committee: AwardsCardCommittee;
  conference: AwardsCardConference;
  allocations: AwardsCardAllocation[];
  papers: PaperEvidence[];
}) {
  const { user, session } = useAuth();
  const config = useMemo(() => getAwardsConfig(conference.awards_config), [conference.awards_config]);
  const slots = useMemo(() => committeeSlots(config), [config]);
  const delegations = useMemo(() => buildDelegations(allocations), [allocations]);

  // Slate stamps: the committee row's values, overridden locally after a
  // submit / withdraw so the card flips state without a refetch. The
  // override is cleared whenever the parent hands us fresh stamps, so a
  // secretariat return or approval that arrives on a refetch wins again.
  const baseStamps: SlateStamps = {
    awards_submitted_at: committee.awards_submitted_at,
    awards_approved_at: committee.awards_approved_at,
    awards_return_note: committee.awards_return_note,
  };
  const [stampOverride, setStampOverride] = useState<{ base: SlateStamps; patch: Partial<SlateStamps> } | null>(null);
  const overrideLive = !!stampOverride
    && stampOverride.base.awards_submitted_at === baseStamps.awards_submitted_at
    && stampOverride.base.awards_approved_at === baseStamps.awards_approved_at
    && stampOverride.base.awards_return_note === baseStamps.awards_return_note;
  const stamps: SlateStamps = { ...baseStamps, ...(overrideLive ? stampOverride.patch : {}) };

  const state = slateState(stamps, conference.awards_published_at, config);
  const editable = chairCanEdit(state);

  // Nominations
  const [rows, setRows] = useState<ConferenceAwardRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [error, setError] = useState('');
  const [suggestedIds, setSuggestedIds] = useState<Set<string>>(new Set());
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set());
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Evidence: null until the scoreboard answers. A committee with no
  // session has no record at all, so it is never "loading".
  const [evidence, setEvidence] = useState<ScoreboardDelegateRow[] | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const hasSession = !!committee.session_id;
  const evidenceLoading = hasSession && evidence === null;

  // Guidance, collapsed state remembered per committee. Read once, lazily:
  // the card only mounts client-side after the roster has loaded.
  const guideKey = `awards-guide-${committee.id}`;
  const [guideOpen, setGuideOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try { return localStorage.getItem(guideKey) !== 'closed'; } catch { return true; }
  });
  function toggleGuide() {
    setGuideOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(guideKey, next ? 'open' : 'closed'); } catch { /* ignore */ }
      return next;
    });
  }

  // Rationale drafts keyed by nomination id (saved on blur)
  const drafts = useRef<Record<string, string>>({});
  // Sequence for optimistic temp ids, so a fresh row never collides
  const tempSeq = useRef(0);

  // Deadline clock, ticking once a minute
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const deadline = useMemo(() => chairDeadline(config, conference.end_date), [config, conference.end_date]);

  // Loads
  useEffect(() => {
    if (!session || !config.enabled) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const data = await loadCommitteeAwards(supabase, committee.id);
      if (cancelled) return;
      setRows(data);
      setRowsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session, committee.id, config.enabled]);

  useEffect(() => {
    if (!session || !config.enabled || !hasSession || !evidenceOpen || evidence !== null) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const board = await loadConferenceScoreboard(supabase, conferenceId, [committee.id]);
      if (cancelled) return;
      setEvidence(board.rows.filter(r => !r.isObserver));
    })();
    return () => { cancelled = true; };
  }, [session, config.enabled, hasSession, evidenceOpen, evidence, conferenceId, committee.id]);

  // Country name (session) → allocation code, for paper pills and suggestions
  const codeByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of delegations) map[d.name] = d.code;
    return map;
  }, [delegations]);
  const codeFor = useCallback((countryName: string): string | null => {
    const direct = codeByName[countryName];
    if (direct) return direct;
    const lower = countryName.toLowerCase();
    const loose = delegations.find(d => d.name.toLowerCase() === lower);
    if (loose) return loose.code;
    return getCountryByName(countryName)?.code ?? null;
  }, [codeByName, delegations]);
  const delegationForName = useCallback((countryName: string): DelegationOption | null => {
    const code = codeFor(countryName);
    return code ? delegations.find(d => d.code === code) ?? null : null;
  }, [codeFor, delegations]);

  const sortedEvidence = useMemo(() => {
    if (!evidence) return [];
    return [...evidence].sort((a, b) => b.headline - a.headline || b.speakingSeconds - a.speakingSeconds || a.country.localeCompare(b.country));
  }, [evidence]);
  const ranks = useMemo(() => (evidence ? rankByHeadline(evidence) : new Map<string, number>()), [evidence]);
  const paperByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of papers) m.set(p.country_code, p.status);
    return m;
  }, [papers]);

  // ── Writes ────────────────────────────────────────────────────────────────

  function markSlot(key: string, busy: boolean) {
    setBusySlots(prev => {
      const next = new Set(prev);
      if (busy) next.add(key); else next.delete(key);
      return next;
    });
  }

  function rowsOfType(type: string): ConferenceAwardRow[] {
    return rows.filter(r => r.award_type === type).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }

  async function chooseDelegation(slot: AwardTypeConfig, index: number, existing: ConferenceAwardRow | null, code: string) {
    if (!user || !session) return;
    const slotKey = `${slot.key}:${index}`;
    if (busySlots.has(slotKey)) return;
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const previous = rows;

    // Cleared
    if (!code) {
      if (!existing) return;
      setRows(prev => prev.filter(r => r.id !== existing.id));
      markSlot(slotKey, true);
      const err = await deleteNomination(supabase, existing.id);
      markSlot(slotKey, false);
      if (err) { setRows(previous); setError(err); }
      return;
    }

    const d = delegations.find(x => x.code === code);
    if (!d) return;
    const patch = {
      country_code: d.code, country_name: d.name, user_id: d.userId,
      allocation_id: d.allocationId, recipient_name: d.recipientName,
    };

    if (existing) {
      setRows(prev => prev.map(r => r.id === existing.id ? { ...r, ...patch } : r));
      setSuggestedIds(prev => { const n = new Set(prev); n.delete(existing.id); return n; });
      markSlot(slotKey, true);
      const err = await updateNomination(supabase, existing.id, patch);
      markSlot(slotKey, false);
      if (err) { setRows(previous); setError(err); }
      return;
    }

    // New nomination: optimistic temp row, swapped for the real one
    tempSeq.current += 1;
    const tempId = `temp-${tempSeq.current}-${index}`;
    const optimistic: ConferenceAwardRow = {
      id: tempId, conference_id: conferenceId, conference_committee_id: committee.id,
      user_id: d.userId, assigned_by: user.id, award_type: slot.key, award_label: slot.label,
      country_code: d.code, country_name: d.name, society_id: null, allocation_id: d.allocationId,
      recipient_name: d.recipientName, points_awarded: slot.points, status: 'nominated',
      rationale: null, position: index + 1, published_at: null, created_at: new Date().toISOString(),
    };
    setRows(prev => [...prev, optimistic]);
    markSlot(slotKey, true);
    const { row, error: err } = await createNomination(supabase, user.id, {
      conferenceId, conferenceCommitteeId: committee.id, awardType: slot.key, awardLabel: slot.label,
      countryCode: d.code, countryName: d.name, userId: d.userId, allocationId: d.allocationId,
      recipientName: d.recipientName, rationale: null, position: index + 1,
    });
    markSlot(slotKey, false);
    if (err || !row) { setRows(previous); setError(err ?? 'Could not save the nomination.'); return; }
    setRows(prev => prev.map(r => r.id === tempId ? row : r));
  }

  async function saveRationale(row: ConferenceAwardRow) {
    if (!session || row.id.startsWith('temp-')) return;
    const text = (drafts.current[row.id] ?? row.rationale ?? '').trim();
    const next = text || null;
    if (next === (row.rationale ?? null)) return;
    const previous = rows;
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, rationale: next } : r));
    setSuggestedIds(prev => { const n = new Set(prev); n.delete(row.id); return n; });
    const supabase = getAuthedClient(session.access_token);
    const err = await updateNomination(supabase, row.id, { rationale: next });
    if (err) { setRows(previous); setError(err); }
  }

  async function suggest() {
    if (!user || !session || !evidence || evidence.length === 0) return;
    setError('');
    const suggestion = suggestSlate(evidence, config, papers, codeByName);
    // Invert: award key → ordered list of session country names
    const byKey = new Map<string, string[]>();
    for (const [country, keys] of Object.entries(suggestion)) {
      for (const k of keys) (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(country);
    }
    const supabase = getAuthedClient(session.access_token);
    const created: ConferenceAwardRow[] = [];
    const newSuggested = new Set<string>();
    for (const slot of slots) {
      const have = rowsOfType(slot.key);
      const takenCodes = new Set(have.map(r => r.country_code));
      const empty = slot.perCommittee - have.length;
      if (empty <= 0) continue;
      const candidates = (byKey.get(slot.key) ?? [])
        .map(delegationForName)
        .filter((d): d is DelegationOption => !!d && !takenCodes.has(d.code));
      let position = have.length + 1;
      for (const d of candidates.slice(0, empty)) {
        const { row, error: err } = await createNomination(supabase, user.id, {
          conferenceId, conferenceCommitteeId: committee.id, awardType: slot.key, awardLabel: slot.label,
          countryCode: d.code, countryName: d.name, userId: d.userId, allocationId: d.allocationId,
          recipientName: d.recipientName, rationale: null, position,
        });
        if (err || !row) { setError(err ?? 'Could not save a suggestion.'); break; }
        created.push(row);
        newSuggested.add(row.id);
        takenCodes.add(d.code);
        position += 1;
      }
    }
    if (created.length) {
      setRows(prev => [...prev, ...created]);
      setSuggestedIds(prev => new Set([...prev, ...newSuggested]));
    }
  }

  async function confirmSuggestion(id: string) {
    setSuggestedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function submit() {
    if (!session || lifecycleBusy) return;
    const completeness = slateCompleteness(rows, config);
    const empty = completeness.total - completeness.filled;
    if (empty > 0 && !window.confirm(`Submit with ${empty} empty slot${empty === 1 ? '' : 's'}?`)) return;
    setError('');
    setLifecycleBusy(true);
    const supabase = getAuthedClient(session.access_token);
    const err = await submitSlate(supabase, committee.id);
    setLifecycleBusy(false);
    if (err) { setError(err); return; }
    setStampOverride(prev => ({ base: baseStamps, patch: { ...(prev?.patch ?? {}), awards_submitted_at: new Date().toISOString(), awards_return_note: null } }));
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 3000);
  }

  async function withdraw() {
    if (!session || lifecycleBusy) return;
    setError('');
    setLifecycleBusy(true);
    const supabase = getAuthedClient(session.access_token);
    const err = await withdrawSlate(supabase, committee.id);
    setLifecycleBusy(false);
    if (err) { setError(err); return; }
    setStampOverride(prev => ({ base: baseStamps, patch: { ...(prev?.patch ?? {}), awards_submitted_at: null } }));
  }

  // Awards off for this conference: render nothing at all.
  if (!config.enabled || state === 'off') return null;

  const completeness = slateCompleteness(rows, config);
  const cd = deadline ? countdown(deadline, now) : null;
  const evidenceEmpty = !hasSession || (evidence !== null && evidence.length === 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SectionCard id="awards">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
          AWARDS
        </p>
        <StatePill state={state} />
      </div>

      {/* State line */}
      <div className="mt-3">
        {state === 'returned' ? (
          <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(139,32,32,0.07)', border: '1px solid rgba(139,32,32,0.25)' }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8B2020', margin: 0 }}>RETURNED BY THE SECRETARIAT</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#1C1410', margin: '6px 0 0 0', lineHeight: 1.55 }}>
              {stamps.awards_return_note}
            </p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#6B5F52', margin: '8px 0 0 0' }}>Edit and resubmit below.</p>
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: '#6B5F52', fontFamily: OUTFIT, margin: 0, lineHeight: 1.55 }}>
            {STATE_COPY[state]}
            {state === 'open' && deadline && (
              <> Deadline {fmtDeadline(deadline)}.</>
            )}
          </p>
        )}
        {state === 'open' && cd && (
          <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: cd.past ? '#8B2020' : '#2A5A3C', margin: '6px 0 0 0' }}>
            {cd.past ? 'You are past the deadline. You can still submit, but tell the secretariat.' : cd.label}
          </p>
        )}
      </div>

      {/* Guidance */}
      {editable && (
        <div className="mt-5 rounded-xl" style={{ border: '1px solid rgba(221,212,192,0.8)', backgroundColor: 'rgba(238,217,138,0.08)' }}>
          <button
            type="button"
            onClick={toggleGuide}
            className="w-full flex items-center justify-between px-4 py-3 focus:outline-none"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            aria-expanded={guideOpen}
          >
            <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: '#1C1410' }}>How chairs decide</span>
            {guideOpen ? <ChevronUp size={15} style={{ color: '#9A8A78' }} /> : <ChevronDown size={15} style={{ color: '#9A8A78' }} />}
          </button>
          {guideOpen && (
            <div className="px-4 pb-4">
              <ul className="m-0 p-0" style={{ listStyle: 'none' }}>
                {GUIDE_DIMENSIONS.map(d => (
                  <li key={d.name} className="flex items-baseline gap-2 py-0.5">
                    <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: '#1B3828', minWidth: 96 }}>{d.name}</span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#6B5F52' }}>{d.text}</span>
                  </li>
                ))}
              </ul>
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#2E2820', margin: '10px 0 0 0', lineHeight: 1.55, fontStyle: 'italic' }}>
                Ten average speeches rarely beat three exceptional ones combined with drafting leadership.
              </p>
              <a
                href="/blog/mun-awards-guide"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2"
                style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#2A5A3C', textDecoration: 'none', letterSpacing: '0.03em' }}
              >
                Full guide <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Evidence */}
      {editable && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setEvidenceOpen(o => !o)}
            className="w-full flex items-center justify-between focus:outline-none"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-expanded={evidenceOpen}
          >
            <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#9A8A78' }}>THE RECORD</span>
            {evidenceOpen ? <ChevronUp size={14} style={{ color: '#9A8A78' }} /> : <ChevronDown size={14} style={{ color: '#9A8A78' }} />}
          </button>
          {evidenceOpen && (
            <div className="mt-2">
              {evidenceLoading ? (
                <div className="flex justify-center py-5"><Loader size={28} /></div>
              ) : evidenceEmpty ? (
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#9A8A78', margin: 0 }}>
                  No session record yet. Awards can still be decided by hand.
                </p>
              ) : (
                <>
                  <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#9A8A78', margin: '0 0 8px 0' }}>
                    The numbers are evidence, not the verdict. Sorted by the session&apos;s blended score.
                  </p>
                  <div className="rounded-xl" style={{ overflowX: 'auto', border: '1px solid rgba(221,212,192,0.8)', maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, fontFamily: OUTFIT, fontSize: 12 }}>
                      <thead>
                        <tr style={{ position: 'sticky', top: 0, backgroundColor: '#F3EFE6', zIndex: 1 }}>
                          {['#', 'Delegation', 'Score', 'Speeches', 'Time', 'WP/DR', 'Paper', 'Factors', 'Notes'].map((h, i) => (
                            <th key={h} style={{ textAlign: i < 2 ? 'left' : 'right', padding: '7px 10px', fontSize: 9.5, letterSpacing: '0.1em', fontWeight: 700, color: '#9A8A78', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(221,212,192,0.8)' }}>
                              {h.toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedEvidence.map((r) => {
                          const code = codeFor(r.country);
                          const paper = code ? paperByCode.get(code) : undefined;
                          const ps = paper ? (PAPER_STYLES[paper] ?? PAPER_STYLES.submitted) : null;
                          const factorAvg = r.factors.length
                            ? r.factors.reduce((s, f) => s + f.average, 0) / r.factors.length
                            : null;
                          const scaleMax = r.factors[0]?.scaleMax ?? 10;
                          const num: React.CSSProperties = { textAlign: 'right', padding: '6px 10px', fontVariantNumeric: 'tabular-nums', color: '#2E2820', whiteSpace: 'nowrap' };
                          return (
                            <tr key={r.key} style={{ borderBottom: '1px solid rgba(221,212,192,0.5)' }}>
                              <td style={{ padding: '6px 10px', color: '#9A8A78', fontVariantNumeric: 'tabular-nums' }}>{ranks.get(r.country) ?? ''}</td>
                              <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                                <span className="inline-flex items-center gap-2">
                                  <FlagImg code={code ?? ''} size={16} />
                                  <span style={{ fontWeight: 600, color: '#1C1410' }}>{r.country}</span>
                                  {r.status === 'absent' && <span style={{ fontSize: 10, color: '#8B2020', fontWeight: 700 }}>ABSENT</span>}
                                </span>
                              </td>
                              <td style={{ ...num, fontWeight: 700, color: '#1B3828' }}>{Math.round(r.headline)}</td>
                              <td style={num}>{r.gslSpeeches + r.caucusSpeeches}</td>
                              <td style={num}>{formatSpeakingTime(r.speakingSeconds)}</td>
                              <td style={num}>{r.workingPapers}/{r.draftResolutions}</td>
                              <td style={{ ...num }}>
                                {ps && paper ? (
                                  <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: ps.bg, color: ps.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
                                    {paper.charAt(0).toUpperCase() + paper.slice(1)}
                                  </span>
                                ) : <span style={{ color: '#C9BFAE' }}>none</span>}
                              </td>
                              <td style={num}>{factorAvg === null ? <span style={{ color: '#C9BFAE' }}>none</span> : `${factorAvg.toFixed(1)}/${scaleMax}`}</td>
                              <td style={num}>{r.comments.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Slate */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#9A8A78' }}>
            {editable ? 'YOUR SLATE' : 'NOMINATIONS'}
          </span>
          {editable && evidence && evidence.length > 0 && !completeness.complete && (
            <button
              type="button"
              onClick={suggest}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 focus:outline-none"
              style={{ border: '1px solid rgba(182,135,31,0.45)', backgroundColor: 'rgba(238,217,138,0.18)', color: '#7A5A20', fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer' }}
            >
              <Sparkles size={12} /> Suggest from the record
            </button>
          )}
        </div>

        {rowsLoading ? (
          <div className="flex justify-center py-5"><Loader size={28} /></div>
        ) : slots.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#9A8A78', margin: 0 }}>
            The secretariat has not configured any committee awards.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {slots.map(slot => {
              const have = rowsOfType(slot.key);
              const count = editable ? Math.max(slot.perCommittee, have.length) : have.length;
              if (!editable && count === 0) {
                return (
                  <div key={slot.key} className="flex items-center gap-2.5 py-1.5">
                    <TierDot tier={slot.tier} />
                    <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: '#1C1410' }}>{slot.label}</span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 12, color: '#9A8A78' }}>not awarded</span>
                  </div>
                );
              }
              return Array.from({ length: count }, (_, i) => {
                const existing = have[i] ?? null;
                const slotKey = `${slot.key}:${i}`;
                const takenElsewhere = new Set(have.filter((_, j) => j !== i).map(r => r.country_code));
                const busy = busySlots.has(slotKey) || (existing?.id.startsWith('temp-') ?? false);
                const suggested = !!existing && suggestedIds.has(existing.id);
                return (
                  <div
                    key={slotKey}
                    className="rounded-xl px-3.5 py-3"
                    style={{ border: `1px solid ${suggested ? 'rgba(182,135,31,0.45)' : 'rgba(221,212,192,0.8)'}`, backgroundColor: suggested ? 'rgba(238,217,138,0.10)' : 'rgba(27,56,40,0.025)' }}
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <TierDot tier={slot.tier} />
                      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: '#1C1410' }}>
                        {slot.label}{slot.perCommittee > 1 ? ` ${i + 1}` : ''}
                      </span>
                      {suggested && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(238,217,138,0.35)', color: '#7A5A20', fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em' }}>
                          SUGGESTED
                          <button
                            type="button"
                            onClick={() => confirmSuggestion(existing!.id)}
                            title="Keep this pick"
                            className="focus:outline-none inline-flex"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A5A20' }}
                            aria-label="Keep this pick"
                          >
                            <Check size={11} strokeWidth={3} />
                          </button>
                        </span>
                      )}
                      {!editable && existing && ranks.get(existing.country_name ?? '') && (
                        <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
                          #{ranks.get(existing.country_name ?? '')} on record
                        </span>
                      )}
                    </div>

                    {editable ? (
                      <div className="flex flex-col sm:flex-row gap-2 mt-2">
                        <select
                          value={existing?.country_code ?? ''}
                          disabled={busy}
                          onChange={e => chooseDelegation(slot, i, existing, e.target.value)}
                          className="focus:outline-none"
                          style={{
                            flex: '0 0 auto', minWidth: 0, width: '100%', maxWidth: 280,
                            padding: '8px 10px', borderRadius: 10, border: '1px solid #DDD4C0',
                            backgroundColor: '#FFFFFF', fontFamily: OUTFIT, fontSize: 12.5, color: existing ? '#1C1410' : '#9A8A78',
                            opacity: busy ? 0.6 : 1,
                          }}
                        >
                          <option value="">Choose a delegation</option>
                          {delegations.map(d => (
                            <option key={d.code} value={d.code} disabled={takenElsewhere.has(d.code)}>
                              {d.name}{d.recipientName ? ` · ${d.recipientName}` : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          defaultValue={existing?.rationale ?? ''}
                          key={existing?.id ?? 'empty'}
                          disabled={!existing || busy}
                          placeholder="Why (the secretariat reads this)"
                          onChange={e => { if (existing) drafts.current[existing.id] = e.target.value; }}
                          onBlur={() => { if (existing) saveRationale(existing); }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                          className="focus:outline-none"
                          style={{
                            flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: '1px solid #DDD4C0',
                            backgroundColor: existing ? '#FFFFFF' : 'rgba(221,212,192,0.25)', fontFamily: OUTFIT, fontSize: 12.5, color: '#1C1410',
                          }}
                        />
                      </div>
                    ) : existing ? (
                      <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                        <FlagImg code={existing.country_code ?? ''} size={18} />
                        <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: '#1C1410' }}>{existing.country_name}</span>
                        {existing.recipient_name && (
                          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#6B5F52' }}>{existing.recipient_name}</span>
                        )}
                        {existing.rationale && (
                          <span className="w-full" style={{ fontFamily: OUTFIT, fontSize: 12, color: '#9A8A78', fontStyle: 'italic' }}>{existing.rationale}</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              });
            })}
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020', marginTop: 10, marginBottom: 0 }}>{error}</p>
      )}

      {/* Footer */}
      {!rowsLoading && slots.length > 0 && (state === 'open' || state === 'returned' || state === 'submitted') && (
        <div className="mt-5 pt-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
          <span style={{ fontFamily: OUTFIT, fontSize: 12, color: completeness.complete ? '#2A5A3C' : '#6B5F52', fontVariantNumeric: 'tabular-nums' }}>
            {completeness.filled} of {completeness.total} slots filled
            {completeness.over.length > 0 && ` (over quota: ${completeness.over.join(', ')})`}
          </span>
          {editable ? (
            <button
              type="button"
              onClick={submit}
              disabled={lifecycleBusy || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 focus:outline-none transition-colors"
              style={{
                backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 12, letterSpacing: '0.06em',
                border: 'none', cursor: lifecycleBusy || rows.length === 0 ? 'not-allowed' : 'pointer', opacity: lifecycleBusy || rows.length === 0 ? 0.55 : 1,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              <Send size={13} /> {state === 'returned' ? 'RESUBMIT SLATE' : 'SUBMIT SLATE'}
            </button>
          ) : (
            <button
              type="button"
              onClick={withdraw}
              disabled={lifecycleBusy}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 focus:outline-none"
              style={{
                backgroundColor: 'transparent', color: '#1C1410', fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
                border: '1px solid #DDD4C0', cursor: lifecycleBusy ? 'not-allowed' : 'pointer', opacity: lifecycleBusy ? 0.55 : 1,
              }}
            >
              {justSubmitted ? <Check size={13} style={{ color: '#3D7A52' }} /> : <Undo2 size={13} />} {justSubmitted ? 'SUBMITTED' : 'WITHDRAW'}
            </button>
          )}
        </div>
      )}

      {state === 'published' && (
        <p className="mt-4" style={{ fontFamily: OUTFIT, fontSize: 12, color: '#6B5F52', margin: '16px 0 0 0' }}>
          The honour roll is public at{' '}
          <a href={`/conferences/${conferenceSlug}/awards`} style={{ color: '#2A5A3C', fontWeight: 700, textDecoration: 'none' }}>
            /conferences/{conferenceSlug}/awards
          </a>.
        </p>
      )}
    </SectionCard>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function TierDot({ tier }: { tier: AwardTier }) {
  return (
    <span
      aria-hidden
      className="flex-shrink-0 rounded-full"
      style={{ width: 10, height: 10, background: TIER_DOT[tier], boxShadow: '0 1px 2px rgba(27,56,40,0.25)' }}
    />
  );
}

function StatePill({ state }: { state: SlateState }) {
  const style: Record<SlateState, { bg: string; color: string; Icon: typeof Lock | null }> = {
    off: { bg: 'transparent', color: '#9A8A78', Icon: null },
    open: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614', Icon: null },
    returned: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020', Icon: Undo2 },
    submitted: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C', Icon: Send },
    approved: { bg: 'rgba(27,56,40,0.12)', color: '#1B3828', Icon: Lock },
    published: { bg: 'rgba(238,217,138,0.5)', color: '#7A5A20', Icon: Megaphone },
  };
  const s = style[state];
  const label: Record<SlateState, string> = {
    off: 'OFF', open: 'NOT SUBMITTED', returned: 'RETURNED', submitted: 'SUBMITTED', approved: 'APPROVED', published: 'ANNOUNCED',
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ backgroundColor: s.bg, color: s.color, fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em' }}>
      {s.Icon && <s.Icon size={10} />}
      {label[state]}
    </span>
  );
}
