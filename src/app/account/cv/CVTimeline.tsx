'use client';

// Shared, presentational MUN-CV renderer used by BOTH the private CV editor
// (/account/cv) and the public shareable CV (/cv/[id]). No data fetching, no
// auth — it takes entries and renders the stats row + timeline. Passing
// `onEditEntry` makes cards + logos interactive (private view); omitting it
// renders a read-only CV (public view).

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Emoji3D, NEU } from '@/components/neu';
import { committeeDisplayName } from '@/lib/presetNames';
import { LogoDisc } from '@/components/LogoDisc';
import { ENTRY_TYPE_MAP, COMMITTEE_SUGGESTIONS, type CVEntry } from '@/components/CVEntryModal';
import { experienceProgress } from '@/lib/munExperience';
import {
  GlassCard, LevelBadge, LevelInsignia, LEVEL_ACCENT, AwardChip, getCommitteeLogo, monogramFor, OUTFIT,
} from '../accountUi';

// ── Conference acronym display ───────────────────────────────────────────────
// House rule: long, spelled-out conference names show the ACRONYM as the primary
// label with the full name small beneath. Known MUN series are mapped explicitly
// (naive initials get these wrong — e.g. LIMUN, BrumMUN, IEUMUN). Unknown names
// fall through unchanged.
const CONFERENCE_ACRONYMS: { match: RegExp; acronym: string; full: string }[] = [
  { match: /asia youth international model united nations/i, acronym: 'AYIMUN',   full: 'Asia Youth International Model United Nations' },
  { match: /harvard world model united nations|world model united nations/i, acronym: 'WorldMUN', full: 'Harvard World Model United Nations' },
  { match: /london international model united nations/i,     acronym: 'LIMUN',    full: 'London International Model United Nations' },
  { match: /ie university model united nations/i,            acronym: 'IEUMUN',   full: 'IE University Model United Nations' },
  { match: /birmingham model united nations/i,              acronym: 'BrumMUN',  full: 'Birmingham Model United Nations' },
  { match: /lse model united nations|lsesu model united nations/i, acronym: 'LSEMUN', full: 'LSE Model United Nations' },
  { match: /ucl model united nations|uclu model united nations/i,  acronym: 'UCLMUN', full: 'UCL Model United Nations' },
  { match: /hult (ashridge )?model united nations/i,        acronym: 'HultMUN',  full: 'Hult Model United Nations' },
];

export function conferenceDisplay(name: string): { primary: string; secondary: string | null } {
  const year = (name.match(/\b(19|20)\d{2}\b/) ?? [''])[0];
  for (const c of CONFERENCE_ACRONYMS) {
    if (c.match.test(name)) {
      return { primary: year ? `${c.acronym} ${year}` : c.acronym, secondary: c.full };
    }
  }
  return { primary: name, secondary: null };
}

// ── Committee acronym display ────────────────────────────────────────────────
const COMMITTEE_ACRONYMS: { match: RegExp; acronym: string }[] = [
  { match: /disarmament (and )?international security/i,   acronym: 'DISEC' },
  { match: /special political (and )?decoloniz/i,          acronym: 'SPECPOL' },
  { match: /social,? humanitarian (and )?cultural/i,       acronym: 'SOCHUM' },
  { match: /world economic forum/i,                        acronym: 'WEF' },
];

export function committeeLabel(name: string): string {
  const n = (name ?? '').trim();
  if (!n) return n;
  for (const c of COMMITTEE_ACRONYMS) if (c.match.test(n)) return c.acronym;
  const q = n.toLowerCase();
  const preset = COMMITTEE_SUGGESTIONS.find((p) => p.name.toLowerCase() === q || p.acronym.toLowerCase() === q);
  if (preset) return committeeDisplayName(preset.name, preset.acronym);
  return committeeDisplayName(n);
}

// ── Logo tiles ─────────────────────────────────────────────────────────────

/** Large PRIMARY tile — the conference's own logo (logo_url) inside the
 *  universal LogoDisc treatment, monogram fallback. When `onEdit` is provided
 *  the disc becomes interactive: hovering reveals a "+" so a missing logo can
 *  be added (and an existing one changed) straight from the timeline. */
function ConferenceLogo({
  entry,
  size = 84,
  onEdit,
}: {
  entry: Pick<CVEntry, 'logo_url' | 'conference_name'>;
  size?: number;
  onEdit?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const disc = (
    <LogoDisc
      src={entry.logo_url}
      alt={entry.conference_name}
      size={size}
      fallbackText={monogramFor(entry.conference_name)}
    />
  );
  if (!onEdit) return disc;

  const hasLogo = !!entry.logo_url;
  const badge = Math.round(size * 0.34);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onEdit(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={hasLogo ? `Change ${entry.conference_name} logo` : `Add a logo for ${entry.conference_name}`}
      title={hasLogo ? 'Change logo' : 'Add a logo'}
      className="relative flex-shrink-0 rounded-full focus:outline-none"
      style={{ width: `${size}px`, height: `${size}px`, padding: 0, border: 'none', background: 'none', cursor: 'pointer', lineHeight: 0 }}
    >
      {disc}
      {/* Hover veil + "+" — dims the disc and floats an add/change affordance. */}
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{
          backgroundColor: `rgba(27,56,40,${hovered ? 0.4 : 0})`,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 180ms ease, background-color 180ms ease',
        }}
      >
        <span
          className="flex items-center justify-center rounded-full"
          style={{
            width: `${badge}px`,
            height: `${badge}px`,
            background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
            color: '#EED98A',
            border: '1px solid rgba(238,217,138,0.5)',
            boxShadow: '0 4px 12px rgba(27,56,40,0.35)',
          }}
        >
          <Plus size={Math.round(badge * 0.62)} strokeWidth={2.6} />
        </span>
      </span>
    </button>
  );
}

/** Small SECONDARY committee logo shown inline beside the committee name. */
function CommitteeLogo({ committee, size = 18 }: { committee: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = getCommitteeLogo(committee);
  if (!src || failed) return null;
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '5px',
        backgroundColor: 'rgba(250,248,243,0.95)', border: '1px solid rgba(221,212,192,0.9)', padding: '2px',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  );
}

// ── Entry card ─────────────────────────────────────────────────────────────

export function TimelineEntry({
  entry,
  onEdit,
  isLast,
}: {
  entry: CVEntry;
  /** Provided on the private CV (opens the editor); omitted → read-only. */
  onEdit?: () => void;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const type = ENTRY_TYPE_MAP[entry.entry_type] ?? ENTRY_TYPE_MAP.delegate;
  const editable = !!onEdit;
  const railDate = entry.event_date
    ? new Date(`${entry.event_date}T00:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' })
    : '—';

  const displayAwards = entry.entry_type === 'delegate'
    ? (entry.awards.length > 0 ? entry.awards : (entry.award && entry.award !== 'None' ? [entry.award] : []))
    : [];

  const isRich = entry.photos.length > 0 || !!entry.description || displayAwards.length > 0;
  const cardPad = isRich ? '!p-5 md:!p-5' : '!p-4';

  return (
    <div className="relative flex gap-4 md:gap-5">
      {/* Timeline rail: big conference logo + date + connecting line */}
      <div className="relative flex flex-col items-center flex-shrink-0" style={{ width: '84px' }}>
        <ConferenceLogo entry={entry} size={84} onEdit={onEdit} />
        <span
          className="mt-2 text-center"
          style={{ fontFamily: OUTFIT, fontSize: '13.5px', fontWeight: 700, color: '#5C5140', lineHeight: 1.2, letterSpacing: '-0.005em' }}
        >
          {railDate}
        </span>
        {!isLast && (
          <div
            aria-hidden
            className="flex-1 mt-2.5"
            style={{ width: '3px', minHeight: '24px', background: 'linear-gradient(180deg, rgba(42,90,60,0.28) 0%, rgba(200,190,168,0.5) 55%, rgba(200,190,168,0.18) 100%)', borderRadius: '9999px' }}
          />
        )}
      </div>

      {/* Content card — click anywhere to edit (private view only) */}
      <div className="flex-1 min-w-0 pb-5">
        <GlassCard
          className={`${cardPad} relative`}
          style={{
            border: `1.5px solid ${type.border}`,
            isolation: 'isolate',
            cursor: editable ? 'pointer' : 'default',
            boxShadow: hovered
              ? '0 2px 5px rgba(27,56,40,0.10), 0 18px 40px rgba(27,56,40,0.13)'
              : '0 1px 3px rgba(27,56,40,0.07), 0 12px 32px rgba(27,56,40,0.08)',
            transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
            transition: 'box-shadow 240ms cubic-bezier(0.22,1,0.36,1), transform 240ms cubic-bezier(0.22,1,0.36,1)',
          }}
          role={editable ? 'button' : undefined}
          tabIndex={editable ? 0 : undefined}
          aria-label={editable ? `Edit ${entry.conference_name} entry` : undefined}
          onClick={editable ? onEdit : undefined}
          onKeyDown={editable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit!(); } } : undefined}
          onMouseEnter={editable ? () => setHovered(true) : undefined}
          onMouseLeave={editable ? () => setHovered(false) : undefined}
        >
          {/* Faded, blended type silhouette bleeding off the RIGHT edge. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{ zIndex: -1, borderRadius: '20px' }}
          >
            <type.bleedIcon
              size={172}
              strokeWidth={1}
              className="pointer-events-none absolute"
              style={{
                right: '-46px',
                top: '50%',
                transform: `translateY(-50%) rotate(${-type.bleedRotate}deg)`,
                color: 'rgba(27,56,40,0.05)',
              }}
            />
          </div>

          {/* Corner type badge */}
          <span
            className="absolute flex items-center justify-center"
            title={type.label}
            style={{
              top: '-12px', right: '14px', width: '34px', height: '34px', borderRadius: '9999px',
              background: `linear-gradient(150deg, ${type.accent}22, ${type.accent}12), ${NEU.surface}`,
              border: '2px solid #FAF8F3',
              boxShadow: NEU.outSm,
            }}
          >
            <Emoji3D name={type.emoji} size={20} fallback={type.Icon} fallbackColor={type.accent} />
          </span>

          {/* Role chip */}
          <div className="flex items-center gap-3 mb-2 pr-9">
            <span
              className="inline-flex items-center gap-1.5 flex-shrink-0"
              style={{
                padding: '4px 11px 4px 7px',
                borderRadius: '999px',
                background: `linear-gradient(150deg, ${type.accent}1C, ${type.accent}0C), ${NEU.surface}`,
                border: `1px solid ${type.accent}33`,
                boxShadow: NEU.outSm,
                color: type.chipInk,
                fontFamily: OUTFIT,
                fontSize: '10.5px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {type.label}
            </span>
          </div>

          {/* Conference name — ACRONYM primary, spelled-out name small beneath */}
          {(() => {
            const disp = conferenceDisplay(entry.conference_name);
            return (
              <>
                <h3
                  className="font-black leading-tight"
                  style={{ color: '#1B3828', fontFamily: OUTFIT, fontSize: '18px', letterSpacing: '-0.01em', margin: 0 }}
                >
                  {disp.primary}
                </h3>
                {disp.secondary && (
                  <p className="mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, fontSize: '11.5px', fontWeight: 500, margin: '2px 0 0 0', lineHeight: 1.3 }}>
                    {disp.secondary}
                  </p>
                )}
              </>
            );
          })()}

          {/* Delegate subheading — COMMITTEE (logo + acronym) — ALLOCATION. */}
          {entry.entry_type === 'delegate' && (entry.committee || entry.allocation) && (
            <div className="flex items-center gap-2 flex-wrap mt-2.5" style={{ fontFamily: OUTFIT }}>
              {entry.committee && <CommitteeLogo committee={entry.committee} size={22} />}
              <span className="inline-flex items-baseline flex-wrap gap-x-1.5 text-[15px]" style={{ letterSpacing: '-0.005em', lineHeight: 1.3 }}>
                {entry.committee && (
                  <span style={{ color: '#1B3828', fontWeight: 700 }}>{committeeLabel(entry.committee)}</span>
                )}
                {entry.committee && entry.allocation && (
                  <span aria-hidden style={{ color: '#B6A88E', fontWeight: 500 }}>—</span>
                )}
                {entry.allocation && (
                  <span style={{ color: '#5C5140', fontWeight: 600 }}>{entry.allocation}</span>
                )}
              </span>
            </div>
          )}

          {/* Chair — just the committee (acronym) */}
          {entry.entry_type === 'chair' && entry.committee && (
            <div className="flex items-center gap-2 flex-wrap mt-2.5 text-[15px]" style={{ color: '#1B3828', fontFamily: OUTFIT, fontWeight: 700 }}>
              <CommitteeLogo committee={entry.committee} size={22} />
              <span>{committeeLabel(entry.committee)}</span>
            </div>
          )}

          {/* Secretariat / other — just the role title */}
          {(entry.entry_type === 'secretariat' || entry.entry_type === 'other') && entry.allocation && (
            <div className="flex items-center flex-wrap mt-2.5 text-[15px]" style={{ color: '#1B3828', fontFamily: OUTFIT, fontWeight: 700 }}>
              <span>{entry.allocation}</span>
            </div>
          )}

          {/* Description */}
          {entry.description && (
            <p className="text-[13px] mt-2.5" style={{ color: '#4A4038', fontFamily: OUTFIT, lineHeight: 1.6, margin: '10px 0 0 0' }}>
              {entry.description}
            </p>
          )}

          {/* Awards + expertise (delegate only) */}
          {(displayAwards.length > 0 || (entry.entry_type === 'delegate' && entry.expertise_level)) && (
            <div className="flex gap-1.5 flex-wrap mt-3 items-center">
              {displayAwards.map((a) => <AwardChip key={a} name={a} />)}
              {entry.entry_type === 'delegate' && entry.expertise_level && <LevelBadge level={entry.expertise_level} size="sm" />}
            </div>
          )}

          {/* Photo strip */}
          {entry.photos.length > 0 && (
            <div className="flex gap-2 mt-3">
              {entry.photos.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Conference photo"
                    style={{ width: '84px', height: '60px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(221,212,192,0.9)', boxShadow: '0 2px 8px rgba(27,56,40,0.08)' }}
                  />
                </a>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ── Stats row ────────────────────────────────────────────────────────────────

/** Three showcase counts + the rank insignia. Computes totals from `entries`. */
export function CVStatsRow({ entries }: { entries: CVEntry[] }) {
  const totalConferences = entries.length;
  const totalAwards = entries.reduce((sum, e) => {
    if (e.awards.length > 0) return sum + e.awards.length;
    return sum + (e.award && e.award !== 'None' ? 1 : 0);
  }, 0);
  const totalVerified = entries.filter((e) => e.source === 'gavelling_verified').length;
  const exp = experienceProgress(totalConferences);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-stretch">
      {[
        { label: 'CONFERENCES', value: String(totalConferences) },
        { label: 'AWARDS', value: String(totalAwards) },
        { label: 'VERIFIED', value: String(totalVerified) },
      ].map((stat) => (
        <GlassCard key={stat.label} className="!p-4 text-center flex flex-col items-center justify-center">
          <p
            style={{
              color: '#1B3828',
              fontFamily: OUTFIT,
              fontSize: '42px',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              margin: 0,
            }}
          >
            {stat.value}
          </p>
          <p className="mt-2" style={{ color: '#B6871F', fontFamily: OUTFIT, fontSize: '10px', fontWeight: 800, letterSpacing: '0.2em', margin: '10px 0 0 0' }}>
            {stat.label}
          </p>
        </GlassCard>
      ))}

      {/* Rank tile — big insignia glyph, tier name directly under it. */}
      <GlassCard className="!p-4 text-center flex flex-col items-center justify-center">
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: '58px',
            height: '58px',
            borderRadius: '9999px',
            background: `linear-gradient(150deg, ${LEVEL_ACCENT[exp.level] ?? '#9A8A78'}26, ${LEVEL_ACCENT[exp.level] ?? '#9A8A78'}12)`,
            border: `1px solid ${LEVEL_ACCENT[exp.level] ?? '#9A8A78'}55`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
          }}
        >
          <LevelInsignia level={exp.level} size={40} />
        </span>
        <p className="mt-2" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: '17px', fontWeight: 800, letterSpacing: '-0.01em', margin: '10px 0 0 0', lineHeight: 1 }}>
          {exp.label}
        </p>
      </GlassCard>
    </div>
  );
}
