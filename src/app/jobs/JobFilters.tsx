'use client';

// ── /jobs filters: Explore's pills, driving the job_board() filters ────────
//
// The search field, then one row of white pill chips (each a popover on
// desktop, a bottom sheet on phones, from Explore's ExploreChrome): Role,
// Where, When, Level, Format, Offers, Deadline and the "Under 10 applicants"
// toggle, with "Clear all" while anything is on. Where works like Explore's:
// countries (at most five) or one region, which replaces the countries; the
// chosen places show as white pills under the row, each with its round X.
// Every change goes up through `onChange`, and the page writes the URL.

import { useEffect, useMemo, useState } from 'react';
import {
  Search, Gavel, Globe, MapPin, CalendarDays, GraduationCap, Monitor, Gift, Clock, Users, X,
} from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { DatePicker } from '@/components/DatePicker';
import { UN_COUNTRIES, countryMatchRank, getCountryByName } from '@/lib/countries';
import { JOB_OFFER_LABEL, JOB_OFFER_ORDER, JOB_ROLE_LABEL, type JobRegion, type JobRole } from '@/lib/jobBoard';
import { ChoiceRow, FilterChip, ToggleChip } from '../conferences/explore/ExploreChrome';
import { JOB_REGIONS, JOB_REGION_LABEL, MAX_JOB_COUNTRIES, hasJobFilters, type JobQuery } from './jobQuery';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

const ROLES: JobRole[] = ['chair', 'secretariat', 'staff'];

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The named date ranges When offers, worked out from today. */
function whenBuckets(): { key: string; label: string; from: string; to: string }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const in3 = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  return [
    { key: 'month', label: 'This month', from: iso(today), to: iso(endOfMonth) },
    { key: 'next3', label: 'Next 3 months', from: iso(today), to: iso(in3) },
    { key: 'year', label: 'This year', from: iso(today), to: iso(endOfYear) },
  ];
}

function shortDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function JobFilters({ query, onChange, onClearAll }: {
  query: JobQuery;
  onChange: (patch: Partial<JobQuery>) => void;
  onClearAll: () => void;
}) {
  // The search types locally and reaches the URL after a short pause. A
  // change from outside (Clear all, the back button) resets the field.
  const [text, setText] = useState(query.q);
  const [seenQ, setSeenQ] = useState(query.q);
  if (query.q !== seenQ) { setSeenQ(query.q); setText(query.q); }
  useEffect(() => {
    if (text === query.q) return;
    const t = window.setTimeout(() => onChange({ q: text }), 350);
    return () => window.clearTimeout(t);
  }, [text, query.q, onChange]);

  const buckets = useMemo(() => whenBuckets(), []);
  const bucket = buckets.find((b) => b.from === query.from && b.to === query.to) ?? null;
  const whenSummary = bucket
    ? bucket.label
    : query.from && query.to ? `${shortDate(query.from)} to ${shortDate(query.to)}`
      : query.from ? `From ${shortDate(query.from)}`
        : query.to ? `Until ${shortDate(query.to)}` : null;

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const roleSummary = query.roles.length === 1 ? JOB_ROLE_LABEL[query.roles[0]] : query.roles.length ? `${query.roles.length} roles` : null;
  const offerSummary = query.offers.length === 1 ? JOB_OFFER_LABEL[query.offers[0]] : query.offers.length ? `${query.offers.length} offers` : null;
  const whereSummary = query.regions.length
    ? JOB_REGION_LABEL[query.regions[0]]
    : query.countries.length === 1 ? query.countries[0]
      : query.countries.length ? `${query.countries.length} countries` : null;

  return (
    <div style={{ fontFamily: FONT }}>
      <style>{FILTER_CSS}</style>
      <label className="gv-job-search">
        <Search size={18} strokeWidth={2.4} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
        <span className="sr-only">Search roles</span>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onChange({ q: text }); }}
          placeholder="Search a role or a conference"
          maxLength={120}
          className="focus:outline-none"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setText(''); onChange({ q: '' }); }}
            className="gv-job-search-x focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          >
            <X size={14} strokeWidth={2.6} aria-hidden />
          </button>
        )}
      </label>

      <div className="gv-job-band" role="group" aria-label="Filters">
        <FilterChip label="Role" title="Role" icon={Gavel} active={query.roles.length > 0} summary={roleSummary} onClear={() => onChange({ roles: [] })}>
          {ROLES.map((r) => (
            <ChoiceRow key={r} kind="check" label={JOB_ROLE_LABEL[r]} active={query.roles.includes(r)} onClick={() => onChange({ roles: toggle(query.roles, r) })} />
          ))}
        </FilterChip>

        <FilterChip
          label="Where" title="Where" icon={Globe}
          active={query.regions.length > 0 || query.countries.length > 0}
          summary={whereSummary}
          onClear={() => onChange({ regions: [], countries: [] })}
        >
          <WherePanel query={query} onChange={onChange} />
        </FilterChip>

        <FilterChip label="When" title="When" icon={CalendarDays} active={!!(query.from || query.to)} summary={whenSummary} onClear={() => onChange({ from: '', to: '' })}>
          <ChoiceRow label="Any time" active={!query.from && !query.to} onClick={() => onChange({ from: '', to: '' })} />
          {buckets.map((b) => (
            <ChoiceRow key={b.key} label={b.label} active={bucket?.key === b.key} onClick={() => onChange({ from: b.from, to: b.to })} />
          ))}
          <p style={{ margin: '14px 4px 8px', fontSize: 13, fontWeight: 700, color: INK_SOFT }}>Or pick dates</p>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <DatePicker value={query.from} onChange={(v) => onChange({ from: v })} max={query.to || undefined} placeholder="From" />
            <DatePicker value={query.to} onChange={(v) => onChange({ to: v })} min={query.from || undefined} placeholder="To" />
          </div>
        </FilterChip>

        <FilterChip
          label="Level" title="Level" icon={GraduationCap} active={!!query.level}
          summary={query.level === 'school' ? 'High school' : query.level === 'university' ? 'University' : null}
          onClear={() => onChange({ level: '' })}
        >
          <ChoiceRow label="Any level" active={!query.level} onClick={() => onChange({ level: '' })} />
          <ChoiceRow label="High school" active={query.level === 'school'} onClick={() => onChange({ level: 'school' })} />
          <ChoiceRow label="University" active={query.level === 'university'} onClick={() => onChange({ level: 'university' })} />
        </FilterChip>

        <FilterChip
          label="Format" title="Format" icon={Monitor} active={!!query.format}
          summary={query.format === 'in-person' ? 'In person' : query.format === 'online' ? 'Online' : query.format === 'hybrid' ? 'Hybrid' : null}
          onClear={() => onChange({ format: '' })}
        >
          <ChoiceRow label="Any format" active={!query.format} onClick={() => onChange({ format: '' })} />
          <ChoiceRow label="In person" active={query.format === 'in-person'} onClick={() => onChange({ format: 'in-person' })} />
          <ChoiceRow label="Online" active={query.format === 'online'} onClick={() => onChange({ format: 'online' })} />
          <ChoiceRow label="Hybrid" active={query.format === 'hybrid'} onClick={() => onChange({ format: 'hybrid' })} />
        </FilterChip>

        <FilterChip label="Offers" title="What the role offers" icon={Gift} active={query.offers.length > 0} summary={offerSummary} onClear={() => onChange({ offers: [] })}>
          {JOB_OFFER_ORDER.map((o) => (
            <ChoiceRow key={o} kind="check" label={JOB_OFFER_LABEL[o]} active={query.offers.includes(o)} onClick={() => onChange({ offers: toggle(query.offers, o) })} />
          ))}
        </FilterChip>

        <FilterChip
          label="Deadline" title="Applications close" icon={Clock} active={!!query.deadline}
          summary={query.deadline === 'week' ? 'Closes this week' : query.deadline === 'month' ? 'Closes this month' : null}
          onClear={() => onChange({ deadline: '' })}
        >
          <ChoiceRow label="Any deadline" active={!query.deadline} onClick={() => onChange({ deadline: '' })} />
          <ChoiceRow label="This week" active={query.deadline === 'week'} onClick={() => onChange({ deadline: 'week' })} />
          <ChoiceRow label="This month" active={query.deadline === 'month'} onClick={() => onChange({ deadline: 'month' })} />
        </FilterChip>

        <ToggleChip label="Under 10 applicants" icon={Users} active={query.under10} onClick={() => onChange({ under10: !query.under10 })} />

        {hasJobFilters(query) && (
          <button type="button" onClick={() => { setText(''); onClearAll(); }} className="gv-job-clear focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded">
            Clear all
          </button>
        )}
      </div>

      {(query.regions.length > 0 || query.countries.length > 0) && (
        <ul aria-label="Chosen places" className="gv-job-places">
          {query.regions.map((r) => (
            <li key={r}>
              <PlacePill label={JOB_REGION_LABEL[r]} icon={<Globe size={15} strokeWidth={2.2} aria-hidden />} onRemove={() => onChange({ regions: query.regions.filter((x) => x !== r) })} />
            </li>
          ))}
          {query.countries.map((c) => {
            const code = getCountryByName(c)?.code;
            return (
              <li key={c}>
                <PlacePill
                  label={c}
                  icon={code ? <CircleFlag code={code} size={20} decorative /> : <MapPin size={15} strokeWidth={2.2} aria-hidden />}
                  onRemove={() => onChange({ countries: query.countries.filter((x) => x !== c) })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Where: type a country (up to five), or choose one region. */
function WherePanel({ query, onChange }: { query: JobQuery; onChange: (patch: Partial<JobQuery>) => void }) {
  const [q, setQ] = useState('');
  const full = query.countries.length >= MAX_JOB_COUNTRIES;
  const matches = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    return UN_COUNTRIES
      .map((c) => ({ c, r: countryMatchRank(c.name, t, 'en') }))
      .filter((x): x is { c: typeof x.c; r: number } => x.r !== null)
      .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
      .slice(0, 6)
      .map((x) => x.c);
  }, [q]);

  function addCountry(name: string) {
    if (query.countries.includes(name)) {
      onChange({ countries: query.countries.filter((x) => x !== name), regions: [] });
      return;
    }
    if (full) return;
    onChange({ countries: [...query.countries, name], regions: [] });
    setQ('');
  }

  return (
    <div>
      <label className="gv-job-where-field">
        <Search size={16} strokeWidth={2.4} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
        <span className="sr-only">Add a country</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); addCountry(matches[0].name); } }}
          placeholder={full ? `Up to ${MAX_JOB_COUNTRIES} countries` : query.countries.length ? 'Add another country' : 'Search a country'}
          className="focus:outline-none"
        />
      </label>
      {matches.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {matches.map((c) => (
            <ChoiceRow
              key={c.code}
              kind="check"
              label={c.name}
              active={query.countries.includes(c.name)}
              onClick={() => addCountry(c.name)}
              note={full && !query.countries.includes(c.name) ? 'Remove a country to add another' : undefined}
            />
          ))}
        </div>
      )}
      <p style={{ margin: '14px 4px 6px', fontSize: 13, fontWeight: 700, color: INK_SOFT }}>Regions</p>
      {JOB_REGIONS.map((r: JobRegion) => (
        <ChoiceRow
          key={r}
          label={JOB_REGION_LABEL[r]}
          active={query.regions.includes(r)}
          onClick={() => onChange({ regions: query.regions.includes(r) ? [] : [r], countries: [] })}
        />
      ))}
    </div>
  );
}

function PlacePill({ label, icon, onRemove }: { label: string; icon: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="gv-job-place">
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, color: FOREST }}>{icon}</span>
      <span style={{ overflowWrap: 'anywhere', textAlign: 'left' }}>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
        className="gv-job-place-x focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      >
        <X size={12} strokeWidth={3} aria-hidden />
      </button>
    </span>
  );
}

const FILTER_CSS = `
.gv-job-search{display:flex;align-items:center;gap:10px;height:52px;padding:0 10px 0 18px;border-radius:9999px;background:#FFFFFF;
  box-shadow:0 1px 2px rgba(27,56,40,0.08),0 6px 20px rgba(27,56,40,0.08);border:1px solid rgba(27,56,40,0.08);cursor:text}
.gv-job-search:focus-within{box-shadow:0 0 0 2px ${FOREST},0 6px 20px rgba(27,56,40,0.1)}
.gv-job-search input{flex:1 1 auto;min-width:0;height:100%;border:none;background:transparent;font-family:${FONT};font-size:15.5px;font-weight:500;color:${INK}}
.gv-job-search input::placeholder{color:#857866}
.gv-job-search input::-webkit-search-cancel-button{display:none}
.gv-job-search-x{width:30px;height:30px;border-radius:9999px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;background:rgba(28,20,16,0.07);color:${INK}}
.gv-job-band{display:flex;align-items:center;gap:8px;margin-top:12px;overflow-x:auto;scrollbar-width:none;padding:4px 2px;margin-left:-2px;margin-right:-2px}
.gv-job-band::-webkit-scrollbar{display:none}
.gv-job-band > *{flex-shrink:0}
@media (min-width:1024px){.gv-job-band{flex-wrap:wrap;overflow:visible}}
.gv-job-clear{background:none;border:none;cursor:pointer;padding:6px 6px;font-family:${FONT};font-size:13.5px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-job-where-field{display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-radius:12px;background:#F7F4EE;border:1px solid rgba(28,20,16,0.1)}
.gv-job-where-field:focus-within{border-color:${FOREST};box-shadow:inset 0 0 0 1px ${FOREST}}
.gv-job-where-field input{flex:1 1 auto;min-width:0;border:none;background:transparent;font-family:${FONT};font-size:15px;color:${INK}}
.gv-job-places{list-style:none;margin:12px 0 0;padding:0 0 0 4px;display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.gv-job-place{position:relative;display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;border-radius:9999px;background:#FFFFFF;
  box-shadow:0 1px 2px rgba(27,56,40,0.08),0 4px 12px rgba(27,56,40,0.08);border:1px solid rgba(27,56,40,0.08);font-size:13.5px;font-weight:700;color:${INK}}
.gv-job-place-x{position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:9999px;border:1.5px solid #FFFFFF;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;background:${INK};color:#FFFFFF;box-shadow:0 2px 6px rgba(28,20,16,0.25);
  opacity:0;transform:scale(0.85);transition:opacity 140ms ease,transform 140ms ease}
.gv-job-place:hover .gv-job-place-x,.gv-job-place:focus-within .gv-job-place-x{opacity:1;transform:scale(1)}
@media (hover:none){.gv-job-place-x{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.gv-job-place-x{transition:none}}
`;
