// ── The Applications page export: an Excel workbook (owner, 20 Oct 2026; reworked 28 Oct 2026) ──
//
// Exactly two sheets:
//   "Overview"          one row per application, the key facts only: Name,
//                       Email, Date of birth, Age, Nationality, Role, Status,
//                       Payment, Society, Submitted, Assigned Committee,
//                       Assigned Country.
//   "Full information"  one row per application with everything we hold: the
//                       overview columns, Experience, Head Delegate, Checked
//                       In, the financial aid request (Aid requested, Aid
//                       status, Aid amount requested, Aid statement), the
//                       conferences listed on the application, then ONE COLUMN
//                       PER QUESTION and nothing merged: the current questions
//                       of every role's form in form order, role by role
//                       (delegate, head delegate, faculty advisor, chair,
//                       observer), then archived or removed questions that
//                       anyone answered (their archived label, or "Removed
//                       question"), then the financial aid form's questions
//                       ("Financial aid: <label>"). A question id shared by
//                       two roles is one column; two different ids with the
//                       same label stay two columns, told apart by the role in
//                       brackets (or a number when that is not enough).
// Rows are oldest submitted first on both sheets. Dates of birth are real
// Excel dates shown as YYYY-MM-DD. Secretariat and staff stay out (Settings >
// Team). Everything comes from what the page already loaded; nothing is read
// from the server. SheetJS (already a dependency) is imported inside the call
// so it never loads with the page. The community build writes column widths
// but not wrapping or frozen panes, so those are left out.
//
// buildApplicationsSheets is pure (no SheetJS, no browser) so the same logic
// can be run from a script.

import { answerIsEmpty, normalizeBlocks, questionsOf, type CustomAnswerValue } from '@/lib/customQuestions';

export interface ExportExperienceEntry {
  conference_name: string;
  committee: string;
  allocation: string;
  event_date: string | null;
  awards: string[];
  description: string | null;
}

export interface ExportApplication {
  role: string;
  status: string;
  payment_status: string | null;
  submitted_at: string | null;
  checked_in_at: string | null;
  invited_name: string | null;
  invited_email: string | null;
  experience_level: string | null;
  is_head_delegate: boolean | null;
  assigned_country_name: string | null;
  custom_answers: Record<string, CustomAnswerValue> | null;
  aid_custom_answers?: Record<string, CustomAnswerValue> | null;
  aid_requested?: boolean | null;
  aid_status?: string | null;
  aid_statement?: string | null;
  aid_requested_amount?: number | null;
  experience_entries?: ExportExperienceEntry[] | null;
  profiles: { display_name: string | null; email: string | null; date_of_birth: string | null; nationality: string | null } | null;
  societies: { name: string | null } | null;
  assigned_committee: { name: string | null } | null;
}

export interface ExportRoleConfig { role: string; custom_questions: unknown }

export interface ExportLabels {
  role: (role: string) => string;
  status: (status: string) => string;
  payment: (payment: string | null) => string;
  date: (iso: string) => string;
  age: (dob: string | null | undefined) => number | null;
}

export const OVERVIEW_SHEET = 'Overview';
export const FULL_SHEET = 'Full information';

const ROLE_ORDER = ['delegate', 'head-delegate', 'faculty-advisor', 'chair', 'observer'];
const EXCLUDED_ROLES = new Set(['secretariat', 'staff']);

export type Cell = string | number;

export interface SheetData {
  name: string;
  rows: Cell[][];
  /** Columns holding Excel date serials, shown as YYYY-MM-DD. */
  dateCols: number[];
}

function answerText(v: CustomAnswerValue | undefined): string {
  if (v === undefined || v === null) return '';
  // Stored answers are strings or string lists, but a jsonb value can be any
  // scalar; read it as text rather than failing the whole export.
  const value: CustomAnswerValue = Array.isArray(v) ? v.map(String) : String(v);
  if (answerIsEmpty(value)) return '';
  return Array.isArray(value) ? value.join('; ') : value;
}

/** 'YYYY-MM-DD' to an Excel date serial (whole days since 1899-12-30); text when it is not that shape. */
function dateSerial(iso: string | null | undefined): Cell {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 + 25569;
}

function experienceText(entries: ExportExperienceEntry[] | null | undefined): string {
  return (entries ?? [])
    .map((e) => {
      const where = [e.committee, e.allocation].filter((s) => s && s.trim()).join(', ');
      const awards = (e.awards ?? []).filter(Boolean);
      return [
        `${e.conference_name}${e.event_date ? ` (${e.event_date})` : ''}${where ? `: ${where}` : ''}`,
        awards.length ? `Awards: ${awards.join('; ')}` : '',
        e.description?.trim() ?? '',
      ].filter(Boolean).join('. ');
    })
    .join('\n');
}

/** Column widths from the content, between 12 and 48 characters. */
function widths(rows: Cell[][]): { wch: number }[] {
  const n = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return Array.from({ length: n }, (_, i) => {
    let w = 0;
    for (const r of rows) {
      const text = String(r[i] ?? '');
      for (const line of text.split('\n')) w = Math.max(w, line.length);
    }
    return { wch: Math.min(48, Math.max(12, w + 2)) };
  });
}

interface Col { id: string; label: string; role: string | null; source: 'app' | 'aid' }

/** Gives every column a distinct header without ever merging two columns. */
function uniqueLabels(cols: Col[], roleName: (role: string) => string): string[] {
  const key = (s: string) => s.trim().toLowerCase();
  const count = new Map<string, number>();
  for (const c of cols) count.set(key(c.label), (count.get(key(c.label)) ?? 0) + 1);
  let out = cols.map((c) => (
    (count.get(key(c.label)) ?? 0) > 1 && c.role ? `${c.label} (${roleName(c.role)})` : c.label
  ));
  const again = new Map<string, number>();
  for (const l of out) again.set(key(l), (again.get(key(l)) ?? 0) + 1);
  const seen = new Map<string, number>();
  out = out.map((l) => {
    if ((again.get(key(l)) ?? 0) < 2) return l;
    const n = (seen.get(key(l)) ?? 0) + 1;
    seen.set(key(l), n);
    return `${l} ${n}`;
  });
  return out;
}

/** Builds both sheets' rows. Pure: no SheetJS, no browser. */
export function buildApplicationsSheets(opts: {
  applications: ExportApplication[];
  roleConfigs: ExportRoleConfig[];
  /** conferences.aid_questions (raw JSON blocks). */
  aidQuestions?: unknown;
  labels: ExportLabels;
}): { overview: SheetData; full: SheetData } {
  const { roleConfigs, labels } = opts;
  const applications = opts.applications
    .filter((a) => !EXCLUDED_ROLES.has(a.role))
    .sort((x, y) => (x.submitted_at ?? '').localeCompare(y.submitted_at ?? ''));

  const nameOf = (a: ExportApplication) => a.profiles?.display_name ?? a.invited_name ?? '';
  const emailOf = (a: ExportApplication) => a.profiles?.email ?? a.invited_email ?? '';
  const dobOf = (a: ExportApplication) => a.profiles?.date_of_birth ?? null;
  const submitted = (a: ExportApplication) => (a.submitted_at ? labels.date(a.submitted_at) : '');

  // ── Overview ──
  const overviewHeader: Cell[] = [
    'Name', 'Email', 'Date of birth', 'Age', 'Nationality', 'Role', 'Status', 'Payment', 'Society',
    'Submitted', 'Assigned Committee', 'Assigned Country',
  ];
  const overviewRow = (a: ExportApplication): Cell[] => [
    nameOf(a),
    emailOf(a),
    dateSerial(dobOf(a)),
    labels.age(dobOf(a)) ?? '',
    a.profiles?.nationality ?? '',
    labels.role(a.role),
    labels.status(a.status),
    labels.payment(a.payment_status),
    a.societies?.name ?? '',
    submitted(a),
    a.assigned_committee?.name ?? '',
    a.assigned_country_name ?? '',
  ];
  const overview: SheetData = {
    name: OVERVIEW_SHEET,
    rows: [overviewHeader, ...applications.map(overviewRow)],
    dateCols: [2],
  };

  // ── Application question columns, role by role ──
  const rolesPresent = new Set(applications.map((a) => a.role));
  const roleOrder = [...ROLE_ORDER, ...[...rolesPresent].filter((r) => !ROLE_ORDER.includes(r))];
  const cols: Col[] = [];
  const colIds = new Set<string>();
  const archivedFor = new Map<string, { label: string; role: string }>();
  for (const role of roleOrder) {
    const blocks = normalizeBlocks(roleConfigs.find((rc) => rc.role === role)?.custom_questions ?? []);
    const current = questionsOf(blocks).filter((q) => q.label.trim());
    const currentIds = new Set(current.map((q) => q.id));
    if (rolesPresent.has(role)) {
      for (const q of current) {
        if (colIds.has(q.id)) continue;
        colIds.add(q.id);
        cols.push({ id: q.id, label: q.label.trim(), role, source: 'app' });
      }
    }
    for (const q of questionsOf(blocks, { includeArchived: true })) {
      if (!currentIds.has(q.id) && q.label.trim() && !archivedFor.has(q.id)) {
        archivedFor.set(q.id, { label: q.label.trim(), role });
      }
    }
  }
  // Archived or removed questions that anyone answered.
  for (const a of applications) {
    for (const [id, v] of Object.entries(a.custom_answers ?? {})) {
      if (colIds.has(id) || !answerText(v)) continue;
      colIds.add(id);
      const arch = archivedFor.get(id);
      cols.push({ id, label: arch?.label ?? 'Removed question', role: arch?.role ?? null, source: 'app' });
    }
  }

  // ── Financial aid form columns ──
  const aidBlocks = normalizeBlocks(opts.aidQuestions ?? []);
  const aidCurrent = questionsOf(aidBlocks).filter((q) => q.label.trim());
  const aidIds = new Set<string>();
  for (const q of aidCurrent) {
    aidIds.add(q.id);
    cols.push({ id: q.id, label: `Financial aid: ${q.label.trim()}`, role: null, source: 'aid' });
  }
  const aidArchived = new Map<string, string>();
  for (const q of questionsOf(aidBlocks, { includeArchived: true })) {
    if (!aidIds.has(q.id) && q.label.trim()) aidArchived.set(q.id, q.label.trim());
  }
  for (const a of applications) {
    for (const [id, v] of Object.entries(a.aid_custom_answers ?? {})) {
      if (aidIds.has(id) || !answerText(v)) continue;
      aidIds.add(id);
      cols.push({ id, label: `Financial aid: ${aidArchived.get(id) ?? 'Removed question'}`, role: null, source: 'aid' });
    }
  }

  const questionLabels = uniqueLabels(cols, labels.role);
  const fullHeader: Cell[] = [
    ...overviewHeader,
    'Experience', 'Head Delegate', 'Checked In',
    'Aid requested', 'Aid status', 'Aid amount requested', 'Aid statement',
    'Listed conferences',
    ...questionLabels,
  ];
  const fullRow = (a: ExportApplication): Cell[] => {
    const aidStatus = a.aid_status && a.aid_status !== 'none' ? a.aid_status : '';
    const aidAsked = !!a.aid_requested || !!aidStatus;
    return [
      ...overviewRow(a),
      a.experience_level ?? '',
      a.is_head_delegate ? 'Yes' : 'No',
      a.checked_in_at ? labels.date(a.checked_in_at) : '',
      aidAsked ? 'Yes' : 'No',
      aidStatus,
      a.aid_requested_amount ?? '',
      a.aid_statement ?? '',
      experienceText(a.experience_entries),
      ...cols.map((c) => answerText((c.source === 'aid' ? a.aid_custom_answers : a.custom_answers)?.[c.id])),
    ];
  };
  const full: SheetData = {
    name: FULL_SHEET,
    rows: [fullHeader, ...applications.map(fullRow)],
    dateCols: [2],
  };
  return { overview, full };
}

/** Lays the two sheets into a SheetJS workbook (widths from content, date columns formatted). */
export function sheetsToWorkbook(XLSX: typeof import('xlsx'), sheets: SheetData[]) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    ws['!cols'] = widths(sheet.rows);
    for (const c of sheet.dateCols) {
      for (let r = 1; r < sheet.rows.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.t === 'n') cell.z = 'yyyy-mm-dd';
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  return wb;
}

/** Builds the workbook and hands it to the browser as "<ACRONYM> applications.xlsx". */
export async function downloadApplicationsWorkbook(opts: {
  acronym: string | null | undefined;
  applications: ExportApplication[];
  roleConfigs: ExportRoleConfig[];
  aidQuestions?: unknown;
  labels: ExportLabels;
}): Promise<void> {
  const XLSX = await import('xlsx');
  const { overview, full } = buildApplicationsSheets(opts);
  const wb = sheetsToWorkbook(XLSX, [overview, full]);
  const base = (opts.acronym ?? '').trim();
  XLSX.writeFile(wb, base ? `${base} applications.xlsx` : 'applications.xlsx', { compression: true });
}
