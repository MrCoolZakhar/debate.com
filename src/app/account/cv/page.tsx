'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, ScrollText, Award } from 'lucide-react';
import DecorativeBleed from '@/components/DecorativeBleed';
import { Emoji3D, NEU } from '@/components/neu';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { experienceProgress, syncExperienceLevel } from '@/lib/munExperience';
import { committeeDisplayName } from '@/lib/presetNames';
import { LogoDisc } from '@/components/LogoDisc';
import {
  CVEntryModal, ENTRY_TYPE_MAP, COMMITTEE_SUGGESTIONS, type CVEntry,
} from '@/components/CVEntryModal';
import {
  Eyebrow, GlassCard, LevelBadge, AwardChip, ExperienceInfo, getCommitteeLogo, monogramFor, OUTFIT, MONO,
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

function conferenceDisplay(name: string): { primary: string; secondary: string | null } {
  const year = (name.match(/\b(19|20)\d{2}\b/) ?? [''])[0];
  for (const c of CONFERENCE_ACRONYMS) {
    if (c.match.test(name)) {
      return { primary: year ? `${c.acronym} ${year}` : c.acronym, secondary: c.full };
    }
  }
  return { primary: name, secondary: null };
}

// ── Committee acronym display ────────────────────────────────────────────────
// Show the committee's short acronym (e.g. DISEC, SPECPOL) rather than the full
// spelled-out name. Explicit matches first (the shared presets don't cover every
// committee), then the shared preset acronyms, then committeeDisplayName's
// >4-word rule; short/unknown names pass through unchanged.
const COMMITTEE_ACRONYMS: { match: RegExp; acronym: string }[] = [
  { match: /disarmament (and )?international security/i,   acronym: 'DISEC' },
  { match: /special political (and )?decoloniz/i,          acronym: 'SPECPOL' },
  { match: /social,? humanitarian (and )?cultural/i,       acronym: 'SOCHUM' },
  { match: /world economic forum/i,                        acronym: 'WEF' },
];

function committeeLabel(name: string): string {
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
 *  universal LogoDisc treatment, monogram fallback. */
function ConferenceLogo({ entry, size = 64 }: { entry: Pick<CVEntry, 'logo_url' | 'conference_name'>; size?: number }) {
  return (
    <LogoDisc
      src={entry.logo_url}
      alt={entry.conference_name}
      size={size}
      fallbackText={monogramFor(entry.conference_name)}
    />
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

function TimelineEntry({
  entry,
  onEdit,
  isLast,
}: {
  entry: CVEntry;
  onEdit: () => void;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const type = ENTRY_TYPE_MAP[entry.entry_type] ?? ENTRY_TYPE_MAP.delegate;
  // Date lives on the timeline rail (under the logo), not inside the card.
  // Full month + year ("August 2026"), sized to read clearly on the rail.
  // Undated entries show an em-dash rather than leaking created_at.
  const railDate = entry.event_date
    ? new Date(`${entry.event_date}T00:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' })
    : '—';

  const allocCountry = entry.allocation ? getCountryByName(entry.allocation) : null;
  const allocFlag = allocCountry ? getFlagUrl(allocCountry.code) : null;

  // Awards only ever surface for delegate entries.
  const displayAwards = entry.entry_type === 'delegate'
    ? (entry.awards.length > 0 ? entry.awards : (entry.award && entry.award !== 'None' ? [entry.award] : []))
    : [];

  // Cards are compact by default and expand only when they carry richer content
  // (a description, awards, or photos) — no empty air on a bare entry.
  const isRich = entry.photos.length > 0 || !!entry.description || displayAwards.length > 0;
  const cardPad = isRich ? '!p-5 md:!p-5' : '!p-4';

  return (
    <div className="relative flex gap-4 md:gap-5">
      {/* Timeline rail: big conference logo + date + connecting line */}
      <div className="relative flex flex-col items-center flex-shrink-0" style={{ width: '64px' }}>
        <ConferenceLogo entry={entry} size={64} />
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

      {/* Content card — click anywhere to edit */}
      <div className="flex-1 min-w-0 pb-5">
        <GlassCard
          className={`${cardPad} relative`}
          style={{
            border: `1.5px solid ${type.border}`,
            isolation: 'isolate',
            cursor: 'pointer',
            boxShadow: hovered
              ? '0 2px 5px rgba(27,56,40,0.10), 0 18px 40px rgba(27,56,40,0.13)'
              : '0 1px 3px rgba(27,56,40,0.07), 0 12px 32px rgba(27,56,40,0.08)',
            transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
            transition: 'box-shadow 240ms cubic-bezier(0.22,1,0.36,1), transform 240ms cubic-bezier(0.22,1,0.36,1)',
          }}
          role="button"
          tabIndex={0}
          aria-label={`Edit ${entry.conference_name} entry`}
          onClick={onEdit}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Faded, blended type silhouette bleeding off the RIGHT edge — sits at
              zIndex -1 behind all content (card is a stacking context via its
              backdrop-filter + isolation), inside a self-clipping overflow-hidden
              layer so it can never force horizontal scroll, and pointer-events-none
              so it never intercepts clicks. */}
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

          {/* Corner type badge — 3D Fluent emoji on a soft neu seat (application-side
              icon language: NEU surface + soft shadow, no coloured glow). */}
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

          {/* Role chip — soft neu pill (NEU surface + gentle shadow + tinted
              accent), matching the applications-side chip system. */}
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

          {/* Role line — varies by type. The type glyph lives ONLY in the corner
              disc; role lines carry no emoji (no repetition). */}
          {entry.entry_type === 'delegate' && (
            <>
              {/* Country represented — the delegate's headline: bigger flag + bold allocation */}
              {entry.allocation && (
                <div className="flex items-center gap-2.5 flex-wrap mt-2.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  {allocFlag && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={allocFlag}
                      alt=""
                      style={{ width: '30px', height: '20px', objectFit: 'cover', borderRadius: '3.5px', boxShadow: '0 1.5px 4px rgba(27,56,40,0.25)', border: '1px solid rgba(255,255,255,0.7)' }}
                    />
                  )}
                  <span className="inline-flex items-center text-[17px]" style={{ fontWeight: 800, color: '#1B3828', letterSpacing: '-0.01em' }}>
                    {entry.allocation}
                  </span>
                </div>
              )}
              {entry.committee && (
                <div className="flex items-center gap-2 mt-2 text-[14px]" style={{ color: '#5C5140', fontFamily: OUTFIT, fontWeight: 500 }}>
                  <CommitteeLogo committee={entry.committee} size={22} />
                  <span>{committeeLabel(entry.committee)}</span>
                </div>
              )}
            </>
          )}

          {/* Chair — just the committee (acronym), no "Chaired", no glyph */}
          {entry.entry_type === 'chair' && entry.committee && (
            <div className="flex items-center gap-2 flex-wrap mt-2.5 text-[15px]" style={{ color: '#1B3828', fontFamily: OUTFIT, fontWeight: 700 }}>
              <CommitteeLogo committee={entry.committee} size={22} />
              <span>{committeeLabel(entry.committee)}</span>
            </div>
          )}

          {/* Secretariat / other — just the role title, no glyph */}
          {(entry.entry_type === 'secretariat' || entry.entry_type === 'other') && entry.allocation && (
            <div className="flex items-center flex-wrap mt-2.5 text-[15px]" style={{ color: '#1B3828', fontFamily: OUTFIT, fontWeight: 700 }}>
              <span>{entry.allocation}</span>
            </div>
          )}

          {/* Description — LinkedIn-style blurb */}
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

          {/* Photo strip — clicks open the photo, not the editor */}
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function CVPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [entries, setEntries]       = useState<CVEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalEntry, setModalEntry] = useState<CVEntry | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('mun_cv_entries')
      .select('id, entry_type, conference_name, committee, allocation, expertise_level, award, awards, photos, description, logo_url, conference_id, event_date, source, created_at')
      .eq('user_id', user.id);
    const rows = ((data as CVEntry[]) ?? []).map((r) => ({
      ...r,
      entry_type: r.entry_type ?? 'delegate',
      awards: r.awards ?? [],
      photos: r.photos ?? [],
    }));
    // Timeline order: most recent first. Prefer event_date; fall back to
    // created_at so undated entries still sort sensibly (near the bottom).
    rows.sort((a, b) => {
      const da = new Date(a.event_date ? `${a.event_date}T00:00:00` : a.created_at).getTime();
      const db = new Date(b.event_date ? `${b.event_date}T00:00:00` : b.created_at).getTime();
      return db - da;
    });
    setEntries(rows);
    setLoading(false);
    // Keep profiles.mun_experience_level in sync with the CV count.
    syncExperienceLevel(supabase, user.id, rows.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    fetchEntries();
  }, [authLoading, fetchEntries]);

  const handleDelete = useCallback(async (id: string) => {
    if (!session || !user) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('mun_cv_entries').delete().eq('id', id);
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      syncExperienceLevel(supabase, user.id, next.length);
      return next;
    });
  }, [session, user]);

  const totalConferences = entries.length;
  const totalAwards = entries.reduce((sum, e) => {
    if (e.awards.length > 0) return sum + e.awards.length;
    return sum + (e.award && e.award !== 'None' ? 1 : 0);
  }, 0);
  const totalVerified = entries.filter((e) => e.source === 'gavelling_verified').length;
  const exp = experienceProgress(totalConferences);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <Eyebrow className="mb-2">Delegate Record</Eyebrow>
          <h1
            className="font-black text-[26px] mb-1"
            style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
          >
            MUN CV
          </h1>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: 0 }}>
            Your Model UN conference history: typeset, verified, and yours.
          </p>
        </div>
        <button
          onClick={() => { setModalEntry(null); setModalOpen(true); }}
          aria-label="Add a conference to your CV"
          title="Add conference"
          className="flex items-center justify-center flex-shrink-0 rounded-full focus:outline-none transition-all"
          style={{
            width: '58px',
            height: '58px',
            background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
            color: '#EED98A',
            border: '1px solid rgba(238,217,138,0.4)',
            boxShadow: '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 30px rgba(27,56,40,0.34), inset 0 1px 0 rgba(238,217,138,0.3)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)'; }}
        >
          <Plus size={26} strokeWidth={2.6} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'CONFERENCES', value: String(totalConferences), isExp: false },
          { label: 'AWARDS', value: String(totalAwards), isExp: false },
          { label: 'VERIFIED', value: String(totalVerified), isExp: false },
          { label: 'EXPERIENCE', value: exp.label, isExp: true },
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-4 text-center">
            {stat.isExp ? (
              <div className="flex items-center justify-center" style={{ minHeight: '31px' }}>
                <LevelBadge level={exp.level} size="sm" />
              </div>
            ) : (
              <p
                className="font-black"
                style={{ color: '#1C1410', fontFamily: MONO, fontSize: '24px', lineHeight: 1.3, margin: 0 }}
              >
                {stat.value}
              </p>
            )}
            <p className="mt-1" style={{ color: '#B6871F', fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.22em', margin: '4px 0 0 0' }}>
              {stat.label}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Rank-up info panel — thresholds live behind the 'i' (ExperienceInfo). */}
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-4 mb-8"
        style={{ backgroundColor: 'rgba(238,217,138,0.14)', border: '1.5px solid rgba(182,135,31,0.35)', isolation: 'isolate' }}
      >
        {/* Decorative bleed — faded CV glyphs tucked behind the rank content
            (zIndex -1 under this isolated, opaque panel). */}
        <DecorativeBleed
          zIndex={-1}
          items={[
            { Icon: ScrollText, size: 128, top: '-30px', right: '-18px', opacity: 0.05 },
            { Icon: Award, size: 96, bottom: '-26px', left: '-16px', opacity: 0.045, rotate: -10 },
          ]}
        />
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} strokeWidth={2.4} style={{ color: '#B6871F' }} />
            <p className="font-bold text-[13px]" style={{ color: '#7A5A20', fontFamily: OUTFIT, margin: 0 }}>
              Your experience level
            </p>
          </div>
          <ExperienceInfo tone="light" align="right" currentLevel={exp.level} />
        </div>

        {/* Progress toward next rank */}
        <div className="w-full rounded-full overflow-hidden mb-1.5" style={{ height: '6px', backgroundColor: 'rgba(221,212,192,0.6)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(exp.progress * 100)}%`, background: 'linear-gradient(90deg, #B6871F, #EED98A)', transition: 'width 400ms ease' }}
          />
        </div>
        <p className="text-[12px]" style={{ color: '#7A5A20', fontFamily: OUTFIT, margin: 0 }}>
          {exp.nextLabel
            ? `You're ${exp.label}. Add ${exp.remaining} more conference${exp.remaining === 1 ? '' : 's'} to reach ${exp.nextLabel}.`
            : `You've reached Expert, the top tier. Keep adding conferences to grow your record.`}
        </p>
      </div>

      {/* Entries — vertical timeline */}
      {entries.length === 0 ? (
        <GlassCard className="text-center !py-14">
          <p className="text-lg font-bold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            No entries yet
          </p>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
            Add your past conferences manually, or they&apos;ll appear automatically when you attend Gavelling-verified conferences.
          </p>
          <button
            onClick={() => { setModalEntry(null); setModalOpen(true); }}
            aria-label="Add your first conference"
            className="flex items-center justify-center rounded-full focus:outline-none transition-all mx-auto"
            style={{
              width: '58px',
              height: '58px',
              background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
              color: '#EED98A',
              border: '1px solid rgba(238,217,138,0.4)',
              boxShadow: '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
          <p className="text-[12px] mt-3" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.1em', margin: '12px 0 0 0' }}>
            ADD YOUR FIRST ENTRY
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col">
          {entries.map((entry, i) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isLast={i === entries.length - 1}
              onEdit={() => { setModalEntry(entry); setModalOpen(true); }}
            />
          ))}
        </div>
      )}

      {modalOpen && user && (
        <CVEntryModal
          existing={modalEntry}
          userId={user.id}
          onClose={() => { setModalOpen(false); setModalEntry(null); }}
          onSaved={fetchEntries}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
