'use client';

// The row menu on the leader card's People table. Every leader gets it, and
// sees the full menu (owner, 20 Oct 2026); an item a flag still holds back is
// shown disabled with a hover title saying why:
//   Make head delegate / Make delegate        delegation_set_head (live)
//   Allocate / Unallocate                     DELEGATIONS_V2_DB (v2.ts), else "Coming soon";
//                                             Place lists the open seats in a second step
//                                             (committee A to Z, country, seat: seat/seatOrder)
//   Upload position paper                     DELEGATIONS_V2_DB, else "Coming soon"
//   Switch with…                              whenever the People table offers a switch (seat/):
//                                             a second step lists the people this seat can go
//                                             to, then the switch is asked in place
//   Remove from delegation                    DELEGATIONS_MONEY_DB (Christian's money functions),
//                                             else "Coming soon, waiting for Christian"
// Seat items and paper never show for a faculty advisor (no seat). Leaders never
// move anyone to or from faculty advisor: only organisers do that (owners,
// 20 Oct 2026), from the organiser's delegation pop-up.
// With `ops` from the People table, Place, Take out, Upload and Switch run
// through the table so its rows change at once (optimistic, rolled back on a
// refusal); the table can also open the menu straight at the place or switch
// step, anchored to its own button (handleRef.openAt).
// The menu is a Portal popover at fixed coordinates under the button, opened
// upward and leftward near the edges, closed on an outside press or Escape.
// A confirm is asked IN PLACE inside the menu (never a modal); a second step
// replaces the menu's content with a back button.

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowLeftRight, Armchair, ChevronLeft, CircleMinus, Crown, MoreHorizontal, Upload, UserRound, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { committeeDisplayName } from '@/lib/presetNames';
import { DELEGATIONS_MONEY_DB, DELEGATIONS_V2_DB, placeMember, removeMember, unplaceMember, uploadPaperForMember, type MemberRole, type OpenSeat, type Result } from './v2';
import { CommitteeDisc, committeeEmblemSrc, DANGER, FONT, INK, INK_SOFT, LINE, RoundAvatar, STROKE } from './leaderKit';
import { sortOpenSeats } from './seat/seatOrder';

export interface MenuMember {
  application_id: string;
  name: string;
  role: MemberRole;
  is_me: boolean;
  user_id: string | null;
  /** The seat they hold, when they hold one. */
  seat: { committee_id: string; country_code: string } | null;
}

/** Someone this member's seat can be switched with (or moved to). */
export interface SwitchTarget {
  application_id: string;
  name: string;
  avatar_url: string | null;
  seat: { country_name: string | null; country_code: string | null; seatLogo: string | null; committee_label: string } | null;
}

/** The People table's seat writes for this row; each one closes the menu and reports itself. */
export interface SeatOps {
  place: (seat: OpenSeat) => void;
  unplace: () => void;
  upload: (file: File) => void;
  switchTargets: SwitchTarget[];
  switchCopy: (toApplicationId: string) => { title: string; line: string | null; yes: string };
  switchWith: (toApplicationId: string) => void;
  /** Why "Switch with…" is disabled when nobody is in switchTargets. */
  switchOffReason?: string;
}

export interface MemberMenuHandle {
  /** Opens the menu at a step, under `anchor` instead of the ··· button. */
  openAt: (step: 'place' | 'switch', anchor: HTMLElement) => void;
}

type Action =
  | { kind: 'head'; head: boolean }
  | { kind: 'remove' }
  | { kind: 'unplace' }
  | { kind: 'switch'; to: string };

type Step = 'list' | 'place' | 'switch' | { confirm: Action };

const MENU_W = 272;
const SOON = 'Coming soon';
const SOON_CHRISTIAN = 'Coming soon, waiting for Christian';

interface Item {
  key: string;
  icon: typeof Crown;
  label: string;
  onPress: () => void;
  danger?: boolean;
  /** Shown but not pressable; the hover title says why. */
  off?: string;
}

export default function MemberMenu({ member, societyId, openSeats, conferenceId, onDone, ops, handleRef }: {
  member: MenuMember;
  societyId: string;
  /** The delegation's open seats (V2 only), for Allocate. */
  openSeats: OpenSeat[] | null;
  conferenceId: string;
  onDone: () => Promise<void> | void;
  ops?: SeatOps;
  handleRef?: React.Ref<MemberMenuHandle>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('list');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Set when the table opened the menu from its own button (openAt).
  const anchorRef = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const self = member.is_me;
  const isAdvisor = member.role === 'faculty-advisor';

  const place = useCallback(() => {
    const r = (anchorRef.current ?? btnRef.current)?.getBoundingClientRect();
    if (!r) return;
    const h = menuRef.current?.offsetHeight ?? 160;
    // Leftward: the menu's right edge on the button's right edge, kept on screen.
    const left = Math.max(8, Math.min(window.innerWidth - MENU_W - 8, r.right - MENU_W));
    // Upward when there is no room below.
    const below = r.bottom + 6;
    const top = below + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : below;
    setPos({ top, left });
  }, []);

  // The Portal mounts a moment after the menu opens: place it once its node
  // exists, and again whenever its content changes height (a step or a confirm).
  const observer = useRef<ResizeObserver | null>(null);
  const setMenuNode = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node;
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    place();
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(() => place());
      observer.current.observe(node);
    }
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  useImperativeHandle(handleRef, () => ({
    openAt: (to, anchor) => {
      anchorRef.current = anchor;
      setPos(null);
      setStep(to);
      setOpen(true);
    },
  }), []);

  const run = useCallback(async (work: () => Promise<Result>, okLine: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await work();
      if (!r.ok) { notifyErr(r.error); return; }
      setOpen(false);
      notifyOk(okLine);
      await onDone();
    } catch (e) {
      notifyErr(friendlyError(e, 'That change was not saved. Try again.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [onDone]);

  const setHead = useCallback((head: boolean) => run(async () => {
    const fallback = head ? 'They could not be made head delegate. Try again.' : 'That change was not saved. Try again.';
    const client = await getFreshAuthedClient();
    if (!client) return { ok: false, error: 'Your session has expired. Refresh the page and sign in again.' };
    const { data, error } = await client.rpc('delegation_set_head', {
      p_society: societyId, p_application_id: member.application_id, p_head: head,
    });
    const r = data as { ok?: boolean; error?: string } | null;
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    if (!r?.ok) return { ok: false, error: plainOrFallback(r?.error, fallback) };
    return { ok: true };
  }, head ? `${member.name} is now a head delegate.` : self ? 'You are now a delegate.' : `${member.name} is now a delegate.`), [run, societyId, member.application_id, member.name, self]);

  const doAction = (a: Action) => {
    if (a.kind === 'head') return setHead(a.head);
    if (a.kind === 'remove') return run(() => removeMember(member.application_id), `${member.name} is no longer in the delegation.`);
    if (a.kind === 'switch') { setOpen(false); ops?.switchWith(a.to); return; }
    if (a.kind === 'unplace' && ops) { setOpen(false); ops.unplace(); return; }
    // Like Allocate: the table is re-read by onDone once the write landed.
    return run(() => unplaceMember(member.application_id), self ? 'You are unallocated. Your allocation stays with the delegation as an open allocation.' : `${member.name} is unallocated. Their allocation stays with the delegation as an open allocation.`);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !member.seat || !member.user_id) return;
    if (ops) { setOpen(false); ops.upload(file); return; }
    const seat = member.seat;
    const userId = member.user_id;
    await run(() => uploadPaperForMember({
      conferenceId, committeeId: seat.committee_id, applicationId: member.application_id, memberUserId: userId, file,
    }), `Position paper uploaded for ${member.name}.`);
  };

  // What this row offers: the full menu, with what a flag holds back disabled.
  const seats = sortOpenSeats(openSeats);
  const noop = () => {};
  const items: Item[] = [];
  if (member.role === 'delegate') items.push({ key: 'up', icon: Crown, label: 'Make head delegate', onPress: () => { void doAction({ kind: 'head', head: true }); } });
  if (member.role === 'head-delegate') items.push({ key: 'down', icon: UserRound, label: 'Make delegate', onPress: () => setStep({ confirm: { kind: 'head', head: false } }) });
  if (!isAdvisor) {
    if (member.seat) {
      items.push(DELEGATIONS_V2_DB
        ? { key: 'unplace', icon: CircleMinus, label: 'Unallocate', onPress: () => setStep({ confirm: { kind: 'unplace' } }) }
        : { key: 'unplace', icon: CircleMinus, label: 'Unallocate', onPress: noop, off: SOON });
    } else {
      items.push(!DELEGATIONS_V2_DB
        ? { key: 'place', icon: Armchair, label: 'Allocate', onPress: noop, off: SOON }
        : (seats?.length ?? 0) > 0
          ? { key: 'place', icon: Armchair, label: 'Allocate', onPress: () => setStep('place') }
          : { key: 'place', icon: Armchair, label: 'Allocate', onPress: noop, off: 'The delegation has no open allocations' });
    }
    items.push(!DELEGATIONS_V2_DB
      ? { key: 'upload', icon: Upload, label: 'Upload position paper', onPress: noop, off: SOON }
      : !member.seat
        ? { key: 'upload', icon: Upload, label: 'Upload position paper', onPress: noop, off: 'Allocate them first' }
        : !member.user_id
          ? { key: 'upload', icon: Upload, label: 'Upload position paper', onPress: noop, off: 'They have not joined yet' }
          : { key: 'upload', icon: Upload, label: 'Upload position paper', onPress: () => fileRef.current?.click() });
    if (member.seat) {
      items.push((ops?.switchTargets.length ?? 0) > 0
        ? { key: 'switch', icon: ArrowLeftRight, label: 'Switch with…', onPress: () => setStep('switch') }
        : { key: 'switch', icon: ArrowLeftRight, label: 'Switch with…', onPress: noop, off: ops?.switchOffReason ?? 'Nobody to switch with right now' });
    }
  }
  if (!self) {
    items.push(DELEGATIONS_MONEY_DB
      ? { key: 'remove', icon: X, label: 'Remove from delegation', onPress: () => setStep({ confirm: { kind: 'remove' } }), danger: true }
      : { key: 'remove', icon: X, label: 'Remove from delegation', onPress: noop, danger: true, off: SOON_CHRISTIAN });
  }

  if (items.length === 0) return null;

  const itemStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, minHeight: 44,
    border: 'none', background: 'transparent', textAlign: 'left', cursor: busy ? 'default' : 'pointer', fontFamily: FONT, fontSize: 14, color: INK,
  };

  const confirmCopy = (a: Action): { title: string; line: string | null; yes: string; danger: boolean } => {
    if (a.kind === 'switch') return { ...(ops?.switchCopy(a.to) ?? { title: 'Switch these allocations?', line: null, yes: 'Switch' }), danger: false };
    if (a.kind === 'unplace') return self
      ? { title: 'Unallocate yourself?', line: 'Your allocation stays with the delegation as an open allocation.', yes: 'Unallocate', danger: true }
      : { title: `Unallocate ${member.name}?`, line: 'Their allocation stays with the delegation as an open allocation.', yes: 'Unallocate', danger: true };
    if (a.kind === 'remove') return { title: `Remove ${member.name}?`, line: 'Their allocation goes back to the delegation as an open allocation. Money stays with whoever paid it.', yes: 'Remove', danger: true };
    return self
      ? { title: 'Make yourself a delegate?', line: 'You stop leading the delegation. Your allocation stays yours.', yes: 'Make me a delegate', danger: true }
      : { title: `Make ${member.name} a delegate?`, line: 'They stop leading the delegation.', yes: 'Make delegate', danger: true };
  };

  const backBtn = (
    <button type="button" onClick={() => setStep('list')} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]" style={{ ...itemStyle, minHeight: 40, padding: '6px 8px', color: INK_SOFT, fontSize: 13.5 }}>
      <ChevronLeft size={16} strokeWidth={STROKE} aria-hidden />
      Back
    </button>
  );

  let body: React.ReactNode;
  if (step === 'place') {
    body = (
      <div>
        {backBtn}
        <p style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: INK, margin: '4px 10px 6px' }}>Choose an allocation for {member.name}</p>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {(seats ?? []).map((s, i) => (
            <button
              key={`${s.allocation_id ?? i}`}
              type="button"
              role="menuitem"
              disabled={busy || !s.allocation_id}
              onClick={() => {
                if (!s.allocation_id) return;
                if (ops) { setOpen(false); ops.place(s); return; }
                void run(() => placeMember(member.application_id, s.allocation_id as string), `${member.name} is now in ${s.country_name}.`);
              }}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:bg-[#F4F0E6]"
              style={itemStyle}
            >
              <CircleFlag code={s.country_code} logoUrl={s.country_logo_url} label={s.country_name} size={22} decorative />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{s.country_name}</span>
              <span className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: INK_SOFT }}>
                <CommitteeDisc src={committeeEmblemSrc(s.logo_url, s.committee, s.abbreviation)} size={16} />
                {s.abbreviation || committeeDisplayName(s.committee, s.abbreviation)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (step === 'switch') {
    body = (
      <div>
        {backBtn}
        <p style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: INK, margin: '4px 10px 6px' }}>Switch with</p>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {(ops?.switchTargets ?? []).map(t => (
            <button
              key={t.application_id}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => setStep({ confirm: { kind: 'switch', to: t.application_id } })}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:bg-[#F4F0E6]"
              style={itemStyle}
            >
              <RoundAvatar name={t.name} url={t.avatar_url} size={28} seed={t.application_id} />
              <span className="min-w-0 flex-1 flex flex-col">
                <span className="[overflow-wrap:anywhere]" style={{ fontWeight: 600 }}>{t.name}</span>
                <span className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: INK_SOFT }}>
                  {t.seat ? (
                    <>
                      <CircleFlag code={t.seat.country_code} logoUrl={t.seat.seatLogo} label={t.seat.country_name} size={16} decorative />
                      {t.seat.country_name} · {t.seat.committee_label}
                    </>
                  ) : 'No allocation yet'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (typeof step === 'object') {
    const c = confirmCopy(step.confirm);
    const action = step.confirm;
    body = (
      <div style={{ padding: '10px 10px 6px' }}>
        <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK, margin: 0, overflowWrap: 'anywhere' }}>{c.title}</p>
        {c.line && <p style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, margin: '4px 0 0 0', lineHeight: 1.45 }}>{c.line}</p>}
        <div className="flex items-center justify-end gap-2" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setStep('list')} disabled={busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
            style={{ minHeight: 40, padding: '0 12px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)', background: '#FFFFFF', color: INK, fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={() => { void doAction(action); }} disabled={busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
            style={{ minHeight: 40, padding: '0 12px', borderRadius: 8, border: 'none', background: c.danger ? DANGER : 'var(--gv-main)', color: c.danger ? '#FFFFFF' : 'var(--gv-on-main)', fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {c.yes}
          </button>
        </div>
      </div>
    );
  } else {
    const danger = items.filter(i => i.danger);
    const plain = items.filter(i => !i.danger);
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
        <button key={i.key} type="button" role="menuitem" onClick={i.onPress} disabled={busy}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:bg-[#F4F0E6]"
          style={{ ...itemStyle, color: i.danger ? DANGER : INK }}>
          <Icon size={18} strokeWidth={STROKE} aria-hidden />
          {i.label}
        </button>
      );
    };
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
        onClick={(e) => { e.stopPropagation(); anchorRef.current = null; setStep('list'); setOpen(o => !o); }}
        disabled={busy}
        aria-label={`More for ${member.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
        style={{ width: 44, height: 44, margin: -6, padding: 0, borderRadius: 10, border: 'none', background: 'transparent', color: INK, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 8, background: open ? '#F1ECE1' : 'transparent' }}>
          <MoreHorizontal size={18} strokeWidth={STROKE} aria-hidden />
        </span>
      </button>
      {DELEGATIONS_V2_DB && (
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => { void onPickFile(e); }} />
      )}
      {open && (
        <Portal>
          <div
            ref={setMenuNode}
            role="menu"
            aria-label={`More for ${member.name}`}
            style={{
              position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_W, zIndex: 80, padding: 6, borderRadius: 12,
              background: '#FFFFFF', boxShadow: '0 1px 2px color-mix(in srgb, var(--gv-main) 8%, transparent), 0 6px 16px color-mix(in srgb, var(--gv-main) 10%, transparent), 0 18px 44px color-mix(in srgb, var(--gv-main) 16%, transparent)',
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
