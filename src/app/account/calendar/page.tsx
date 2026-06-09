'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByName, getFlagUrl } from '@/lib/countries';

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
  const bg    = status === 'assigned' ? 'rgba(27,56,40,0.1)' : 'rgba(61,122,82,0.1)';
  return (
    <span
      className="rounded-full px-2 py-0.5"
      style={{ backgroundColor: bg, color, fontFamily: "'DM Mono', monospace", fontSize: '9px' }}
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
        color: '#9A8A78',
        fontFamily: "'DM Mono', monospace",
        fontSize: '9px',
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

  return (
    <Link
      href={`/conferences/${conf.slug}`}
      className="block rounded-2xl p-5 mb-3 transition-colors"
      style={{
        backgroundColor: '#FAF8F3',
        border: '1px solid #DDD4C0',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
    >
      <div className="flex gap-4">
        {/* Date block */}
        <div
          className="flex-shrink-0 text-center"
          style={{ width: '56px' }}
        >
          <p
            className="font-black text-2xl leading-none"
            style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
          >
            {day}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
          >
            {month}
          </p>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', backgroundColor: '#DDD4C0', flexShrink: 0 }} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-sm"
            style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
          >
            {conf.full_name}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
          >
            {conf.acronym}
          </p>

          {(app.role || committeeName) && (
            <p
              className="text-xs mt-1"
              style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
            >
              {app.role
                ? app.role.charAt(0).toUpperCase() + app.role.slice(1)
                : ''}
              {committeeName && <> · {committeeName}</>}
            </p>
          )}

          {app.assigned_country_name && (
            <p
              className="text-xs font-semibold mt-0.5"
              style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
            >
              {app.assigned_country_name}
            </p>
          )}

          {(conf.city || conf.country) && (
            <div className="flex items-center gap-1 mt-1">
              {flagUrl && (
                <img
                  src={flagUrl}
                  alt={conf.country}
                  style={{ width: '16px', height: '11px', objectFit: 'cover', borderRadius: '1px' }}
                />
              )}
              <p
                className="text-xs"
                style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
              >
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
  const { user, session } = useAuth();
  const [applications, setApplications] = useState<CalendarApplication[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!user) return;
    if (!session) return;
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
  }, [user?.id]);

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
      <h1
        className="font-black text-2xl mb-1"
        style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
      >
        Conference Calendar
      </h1>
      <p
        className="text-sm mb-8"
        style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
      >
        Your upcoming and past conferences.
      </p>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p
            className="text-lg font-semibold mb-2"
            style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
          >
            No conferences yet
          </p>
          <p
            className="text-sm mb-6"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          >
            Apply to conferences to see them here.
          </p>
          <Link
            href="/conferences/explore"
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: '#1B3828',
              color: '#EED98A',
              textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.06em',
            }}
          >
            EXPLORE CONFERENCES →
          </Link>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section className="mb-8">
              <p
                className="text-xs tracking-widest mb-3"
                style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
              >
                UPCOMING
              </p>

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
                  <p
                    className="text-sm"
                    style={{ color: '#7A5A20', fontFamily: "'Outfit', sans-serif" }}
                  >
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
              <p
                className="text-xs tracking-widest mb-3"
                style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
              >
                PAST
              </p>
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
