// ============================================================
// src/lib/sessionRecordExport.ts
//
// "DOWNLOAD THE RECORD" (23 Sep 2026). A standalone room is deleted an hour after End
// Debate (and 36 / 72 hours after a suspension that nobody resumes), and with it every
// speech, motion, note and score. This builds the whole record as ONE Excel workbook the
// chair can keep, from what the chair page already holds plus two reads:
//   • the chair notes (`getFeedbackForCommittee`, the same read the scoreboard makes);
//   • the roll-call timeline (`delegate_status_history`, chair-gated on the suffix header),
//     falling back to the current statuses when it is refused or missing.
//
// Sheets: History, Scores, Per motion, Speeches, Attendance, Documents.
//
// Nothing here scores anything: the numbers are `buildSessionScoreboardRows` (the chair's
// own board), the timeline is `buildSessionHistory` (the History tab), so the file can never
// disagree with the screen. The workbook library (`xlsx`, already a dependency for the
// organiser import) is loaded lazily, only when someone asks for the file.
//
// Column headers and labels are English, like the CSV this replaces; delegation names are
// the English display names. It writes nothing.
// ============================================================

import type { Committee, CommitteeDocument } from './types';
import { getFeedbackForCommittee, type FeedbackEntry } from './committeeService';
import { buildSessionScoreboardRows, sessionPointSlices } from './sessionScoreboard';
import { buildSessionHistory, speechKey, type HistoryEvent, type HistoryMotion, type HistorySegment, type SegmentKind } from './sessionHistory';
import { describeMotion } from './motionLog';
import { getCountryDisplayName } from './countries';
import { docName } from './docNames';
import { loadVoteStates, type VoteStateV1 } from './voteState';
import { sessionClient } from './sessionClient';
import type { LedgerRow } from './scoring';

type Row = Record<string, string | number | null>;

const SEGMENT_LABEL: Record<SegmentKind, string> = {
  'speakers-list': "General Speakers' List",
  'moderated-caucus': 'Moderated caucus',
  'unmoderated-caucus': 'Unmoderated caucus',
  consultation: 'Consultation of the Whole',
  'tour-de-table': 'Tour de Table',
  other: 'On the floor',
};

const EVENT_LABEL: Record<string, string> = {
  'right-of-reply': 'Right of reply',
  'manual-award': 'Points awarded',
  'manual-deduct': 'Points deducted',
  'wp-sponsor': 'Working paper sponsor',
  'dr-sponsor': 'Draft resolution sponsor',
  'dr-passed': 'Draft resolution passed',
  attendance: 'Attendance',
};

const OUTCOME: Record<HistoryMotion['status'], string> = {
  pending: 'On the floor', passed: 'Passed', rejected: 'Rejected', failed: 'Did not pass', fell: 'Fell', unknown: '',
};

const name = (country: string) => (country === '__chair__' ? 'Chair' : getCountryDisplayName(country, 'en'));
const mmss = (s: number | undefined | null) => {
  if (s == null || !Number.isFinite(s)) return '';
  const n = Math.max(0, Math.round(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};
const when = (iso: string | undefined | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  // Local time, sortable, readable in any spreadsheet.
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const notesText = (notes: { chairName: string; content: string }[] | undefined) =>
  (notes ?? []).map((n) => (n.chairName ? `${n.chairName}: ${n.content}` : n.content)).join(' | ');

function motionText(committee: Committee, m: HistoryMotion | undefined): string {
  if (!m) return '';
  if (m.legacy) return 'Motion (type not recorded)';
  return describeMotion(committee, m, 'en') ?? (m.motionType ?? 'Motion');
}

function segmentName(seg: HistorySegment): string {
  const label = SEGMENT_LABEL[seg.kind] ?? seg.kind;
  return seg.topic && seg.kind !== 'speakers-list' ? `${label}: ${seg.topic}` : label;
}

async function statusHistory(committee: Committee): Promise<Row[]> {
  try {
    const { data, error } = await sessionClient(committee.code, committee.dbChairJoinSuffix ?? undefined)
      .rpc('delegate_status_history', { p_committee: committee.id });
    const d = data as { ok?: boolean; rows?: { country: string; status: string; is_observer: boolean; kind: string; at: string }[] } | null;
    if (!error && d?.ok && Array.isArray(d.rows) && d.rows.length) {
      return d.rows.map((r) => ({
        Time: when(r.at), Delegation: name(r.country), Status: statusWord(r.status),
        Observer: r.is_observer ? 'Yes' : '', Change: r.kind ?? '',
      }));
    }
  } catch { /* fall back below */ }
  return committee.delegates.map((dl) => ({
    Time: 'Now (no roll-call history)', Delegation: name(dl.country), Status: statusWord(dl.status),
    Observer: dl.isObserver ? 'Yes' : '', Change: '',
  }));
}

function statusWord(s: string): string {
  return s === 'present-voting' ? 'Present and voting' : s === 'present' ? 'Present' : s === 'absent' ? 'Absent' : s;
}

function voteSummary(v: VoteStateV1 | undefined): Row {
  if (!v) return { 'Vote result': '', For: '', Against: '', Abstain: '', 'Voted by': '' };
  const n = (pred: (c: string) => boolean) => v.votes.filter((x) => pred(x.choice)).length;
  return {
    'Vote result': v.status !== 'result' ? 'Vote in progress'
      : v.vetoed ? 'Vetoed' : v.result === 'passed' ? 'Passed' : v.result === 'failed' ? 'Failed' : '',
    For: n((c) => c === 'for' || c === 'for-rights'),
    Against: n((c) => c === 'against' || c === 'against-rights'),
    Abstain: n((c) => c === 'abstain'),
    'Voted by': v.method === 'device' ? 'Own devices' : 'Roll call',
  };
}

/** Build the workbook and hand it to the browser as "<CODE> <committee> record.xlsx". */
export async function downloadSessionRecord(committee: Committee, feedbackIn?: FeedbackEntry[]): Promise<void> {
  const [XLSX, feedback, attendance, votes] = await Promise.all([
    import('xlsx'),
    feedbackIn ? Promise.resolve(feedbackIn) : getFeedbackForCommittee(committee.id, { code: committee.code, chairSuffix: committee.dbChairJoinSuffix ?? undefined }),
    statusHistory(committee),
    loadVoteStates(committee.id).then((v) => v ?? {}),
  ]);

  const rows = buildSessionScoreboardRows(committee, feedback, 'en');
  const segments = [...buildSessionHistory(committee, feedback)].reverse(); // oldest first

  // Every ledger row of every delegation, found by what it is.
  const speechPts = new Map<string, number>();
  const motionPts = new Map<string, LedgerRow[]>();
  for (const r of rows) for (const l of r.ledger) {
    if (l.type === 'speech') speechPts.set(speechKey(l.country, l.timestamp, l.context, l.seconds), l.pts);
    const id = l.motion?.motionId;
    if (id) { const a = motionPts.get(id); if (a) a.push(l); else motionPts.set(id, [l]); }
  }

  // ── History + Speeches ────────────────────────────────────────────────────
  const history: Row[] = [];
  const speeches: Row[] = [];
  type Item = { at: string; row: Row };
  for (const seg of segments) {
    const items: Item[] = [];
    const segName = segmentName(seg);
    for (const sp of seg.speeches) {
      const pts = speechPts.get(speechKey(sp.country, sp.timestamp, sp.context, sp.seconds));
      items.push({ at: sp.timestamp, row: {
        Time: when(sp.timestamp), Segment: segName, Type: 'Speech', Delegation: name(sp.country),
        Duration: mmss(sp.seconds), Seconds: sp.seconds, Motion: '', Outcome: '',
        Points: pts ?? '', 'Chair comments': notesText(sp.notes),
      } });
      speeches.push({
        Time: when(sp.timestamp), Delegation: name(sp.country), Segment: segName,
        Topic: sp.topic, Duration: mmss(sp.seconds), Seconds: sp.seconds,
        Points: pts ?? '', 'Chair comments': notesText(sp.notes),
      });
    }
    for (const ev of seg.events) items.push({ at: ev.timestamp, row: eventRow(committee, segName, ev) });
    items.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
    history.push(...items.map((i) => i.row));
  }

  // ── Scores ────────────────────────────────────────────────────────────────
  const sourceLabels: string[] = [];
  const scoreRows: Row[] = [...rows].sort((a, b) => b.headline - a.headline).map((r) => {
    const out: Row = {
      Delegation: name(r.country), Observer: r.isObserver ? 'Yes' : '',
      Score: r.headline, 'Points (objective)': r.objective, 'Quality /100': r.quality ?? '',
      'GSL speeches': r.gslSpeeches, 'Caucus speeches': r.caucusSpeeches,
      'Speaking time': mmss(r.speakingSeconds), 'Speaking (s)': r.speakingSeconds,
      Motions: r.motions, 'Rights of reply': r.rightsOfReply,
      'Working papers': r.workingPapers, 'Draft resolutions': r.draftResolutions, 'Manual ±': r.manual,
    };
    for (const sl of sessionPointSlices(committee, r.ledger, 'en', 'Manual adjustments')) {
      const key = `Pts: ${sl.label}`;
      if (!sourceLabels.includes(key)) sourceLabels.push(key);
      out[key] = ((out[key] as number) || 0) + sl.pts;
    }
    for (const f of r.factors) out[`Rating: ${f.name}`] = `${f.average} / ${f.scaleMax}`;
    return out;
  });

  // ── Per motion ────────────────────────────────────────────────────────────
  const perMotion: Row[] = [];
  const seen = new Set<HistoryMotion>();
  for (const seg of segments) {
    for (const ev of seg.events) {
      if (ev.type !== 'motion' || !ev.motion || seen.has(ev.motion)) continue;
      seen.add(ev.motion);
      const m = ev.motion;
      const opened = segments.find((s) => s.motion === m);
      const pts = new Map<string, number>();
      for (const l of m.motionId ? motionPts.get(m.motionId) ?? [] : []) pts.set(l.country, (pts.get(l.country) ?? 0) + l.pts);
      for (const sp of opened?.speeches ?? []) {
        const p = speechPts.get(speechKey(sp.country, sp.timestamp, sp.context, sp.seconds)) ?? 0;
        pts.set(sp.country, (pts.get(sp.country) ?? 0) + p);
      }
      perMotion.push({
        Time: when(ev.timestamp), Proposer: name(ev.country), Motion: motionText(committee, m),
        Topic: m.topic ?? '', 'Total time': m.totalTime ? mmss(m.totalTime) : '', 'Speaking time': m.speakingTime ? mmss(m.speakingTime) : '',
        Outcome: OUTCOME[m.status] ?? '',
        Speeches: opened?.speeches.length ?? 0,
        'Points by delegation': [...pts.entries()].filter(([, v]) => v !== 0)
          .sort((a, b) => b[1] - a[1]).map(([c, v]) => `${name(c)} ${v}`).join(', '),
        'Points total': [...pts.values()].reduce((a, b) => a + b, 0),
      });
    }
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  const docs: Row[] = [...(committee.documents ?? [])]
    .sort((a, b) => (a.docCode || '').localeCompare(b.docCode || '', undefined, { numeric: true }))
    .map((d: CommitteeDocument) => ({
      Code: d.docCode, Type: docName(committee, d.type, 'singular', d.type === 'working-paper' ? 'Working paper' : 'Draft resolution'), Title: d.title,
      Sponsors: d.sponsors.map(name).join(', '), Signatories: (d.signatories ?? []).map(name).join(', '),
      Status: d.status, Approval: d.approval ?? '', Submitted: when(d.submittedAt), File: d.fileUrl ?? '',
      ...voteSummary(votes[d.id]),
    }));

  // ── Workbook ──────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const add = (title: string, data: Row[], headers: string[], widths?: number[]) => {
    const ws = data.length
      ? XLSX.utils.json_to_sheet(data, { header: headers })
      : XLSX.utils.aoa_to_sheet([headers, ['Nothing recorded']]);
    ws['!cols'] = headers.map((h, i) => ({ wch: widths?.[i] ?? Math.min(48, Math.max(10, h.length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, title);
  };
  add('History', history,
    ['Time', 'Segment', 'Type', 'Delegation', 'Duration', 'Seconds', 'Motion', 'Outcome', 'Points', 'Chair comments'],
    [20, 34, 22, 24, 9, 8, 40, 14, 8, 60]);
  add('Scores', scoreRows, [
    'Delegation', 'Observer', 'Score', 'Points (objective)', 'Quality /100', 'GSL speeches', 'Caucus speeches',
    'Speaking time', 'Speaking (s)', 'Motions', 'Rights of reply', 'Working papers', 'Draft resolutions', 'Manual ±',
    ...sourceLabels,
    ...[...new Set(rows.flatMap((r) => r.factors.map((f) => `Rating: ${f.name}`)))],
  ]);
  add('Per motion', perMotion,
    ['Time', 'Proposer', 'Motion', 'Topic', 'Total time', 'Speaking time', 'Outcome', 'Speeches', 'Points by delegation', 'Points total'],
    [20, 22, 40, 30, 10, 12, 14, 9, 60, 12]);
  add('Speeches', speeches,
    ['Time', 'Delegation', 'Segment', 'Topic', 'Duration', 'Seconds', 'Points', 'Chair comments'],
    [20, 24, 34, 30, 9, 8, 8, 60]);
  add('Attendance', attendance, ['Time', 'Delegation', 'Status', 'Observer', 'Change'], [26, 24, 20, 9, 14]);
  add('Documents', docs,
    ['Code', 'Type', 'Title', 'Sponsors', 'Signatories', 'Status', 'Approval', 'Submitted', 'Vote result', 'For', 'Against', 'Abstain', 'Voted by', 'File'],
    [10, 18, 40, 40, 40, 12, 10, 20, 16, 6, 8, 8, 12, 50]);

  const safe = `${committee.code} ${committee.name || 'committee'} record`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  XLSX.writeFile(wb, `${safe}.xlsx`, { compression: true });
}

function eventRow(committee: Committee, segName: string, ev: HistoryEvent): Row {
  if (ev.type === 'motion') {
    return {
      Time: when(ev.timestamp), Segment: segName, Type: 'Motion', Delegation: name(ev.country),
      Duration: ev.motion?.totalTime ? mmss(ev.motion.totalTime) : '', Seconds: ev.motion?.totalTime || '',
      Motion: motionText(committee, ev.motion), Outcome: ev.motion ? OUTCOME[ev.motion.status] ?? '' : '',
      Points: '', 'Chair comments': '',
    };
  }
  const signed = ev.type === 'manual-deduct' ? -(ev.value ?? 0) : ev.type === 'manual-award' ? (ev.value ?? 0) : '';
  return {
    Time: when(ev.timestamp), Segment: segName, Type: EVENT_LABEL[ev.type] ?? ev.type, Delegation: name(ev.country),
    Duration: '', Seconds: '', Motion: '', Outcome: '', Points: signed,
    'Chair comments': [ev.note ?? '', notesText(ev.notes)].filter(Boolean).join(' | '),
  };
}
