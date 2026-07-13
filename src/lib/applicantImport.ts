// Applicant CSV/XLSX import — pure parsing + dry-run validation logic, shared
// by the /manage/[slug]/import page. Nothing here talks to Supabase; the page
// fetches the DB context (committees, existing applications, existing
// allocations) and passes it into classifyImportRows.

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ── Canonical columns ────────────────────────────────────────────────────────

export const CANONICAL_HEADERS = ['email', 'name', 'role', 'delegation', 'payment', 'committee', 'country'] as const;
export type CanonicalHeader = (typeof CANONICAL_HEADERS)[number];

export type ImportableRole = 'delegate' | 'head-delegate' | 'faculty-advisor' | 'observer';

const ROLE_ALIASES: Record<string, ImportableRole> = {
  'delegate': 'delegate',
  'head delegate': 'head-delegate',
  'head-delegate': 'head-delegate',
  'faculty advisor': 'faculty-advisor',
  'faculty-advisor': 'faculty-advisor',
  'observer': 'observer',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeaderKey(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Template download ────────────────────────────────────────────────────────

export function buildImportTemplateCSV(): string {
  const header = CANONICAL_HEADERS.join(',');
  const example = [
    'delegate@example.com',
    'Jordan Rivera',
    'delegate',
    'Riverside High School',
    'unpaid',
    'UNSC',
    'France',
  ].map(v => `"${v.replace(/"/g, '""')}"`).join(',');
  return `${header}\n${example}\n`;
}

// ── File parsing ─────────────────────────────────────────────────────────────

export interface ParsedImportRow {
  rowNumber: number; // 1-based, counting only data rows
  email: string;
  name: string;
  role: string;
  delegation: string;
  payment: string;
  committee: string;
  country: string;
}

export interface ParseFileResult {
  rows: ParsedImportRow[];
  missingHeaders: CanonicalHeader[];
}

function recordsToRows(records: Record<string, string>[]): ParseFileResult {
  if (records.length === 0) return { rows: [], missingHeaders: [...CANONICAL_HEADERS] };

  // Map each record's own keys (whatever case/spacing) to canonical headers.
  const sampleKeys = Object.keys(records[0]);
  const keyForCanonical = new Map<CanonicalHeader, string>();
  for (const key of sampleKeys) {
    const normalized = normalizeHeaderKey(key);
    if ((CANONICAL_HEADERS as readonly string[]).includes(normalized)) {
      keyForCanonical.set(normalized as CanonicalHeader, key);
    }
  }
  const missingHeaders = CANONICAL_HEADERS.filter(h => !keyForCanonical.has(h));

  const rows: ParsedImportRow[] = [];
  let rowNumber = 0;
  for (const record of records) {
    const get = (h: CanonicalHeader) => {
      const key = keyForCanonical.get(h);
      const raw = key ? record[key] : '';
      return (raw ?? '').toString().trim();
    };
    const row: ParsedImportRow = {
      rowNumber: 0,
      email: get('email'),
      name: get('name'),
      role: get('role'),
      delegation: get('delegation'),
      payment: get('payment'),
      committee: get('committee'),
      country: get('country'),
    };
    // Skip fully-blank rows (trailing spreadsheet rows, etc).
    if (!row.email && !row.name && !row.role && !row.delegation && !row.payment && !row.committee && !row.country) continue;
    rowNumber += 1;
    row.rowNumber = rowNumber;
    rows.push(row);
  }
  return { rows, missingHeaders };
}

export async function parseImportFile(file: File): Promise<ParseFileResult> {
  const isXlsx = /\.xlsx$/i.test(file.name);
  if (isXlsx) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false }) as Record<string, string>[];
    return recordsToRows(records);
  }
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return recordsToRows(parsed.data);
}

// ── Validation / classification ─────────────────────────────────────────────

export type ImportRowClass = 'valid' | 'warning' | 'error';

interface Reason {
  severity: 'error' | 'warning';
  message: string;
}

export interface ClassifiedImportRow {
  rowNumber: number;
  raw: ParsedImportRow;
  cls: ImportRowClass;
  reasons: string[];
  resolved: {
    email: string;
    name: string;
    role: ImportableRole | null;
    societyName: string | null;
    paymentStatus: 'paid' | 'unpaid' | 'waived';
    committeeId: string | null;
    committeeLabel: string | null;
    countryCode: string | null;
    countryName: string | null;
  };
}

export interface CommitteeLite {
  id: string;
  name: string;
  abbreviation: string | null;
}

/** A single allocatable row from committee_country_slots — a country for a
 *  standard committee, or a character for a crisis one (same table, the
 *  committee editor writes country_code = getCountryByName(name)?.code ??
 *  name, so a character just carries its own name as the code). */
export interface RosterSlot {
  country_code: string;
  country_name: string;
}

export interface ClassifyContext {
  committees: CommitteeLite[];
  /** `${lowercased email}|${role}` for every application already on this conference (invited_email or profile email). */
  existingEmailRole: Set<string>;
  /** `${committeeId}|${countryCode}` for every country already allocated in this conference. */
  existingAllocations: Set<string>;
  /** Every committee's roster (committee_country_slots), keyed by committee id — the single source of truth for what's assignable in that committee, standard or crisis alike. */
  committeeSlots: Map<string, RosterSlot[]>;
}

function matchCommittee(committees: CommitteeLite[], value: string): CommitteeLite | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  return committees.find(c =>
    c.name.trim().toLowerCase() === v || (c.abbreviation && c.abbreviation.trim().toLowerCase() === v)
  ) ?? null;
}

/** Matches a raw assignment value against ONE committee's roster,
 *  case-insensitive on country_name — never against the global country list,
 *  so a committee's actual matrix (which may omit countries, or list crisis
 *  characters instead) is the sole authority. */
function matchRosterSlot(slots: RosterSlot[], value: string): RosterSlot | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  return slots.find(s => s.country_name.trim().toLowerCase() === v) ?? null;
}

function mapPayment(raw: string): { status: 'paid' | 'unpaid' | 'waived'; unknown: boolean } {
  const v = raw.trim().toLowerCase();
  if (!v) return { status: 'unpaid', unknown: false };
  if (v === 'paid' || v === 'unpaid' || v === 'waived') return { status: v, unknown: false };
  return { status: 'unpaid', unknown: true };
}

function mapRole(raw: string): { role: ImportableRole | null; isChair: boolean } {
  const v = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (v === 'chair') return { role: null, isChair: true };
  return { role: ROLE_ALIASES[v] ?? null, isChair: false };
}

export function classifyImportRows(rows: ParsedImportRow[], ctx: ClassifyContext): ClassifiedImportRow[] {
  const seenInFile = new Set<string>();
  const claimedInFile = new Set<string>();
  const results: ClassifiedImportRow[] = [];

  for (const raw of rows) {
    const reasons: Reason[] = [];
    const emailLower = raw.email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(raw.email.trim())) {
      reasons.push({ severity: 'error', message: 'Invalid email address.' });
    }
    if (!raw.name.trim()) {
      reasons.push({ severity: 'error', message: 'Missing name.' });
    }

    const { role, isChair } = mapRole(raw.role);
    if (isChair) {
      reasons.push({ severity: 'error', message: "Chairs aren't importable. Invite chairs from Committees instead." });
    } else if (!role) {
      reasons.push({ severity: 'error', message: `Unknown role "${raw.role}".` });
    }

    const emailValid = EMAIL_PATTERN.test(raw.email.trim());
    if (emailValid && role) {
      const key = `${emailLower}|${role}`;
      if (seenInFile.has(key)) {
        reasons.push({ severity: 'error', message: 'Duplicate email + role within this file.' });
      }
      seenInFile.add(key);
      if (ctx.existingEmailRole.has(key)) {
        reasons.push({ severity: 'error', message: 'An application already exists for this email and role.' });
      }
    }

    if (raw.country.trim() && !raw.committee.trim()) {
      reasons.push({ severity: 'error', message: 'Country given without a committee.' });
    }

    // Committee / country resolution (computed for display even on errored rows).
    let committeeId: string | null = null;
    let committeeLabel: string | null = null;
    let countryCode: string | null = null;
    let countryName: string | null = null;

    if (raw.committee.trim()) {
      const committee = matchCommittee(ctx.committees, raw.committee);
      if (!committee) {
        reasons.push({ severity: 'warning', message: `Committee "${raw.committee}" not found, so imported without allocation.` });
      } else {
        committeeLabel = committee.abbreviation ?? committee.name;
        if (raw.country.trim()) {
          // Validated against THIS committee's own roster, never the global
          // country list — the only source of truth for what's assignable
          // here, a country for a standard committee or a character for a
          // crisis one.
          const slots = ctx.committeeSlots.get(committee.id) ?? [];
          const slot = matchRosterSlot(slots, raw.country);
          if (!slot) {
            reasons.push({ severity: 'warning', message: `'${raw.country.trim()}' is not in ${committeeLabel}'s roster, so imported without allocation.` });
          } else {
            const slotKey = `${committee.id}|${slot.country_code}`;
            const occupied = ctx.existingAllocations.has(slotKey) || claimedInFile.has(slotKey);
            if (occupied) {
              reasons.push({ severity: 'warning', message: `${slot.country_name} is already allocated in ${committeeLabel}, so imported without allocation.` });
            } else {
              claimedInFile.add(slotKey);
              committeeId = committee.id;
              // Copied verbatim from the matched slot row, no derivation —
              // guarantees import-created allocations are byte-identical to
              // UI-created ones.
              countryCode = slot.country_code;
              countryName = slot.country_name;
            }
          }
        }
      }
    }

    const payment = mapPayment(raw.payment);
    if (payment.unknown) {
      reasons.push({ severity: 'warning', message: `Unknown payment value "${raw.payment}", defaulting to unpaid.` });
    }

    const cls: ImportRowClass = reasons.some(r => r.severity === 'error')
      ? 'error'
      : reasons.some(r => r.severity === 'warning')
      ? 'warning'
      : 'valid';

    results.push({
      rowNumber: raw.rowNumber,
      raw,
      cls,
      reasons: reasons.map(r => r.message),
      resolved: {
        email: emailLower,
        name: raw.name.trim(),
        role,
        societyName: raw.delegation.trim() || null,
        paymentStatus: payment.status,
        committeeId,
        committeeLabel,
        countryCode,
        countryName,
      },
    });
  }

  return results;
}

export interface ImportSummary {
  valid: number;
  warning: number;
  error: number;
}

export function summarizeRows(rows: ClassifiedImportRow[]): ImportSummary {
  return {
    valid: rows.filter(r => r.cls === 'valid').length,
    warning: rows.filter(r => r.cls === 'warning').length,
    error: rows.filter(r => r.cls === 'error').length,
  };
}
