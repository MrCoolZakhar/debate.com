'use client';

// PeopleList — the Invoices page's filters and rows (prompt 93). One row per
// person who is BILLED (a leader's delegate and advisor tickets sit under the
// leader), in financials_people's own order: something to do first, then what
// they owe, then name. Filters are pure; the page keeps them in the URL.

import { Search } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { INK, INK_SOFT, FOREST, DEEP_GOLD, LINE } from '../dashboardKit';
import { KIND_NAME, KIND_ORDER } from '../financialsApi';
import { roleWord, type PersonRow } from './invoicesApi';

export const INDEPENDENTS = '__independent';
export const PAGE_SIZE = 50;

export type StatusFilter = 'all' | 'owes' | 'review' | 'paid' | 'unclaimed' | 'closed';
export const STATUS_OPTIONS: { v: StatusFilter; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'owes', label: 'Owes money' },
  { v: 'review', label: 'In review' },
  { v: 'paid', label: 'Paid in full' },
  { v: 'unclaimed', label: 'Not claimed yet' },
  { v: 'closed', label: 'Closed' },
];

export interface Filters { q: string; delegation: string; status: StatusFilter; type: string }

export function filterPeople(people: PersonRow[], f: Filters): PersonRow[] {
  const q = f.q.trim().toLowerCase();
  return people.filter(p => {
    if (q && ![p.name, p.email ?? '', p.delegation ?? ''].some(s => s.toLowerCase().includes(q))) return false;
    if (f.delegation === INDEPENDENTS ? !!p.delegation : (f.delegation && p.delegation !== f.delegation)) return false;
    switch (f.status) {
      case 'owes': if (!(p.owed_cents > 0 && !p.closed)) return false; break;
      case 'review': if (!(p.in_review_cents > 0)) return false; break;
      case 'paid': if (!(p.owed_cents === 0 && p.paid_cents > 0 && !p.closed)) return false; break;
      case 'unclaimed': if (p.claimed) return false; break;
      case 'closed': if (!p.closed) return false; break;
    }
    if (f.type && !(p.kinds ?? []).includes(f.type)) return false;
    return true;
  });
}

export const INV_CSS = `
.gv-inv-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px}
.gv-inv-search{position:relative;flex:1 1 240px;min-width:200px;max-width:380px}
.gv-inv-search svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:${INK_SOFT}}
.gv-inv-search input{width:100%;height:44px;padding:0 14px 0 40px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.2);background:#FFFFFF;font-family:${OUTFIT};font-size:14.5px;color:${INK}}
.gv-inv-search input:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-inv-select{height:44px;padding:0 34px 0 14px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.2);background:#FFFFFF;font-family:${OUTFIT};font-size:14px;font-weight:600;color:${INK};cursor:pointer;max-width:100%}
.gv-inv-select:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-inv-list{display:flex;flex-direction:column;background:#FFFFFF;border-radius:20px;padding:4px 0;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
.gv-inv-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 18px;cursor:pointer;transition:background-color 120ms ease}
.gv-inv-row + .gv-inv-row{border-top:1px solid ${LINE}}
.gv-inv-row:hover{background:#FAF8F3}
.gv-inv-row:focus{outline:none}
.gv-inv-row:focus-visible{box-shadow:inset 0 0 0 2px ${FOREST}}
.gv-inv-row[data-selected]{background:rgba(238,217,138,0.18)}
.gv-inv-row input[type=checkbox]{width:20px;height:20px;accent-color:${FOREST};cursor:pointer}
.gv-inv-name{margin:0;font-size:15.5px;font-weight:700;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-inv-sub{margin:2px 0 0;font-size:13px;line-height:1.4;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-inv-flag{display:inline-flex;align-items:center;gap:6px;margin:0 0 4px;font-size:12.5px;font-weight:700;color:${DEEP_GOLD}}
.gv-inv-flag b{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#EED98A;color:${INK};font-size:12px;font-variant-numeric:tabular-nums}
.gv-inv-nums{display:flex;gap:22px;text-align:right}
.gv-inv-num{min-width:96px}
.gv-inv-num b{display:block;font-size:17px;font-weight:800;font-variant-numeric:tabular-nums;color:${INK}}
.gv-inv-num span{display:block;font-size:12px;color:${INK_SOFT}}
.gv-inv-num .gv-inv-ok{font-size:14px;font-weight:700;color:#2A5A3C}
@media (max-width:639px){
  .gv-inv-row{grid-template-columns:28px minmax(0,1fr)}
  .gv-inv-nums{grid-column:2;justify-content:flex-start;text-align:left}
  .gv-inv-num{min-width:0}
}
.gv-inv-bulk{position:sticky;bottom:16px;z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:14px 0 0;padding:12px 16px;border-radius:16px;background:#FFFFFF;box-shadow:0 2px 0 rgba(27,56,40,0.06),0 18px 40px -18px rgba(27,56,40,0.45)}
.gv-inv-bulk-count{font-size:15px;font-weight:800;color:${INK};margin-right:auto}
`;

export function FiltersBar({ f, delegations, onChange }: {
  f: Filters;
  delegations: string[];
  onChange: (patch: Partial<Filters>) => void;
}) {
  return (
    <div className="gv-inv-filters" role="search">
      <label className="gv-inv-search">
        <Search size={16} strokeWidth={2.4} aria-hidden />
        <input type="search" value={f.q} placeholder="Name, email or delegation" aria-label="Search people"
          onChange={e => onChange({ q: e.target.value })} />
      </label>
      <select className="gv-inv-select" aria-label="Delegation" value={f.delegation} onChange={e => onChange({ delegation: e.target.value })}>
        <option value="">All delegations</option>
        {delegations.map(d => <option key={d} value={d}>{d}</option>)}
        <option value={INDEPENDENTS}>Independents</option>
      </select>
      <select className="gv-inv-select" aria-label="Status" value={f.status} onChange={e => onChange({ status: e.target.value as StatusFilter })}>
        {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.v === 'all' ? 'All statuses' : o.label}</option>)}
      </select>
      <select className="gv-inv-select" aria-label="Ticket type" value={f.type} onChange={e => onChange({ type: e.target.value })}>
        <option value="">All ticket types</option>
        {KIND_ORDER.map(k => <option key={k} value={k}>{KIND_NAME[k]}</option>)}
      </select>
    </div>
  );
}

export function PersonLine({ p, selected, onToggle, onOpen, money, readOnly }: {
  p: PersonRow;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  money: (c: number, currency: string | null) => string;
  readOnly: boolean;
}) {
  const sub = [roleWord(p.role), p.delegation].filter(Boolean).join(' · ');
  return (
    <div
      className="gv-inv-row"
      role="button"
      tabIndex={0}
      data-selected={selected || undefined}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-label={`${p.name}, open their payments`}
    >
      <span onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        {!readOnly && (
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${p.name}`} />
        )}
      </span>
      <div style={{ minWidth: 0 }}>
        {p.to_do > 0 && (
          <p className="gv-inv-flag"><b>{p.to_do}</b> to review</p>
        )}
        <p className="gv-inv-name">{p.name}</p>
        {sub && <p className="gv-inv-sub">{sub}</p>}
        {!p.claimed && <p className="gv-inv-sub">Not claimed yet</p>}
        {p.closed && <p className="gv-inv-sub">{p.app_status === 'withdrawn' ? 'Withdrawn' : 'Rejected'}</p>}
      </div>
      <div className="gv-inv-nums">
        <div className="gv-inv-num">
          {p.owed_cents > 0
            ? <b>{money(p.owed_cents, p.currency)}</b>
            : <b className="gv-inv-ok">Nothing owed</b>}
          <span>Outstanding</span>
        </div>
        <div className="gv-inv-num">
          <b style={{ color: FOREST }}>{money(p.paid_cents, p.currency)}</b>
          <span>Paid</span>
          {p.in_review_cents > 0 && <span>in review: {money(p.in_review_cents, p.currency)}</span>}
        </div>
      </div>
    </div>
  );
}
