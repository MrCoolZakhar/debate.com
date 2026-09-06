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
import { Globe, Users, PenLine, Megaphone, Info, ArrowDownAZ, X, ImagePlus, Replace, FolderInput, Plus, Check, GripVertical } from 'lucide-react';
import Portal from '@/components/Portal';
import { UN_COUNTRIES, getFlagUrl, getCountryByName, findCountryFlexible, countryMatchRank } from '@/lib/countries';
import {
  UNSC_MEMBERS, WHO_MEMBERS, IMF_MEMBERS, WORLD_BANK_MEMBERS, UNEP_MEMBERS,
  ICC_ROLES, ICJ_ROLES, CRISIS_MEMBERS, FIFA_MEMBERS, HOUSE_OF_COMMONS_ROLES,
  US_SENATE_MEMBERS, PRESS_ROLES, EUROPEAN_PARLIAMENT_MEMBERS,
} from '@/lib/presets';
import { useScrollLock } from '@/hooks/useScrollLock';
import { type SlotGroup, newGroupId, GROUP_COLORS, effectiveSlotArt, PARLIAMENT_PRESETS } from '@/lib/slotGroups';

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
// `logoUrl` is the seat's own flag image (committee_country_slots.logo_url) and
// `groupId` the seat group it sits in (committee_country_slots.group_id), see
// src/lib/slotGroups.ts. Both are null for the ordinary flag-and-country seat.
export interface RosterEntry {
  name: string;
  importance: ImportanceTier;
  isObserver?: boolean;
  logoUrl?: string | null;
  groupId?: string | null;
}

export const entry = (name: string, importance: ImportanceTier = 'standard', isObserver = false): RosterEntry => ({ name, importance, isObserver, logoUrl: null, groupId: null });

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
  { name: 'Economic and Social Council', acronym: 'ECOSOC', logoPath: '/logos/un.svg', members: ['Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Burundi','Canada','Chile','China','Colombia','Congo','Czech Republic','Denmark','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','France','Germany','Ghana','Greece','Guatemala','Guinea','Haiti','Honduras','Hungary','India','Indonesia','Iran','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Lesotho','Libya','Malaysia','Maldives','Mali','Malta','Mexico','Mongolia','Morocco','Mozambique','Netherlands','New Zealand','Niger','Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Serbia','South Africa','South Korea','Spain','Sweden','Switzerland','Tanzania','Thailand','Togo','Türkiye','Uganda','Ukraine','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam','Zimbabwe'] },
  { name: 'NATO', acronym: 'NATO', logoPath: '/logos/nato.png', members: ['Albania','Belgium','Bulgaria','Canada','Croatia','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Iceland','Italy','Latvia','Lithuania','Luxembourg','Montenegro','Netherlands','North Macedonia','Norway','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden','Türkiye','United Kingdom','United States'] },
  { name: 'G20', acronym: 'G20', logoPath: '/logos/g20.svg', members: ['Argentina','Australia','Brazil','Canada','China','France','Germany','India','Indonesia','Italy','Japan','Mexico','South Korea','Russia','Saudi Arabia','South Africa','Türkiye','United Kingdom','United States'] },
  { name: 'European Union', acronym: 'EU', logoPath: '/logos/eu.png', members: ['Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Ireland','Italy','Latvia','Lithuania','Luxembourg','Malta','Netherlands','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden'] },
  { name: 'African Union', acronym: 'AU', logoPath: '/logos/AU.png', members: ['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo','Côte d\'Ivoire','DR Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'] },
  { name: 'Arab League', acronym: 'LAS', logoPath: '/logos/arab-league.png', members: ['Algeria','Bahrain','Comoros','Djibouti','Egypt','Iraq','Jordan','Kuwait','Lebanon','Libya','Mauritania','Morocco','Oman','Palestine','Qatar','Saudi Arabia','Somalia','Sudan','Syria','Tunisia','United Arab Emirates','Yemen'] },
  { name: 'ASEAN', acronym: 'ASEAN', logoPath: '/logos/asean.png', members: ['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar','Philippines','Singapore','Thailand','Timor-Leste','Vietnam'] },
  // GA main committees. Canonical long-form names: the full name is what gets
  // stored, and committeeDisplayName collapses it at render time to how delegates
  // actually refer to them (DISEC, SPECPOL, SOCHUM, LEGAL) with the full name
  // small beneath. Emblem still resolves to the UN seal.
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
  G20:        { label: 'G20',         logoPath: '/logos/g20.svg',          members: ['Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India', 'Indonesia', 'Italy', 'Japan', 'Mexico', 'South Korea', 'Russia', 'Saudi Arabia', 'South Africa', 'Türkiye', 'United Kingdom', 'United States'] },
  EU:         { label: 'EU',          logoPath: '/logos/eu.png',           members: ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'] },
  NATO:       { label: 'NATO',        logoPath: '/logos/nato.png',         members: ['Albania', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Türkiye', 'United Kingdom', 'United States'] },
  ASEAN:      { label: 'ASEAN',       logoPath: '/logos/asean.png',        members: ['Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines', 'Singapore', 'Thailand', 'Timor-Leste', 'Vietnam'] },
  ArabLeague: { label: 'Arab League', logoPath: '/logos/arab-league.png',  members: ['Algeria', 'Bahrain', 'Comoros', 'Djibouti', 'Egypt', 'Iraq', 'Jordan', 'Kuwait', 'Lebanon', 'Libya', 'Mauritania', 'Morocco', 'Oman', 'Palestine', 'Qatar', 'Saudi Arabia', 'Somalia', 'Sudan', 'Syria', 'Tunisia', 'United Arab Emirates', 'Yemen'] },
};

// The acronym table that used to live here (uk, usa, uae, drc, roc, rok,
// dprk, car, png) moved into COUNTRY_NAME_ALIASES in src/lib/countries.ts,
// where findCountryFlexible consults it before its loose fallback. Three
// copies of that table had drifted apart; there is now one.
function fuzzyMatchCountry(raw: string): string | null {
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

// ── The selected roster, as its own panel ────────────────────────────────────
//
// Split out of ConferenceRosterPicker so the committee editor can dock it
// OUTSIDE its main bubble (next to the chairs panel) where it has room to
// breathe. Nothing was duplicated to do it: every mutation here is a pure
// function of `value` + `onChange`, and the three pieces of state that are
// genuinely local to the list (which row is being renamed, and the
// display-only sort) came with it.
//
// Rows are ONE LINE each: art, name, then a cluster of small controls that
// stay visible (muted) and brighten when the row is hovered or a control is
// focused. The two-line bordered cards this replaced wrapped every country
// onto two lines in the docked rail, which is the complaint this fixes.
//
// Two optional layers sit on top of the plain list:
//   - seat flags: a per-row image upload, offered only where it is useful.
//     Custom (parliamentary) committees always get it. Every other type gets
//     it only on a seat with no national flag to draw (a character or a
//     free-text entity), or on a seat that already carries an image, so it can
//     be replaced or cleared. A recognised country keeps its real flag and has
//     no image control at all. Once an image lands, an inline "apply to
//     others" strip offers to copy it to the same group, every eligible seat,
//     or a hand-picked set.
//   - groups (custom committees only): political groups / parties / benches.
//     The list becomes one section per group plus "Ungrouped"; rows drag
//     between sections, or move through the row's "Move to" select.

type UploadTarget = { kind: 'seat'; idx: number } | { kind: 'group'; id: string };

// Fixed-position anchor for the small floating panels below (flag chooser,
// group menu). Left-aligned to the anchor, clamped to the viewport, flipped
// above when there is no room beneath. Repositions on scroll and resize, and
// whenever `anchorKey` changes (the group menu hops from pill to pill while
// staying open). Placement is measured on the next frame, never mid-render.
function useFloatingPos(
  open: boolean,
  anchorKey: string | number | null,
  anchorRef: React.RefObject<HTMLElement | null>,
  width: number,
  estHeight: number,
) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(r.left, window.innerWidth - width - margin));
    const up = r.bottom + 6 + estHeight > window.innerHeight - margin && r.top - 6 - estHeight > margin;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left, up });
  }, [anchorRef, width, estHeight]);
  useEffect(() => {
    if (!open) {
      const id = requestAnimationFrame(() => setPos(null));
      return () => cancelAnimationFrame(id);
    }
    const id = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorKey, place]);
  return pos;
}

const floatingPanelStyle: React.CSSProperties = {
  position: 'fixed', zIndex: 10000,
  backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 12,
  boxShadow: '0 12px 34px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08)',
  fontFamily: "'Outfit', sans-serif",
};

const chipStyle: React.CSSProperties = { outline: 'none',
  fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em',
  padding: '3px 9px', borderRadius: 999, border: '1px solid #DDD4C0', backgroundColor: '#FFFDF8',
  color: '#1B3828', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.3,
};

// Row + control styling lives in one scoped stylesheet rather than a hover
// handler per control: the whole cluster brightens together when the ROW is
// hovered, which per-button handlers cannot express.
const ROSTER_ROW_CSS = `
.gv-rs-row { display:flex; align-items:center; gap:7px; height:34px; padding:0 4px 0 4px; border-bottom:1px solid #EFE9DB; border-radius:6px; transition:background-color 120ms; }
.gv-rs-row:hover { background-color:rgba(27,56,40,0.04); }
div:last-child > .gv-rs-row { border-bottom-color:transparent; }
.gv-rs-row.gv-rs-dragging { opacity:0.45; }
.gv-rs-ctl { outline:none; color:#B3A794; display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; flex-shrink:0; background:transparent; border:0; padding:0; cursor:pointer; transition:color 120ms, background-color 120ms; line-height:0; }
.gv-rs-row:hover .gv-rs-ctl { color:#1B3828; }
.gv-rs-ctl:hover { background-color:rgba(27,56,40,0.08); }
.gv-rs-ctl:focus-visible { color:#1B3828; box-shadow:0 0 0 2px rgba(27,56,40,0.35); }
.gv-rs-ctl.gv-rs-danger:hover { color:#8B2020 !important; }
.gv-rs-ctl.gv-rs-lit { color:#B6871F; }
.gv-rs-row:hover .gv-rs-ctl.gv-rs-lit { color:#B6871F; }
.gv-rs-art { position:relative; width:26px; height:18px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.gv-rs-art-x { outline:none; position:absolute; top:-7px; right:-8px; width:14px; height:14px; border-radius:999px; background:#8B2020; color:#FFFFFF; display:flex; align-items:center; justify-content:center; border:0; padding:0; cursor:pointer; opacity:0; transition:opacity 120ms; }
.gv-rs-art:hover .gv-rs-art-x, .gv-rs-art-x:focus-visible { opacity:1; }
.gv-rs-move { position:relative; }
.gv-rs-move select { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
.gv-rs-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 8px 3px 6px; border-radius:999px; border:1px solid #DDD4C0; background:#FFFDF8; cursor:pointer; font-family:'Outfit',sans-serif; font-size:10.5px; font-weight:700; color:#1C1410; line-height:1.3; white-space:nowrap; max-width:100%; }
.gv-rs-pill:hover, .gv-rs-pill:focus-visible { border-color:#1B3828; outline:none; }
.gv-rs-menu-btn { display:flex; align-items:center; gap:7px; width:100%; text-align:left; padding:7px 10px; border-radius:8px; border:0; background:transparent; cursor:pointer; font-family:'Outfit',sans-serif; font-size:12px; font-weight:600; color:#1C1410; }
.gv-rs-menu-btn:hover, .gv-rs-menu-btn:focus-visible { background:rgba(27,56,40,0.06); outline:none; }
.gv-rs-menu-btn.gv-rs-danger { color:#8B2020; }
`;

export function ConferenceRosterSelected({
  mode, value, onChange, style, className,
  groups = [], onGroupsChange, onUploadLogo, committeeType,
}: {
  mode: 'country' | 'character';
  value: RosterEntry[];
  onChange: (roster: RosterEntry[]) => void;
  style?: React.CSSProperties;
  className?: string;
  /** Seat groups (parties, benches). Only rendered for `committeeType === 'custom'`. */
  groups?: SlotGroup[];
  onGroupsChange?: (groups: SlotGroup[]) => void;
  /** Uploads a seat or group image and resolves to its public URL (null on
   *  failure). Enables the per-row flag control, on the seats that can use one
   *  (see `canSeatArt` below). */
  onUploadLogo?: (file: File, kind: 'seat' | 'group') => Promise<string | null>;
  committeeType?: string;
}) {
  const isCharacter = mode === 'character';
  const isCustom = committeeType === 'custom';
  const showGroups = isCustom && !!onGroupsChange;
  const hasGroups = showGroups && groups.length > 0;
  const canLogo = !!onUploadLogo;

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  // Display-only ordering of the selected list. 'entered' keeps insertion order;
  // 'az' sorts alphabetically; 'importance' ranks by tier (high → standard).
  // This never mutates `value` (handlers below always resolve the ORIGINAL
  // index) so parent state/observer/tier semantics are untouched. With groups
  // present the order applies inside each section.
  // A to Z is the default: a roster is read by looking a seat up by name, and
  // added order is only useful right after a paste. Clicking the lit option
  // restores added order.
  const [orderMode, setOrderMode] = useState<'entered' | 'az' | 'importance'>('az');

  // Flag upload plumbing: one hidden file input, the target remembered in a
  // ref between click and change.
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<UploadTarget | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  // Latest props for the async upload path (the await outlives the closure).
  const valueRef = useRef(value);
  const groupsRef = useRef(groups);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  // Every group mutation goes through here. Two reasons:
  //   1. It reads `groupsRef.current` and writes it back synchronously, so two
  //      changes fired before React re-renders (two preset picks in a row) both
  //      land. Reading the `groups` PROP instead made the second change compute
  //      from the pre-first-change array, which dropped the first one.
  //   2. A group id is generated ONCE and never regenerated. Seats reference a
  //      group by id (committee_country_slots.group_id), so a new id for an
  //      existing group orphans every seat in it: the section lookup misses and
  //      the seats fall into Ungrouped. Rename and recolour keep the id.
  const mutateGroups = useCallback((updater: (prev: SlotGroup[]) => SlotGroup[]) => {
    if (!onGroupsChange) return;
    const next = updater(groupsRef.current);
    groupsRef.current = next;
    onGroupsChange(next);
  }, [onGroupsChange]);

  // Can this seat show an image of its own? A custom committee always can:
  // every seat there is a party or a bench, and nothing else draws it. Anywhere
  // else the image is only offered where there is no national flag to override
  // (a character or a free-text entity), or where an image is already set, so
  // it can be replaced or removed. Nobody redraws the flag of France.
  const canSeatArt = useCallback(
    (r: RosterEntry) => canLogo && (isCustom || isCharacter || !!r.logoUrl || !getCountryByName(r.name)),
    [canLogo, isCustom, isCharacter],
  );

  // "Apply to others" strip: which row just received an image, and the URL.
  const [applyFor, setApplyFor] = useState<{ idx: number; url: string } | null>(null);
  // The "Choose…" checklist: the set of ORIGINAL indices ticked so far.
  const [chooser, setChooser] = useState<Set<number> | null>(null);
  const chooserAnchorRef = useRef<HTMLButtonElement>(null);
  const chooserPanelRef = useRef<HTMLDivElement>(null);
  const chooserPos = useFloatingPos(!!chooser, applyFor?.idx ?? null, chooserAnchorRef, 240, 280);

  // Groups bar state.
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState('');
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);
  const [groupRename, setGroupRename] = useState('');
  const groupMenuAnchorRef = useRef<HTMLElement | null>(null);
  const groupMenuPanelRef = useRef<HTMLDivElement>(null);
  const groupMenuPos = useFloatingPos(!!groupMenuId, groupMenuId, groupMenuAnchorRef, 220, 200);

  // Drag and drop between sections.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  // Outside click closes the two floating panels.
  useEffect(() => {
    if (!chooser && !groupMenuId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (chooser && !chooserPanelRef.current?.contains(t) && !chooserAnchorRef.current?.contains(t)) setChooser(null);
      if (groupMenuId && !groupMenuPanelRef.current?.contains(t) && !groupMenuAnchorRef.current?.contains(t)) setGroupMenuId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [chooser, groupMenuId]);

  const removeIdx = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
    // Keep the "apply to others" strip on the row it belongs to: indices
    // above the removed row shift down by one.
    if (applyFor?.idx === idx) { setApplyFor(null); setChooser(null); }
    else if (applyFor && idx < applyFor.idx) { setApplyFor({ ...applyFor, idx: applyFor.idx - 1 }); setChooser(null); }
  };

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

  const setRowGroup = (idx: number, groupId: string | null) => {
    onChange(value.map((r, i) => (i === idx ? { ...r, groupId } : r)));
  };

  const clearRowLogo = (idx: number) => {
    onChange(value.map((r, i) => (i === idx ? { ...r, logoUrl: null } : r)));
    if (applyFor?.idx === idx) { setApplyFor(null); setChooser(null); }
  };

  // ── Flag upload ──
  const pickFile = (t: UploadTarget) => {
    if (!onUploadLogo) return;
    uploadTarget.current = t;
    fileRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    const t = uploadTarget.current;
    uploadTarget.current = null;
    if (!f || !t || !onUploadLogo) return;
    const key = t.kind === 'seat' ? `seat:${t.idx}` : `group:${t.id}`;
    setUploading(key);
    const url = await onUploadLogo(f, t.kind);
    setUploading(null);
    if (!url) return;
    if (t.kind === 'seat') {
      onChange(valueRef.current.map((r, i) => (i === t.idx ? { ...r, logoUrl: url } : r)));
      // Offer to reuse it, but only when there is another seat to reuse it on.
      setChooser(null);
      setApplyFor(valueRef.current.length > 1 ? { idx: t.idx, url } : null);
    } else {
      mutateGroups((prev) => prev.map((g) => (g.id === t.id ? { ...g, logo_url: url } : g)));
    }
  };

  const applyFlag = (pick: (i: number, r: RosterEntry) => boolean) => {
    if (!applyFor) return;
    const { idx, url } = applyFor;
    // The source row always takes it. Every other row has to be a seat that can
    // show an image at all, so "All seats" can never paint over a real flag.
    onChange(valueRef.current.map((r, i) => (i === idx || (pick(i, r) && canSeatArt(r)) ? { ...r, logoUrl: url } : r)));
    setApplyFor(null);
    setChooser(null);
  };

  // ── Groups ──
  const nextColor = (list: SlotGroup[], offset = 0) => GROUP_COLORS[(list.length + offset) % GROUP_COLORS.length];

  const commitNewGroup = () => {
    const name = groupDraft.trim();
    setAddingGroup(false);
    setGroupDraft('');
    if (!name) return;
    mutateGroups((prev) => (
      prev.some((g) => g.name.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, { id: newGroupId(), name, logo_url: null, color: nextColor(prev) }]
    ));
  };

  // Presets APPEND. Names already on the bar are skipped, existing groups keep
  // their id and their seats, and nothing is ever cleared. Picking two presets
  // in a row leaves both sets on the bar.
  const applyPreset = (key: string) => {
    const preset = PARLIAMENT_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    mutateGroups((prev) => {
      const have = new Set(prev.map((g) => g.name.toLowerCase()));
      const additions: SlotGroup[] = [];
      for (const n of preset.groups) {
        if (have.has(n.toLowerCase())) continue;
        have.add(n.toLowerCase());
        additions.push({ id: newGroupId(), name: n, logo_url: null, color: nextColor(prev, additions.length) });
      }
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  };

  // Opens on click or keyboard activation, never on hover: this is a menu with
  // a destructive item, and it is portaled straight over the rest of the groups
  // bar. Opening it by passing the pointer across a pill put "Remove group"
  // under a click aimed at the preset select below it.
  const openGroupMenu = (id: string, el: HTMLElement) => {
    groupMenuAnchorRef.current = el;
    const g = groupsRef.current.find((x) => x.id === id);
    setGroupRename(g?.name ?? '');
    setGroupMenuId(id);
  };

  const commitGroupRename = (id: string) => {
    const name = groupRename.trim();
    if (!name) return;
    // Rename in place. The id is deliberately untouched: it is what the seats
    // point at.
    mutateGroups((prev) => (
      prev.some((g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase())
        ? prev
        : prev.map((g) => (g.id === id ? { ...g, name } : g))
    ));
  };

  const removeGroup = (id: string) => {
    if (!onGroupsChange) return;
    setGroupMenuId(null);
    mutateGroups((prev) => prev.filter((g) => g.id !== id));
    // Seats in the removed group go back to Ungrouped; the editor writes the
    // null through to committee_country_slots.group_id on save.
    if (value.some((r) => r.groupId === id)) onChange(value.map((r) => (r.groupId === id ? { ...r, groupId: null } : r)));
  };

  const clearGroupLogo = (id: string) => {
    mutateGroups((prev) => prev.map((g) => (g.id === id ? { ...g, logo_url: null } : g)));
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

  // One section per group, then Ungrouped. Without groups: a single flat list.
  const sections = useMemo(() => {
    if (!hasGroups) return [{ key: '__all', group: null as SlotGroup | null, rows: displayRows }];
    const ids = new Set(groups.map((g) => g.id));
    const out = groups.map((g) => ({ key: g.id, group: g as SlotGroup | null, rows: displayRows.filter((x) => x.r.groupId === g.id) }));
    out.push({ key: '__ungrouped', group: null, rows: displayRows.filter((x) => !x.r.groupId || !ids.has(x.r.groupId)) });
    return out;
  }, [hasGroups, groups, displayRows]);

  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of value) if (r.groupId) m.set(r.groupId, (m.get(r.groupId) ?? 0) + 1);
    return m;
  }, [value]);

  const applyRow = applyFor ? value[applyFor.idx] : null;
  const applyGroupName = applyRow?.groupId ? groups.find((g) => g.id === applyRow.groupId)?.name ?? null : null;
  // Only seats that can show an image are offered a copy of one. On a country
  // committee that is usually nobody, so the strip stays hidden.
  const applyTargets = useMemo(() => {
    if (!applyFor) return [] as { r: RosterEntry; i: number }[];
    return value.map((r, i) => ({ r, i })).filter(({ r, i }) => i !== applyFor.idx && canSeatArt(r));
  }, [applyFor, value, canSeatArt]);
  const sameGroupCount = applyRow?.groupId ? applyTargets.filter(({ r }) => r.groupId === applyRow.groupId).length : 0;

  const noun = isCustom ? 'seats' : isCharacter ? 'characters' : 'countries';
  const menuGroup = groupMenuId ? groups.find((g) => g.id === groupMenuId) ?? null : null;

  // ── Drag and drop (native, same pattern as the assignment board) ──
  const dragEnabled = hasGroups;
  const sectionDropProps = (key: string, groupId: string | null) => dragEnabled ? {
    onDragOver: (e: React.DragEvent) => {
      if (dragIdx === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropKey !== key) setDropKey(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropKey((k) => (k === key ? null : k));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('text/plain');
      setDropKey(null);
      setDragIdx(null);
      if (!data.startsWith('slot:')) return;
      const i = Number(data.slice(5));
      if (!Number.isInteger(i) || !value[i]) return;
      if ((value[i].groupId ?? null) !== groupId) setRowGroup(i, groupId);
    },
  } : {};

  return (
    <div className={`flex flex-col min-h-0 ${className ?? ''}`} style={style}>
      <style>{ROSTER_ROW_CSS}</style>
      {canLogo && (
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={onFilePicked} />
      )}

      {/* Header. `flex-wrap` so the label, the count badge and CLEAR ALL never
          squash each other in the narrow rail. */}
      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>{isCustom ? 'Selected seats' : isCharacter ? 'Selected characters' : 'Selected countries'}</label>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#1B3828', backgroundColor: 'rgba(238,217,138,0.3)', padding: '1px 6px', borderRadius: 999, fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
            {value.length}
          </span>
          <HoverInfo>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B6871F' }}>Reading this list</p>
            <div className="mt-2.5 flex gap-2.5">
              <span className="shrink-0 mt-0.5"><Megaphone size={14} strokeWidth={1.75} style={{ color: '#B6871F' }} /></span>
              <p style={{ margin: 0, fontSize: 11.5, color: '#4A3F33', lineHeight: 1.5 }}>
                <b style={{ color: '#1C1410' }}>Observer</b> (megaphone) marks a seat as a non-voting observer: they can speak but hold no vote. Click to toggle; lit gold = observer.
              </p>
            </div>
            {!isCharacter && (
              <div className="mt-2.5 flex gap-2.5">
                <span className="shrink-0 mt-1"><DashLegend tier="high" /></span>
                <p style={{ margin: 0, fontSize: 11.5, color: '#4A3F33', lineHeight: 1.5 }}>
                  <b style={{ color: '#1C1410' }}>Importance dashes</b> rank how sought-after a seat is. They steer allocation and assignment: higher tiers are offered to stronger applicants and surface first in suggestions.
                </p>
              </div>
            )}
            {canLogo && (
              <div className="mt-2.5 flex gap-2.5">
                <span className="shrink-0 mt-0.5"><ImagePlus size={14} strokeWidth={1.75} style={{ color: '#B6871F' }} /></span>
                <p style={{ margin: 0, fontSize: 11.5, color: '#4A3F33', lineHeight: 1.5 }}>
                  <b style={{ color: '#1C1410' }}>Flag</b> gives a seat its own picture. {isCustom ? 'Every seat here can take one.' : 'It is offered on seats with no national flag of their own.'} After you set one, you can copy it to other seats.
                </p>
              </div>
            )}
            {showGroups && (
              <div className="mt-2.5 flex gap-2.5">
                <span className="shrink-0 mt-0.5"><FolderInput size={14} strokeWidth={1.75} style={{ color: '#B6871F' }} /></span>
                <p style={{ margin: 0, fontSize: 11.5, color: '#4A3F33', lineHeight: 1.5 }}>
                  <b style={{ color: '#1C1410' }}>Groups</b> are parties or benches. Drag a seat under a group header, or use the move control on the row.
                </p>
              </div>
            )}
            {!isCharacter && (
              <div className="mt-2.5 flex items-center gap-3" style={{ borderTop: '1px solid #EDE7D8', paddingTop: 10 }}>
                {(['standard', 'low', 'medium', 'high'] as const).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1">
                    <DashLegend tier={t} />
                    <span style={{ fontSize: 9.5, color: '#9A8A78', fontWeight: 600 }}>{TIER_META[t].label}</span>
                  </span>
                ))}
              </div>
            )}
          </HoverInfo>
        </div>
        <div className="flex items-center gap-2">
          {value.length > 0 && (
            <button
              onClick={() => { onChange([]); setApplyFor(null); setChooser(null); }}
              className="text-xs font-bold uppercase tracking-wide transition-colors focus:outline-none"
              style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 9, whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
            >
              CLEAR ALL
            </button>
          )}
        </div>
      </div>

      {/* Groups bar (custom committees only). */}
      {showGroups && (
        <div className="mb-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span style={{ ...labelStyle, marginBottom: 0, fontSize: 9.5 }}>Groups</span>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="gv-rs-pill"
                title={`${g.name}: rename, set a flag, or remove`}
                aria-expanded={groupMenuId === g.id}
                onClick={(e) => { if (groupMenuId === g.id) setGroupMenuId(null); else openGroupMenu(g.id, e.currentTarget); }}
                style={{ borderColor: groupMenuId === g.id ? '#1B3828' : undefined }}
              >
                {g.logo_url
                  ? <img src={g.logo_url} alt="" draggable={false} style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                  : <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: g.color ?? '#1B3828', flexShrink: 0 }} />}
                <span className="truncate" style={{ maxWidth: 120 }}>{g.name}</span>
                <span style={{ fontSize: 9.5, color: '#9A8A78', fontVariantNumeric: 'tabular-nums' }}>{groupCounts.get(g.id) ?? 0}</span>
              </button>
            ))}
            {addingGroup ? (
              <input
                autoFocus
                value={groupDraft}
                onChange={(e) => setGroupDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitNewGroup(); } else if (e.key === 'Escape') { setAddingGroup(false); setGroupDraft(''); } }}
                onBlur={commitNewGroup}
                placeholder="Group name"
                aria-label="New group name"
                style={{ ...inputStyle, width: 130, padding: '3px 8px', fontSize: 11.5, borderRadius: 999 }}
              />
            ) : (
              <button type="button" className="gv-rs-pill" onClick={() => setAddingGroup(true)} style={{ borderStyle: 'dashed', color: '#1B3828' }}>
                <Plus size={11} strokeWidth={2.5} />
                Group
              </button>
            )}
            <select
              value=""
              onChange={(e) => { applyPreset(e.target.value); e.target.value = ''; }}
              aria-label="Start from a preset"
              title="Append a parliament's groups"
              className="focus:outline-none"
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 600, color: '#6E5F4E', border: '1px solid #DDD4C0', borderRadius: 999, padding: '3px 8px', backgroundColor: '#FAF8F3', cursor: 'pointer', maxWidth: 150 }}
            >
              <option value="">Start from a preset</option>
              {PARLIAMENT_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          {groups.length === 0 && (
            <p style={{ margin: 0, fontSize: 10.5, color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Add parties or benches, then drag seats under them.</p>
          )}
        </div>
      )}

      {/* Order toggle. Display-only; sorts inside each section when grouped. */}
      {value.length > 1 && (
        <div className="flex items-center gap-1 mb-2 rounded-lg p-0.5 self-start" style={{ backgroundColor: '#EFE9DB', border: '1px solid #E1D9C6' }}>
          {([
            { key: 'az' as const, label: 'A-Z', icon: <ArrowDownAZ size={11} strokeWidth={2} /> },
            ...(!isCharacter ? [{ key: 'importance' as const, label: 'Importance', icon: <DashLegend tier="high" /> }] : []),
          ]).map((opt) => {
            const active = orderMode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setOrderMode((cur) => (cur === opt.key ? 'entered' : opt.key))}
                aria-pressed={active}
                title={active ? 'Sorted. Click to restore added order' : `Sort by ${opt.key === 'az' ? 'name' : 'importance'}`}
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

      {/* The list: a single column of one-line rows, hairline-separated. */}
      <div
        className="flex-1 rounded-xl min-h-0"
        style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', overflowY: 'auto', padding: value.length === 0 ? 0 : '4px 6px' }}
      >
        {value.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-3 py-8">
            <p className="text-xs font-bold uppercase text-center" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{`NO ${noun.toUpperCase()}`}</p>
            <p className="text-xs text-center mt-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{isCharacter ? 'Type or paste names to add' : 'Search, use bundles, or paste'}</p>
          </div>
        ) : (
          sections.map((sec, sIdx) => {
            const isDropTarget = dropKey === sec.key;
            const g = sec.group;
            const isUngrouped = hasGroups && !g;
            return (
              <div
                key={sec.key}
                {...sectionDropProps(sec.key, g?.id ?? null)}
                style={{
                  borderRadius: 8, marginTop: hasGroups && sIdx > 0 ? 6 : 0, padding: hasGroups ? '2px 2px 4px' : 0,
                  boxShadow: isDropTarget ? '0 0 0 2px #1B3828 inset' : 'none',
                  backgroundColor: isDropTarget ? 'rgba(27,56,40,0.05)' : 'transparent',
                  transition: 'box-shadow 120ms, background-color 120ms',
                }}
              >
                {hasGroups && (
                  <div className="flex items-center gap-2" style={{ padding: '5px 4px 4px' }}>
                    <span style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: g ? (g.color ?? '#1B3828') : '#C9BEA2', flexShrink: 0 }} />
                    {g?.logo_url && <img src={g.logo_url} alt="" draggable={false} style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }} />}
                    <span className="truncate" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: g ? '#1B3828' : '#9A8A78' }}>
                      {g ? g.name : 'Ungrouped'}
                    </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 700, color: '#9A8A78', fontVariantNumeric: 'tabular-nums' }}>{sec.rows.length}</span>
                  </div>
                )}
                {hasGroups && sec.rows.length === 0 && (
                  <p style={{ margin: 0, padding: '4px 8px 6px', fontSize: 10.5, color: '#B3A794', fontFamily: "'Outfit', sans-serif", fontStyle: 'italic' }}>
                    {isUngrouped ? 'Drop a seat here to ungroup it' : 'No seats yet. Drag seats here'}
                  </p>
                )}
                {sec.rows.map(({ r: row, i: idx }) => {
                  const found = isCharacter ? undefined : getCountryByName(row.name);
                  const isCustomName = !found;
                  const isEditing = editingIdx === idx;
                  const isObserver = !!row.isObserver;
                  const art = effectiveSlotArt({ country_code: found?.code ?? row.name, logo_url: row.logoUrl ?? null, group_id: row.groupId ?? null }, groups);
                  const ownLogo = !!row.logoUrl;
                  // A recognised country on a country committee keeps its real
                  // flag and gets no image control at all.
                  const rowCanArt = canSeatArt(row);
                  const isUploading = uploading === `seat:${idx}`;
                  const isDragging = dragIdx === idx;
                  return (
                    <div key={`${row.name}-${idx}`}>
                      <div
                        className={`gv-rs-row${isDragging ? ' gv-rs-dragging' : ''}`}
                        draggable={dragEnabled && !isEditing}
                        onDragStart={dragEnabled ? (e) => { e.dataTransfer.setData('text/plain', `slot:${idx}`); e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx); } : undefined}
                        onDragEnd={dragEnabled ? () => { setDragIdx(null); setDropKey(null); } : undefined}
                        style={dragEnabled ? { cursor: 'grab' } : undefined}
                      >
                        {dragEnabled && <GripVertical size={12} style={{ color: '#D5CBB6', flexShrink: 0, marginRight: -3 }} aria-hidden />}
                        {/* Art: the seat's own image, its group's, the national flag, or the mode glyph. */}
                        <span className="gv-rs-art">
                          {art.kind === 'logo' ? (
                            <span style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <img src={art.url} alt={art.label} draggable={false} style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 5 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            </span>
                          ) : art.kind === 'flag' ? (
                            <img src={getFlagUrl(art.code)} alt={art.code} draggable={false} style={{ width: 26, height: 18, objectFit: 'cover', borderRadius: 3, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          ) : isCharacter ? (
                            <Users size={17} strokeWidth={1.5} style={{ color: '#B6871F' }} />
                          ) : (
                            <Globe size={17} strokeWidth={1.5} style={{ color: '#9A8A78' }} />
                          )}
                          {ownLogo && !isEditing && (
                            <button type="button" className="gv-rs-art-x" onClick={() => clearRowLogo(idx)} title="Remove flag" aria-label={`Remove flag from ${row.name}`}>
                              <X size={9} strokeWidth={3} />
                            </button>
                          )}
                        </span>
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(idx, editDraft); else if (e.key === 'Escape') setEditingIdx(null); }}
                            onBlur={() => commitRename(idx, editDraft)}
                            className="flex-1 min-w-0 text-[13px] bg-transparent outline-none"
                            style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", borderBottom: '1px solid #1B3828' }}
                          />
                        ) : (
                          <span className="flex-1 min-w-0 text-[13px] font-semibold truncate" title={row.name} style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                            {row.name}
                          </span>
                        )}
                        {!isEditing && (
                          <span className="flex items-center gap-0.5 shrink-0">
                            {/* Importance: country mode only. Vertical dashes: count + colour encode the tier. */}
                            {!isCharacter && (
                              <ImportanceDashes tier={row.importance} onClick={() => cycleTier(idx)} />
                            )}
                            {/* Observer toggle: countries AND characters, mirrors /create's megaphone */}
                            <button
                              type="button"
                              onClick={() => toggleObserver(idx)}
                              title={isObserver ? 'Observer. Click to make a voting delegate' : 'Mark as observer'}
                              aria-pressed={isObserver}
                              className={`gv-rs-ctl${isObserver ? ' gv-rs-lit' : ''}`}
                            >
                              <Megaphone size={13} strokeWidth={1.75} />
                            </button>
                            {/* Flag upload / replace */}
                            {rowCanArt && (
                              <button
                                type="button"
                                onClick={() => pickFile({ kind: 'seat', idx })}
                                disabled={isUploading}
                                title={ownLogo ? 'Replace flag' : 'Set a flag'}
                                aria-label={`${ownLogo ? 'Replace' : 'Set'} flag for ${row.name}`}
                                className={`gv-rs-ctl${ownLogo ? ' gv-rs-lit' : ''}`}
                                style={isUploading ? { opacity: 0.5, cursor: 'wait' } : undefined}
                              >
                                {ownLogo ? <Replace size={13} strokeWidth={1.75} /> : <ImagePlus size={13} strokeWidth={1.75} />}
                              </button>
                            )}
                            {/* Move to group: pointer/keyboard fallback for the drag. */}
                            {hasGroups && (
                              <span className="gv-rs-ctl gv-rs-move" title="Move to a group">
                                <FolderInput size={13} strokeWidth={1.75} />
                                <select
                                  aria-label={`Move ${row.name} to a group`}
                                  value={row.groupId && groups.some((x) => x.id === row.groupId) ? row.groupId : ''}
                                  onChange={(e) => setRowGroup(idx, e.target.value || null)}
                                >
                                  <option value="">Ungrouped</option>
                                  {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                                </select>
                              </span>
                            )}
                            {/* Rename: custom entries and all characters */}
                            {(isCustomName || isCharacter) && (
                              <button type="button" onClick={() => { setEditingIdx(idx); setEditDraft(row.name); }} className="gv-rs-ctl" title="Rename" aria-label={`Rename ${row.name}`}><PenLine size={13} /></button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeIdx(idx)}
                              className="gv-rs-ctl gv-rs-danger"
                              title="Remove"
                              aria-label={`Remove ${row.name}`}
                            >
                              <X size={13} strokeWidth={2.4} />
                            </button>
                          </span>
                        )}
                      </div>

                      {/* "Apply to others" strip, inline under the row that just got a flag.
                          Hidden when no other seat can take one. */}
                      {applyFor?.idx === idx && applyTargets.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap" style={{ margin: '4px 0 6px', padding: '7px 9px', borderRadius: 10, backgroundColor: 'rgba(238,217,138,0.22)', border: '1px solid rgba(182,135,31,0.35)' }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: '#1C1410', marginRight: 2 }}>Use this flag for other seats too?</span>
                          {applyGroupName && sameGroupCount > 0 && (
                            <button type="button" style={chipStyle} onClick={() => applyFlag((_, r) => r.groupId === applyRow?.groupId)} title={`Every seat in ${applyGroupName}`}>
                              Same group ({sameGroupCount})
                            </button>
                          )}
                          <button type="button" style={chipStyle} onClick={() => applyFlag(() => true)}>All seats ({applyTargets.length})</button>
                          <button
                            ref={chooserAnchorRef}
                            type="button"
                            style={{ ...chipStyle, borderColor: chooser ? '#1B3828' : undefined }}
                            onClick={() => setChooser((c) => (c ? null : new Set<number>()))}
                            aria-expanded={!!chooser}
                          >
                            Choose…
                          </button>
                          <button type="button" style={{ ...chipStyle, color: '#6E5F4E', backgroundColor: 'transparent' }} onClick={() => { setApplyFor(null); setChooser(null); }}>No</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* "Choose…" checklist, portaled so the rail's scroll box never clips it. */}
      {chooser && applyFor && chooserPos && (
        <Portal>
          <div
            ref={chooserPanelRef}
            style={{ ...floatingPanelStyle, top: chooserPos.top, left: chooserPos.left, width: 240, transform: chooserPos.up ? 'translateY(-100%)' : undefined, display: 'flex', flexDirection: 'column', maxHeight: 300 }}
          >
            <p style={{ margin: 0, padding: '9px 12px 6px', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B6871F' }}>Copy flag to</p>
            <div style={{ overflowY: 'auto', padding: '0 6px', flex: 1, minHeight: 0 }}>
              {applyTargets.map(({ r, i }) => {
                const on = chooser.has(i);
                return (
                  <label key={`${r.name}-${i}`} className="flex items-center gap-2" style={{ padding: '5px 6px', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: '#1C1410', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setChooser((c) => { const n = new Set(c ?? []); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                      style={{ accentColor: '#1B3828' }}
                    />
                    <span className="truncate">{r.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex items-center gap-2" style={{ padding: '8px 10px 10px', borderTop: '1px solid #EDE7D8' }}>
              <button type="button" style={{ ...chipStyle, color: '#6E5F4E', backgroundColor: 'transparent' }} onClick={() => setChooser(null)}>Cancel</button>
              <button
                type="button"
                disabled={chooser.size === 0}
                onClick={() => applyFlag((i) => chooser.has(i))}
                style={{ ...chipStyle, marginLeft: 'auto', backgroundColor: chooser.size === 0 ? '#DDD4C0' : '#1B3828', color: chooser.size === 0 ? '#9A8A78' : '#EED98A', borderColor: 'transparent', cursor: chooser.size === 0 ? 'default' : 'pointer' }}
              >
                <span className="inline-flex items-center gap-1"><Check size={11} strokeWidth={3} /> Apply to {chooser.size}</span>
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* Group pill menu: rename, flag, remove. A menu with actions, so it opens
          on click and closes on Escape or an outside click. It used to open on
          hover, and because it is portaled over the rest of the groups bar a
          click aimed at the preset select underneath landed on "Remove group",
          which deleted the group and dropped its seats into Ungrouped. */}
      {menuGroup && groupMenuPos && (
        <Portal>
          <div
            ref={groupMenuPanelRef}
            onKeyDown={(e) => { if (e.key === 'Escape') setGroupMenuId(null); }}
            style={{ ...floatingPanelStyle, top: groupMenuPos.top, left: groupMenuPos.left, width: 220, transform: groupMenuPos.up ? 'translateY(-100%)' : undefined, padding: 6 }}
          >
            <div className="flex items-center gap-2" style={{ padding: '4px 6px 6px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: menuGroup.color ?? '#1B3828', flexShrink: 0 }} />
              <input
                value={groupRename}
                onChange={(e) => setGroupRename(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitGroupRename(menuGroup.id); } else if (e.key === 'Escape') setGroupMenuId(null); }}
                onBlur={() => commitGroupRename(menuGroup.id)}
                aria-label="Group name"
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 12, borderRadius: 7 }}
              />
            </div>
            <button type="button" className="gv-rs-menu-btn" onClick={() => pickFile({ kind: 'group', id: menuGroup.id })} disabled={uploading === `group:${menuGroup.id}`}>
              {menuGroup.logo_url
                ? <img src={menuGroup.logo_url} alt="" draggable={false} style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: 4 }} />
                : <ImagePlus size={14} strokeWidth={1.75} style={{ color: '#B6871F' }} />}
              {uploading === `group:${menuGroup.id}` ? 'Uploading…' : menuGroup.logo_url ? 'Replace flag' : 'Set flag'}
            </button>
            {menuGroup.logo_url && (
              <button type="button" className="gv-rs-menu-btn" onClick={() => clearGroupLogo(menuGroup.id)}>
                <X size={14} strokeWidth={2} style={{ color: '#9A8A78' }} />
                Remove flag
              </button>
            )}
            <button type="button" className="gv-rs-menu-btn gv-rs-danger" onClick={() => removeGroup(menuGroup.id)}>
              <X size={14} strokeWidth={2} />
              {(() => { const n = groupCounts.get(menuGroup.id) ?? 0; return n > 0 ? `Remove group (${n} seat${n === 1 ? '' : 's'})` : 'Remove group'; })()}
            </button>
          </div>
        </Portal>
      )}
    </div>
  );
}

export function ConferenceRosterPicker({ mode, value, onChange, showSelected = true }: {
  mode: 'country' | 'character';
  value: RosterEntry[];
  onChange: (roster: RosterEntry[]) => void;
  /** False when the caller renders `ConferenceRosterSelected` itself somewhere
   *  else — the committee editor docks it outside its main panel. */
  showSelected?: boolean;
}) {
  const isCharacter = mode === 'character';
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  // The paste-review overlay is a modal. Ref-counted, so when it opens on top
  // of the committee editor modal the editor's own lock survives its close.
  useScrollLock(!!review);

  const names = value.map((r) => r.name);
  const nameSet = new Set(names.map((n) => n.toLowerCase()));

  // Ranked through the shared matcher so diacritics, aliases and locale names
  // all resolve: typing "tu" finds Türkiye, "uk" finds the United Kingdom.
  // Never hand-roll .toLowerCase().includes() here again, that is what broke
  // every renamed country. Exact and alias hits first, then prefix, then
  // substring; ties fall back to the list's own order.
  const available = isCharacter
    ? []
    : UN_COUNTRIES
        .filter((c) => !nameSet.has(c.name.toLowerCase()))
        .map((c) => ({ c, rank: countryMatchRank(c.name, search, 'en') }))
        .filter((x): x is { c: typeof UN_COUNTRIES[number]; rank: number } => x.rank !== null)
        .sort((a, b) => a.rank - b.rank || a.c.name.localeCompare(b.c.name))
        .map((x) => x.c);

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
    // The old `minHeight: 340` existed only to stop the add column from being
    // shorter than the selected list beside it. With the list docked elsewhere
    // there is nothing to match, and the floor was forcing the editor to
    // scroll for no reason.
    <div className="flex gap-5">
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
            /* 8 rows → 4. This is a paste TARGET, not a place anyone reads a
               list back: it scrolls, it is resize-y, and the 8-row default was
               ~90px of the committee editor's height — the single biggest
               reason the main step did not fit a 900px-tall viewport. */
            rows={4}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm resize-y focus:outline-none"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif", minHeight: 92, lineHeight: 1.55 }}
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

      {/* Right: selected list, unless the caller is placing it itself. */}
      {showSelected && (
        <ConferenceRosterSelected
          mode={mode}
          value={value}
          onChange={onChange}
          style={{ width: 280, flexShrink: 0, maxHeight: 320 }}
        />
      )}


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
              <button onClick={() => setReview(null)} className="gv-lift px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wide transition-colors focus:outline-none" style={{ color: '#6A5A4A', backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}>Cancel</button>
              <button onClick={commitReview} disabled={review.length === 0} className="gv-lift flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-30 focus:outline-none" style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>
                Add {review.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
