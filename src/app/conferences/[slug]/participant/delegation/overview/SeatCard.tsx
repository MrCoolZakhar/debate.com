'use client';

// "Your Seat", the left column of the delegation Overview (owner, 21 Oct 2026),
// drawn the same height as "Your Delegation" beside it and compact enough that
// both fit one screen at 1280x800:
//   the country      its ROUND flag (CircleFlag, the seat's crest first; never
//                    a rectangle, CLAUDE.md §8 rule 10), the name big beside
//                    it, the co-delegate under it, then the committee's logo
//                    with its short name over the full one
//   the topics       conference_committees.topics, numbered 1 to 3, ALWAYS
//                    shown when the committee has any (owner, 21 Oct 2026; the
//                    data was there, the card never drew it)
//   two doc tiles    the study guide (GuideTile, opened through openStudyGuide)
//                    and the position paper (PositionPaperCard's tile variant:
//                    Upload, or Submitted), each one row with ONE big button
//                    to the right of its text
//   the payment      what is owed today from my_open_balances with Pay now,
//                    else Paid, at the card's foot
// Names wrap, never cut; the conference's own colours (var(--gv-main)).

import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Compass, CreditCard, ExternalLink } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import ProfileLink from '@/components/ProfileLink';
import { SkeletonBlock } from '@/components/Skeleton';
import { centsToFee } from '@/lib/invoices';
import { useNow } from '@/lib/useNow';
import { useSeatCrest } from '../../AllocationCard';
import LockedPayButton from '../../PaymentsLocked';
import type { OpenBalance } from '../../PayNowCard';
import { useAllocationPartner } from '../../shared';
import type { ParticipantAllocation, ParticipantCommittee } from '../../types';
import { BTN_CLASS, cardStyle, CommitteeDisc, committeeEmblemSrc, FONT, INK, INK_SOFT, LINE, linkStyle, OK_GREEN, OWE, STROKE } from '../leaderKit';
import { guideState, useCommitteeGuides, useOpenStudyGuide } from '../committee/useCommitteeGuides';
import DocTile, { TileAction } from './DocTile';
import { committeeDisplayName } from '@/lib/presetNames';
import { dayOf, dayWords, relativeWords, todayStart } from './overviewDates';

/** A main button in the conference's own colour. */
export const mainBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 16px',
  borderRadius: 10, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
  border: 'none', background: 'var(--gv-main)', color: 'var(--gv-on-main)',
};

const titleStyle: React.CSSProperties = { fontFamily: FONT, fontSize: 19, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.25 };

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={titleStyle}>{children}</h2>;
}

/** The two Overview cards' frame: tighter on a phone, the same on both. */
export const OVERVIEW_CARD = 'flex flex-col flex-1 min-w-0 gap-4 p-[18px] sm:px-6 sm:py-[22px]';

/** The committee's topics, numbered, whenever it has any. */
export function TopicsList({ topics }: { topics: string[] | null | undefined }) {
  const list = (topics ?? []).filter(t => typeof t === 'string' && t.trim()).slice(0, 3);
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" aria-label="Topics">
      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK_SOFT }}>{list.length === 1 ? 'Topic' : 'Topics'}</span>
      <ol className="flex flex-col gap-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {list.map((t, i) => (
          <li key={i} className="flex items-start gap-2.5 min-w-0">
            <span
              aria-hidden
              className="inline-flex items-center justify-center flex-none"
              style={{ width: 22, height: 22, borderRadius: '50%', marginTop: 1, background: 'color-mix(in srgb, var(--gv-main) 9%, transparent)', color: 'var(--gv-main)', fontFamily: FONT, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              {i + 1}
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, color: INK, lineHeight: 1.4 }}>
              <span className="sr-only">Topic {i + 1}: </span>{t.trim()}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function SeatCard({ seat, committee, payments, paperTile, emptyAction }: {
  seat: ParticipantAllocation | null;
  committee: ParticipantCommittee | null;
  /** The position paper's tile (PositionPaperCard variant="tile"), beside the study guide's. */
  paperTile?: React.ReactNode;
  /** The payment block (PaymentsBlock), drawn at the card's foot. */
  payments: React.ReactNode;
  /** With no seat: what a leader can do about it (Open delegation). */
  emptyAction?: React.ReactNode;
}) {
  const crest = useSeatCrest(seat);
  const partner = useAllocationPartner(seat);
  const ccId = seat?.conference_committee_id ?? null;

  if (!seat || !committee) {
    return (
      <section aria-label="Your seat" className={OVERVIEW_CARD} style={cardStyle}>
        <CardTitle>Your Seat</CardTitle>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3" style={{ padding: '12px 8px' }}>
          <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 84, height: 84, borderRadius: '50%', background: '#F6F2EA' }}>
            <Compass size={34} strokeWidth={STROKE} style={{ color: 'var(--gv-main)' }} />
          </span>
          <p style={{ fontFamily: FONT, fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>No allocation yet</p>
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0, lineHeight: 1.5, maxWidth: 360 }}>
            Your committee and country appear here once you are allocated.
          </p>
          {emptyAction}
        </div>
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>{payments}</div>
      </section>
    );
  }

  const short = (committee.abbreviation ?? '').trim() || committeeDisplayName(committee.name, committee.abbreviation);
  const showFull = committee.name.trim() !== short.trim();

  return (
    <section aria-label="Your seat" className={OVERVIEW_CARD} style={cardStyle}>
      <CardTitle>Your Seat</CardTitle>

      {/* The country: its round flag big, the name beside it, the committee under the name. */}
      <div className="flex items-center gap-4 min-w-0">
        <CircleFlag
          code={seat.country_code}
          country={seat.country_code ? null : seat.country_name}
          logoUrl={crest}
          label={seat.country_name}
          size={84}
          loading="eager"
          decorative
          style={{ flexShrink: 0, filter: 'drop-shadow(0 10px 18px color-mix(in srgb, var(--gv-main) 22%, transparent))' }}
        />
        <div className="min-w-0 flex flex-col gap-1">
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
            {seat.country_name}
          </p>
          {partner?.name && (
            <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: 0 }}>
              With <ProfileLink userId={partner.userId} name={partner.name}>{partner.name}</ProfileLink>
            </p>
          )}
          <div className="flex items-center gap-2.5 min-w-0" style={{ marginTop: 4 }}>
            <CommitteeDisc src={committeeEmblemSrc(committee.logo_url, committee.name, committee.abbreviation)} size={32} />
            <div className="min-w-0 flex flex-col">
              <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{short}</span>
              {showFull && (
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT, lineHeight: 1.35 }}>{committee.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <TopicsList topics={committee.topics} />

      <div className="flex flex-col gap-2.5">
        <GuideTile committeeId={ccId} />
        {paperTile}
      </div>

      <div className="mt-auto" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>{payments}</div>
    </section>
  );
}

/** The study guide as a small tile: released (Open), out on a date, or not out yet. */
function GuideTile({ committeeId }: { committeeId: string | null }) {
  const now = useNow();
  const guides = useCommitteeGuides(committeeId ? [committeeId] : []);
  const openGuide = useOpenStudyGuide();
  const entry = committeeId ? guides?.get(committeeId) : undefined;
  const g = guideState(entry, now);
  const files = entry?.guides ?? [];
  return (
    <DocTile
      Icon={BookOpen}
      title="Study guide"
      line={guides === null && committeeId ? <SkeletonBlock width="60%" height={12} /> : g.line}
      action={g.kind === 'open' && files.length > 0
        ? files.map(f => (
          <TileAction key={f.id} Icon={ExternalLink} label={files.length === 1 ? 'Open' : f.title} onClick={() => openGuide(f.file_url)} />
        ))
        : undefined}
    />
  );
}

/** What this person owes today (my_open_balances) with Pay now, else where
 *  their own fee stands. Drawn in the seat card, or on its own for an advisor. */
export function PaymentsBlock({ rows, paymentStatus, selfPaid, feeFree, slug }: {
  rows: OpenBalance[] | null;
  paymentStatus: string;
  selfPaid: boolean;
  feeFree: boolean;
  slug: string;
}) {
  const today = todayStart();
  const icon = <CreditCard size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0, marginTop: 1 }} />;
  if (rows === null) {
    return (
      <div className="flex items-start gap-3" aria-hidden>
        {icon}
        <div className="flex-1 flex flex-col gap-2"><SkeletonBlock width="30%" height={14} /><SkeletonBlock width="55%" height={12} /></div>
      </div>
    );
  }
  if (rows.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        {rows.map(b => {
          const due = dayOf(b.due_date);
          const late = due !== null && due < today;
          return (
            <div key={`${b.conference_id}:${b.currency}`} className="flex items-start gap-3 flex-wrap">
              {icon}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>Payment</span>
                <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: OWE, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                  {centsToFee(b.due_cents, b.currency)}
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: INK_SOFT }}> to pay</span>
                </span>
                {due !== null && (
                  <span className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 13, color: late ? '#8B2020' : INK_SOFT }}>
                    <CalendarClock size={14} strokeWidth={STROKE} aria-hidden />
                    {late ? `Was due ${dayWords(due)}` : `Due ${dayWords(due)}, ${relativeWords(due, today)}`}
                  </span>
                )}
              </div>
              {b.payments_ready ? (
                <Link href={`/conferences/${b.slug || slug}/pay`} className={BTN_CLASS} style={mainBtn}>
                  Pay now <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
                </Link>
              ) : (
                <LockedPayButton slug={b.slug || slug} label={<>Pay now</>} className={BTN_CLASS} style={mainBtn} />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  const paid = paymentStatus === 'paid';
  const waived = paymentStatus === 'waived';
  const word = paid ? (selfPaid ? 'Paid' : 'Paid by your delegation') : waived ? 'Fee waived' : feeFree ? 'No fee to pay' : 'Nothing to pay yet';
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {paid || waived || feeFree
        ? <CheckCircle2 size={22} strokeWidth={STROKE} aria-hidden style={{ color: OK_GREEN, flexShrink: 0 }} />
        : icon}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: paid || waived ? OK_GREEN : INK }}>{word}</span>
        <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
          {paid || waived ? 'Receipts are on your payments page.' : 'Anything you owe shows here.'}
        </span>
      </div>
      <Link href={`/conferences/${slug}/pay`} className={BTN_CLASS} style={linkStyle}>Payments</Link>
    </div>
  );
}
