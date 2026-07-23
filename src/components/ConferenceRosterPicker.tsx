'use client';

// Modernized roster + committee-name picker for the conference committee editor.
// Brings the conference editor to parity with the current standalone session
// flow (src/app/create/page.tsx):
//   • Committee-name presets in sync with /create (full 27-body list).
//   • Custom allocations — add arbitrary countries/entities by name, robust
//     multi-delimiter paste with a review/rename step, per-country importance
//     tiers (committee_country_slots.importance), reorder + remove.
//   • Crisis committees roster free-text CHARACTERS — no country search, no
//     country bundles, no flags, no country matching.
// Reuses shared logic (findCountryFlexible, UN_COUNTRIES) rather than copying.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Globe, Users, PenLine, Megaphone, Info, ArrowDownAZ } from 'lucide-react';
import Portal from '@/components/Portal';
import { UN_COUNTRIES, getFlagUrl, getCountryByName, findCountryFlexible } from '@/lib/countries';
import {
  UNSC_MEMBERS, WHO_MEMBERS, IMF_MEMBERS, WORLD_BANK_MEMBERS, UNEP_MEMBERS,
  ICC_ROLES, ICJ_ROLES, CRISIS_MEMBERS, FIFA_MEMBERS, HOUSE_OF_COMMONS_ROLES,
  US_SENATE_MEMBERS, PRESS_ROLES, EUROPEAN_PARLIAMENT_MEMBERS,
} from '@/lib/presets';

// ── Importance tiers ──────────────────────────────────────────────────────────
// Mirrors the assignment page's model so tiers set here round-trip through the
// same committee_country_slots.importance column the allocator reads/cycles.
export type ImportanceTier = 'standard' | 'high' | 'medium' | 'low';
// Visible cycle order: standard → high → medium → low → standard, which also
// walks the dash count 1 → 2 → 3 → 4 → 1.
const TIER_CYCLE: ImportanceTier[] = ['standard', 'low', 'medium', 'high'];
// `label` is retained for the accessible title/aria text. `color` doubles as the
// dash colour; `dashes` is how many vertical bars render for the tier. `bg` is
// kept because it feeds nothing structural but documents the tier's tint.
const TIER_META: Record<ImportanceTier, { label: string; color: string; bg: string; dashes: number }> = {
  standard: { label: 'Standard', color: '#9A8A78', bg: 'rgba(154,138,120,0.12)', dashes: 1 },
  low:      { label: 'Low',      color: '#3D7A52', bg: 'rgba(61,122,82,0.12)',   dashes: 2 },
  medium:   { label: 'Medium',   color: '#D4A72C', bg: 'rgba(212,167,44,0.14)',  dashes: 3 },
  high:     { label: 'High',     color: '#8B2020', bg: 'rgba(139,32,32,0.10)',   dashes: 4 },
};

// A roster row: a country name (or free-text character/entity) plus its
// importance tier and observer flag. Characters always carry the neutral
// 'standard' tier. Observers apply to both countries and characters, mirroring
// the standalone session flow (src/app/create/page.tsx).
export interface RosterEntry {
  name: string;
  importance: ImportanceTier;
  isObserver?: boolean;
}

export const entry = (name: string, importance: ImportanceTier = 'standard', isObserver = false): RosterEntry => ({ name, importance, isObserver });

// ── Importance dashes ─────────────────────────────────────────────────────────
// A small clickable stack of vertical bars. Dash count + colour both encode the
// tier (1 grey / 2 green / 3 yellow / 4 red). Country mode only — characters
// keep the neutral 'standard' tier with no control.
function ImportanceDashes({ tier, onClick }: { tier: ImportanceTier; onClick: () => void }) {
  const meta = TIER_META[tier];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Importance: ${meta.label}. Click to cycle: standard, low, medium, high.`}
      aria-label={`Importance: ${meta.label}`}
      className="flex items-end gap-[2px] focus:outline-none transition-opacity"
      style={{ padding: '3px 4px', borderRadius: 5, height: 20, opacity: 0.9 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
    >
      {Array.from({ length: meta.dashes }).map((_, i) => (
        <span key={i} style={{ width: 2, height: 11, borderRadius: 1, backgroundColor: meta.color, display: 'inline-block' }} />
      ))}
    </button>
  );
}

// ── Hover-info explainer ──────────────────────────────────────────────────────
// A small "i" affordance that reveals an on-brand infographic panel on HOVER
// (house rule — never click-to-toggle for read-only explainers). Keyboard/focus
// accessible, and portaled at fixed viewport coordinates so the panel is never
// clipped by the editor modal's `overflow-y:auto` body. Right-aligns to the
// trigger, clamps to the viewport, and flips above when short on room below.
function HoverInfo({ children, ariaLabel = 'What do these controls mean?' }: { children: React.ReactNode; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const PANEL_W = 288;
  const EST_H = 250;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 10;
    let left = r.right - PANEL_W;
    left = Math.max(margin, Math.min(left, window.innerWidth - PANEL_W - margin));
    const flip = r.bottom + 8 + EST_H > window.innerHeight - margin && r.top - 8 - EST_H > margin;
    const top = flip ? r.top - 8 : r.bottom + 8;
    setPos({ top, left, flip });
  }, []);

  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); place(); setOpen(true); };
  const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 160); };

  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => e.preventDefault()}
        className="inline-flex items-center justify-center rounded-full focus:outline-none transition-colors"
        style={{ width: 15, height: 15, color: open ? '#1B3828' : '#9A8A78', cursor: 'help' }}
      >
        <Info size={13} strokeWidth={2} />
      </button>
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: PANEL_W, zIndex: 10000,
              transform: pos.flip ? 'translateY(-100%)' : undefined,
              backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 14,
              boxShadow: '0 12px 34px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08)',
              padding: '14px 15px', fontFamily: "'Outfit', sans-serif",
            }}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}

// A miniature static dash stack for the explainer legend (non-interactive).
function DashLegend({ tier }: { tier: ImportanceTier }) {
  const meta = TIER_META[tier];
  return (
    <span className="inline-flex items-end gap-[2px]" style={{ height: 12 }}>
      {Array.from({ length: meta.dashes }).map((_, i) => (
        <span key={i} style={{ width: 2, height: 11, borderRadius: 1, backgroundColor: meta.color, display: 'inline-block' }} />
      ))}
    </span>
  );
}

// ── Committee-name presets (kept in sync with src/app/create/page.tsx) ─────────
export interface CommitteePreset {
  name: string;
  acronym: string;
  logoPath: string;
  members: string[];
  // Which roster path this preset feeds. 'country' → flag-matched country slots;
  // 'character' → free-text role/character seats (judges, cabinet posts, press
  // outlets, US-state seats). Defaults to 'country' when omitted.
  rosterMode?: 'country' | 'character';
}

// Raw list — order preserved. Deduped by name below (defends against merge dupes
// re-introducing UNGA/ECOSOC/etc. twice).
const RAW_COMMITTEE_PRESETS: CommitteePreset[] = [
  { name: 'UN Security Council', acronym: 'UNSC', logoPath: '/logos/un.svg', members: UNSC_MEMBERS },
  { name: 'UN Environment Programme', acronym: 'UNEP', logoPath: '/logos/UNEP.png', members: UNEP_MEMBERS },
  { name: 'World Health Organization', acronym: 'WHO', logoPath: '/logos/who.png', members: WHO_MEMBERS },
  { name: 'International Monetary Fund', acronym: 'IMF', logoPath: '/logos/IMF.png', members: IMF_MEMBERS },
  { name: 'World Bank', acronym: 'WB', logoPath: '/logos/worldbank.svg', members: WORLD_BANK_MEMBERS },
  { name: 'UN General Assembly', acronym: 'GA/UNGA', logoPath: '/logos/un.svg', members: UN_COUNTRIES.filter((c) => !['Holy See', 'Kosovo', 'Niue', 'Palestine', 'Taiwan', 'Cook Islands', 'European Union', 'African Union'].includes(c.name)).map((c) => c.name) },
  { name: 'UN Human Rights Council', acronym: 'UNHRC', logoPath: '/logos/UNHRC.png', members: ['Afghanistan','Albania','Algeria','Argentina','Armenia','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Cameroon','Chile','China','Cuba','Czech Republic','Estonia','Finland','France','Gambia','Germany','Honduras','Iceland','India','Indonesia','Japan','Kazakhstan','Kenya','Libya','Luxembourg','Malawi','Malaysia','Maldives','Marshall Islands','Mexico','Montenegro','Morocco','Namibia','Nepal','Netherlands','Pakistan','Paraguay','Peru','Poland','Qatar','Romania','Senegal','Sierra Leone','Somalia','South Africa','Sudan','Togo','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Venezuela','Vietnam'] },
  { name: 'Economic and Social Council', acronym: 'ECOSOC', logoPath: '/logos/un.svg', members: ['Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Burundi','Canada','Chile','China','Colombia','Congo','Czech Republic','Denmark','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','France','Germany','Ghana','Greece','Guatemala','Guinea','Haiti','Honduras','Hungary','India','Indonesia','Iran','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Lesotho','Libya','Malaysia','Maldives','Mali','Malta','Mexico','Mongolia','Morocco','Mozambique','Netherlands','New Zealand','Niger','Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Serbia','South Africa','South Korea','Spain','Sweden','Switzerland','Tanzania','Thailand','Togo','Turkey','Uganda','Ukraine','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam','Zimbabwe'] },
  { name: 'NATO', acronym: 'NATO', logoPath: '/logos/nato.png', members: ['Albania','Belgium','Bulgaria','Canada','Croatia','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Iceland','Italy','Latvia','Lithuania','Luxembourg','Montenegro','Netherlands','North Macedonia','Norway','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden','Turkey','United Kingdom','United States'] },
  { name: 'G20', acronym: 'G20', logoPath: '/logos/g20.svg', members: ['Argentina','Australia','Brazil','Canada','China','France','Germany','India','Indonesia','Italy','Japan','Mexico','South Korea','Russia','Saudi Arabia','South Africa','Turkey','United Kingdom','United States'] },
  { name: 'European Union', acronym: 'EU', logoPath: '/logos/eu.png', members: ['Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Ireland','Italy','Latvia','Lithuania','Luxembourg','Malta','Netherlands','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden'] },
  { name: 'African Union', acronym: 'AU', logoPath: '/logos/AU.png', members: ['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo','Côte d\'Ivoire','DR Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'] },
  { name: 'Arab League', acronym: 'LAS', logoPath: '/logos/arab-league.png', members: ['Algeria','Bahrain','Comoros','Djibouti','Egypt','Iraq','Jordan','Kuwait','Lebanon','Libya','Mauritania','Morocco','Oman','Palestine','Qatar','Saudi Arabia','Somalia','Sudan','Syria','Tunisia','United Arab Emirates','Yemen'] },
  { name: 'ASEAN', acronym: 'ASEAN', logoPath: '/logos/asean.png', members: ['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar','Philippines','Singapore','Thailand','Timor-Leste','Vietnam'] },
  // GA main committees. Canonical long-form names so committeeDisplayName's
  // ">4 words → acronym" rule collapses them to how delegates actually refer to
  // them (DISEC, SPECPOL, SOCHUM, LEGAL). Emblem still resolves to the UN seal.
  { name: 'Disarmament and International Security Committee', acronym: 'DISEC',   logoPath: '/logos/un.svg',     members: [] },
  { name: 'Special Political and Decolonization Committee',   acronym: 'SPECPOL', logoPath: '/logos/un.svg',     members: [] },
  { name: 'Social, Humanitarian and Cultural Committee',      acronym: 'SOCHUM',  logoPath: '/logos/un.svg',     members: [] },
  { name: 'International Law and Legal Affairs Committee',     acronym: 'LEGAL',   logoPath: '/logos/un.svg',     members: [] },
  { name: 'UN Children\'s Fund',                       acronym: 'UNICEF',  logoPath: '/logos/unicef.png', members: [] },
  { name: 'UN Educational, Scientific & Cultural Org.', acronym: 'UNESCO', logoPath: '/logos/unesco.png', members: [] },
  { name: 'UN Refugee Agency',                         acronym: 'UNHCR',   logoPath: '/logos/un.svg',     members: [] },
  { name: 'World Food Programme',                      acronym: 'WFP',     logoPath: '/logos/un.svg',     members: [] },
  { name: 'Food and Agriculture Organization',         acronym: 'FAO',     logoPath: '/logos/fao.png',    members: [] },
  { name: 'International Labour Organization',          acronym: 'ILO',     logoPath: '/logos/un.svg',     members: [] },
  { name: 'International Atomic Energy Agency',         acronym: 'IAEA',    logoPath: '/logos/iaea.png',   members: [] },
  { name: 'UN Development Programme',                   acronym: 'UNDP',    logoPath: '/logos/un.svg',     members: [] },
  { name: 'UN Entity for Gender Equality (UN Women)',   acronym: 'UNW',     logoPath: '/logos/un.svg',     members: [] },
  { name: 'UN Office on Drugs and Crime',              acronym: 'UNODC',   logoPath: '/logos/un.svg',     members: [] },
  // ── New shared presets (src/lib/presets.ts). ICC/ICJ/Crisis/HoC/Senate/Press
  // roster free-text role/character seats; FIFA + European Parliament roster
  // flag-matched countries.
  { name: 'International Criminal Court',  acronym: 'ICC',       logoPath: '/logos/icc.svg',                  members: ICC_ROLES,                   rosterMode: 'character' },
  { name: 'International Court of Justice', acronym: 'ICJ',      logoPath: '/logos/icj.svg',                  members: ICJ_ROLES,                   rosterMode: 'character' },
  { name: 'Crisis Committee',             acronym: 'Crisis',    logoPath: '/committee-emblems/crisis.svg',   members: CRISIS_MEMBERS,              rosterMode: 'character' },
  { name: 'FIFA Congress',                acronym: 'FIFA',      logoPath: '/logos/fifa.svg',                 members: FIFA_MEMBERS,                rosterMode: 'country' },
  { name: 'House of Commons',             acronym: 'HoC',       logoPath: '/logos/commons.svg',              members: HOUSE_OF_COMMONS_ROLES,     rosterMode: 'character' },
  { name: 'United States Senate',         acronym: 'US Senate', logoPath: '/logos/senate.svg',               members: US_SENATE_MEMBERS,          rosterMode: 'character' },
  { name: 'International Press Corps',     acronym: 'IPC',       logoPath: '/logos/press.svg',                members: PRESS_ROLES,                 rosterMode: 'character' },
  { name: 'European Parliament',          acronym: 'EP',        logoPath: '/logos/eu.png',                   members: EUROPEAN_PARLIAMENT_MEMBERS, rosterMode: 'country' },
];

// Deduped by lowercased name — one card per committee, first occurrence wins.
export const CONFERENCE_COMMITTEE_PRESETS: CommitteePreset[] = (() => {
  const seen = new Set<string>();
  const out: CommitteePreset[] = [];
  for (const p of RAW_COMMITTEE_PRESETS) {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
})();

// ── Country bundles (kept in sync with /create) ───────────────────────────────
const BUNDLES: Record<string, { label: string; logoPath?: string; members: string[] }> = {
  P5:         { label: 'P5',          logoPath: '/logos/un.svg',           members: ['China', 'France', 'Russia', 'United Kingdom', 'United States'] },
  G7:         { label: 'G7',          logoPath: '/logos/g7.png',           members: ['Canada', 'France', 'Germany', 'Italy', 'Japan', 'United Kingdom', 'United States'] },
  BRICS:      { label: 'BRICS+',      logoPath: '/logos/brics.png',        members: ['Brazil', 'Russia', 'India', 'China', 'South Africa', 'Egypt', 'Ethiopia', 'Iran', 'Saudi Arabia', 'United Arab Emirates'] },
  G20:        { label: 'G20',         logoPath: '/logos/g20.svg',          members: ['Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India', 'Indonesia', 'Italy', 'Japan', 'Mexico', 'South Korea', 'Russia', 'Saudi Arabia', 'South Africa', 'Turkey', 'United Kingdom', 'United States'] },
  EU:         { label: 'EU',          logoPath: '/logos/eu.png',           members: ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'] },
  NATO:       { label: 'NATO',        logoPath: '/logos/nato.png',         members: ['Albania', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Turkey', 'United Kingdom', 'United States'] },
  ASEAN:      { label: 'ASEAN',       logoPath: '/logos/asean.png',        members: ['Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines', 'Singapore', 'Thailand', 'Timor-Leste', 'Vietnam'] },
  ArabLeague: { label: 'Arab League', logoPath: '/logos/arab-league.png',  members: ['Algeria', 'Bahrain', 'Comoros', 'Djibouti', 'Egypt', 'Iraq', 'Jordan', 'Kuwait', 'Lebanon', 'Libya', 'Mauritania', 'Morocco', 'Oman', 'Palestine', 'Qatar', 'Saudi Arabia', 'Somalia', 'Sudan', 'Syria', 'Tunisia', 'United Arab Emirates', 'Yemen'] },
};

// Common shorthands the paste matcher understands before falling through to
// the shared accent/locale-aware findCountryFlexible.
const COUNTRY_ACRONYMS: Record<string, string> = {
  uk: 'United Kingdom', us: 'United States', usa: 'United States',
  uae: 'United Arab Emirates', drc: 'DR Congo', roc: 'Taiwan',
  rok: 'South Korea', dprk: 'North Korea', car: 'Central African Republic',
  png: 'Papua New Guinea',
};

function fuzzyMatchCountry(raw: string): string | null {
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  if (COUNTRY_ACRONYMS[n]) return COUNTRY_ACRONYMS[n];
  return findCountryFlexible(raw);
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#9A8A78',
  fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 12px',
  fontSize: 14, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none',
  fontFamily: "'Outfit', sans-serif",
};

// Anchors a typeahead dropdown at fixed viewport coordinates so it is never
// clipped by an ancestor's overflow — this editor lives inside the committee
// editor modal, a scrollable `overflow-y:auto` panel that would otherwise clip
// an in-flow `absolute` dropdown. Matches the anchor's width, opens below it,
// and flips above when short on room near the viewport bottom. Returns null
// until the anchor has been measured.
function useAnchoredDropdown<T extends HTMLElement>(
  open: boolean,
  anchorRef: React.RefObject<T | null>,
  estHeight = 300,
) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    let top = r.bottom + 4;
    if (top + estHeight > window.innerHeight - margin && r.top - 4 - estHeight > margin) {
      top = r.top - 4 - estHeight;
    }
    setPos({ top: Math.max(margin, top), left: r.left, width: r.width });
  }, [anchorRef, estHeight]);
  useEffect(() => {
    if (!open) { setPos(null); return; }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);
  return pos;
}

// ── Committee-name input with preset dropdown ─────────────────────────────────
export function ConferenceCommitteeNameInput({ value, onChange, onPresetSelect }: {
  value: string;
  onChange: (v: string) => void;
  onPresetSelect: (preset: CommitteePreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = value.trim()
    ? CONFERENCE_COMMITTEE_PRESETS.filter((p) => {
        const v = value.toLowerCase();
        return p.name.toLowerCase().includes(v) || p.acronym.toLowerCase().includes(v);
      })
    : [];
  const topMatch = matches[0] ?? null;
  const menuOpen = open && matches.length > 0;
  const pos = useAnchoredDropdown(menuOpen, inputRef, 280);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && topMatch) { e.preventDefault(); onPresetSelect(topMatch); setOpen(false); }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="e.g. Human Rights Council or UNHRC"
        style={inputStyle}
      />
      {menuOpen && pos && (
        <Portal>
        <div className="rounded-xl overflow-hidden" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 8px 32px rgba(27,56,40,0.14), 0 2px 8px rgba(27,56,40,0.08)', maxHeight: 280, overflowY: 'auto' }}>
          {matches.slice(0, 8).map((p, i) => (
            <button
              key={p.name}
              onMouseDown={(e) => { e.preventDefault(); onPresetSelect(p); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#DDD4C0]/50 last:border-0 ${i === 0 ? 'text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#EDE7D8]'}`}
              style={i === 0 ? { backgroundColor: 'rgba(27,56,40,0.07)' } : {}}
            >
              {p.logoPath ? (
                <img src={p.logoPath} alt={p.acronym} width={18} height={18} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-[22px] h-[22px] rounded-md shrink-0" style={{ backgroundColor: 'rgba(27,56,40,0.08)' }} />
              )}
              <span className="text-sm flex-1">{p.name}</span>
              {p.members.length > 0 && (
                <span className="text-[10px] shrink-0" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>+{p.members.length}</span>
              )}
              <span className="text-[10px] font-bold shrink-0" style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', color: '#1B3828' }}>{p.acronym}</span>
              {i === 0 && <span className="text-[10px] shrink-0" style={{ color: '#9A8A78' }}>↵</span>}
            </button>
          ))}
        </div>
        </Portal>
      )}
    </div>
  );
}

// ── Roster picker (countries or characters) ───────────────────────────────────

interface ReviewRow { name: string; isCountry: boolean }

export function ConferenceRosterPicker({ mode, value, onChange }: {
  mode: 'country' | 'character';
  value: RosterEntry[];
  onChange: (roster: RosterEntry[]) => void;
}) {
  const isCharacter = mode === 'character';
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  // Display-only ordering of the selected list. 'entered' keeps insertion order;
  // 'az' sorts alphabetically; 'importance' ranks by tier (high → standard).
  // This never mutates `value` — handlers below always resolve the ORIGINAL
  // index — so parent state/observer/tier semantics are untouched.
  const [orderMode, setOrderMode] = useState<'entered' | 'az' | 'importance'>('entered');

  const names = value.map((r) => r.name);
  const nameSet = new Set(names.map((n) => n.toLowerCase()));

  const available = isCharacter
    ? []
    : UN_COUNTRIES.filter((c) => !nameSet.has(c.name.toLowerCase()) && c.name.toLowerCase().includes(search.toLowerCase()));

  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const searchMenuOpen = !!(search.trim() && (available.length > 0 || !nameSet.has(search.trim().toLowerCase())));
  const searchPos = useAnchoredDropdown(searchMenuOpen, searchAnchorRef, 300);

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || nameSet.has(trimmed.toLowerCase())) return;
    onChange([...value, entry(trimmed)]);
  };

  const addBundle = (key: string) => {
    const bundle = BUNDLES[key];
    if (!bundle) return;
    const additions = bundle.members.filter((m) => !nameSet.has(m.toLowerCase())).map((m) => entry(m));
    onChange([...value, ...additions]);
  };

  const removeIdx = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const cycleTier = (idx: number) => {
    const cur = value[idx].importance;
    const nextTier = TIER_CYCLE[(TIER_CYCLE.indexOf(cur) + 1) % TIER_CYCLE.length];
    onChange(value.map((r, i) => (i === idx ? { ...r, importance: nextTier } : r)));
  };

  const toggleObserver = (idx: number) => {
    onChange(value.map((r, i) => (i === idx ? { ...r, isObserver: !r.isObserver } : r)));
  };

  const commitRename = (idx: number, raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) { removeIdx(idx); setEditingIdx(null); return; }
    // Reject a rename that collides with another existing row.
    if (value.some((r, i) => i !== idx && r.name.toLowerCase() === trimmed.toLowerCase())) { setEditingIdx(null); return; }
    onChange(value.map((r, i) => (i === idx ? { ...r, name: trimmed } : r)));
    setEditingIdx(null);
  };

  // Rows to render, paired with their original index so every handler mutates
  // the correct `value` entry regardless of display order.
  const displayRows = useMemo(() => {
    const rows = value.map((r, i) => ({ r, i }));
    if (orderMode === 'az') {
      rows.sort((a, b) => a.r.name.localeCompare(b.r.name));
    } else if (orderMode === 'importance') {
      rows.sort((a, b) => (TIER_META[b.r.importance].dashes - TIER_META[a.r.importance].dashes) || a.r.name.localeCompare(b.r.name));
    }
    return rows;
  }, [value, orderMode]);

  // Paste. Countries → fuzzy-match + review/rename step. Characters → add all
  // pasted lines verbatim (no country matching), deduped case-insensitively.
  const handlePaste = () => {
    // Character mode uses a gentler split (no period / double-space rules) so
    // names with middle initials like "John F. Kennedy" survive intact.
    const splitter = isCharacter ? /\r?\n|[,;\t·•]/ : /\r?\n|[,;\t]|\s{2,}|[·•]|\.(?=\s|$)/;
    const tokens = pasteText
      .split(splitter)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set(nameSet);
    if (isCharacter) {
      const additions: RosterEntry[] = [];
      for (const tok of tokens) {
        const k = tok.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        additions.push(entry(tok));
      }
      if (additions.length === 0) { setPasteError('Nothing new to add'); return; }
      onChange([...value, ...additions]);
      setPasteError('');
      setPasteText('');
      return;
    }
    const rows: ReviewRow[] = [];
    for (const tok of tokens) {
      const found = fuzzyMatchCountry(tok);
      const name = found ?? tok;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({ name, isCountry: !!found });
    }
    if (rows.length === 0) { setPasteError('Nothing new to add'); return; }
    setPasteError('');
    setReview(rows);
  };

  const commitReview = () => {
    if (!review) return;
    const seen = new Set(nameSet);
    const additions: RosterEntry[] = [];
    for (const r of review) {
      const nm = r.name.trim();
      if (!nm) continue;
      const k = nm.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      additions.push(entry(nm));
    }
    onChange([...value, ...additions]);
    setReview(null);
    setPasteText('');
  };

  return (
    <div className="flex gap-5" style={{ minHeight: 340 }}>
      {/* Left: add controls */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {/* Search & Add */}
        <div>
          <label style={labelStyle}>{isCharacter ? 'Add Character' : 'Search & Add'}</label>
          <div className="relative">
            <div ref={searchAnchorRef} className="flex items-center rounded-xl" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isCharacter && available[0]) { add(available[0].name); setSearch(''); }
                    else if (search.trim()) { add(search.trim()); setSearch(''); }
                  }
                  if (e.key === 'Escape') setSearch('');
                }}
                placeholder={isCharacter ? 'Type a character or role name, press Enter…' : 'Search countries or type a name…'}
                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              />
              {search.trim() && (isCharacter || available[0]) && (
                <span className="text-xs px-2 shrink-0" style={{ color: '#9A8A78' }}>↵ {isCharacter ? search.trim() : available[0]?.name ?? search.trim()}</span>
              )}
            </div>
            {searchMenuOpen && searchPos && (
              <Portal>
              <div className="rounded-xl overflow-hidden" style={{ position: 'fixed', top: searchPos.top, left: searchPos.left, width: searchPos.width, zIndex: 9999, backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 8px 24px rgba(27,56,40,0.12)' }}>
                {available.slice(0, 5).map((c, i) => (
                  <button
                    key={c.code}
                    onMouseDown={(e) => { e.preventDefault(); add(c.name); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                    style={{ backgroundColor: i === 0 ? 'rgba(27,56,40,0.07)' : 'transparent', borderBottom: '1px solid #F0EDE6' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i === 0 ? 'rgba(27,56,40,0.07)' : 'transparent'; }}
                  >
                    <img src={getFlagUrl(c.code)} alt={c.code} style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <span className="text-sm flex-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{c.name}</span>
                    {i === 0 && <span className="text-xs" style={{ color: '#9A8A78' }}>↵</span>}
                  </button>
                ))}
                {search.trim() && !nameSet.has(search.trim().toLowerCase()) && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); add(search.trim()); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                    style={{ borderTop: available.length > 0 ? '1px solid #EDE7D8' : undefined, backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1B3828', flexShrink: 0, width: 20, textAlign: 'center' }}>+</span>
                    <span className="text-sm flex-1" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{`Add "${search.trim()}"`}</span>
                  </button>
                )}
              </div>
              </Portal>
            )}
          </div>
        </div>

        {/* Quick Bundles — country mode only */}
        {!isCharacter && (
          <div>
            <label style={labelStyle}>Quick Bundles</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(BUNDLES).map(([key, bundle]) => (
                <button
                  key={key}
                  onClick={() => addBundle(key)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                  style={{ backgroundColor: '#FAF8F3', color: '#1B3828', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderColor = '#1B3828'; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#FAF8F3'; el.style.color = '#1B3828'; el.style.borderColor = '#DDD4C0'; }}
                >
                  {bundle.logoPath && (
                    <img src={bundle.logoPath} alt={bundle.label} width={12} height={12} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <span>{bundle.label}</span>
                  <span style={{ fontSize: 9, color: 'inherit', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>+{bundle.members.length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paste list */}
        <div className="flex flex-col flex-1">
          <label style={labelStyle}>{isCharacter ? 'Paste Character List' : 'Paste Country List'}</label>
          <textarea
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
            placeholder={isCharacter ? 'Fidel Castro\nNikita Khrushchev\nJohn F. Kennedy…' : 'France\nGermany\nBrazil, India…'}
            rows={8}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm resize-y focus:outline-none"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif", minHeight: 150, lineHeight: 1.55 }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handlePaste}
              disabled={!pasteText.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}
              onMouseEnter={(e) => { if (pasteText.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {isCharacter ? 'Add All' : 'Auto-Match'}
            </button>
            {pasteError && <p className="text-xs" style={{ color: '#B6871F', fontFamily: "'Outfit', sans-serif" }}>{pasteError}</p>}
          </div>
        </div>
      </div>

      {/* Right: selected list */}
      <div className="flex flex-col" style={{ width: 280, flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <label style={{ ...labelStyle, marginBottom: 0 }}>Selected</label>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#1B3828', backgroundColor: 'rgba(238,217,138,0.3)', padding: '1px 6px', borderRadius: 999, fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
              {value.length}
            </span>
            <HoverInfo>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B6871F' }}>Reading this list</p>
              <div className="mt-2.5 flex gap-2.5">
                <span className="shrink-0 mt-0.5"><Megaphone size={14} strokeWidth={1.75} style={{ color: '#B6871F' }} /></span>
                <p style={{ margin: 0, fontSize: 11.5, color: '#4A3F33', lineHeight: 1.5 }}>
                  <b style={{ color: '#1C1410' }}>Observer</b> (megaphone) marks a seat as a non-voting observer — they can speak but hold no vote. Click to toggle; lit gold = observer.
                </p>
              </div>
              <div className="mt-2.5 flex gap-2.5">
                <span className="shrink-0 mt-1"><DashLegend tier="high" /></span>
                <p style={{ margin: 0, fontSize: 11.5, color: '#4A3F33', lineHeight: 1.5 }}>
                  <b style={{ color: '#1C1410' }}>Importance dashes</b> rank how sought-after a seat is. They steer allocation &amp; assignment — higher tiers are offered to stronger applicants and surface first in suggestions.
                </p>
              </div>
              <div className="mt-2.5 flex items-center gap-3" style={{ borderTop: '1px solid #EDE7D8', paddingTop: 10 }}>
                {(['standard', 'low', 'medium', 'high'] as const).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1">
                    <DashLegend tier={t} />
                    <span style={{ fontSize: 9.5, color: '#9A8A78', fontWeight: 600 }}>{TIER_META[t].label}</span>
                  </span>
                ))}
              </div>
            </HoverInfo>
          </div>
          <div className="flex items-center gap-2">
            {value.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="text-xs font-bold uppercase tracking-wide transition-colors focus:outline-none"
                style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 9 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
              >
                CLEAR ALL
              </button>
            )}
          </div>
        </div>
        {/* Order toggle — A–Z ↔ Importance (country mode only). Display-only. */}
        {!isCharacter && value.length > 1 && (
          <div className="flex items-center gap-1 mb-2 rounded-lg p-0.5 self-start" style={{ backgroundColor: '#EFE9DB', border: '1px solid #E1D9C6' }}>
            {([
              { key: 'az', label: 'A–Z', icon: <ArrowDownAZ size={11} strokeWidth={2} /> },
              { key: 'importance', label: 'Importance', icon: <DashLegend tier="high" /> },
            ] as const).map((opt) => {
              const active = orderMode === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setOrderMode((cur) => (cur === opt.key ? 'entered' : opt.key))}
                  aria-pressed={active}
                  title={active ? 'Sorted — click to restore added order' : `Sort by ${opt.label === 'A–Z' ? 'name' : 'importance'}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors focus:outline-none"
                  style={{
                    fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: active ? '#EED98A' : '#6E5F4E',
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    boxShadow: active ? '0 1px 3px rgba(27,56,40,0.22)' : undefined,
                  }}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', maxHeight: 320, overflowY: 'auto' }}>
          {value.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-3 py-8">
              <p className="text-xs font-bold uppercase text-center" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{isCharacter ? 'NO CHARACTERS' : 'NO COUNTRIES'}</p>
              <p className="text-xs text-center mt-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{isCharacter ? 'Type or paste names to add' : 'Search, use bundles, or paste'}</p>
            </div>
          ) : (
            displayRows.map(({ r: row, i: idx }) => {
              const found = isCharacter ? undefined : getCountryByName(row.name);
              const isCustom = !found;
              const isEditing = editingIdx === idx;
              const isObserver = !!row.isObserver;
              return (
                <div
                  key={`${row.name}-${idx}`}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 group transition-colors"
                  style={{ borderBottom: '1px solid #F0EDE6' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                >
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: 22, height: 16, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : (isCharacter
                        ? <Users size={15} strokeWidth={1.5} style={{ color: '#B6871F', flexShrink: 0 }} />
                        : <Globe size={15} strokeWidth={1.5} style={{ color: '#9A8A78', flexShrink: 0 }} />)
                  }
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(idx, editDraft); else if (e.key === 'Escape') setEditingIdx(null); }}
                      onBlur={() => commitRename(idx, editDraft)}
                      className="flex-1 text-[13px] bg-transparent outline-none"
                      style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", borderBottom: '1px solid #1B3828' }}
                    />
                  ) : (
                    <span className="flex-1 text-[13px] truncate min-w-0" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      <span className="truncate">{row.name}</span>
                    </span>
                  )}
                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Importance — country mode only. Vertical dashes: count + colour encode the tier. */}
                      {!isCharacter && (
                        <ImportanceDashes tier={row.importance} onClick={() => cycleTier(idx)} />
                      )}
                      {/* Observer toggle — countries AND characters, mirrors /create's megaphone */}
                      <button
                        onClick={() => toggleObserver(idx)}
                        title={isObserver ? 'Observer — click to make a voting delegate' : 'Mark as observer'}
                        aria-pressed={isObserver}
                        className="focus:outline-none transition-transform active:scale-90 shrink-0"
                        style={{ color: isObserver ? '#B6871F' : '#9A8A78', opacity: isObserver ? 1 : undefined }}
                      >
                        <Megaphone size={12} strokeWidth={1.75} className={isObserver ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'} />
                      </button>
                      {/* Rename — custom entries & all characters */}
                      {(isCustom || isCharacter) && (
                        <button onClick={() => { setEditingIdx(idx); setEditDraft(row.name); }} className="opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none" style={{ color: '#9A8A78' }} title="Rename"><PenLine size={12} /></button>
                      )}
                      <button
                        onClick={() => removeIdx(idx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs focus:outline-none"
                        style={{ color: '#9A8A78' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Paste review overlay (country mode) — sits above the editor modal */}
      {review && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(5,4,3,0.5)', backdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setReview(null); }}
        >
          <div className="w-full max-w-md flex flex-col rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '78%' }}>
            <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
              <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: '#1B3828', letterSpacing: '0.04em', fontFamily: "'Outfit', sans-serif" }}>Review pasted list</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{review.length} to add. Edit any custom names before confirming.</p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {review.map((r, idx) => {
                const found = getCountryByName(r.name);
                return (
                  <div key={idx} className="flex items-center gap-3 px-5 py-2.5 border-b border-[#DDD4C0]/50 last:border-0">
                    {found
                      ? <img src={getFlagUrl(found.code)} alt={found.code} width={20} height={14} style={{ objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                      : <Globe size={16} strokeWidth={1.5} style={{ color: '#9A8A78', flexShrink: 0 }} />}
                    {found ? (
                      <span className="text-sm flex-1 truncate font-medium" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{r.name}</span>
                    ) : (
                      <input
                        value={r.name}
                        onChange={(e) => setReview((prev) => prev ? prev.map((x, i) => i === idx ? { name: e.target.value, isCountry: !!getCountryByName(e.target.value.trim()) } : x) : prev)}
                        className="text-sm flex-1 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none"
                        style={{ border: '1px solid #C8BAA8', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                      />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 px-2 py-0.5 rounded-full" style={found ? { color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.1)' } : { color: '#B6871F', backgroundColor: 'rgba(182,135,31,0.12)' }}>
                      {found ? 'Country' : 'Custom'}
                    </span>
                    <button onClick={() => setReview((prev) => prev ? prev.filter((_, i) => i !== idx) : prev)} className="text-sm shrink-0 focus:outline-none" style={{ color: '#9A8A78' }}>✕</button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 shrink-0" style={{ borderTop: '1px solid #DDD4C0' }}>
              <button onClick={() => setReview(null)} className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wide transition-colors focus:outline-none" style={{ color: '#6A5A4A', backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}>Cancel</button>
              <button onClick={commitReview} disabled={review.length === 0} className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-30 focus:outline-none" style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>
                Add {review.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
