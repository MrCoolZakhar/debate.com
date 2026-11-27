'use client';

// ── Allocation announcement emails: the organiser's control ──────────────────
// "You are France in DISEC" is the single most important message this product
// sends. This module owns the organiser side of it: the Automatic or Manual
// choice (automatic release is the default; manual sends waves by hand), the roster of
// who has already been told, and the picker for a custom wave.
//
// The queue itself is @/lib/allocationEmail.queueAllocationEmails, re-exported
// below — the only place 'allocation_assigned' is raised and the only place
// conference_allocations.allocation_sent / allocation_sent_at is flipped to
// true. Before it existed the two were separate: three different "send"
// affordances set the boolean and queued NOTHING, while one lone header button
// queued emails and marked nobody, so a conference could show every delegate as
// emailed having sent zero.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mail, Info, Send, Repeat, ListChecks, Check, Search, X, ChevronDown, CircleSlash, CheckCircle2,
} from 'lucide-react';
import { type QueueEventEmailResult, turnOnDefaultEmail } from '@/lib/emailEvents';
import type { getAuthedClient } from '@/lib/supabase-auth';
import { CircleFlag } from '@/components/CircleFlag';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuButton, NeuInset } from '@/components/neu';
import Portal from '@/components/Portal';
import { ModalOverlay } from '@/components/ModalOverlay';

// The queue itself lives in @/lib/allocationEmail — server-safe, because the
// same rules have to run for /api/emails/queue-participant when a DELEGATION
// LEADER seats one of their own block members. Re-exported here so this module
// stays the one import an organiser surface needs.
export { queueAllocationEmails, ALLOCATION_EVENT_KEY } from '@/lib/allocationEmail';

/** One sentence the caller can flash, so every surface explains a non-send the
 *  same way — an 'off' template, a wave where every recipient had opted out,
 *  and a partial send all read as themselves rather than as silence. */
/**
 * THE one save of how allocation emails are released (conferences.allocation_email_auto),
 * used by the Allocation tab's switch and by the Allocation Assigned editor in
 * Communications (prompt 145), so there is never a second copy of the setting.
 * A verified write: the row must come back, otherwise nothing is reported as saved.
 * Turning automatic sending ON also turns an explicitly switched-off Allocation
 * Assigned email back on (`templateOff`), exactly as the Allocation tab always did;
 * it queues nothing by itself.
 */
export async function saveAllocationEmailAuto(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  next: boolean,
  templateOff: boolean,
): Promise<{ ok: boolean; templateTurnedOn: boolean }> {
  const { data, error } = await supabase
    .from('conferences')
    .update({ allocation_email_auto: next })
    .eq('id', conferenceId)
    .select('id, allocation_email_auto');
  const row = (data ?? [])[0] as { allocation_email_auto?: boolean } | undefined;
  if (error || !data || data.length !== 1 || row?.allocation_email_auto !== next) return { ok: false, templateTurnedOn: false };
  let templateTurnedOn = false;
  if (next && templateOff) {
    const res = await turnOnDefaultEmail(supabase, conferenceId, 'allocation_assigned');
    templateTurnedOn = res.ok;
  }
  return { ok: true, templateTurnedOn };
}

export function allocationSendMessage(result: QueueEventEmailResult, attempted: number): { kind: 'ok' | 'err'; msg: string } {
  const queued = result.queued ?? 0;
  switch (result.outcome) {
    case 'off':
      return { kind: 'err', msg: 'Allocation emails are switched off for this conference. Turn them back on under Communications.' };
    case 'unconfigured':
      return { kind: 'err', msg: 'The allocation email could not be turned on automatically. Open Communications and enable it.' };
    case 'no-recipients':
      return { kind: 'err', msg: 'No delegates to email.' };
    default:
      if (queued === 0) {
        return { kind: 'err', msg: 'Nobody was emailed. Every delegate selected has turned off application emails.' };
      }
      return {
        kind: 'ok',
        msg: queued < attempted
          ? `Emailed ${queued} of ${attempted} delegates. The rest have turned off application emails.`
          : `Allocation email sent to ${queued} delegate${queued === 1 ? '' : 's'}.`,
      };
  }
}

// ── Shared shape ─────────────────────────────────────────────────────────────

/** One seated delegate, flattened out of the committee board for this control. */
export interface AllocationTarget {
  applicationId: string;
  name: string;
  committee: string;
  countryCode: string;
  countryName: string;
  sent: boolean;
  sentAt: string | null;
}

function formatSentAt(iso: string | null): string {
  if (!iso) return 'Sent';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sent';
  return `Sent ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

// ── Hover-only "i" ───────────────────────────────────────────────────────────
// Informational, so it opens on hover/focus and never on click (house rule).
// Portalled at fixed viewport coords, clamped horizontally and flipped upward
// when there is no room below, so no ancestor's overflow can clip it.

function HoverInfo({ title, lines }: { title: string; lines: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const WIDTH = 296;
  const EST_H = 40 + lines.length * 52;

  const place = useCallback(() => {
    const b = anchor.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    let left = r.left + r.width / 2 - WIDTH / 2;
    if (left + WIDTH > vw - 10) left = vw - 10 - WIDTH;
    if (left < 10) left = 10;
    const flipUp = r.bottom + 8 + EST_H > window.innerHeight - 10 && r.top - 8 - EST_H > 10;
    setPos({ top: flipUp ? Math.max(10, r.top - 8 - EST_H) : r.bottom + 8, left });
  }, [EST_H]);

  // Placed on the way in, not from an effect: the trigger is already laid out
  // when the pointer reaches it, so there is nothing to wait a commit for.
  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); place(); setOpen(true); };
  const scheduleHide = () => { closeTimer.current = setTimeout(() => setOpen(false), 140); };

  useEffect(() => {
    if (!open) return;
    const handler = () => place();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, place]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <span
      ref={anchor}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: 17, height: 17, borderRadius: 999,
        backgroundColor: NEU.surface, boxShadow: open ? NEU.outSmHover : NEU.outSm,
        color: NEU.deepGold, cursor: 'help',
        transition: `box-shadow 200ms ${EASE}`,
      }}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={() => setOpen(false)}
      aria-label={title}
    >
      <Info size={10.5} strokeWidth={2.6} />
      {open && pos && (
        <Portal>
          <span
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
              width: WIDTH, padding: 14, borderRadius: 16,
              backgroundColor: NEU.surface,
              boxShadow: `${NEU.out}, 0 14px 34px rgba(27,56,40,0.16)`,
              display: 'flex', flexDirection: 'column', gap: 9,
              textAlign: 'left', cursor: 'default',
            }}
          >
            <span style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.deepGold }}>
              {title.toUpperCase()}
            </span>
            {lines.map(([head, body]) => (
              <span key={head} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: NEU.forest }}>{head}</span>
                <span style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, lineHeight: 1.45 }}>{body}</span>
              </span>
            ))}
          </span>
        </Portal>
      )}
    </span>
  );
}

// ── Send menu ────────────────────────────────────────────────────────────────
// An ACTION menu, so click-to-open is correct here. Portalled and edge-flipped
// like every other floating layer on this page.

function SendMenu({
  unsentCount, totalCount, busy, onAllNew, onEveryone, onCustom,
}: {
  unsentCount: number;
  totalCount: number;
  busy: boolean;
  onAllNew: () => void;
  onEveryone: () => void;
  onCustom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const WIDTH = 268;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const left = Math.max(10, Math.min(r.right - WIDTH, window.innerWidth - 10 - WIDTH));
    const estH = 214;
    const flipUp = r.bottom + 8 + estH > window.innerHeight - 10 && r.top - 8 - estH > 10;
    setPos({ top: flipUp ? r.top - 8 - estH : r.bottom + 8, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => place();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  const item = (
    Icon: typeof Send, text: string, note: string, onClick: () => void, itemDisabled: boolean,
  ) => (
    <button
      onClick={() => { if (itemDisabled) return; setOpen(false); onClick(); }}
      disabled={itemDisabled}
      className="flex items-start gap-2.5 w-full focus:outline-none"
      style={{
        padding: '9px 11px', borderRadius: 11, background: 'transparent', border: 'none',
        cursor: itemDisabled ? 'not-allowed' : 'pointer', textAlign: 'left',
        opacity: itemDisabled ? 0.45 : 1,
        transition: `background-color 160ms ${EASE}`,
      }}
      onMouseEnter={e => { if (!itemDisabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <Icon size={15} strokeWidth={1.5} style={{ color: NEU.ink, marginTop: 1, flexShrink: 0 }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.ink }}>{text}</span>
        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, lineHeight: 1.35 }}>{note}</span>
      </span>
    </button>
  );

  return (
    <>
      {/* "Send N waiting" (owner, 22 Oct 2026): the count IS the button, the
          menu holds the other waves. A calm solid while people are waiting,
          a soft pill when nobody is. */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => { if (!open) place(); setOpen(o => !o); }}
        disabled={busy || totalCount === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/25 transition-transform duration-150 enabled:active:scale-[0.96]"
        style={{
          height: 34, padding: '0 12px 0 14px', borderRadius: 999, whiteSpace: 'nowrap',
          fontFamily: OUTFIT, fontSize: 13, fontWeight: 600,
          border: unsentCount > 0 ? 'none' : '1px solid rgba(27,56,40,0.20)',
          background: unsentCount > 0 ? '#2C4A39' : '#FFFFFF',
          color: unsentCount > 0 ? '#FFFFFF' : NEU.forest,
          opacity: totalCount === 0 ? 0.55 : 1,
          cursor: busy || totalCount === 0 ? 'default' : 'pointer',
        }}
      >
        <Send size={14} strokeWidth={1.5} aria-hidden />
        {busy ? 'Sending' : unsentCount > 0 ? `Send ${unsentCount} waiting` : 'Send'}
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'none', transition: `transform 160ms ${EASE}` }} />
      </button>

      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: WIDTH,
              backgroundColor: NEU.surface, borderRadius: 16, padding: 6,
              boxShadow: `${NEU.out}, 0 18px 44px rgba(27,56,40,0.2)`,
              animation: `allocMenuIn 160ms ${EASE}`,
            }}
          >
            <style>{'@keyframes allocMenuIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }'}</style>
            <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: NEU.inkSoft, padding: '6px 11px 4px' }}>
              Send allocation emails
            </p>
            {item(Send, `Everyone waiting (${unsentCount})`, 'Everyone seated who has not been emailed yet', onAllNew, unsentCount === 0)}
            {item(Repeat, `Everyone seated (${totalCount})`, 'Sends again to all seated delegates, including those already emailed', onEveryone, totalCount === 0)}
            {item(ListChecks, 'Choose who', 'Pick exactly who goes out in this wave', onCustom, totalCount === 0)}
          </div>
        </Portal>
      )}
    </>
  );
}

// ── The header control ───────────────────────────────────────────────────────

export function AllocationEmailBar({
  autoSend, onToggleAuto, togglePending, targets, busy, onSend,
  templateOff = false, onTurnOnTemplate, turningOnTemplate = false,
  openWithUnsent = false, onOpenedWithUnsent,
}: {
  autoSend: boolean;
  onToggleAuto: (next: boolean) => void;
  togglePending: boolean;
  targets: AllocationTarget[];
  busy: boolean;
  onSend: (applicationIds: string[], scope: 'new' | 'all' | 'custom') => void;
  /** The Allocation Assigned template is switched OFF under Communications.
   *  That off wins over `autoSend`: nothing is queued, automatically or by
   *  hand, so the bar must never read "Sending automatically" while it holds. */
  templateOff?: boolean;
  /** Re-enables the template. Queues nothing for delegates already seated. */
  onTurnOnTemplate?: () => void;
  turningOnTemplate?: boolean;
  /** Arrived from the dashboard's "never told their seat" row: open the
   *  custom picker with everyone not yet emailed already ticked. Nothing is
   *  sent until the organiser presses Send in the picker. */
  openWithUnsent?: boolean;
  onOpenedWithUnsent?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [initialPicked, setInitialPicked] = useState<string[]>([]);
  const unsent = targets.filter(t => !t.sent);
  const sentCount = targets.length - unsent.length;

  // Arriving from the dashboard opens the picker once, as soon as the
  // targets are loaded. Adjusted during render (not in an effect), then the
  // parent is told in an effect so it can clear its flag.
  const [openedFromDashboard, setOpenedFromDashboard] = useState(false);
  if (openWithUnsent && !openedFromDashboard && targets.length > 0) {
    setOpenedFromDashboard(true);
    setInitialPicked(targets.filter(t => !t.sent).map(t => t.applicationId));
    setPickerOpen(true);
  }
  if (!openWithUnsent && openedFromDashboard) setOpenedFromDashboard(false);
  useEffect(() => {
    if (openWithUnsent && openedFromDashboard) onOpenedWithUnsent?.();
  }, [openWithUnsent, openedFromDashboard, onOpenedWithUnsent]);

  // One clear control (owner, 22 Oct 2026): "Allocation emails: Automatic |
  // Manual" with the current mode highlighted, the status beneath, and "Send N
  // waiting" whenever the release is manual or someone is waiting. No on/off
  // wording. The saves are the same verified write (saveAllocationEmailAuto).
  const showSend = !templateOff && targets.length > 0 && (!autoSend || unsent.length > 0);
  const mode = (key: 'auto' | 'manual', label: string, hint: string) => {
    const on = autoSend === (key === 'auto');
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        title={hint}
        disabled={togglePending}
        onClick={() => { if (!on && !togglePending) onToggleAuto(key === 'auto'); }}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/25"
        style={{
          height: 30, padding: '0 13px', borderRadius: 9, border: 'none',
          background: on ? '#FFFFFF' : 'transparent',
          boxShadow: on ? '0 1px 3px rgba(27,56,40,0.14)' : 'none',
          fontFamily: OUTFIT, fontSize: 13, fontWeight: on ? 600 : 500,
          color: on ? NEU.ink : NEU.inkSoft,
          cursor: togglePending ? 'wait' : on ? 'default' : 'pointer',
          transition: `background-color 160ms ${EASE}, box-shadow 160ms ${EASE}`,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <div
        className="flex items-center gap-x-4 gap-y-2 flex-wrap"
        style={{
          backgroundColor: '#FFFFFF', borderRadius: 18, padding: '8px 10px 8px 14px',
          boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 8px 24px rgba(27,56,40,0.08)',
          // So a narrow header makes the bar WRAP rather than run off the page:
          // without these a flex item refuses to shrink below its content.
          maxWidth: '100%', minWidth: 0,
        }}
      >
        <div className="flex flex-col" style={{ minWidth: 0, gap: 1 }}>
          <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: NEU.ink }}>
            <Mail size={15} strokeWidth={1.5} aria-hidden />
            Allocation emails
            <HoverInfo
              title="How allocation emails go out"
              lines={[
                ['Automatic', 'Each delegate is emailed their committee and country the moment you seat them. Nothing to remember, nothing to press.'],
                ['Manual', 'Nobody is emailed when you seat them. You choose when, and who, with Send.'],
                ['Who has been told', 'Every seated delegate is tracked. "Everyone waiting" covers only those not emailed yet; "Choose who" shows each delegate.'],
                ['The wording', 'Edit the Allocation Assigned email under Communications. Until you write your own, Gavelling sends its default.'],
              ]}
            />
          </span>
          <span style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>
            {templateOff ? (
              <span style={{ fontWeight: 600, color: NEU.amber }}>
                Turned off in Communications{unsent.length > 0 ? `, ${unsent.length} waiting` : ''}
              </span>
            ) : targets.length === 0 ? (
              'Nobody seated yet'
            ) : (
              <>
                <span style={{ fontWeight: 600, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{sentCount}</span> emailed
                {unsent.length > 0 && (
                  <>
                    {' · '}
                    <span style={{ fontWeight: 600, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{unsent.length}</span> waiting
                  </>
                )}
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap" style={{ marginLeft: 'auto' }}>
          <span
            role="radiogroup"
            aria-label="How allocation emails go out"
            className="inline-flex"
            style={{ gap: 2, padding: 2.5, borderRadius: 11, background: '#F1ECE1', opacity: templateOff ? 0.6 : 1 }}
          >
            {mode('auto', 'Automatic', 'Each delegate is emailed the moment you seat them')}
            {mode('manual', 'Manual', 'Nobody is emailed until you send')}
          </span>

          {templateOff && onTurnOnTemplate && (
            <button
              type="button"
              onClick={onTurnOnTemplate}
              disabled={turningOnTemplate}
              title="Allocation emails are turned off under Communications, so nobody is emailed when you seat them. Turning them on emails the delegates you seat from now on. Anyone already waiting is sent only when you press Send."
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/25"
              style={{
                height: 32, padding: '0 14px', borderRadius: 999, whiteSpace: 'nowrap',
                fontFamily: OUTFIT, fontSize: 13, fontWeight: 600,
                color: NEU.forest, background: '#FFFFFF', border: '1px solid rgba(27,56,40,0.20)',
                cursor: turningOnTemplate ? 'wait' : 'pointer', opacity: turningOnTemplate ? 0.6 : 1,
              }}
            >
              Turn on
            </button>
          )}

          {showSend && (
            <SendMenu
              unsentCount={unsent.length}
              totalCount={targets.length}
              busy={busy}
              onAllNew={() => onSend(unsent.map(t => t.applicationId), 'new')}
              onEveryone={() => onSend(targets.map(t => t.applicationId), 'all')}
              onCustom={() => { setInitialPicked([]); setPickerOpen(true); }}
            />
          )}
        </div>
      </div>

      {pickerOpen && (
        <AllocationPicker
          targets={targets}
          initialPicked={initialPicked}
          busy={busy}
          onClose={() => setPickerOpen(false)}
          onSend={ids => { setPickerOpen(false); onSend(ids, 'custom'); }}
        />
      )}
    </>
  );
}

// ── Custom picker ────────────────────────────────────────────────────────────

function AllocationPicker({
  targets, initialPicked = [], busy, onClose, onSend,
}: {
  targets: AllocationTarget[];
  initialPicked?: string[];
  busy: boolean;
  onClose: () => void;
  onSend: (applicationIds: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialPicked));

  // Not yet emailed first — that is the wave an organiser is usually building —
  // then alphabetical inside each group.
  const ordered = [...targets].sort((a, b) =>
    Number(a.sent) - Number(b.sent) || a.name.localeCompare(b.name)
  );
  const q = search.trim().toLowerCase();
  const shown = q
    ? ordered.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.committee.toLowerCase().includes(q) ||
        t.countryName.toLowerCase().includes(q))
    : ordered;

  const unsentIds = targets.filter(t => !t.sent).map(t => t.applicationId);
  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <ModalOverlay onClose={onClose} paddingClassName="px-4 py-8" label="Choose who to email">
      <div
        className="flex flex-col"
        style={{
          width: 'min(94vw, 560px)', maxHeight: '84dvh',
          backgroundColor: NEU.surface, borderRadius: 24, padding: 24,
          boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)`,
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="font-black text-base" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              Choose Who to Email
            </h2>
            <p className="text-xs mt-0.5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
              Each delegate gets their own committee and country. Re-sending is allowed. A delegate can be emailed more than once.
            </p>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0" style={{ color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4 mb-3 flex-wrap">
          <NeuInset small className="flex items-center gap-2 px-3 py-2" style={{ flex: '1 1 200px', borderRadius: 999 }}>
            <Search size={13} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, committee or country"
              className="w-full focus:outline-none"
              style={{ background: 'transparent', border: 'none', fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink }}
            />
          </NeuInset>
          <button
            onClick={() => setPicked(new Set(unsentIds))}
            disabled={unsentIds.length === 0}
            className="focus:outline-none"
            style={{
              padding: '8px 13px', borderRadius: 999, border: 'none',
              backgroundColor: NEU.surface, boxShadow: NEU.outSm,
              fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: 0,
              color: unsentIds.length === 0 ? NEU.muted : NEU.ink,
              cursor: unsentIds.length === 0 ? 'default' : 'pointer',
              opacity: unsentIds.length === 0 ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            Select {unsentIds.length} new
          </button>
          <button
            onClick={() => setPicked(new Set())}
            disabled={picked.size === 0}
            className="focus:outline-none"
            style={{
              padding: '8px 13px', borderRadius: 999, border: 'none',
              backgroundColor: 'transparent',
              fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: 0,
              color: picked.size === 0 ? NEU.muted : NEU.inkSoft,
              cursor: picked.size === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Clear
          </button>
        </div>

        <NeuInset className="flex-1 p-1.5" style={{ borderRadius: 16, overflowY: 'auto', minHeight: 120 }}>
          {shown.length === 0 ? (
            <p className="text-center text-xs py-8" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
              {targets.length === 0 ? 'No delegates are seated yet.' : 'Nobody matches that search.'}
            </p>
          ) : (
            shown.map(t => {
              const on = picked.has(t.applicationId);
              return (
                <button
                  key={t.applicationId}
                  onClick={() => toggle(t.applicationId)}
                  className="flex items-center gap-2.5 w-full focus:outline-none"
                  style={{
                    padding: '8px 10px', borderRadius: 12, border: 'none', textAlign: 'left',
                    backgroundColor: on ? 'rgba(27,56,40,0.07)' : 'transparent',
                    cursor: 'pointer', transition: `background-color 160ms ${EASE}`,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 17, height: 17, borderRadius: 5,
                      background: on ? NEU.forest : NEU.surface,
                      boxShadow: on ? 'none' : NEU.inSm,
                      color: NEU.gold,
                    }}
                  >
                    {on && <Check size={11} strokeWidth={3.2} />}
                  </span>
                  <FlagChip code={t.countryCode} name={t.countryName} />
                  <span className="min-w-0" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>
                      {t.name}
                    </span>
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.inkSoft }}>
                      {t.countryName} · {t.committee}
                    </span>
                  </span>
                  <SentPill sent={t.sent} sentAt={t.sentAt} />
                </button>
              );
            })
          )}
        </NeuInset>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-full py-2.5 font-bold text-sm focus:outline-none"
            style={{ border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontFamily: OUTFIT, letterSpacing: 0, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <NeuButton
            onClick={() => onSend(Array.from(picked))}
            disabled={busy || picked.size === 0}
            gradient={NEU_GRADIENTS.gold}
            icon={Send}
            style={{ flex: 1, padding: '11px 22px', letterSpacing: 0 }}
          >
            {busy ? 'Sending…' : `Send to ${picked.size}`}
          </NeuButton>
        </div>
      </div>
    </ModalOverlay>
  );
}

function FlagChip({ code, name }: { code: string; name: string }) {
  // Round, like every flag on the allocation portal (owner, 23 Sep 2026).
  return <CircleFlag code={/^[A-Za-z]{2}$/.test(code.trim()) ? code.trim() : null} size={18} label={name} title={name} />;
}

function SentPill({ sent, sentAt }: { sent: boolean; sentAt: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 flex-shrink-0"
      style={{
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 700,
        color: sent ? NEU.forest : NEU.inkSoft, whiteSpace: 'nowrap',
      }}
    >
      {sent
        ? <><CheckCircle2 size={14} strokeWidth={2.4} aria-hidden="true" />{formatSentAt(sentAt)}</>
        : <><CircleSlash size={14} strokeWidth={2.4} aria-hidden="true" />Not sent</>}
    </span>
  );
}
