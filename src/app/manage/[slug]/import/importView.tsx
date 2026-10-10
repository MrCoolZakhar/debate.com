'use client';

// The organiser import page's look (Oct 2026 redesign, owner: "the easiest
// possible, literally one page, as little text as possible"). Presentation
// only: page.tsx owns every read, write, RPC and the paid-launch path, and
// hands its handlers down.
//
//   ImportDropZone  the one big drop zone, before a file is read
//   ImportReview    the file's rows as a list (ready / without a seat /
//                   skipped), big-number summary, filters only when there
//                   are problems, the one sticky button with its small
//                   inline confirm (always: an import sends invites), then
//                   the results in place

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Check, CheckCircle2, Download, FileSpreadsheet, Loader2, MinusCircle, Pencil, Upload as UploadIcon, XCircle, AlertTriangle,
} from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import type { ClassifiedImportRow, CommitteeLite, ImportableRole, ParsedImportRow } from '@/lib/applicantImport';

export const OUTFIT = "var(--font-brand), sans-serif";

export function roleLabel(role: string) {
  const map: Record<string, string> = {
    delegate: 'Delegate', 'head-delegate': 'Head Delegate',
    'faculty-advisor': 'Faculty Advisor', observer: 'Observer',
  };
  return map[role] ?? role;
}
// ── What the list says about each row (Oct 2026 redesign) ──────────────────
// Three marks only: ready, imported without a seat, skipped. The classifier's
// sentences stay the truth (and the tooltip); the list shows a short form.

export type Mark = 'ready' | 'noSeat' | 'skipped';

export const INK = '#1C1410';
export const INK_SOFT = '#5C4F42';
export const FOREST = '#1B3828';
export const GREEN = '#2A5A3C';
export const AMBER = '#8A6614';
export const RED = '#8B2020';
const HAIRLINE = 'rgba(27,56,40,0.08)';
const MARK_COLOR: Record<Mark, string> = { ready: GREEN, noSeat: AMBER, skipped: RED };

/** The short, plain form of one classifier sentence. Unknown ones pass through. */
function shortReason(m: string): string {
  let x: RegExpMatchArray | null;
  if (m.startsWith('Invalid email address')) return "Email can't receive mail";
  if (m === 'Missing name.') return 'No name';
  if (m.startsWith("Chairs aren't importable")) return 'Chairs are invited from Committees';
  if (m.startsWith('Add a role')) return 'No role';
  if ((x = m.match(/^Unknown role "(.*)"\./))) return `Unknown role "${x[1]}"`;
  if (m.startsWith('Duplicate email + role')) return 'Listed twice in this file';
  if (m.startsWith('Country given without a committee')) return 'Country but no committee';
  if ((x = m.match(/^Unknown payment value "(.*)"\./))) return `Unknown payment "${x[1]}"`;
  if ((x = m.match(/^Committee "(.*)" could be (.*), so imported/))) return `"${x[1]}" could be ${x[2]}`;
  if ((x = m.match(/^Committee "(.*)" not found/))) return `No committee called "${x[1]}"`;
  if ((x = m.match(/^'(.*)' is not in (.*)'s roster/))) return `${x[1]} is not in ${x[2]}`;
  if ((x = m.match(/^(.*) is fully allocated in (.*), so imported/))) return `${x[1]} is full in ${x[2]}`;
  if ((x = m.match(/^(.*) is already allocated in (.*), so imported/))) return `${x[1]} is taken in ${x[2]}`;
  if ((x = m.match(/^Already allocated to (.*), so the new assignment/))) return `Keeps their seat (${x[1]})`;
  if (m.startsWith('Already imported, and this row adds nothing new')) return 'Already imported';
  if ((x = m.match(/Seat must be (1 or 2|1)/))) return `Seat must be ${x[1]} or empty`;
  return m.replace(/\.$/, '');
}

function isSeatlessRole(role: ImportableRole | null) {
  return role === 'delegate' || role === 'head-delegate';
}

function markOf(r: ClassifiedImportRow): { mark: Mark; reason: string | null } {
  if (r.cls === 'error') {
    return { mark: 'skipped', reason: r.reasons.map(shortReason).join('. ') };
  }
  const allocWarning = r.reasons.find(m => m.includes('imported without allocation'));
  if (allocWarning) return { mark: 'noSeat', reason: shortReason(allocWarning) };
  if (isSeatlessRole(r.resolved.role) && !r.allocatedAfterImport) {
    return {
      mark: 'noSeat',
      reason: !r.raw.committee.trim() ? 'No committee in the file' : !r.raw.country.trim() ? 'No country in the file' : 'No seat',
    };
  }
  return { mark: 'ready', reason: r.reasons.length > 0 ? r.reasons.map(shortReason).join('. ') : null };
}

/** Which raw cells an error row needs, so the inline fix shows only those. */
type FixField = 'email' | 'name' | 'role' | 'payment' | 'committee' | 'seat';
function fixFieldsOf(r: ClassifiedImportRow): FixField[] {
  const out = new Set<FixField>();
  for (const m of r.reasons) {
    if (m.startsWith('Invalid email address') || m.startsWith('Duplicate email + role')) out.add('email');
    if (m === 'Missing name.') out.add('name');
    if (m.startsWith("Chairs aren't importable") || m.startsWith('Add a role') || m.startsWith('Unknown role')) out.add('role');
    if (m.startsWith('Unknown payment value')) out.add('payment');
    if (m.startsWith('Country given without a committee')) out.add('committee');
    if (m.includes('Seat must be')) out.add('seat');
  }
  return Array.from(out);
}

// ── Row outcome (post-execute) ──────────────────────────────────────────────

export type RowOutcome = 'imported' | 'imported-no-allocation' | 'updated' | 'unchanged' | 'skipped';

export interface ResultRow {
  row: ClassifiedImportRow;
  outcome: RowOutcome;
  note: string | null;
}

// ── Small pieces ─────────────────────────────────────────────────────────────

const ROLE_CHOICES: { value: string; label: string }[] = [
  { value: 'delegate', label: 'Delegate' },
  { value: 'head delegate', label: 'Head Delegate' },
  { value: 'faculty advisor', label: 'Faculty Advisor' },
  { value: 'observer', label: 'Observer' },
];

export const IMPORT_CSS = `
.gv-imp-title{margin:0;font-family:${OUTFIT};font-size:clamp(30px,3.4vw,42px);font-weight:800;letter-spacing:-0.015em;line-height:1.08;color:${INK}}
.gv-imp-lead{margin:8px 0 0;font-family:${OUTFIT};font-size:15px;line-height:1.45;color:${INK_SOFT}}
.gv-imp-link{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0;background:none;border:none;cursor:pointer;font-family:${OUTFIT};font-size:15px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px}
.gv-imp-link:disabled{opacity:0.55;cursor:default}
.gv-imp-link:focus{outline:none}
.gv-imp-link:focus-visible{outline:2px solid ${FOREST};outline-offset:3px;border-radius:4px}
.gv-imp-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:clamp(280px,42vh,380px);padding:36px 20px;border-radius:24px;cursor:pointer;text-align:center;background:#FFFFFF;border:2px dashed rgba(27,56,40,0.22);box-shadow:0 1px 2px rgba(27,56,40,0.05),0 12px 32px rgba(27,56,40,0.08);transition:border-color 160ms ease,background-color 160ms ease,transform 160ms ease}
.gv-imp-drop:hover{border-color:rgba(27,56,40,0.45)}
.gv-imp-drop[data-over]{border-color:${FOREST};background:#F6FAF6;transform:scale(1.005)}
.gv-imp-drop:focus{outline:none}
.gv-imp-drop:focus-visible{border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.18)}
.gv-imp-drop-disc{width:68px;height:68px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:${FOREST};background:radial-gradient(circle at 35% 30%,#F4E4A6,#EED98A 60%,#E2C772);box-shadow:inset 0 1px 0 rgba(255,255,255,0.6),0 6px 16px rgba(182,135,31,0.25)}
.gv-imp-drop-title{margin:0;font-family:${OUTFIT};font-size:clamp(20px,2.2vw,24px);font-weight:700;color:${INK};line-height:1.25}
.gv-imp-drop-sub{margin:0;font-family:${OUTFIT};font-size:13.5px;color:${INK_SOFT}}
.gv-imp-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 20px;border-radius:10px;border:none;cursor:pointer;font-family:${OUTFIT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);box-shadow:0 4px 12px rgba(27,56,40,0.22);transition:transform 120ms ease,opacity 160ms ease}
.gv-imp-primary:active{transform:scale(0.98)}
.gv-imp-primary:disabled{opacity:0.45;cursor:default;transform:none}
.gv-imp-primary:focus{outline:none}
.gv-imp-primary:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
.gv-imp-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:10px;cursor:pointer;font-family:${OUTFIT};font-size:15px;font-weight:600;color:${INK};background:#FFFFFF;border:1.5px solid rgba(28,20,16,0.22)}
.gv-imp-secondary:focus{outline:none}
.gv-imp-secondary:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
.gv-imp-error{margin:12px 0 0;font-family:${OUTFIT};font-size:14.5px;font-weight:600;color:${RED};line-height:1.45}
.gv-imp-ok{margin:0;font-family:${OUTFIT};font-size:14px;font-weight:600;color:${GREEN}}
.gv-imp-slim{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:6px 16px;border-radius:14px;font-family:${OUTFIT};font-size:14.5px}
.gv-imp-summary{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 26px;margin-bottom:14px}
.gv-imp-filters{display:flex;flex-wrap:wrap;gap:4px 18px;margin-bottom:10px}
.gv-imp-filter{min-height:40px;padding:0 2px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:${OUTFIT};font-size:14.5px;font-weight:600;color:${INK_SOFT}}
.gv-imp-filter[aria-pressed="true"]{color:${INK};border-bottom-color:${FOREST}}
.gv-imp-filter:focus{outline:none}
.gv-imp-filter:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-imp-list{background:#FFFFFF;border-radius:20px;border:1px solid rgba(27,56,40,0.07);box-shadow:0 1px 2px rgba(27,56,40,0.06),0 10px 28px rgba(27,56,40,0.08);overflow:hidden}
.gv-imp-row{display:grid;grid-template-columns:22px minmax(0,1fr);gap:4px 12px;padding:14px 18px;font-family:${OUTFIT};content-visibility:auto;contain-intrinsic-size:auto 76px}
.gv-imp-row + .gv-imp-row{border-top:1px solid ${HAIRLINE}}
.gv-imp-row > .gv-imp-c{grid-column:2}
.gv-imp-row > .gv-imp-wide{grid-column:2 / -1}
@media (min-width:768px){
  .gv-imp-row{grid-template-columns:22px minmax(0,1.5fr) minmax(0,0.9fr) minmax(0,1.4fr);gap:4px 16px;padding:14px 22px}
  .gv-imp-row > .gv-imp-c{grid-column:auto}
}
.gv-imp-fix{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;margin-top:8px;padding:12px;border-radius:14px;background:#F7F4EC}
.gv-imp-field{display:flex;flex-direction:column;gap:4px;flex:1 1 180px;min-width:0;font-size:12.5px;font-weight:600;color:${INK_SOFT}}
.gv-imp-field input,.gv-imp-field select{min-height:44px;padding:0 12px;border-radius:10px;border:1.5px solid #DDD4C0;background:#FFFFFF;font-family:${OUTFIT};font-size:16px;color:${INK};width:100%;min-width:0}
.gv-imp-field input:focus,.gv-imp-field select:focus{outline:none;border-color:${FOREST}}
.gv-imp-bar{position:sticky;bottom:8px;z-index:5;margin-top:16px;padding:12px 16px;padding-bottom:max(12px,env(safe-area-inset-bottom));border-radius:18px;background:#FFFFFF;border:1px solid rgba(27,56,40,0.08);box-shadow:0 -2px 10px rgba(27,56,40,0.05),0 12px 30px rgba(27,56,40,0.14)}
.gv-imp-bar-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px}
.gv-imp-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}
@media (max-width:639px){
  .gv-imp-go{width:100%}
  .gv-imp-actions{width:100%}
  .gv-imp-actions > button{flex:1 1 auto}
}
`;

/** A big number with its word beside it (the owner's way to show a count). */
export function BigCount({ n, word, color }: { n: number; word: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, fontFamily: OUTFIT }}>
      <span style={{ fontSize: 34, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{n}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: INK_SOFT }}>{word}</span>
    </span>
  );
}

/** "Mark as accepted": on = accepted (or seated), off = submitted for review. */
function AcceptSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      className="inline-flex items-center gap-3 cursor-pointer"
      style={{ fontFamily: OUTFIT, minHeight: 44 }}
      title={on
        ? 'They arrive accepted, or seated when the file gives them a seat'
        : 'They arrive as applications, for you to accept in Applications'}
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          width: 46, height: 28, borderRadius: 999, border: 'none', padding: 3, cursor: 'pointer', flexShrink: 0,
          background: on ? 'linear-gradient(90deg,#1B3828,#2A5A3C)' : '#D9D1BF',
          transition: 'background 160ms ease',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'block', width: 22, height: 22, borderRadius: 999, background: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 160ms ease',
          }}
        />
      </button>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: INK }}>Already accepted</span>
        <span style={{ fontSize: 12.5, color: INK_SOFT }}>{on ? 'They skip review' : 'You review them in Applications'}</span>
      </span>
    </label>
  );
}

function ImportRowItem({ row, mark, word, reason, committees, onFix }: {
  row: ClassifiedImportRow;
  mark: Mark;
  word: string;
  reason: string | null;
  committees: CommitteeLite[];
  /** Present for a skipped row before the import: replace raw cells and re-check. */
  onFix?: (patch: Partial<ParsedImportRow>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ParsedImportRow>(row.raw);
  const fields = onFix ? fixFieldsOf(row) : [];
  const color = MARK_COLOR[mark];
  const Icon = mark === 'ready' ? CheckCircle2 : mark === 'noSeat' ? MinusCircle : XCircle;
  const r = row.resolved;
  const isDouble = !!r.committeeId && committees.some(c => c.id === r.committeeId && c.delegation_size === 2);
  const emailBad = row.reasons.some(m => m.startsWith('Invalid email address'));
  const sub = [r.societyName, r.paymentStatus !== 'unpaid' ? (r.paymentStatus === 'paid' ? 'Paid' : 'Waived') : null].filter(Boolean).join(' · ');

  function startFix() {
    // A select shows a valid choice, so the draft starts on what it shows.
    const pay = row.raw.payment.trim().toLowerCase();
    setDraft({
      ...row.raw,
      payment: ['paid', 'unpaid', 'waived'].includes(pay) ? pay : 'unpaid',
      seat: ['1', '2'].includes(row.raw.seat.trim()) ? row.raw.seat.trim() : '',
    });
    setEditing(true);
  }
  function saveFix() {
    if (!onFix) return;
    const patch: Partial<ParsedImportRow> = {};
    for (const f of fields) {
      if (f === 'committee') {
        patch.committee = draft.committee;
        if (!draft.committee.trim()) patch.country = '';
      } else {
        patch[f] = draft[f];
      }
    }
    setEditing(false);
    onFix(patch);
  }

  let seat: ReactNode = null;
  if (r.committeeId && r.countryCode) {
    seat = (
      <span className="inline-flex items-start gap-2.5">
        <CircleFlag code={r.countryCode} country={r.countryName} size={24} decorative style={{ marginTop: 1 }} />
        <span style={{ minWidth: 0 }}>
          <span className="block" style={{ fontSize: 15, fontWeight: 600, color: INK, overflowWrap: 'anywhere' }}>{r.countryName}</span>
          <span className="block" style={{ fontSize: 13, color: INK_SOFT, overflowWrap: 'anywhere' }}>
            {r.committeeLabel}{isDouble && r.seat != null ? ` · seat ${r.seat}` : ''}
          </span>
        </span>
      </span>
    );
  } else if (row.allocatedAfterImport) {
    seat = <span style={{ fontSize: 14, color: INK_SOFT }}>Keeps their seat</span>;
  } else if (row.raw.committee.trim() || row.raw.country.trim()) {
    seat = (
      <span style={{ minWidth: 0 }}>
        <span className="block" style={{ fontSize: 15, fontWeight: 600, color: r.committeeLabel ? INK : AMBER, overflowWrap: 'anywhere' }}>
          {row.raw.country.trim() || r.committeeLabel || row.raw.committee.trim()}
        </span>
        {(row.raw.country.trim() ? (r.committeeLabel ?? row.raw.committee.trim()) : null) && (
          <span className="block" style={{ fontSize: 13, color: INK_SOFT, overflowWrap: 'anywhere' }}>
            {r.committeeLabel ?? row.raw.committee.trim()}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="gv-imp-row" role="listitem">
      <span title={word} aria-label={word} role="img" style={{ color, paddingTop: 1 }}>
        <Icon size={20} strokeWidth={2.3} aria-hidden />
      </span>

      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: row.raw.name.trim() ? INK : RED, overflowWrap: 'anywhere', lineHeight: 1.3 }}>
          {row.raw.name.trim() || 'No name'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 13.5, color: emailBad ? RED : INK_SOFT, overflowWrap: 'anywhere', lineHeight: 1.35 }}>
          {row.raw.email.trim() || 'No email'}
        </p>
      </div>

      <div className="gv-imp-c" style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: r.role ? INK : RED, overflowWrap: 'anywhere' }}>
          {r.role ? roleLabel(r.role) : (row.raw.role.trim() || 'No role')}
        </p>
        {sub && <p style={{ margin: '2px 0 0', fontSize: 13, color: INK_SOFT, overflowWrap: 'anywhere' }}>{sub}</p>}
      </div>

      {seat ? <div className="gv-imp-c" style={{ minWidth: 0 }}>{seat}</div> : <div className="gv-imp-c hidden md:block" />}

      {(reason || (fields.length > 0 && !editing)) && (
        <div className="gv-imp-wide flex flex-wrap items-center gap-x-3" style={{ minWidth: 0 }}>
          {reason && (
            <p
              style={{ margin: 0, fontSize: 13.5, fontWeight: mark === 'ready' ? 500 : 600, color: mark === 'ready' ? INK_SOFT : color, lineHeight: 1.4, overflowWrap: 'anywhere' }}
              title={row.reasons.join(' ')}
            >
              {reason}
            </p>
          )}
          {fields.length > 0 && !editing && (
            <button type="button" className="gv-imp-link" style={{ minHeight: 32, fontSize: 14 }} onClick={startFix}>
              <Pencil size={13} aria-hidden /> Fix
            </button>
          )}
        </div>
      )}

      {editing && (
        <form
          className="gv-imp-wide gv-imp-fix"
          onSubmit={e => { e.preventDefault(); saveFix(); }}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false); } }}
        >
          {fields.includes('name') && (
            <label className="gv-imp-field">Name
              <input autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </label>
          )}
          {fields.includes('email') && (
            <label className="gv-imp-field">Email
              <input type="email" autoFocus={!fields.includes('name')} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
            </label>
          )}
          {fields.includes('role') && (
            <label className="gv-imp-field" style={{ flexBasis: 160 }}>Role
              <select value={ROLE_CHOICES.some(o => o.value === draft.role.trim().toLowerCase()) ? draft.role.trim().toLowerCase() : ''} onChange={e => setDraft({ ...draft, role: e.target.value })}>
                <option value="" disabled>Choose a role</option>
                {ROLE_CHOICES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          )}
          {fields.includes('payment') && (
            <label className="gv-imp-field" style={{ flexBasis: 140 }}>Payment
              <select value={['paid', 'unpaid', 'waived'].includes(draft.payment.trim().toLowerCase()) ? draft.payment.trim().toLowerCase() : 'unpaid'} onChange={e => setDraft({ ...draft, payment: e.target.value })}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </select>
            </label>
          )}
          {fields.includes('committee') && (
            <label className="gv-imp-field">Committee
              <select value={draft.committee} onChange={e => setDraft({ ...draft, committee: e.target.value })}>
                <option value="">No committee (no seat)</option>
                {committees.map(c => {
                  const v = c.abbreviation ?? c.name;
                  return <option key={c.id} value={v}>{c.abbreviation ? `${c.abbreviation} (${c.name})` : c.name}</option>;
                })}
              </select>
            </label>
          )}
          {fields.includes('seat') && (
            <label className="gv-imp-field" style={{ flexBasis: 120 }}>Seat
              <select value={['1', '2'].includes(draft.seat.trim()) ? draft.seat.trim() : ''} onChange={e => setDraft({ ...draft, seat: e.target.value })}>
                <option value="">Next free</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
          )}
          <div className="flex gap-2" style={{ flex: '0 0 auto' }}>
            <button type="button" className="gv-imp-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="gv-imp-primary">Save</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── The drop zone ───────────────────────────────────────────────────────────

export function ImportDropZone({ parsing, fileName, fileError, onChoose, onFile, onTemplate }: {
  parsing: boolean;
  fileName: string | null;
  fileError: string | null;
  onChoose: () => void;
  onFile: (file: File) => void;
  onTemplate: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a spreadsheet to import"
        aria-busy={parsing || undefined}
        onClick={() => { if (!parsing) onChoose(); }}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !parsing) { e.preventDefault(); onChoose(); } }}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !parsing) onFile(file);
        }}
        className="gv-imp-drop"
        data-over={over || undefined}
      >
        {parsing ? (
          <>
            <Loader2 size={34} className="animate-spin" style={{ color: FOREST }} aria-hidden />
            <p className="gv-imp-drop-title">Reading <span style={{ overflowWrap: 'anywhere' }}>{fileName}</span></p>
          </>
        ) : (
          <>
            <span className="gv-imp-drop-disc" aria-hidden><FileSpreadsheet size={30} strokeWidth={1.9} /></span>
            <p className="gv-imp-drop-title">Drop your spreadsheet here</p>
            <span className="gv-imp-primary" style={{ pointerEvents: 'none' }}>
              <UploadIcon size={16} aria-hidden /> Choose a file
            </span>
            <p className="gv-imp-drop-sub">CSV or Excel, with email, name and role</p>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
        <button type="button" className="gv-imp-link" onClick={onTemplate}>
          <Download size={15} aria-hidden /> Download the template
        </button>
      </div>
      {fileError && <p role="alert" className="gv-imp-error">{fileError}</p>}
    </>
  );
}

// ── The review: summary, list, the one button, the results ─────────────────

export type ImportFilter = 'all' | 'noSeat' | 'skipped';

export function ImportReview({
  phase, fileName, rows, committees, results, filter, onFilter, confirming, onCancelConfirm,
  accepted, onAccepted, onImport, onChooseFile, onFixRow, onReset,
  importBlocked, invitesQueued, applicationsHref, storeHref, footer,
}: {
  phase: 'preview' | 'importing' | 'results';
  fileName: string | null;
  rows: ClassifiedImportRow[];
  committees: CommitteeLite[];
  results: ResultRow[];
  filter: ImportFilter;
  onFilter: (f: ImportFilter) => void;
  confirming: boolean;
  onCancelConfirm: () => void;
  accepted: boolean;
  onAccepted: (on: boolean) => void;
  onImport: () => void;
  onChooseFile: () => void;
  onFixRow: (rowNumber: number, patch: Partial<ParsedImportRow>) => void;
  onReset: () => void;
  importBlocked: string | null;
  invitesQueued: number | null;
  applicationsHref: string;
  storeHref: string;
  /** Shown under the bar once the import is done (the invites line). */
  footer?: ReactNode;
}) {
  // Each row's mark: from the classifier before the import, from what really
  // happened after it.
  const done = phase === 'results';
  const resultByRow = new Map(results.map(r => [r.row.rowNumber, r]));
  const viewOf = (r: ClassifiedImportRow): { mark: Mark; reason: string | null; word: string } => {
    const m = markOf(r);
    const res = done ? resultByRow.get(r.rowNumber) : undefined;
    if (!res) return { ...m, word: m.mark === 'ready' ? 'Ready' : m.mark === 'noSeat' ? 'No seat' : 'Skipped' };
    switch (res.outcome) {
      case 'skipped':
        return { mark: 'skipped', reason: r.cls === 'error' ? m.reason : res.note, word: 'Skipped' };
      case 'imported-no-allocation':
        return { mark: 'noSeat', reason: m.mark === 'noSeat' ? m.reason : res.note, word: 'Imported, no seat' };
      case 'unchanged':
        return { mark: 'ready', reason: null, word: 'Already up to date' };
      case 'updated':
        return { mark: 'ready', reason: m.mark === 'ready' ? m.reason : null, word: 'Updated' };
      default:
        return { mark: 'ready', reason: m.mark === 'ready' ? m.reason : null, word: 'Imported' };
    }
  };
  const views = rows.map(r => ({ row: r, ...viewOf(r) }));
  const countOf = (k: Mark) => views.filter(v => v.mark === k).length;
  const readyCount = countOf('ready');
  const noSeatCount = countOf('noSeat');
  const skippedCount = countOf('skipped');
  const notedCount = views.filter(v => v.mark === 'ready' && v.reason).length;
  const importableCount = rows.filter(r => r.cls !== 'error').length;
  const unchangedCount = results.filter(r => r.outcome === 'unchanged').length;
  const visible = filter === 'all' ? views : views.filter(v => v.mark === filter);
  const peopleWord = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
  // Who actually gets an invite: exactly the rows executeImport invites, the
  // NEW rows that are not skipped (re-imported people are never re-invited).
  const inviteCount = rows.filter(r => r.cls !== 'error' && r.mode === 'create').length;
  const flagLine = [
    noSeatCount > 0 ? `${noSeatCount} without a seat` : null,
    skippedCount > 0 ? `${skippedCount} skipped` : null,
    notedCount > 0 ? `${notedCount} with a note` : null,
  ].filter(Boolean).join(', ');
  const confirmLine = [
    inviteCount > 0 ? `This sends an invite email to ${peopleWord(inviteCount)}.` : 'This sends no invite emails.',
    flagLine ? `${flagLine.charAt(0).toUpperCase()}${flagLine.slice(1)}.` : null,
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4" style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT }}>
        <FileSpreadsheet size={16} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
        <span style={{ overflowWrap: 'anywhere', color: INK, fontWeight: 600 }}>{fileName}</span>
        {phase === 'preview' && (
          <button type="button" className="gv-imp-link" onClick={onChooseFile}>Choose another file</button>
        )}
      </div>

      <div className="gv-imp-summary" aria-live="polite">
        <BigCount n={done ? readyCount - unchangedCount : readyCount} word={done ? 'imported' : 'ready'} color={GREEN} />
        {noSeatCount > 0 && <BigCount n={noSeatCount} word="without a seat" color={AMBER} />}
        {skippedCount > 0 && <BigCount n={skippedCount} word="skipped" color={RED} />}
        {done && unchangedCount > 0 && <BigCount n={unchangedCount} word="already up to date" color={INK_SOFT} />}
      </div>

      {done && invitesQueued !== null && invitesQueued > 0 && (
        <p className="gv-imp-ok" style={{ margin: '-4px 0 12px' }}>Invites sent to {peopleWord(invitesQueued)}</p>
      )}

      {(noSeatCount > 0 || skippedCount > 0) && (
        <div className="gv-imp-filters" role="group" aria-label="Show">
          {([
            ['all', 'All', views.length],
            ['noSeat', 'Without a seat', noSeatCount],
            ['skipped', 'Skipped', skippedCount],
          ] as const).filter(([, , n]) => n > 0).map(([k, label, n]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => onFilter(k)} className="gv-imp-filter">
              {label} <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>{n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="gv-imp-list" role="list">
        {visible.map(v => (
          <ImportRowItem
            key={v.row.rowNumber}
            row={v.row}
            mark={v.mark}
            word={v.word}
            reason={v.reason}
            committees={committees}
            onFix={phase === 'preview' && v.row.cls === 'error' ? patch => onFixRow(v.row.rowNumber, patch) : undefined}
          />
        ))}
        {visible.length === 0 && (
          <p style={{ margin: 0, padding: '22px 18px', fontFamily: OUTFIT, color: INK_SOFT, fontSize: 14 }}>Nothing here</p>
        )}
      </div>

      {/* The one action, pinned to the bottom of the screen. */}
      <div className="gv-imp-bar">
        {phase === 'preview' && (confirming ? (
          <div className="gv-imp-bar-row" role="alert">
            <p style={{ margin: 0, flex: '1 1 220px', fontFamily: OUTFIT, fontSize: 15, color: INK, lineHeight: 1.4 }}>
              <b>{confirmLine}</b> {skippedCount > 0 ? 'Import the rest?' : 'Import now?'}
            </p>
            <div className="gv-imp-actions">
              <button type="button" className="gv-imp-secondary" onClick={onCancelConfirm}>Cancel</button>
              <button type="button" className="gv-imp-primary" onClick={onImport} autoFocus>Import</button>
            </div>
          </div>
        ) : (
          <div className="gv-imp-bar-row">
            <AcceptSwitch on={accepted} onChange={onAccepted} />
            <button type="button" className="gv-imp-primary gv-imp-go" onClick={onImport} disabled={importableCount === 0}>
              <Check size={17} aria-hidden /> Import {peopleWord(importableCount)}
            </button>
          </div>
        ))}

        {phase === 'importing' && (
          <div className="gv-imp-bar-row" style={{ justifyContent: 'center', minHeight: 46 }}>
            <Loader2 size={18} className="animate-spin" style={{ color: FOREST }} aria-hidden />
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, color: INK }}>Importing {peopleWord(importableCount)}</p>
          </div>
        )}

        {done && (
          <div className="flex flex-col gap-2">
            {importBlocked && (
              <div className="gv-imp-slim" role="alert" style={{ backgroundColor: 'rgba(139,32,32,0.07)' }}>
                <AlertTriangle size={16} style={{ color: RED, flexShrink: 0 }} aria-hidden />
                <p style={{ flex: 1, margin: 0, color: RED, minWidth: 200, lineHeight: 1.45 }}>{importBlocked}</p>
                <Link href={storeHref} className="gv-imp-link" style={{ color: RED }}>Go to Store</Link>
              </div>
            )}
            <div className="gv-imp-bar-row">
              <button type="button" className="gv-imp-link" onClick={onReset}>Import another file</button>
              <Link href={applicationsHref} className="gv-imp-primary gv-imp-go">Go to Applications</Link>
            </div>
          </div>
        )}
      </div>
      {done && footer ? <div className="mt-4">{footer}</div> : null}
    </>
  );
}
