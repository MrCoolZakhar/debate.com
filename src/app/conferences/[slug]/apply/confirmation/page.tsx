'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';

function ConfirmationInner() {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const role = searchParams.get('role') ?? 'delegate';
  const timing = searchParams.get('timing');
  const timingNote = timing === 'after_application'
    ? 'Payment for your registration is now available in your conference view.'
    : timing === 'after_acceptance'
    ? 'If accepted, payment will become available in your conference view.'
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
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
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(27,56,40,0.1)', border: '2px solid rgba(27,56,40,0.2)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p
          className="text-xs tracking-[0.2em] mb-3"
          style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
        >
          APPLICATION SUBMITTED
        </p>
        <h1
          className="font-black text-2xl mb-2"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          You&apos;re in the queue!
        </h1>
        <p
          className={`text-sm leading-relaxed max-w-sm ${timingNote ? 'mb-3' : 'mb-8'}`}
          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
        >
          Your application as {role.replace(/-/g, ' ')} has been submitted. The conference team will review it and you&apos;ll hear back soon.
        </p>
        {timingNote && (
          <p
            className="text-sm leading-relaxed mb-8 max-w-sm"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          >
            {timingNote}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/conferences/${slug}`}
            className="rounded-xl py-3 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: '#1B3828',
              color: '#EED98A',
              textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.08em',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            VIEW CONFERENCE →
          </Link>
          <Link
            href="/conferences/explore"
            className="rounded-xl py-3 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{
              border: '1px solid #DDD4C0',
              color: '#1C1410',
              textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.08em',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            EXPLORE MORE
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <ConfirmationInner />
    </Suspense>
  );
}
