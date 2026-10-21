'use client';

// "Your Seat", the left column of the delegation Overview (owner, 21 Oct 2026:
// "the country with a BIG flag on a taller, more vertical card, as the
// delegate's seat card looked before"): the look of the earlier delegate
// allocation card (AllocationCard's "Your country": the flag large and
// centred, the country's name big under it, the co-delegate beneath), then the
// committee's logo with its short name over the full one. Then ONE line of two
// small, equal tiles (owner, 21 Oct 2026): the study guide (GuideTile, opened
// through openStudyGuide) and the position paper (PositionPaperCard's tile
// variant, handed in by the Overview: Upload, or Submitted). Then the payment
// (what is owed today from my_open_balances with Pay now, else Paid).
// Names wrap, never cut; the conference's own colours (var(--gv-main)).

import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Compass, CreditCard, ExternalLink } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
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
      <section aria-label="Your seat" className="flex flex-col" style={{ ...cardStyle, padding: '22px 24px' }}>
        <CardTitle>Your Seat</CardTitle>
        <div className="flex flex-col items-center text-center gap-3" style={{ padding: '28px 8px 24px' }}>
          <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 104, height: 104, borderRadius: '50%', background: '#F6F2EA' }}>
            <Compass size={40} strokeWidth={STROKE} style={{ color: 'var(--gv-main)' }} />
          </span>
          <p style={{ fontFamily: FONT, fontSize: 20, fontWeight: 600, color: INK, margin: 0 }}>No allocation yet</p>
          <p style={{ fontFamily: FONT, fontSize: 14.5, color: INK_SOFT, margin: 0, lineHeight: 1.5, maxWidth: 360 }}>
            Your committee and country appear here once you are allocated.
          </p>
          {emptyAction}
        </div>
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>{payments}</div>
      </section>
    );
  }

  const short = (committee.abbreviation ?? '').trim() || committeeDisplayName(committee.name, committee.abbreviation);
  const showFull = committee.name.trim() !== short.trim();

  return (
    <section aria-label="Your seat" className="flex flex-col" style={{ ...cardStyle, padding: '22px 24px' }}>
      <CardTitle>Your Seat</CardTitle>

      {/* The country, large and centred. */}
      <div className="flex flex-col items-center text-center" style={{ padding: '26px 8px 22px' }}>
        {crest ? (
          <FlagImg code={seat.country_code} logoUrl={crest} label={seat.country_name} size={112} style={{ borderRadius: 16 }} />
        ) : (
          <FlagImg
            code={seat.country_code}
            label={seat.country_name}
            size={150}
            style={{ width: 150, height: 104, filter: 'drop-shadow(0 12px 20px color-mix(in srgb, var(--gv-main) 26%, transparent))' }}
          />
        )}
        <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 28, fontWeight: 700, color: INK, margin: '16px 0 0 0', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
          {seat.country_name}
        </p>
        {partner?.name && (
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: '6px 0 0 0' }}>
            With <ProfileLink userId={partner.userId} name={partner.name}>{partner.name}</ProfileLink>
          </p>
        )}

        {/* The committee: its logo, the short name over the full one. */}
        <div className="flex items-center gap-3 min-w-0 text-left" style={{ marginTop: 20 }}>
          <CommitteeDisc src={committeeEmblemSrc(committee.logo_url, committee.name, committee.abbreviation)} size={52} />
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 20, fontWeight: 600, color: INK, lineHeight: 1.2 }}>{short}</span>
            {showFull && (
              <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, lineHeight: 1.35 }}>{committee.name}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="grid grid-cols-2 gap-3 items-stretch">
          <GuideTile committeeId={ccId} />
          {paperTile}
        </div>
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16, marginTop: 16 }}>{payments}</div>
      </div>
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
