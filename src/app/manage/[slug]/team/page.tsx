'use client';

// ── Team (owner, 14 Nov 2026) ──────────────────────────────────────────────
//
// Chairs, secretariat and staff are the people who RUN the conference, so they
// have their own place, never Applications (which is for delegates, head
// delegates, faculty advisors and observers). Three tabs, kept in ?tab= and picked
// from the left menu's TEAM section (24 Nov 2026: the top tab cards are gone):
//   applications  Team Applications: decide chairs, secretariat and staff. It is the
//                 Applications page itself (applications/ApplicationsView.tsx with scope
//                 'team', owner 23 Nov 2026), its decisions in team/useTeamDecisions.tsx
//   jobs          the Job Board (jobs/JobBoardPanel.tsx, moved here)
//   members       Team Members: the organizing team (moved from Settings)

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Briefcase, Inbox, Users2, type LucideIcon } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { NEU, NEU_GRADIENTS, NeuIconDisc, OUTFIT } from '@/components/neu';
import JobBoardPanel from '../jobs/JobBoardPanel';
import ApplicationsView from '../applications/ApplicationsView';
import TeamMembers from './TeamMembers';

type TeamTab = 'applications' | 'jobs' | 'members';

/** The tab from the URL; the old Settings links (team, organizers, highlight) open Team Members. */
function tabFrom(sp: URLSearchParams): TeamTab {
  const all = sp.getAll('tab');
  if (all.includes('jobs')) return 'jobs';
  if (all.some(t => t === 'members' || t === 'team' || t === 'organizers') || sp.get('highlight')) return 'members';
  return 'applications';
}

// The header of each tab, in the Applications page's look (24 Nov 2026).
const HEADS: Record<TeamTab, { icon: LucideIcon; emoji: string; title: string }> = {
  applications: { icon: Inbox, emoji: 'Inbox tray', title: 'Team Applications' },
  jobs: { icon: Briefcase, emoji: 'Briefcase', title: 'Job Board' },
  members: { icon: Users2, emoji: 'Busts in silhouette', title: 'Team Members' },
};

export default function TeamPage() {
  const { conference } = useManage();
  const searchParams = useSearchParams();
  // The left menu's Team links (layout.tsx) drive the tab through ?tab=; read on every render,
  // so a menu click, back and forward all switch it (24 Nov 2026).
  const tab = tabFrom(new URLSearchParams(searchParams.toString()));

  if (!conference) return null;
  const head = HEADS[tab];

  return (
    // Team Applications fills the page like Applications does (no reading-width cap); the other tabs keep 1500.
    <div className="px-6 md:px-10 py-8" style={{ maxWidth: tab === 'applications' ? undefined : 1500 }}>
      <div className="flex items-center gap-3.5 mb-5">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={head.icon} emoji={head.emoji} size={46} />
        <div className="min-w-0">
          <p className="mb-1" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}>
            {conference.acronym} · Team
          </p>
          <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, color: NEU.ink, letterSpacing: '-0.01em' }}>{head.title}</h1>
          <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.inkSoft, margin: '4px 0 0', lineHeight: 1.5 }}>
            {tab === 'applications' ? (
              <>
                Team Applications is for chairs, secretariat and staff. Delegates, head delegates, faculty advisors and observers are in{' '}
                <Link href={`/manage/${conference.slug}/applications`} style={{ fontWeight: 700, color: NEU.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>Applications</Link>.
              </>
            ) : tab === 'jobs' ? (
              'Post the chair, secretariat and staff roles you are hiring for'
            ) : (
              'Who runs the conference with you and the pages they can open'
            )}
          </p>
        </div>
      </div>

      {tab === 'applications' && (
        <ApplicationsView scope="team" />
      )}
      {tab === 'jobs' && <JobBoardPanel embedded />}
      {tab === 'members' && <TeamMembers />}
    </div>
  );
}
