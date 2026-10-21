'use client';

// The Delegations tab inside Applications (taste board 2B, 19 Oct 2026; owner
// 21 Oct 2026): full-width ROWS, one delegation per line, all the same height
// (the card grid was too small). Each row leads with the delegation: a big
// round crest, the name bold, "City, Country" small on ONE line with the round
// flag (short names for long countries: UK, USA, UAE); then, using the width,
// its leaders (avatar and name), how many members, and the allocations given
// (meter, given and filled), then the next step. Expected / Joined / Paid stay
// in the pop-up's quiet row. A rail holds the totals and how delegations get
// allocations. The whole row opens the delegation pop-up (a small chevron says
// so; "Give allocations" sits under the allocations meter when some are still
// to give). Under 900px a row stacks. Names split on two rows
// (DelegationNameLines); members big with the expected size small beneath.
// Decisions: docs/conferences/delegations.md.
//
// Where every number comes from (useDelegationsData.ts, delegationRows.ts):
//   Expected      the expected size the leaders gave (live pledges plus advisors
//                 coming), else the spots paid for; 0 when neither exists
//   Joined        members coming or applying (any role, attending)
//   Paid          the ledger: settled delegation spots of live leaders plus delegates
//                 who paid their own ticket or were waived (paidSpotsBySociety, the twin
//                 of _society_paid_delegate_spots; the allocation page uses the same)
//   Seats given   allocations carrying the delegation (block seats) or one of its
//                 members; a double delegation counts as 2
//   Filled        of those, seats with a person on them
//
// Writes: "Leaders can reshuffle their seats" is conferences.allocation_swap_mode
// ('self_serve' on, 'request' off), the same verified update Settings → Delegations
// makes (saveSwapMode in settings/page.tsx: .select('id'), exactly one row, then
// refreshConferenceQuiet). The seat limit and the "Until" date are behind
// DELEGATIONS_V2_DB (v2.ts).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { DatePicker } from '@/components/DatePicker';
import DelegationCrest from '@/components/DelegationCrest';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { memberName, type DelegationMemberLite } from '../delegationRows';
import { useDelegationsData } from './useDelegationsData';
import DelegationPopup, { leadersOf, type DelegationTab } from './DelegationPopup';
import { DELEGATIONS_V2_DB, SEAT_LIMIT_OPTIONS, readDelegationSettings, writeDelegationSetting, type SeatLimit } from './v2';
import {
  BTN_CLASS, DelegationNameLines, FONT, FOREST, HAIRLINE, INK, INK_SOFT, PlaceLine, ROW_LINE, RoundAvatar, STROKE, SeatMeter, SkeletonRows,
  cardStyle, linkStyle,
} from './kit';

/** Delegation | Leaders | Members | Allocations | chevron. Every column but the
 *  counts shrinks (minmax 0) and wraps, so nothing is pushed past the card at
 *  1280 (owner, 21 Oct 2026: the Open button was cut off and the row was mostly
 *  blank). The whole row opens the pop-up; the chevron says so. */
const ROW_COLUMNS = 'minmax(0, 1.55fr) minmax(0, 1.15fr) max-content minmax(150px, 1fr) 20px';

export interface DelegationsTabProps<M extends DelegationMemberLite> {
  conference: { id: string; slug: string; fee_currency: string };
  /** Every application the page loaded (all statuses). */
  applications: M[];
  /** Open drafts; those naming a delegation count as still applying. */
  drafts: { society_id: string | null }[];
  /** The page's debounced, lower-cased search term. */
  search: string;
  /** Open this delegation's pop-up when the value changes (?delegation=, a person row's delegation link). */
  focusId: string | null;
  /** A write changed applications: the page re-reads them silently. */
  onChanged: () => void;
}

export default function DelegationsTab<M extends DelegationMemberLite>(props: DelegationsTabProps<M>) {
  const { conference, applications, drafts, search, focusId, onChanged } = props;
  const { conference: managed, refreshConferenceQuiet } = useManage();
  const data = useDelegationsData<M>({ conferenceId: conference.id, currency: conference.fee_currency, applications, drafts });

  const [open, setOpen] = useState<{ id: string; tab: DelegationTab } | null>(focusId ? { id: focusId, tab: 'people' } : null);
  // A delegation handed in by the page opens its pop-up. Adjusted during render, not in an effect.
  const [seenFocus, setSeenFocus] = useState(focusId);
  if (focusId !== seenFocus) {
    setSeenFocus(focusId);
    if (focusId) setOpen({ id: focusId, tab: 'people' });
  }

  const visible = useMemo(() => data.rows.filter(r => {
    if (!search) return true;
    const hay = [r.name, r.city ?? '', ...r.members.map(m => `${memberName(m)} ${m.profiles?.email ?? m.invited_email ?? ''}`)]
      .join(' ').toLowerCase();
    return hay.includes(search);
  }), [data.rows, search]);

  const totals = useMemo(() => data.rows.reduce((t, r) => ({
    expected: t.expected + (r.expected ?? 0),
    paid: t.paid + r.paid,
    given: t.given + r.seatsGiven,
    filled: t.filled + r.seatsFilled,
    need: t.need + r.needSeats,
  }), { expected: 0, paid: 0, given: 0, filled: 0, need: 0 }), [data.rows]);

  // ── Settings card ─────────────────────────────────────────────────────
  const swapMode = managed?.allocation_swap_mode ?? 'request';
  const [swapSaving, setSwapSaving] = useState(false);
  const [limit, setLimit] = useState<SeatLimit>('none');
  const [until, setUntil] = useState<string>('');
  const [v2Saving, setV2Saving] = useState(false);
  const v2Loaded = useRef(false);

  useEffect(() => {
    if (!DELEGATIONS_V2_DB || v2Loaded.current) return;
    v2Loaded.current = true;
    let cancelled = false;
    void readDelegationSettings(conference.id).then(s => {
      if (cancelled || !s) return;
      setLimit(s.limit);
      setUntil(s.until ?? '');
    });
    return () => { cancelled = true; };
  }, [conference.id]);

  async function saveSwap(on: boolean) {
    if (swapSaving) return;
    // Off goes back to the default 'request' (leaders ask, the team moves seats), never 'off'.
    const mode = on ? 'self_serve' : 'request';
    setSwapSaving(true);
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) { notifyErr('Your session has expired, please refresh and sign in again.', 'applications'); return; }
      const { data: rows, error } = await supabase.from('conferences')
        .update({ allocation_swap_mode: mode })
        .eq('id', conference.id)
        .select('id');
      if (error || !rows || rows.length !== 1) { notifyErr(friendlyError(error, 'That setting was not saved. Try again.'), 'applications'); return; }
      await refreshConferenceQuiet();
      notifyOk(on ? 'Leaders can reshuffle their own allocations.' : 'Only your team moves allocations now.', 'applications');
    } catch (e) {
      notifyErr(friendlyError(e, 'That setting was not saved. Try again.'), 'applications');
    } finally {
      setSwapSaving(false);
    }
  }

  async function saveV2(patch: { delegation_seat_limit?: SeatLimit; delegation_reshuffle_until?: string | null }, undo: () => void) {
    setV2Saving(true);
    const r = await writeDelegationSetting(conference.id, patch);
    setV2Saving(false);
    if (!r.ok) { undo(); notifyErr(r.error, 'applications'); return; }
    notifyOk('Saved', 'applications');
  }

  function openRow(id: string, tab: DelegationTab) {
    setOpen({ id, tab });
  }

  const reshuffleOn = swapMode === 'self_serve';

  return (
    <div className="flex flex-col xl:flex-row items-stretch xl:items-start" style={{ gap: 24 }}>
      {/* ── The cards ── */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 12 }}>
        {data.loading && <div style={{ ...cardStyle, padding: '16px 20px' }}><SkeletonRows rows={4} height={64} /></div>}

        {data.loadFailed && (
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK }}>The delegations could not be loaded.</p>
            <button type="button" onClick={() => { void data.reload(); }} className={BTN_CLASS} style={{ ...linkStyle, marginTop: 6 }}>Try again</button>
          </div>
        )}

        {!data.loading && !data.loadFailed && data.rows.length === 0 && (
          <div style={{ ...cardStyle, padding: '28px 24px' }}>
            <p style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>No delegations yet</p>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, marginTop: 4 }}>A head delegate or a faculty advisor creates one when they apply.</p>
          </div>
        )}

        {!data.loading && data.rows.length > 0 && visible.length === 0 && (
          <p style={{ ...cardStyle, padding: '22px 24px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No delegation matches that search.</p>
        )}

        {visible.length > 0 && (
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div className="dlgV2Head" style={{ gridTemplateColumns: ROW_COLUMNS, gap: 18, padding: '12px 20px', borderBottom: `1px solid ${ROW_LINE}` }}>
              {['Delegation', 'Leaders', 'Members', 'Allocations given', ''].map((h, i) => (
                <span key={i} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>
              ))}
            </div>
            {visible.map((r, i) => {
              const giveSeats = r.seatsGiven < r.paid;
              const { shown, total } = leadersOf(r);
              const more = Math.max(0, total - shown.length);
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${r.name}`}
                  onClick={() => openRow(r.id, 'people')}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRow(r.id, 'people'); } }}
                  className="dlgV2Row focus:outline-none"
                  style={{ gridTemplateColumns: ROW_COLUMNS, gap: 18, padding: '14px 20px', borderTop: i === 0 ? 'none' : `1px solid ${ROW_LINE}`, cursor: 'pointer' }}
                >
                  <div className="flex items-center min-w-0" style={{ gap: 12 }}>
                    <DelegationCrest name={r.name} logoUrl={r.logoUrl} size={52} />
                    <div className="flex flex-col min-w-0" style={{ gap: 4 }}>
                      <DelegationNameLines name={r.name} size={17} restSize={12.5} />
                      <PlaceLine city={r.city} countryCode={r.countryCode} short oneLine size={14} fontSize={12} />
                    </div>
                  </div>

                  <div className="flex flex-col min-w-0" style={{ gap: 6 }}>
                    {shown.length === 0 ? (
                      <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>No leader accepted yet</span>
                    ) : shown.map(l => (
                      <span key={l.id} className="flex items-center gap-2 min-w-0" title={l.role}>
                        <RoundAvatar name={l.name} url={l.avatarUrl} size={26} seed={l.id} />
                        <span className="flex flex-col min-w-0" style={{ lineHeight: 1.2 }}>
                          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 500, color: INK }}>{l.name}</span>
                          <span style={{ fontFamily: FONT, fontSize: 11.5, color: INK_SOFT }}>{l.role}</span>
                        </span>
                      </span>
                    ))}
                    {more > 0 && (
                      <span style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT, paddingLeft: 34 }}>+{more} more</span>
                    )}
                  </div>

                  {/* Members big, the expected size small beneath (owner, 21 Oct 2026). */}
                  <div className="flex flex-col" style={{ gap: 2, minWidth: 84 }}>
                    <span className="inline-flex items-baseline" style={{ gap: 5 }}>
                      <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{r.registered}</span>
                      <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{r.registered === 1 ? 'member' : 'members'}</span>
                    </span>
                    {r.expected != null && (
                      <span style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{r.expected} expected</span>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0" style={{ gap: 6 }}>
                    <SeatMeter given={r.seatsGiven} filled={r.seatsFilled} paid={r.paid} height={6} />
                    <span style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                      <b style={{ color: INK, fontWeight: 600 }}>{r.seatsGiven}</b> {r.seatsGiven === 1 ? 'allocation' : 'allocations'} · <b style={{ color: INK, fontWeight: 600 }}>{r.seatsFilled}</b> filled
                    </span>
                    {giveSeats && (
                      <Link href={`/manage/${conference.slug}/assignment?mode=delegation-seats&society=${encodeURIComponent(r.id)}`}
                        className={`${BTN_CLASS} self-start`} style={{ ...linkStyle, fontSize: 13 }}
                        onClick={e => e.stopPropagation()}>
                        Give allocations
                      </Link>
                    )}
                  </div>

                  <span aria-hidden className="dlgV2Chevron flex items-center justify-end" style={{ color: INK_SOFT }}>
                    <ChevronRight size={18} strokeWidth={STROKE} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {data.seatsUnavailable && (
          <p style={{ padding: '4px 4px', fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>The allocations could not be read just now, so allocation counts may be out of date.</p>
        )}
      </div>

      {/* ── The rail ── */}
      <div className="flex flex-col w-full xl:w-[330px] xl:flex-none" style={{ gap: 20 }}>
        <div className="flex flex-col" style={{ ...cardStyle, padding: 22, gap: 14 }}>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontFamily: FONT, fontSize: 30, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{totals.need}</span>
            <span style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT }}>paid {totals.need === 1 ? 'spot' : 'spots'} without an allocation</span>
          </div>
          <div className="flex flex-col" style={{ gap: 8, fontFamily: FONT, fontSize: 14 }}>
            {[
              ['Expected', totals.expected],
              ['Paid', totals.paid],
              ['Allocations given', totals.given],
              ['Allocations filled by a person', totals.filled],
            ].map(([label, n]) => (
              <div key={label as string} className="flex justify-between gap-3">
                <span style={{ color: INK_SOFT }}>{label}</span>
                <b style={{ color: INK, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{n}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col" style={{ ...cardStyle, padding: 22, gap: 12 }}>
          {DELEGATIONS_V2_DB && (
            <>
              <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>How many allocations a delegation can get</span>
              <div role="radiogroup" aria-label="How many allocations a delegation can get" className="flex flex-col" style={{ gap: 8 }}>
                {SEAT_LIMIT_OPTIONS.map(o => {
                  const active = limit === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={v2Saving}
                      onClick={() => {
                        if (active) return;
                        const prev = limit;
                        setLimit(o.value);
                        void saveV2({ delegation_seat_limit: o.value }, () => setLimit(prev));
                      }}
                      className={`${BTN_CLASS} flex items-center text-left`}
                      style={{
                        gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 14, color: INK,
                        border: `1px solid ${active ? FOREST : 'rgba(27,56,40,0.12)'}`, background: active ? '#F5F8F5' : '#FFFFFF',
                      }}
                    >
                      <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box', border: active ? `5px solid ${FOREST}` : '1.5px solid rgba(27,56,40,0.35)' }} />
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <div aria-hidden style={{ height: 1, background: HAIRLINE, margin: '4px 0' }} />
            </>
          )}

          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <span id="dlg-reshuffle" style={{ fontFamily: FONT, fontSize: 14, color: INK }}>Leaders can reshuffle their allocations</span>
            <button
              type="button"
              role="switch"
              aria-checked={reshuffleOn}
              aria-labelledby="dlg-reshuffle"
              disabled={swapSaving || !managed}
              onClick={() => { void saveSwap(!reshuffleOn); }}
              className={BTN_CLASS}
              style={{
                width: 40, height: 24, borderRadius: 99, border: 'none', position: 'relative', flexShrink: 0, cursor: swapSaving ? 'wait' : 'pointer',
                background: reshuffleOn ? FOREST : 'rgba(27,56,40,0.22)', opacity: swapSaving ? 0.7 : 1, transition: 'background-color 160ms',
              }}
            >
              <span aria-hidden style={{ position: 'absolute', top: 3, left: reshuffleOn ? 19 : 3, width: 18, height: 18, borderRadius: '50%', background: '#FFFFFF', transition: 'left 160ms cubic-bezier(0.22,1,0.36,1)' }} />
            </button>
          </div>

          {DELEGATIONS_V2_DB && (
            <div className="flex items-center justify-between" style={{ gap: 12, fontFamily: FONT, fontSize: 14 }}>
              <span style={{ color: INK_SOFT }}>Until</span>
              <div style={{ width: 170 }}>
                <DatePicker
                  futureOnly
                  value={until}
                  disabled={!reshuffleOn || v2Saving}
                  placeholder="No end date"
                  clearable
                  onChange={iso => {
                    const prev = until;
                    setUntil(iso);
                    void saveV2({ delegation_reshuffle_until: iso || null }, () => setUntil(prev));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dlgV2Head { display: none; }
        .dlgV2Row { display: flex; flex-direction: column; align-items: stretch; transition: background-color 140ms; }
        .dlgV2Chevron { display: none !important; }
        @media (min-width: 900px) {
          .dlgV2Head { display: grid; align-items: center; }
          .dlgV2Row { display: grid; align-items: center; }
          .dlgV2Chevron { display: flex !important; }
        }
        .dlgV2Chevron { transition: transform 160ms cubic-bezier(0.22,1,0.36,1); }
        @media (hover: hover) { .dlgV2Row:hover .dlgV2Chevron { transform: translateX(2px); color: ${FOREST}; } }
        @media (hover: hover) { .dlgV2Row:hover { background: #FBF9F4; } }
        .dlgV2Row:focus-visible { outline: 2px solid #B6871F !important; outline-offset: -2px; }
      `}</style>

      {open && (
        <DelegationPopup<M>
          conference={conference}
          key={`${open.id}:${open.tab}`}
          societyId={open.id}
          initialTab={open.tab}
          data={data}
          onChanged={onChanged}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

