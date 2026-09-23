'use client';

// ── InviteAcceptance ───────────────────────────────────────────────────────
//
// Replaced the applicants dial on the organiser dashboard (owner, 23 Sep 2026:
// "instead of the status, show how many delegates / FAs / observers / chairs
// have accepted their invite"). One small ring per role, the accepted count as
// plain typography beside it, and what is still out in one quiet line.
//
// What "accepted" and "invited" mean is decided by `inviteAcceptanceByRole`
// below, from the rows the dashboard already reads. The rule, per role:
//
//   Delegates (delegate + head-delegate), Faculty advisors, Observers:
//     invited  = every application of that role that is not rejected or
//                withdrawn and is either accepted by the organiser (accepted /
//                assigned / checked-in) or still an unclaimed invite (an
//                imported / invited row with no account, user_id null).
//     accepted = those rows with an account on them (user_id set). An imported
//                applicant becomes that by claiming the invite
//                (claim_import_invite writes user_id); a self-applicant has one
//                from the start and counts once the organiser accepts them.
//     A self-applicant still waiting for a decision is an APPLICANT, not an
//     invitee, and is counted on neither side.
//
//   Chairs:
//     accepted = distinct accounts that are on the dais: accepted
//                conference_chair_invites (invited_user_id) together with chair
//                applications with an account at accepted / assigned /
//                checked-in (accepting a chair invite creates that application,
//                so the two are unioned by user id, never added).
//     invited  = accepted + pending chair invites + unclaimed imported chair
//                applications (user_id null). Declined and revoked invites are
//                not counted.

import { Gavel, GraduationCap, Eye, Users, type LucideIcon } from 'lucide-react';
import { OUTFIT } from '@/components/neu';

const INK = 'var(--gv-on-surface)';
const INK_SOFT = 'color-mix(in srgb, var(--gv-on-surface) 72%, var(--gv-surface))';
const FOREST = 'var(--gv-main)';
const TRACK = 'color-mix(in srgb, var(--gv-main) 10%, transparent)';

const PLACED = new Set(['accepted', 'assigned', 'checked-in']);
const CLOSED = new Set(['rejected', 'withdrawn']);

export interface InviteAppRow {
  role: string;
  status: string;
  user_id: string | null;
}

export interface ChairInviteRow {
  status: string;
  invited_user_id: string | null;
}

export type InviteRoleKey = 'delegates' | 'advisors' | 'observers' | 'chairs';

export interface InviteRoleCount {
  key: InviteRoleKey;
  accepted: number;
  invited: number;
}

const ROLE_OF: Record<string, Exclude<InviteRoleKey, 'chairs'> | undefined> = {
  delegate: 'delegates',
  'head-delegate': 'delegates',
  'faculty-advisor': 'advisors',
  observer: 'observers',
};

export function inviteAcceptanceByRole(apps: InviteAppRow[], chairInvites: ChairInviteRow[]): InviteRoleCount[] {
  const tally: Record<Exclude<InviteRoleKey, 'chairs'>, { accepted: number; invited: number }> = {
    delegates: { accepted: 0, invited: 0 },
    advisors: { accepted: 0, invited: 0 },
    observers: { accepted: 0, invited: 0 },
  };
  const chairsIn = new Set<string>();
  let chairsOut = 0;

  for (const a of apps) {
    if (CLOSED.has(a.status)) continue;
    if (a.role === 'chair') {
      if (!a.user_id) chairsOut += 1;
      else if (PLACED.has(a.status)) chairsIn.add(a.user_id);
      continue;
    }
    const key = ROLE_OF[a.role];
    if (!key) continue;
    if (!a.user_id) {
      tally[key].invited += 1;
    } else if (PLACED.has(a.status)) {
      tally[key].invited += 1;
      tally[key].accepted += 1;
    }
  }
  for (const inv of chairInvites) {
    if (inv.status === 'accepted') {
      if (inv.invited_user_id) chairsIn.add(inv.invited_user_id);
    } else if (inv.status === 'pending') {
      chairsOut += 1;
    }
  }

  return [
    { key: 'delegates', ...tally.delegates },
    { key: 'advisors', ...tally.advisors },
    { key: 'observers', ...tally.observers },
    { key: 'chairs', accepted: chairsIn.size, invited: chairsIn.size + chairsOut },
  ];
}

const META: Record<InviteRoleKey, { label: string; one: string; Icon: LucideIcon }> = {
  delegates: { label: 'Delegates', one: 'delegate', Icon: Users },
  advisors: { label: 'Faculty advisors', one: 'faculty advisor', Icon: GraduationCap },
  observers: { label: 'Observers', one: 'observer', Icon: Eye },
  chairs: { label: 'Chairs', one: 'chair', Icon: Gavel },
};

function Ring({ value, max, size, Icon }: { value: number; max: number; size: number; Icon: LucideIcon }) {
  const stroke = Math.max(5, Math.round(size * 0.12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = max > 0 ? Math.min(1, value / max) : 0;
  const full = max > 0 && value >= max;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
        {share > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={full ? 'var(--gv-accent)' : FOREST}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c}`}
            style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.22,1,0.36,1)' }}
          />
        )}
      </svg>
      <span
        aria-hidden
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FOREST }}
      >
        <Icon size={Math.round(size * 0.34)} strokeWidth={2.2} />
      </span>
    </div>
  );
}

export default function InviteAcceptance({ counts, ringSize = 56 }: { counts: InviteRoleCount[]; ringSize?: number }) {
  return (
    <ul
      style={{
        margin: 0, padding: 0, listStyle: 'none', width: '100%',
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 16px',
        alignContent: 'center',
      }}
    >
      {counts.map((row) => {
        const { label, one, Icon } = META[row.key];
        const waiting = Math.max(0, row.invited - row.accepted);
        const sentence = row.invited === 0
          ? `${label}: nobody invited yet.`
          : `${label}: ${row.accepted} of ${row.invited} accepted${waiting > 0 ? `, ${waiting} still to accept` : ''}.`;
        return (
          <li key={row.key} className="flex items-center min-w-0" style={{ gap: 11 }} aria-label={sentence} title={sentence}>
            <Ring value={row.accepted} max={row.invited} size={ringSize} Icon={Icon} />
            <div className="min-w-0" style={{ fontFamily: OUTFIT }}>
              <p className="truncate" style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: INK_SOFT }}>
                {label}
              </p>
              <p style={{ margin: '1px 0 0', lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: INK, letterSpacing: '-0.02em' }}>
                  {row.accepted.toLocaleString()}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: INK_SOFT }}>
                  {' '}/ {row.invited.toLocaleString()}
                </span>
              </p>
              <p className="truncate" style={{ margin: '3px 0 0', fontSize: 10.5, fontWeight: 600, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                {row.invited === 0
                  ? 'None invited yet'
                  : waiting === 0
                    ? 'All accepted'
                    : `${waiting.toLocaleString()} ${waiting === 1 ? one : `${one}s`} to accept`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
