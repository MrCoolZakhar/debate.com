'use client';

/**
 * SessionsResumePrompt: the pop-up that opens on the Gavelling Sessions landing
 * (/sessions, `HomeClient`) when there is a room waiting for this person.
 *
 * Two sources, one dialog:
 *
 *  1. CONFERENCE rooms (signed in only). `my_live_chair_rooms()` returns the
 *     conference committees this account chairs (`chair_user_ids`) whose live
 *     session has not ended while the conference is running today. "Join as
 *     chair" goes to `/join?code=CODE&mode=chair`, the verified conference-chair
 *     path: the join page recognises the account from `chair_user_ids` and never
 *     asks for (or shows) the chair code. "Not now" closes it for THIS page load
 *     only; the next open of /sessions asks again, and it stops by itself once
 *     the conference is over or the room has ended (the RPC stops returning it).
 *
 *  2. The STANDALONE rejoin, unchanged in source and behaviour: the
 *     `gavelling-rejoin` blob the chair page writes (legacy key
 *     `gavelling_active_session` migrated), younger than 18 hours, not the code
 *     stored in `gavelling-rejoin-dismissed`. "Rejoin" opens
 *     `/chair/CODE?chairName=...` (the name is the chair's only identity);
 *     "Dismiss" remembers the code so it never asks again for that room. New:
 *     the room is read back (anon, `committees` SELECT is public) for its topic,
 *     and a room that was deleted or has ended is forgotten instead of offered.
 *     The chair code the blob carries is never shown any more.
 *
 * One room = a full card. Several = a compact chooser. A standalone blob for a
 * room that is also one of the conference rooms is dropped (the conference row
 * wins).
 *
 * Never stacks: it waits while the auth modal or CompleteBasicsGate is deciding
 * or open (`useBasicsGateBlocking`), and while any other modal layer is on
 * screen (the credits welcome, the setup reminder, anything with
 * aria-modal / role=dialog, or a full-screen fixed layer that takes the
 * pointer), checked on a light interval. If another gate opens on top of it
 * later, it steps aside and comes back when that one closes.
 *
 * It is mounted by /sessions only, so it can never appear on a live session
 * route (/chair, /delegate, /voting, /advisor) or on /join.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, LogIn, Gavel, X, RotateCcw, CirclePause, CircleDot, Clock } from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag, flagMonogram } from '@/components/CircleFlag';
import { useAuth } from '@/components/AuthProvider';
import { useBasicsGateBlocking } from '@/lib/basicsGateState';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useT } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { committeeDisplayName, deriveCommitteeAcronym, matchPresetEmblem } from '@/lib/presetNames';
import { fetchMyLiveChairRooms, type LiveChairRoom } from '@/lib/liveChairRooms';

// ── Palette (CLAUDE.md §8) ────────────────────────────────────────────────────
const FOREST = '#1B3828';
const FOREST_2 = '#2A5A3C';
const GOLD = '#EED98A';
const DEEP_GOLD = '#8A6A1E';
const INK = '#1C1410';
const INK_SOFT = '#5C4E40';
const SURFACE = '#F6F1E6';
const PAGE = '#EDE7D8';
const FONT = "'Outfit', sans-serif";
const DEFAULT_EMBLEM = '/logos/un.svg';

const REJOIN_KEY = 'gavelling-rejoin';
const REJOIN_LEGACY_KEY = 'gavelling_active_session';
const REJOIN_DISMISSED_KEY = 'gavelling-rejoin-dismissed';
const REJOIN_MAX_AGE_MS = 18 * 60 * 60 * 1000;

// ── Items ─────────────────────────────────────────────────────────────────────

interface StoredRejoin {
  code: string;
  chairName: string;
  committeeTitle: string;
  savedAt: number;
}

export type Item =
  | { kind: 'conference'; key: string; room: LiveChairRoom }
  | { kind: 'standalone'; key: string; rejoin: StoredRejoin; topic: string | null; name: string };

type Status = 'live' | 'ready' | 'suspended';

function readStoredRejoin(): StoredRejoin | null {
  try {
    const raw = localStorage.getItem(REJOIN_KEY) ?? localStorage.getItem(REJOIN_LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRejoin> | null;
    if (!parsed || typeof parsed.code !== 'string' || !parsed.code) {
      localStorage.removeItem(REJOIN_KEY);
      localStorage.removeItem(REJOIN_LEGACY_KEY);
      return null;
    }
    if (parsed.code === localStorage.getItem(REJOIN_DISMISSED_KEY)) {
      localStorage.removeItem(REJOIN_KEY);
      return null;
    }
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt >= REJOIN_MAX_AGE_MS) {
      localStorage.removeItem(REJOIN_KEY);
      localStorage.removeItem(REJOIN_LEGACY_KEY);
      return null;
    }
    // Migrate the legacy key forward, exactly as before.
    localStorage.setItem(REJOIN_KEY, raw);
    localStorage.removeItem(REJOIN_LEGACY_KEY);
    return {
      code: parsed.code,
      chairName: typeof parsed.chairName === 'string' ? parsed.chairName : '',
      committeeTitle: typeof parsed.committeeTitle === 'string' && parsed.committeeTitle ? parsed.committeeTitle : parsed.code,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

function forgetStoredRejoin(code: string) {
  try {
    localStorage.setItem(REJOIN_DISMISSED_KEY, code);
    localStorage.removeItem(REJOIN_KEY);
  } catch { /* storage blocked */ }
}

/** Read the standalone room back: topic and name, and whether it still runs.
 *  'gone' = deleted or ended (forget it); null = the read failed (offer it as before). */
async function checkStandaloneRoom(code: string): Promise<{ name: string | null; topic: string | null } | 'gone' | null> {
  try {
    const { data, error } = await supabase
      .from('committees')
      .select('name, topic, ended_at')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    if (error) return null;
    if (!data) return 'gone';
    const row = data as { name: string | null; topic: string | null; ended_at: string | null };
    if (row.ended_at) return 'gone';
    return { name: row.name, topic: row.topic };
  } catch {
    return null;
  }
}

// ── Blocking: never on top of another modal ───────────────────────────────────

const PROMPT_ATTR = 'data-sessions-resume-prompt';

function otherModalOnScreen(): boolean {
  if (typeof document === 'undefined') return false;
  const mine = (el: Element) => !!el.closest(`[${PROMPT_ATTR}]`);
  const dialogs = document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"]');
  for (const el of Array.from(dialogs)) {
    if (!mine(el) && (el as HTMLElement).getClientRects().length > 0) return true;
  }
  // The credits welcome carries no dialog role: a full-screen fixed layer that
  // takes the pointer is a modal for our purposes.
  const layers = document.querySelectorAll('.fixed.inset-0');
  for (const el of Array.from(layers)) {
    if (mine(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents !== 'none' && cs.display !== 'none' && cs.visibility !== 'hidden') return true;
  }
  return false;
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size, height: size,
        background: FOREST, color: GOLD,
        boxShadow: `0 0 0 2.5px ${SURFACE}, 0 0 0 4.5px ${GOLD}, 0 6px 16px rgba(27,56,40,0.22)`,
        fontFamily: FONT, fontWeight: 800, fontSize: Math.round(size * 0.36),
      }}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        flagMonogram(name || 'G')
      )}
    </span>
  );
}

/** A committee emblem on a white disc, padded so a transparent logo never touches the edge. */
function Emblem({ src, label, size }: { src: string; label: string; size: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size, height: size,
        background: '#FFFDF8',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(27,56,40,0.10), 0 10px 28px rgba(27,56,40,0.18)',
      }}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: '70%', height: '70%', objectFit: 'contain' }}
        />
      ) : (
        <span style={{ fontFamily: FONT, fontWeight: 800, color: FOREST, fontSize: Math.round(size * 0.3) }}>
          {flagMonogram(label)}
        </span>
      )}
    </span>
  );
}

function emblemFor(item: Item): string {
  if (item.kind === 'conference') {
    const r = item.room;
    return r.committeeLogoUrl || matchPresetEmblem(r.committeeName, r.committeeAbbreviation) || DEFAULT_EMBLEM;
  }
  return matchPresetEmblem(item.name) || DEFAULT_EMBLEM;
}

function namesFor(item: Item): { primary: string; secondary: string | null } {
  const full = item.kind === 'conference' ? item.room.committeeName : item.name;
  const abbr = item.kind === 'conference' ? item.room.committeeAbbreviation : null;
  const primary = committeeDisplayName(full, deriveCommitteeAcronym(full, abbr)) || full;
  return { primary, secondary: primary !== full ? full : null };
}

function statusOf(room: LiveChairRoom): Status {
  if (room.suspended) return 'suspended';
  return room.started ? 'live' : 'ready';
}

function StatusLine({ status, t, compact = false }: { status: Status; t: ReturnType<typeof useT>; compact?: boolean }) {
  const Icon = status === 'suspended' ? CirclePause : status === 'live' ? CircleDot : Clock;
  const label = status === 'suspended' ? t('srp_status_suspended') : status === 'live' ? t('srp_status_live') : t('srp_status_ready');
  const color = status === 'live' ? '#2F7A4A' : status === 'suspended' ? '#8A5A12' : INK_SOFT;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color, fontSize: compact ? 12 : 13, fontWeight: 600 }}>
      <Icon size={compact ? 13 : 15} strokeWidth={2.4} aria-hidden />
      {label}
    </span>
  );
}

function CopyCode({ code, t, large }: { code: string; t: ReturnType<typeof useT>; large: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the code is on screen to read */ }
  };
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl"
      style={{
        background: PAGE,
        padding: large ? '12px 12px 12px 18px' : '8px 8px 8px 14px',
        boxShadow: 'inset 0 1px 2px rgba(27,56,40,0.10), inset 0 0 0 1px rgba(27,56,40,0.06)',
      }}
    >
      <div className="min-w-0">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK_SOFT }}>
          {t('srp_code')}
        </p>
        <p
          dir="ltr"
          className="truncate"
          style={{
            fontFamily: FONT, fontWeight: 800, color: INK,
            fontSize: large ? 34 : 22, letterSpacing: '0.14em', lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {code}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? t('srp_copied') : t('srp_copy')}
        title={copied ? t('srp_copied') : t('srp_copy')}
        className="inline-flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl transition-transform active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
        style={{
          width: large ? 64 : 52, height: large ? 58 : 48,
          background: copied ? FOREST : '#FFFDF8', color: copied ? GOLD : FOREST,
          boxShadow: '0 1px 2px rgba(27,56,40,0.12), 0 0 0 1px rgba(27,56,40,0.08)',
        }}
      >
        {copied ? <Check size={20} strokeWidth={2.6} aria-hidden /> : <Copy size={19} strokeWidth={2.2} aria-hidden />}
        <span style={{ fontSize: 10.5, fontWeight: 700 }}>{copied ? t('srp_copied') : t('srp_copy_short')}</span>
      </button>
    </div>
  );
}

// ── The dialog ────────────────────────────────────────────────────────────────

export default function SessionsResumePrompt() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const gatesBlocking = useBasicsGateBlocking();

  const [dismissed, setDismissed] = useState(false);
  // Assume something else is on screen until the first check has looked.
  const [otherModal, setOtherModal] = useState(true);

  // Conference rooms: once per page load per account. Not keyed on the token,
  // so an hourly token refresh never re-reads or reopens it. The answer is
  // stamped with the account it belongs to, so a sign-out or account switch
  // can never show another account's rooms.
  const userId = user?.id ?? null;
  const tokenRef = useRef<string | null>(null);
  const accessToken = session?.access_token ?? null;
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  const [roomsFor, setRoomsFor] = useState<{ uid: string; rooms: LiveChairRoom[] } | null>(null);
  useEffect(() => {
    if (authLoading || !userId || !tokenRef.current) return;
    let cancelled = false;
    fetchMyLiveChairRooms(tokenRef.current).then((r) => {
      if (!cancelled) setRoomsFor({ uid: userId, rooms: r ?? [] });
    });
    return () => { cancelled = true; };
  }, [authLoading, userId]);
  const roomsSettled = !authLoading && (!userId || roomsFor?.uid === userId);
  const rooms = useMemo(() => (userId && roomsFor?.uid === userId ? roomsFor.rooms : []), [userId, roomsFor]);

  // Standalone rejoin: the existing localStorage source, checked against the room.
  // `undefined` = not answered yet, `null` = nothing to offer.
  const [standalone, setStandalone] = useState<Item | null | undefined>(undefined);
  useEffect(() => {
    const stored = readStoredRejoin();
    let cancelled = false;
    (stored ? checkStandaloneRoom(stored.code) : Promise.resolve('gone' as const)).then((res) => {
      if (cancelled) return;
      if (!stored) { setStandalone(null); return; }
      if (res === 'gone') {
        try { localStorage.removeItem(REJOIN_KEY); } catch { /* ignore */ }
        setStandalone(null);
        return;
      }
      setStandalone({
        kind: 'standalone',
        key: `s:${stored.code.toUpperCase()}`,
        rejoin: stored,
        topic: res?.topic && res.topic.trim() && res.topic !== 'TBD' ? res.topic : null,
        name: res?.name?.trim() || stored.committeeTitle,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const items = useMemo<Item[]>(() => {
    const conf: Item[] = rooms.map((room) => ({ kind: 'conference', key: `c:${room.sessionCode}`, room }));
    const codes = new Set(rooms.map((r) => r.sessionCode));
    const extra = standalone && standalone.kind === 'standalone' && !codes.has(standalone.rejoin.code.toUpperCase()) ? [standalone] : [];
    return [...conf, ...extra];
  }, [rooms, standalone]);

  // Open only when both sources have answered, so a room never "appears" into
  // an already open card, and a chooser never collapses under the pointer.
  const ready = roomsSettled && standalone !== undefined;

  const wanted = ready && !dismissed && items.length > 0;

  // Step aside for any other modal layer; re-checked on a light interval.
  useEffect(() => {
    if (!wanted) return;
    const check = () => setOtherModal(otherModalOnScreen());
    const first = window.setTimeout(check, 0);
    const id = window.setInterval(check, 700);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [wanted]);

  const open = wanted && !gatesBlocking && !otherModal;

  const close = useCallback(() => setDismissed(true), []);

  const go = (item: Item) => {
    if (item.kind === 'conference') {
      window.location.href = `/join?code=${encodeURIComponent(item.room.sessionCode)}&mode=chair`;
    } else {
      // ?chairName is the chair's ONLY identity (chat sender, feedback author, the gavel).
      const q = item.rejoin.chairName ? `?chairName=${encodeURIComponent(item.rejoin.chairName)}` : '';
      window.location.href = `/chair/${item.rejoin.code}${q}`;
    }
  };

  const forget = (item: Item) => {
    if (item.kind !== 'standalone') return;
    forgetStoredRejoin(item.rejoin.code);
    setStandalone(null);
  };

  if (!open) return null;

  const displayName = profile?.display_name?.trim()
    || (standalone && standalone.kind === 'standalone' ? standalone.rejoin.chairName : '')
    || '';

  return (
    <ResumeDialogView
      items={items}
      displayName={displayName}
      avatarUrl={user ? profile?.avatar_url ?? null : null}
      showAvatar={!!user || !!displayName}
      onGo={go}
      onClose={close}
      onForget={forget}
    />
  );
}

export interface ResumeDialogViewProps {
  items: Item[];
  displayName: string;
  avatarUrl: string | null;
  showAvatar: boolean;
  onGo: (item: Item) => void;
  onClose: () => void;
  onForget: (item: Item) => void;
}

/** The dialog itself, presentational: mounted only while it should be on screen. */
export function ResumeDialogView({ items, displayName, avatarUrl, showAvatar, onGo, onClose, onForget }: ResumeDialogViewProps) {
  const t = useT();
  useScrollLock(true);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const close = onClose;
  // Focus: first action on open, trap Tab, Escape = Not now, focus back on close.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => primaryRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.hasAttribute('disabled'));
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  const firstName = displayName.split(/\s+/)[0] ?? '';
  const single = items.length === 1 ? items[0] : null;

  return (
    <Portal>
      <div {...{ [PROMPT_ATTR]: '' }} className="srp-root" style={{ fontFamily: FONT }}>
        <style>{CSS}</style>
        <div className="srp-backdrop" onClick={close} aria-hidden />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="srp-title"
          className="srp-panel"
        >
          <button
            type="button"
            onClick={close}
            aria-label={t('srp_close')}
            title={t('srp_close')}
            className="srp-x focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
          >
            <X size={18} strokeWidth={2.4} aria-hidden />
          </button>

          {/* Who: the person, and why this is for them. */}
          <div className="flex items-center gap-3.5" style={{ paddingInlineEnd: 40 }}>
            {showAvatar && <Avatar url={avatarUrl} name={displayName} size={52} />}
            <div className="min-w-0">
              <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: DEEP_GOLD }}>
                {single?.kind === 'standalone' ? t('srp_rejoin_eyebrow') : t('srp_conf_eyebrow')}
              </p>
              <h2 id="srp-title" style={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1.2, textWrap: 'balance' }}>
                {single
                  ? (single.kind === 'standalone'
                      ? t('srp_rejoin_title')
                      : firstName ? t('srp_conf_title').replace('{name}', firstName) : t('srp_conf_title_anon'))
                  : t('srp_chooser_title').replace('{n}', String(items.length))}
              </h2>
            </div>
          </div>

          {single ? (
            <SingleRoom item={single} t={t} primaryRef={primaryRef} onGo={onGo} onClose={close} onForget={onForget} />
          ) : (
            <Chooser items={items} t={t} primaryRef={primaryRef} onGo={onGo} onClose={close} onForget={onForget} />
          )}
        </div>
      </div>
    </Portal>
  );
}

// ── One room ──────────────────────────────────────────────────────────────────

interface ViewProps {
  t: ReturnType<typeof useT>;
  primaryRef: React.RefObject<HTMLButtonElement | null>;
  onGo: (item: Item) => void;
  onClose: () => void;
  onForget: (item: Item) => void;
}

function SingleRoom({ item, t, primaryRef, onGo, onClose, onForget }: ViewProps & { item: Item }) {
  const { primary, secondary } = namesFor(item);
  const emblem = emblemFor(item);
  const topic = item.kind === 'conference' ? item.room.topic : item.topic;
  const code = item.kind === 'conference' ? item.room.sessionCode : item.rejoin.code.toUpperCase();
  const room = item.kind === 'conference' ? item.room : null;
  const conferenceLabel = room ? (room.conferenceAcronym || room.conferenceName) : null;

  return (
    <>
      {/* The committee, with its conference and country in circles. */}
      <div className="srp-hero">
        <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
          <Emblem src={emblem} label={primary} size={104} />
          {room && (
            <span className="absolute flex items-center" style={{ insetInlineEnd: -10, bottom: -6 }}>
              {room.conferenceLogoUrl || conferenceLabel ? (
                <CircleFlag
                  logoUrl={room.conferenceLogoUrl}
                  label={conferenceLabel ?? room.conferenceName}
                  title={room.conferenceName}
                  size={40}
                  logoFit="contain"
                  ring={false}
                  style={{ boxShadow: `0 0 0 3px ${SURFACE}, 0 4px 10px rgba(27,56,40,0.18)` }}
                />
              ) : null}
              {room.conferenceCountry && (
                <CircleFlag
                  country={room.conferenceCountry}
                  title={room.conferenceCountry}
                  size={40}
                  ring={false}
                  style={{ marginInlineStart: -6, boxShadow: `0 0 0 3px ${SURFACE}, 0 4px 10px rgba(27,56,40,0.18)` }}
                />
              )}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="srp-acronym" style={{ color: FOREST }}>{primary}</p>
          {secondary && <p style={{ fontSize: 13.5, color: INK_SOFT, lineHeight: 1.3, marginTop: 2 }}>{secondary}</p>}
          {room ? (
            <p className="mt-2 truncate" title={room.conferenceName} style={{ fontSize: 13, color: INK_SOFT }}>
              <span style={{ fontWeight: 700, color: INK }}>{conferenceLabel}</span>
              {room.conferenceCountry && <span>{' · '}{room.conferenceCountry}</span>}
            </p>
          ) : (
            <p className="mt-2 inline-flex items-center gap-1.5" style={{ fontSize: 13, color: INK_SOFT }}>
              <Gavel size={14} strokeWidth={2.3} aria-hidden style={{ color: FOREST }} />
              <span>
                {t('srp_role')}{' '}
                <span style={{ fontWeight: 700, color: INK }}>
                  {item.kind === 'standalone' && item.rejoin.chairName
                    ? t('srp_role_chair_named').replace('{name}', item.rejoin.chairName)
                    : t('srp_role_chair')}
                </span>
              </span>
            </p>
          )}
          {room && <div className="mt-1.5"><StatusLine status={statusOf(room)} t={t} /></div>}
        </div>
      </div>

      {topic && (
        <div className="srp-topic">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK_SOFT }}>
            {t('srp_topic')}
          </p>
          <p className="srp-clamp" title={topic} style={{ fontSize: 15, color: INK, lineHeight: 1.4, fontWeight: 500 }}>{topic}</p>
        </div>
      )}

      <CopyCode code={code} t={t} large />

      <div className="srp-actions">
        <button
          ref={primaryRef}
          type="button"
          onClick={() => onGo(item)}
          className="srp-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-2"
        >
          {item.kind === 'conference'
            ? <LogIn size={20} strokeWidth={2.4} aria-hidden />
            : <RotateCcw size={19} strokeWidth={2.4} aria-hidden />}
          <span>{item.kind === 'conference' ? t('srp_join_chair') : t('srp_rejoin')}</span>
        </button>
        <button
          type="button"
          onClick={() => (item.kind === 'standalone' ? onForget(item) : onClose())}
          className="srp-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
        >
          {item.kind === 'standalone' ? t('srp_dismiss') : t('srp_not_now')}
        </button>
      </div>
      {item.kind === 'conference' && (
        <p style={{ fontSize: 12, color: INK_SOFT, textAlign: 'center', marginTop: -4 }}>{t('srp_conf_note')}</p>
      )}
    </>
  );
}

// ── Several rooms ─────────────────────────────────────────────────────────────

function Chooser({ items, t, primaryRef, onGo, onClose, onForget }: ViewProps & { items: Item[] }) {
  return (
    <>
      <p style={{ fontSize: 14, color: INK_SOFT, marginTop: -6 }}>{t('srp_chooser_hint')}</p>
      <ul className="srp-list" role="list">
        {items.map((item, i) => {
          const { primary } = namesFor(item);
          const room = item.kind === 'conference' ? item.room : null;
          const topic = room ? room.topic : item.kind === 'standalone' ? item.topic : null;
          const code = room ? room.sessionCode : item.kind === 'standalone' ? item.rejoin.code.toUpperCase() : '';
          const sub = room
            ? (room.conferenceAcronym || room.conferenceName)
            : item.kind === 'standalone' && item.rejoin.chairName
              ? t('srp_role_chair_named').replace('{name}', item.rejoin.chairName)
              : t('srp_role_chair');
          return (
            <li key={item.key} className="srp-row">
              <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
                <Emblem src={emblemFor(item)} label={primary} size={52} />
                {room?.conferenceCountry && (
                  <CircleFlag
                    country={room.conferenceCountry}
                    title={room.conferenceCountry}
                    size={22}
                    ring={false}
                    className="absolute"
                    style={{ position: 'absolute', insetInlineEnd: -4, bottom: -3, boxShadow: `0 0 0 2px ${SURFACE}` }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate" style={{ fontSize: 16, fontWeight: 800, color: FOREST, lineHeight: 1.2 }}>{primary}</p>
                <p className="truncate" style={{ fontSize: 12.5, color: INK_SOFT }}>
                  <span dir="ltr" style={{ fontWeight: 800, color: INK, letterSpacing: '0.08em' }}>{code}</span> <span aria-hidden>·</span> {sub}
                </p>
                {room && <StatusLine status={statusOf(room)} t={t} compact />}
                {topic && <p className="truncate" title={topic} style={{ fontSize: 12.5, color: INK_SOFT }}>{topic}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {item.kind === 'standalone' && (
                  <button
                    type="button"
                    onClick={() => onForget(item)}
                    aria-label={t('srp_forget')}
                    title={t('srp_forget')}
                    className="srp-icon focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
                  >
                    <X size={16} strokeWidth={2.4} aria-hidden />
                  </button>
                )}
                <button
                  ref={i === 0 ? primaryRef : undefined}
                  type="button"
                  onClick={() => onGo(item)}
                  aria-label={`${item.kind === 'conference' ? t('srp_join_chair') : t('srp_rejoin')}: ${primary}`}
                  className="srp-row-go focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-2"
                >
                  {item.kind === 'conference'
                    ? <LogIn size={16} strokeWidth={2.5} aria-hidden />
                    : <RotateCcw size={15} strokeWidth={2.5} aria-hidden />}
                  <span>{item.kind === 'conference' ? t('srp_join') : t('srp_rejoin')}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onClose}
        className="srp-secondary w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
      >
        {t('srp_not_now')}
      </button>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
// A centred card from 560px wide; a bottom sheet with a grab edge on phones.

const CSS = `
.srp-root{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px}
.srp-backdrop{position:absolute;inset:0;background:rgba(16,30,22,0.46);animation:srpFade 200ms ease both}
.srp-panel{position:relative;width:100%;max-width:468px;max-height:calc(100dvh - 32px);overflow-y:auto;
  background:${SURFACE};border-radius:28px;padding:24px;display:flex;flex-direction:column;gap:18px;
  box-shadow:0 1px 0 rgba(255,255,255,0.8) inset,0 0 0 1px rgba(27,56,40,0.08),0 30px 80px rgba(16,30,22,0.35);
  animation:srpPop 260ms cubic-bezier(0.32,0.72,0,1) both;overscroll-behavior:contain}
.srp-x{position:absolute;top:14px;inset-inline-end:14px;width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;
  color:${INK_SOFT};background:transparent;transition:background-color 150ms ease,color 150ms ease}
.srp-x:hover{background:rgba(27,56,40,0.07);color:${FOREST}}
.srp-hero{display:flex;align-items:center;gap:22px;padding:18px;border-radius:22px;
  background:linear-gradient(160deg,#FFFDF8 0%,${PAGE} 100%);box-shadow:inset 0 0 0 1px rgba(27,56,40,0.06)}
.srp-acronym{font-size:30px;font-weight:900;line-height:1.02;letter-spacing:-0.01em;overflow-wrap:anywhere}
.srp-topic{padding:0 4px}
.srp-clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-wrap:pretty}
.srp-actions{display:flex;gap:10px}
.srp-primary{flex:1.5;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 18px;border-radius:16px;
  background:linear-gradient(180deg,${FOREST_2} 0%,${FOREST} 100%);color:${GOLD};font-weight:800;font-size:16.5px;
  box-shadow:0 1px 0 rgba(255,255,255,0.14) inset,0 8px 20px rgba(27,56,40,0.28);transition:transform 120ms ease,filter 150ms ease}
.srp-primary:hover{filter:brightness(1.08)}
.srp-primary:active{transform:scale(0.97)}
.srp-secondary{flex:1;min-height:54px;padding:0 16px;border-radius:16px;font-weight:700;font-size:15px;color:${FOREST};
  background:transparent;box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.18);transition:background-color 150ms ease,transform 120ms ease}
.srp-secondary:hover{background:rgba(27,56,40,0.06)}
.srp-secondary:active{transform:scale(0.98)}
.srp-list{display:flex;flex-direction:column;gap:8px;max-height:min(52dvh,420px);overflow-y:auto;margin:0 -4px;padding:2px 4px}
.srp-row{display:flex;align-items:center;gap:14px;padding:12px 12px 12px 14px;border-radius:18px;background:#FFFDF8;
  box-shadow:0 0 0 1px rgba(27,56,40,0.07),0 2px 6px rgba(27,56,40,0.06)}
.srp-row-go{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:12px;background:${FOREST};color:${GOLD};
  font-weight:800;font-size:14px;transition:transform 120ms ease,filter 150ms ease}
.srp-row-go:hover{filter:brightness(1.12)}
.srp-row-go:active{transform:scale(0.96)}
.srp-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:${INK_SOFT};transition:background-color 150ms ease}
.srp-icon:hover{background:rgba(27,56,40,0.07);color:${FOREST}}
@keyframes srpFade{from{opacity:0}to{opacity:1}}
@keyframes srpPop{from{opacity:0;transform:translateY(12px) scale(0.97)}to{opacity:1;transform:none}}
@keyframes srpSheet{from{transform:translateY(100%)}to{transform:none}}
@media (max-width:559px){
  .srp-root{align-items:flex-end;padding:0}
  .srp-panel{max-width:none;border-radius:26px 26px 0 0;padding:26px 18px calc(18px + env(safe-area-inset-bottom));
    max-height:calc(100dvh - 24px);animation:srpSheet 300ms cubic-bezier(0.32,0.72,0,1) both}
  .srp-panel::before{content:"";position:absolute;top:8px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:4px;background:rgba(27,56,40,0.18)}
  .srp-hero{gap:16px;padding:14px}
  .srp-acronym{font-size:25px}
  .srp-actions{flex-direction:column-reverse}
  .srp-primary,.srp-secondary{flex:none;width:100%}
}
@media (prefers-reduced-motion:reduce){
  .srp-backdrop,.srp-panel{animation:srpFade 1ms both}
  .srp-primary,.srp-secondary,.srp-row-go{transition:none}
}
`;
