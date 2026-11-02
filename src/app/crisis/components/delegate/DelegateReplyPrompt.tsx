'use client';
// Gavelling Crisis: the delegate's "you got a reply" pop-up, the twin of the cabinet directive prompt. When one of MY directives is
// answered, needs more detail, or my chair sends it back or asks for changes, a centred card opens on any page: a banner OUTSIDE the
// card on ONE line in the display font with the outcome's colour ("Approved!", "Denied!", "More Detail Needed!", "Reply Received!"),
// then the directive's number and title, the reply, and Open (the directive pop-up) and X. One at a time with "1 of N". Each reply
// is remembered on this device once seen, so it shows once; a new reply to the same directive shows again. It never opens over another
// dialog (it waits, and appears when the other one is closed). The first time this device ever loads, replies that already exist are
// treated as seen, and replies older than three days never pop up.

import { useNow } from '../directives/useNow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { listDirectives, listNotes } from '@/lib/crisis/api';
import { dirNumber, isChairSendBack } from '@/lib/crisis/format';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive, DirectiveNote } from '@/lib/crisis/types';
import { Btn, CK, useScrollLock } from '../../crisisKit';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { crisisDisplay } from '../../displayFont';
import { DirectiveBody } from '../directives/attachedImage';
import { kindIcon, verdictOf, whenLabel } from './directiveUi';

const WATCH_MS = 1500;
const KEEP_HANDLED = 300;
const RECENT_MS = 3 * 24 * 60 * 60 * 1000;

const storageKey = (crisisId: string, memberId: string) => `gavelling-crisis-reply-prompt:${crisisId}:${memberId}`;
/** A new reply to the same directive has a new answered_at, so it counts as new. */
const stamp = (d: Directive) => `${d.id}@${d.status}@${d.answered_at ?? d.updated_at}`;

function readHandled(key: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}
function writeHandled(key: string, ids: Set<string>): void {
  try { window.localStorage.setItem(key, JSON.stringify([...ids].slice(-KEEP_HANDLED))); } catch { /* it may show again after a reload; nothing breaks */ }
}

/** Does this directive carry a reply the author should be told about? */
function hasReply(d: Directive): boolean {
  return d.status === 'answered' || d.status === 'clarify' || d.status === 'changes_requested' || d.status === 'rejected';
}

/** The banner's words, by what happened. */
function bannerWord(d: Directive): string {
  if (isChairSendBack(d)) return 'Sent Back!';
  if (d.status === 'changes_requested') return 'Changes Needed!';
  if (d.status === 'clarify' || d.outcome === 'clarify') return 'More Detail Needed!';
  if (d.outcome === 'approved') return 'Approved!';
  if (d.outcome === 'partial') return 'Partly Works!';
  if (d.outcome === 'denied') return 'Denied!';
  return 'Reply Received!';
}

/** A dialog or pop-up is open and visible right now. */
function otherDialogOpen(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]:not([data-reply-prompt]), [role="dialog"]:not([data-reply-prompt])'))
    .some((el) => el.getClientRects().length > 0);
}

const CSS = `
.rp-banner { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 13px 20px 12px; border-radius: 18px; text-align: center;
  color: #FFF8EC; box-shadow: 0 8px 22px rgba(58,14,15,0.42), inset 0 0 0 2px rgba(255,255,255,0.5), inset 0 -4px 0 rgba(0,0,0,0.22);
  animation: rp-pop 560ms cubic-bezier(0.34,1.56,0.64,1) both; }
.rp-banner::after { content: ''; position: absolute; top: -10%; bottom: -10%; width: 34%; left: -50%; transform: skewX(-18deg); pointer-events: none;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent); animation: rp-shine 900ms 480ms ease-out 1 both; }
.rp-title { margin: 0; white-space: nowrap; font-size: clamp(18px, 4.6vw, 30px); line-height: 1.1; letter-spacing: 0.02em; text-shadow: 0 2px 0 rgba(0,0,0,0.35); }
@keyframes rp-pop { 0% { opacity: 0; transform: scale(0.55) rotate(-3deg); } 62% { opacity: 1; transform: scale(1.07) rotate(1deg); } 100% { opacity: 1; transform: none; } }
@keyframes rp-shine { from { left: -50%; } to { left: 130%; } }
@keyframes rp-in { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
.rp-panel { animation: rp-in 220ms cubic-bezier(0.22,1,0.36,1); }
@media (prefers-reduced-motion: reduce) { .rp-banner, .rp-panel { animation: none; } .rp-banner::after { display: none; } }
`;

export default function DelegateReplyPrompt() {
  const v = useCrisis();
  const { ref, memberId } = v;
  const router = useRouter();
  const pathname = usePathname();
  const enabled = v.role === 'delegate' && !!memberId;
  const key = enabled && memberId ? storageKey(ref.id, memberId) : '';

  const [rows, setRows] = useState<Directive[] | null>(null);
  const [version, setVersion] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [notes, setNotes] = useState<Record<string, DirectiveNote[]>>({});
  const panel = useRef<HTMLDivElement>(null);

  const mine = useMemo(() => (rows ?? []).filter((d) => !!memberId && d.author_member_id === memberId && hasReply(d)), [rows, memberId]);

  // The first time this device ever loads, what is already there counts as seen.
  useEffect(() => {
    if (!enabled || !key || rows === null) return;
    if (readHandled(key) === null) {
      writeHandled(key, new Set(mine.map(stamp)));
      void Promise.resolve().then(() => setVersion((x) => x + 1));
    }
  }, [enabled, key, rows, mine]);

  // This device's list of replies already seen; null until the first-load seeding above has written it.
  const handled = useMemo(() => {
    void version;
    return key && typeof window !== 'undefined' ? readHandled(key) : null;
  }, [key, version]);

  const load = useCallback(async () => {
    if (!enabled) return;
    try { setRows(await listDirectives(ref)); } catch { /* the next ping retries; a prompt must never show an error */ }
  }, [enabled, ref]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const watch = useCallback(() => { setBlocked(otherDialogOpen()); }, []);
  useCrisisLive(enabled ? ref.id : null, ['crisis_directives'], () => { void load(); watch(); });
  useEffect(() => {
    if (!enabled) return undefined;
    void Promise.resolve().then(watch);
    const t = window.setInterval(watch, WATCH_MS);
    return () => window.clearInterval(t);
  }, [enabled, watch]);

  // Newest reply first; old ones and ones already seen on this device never show.
  const now = useNow(60_000);
  const pending = useMemo(() => {
    if (handled === null) return [];
    return mine
      .filter((d) => !handled.has(stamp(d)) && now - new Date(d.answered_at ?? d.updated_at).getTime() < RECENT_MS)
      .sort((a, b) => (b.answered_at ?? b.updated_at).localeCompare(a.answered_at ?? a.updated_at));
  }, [mine, handled, now]);

  const current = pending.length ? pending[cursor % pending.length] : null;
  const shown = !!current && !blocked;
  useScrollLock(shown);

  // A chair's send-back keeps its words in the conversation, not in the stored reply: read them for the card.
  const currentId = current && isChairSendBack(current) ? current.id : null;
  useEffect(() => {
    if (!currentId || !shown) return;
    let off = false;
    void listNotes(ref, currentId).then((n) => { if (!off) setNotes((p) => ({ ...p, [currentId]: n })); }).catch(() => { /* the card just shows the stored reply */ });
    return () => { off = true; };
  }, [currentId, shown, ref]);

  const dismiss = useCallback((d: Directive) => {
    if (!key) return;
    const next = readHandled(key) ?? new Set<string>();
    next.add(stamp(d));
    writeHandled(key, next);
    setVersion((x) => x + 1);
  }, [key]);

  const closeRef = useRef<(() => void) | null>(null);
  useEffect(() => { closeRef.current = current ? () => dismiss(current) : null; });
  useEffect(() => {
    if (!shown) return undefined;
    const el = panel.current;
    const before = document.activeElement as HTMLElement | null;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented || document.querySelector('[data-crisis-popover]')) return;
        closeRef.current?.();
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

  if (!enabled || !current || blocked) return null;

  const d = current;
  const verdict = verdictOf(d, 14);
  const tone = verdict.color;
  const queue = pending.length;
  const at = queue > 1 ? cursor % queue : 0;
  const step = (by: number) => setCursor((at + by + queue) % queue);
  const sentBack = isChairSendBack(d);
  const lastNote = sentBack ? [...(notes[d.id] ?? [])].reverse().find((n) => n.member_id !== memberId) ?? null : null;
  const reply = (lastNote?.body ?? (sentBack ? '' : d.reply ?? '')).trim();
  const navBtn = { border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 30, height: 30, cursor: 'pointer', flex: 'none' } as const;

  const open = () => {
    dismiss(d);
    const base = crisisBase(ref);
    router.push(pathname === base ? `${base}?d=${d.id}` : `${base}/directives?d=${d.id}`);
  };

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, zIndex: 230, display: 'grid', placeItems: 'center', padding: '44px 12px 12px', fontFamily: CK.font }}>
        <style>{CSS}</style>
        <div aria-hidden className="cm-fade" onMouseDown={() => dismiss(d)} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.5)' }} />
        <div
          ref={panel}
          data-reply-prompt=""
          role="dialog"
          aria-modal="true"
          aria-label={`Reply to your directive: ${bannerWord(d).replace('!', '')}`}
          tabIndex={-1}
          className="rp-panel focus:outline-none"
          style={{ position: 'relative', width: 'min(560px, 100%)', maxHeight: 'calc(100dvh - 56px)', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {/* The banner sits OUTSIDE the card, on one line, in the outcome's colour. */}
          <div className="rp-banner" style={{ background: `linear-gradient(135deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 70%), ${tone}` }}>
            <h2 className={`rp-title ${crisisDisplay.className}`}>{bannerWord(d)}</h2>
          </div>
          <div style={{ minHeight: 0, overflowY: 'auto', background: CK.card, borderRadius: 22, padding: '14px 18px 16px', boxShadow: `${CK.shadow}, 0 24px 60px rgba(58,14,15,0.4)` }}>
            <div className="flex items-start justify-between" style={{ gap: 8 }}>
              <div className="min-w-0" style={{ flex: 1 }}>
                <p className="flex items-center flex-wrap" style={{ margin: 0, gap: 6, fontSize: 12, fontWeight: 800, color: tone }}>
                  {verdict.icon}{verdict.word}
                  <span style={{ fontWeight: 600, color: CK.muted }}>{d.answered_at ? whenLabel(d.answered_at) : ''}</span>
                </p>
                <h3 className="flex items-start" style={{ margin: '4px 0 0', gap: 8, fontSize: 18, lineHeight: 1.28, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>
                  <span style={{ color: CK.red, flex: 'none', paddingTop: 2, lineHeight: 0 }}>{kindIcon(d.kind, 18)}</span>
                  <span>{dirNumber(d)}: {d.title}</span>
                </h3>
              </div>
              <div className="flex items-center" style={{ gap: 4, flex: 'none' }}>
                {queue > 1 && (
                  <>
                    <button type="button" onClick={() => step(-1)} aria-label="Show the previous reply" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}>
                      <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
                    </button>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.inkSoft, fontVariantNumeric: 'tabular-nums', padding: '0 2px' }}>{at + 1} of {queue}</span>
                    <button type="button" onClick={() => step(1)} aria-label="Show the next reply" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}>
                      <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
                    </button>
                  </>
                )}
                <button type="button" onClick={() => dismiss(d)} aria-label="Close" title="Close" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...navBtn, marginLeft: 4 }}>
                  <X size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </div>
            <div style={{ marginTop: 10, maxHeight: 'min(40dvh, 340px)', overflowY: 'auto', background: CK.well, borderRadius: 14, padding: '10px 12px' }}>
              {reply ? (
                <DirectiveBody body={reply} thumb={320} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>No written reply. Open the directive to read the whole conversation.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 12 }}>
              <Btn tone="green" onClick={open}>Open</Btn>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
