'use client';

// ── Team (owner, 14 Nov 2026) ──────────────────────────────────────────────
//
// Chairs, secretariat and staff are the people who RUN the conference, so they
// have their own place, never Applications (which is for delegates, head
// delegates, faculty advisors and observers). Three tabs, kept in ?tab=:
//   applications  Team Applications: decide chairs, secretariat and staff
//   jobs          the Job Board (jobs/JobBoardPanel.tsx, moved here)
//   members       Team Members: the organizing team (moved from Settings)

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Briefcase, Inbox, Users2 } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { OUTFIT } from '@/components/neu';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import { BigSectionTabs, type BigSectionTab } from '../BigSectionTabs';
import JobBoardPanel from '../jobs/JobBoardPanel';
import TeamApplications, { type TeamRoleConfig } from './TeamApplications';
import TeamMembers from './TeamMembers';

type TeamTab = 'applications' | 'jobs' | 'members';

const TABS: BigSectionTab<TeamTab>[] = [
  { key: 'applications', label: 'Team Applications', sub: 'Chairs, secretariat and staff', emoji: 'Inbox tray', lucide: Inbox, tone: 'gold' },
  { key: 'jobs', label: 'Job Board', sub: 'Roles you post for your team', emoji: 'Briefcase', lucide: Briefcase, tone: 'gold' },
  { key: 'members', label: 'Team Members', sub: 'Who runs it with you', emoji: 'Busts in silhouette', lucide: Users2, tone: 'green' },
];

/** The tab from the URL; the old Settings links (team, organizers, highlight) open Team Members. */
function tabFrom(sp: URLSearchParams): TeamTab {
  const all = sp.getAll('tab');
  if (all.includes('jobs')) return 'jobs';
  if (all.some(t => t === 'members' || t === 'team' || t === 'organizers') || sp.get('highlight')) return 'members';
  return 'applications';
}

export default function TeamPage() {
  const { conference } = useManage();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TeamTab>(() => tabFrom(new URLSearchParams(searchParams.toString())));
  const [roleConfigs, setRoleConfigs] = useState<TeamRoleConfig[]>([]);
  const confId = conference?.id ?? null;

  // The team roles' form questions and payment timing, for the review pop-up.
  useEffect(() => {
    if (!confId) return;
    let alive = true;
    void (async () => {
      const c = await getFreshAuthedClient();
      if (!c) return;
      const { data } = await c.from('application_role_configs')
        .select('role, payment_timing, custom_questions')
        .eq('conference_id', confId)
        .in('role', ['chair', 'secretariat', 'staff']);
      if (alive) setRoleConfigs((data ?? []) as TeamRoleConfig[]);
    })();
    return () => { alive = false; };
  }, [confId]);

  const open = (next: TeamTab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.delete('tab');
    if (next !== 'members') params.delete('highlight');
    params.set('tab', next);
    replaceUrlInPlace(`${window.location.pathname}?${params.toString()}`);
  };

  const tabs = useMemo(() => TABS, []);
  if (!conference) return null;

  return (
    <div className="px-4 sm:px-6 md:px-10 pt-6 pb-10" style={{ maxWidth: 1500 }}>
      <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 'clamp(32px, 3.4vw, 42px)', letterSpacing: '-0.025em', lineHeight: 1.05, color: '#1C1410', margin: 0 }}>
        Team
      </h1>
      <p style={{ fontFamily: OUTFIT, fontSize: 15, color: '#5C5140', margin: '6px 0 0', overflowWrap: 'anywhere' }}>{conference.full_name}</p>

      <BigSectionTabs tabs={tabs} value={tab} onChange={open} label="Team sections" compact scroll />

      {tab === 'applications' && (
        <TeamApplications conferenceId={conference.id} conferenceSlug={conference.slug} roleConfigs={roleConfigs} />
      )}
      {tab === 'jobs' && <JobBoardPanel embedded />}
      {tab === 'members' && <TeamMembers />}
    </div>
  );
}
