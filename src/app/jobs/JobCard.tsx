'use client';

// ── The job card (/jobs, and prompt 4's homepage and conference-page rows) ──
//
// Explore's card language, in a row shape: a white card with a soft
// forest-tinted shadow on the ivory, lifting a little on hover.
//   Line 1  the conference's logo (its verified tick on the disc's edge, none
//           when standalone) and the listing title, never cut off.
//   Line 2  the conference short name, city and country, the format, the dates.
//   Line 3  the offer chips, then the urgency line when there is one.
// A promoted card has a gold edge and a small "Promoted" tag; a premium card a
// "Premium" tag. `compact` is the smaller row prompt 4 places elsewhere.
//
// The card is a real <a href="/jobs?listing=<id>"> so the server-rendered list
// is crawlable; `onSelect` takes the click in place on /jobs.

import Link from 'next/link';
import { Clock, Crown, Sparkles } from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import VerifiedCheck from '@/components/VerifiedCheck';
import { getCountryByName } from '@/lib/countries';
import { formatConferenceDates, DATES_TO_BE_DECIDED } from '@/lib/conferenceDates';
import { jobOfferChips, type JobCard as JobCardData, type JobConference } from '@/lib/jobBoard';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

export const JOB_FORMAT_LABEL: Record<string, string> = {
  'in-person': 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
};

/** "Madrid, Spain" (the country's canonical name when we know it). */
export function jobPlace(c: JobConference): string {
  const country = c.country ? (getCountryByName(c.country)?.name ?? c.country) : '';
  return [c.city?.trim(), country.trim()].filter(Boolean).join(', ');
}

export function jobDates(c: JobConference): string {
  return c.start_date ? formatConferenceDates(c.start_date, c.end_date, { style: 'dmy-end-year' }) : DATES_TO_BE_DECIDED;
}

/** Monogram for a conference with no logo. */
export function jobInitials(c: JobConference): string {
  const base = (c.short || c.name || '').trim();
  return base.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'MUN';
}

/** The conference's logo disc with its verified tick on the edge. */
export function JobLogo({ conf, size, standalone }: { conf: JobConference; size: number; standalone: boolean }) {
  const tick = Math.max(14, Math.round(size * 0.36));
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, width: size, height: size }}>
      <LogoDisc
        src={conf.logo_url}
        alt={conf.short || conf.name || ''}
        size={size}
        fallbackText={jobInitials(conf)}
        style={{ border: '2px solid #FFFFFF', boxShadow: '0 4px 12px rgba(27,56,40,0.14)' }}
      />
      {!standalone && conf.verified && (
        <span style={{ position: 'absolute', right: -3, bottom: -3, lineHeight: 0, borderRadius: 9999, background: '#FFFFFF', padding: 1.5 }}>
          <VerifiedCheck verified size={tick} title="Verified conference" />
        </span>
      )}
    </span>
  );
}

/** The small Promoted / Premium tags. */
export function JobTag({ kind }: { kind: 'promoted' | 'premium' }) {
  const promoted = kind === 'promoted';
  return (
    <span
      title={promoted ? 'Paid for by the conference' : 'For Gavelling Unlimited members'}
      className="inline-flex items-center"
      style={{
        gap: 4, fontFamily: FONT, fontSize: 11, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap',
        padding: '3px 8px', borderRadius: 9999,
        color: promoted ? '#4A3410' : '#F4F1E8',
        background: promoted ? 'linear-gradient(145deg, #F3E3A1 0%, #EED98A 55%, #D9B44A 100%)' : 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%)',
        boxShadow: promoted ? '0 1px 4px rgba(182,135,31,0.35)' : '0 1px 4px rgba(27,56,40,0.3)',
      }}
    >
      {promoted ? <Sparkles size={11} strokeWidth={2.4} aria-hidden /> : <Crown size={11} strokeWidth={2.4} aria-hidden />}
      {promoted ? 'Promoted' : 'Premium'}
    </span>
  );
}

export function OfferChips({ card, size = 'md' }: { card: Pick<JobCardData, 'offers'>; size?: 'sm' | 'md' }) {
  const chips = jobOfferChips(card.offers);
  if (!chips.length) return null;
  const sm = size === 'sm';
  return (
    <ul className="flex flex-wrap" style={{ listStyle: 'none', margin: 0, padding: 0, gap: sm ? 5 : 6 }}>
      {chips.map((c) => (
        <li
          key={c.key}
          style={{
            fontSize: sm ? 11.5 : 12.5, fontWeight: 600, lineHeight: 1.2, color: '#2A4A36',
            padding: sm ? '3px 8px' : '4px 10px', borderRadius: 8,
            background: c.key === 'paid' ? 'rgba(238,217,138,0.45)' : 'rgba(27,56,40,0.07)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {c.label}
        </li>
      ))}
    </ul>
  );
}

export function UrgencyLine({ text, size = 'md' }: { text: string | null | undefined; size?: 'sm' | 'md' }) {
  if (!text) return null;
  return (
    <span className="inline-flex items-center" style={{ gap: 5, fontSize: size === 'sm' ? 12 : 13, fontWeight: 700, color: '#8A5A12' }}>
      <Clock size={size === 'sm' ? 12 : 13} strokeWidth={2.4} aria-hidden />
      {text}
    </span>
  );
}

export default function JobCard({
  card, selected = false, onSelect, compact = false, status, closed = false, href,
}: {
  card: JobCardData;
  selected?: boolean;
  /** Take the click in place (the /jobs list). Without it the link navigates. */
  onSelect?: (id: string) => void;
  compact?: boolean;
  /** A line drawn at the foot of the card (My Applications' status). */
  status?: React.ReactNode;
  /** A saved listing that stopped taking applicants. */
  closed?: boolean;
  /** Where the card goes; defaults to the listing on /jobs. */
  href?: string;
}) {
  const conf = card.conference;
  const target = href ?? `/jobs?listing=${encodeURIComponent(card.id)}`;
  const meta = [
    conf.short || conf.name,
    jobPlace(conf),
    conf.format ? JOB_FORMAT_LABEL[conf.format] ?? null : null,
    jobDates(conf),
  ].filter(Boolean) as string[];
  const hasTags = card.promoted || card.premium || closed;
  const logo = compact ? 38 : 46;

  return (
    <Link
      href={target}
      scroll={false}
      onClick={onSelect ? (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onSelect(card.id);
      } : undefined}
      aria-current={selected ? 'true' : undefined}
      className={`gv-job-card${card.promoted ? ' gv-job-card-promoted' : ''}${selected ? ' gv-job-card-on' : ''} focus:outline-none`}
      style={{ padding: compact ? '12px 14px' : '16px 18px', gap: compact ? 8 : 10 }}
    >
      <style>{CARD_CSS}</style>
      <span className="flex items-start" style={{ gap: compact ? 10 : 12 }}>
        <JobLogo conf={conf} size={logo} standalone={card.standalone} />
        <span className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="flex items-start justify-between" style={{ gap: 8 }}>
            <span
              style={{
                fontSize: compact ? 15.5 : 17, fontWeight: 700, lineHeight: 1.25, color: INK,
                letterSpacing: '-0.01em', overflowWrap: 'anywhere', minWidth: 0,
              }}
            >
              {card.title}
            </span>
            {hasTags && (
              <span className="flex flex-wrap justify-end" style={{ gap: 5, flexShrink: 0, marginTop: 1 }}>
                {closed && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 9999, background: 'rgba(28,20,16,0.08)', color: INK_SOFT }}>
                    Closed
                  </span>
                )}
                {card.premium && <JobTag kind="premium" />}
                {card.promoted && <JobTag kind="promoted" />}
              </span>
            )}
          </span>
          {card.committee && (
            <span style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: FOREST, overflowWrap: 'anywhere' }}>
              {card.committee}
            </span>
          )}
          <span style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 500, lineHeight: 1.45, color: INK_SOFT, overflowWrap: 'anywhere' }}>
            {meta.map((m, i) => (
              <span key={i}>
                {i > 0 && <span aria-hidden style={{ margin: '0 6px', color: 'rgba(28,20,16,0.3)' }}>·</span>}
                <span style={i === 0 ? { fontWeight: 700, color: '#3A3128' } : undefined}>{m}</span>
              </span>
            ))}
          </span>
        </span>
      </span>
      {(jobOfferChips(card.offers).length > 0 || card.urgency) && (
        <span className="flex flex-wrap items-center" style={{ gap: 8, paddingLeft: logo + (compact ? 10 : 12) }}>
          <OfferChips card={card} size={compact ? 'sm' : 'md'} />
          <UrgencyLine text={card.urgency} size={compact ? 'sm' : 'md'} />
        </span>
      )}
      {status && <span style={{ paddingLeft: logo + (compact ? 10 : 12) }}>{status}</span>}
    </Link>
  );
}

export function JobCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden className="gv-job-card gv-job-skel" style={{ padding: compact ? '12px 14px' : '16px 18px', gap: 10 }}>
      <style>{CARD_CSS}</style>
      <span className="flex items-start" style={{ gap: 12 }}>
        <span className="gv-job-bone" style={{ width: compact ? 38 : 46, height: compact ? 38 : 46, borderRadius: 9999 }} />
        <span className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          <span className="gv-job-bone" style={{ width: '62%', height: 14 }} />
          <span className="gv-job-bone" style={{ width: '88%', height: 11 }} />
        </span>
      </span>
      <span className="flex" style={{ gap: 6, paddingLeft: compact ? 48 : 58 }}>
        <span className="gv-job-bone" style={{ width: 54, height: 20 }} />
        <span className="gv-job-bone" style={{ width: 96, height: 20 }} />
      </span>
    </div>
  );
}

const CARD_CSS = `
.gv-job-card{position:relative;display:flex;flex-direction:column;background:#FFFFFF;border-radius:18px;text-decoration:none;color:${INK};font-family:${FONT};
  box-shadow:0 1px 2px rgba(27,56,40,0.05),0 6px 18px rgba(27,56,40,0.07);transition:box-shadow 220ms ease,transform 240ms cubic-bezier(0.22,1,0.36,1)}
a.gv-job-card:hover{box-shadow:0 1px 2px rgba(27,56,40,0.06),0 14px 32px rgba(27,56,40,0.13);transform:translateY(-2px)}
a.gv-job-card:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}
.gv-job-card-promoted{box-shadow:0 0 0 1.5px #E2C467,0 8px 22px rgba(182,135,31,0.18)}
a.gv-job-card-promoted:hover{box-shadow:0 0 0 1.5px #D9B44A,0 14px 32px rgba(182,135,31,0.26)}
.gv-job-card-on,a.gv-job-card-on:hover{box-shadow:0 0 0 2px ${FOREST},0 10px 26px rgba(27,56,40,0.14);transform:none}
.gv-job-bone{display:block;border-radius:6px;background:linear-gradient(90deg,#EFEAE0 0%,#F7F4EE 50%,#EFEAE0 100%);background-size:200% 100%;animation:gvJobBone 1.3s ease-in-out infinite}
@keyframes gvJobBone{from{background-position:100% 0}to{background-position:-100% 0}}
@media (prefers-reduced-motion:reduce){.gv-job-card{transition:none}a.gv-job-card:hover{transform:none}.gv-job-bone{animation:none}}
`;
