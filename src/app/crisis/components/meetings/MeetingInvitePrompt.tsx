'use client';
// Gavelling Crisis: the delegate's pop-up for a meeting invitation (meetings go to the invited delegates first).
// Whenever a meeting in status awaiting_delegates names this delegate's character, was asked by someone else and has not been
// answered by them, this centred card opens on any delegate page: Accept or Decline. X, a click outside or Escape just closes it:
// the invitation stays in the Meetings tab, and this device remembers it was closed so it does not come back on a reload.
// It waits while any other dialog is open (checked every 1.5 s), shows one invitation at a time ("1 of N"), and never opens
// on top of another pop-up. Modelled on chair/ChairDirectivePrompt.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { listMeetings } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Meeting } from '@/lib/crisis/types';
import { CK, OverhangCard, useScrollLock } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { useMeetingPeople } from './MeetingRequestsStrip';
import { useMeetingResponses } from './useMeetingResponses';
import { AvatarStack, Fact, InviteButtons, NameList, cabinetColor, dueClock, requesterName, useMyCharacterId, whenText, type MeetingX } from './meetingKit';

const WATCH_MS = 1500;
const KEEP_HANDLED = 300;

const storageKey = (crisisId: string, memberId: string) => `gavelling-crisis-meeting-invite:${crisisId}:${memberId}`;

function readHandled(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}

function writeHandled(key: string, ids: Set<string>): void {
  try { window.localStorage.setItem(key, JSON.stringify([...ids].slice(-KEEP_HANDLED))); } catch { /* it may come back after a reload; nothing else breaks */ }
}

/** A dialog or pop-up (anything but this card) is open right now. */
function otherDialogOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"]:not([data-meeting-invite]), [role="dialog"]:not([data-meeting-invite])');
}

export default function MeetingInvitePrompt() {
  const { ref, core, memberId, role } = useCrisis();
  const myChar = useMyCharacterId();
  const enabled = role === 'delegate' && !!myChar;
  const key = enabled ? storageKey(ref.id, memberId ?? 'me') : '';

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const { responses, reload: reloadResponses } = useMeetingResponses(ref, enabled);
  const people = useMeetingPeople(ref, enabled);
  const [version, setVersion] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next'); // which way the "1 of N" card arrives from
  const panel = useRef<HTMLDivElement>(null);

  // This device's list of closed invitations, read again whenever it changes (or the person does).
  const handled = useMemo(() => {
    void version; // a new write to the device list bumps it
    return key && typeof window !== 'undefined' ? readHandled(key) : new Set<string>();
  }, [key, version]);

  const load = useCallback(async () => {
    if (!enabled) return;
    try { setMeetings((await listMeetings(ref)).filter((m) => m.status === 'awaiting_delegates')); } catch { /* the next ping or poll retries; a prompt must never show an error */ }
  }, [enabled, ref]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useCrisisLive(enabled ? ref.id : null, ['crisis_meetings'], () => { void load(); });

  const watch = useCallback(() => { setBlocked(otherDialogOpen()); }, []);
  useEffect(() => {
    if (!enabled) return;
    void Promise.resolve().then(watch);
    const t = window.setInterval(watch, WATCH_MS);
    return () => window.clearInterval(t);
  }, [enabled, watch]);

  // Oldest first. Nothing shows until the answers have been read once, so an answered invitation never flashes.
  const pending = useMemo<MeetingX[]>(
    () => (enabled && myChar && responses
      ? meetings
        .filter((m) => m.character_ids.includes(myChar) && m.requested_by_character !== myChar && !handled.has(m.id)
          && !responses.some((r) => r.meeting_id === m.id && r.character_id === myChar))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      : []),
    [enabled, myChar, responses, meetings, handled],
  );
  const current = pending.length ? pending[cursor % pending.length] : null;
  const shown = !!current && !blocked;
  useScrollLock(shown);

  const dismiss = useCallback((m: Meeting) => {
    const next = readHandled(key);
    next.add(m.id);
    writeHandled(key, next);
    setVersion((x) => x + 1);
  }, [key]);

  // Escape and a click outside close it (the invitation stays in the Meetings tab); Tab stays inside the card.
  const currentRef = useRef<Meeting | null>(null);
  useEffect(() => { currentRef.current = current; });
  useEffect(() => {
    if (!shown) return undefined;
    const el = panel.current;
    const before = document.activeElement as HTMLElement | null;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented || document.querySelector('[data-crisis-popover]')) return;
        if (currentRef.current) dismiss(currentRef.current);
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter((n) => n.offsetParent !== null);
      if (!nodes.length) { e.preventDefault(); return; }
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [shown, dismiss]);

  if (!enabled || !current) return null;

  const m = current as MeetingX;
  const asker = m.requested_by_character ? people.get(m.requested_by_character) : undefined;
  const askerName = requesterName(m, people, core.members);
  const askerColor = cabinetColor(core.cabinets, asker?.cabinet_id ?? null);
  const due = dueClock(m);
  const size = 60;
  const overhang = Math.round(size / 3);
  const at = cursor % pending.length;
  const step = (by: number) => { setDir(by < 0 ? 'prev' : 'next'); setCursor((at + by + pending.length) % pending.length); };
  const navBtn = { border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 30, height: 30, cursor: 'pointer', flex: 'none' } as const;

  return (
    <Portal>
      {/* Hidden (not unmounted) while another dialog is open. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 231, display: blocked ? 'none' : 'grid', placeItems: 'center', padding: '44px 12px 12px', fontFamily: CK.font }}>
        <style>{`
          @keyframes meeting-invite-in { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
          .meeting-invite { animation: meeting-invite-in 220ms cubic-bezier(0.22,1,0.36,1); }
          @media (prefers-reduced-motion: reduce) { .meeting-invite { animation: none; } }
        `}</style>
        <div aria-hidden className="cm-fade" onMouseDown={() => dismiss(m)} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.5)' }} />
        <div
          ref={panel}
          data-meeting-invite=""
          role="dialog"
          aria-modal="true"
          aria-label="Meeting invitation"
          tabIndex={-1}
          className="meeting-invite focus:outline-none"
          style={{ position: 'relative', width: 'min(540px, 100%)', maxHeight: 'calc(100dvh - 56px)' }}
        >
          <div key={m.id} className={pending.length > 1 ? (dir === 'prev' ? 'cm-prev' : 'cm-next') : undefined}>
          <OverhangCard
            name={askerName}
            src={asker?.picture_url}
            color={askerColor}
            size={size}
            warm
            style={{ padding: '12px 18px 18px', borderTop: `4px solid ${CK.red}`, boxShadow: `${CK.shadow}, 0 24px 60px rgba(58,14,15,0.4)` }}
          >
            <div className="flex items-start justify-between" style={{ gap: 8, paddingLeft: overhang + size + 12 - 18, minHeight: Math.round((size * 2) / 3) - 4 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="inline-flex items-center" style={{ gap: 5, fontSize: 11.5, fontWeight: 800, color: CK.red, letterSpacing: '0.03em' }}>
                  <CalendarClock size={14} strokeWidth={1.5} aria-hidden />Meeting invitation
                </span>
                <b style={{ display: 'block', marginTop: 2, fontSize: 16, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{askerName}</b>
                <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>asks to meet</span>
              </div>
              <div className="flex items-center" style={{ gap: 4, flex: 'none' }}>
                {pending.length > 1 && (
                  <>
                    <button type="button" onClick={() => step(-1)} aria-label="Show the previous invitation" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}>
                      <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
                    </button>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.inkSoft, fontVariantNumeric: 'tabular-nums', padding: '0 2px' }}>{at + 1} of {pending.length}</span>
                    <button type="button" onClick={() => step(1)} aria-label="Show the next invitation" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}>
                      <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
                    </button>
                  </>
                )}
                <button type="button" onClick={() => dismiss(m)} aria-label="Close, it stays in your Meetings tab" title="Close, it stays in your Meetings tab" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...navBtn, marginLeft: 4 }}>
                  <X size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex items-center flex-wrap" style={{ gap: 10, marginTop: 14 }}>
              <AvatarStack ids={m.character_ids.slice(0, 5)} people={people} cabinets={core.cabinets} size={40} />
              <p style={{ margin: 0, flex: '1 1 160px', minWidth: 0, fontSize: 14, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}><NameList ids={m.character_ids} people={people} /></p>
            </div>
            <p style={{ margin: '10px 0 12px', maxHeight: 'min(30dvh, 240px)', overflowY: 'auto', fontSize: 14.5, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.intention}</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <Fact label="Length">{m.duration_minutes} min</Fact>
              <Fact label="When">{whenText(m)}</Fact>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: CK.inkSoft }}>
              {due ? `If someone does not answer, it goes to the crisis team on its own at ${due}.` : 'If someone does not answer, it goes to the crisis team on its own after 5 minutes.'}
            </p>
            <div style={{ marginTop: 14 }}>
              <InviteButtons refx={ref} meetingId={m.id} size="md" onAnswered={() => { void load(); void reloadResponses(); }} />
            </div>
          </OverhangCard>
          </div>
        </div>
      </div>
    </Portal>
  );
}
