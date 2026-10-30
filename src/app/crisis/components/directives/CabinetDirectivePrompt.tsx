'use client';
// Gavelling Crisis: the Crisis Director's prompt for a new cabinet directive (Round 9). Cabinet directives are assigned to the
// Director by the database (docs/crisis/sql/027); whenever one is waiting for them this card rises from the bottom right of any
// staff page: Review (opens it the way a notification does), Allocate to someone else (the second step replaces the card's content,
// never a second pop-up) or X. What was handled or dismissed is remembered on this device. It waits while any dialog is open and
// never shows what was already waiting for more than 30 minutes when the page opened.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, ScrollText, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, listDirectives, listQueuedCabinetDirectivesFor } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive } from '@/lib/crisis/types';
import { serverNow } from '@/lib/serverClock';
import { Avatar, agoLabel, CK } from '../../crisisKit';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { staffLoads } from '../command/commandData';
import { responsibleMembers } from '../command/setupKit';
import { authorName, buildNames } from './directiveKit';
import { NumberBadge, StaffPic } from './directiveParts';
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

  if (!enabled || !current || blocked || viewing) return null;

  const d = current;
  const character = d.author_character_id ? names.characters.get(d.author_character_id) ?? null : null;
  const author = authorName(d, names);
  const cabinet = d.cabinet_id ? names.cabinets.get(d.cabinet_id) ?? null : null;
  const picking = pickFor === d.id;
  const arrived = agoLabel(d.waiting_since || d.created_at, now);

  return (
    <>
      <style>{`
        .cd-prompt { position: fixed; right: 12px; left: 12px; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); z-index: 240; max-width: 420px; margin-left: auto; animation: cd-prompt-rise 320ms cubic-bezier(0.22,1,0.36,1); }
        @media (min-width: 768px) { .cd-prompt { right: 22px; left: auto; bottom: 22px; width: 420px; } }
        @keyframes cd-prompt-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .cd-prompt { animation: none; } }
      `}</style>
      <div
        data-cd-prompt=""
        role="dialog"
        aria-label={picking ? 'Allocate this directive' : 'New cabinet directive'}
        className="cd-prompt"
        style={{ background: CK.card, color: CK.ink, borderRadius: 20, padding: 14, fontFamily: CK.font, boxShadow: `${CK.shadow}, 0 18px 44px rgba(58,14,15,0.28)` }}
      >
        <div className="flex items-center" style={{ gap: 8, minHeight: 28 }}>
          {picking ? (
            <button
              type="button"
              onClick={() => setPickFor(null)}
              aria-label="Back"
              className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ gap: 4, border: 0, background: 'transparent', cursor: 'pointer', padding: '3px 6px 3px 2px', borderRadius: 8, fontFamily: CK.font, fontSize: 13, fontWeight: 700, color: CK.forest }}
            >
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />Back
            </button>
          ) : (
            <span className="inline-flex items-center" style={{ gap: 6, fontSize: 12, fontWeight: 800, color: CK.red, letterSpacing: '0.04em' }}>
              <ScrollText size={15} strokeWidth={1.5} aria-hidden />New cabinet directive
            </span>
          )}
          <span className="flex-1" />
          {!picking && pending.length > 1 && (
            <button
              type="button"
              onClick={() => setCursor((c) => c + 1)}
              aria-label="Show the next waiting directive"
              className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ gap: 2, border: 0, background: 'transparent', cursor: 'pointer', padding: '3px 4px 3px 8px', borderRadius: 8, fontFamily: CK.font, fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}
            >
              {(cursor % pending.length) + 1} of {pending.length}<ChevronRight size={15} strokeWidth={1.5} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => markHandled(d.id)}
            aria-label="Close"
            className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 28, height: 28, cursor: 'pointer', flex: 'none' }}
          >
            <X size={15} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <div className="flex items-start" style={{ gap: 10, marginTop: 10 }}>
          <Avatar name={author} src={character?.picture_url ?? null} size={44} color={cabinet?.color ?? CK.red} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center flex-wrap" style={{ gap: '2px 8px' }}>
              <NumberBadge n={dirNumber(d)} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: CK.muted }}>{arrived}</span>
            </div>
            <b style={{ display: 'block', marginTop: 4, fontSize: 15, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{d.title}</b>
            <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
              {author}{cabinet ? `, ${cabinet.name}` : ''}
            </span>
          </div>
        </div>

        {!picking && (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.45, color: CK.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {d.body}
            </p>
            <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => review(d)}
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
                style={{ border: 0, borderRadius: 11, padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', background: CK.redBtn, color: '#FFF4E6', boxShadow: CK.shadowSm, fontFamily: CK.font }}
              >
                Review
              </button>
              <button
                type="button"
                onClick={() => openAllocate(d)}
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
                style={{ border: 0, borderRadius: 11, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', background: CK.card, color: CK.forest, boxShadow: `inset 0 0 0 1px ${CK.hair}`, fontFamily: CK.font }}
              >
                Allocate to someone else
              </button>
            </div>
          </>
        )}

        {picking && (
          <div role="listbox" aria-label="Staff" style={{ marginTop: 10, maxHeight: 'min(280px, 40dvh)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {others.length === 0 && <p style={{ margin: 8, fontSize: 13, color: CK.inkSoft }}>There is nobody else on the staff yet</p>}
            {others.map((m) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={false}
                disabled={busy}
                onClick={() => void allocate(d, m)}
                className="flex items-center w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] disabled:opacity-60"
                style={{ gap: 10, border: 0, cursor: busy ? 'default' : 'pointer', padding: '6px 8px', borderRadius: 10, background: 'transparent', fontFamily: CK.font }}
              >
                <StaffPic member={m} size={30} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere', lineHeight: 1.2 }}>{m.display_name}</b>
                  <span style={{ fontSize: 11.5, color: CK.inkSoft }}>
                    {m.role === 'backroomer' ? 'Backroomer' : m.role === 'director' ? 'Crisis Director' : 'Assistant Crisis Director'}
                    {counts ? `, ${counts.get(m.id) ?? 0} open` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
