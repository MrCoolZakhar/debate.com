'use client';

// ─────────────────────────────────────────────────────────────────────────────
// RegistrationConfirmation — the confirmation moment.
//
// One component, two arrivals:
//
//   1. straight after an application is submitted
//      (/conferences/[slug]/apply/confirmation)
//   2. coming back from Stripe with a successful charge
//      (ConferenceDetailClient, ?payment=success)
//
// A "delegate pass" card on the left, the headline and the actions on the
// right. The pass turns to face the reader on entry, then the pill, the date
// chip and the logo disc pop in behind it. All of that is switched off under
// `prefers-reduced-motion`.
//
// TWO STATES, and the difference is only ever what the DATA says:
//   'paid' — gold seal, "Paid" row, CTA "Go to my conference"
//   'due'  — no seal, amber "Due" row, CTA "Pay <amount>" with a card icon
//
// NOTHING here decides that a payment succeeded. The caller passes `state`
// straight off the application row the webhook wrote; the `processing` flag
// is the only thing this component knows about a charge still in flight, and
// while it is true the Pay CTA is suppressed rather than the state changed.
//
// The committee row deliberately reads "Not allocated yet" unless the caller
// hands over a released allocation. There is no allocation-date column in the
// schema, so the pass promises no date it cannot keep.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { Check, CalendarDays, CreditCard, Clock } from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import { NEU } from '@/components/neu';
import { formatFee } from '@/lib/finance';
import { conferenceAcronymLabel, conferenceFullNameLabel } from '@/lib/conferenceLabels';
import { formatConferenceDates } from '@/lib/conferenceDates';

const OUTFIT = "'Outfit', sans-serif";
const EASE = 'cubic-bezier(0.22,1,0.36,1)';
const IVORY = '#FAF8F3';

/** Everything the pass needs off the conference row. Structural on purpose so
 *  both the public page's `Conference` and a narrow select satisfy it. */
export interface RegistrationConfirmationConference {
  slug: string;
  full_name: string;
  acronym: string;
  start_date: string | null;
  end_date: string | null;
  city?: string | null;
  country?: string | null;
  banner_url?: string | null;
  logo_url?: string | null;
}

export type RegistrationConfirmationState = 'paid' | 'due';

export interface RegistrationConfirmationProps {
  conference: RegistrationConfirmationConference;
  /** Read off the application row, never inferred on the client. */
  state: RegistrationConfirmationState;
  /** Application role, for the "Delegate registration" line. */
  role: string;
  /** Society name, or null for an independent applicant. */
  delegation?: string | null;
  /** A RELEASED allocation's committee name. Null reads "Not allocated yet". */
  committee?: string | null;
  /** Amount paid ('paid') or amount outstanding ('due'). Null hides the row. */
  amount?: number | null;
  currency: string;
  /** The webhook has not landed yet. Shows the reassurance line and holds the
   *  Pay CTA back, because a charge is already on its way. */
  processing?: boolean;
  /** Where "Go to my conference" goes. Omit to render it as a button and
   *  handle it with `onContinue` instead (used when the moment is already
   *  sitting on the conference page). */
  continueHref?: string;
  onContinue?: () => void;
  /** Payment surface. Without it the Pay CTA never renders, which is how a
   *  "pay after acceptance" role avoids offering a payment it cannot take. */
  payHref?: string | null;
  /** Rendered under the two columns (the apply page keeps its timeline). */
  children?: React.ReactNode;
  className?: string;
}

const ROLE_REGISTRATION_LABEL: Record<string, string> = {
  delegate: 'Delegate registration',
  'head-delegate': 'Head delegate registration',
  'faculty-advisor': 'Faculty advisor registration',
  observer: 'Observer registration',
  chair: 'Chair registration',
  crisis: 'Crisis staff registration',
  press: 'Press registration',
  staff: 'Staff registration',
};

function registrationLabel(role: string): string {
  return ROLE_REGISTRATION_LABEL[role]
    ?? `${role.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())} registration`;
}

/** YYYYMMDD/YYYYMMDD for a Google Calendar all-day event. The end is
 *  EXCLUSIVE there, so a 19 to 21 Feb conference ends 20270222. */
function googleCalendarDates(start: string | null, end: string | null): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec((start ?? '').trim());
  if (!m) return null;
  const e = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec((end ?? '').trim()) ?? m;
  const pad = (n: number) => String(n).padStart(2, '0');
  const startStamp = `${m[1]}${pad(+m[2])}${pad(+m[3])}`;
  // +1 day, in UTC so no local timezone can roll it backwards.
  const exclusive = new Date(Date.UTC(+e[1], +e[2] - 1, +e[3] + 1));
  const endStamp = `${exclusive.getUTCFullYear()}${pad(exclusive.getUTCMonth() + 1)}${pad(exclusive.getUTCDate())}`;
  return `${startStamp}/${endStamp}`;
}

export default function RegistrationConfirmation({
  conference,
  state,
  role,
  delegation = null,
  committee = null,
  amount = null,
  currency,
  processing = false,
  continueHref,
  onContinue,
  payHref = null,
  children,
  className,
}: RegistrationConfirmationProps) {
  const paid = state === 'paid';
  const acronym = conferenceAcronymLabel(conference);
  const fullName = conferenceFullNameLabel(conference) || conference.full_name;
  // The pass shows the acronym big; a conference with no acronym on record
  // falls back to its name rather than printing an empty hero.
  const heroLabel = acronym || fullName;
  const place = [conference.city, conference.country].filter(Boolean).join(', ');
  const dates = formatConferenceDates(conference.start_date, conference.end_date, {
    style: 'dmy-end-year-spaced',
    fallback: 'Dates to be confirmed',
  });

  const money = amount !== null && amount !== undefined && amount > 0
    ? formatFee(amount, currency)
    : null;

  // The Pay CTA only exists when there is somewhere to pay, something to pay,
  // and no charge already in flight.
  const showPay = !paid && !processing && !!payHref && !!money;

  const gcalDates = googleCalendarDates(conference.start_date, conference.end_date);
  const calendarHref = gcalDates
    ? 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + `&text=${encodeURIComponent(fullName)}`
      + `&dates=${gcalDates}`
      + (place ? `&location=${encodeURIComponent(place)}` : '')
      + `&details=${encodeURIComponent(
        state === 'paid'
          ? `Your ${role.replace(/-/g, ' ')} place at ${heroLabel} is confirmed. See it on Gavelling.`
          : `Your ${role.replace(/-/g, ' ')} registration for ${heroLabel}. See it on Gavelling.`,
      )}`
    : null;

  // A conference with no fee still gets the moment, but never a word about
  // money: no "Payment due" pill, no fee sentence, no Pay button.
  const owesMoney = !paid && !!money;
  const pillLabel = paid ? 'Paid' : owesMoney ? 'Payment due' : 'Registered';

  const headline = paid
    ? `You're going to ${heroLabel}`
    : "You're on the roster";
  const sub = paid
    ? 'Your place is confirmed and paid. Committee allocations are not out yet, and we will email you the moment yours is ready.'
    : owesMoney
      ? 'Your registration is in. Your place is held while the fee is outstanding, and it is confirmed the moment it is paid.'
      : 'Your registration is in. Committee allocations are not out yet, and we will email you the moment yours is ready.';

  const ctaInner = (
    <>
      {showPay && <CreditCard size={17} strokeWidth={2.2} style={{ flexShrink: 0 }} />}
      <span>{showPay ? `Pay ${money}` : 'Go to my conference'}</span>
    </>
  );
  const ctaStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 9,
    fontFamily: OUTFIT, fontSize: 14, fontWeight: 800,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    padding: '15px 28px', borderRadius: 999, border: 'none', cursor: 'pointer',
    background: `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})`,
    color: NEU.gold, textDecoration: 'none',
    boxShadow: `0 4px 10px color-mix(in srgb, ${NEU.forest} 30%, transparent), ${NEU.outSm}`,
  };

  const ctaHref = showPay ? (payHref as string) : continueHref;

  return (
    <div className={`rc-root ${className ?? ''}`}>
      <style>{`
        .rc-stage {
          display: grid;
          grid-template-columns: minmax(300px, 392px) auto;
          gap: clamp(36px, 6vw, 84px);
          align-items: center;
          justify-content: center;
          perspective: 1700px;
        }
        @media (max-width: 900px) {
          .rc-stage { grid-template-columns: minmax(0,1fr); gap: 40px; justify-items: center; }
          .rc-pass { max-width: 380px; width: 100%; }
          .rc-message { text-align: center; max-width: 100%; }
          .rc-sub { margin-left: auto; margin-right: auto; }
          .rc-stall, .rc-actions { justify-content: center; }
        }
        @keyframes rc-spin-in {
          0%   { opacity: 0; transform: rotateY(-90deg) scale(0.93); }
          45%  { opacity: 1; }
          74%  { transform: rotateY(6deg) scale(1.012); }
          100% { opacity: 1; transform: rotateY(0deg) scale(1); }
        }
        @keyframes rc-rise { 0% { opacity: 0; transform: translateY(15px); } 100% { opacity: 1; transform: none; } }
        @keyframes rc-pop  { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }
        .rc-pass      { animation: rc-spin-in 1500ms ${EASE} both; }
        .rc-pill,
        .rc-datechip  { animation: rc-pop 460ms ${EASE} 1060ms both; }
        .rc-logo      { animation: rc-pop 520ms ${EASE} 1160ms both; }
        .rc-seal      { animation: rc-pop 620ms ${EASE} 1260ms both; }
        .rc-eyebrow   { animation: rc-rise 560ms ${EASE} 420ms both; }
        .rc-headline  { animation: rc-rise 660ms ${EASE} 540ms both; }
        .rc-sub       { animation: rc-rise 660ms ${EASE} 680ms both; }
        .rc-actions   { animation: rc-rise 660ms ${EASE} 820ms both; }
        .rc-cta { transition: transform 160ms ${EASE}, box-shadow 160ms ease; }
        .rc-cta:hover { transform: translateY(-1px); }
        .rc-cta:active { transform: translateY(0); }
        .rc-link { transition: border-color 160ms ease; }
        .rc-link:hover { border-bottom-color: ${NEU.forest} !important; }
        @media (prefers-reduced-motion: reduce) {
          .rc-pass, .rc-pill, .rc-datechip, .rc-logo, .rc-seal,
          .rc-eyebrow, .rc-headline, .rc-sub, .rc-actions { animation: none !important; }
          .rc-cta, .rc-link { transition: none; }
          .rc-cta:hover { transform: none; }
        }
      `}</style>

      <div className="rc-stage">
        {/* ── The pass ───────────────────────────────────────────────── */}
        <article
          className="rc-pass"
          aria-labelledby="rc-pass-title"
          style={{
            background: NEU.surface,
            borderRadius: 26,
            padding: '14px 14px 22px',
            boxShadow: `0 28px 60px color-mix(in srgb, ${NEU.forest} 20%, transparent), -8px -8px 18px rgba(255,255,255,0.7)`,
            transformOrigin: '50% 50%',
          }}
        >
          {/* Exists only so the overlapping badges have an unclipped parent:
              the hero itself must keep overflow:hidden for its corners. */}
          <div style={{ position: 'relative' }}>
            <div
              role="img"
              aria-label={`${heroLabel} banner`}
              style={{
                position: 'relative', borderRadius: 17, overflow: 'hidden',
                aspectRatio: '4 / 3.15',
                // A missing banner is a forest field, never a broken image.
                background: conference.banner_url
                  ? `url("${conference.banner_url}") center 42% / cover no-repeat, linear-gradient(160deg, ${NEU.forest}, ${NEU.green})`
                  : `linear-gradient(160deg, ${NEU.forest}, ${NEU.green})`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start', justifyContent: 'flex-end',
                textAlign: 'left', padding: '26px 22px 30px',
              }}
            >
              {/* Forest-tinted scrim, heavier at the bottom so the acronym and
                  the floating logo hold over a bright photo. */}
              <span
                aria-hidden
                style={{
                  content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'linear-gradient(to top, rgba(10,22,16,0.92) 0%, rgba(12,26,19,0.70) 26%, rgba(18,36,27,0.30) 58%, rgba(12,26,19,0.44) 100%)',
                }}
              />

              <span
                className="rc-pill"
                style={{
                  position: 'absolute', top: 13, left: 13, zIndex: 3,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px 6px 10px', borderRadius: 999,
                  background: NEU.surface, fontFamily: OUTFIT,
                  fontSize: 12.5, fontWeight: 700, color: NEU.ink,
                  boxShadow: `0 3px 10px color-mix(in srgb, ${NEU.forest} 26%, transparent)`,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                    background: owesMoney ? NEU.amber : NEU.green,
                  }}
                />
                {pillLabel}
              </span>

              <span
                className="rc-datechip"
                style={{
                  position: 'absolute', top: 13, right: 13, zIndex: 3,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 999,
                  background: 'rgba(20,36,27,0.5)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(250,248,243,0.2)',
                  fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: IVORY,
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                }}
              >
                <CalendarDays size={12} strokeWidth={2.4} style={{ color: NEU.gold, flexShrink: 0 }} />
                {dates}
              </span>

              <p
                style={{
                  position: 'relative', zIndex: 1, margin: 0,
                  fontFamily: OUTFIT, fontSize: 'clamp(26px, 6.2vw, 44px)', fontWeight: 800,
                  lineHeight: 1, color: NEU.gold, letterSpacing: '-0.02em',
                  textShadow: '0 2px 14px rgba(0,0,0,0.45)',
                  // Clears the logo disc overlapping the bottom-left edge.
                  paddingLeft: 72,
                  overflowWrap: 'break-word',
                }}
              >
                {heroLabel}
              </p>
              {place && (
                <p
                  style={{
                    position: 'relative', zIndex: 1, margin: '7px 0 0',
                    fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600,
                    letterSpacing: '0.15em', textTransform: 'uppercase',
                    color: 'rgba(250,248,243,0.82)',
                    textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                    paddingLeft: 72,
                  }}
                >
                  {place}
                </p>
              )}
            </div>

            {/* Overlapping badges: siblings of the hero, so nothing clips them. */}
            <LogoDisc
              className="rc-logo"
              src={conference.logo_url}
              alt={`${heroLabel} logo`}
              size={60}
              fallbackText={(conference.acronym || conference.full_name || '?').trim().slice(0, 2).toUpperCase()}
              style={{
                position: 'absolute', left: 16, bottom: -22, zIndex: 4,
                border: `3px solid ${NEU.surface}`,
                boxShadow: '0 8px 18px rgba(6,14,10,0.38)',
              }}
            />

            {paid && (
              <span
                className="rc-seal"
                aria-hidden
                style={{
                  position: 'absolute', right: 18, bottom: -18, zIndex: 4,
                  width: 50, height: 50, borderRadius: 999,
                  display: 'grid', placeItems: 'center',
                  background: `linear-gradient(140deg, ${NEU.gold}, ${NEU.deepGold})`,
                  boxShadow: `0 8px 20px color-mix(in srgb, ${NEU.forest} 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.5)`,
                }}
              >
                <Check size={23} strokeWidth={3} style={{ color: NEU.forest }} />
              </span>
            )}
          </div>

          <div style={{ padding: '34px 8px 0' }}>
            <h2
              id="rc-pass-title"
              style={{
                fontFamily: OUTFIT, fontSize: 18.5, fontWeight: 700, lineHeight: 1.28,
                margin: '0 0 4px', color: NEU.ink, textWrap: 'balance',
              }}
            >
              {fullName}
            </h2>
            <p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft, margin: 0 }}>
              {registrationLabel(role)}
            </p>

            <dl
              style={{
                marginTop: 20, paddingTop: 17, borderTop: '1px solid var(--gv-border)',
                display: 'flex', flexDirection: 'column', gap: 11,
              }}
            >
              <PassRow label="Committee" value={committee ?? 'Not allocated yet'} pending={!committee} />
              <PassRow label="Delegation" value={delegation || 'Independent'} />
              {money && (
                <PassRow
                  label={paid ? 'Paid' : 'Due'}
                  value={money}
                  total
                  valueColor={paid ? NEU.ink : NEU.amber}
                />
              )}
            </dl>
          </div>
        </article>

        {/* ── Message column ─────────────────────────────────────────── */}
        <div className="rc-message" style={{ maxWidth: '30rem' }}>
          {acronym && (
            <p
              className="rc-eyebrow"
              style={{
                fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: NEU.amber, margin: '0 0 16px',
              }}
            >
              {acronym}
            </p>
          )}
          <h1
            className="rc-headline"
            style={{
              fontFamily: OUTFIT, fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 800,
              lineHeight: 1.04, letterSpacing: '-0.028em', margin: '0 0 18px',
              color: NEU.forest, textWrap: 'balance',
            }}
          >
            {headline}
          </h1>
          <p
            className="rc-sub"
            style={{
              fontFamily: OUTFIT, fontSize: 16.5, lineHeight: 1.55, color: NEU.inkSoft,
              margin: processing ? '0 0 14px' : '0 0 30px', maxWidth: '34ch',
            }}
          >
            {sub}
          </p>

          {processing && (
            <p
              className="rc-stall"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: OUTFIT, fontSize: 13.5, color: NEU.amber, margin: '0 0 26px',
              }}
            >
              <Clock size={15} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              Still recording your payment. Nothing more to do, this page updates itself.
            </p>
          )}

          <div
            className="rc-actions"
            style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}
          >
            {ctaHref ? (
              <Link href={ctaHref} className="rc-cta focus:outline-none" style={ctaStyle}>
                {ctaInner}
              </Link>
            ) : (
              <button type="button" onClick={onContinue} className="rc-cta focus:outline-none" style={ctaStyle}>
                {ctaInner}
              </button>
            )}

            {calendarHref && (
              <a
                href={calendarHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rc-link focus:outline-none"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
                  color: NEU.forest, padding: '6px 2px', textDecoration: 'none',
                  borderBottom: `1.5px solid color-mix(in srgb, ${NEU.forest} 28%, transparent)`,
                }}
              >
                <CalendarDays size={14} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                Add to calendar
              </a>
            )}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

function PassRow({
  label, value, pending = false, total = false, valueColor,
}: {
  label: string;
  value: string;
  pending?: boolean;
  total?: boolean;
  valueColor?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
      <dt style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.inkSoft, margin: 0 }}>{label}</dt>
      <dd
        style={{
          fontFamily: OUTFIT,
          fontSize: total ? 16 : 14,
          fontWeight: pending ? 500 : total ? 700 : 600,
          color: valueColor ?? (pending ? NEU.muted : NEU.ink),
          margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </dd>
    </div>
  );
}
