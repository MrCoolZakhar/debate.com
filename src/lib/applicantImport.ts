// Applicant CSV/XLSX import — pure parsing + dry-run validation logic, shared
// by the /manage/[slug]/import page. Nothing here talks to Supabase; the page
// fetches the DB context (committees, existing applications, existing
// allocations) and passes it into classifyImportRows.

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ── Canonical columns ────────────────────────────────────────────────────────

export const CANONICAL_HEADERS = ['email', 'name', 'role', 'delegation', 'payment', 'committee', 'country', 'seat'] as const;
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
    '', // seat: optional. Leave empty and double-delegation seats fill in order.
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
  /** Raw text, "1", "2", or empty. OPTIONAL — when empty the importer fills the
   *  next free seat for that country, so listing a country once per delegate is
   *  enough. An explicit value pins the delegate to that half instead. */
  seat: string;
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
      seat: get('seat'),
    };
    // Skip fully-blank rows (trailing spreadsheet rows, etc).
    if (!row.email && !row.name && !row.role && !row.delegation && !row.payment && !row.committee && !row.country && !row.seat) continue;
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
  /** 'create' inserts a new application. 'update' patches the one that already
   *  exists for this email + role — re-importing a roster after fixing it is a
   *  normal workflow, not an error. */
  mode: 'create' | 'update';
  /** The application to patch, for mode === 'update'. */
  existingId: string | null;
  /** True when an update row would change nothing at all, so the result table
   *  can say "unchanged" rather than implying work was done. */
  noop: boolean;
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
    /** 1 or 2 in a double-delegation committee, 1 in a single-delegation
     *  committee, null when no allocation resolved at all. */
    seat: number | null;
  };
}

export interface CommitteeLite {
  id: string;
  name: string;
  abbreviation: string | null;
  delegation_size: number;
}

/** A single allocatable row from committee_country_slots — a country for a
 *  standard committee, or a character for a crisis one (same table, the
 *  committee editor writes country_code = getCountryByName(name)?.code ??
 *  name, so a character just carries its own name as the code). */
export interface RosterSlot {
  country_code: string;
  country_name: string;
}

/** An application already on this conference, keyed by `${email}|${role}`.
 *  Re-importing someone is an UPDATE, so the classifier needs their current
 *  state to decide what a second row would actually change. */
export interface ExistingApplication {
  id: string;
  /** Their current allocation, if any — null when imported without one. */
  committeeId: string | null;
  countryCode: string | null;
  countryName: string | null;
  seat: number | null;
  /** Already attached to a delegation? Blank cells never clear this. */
  hasSociety: boolean;
}

export interface ClassifyContext {
  committees: CommitteeLite[];
  /** Every application already on this conference, by `${lowercased email}|${role}`
   *  (invited_email or profile email). */
  existingByEmailRole: Map<string, ExistingApplication>;
  /** `${committeeId}|${countryCode}|${seat}` for every country already allocated in this conference — single-delegation allocations are keyed at seat 1. */
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

    // Re-importing an existing delegate UPDATES them rather than failing. The
    // common workflow is: import the roster, discover a country was missing
    // from a committee, fix the roster, re-import. That used to be rejected
    // wholesale ("an application already exists"), leaving the organiser to
    // hand-assign the stragglers.
    let mode: 'create' | 'update' = 'create';
    let existing: ExistingApplication | undefined;

    const emailValid = EMAIL_PATTERN.test(raw.email.trim());
    if (emailValid && role) {
      const key = `${emailLower}|${role}`;
      if (seenInFile.has(key)) {
        // Still an error: two rows for one person in ONE file is a mistake in
        // the file, not an intentional update.
        reasons.push({ severity: 'error', message: 'Duplicate email + role within this file.' });
      }
      seenInFile.add(key);
      existing = ctx.existingByEmailRole.get(key);
      if (existing) mode = 'update';
    }

    if (raw.country.trim() && !raw.committee.trim()) {
      reasons.push({ severity: 'error', message: 'Country given without a committee.' });
    }

    // Committee / country resolution (computed for display even on errored rows).
    let committeeId: string | null = null;
    let committeeLabel: string | null = null;
    let countryCode: string | null = null;
    let countryName: string | null = null;
    let seat: number | null = null;

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
            // Seat resolution. The `seat` column is OPTIONAL: listing a country
            // once per delegate is all an organiser has to do. In a
            // double-delegation committee the first row naming France takes
            // seat 1 and the second takes seat 2 — writing "France" twice does
            // the obvious thing. An explicit 1/2 is still honoured for anyone
            // who wants to pin which half a delegate sits in.
            //
            // This used to demand an explicit seat and raise an ERROR without
            // one, which dropped the delegate entirely rather than merely
            // leaving them unallocated — so a 200-row file with no seat column
            // imported nobody at all.
            const isDouble = committee.delegation_size === 2;
            const capacity = isDouble ? 2 : 1;
            const seatRaw = raw.seat.trim();
            const seatTaken = (n: number) => {
              // A seat this same delegate already occupies is not "taken" from
              // their point of view — otherwise re-importing an unchanged row
              // would warn that they are blocking themselves.
              if (existing
                  && existing.committeeId === committee.id
                  && existing.countryCode === slot.country_code
                  && (existing.seat ?? 1) === n) {
                return false;
              }
              const k = `${committee.id}|${slot.country_code}|${n}`;
              return ctx.existingAllocations.has(k) || claimedInFile.has(k);
            };
            let seatValue: number | null = null;

            if (seatRaw === '') {
              for (let n = 1; n <= capacity; n++) {
                if (!seatTaken(n)) { seatValue = n; break; }
              }
              if (seatValue === null) {
                reasons.push({ severity: 'warning', message: `${slot.country_name} is fully allocated in ${committeeLabel}, so imported without allocation.` });
              }
            } else {
              const n = Number(seatRaw);
              if (!Number.isInteger(n) || n < 1 || n > capacity) {
                reasons.push({
                  severity: 'error',
                  message: capacity === 1
                    ? `${committeeLabel} seats one delegate per country, so Seat must be 1 or left empty.`
                    : `Seat must be 1 or 2 in ${committeeLabel}, or left empty to fill the next free seat.`,
                });
              } else if (seatTaken(n)) {
                reasons.push({ severity: 'warning', message: `${slot.country_name}${isDouble ? ` seat ${n}` : ''} is already allocated in ${committeeLabel}, so imported without allocation.` });
              } else {
                seatValue = n;
              }
            }

            if (seatValue !== null) {
              claimedInFile.add(`${committee.id}|${slot.country_code}|${seatValue}`);
              committeeId = committee.id;
              // Copied verbatim from the matched slot row, no derivation —
              // guarantees import-created allocations are byte-identical to
              // UI-created ones.
              countryCode = slot.country_code;
              countryName = slot.country_name;
              seat = seatValue;
            }
          }
        }
      }
    }

    const payment = mapPayment(raw.payment);
    if (payment.unknown) {
      reasons.push({ severity: 'warning', message: `Unknown payment value "${raw.payment}", defaulting to unpaid.` });
    }

    // ── Update-specific rules ────────────────────────────────────────────────
    // A re-import FILLS GAPS. It never overwrites an allocation an organiser
    // has already made — moving a delegate who is sitting somewhere is a
    // decision, not a side effect of re-running a spreadsheet.
    let noop = false;
    if (mode === 'update' && existing) {
      const alreadyAllocated = !!existing.committeeId && !!existing.countryCode;
      const sameSeat = alreadyAllocated
        && existing.committeeId === committeeId
        && existing.countryCode === countryCode;
      // Set when we declined a genuine change, so the "adds nothing new" line
      // below is suppressed — the row DID carry something new, we just refused
      // to act on it, and saying both at once contradicts itself.
      let declinedAMove = false;

      if (alreadyAllocated && committeeId && !sameSeat) {
        reasons.push({
          severity: 'warning',
          message: `Already allocated to ${existing.countryName ?? existing.countryCode}, so the new assignment was ignored. Move them from Assignment if that's intended.`,
        });
        committeeId = null; countryCode = null; countryName = null; seat = null;
        declinedAMove = true;
      } else if (sameSeat) {
        // Re-stating what they already have is not a change.
        committeeId = null; countryCode = null; countryName = null; seat = null;
      }

      // Blank cells mean "no change", never "clear it", so a partial re-import
      // can't wipe a delegation. Payment is deliberately untouched on update:
      // it now settles invoices as a side effect, which a spreadsheet should
      // not be able to trigger.
      const willAllocate = !!committeeId;
      const willSetSociety = !!raw.delegation.trim() && !existing.hasSociety;
      noop = !willAllocate && !willSetSociety;
      if (noop && !declinedAMove) {
        reasons.push({ severity: 'warning', message: 'Already imported, and this row adds nothing new.' });
      }
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
      mode,
      existingId: existing?.id ?? null,
      noop,
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
        seat,
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
