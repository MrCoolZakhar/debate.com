'use client';

// The delegation pop-up's People tab (taste board 3B): every member coming or
// applying, with their role, their seat and where their payment stands.
//
// Payment words follow the payments ledger where it decides: "Owes ... fee"
// is an open invoice balance of an accepted member (delegationRows.ts, the
// same rule as conference_money_summary). "Paid" and "Paid by delegation" are
// the member's access flag (`payment_status`, `self_paid`), never a sum.
//
// Writes, only while DELEGATIONS_MONEY_DB is on (v2.ts; waits for Christian's
// money functions): the role select (organiser_set_member_role, which moves the
// person's ticket and money with them; every move to or from faculty advisor is
// confirmed in place, since only organisers make it) and Remove from delegation
// (delegation_remove_member). While it is off the role is plain text and nothing
// here writes.

import { useMemo, useState } from 'react';
import { UserMinus } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { CircleFlag } from '@/components/CircleFlag';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { removeMember, type MemberRole } from '@/app/conferences/[slug]/participant/delegation/v2';
import { LIVE, ACCEPTED, memberName, type DelegationMemberLite } from '../delegationRows';
import type { DelegationsData, DelegationView } from './useDelegationsData';
import { societyAllocations } from './societySeats';
import { DELEGATIONS_MONEY_DB, organiserSetMemberRole } from './v2';
import {
  BTN_CLASS, CommitteeTag, FONT, HAIRLINE, INK, INK_SOFT, OK_GREEN, OWE, ROW_LINE, RoundAvatar, STROKE,
  firstName, smallPrimaryBtn, smallSecondaryBtn,
} from './kit';

const GRID = DELEGATIONS_MONEY_DB ? 'minmax(0,1fr) 190px 190px 160px 36px' : 'minmax(0,1fr) 190px 190px 160px';

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'delegate', label: 'Delegate' },
  { value: 'head-delegate', label: 'Head delegate' },
  { value: 'faculty-advisor', label: 'Faculty advisor' },
];

const OTHER_ROLE_LABEL: Record<string, string> = {
  observer: 'Observer', chair: 'Chair', secretariat: 'Secretariat',
};

function roleOf(m: DelegationMemberLite): MemberRole | null {
  if (m.role === 'faculty-advisor') return 'faculty-advisor';
  if (m.role === 'head-delegate' || (m.role === 'delegate' && m.is_head_delegate)) return 'head-delegate';
  if (m.role === 'delegate') return 'delegate';
  return null;
}

function roleLabel(m: DelegationMemberLite): string {
  const r = roleOf(m);
  return r ? ROLE_OPTIONS.find(o => o.value === r)!.label : (OTHER_ROLE_LABEL[m.role] ?? m.role);
}

function paymentOf(m: DelegationMemberLite, owes: boolean): { text: string; color: string } {
  if (m.status === 'submitted') return { text: 'Waiting on you', color: '#8A5A12' };
  if (owes) {
    const r = roleOf(m);
    const fee = r === 'faculty-advisor' ? 'faculty advisor' : r === 'head-delegate' ? 'head delegate' : 'delegate';
    return { text: `Owes ${fee} fee`, color: OWE };
  }
  if (m.payment_status === 'paid') return { text: m.self_paid ? 'Paid' : 'Paid by delegation', color: OK_GREEN };
  if (m.payment_status === 'waived') return { text: 'Waived', color: OK_GREEN };
  return { text: ACCEPTED.has(m.status) ? 'Not paid yet' : 'Nothing due yet', color: INK_SOFT };
}

type Pending =
  | { kind: 'role'; id: string; role: MemberRole }
  | { kind: 'remove'; id: string };

export default function PeopleTab<M extends DelegationMemberLite>({ row, data, onChanged }: {
  row: DelegationView<M>;
  data: DelegationsData<M>;
  onChanged?: () => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const live = useMemo(() => row.members.filter(m => LIVE.has(m.status)), [row.members]);
  const gone = row.members.length - live.length;

  // A person's seat: the allocation row on their application, else the
  // seat stamped on the application itself.
  const seatByApp = useMemo(() => {
    const map = new Map<string, { countryCode: string; countryName: string; committee: { name: string; abbreviation: string | null; logo_url: string | null } }>();
    if (!data.committees) return map;
    const ids = new Set(row.members.map(m => m.id));
    for (const { committee, allocation } of societyAllocations(data.committees, row.id, ids)) {
      if (!allocation.application_id) continue;
      const slot = committee.committee_country_slots.find(s => s.country_code === allocation.country_code);
      map.set(allocation.application_id, {
        countryCode: allocation.country_code,
        countryName: allocation.country_name || slot?.country_name || allocation.country_code,
        committee,
      });
    }
    return map;
  }, [data.committees, row.id, row.members]);

  async function changeRole(m: M, role: MemberRole) {
    if (busyId) return;
    setBusyId(m.id);
    const r = await organiserSetMemberRole(m.id, role);
    setBusyId(null);
    setPending(null);
    if (!r.ok) { notifyErr(r.error, 'applications'); return; }
    notifyOk(`${memberName(m)} is now a ${ROLE_OPTIONS.find(o => o.value === role)!.label.toLowerCase()}.`, 'applications');
    onChanged?.();
    void data.reload();
  }

  async function remove(m: M) {
    if (busyId) return;
    setBusyId(m.id);
    const r = await removeMember(m.id);
    setBusyId(null);
    setPending(null);
    if (!r.ok) { notifyErr(r.error, 'applications'); return; }
    notifyOk(`${memberName(m)} left ${row.name}.`, 'applications');
    onChanged?.();
    void data.reload();
  }

  function onRolePick(m: M, next: MemberRole) {
    const current = roleOf(m);
    if (next === current) return;
    // Delegate or head delegate to faculty advisor, or back: asked first.
    if ((next === 'faculty-advisor') !== (current === 'faculty-advisor')) { setPending({ kind: 'role', id: m.id, role: next }); return; }
    void changeRole(m, next);
  }

  if (live.length === 0) {
    return (
      <div style={{ padding: '24px 28px' }}>
        <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>Nobody has joined yet</p>
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, marginTop: 4 }}>People appear here once they apply with this delegation or join through its invite link.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '6px 0' }}>
      <div style={{ minWidth: 760 }}>
        <div className="grid" style={{ gridTemplateColumns: GRID, gap: 16, padding: '10px 28px' }}>
          {['Person', 'Role', 'Seat', 'Payment'].map(h => (
            <span key={h} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>
          ))}
        </div>
        {live.map(m => {
          const name = memberName(m);
          const email = m.profiles?.email || m.invited_email || '';
          const seat = seatByApp.get(m.id) ?? (m.assigned_country_code && m.assigned_committee
            ? { countryCode: m.assigned_country_code, countryName: m.assigned_country_name || m.assigned_country_code, committee: { ...m.assigned_committee, logo_url: data.committees?.find(c => c.id === m.assigned_committee_id)?.logo_url ?? null } }
            : null);
          const pay = paymentOf(m, row.owingMemberIds.includes(m.id));
          const confirming = pending?.id === m.id ? pending : null;
          const role = roleOf(m);
          return (
            <div key={m.id} style={{ borderTop: `1px solid ${ROW_LINE}`, background: confirming ? '#FAF7F0' : 'transparent' }}>
              <div className="grid items-center" style={{ gridTemplateColumns: GRID, gap: 16, padding: '11px 28px' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <RoundAvatar name={name} url={m.profiles?.avatar_url ?? null} size={46} seed={m.id} />
                  <div className="flex flex-col min-w-0" style={{ gap: 1 }}>
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{name}</span>
                    {email && email !== name && (
                      <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT }}>{email}</span>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  {DELEGATIONS_MONEY_DB && role && ACCEPTED.has(m.status) ? (
                    <GSelect<MemberRole>
                      value={confirming?.kind === 'role' ? confirming.role : role}
                      onChange={v => onRolePick(m, v)}
                      options={ROLE_OPTIONS}
                      size="sm"
                      disabled={busyId !== null}
                      aria-label={`Role of ${name}`}
                    />
                  ) : (
                    <span style={{ fontFamily: FONT, fontSize: 14, color: INK }}>{roleLabel(m)}</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap min-w-0" style={{ fontFamily: FONT, fontSize: 14 }}>
                  {seat ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <CircleFlag code={seat.countryCode} country={seat.countryName} size={20} decorative />
                        <span className="[overflow-wrap:anywhere]" style={{ color: INK }}>{seat.countryName}</span>
                      </span>
                      <CommitteeTag name={seat.committee.name} abbreviation={seat.committee.abbreviation} logoUrl={seat.committee.logo_url} size={20} />
                    </>
                  ) : (
                    <span style={{ color: INK_SOFT }}>No seat</span>
                  )}
                </div>

                <span style={{ fontFamily: FONT, fontSize: 14, color: pay.color }}>{pay.text}</span>

                {DELEGATIONS_MONEY_DB && (
                  <button type="button" aria-label={`Remove ${name} from the delegation`} title="Remove from delegation"
                    disabled={busyId !== null}
                    onClick={() => setPending({ kind: 'remove', id: m.id })}
                    className={BTN_CLASS}
                    style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'none', color: INK_SOFT, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserMinus size={18} strokeWidth={STROKE} aria-hidden />
                  </button>
                )}
              </div>

              {confirming && (
                <div className="flex items-center justify-between gap-4 flex-wrap"
                  style={{ margin: '0 28px 14px 78px', padding: '14px 16px', borderRadius: 12, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 6px 18px rgba(27,56,40,0.08)' }}>
                  <span style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.45, color: INK }}>
                    {confirming.kind === 'role'
                      ? `Make ${firstName(name)} ${confirming.role === 'faculty-advisor' ? 'a faculty advisor' : confirming.role === 'head-delegate' ? 'a head delegate' : 'a delegate'}? Their ticket moves with them to the new role. Any price difference is charged, or refunded to whoever paid.`
                      : `Remove ${firstName(name)} from the delegation? Their seat goes back to the delegation as Open.`}
                  </span>
                  <div className="flex gap-2 flex-shrink-0">
                    <button type="button" onClick={() => setPending(null)} disabled={busyId !== null} className={BTN_CLASS} style={smallSecondaryBtn}>Cancel</button>
                    <button type="button" disabled={busyId !== null} className={BTN_CLASS}
                      onClick={() => { if (confirming.kind === 'role') void changeRole(m, confirming.role); else void remove(m); }}
                      style={{ ...smallPrimaryBtn, height: 36, opacity: busyId ? 0.7 : 1 }}>
                      {confirming.kind === 'role' ? (confirming.role === 'faculty-advisor' ? 'Make advisor' : confirming.role === 'head-delegate' ? 'Make head delegate' : 'Make delegate') : 'Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {gone > 0 && (
          <p style={{ borderTop: `1px solid ${HAIRLINE}`, padding: '14px 28px', fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
            {gone === 1 ? '1 more person was turned down or withdrew.' : `${gone} more people were turned down or withdrew.`}
          </p>
        )}
      </div>
    </div>
  );
}
