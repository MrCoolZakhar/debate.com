'use client';

// The ··· menu on a person in the organiser's delegation pop-up (People tab,
// owner, 21 Oct 2026), drawn like the leader card's row menu
// (participant/delegation/MemberMenu): a Portal popover at fixed coordinates,
// opened leftward from the button and upward when there is no room below,
// scrolling itself, closed by a press outside or Escape (on the shared Escape
// stack, so Escape never closes the pop-up underneath). A confirm is asked IN
// PLACE inside the menu, never as a modal.
//
// Items, only the ones that change something:
//   Make head delegate / Make faculty advisor / Make delegate
//       organiser_set_member_role (Christian's, live; its sentence shown as given).
//       A move to or from faculty advisor is asked first: the ticket follows the person.
//       Head delegate to delegate is asked first: they stop leading.
//   Unallocate                 seated people; the parent runs the optimistic seat write
//   Remove from delegation     delegation_remove_member (live)
// Role and Remove wait for DELEGATIONS_MONEY_DB (v2.ts) and are drawn disabled
// with the hover title "Coming soon, waiting for Christian" while it is off.

import { useCallback, useRef, useState } from 'react';
import { CircleMinus, Crown, GraduationCap, MoreHorizontal, UserMinus, UserRound } from 'lucide-react';
import Portal from '@/components/Portal';
import { useModalEscape } from '@/components/ModalOverlay';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr } from '@/lib/appNotify';
import { DANGER, FONT, INK, INK_SOFT, STROKE } from './kit';
import { DELEGATIONS_MONEY_DB, WAITING_FOR_CHRISTIAN } from './v2';

export type OrganiserRole = 'delegate' | 'head-delegate' | 'faculty-advisor';
type Result = { ok: true } | { ok: false; error: string };

const MENU_W = 284;
const LINE = '#EFEAE0';

const ROLE_WORDS: Record<OrganiserRole, { label: string; a: string; yes: string }> = {
  'delegate': { label: 'Make delegate', a: 'a delegate', yes: 'Make delegate' },
  'head-delegate': { label: 'Make head delegate', a: 'a head delegate', yes: 'Make head delegate' },
  'faculty-advisor': { label: 'Make faculty advisor', a: 'a faculty advisor', yes: 'Make faculty advisor' },
};

const ROLE_ICON: Record<OrganiserRole, typeof Crown> = {
  'delegate': UserRound,
  'head-delegate': Crown,
  'faculty-advisor': GraduationCap,
};

type Action =
  | { kind: 'role'; role: OrganiserRole }
  | { kind: 'unallocate' }
  | { kind: 'remove' };

interface Item {
  key: string;
  icon: typeof Crown;
  label: string;
  /** What a press does: asked in place first, or run at once. */
  action: Action;
  asks: boolean;
  danger?: boolean;
  /** Shown but not pressable; the hover title says why. */
  off?: string;
}

export default function OrganiserMemberMenu({
  name, role, canChangeRole, allocationWords, delegationName, onRole, onRemove, onUnallocate, onOpenChange, disabled = false,
}: {
  name: string;
  /** The person's role, or null for a role this menu does not move (observer, chair). */
  role: OrganiserRole | null;
  /** Accepted people only: an applicant's role is decided on their application. */
  canChangeRole: boolean;
  /** "Germany · UNHRC" when the person holds an allocation they can be taken out of. */
  allocationWords: string | null;
  delegationName: string;
  onRole: (role: OrganiserRole) => Promise<Result>;
  onRemove: () => Promise<Result>;
  onUnallocate: () => void;
  /** The menu opened or closed (the parent holds the live re-read back meanwhile). */
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}) {
  const [open, setOpenState] = useState(false);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) { setConfirm(null); setPos(null); }
    onOpenChange?.(next);
  }, [onOpenChange]);

  const close = useCallback(() => { if (!busyRef.current) setOpen(false); }, [setOpen]);
  useModalEscape(close, open);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const h = menuRef.current?.offsetHeight ?? 200;
    // Leftward: the menu's right edge on the button's right edge, kept on screen.
    const left = Math.max(8, Math.min(window.innerWidth - MENU_W - 8, r.right - MENU_W));
    // Upward when there is no room below.
    const below = r.bottom + 6;
    const top = below + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : below;
    setPos(p => (p && p.top === top && p.left === left ? p : { top, left }));
  }, []);

  // Placed once the Portal node exists, and again when its content changes
  // height (a confirm), on scroll and on resize; an outside press closes it.
  const cleanup = useRef<(() => void) | null>(null);
  const setMenuNode = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node;
    cleanup.current?.();
    cleanup.current = null;
    if (!node) return;
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place()) : null;
    ro?.observe(node);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', onDown);
    cleanup.current = () => {
      ro?.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [place, close]);

  const run = useCallback(async (work: () => Promise<Result>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let r: Result;
    try {
      r = await work();
    } catch (e) {
      r = { ok: false, error: friendlyError(e, 'That change was not saved. Try again.') };
    }
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) { notifyErr(r.error, 'applications'); return; }
    setOpen(false);
  }, [setOpen]);

  const doAction = useCallback((a: Action) => {
    if (a.kind === 'role') { void run(() => onRole(a.role)); return; }
    if (a.kind === 'remove') { void run(onRemove); return; }
    setOpen(false);
    onUnallocate();
  }, [run, onRole, onRemove, onUnallocate, setOpen]);

  // ── What this person offers ──
  const items: Item[] = [];
  if (role && canChangeRole) {
    const targets: OrganiserRole[] = (['head-delegate', 'faculty-advisor', 'delegate'] as OrganiserRole[]).filter(r => r !== role);
    for (const to of targets) {
      const asks = (to === 'faculty-advisor') !== (role === 'faculty-advisor') || (role === 'head-delegate' && to === 'delegate');
      items.push({
        key: to, icon: ROLE_ICON[to], label: ROLE_WORDS[to].label, action: { kind: 'role', role: to }, asks,
        off: DELEGATIONS_MONEY_DB ? undefined : WAITING_FOR_CHRISTIAN,
      });
    }
  }
  if (allocationWords) {
    items.push({ key: 'unallocate', icon: CircleMinus, label: 'Unallocate', action: { kind: 'unallocate' }, asks: true });
  }
  items.push({
    key: 'remove', icon: UserMinus, label: 'Remove from delegation', action: { kind: 'remove' }, asks: true, danger: true,
    off: DELEGATIONS_MONEY_DB ? undefined : WAITING_FOR_CHRISTIAN,
  });

  const confirmCopy = (a: Action): { title: string; line: string | null; yes: string; danger: boolean } => {
    if (a.kind === 'unallocate') {
      return { title: `Unallocate ${name} from ${allocationWords ?? 'their allocation'}?`, line: 'The allocation stays with the delegation as an open allocation.', yes: 'Unallocate', danger: true };
    }
    if (a.kind === 'remove') {
      return { title: `Remove ${name} from ${delegationName}?`, line: 'Their allocation goes back to the delegation as open. Money stays with whoever paid it.', yes: 'Remove', danger: true };
    }
    const w = ROLE_WORDS[a.role];
    if (a.role === 'faculty-advisor') {
      return { title: `Make ${name} ${w.a}?`, line: "Their ticket follows them: the advisor fee is owed or the difference refunded, as the conference's prices say.", yes: w.yes, danger: false };
    }
    if (role === 'faculty-advisor') {
      return { title: `Make ${name} ${w.a}?`, line: `Their ticket follows them: the ${a.role === 'head-delegate' ? 'head delegate' : 'delegate'} fee is owed or the difference refunded, as the conference's prices say.`, yes: w.yes, danger: false };
    }
    return { title: `Make ${name} ${w.a}?`, line: 'They stop leading the delegation.', yes: w.yes, danger: true };
  };

  const itemStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, minHeight: 44,
    border: 'none', background: 'transparent', textAlign: 'left', cursor: busy ? 'default' : 'pointer', fontFamily: FONT, fontSize: 14, color: INK,
  };

  let body: React.ReactNode;
  if (confirm) {
    const c = confirmCopy(confirm);
    const action = confirm;
    body = (
      <div style={{ padding: '10px 10px 6px' }}>
        <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK, margin: 0, overflowWrap: 'anywhere' }}>{c.title}</p>
        {c.line && <p style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, margin: '4px 0 0 0', lineHeight: 1.45 }}>{c.line}</p>}
        <div className="flex items-center justify-end gap-2 flex-wrap" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
            style={{ minHeight: 40, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', color: INK, fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={() => doAction(action)} disabled={busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
            style={{ minHeight: 40, padding: '0 12px', borderRadius: 8, border: 'none', background: c.danger ? DANGER : 'linear-gradient(180deg, #26503D, #1B3828)', color: '#FFFFFF', fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {c.yes}
          </button>
        </div>
      </div>
    );
  } else {
    const row = (i: Item) => {
      const Icon = i.icon;
      if (i.off) {
        // aria-disabled, not disabled: a disabled button shows no hover title in every browser.
        return (
          <button key={i.key} type="button" role="menuitem" aria-disabled="true" title={i.off} onClick={(e) => e.preventDefault()}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
            style={{ ...itemStyle, color: i.danger ? DANGER : INK, opacity: 0.45, cursor: 'default' }}>
            <Icon size={18} strokeWidth={STROKE} aria-hidden />
            {i.label}
          </button>
        );
      }
      return (
        <button key={i.key} type="button" role="menuitem" onClick={() => { if (i.asks) setConfirm(i.action); else doAction(i.action); }} disabled={busy}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:bg-[#F4F0E6]"
          style={{ ...itemStyle, color: i.danger ? DANGER : INK }}>
          <Icon size={18} strokeWidth={STROKE} aria-hidden />
          {i.label}
        </button>
      );
    };
    const danger = items.filter(i => i.danger);
    const plain = items.filter(i => !i.danger);
    body = (
      <>
        {plain.map(row)}
        {danger.length > 0 && plain.length > 0 && <div aria-hidden style={{ height: 1, background: LINE, margin: '4px 6px' }} />}
        {danger.map(row)}
      </>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (open) close(); else setOpen(true); }}
        disabled={disabled || busy}
        aria-label={`More for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
        style={{ width: 36, height: 36, padding: 0, borderRadius: 10, border: 'none', background: open ? '#F1ECE1' : 'transparent', color: INK, cursor: disabled || busy ? 'default' : 'pointer', opacity: disabled || busy ? 0.5 : 1 }}
      >
        <MoreHorizontal size={18} strokeWidth={STROKE} aria-hidden />
      </button>
      {open && (
        <Portal>
          <div
            ref={setMenuNode}
            role="menu"
            aria-label={`More for ${name}`}
            style={{
              position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_W, zIndex: 80, padding: 6, borderRadius: 12,
              background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.08), 0 6px 16px rgba(27,56,40,0.10), 0 18px 44px rgba(27,56,40,0.16)',
              maxHeight: 'calc(100vh - 16px)', overflowY: 'auto', visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {body}
          </div>
        </Portal>
      )}
    </>
  );
}
