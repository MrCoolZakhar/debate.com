'use client';
// Gavelling Crisis: the chair's pop-up for a cabinet directive waiting for their decision (Round 10).
// Whenever a cabinet directive of the chair's cabinet is waiting (kind committee, status awaiting_chair) this centred card
// opens on any chair page: Approve (to the backroom), Request changes (back to the author as a draft, with a note) or Reject
// (final). Both of the last two ask for an optional note IN PLACE: the card's content is replaced by the note field with a
// Back button, never a second pop-up. X, a click outside or Escape just closes it: the directive stays in "Cabinet Directives
// For You" on the Front Room, and this device remembers it was closed so it does not come back on a reload (a new directive,
// or the same one sent again, does pop up). It waits while any other dialog is open (and hides, keeping what was typed).
//
// ChairDirectiveCard is the one card, also drawn inline by the Front Room (chair/ChairApproval.tsx).

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Gavel, PencilLine, X, XCircle } from 'lucide-react';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, listDirectives, requestDirectiveChanges, reviewDirectiveAsChair, type CrisisRef } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Cabinet, Character, Directive, Member } from '@/lib/crisis/types';
import { Btn, CK, fieldStyle, OverhangCard, ThemeTag, useScrollLock } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { whenLabel, whenTitle } from '../delegate/directiveUi';
import { DirectiveBody, splitAttached } from '../directives/attachedImage';
import { NumberBadge } from '../directives/directiveParts';
import { ZoomableImage } from '../news/ImageLightbox';

const WATCH_MS = 1500;
const KEEP_HANDLED = 300;
const LONG = 260; // characters; a longer text starts folded in the list

// ───────────── who wrote it ─────────────

export interface DirectiveAuthor { name: string; picture_url: string | null; color: string }

/** The author's character (else their own name), with their cabinet's colour. */
export function directiveAuthor(d: Directive, characters: Character[], members: Member[], cabinets: Cabinet[]): DirectiveAuthor {
  const ch = d.author_character_id ? characters.find((c) => c.id === d.author_character_id) : undefined;
  const cab = cabinets.find((c) => c.id === (ch?.cabinet_id ?? d.cabinet_id));
  const color = cab?.color ?? CK.red;
  if (ch) return { name: ch.name, picture_url: ch.picture_url, color };
  const m = d.author_member_id ? members.find((x) => x.id === d.author_member_id) : undefined;
  return { name: m?.display_name ?? 'A delegate', picture_url: m?.picture_url ?? null, color };
}

// ───────────── the card ─────────────

type Mode = 'view' | 'changes' | 'reject';
type Doing = 'approve' | 'changes' | 'reject';

const COPY: Record<Exclude<Mode, 'view'>, { heading: string; line: string; label: string; busy: string; tone: 'red'; ask: string; ok: string }> = {
  changes: {
    heading: 'What should change?', line: 'It goes back to the author as a draft, with your note.',
    label: 'Send back for changes', busy: 'Sending back', tone: 'red', ask: 'Note for the author (optional)', ok: 'Sent back to the author for changes',
  },
  reject: {
    heading: 'Reject this directive?', line: 'This is final. Nothing goes to the backroom.',
    label: 'Reject directive', busy: 'Rejecting', tone: 'red', ask: 'Note for the author (optional)', ok: 'Directive rejected',
  },
};

/**
 * One cabinet directive waiting for the chair, with the three ways to deal with it. `popup` shows the whole text in a scroll
 * area; `inline` (the Front Room) folds a long text. `topBar` sits at the card's top right (the pop-up's navigation and X).
 */
export function ChairDirectiveCard({ d, author, cref, cabinetName, variant, focused = false, topBar, onDone }: {
  d: Directive; author: DirectiveAuthor; cref: CrisisRef; cabinetName: string | null; variant: 'popup' | 'inline';
  focused?: boolean; topBar?: ReactNode; onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>('view');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Doing | null>(null);
  const [open, setOpen] = useState(focused);
  const root = useRef<HTMLDivElement>(null);
  const popup = variant === 'popup';
  const size = popup ? 60 : 48;
  const overhang = Math.round(size / 3);
  const { text, image } = splitAttached(d.body);
  const long = !popup && (text.length > LONG || text.split('\n').length > 4);

  useEffect(() => {
    if (focused) root.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focused]);

  const run = async (kind: Doing) => {
    if (busy) return;
    setBusy(kind);
    try {
      const landed = kind === 'approve'
        ? await reviewDirectiveAsChair(cref, d.id, true, null)
        : kind === 'changes'
          ? await requestDirectiveChanges(cref, d.id, note)
          : await reviewDirectiveAsChair(cref, d.id, false, note);
      if (landed) notifyOk(kind === 'approve' ? 'Sent to the backroom' : COPY[kind].ok, 'crisis-chair');
      else notifyErr('This directive was already dealt with.', 'crisis-chair');
      onDone();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save that decision. Try again.'), 'crisis-chair');
    } finally {
      setBusy(null);
    }
  };

  // Escape inside the note step goes back to the card first; only then does it close the pop-up.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape' && mode !== 'view' && !busy) {
      e.preventDefault();
      e.stopPropagation();
      setMode('view');
      setNote('');
    }
  };

  const back = () => { setMode('view'); setNote(''); };
  const header = (
    <div className="flex items-start justify-between" style={{ gap: 8, paddingLeft: overhang + size + 12 - 18, minHeight: Math.round((size * 2) / 3) - 4 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span className="inline-flex items-center" style={{ gap: 5, fontSize: 11.5, fontWeight: 800, color: CK.red, letterSpacing: '0.03em' }}>
          <Gavel size={14} strokeWidth={1.5} aria-hidden />Needs your decision
        </span>
        <b style={{ display: 'block', marginTop: 2, fontSize: popup ? 16 : 15, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{author.name}</b>
        <span className="flex items-center flex-wrap" style={{ gap: '2px 8px', marginTop: 3, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>
          <NumberBadge n={dirNumber(d)} />
          {cabinetName && <span style={{ overflowWrap: 'anywhere' }}>{cabinetName}</span>}
          <span title={whenTitle(d.created_at)} style={{ color: CK.muted }}>Sent {whenLabel(d.created_at)}</span>
        </span>
      </div>
      {topBar}
    </div>
  );

  const asking = mode !== 'view' ? COPY[mode] : null;

  return (
    <div ref={root} onKeyDown={onKeyDown}>
      <OverhangCard
        name={author.name}
        src={author.picture_url}
        color={author.color}
        size={size}
        warm
        style={{
          padding: '12px 18px 18px',
          borderTop: `4px solid ${CK.red}`,
          boxShadow: popup ? `${CK.shadow}, 0 24px 60px rgba(58,14,15,0.4)` : focused ? `${CK.shadow}, 0 0 0 2px ${CK.red}` : CK.shadow,
        }}
      >
        {header}

        {!asking ? (
          <>
            <h3 style={{ margin: '12px 0 0', fontSize: popup ? 20 : 18, lineHeight: 1.28, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</h3>
            {(d.themes ?? []).length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
                {(d.themes ?? []).map((t) => <ThemeTag key={t} theme={t} />)}
              </div>
            )}
            {popup ? (
              <div style={{ marginTop: 10, maxHeight: 'min(44dvh, 420px)', overflowY: 'auto', paddingRight: 2 }}>
                <DirectiveBody body={d.body} thumb={360} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />
              </div>
            ) : (
              <>
                <p
                  className={long && !open ? 'line-clamp-3' : undefined}
                  style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {text}
                </p>
                {image && <ZoomableImage src={image} alt="Attached image" style={{ width: 'min(100%, 240px)', height: 160, borderRadius: 14, marginTop: 8 }} />}
                {long && (
                  <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                    style={{ marginTop: 4, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 13, fontWeight: 800, color: CK.forest, textDecoration: 'underline' }}
                  >
                    {open ? <ChevronUp size={14} strokeWidth={1.6} aria-hidden /> : <ChevronDown size={14} strokeWidth={1.6} aria-hidden />}
                    {open ? 'Show less' : 'Read all'}
                  </button>
                )}
              </>
            )}
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 14 }}>
              <Btn tone="green" icon={<Check size={16} strokeWidth={1.6} aria-hidden />} disabled={!!busy} onClick={() => run('approve')} title="Sends it to the backroom">
                {busy === 'approve' ? 'Approving' : 'Approve'}
              </Btn>
              <Btn tone="ghost" icon={<PencilLine size={16} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => setMode('changes')}>Request changes</Btn>
              <Btn tone="danger" icon={<XCircle size={16} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => setMode('reject')}>Reject</Btn>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={back}
              disabled={!!busy}
              className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] disabled:opacity-50"
              style={{ gap: 4, border: 0, background: 'transparent', cursor: 'pointer', padding: '3px 6px 3px 0', borderRadius: 8, fontFamily: CK.font, fontSize: 13, fontWeight: 700, color: CK.forest }}
            >
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />Back
            </button>
            <h3 style={{ margin: '6px 0 0', fontSize: 18, lineHeight: 1.28, fontWeight: 800, color: CK.ink }}>{asking.heading}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: CK.inkSoft }}>{asking.line}</p>
            <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</p>
            <label htmlFor={`chair-note-${d.id}`} style={{ display: 'block', margin: '10px 0 5px', fontSize: 13, fontWeight: 700, color: CK.ink }}>{asking.ask}</label>
            <textarea
              id={`chair-note-${d.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              autoFocus
              placeholder={mode === 'changes' ? 'Say what to change' : 'Say why'}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
              <Btn
                tone={asking.tone}
                icon={mode === 'changes' ? <PencilLine size={16} strokeWidth={1.5} aria-hidden /> : <XCircle size={16} strokeWidth={1.5} aria-hidden />}
                disabled={!!busy}
                onClick={() => run(mode as Doing)}
              >
                {busy === mode ? asking.busy : asking.label}
              </Btn>
              <Btn tone="ghost" disabled={!!busy} onClick={back}>Cancel</Btn>
            </div>
          </div>
        )}
      </OverhangCard>
    </div>
  );
}

// ───────────── the pop-up ─────────────

const storageKey = (crisisId: string, memberId: string) => `gavelling-crisis-chair-prompt:${crisisId}:${memberId}`;
/** A directive sent again keeps its id but changes `updated_at`, so it counts as new. */
const stamp = (d: Directive) => `${d.id}@${d.updated_at}`;

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
  return !!document.querySelector('[aria-modal="true"]:not([data-chair-prompt]), [role="dialog"]:not([data-chair-prompt])');
}

export default function ChairDirectivePrompt() {
  const v = useCrisis();
  const { ref, core, memberId, cabinetId } = v;
  const enabled = v.role === 'chair';
  const key = enabled ? storageKey(ref.id, memberId ?? 'chair') : '';

  const [rows, setRows] = useState<Directive[]>([]);
  const [version, setVersion] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const panel = useRef<HTMLDivElement>(null);

  // This device's list of closed directives, read again whenever it changes (or the person does).
  const handled = useMemo(() => {
    void version; // a new write to the device list bumps it
    return key && typeof window !== 'undefined' ? readHandled(key) : new Set<string>();
  }, [key, version]);

  const load = useCallback(async () => {
    if (!enabled) return;
    try { setRows(await listDirectives(ref)); } catch { /* the next ping or poll retries; a prompt must never show an error */ }
  }, [enabled, ref]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const watch = useCallback(() => {
    setBlocked(otherDialogOpen());
    // The Front Room opened on one directive (?d=<id>): that one is already in front of the chair.
    setViewing(new URLSearchParams(window.location.search).get('d'));
  }, []);
  useCrisisLive(enabled ? ref.id : null, ['crisis_directives'], () => { void load(); watch(); });
  useEffect(() => {
    if (!enabled) return;
    void Promise.resolve().then(watch);
    const t = window.setInterval(watch, WATCH_MS);
    return () => window.clearInterval(t);
  }, [enabled, watch]);

  // Longest waiting first.
  const pending = useMemo(
    () => rows
      .filter((d) => d.kind === 'committee' && d.status === 'awaiting_chair' && (!cabinetId || d.cabinet_id === cabinetId) && !handled.has(stamp(d)) && d.id !== viewing)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [rows, cabinetId, handled, viewing],
  );
  const current = pending.length ? pending[cursor % pending.length] : null;
  const shown = !!current && !blocked;
  useScrollLock(shown);

  const dismiss = useCallback((d: Directive) => {
    const next = readHandled(key);
    next.add(stamp(d));
    writeHandled(key, next);
    setVersion((x) => x + 1);
  }, [key]);

  // Escape and a click outside close it (the directive stays on the Front Room); Tab stays inside the card.
  const currentRef = useRef<Directive | null>(null);
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

  const d = current;
  const author = directiveAuthor(d, core.characters, core.members, core.cabinets);
  const cabinetName = d.cabinet_id ? core.cabinets.find((c) => c.id === d.cabinet_id)?.name ?? null : null;
  const at = cursor % pending.length;
  const step = (by: number) => setCursor((at + by + pending.length) % pending.length);
  const navBtn = { border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 30, height: 30, cursor: 'pointer', flex: 'none' } as const;

  const topBar = (
    <div className="flex items-center" style={{ gap: 4, flex: 'none' }}>
      {pending.length > 1 && (
        <>
          <button type="button" onClick={() => step(-1)} aria-label="Show the previous waiting directive" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}>
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.inkSoft, fontVariantNumeric: 'tabular-nums', padding: '0 2px' }}>{at + 1} of {pending.length}</span>
          <button type="button" onClick={() => step(1)} aria-label="Show the next waiting directive" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}>
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </>
      )}
      <button type="button" onClick={() => dismiss(d)} aria-label="Close, it stays in your list" title="Close, it stays in your list" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...navBtn, marginLeft: 4 }}>
        <X size={16} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );

  return (
    <Portal>
      {/* Hidden (not unmounted) while another dialog is open, so a half-written note is not lost. */}
      <div className="chair-pop-wrap" style={{ position: 'fixed', inset: 0, zIndex: 230, display: blocked ? 'none' : 'grid', placeItems: 'center', padding: '44px 12px 12px', fontFamily: CK.font }}>
        <style>{`
          @keyframes chair-pop-in { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
          .chair-pop { animation: chair-pop-in 220ms cubic-bezier(0.22,1,0.36,1); }
          @media (prefers-reduced-motion: reduce) { .chair-pop { animation: none; } }
        `}</style>
        <div aria-hidden onMouseDown={() => dismiss(d)} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.5)' }} />
        <div
          ref={panel}
          data-chair-prompt=""
          role="dialog"
          aria-modal="true"
          aria-label="Cabinet directive for your decision"
          tabIndex={-1}
          className="chair-pop focus:outline-none"
          style={{ position: 'relative', width: 'min(580px, 100%)', maxHeight: 'calc(100dvh - 56px)' }}
        >
          <ChairDirectiveCard
            key={stamp(d)}
            d={d}
            author={author}
            cref={ref}
            cabinetName={cabinetName}
            variant="popup"
            topBar={topBar}
            onDone={() => { void load(); }}
          />
        </div>
      </div>
    </Portal>
  );
}
