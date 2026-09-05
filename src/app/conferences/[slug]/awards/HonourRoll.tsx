'use client';

// The honour roll body. Pure presentation of the rows the server page
// fetched: delegation awards (society honours) in their own block at the
// top, then one block per committee with its honours in the conference's
// configured award order. Matches the conference detail page's ivory look.

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import ProfileLink from '@/components/ProfileLink';
import { AwardArtwork, AwardChip, OUTFIT } from '@/app/account/accountUi';
import { formatConferenceDates } from '@/lib/conferenceDates';
import { getAwardsConfig, type ConferenceAwardRow } from '@/lib/awards';

export interface HonourRollConference {
  slug: string;
  full_name: string;
  acronym: string | null;
  logo_url: string | null;
  awards_published_at: string | null;
  awards_config: unknown;
  start_date: string | null;
  end_date: string | null;
}

export interface HonourRollCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
}

const PAGE_BG = '#EDE7D8';

export default function HonourRoll({ conference, committees, awards }: {
  conference: HonourRollConference;
  committees: HonourRollCommittee[];
  awards: ConferenceAwardRow[];
}) {
  const name = conference.acronym || conference.full_name;
  const dates = formatConferenceDates(conference.start_date, conference.end_date, { fallback: '' });

  const config = useMemo(() => getAwardsConfig(conference.awards_config), [conference.awards_config]);
  const typeOrder = useMemo(() => {
    const m = new Map<string, number>();
    config.types.forEach((t, i) => m.set(t.key, i));
    return m;
  }, [config]);

  const orderRows = (rows: ConferenceAwardRow[]) =>
    [...rows].sort((a, b) =>
      (typeOrder.get(a.award_type) ?? 999) - (typeOrder.get(b.award_type) ?? 999)
      || a.position - b.position
      || (a.country_name ?? a.recipient_name ?? '').localeCompare(b.country_name ?? b.recipient_name ?? ''));

  const delegationAwards = orderRows(awards.filter(r => !r.conference_committee_id));
  const committeeBlocks = committees
    .map(c => ({ committee: c, rows: orderRows(awards.filter(r => r.conference_committee_id === c.id)) }))
    .filter(b => b.rows.length > 0);
  const knownCommittees = new Set(committees.map(c => c.id));
  const orphans = orderRows(awards.filter(r => r.conference_committee_id && !knownCommittees.has(r.conference_committee_id)));

  const published = !!conference.awards_published_at;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: PAGE_BG }}>
      <SiteNav />

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-8 pt-8 pb-16">
        <Link
          href={`/conferences/${conference.slug}`}
          className="inline-flex items-center gap-1.5 mb-6"
          style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#6B5F52', textDecoration: 'none' }}
        >
          <ArrowLeft size={13} /> {name.toUpperCase()}
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <LogoDisc src={conference.logo_url} alt={name} size={64} fallbackText={(conference.acronym || conference.full_name).slice(0, 3)} />
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.16em', color: '#B6871F', margin: 0 }}>
              HONOUR ROLL
            </p>
            <h1 className="font-black leading-tight" style={{ fontFamily: OUTFIT, fontSize: 26, color: '#1C1410', margin: '4px 0 0 0' }}>
              {conference.full_name}
            </h1>
            {dates && (
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#9A8A78', margin: '4px 0 0 0' }}>{dates}</p>
            )}
          </div>
        </div>

        {!published ? (
          <Card>
            <div className="flex flex-col items-center text-center py-8">
              <span className="flex items-center justify-center mb-4 rounded-full" style={{ width: 52, height: 52, backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.14)' }}>
                <Trophy size={22} style={{ color: '#1B3828' }} />
              </span>
              <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, color: '#1C1410', margin: 0 }}>
                Awards for {name} have not been announced yet.
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78', margin: '6px 0 18px 0', lineHeight: 1.6 }}>
                They appear here the moment the secretariat publishes them after the closing ceremony.
              </p>
              <Link
                href={`/conferences/${conference.slug}`}
                className="rounded-xl py-2.5 px-5 focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 12, letterSpacing: '0.06em', textDecoration: 'none' }}
              >
                BACK TO THE CONFERENCE
              </Link>
            </div>
          </Card>
        ) : awards.length === 0 ? (
          <Card>
            <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: '#9A8A78', margin: 0 }}>
              The awards were announced, but no honours were recorded.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {delegationAwards.length > 0 && (
              <Card>
                <SectionLabel>DELEGATION AWARDS</SectionLabel>
                <ul className="m-0 p-0" style={{ listStyle: 'none' }}>
                  {delegationAwards.map(r => (
                    <li key={r.id} className="flex items-center gap-3 flex-wrap py-2.5" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                      <AwardChip name={r.award_label} delegation />
                      <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: '#1C1410' }}>
                        {r.recipient_name ?? 'Delegation'}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {committeeBlocks.map(({ committee, rows }) => (
              <Card key={committee.id}>
                <SectionLabel>{(committee.abbreviation || committee.name).toUpperCase()}</SectionLabel>
                {committee.abbreviation && committee.abbreviation !== committee.name && (
                  <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#9A8A78', margin: '-8px 0 12px 0' }}>{committee.name}</p>
                )}
                <ul className="m-0 p-0" style={{ listStyle: 'none' }}>
                  {rows.map(r => <HonourRow key={r.id} row={r} />)}
                </ul>
              </Card>
            ))}

            {orphans.length > 0 && (
              <Card>
                <SectionLabel>OTHER HONOURS</SectionLabel>
                <ul className="m-0 p-0" style={{ listStyle: 'none' }}>
                  {orphans.map(r => <HonourRow key={r.id} row={r} />)}
                </ul>
              </Card>
            )}

            <p className="text-center" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#9A8A78', margin: '8px 0 0 0' }}>
              Every honour on this page is a verified entry on the recipient&apos;s MUN CV.
            </p>
          </div>
        )}
      </main>

      <div className="w-full max-w-3xl mx-auto px-5 md:px-8 pb-8">
        <FooterLegal tone="ivory" showCopyright />
      </div>
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[20px] p-6 md:p-7"
      style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 1px 3px rgba(27,56,40,0.04)' }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
      {children}
    </p>
  );
}

function HonourRow({ row }: { row: ConferenceAwardRow }) {
  const country = row.country_name ?? '';
  const recipient = row.recipient_name ?? country;
  return (
    <li className="flex items-center gap-3 py-2.5" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
      <AwardArtwork name={row.award_label} size={30} />
      <div className="min-w-0 flex-1">
        <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: '#6B5F52', margin: 0 }}>
          {row.award_label.toUpperCase()}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {row.country_code && <FlagImg code={row.country_code} size={18} className="rounded-[3px]" />}
          {country && (
            <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: '#1C1410' }}>{country}</span>
          )}
          {recipient && recipient !== country && (
            <span style={{ fontFamily: OUTFIT, fontSize: 13, color: '#6B5F52' }}>
              <ProfileLink userId={row.user_id} name={recipient}>{recipient}</ProfileLink>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
