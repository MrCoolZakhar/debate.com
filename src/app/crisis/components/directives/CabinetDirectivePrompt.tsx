'use client';
// Gavelling Crisis: the Crisis Director's prompt for a new cabinet directive. Cabinet directives are assigned to the Director by
// the database (docs/crisis/sql/027); whenever one is waiting for them this big centred pop-up opens over a dimmed page on any staff
// page, under a playful "New Cabinet Directive!" banner: Review (opens it the way a notification does), Allocate to someone else
// (the second step replaces the pop-up's content, never a second pop-up) or X. What was handled or dismissed is remembered on this
// device. The directive is drawn as design B (cabinetStamp.tsx): a card framed in its cabinet's colour with the seal and the number
// on its top border, the name a small label, the title large; the sender is only a small "From" fact beside "Sent" (owner, 1 Nov 2026), the text 15px. It waits while any dialog is open and never shows what was already waiting for more than 30 minutes when the page opened.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, ScrollText, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, listDirectives, listQueuedCabinetDirectivesFor } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive } from '@/lib/crisis/types';
import { serverNow } from '@/lib/serverClock';
import { agoLabel, Avatar, CK, useScrollLock } from '../../crisisKit';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { staffLoads } from '../command/commandData';
import { responsibleMembers } from '../command/setupKit';
import { authorName, buildNames } from './directiveKit';
import { StaffPic } from './directiveParts';
import { CARD_GAP_BELOW, CabinetCrest, CabinetHead, CabinetName, SEAL_POP, cabinetColorOf, cabinetRing, cabinetWash, crestIndent } from './cabinetStamp';
import { plainText } from './attachedImage';
import PopBanner from './PopBanner';
import { useNow } from './useNow';

const BACKLOG_MS = 30 * 60 * 1000;
const WATCH_MS = 1500;
const KEEP_HANDLED = 300;

const storageKey = (crisisId: string, memberId: string) => `gavelling-crisis-cd-prompt:${crisisId}:${memberId}`;

function readHandled(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}

function writeHandled(key: string, ids: Set<string>): void {
  try { window.localStorage.setItem(key, JSON.stringify([...ids].slice(-KEEP_HANDLED))); } catch { /* the prompt may come back after a reload; nothing else breaks */ }
}

/** A dialog or pop-up (anything but this card) is open right now. */
function otherDialogOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"]:not([data-cd-prompt]), [role="dialog"]:not([data-cd-prompt])');
}

export default function CabinetDirectivePrompt() {
  const v = useCrisis();
  const router = useRouter();
  const { ref, core, memberId } = v;
  const enabled = v.role === 'director' && !!memberId;
  const key = enabled ? storageKey(ref.id, memberId as string) : '';

  const [rows, setRows] = useState<Directive[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRead = useRef(true);
  const now = useNow();

  // Read this device's list of handled directives again whenever it changes (or the person does).
  const handled = useMemo(() => {
    void version; // a new write to the device list bumps it
    return key && typeof window !== 'undefined' ? readHandled(key) : new Set<string>();
  }, [key, version]);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = await listQueuedCabinetDirectivesFor(ref, memberId as string);
      if (firstRead.current) {
        // What was already waiting when the page opened: only the last 30 minutes may pop up.
        firstRead.current = false;
        const cutoff = serverNow() - BACKLOG_MS;
        const old = list.filter((d) => new Date(d.updated_at).getTime() < cutoff).map((d) => d.id);
        if (old.length) setSkipped(new Set(old));
      }
      setRows(list);
    } catch { /* the next ping or poll retries; a prompt must never show an error */ }
  }, [enabled, ref, memberId]);

  useEffect(() => {
    firstRead.current = true;
    void Promise.resolve().then(load);
  }, [load]);

  const watch = useCallback(() => { setBlocked(otherDialogOpen()); }, []);
  useCrisisLive(enabled ? ref.id : null, ['crisis_directives'], () => { void load(); watch(); });
  useEffect(() => {
    if (!enabled) return;
    void Promise.resolve().then(watch);
    const t = window.setInterval(watch, WATCH_MS);
    return () => window.clearInterval(t);
  }, [enabled, watch]);

  const pending = useMemo(
    () => rows.filter((d) => d.status === 'queued' && d.assigned_member_id === memberId && !handled.has(d.id) && !skipped.has(d.id)),
    [rows, memberId, handled, skipped],
  );
  const current = pending.length ? pending[cursor % pending.length] : null;

  // Never while the Director is already looking at this very directive (?d=<id> on the directives page).
  const viewing = !!current && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('d') === current.id;

  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);
  const others = useMemo(() => responsibleMembers(core.members).filter((m) => m.id !== memberId), [core.members, memberId]);

  const markHandled = (id: string) => {
    const next = readHandled(key);
    next.add(id);
    writeHandled(key, next);
    setVersion((x) => x + 1);
    setPickFor(null);
  };

  const review = (d: Directive) => {
    markHandled(d.id);
    router.push(`${crisisBase(ref)}/directives?d=${d.id}`);
  };

  const openAllocate = (d: Directive) => {
    setPickFor(d.id);
    setCounts(null);
    void listDirectives(ref)
      .then((all) => setCounts(new Map(staffLoads(core.members, all, serverNow()).map((l) => [l.member.id, l.open.length]))))
      .catch(() => { /* the list works without the counts */ });
  };

  const allocate = async (d: Directive, to: { id: string; display_name: string }) => {
    if (busy) return;
    setBusy(true);
    try {
      await assignDirective(ref, d.id, to.id);
      markHandled(d.id);
      notifyOk(`Moved to ${to.display_name}`, 'crisis-command');
      void load();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not move this directive.'), 'crisis-command');
    } finally { setBusy(false); }
  };

  const shown = enabled && !!current && !blocked && !viewing;
  useScrollLock(shown);

  // Escape closes it (or goes back from the allocate step); Tab stays inside; focus returns where it was.
  const panel = useRef<HTMLDivElement>(null);
  const escRef = useRef<() => void>(() => {});
  useEffect(() => {
    escRef.current = () => {
      if (pickFor) { setPickFor(null); return; }
      if (current) markHandled(current.id);
    };
  });
  useEffect(() => {
    if (!shown) return undefined;
    const el = panel.current;
    const before = document.activeElement as HTMLElement | null;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented || document.querySelector('[data-crisis-popover]')) return;
        escRef.current();
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
  }, [shown]);

  if (!shown || !current) return null;

  const d = current;
  const character = d.author_character_id ? names.characters.get(d.author_character_id) ?? null : null;
  const author = authorName(d, names);
  const cabinet = d.cabinet_id ? names.cabinets.get(d.cabinet_id) ?? null : null;
  const picking = pickFor === d.id;
  const arrived = agoLabel(d.waiting_since || d.created_at, now);
  const bigBtn = { border: 0, borderRadius: 13, padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: CK.font } as const;

  return (
    <Portal>
      <div className="cd-wrap" style={{ position: 'fixed', inset: 0, zIndex: 240, display: 'grid', placeItems: 'center', padding: '16px 12px', fontFamily: CK.font }}>
        <style>{`
          @keyframes cd-pop-in { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: none; } }
          .cd-panel { animation: cd-pop-in 260ms cubic-bezier(0.22,1,0.36,1); }
          @media (prefers-reduced-motion: reduce) { .cd-panel { animation: none; } }
        `}</style>
        <div aria-hidden className="cm-fade" onMouseDown={() => markHandled(d.id)} style={{ position: 'absolute', inset: 0, background: 'rgba(42,10,12,0.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
        <div
          ref={panel}
          data-cd-prompt=""
          role="dialog"
          aria-modal="true"
          aria-label={picking ? 'Allocate this directive' : 'New cabinet directive'}
          tabIndex={-1}
          className="cd-panel focus:outline-none"
          style={{ position: 'relative', width: 'min(600px, 100%)', maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column', background: CK.surface, color: CK.ink, borderRadius: 26, padding: 14, boxShadow: '0 28px 70px rgba(42,10,12,0.5)' }}
        >
          <PopBanner icon={<ScrollText size={26} strokeWidth={1.6} />}>New Cabinet Directive!</PopBanner>

          <div className="flex items-center" style={{ gap: 8, minHeight: 36, marginTop: 10, marginBottom: picking ? 0 : 4 }}>
            {picking ? (
              <button
                type="button"
                onClick={() => setPickFor(null)}
                aria-label="Back"
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ gap: 4, border: 0, background: 'transparent', cursor: 'pointer', padding: '5px 8px 5px 2px', borderRadius: 8, fontFamily: CK.font, fontSize: 14, fontWeight: 700, color: CK.forest }}
              >
                <ArrowLeft size={17} strokeWidth={1.5} aria-hidden />Back
              </button>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>Waiting for you to review it</span>
            )}
            <span className="flex-1" />
            {!picking && pending.length > 1 && (
              <button
                type="button"
                onClick={() => setCursor((c) => c + 1)}
                aria-label="Show the next waiting directive"
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ gap: 2, border: 0, background: 'transparent', cursor: 'pointer', padding: '4px 4px 4px 8px', borderRadius: 8, fontFamily: CK.font, fontSize: 14, fontWeight: 700, color: CK.inkSoft }}
              >
                {(cursor % pending.length) + 1} of {pending.length}<ChevronRight size={16} strokeWidth={1.5} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => markHandled(d.id)}
              aria-label="Close"
              className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 34, height: 34, cursor: 'pointer', flex: 'none' }}
            >
              <X size={17} strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          {!picking && (
            <div key={d.id} className={cursor > 0 ? 'cm-next' : undefined} style={{ flex: 'none', minHeight: 0 }}>
              <div style={{ position: 'relative', overflow: 'visible', background: cabinetWash(cabinetColorOf(cabinet)), borderRadius: 20, padding: '22px 18px 16px', boxShadow: cabinetRing(cabinetColorOf(cabinet), 3, CK.shadow), margin: `${SEAL_POP / 2 + 6}px 6px ${CARD_GAP_BELOW}px` }}>
                {/* The seal, the number and the small stamp sit on the card's top border; who sent it is only a small fact under the title. */}
                <CabinetCrest cabinet={cabinet} n={dirNumber(d)} sealSize={SEAL_POP} left={18} stamp="pop" />
                <CabinetName cabinet={cabinet} size={14.5} indent={crestIndent(SEAL_POP)} />
                <b style={{ display: 'block', marginTop: 10, fontSize: 25, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{d.title}</b>
                <p className="flex items-center flex-wrap" style={{ margin: '8px 0 0', gap: '2px 7px', fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>
                  <span style={{ color: CK.muted }}>From</span>
                  <Avatar name={author} src={character?.picture_url ?? null} size={20} color={cabinetColorOf(cabinet)} />
                  <b style={{ color: CK.ink, fontWeight: 800, overflowWrap: 'anywhere' }}>{author}</b>
                  <span style={{ color: CK.muted }}>· Sent {arrived || 'just now'}</span>
                </p>
                <p key="body" className="cm-fade" style={{ margin: '10px 0 0', maxHeight: 'min(30dvh, 250px)', overflowY: 'auto', background: CK.well, borderRadius: 14, padding: '11px 14px', fontSize: 15, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {plainText(d.body)}
                </p>
              </div>
            </div>
          )}

          {picking && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 6 }}>
            <div key={d.id} className="flex items-center" style={{ gap: 10 }}>
              <CabinetHead cabinet={cabinet} n={dirNumber(d)} sealSize={32} nameSize={13.5} />
            </div>
            <b style={{ display: 'block', marginTop: 8, fontSize: 18, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{d.title}</b>

            <div role="listbox" aria-label="Staff" className="cm-fade" style={{ marginTop: 14, maxHeight: 'min(320px, 44dvh)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {others.length === 0 && <p style={{ margin: 8, fontSize: 14, color: CK.inkSoft }}>There is nobody else on the staff yet</p>}
                {others.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    disabled={busy}
                    onClick={() => void allocate(d, m)}
                    className="cm-slide-in flex items-center w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] disabled:opacity-60"
                    style={{ ['--i' as string]: i, gap: 12, border: 0, cursor: busy ? 'default' : 'pointer', padding: '8px 10px', borderRadius: 12, background: 'transparent', fontFamily: CK.font }}
                  >
                    <StaffPic member={m} size={36} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 15, color: CK.ink, overflowWrap: 'anywhere', lineHeight: 1.2 }}>{m.display_name}</b>
                      <span style={{ fontSize: 12.5, color: CK.inkSoft }}>
                        {m.role === 'backroomer' ? 'Backroomer' : m.role === 'director' ? 'Crisis Director' : 'Assistant Crisis Director'}
                        {counts ? `, ${counts.get(m.id) ?? 0} open` : ''}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
          )}

          {!picking && (
            <div key="actions" className="cm-fade flex items-center flex-wrap" style={{ gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => review(d)}
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] cm-btn"
                style={{ ...bigBtn, background: CK.redBtn, color: '#FFF4E6', boxShadow: CK.shadowSm }}
              >
                Review
              </button>
              <button
                type="button"
                onClick={() => openAllocate(d)}
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] cm-btn"
                style={{ ...bigBtn, padding: '12px 18px', background: CK.card, color: CK.forest, boxShadow: `inset 0 0 0 1px ${CK.hair}` }}
              >
                Allocate to someone else
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
