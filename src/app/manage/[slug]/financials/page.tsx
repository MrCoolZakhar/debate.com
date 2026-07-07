'use client';
import { Wallet, TrendingUp, Clock, Landmark, Sparkles } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { Pill } from '@/app/account/accountUi';

const OUTFIT = "'Outfit', sans-serif";

// Ghosted "future stat" medallion — reads as a designed preview, not an empty box.
function GhostStat({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div
      className="relative flex flex-col items-center text-center rounded-2xl px-4 py-6 overflow-hidden"
      style={{
        backgroundColor: 'rgba(250,248,243,0.55)',
        border: '1.5px solid #D8CDB6',
        boxShadow: '0 1px 3px rgba(27,56,40,0.05)',
      }}
    >
      {/* Ghosted content */}
      <div style={{ filter: 'blur(1.5px)', opacity: 0.55 }} className="flex flex-col items-center">
        <span
          className="flex items-center justify-center rounded-full mb-3"
          style={{
            width: '54px',
            height: '54px',
            background: 'radial-gradient(circle at 50% 36%, rgba(238,217,138,0.28) 0%, rgba(250,248,243,0) 74%)',
            border: '1.5px solid rgba(182,135,31,0.4)',
            boxShadow: '0 0 0 6px rgba(238,217,138,0.1)',
          }}
        >
          <span style={{ color: '#B6871F' }}>{icon}</span>
        </span>
        <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: '26px', color: '#1C1410', lineHeight: 1 }}>
          ——
        </span>
      </div>
      <p
        className="mt-3"
        style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '12px', color: '#6E5F4E', letterSpacing: '0.02em' }}
      >
        {label}
      </p>
      <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: '11px', color: '#9A8A78', lineHeight: 1.4 }}>
        {hint}
      </p>
    </div>
  );
}

export default function FinancialsPage() {
  const { conference } = useManage();

  return (
    <div className="px-6 md:px-10 py-8">
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Eyebrow */}
        <p
          className="mb-4"
          style={{ fontFamily: OUTFIT, fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#B6871F', textTransform: 'uppercase' }}
        >
          {conference?.acronym ?? 'Conference'} · Financials
        </p>

        {/* Hero teaser card */}
        <div
          className="relative overflow-hidden rounded-[26px]"
          style={{
            background: 'linear-gradient(150deg, #16301F 0%, #1B3828 46%, #2A5A3C 100%)',
            border: '1.5px solid rgba(182,135,31,0.32)',
            boxShadow: '0 2px 8px rgba(27,56,40,0.14), 0 24px 60px rgba(27,56,40,0.22)',
          }}
        >
          {/* Gold radial glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% 8%, rgba(238,217,138,0.22) 0%, rgba(27,56,40,0) 58%)' }}
          />

          <div className="relative flex flex-col items-center text-center px-6 md:px-10 pt-12 pb-10">
            {/* Wallet medallion */}
            <div
              className="flex items-center justify-center rounded-full mb-6"
              style={{
                width: '96px',
                height: '96px',
                background: 'radial-gradient(circle at 50% 36%, rgba(238,217,138,0.34) 0%, rgba(27,56,40,0) 72%)',
                border: '1.5px solid rgba(238,217,138,0.5)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.28), 0 0 0 8px rgba(238,217,138,0.1)',
              }}
            >
              <Wallet size={40} strokeWidth={1.9} style={{ color: '#EED98A' }} />
            </div>

            {/* Coming with Stripe badge */}
            <div className="mb-5">
              <Pill tone="gold" icon={<Sparkles size={12} strokeWidth={2.4} />}>
                Coming with Stripe
              </Pill>
            </div>

            <h1
              className="mb-3"
              style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: '30px', lineHeight: 1.1, color: '#FAF8F3', letterSpacing: '-0.01em' }}
            >
              Payments are coming to Gavelling
            </h1>
            <p
              className="max-w-md"
              style={{ fontFamily: OUTFIT, fontSize: '14px', lineHeight: 1.7, color: 'rgba(250,248,243,0.72)' }}
            >
              Soon you&apos;ll collect registration fees, track outstanding balances, and pay out
              directly from here — powered by Stripe. We&apos;re building it now.
            </p>
          </div>

          {/* Ghosted future stats grid */}
          <div
            className="relative px-6 md:px-10 pb-10 pt-8"
            style={{ borderTop: '1px solid rgba(238,217,138,0.14)' }}
          >
            <p
              className="text-center mb-5"
              style={{ fontFamily: OUTFIT, fontSize: '10px', fontWeight: 800, letterSpacing: '0.16em', color: 'rgba(238,217,138,0.65)', textTransform: 'uppercase' }}
            >
              A preview of what&apos;s coming
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <GhostStat icon={<TrendingUp size={22} strokeWidth={2} />} label="Collected" hint="Fees successfully paid" />
              <GhostStat icon={<Clock size={22} strokeWidth={2} />} label="Pending" hint="Awaiting payment" />
              <GhostStat icon={<Landmark size={22} strokeWidth={2} />} label="Paid out" hint="Transferred to you" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
