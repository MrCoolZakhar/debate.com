'use client';

// The People table of the leader card (taste board 1A): one row per member,
// person (photo or initials, name, role in plain words), seat (the country's
// round flag and the committee's round emblem side by side at 44px, owner 19
// Oct 2026, then the country and the committee acronym as a link that opens
// the committee, two rows), position paper (V2 only), payment, and the row menu.
// From 760px of card width it is a table; below it every row stacks.
// Names wrap, never an ellipsis (CLAUDE.md §8).

import { useMemo, useState } from 'react';
import { AlertCircle, Check, Mail, Minus, Search, UserX } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import ProfileLink from '@/components/ProfileLink';
import { DELEGATIONS_V2_DB, type OpenSeat } from './v2';
import MemberMenu, { type MenuMember } from './MemberMenu';
import { cardStyle, CommitteeDisc, FONT, INK, INK_SOFT, LINE, OK_GREEN, OWE, RoundAvatar, STROKE } from './leaderKit';

export type PayTone = 'ok' | 'owe' | 'soft';

export interface PersonRow {
  application_id: string;
  name: string;
  avatar_url: string | null;
  role: MenuMember['role'];
  is_me: boolean;
  claimed: boolean;
  user_id: string | null;
  attending: boolean;
  seat: {
    country_name: string | null;
    country_code: string | null;
    seatLogo: string | null;
    committee_id: string | null;
    committee_label: string;
    committee_full: string | null;
    emblem: string;
  } | null;
  /** V2 only: the position paper in words, with its tone. */
  paper: { word: string; tone: PayTone } | null;
  pay: { word: string; tone: PayTone } | null;
}

const ROLE_WORD: Record<PersonRow['role'], string> = {
  'faculty-advisor': 'Faculty advisor',
  'head-delegate': 'Head delegate',
  delegate: 'Delegate',
};

const TONE_COLOR: Record<PayTone, string> = { ok: OK_GREEN, owe: OWE, soft: INK_SOFT };
const TONE_ICON = { ok: Check, owe: AlertCircle, soft: Minus } as const;

function ToneWord({ word, tone }: { word: string; tone: PayTone }) {
  const Icon = TONE_ICON[tone];
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 14, color: TONE_COLOR[tone] }}>
      <Icon size={16} strokeWidth={STROKE} aria-hidden style={{ flexShrink: 0 }} />
      {word}
    </span>
  );
}

// The seat column is the widest: two 44px circles before its two text rows.
const GRID_V2 = '@[760px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,0.95fr)_36px]';
const GRID = '@[760px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1.7fr)_minmax(0,0.9fr)_36px]';

export default function PeopleTable({ rows, societyId, conferenceId, openSeats, onOpenCommittee, onChanged, swap }: {
  rows: PersonRow[];
  societyId: string;
  conferenceId: string;
  openSeats: OpenSeat[] | null;
  onOpenCommittee: (committeeId: string) => void;
  onChanged: () => Promise<void> | void;
  /** The existing allocation swap: while on, seated rows are picked instead of the menu. */
  swap: { on: boolean; selected: string[]; toggle: (applicationId: string) => void };
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.name, r.seat?.country_name, r.seat?.committee_label, r.seat?.committee_full, ROLE_WORD[r.role]]
      .some(v => (v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);

  const grid = DELEGATIONS_V2_DB ? GRID_V2 : GRID;
  const heads = DELEGATIONS_V2_DB ? ['Person', 'Seat', 'Position paper', 'Payment'] : ['Person', 'Seat', 'Payment'];

  return (
    <section className="@container min-w-0" style={{ ...cardStyle, padding: '8px 0 12px' }} aria-label="People">
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ padding: '16px 24px 12px' }}>
        <h2 style={{ fontFamily: FONT, fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>People</h2>
        {rows.length > 4 && (
          <label className="inline-flex items-center gap-2" style={{ height: 40, padding: '0 12px', borderRadius: 10, background: '#F6F2EA', color: INK_SOFT, width: 240, maxWidth: '100%' }}>
            <Search size={17} strokeWidth={STROKE} aria-hidden style={{ flexShrink: 0 }} />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="focus:outline-none"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 16, color: INK }}
            />
          </label>
        )}
      </div>

      <div aria-hidden className={`hidden @[760px]:grid ${grid} gap-3`} style={{ padding: '8px 24px', borderBottom: `1px solid ${LINE}` }}>
        {heads.map(h => <span key={h} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>)}
        <span />
      </div>

      {shown.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0, padding: '18px 24px' }}>
          {rows.length === 0 ? 'Nobody has joined yet. Share the invite link to bring your people in.' : 'Nobody matches that search.'}
        </p>
      ) : shown.map(r => {
        const selectable = swap.on && !!r.seat?.committee_id;
        const selected = swap.selected.includes(r.application_id);
        return (
          <div
            key={r.application_id}
            onClick={() => { if (selectable) swap.toggle(r.application_id); }}
            className={`relative flex flex-col gap-3 @[760px]:grid ${grid} @[760px]:gap-3 @[760px]:items-center`}
            style={{
              padding: '12px 24px', borderBottom: `1px solid ${LINE}`,
              background: selected ? 'rgba(27,56,40,0.06)' : r.is_me ? 'rgba(238,217,138,0.14)' : 'transparent',
              opacity: !r.attending ? 0.6 : swap.on && !selectable ? 0.45 : 1,
              cursor: selectable ? 'pointer' : 'default',
            }}
          >
            {/* Person */}
            <div className="flex items-center gap-3 min-w-0 pr-10 @[760px]:pr-0">
              <RoundAvatar name={r.name} url={r.avatar_url} size={54} seed={r.application_id} />
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                  {r.user_id ? <ProfileLink userId={r.user_id} name={r.name} nested>{r.name}</ProfileLink> : r.name}
                  {r.is_me && <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8A6614', marginLeft: 6 }}>You</span>}
                </span>
                <span className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
                  {ROLE_WORD[r.role]}
                  {!r.claimed && (
                    <span className="inline-flex items-center gap-1"><Mail size={14} strokeWidth={STROKE} aria-hidden />Invited</span>
                  )}
                  {!r.attending && (
                    <span className="inline-flex items-center gap-1"><UserX size={14} strokeWidth={STROKE} aria-hidden />Not attending</span>
                  )}
                </span>
              </div>
            </div>

            {/* Seat */}
            <div className="min-w-0 pl-[66px] @[760px]:pl-0">
              {r.seat ? (
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex items-center flex-shrink-0" style={{ gap: 6 }}>
                    <CircleFlag code={r.seat.country_code} logoUrl={r.seat.seatLogo} label={r.seat.country_name} size={44} decorative />
                    <CommitteeDisc src={r.seat.emblem} size={44} />
                  </span>
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 500, color: INK, lineHeight: 1.3 }}>{r.seat.country_name}</span>
                    {r.seat.committee_id ? (
                      <button
                        type="button"
                        title="Open this committee"
                        onClick={(e) => { e.stopPropagation(); if (r.seat?.committee_id) onOpenCommittee(r.seat.committee_id); }}
                        className="self-start text-left [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#1B3828', textDecoration: 'underline', textUnderlineOffset: 3, lineHeight: 1.35 }}
                      >
                        {r.seat.committee_label}
                      </button>
                    ) : (
                      <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, lineHeight: 1.35 }}>
                        {r.seat.committee_label}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
                  {r.role === 'faculty-advisor' ? 'Advisors have no seat' : 'No seat yet'}
                </span>
              )}
            </div>

            {/* Position paper (V2) */}
            {DELEGATIONS_V2_DB && (
              <div className="pl-[66px] @[760px]:pl-0">
                {r.paper && <ToneWord word={r.paper.word} tone={r.paper.tone} />}
              </div>
            )}

            {/* Payment */}
            <div className="pl-[66px] @[760px]:pl-0">
              {r.pay && <ToneWord word={r.pay.word} tone={r.pay.tone} />}
            </div>

            {/* Menu, or the swap pick */}
            <div className="absolute right-6 top-[23px] @[760px]:static flex justify-end">
              {swap.on ? (
                selectable ? (
                  <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${selected ? '#1B3828' : 'rgba(27,56,40,0.3)'}`, background: selected ? '#1B3828' : 'transparent' }}>
                    {selected && <Check size={12} strokeWidth={2} color="#FFFFFF" aria-hidden />}
                  </span>
                ) : null
              ) : (
                <MemberMenu
                  member={{
                    application_id: r.application_id, name: r.name, role: r.role, is_me: r.is_me, user_id: r.user_id,
                    seat: r.seat?.committee_id && r.seat.country_code ? { committee_id: r.seat.committee_id, country_code: r.seat.country_code } : null,
                  }}
                  societyId={societyId}
                  conferenceId={conferenceId}
                  openSeats={openSeats}
                  onDone={onChanged}
                />
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
