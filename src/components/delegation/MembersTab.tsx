'use client';

// Members: every person in the delegation with their role, status and seat.
// The head delegate can hand over the role or make someone the faculty advisor
// from the row's menu. The actions themselves (confirmations, RPCs) live in the
// portal page; this tab only says what is possible and why not.

import { useMemo, useState } from 'react';
import { Crown, GraduationCap, Search, Users } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import ProfileLink from '@/components/ProfileLink';
import {
  isAccepted, isHead, isLive,
  type PortalCommittee, type PortalData, type PortalMember,
} from './portalModel';
import { Panel, PanelTitle, PersonAvatar, RoleMark, RowMenu, SeatMark, StatusMark, type MenuAction } from './portalUi';

export function MembersTab({ data, busyId, onMakeHead, onMakeAdvisor }: {
  data: PortalData;
  busyId: string | null;
  onMakeHead: (m: PortalMember) => void;
  onMakeAdvisor: (m: PortalMember) => void;
}) {
  const [q, setQ] = useState('');
  const committees = useMemo(() => new Map(data.committees.map((c) => [c.id, c])), [data.committees]);
  const iAmHead = data.me.role === 'head-delegate';

  const all = data.members.filter(isLive);
  const rejected = data.members.filter((m) => m.status === 'rejected');
  const needle = q.trim().toLowerCase();
  const match = (m: PortalMember) => !needle || m.name.toLowerCase().includes(needle) || (m.assigned_country_name ?? '').toLowerCase().includes(needle);

  const leaders = all.filter((m) => isHead(m) || m.role === 'faculty-advisor').filter(match)
    .sort((a, b) => Number(isHead(b)) - Number(isHead(a)) || a.name.localeCompare(b.name));
  const delegates = all.filter((m) => !isHead(m) && m.role !== 'faculty-advisor' && isAccepted(m)).filter(match)
    .sort((a, b) => a.name.localeCompare(b.name));
  const pending = all.filter((m) => !isHead(m) && m.role !== 'faculty-advisor' && !isAccepted(m)).filter(match)
    .sort((a, b) => a.name.localeCompare(b.name));

  const actionsFor = (m: PortalMember): MenuAction[] => {
    if (!iAmHead) return [];
    const self = m.id === data.me.application_id;
    const out: MenuAction[] = [];
    if (!self && m.role === 'delegate') {
      const reason = !m.registered ? 'They need a Gavelling account first.'
        : !isAccepted(m) ? 'The organiser has to accept them first.' : undefined;
      out.push({ key: 'head', label: 'Make head delegate', icon: Crown, onSelect: () => onMakeHead(m), disabled: !!reason, note: reason ?? 'You become a delegate.' });
    }
    if (m.role === 'delegate' || m.role === 'head-delegate') {
      const reason = !data.facultyAdvisorsEnabled ? 'This conference takes no faculty advisors.' : undefined;
      out.push({
        key: 'fa', label: self ? 'Become the faculty advisor' : 'Make faculty advisor', icon: GraduationCap,
        onSelect: () => onMakeAdvisor(m), disabled: !!reason,
        note: reason ?? (m.assigned_country_name ? 'Frees their committee seat.' : 'Advisors hold no committee seat.'),
      });
    }
    return out;
  };

  const total = leaders.length + delegates.length + pending.length;

  return (
    <div className="flex flex-col gap-4">
      {all.length > 8 && (
        <label className="flex items-center gap-2" style={{ padding: '10px 14px', borderRadius: 12, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
          <Search size={16} strokeWidth={2.2} aria-hidden style={{ color: NEU.inkSoft }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or country"
            aria-label="Search members"
            className="flex-1 outline-none bg-transparent"
            style={{ fontFamily: OUTFIT, fontSize: 16, color: NEU.ink }}
          />
        </label>
      )}

      {!iAmHead && (
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, lineHeight: 1.45 }}>
          Only the head delegate can change who leads the delegation.
        </p>
      )}

      {total === 0 && (
        <Panel><p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>{needle ? 'Nobody matches.' : 'Nobody has joined yet.'}</p></Panel>
      )}

      <Group title="Leading the delegation" count={leaders.length} members={leaders} committees={committees} actionsFor={actionsFor} busyId={busyId} />
      <Group title="Delegates" count={delegates.length} members={delegates} committees={committees} actionsFor={actionsFor} busyId={busyId} />
      <Group title="Waiting for the organiser" count={pending.length} members={pending} committees={committees} actionsFor={actionsFor} busyId={busyId}
        sub="The organiser reviews these applications. They get a seat once accepted." />
      {rejected.length > 0 && !needle && (
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
          {rejected.length === 1 ? 'One application' : `${rejected.length} applications`} from your delegation {rejected.length === 1 ? 'was' : 'were'} not accepted.
        </p>
      )}
    </div>
  );
}

function Group({ title, count, members, committees, actionsFor, busyId, sub }: {
  title: string; count: number; members: PortalMember[]; committees: Map<string, PortalCommittee>;
  actionsFor: (m: PortalMember) => MenuAction[]; busyId: string | null; sub?: string;
}) {
  if (members.length === 0) return null;
  return (
    <Panel style={{ padding: '16px 16px 6px' }}>
      <PanelTitle icon={Users} title={title} sub={sub} aside={<span style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{count}</span>} />
      <ul>
        {members.map((m) => {
          const actions = actionsFor(m);
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
              style={{ padding: '12px 0', borderTop: NEU.hairline, opacity: busyId === m.id ? 0.55 : 1 }}
            >
              <div className="flex items-center gap-3 min-w-0" style={{ flex: '1 1 220px' }}>
                <PersonAvatar name={m.name} url={m.avatar_url} size={40} />
                <div className="min-w-0">
                  <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, color: NEU.ink }}>
                    {m.user_id ? <ProfileLink userId={m.user_id} name={m.name}>{m.name}</ProfileLink> : m.name}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <RoleMark member={m} />
                    <StatusMark status={m.status} registered={m.registered} />
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex items-center" style={{ flex: '1 1 200px' }}>
                {m.role === 'faculty-advisor'
                  ? <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>Advisors hold no seat</span>
                  : <SeatMark committee={m.assigned_committee_id ? committees.get(m.assigned_committee_id) : null} countryName={m.assigned_country_name} countryCode={m.assigned_country_code} />}
              </div>
              {actions.length > 0 && <RowMenu actions={actions} label={`Actions for ${m.name}`} />}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
