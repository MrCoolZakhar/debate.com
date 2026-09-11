'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Send, Search, Award } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import RegistrationConfirmation from '@/components/RegistrationConfirmation';
import { useAuth } from '@/components/AuthProvider';
import { supabase as anonClient } from '@/lib/supabase';
import { getAuthedClient } from '@/lib/supabase-auth';
import { activePhaseFee, type FeePhase } from '@/lib/finance';
import { themeCssVars, type ConferenceTheme } from '@/lib/theme';

const OUTFIT = "'Outfit', sans-serif";

/** The conference fields this page reads. `conferences` is readable by anyone
 *  with the link (USING (true)), so the anon client is enough. */
interface ConfRow {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  banner_url: string | null;
  logo_url: string | null;
  fee_amount: number | null;
  fee_currency: string | null;
  theme: ConferenceTheme | null;
}

const CONF_SELECT =
  'id, slug, full_name, acronym, start_date, end_date, city, country, banner_url, logo_url, fee_amount, fee_currency, theme';

interface AppRow {
  id: string;
  role: string;
  payment_status: string;
  amount_paid: number | null;
  society_id: string | null;
}

function ConfirmationInner({ conference }: { conference: ConfRow }) {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const { user, session, loading: authLoading } = useAuth();

  const rawRole = searchParams.get('role');
  const role = rawRole ?? 'delegate';
  const portalHref = rawRole ? `/conferences/${slug}/role/${rawRole}` : `/conferences/${slug}`;
  const timing = searchParams.get('timing');
  const resubmitted = searchParams.get('resubmitted') === '1';

  // The application the applicant just filed, plus its delegation. Read, never
  // written: the pass shows what the row says and nothing else. A signed-out
  // or slow read simply leaves the money row off the pass.
  const [app, setApp] = useState<AppRow | null>(null);
  const [delegation, setDelegation] = useState<string | null>(null);
  // Today's fee for THIS role, resolved the same way every public surface does
  // it (the conference_public_fees view, through activePhaseFee).
  const [roleFee, setRoleFee] = useState<{ amount: number; currency: string } | null>(null);

  useEffect(() => {
    if (authLoading || !user || !session) return;
    let cancelled = false;
    (async () => {
      const authed = getAuthedClient(session.access_token);
      const { data } = await authed
        .from('applications')
        .select('id, role, payment_status, amount_paid, society_id')
        .eq('conference_id', conference.id)
        .eq('user_id', user.id)
        .eq('role', role)
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = ((data ?? []) as AppRow[])[0] ?? null;
      setApp(row);
      if (row?.society_id) {
        const { data: soc } = await authed
          .from('societies')
          .select('name')
          .eq('id', row.society_id)
          .maybeSingle();
        if (!cancelled) setDelegation((soc as { name?: string } | null)?.name ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, session, conference.id, role]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await anonClient
        .from('conference_public_fees')
        .select('fee_amount, fee_currency, fee_phases')
        .eq('conference_id', conference.id)
        .eq('role', role)
        .maybeSingle();
      if (cancelled) return;
      const row = data as { fee_amount: number | null; fee_currency: string | null; fee_phases: FeePhase[] | null } | null;
      if (!row) {
        // No role config at all: fall back to the conference columns, which is
        // exactly the rule publicFees.ts documents.
        setRoleFee({ amount: Number(conference.fee_amount) || 0, currency: conference.fee_currency || 'USD' });
        return;
      }
      const { amount } = activePhaseFee({ fee_amount: row.fee_amount, fee_phases: row.fee_phases });
      setRoleFee({
        amount: Number(amount) || 0,
        currency: row.fee_currency || conference.fee_currency || 'USD',
      });
    })();
    return () => { cancelled = true; };
  }, [conference.id, conference.fee_amount, conference.fee_currency, role]);

  const paidAmount = Number(app?.amount_paid ?? 0);
  const paid = app?.payment_status === 'paid';
  const outstanding = Math.max(0, (roleFee?.amount ?? 0) - paidAmount);
  // Payment only becomes available after acceptance for some roles, so the
  // pass must not offer a Pay button the conference cannot honour yet.
  const payable = timing !== 'after_acceptance';

  const timeline = [
    { icon: Send, label: resubmitted ? 'Resubmitted' : 'Submitted', sub: resubmitted ? 'Your updated application is in' : 'Your application is in', state: 'done' as const },
    { icon: Search, label: 'Under review', sub: 'The team reads it over', state: 'active' as const },
    { icon: Award, label: 'Decision', sub: 'You hear back by email', state: 'todo' as const },
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ ...themeCssVars(conference.theme ?? {}), backgroundColor: 'var(--gv-bg)' } as React.CSSProperties}
    >
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />
      <SiteNav />
      <style>{`@keyframes gvRise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
        <RegistrationConfirmation
          conference={conference}
          state={paid ? 'paid' : 'due'}
          role={role}
          delegation={delegation}
          // Allocations do not exist at registration, and there is no
          // allocation-date column to promise one from.
          committee={null}
          amount={paid ? paidAmount : outstanding}
          currency={roleFee?.currency || conference.fee_currency || 'USD'}
          continueHref={portalHref}
          payHref={payable ? `/conferences/${slug}/pay` : null}
        >
          {/* What happens next: the application still has to be read. */}
          <div className="w-full mx-auto mt-12" style={{ maxWidth: 440 }}>
            <div
              className="rounded-2xl px-5 py-6"
              style={{
                backgroundColor: 'var(--gv-surface)',
                border: '1.5px solid var(--gv-border)',
                boxShadow: '0 2px 6px color-mix(in srgb, var(--gv-main) 5%, transparent), 0 16px 40px color-mix(in srgb, var(--gv-main) 8%, transparent)',
              }}
            >
              <p
                className="mb-5"
                style={{ fontFamily: OUTFIT, fontSize: '10px', fontWeight: 800, letterSpacing: '0.16em', color: 'var(--gv-accent)', textTransform: 'uppercase' }}
              >
                What happens next
              </p>
              <div className="flex items-start justify-between">
                {timeline.map((t, i) => {
                  const Icon = t.icon;
                  const done = t.state === 'done';
                  const active = t.state === 'active';
                  const discBg = done
                    ? 'linear-gradient(150deg, #16301F, var(--gv-main-mid))'
                    : active
                    ? 'radial-gradient(circle at 50% 36%, color-mix(in srgb, var(--gv-accent) 28%, transparent) 0%, color-mix(in srgb, var(--gv-surface) 0%, transparent) 74%)'
                    : 'var(--gv-bg)';
                  const discBorder = done
                    ? '1.5px solid color-mix(in srgb, var(--gv-accent) 40%, transparent)'
                    : active
                    ? '1.5px solid color-mix(in srgb, var(--gv-accent) 50%, transparent)'
                    : '1.5px solid var(--gv-border)';
                  const iconColor = done ? 'var(--gv-on-main)' : active ? 'var(--gv-accent)' : 'var(--gv-muted)';
                  return (
                    <div key={t.label} className="flex items-start flex-1" style={{ animation: 'gvRise 480ms cubic-bezier(0.2,0,0,1) both', animationDelay: `${900 + i * 60}ms` }}>
                      <div className="flex flex-col items-center flex-1 min-w-0">
                        <span
                          className="flex items-center justify-center rounded-full flex-shrink-0"
                          style={{
                            width: '44px',
                            height: '44px',
                            background: discBg,
                            border: discBorder,
                            boxShadow: active ? '0 0 0 4px color-mix(in srgb, var(--gv-accent) 18%, transparent)' : 'none',
                          }}
                        >
                          <Icon size={19} strokeWidth={2.2} style={{ color: iconColor }} />
                        </span>
                        <p
                          className="mt-2.5 text-center"
                          style={{ fontFamily: OUTFIT, fontSize: '12.5px', fontWeight: 700, color: active || done ? 'var(--gv-on-surface)' : 'var(--gv-muted)' }}
                        >
                          {t.label}
                        </p>
                        <p
                          className="mt-0.5 px-1 text-center"
                          style={{ fontFamily: OUTFIT, fontSize: '10.5px', color: 'var(--gv-muted)', lineHeight: 1.35 }}
                        >
                          {t.sub}
                        </p>
                      </div>
                      {i < timeline.length - 1 && (
                        <div
                          className="flex-shrink-0"
                          style={{
                            width: '20px',
                            height: '2px',
                            marginTop: '21px',
                            borderRadius: '2px',
                            backgroundColor: done ? 'var(--gv-main-mid)' : 'var(--gv-border)',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center">
              <Link
                href="/conferences/explore"
                className="mt-6 text-xs font-medium focus:outline-none transition-colors"
                style={{ color: 'var(--gv-muted)', textDecoration: 'none', fontFamily: OUTFIT }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--gv-on-bg)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--gv-muted)'; }}
              >
                explore more conferences
              </Link>
            </div>
          </div>
        </RegistrationConfirmation>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  const { slug } = useParams() as { slug: string };
  // Published theme only: this page is only ever reached by really
  // submitting an application, which preview mode cannot do, so there is no
  // draft-vs-published distinction to make here.
  const [conference, setConference] = useState<ConfRow | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await anonClient
          .from('conferences')
          .select(CONF_SELECT)
          .eq('slug', slug)
          .maybeSingle();
        if (cancelled) return;
        // Any error, or no row for this slug, degrades to a plain confirmation
        // rather than ever hanging on this fetch.
        if (error || !data) {
          setMissing(true);
          return;
        }
        setConference(data as unknown as ConfRow);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Conference not resolved yet: the same loading UI the page always showed,
  // in Gavelling's own colours (nothing to override yet), so there is no
  // flash of the wrong palette once the real theme arrives.
  if (!conference) {
    if (missing) {
      return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--gv-bg)' }}>
          <SiteNav />
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <h1 style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 28, color: 'var(--gv-on-bg)' }}>
              Your application is in
            </h1>
            <p className="mt-2 text-sm" style={{ fontFamily: OUTFIT, color: 'var(--gv-muted)' }}>
              We could not load this conference right now. Your submission was saved.
            </p>
            <Link
              href="/my-conferences"
              className="mt-6 focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
                backgroundColor: 'var(--gv-main)', color: 'var(--gv-on-main)',
                padding: '12px 24px', borderRadius: 12, textDecoration: 'none',
              }}
            >
              MY CONFERENCES
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gv-bg)' }}>
        <Loader size={64} label="Loading confirmation" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ ...themeCssVars(conference.theme ?? {}), backgroundColor: 'var(--gv-bg)' } as React.CSSProperties}
        >
          <Loader size={64} label="Loading confirmation" />
        </div>
      }
    >
      <ConfirmationInner conference={conference} />
    </Suspense>
  );
}
