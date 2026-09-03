'use client';

// ── Allocation announcement emails: the organiser's control ──────────────────
// "You are France in DISEC" is the single most important message this product
// sends. This module owns the organiser side of it: the toggle between
// automatic release (the default) and waves released by hand, the roster of
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
  Mail, Info, Send, Repeat, ListChecks, Check, Search, X, ChevronDown, CircleSlash,
} from 'lucide-react';
import { type QueueEventEmailResult } from '@/lib/emailEvents';
import { getFlagUrl } from '@/lib/countries';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuButton, NeuInset } from '@/components/neu';
import Portal from '@/components/Portal';
import { ModalOverlay } from '@/components/ModalOverlay';
import { PillToggle } from '@/app/account/accountUi';

// The queue itself lives in @/lib/allocationEmail — server-safe, because the
// same rules have to run for /api/emails/queue-participant when a DELEGATION
// LEADER seats one of their own block members. Re-exported here so this module
// stays the one import an organiser surface needs.
export { queueAllocationEmails, ALLOCATION_EVENT_KEY } from '@/lib/allocationEmail';

/** One sentence the caller can flash, so every surface explains a non-send the
 *  same way — an 'off' template, a wave where every recipient had opted out,
 *  and a partial send all read as themselves rather than as silence. */
export function allocationSendMessage(result: QueueEventEmailResult, attempted: number): { kind: 'ok' | 'err'; msg: string } {
  const queued = result.queued ?? 0;
  switch (result.outcome) {
    case 'off':
      return { kind: 'err', msg: 'Allocation emails are switched off for this conference — turn them back on under Communications.' };
    case 'unconfigured':
      return { kind: 'err', msg: 'The allocation email could not be turned on automatically. Open Communications and enable it.' };
    case 'no-recipients':
      return { kind: 'err', msg: 'No delegates to email.' };
    default:
      if (queued === 0) {
        return { kind: 'err', msg: 'Nobody was emailed — every delegate selected has turned off application emails.' };
      }
      return {
        kind: 'ok',
        msg: queued < attempted
          ? `Emailed ${queued} of ${attempted} delegates — the rest have turned off application emails.`
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
  unsentCount, totalCount, busy, emphasise, onAllNew, onEveryone, onCustom,
}: {
  unsentCount: number;
  totalCount: number;
  busy: boolean;
  /** OFF = the organiser is driving, so the button carries the gold accent. */
  emphasise: boolean;
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
    const estH = 186;
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
      <Icon size={14} strokeWidth={2.4} style={{ color: NEU.deepGold, marginTop: 2, flexShrink: 0 }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink }}>{text}</span>
        <span style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.inkSoft, lineHeight: 1.35 }}>{note}</span>
      </span>
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => { if (!open) place(); setOpen(o => !o); }}
        disabled={busy || totalCount === 0}
        className="gv-lift inline-flex items-center gap-1.5 focus:outline-none"
        style={{
          padding: '9px 15px', borderRadius: 999, border: 'none',
          fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em',
          background: totalCount === 0
            ? 'rgba(27,56,40,0.12)'
            : emphasise
            ? `linear-gradient(135deg, ${NEU_GRADIENTS.gold[0]}, ${NEU_GRADIENTS.gold[1]})`
            : NEU.surface,
          color: totalCount === 0 ? NEU.muted : emphasise ? NEU.forest : NEU.ink,
          cursor: busy || totalCount === 0 ? 'default' : 'pointer',
        }}
      >
        <Send size={13} strokeWidth={2.5} style={{ color: totalCount === 0 ? NEU.muted : emphasise ? NEU.forest : NEU.deepGold }} />
        {busy ? 'SENDING...' : 'SEND'}
        <ChevronDown size={12} strokeWidth={2.6} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: `transform 160ms ${EASE}` }} />
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
            <p style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.13em', color: NEU.deepGold, padding: '6px 11px 4px' }}>
              RELEASE ALLOCATIONS
            </p>
            {item(Send, `All new (${unsentCount})`, 'Everyone seated who has not been emailed yet.', onAllNew, unsentCount === 0)}
            {item(Repeat, `Everyone (${totalCount})`, 'Re-sends to all seated delegates, including those already emailed.', onEveryone, totalCount === 0)}
            {item(ListChecks, 'Choose individually…', 'Pick exactly who goes out in this wave.', onCustom, totalCount === 0)}
          </div>
        </Portal>
      )}
    </>
  );
}

// ── The header control ───────────────────────────────────────────────────────

export function AllocationEmailBar({
  autoSend, onToggleAuto, togglePending, targets, busy, onSend,
}: {
  autoSend: boolean;
  onToggleAuto: (next: boolean) => void;
  togglePending: boolean;
  targets: AllocationTarget[];
  busy: boolean;
  onSend: (applicationIds: string[], scope: 'new' | 'all' | 'custom') => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const unsent = targets.filter(t => !t.sent);
  const sentCount = targets.length - unsent.length;

  return (
    <>
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{
          backgroundColor: NEU.surface, borderRadius: 20, padding: '10px 14px',
          boxShadow: NEU.outSm,
          // So a narrow header makes the bar WRAP rather than run off the page:
          // without these a flex item refuses to shrink below its content.
          maxWidth: '100%', minWidth: 0,
        }}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 32, height: 32, borderRadius: 11,
            background: `linear-gradient(135deg, ${NEU_GRADIENTS.gold[0]}, ${NEU_GRADIENTS.gold[1]})`,
            color: NEU.forest, boxShadow: NEU.outSm,
          }}
        >
          <Mail size={15} strokeWidth={2.4} />
        </span>

        <div style={{ minWidth: 0 }}>
          <div className="flex items-center gap-1.5">
            <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.deepGold }}>
              ALLOCATION EMAILS
            </p>
            <HoverInfo
              title="How allocation emails go out"
              lines={[
                ['Automatic (default)', 'Each delegate is emailed their committee and country the moment you seat them. Nothing to remember, nothing to press.'],
                ['Manual', 'Turn this off to release in waves. Nobody is emailed on assignment; you choose when, and who, from the SEND menu.'],
                ['Who has been told', 'Every seated delegate is tracked individually. "All new" covers only those not yet emailed; "Choose individually" shows each delegate\'s status.'],
                ['The copy itself', 'Edit the Allocation Assigned template under Communications. Until you draft your own, Gavelling sends its default.'],
              ]}
            />
          </div>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 1 }}>
            {targets.length === 0 ? (
              'No delegates seated yet'
            ) : (
              <>
                <span style={{ fontWeight: 800, color: NEU.green }}>{sentCount} emailed</span>
                {unsent.length > 0 && (
                  <>
                    <span style={{ color: NEU.muted }}> · </span>
                    <span style={{ fontWeight: 800, color: unsent.length > 0 ? NEU.amber : NEU.inkSoft }}>
                      {unsent.length} waiting
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        {/* Controls travel together, so a narrow header wraps this bar into two
            clean halves — status above, controls below — instead of orphaning
            the divider mid-row. */}
        <div className="flex items-center gap-3" style={{ marginLeft: 'auto' }}>
          <span
            aria-hidden
            style={{ width: 1, alignSelf: 'stretch', minHeight: 26, backgroundColor: 'rgba(27,56,40,0.10)' }}
          />

          {/* A <label> cannot own a <button>, so the caption is not one — it
              just mirrors the pill's click for the pointer. The pill stays the
              single keyboard control. */}
          <span className="flex items-center gap-2" role="group" aria-label="Allocation email release mode">
            <PillToggle value={autoSend} onChange={onToggleAuto} size="sm" disabled={togglePending} />
            <span
              onClick={() => { if (!togglePending) onToggleAuto(!autoSend); }}
              style={{
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700,
                color: autoSend ? NEU.forest : NEU.amber, whiteSpace: 'nowrap',
                cursor: togglePending ? 'wait' : 'pointer', userSelect: 'none',
              }}
            >
              {autoSend ? 'Sending automatically' : 'Manual release'}
            </span>
          </span>

          <SendMenu
            unsentCount={unsent.length}
            totalCount={targets.length}
            busy={busy}
            emphasise={!autoSend}
            onAllNew={() => onSend(unsent.map(t => t.applicationId), 'new')}
            onEveryone={() => onSend(targets.map(t => t.applicationId), 'all')}
            onCustom={() => setPickerOpen(true)}
          />
        </div>
      </div>

      {pickerOpen && (
        <AllocationPicker
          targets={targets}
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
  targets, busy, onClose, onSend,
}: {
  targets: AllocationTarget[];
  busy: boolean;
  onClose: () => void;
  onSend: (applicationIds: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

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
          width: 'min(94vw, 560px)', maxHeight: '84vh',
          backgroundColor: NEU.surface, borderRadius: 24, padding: 24,
          boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)`,
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="font-black text-base" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              Choose who to email
            </h2>
            <p className="text-xs mt-0.5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
              Each delegate gets their own committee and country. Re-sending is allowed — a delegate can be emailed more than once.
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
              fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
              color: unsentIds.length === 0 ? NEU.muted : NEU.ink,
              cursor: unsentIds.length === 0 ? 'default' : 'pointer',
              opacity: unsentIds.length === 0 ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            SELECT {unsentIds.length} NEW
          </button>
          <button
            onClick={() => setPicked(new Set())}
            disabled={picked.size === 0}
            className="focus:outline-none"
            style={{
              padding: '8px 13px', borderRadius: 999, border: 'none',
              backgroundColor: 'transparent',
              fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
              color: picked.size === 0 ? NEU.muted : NEU.inkSoft,
              cursor: picked.size === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            CLEAR
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
                    <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>
                      {t.name}
                    </span>
                    <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.inkSoft }}>
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
            style={{ border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer' }}
          >
            CANCEL
          </button>
          <NeuButton
            onClick={() => onSend(Array.from(picked))}
            disabled={busy || picked.size === 0}
            gradient={NEU_GRADIENTS.gold}
            icon={Send}
            style={{ flex: 1, padding: '11px 22px' }}
          >
            {busy ? 'SENDING...' : `SEND TO ${picked.size}`}
          </NeuButton>
        </div>
      </div>
    </ModalOverlay>
  );
}

function FlagChip({ code, name }: { code: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = getFlagUrl(code);
  if (!url || failed) {
    return <span aria-hidden style={{ width: 20, height: 14, borderRadius: 2, backgroundColor: NEU.base, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.14)', flexShrink: 0 }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 1px rgba(27,56,40,0.10)' }}
    />
  );
}

function SentPill({ sent, sentAt }: { sent: boolean; sentAt: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 flex-shrink-0"
      style={{
        padding: '3px 8px', borderRadius: 999,
        backgroundColor: sent ? 'rgba(61,122,82,0.12)' : 'transparent',
        boxShadow: sent ? 'none' : NEU.inSm,
        fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em',
        color: sent ? NEU.green : NEU.muted, whiteSpace: 'nowrap',
      }}
    >
      {sent
        ? <><Check size={10} strokeWidth={3} />{formatSentAt(sentAt).toUpperCase()}</>
        : <><CircleSlash size={10} strokeWidth={2.6} />NOT SENT</>}
    </span>
  );
}
