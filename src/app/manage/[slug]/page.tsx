'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, CheckCircle, MapPin, CreditCard } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { createAuthClient } from '@/lib/supabase-auth';

// ── Setup step component ───────────────────────────────────────────────────

function SetupStep({
  complete,
  title,
  desc,
  actionLabel,
  actionHref,
  onAction,
}: {
  complete: boolean;
  title: string;
  desc: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid #F0EDE6' }}>
      {/* Circle indicator */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: complete ? '#1B3828' : '#EDE7D8',
          border: complete ? 'none' : '1.5px solid #DDD4C0',
        }}
      >
        {complete && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <polyline points="2,7 6,11 12,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{title}</p>
        <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{desc}</p>
      </div>

      {/* Action */}
      {!complete && (actionHref || onAction) && (
        <button
          onClick={() => { if (onAction) onAction(); else if (actionHref) router.push(actionHref); }}
          className="flex-shrink-0 text-xs font-semibold focus:outline-none transition-colors"
          style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#2A5A3C'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
        >
          {actionLabel ?? 'SET UP →'}
        </button>
      )}
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

  async function handlePublish() {
    setPublishing(true);
    const supabase = createAuthClient();
    await supabase
      .from('conferences')
      .update({ is_public: true, status: 'published' })
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
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishBlockMsg, setPublishBlockMsg] = useState('');

  if (!conference) {
    return (
      <div className="px-6 py-8 flex items-center justify-center min-h-[300px]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const slug = conference.slug;

  // Step completion
  const stepsComplete = {
    committees: false,        // will be real in later prompt
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
    { icon: Users,       value: 0, label: 'Total Applications' },
    { icon: CheckCircle, value: 0, label: 'Accepted' },
    { icon: MapPin,      value: 0, label: 'Assigned' },
    { icon: CreditCard,  value: 0, label: 'Paid' },
  ];

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">

      {/* Section A — Setup checklist (shown until published) */}
      {!conference.is_public && (
        <div
          className="mb-6 p-6 rounded-2xl"
          style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
        >
          <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Complete Your Setup
          </p>
          <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            Complete these steps to publish your conference.
          </p>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full mb-4" style={{ backgroundColor: '#DDD4C0' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: '#1B3828' }}
            />
          </div>

          <div>
            <SetupStep
              complete={stepsComplete.committees}
              title="Add Committees"
              desc="Create committees and configure topics for your conference."
              actionLabel="SET UP →"
              actionHref={`/manage/${slug}/committees`}
            />
            <SetupStep
              complete={stepsComplete.applications}
              title="Configure Applications"
              desc="Set up the delegate application form and roles."
              actionLabel="SET UP →"
              actionHref={`/manage/${slug}/settings`}
            />
            <SetupStep
              complete={stepsComplete.payments}
              title="Setup Payments"
              desc="Connect Stripe to collect conference fees from delegates."
              actionLabel="SET UP →"
              actionHref={`/manage/${slug}/financials`}
            />
            <div style={{ borderBottom: 'none' }}>
              <SetupStep
                complete={stepsComplete.published}
                title="Publish Conference"
                desc="Make your conference visible to delegates worldwide."
                actionLabel="PUBLISH →"
                onAction={handlePublishClick}
              />
            </div>
            {publishBlockMsg && (
              <p className="text-xs mt-2" style={{ color: '#B8844A', fontFamily: "'Outfit', sans-serif" }}>{publishBlockMsg}</p>
            )}
          </div>
        </div>
      )}

      {/* Section B — Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
            >
              <Icon size={18} style={{ color: '#1B3828' }} />
              <p className="font-black text-2xl mt-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{stat.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Section C — Quick actions */}
      <div className="mb-6">
        <p className="font-semibold text-sm mb-3" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push(`/manage/${slug}/committees`)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold tracking-wide transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            ADD COMMITTEE
          </button>
          {([
            { label: 'VIEW APPLICATIONS', href: `/manage/${slug}/applications` },
            { label: 'EMAIL DELEGATES',   href: `/manage/${slug}/communications` },
          ] as { label: string; href: string }[]).map(action => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className="rounded-xl py-2.5 px-5 text-sm font-bold tracking-wide transition-colors focus:outline-none"
              style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {action.label}
            </button>
          ))}
          {!conference.is_public && (
            <button
              onClick={handlePublishClick}
              className="rounded-xl py-2.5 px-5 text-sm font-bold tracking-wide transition-colors focus:outline-none"
              style={{ border: '1px solid #DDD4C0', color: '#1B3828', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
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
