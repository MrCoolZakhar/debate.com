'use client';

/**
 * LiveRoomsDialog: the "your room is live" pop-up itself, presentational.
 * `LiveRoomsGate` (root layout) decides WHEN it shows; `LiveNowMenuSection`
 * reuses its small pieces in the profile menu.
 *
 * One entry = a full card in the role's own shape. Several = a compact list in
 * priority order (organiser, chair, delegate, advisor, then the standalone
 * rejoin on /sessions). No chair code is ever shown: only the session code.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check, Copy, LogIn, Gavel, X, RotateCcw, CirclePause, CircleDot, Clock, Eye, Activity,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag, flagMonogram } from '@/components/CircleFlag';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useT } from '@/contexts/LanguageContext';
import { committeeDisplayName, deriveCommitteeAcronym, matchPresetEmblem } from '@/lib/presetNames';
import { liveEntryHref, type LiveEntry, type LiveRoomInfo } from '@/lib/liveRooms';

// ── Palette (CLAUDE.md §8) ────────────────────────────────────────────────────
export const LR = {
  forest: '#1B3828',
  forest2: '#2A5A3C',
  gold: '#EED98A',
  deepGold: '#8A6A1E',
  ink: '#1C1410',
  inkSoft: '#5C4E40',
  surface: '#F6F1E6',
  page: '#EDE7D8',
  font: "'Outfit', sans-serif",
} as const;
const DEFAULT_EMBLEM = '/logos/un.svg';

export const PROMPT_ATTR = 'data-live-rooms-prompt';

// ── Items ─────────────────────────────────────────────────────────────────────

/** The standalone rejoin (localStorage `gavelling-rejoin`), offered on /sessions only. */
export interface StandaloneItem {
  role: 'standalone';
  key: string;
  code: string;
  chairName: string;
  name: string;
  topic: string | null;
}

export type PromptItem = LiveEntry | StandaloneItem;

export function itemHref(item: PromptItem): string {
  if (item.role === 'standalone') {
    // ?chairName is the chair's ONLY identity (chat sender, feedback author, the gavel).
    const q = item.chairName ? `?chairName=${encodeURIComponent(item.chairName)}` : '';
    return `/chair/${item.code}${q}`;
  }
  return liveEntryHref(item);
}

type T = ReturnType<typeof useT>;
type Status = 'live' | 'ready' | 'suspended';

function roomOf(item: PromptItem): LiveRoomInfo | null {
  return item.role === 'chair' || item.role === 'delegate' || item.role === 'advisor' ? item.room : null;
}

export function emblemFor(item: PromptItem): string {
  const room = roomOf(item);
  if (room) return room.committeeLogoUrl || matchPresetEmblem(room.committeeName, room.committeeAbbreviation) || DEFAULT_EMBLEM;
  if (item.role === 'standalone') return matchPresetEmblem(item.name) || DEFAULT_EMBLEM;
  return DEFAULT_EMBLEM;
}

export function committeeNames(full: string, abbr: string | null): { primary: string; secondary: string | null } {
  const primary = committeeDisplayName(full, deriveCommitteeAcronym(full, abbr)) || full;
  return { primary, secondary: primary !== full ? full : null };
}

function statusOf(room: LiveRoomInfo): Status {
  if (room.suspended) return 'suspended';
  return room.started ? 'live' : 'ready';
}

export function actionLabel(item: PromptItem, t: T, long: boolean): string {
  switch (item.role) {
    case 'organiser': return long ? t('srp_org_open') : t('srp_menu_open');
    case 'chair': return long ? t('srp_join_chair') : t('srp_menu_join');
    case 'delegate': return t('srp_menu_join');
    case 'advisor': return long ? t('srp_adv_open') : t('srp_menu_join');
    case 'standalone': return t('srp_rejoin');
  }
}

export function roleWord(item: PromptItem, t: T): string {
  switch (item.role) {
    case 'organiser': return t('srp_role_word_organiser');
    case 'chair': return t('srp_role_word_chair');
    case 'delegate': return t('srp_role_word_delegate');
    case 'advisor': return t('srp_role_word_advisor');
    case 'standalone': return t('srp_role_word_chair');
  }
}

function ActionIcon({ item, size }: { item: PromptItem; size: number }) {
  if (item.role === 'organiser') return <Activity size={size} strokeWidth={2.4} aria-hidden />;
  if (item.role === 'advisor') return <Eye size={size} strokeWidth={2.4} aria-hidden />;
  if (item.role === 'standalone') return <RotateCcw size={size} strokeWidth={2.4} aria-hidden />;
  return <LogIn size={size} strokeWidth={2.4} aria-hidden />;
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
        background: LR.forest, color: LR.gold,
        boxShadow: `0 0 0 2.5px ${LR.surface}, 0 0 0 4.5px ${LR.gold}, 0 6px 16px rgba(27,56,40,0.22)`,
        fontFamily: LR.font, fontWeight: 800, fontSize: Math.round(size * 0.36),
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

/** A committee emblem (or conference logo) on a white disc, padded so a transparent logo never touches the edge. */
export function Emblem({ src, label, size, style }: { src: string | null; label: string; size: number; style?: React.CSSProperties }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size, height: size,
        background: '#FFFDF8',
        boxShadow: size >= 48
          ? '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(27,56,40,0.10), 0 10px 28px rgba(27,56,40,0.18)'
          : '0 0 0 1px rgba(27,56,40,0.12)',
        ...style,
      }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} style={{ width: '72%', height: '72%', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontFamily: LR.font, fontWeight: 800, color: LR.forest, fontSize: Math.max(8, Math.round(size * 0.3)) }}>
          {flagMonogram(label || '?')}
        </span>
      )}
    </span>
  );
}

const BADGE_RING = `0 0 0 3px ${LR.surface}, 0 4px 10px rgba(27,56,40,0.18)`;

function StatusLine({ status, t, compact = false }: { status: Status; t: T; compact?: boolean }) {
  const Icon = status === 'suspended' ? CirclePause : status === 'live' ? CircleDot : Clock;
  const label = status === 'suspended' ? t('srp_status_suspended') : status === 'live' ? t('srp_status_live') : t('srp_status_ready');
  const color = status === 'live' ? '#2F7A4A' : status === 'suspended' ? '#8A5A12' : LR.inkSoft;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color, fontSize: compact ? 12 : 13, fontWeight: 600 }}>
      <Icon size={compact ? 13 : 15} strokeWidth={2.4} aria-hidden />
      {label}
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: LR.inkSoft }}>
      {children}
    </p>
  );
}

function CopyCode({ code, t }: { code: string; t: T }) {
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
      style={{ background: LR.page, padding: '12px 12px 12px 18px', boxShadow: 'inset 0 1px 2px rgba(27,56,40,0.10), inset 0 0 0 1px rgba(27,56,40,0.06)' }}
    >
      <div className="min-w-0">
        <Label>{t('srp_code')}</Label>
        <p
          dir="ltr"
          className="truncate"
          style={{ fontFamily: LR.font, fontWeight: 800, color: LR.ink, fontSize: 34, letterSpacing: '0.14em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}
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
          width: 64, height: 58,
          background: copied ? LR.forest : '#FFFDF8', color: copied ? LR.gold : LR.forest,
          boxShadow: '0 1px 2px rgba(27,56,40,0.12), 0 0 0 1px rgba(27,56,40,0.08)',
        }}
      >
        {copied ? <Check size={20} strokeWidth={2.6} aria-hidden /> : <Copy size={19} strokeWidth={2.2} aria-hidden />}
        <span style={{ fontSize: 10.5, fontWeight: 700 }}>{copied ? t('srp_copied') : t('srp_copy_short')}</span>
      </button>
    </div>
  );
}

function Topic({ topic, t }: { topic: string | null; t: T }) {
  if (!topic) return null;
  return (
    <div className="srp-topic">
      <Label>{t('srp_topic')}</Label>
      <p className="srp-clamp" title={topic} style={{ fontSize: 15, color: LR.ink, lineHeight: 1.4, fontWeight: 500 }}>{topic}</p>
    </div>
  );
}

// ── The dialog ────────────────────────────────────────────────────────────────

export interface LiveRoomsDialogProps {
  items: PromptItem[];
  displayName: string;
  avatarUrl: string | null;
  showAvatar: boolean;
  onGo: (item: PromptItem) => void;
  onClose: () => void;
  /** Standalone only: forget this room for good (the old Dismiss). */
  onForget: (item: PromptItem) => void;
}

export default function LiveRoomsDialog({ items, displayName, avatarUrl, showAvatar, onGo, onClose, onForget }: LiveRoomsDialogProps) {
  const t = useT();
  useScrollLock(true);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

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
  const withName = (key: 'srp_conf_title' | 'srp_org_title' | 'srp_deleg_title' | 'srp_adv_title', anon: 'srp_conf_title_anon' | 'srp_org_title_anon' | 'srp_deleg_title_anon' | 'srp_adv_title_anon') =>
    firstName ? t(key).replace('{name}', firstName) : t(anon);

  let eyebrow = t('srp_live_eyebrow');
  let title = t('srp_chooser_title').replace('{n}', String(items.length));
  if (single) {
    switch (single.role) {
      case 'organiser': eyebrow = t('srp_org_eyebrow'); title = withName('srp_org_title', 'srp_org_title_anon'); break;
      case 'chair': eyebrow = t('srp_conf_eyebrow'); title = withName('srp_conf_title', 'srp_conf_title_anon'); break;
      case 'delegate': eyebrow = t('srp_conf_eyebrow'); title = withName('srp_deleg_title', 'srp_deleg_title_anon'); break;
      case 'advisor': eyebrow = t('srp_adv_eyebrow'); title = withName('srp_adv_title', 'srp_adv_title_anon'); break;
      case 'standalone': eyebrow = t('srp_rejoin_eyebrow'); title = t('srp_rejoin_title'); break;
    }
  }

  return (
    <Portal>
      <div {...{ [PROMPT_ATTR]: '' }} className="srp-root" style={{ fontFamily: LR.font }}>
        <style>{CSS}</style>
        <div className="srp-backdrop" onClick={onClose} aria-hidden />
        <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="srp-title" className="srp-panel">
          <button
            type="button"
            onClick={onClose}
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
              <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: LR.deepGold }}>
                {eyebrow}
              </p>
              <h2 id="srp-title" style={{ fontSize: 22, fontWeight: 800, color: LR.ink, lineHeight: 1.2, textWrap: 'balance' }}>
                {title}
              </h2>
            </div>
          </div>

          {single ? (
            <SingleCard item={single} t={t} primaryRef={primaryRef} onGo={onGo} onClose={onClose} onForget={onForget} />
          ) : (
            <Chooser items={items} t={t} primaryRef={primaryRef} onGo={onGo} onClose={onClose} onForget={onForget} />
          )}
        </div>
      </div>
    </Portal>
  );
}

// ── One entry ─────────────────────────────────────────────────────────────────

interface ViewProps {
  t: T;
  primaryRef: React.RefObject<HTMLButtonElement | null>;
  onGo: (item: PromptItem) => void;
  onClose: () => void;
  onForget: (item: PromptItem) => void;
}

function SingleCard({ item, t, primaryRef, onGo, onClose, onForget }: ViewProps & { item: PromptItem }) {
  let hero: ReactNode;
  let code: string | null = null;
  let topic: string | null = null;
  let note: string | null = null;

  if (item.role === 'organiser') {
    const c = item.conference;
    const primary = c.conferenceAcronym || c.conferenceName;
    hero = (
      <div className="srp-hero">
        <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
          <Emblem src={c.conferenceLogoUrl} label={primary} size={104} />
          {c.conferenceCountry && (
            <CircleFlag country={c.conferenceCountry} title={c.conferenceCountry} size={40} ring={false}
              className="absolute" style={{ position: 'absolute', insetInlineEnd: -8, bottom: -6, boxShadow: BADGE_RING }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="srp-acronym" style={{ color: LR.forest }}>{primary}</p>
          {primary !== c.conferenceName && <p style={{ fontSize: 13.5, color: LR.inkSoft, lineHeight: 1.3, marginTop: 2 }}>{c.conferenceName}</p>}
          <div className="mt-3 flex items-end gap-6">
            <div>
              <p className="srp-num">{c.liveCount}</p>
              <p style={{ fontSize: 12.5, color: LR.inkSoft, fontWeight: 600 }}>{t('srp_org_live_count')}</p>
            </div>
            <div>
              <p className="srp-num" style={{ color: '#2F7A4A' }}>{c.inSessionCount}</p>
              <p style={{ fontSize: 12.5, color: LR.inkSoft, fontWeight: 600 }}>{t('srp_org_in_session')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (item.role === 'delegate') {
    const r = item.room;
    const { primary } = committeeNames(r.committeeName, r.committeeAbbreviation);
    const conferenceLabel = r.conferenceAcronym || r.conferenceName;
    code = r.sessionCode;
    topic = r.topic;
    note = t('srp_deleg_note');
    hero = (
      <div className="srp-hero">
        <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
          <CircleFlag code={item.countryCode} country={item.countryName} label={item.countryName} size={104} ring={false} loading="eager"
            style={{ boxShadow: '0 0 0 1px rgba(27,56,40,0.10), 0 10px 28px rgba(27,56,40,0.22)' }} />
          <span className="absolute flex items-center" style={{ insetInlineEnd: -10, bottom: -6 }}>
            <Emblem src={emblemFor(item)} label={primary} size={40} style={{ boxShadow: BADGE_RING }} />
            <Emblem src={r.conferenceLogoUrl} label={conferenceLabel} size={40} style={{ boxShadow: BADGE_RING, marginInlineStart: -6 }} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <Label>{t('srp_deleg_country')}</Label>
          <p className="srp-acronym" style={{ color: LR.forest }}>{item.countryName}</p>
          <p className="mt-1.5 truncate" title={`${r.committeeName} · ${r.conferenceName}`} style={{ fontSize: 13.5, color: LR.inkSoft }}>
            <span style={{ fontWeight: 700, color: LR.ink }}>{primary}</span>{' · '}{conferenceLabel}
          </p>
          <div className="mt-1.5"><StatusLine status={statusOf(r)} t={t} /></div>
        </div>
      </div>
    );
  } else if (item.role === 'chair' || item.role === 'advisor') {
    const r = item.room;
    const { primary, secondary } = committeeNames(r.committeeName, r.committeeAbbreviation);
    const conferenceLabel = r.conferenceAcronym || r.conferenceName;
    code = r.sessionCode;
    topic = r.topic;
    note = item.role === 'chair' ? t('srp_conf_note') : t('srp_adv_note');
    hero = (
      <div className="srp-hero">
        <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
          <Emblem src={emblemFor(item)} label={primary} size={104} />
          <span className="absolute flex items-center" style={{ insetInlineEnd: -10, bottom: -6 }}>
            <Emblem src={r.conferenceLogoUrl} label={conferenceLabel} size={40} style={{ boxShadow: BADGE_RING }} />
            {r.conferenceCountry && (
              <CircleFlag country={r.conferenceCountry} title={r.conferenceCountry} size={40} ring={false}
                style={{ marginInlineStart: -6, boxShadow: BADGE_RING }} />
            )}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="srp-acronym" style={{ color: LR.forest }}>{primary}</p>
          {secondary && <p style={{ fontSize: 13.5, color: LR.inkSoft, lineHeight: 1.3, marginTop: 2 }}>{secondary}</p>}
          <p className="mt-2 truncate" title={r.conferenceName} style={{ fontSize: 13, color: LR.inkSoft }}>
            <span style={{ fontWeight: 700, color: LR.ink }}>{conferenceLabel}</span>
            {r.conferenceCountry && <span>{' · '}{r.conferenceCountry}</span>}
          </p>
          <div className="mt-1.5"><StatusLine status={statusOf(r)} t={t} /></div>
        </div>
      </div>
    );
  } else {
    const { primary, secondary } = committeeNames(item.name, null);
    code = item.code.toUpperCase();
    topic = item.topic;
    hero = (
      <div className="srp-hero">
        <Emblem src={emblemFor(item)} label={primary} size={104} />
        <div className="min-w-0 flex-1">
          <p className="srp-acronym" style={{ color: LR.forest }}>{primary}</p>
          {secondary && <p style={{ fontSize: 13.5, color: LR.inkSoft, lineHeight: 1.3, marginTop: 2 }}>{secondary}</p>}
          <p className="mt-2 inline-flex items-center gap-1.5" style={{ fontSize: 13, color: LR.inkSoft }}>
            <Gavel size={14} strokeWidth={2.3} aria-hidden style={{ color: LR.forest }} />
            <span>
              {t('srp_role')}{' '}
              <span style={{ fontWeight: 700, color: LR.ink }}>
                {item.chairName ? t('srp_role_chair_named').replace('{name}', item.chairName) : t('srp_role_chair')}
              </span>
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {hero}
      <Topic topic={topic} t={t} />
      {code && <CopyCode code={code} t={t} />}
      <div className="srp-actions">
        <button
          ref={primaryRef}
          type="button"
          onClick={() => onGo(item)}
          className="srp-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-2"
        >
          <ActionIcon item={item} size={20} />
          <span>{actionLabel(item, t, true)}</span>
        </button>
        <button
          type="button"
          onClick={() => (item.role === 'standalone' ? onForget(item) : onClose())}
          className="srp-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
        >
          {item.role === 'standalone' ? t('srp_dismiss') : t('srp_not_now')}
        </button>
      </div>
      {note && <p style={{ fontSize: 12, color: LR.inkSoft, textAlign: 'center', marginTop: -4 }}>{note}</p>}
    </>
  );
}

// ── Several entries ───────────────────────────────────────────────────────────

/** The small round picture of an entry: the country flag for a delegate, else the emblem / logo. */
export function EntryMark({ item, size }: { item: PromptItem; size: number }) {
  if (item.role === 'delegate') {
    return <CircleFlag code={item.countryCode} country={item.countryName} label={item.countryName} size={size} ring={false} decorative
      style={{ boxShadow: '0 0 0 1px rgba(27,56,40,0.12)' }} />;
  }
  if (item.role === 'organiser') {
    return <Emblem src={item.conference.conferenceLogoUrl} label={item.conference.conferenceAcronym || item.conference.conferenceName} size={size} />;
  }
  const label = item.role === 'standalone' ? item.name : item.room.committeeName;
  return <Emblem src={emblemFor(item)} label={label} size={size} />;
}

/** Title and sub-line of an entry in a list (the chooser and the profile menu). */
export function entryLines(item: PromptItem, t: T): { title: string; sub: string; code: string | null } {
  if (item.role === 'organiser') {
    const c = item.conference;
    return {
      title: c.conferenceAcronym || c.conferenceName,
      sub: t('srp_org_rows').replace('{live}', String(c.liveCount)).replace('{session}', String(c.inSessionCount)),
      code: null,
    };
  }
  if (item.role === 'standalone') {
    return {
      title: committeeNames(item.name, null).primary,
      sub: item.chairName ? t('srp_role_chair_named').replace('{name}', item.chairName) : t('srp_role_chair'),
      code: item.code.toUpperCase(),
    };
  }
  const r = item.room;
  const { primary } = committeeNames(r.committeeName, r.committeeAbbreviation);
  const conf = r.conferenceAcronym || r.conferenceName;
  if (item.role === 'delegate') {
    return { title: item.countryName, sub: `${primary} · ${conf}`, code: r.sessionCode };
  }
  return { title: primary, sub: `${roleWord(item, t)} · ${conf}`, code: r.sessionCode };
}

function Chooser({ items, t, primaryRef, onGo, onClose, onForget }: ViewProps & { items: PromptItem[] }) {
  return (
    <>
      <p style={{ fontSize: 14, color: LR.inkSoft, marginTop: -6 }}>{t('srp_chooser_hint')}</p>
      <ul className="srp-list" role="list">
        {items.map((item, i) => {
          const { title, sub, code } = entryLines(item, t);
          const room = roomOf(item);
          return (
            <li key={item.key} className="srp-row">
              <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
                <EntryMark item={item} size={52} />
                {room?.conferenceCountry && item.role !== 'delegate' && (
                  <CircleFlag country={room.conferenceCountry} title={room.conferenceCountry} size={22} ring={false}
                    className="absolute" style={{ position: 'absolute', insetInlineEnd: -4, bottom: -3, boxShadow: `0 0 0 2px ${LR.surface}` }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate" style={{ fontSize: 16, fontWeight: 800, color: LR.forest, lineHeight: 1.2 }}>{title}</p>
                <p className="truncate" title={sub} style={{ fontSize: 12.5, color: LR.inkSoft }}>
                  {code && <><span dir="ltr" style={{ fontWeight: 800, color: LR.ink, letterSpacing: '0.08em' }}>{code}</span> <span aria-hidden>·</span> </>}
                  {sub}
                </p>
                {room && <StatusLine status={statusOf(room)} t={t} compact />}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {item.role === 'standalone' && (
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
                  aria-label={`${actionLabel(item, t, true)}: ${title}`}
                  className="srp-row-go focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-2"
                >
                  <ActionIcon item={item} size={16} />
                  <span>{actionLabel(item, t, false)}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onClose} className="srp-secondary w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40">
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
  background:${LR.surface};border-radius:28px;padding:24px;display:flex;flex-direction:column;gap:18px;
  box-shadow:0 1px 0 rgba(255,255,255,0.8) inset,0 0 0 1px rgba(27,56,40,0.08),0 30px 80px rgba(16,30,22,0.35);
  animation:srpPop 260ms cubic-bezier(0.32,0.72,0,1) both;overscroll-behavior:contain}
.srp-x{position:absolute;top:14px;inset-inline-end:14px;width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;
  color:${LR.inkSoft};background:transparent;transition:background-color 150ms ease,color 150ms ease}
.srp-x:hover{background:rgba(27,56,40,0.07);color:${LR.forest}}
.srp-hero{display:flex;align-items:center;gap:22px;padding:18px;border-radius:22px;
  background:linear-gradient(160deg,#FFFDF8 0%,${LR.page} 100%);box-shadow:inset 0 0 0 1px rgba(27,56,40,0.06)}
.srp-acronym{font-size:30px;font-weight:900;line-height:1.02;letter-spacing:-0.01em;overflow-wrap:anywhere}
.srp-num{font-size:34px;font-weight:900;line-height:1;color:${LR.forest};font-variant-numeric:tabular-nums}
.srp-topic{padding:0 4px}
.srp-clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-wrap:pretty}
.srp-actions{display:flex;gap:10px}
.srp-primary{flex:1.5;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 18px;border-radius:16px;
  background:linear-gradient(180deg,${LR.forest2} 0%,${LR.forest} 100%);color:${LR.gold};font-weight:800;font-size:16.5px;
  box-shadow:0 1px 0 rgba(255,255,255,0.14) inset,0 8px 20px rgba(27,56,40,0.28);transition:transform 120ms ease,filter 150ms ease}
.srp-primary:hover{filter:brightness(1.08)}
.srp-primary:active{transform:scale(0.97)}
.srp-secondary{flex:1;min-height:54px;padding:0 16px;border-radius:16px;font-weight:700;font-size:15px;color:${LR.forest};
  background:transparent;box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.18);transition:background-color 150ms ease,transform 120ms ease}
.srp-secondary:hover{background:rgba(27,56,40,0.06)}
.srp-secondary:active{transform:scale(0.98)}
.srp-list{display:flex;flex-direction:column;gap:8px;max-height:min(52dvh,420px);overflow-y:auto;margin:0 -4px;padding:2px 4px}
.srp-row{display:flex;align-items:center;gap:14px;padding:12px 12px 12px 14px;border-radius:18px;background:#FFFDF8;
  box-shadow:0 0 0 1px rgba(27,56,40,0.07),0 2px 6px rgba(27,56,40,0.06)}
.srp-row-go{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:12px;background:${LR.forest};color:${LR.gold};
  font-weight:800;font-size:14px;white-space:nowrap;transition:transform 120ms ease,filter 150ms ease}
.srp-row-go:hover{filter:brightness(1.12)}
.srp-row-go:active{transform:scale(0.96)}
.srp-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:${LR.inkSoft};transition:background-color 150ms ease}
.srp-icon:hover{background:rgba(27,56,40,0.07);color:${LR.forest}}
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
