'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, CheckCircle, MapPin, CreditCard, Building2, FileText, Globe, Check, ArrowRight, Rocket, Mail } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';

const OUTFIT = "'Outfit', sans-serif";

// ── Setup step component ───────────────────────────────────────────────────

function SetupStep({
  complete,
  icon: Icon,
  title,
  desc,
  actionLabel,
  actionHref,
  onAction,
  isLast,
}: {
  complete: boolean;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  title: string;
  desc: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  isLast?: boolean;
}) {
  const router = useRouter();
  return (
    <div
      className="flex items-center gap-3.5 py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(238,217,138,0.14)' }}
    >
      {/* Icon-in-disc indicator */}
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 40, height: 40, borderRadius: 13,
          background: complete
            ? 'linear-gradient(150deg, rgba(238,217,138,0.28), rgba(238,217,138,0.12))'
            : 'rgba(255,255,255,0.06)',
          border: complete ? '1px solid rgba(238,217,138,0.5)' : '1px solid rgba(238,217,138,0.16)',
        }}
      >
        {complete
          ? <Check size={19} style={{ color: '#EED98A' }} />
          : <Icon size={18} style={{ color: 'rgba(238,217,138,0.62)' }} />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: complete ? 'rgba(237,231,216,0.7)' : '#F5F1E6', fontFamily: OUTFIT }}>{title}</p>
        <p className="text-xs" style={{ color: 'rgba(237,231,216,0.5)', fontFamily: OUTFIT }}>{desc}</p>
      </div>

      {/* Action */}
      {complete ? (
        <span
          className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(238,217,138,0.16)', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.08em' }}
        >
          DONE
        </span>
      ) : (actionHref || onAction) && (
        <button
          onClick={() => { if (onAction) onAction(); else if (actionHref) router.push(actionHref); }}
          className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none transition-all"
          style={{ backgroundColor: 'rgba(238,217,138,0.14)', color: '#EED98A', fontFamily: OUTFIT, border: '1px solid rgba(238,217,138,0.28)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.24)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.14)'; }}
        >
          {actionLabel ?? 'Set up'}
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

// ── Completion ring ────────────────────────────────────────────────────────
// A gold progress ring wrapped around the "N/4" fraction — the "show, don't
// list" replacement for the old thin progress bar.

function CompletionRing({ completed, total }: { completed: number; total: number }) {
  const size = 92;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? completed / total : 0;
  const allDone = completed >= total;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(238,217,138,0.16)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={allDone ? '#EED98A' : '#EED98A'} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 22, color: '#EED98A', lineHeight: 1 }}>
          {completed}<span style={{ fontSize: 13, opacity: 0.55 }}>/{total}</span>
        </span>
        <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(238,217,138,0.6)', marginTop: 2 }}>
          STEPS
        </span>
      </div>
    </div>
  );
}

// ── Publish modal ──────────────────────────────────────────────────────────

function PublishModal({
  conference,
  onClose,
  onPublished,
}: {
  conference: { id: string; full_name: string };
  onClose: () => void;
  onPublished: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const { session } = useAuth();

  async function handlePublish() {
    setPublishing(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase
      .from('conferences')
      .update({ is_public: true, status: 'public' })
      .eq('id', conference.id);
    setPublishing(false);
    onPublished();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-black text-xl mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Publish Conference?
        </h2>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Your conference will appear publicly on gavelling.com/conferences and delegates will be able to apply.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            CANCEL
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{
              backgroundColor: publishing ? '#DDD4C0' : '#1B3828',
              color: publishing ? '#9A8A78' : '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.06em',
            }}
            onMouseEnter={(e) => { if (!publishing) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!publishing) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {publishing ? 'PUBLISHING...' : 'PUBLISH NOW'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard home ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { conference, refreshConference } = useManage();
  const { session } = useAuth();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishBlockMsg, setPublishBlockMsg] = useState('');
  const [hasCommittees, setHasCommittees] = useState(false);
  const [statCounts, setStatCounts] = useState({ total: 0, accepted: 0, assigned: 0, paid: 0 });

  useEffect(() => {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    supabase
      .from('conference_committees')
      .select('*', { count: 'exact', head: true })
      .eq('conference_id', conference.id)
      .then(({ count }) => { setHasCommittees((count ?? 0) > 0); });
  }, [conference?.id]);

  useEffect(() => {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const confId = conference.id;
    (async () => {
      const [totalRes, acceptedRes, paidRes, assignedRes] = await Promise.all([
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('conference_id', confId),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('conference_id', confId).eq('status', 'accepted'),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('conference_id', confId).eq('payment_status', 'paid'),
        supabase.from('conference_allocations').select('*', { count: 'exact', head: true }).eq('conference_id', confId),
      ]);
      setStatCounts({
        total: totalRes.count ?? 0,
        accepted: acceptedRes.count ?? 0,
        paid: paidRes.count ?? 0,
        assigned: assignedRes.count ?? 0,
      });
    })();
  }, [conference?.id, session?.access_token]);

  if (!conference) {
    return (
      <div className="px-6 md:px-10 py-8 max-w-5xl">
        {/* Hero skeleton — echoes the setup hero's shape, not a lone spinner */}
        <div
          className="mb-6 rounded-[22px] animate-pulse"
          style={{ height: 260, background: 'linear-gradient(135deg, rgba(27,56,40,0.14), rgba(27,56,40,0.07))', border: '1.5px solid rgba(27,56,40,0.1)' }}
        />
        {/* Stat tiles skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-xl animate-pulse" style={{ height: 78, backgroundColor: 'rgba(250,248,243,0.7)', border: '1px solid #DDD4C0' }} />
          ))}
        </div>
      </div>
    );
  }

  const slug = conference.slug;

  // Step completion
  const stepsComplete = {
    committees: hasCommittees,
    applications: false,      // will be real in later prompt
    payments: conference.stripe_account_id !== null,
    published: conference.is_public,
  };

  const completedCount = Object.values(stepsComplete).filter(Boolean).length;
  const totalSteps = 4;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  function handlePublishClick() {
    if (!stepsComplete.committees || !stepsComplete.applications) {
      setPublishBlockMsg('Complete the steps above first.');
      setTimeout(() => setPublishBlockMsg(''), 3000);
      return;
    }
    setShowPublishModal(true);
  }

  async function handlePublished() {
    await refreshConference();
    setShowPublishModal(false);
  }

  const stats = [
    { icon: Users,       value: statCounts.total,    label: 'Total Applications' },
    { icon: CheckCircle, value: statCounts.accepted, label: 'Accepted' },
    { icon: MapPin,      value: statCounts.assigned, label: 'Assigned' },
    { icon: CreditCard,  value: statCounts.paid,     label: 'Paid' },
  ];

  const confYear = conference.start_date ? new Date(conference.start_date + 'T00:00:00').getFullYear() : null;

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">

      {/* Section A — Setup hero (shown until published) — the unmistakable protagonist */}
      {!conference.is_public && (
        <div
          className="mb-6 rounded-[22px] overflow-hidden relative"
          style={{
            background: 'linear-gradient(135deg, #16301F 0%, #1B3828 46%, #2A5A3C 100%)',
            border: '2px solid rgba(238,217,138,0.22)',
            boxShadow: '0 4px 14px rgba(27,56,40,0.2), 0 24px 60px rgba(27,56,40,0.24)',
          }}
        >
          {/* Gold radial glow */}
          <div
            className="pointer-events-none absolute"
            style={{ top: -120, right: -80, width: 380, height: 380, borderRadius: '9999px', background: 'radial-gradient(circle, rgba(238,217,138,0.22), transparent 66%)' }}
          />
          {/* Banner strip behind the header, if present */}
          {conference.banner_url && (
            <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={conference.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #16301F 8%, transparent 120%)' }} />
            </div>
          )}

          <div className="relative p-6 md:p-8">
            {/* Header: identity + ring */}
            <div className="flex items-start justify-between gap-5 mb-5">
              <div className="flex items-center gap-4 min-w-0">
                {conference.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={conference.logo_url}
                    alt={conference.acronym}
                    className="flex-shrink-0"
                    style={{ width: 52, height: 52, objectFit: 'contain', filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.35))' }}
                  />
                ) : (
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(238,217,138,0.14)', border: '1px solid rgba(238,217,138,0.3)', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 900, fontSize: 17 }}
                  >
                    {conference.acronym.slice(0, 2)}
                  </span>
                )}
                <div className="min-w-0">
                  <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: 'rgba(238,217,138,0.78)' }}>
                    {conference.acronym}{confYear ? ` · ${confYear}` : ''}
                  </p>
                  <h2 className="font-black" style={{ color: '#F7F3E9', fontFamily: OUTFIT, fontSize: 22, lineHeight: 1.12, marginTop: 2 }}>
                    Complete your setup
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'rgba(237,231,216,0.6)', fontFamily: OUTFIT }}>
                    {completedCount === totalSteps ? 'All set — ready to go live.' : `${totalSteps - completedCount} step${totalSteps - completedCount === 1 ? '' : 's'} left before you can publish.`}
                  </p>
                </div>
              </div>
              <CompletionRing completed={completedCount} total={totalSteps} />
            </div>

            {/* Steps */}
            <div
              className="rounded-2xl px-4 md:px-5"
              style={{ backgroundColor: 'rgba(0,0,0,0.16)', border: '1px solid rgba(238,217,138,0.12)' }}
            >
              <SetupStep
                complete={stepsComplete.committees}
                icon={Building2}
                title="Add Committees"
                desc="Create committees and configure topics for your conference."
                actionHref={`/manage/${slug}/committees`}
              />
              <SetupStep
                complete={stepsComplete.applications}
                icon={FileText}
                title="Configure Applications"
                desc="Set up the delegate application form and roles."
                actionHref={`/manage/${slug}/settings`}
              />
              <SetupStep
                complete={stepsComplete.payments}
                icon={CreditCard}
                title="Setup Payments"
                desc="Connect Stripe to collect conference fees from delegates."
                actionHref={`/manage/${slug}/financials`}
              />
              <SetupStep
                complete={stepsComplete.published}
                icon={Globe}
                title="Publish Conference"
                desc="Make your conference visible to delegates worldwide."
                actionLabel="Publish"
                onAction={handlePublishClick}
                isLast
              />
            </div>
            {publishBlockMsg && (
              <p className="text-xs mt-3" style={{ color: '#EED98A', fontFamily: OUTFIT }}>{publishBlockMsg}</p>
            )}
          </div>
        </div>
      )}

      {/* Section B — Stats (secondary weight — quieter than the hero) */}
      <p className="text-[11px] font-bold mb-2.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        At a glance
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-3.5 rounded-xl flex items-center gap-3"
              style={{ backgroundColor: 'rgba(250,248,243,0.7)', border: '1px solid #DDD4C0' }}
            >
              <span className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(27,56,40,0.07)' }}>
                <Icon size={15} style={{ color: '#1B3828' }} />
              </span>
              <div className="min-w-0">
                <p className="font-black text-xl leading-none" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{stat.value}</p>
                <p className="text-[11px] font-medium mt-1 truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section C — Quick actions */}
      <div className="mb-6">
        <p className="font-bold text-sm mb-3" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push(`/manage/${slug}/committees`)}
            className="inline-flex items-center gap-2 rounded-xl py-2.5 px-5 text-sm font-bold tracking-wide transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.03em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            <Building2 size={15} />
            ADD COMMITTEE
          </button>
          {([
            { label: 'VIEW APPLICATIONS', href: `/manage/${slug}/applications`, icon: Users },
            { label: 'EMAIL DELEGATES',   href: `/manage/${slug}/communications`, icon: Mail },
          ] as { label: string; href: string; icon: React.ComponentType<{ size?: number }> }[]).map(action => {
            const AIcon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="inline-flex items-center gap-2 rounded-xl py-2.5 px-5 text-sm font-bold tracking-wide transition-colors focus:outline-none"
                style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.03em' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <AIcon size={15} />
                {action.label}
              </button>
            );
          })}
          {!conference.is_public && (
            <button
              onClick={handlePublishClick}
              className="inline-flex items-center gap-2 rounded-xl py-2.5 px-5 text-sm font-bold tracking-wide transition-colors focus:outline-none"
              style={{ border: '1.5px solid #DDD4C0', color: '#1B3828', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.03em' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Rocket size={15} />
              PUBLISH CONFERENCE
            </button>
          )}
        </div>
      </div>

      {showPublishModal && (
        <PublishModal
          conference={conference}
          onClose={() => setShowPublishModal(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
