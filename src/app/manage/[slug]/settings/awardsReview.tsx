'use client';

// ── Settings → Awards → Review and Publish (12 Oct 2026) ────────────────────
// The secretariat's half of awards, under the award editor. Chairs nominate
// and submit a slate per committee (participant/AwardsCard.tsx); here the
// organisers read each slate, approve it or return it with a note, and then
// publish the whole conference at once.
//
// Every read and write goes through src/lib/awardsService.ts:
//   approveSlate  → approve_committee_awards   (stamps approved, rows nominated → approved)
//   returnSlate   → return_committee_awards    (clears the stamps, approved → nominated, stores the note)
//   publishAwards → publish_conference_awards  (approved rows, or every unpublished row when
//                   requireApproval is off, → published; one gavelling_verified MUN CV entry per
//                   recipient with an account; stamps awards_published_at once). Idempotent:
//                   only rows not yet published are touched, so late additions republish safely.
// None of the three sends email. Shown only once awards are set up.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Award, CheckCircle2, ChevronDown, CircleDashed, ClipboardList, ExternalLink, Inbox,
  Loader2, PartyPopper, PenLine, Undo2,
} from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { Emoji3D } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import { CircleFlag, flagMonogram } from '@/components/CircleFlag';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  committeeSlots, configForCommittee, slateCompleteness, slateState, SLATE_STATE_LABEL,
  type AwardsConfig, type ConferenceAwardRow,
} from '@/lib/awards';
import { approveSlate, loadConferenceAwards, publishAwards, returnSlate } from '@/lib/awardsService';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { committeeDisplayName } from '@/lib/presetNames';
import { F, INK, INK_SOFT, FOREST, AMBER, DANGER, INPUT, TINT_GOLD_BG, TINT_GREEN_BG } from './panelKit';

const NOTE_MAX = 500;
const SCOPE = 'settings-awards-review';

export interface CommitteeRow {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  awards_submitted_at: string | null;
  awards_approved_at: string | null;
  awards_return_note: string | null;
}

/** The six states a committee's slate can be in, as the organiser reads them. */
type ReviewState = 'not-started' | 'nominating' | 'submitted' | 'returned' | 'approved' | 'published';

const STATE_VIEW: Record<ReviewState, { label: string; emoji: string; icon: typeof Award; color: string }> = {
  'not-started': { label: 'Not started', emoji: 'Hourglass not done', icon: CircleDashed, color: INK_SOFT },
  nominating: { label: 'Nominating', emoji: 'Memo', icon: PenLine, color: INK_SOFT },
  submitted: { label: SLATE_STATE_LABEL.submitted, emoji: 'Inbox tray', icon: Inbox, color: AMBER },
  returned: { label: SLATE_STATE_LABEL.returned, emoji: 'Right arrow curving left', icon: Undo2, color: DANGER },
  approved: { label: SLATE_STATE_LABEL.approved, emoji: 'Check mark button', icon: CheckCircle2, color: '#2A5A3C' },
  published: { label: SLATE_STATE_LABEL.published, emoji: 'Party popper', icon: PartyPopper, color: FOREST },
};

/** Listing order: what needs the organiser first. */
const STATE_ORDER: Record<ReviewState, number> = {
  submitted: 0, approved: 1, nominating: 2, returned: 3, 'not-started': 4, published: 5,
};

/**
 * Per committee, not per conference: `slateState` answers 'published' for
 * every committee once the conference has published at all, which would hide
 * a late slate. A committee is published when it has awards and all of them
 * are published; otherwise its own stamps decide.
 */
function reviewState(c: CommitteeRow, rows: ConferenceAwardRow[], config: AwardsConfig): ReviewState {
  if (rows.length > 0 && rows.every((r) => r.status === 'published')) return 'published';
  const s = slateState(c, null, { ...config, enabled: true });
  if (s === 'open' || s === 'off') return rows.length > 0 ? 'nominating' : 'not-started';
  if (s === 'published') return 'published';
  return s;
}

/** Service errors are either our own sentences or raw database text. */
function humanize(err: string, fallback: string): string {
  if (/^(This|That|You|Your) /.test(err)) return err;
  return friendlyError(new Error(err), fallback);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const REVIEW_CSS = `
.gv-rv-list{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.gv-rv-row{border-radius:16px;background:#FBF8F0;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.08);transition:box-shadow 160ms ease}
.gv-rv-row[data-needs="true"]{background:linear-gradient(160deg,rgba(238,217,138,0.22),rgba(238,217,138,0.06)),#FFFFFF;box-shadow:inset 0 0 0 2px rgba(182,135,31,0.75),0 12px 26px -22px rgba(138,102,20,0.6)}
.gv-rv-row[data-open="true"]{background:#FFFFFF}
.gv-rv-head{display:flex;align-items:center;gap:12px;width:100%;text-align:start;background:none;border:none;cursor:pointer;padding:12px 14px;border-radius:16px;font-family:${F}}
.gv-rv-head:focus{outline:none}
.gv-rv-head:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-rv-chev{transition:transform 180ms ease;color:${INK_SOFT};flex-shrink:0}
.gv-rv-head[aria-expanded="true"] .gv-rv-chev{transform:rotate(180deg)}
.gv-rv-body{padding:2px 16px 16px}
.gv-rv-rec{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:#FBF8F0}
.gv-rv-recs{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.gv-rv-meta{display:flex;align-items:center;gap:14px;flex-shrink:0}
@media (max-width:620px){.gv-rv-head{flex-wrap:wrap}.gv-rv-meta{width:100%;justify-content:space-between;padding-inline-start:56px}}
@media (prefers-reduced-motion: reduce){.gv-rv-chev,.gv-rv-row{transition:none}}
`;

function OverhangDisc({ emoji, icon, tint = TINT_GOLD_BG, size = 56 }: { emoji: string; icon: typeof Award; tint?: string; size?: number }) {
  return (
    <span aria-hidden className="gv-fd-disc absolute" style={{ top: -24, insetInlineStart: 18, width: size, height: size, borderRadius: Math.round(size * 0.32), background: tint }}>
      <Emoji3D name={emoji} size={Math.round(size * 0.66)} fallback={icon} fallbackColor={FOREST} />
    </span>
  );
}

function StateMark({ state }: { state: ReviewState }) {
  const v = STATE_VIEW[state];
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: v.color, whiteSpace: 'nowrap' }}>
      <Emoji3D name={v.emoji} size={20} fallback={v.icon} fallbackColor={v.color} />
      {v.label}
    </span>
  );
}

function RecipientCard({ row, awardLabel }: { row: ConferenceAwardRow; awardLabel: string }) {
  const person = row.recipient_name?.trim() || '';
  const place = row.country_name?.trim() || '';
  const big = person || place || 'Unclaimed seat';
  const small = person && place ? place : person ? '' : 'Name not known yet';
  return (
    <div className="gv-rv-rec">
      {row.country_code || place ? (
        <CircleFlag code={row.country_code} country={place || null} size={40} decorative />
      ) : (
        <span aria-hidden className="inline-flex items-center justify-center shrink-0"
          style={{ width: 40, height: 40, borderRadius: 999, background: FOREST, color: '#EED98A', fontFamily: F, fontSize: 14, fontWeight: 800 }}>
          {flagMonogram(big)}
        </span>
      )}
      <div className="min-w-0" style={{ fontFamily: F }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: AMBER, overflowWrap: 'anywhere' }}>{awardLabel}</p>
        <p style={{ fontSize: 15.5, fontWeight: 800, color: INK, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{big}</p>
        {small && <p style={{ fontSize: 12.5, color: INK_SOFT, overflowWrap: 'anywhere' }}>{small}</p>}
      </div>
    </div>
  );
}

// ── One committee ───────────────────────────────────────────────────────────

function CommitteeSlate({ committee, rows, config, state, open, onToggle, busy, onApprove, onReturn }: {
  committee: CommitteeRow;
  rows: ConferenceAwardRow[];
  config: AwardsConfig;
  state: ReviewState;
  open: boolean;
  onToggle: () => void;
  busy: boolean;
  onApprove: () => void;
  onReturn: (note: string) => Promise<boolean>;
}) {
  const cfg = configForCommittee(config, committee.id);
  const slots = committeeSlots(cfg);
  const done = slateCompleteness(rows, cfg);
  const short = committeeDisplayName(committee.name, committee.abbreviation);
  const labelFor = (r: ConferenceAwardRow) => cfg.types.find((t) => t.key === r.award_type)?.label ?? r.award_label;
  const order = new Map(cfg.types.map((t, i) => [t.key, i]));
  const sorted = [...rows].sort((a, b) =>
    (order.get(a.award_type) ?? 99) - (order.get(b.award_type) ?? 99) || a.position - b.position || a.created_at.localeCompare(b.created_at));

  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const bodyId = `rv-body-${committee.id}`;
  const noteId = `rv-note-${committee.id}`;

  const sendBack = async () => {
    const v = note.trim();
    if (!v) { setNoteError('Write a short note so the chairs know what to change.'); return; }
    const ok = await onReturn(v);
    if (ok) { setReturning(false); setNote(''); setNoteError(''); }
  };

  const canApprove = state === 'submitted' || (state === 'nominating' && rows.length > 0) || state === 'returned';
  const canReturn = state === 'submitted' || state === 'approved';

  return (
    <li className="gv-rv-row" data-needs={state === 'submitted' ? 'true' : undefined} data-open={open ? 'true' : undefined}>
      <button type="button" className="gv-rv-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <LogoDisc src={committee.logo_url} size={44} fallbackText={(committee.abbreviation || short).slice(0, 3)} alt="" />
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontSize: 16.5, fontWeight: 800, color: INK, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{short}</span>
          {short !== committee.name && (
            <span className="block" style={{ fontSize: 12.5, color: INK_SOFT, overflowWrap: 'anywhere' }}>{committee.name}</span>
          )}
        </span>
        <span className="gv-rv-meta">
          <span style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{done.filled}</span> of {done.total}
          </span>
          <StateMark state={state} />
          <ChevronDown size={18} strokeWidth={2.4} className="gv-rv-chev" aria-hidden />
        </span>
      </button>

      {open && (
        <div id={bodyId} className="gv-rv-body" style={{ fontFamily: F }}>
          {state === 'returned' && committee.awards_return_note && (
            <p className="mb-3" style={{ fontSize: 13.5, color: INK, background: 'rgba(139,32,32,0.06)', borderRadius: 10, padding: '8px 12px', overflowWrap: 'anywhere' }}>
              <strong style={{ color: DANGER }}>Your note to the chairs: </strong>{committee.awards_return_note}
            </p>
          )}

          {sorted.length === 0 ? (
            <p style={{ fontSize: 14, color: INK_SOFT }}>The chairs have not nominated anyone yet.</p>
          ) : (
            <div className="gv-rv-recs">
              {sorted.map((r) => <RecipientCard key={r.id} row={r} awardLabel={labelFor(r)} />)}
            </div>
          )}

          {slots.length > 0 && done.missing.length > 0 && rows.length > 0 && (
            <p className="mt-3" style={{ fontSize: 13, color: INK_SOFT }}>Still empty: {done.missing.join(', ')}</p>
          )}
          {done.over.length > 0 && (
            <p className="mt-1" style={{ fontSize: 13, color: DANGER }}>More than the set allows: {done.over.join(', ')}</p>
          )}

          {state !== 'published' && (canApprove || canReturn) && (
            returning ? (
              <div className="mt-4">
                <label htmlFor={noteId} style={{ fontSize: 13, fontWeight: 700, color: INK }}>What should the chairs change?</label>
                <textarea
                  id={noteId}
                  value={note}
                  maxLength={NOTE_MAX}
                  rows={3}
                  autoFocus
                  placeholder="Please give the Best Delegate award to a delegate who spoke more often."
                  onChange={(e) => { setNote(e.target.value); if (noteError) setNoteError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setReturning(false); } }}
                  aria-describedby={noteError ? `${noteId}-err` : undefined}
                  aria-invalid={!!noteError}
                  style={{ ...INPUT, width: '100%', marginTop: 6, minHeight: 84, fontSize: 14.5, resize: 'vertical' }}
                />
                {noteError && <p id={`${noteId}-err`} role="alert" style={{ fontSize: 13, color: DANGER, marginTop: 4 }}>{noteError}</p>}
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <button type="button" className="gv-st-btn gv-st-forest" disabled={busy} onClick={() => void sendBack()}>
                    {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}Send back to the chairs
                  </button>
                  <button type="button" className="gv-st-link" onClick={() => { setReturning(false); setNoteError(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                {canApprove && (
                  <button type="button" className="gv-st-btn gv-st-forest" disabled={busy || rows.length === 0} onClick={onApprove}>
                    {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
                    {state === 'submitted' ? 'Approve' : 'Approve as it is'}
                  </button>
                )}
                {canReturn && (
                  <button type="button" className="gv-st-link" disabled={busy} onClick={() => setReturning(true)}>Return with a note</button>
                )}
                {state === 'approved' && (
                  <span style={{ fontSize: 13.5, color: INK_SOFT }}>Approved. It goes out when you publish.</span>
                )}
                {(state === 'nominating' || state === 'returned') && (
                  <span style={{ fontSize: 13.5, color: INK_SOFT }}>Waiting for the chairs to submit.</span>
                )}
              </div>
            )
          )}
          {state === 'not-started' && (
            <p className="mt-2" style={{ fontSize: 13.5, color: INK_SOFT }}>Chairs nominate from their conference page.</p>
          )}
        </div>
      )}
    </li>
  );
}

// ── The data ────────────────────────────────────────────────────────────────

export function AwardsReview({ conference, config }: { conference: Conference; config: AwardsConfig }) {
  const { refreshConferenceQuiet } = useManage();
  const [committees, setCommittees] = useState<CommitteeRow[] | null>(null);
  const [awards, setAwards] = useState<ConferenceAwardRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [localPublishedAt, setLocalPublishedAt] = useState<string | null>(null);
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const s = await getFreshAuthedClient();
      if (!s) { if (seq === seqRef.current) setLoadError('Sign in again to see the slates.'); return; }
      const [cRes, rows] = await Promise.all([
        s.from('conference_committees')
          .select('id, name, abbreviation, logo_url, awards_submitted_at, awards_approved_at, awards_return_note')
          .eq('conference_id', conference.id)
          .order('name', { ascending: true }),
        loadConferenceAwards(s, conference.id),
      ]);
      if (seq !== seqRef.current) return;
      if (cRes.error) { setLoadError(friendlyError(cRes.error, 'The slates could not be loaded. Try again in a moment.')); return; }
      setLoadError('');
      setCommittees((cRes.data ?? []) as CommitteeRow[]);
      setAwards(rows);
    } catch (e) {
      if (seq === seqRef.current) setLoadError(friendlyError(e, 'The slates could not be loaded. Try again in a moment.'));
    }
  }, [conference.id]);

  useEffect(() => { void load(); }, [load]);

  const approve = async (c: CommitteeRow) => {
    setBusyId(c.id);
    try {
      const s = await getFreshAuthedClient();
      const err = s ? await approveSlate(s, c.id) : 'Your session has expired. Sign in again and retry.';
      if (err) { notifyErr(humanize(err, 'The slate was not approved. Try again in a moment.'), SCOPE); return; }
      notifyOk(`${committeeDisplayName(c.name, c.abbreviation)} approved`, SCOPE);
      await load();
    } catch (e) {
      notifyErr(friendlyError(e, 'The slate was not approved. Try again in a moment.'), SCOPE);
    } finally {
      setBusyId(null);
    }
  };

  const sendBack = async (c: CommitteeRow, note: string): Promise<boolean> => {
    setBusyId(c.id);
    try {
      const s = await getFreshAuthedClient();
      const err = s ? await returnSlate(s, c.id, note.slice(0, NOTE_MAX)) : 'Your session has expired. Sign in again and retry.';
      if (err) { notifyErr(humanize(err, 'The slate was not sent back. Try again in a moment.'), SCOPE); return false; }
      notifyOk(`Sent back to the ${committeeDisplayName(c.name, c.abbreviation)} chairs`, SCOPE);
      await load();
      return true;
    } catch (e) {
      notifyErr(friendlyError(e, 'The slate was not sent back. Try again in a moment.'), SCOPE);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  /** Resolves true when the awards were published (the confirmation then closes). */
  const publish = async (): Promise<boolean> => {
    setPublishing(true);
    try {
      const s = await getFreshAuthedClient();
      if (!s) { notifyErr('Your session has expired. Sign in again and retry.', SCOPE); return false; }
      const { result, error } = await publishAwards(s, conference.id);
      if (error || !result) { notifyErr(humanize(error ?? '', 'The awards were not published. Try again in a moment.'), SCOPE); return false; }
      setLocalPublishedAt((p) => p ?? new Date().toISOString());
      notifyOk(result.awards === 1 ? '1 award published' : `${result.awards} awards published`, SCOPE);
      await Promise.all([load(), refreshConferenceQuiet()]);
      return true;
    } catch (e) {
      notifyErr(friendlyError(e, 'The awards were not published. Try again in a moment.'), SCOPE);
      return false;
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AwardsReviewView
      slug={conference.slug}
      config={config}
      committees={committees}
      awards={awards}
      loadError={loadError}
      publishedAt={conference.awards_published_at ?? localPublishedAt}
      busyId={busyId}
      publishing={publishing}
      onRetry={() => void load()}
      onApprove={(c) => void approve(c)}
      onReturn={sendBack}
      onPublish={publish}
    />
  );
}

// ── The view (pure: everything comes in as props) ───────────────────────────

export function AwardsReviewView({
  slug, config, committees, awards, loadError, publishedAt, busyId, publishing,
  onRetry, onApprove, onReturn, onPublish,
}: {
  slug: string;
  config: AwardsConfig;
  committees: CommitteeRow[] | null;
  awards: ConferenceAwardRow[];
  loadError: string;
  publishedAt: string | null;
  busyId: string | null;
  publishing: boolean;
  onRetry: () => void;
  onApprove: (c: CommitteeRow) => void;
  onReturn: (c: CommitteeRow, note: string) => Promise<boolean>;
  onPublish: () => Promise<boolean>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const byCommittee = useMemo(() => {
    const m = new Map<string, ConferenceAwardRow[]>();
    for (const r of awards) {
      if (!r.conference_committee_id) continue;
      const list = m.get(r.conference_committee_id) ?? [];
      list.push(r);
      m.set(r.conference_committee_id, list);
    }
    return m;
  }, [awards]);

  const listed = useMemo(() => {
    const all = (committees ?? []).map((c) => {
      const rows = byCommittee.get(c.id) ?? [];
      return { c, rows, state: reviewState(c, rows, config) };
    });
    return all.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]
      || committeeDisplayName(a.c.name, a.c.abbreviation).localeCompare(committeeDisplayName(b.c.name, b.c.abbreviation)));
  }, [committees, byCommittee, config]);

  // What publish would take, mirroring publish_conference_awards exactly:
  // every row not yet published that is approved (or any, when approval is off).
  const publishable = useMemo(
    () => awards.filter((r) => r.status !== 'published' && (config.requireApproval ? r.status === 'approved' : true)),
    [awards, config.requireApproval],
  );
  const publishCommittees = new Set(publishable.map((r) => r.conference_committee_id ?? 'delegation')).size;
  const notApproved = config.requireApproval
    ? listed.filter((x) => x.state !== 'approved' && x.state !== 'published').length
    : 0;
  const needYou = listed.filter((x) => x.state === 'submitted').length;
  const publishedCount = awards.filter((r) => r.status === 'published').length;

  const honourRoll = `/conferences/${slug}/awards`;
  const committeesWord = (n: number) => (n === 1 ? '1 committee' : `${n} committees`);
  const waitLine = notApproved === 1
    ? '1 committee is not approved yet. It waits, and you can publish it later.'
    : `${notApproved} committees are not approved yet. They wait, and you can publish them later.`;

  let summary: string;
  if (committees === null) summary = 'Loading the slates';
  else if (committees.length === 0) summary = 'Add committees first. Their chairs nominate, then you approve here.';
  else if (needYou > 0) summary = needYou === 1 ? '1 slate is waiting for you.' : `${needYou} slates are waiting for you.`;
  else summary = 'Open a committee to see who its chairs nominated.';

  return (
    <div className="flex flex-col gap-5" style={{ marginTop: 14 }}>
      <style>{REVIEW_CSS}</style>

      <section className="gv-st-card gv-fd-card relative" aria-labelledby="rv-title"
        style={{ paddingTop: 44, marginTop: 24, background: 'radial-gradient(120% 90% at 100% 0%, rgba(61,122,82,0.10) 0%, rgba(61,122,82,0) 55%), #FFFFFF' }}>
        <OverhangDisc emoji="Clipboard" icon={ClipboardList} tint={TINT_GREEN_BG} />
        <h2 id="rv-title" style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>Review and Publish</h2>
        <p className="mt-1" style={{ fontFamily: F, fontSize: 14, color: INK_SOFT }}>{summary}</p>

        {loadError ? (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <p role="alert" style={{ fontFamily: F, fontSize: 14, color: DANGER }}>{loadError}</p>
            <button type="button" className="gv-st-link" onClick={onRetry}>Try again</button>
          </div>
        ) : committees === null ? (
          <div className="gv-rv-list" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 68, borderRadius: 16, background: 'rgba(27,56,40,0.06)' }} />)}
          </div>
        ) : listed.length > 0 && (
          <ul className="gv-rv-list" aria-label="Committee slates">
            {listed.map(({ c, rows, state }) => (
              <CommitteeSlate
                key={c.id}
                committee={c}
                rows={rows}
                config={config}
                state={state}
                open={openId === c.id}
                onToggle={() => setOpenId((id) => (id === c.id ? null : c.id))}
                busy={busyId === c.id}
                onApprove={() => onApprove(c)}
                onReturn={(note) => onReturn(c, note)}
              />
            ))}
          </ul>
        )}
      </section>

      {committees !== null && committees.length > 0 && !loadError && (
        <section className="gv-st-card gv-fd-card relative" aria-labelledby="rv-publish-title"
          style={{ paddingTop: 44, marginTop: 24, background: publishedAt
            ? 'radial-gradient(120% 90% at 100% 0%, rgba(61,122,82,0.14) 0%, rgba(61,122,82,0) 55%), #FFFFFF'
            : 'radial-gradient(120% 90% at 100% 0%, rgba(238,217,138,0.30) 0%, rgba(238,217,138,0) 55%), #FFFFFF' }}>
          <OverhangDisc emoji="Party popper" icon={PartyPopper} tint={publishedAt ? TINT_GREEN_BG : TINT_GOLD_BG} />
          <h2 id="rv-publish-title" style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>
            {publishedAt ? 'Awards Published' : 'Publish Awards'}
          </h2>
          <div className="mt-1 flex flex-col gap-1" style={{ fontFamily: F, fontSize: 14, color: INK_SOFT }}>
            {publishedAt && (
              <p>
                <span style={{ fontSize: 18, fontWeight: 800, color: FOREST, fontVariantNumeric: 'tabular-nums' }}>{publishedCount}</span>
                {' '}{publishedCount === 1 ? 'award' : 'awards'} published on {fmtDate(publishedAt)}. Winners see them on their MUN CV.
              </p>
            )}
            {publishable.length > 0 ? (
              <p>{publishedAt ? 'New awards are ready from ' : 'Ready to publish: '}{committeesWord(publishCommittees)}.</p>
            ) : !publishedAt ? (
              <p>{config.requireApproval ? 'Approve a slate first, then publish.' : 'Nothing to publish yet.'}</p>
            ) : null}
            {notApproved > 0 && (publishable.length > 0 || !publishedAt) && <p>{waitLine}</p>}
          </div>

          <div className="mt-4 flex items-center gap-4 flex-wrap">
            {(publishable.length > 0 || !publishedAt) && (
              <button type="button" className="gv-st-btn gv-st-forest" disabled={publishable.length === 0 || publishing} onClick={() => setConfirming(true)}>
                {publishedAt ? 'Publish new awards' : 'Publish awards'}
              </button>
            )}
            {publishedAt && (
              <Link href={honourRoll} target="_blank" rel="noopener" className="gv-st-link inline-flex items-center gap-1.5">
                See the honour roll<ExternalLink size={14} strokeWidth={2.4} aria-hidden />
              </Link>
            )}
          </div>
        </section>
      )}

      {confirming && (
        <ConfirmModal
          title="Publish Awards"
          body={
            <>
              <p>
                Publish awards for {committeesWord(publishCommittees)}? Winners see them on their MUN CV and the public honour roll. This can&apos;t be undone.
              </p>
              {notApproved > 0 && (
                <p style={{ marginTop: 8 }}>
                  {notApproved === 1 ? '1 committee is' : `${notApproved} committees are`} not approved yet and will wait.
                </p>
              )}
            </>
          }
          confirmLabel="Publish awards"
          cancelLabel="Not yet"
          loading={publishing}
          onConfirm={() => { void onPublish().then((ok) => { if (ok) setConfirming(false); }); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
