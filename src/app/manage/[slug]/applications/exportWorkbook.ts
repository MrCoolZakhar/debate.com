// ── The Applications page export: an Excel workbook (owner, 20 Oct 2026) ──
//
// OAKMUN asked for every application answer in Excel. The workbook:
//   Sheet 1 "Applications"  the overview, exactly the old CSV's columns
//                           without the answers.
//   One sheet per role       (Delegates, Head Delegates, Faculty Advisors,
//                           Chairs, Observers) that has at least one
//                           application with a question or an answer: Name,
//                           Email, Status, Payment, Submitted, Assigned
//                           Committee, Assigned Country, then one column per
//                           question on that role's CURRENT form, in form
//                           order, then "Other answers" (archived, deleted or
//                           unlabelled questions) only when a row needs it.
//                           Rows oldest submitted first.
// Everything comes from what the page already loaded; nothing is read from
// the server. SheetJS (already a dependency) is imported inside the call so
// it never loads with the page. The community build writes column widths but
// not wrapping or frozen panes, so those are left out.

import { answerIsEmpty, normalizeBlocks, questionsOf, type CustomAnswerValue } from '@/lib/customQuestions';

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

const ROLE_SHEETS: { role: string; sheet: string }[] = [
  { role: 'delegate', sheet: 'Delegates' },
  { role: 'head-delegate', sheet: 'Head Delegates' },
  { role: 'faculty-advisor', sheet: 'Faculty Advisors' },
  { role: 'chair', sheet: 'Chairs' },
  { role: 'observer', sheet: 'Observers' },
];

type Cell = string | number;

function answerText(v: CustomAnswerValue | undefined): string {
  if (v === undefined || answerIsEmpty(v)) return '';
  return Array.isArray(v) ? v.join('; ') : String(v);
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

/** Builds the workbook and hands it to the browser as "<ACRONYM> applications.xlsx". */
export async function downloadApplicationsWorkbook(opts: {
  acronym: string | null | undefined;
  applications: ExportApplication[];
  roleConfigs: ExportRoleConfig[];
  labels: ExportLabels;
}): Promise<void> {
  const { applications, roleConfigs, labels } = opts;
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Cell[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  const nameOf = (a: ExportApplication) => a.profiles?.display_name ?? a.invited_name ?? '';
  const emailOf = (a: ExportApplication) => a.profiles?.email ?? a.invited_email ?? '';

  // ── Sheet 1: Applications ──
  const overview: Cell[][] = [[
    'Name', 'Email', 'Date of birth', 'Age', 'Nationality', 'Role', 'Status', 'Payment', 'Experience', 'Society',
    'Head Delegate', 'Submitted', 'Checked In', 'Assigned Committee', 'Assigned Country',
  ]];
  for (const a of applications) {
    overview.push([
      nameOf(a),
      emailOf(a),
      a.profiles?.date_of_birth ?? '',
      labels.age(a.profiles?.date_of_birth) ?? '',
      a.profiles?.nationality ?? '',
      labels.role(a.role),
      labels.status(a.status),
      labels.payment(a.payment_status),
      a.experience_level ?? '',
      a.societies?.name ?? '',
      a.is_head_delegate ? 'Yes' : 'No',
      a.submitted_at ? labels.date(a.submitted_at) : '',
      a.checked_in_at ? labels.date(a.checked_in_at) : '',
      a.assigned_committee?.name ?? '',
      a.assigned_country_name ?? '',
    ]);
  }
  add('Applications', overview);

  // ── One sheet per role ──
  for (const { role, sheet } of ROLE_SHEETS) {
    const apps = applications
      .filter((a) => a.role === role)
      .sort((x, y) => (x.submitted_at ?? '').localeCompare(y.submitted_at ?? ''));
    if (apps.length === 0) continue;

    const blocks = normalizeBlocks(roleConfigs.find((rc) => rc.role === role)?.custom_questions ?? []);
    const current = questionsOf(blocks).filter((q) => q.label.trim());
    const currentIds = new Set(current.map((q) => q.id));
    const archivedLabel = new Map<string, string>();
    for (const q of questionsOf(blocks, { includeArchived: true })) {
      if (!currentIds.has(q.id) && q.label.trim()) archivedLabel.set(q.id, q.label.trim());
    }

    let anyAnswer = false;
    let anyOther = false;
    const body: Cell[][] = apps.map((a) => {
      const answers = a.custom_answers ?? {};
      const cells = current.map((q) => answerText(answers[q.id]));
      const other: string[] = [];
      for (const [id, v] of Object.entries(answers)) {
        if (currentIds.has(id)) continue;
        const text = answerText(v);
        if (!text) continue;
        other.push(`${archivedLabel.get(id) ?? 'Removed question'}: ${text}`);
      }
      if (cells.some(Boolean) || other.length) anyAnswer = true;
      if (other.length) anyOther = true;
      return [
        nameOf(a),
        emailOf(a),
        labels.status(a.status),
        labels.payment(a.payment_status),
        a.submitted_at ? labels.date(a.submitted_at) : '',
        a.assigned_committee?.name ?? '',
        a.assigned_country_name ?? '',
        ...cells,
        ...(other.length ? [other.join('\n')] : []),
      ];
    });
    // A role sheet only when the role asks something or someone answered.
    if (current.length === 0 && !anyAnswer) continue;

    const header: Cell[] = [
      'Name', 'Email', 'Status', 'Payment', 'Submitted', 'Assigned Committee', 'Assigned Country',
      ...current.map((q) => q.label.trim()),
      ...(anyOther ? ['Other answers'] : []),
    ];
    add(sheet, [header, ...body]);
  }

  const base = (opts.acronym ?? '').trim();
  XLSX.writeFile(wb, base ? `${base} applications.xlsx` : 'applications.xlsx', { compression: true });
}
