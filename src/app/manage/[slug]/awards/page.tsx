'use client';

// ============================================================
// /manage/[slug]/awards: the secretariat's awards desk.
//
// MUN awards are decided per committee by the chairs, ratified by the
// secretariat, and announced once at the closing ceremony. This page is the
// ratification and the ceremony:
//
//   1. every committee's slate, with the session scoreboard as evidence beside
//      each nomination (rank, headline score, speeches, speaking time, papers);
//   2. Approve / Return (with a note) / Edit slate per committee;
//   3. the delegation standings, tallied from committee honours with
//      AWARD_WEIGHT, and the Best Delegation style awards handed out from them;
//   4. Publish: one RPC that flips rows to published, writes a verified MUN CV
//      entry per recipient with an account and mints Gavelling Points at a
//      paid conference. Idempotent, so a late addition can be published again.
//
// All vocabulary comes from src/lib/awards.ts; all writes go through
// src/lib/awardsService.ts. Nothing here talks to conference_awards directly.
// Manage surfaces render hardcoded English (no t()).
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy, Settings2, Send, CheckCircle2, Undo2, Pencil, X, ExternalLink, Download,
  AlertTriangle, Megaphone, Radio, Medal, Building2, Save, Loader2,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { ModalOverlay } from '@/components/ModalOverlay';
import { LogoDisc } from '@/components/LogoDisc';
import { NEU, NeuCard, OUTFIT, EASE } from '@/components/neu';
import { SOFT, RED, AMBER_INK, GREEN_INK, CARD_BORDER_COLOR } from '@/app/manage/[slug]/live/tokens';
import { committeeDisplayName } from '@/lib/presetNames';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import {
  loadConferenceScoreboard, formatSpeakingTime,
  type ConferenceScoreboard, type ScoreboardDelegateRow,
} from '@/lib/conferenceScoreboard';
import {
  getAwardsConfig, committeeSlots, delegationAwardTypes, chairDeadline,
  slateState, SLATE_STATE_LABEL, slateCompleteness, rankByHeadline, delegationStandings,
  SMALL_DELEGATION_MAX, AWARD_WEIGHT,
  type AwardsConfig, type AwardTypeConfig, type AwardTier, type ConferenceAwardRow, type SlateState,
} from '@/lib/awards';
import {
  loadConferenceAwards, createNomination, updateNomination, deleteNomination,
  createDelegationAward, approveSlate, returnSlate, publishAwards, type PublishResult,
} from '@/lib/awardsService';
import { queueAwardsOpenEmails, queueAwardReceivedEmails } from '@/lib/emailEvents';

// ── Row shapes ───────────────────────────────────────────────────────────────

interface DisplayChair { name: string; avatar_url: string | null }

interface CommitteeRow {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  display_chairs: DisplayChair[] | null;
  chair_user_ids: string[] | null;
  session_id: string | null;
  awards_submitted_at: string | null;
  awards_submitted_by: string | null;
  awards_approved_at: string | null;
  awards_approved_by: string | null;
  awards_return_note: string | null;
}

interface AllocationRow {
  id: string;
  conference_committee_id: string;
  country_code: string | null;
  country_name: string | null;
  user_id: string | null;
  application_id: string | null;
  society_id: string | null;
  profiles: { display_name: string | null } | null;
  applications: { id: string; invited_name: string | null } | null;
  societies: { name: string | null } | null;
}

interface RoleFeeRow { role: string; fee_amount: number | null }

type Notice = { kind: 'ok' | 'err'; text: string };

/** One editable slot in the inline slate editor: `${awardType}:${index}`. */
type SlateDraft = Record<string, { allocationId: string; rationale: string }>;

// ── Small helpers ────────────────────────────────────────────────────────────

const TIER_COLOR: Record<AwardTier, string> = {
  gold: NEU.deepGold,
  silver: '#8C8C94',
  bronze: '#9C6B3C',
  special: NEU.forest,
};

const STATE_STYLE: Record<SlateState, { bg: string; fg: string }> = {
  off: { bg: 'rgba(27,56,40,0.08)', fg: SOFT },
  open: { bg: 'rgba(27,56,40,0.08)', fg: SOFT },
  submitted: { bg: 'rgba(184,132,74,0.15)', fg: AMBER_INK },
  returned: { bg: 'rgba(139,32,32,0.08)', fg: RED },
  approved: { bg: 'rgba(61,122,82,0.12)', fg: GREEN_INK },
  published: { bg: NEU.forest, fg: NEU.gold },
};

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function flagFor(code: string | null, name: string | null): string {
  const c = code || (name ? getCountryByName(name)?.code : '') || '';
  return getFlagUrl(c);
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function allocationDisplayName(a: AllocationRow | undefined): string | null {
  if (!a) return null;
  return a.profiles?.display_name?.trim() || a.applications?.invited_name?.trim() || null;
}

/** Who receives an award: profile name, then the invited name on the
 *  application, then whatever the chair typed, then the honest fallback. */
function recipientNameFor(r: ConferenceAwardRow, allocationById: Map<string, AllocationRow>): string {
  const alloc = r.allocation_id ? allocationById.get(r.allocation_id) : undefined;
  return allocationDisplayName(alloc) || r.recipient_name?.trim() || 'Unclaimed seat';
}

function chairNames(c: CommitteeRow): string[] {
  return (c.display_chairs ?? []).map((d) => d.name).filter(Boolean);
}

/** Rows for one committee, in config order then by position. */
function sortRows(rows: ConferenceAwardRow[], config: AwardsConfig): ConferenceAwardRow[] {
  const order = new Map(config.types.map((t, i) => [t.key, i]));
  return [...rows].sort((a, b) =>
    (order.get(a.award_type) ?? 99) - (order.get(b.award_type) ?? 99)
    || a.position - b.position
    || a.created_at.localeCompare(b.created_at));
}

function sameCountry(a: string | null, b: string): boolean {
  return !!a && a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ── Presentational pieces ────────────────────────────────────────────────────

function StatePill({ state }: { state: SlateState }) {
  const s = STATE_STYLE[state];
  return (
    <span style={{
      fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: s.fg, backgroundColor: s.bg, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap',
    }}>
      {SLATE_STATE_LABEL[state]}
    </span>
  );
}

function TierDot({ tier, size = 9 }: { tier: AwardTier; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 999, backgroundColor: TIER_COLOR[tier], flexShrink: 0, display: 'inline-block' }} />
  );
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} style={{
      fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: SOFT, fontVariantNumeric: 'tabular-nums',
      backgroundColor: 'rgba(27,56,40,0.06)', border: `1px solid ${CARD_BORDER_COLOR}`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function Btn({
  children, onClick, icon: Icon, tone = 'ghost', disabled = false, title, href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  title?: string;
  href?: string;
}) {
  const style: React.CSSProperties = {
    fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, borderRadius: 10, padding: '8px 14px',
    display: 'inline-flex', alignItems: 'center', gap: 7, cursor: disabled ? 'default' : 'pointer',
    textDecoration: 'none', whiteSpace: 'nowrap', transition: `box-shadow 200ms ${EASE}, opacity 200ms ${EASE}`,
    opacity: disabled ? 0.5 : 1,
    ...(tone === 'primary'
      ? { color: NEU.gold, backgroundColor: NEU.forest, border: 'none' }
      : tone === 'danger'
        ? { color: RED, backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.25)' }
        : { color: NEU.forest, backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`, boxShadow: NEU.outSm }),
  };
  if (href && !disabled) {
    return (
      <Link href={href} title={title} className="focus:outline-none" style={style}>
        {Icon && <Icon size={13} strokeWidth={2.4} />}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className="focus:outline-none" style={style}>
      {Icon && <Icon size={13} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: SOFT }}>
      {children}
    </p>
  );
}

function InlineNotice({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const err = notice.kind === 'err';
  return (
    <div role={err ? 'alert' : 'status'} style={{
      display: 'flex', alignItems: 'center', gap: 10, fontFamily: OUTFIT, fontSize: 12.5,
      color: err ? RED : GREEN_INK, backgroundColor: err ? 'rgba(139,32,32,0.06)' : 'rgba(61,122,82,0.09)',
      border: `1px solid ${err ? 'rgba(139,32,32,0.2)' : 'rgba(61,122,82,0.25)'}`, borderRadius: 10, padding: '8px 12px', marginBlockEnd: 16,
    }}>
      {err ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
      <span style={{ flex: 1 }}>{notice.text}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="focus:outline-none" style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'inline-flex' }}>
        <X size={14} />
      </button>
    </div>
  );
}

function ModalCard({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose} scrimColor="rgba(27,20,16,0.42)" label={title}>
      <div style={{ width: 'min(520px, 92vw)', backgroundColor: NEU.surface, borderRadius: 18, padding: 22, boxShadow: NEU.out, border: `1px solid ${CARD_BORDER_COLOR}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBlockEnd: 12 }}>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 19, color: NEU.ink, flex: 1, lineHeight: 1.15 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="focus:outline-none" style={{ border: 'none', background: 'transparent', color: SOFT, cursor: 'pointer', display: 'inline-flex' }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </ModalOverlay>
  );
}

// ── Evidence chips for one nomination ────────────────────────────────────────

function Evidence({ row, rank, total }: { row: ScoreboardDelegateRow | null; rank: number | null; total: number }) {
  if (!row) return <Chip title="This delegation has no rows on the session scoreboard">No scoreboard data</Chip>;
  const speeches = row.gslSpeeches + row.caucusSpeeches;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {rank != null && <Chip title="Rank by headline score within this committee">#{rank} of {total}</Chip>}
      <Chip title="Headline score (objective points blended with chair ratings per the chair's settings)">{row.headline} pts</Chip>
      <Chip title={`${row.gslSpeeches} on the speakers list, ${row.caucusSpeeches} in caucus`}>{speeches} {speeches === 1 ? 'speech' : 'speeches'}</Chip>
      <Chip title="Total speaking time">{formatSpeakingTime(row.speakingSeconds)}</Chip>
      <Chip title="Working papers sponsored">{row.workingPapers} WP</Chip>
      <Chip title="Draft resolutions sponsored">{row.draftResolutions} DR</Chip>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AwardsPage() {
  const { conference, refreshConferenceQuiet } = useManage();
  const { session, user } = useAuth();

  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [awards, setAwards] = useState<ConferenceAwardRow[]>([]);
  const [scoreboard, setScoreboard] = useState<ConferenceScoreboard | null>(null);
  const [roleFees, setRoleFees] = useState<RoleFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SlateDraft>({});
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  const conferenceId = conference?.id;
  const accessToken = session?.access_token;
  const organiserId = user?.id ?? session?.user?.id ?? null;

  const config = useMemo(() => getAwardsConfig(conference?.awards_config), [conference?.awards_config]);
  const slots = useMemo(() => committeeSlots(config), [config]);
  const delegationTypes = useMemo(() => delegationAwardTypes(config), [config]);
  const publishedAt = conference?.awards_published_at ?? null;
  const deadline = useMemo(() => chairDeadline(config, conference?.end_date ?? null), [config, conference?.end_date]);

  // ── Loading ──
  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!conferenceId || !accessToken) return;
    const supabase = getAuthedClient(accessToken);
    if (!opts?.quiet) setLoading(true);
    try {
      const [committeesRes, allocationsRes, awardRows, board, feesRes] = await Promise.all([
        supabase
          .from('conference_committees')
          .select('id, name, abbreviation, logo_url, display_chairs, chair_user_ids, session_id, awards_submitted_at, awards_submitted_by, awards_approved_at, awards_approved_by, awards_return_note')
          .eq('conference_id', conferenceId)
          .order('name'),
        supabase
          .from('conference_allocations')
          .select('id, conference_committee_id, country_code, country_name, user_id, application_id, society_id, profiles:user_id(display_name), applications:application_id(id, invited_name), societies:society_id(name)')
          .eq('conference_id', conferenceId),
        loadConferenceAwards(supabase, conferenceId),
        loadConferenceScoreboard(supabase, conferenceId).catch((err) => {
          console.error('[AwardsPage] scoreboard load failed:', err);
          return null;
        }),
        supabase
          .from('application_role_configs')
          .select('role, fee_amount')
          .eq('conference_id', conferenceId),
      ]);
      if (committeesRes.error) throw committeesRes.error;
      if (allocationsRes.error) throw allocationsRes.error;
      setCommittees((committeesRes.data ?? []) as unknown as CommitteeRow[]);
      setAllocations((allocationsRes.data ?? []) as unknown as AllocationRow[]);
      setAwards(awardRows);
      setScoreboard(board);
      setRoleFees((feesRes.data ?? []) as RoleFeeRow[]);
      setLoadError('');
    } catch (err) {
      console.error('[AwardsPage] load failed:', err);
      setLoadError("Couldn't load the awards desk. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [conferenceId, accessToken]);

  useEffect(() => { void load(); }, [load]);

  // ── Derived ──
  const allocationById = useMemo(() => new Map(allocations.map((a) => [a.id, a])), [allocations]);
  const allocationsByCommittee = useMemo(() => {
    const m = new Map<string, AllocationRow[]>();
    for (const a of allocations) {
      const list = m.get(a.conference_committee_id) ?? [];
      list.push(a);
      m.set(a.conference_committee_id, list);
    }
    for (const list of m.values()) list.sort((a, b) => (a.country_name ?? '').localeCompare(b.country_name ?? ''));
    return m;
  }, [allocations]);

  const awardsByCommittee = useMemo(() => {
    const m = new Map<string, ConferenceAwardRow[]>();
    for (const r of awards) {
      if (!r.conference_committee_id) continue;
      const list = m.get(r.conference_committee_id) ?? [];
      list.push(r);
      m.set(r.conference_committee_id, list);
    }
    return m;
  }, [awards]);

  const boardByCommittee = useMemo(() => {
    const m = new Map<string, { rows: ScoreboardDelegateRow[]; rank: Map<string, number>; total: number }>();
    for (const r of scoreboard?.rows ?? []) {
      const e = m.get(r.committeeId) ?? { rows: [] as ScoreboardDelegateRow[], rank: new Map<string, number>(), total: 0 };
      e.rows.push(r);
      m.set(r.committeeId, e);
    }
    for (const e of m.values()) {
      e.rank = rankByHeadline(e.rows);
      e.total = e.rows.filter((r) => !r.isObserver).length;
    }
    return m;
  }, [scoreboard]);

  const stateOf = useCallback((c: CommitteeRow) => slateState(c, publishedAt, config), [publishedAt, config]);

  const stateCounts = useMemo(() => {
    const counts: Record<SlateState, number> = { off: 0, open: 0, returned: 0, submitted: 0, approved: 0, published: 0 };
    for (const c of committees) counts[stateOf(c)] += 1;
    return counts;
  }, [committees, stateOf]);

  const publishable = useMemo(
    () => awards.filter((r) => r.status !== 'published' && (config.requireApproval ? r.status === 'approved' : true)),
    [awards, config.requireApproval],
  );
  const publishedRows = useMemo(() => awards.filter((r) => r.status === 'published'), [awards]);

  const isPaid = useMemo(
    () => (conference?.fee_amount ?? 0) > 0
      || roleFees.some((r) => (r.role === 'delegate' || r.role === 'head-delegate') && (r.fee_amount ?? 0) > 0),
    [conference?.fee_amount, roleFees],
  );

  const societyByAllocation = useMemo(() => {
    const m: Record<string, { societyId: string; societyName: string }> = {};
    for (const a of allocations) {
      if (a.society_id) m[a.id] = { societyId: a.society_id, societyName: a.societies?.name ?? 'Unnamed delegation' };
    }
    return m;
  }, [allocations]);
  const delegatesBySociety = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of allocations) if (a.society_id) m[a.society_id] = (m[a.society_id] ?? 0) + 1;
    return m;
  }, [allocations]);
  const standings = useMemo(
    () => delegationStandings(awards.filter((r) => r.conference_committee_id), societyByAllocation, delegatesBySociety),
    [awards, societyByAllocation, delegatesBySociety],
  );

  const committeeLabel = useCallback((id: string | null) => {
    const c = committees.find((x) => x.id === id);
    return c ? committeeDisplayName(c.name, c.abbreviation) : 'Delegation award';
  }, [committees]);

  // ── Actions ──
  function supa() {
    return accessToken ? getAuthedClient(accessToken) : null;
  }

  async function handleApprove(c: CommitteeRow) {
    const s = supa(); if (!s) return;
    setBusy(c.id);
    const err = await approveSlate(s, c.id);
    setBusy(null);
    if (err) { setNotice({ kind: 'err', text: `Could not approve ${committeeDisplayName(c.name, c.abbreviation)}: ${err}` }); return; }
    setCommittees((prev) => prev.map((x) => x.id === c.id ? { ...x, awards_approved_at: new Date().toISOString(), awards_return_note: null } : x));
    setNotice({ kind: 'ok', text: `${committeeDisplayName(c.name, c.abbreviation)} approved.` });
    void load({ quiet: true });
  }

  async function handleReturn() {
    const s = supa(); if (!s || !returningId) return;
    const c = committees.find((x) => x.id === returningId);
    const note = returnNote.trim();
    if (!note) return;
    setBusy(returningId);
    const err = await returnSlate(s, returningId, note);
    setBusy(null);
    if (err) { setNotice({ kind: 'err', text: `Could not return the slate: ${err}` }); return; }
    setCommittees((prev) => prev.map((x) => x.id === returningId
      ? { ...x, awards_submitted_at: null, awards_approved_at: null, awards_return_note: note }
      : x));
    setReturningId(null);
    setReturnNote('');
    setNotice({ kind: 'ok', text: `${c ? committeeDisplayName(c.name, c.abbreviation) : 'Slate'} returned to its chairs.` });
    void load({ quiet: true });
  }

  function beginEdit(c: CommitteeRow) {
    const rows = sortRows(awardsByCommittee.get(c.id) ?? [], config);
    const next: SlateDraft = {};
    for (const slot of slots) {
      const ofType = rows.filter((r) => r.award_type === slot.key);
      for (let i = 0; i < slot.perCommittee; i++) {
        const r = ofType[i];
        next[`${slot.key}:${i}`] = { allocationId: r?.allocation_id ?? '', rationale: r?.rationale ?? '' };
      }
    }
    setDraft(next);
    setEditingId(c.id);
  }

  async function saveEdit(c: CommitteeRow) {
    const s = supa(); if (!s || !organiserId || !conferenceId) return;
    setBusy(c.id);
    const rows = sortRows(awardsByCommittee.get(c.id) ?? [], config);
    const errors: string[] = [];
    for (const slot of slots) {
      const ofType = rows.filter((r) => r.award_type === slot.key);
      for (let i = 0; i < slot.perCommittee; i++) {
        const existing = ofType[i];
        const d = draft[`${slot.key}:${i}`] ?? { allocationId: '', rationale: '' };
        const alloc = d.allocationId ? allocationById.get(d.allocationId) : undefined;
        const rationale = d.rationale.trim() || null;
        if (alloc && existing) {
          const changed = existing.allocation_id !== alloc.id || (existing.rationale ?? null) !== rationale;
          if (!changed) continue;
          const err = await updateNomination(s, existing.id, {
            allocation_id: alloc.id,
            country_code: alloc.country_code,
            country_name: alloc.country_name,
            user_id: alloc.user_id,
            recipient_name: allocationDisplayName(alloc),
            rationale,
            position: i + 1,
          });
          if (err) errors.push(err);
        } else if (alloc && !existing) {
          const { error } = await createNomination(s, organiserId, {
            conferenceId,
            conferenceCommitteeId: c.id,
            awardType: slot.key,
            awardLabel: slot.label,
            countryCode: alloc.country_code ?? '',
            countryName: alloc.country_name ?? '',
            userId: alloc.user_id,
            allocationId: alloc.id,
            recipientName: allocationDisplayName(alloc),
            rationale,
            position: i + 1,
          });
          if (error) errors.push(error);
        } else if (!alloc && existing) {
          const err = await deleteNomination(s, existing.id);
          if (err) errors.push(err);
        }
      }
    }
    setBusy(null);
    if (errors.length) setNotice({ kind: 'err', text: errors[0] });
    else { setNotice({ kind: 'ok', text: `${committeeDisplayName(c.name, c.abbreviation)} slate saved.` }); setEditingId(null); }
    await load({ quiet: true });
  }

  async function removeExtra(r: ConferenceAwardRow) {
    const s = supa(); if (!s) return;
    const err = await deleteNomination(s, r.id);
    if (err) { setNotice({ kind: 'err', text: err }); return; }
    setAwards((prev) => prev.filter((x) => x.id !== r.id));
  }

  async function handleGiveDelegationAward(type: AwardTypeConfig, societyId: string, societyName: string) {
    const s = supa(); if (!s || !organiserId || !conferenceId) return;
    setBusy(`${type.key}:${societyId}`);
    const holder = awards.find((r) => r.award_type === type.key && r.society_id);
    if (holder && holder.society_id !== societyId && holder.status !== 'published') {
      const err = await deleteNomination(s, holder.id);
      if (err) { setBusy(null); setNotice({ kind: 'err', text: err }); return; }
    }
    const { error } = await createDelegationAward(s, organiserId, {
      conferenceId, awardType: type.key, awardLabel: type.label, societyId, recipientName: societyName,
    });
    setBusy(null);
    if (error) { setNotice({ kind: 'err', text: error }); return; }
    setNotice({ kind: 'ok', text: `${type.label} given to ${societyName}.` });
    void load({ quiet: true });
  }

  async function handleNotifyChairs() {
    const s = supa(); if (!s || !conferenceId) return;
    const targets = committees.filter((c) => { const st = stateOf(c); return st === 'open' || st === 'returned'; });
    if (targets.length === 0) { setNotice({ kind: 'ok', text: 'Every committee has already submitted its slate.' }); return; }
    setBusy('notify');
    const res = await queueAwardsOpenEmails(s, conferenceId, targets.map((c) => c.id));
    setBusy(null);
    if (res.outcome === 'unconfigured') {
      setNotice({ kind: 'err', text: 'Nothing sent: the "Awards open for chairs" email is not turned on. Turn it on under Communications and try again.' });
    } else if (res.outcome === 'off') {
      setNotice({ kind: 'err', text: 'Nothing sent: the "Awards open for chairs" email is switched off under Communications.' });
    } else {
      setNotice({
        kind: 'ok',
        text: `Queued ${res.queued} email${res.queued === 1 ? '' : 's'} to the chairs of ${targets.length - res.skipped} committee${targets.length - res.skipped === 1 ? '' : 's'}`
          + (res.skipped > 0 ? `. ${res.skipped} had no chair with a Gavelling account.` : '.'),
      });
    }
  }

  async function handlePublish() {
    const s = supa(); if (!s || !conferenceId) return;
    setBusy('publish');
    const toEmail = publishable;
    const { result, error } = await publishAwards(s, conferenceId);
    if (error || !result) {
      setBusy(null);
      setNotice({ kind: 'err', text: `Publishing failed: ${error ?? 'unknown error'}` });
      return;
    }
    setPublishResult(result);
    setPublishOpen(false);
    const mail = await queueAwardReceivedEmails(s, conferenceId, toEmail, allocations);
    setBusy(null);
    setNotice({
      kind: 'ok',
      text: `Published ${result.awards} award${result.awards === 1 ? '' : 's'}: ${result.cv_entries} new MUN CV entr${result.cv_entries === 1 ? 'y' : 'ies'}, ${result.points_rows} points credit${result.points_rows === 1 ? '' : 's'}`
        + (mail.queued > 0 ? `, ${mail.queued} email${mail.queued === 1 ? '' : 's'} queued.` : mail.outcome === 'unconfigured' ? '. No emails: the "Award received" email is not turned on under Communications.' : '.'),
    });
    await Promise.all([load({ quiet: true }), refreshConferenceQuiet()]);
  }

  function exportCertificates() {
    const header = ['Award', 'Recipient', 'Delegation', 'Committee', 'Chairs', 'Rationale'];
    const lines = [header.map(csvEscape).join(',')];
    for (const r of sortRows(publishedRows, config)) {
      const c = committees.find((x) => x.id === r.conference_committee_id);
      const alloc = r.allocation_id ? allocationById.get(r.allocation_id) : undefined;
      const delegation = r.society_id
        ? (r.recipient_name ?? '')
        : `${r.country_name ?? ''}${alloc?.societies?.name ? ` (${alloc.societies.name})` : ''}`;
      lines.push([
        r.award_label,
        r.society_id ? (r.recipient_name ?? '') : recipientNameFor(r, allocationById),
        delegation,
        c ? committeeDisplayName(c.name, c.abbreviation) : 'Conference',
        c ? chairNames(c).join('; ') : '',
        r.rationale ?? '',
      ].map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conference?.acronym ?? 'conference'}-awards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!conference) return null;

  const settingsHref = `/manage/${conference.slug}/settings?tab=awards`;
  const publishCount = publishable.length;
  const publishCommittees = new Set(publishable.map((r) => r.conference_committee_id).filter(Boolean)).size;
  const publishRecipients = new Set(publishable.map((r) => r.user_id).filter(Boolean)).size;
  const notifyTargets = committees.filter((c) => { const st = stateOf(c); return st === 'open' || st === 'returned'; }).length;

  // ── Header state line ──
  let stateLine: React.ReactNode;
  if (!config.enabled) {
    stateLine = (
      <>Awards are off for this conference. <Link href={settingsHref} style={{ color: NEU.forest, fontWeight: 700, textDecoration: 'none' }}>Turn them on in Award settings</Link>.</>
    );
  } else if (publishedAt) {
    stateLine = <>Published on {fmtDate(publishedAt)}. {publishedRows.length} award{publishedRows.length === 1 ? '' : 's'} on the honour roll.</>;
  } else {
    const submitted = stateCounts.submitted + stateCounts.approved;
    stateLine = (
      <>
        {submitted} of {committees.length} committee{committees.length === 1 ? '' : 's'} submitted
        {stateCounts.approved > 0 && <> · {stateCounts.approved} approved</>}
        {stateCounts.returned > 0 && <> · {stateCounts.returned} returned</>}
        {deadline && <> · chairs&apos; deadline {fmtDateTime(deadline)}</>}
        {!config.requireApproval && <> · approval not required</>}
      </>
    );
  }

  return (
    <div className="px-6 md:px-10 py-8">
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, color: SOFT, letterSpacing: '0.12em', marginBlockEnd: 4 }}>
        {conference.acronym} / Awards
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBlockEnd: 6 }}>
        <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 24, color: NEU.ink }}>Awards</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginInlineStart: 'auto' }}>
          <Btn href={settingsHref} icon={Settings2}>Award settings</Btn>
          {config.enabled && !publishedAt && (
            <Btn icon={Megaphone} onClick={handleNotifyChairs} disabled={busy === 'notify' || notifyTargets === 0}
              title={notifyTargets === 0 ? 'Every committee has submitted' : `Email the chairs of ${notifyTargets} committee${notifyTargets === 1 ? '' : 's'} whose slate is still open`}>
              {busy === 'notify' ? 'Sending' : `Notify chairs${notifyTargets > 0 ? ` (${notifyTargets})` : ''}`}
            </Btn>
          )}
          {config.enabled && (
            <Btn tone="primary" icon={Send} onClick={() => setPublishOpen(true)} disabled={publishCount === 0 || busy === 'publish'}
              title={publishCount === 0
                ? (config.requireApproval ? 'Approve at least one slate first' : 'No nominations yet')
                : `${publishCount} award${publishCount === 1 ? '' : 's'} ready`}>
              {publishedAt ? 'Publish new awards' : 'Publish awards'}{publishCount > 0 ? ` (${publishCount})` : ''}
            </Btn>
          )}
        </div>
      </div>
      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, marginBlockEnd: 20, maxWidth: 720 }}>{stateLine}</p>

      {loadError && (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: RED, backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px', marginBlockEnd: 16 }}>
          {loadError}
        </p>
      )}
      {notice && <InlineNotice notice={notice} onClose={() => setNotice(null)} />}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && !config.enabled && (
        <NeuCard style={{ padding: 40, textAlign: 'center' }}>
          <span className="inline-flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(150deg, rgba(27,56,40,0.1), rgba(27,56,40,0.04))', border: `1px solid ${CARD_BORDER_COLOR}`, marginBlockEnd: 16 }}>
            <Trophy size={26} strokeWidth={1.8} style={{ color: NEU.forest }} />
          </span>
          <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, color: NEU.ink, marginBlockEnd: 6 }}>Awards are off for this conference</p>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, marginBlockEnd: 20, maxWidth: 440, marginInline: 'auto' }}>
            Chairs cannot nominate and nothing can be published until awards are enabled. The categories, quotas and deadline live in Award settings.
          </p>
          <Btn href={settingsHref} tone="primary" icon={Settings2}>Open award settings</Btn>
        </NeuCard>
      )}

      {!loading && config.enabled && (
        <>
          {/* ── Published banner + honour roll ── */}
          {publishedAt && (
            <NeuCard style={{ padding: '18px 22px', marginBlockEnd: 22, borderLeft: `4px solid ${NEU.forest}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBlockEnd: 6 }}>
                <Trophy size={16} style={{ color: NEU.forest }} />
                <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: NEU.ink, flex: 1 }}>
                  Awards published on {fmtDate(publishedAt)}
                </p>
                <Btn icon={Download} onClick={exportCertificates} disabled={publishedRows.length === 0}>Export certificates CSV</Btn>
                <Btn href={`/conferences/${conference.slug}/awards`} icon={ExternalLink}>Public honour roll</Btn>
              </div>
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, marginBlockEnd: 14 }}>
                Every recipient with a Gavelling account now carries this on their MUN CV.
                {isPaid ? ' Gavelling Points were minted for each honour.' : ' No points were minted: this is a free conference.'}
                {publishResult && ` Last publish: ${publishResult.awards} awards, ${publishResult.cv_entries} new CV entries, ${publishResult.points_rows} points credits.`}
              </p>
              <HonourRoll rows={publishedRows} config={config} committees={committees} allocationById={allocationById} committeeLabel={committeeLabel} />
              {publishable.length > 0 && (
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: AMBER_INK, marginBlockStart: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} />
                  {publishable.length} late addition{publishable.length === 1 ? '' : 's'} below {publishable.length === 1 ? 'is' : 'are'} not yet published. Use &quot;Publish new awards&quot; above.
                </p>
              )}
            </NeuCard>
          )}

          {/* ── Committee cards ── */}
          {committees.length === 0 && (
            <NeuCard style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: NEU.ink, marginBlockEnd: 6 }}>No committees yet</p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT }}>Awards are given per committee. Create committees first, then chairs can nominate.</p>
            </NeuCard>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {committees.map((c) => {
              const state = stateOf(c);
              const rows = sortRows(awardsByCommittee.get(c.id) ?? [], config);
              const completeness = slateCompleteness(rows, config);
              const board = boardByCommittee.get(c.id) ?? null;
              const chairs = chairNames(c);
              const editing = editingId === c.id;
              const canApprove = state === 'submitted' || state === 'open' || state === 'returned';
              const canReturn = state === 'submitted' || state === 'approved';
              const isBusy = busy === c.id;
              const label = committeeDisplayName(c.name, c.abbreviation);
              const committeeAllocs = allocationsByCommittee.get(c.id) ?? [];
              const extras = rows.filter((r) => {
                const slot = slots.find((s) => s.key === r.award_type);
                if (!slot) return true;
                const idx = rows.filter((x) => x.award_type === r.award_type).indexOf(r);
                return idx >= slot.perCommittee;
              });

              return (
                <NeuCard key={c.id} style={{ padding: '18px 22px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                    <LogoDisc src={c.logo_url} size={44} fallbackText={(c.abbreviation ?? c.name).slice(0, 3).toUpperCase()} alt={label} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink }}>{label}</h2>
                        <StatePill state={state} />
                      </div>
                      {c.abbreviation && c.name !== label && (
                        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT }}>{c.name}</p>
                      )}
                      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, marginBlockStart: 4 }}>
                        {chairs.length > 0 ? `Chairs: ${chairs.join(', ')}` : 'No chairs assigned'}
                        {c.awards_submitted_at && ` · submitted ${fmtDateTime(new Date(c.awards_submitted_at))}`}
                        {c.awards_approved_at && ` · approved ${fmtDateTime(new Date(c.awards_approved_at))}`}
                      </p>
                      <p style={{ fontFamily: OUTFIT, fontSize: 12, marginBlockStart: 4, color: completeness.over.length ? RED : completeness.complete ? GREEN_INK : SOFT, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {completeness.over.length > 0 && <AlertTriangle size={12} />}
                        {completeness.filled} of {completeness.total} slot{completeness.total === 1 ? '' : 's'} filled
                        {completeness.over.length > 0 && <> · over quota: {completeness.over.join(', ')}</>}
                        {completeness.missing.length > 0 && state !== 'open' && <> · missing: {completeness.missing.join(', ')}</>}
                      </p>
                      {c.awards_return_note && state === 'returned' && (
                        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: RED, marginBlockStart: 6, backgroundColor: 'rgba(139,32,32,0.06)', borderRadius: 8, padding: '6px 10px' }}>
                          Return note: {c.awards_return_note}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn href={`/manage/${conference.slug}/scoreboard?committee=${c.id}`} icon={Trophy} title="Open this committee on the full scoreboard">View scoreboard</Btn>
                      {state !== 'published' && !editing && (
                        <Btn icon={Pencil} onClick={() => beginEdit(c)} disabled={isBusy}>Edit slate</Btn>
                      )}
                      {canReturn && !editing && (
                        <Btn icon={Undo2} tone="danger" onClick={() => { setReturningId(c.id); setReturnNote(''); }} disabled={isBusy}>Return</Btn>
                      )}
                      {canApprove && !editing && (
                        <Btn icon={CheckCircle2} tone="primary" onClick={() => handleApprove(c)} disabled={isBusy || completeness.over.length > 0 || rows.length === 0}
                          title={completeness.over.length > 0 ? 'Over quota: trim the slate first' : rows.length === 0 ? 'Nothing nominated yet' : 'Ratify this slate'}>
                          {isBusy ? 'Working' : 'Approve'}
                        </Btn>
                      )}
                    </div>
                  </div>

                  {!c.session_id && (
                    <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, marginBlockStart: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Radio size={12} /> No live session data: this committee has no linked session, so nominations carry no scoreboard evidence.
                    </p>
                  )}

                  {/* Slate editor */}
                  {editing ? (
                    <div style={{ marginBlockStart: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {slots.map((slot) => Array.from({ length: slot.perCommittee }, (_, i) => {
                        const key = `${slot.key}:${i}`;
                        const d = draft[key] ?? { allocationId: '', rationale: '' };
                        return (
                          <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(200px, 1.4fr) minmax(200px, 2fr)', gap: 10, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TierDot tier={slot.tier} />
                              <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: NEU.ink }}>
                                {slot.label}{slot.perCommittee > 1 ? ` ${i + 1}` : ''}
                              </span>
                            </div>
                            <select
                              value={d.allocationId}
                              onChange={(e) => setDraft((prev) => ({ ...prev, [key]: { ...d, allocationId: e.target.value } }))}
                              aria-label={`${slot.label} recipient`}
                              className="focus:outline-none"
                              style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`, borderRadius: 10, padding: '7px 10px', width: '100%' }}
                            >
                              <option value="">Nobody</option>
                              {committeeAllocs.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.country_name ?? a.country_code ?? 'Seat'}{allocationDisplayName(a) ? ` (${allocationDisplayName(a)})` : ' (unclaimed)'}
                                </option>
                              ))}
                            </select>
                            <input
                              value={d.rationale}
                              onChange={(e) => setDraft((prev) => ({ ...prev, [key]: { ...d, rationale: e.target.value } }))}
                              placeholder="Rationale (optional)"
                              aria-label={`${slot.label} rationale`}
                              className="focus:outline-none"
                              style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`, borderRadius: 10, padding: '7px 10px', width: '100%' }}
                            />
                          </div>
                        );
                      }))}
                      {extras.length > 0 && (
                        <div style={{ borderTop: `1px solid ${CARD_BORDER_COLOR}`, paddingBlockStart: 10 }}>
                          <Eyebrow>Beyond the quota</Eyebrow>
                          {extras.map((r) => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBlockStart: 6 }}>
                              <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, flex: 1 }}>{r.award_label}: {r.country_name ?? r.recipient_name}</span>
                              <Btn tone="danger" icon={X} onClick={() => removeExtra(r)}>Remove</Btn>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Btn icon={X} onClick={() => setEditingId(null)} disabled={isBusy}>Cancel</Btn>
                        <Btn tone="primary" icon={isBusy ? Loader2 : Save} onClick={() => saveEdit(c)} disabled={isBusy}>{isBusy ? 'Saving' : 'Save slate'}</Btn>
                      </div>
                    </div>
                  ) : (
                    <NominationList
                      rows={rows} config={config} allocationById={allocationById} board={board}
                    />
                  )}
                </NeuCard>
              );
            })}
          </div>

          {/* ── Delegation standings ── */}
          {delegationTypes.length > 0 && (
            <NeuCard style={{ padding: '18px 22px', marginBlockStart: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBlockEnd: 4 }}>
                <Building2 size={16} style={{ color: NEU.forest }} />
                <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink }}>Delegation standings</h2>
              </div>
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, marginBlockEnd: 12 }}>
                Committee honours tallied by school or society. Weights: {Object.entries(AWARD_WEIGHT).map(([k, w]) => `${config.types.find((t) => t.key === k)?.label ?? k} ${w}`).join(', ')}.
                {' '}Best Small Delegation is open to societies sending {SMALL_DELEGATION_MAX} delegates or fewer.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 12 }}>
                {delegationTypes.map((t) => {
                  const holder = awards.find((r) => r.award_type === t.key && r.society_id);
                  return (
                    <Chip key={t.key} title={t.description}>
                      <TierDot tier={t.tier} size={7} /> {t.label}: {holder ? `${holder.recipient_name ?? 'held'}${holder.status === 'published' ? ' (published)' : ''}` : 'not yet given'}
                    </Chip>
                  );
                })}
              </div>
              {standings.length === 0 ? (
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT }}>No committee honours are attached to a society yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: OUTFIT, fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ color: SOFT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>#</th>
                        <th style={{ padding: '6px 8px' }}>Society</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Delegates</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Honours</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Weighted</th>
                        <th style={{ padding: '6px 8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => (
                        <tr key={s.societyId} style={{ borderTop: `1px solid ${CARD_BORDER_COLOR}` }}>
                          <td style={{ padding: '8px', color: SOFT, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                          <td style={{ padding: '8px', color: NEU.ink, fontWeight: 700 }}>{s.societyName}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.delegates}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.honours}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: NEU.forest }}>{s.points}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {delegationTypes.map((t) => {
                                const holder = awards.find((r) => r.award_type === t.key && r.society_id);
                                const isHolder = holder?.society_id === s.societyId;
                                const tooBig = t.key === 'best-small-delegation' && s.delegates > SMALL_DELEGATION_MAX;
                                const locked = !!holder && holder.status === 'published' && !isHolder;
                                const k = `${t.key}:${s.societyId}`;
                                return (
                                  <Btn
                                    key={t.key}
                                    icon={Medal}
                                    tone={isHolder ? 'primary' : 'ghost'}
                                    disabled={isHolder || tooBig || locked || busy === k || !!publishedAt && !!holder}
                                    onClick={() => handleGiveDelegationAward(t, s.societyId, s.societyName)}
                                    title={isHolder ? `Holds ${t.label}` : tooBig ? `Too large for ${t.label} (${s.delegates} delegates)` : locked ? `${t.label} is already published` : holder ? `Move ${t.label} here` : `Give ${t.label}`}
                                  >
                                    {isHolder ? 'Holds' : holder ? 'Move' : 'Give'} {t.label}
                                  </Btn>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </NeuCard>
          )}
        </>
      )}

      {/* ── Return modal ── */}
      {returningId && (
        <ModalCard title="Return this slate to its chairs?" onClose={() => setReturningId(null)}>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, marginBlockEnd: 10 }}>
            The chairs will be able to edit and resubmit. Tell them what to change.
          </p>
          <textarea
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            rows={4}
            autoFocus
            placeholder="e.g. Two Honourable Mentions are over the quota, and the Best Delegate rationale is missing."
            className="focus:outline-none"
            style={{ width: '100%', fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, backgroundColor: NEU.base, border: `1px solid ${CARD_BORDER_COLOR}`, borderRadius: 12, padding: '10px 12px', resize: 'vertical', boxShadow: NEU.inSm }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBlockStart: 14 }}>
            <Btn onClick={() => setReturningId(null)}>Cancel</Btn>
            <Btn tone="danger" icon={Undo2} onClick={handleReturn} disabled={!returnNote.trim() || busy === returningId}>
              {busy === returningId ? 'Returning' : 'Return slate'}
            </Btn>
          </div>
        </ModalCard>
      )}

      {/* ── Publish modal ── */}
      {publishOpen && (
        <ModalCard title={`Publish awards for ${conference.acronym}?`} onClose={() => { if (busy !== 'publish') setPublishOpen(false); }}>
          <ul style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, display: 'flex', flexDirection: 'column', gap: 6, paddingInlineStart: 18, marginBlockEnd: 12 }}>
            <li>{publishCount} award{publishCount === 1 ? '' : 's'} across {publishCommittees} committee{publishCommittees === 1 ? '' : 's'}{publishable.some((r) => r.society_id) ? ' plus delegation awards' : ''}.</li>
            <li>{publishRecipients} recipient{publishRecipients === 1 ? '' : 's'} with a Gavelling account will get a verified MUN CV entry.</li>
            <li>
              {isPaid
                ? 'This is a paid conference, so Gavelling Points are minted for every recipient with an account.'
                : 'This is a free conference (no delegate fee), so no Gavelling Points are minted.'}
            </li>
            <li>Each recipient is emailed if the &quot;Award received&quot; email is turned on.</li>
          </ul>
          {!config.requireApproval && stateCounts.submitted + stateCounts.open + stateCounts.returned > 0 && (
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: AMBER_INK, marginBlockEnd: 10 }}>
              Approval is not required for this conference, so every nomination publishes, including from slates that were never submitted.
            </p>
          )}
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: RED, fontWeight: 700, marginBlockEnd: 16 }}>
            Delegates will be able to see their awards immediately. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setPublishOpen(false)} disabled={busy === 'publish'}>Cancel</Btn>
            <Btn tone="primary" icon={busy === 'publish' ? Loader2 : Send} onClick={handlePublish} disabled={busy === 'publish'}>
              {busy === 'publish' ? 'Publishing' : `Publish ${publishCount} award${publishCount === 1 ? '' : 's'}`}
            </Btn>
          </div>
        </ModalCard>
      )}
    </div>
  );
}

// ── Nomination list (read mode) ──────────────────────────────────────────────

function NominationList({
  rows, config, allocationById, board,
}: {
  rows: ConferenceAwardRow[];
  config: AwardsConfig;
  allocationById: Map<string, AllocationRow>;
  board: { rows: ScoreboardDelegateRow[]; rank: Map<string, number>; total: number } | null;
}) {
  if (rows.length === 0) {
    return <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, marginBlockStart: 12 }}>Nothing nominated yet.</p>;
  }
  const groups: { type: AwardTypeConfig | null; key: string; label: string; rows: ConferenceAwardRow[] }[] = [];
  for (const r of rows) {
    let g = groups.find((x) => x.key === r.award_type);
    if (!g) {
      const type = config.types.find((t) => t.key === r.award_type) ?? null;
      g = { type, key: r.award_type, label: type?.label ?? r.award_label, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  return (
    <div style={{ marginBlockStart: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map((g) => (
        <div key={g.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBlockEnd: 6 }}>
            <TierDot tier={g.type?.tier ?? 'special'} />
            <Eyebrow>{g.label}</Eyebrow>
            {g.type && g.rows.length > g.type.perCommittee && (
              <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, color: RED }}>over quota ({g.rows.length} of {g.type.perCommittee})</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.rows.map((r) => {
              const country = r.country_name ?? '';
              const evidence = board?.rows.find((x) => sameCountry(r.country_name, x.country)) ?? null;
              const rank = evidence ? board?.rank.get(evidence.country) ?? null : null;
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, backgroundColor: NEU.base, borderRadius: 12, padding: '9px 12px', boxShadow: NEU.inSm }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={flagFor(r.country_code, r.country_name)} alt="" width={22} height={22} style={{ width: 22, height: 22, flexShrink: 0, marginBlockStart: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink }}>
                      <strong>{country || r.recipient_name || 'Seat'}</strong>
                      <span style={{ color: SOFT }}> · {recipientNameFor(r, allocationById)}</span>
                      {r.status === 'published' && <span style={{ color: GREEN_INK, fontWeight: 700 }}> · published</span>}
                    </p>
                    {r.rationale && (
                      <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, fontStyle: 'italic', marginBlockStart: 2 }}>{r.rationale}</p>
                    )}
                    <div style={{ marginBlockStart: 6 }}>
                      {board ? <Evidence row={evidence} rank={rank} total={board.total} /> : <Chip>No live session data</Chip>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Honour roll (published rows, grouped by committee then award type) ───────

function HonourRoll({
  rows, config, committees, allocationById, committeeLabel,
}: {
  rows: ConferenceAwardRow[];
  config: AwardsConfig;
  committees: CommitteeRow[];
  allocationById: Map<string, AllocationRow>;
  committeeLabel: (id: string | null) => string;
}) {
  if (rows.length === 0) {
    return <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT }}>No awards have been published yet.</p>;
  }
  const order = new Map(config.types.map((t, i) => [t.key, i]));
  const groupIds: (string | null)[] = [
    ...committees.map((c) => c.id).filter((id) => rows.some((r) => r.conference_committee_id === id)),
    ...(rows.some((r) => !r.conference_committee_id) ? [null] : []),
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {groupIds.map((id) => {
        const list = rows
          .filter((r) => r.conference_committee_id === id)
          .sort((a, b) => (order.get(a.award_type) ?? 99) - (order.get(b.award_type) ?? 99) || a.position - b.position);
        return (
          <div key={id ?? 'conference'} style={{ backgroundColor: NEU.base, borderRadius: 12, padding: '10px 12px', boxShadow: NEU.inSm }}>
            <Eyebrow>{id ? committeeLabel(id) : 'Delegation awards'}</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBlockStart: 6 }}>
              {list.map((r) => {
                const type = config.types.find((t) => t.key === r.award_type);
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: OUTFIT, fontSize: 12.5 }}>
                    <TierDot tier={type?.tier ?? 'special'} size={7} />
                    {r.society_id ? (
                      <Building2 size={14} style={{ color: SOFT, flexShrink: 0 }} />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={flagFor(r.country_code, r.country_name)} alt="" width={16} height={16} style={{ width: 16, height: 16, flexShrink: 0 }} />
                    )}
                    <span style={{ color: SOFT, minWidth: 0, flexShrink: 0 }}>{r.award_label}</span>
                    <span style={{ color: NEU.ink, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.society_id ? r.recipient_name : `${r.country_name ?? ''}, ${recipientNameFor(r, allocationById)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
