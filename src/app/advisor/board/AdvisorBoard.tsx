'use client';

// ============================================================
// /advisor: the Faculty Advisor board (24 Sep 2026).
//
// One job made effortless: be in the room when your student speaks. Every followed
// student is one card, ordered by urgency (On the floor, Coming up, In the room, Needs a
// look, Rooms not in session). A reminder fires once per turn when a student is two
// speakers away and when they start speaking.
//
// Rooms come from two places: codes typed on this device (store.ts, names stay here),
// and a signed-in advisor's conference delegation (useMyAdvisorDelegation, verified).
// Everything is read anonymously; nothing here writes to a session.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, BellOff, Plus, Sun, SunDim, Pencil, ArrowUpRight, Mic, X, DoorOpen } from 'lucide-react';
import SessionLanguageMenu from '@/components/SessionLanguageMenu';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { useMyAdvisorDelegation } from '@/lib/advisorDelegation';
import { getCommitteeDisplayName, committeeDisplayName } from '@/lib/presetNames';
import { serverNow } from '@/lib/serverClock';
import { useBoardData } from '@/lib/advisorBoard/data';
import { deriveSeat, inSession, roomMode, sectionOf, urgency, type BoardSection } from '@/lib/advisorBoard/derive';
import { useAdvisorReminders, type ActiveReminder, type BoardSeatView } from '@/lib/advisorBoard/reminders';
import { markRoomsEnded, markSeen, normaliseCode, setBoardPref, useBoardPrefs, useBoardState, type BoardRoom } from '@/lib/advisorBoard/store';
import type { FollowedSeat, RoomData } from '@/lib/advisorBoard/types';
import { useWakeLock, useWakeLockSupported } from '@/lib/advisorBoard/wakeLock';
import type { TranslationKey } from '@/lib/translations';
import AddRoomSheet from './AddRoomSheet';
import StudentSheet from './StudentSheet';
import { MODE_KEY, SeatCard, seatTitle } from './SeatCard';
import { C, FONT, SHADOW } from './tokens';

const STALE_AFTER_MS = 30_000;
const lc = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

const SECTION_ORDER: BoardSection[] = ['floor', 'coming', 'room', 'look', 'out'];
const SECTION_KEY: Record<BoardSection, TranslationKey> = {
  floor: 'adv_section_floor',
  coming: 'adv_section_coming',
  room: 'adv_section_room',
  look: 'adv_section_look',
  out: 'adv_section_out',
};

const GLOBAL_CSS = `
.adv-focus:focus{outline:none}
.adv-focus:focus-visible{outline:none;box-shadow:0 0 0 3px ${C.cream},0 0 0 5px ${C.deepGold} !important}
.adv-input{outline:none;box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.16)}
.adv-input:focus{box-shadow:inset 0 0 0 2px ${C.forest}}
@media (prefers-reduced-motion: no-preference){
  .adv-sheet-panel{animation:adv-up 220ms cubic-bezier(0.32,0.72,0,1)}
  .adv-sheet-backdrop{animation:adv-fade 180ms ease-out}
  .adv-banner{animation:adv-drop 260ms cubic-bezier(0.32,0.72,0,1)}
  .adv-pulse{animation:adv-pulse 1.6s ease-in-out infinite}
}
@keyframes adv-up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
@keyframes adv-fade{from{opacity:0}to{opacity:1}}
@keyframes adv-drop{from{transform:translateY(-10px);opacity:0}to{transform:none;opacity:1}}
@keyframes adv-pulse{0%,100%{opacity:1}50%{opacity:.35}}
`;

export default function AdvisorBoard() {
  const t = useT();
  const { language } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const board = useBoardState();
  const prefs = useBoardPrefs();
  const delegation = useMyAdvisorDelegation();
  const wakeSupported = useWakeLockSupported();
  const wakeHeld = useWakeLock(prefs.keepAwake && wakeSupported);

  // ── ?add=CODE (from /join and the room view) opens the add flow prefilled ──
  const addParam = normaliseCode(params.get('add') ?? '');
  const [addOpen, setAddOpen] = useState<{ code: string | null; editing: BoardRoom | null } | null>(null);
  const [handledAdd, setHandledAdd] = useState<string | null>(null);
  if (addParam.length === 6 && handledAdd !== addParam) {
    setHandledAdd(addParam);
    // `editing` is resolved at render (addEditing below), not here: on the first render
    // the device store still reads its server snapshot (no rooms), so a room already on
    // the board would open as a NEW room and Save would drop its picks and names.
    setAddOpen({ code: addParam, editing: null });
  }
  const addEditing = addOpen
    ? addOpen.editing ?? (addOpen.code ? board.rooms.find((r) => r.code === addOpen.code) ?? null : null)
    : null;
  useEffect(() => {
    if (addParam.length === 6) router.replace('/advisor', { scroll: false });
  }, [addParam, router]);

  // ── Everything the board follows ────────────────────────────────────────
  const conferenceCodes = useMemo(() => {
    const set = new Set<string>();
    for (const c of delegation.conferences) {
      for (const s of c.seats) if (s.sessionCode) set.add(normaliseCode(s.sessionCode));
      if (c.seats.length === 0) for (const r of c.rooms) set.add(normaliseCode(r.sessionCode));
    }
    return [...set];
  }, [delegation.conferences]);
  // The detailed room view (/advisor/CODE) of a CONFERENCE room admits the conference's
  // faculty advisors, observers and organisers only (verifyConferenceAccess). A head
  // delegate's seats are on the board, but a link would land them on "not for you".
  const verifiedCodes = useMemo(() => {
    const set = new Set<string>();
    for (const c of delegation.conferences) {
      if (c.myRole !== 'faculty-advisor' && c.myRole !== 'observer') continue;
      for (const s of c.seats) if (s.sessionCode) set.add(normaliseCode(s.sessionCode));
      for (const r of c.rooms) set.add(normaliseCode(r.sessionCode));
    }
    return set;
  }, [delegation.conferences]);
  const codes = useMemo(() => [...new Set([...board.rooms.map((r) => r.code), ...conferenceCodes])], [board.rooms, conferenceCodes]);
  const data = useBoardData(codes);

  useEffect(() => { if (conferenceCodes.length) markSeen(conferenceCodes); }, [conferenceCodes]);
  useEffect(() => {
    const ended = board.rooms.filter((r) => data.rooms[r.code]?.endedAt).map((r) => r.code);
    if (ended.length) markRoomsEnded(ended);
  }, [board.rooms, data.rooms]);

  const seats: FollowedSeat[] = useMemo(() => {
    const out: FollowedSeat[] = [];
    const covered = new Set<string>();
    for (const c of delegation.conferences) {
      const label = c.conferenceAcronym || c.conferenceName;
      for (const s of c.seats) {
        const code = s.sessionCode ? normaliseCode(s.sessionCode) : null;
        if (code) covered.add(`${code}|${lc(s.countryName)}`);
        out.push({
          key: `conf|${c.conferenceId}|${code ?? s.committeeName}|${lc(s.countryName)}|${s.seat}`,
          code,
          country: s.countryName,
          countryCode: s.countryCode,
          name: s.studentName,
          verified: true,
          conferenceId: c.conferenceId,
          conferenceLabel: label,
          committeeName: s.committeeName,
          committeeAbbreviation: s.committeeAbbreviation,
          followingSince: (code && board.seen[code]) || 0,
        });
      }
    }
    for (const r of board.rooms) {
      for (const f of r.follows) {
        if (covered.has(`${r.code}|${lc(f.country)}`)) continue;
        out.push({
          key: `dev|${r.code}|${lc(f.country)}`,
          code: r.code,
          country: f.country,
          countryCode: null,
          name: f.name ?? null,
          verified: false,
          conferenceId: null,
          conferenceLabel: null,
          committeeName: '',
          committeeAbbreviation: null,
          followingSince: r.addedAt,
        });
      }
    }
    return out;
  }, [delegation.conferences, board.rooms, board.seen]);

  const views: BoardSeatView[] = useMemo(() => seats.map((seat) => {
    const room = seat.code ? data.rooms[seat.code] ?? null : null;
    const loading = !!seat.code && !room && !data.missing.has(seat.code);
    const state = deriveSeat(room, seat.country, seat.countryCode, !!seat.code, loading);
    return { seat, state, fetchedAt: room?.fetchedAt ?? 0, code: room ? seat.code : null };
  }), [seats, data.rooms, data.missing]);

  // ── Reminders ───────────────────────────────────────────────────────────
  const labelOf = useCallback((v: BoardSeatView) => seatTitle(v.seat, language), [language]);
  const titleOf = useCallback((r: ActiveReminder) => (r.kind === 'speaking'
    ? t('adv_title_speaking', { name: r.label })
    : r.ahead <= 1 ? t('adv_title_next', { name: r.label }) : t('adv_title_soon', { name: r.label, n: r.ahead })), [t]);
  const reminders = useAdvisorReminders({ views, enabled: prefs.reminders, subscribed: data.subscribed, labelOf, titleOf });
  const topReminder = reminders.active[0] ?? null;

  // ── Sheets ──────────────────────────────────────────────────────────────
  const [openSeat, setOpenSeat] = useState<string | null>(null);
  const onOpen = useCallback((key: string) => setOpenSeat(key), []);
  const openView = openSeat ? views.find((v) => v.seat.key === openSeat) ?? null : null;

  const roomHrefFor = useCallback((seat: FollowedSeat, room: RoomData | null): string | null => {
    if (!seat.code) return null;
    if (verifiedCodes.has(seat.code)) return `/advisor/${seat.code}`;
    // The room view of a conference room is gated to verified advisors: no link for a code.
    if (room && room.sessionOrigin === 'standalone') return `/advisor/${seat.code}`;
    return null;
  }, [verifiedCodes]);

  // ── Sections ────────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    const map = new Map<BoardSection, BoardSeatView[]>();
    for (const v of views) {
      const s = sectionOf(v.state);
      const arr = map.get(s) ?? [];
      arr.push(v);
      map.set(s, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => urgency(a.state) - urgency(b.state) || seatTitle(a.seat, language).localeCompare(seatTitle(b.seat, language), language));
    }
    return map;
  }, [views, language]);

  const observerConferences = delegation.conferences.filter((c) => c.seats.length === 0 && c.rooms.length > 0);
  const empty = seats.length === 0 && board.rooms.length === 0 && observerConferences.length === 0;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: C.ivory, fontFamily: FONT, color: C.ink }}>
      <style>{GLOBAL_CSS}</style>
      <header className="sticky top-0 z-30" style={{ backgroundColor: 'rgba(237,231,216,0.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: `0 1px 0 ${C.hairline}` }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
          <Link href="/" aria-label={t('adv_home')} className="adv-focus shrink-0 rounded-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gavelling-mark.png" alt="" width={34} height={34} style={{ display: 'block' }} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.015em', color: C.ink, lineHeight: 1.1 }}>{t('adv_board_title')}</h1>
            <Freshness lastOkAt={data.lastOkAt} subscribed={data.subscribed} active={codes.length > 0} />
          </div>
          <HeaderButton icon={<Plus size={20} strokeWidth={2.6} aria-hidden />} label={t('adv_add_room')} primary onClick={() => setAddOpen({ code: null, editing: null })} />
        </div>
        {topReminder && (
          <ReminderBanner reminder={topReminder} more={reminders.active.length - 1}
            onOpen={() => { setOpenSeat(topReminder.seatKey); reminders.dismiss(topReminder.key); }}
            onDismiss={() => reminders.dismiss(topReminder.key)} />
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-3">
        <div className="mb-4 flex items-center gap-2" role="toolbar" aria-label={t('adv_board_title')}>
          <ToggleButton icon={prefs.reminders ? <Bell size={18} aria-hidden /> : <BellOff size={18} aria-hidden />}
            label={prefs.reminders ? t('adv_reminders_on') : t('adv_reminders_off')} pressed={prefs.reminders}
            onClick={() => setBoardPref('reminders', !prefs.reminders)} title={t('adv_reminders_hint')} />
          {wakeSupported && (
            <ToggleButton icon={prefs.keepAwake ? <Sun size={18} aria-hidden /> : <SunDim size={18} aria-hidden />}
              label={t('adv_keep_awake')} pressed={prefs.keepAwake}
              onClick={() => setBoardPref('keepAwake', !prefs.keepAwake)} title={wakeHeld ? t('adv_keep_awake_on') : t('adv_keep_awake_hint')} />
          )}
          <span className="ms-auto"><SessionLanguageMenu /></span>
        </div>
        {data.failed && codes.length > 0 && (
          <p role="status" className="mb-3 rounded-xl px-3 py-2" style={{ backgroundColor: C.dangerTint, color: C.danger, fontSize: 13.5, fontWeight: 600 }}>{t('adv_read_failed')}</p>
        )}

        {empty && <EmptyState onAdd={() => setAddOpen({ code: null, editing: null })} />}

        {SECTION_ORDER.map((sec) => {
          const list = sections.get(sec);
          if (!list || list.length === 0) return null;
          return (
            <section key={sec} className="mb-6" aria-labelledby={`adv-sec-${sec}`}>
              <h2 id={`adv-sec-${sec}`} className="mb-2 flex items-baseline gap-2 px-1" style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: sec === 'floor' ? C.forest : sec === 'look' ? C.danger : C.forestSoft }}>
                {t(SECTION_KEY[sec])}
                <span style={{ fontWeight: 600, color: C.inkSoft, letterSpacing: 0 }}>{list.length}</span>
              </h2>
              <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {list.map((v) => {
                  const room = v.seat.code ? data.rooms[v.seat.code] ?? null : null;
                  return (
                    <li key={v.seat.key}>
                      <SeatCard seat={v.seat} state={v.state} committeeName={room?.name ?? v.seat.committeeName}
                        delegate={v.state.delegate} onOpen={onOpen} highlight={reminders.active.some((r) => r.seatKey === v.seat.key)} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {observerConferences.map((c) => (
          <section key={c.conferenceId} className="mb-6">
            <h2 className="mb-2 px-1" style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.forestSoft }}>
              {t('adv_conference_rooms', { conference: c.conferenceAcronym || c.conferenceName })}
            </h2>
            <ul className="flex flex-col gap-2">
              {c.rooms.map((r) => {
                const code = normaliseCode(r.sessionCode);
                const room = data.rooms[code] ?? null;
                return (
                  <li key={code}>
                    <RoomRow code={code} name={committeeDisplayName(r.committeeName, r.committeeAbbreviation)} room={room} href={verifiedCodes.has(code) ? `/advisor/${code}` : null} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {board.rooms.length > 0 && (
          <section className="mt-8" aria-labelledby="adv-sec-rooms">
            <h2 id="adv-sec-rooms" className="mb-2 px-1" style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.forestSoft }}>{t('adv_section_rooms')}</h2>
            <ul className="flex flex-col gap-2">
              {board.rooms.map((r) => {
                const room = data.rooms[r.code] ?? null;
                const gone = data.loaded && data.missing.has(r.code);
                const href = room && (room.sessionOrigin === 'standalone' || verifiedCodes.has(r.code)) ? `/advisor/${r.code}` : null;
                return (
                  <li key={r.code}>
                    <RoomRow code={r.code} name={room ? getCommitteeDisplayName(room.name, language) : ''} room={room} gone={gone}
                      following={r.follows.length} href={href} onEdit={() => setAddOpen({ code: r.code, editing: r })} />
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 px-1" style={{ fontSize: 12.5, color: C.inkSoft }}>{t('adv_rooms_note')}</p>
          </section>
        )}
      </main>

      {addOpen && (
        <AddRoomSheet
          key={`${addOpen.code ?? 'new'}-${addEditing ? 'edit' : 'add'}`}
          initialCode={addOpen.code}
          editing={addEditing}
          onClose={() => setAddOpen(null)}
          onSaved={() => { setAddOpen(null); data.refresh(); }}
        />
      )}
      {openView && (
        <StudentSheet
          seat={openView.seat}
          state={openView.state}
          room={openView.seat.code ? data.rooms[openView.seat.code] ?? null : null}
          roomHref={roomHrefFor(openView.seat, openView.seat.code ? data.rooms[openView.seat.code] ?? null : null)}
          onClose={() => setOpenSeat(null)}
        />
      )}
    </div>
  );
}

function HeaderButton({ icon, label, onClick, pressed, primary, title }: {
  icon: React.ReactNode; label: string; onClick: () => void; pressed?: boolean; primary?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={title ?? label}
      className="adv-focus flex h-12 min-w-[48px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 transition-transform active:scale-[0.95]"
      style={{
        backgroundColor: primary ? C.forest : pressed ? 'rgba(27,56,40,0.08)' : 'transparent',
        color: primary ? C.gold : pressed === false ? C.inkSoft : C.forest,
      }}
    >
      {icon}
      <span className="max-w-[64px] truncate" style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.1 }}>{label}</span>
    </button>
  );
}

function ToggleButton({ icon, label, onClick, pressed, title }: {
  icon: React.ReactNode; label: string; onClick: () => void; pressed: boolean; title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={title}
      className="adv-focus flex h-10 items-center gap-1.5 rounded-full ps-3 pe-3.5 transition-transform active:scale-[0.96]"
      style={{
        backgroundColor: pressed ? C.forest : 'rgba(27,56,40,0.07)',
        color: pressed ? C.gold : C.inkSoft,
        fontSize: 13.5, fontWeight: 700,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** Data freshness: a live dot, grey "Reconnecting…" once the last read is over 30 s old. */
function Freshness({ lastOkAt, subscribed, active }: { lastOkAt: number; subscribed: boolean; active: boolean }) {
  const t = useT();
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(serverNow()), 5000);
    return () => window.clearInterval(iv);
  }, []);
  if (!active) return null;
  // Live = a read landed in the last 30 s. The 15 s poll keeps that true while the socket
  // reconnects, so a brief realtime drop does not flash "Reconnecting"; a dead connection
  // (no read for 30 s) does. Reminders separately require the channel (reminders.ts).
  const age = now - lastOkAt;
  const fresh = lastOkAt > 0 && age <= STALE_AFTER_MS && (subscribed || age <= 20_000);
  const label = lastOkAt === 0 ? t('adv_loading') : fresh ? t('adv_live') : t('adv_reconnecting');
  return (
    <span className="mt-0.5 flex items-center gap-1.5" role="status" style={{ fontSize: 12, fontWeight: 600, color: fresh ? C.forestSoft : C.inkSoft }}>
      <span aria-hidden className={fresh ? 'adv-pulse' : undefined} style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: fresh ? '#2E8B57' : '#9C9384' }} />
      {label}
    </span>
  );
}

function ReminderBanner({ reminder, more, onOpen, onDismiss }: { reminder: ActiveReminder; more: number; onOpen: () => void; onDismiss: () => void }) {
  const t = useT();
  const text = reminder.kind === 'speaking'
    ? t('adv_banner_speaking', { name: reminder.label })
    : reminder.ahead <= 1 ? t('adv_banner_next', { name: reminder.label }) : t('adv_banner_soon', { name: reminder.label, n: reminder.ahead });
  return (
    <div className="adv-banner mx-auto max-w-3xl px-4 pb-2.5">
      <div role="alert" className="flex items-center gap-2 rounded-2xl ps-2 pe-1" style={{ backgroundColor: C.forest, color: C.cream, boxShadow: SHADOW.lift }}>
        <button type="button" onClick={onOpen} className="adv-focus flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-start">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: C.gold, color: C.forest }}>
            <Mic size={18} strokeWidth={2.4} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate" style={{ fontSize: 15.5, fontWeight: 800 }}>{text}</span>
            {more > 0 && <span className="block" style={{ fontSize: 12, fontWeight: 600, color: 'rgba(250,248,243,0.75)' }}>{t('adv_banner_more', { n: more })}</span>}
          </span>
        </button>
        <button type="button" onClick={onDismiss} aria-label={t('adv_dismiss')} title={t('adv_dismiss')} className="adv-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function RoomRow({ code, name, room, gone, following, href, onEdit }: {
  code: string; name: string; room: RoomData | null; gone?: boolean; following?: number; href: string | null; onEdit?: () => void;
}) {
  const t = useT();
  const mode = gone ? 'missing' : room ? roomMode(room) : null;
  const status = mode ? t(MODE_KEY[mode]) : t('adv_loading');
  const live = mode ? inSession(mode) : false;
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: C.cream, boxShadow: SHADOW.card }}>
      <DoorOpen size={20} aria-hidden className="shrink-0" style={{ color: live ? C.forest : C.inkSoft }} />
      <div className="min-w-0 flex-1">
        <div className="truncate" style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{name || code}</div>
        <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500, color: C.inkSoft }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.1em', color: C.forestSoft }}>{code}</span>
          {' · '}{status}
          {typeof following === 'number' && <>{' · '}{t('adv_following_n', { n: following })}</>}
        </div>
      </div>
      {href && (
        <Link href={href} aria-label={t('adv_open_room')} title={t('adv_open_room')} className="adv-focus flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: C.forest }}>
          <ArrowUpRight size={19} aria-hidden className="rtl:-scale-x-100" />
        </Link>
      )}
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={t('adv_edit_room', { code })} title={t('adv_edit_room', { code })} className="adv-focus flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: C.forest }}>
          <Pencil size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl px-6 py-8 text-center" style={{ backgroundColor: C.cream, boxShadow: SHADOW.card }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: C.forest, color: C.gold }}>
        <Mic size={26} aria-hidden />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em' }}>{t('adv_empty_title')}</h2>
      <p className="mt-2" style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.45 }}>{t('adv_empty_body')}</p>
      <button type="button" onClick={onAdd} className="adv-focus mx-auto mt-5 flex h-12 items-center gap-2 rounded-2xl px-5" style={{ backgroundColor: C.forest, color: C.gold, fontSize: 16, fontWeight: 800 }}>
        <Plus size={18} strokeWidth={2.6} aria-hidden /> {t('adv_add_room')}
      </button>
      <p className="mt-5" style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.45 }}>{t('adv_empty_conference')}</p>
    </div>
  );
}

