// ── Import a MUN CV from a spreadsheet (prompt 70, 26 Nov 2026) ─────────────
//
// The pure half of "Import from a template": the template, the parser, the row
// checks and the duplicate key. No React, no network. SheetJS (xlsx) is loaded
// with `await import('xlsx')` inside the call, never statically, as the
// Applications export does.
//
// The rows become the same mun_cv_entries rows the one-by-one add writes
// (source 'manual'), and checkRow asks for exactly what CVEntryModal's
// handleSubmit asks for:
//   conference always; committee for delegate and chair; the country or
//   allocation for delegate; the delegation (faculty advisor), the position
//   (secretariat) or the role title (other) in `allocation`.
// A chair's dais position is optional and also lives in `allocation`.

import type { EntryType } from '@/components/CVEntryModal';

export const CV_IMPORT_MAX_ROWS = 100;
export const CV_TEMPLATE_FILE = 'Gavelling MUN CV template.xlsx';
const DESCRIPTION_MAX = 500;

/** One row of the file, in the CVEntry shape (everything but the server's fields). */
export interface CvDraft {
  /** Local key for the preview list; never sent. */
  key: string;
  entry_type: EntryType | null;
  /** The role as written, kept when it could not be read. */
  role_text: string;
  conference_name: string;
  committee: string;
  allocation: string;
  event_date: string | null;
  /** The month as written, kept when it could not be read. */
  month_text: string;
  month_bad: boolean;
  awards: string[];
  description: string | null;
  expertise_level: null;
  photos: string[];
  logo_url: null;
  conference_id: null;
}

export const CV_ROLE_LABEL: Record<EntryType, string> = {
  delegate: 'Delegate',
  chair: 'Chair',
  'faculty-advisor': 'Faculty Advisor',
  secretariat: 'Secretariat',
  other: 'Other',
};

const HEADERS = ['Conference', 'Role', 'Month', 'Committee', 'Country or position', 'Awards', 'Description'] as const;

const EXAMPLES: string[][] = [
  ['Harvard WorldMUN', 'Delegate', '2025-03', 'UNSC', 'France', 'Honourable Mention', ''],
  ['LIMUN', 'Chair', '2024-02', 'DISEC', 'Head Chair', '', ''],
];

const HOW_TO: string[][] = [
  ['Column', 'What goes in it'],
  ['Conference', 'The conference name, for example Harvard WorldMUN. Required'],
  ['Role', 'One of: Delegate, Chair, Faculty Advisor, Secretariat, Other. Required'],
  ['Month', 'The month it took place, written as YYYY-MM, for example 2025-03. Optional'],
  ['Committee', 'The committee, for example UNSC. Required for Delegate and Chair'],
  ['Country or position', 'Delegate: your country or allocation. Chair: your dais position, optional. Faculty Advisor: the delegation you advised. Secretariat: your position. Other: your role title'],
  ['Awards', 'Any awards, separated by commas. Optional'],
  ['Description', 'A few words about it, up to 500 characters. Optional'],
  ['', ''],
  ['Rows', 'One conference per row, up to 100. Replace or delete the two example rows'],
  ['Roles', 'The free spreadsheet format cannot hold a dropdown, so write the role exactly as one of the five above'],
];

/** Writes "Gavelling MUN CV template.xlsx": "My conferences" and "How to fill it". */
export async function downloadCvTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const main = XLSX.utils.aoa_to_sheet([[...HEADERS], ...EXAMPLES]);
  main['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, main, 'My conferences');
  const help = XLSX.utils.aoa_to_sheet(HOW_TO);
  help['!cols'] = [{ wch: 22 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, help, 'How to fill it');
  XLSX.writeFile(wb, CV_TEMPLATE_FILE, { compression: true });
}

// ── Reading a file ──────────────────────────────────────────────────────────

export type ParseResult =
  | { ok: true; drafts: CvDraft[] }
  | { ok: false; message: string };

export const CV_FILE_MESSAGES = {
  unreadable: 'This file could not be read. Upload the template as .xlsx or .csv',
  columns: 'This file is missing the Conference or Role column. Download the template and try again',
  empty: 'We found no conferences in this file',
  tooMany: (n: number) => `Your file has ${n} conferences. Upload up to ${CV_IMPORT_MAX_ROWS} at a time`,
};

const normHeader = (h: unknown) => String(h ?? '').toLowerCase().replace(/[^a-z]/g, '');

type ColKey = 'conference' | 'role' | 'month' | 'committee' | 'position' | 'awards' | 'description';
const HEADER_KEYS: Record<string, ColKey> = {
  conference: 'conference',
  conferencename: 'conference',
  role: 'role',
  month: 'month',
  date: 'month',
  committee: 'committee',
  countryorposition: 'position',
  countryposition: 'position',
  country: 'position',
  position: 'position',
  allocation: 'position',
  awards: 'awards',
  award: 'awards',
  description: 'description',
};

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The first of the month (YYYY-MM-01), null for an empty cell, 'bad' when it cannot be read. */
export function readMonth(v: unknown): string | null | 'bad' {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-01`;
  }
  const t = cellText(v);
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(t);
  if (m) {
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? `${m[1]}-${String(mo).padStart(2, '0')}-01` : 'bad';
  }
  m = /^([A-Za-z]+)\.?\s+(\d{4})$/.exec(t);
  if (m) {
    const idx = MONTH_NAMES.indexOf(m[1].slice(0, 3).toLowerCase());
    return idx >= 0 ? `${m[2]}-${String(idx + 1).padStart(2, '0')}-01` : 'bad';
  }
  if (/^\d{4}$/.test(t)) return `${t}-01-01`;
  // An ISO timestamp (a date cell read as text).
  m = /^(\d{4})-(\d{2})-\d{2}T/.exec(t);
  if (m) return `${m[1]}-${m[2]}-01`;
  return 'bad';
}

/** Role words to an entry type, case-insensitive; `dais` is the chair position the word gives. */
export function readRole(v: string): { type: EntryType | null; dais: string | null } {
  const t = v.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return { type: null, dais: null };
  if (t === 'delegate') return { type: 'delegate', dais: null };
  if (t === 'chair') return { type: 'chair', dais: null };
  if (t === 'head chair' || t === 'co-chair' || t === 'co chair' || t === 'vice chair' || t === 'vice-chair' || t === 'dais') {
    const dais = t === 'dais' ? 'Dais' : t.replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
    return { type: 'chair', dais };
  }
  if (t === 'faculty advisor' || t === 'faculty-advisor' || t === 'advisor' || t === 'fa') return { type: 'faculty-advisor', dais: null };
  if (t === 'secretariat' || t === 'secretary-general' || t === 'secretary general' || t === 'usg' || t === 'staff') return { type: 'secretariat', dais: null };
  if (t === 'other') return { type: 'other', dais: null };
  return { type: null, dais: null };
}

export function splitAwards(v: string): string[] {
  return v.split(',').map(a => a.trim()).filter(Boolean);
}

let keySeq = 0;
const nextKey = () => `d${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/** A draft from typed values (the preview's inline edit uses it too). */
export function makeDraft(f: {
  conference: string; role: string; month: unknown; committee: string; position: string; awards: string; description: string;
}, key?: string): CvDraft {
  const role = readRole(f.role);
  const month = readMonth(f.month);
  const position = f.position.trim();
  return {
    key: key ?? nextKey(),
    entry_type: role.type,
    role_text: f.role.trim(),
    conference_name: f.conference.trim(),
    committee: f.committee.trim(),
    allocation: position || (role.type === 'chair' && role.dais ? role.dais : ''),
    event_date: month === 'bad' ? null : month,
    month_text: cellText(f.month),
    month_bad: month === 'bad',
    awards: splitAwards(f.awards),
    description: f.description.trim() || null,
    expertise_level: null,
    photos: [],
    logo_url: null,
    conference_id: null,
  };
}

function isExample(row: string[]): boolean {
  return EXAMPLES.some(ex => ex.every((v, i) => (row[i] ?? '').trim() === v));
}

/** Reads the first sheet of an .xlsx or .csv file into drafts. Never throws. */
export async function parseCvFile(file: File): Promise<ParseResult> {
  let rows: unknown[][];
  try {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
    const wb = isCsv
      ? XLSX.read(new TextDecoder().decode(buf), { type: 'string', cellDates: true })
      : XLSX.read(buf, { type: 'array', cellDates: true });
    const first = wb.SheetNames[0];
    if (!first) return { ok: false, message: CV_FILE_MESSAGES.unreadable };
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first], { header: 1, defval: '', raw: true });
  } catch {
    return { ok: false, message: CV_FILE_MESSAGES.unreadable };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: CV_FILE_MESSAGES.empty };

  const header = (rows[0] ?? []).map(normHeader);
  const at: Partial<Record<ColKey, number>> = {};
  header.forEach((h, i) => {
    const k = HEADER_KEYS[h];
    if (k && at[k] === undefined) at[k] = i;
  });
  if (at.conference === undefined || at.role === undefined) return { ok: false, message: CV_FILE_MESSAGES.columns };

  const get = (r: unknown[], k: ColKey): unknown => (at[k] === undefined ? '' : r[at[k] as number]);
  const body = rows.slice(1).filter((r) => {
    const texts = (r ?? []).map(cellText);
    if (texts.every(t => !t)) return false;
    const ordered = (['conference', 'role', 'month', 'committee', 'position', 'awards', 'description'] as const).map(k => cellText(get(r, k)));
    return !isExample(ordered);
  });
  if (body.length === 0) return { ok: false, message: CV_FILE_MESSAGES.empty };
  if (body.length > CV_IMPORT_MAX_ROWS) return { ok: false, message: CV_FILE_MESSAGES.tooMany(body.length) };

  return {
    ok: true,
    drafts: body.map(r => makeDraft({
      conference: cellText(get(r, 'conference')),
      role: cellText(get(r, 'role')),
      month: get(r, 'month'),
      committee: cellText(get(r, 'committee')),
      position: cellText(get(r, 'position')),
      awards: cellText(get(r, 'awards')),
      description: cellText(get(r, 'description')),
    })),
  };
}

// ── Checks ──────────────────────────────────────────────────────────────────

/** Null when the row can be added, else ONE plain sentence (CVEntryModal's required fields). */
export function checkRow(d: CvDraft): string | null {
  if (!d.conference_name.trim()) return 'Add the conference name';
  if (!d.entry_type) return 'Role must be Delegate, Chair, Faculty Advisor, Secretariat or Other';
  if ((d.entry_type === 'delegate' || d.entry_type === 'chair') && !d.committee.trim()) return 'Add the committee';
  if (d.entry_type === 'delegate' && !d.allocation.trim()) return 'Add your country or allocation';
  if (d.entry_type === 'faculty-advisor' && !d.allocation.trim()) return 'Add the delegation you advised';
  if (d.entry_type === 'secretariat' && !d.allocation.trim()) return 'Add your Secretariat position';
  if (d.entry_type === 'other' && !d.allocation.trim()) return 'Add your role title';
  if (d.month_bad) return 'Write the month as 2025-03';
  if ((d.description ?? '').length > DESCRIPTION_MAX) return 'Keep the description under 500 characters';
  return null;
}

/** Conference name (lower case, spaces collapsed) + role + year. */
export function duplicateKey(e: { conference_name: string; entry_type: string | null; event_date: string | null }): string {
  const name = (e.conference_name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const year = e.event_date ? e.event_date.slice(0, 4) : '';
  return `${name}|${e.entry_type ?? ''}|${year}`;
}

/** Splits the drafts into the ones to list and how many repeat an existing entry or an earlier row. */
export function splitDuplicates(drafts: CvDraft[], existing: { conference_name: string; entry_type: string | null; event_date: string | null }[]): { fresh: CvDraft[]; duplicates: number } {
  const seen = new Set(existing.map(duplicateKey));
  const fresh: CvDraft[] = [];
  let duplicates = 0;
  for (const d of drafts) {
    const k = duplicateKey(d);
    if (seen.has(k)) { duplicates++; continue; }
    seen.add(k);
    fresh.push(d);
  }
  return { fresh, duplicates };
}

/** The row to insert into mun_cv_entries (the caller adds user_id). */
export function draftToInsert(d: CvDraft) {
  return {
    entry_type: d.entry_type as EntryType,
    conference_name: d.conference_name,
    committee: d.committee,
    allocation: d.allocation,
    event_date: d.event_date,
    awards: d.awards,
    award: d.awards[0] ?? 'None',
    description: d.description,
    expertise_level: null,
    photos: [] as string[],
    logo_url: null,
    conference_id: null,
    source: 'manual' as const,
  };
}
