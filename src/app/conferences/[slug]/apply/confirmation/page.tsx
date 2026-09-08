'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Send, Search, Award } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { supabase as anonClient } from '@/lib/supabase';
import { themeCssVars, type ConferenceTheme } from '@/lib/theme';

const OUTFIT = "'Outfit', sans-serif";

// F12: human role names with the correct article, "a delegate", "an observer".
const ROLE_WITH_ARTICLE: Record<string, string> = {
  delegate: 'a delegate',
  'head-delegate': 'a head delegate',
  'faculty-advisor': 'a faculty advisor',
  observer: 'an observer',
  chair: 'a chair',
};

function roleWithArticle(role: string): string {
  return ROLE_WITH_ARTICLE[role] ?? `a ${role.replace(/-/g, ' ')}`;
}

function ConfirmationInner({ theme }: { theme: ConferenceTheme }) {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const rawRole = searchParams.get('role');
  const role = rawRole ?? 'delegate';
  const portalHref = rawRole ? `/conferences/${slug}/role/${rawRole}` : `/conferences/${slug}`;
  const timing = searchParams.get('timing');
  const resubmitted = searchParams.get('resubmitted') === '1';
  const timingNote = timing === 'after_application'
    ? 'Payment for your registration is now available in your conference view.'
    : timing === 'after_acceptance'
    ? 'If accepted, payment will become available in your conference view.'
    : null;

  const timeline = [
    { icon: Send, label: resubmitted ? 'Resubmitted' : 'Submitted', sub: resubmitted ? 'Your updated application is in' : 'Your application is in', state: 'done' as const },
    { icon: Search, label: 'Under review', sub: 'The team reads it over', state: 'active' as const },
    { icon: Award, label: 'Decision', sub: 'You hear back by email', state: 'todo' as const },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ ...themeCssVars(theme), backgroundColor: 'var(--gv-bg)' } as React.CSSProperties}>
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
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        {/* Celebratory gradient disc with gold ring */}
        <div
          className="relative flex items-center justify-center mb-7"
          style={{ width: '104px', height: '104px', animation: 'gvRise 480ms cubic-bezier(0.2,0,0,1) both', animationDelay: '0ms' }}
        >
          {/* Gold radial glow behind the disc */}
          <div
            className="pointer-events-none absolute"
            style={{
              inset: '-24px',
              borderRadius: '9999px',
              background: 'radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--gv-accent) 35%, transparent) 0%, color-mix(in srgb, var(--gv-bg) 0%, transparent) 70%)',
            }}
          />
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: '96px',
              height: '96px',
              background: 'linear-gradient(150deg, #16301F 0%, var(--gv-main) 48%, var(--gv-main-mid) 100%)',
              border: '1.5px solid color-mix(in srgb, var(--gv-accent) 55%, transparent)',
              boxShadow: '0 12px 34px color-mix(in srgb, var(--gv-main) 30%, transparent), 0 0 0 8px color-mix(in srgb, var(--gv-accent) 12%, transparent)',
            }}
          >
            <Check size={44} strokeWidth={2.6} style={{ color: 'var(--gv-on-main)' }} />
          </div>
        </div>

        <p
          className="text-xs mb-3"
          style={{ color: 'var(--gv-accent)', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.14em', animation: 'gvRise 480ms cubic-bezier(0.2,0,0,1) both', animationDelay: '100ms' }}
        >
          {resubmitted ? 'APPLICATION RESUBMITTED' : 'APPLICATION SUBMITTED'}
        </p>
        <h1
          className="mb-2"
          style={{ color: 'var(--gv-on-bg)', fontFamily: OUTFIT, fontWeight: 900, fontSize: '32px', letterSpacing: '-0.01em', textWrap: 'balance', animation: 'gvRise 480ms cubic-bezier(0.2,0,0,1) both', animationDelay: '180ms' }}
        >
          {resubmitted ? "You're back in the queue!" : "You're in the queue!"}
        </h1>
        <p
          className={`text-sm leading-relaxed max-w-sm ${timingNote ? 'mb-3' : 'mb-9'}`}
          style={{ color: 'var(--gv-muted)', fontFamily: OUTFIT }}
        >
          {resubmitted
            ? "Your application has been resubmitted. The conference team will take another look and you'll hear back soon."
            : <>Your application as {roleWithArticle(role)} has been submitted. The conference team will review it and you&apos;ll hear back soon.</>}
        </p>
        {timingNote && (
          <p
            className="text-sm leading-relaxed mb-9 max-w-sm"
            style={{ color: 'var(--gv-muted)', fontFamily: OUTFIT }}
          >
            {timingNote}
          </p>
        )}

        {/* What happens next, mini timeline */}
        <div className="w-full mb-9" style={{ maxWidth: 440 }}>
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
                  <div key={t.label} className="flex items-start flex-1" style={{ animation: 'gvRise 480ms cubic-bezier(0.2,0,0,1) both', animationDelay: `${260 + i * 60}ms` }}>
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
                        className="mt-2.5"
                        style={{ fontFamily: OUTFIT, fontSize: '12.5px', fontWeight: 700, color: active || done ? 'var(--gv-on-surface)' : 'var(--gv-muted)' }}
                      >
                        {t.label}
                      </p>
                      <p
                        className="mt-0.5 px-1"
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
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={portalHref}
            className="rounded-xl py-3 px-6 font-bold text-sm focus:outline-none transition-colors text-center"
            style={{
              backgroundColor: 'var(--gv-main)',
              color: 'var(--gv-on-main)',
              textDecoration: 'none',
              fontFamily: OUTFIT,
              letterSpacing: '0.08em',
              boxShadow: '0 6px 18px color-mix(in srgb, var(--gv-main) 22%, transparent)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--gv-main-mid)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--gv-main)'; }}
          >
            CONFERENCE PORTAL →
          </Link>
          <Link
            href={`/conferences/${slug}/pay`}
            className="rounded-xl py-3 px-6 font-bold text-sm focus:outline-none transition-colors text-center"
            style={{
              border: '1.5px solid #C8BEA8',
              color: 'var(--gv-on-bg)',
              textDecoration: 'none',
              fontFamily: OUTFIT,
              letterSpacing: '0.08em',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--gv-main) 4%, transparent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            PAYMENT PORTAL
          </Link>
        </div>

        <Link
          href="/conferences/explore"
          className="mt-5 text-xs font-medium focus:outline-none transition-colors"
          style={{
            color: 'var(--gv-muted)',
            textDecoration: 'none',
            fontFamily: OUTFIT,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--gv-on-bg)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--gv-muted)'; }}
        >
          explore more conferences
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  const { slug } = useParams() as { slug: string };
  // Published theme only: this page is only ever reached by really
  // submitting an application, which preview mode cannot do, so there is no
  // draft-vs-published distinction to make here.
  const [theme, setTheme] = useState<ConferenceTheme | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await anonClient
          .from('conferences')
          .select('theme')
          .eq('slug', slug)
          .maybeSingle();
        if (cancelled) return;
        // Any error, or no row for this slug, degrades to Gavelling's own
        // palette rather than ever hanging on this fetch.
        if (error || !data) {
          setTheme({});
          return;
        }
        setTheme((data as { theme: ConferenceTheme | null }).theme ?? {});
      } catch {
        if (!cancelled) setTheme({});
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Theme not resolved yet: the same loading UI the page always showed,
  // in Gavelling's own colours (nothing to override yet), so there is no
  // flash of the wrong palette once the real theme arrives.
  if (theme === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gv-bg)' }}>
        <Loader size={64} label="Loading confirmation" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ ...themeCssVars(theme), backgroundColor: 'var(--gv-bg)' } as React.CSSProperties}>
          <Loader size={64} label="Loading confirmation" />
        </div>
      }
    >
      <ConfirmationInner theme={theme} />
    </Suspense>
  );
}
