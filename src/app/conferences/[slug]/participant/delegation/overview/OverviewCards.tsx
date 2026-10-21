'use client';

// The delegation Overview's other cards (owner, 21 Oct 2026):
//   DelegationCard   right column, "Your Delegation": the crest, the name, the
//                    city and country with its round flag, the leaders with
//                    their photos, two counts at most
//   CommitteesBrief  an advisor's left column (they hold no seat): the
//                    committees their delegation sits in, logo + name + people
//   PapersTile       leaders: position papers submitted N of M, who is still
//                    to hand one in
//   DeadlinesCard    every date ahead in order, with relative words, never
//                    folded away
// White lifted cards, fine-line icons, country = flag, committee = logo,
// person = avatar + name, names wrap and are never cut.

import { ArrowRight, CalendarDays, FileText, Landmark } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import DelegationCrest from '@/components/DelegationCrest';
import { getCountryByCode } from '@/lib/countries';
import { BTN_CLASS, cardStyle, CommitteeDisc, committeeEmblemSrc, FONT, INK, INK_SOFT, LINE, OK_GREEN, OWE, RoundAvatar, secondaryBtn, STROKE } from '../leaderKit';
import { ROLE_WORD } from '../member/memberKit';
import type { DelegationOverviewData } from './useDelegationOverview';
import { plural, shortOf, type CommitteeBrief, type DeadlineRow, type Person } from './overviewRecap';
import { DAY, MONTHS, rangeWords, relativeWords } from './overviewDates';
import { CardTitle } from './SeatCard';

const YOU: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', marginLeft: 6 };

function Count({ n, word }: { n: number; word: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" style={{ fontFamily: FONT }}>
      <span style={{ fontSize: 24, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{n}</span>
      <span style={{ fontSize: 14, color: INK_SOFT }}>{word}</span>
    </span>
  );
}

export function DelegationCard({ data, leaders, delegateCount, committeeCount, onOpen }: {
  data: DelegationOverviewData;
  leaders: Person[];
  delegateCount: number;
  /** Leaders only: the committees the delegation sits in. */
  committeeCount: number | null;
  onOpen: () => void;
}) {
  const home = data.society;
  const name = data.societyName ?? home?.name ?? 'Your delegation';
  const country = home?.country_code ? getCountryByCode(home.country_code)?.name ?? null : null;
  const place = [home?.city?.trim() || null, country].filter(Boolean).join(', ');
  return (
    <section aria-label="Your delegation" className="flex flex-col gap-5" style={{ ...cardStyle, padding: '22px 24px' }}>
      <CardTitle>Your Delegation</CardTitle>
      <div className="flex items-center gap-4 min-w-0">
        <span style={{ borderRadius: '50%', boxShadow: '0 6px 18px color-mix(in srgb, var(--gv-main) 10%, transparent)', flexShrink: 0, background: '#FFFFFF' }}>
          <DelegationCrest name={name} logoUrl={home?.logo_url ?? null} size={64} />
        </span>
        <div className="min-w-0 flex flex-col gap-1">
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{name}</span>
          {place && (
            <span className="flex items-center gap-2 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
              {home?.country_code && <CircleFlag code={home.country_code} size={18} decorative />}
              {place}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-7 gap-y-2">
        <Count n={delegateCount} word={plural(delegateCount, 'delegate', 'delegates')} />
        {committeeCount !== null && <Count n={committeeCount} word={plural(committeeCount, 'committee', 'committees')} />}
      </div>

      {leaders.length > 0 && (
        <div className="flex flex-col gap-2.5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK_SOFT }}>{plural(leaders.length, 'Leader', 'Leaders')}</span>
          {leaders.map(p => (
            <div key={p.application_id} className="flex items-center gap-3 min-w-0">
              <RoundAvatar name={p.name} url={p.avatar_url} size={40} seed={p.application_id} />
              <div className="min-w-0 flex flex-col">
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                  {p.name}{p.is_me && <span style={YOU}>You</span>}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{ROLE_WORD[p.role as keyof typeof ROLE_WORD] ?? 'Member'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <button type="button" onClick={onOpen} className={BTN_CLASS} style={secondaryBtn}>
          Open delegation <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>
    </section>
  );
}

const BRIEF_CAP = 6;

/** An advisor holds no seat: their delegation's committees, briefly. */
export function CommitteesBrief({ briefs, onOpen }: { briefs: CommitteeBrief[]; onOpen: () => void }) {
  const shown = briefs.slice(0, BRIEF_CAP);
  const more = briefs.length - shown.length;
  return (
    <section aria-label="Your committees" className="flex flex-col gap-4" style={{ ...cardStyle, padding: '22px 24px' }}>
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
      <div>
        <button type="button" onClick={onOpen} className={BTN_CLASS} style={secondaryBtn}>
          See committees <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>
    </section>
  );
}

const MISSING_CAP = 6;

/** Leaders: position papers submitted, N of M people with an allocation. */
export function PapersTile({ papersIn, papersOf, known, missing, onOpen }: {
  papersIn: number;
  papersOf: number;
  known: boolean;
  missing: Person[];
  onOpen: () => void;
}) {
  const pct = papersOf > 0 ? Math.round((papersIn / papersOf) * 100) : 0;
  const shown = missing.slice(0, MISSING_CAP);
  const more = missing.length - shown.length;
  return (
    <section aria-label="Position papers" className="@container flex flex-col gap-4" style={{ ...cardStyle, padding: '20px 24px' }}>
      <div className="flex items-center gap-x-6 gap-y-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <FileText size={24} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
          <span className="inline-flex items-baseline gap-2 flex-wrap" style={{ fontFamily: FONT }}>
            <span style={{ fontSize: 30, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{known ? papersIn : '–'}</span>
            {papersOf > 0 && <span style={{ fontSize: 17, fontWeight: 500, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>of {papersOf}</span>}
            <span style={{ fontSize: 15, color: INK_SOFT }}>{plural(papersOf, 'position paper submitted', 'position papers submitted')}</span>
          </span>
        </div>
        {known && papersOf > 0 && (
          <div aria-hidden className="flex-1" style={{ minWidth: 160, height: 8, borderRadius: 999, background: '#F1ECE1', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: pct === 100 ? OK_GREEN : 'var(--gv-main)' }} />
          </div>
        )}
        <button type="button" onClick={onOpen} className={BTN_CLASS} style={secondaryBtn}>
          Open delegation <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>
      {known && papersOf === 0 && (
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>Papers count once your people have allocations in committees that take them.</p>
      )}
      {known && shown.length > 0 && (
        <div className="flex items-center flex-wrap gap-x-5 gap-y-2.5">
          <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: INK_SOFT }}>Still to hand in</span>
          {shown.map(p => (
            <span key={p.application_id} className="inline-flex items-center gap-2 min-w-0">
              <RoundAvatar name={p.name} url={p.avatar_url} size={30} seed={p.application_id} />
              <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK }}>
                {p.name}{p.is_me && <span style={YOU}>You</span>}
              </span>
            </span>
          ))}
          {more > 0 && <span style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT }}>and {more} more</span>}
        </div>
      )}
    </section>
  );
}

const DEADLINE_CAP = 8;
const NAMED_CAP = 3;

/** Every date ahead, in order, each with its relative words (owner, 21 Oct
 *  2026: deadlines easy to see, not hidden). */
export function DeadlinesCard({ rows, datesTbd, today }: { rows: DeadlineRow[]; datesTbd: boolean; today: number }) {
  const shown = rows.slice(0, DEADLINE_CAP);
  const more = rows.length - shown.length;
  return (
    <section aria-label="Deadlines" className="flex flex-col gap-3" style={{ ...cardStyle, padding: '20px 24px' }}>
      <h2 className="inline-flex items-center gap-2.5" style={{ fontFamily: FONT, fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>
        <CalendarDays size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
        Deadlines
      </h2>
      {shown.length === 0 && (
        <p style={{ fontFamily: FONT, fontSize: 14.5, color: INK_SOFT, margin: 0 }}>
          {datesTbd ? 'The conference dates are to be decided. Deadlines appear here once they are set.' : 'Nothing due right now. New deadlines appear here.'}
        </p>
      )}
      {shown.length > 0 && (
        <ol className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((r, i) => {
            const d = new Date(r.day);
            const named = r.committees.slice(0, NAMED_CAP);
            const extra = r.committees.length - named.length;
            return (
              <li key={r.key} className="flex items-center gap-4 min-w-0" style={{ padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${LINE}` }}>
                <span className="flex flex-col items-center justify-center flex-none" style={{ width: 56, height: 56, borderRadius: 14, background: '#F6F2EA' }}>
                  <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: INK, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{d.getDate()}</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: INK_SOFT, marginTop: 3 }}>{MONTHS[d.getMonth()]}</span>
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15.5, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                    {r.what}
                    {r.kind === 'conference' && <span style={{ fontWeight: 400, color: INK_SOFT }}>{` · ${rangeWords(r.day, r.endDay ?? null)}`}</span>}
                  </span>
                  {named.length > 0 && (
                    <span className="flex items-center flex-wrap gap-x-3 gap-y-1">
                      {named.map(c => (
                        <span key={c.id} className="inline-flex items-center gap-1.5 min-w-0">
                          <CommitteeDisc src={committeeEmblemSrc(c.logo_url, c.name, c.abbreviation)} size={20} />
                          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT }}>{shortOf(c)}</span>
                        </span>
                      ))}
                      {extra > 0 && <span style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT }}>and {extra} more</span>}
                    </span>
                  )}
                </div>
                <span className="flex-none text-right" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: r.day - today <= 7 * DAY ? OWE : INK_SOFT }}>
                  {relativeWords(r.day, today)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {more > 0 && <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: 0 }}>and {more} more {plural(more, 'date', 'dates')} after these</p>}
      {datesTbd && shown.length > 0 && (
        <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: 0 }}>The conference dates are to be decided.</p>
      )}
    </section>
  );
}
