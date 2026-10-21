'use client';

// The delegation Overview's other cards (owner, 21 Oct 2026):
//   DelegationCard   right column, "Your Delegation", EXACTLY the size of
//                    "Your Seat" beside it (both h-full in a stretched grid) and
//                    compact enough that both fit one screen at 1280x800:
//                    the crest and the name big, the city and country with its
//                    round flag; the leaders "floating" in one line under the
//                    name like a committee's chairs (small avatars + names,
//                    faculty advisors first, each avatar opening the person's
//                    public MUN CV when their account is readable); the counts
//                    on one line; for a leader the position papers (N of M) and
//                    their payments (paid, tickets, left to pay: the Financials
//                    card's numbers from my_pay_overview); for everyone "Coming
//                    up", at most the next three dates, one line each
//   CommitteesBrief  an advisor's left column (they hold no seat): the
//                    committees their delegation sits in, logo + name + people
// White lifted cards, fine-line icons, country = flag, committee = logo,
// person = avatar + name, names wrap and are never cut.

import { ArrowRight, CalendarDays, CreditCard, FileText, Landmark } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import DelegationCrest from '@/components/DelegationCrest';
import { getCountryByCode } from '@/lib/countries';
import { BTN_CLASS, cardStyle, CommitteeDisc, committeeEmblemSrc, CvAvatar, FONT, INK, INK_SOFT, LINE, OK_GREEN, OWE, roleRank, secondaryBtn, STROKE } from '../leaderKit';
import { ROLE_WORD } from '../member/memberKit';
import type { DelegationOverviewData } from './useDelegationOverview';
import { plural, shortOf, type CommitteeBrief, type DeadlineRow, type Person } from './overviewRecap';
import { DAY, MONTHS, rangeWords, relativeWords } from './overviewDates';
import { CardTitle, OVERVIEW_CARD } from './SeatCard';
import { money, type PayOverview } from '../../../pay/payApi';
import { itemsCurrency } from '../../../pay/BalanceHeader';
import { tally } from '../FinancialsCard';

const YOU: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', marginLeft: 5 };

function Count({ n, word }: { n: number; word: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" style={{ fontFamily: FONT }}>
      <span style={{ fontSize: 22, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{n}</span>
      <span style={{ fontSize: 14, color: INK_SOFT }}>{word}</span>
    </span>
  );
}

/** The leaders in one line, like a committee's chairs: small avatar + name. */
function LeadersInline({ leaders }: { leaders: Person[] }) {
  const sorted = [...leaders].sort((a, b) => roleRank(a.role) - roleRank(b.role));
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Your leaders">
      {sorted.map(p => (
        <li key={p.application_id} className="inline-flex items-center gap-2 min-w-0" title={ROLE_WORD[p.role as keyof typeof ROLE_WORD] ?? undefined}>
          <CvAvatar userId={p.user_id} name={p.name} url={p.avatar_url} size={28} seed={p.application_id} />
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.25 }}>
            {p.name}{p.is_me && <span style={YOU}>You</span>}
            <span className="sr-only">, {ROLE_WORD[p.role as keyof typeof ROLE_WORD] ?? 'Leader'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DelegationCard({ societyId, data, leaders, delegateCount, committeeCount, papers, pay, deadlines, datesTbd, today, onOpen }: {
  societyId: string;
  data: DelegationOverviewData;
  leaders: Person[];
  delegateCount: number;
  /** Leaders only: the committees the delegation sits in. */
  committeeCount: number | null;
  /** Leaders only: position papers submitted of those due; null for a member. */
  papers: { in: number; of: number; known: boolean } | null;
  /** Leaders only: their own payments (my_pay_overview); null otherwise or before the read. */
  pay: PayOverview | null;
  deadlines: DeadlineRow[];
  datesTbd: boolean;
  today: number;
  onOpen: () => void;
}) {
  const home = data.society;
  const name = data.societyName ?? home?.name ?? 'Your delegation';
  const country = home?.country_code ? getCountryByCode(home.country_code)?.name ?? null : null;
  const place = [home?.city?.trim() || null, country].filter(Boolean).join(', ');
  return (
    <section aria-label="Your delegation" className={OVERVIEW_CARD} style={cardStyle}>
      <CardTitle>Your Delegation</CardTitle>
      <div className="flex items-center gap-4 min-w-0">
        <span style={{ borderRadius: '50%', boxShadow: '0 6px 18px color-mix(in srgb, var(--gv-main) 10%, transparent)', flexShrink: 0, background: '#FFFFFF' }}>
          <DelegationCrest name={name} logoUrl={home?.logo_url ?? null} size={64} />
        </span>
        <div className="min-w-0 flex flex-col gap-1">
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 28, fontWeight: 700, color: INK, lineHeight: 1.12, letterSpacing: '-0.01em' }}>{name}</span>
          {place && (
            <span className="flex items-center gap-2 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
              {home?.country_code && <CircleFlag code={home.country_code} size={18} decorative />}
              {place}
            </span>
          )}
        </div>
      </div>

      {leaders.length > 0 && <LeadersInline leaders={leaders} />}

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <Count n={delegateCount} word={plural(delegateCount, 'delegate', 'delegates')} />
        {committeeCount !== null && <Count n={committeeCount} word={plural(committeeCount, 'committee', 'committees')} />}
      </div>

      {papers && <PapersLine papersIn={papers.in} papersOf={papers.of} known={papers.known} />}
      {pay && <MoneyLines pay={pay} societyId={societyId} />}
      <ComingUp rows={deadlines} datesTbd={datesTbd} today={today} />

      <div className="mt-auto">
        <button type="button" onClick={onOpen} className={BTN_CLASS} style={secondaryBtn}>
          Open delegation <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>
    </section>
  );
}

const blockStyle: React.CSSProperties = { borderTop: `1px solid ${LINE}`, paddingTop: 12 };
const blockLabel: React.CSSProperties = { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK_SOFT };

/** Leaders: position papers submitted, N of M people with an allocation. */
function PapersLine({ papersIn, papersOf, known }: { papersIn: number; papersOf: number; known: boolean }) {
  const pct = papersOf > 0 ? Math.round((papersIn / papersOf) * 100) : 0;
  return (
    <div className="flex flex-col gap-2" style={blockStyle}>
      <div className="flex items-center gap-3 min-w-0">
        <FileText size={20} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
        <span className="inline-flex items-baseline gap-1.5 flex-wrap" style={{ fontFamily: FONT }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{known ? papersIn : '–'}</span>
          {papersOf > 0 && <span style={{ fontSize: 15, fontWeight: 500, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>of {papersOf}</span>}
          <span style={{ fontSize: 14, color: INK_SOFT }}>{plural(papersOf, 'position paper submitted', 'position papers submitted')}</span>
        </span>
      </div>
      {known && papersOf > 0 && (
        <div aria-hidden style={{ height: 6, borderRadius: 999, background: '#F1ECE1', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: pct === 100 ? OK_GREEN : 'var(--gv-main)' }} />
        </div>
      )}
    </div>
  );
}

/** Leaders: what they paid and what is left, the Financials card's own numbers. */
function MoneyLines({ pay, societyId }: { pay: PayOverview; societyId: string }) {
  const cur = itemsCurrency(pay) ?? pay.conference.currency;
  const delegate = tally(pay.items, 'delegate');
  const advisor = tally(pay.items, 'advisor');
  const owed = pay.totals.owed_cents;
  // As the Financials card: "Your" when another leader holds tickets too.
  const mine = pay.delegation?.find(d => d.society_id === societyId) ?? null;
  const your = mine?.leaders.some(l => !l.is_me && (l.delegate_tickets > 0 || l.advisor_tickets > 0)) ? 'Your ' : '';
  const tickets = [
    delegate.total > 0 ? `${delegate.done} of ${delegate.total} ${your}Delegate Tickets paid` : null,
    advisor.total > 0 ? `${advisor.done} of ${advisor.total} ${your}Advisor Tickets paid` : null,
  ].filter(Boolean) as string[];
  return (
    <div className="flex flex-col gap-1" style={blockStyle}>
      <div className="flex items-center justify-between gap-3 flex-wrap min-w-0">
        <span className="inline-flex items-center gap-3 min-w-0">
          <CreditCard size={20} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
          <span className="inline-flex items-baseline gap-1.5 flex-wrap" style={{ fontFamily: FONT }}>
            <span style={{ fontSize: 20, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {money(pay.totals.paid_cents_in_currency ?? pay.totals.paid_cents, cur)}
            </span>
            <span style={{ fontSize: 14, color: INK_SOFT }}>paid</span>
          </span>
        </span>
        <span style={{ fontFamily: FONT, fontSize: 14, color: owed > 0 ? OWE : INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
          <b style={{ fontWeight: 600 }}>{money(owed, cur)}</b> left to pay
        </span>
      </div>
      {tickets.map(t => (
        <span key={t} className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, paddingLeft: 32 }}>{t}</span>
      ))}
    </div>
  );
}

const COMING_CAP = 3;

/** At most the next three dates, one compact line each: the date, what, when. */
function ComingUp({ rows, datesTbd, today }: { rows: DeadlineRow[]; datesTbd: boolean; today: number }) {
  const shown = rows.slice(0, COMING_CAP);
  return (
    <div className="flex flex-col gap-1.5" style={blockStyle}>
      <span className="inline-flex items-center gap-2" style={blockLabel}>
        <CalendarDays size={16} strokeWidth={STROKE} aria-hidden style={{ color: INK }} />
        Coming up
      </span>
      {shown.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: 0, lineHeight: 1.45 }}>
          {datesTbd ? 'The conference dates are to be decided.' : 'Nothing due right now.'}
        </p>
      ) : (
        <ol className="flex flex-col gap-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map(r => {
            const d = new Date(r.day);
            const named = r.committees.length === 1 ? shortOf(r.committees[0]) : r.committees.length > 1 ? `${r.committees.length} committees` : null;
            return (
              <li key={r.key} className="flex items-baseline gap-3 min-w-0" style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.35 }}>
                <span className="flex-none" style={{ width: 52, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                  {d.getDate()} {MONTHS[d.getMonth()]}
                </span>
                <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ color: INK }}>
                  {r.what}
                  {r.kind === 'conference' && <span style={{ color: INK_SOFT }}>{` · ${rangeWords(r.day, r.endDay ?? null)}`}</span>}
                  {named && <span style={{ color: INK_SOFT }}>{` · ${named}`}</span>}
                </span>
                <span className="flex-none text-right" style={{ fontSize: 13, fontWeight: 600, color: r.day - today <= 7 * DAY ? OWE : INK_SOFT }}>
                  {relativeWords(r.day, today)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const BRIEF_CAP = 6;

/** An advisor holds no seat: their delegation's committees, briefly. */
export function CommitteesBrief({ briefs, onOpen }: { briefs: CommitteeBrief[]; onOpen: () => void }) {
  const shown = briefs.slice(0, BRIEF_CAP);
  const more = briefs.length - shown.length;
  return (
    <section aria-label="Your committees" className={OVERVIEW_CARD} style={cardStyle}>
      <CardTitle>Your Committees</CardTitle>
      {briefs.length === 0 ? (
        <p className="inline-flex items-start gap-2.5" style={{ fontFamily: FONT, fontSize: 14.5, color: INK_SOFT, margin: 0, lineHeight: 1.5 }}>
          <Landmark size={20} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
          Your delegation&apos;s committees appear here once the organisers give allocations.
        </p>
      ) : (
        <div className="flex flex-col">
          {shown.map((b, i) => {
            const short = shortOf(b.committee);
            const full = b.committee.name.trim() !== short.trim() ? b.committee.name : null;
            return (
              <div key={b.committee.id} className="flex items-center gap-3 min-w-0" style={{ padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${LINE}` }}>
                <CommitteeDisc src={committeeEmblemSrc(b.committee.logo_url, b.committee.name, b.committee.abbreviation)} size={40} />
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{short}</span>
                  {full && <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT, lineHeight: 1.35 }}>{full}</span>}
                </div>
                <span className="flex-none text-right" style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{b.people}</span> {plural(b.people, 'delegate', 'delegates')}
                  {b.open > 0 && <><br />{b.open} open</>}
                </span>
              </div>
            );
          })}
          {more > 0 && <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: '6px 0 0 0' }}>and {more} more</p>}
        </div>
      )}
      <div className="mt-auto">
        <button type="button" onClick={onOpen} className={BTN_CLASS} style={secondaryBtn}>
          See committees <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>
    </section>
  );
}
