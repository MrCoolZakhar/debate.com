'use client';
// Gavelling Crisis: the chair's pop-up for a cabinet directive. The ONE place a chair reads and decides a directive.
// Whenever a cabinet directive of the chair's cabinet is waiting (kind committee, status awaiting_chair) this centred card
// opens on any chair page: Approve (to the backroom), Request changes (back to the author as a draft, with a note) or Reject
// (final). Both of the last two ask for an optional note IN PLACE: the card's content is replaced by the note field with a
// Back button, never a second pop-up. X, a click outside or Escape just closes it: the directive stays in "Waiting for You"
// on the Front Room (and in the Directives tab), and this device remembers it was closed so it does not come back on a reload
// (a new directive, or the same one sent again, does pop up). It waits while any other dialog is open (and hides, keeping what
// was typed).
//
// The Front Room's "Waiting for You" card and the Directives tab open ONE given directive here through openChairDirective()
// (chairDirectiveKit.tsx): a waiting one shows the decision card even if it was closed on this device, any other the same card
// read only.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Gavel, PencilLine, ScrollText, X, XCircle } from 'lucide-react';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, listDirectives, requestDirectiveChanges, reviewDirectiveAsChair, type CrisisRef } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Cabinet, Directive } from '@/lib/crisis/types';
import { Avatar, Btn, CK, fieldStyle, useScrollLock } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { whenLabel } from '../delegate/directiveUi';
import { CARD_GAP_BELOW, CabinetCrest, CabinetFoot, CabinetName, SEAL_POP, cabinetColorOf, cabinetRing, cabinetWash, crestIndent } from '../directives/cabinetStamp';
import { DirectiveBody } from '../directives/attachedImage';
import PopBanner from '../directives/PopBanner';
import { ThemeTags } from '../directives/directiveParts';
import { chairGroup, chairVerdict, closeChairDirective, directiveAuthor, useRequestedChairDirective, type DirectiveAuthor } from './chairDirectiveKit';

const WATCH_MS = 1500;
const KEEP_HANDLED = 300;

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
 * One cabinet directive, read in full. Waiting for the chair: the three ways to deal with it. Anything else (`readOnly`): the
 * same card with its state on top and no buttons. `topBar` sits at the card's top right (the pop-up's navigation and X).
 */
export function ChairDirectiveCard({ d, author, cabinet, cref, readOnly = false, topBar, onDone }: {
  d: Directive; author: DirectiveAuthor; cref: CrisisRef; cabinet: Cabinet | null; readOnly?: boolean; topBar?: ReactNode; onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>('view');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Doing | null>(null);
  const verdict = chairVerdict(d);
  const group = chairGroup(d);
  const reply = (d.reply ?? '').trim();
  const replyLabel = group === 'changes' || group === 'rejected' ? 'Your note' : group === 'answered' ? 'Backroom reply' : '';

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
  const color = cabinetColorOf(cabinet);
  // Design B (owner, 1 Nov 2026): the seal and the number on the card's top border, the cabinet's name beside them with the state under it,
  // the top bar top right.
  const header = (
    <div className="flex items-start justify-between" style={{ gap: 8 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <CabinetName cabinet={cabinet} size={14.5} indent={crestIndent(SEAL_POP)} />
        {readOnly ? (
          <span className="inline-flex items-center" style={{ gap: 5, marginTop: 6, fontSize: 12, fontWeight: 800, color: verdict.color }}>{verdict.icon}{verdict.word}</span>
        ) : (
          <span className="inline-flex items-center" style={{ gap: 5, marginTop: 6, fontSize: 12, fontWeight: 800, color: CK.red }}>
            <Gavel size={15} strokeWidth={1.5} aria-hidden />Needs your decision
          </span>
        )}
      </div>
      {topBar && <div style={{ flex: 'none' }}>{topBar}</div>}
    </div>
  );

  const asking = mode !== 'view' ? COPY[mode] : null;

  return (
    <div onKeyDown={onKeyDown}>
      <div
        style={{
          position: 'relative', overflow: 'visible', minWidth: 0, background: cabinetWash(color), borderRadius: 22, padding: '26px 20px 18px', margin: `${SEAL_POP / 2 + 6}px 0 ${CARD_GAP_BELOW}px`,
          boxShadow: cabinetRing(color, 3, `${CK.shadow}, 0 24px 60px rgba(58,14,15,0.4)`),
        }}
      >
        <CabinetCrest cabinet={cabinet} n={dirNumber(d)} sealSize={SEAL_POP} left={20} stamp="pop" />
        {header}

        {!asking ? (
          <div key="view" className="cm-fade">
            <h3 style={{ margin: '14px 0 0', fontSize: 25, lineHeight: 1.2, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</h3>
            {/* Who sent it is only a small fact (owner, 1 Nov 2026), beside when it was sent and the themes. */}
            <div className="flex flex-wrap items-center" style={{ gap: '4px 12px', marginTop: 8, fontSize: 13, fontWeight: 600, color: CK.muted }}>
              <span className="inline-flex items-center" style={{ gap: 6 }}>
                From
                <Avatar name={author.name} src={author.picture_url} size={20} color={author.color} />
                <b style={{ color: CK.ink, fontWeight: 800, overflowWrap: 'anywhere' }}>{author.name}</b>
              </span>
              <span>Sent {whenLabel(d.created_at)}</span>
              {(d.themes ?? []).length > 0 && <ThemeTags themes={d.themes ?? []} />}
            </div>
            <div style={{ marginTop: 10, maxHeight: 'min(42dvh, 380px)', overflowY: 'auto', background: CK.well, borderRadius: 14, padding: '10px 12px' }}>
              <DirectiveBody body={d.body} thumb={360} style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />
            </div>
            {readOnly && replyLabel && reply && (
              <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}><b>{replyLabel}: </b>{reply}</p>
            )}
            {/* The decision buttons. */}
            {!readOnly && (
              <CabinetFoot marginTop={12}>
                <>
                  <Btn tone="green" icon={<Check size={16} strokeWidth={1.6} aria-hidden />} disabled={!!busy} onClick={() => run('approve')} title="Sends it to the backroom">
                    {busy === 'approve' ? 'Approving' : 'Approve'}
                  </Btn>
                  <Btn tone="ghost" icon={<PencilLine size={16} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => setMode('changes')}>Request changes</Btn>
                  <Btn tone="danger" icon={<XCircle size={16} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => setMode('reject')}>Reject</Btn>
                </>
              </CabinetFoot>
            )}
          </div>
        ) : (
          <div key={mode} className="cm-fade" style={{ marginTop: 12 }}>
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
              rows={5}
              maxLength={500}
              autoFocus
              placeholder={mode === 'changes' ? 'Say what to change' : 'Say why'}
              style={{ ...fieldStyle, fontSize: 15.5, padding: '12px 14px', minHeight: 120, resize: 'vertical' }}
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
      </div>
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
  const requested = useRequestedChairDirective();

  const [rows, setRows] = useState<Directive[]>([]);
  const [version, setVersion] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next'); // which way the "1 of N" card arrives from
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

  const watch = useCallback(() => { setBlocked(otherDialogOpen()); }, []);
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
      .filter((d) => d.kind === 'committee' && d.status === 'awaiting_chair' && (!cabinetId || d.cabinet_id === cabinetId) && !handled.has(stamp(d)))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [rows, cabinetId, handled],
  );

  // A directive a page asked for wins over the waiting queue; its row is read fresh when this pop-up has it.
  const forced = enabled ? requested : null;
  const forcedNow = useMemo(() => (forced ? rows.find((r) => r.id === forced.id) ?? forced : null), [forced, rows]);
  const auto = pending.length ? pending[cursor % pending.length] : null;
  const current = forcedNow ?? auto;
  const shown = !!current && !blocked;
  useScrollLock(shown);

  const dismiss = useCallback((d: Directive) => {
    const next = readHandled(key);
    next.add(stamp(d));
    writeHandled(key, next);
    setVersion((x) => x + 1);
  }, [key]);

  /** Close: a page's request just ends; a waiting directive is also remembered as closed here, so it stays on the list. */
  const close = useCallback((d: Directive) => {
    if (d.kind === 'committee' && d.status === 'awaiting_chair') dismiss(d);
    if (forced) closeChairDirective();
  }, [dismiss, forced]);

  // Escape and a click outside close it (the directive stays on the Front Room); Tab stays inside the card.
  const closeRef = useRef<(() => void) | null>(null);
  useEffect(() => { closeRef.current = current ? () => close(current) : null; });
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

  if (!enabled || !current) return null;

  const d = current;
  const readOnly = d.status !== 'awaiting_chair';
  const author = directiveAuthor(d, core.characters, core.members, core.cabinets);
  const cabinet = d.cabinet_id ? core.cabinets.find((c) => c.id === d.cabinet_id) ?? null : null;
  const queue = forcedNow ? 1 : pending.length;
  const at = queue > 1 ? cursor % queue : 0;
  const step = (by: number) => { setDir(by < 0 ? 'prev' : 'next'); setCursor((at + by + queue) % queue); };
  const navBtn = { border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 30, height: 30, cursor: 'pointer', flex: 'none' } as const;

  const topBar = (
    <div className="flex items-center" style={{ gap: 4, flex: 'none' }}>
      {queue > 1 && (
        <>
          <button type="button" onClick={() => step(-1)} aria-label="Show the previous waiting directive" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}>
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.inkSoft, fontVariantNumeric: 'tabular-nums', padding: '0 2px' }}>{at + 1} of {queue}</span>
          <button type="button" onClick={() => step(1)} aria-label="Show the next waiting directive" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}>
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </>
      )}
      <button type="button" onClick={() => close(d)} aria-label={readOnly ? 'Close' : 'Close, it stays in your list'} title={readOnly ? 'Close' : 'Close, it stays in your list'} className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...navBtn, marginLeft: 4 }}>
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
        <div aria-hidden className="cm-fade" onMouseDown={() => close(d)} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.5)' }} />
        <div
          ref={panel}
          data-chair-prompt=""
          role="dialog"
          aria-modal="true"
          aria-label={readOnly ? 'Cabinet directive' : 'Cabinet directive for your decision'}
          tabIndex={-1}
          className="chair-pop focus:outline-none"
          style={{ position: 'relative', width: 'min(620px, 100%)', maxHeight: 'calc(100dvh - 56px)' }}
        >
          {!readOnly && <PopBanner icon={<ScrollText size={26} strokeWidth={1.6} />}>New Cabinet Directive!</PopBanner>}
          <div key={stamp(d)} className={queue > 1 ? (dir === 'prev' ? 'cm-prev' : 'cm-next') : undefined}>
            <ChairDirectiveCard
              d={d}
              author={author}
              cref={ref}
              cabinet={cabinet}
              readOnly={readOnly}
              topBar={topBar}
              onDone={() => { void load(); if (forced) closeChairDirective(); }}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
