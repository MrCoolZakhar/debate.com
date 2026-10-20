'use client';

// The Delegations tab inside Applications (taste board 2B, 19 Oct 2026): one
// table of delegations with their expected size, who joined, the spots paid
// for and a meter of seats given against paid spots; a rail with the totals
// and how delegations get seats. A row opens the delegation pop-up.
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
import { useManage } from '@/app/manage/[slug]/layout';
import { DatePicker } from '@/components/DatePicker';
import DelegationCrest from '@/components/DelegationCrest';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { memberName, type DelegationMemberLite } from '../delegationRows';
import { useDelegationsData } from './useDelegationsData';
import DelegationPopup, { type DelegationTab } from './DelegationPopup';
import { DELEGATIONS_V2_DB, SEAT_LIMIT_OPTIONS, readDelegationSettings, writeDelegationSetting, type SeatLimit } from './v2';
import {
  BTN_CLASS, FONT, FOREST, HAIRLINE, INK, INK_SOFT, PlaceLine, ROW_LINE, SeatMeter, SkeletonRows,
  cardStyle, linkStyle, smallPrimaryBtn,
} from './kit';

const GRID = 'minmax(0,1fr) 90px 90px 90px 260px 120px';

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
      notifyOk(on ? 'Leaders can reshuffle their own seats.' : 'Only your team moves seats now.', 'applications');
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
      {/* ── The table ── */}
      <div className="flex-1 min-w-0" style={{ ...cardStyle, padding: '6px 0 10px' }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 900 }}>
            <div className="grid" style={{ gridTemplateColumns: GRID, gap: 16, padding: '14px 24px', borderBottom: `1px solid ${HAIRLINE}` }}>
              {['Delegation', 'Expected', 'Joined', 'Paid', 'Seats given', ''].map((h, i) => (
                <span key={i} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>
              ))}
            </div>

            {data.loading && <div style={{ padding: '16px 24px' }}><SkeletonRows rows={6} height={52} /></div>}

            {data.loadFailed && (
              <div style={{ padding: '22px 24px' }}>
                <p style={{ fontFamily: FONT, fontSize: 14, color: INK }}>The delegations could not be loaded.</p>
                <button type="button" onClick={() => { void data.reload(); }} className={BTN_CLASS} style={{ ...linkStyle, marginTop: 6 }}>Try again</button>
              </div>
            )}

            {!data.loading && !data.loadFailed && data.rows.length === 0 && (
              <div style={{ padding: '28px 24px' }}>
                <p style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>No delegations yet</p>
                <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, marginTop: 4 }}>A head delegate or a faculty advisor creates one when they apply.</p>
              </div>
            )}

            {!data.loading && data.rows.length > 0 && visible.length === 0 && (
              <p style={{ padding: '22px 24px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No delegation matches that search.</p>
            )}

            {visible.map(r => {
              const giveSeats = r.seatsGiven < r.paid;
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${r.name}`}
                  onClick={() => openRow(r.id, 'people')}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRow(r.id, 'people'); } }}
                  className="dlgV2Row grid items-center focus:outline-none"
                  style={{ gridTemplateColumns: GRID, gap: 16, padding: '14px 24px', borderBottom: `1px solid ${ROW_LINE}`, cursor: 'pointer' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DelegationCrest name={r.name} logoUrl={r.logoUrl} size={44} />
                    <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
                      <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 18, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{r.name}</span>
                      <PlaceLine city={r.city} countryCode={r.countryCode} />
                    </div>
                  </div>
                  <Num n={r.expected ?? 0} soft={r.expected == null} />
                  <Num n={r.registered} />
                  <Num n={r.paid} />
                  <div className="flex flex-col" style={{ gap: 6 }}>
                    <SeatMeter given={r.seatsGiven} filled={r.seatsFilled} paid={r.paid} />
                    <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                      <b style={{ color: INK, fontWeight: 600 }}>{r.seatsGiven}</b> of {r.paid} paid · <b style={{ color: INK, fontWeight: 600 }}>{r.seatsFilled}</b> filled
                    </span>
                  </div>
                  <div className="flex justify-end">
                    {giveSeats ? (
                      <Link href={`/manage/${conference.slug}/assignment?mode=delegation-seats&society=${encodeURIComponent(r.id)}`}
                        className={BTN_CLASS} style={{ ...smallPrimaryBtn, textDecoration: 'none' }}
                        onClick={e => e.stopPropagation()}>
                        Give seats
                      </Link>
                    ) : (
                      <button type="button" className={BTN_CLASS} style={{ ...linkStyle, fontSize: 14 }}
                        onClick={e => { e.stopPropagation(); openRow(r.id, 'people'); }}>
                        Open
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {data.seatsUnavailable && (
          <p style={{ padding: '12px 24px 4px', fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>The seats could not be read just now, so seat counts may be out of date.</p>
        )}
      </div>

      {/* ── The rail ── */}
      <div className="flex flex-col w-full xl:w-[330px] xl:flex-none" style={{ gap: 20 }}>
        <div className="flex flex-col" style={{ ...cardStyle, padding: 22, gap: 14 }}>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontFamily: FONT, fontSize: 30, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{totals.need}</span>
            <span style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT }}>paid {totals.need === 1 ? 'spot' : 'spots'} without a seat</span>
          </div>
          <div className="flex flex-col" style={{ gap: 8, fontFamily: FONT, fontSize: 14 }}>
            {[
              ['Expected', totals.expected],
              ['Paid', totals.paid],
              ['Seats given', totals.given],
              ['Seats filled by a person', totals.filled],
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
              <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>How many seats a delegation can get</span>
              <div role="radiogroup" aria-label="How many seats a delegation can get" className="flex flex-col" style={{ gap: 8 }}>
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
            <span id="dlg-reshuffle" style={{ fontFamily: FONT, fontSize: 14, color: INK }}>Leaders can reshuffle their seats</span>
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
        .dlgV2Row { transition: background-color 180ms cubic-bezier(0.22,1,0.36,1); }
        .dlgV2Row:hover { background-color: rgba(27,56,40,0.025); }
        .dlgV2Row:focus-visible { box-shadow: inset 0 0 0 2px #B6871F; }
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

function Num({ n, soft = false }: { n: number; soft?: boolean }) {
  return <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: soft ? INK_SOFT : INK, fontVariantNumeric: 'tabular-nums' }}>{n}</span>;
}
