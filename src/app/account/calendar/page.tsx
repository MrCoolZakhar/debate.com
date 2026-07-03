'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { Eyebrow, GlassCard, OUTFIT, MONO } from '../accountUi';

interface CalendarConference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  start_date: string;
  end_date: string;
  city: string;
  country: string;
  format: string;
  logo_url: string | null;
}

interface CalendarApplication {
  id: string;
  role: string;
  status: string;
  assigned_country_name: string | null;
  assigned_committee_id: string | null;
  conferences: CalendarConference | null;
  conference_committees: { name: string } | null;
}

function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const a1 = new Date(startA).getTime();
  const a2 = new Date(endA).getTime();
  const b1 = new Date(startB).getTime();
  const b2 = new Date(endB).getTime();
  return a1 <= b2 && b1 <= a2;
}

function StatusBadge({ status }: { status: string }) {
  const label = status === 'assigned' ? 'ASSIGNED' : 'ACCEPTED';
  const color = status === 'assigned' ? '#1B3828' : '#3D7A52';
  const bg    = status === 'assigned' ? 'rgba(27,56,40,0.09)' : 'rgba(61,122,82,0.1)';
  const bd    = status === 'assigned' ? 'rgba(27,56,40,0.28)' : 'rgba(61,122,82,0.3)';
  return (
    <span
      className="rounded-full px-2 py-0.5"
      style={{ backgroundColor: bg, border: `1px solid ${bd}`, color, fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.08em' }}
    >
      {label}
    </span>
  );
}

function FormatPill({ format }: { format: string }) {
  const label = format
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('-');
  return (
    <span
      className="rounded-full px-2 py-0.5 mt-1"
      style={{
        backgroundColor: 'rgba(154,138,120,0.1)',
        border: '1px solid rgba(154,138,120,0.25)',
        color: '#9A8A78',
        fontFamily: MONO,
        fontSize: '8.5px',
        letterSpacing: '0.06em',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  );
}

function ConferenceCard({ app }: { app: CalendarApplication }) {
  const conf = app.conferences;
  if (!conf) return null;

  const startDate = new Date(conf.start_date);
  const day   = startDate.getDate();
  const month = startDate.toLocaleDateString('en', { month: 'short' }).toUpperCase();

  const countryData = getCountryByName(conf.country);
  const flagUrl     = countryData ? getFlagUrl(countryData.code) : null;
  const committeeName = (app.conference_committees as { name: string } | null)?.name;
  const allocCountry = app.assigned_country_name ? getCountryByName(app.assigned_country_name) : null;
  const allocFlag = allocCountry ? getFlagUrl(allocCountry.code) : null;

  return (
    <Link
      href={`/conferences/${conf.slug}`}
      className="block rounded-[20px] p-5 mb-3 transition-all"
      style={{
        backgroundColor: 'rgba(250,248,243,0.82)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        border: '1px solid rgba(221,212,192,0.9)',
        boxShadow: '0 1px 3px rgba(27,56,40,0.05), 0 12px 32px rgba(27,56,40,0.06)',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(27,56,40,0.45)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(27,56,40,0.08), 0 16px 40px rgba(27,56,40,0.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(221,212,192,0.9)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(27,56,40,0.05), 0 12px 32px rgba(27,56,40,0.06)';
      }}
    >
      <div className="flex gap-4">
        {/* Date block */}
        <div className="flex-shrink-0 text-center" style={{ width: '56px' }}>
          <p
            className="font-black text-2xl leading-none"
            style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}
          >
            {day}
          </p>
          <p className="text-xs mt-1" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.14em', margin: '4px 0 0 0' }}>
            {month}
          </p>
          {conf.logo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={conf.logo_url}
              alt=""
              className="mx-auto mt-2"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', backgroundColor: 'rgba(221,212,192,0.8)', flexShrink: 0 }} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
            {conf.full_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: MONO, margin: '2px 0 0 0' }}>
            {conf.acronym}
          </p>

          {(app.role || committeeName) && (
            <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: '6px 0 0 0' }}>
              {app.role
                ? app.role.charAt(0).toUpperCase() + app.role.slice(1)
                : ''}
              {committeeName && <> · {committeeName}</>}
            </p>
          )}

          {app.assigned_country_name && (
            <p className="text-xs font-semibold mt-1 flex items-center gap-1.5" style={{ color: '#1B3828', fontFamily: OUTFIT, margin: '4px 0 0 0' }}>
              {allocFlag && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={allocFlag}
                  alt=""
                  style={{ width: '16px', height: '11px', objectFit: 'cover', borderRadius: '2px' }}
                />
              )}
              {app.assigned_country_name}
            </p>
          )}

          {(conf.city || conf.country) && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {flagUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={flagUrl}
                  alt={conf.country}
                  style={{ width: '16px', height: '11px', objectFit: 'cover', borderRadius: '2px' }}
                />
              )}
              <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: 0 }}>
                {[conf.city, conf.country].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Right: badges */}
        <div className="flex-shrink-0 flex flex-col items-end justify-start gap-1">
          <StatusBadge status={app.status} />
          <FormatPill format={conf.format} />
        </div>
      </div>
    </Link>
  );
}

export default function CalendarPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<CalendarApplication[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);

    supabase
      .from('applications')
      .select(`
        id, role, status, assigned_country_name, assigned_committee_id,
        conferences (
          id, slug, full_name, acronym, start_date, end_date,
          city, country, format, logo_url
        ),
        conference_committees (name)
      `)
      .eq('user_id', user.id)
      .in('status', ['accepted', 'assigned'])
      .then(({ data }) => {
        const sorted = ((data as unknown as CalendarApplication[]) ?? []).sort((a, b) => {
          const aDate = new Date(a.conferences?.start_date ?? '').getTime();
          const bDate = new Date(b.conferences?.start_date ?? '').getTime();
          return aDate - bDate;
        });
        setApplications(sorted);
        setLoading(false);
      });
  }, [authLoading, user?.id, session?.access_token]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = applications.filter((a) => {
    const end = a.conferences?.end_date;
    return end ? new Date(end) >= today : false;
  });

  const past = applications.filter((a) => {
    const end = a.conferences?.end_date;
    return end ? new Date(end) < today : false;
  });

  // Overlap detection
  let overlapPair: [string, string] | null = null;
  outer: for (let i = 0; i < upcoming.length; i++) {
    for (let j = i + 1; j < upcoming.length; j++) {
      const confA = upcoming[i].conferences;
      const confB = upcoming[j].conferences;
      if (
        confA && confB &&
        datesOverlap(confA.start_date, confA.end_date, confB.start_date, confB.end_date)
      ) {
        overlapPair = [confA.full_name, confB.full_name];
        break outer;
      }
    }
  }

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
      <Eyebrow className="mb-2">Where You&apos;re Headed</Eyebrow>
      <h1
        className="font-black text-[26px] mb-1"
        style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
      >
        Conference Calendar
      </h1>
      <p className="text-sm mb-8" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Your upcoming and past conferences.
      </p>

      {applications.length === 0 ? (
        <GlassCard className="text-center !py-14">
          <p className="text-lg font-bold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            No conferences yet
          </p>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Apply to conferences to see them here.
          </p>
          <Link
            href="/conferences/explore"
            className="inline-block rounded-xl py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
            style={{
              backgroundColor: '#1B3828',
              color: '#EED98A',
              textDecoration: 'none',
              fontFamily: OUTFIT,
              letterSpacing: '0.08em',
            }}
          >
            EXPLORE CONFERENCES →
          </Link>
        </GlassCard>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section className="mb-10">
              <Eyebrow className="mb-4">Upcoming</Eyebrow>

              {/* Overlap warning */}
              {overlapPair && (
                <div
                  className="flex items-start gap-2 rounded-xl px-4 py-3 mb-4"
                  style={{
                    backgroundColor: 'rgba(184,132,74,0.1)',
                    border: '1px solid rgba(184,132,74,0.3)',
                  }}
                >
                  <AlertTriangle size={16} style={{ color: '#B8844A', flexShrink: 0, marginTop: '1px' }} />
                  <p className="text-sm" style={{ color: '#7A5A20', fontFamily: OUTFIT, margin: 0 }}>
                    You have overlapping conferences.{' '}
                    <strong>{overlapPair[0]}</strong> and{' '}
                    <strong>{overlapPair[1]}</strong> overlap — you may not be able to attend both.
                  </p>
                </div>
              )}

              {upcoming.map((app) => (
                <ConferenceCard key={app.id} app={app} />
              ))}
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <Eyebrow className="mb-4" color="#9A8A78">Past</Eyebrow>
              {past.map((app) => (
                <ConferenceCard key={app.id} app={app} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
