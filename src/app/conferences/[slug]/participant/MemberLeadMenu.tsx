'use client';

// The head delegate's two tools on the delegation card (27 Sep 2026), moved
// from the deleted /delegation portal onto each member row: a small "…" menu,
// shown only to the head delegate, with "Make head delegate"
// (delegation_transfer_head) and "Make faculty advisor"
// (delegation_promote_to_advisor, retried with p_clear_seat true when the
// server says the member holds a seat). Each asks first, reads a fresh token,
// has a busy guard, shows the server's sentence on refusal and re-reads the
// roster on success. Seating stays with the swap control.

import { useEffect, useRef, useState } from 'react';
import { Crown, GraduationCap, MoreHorizontal } from 'lucide-react';
import Portal from '@/components/Portal';
import type { ConfirmModalConfig, ConfirmModalResult } from '@/components/ConfirmModal';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5A5046';

const ACCEPTED = new Set(['accepted', 'assigned', 'checked-in']);

export interface LeadMenuMember {
  application_id: string;
  name: string;
  role: 'faculty-advisor' | 'head-delegate' | 'delegate';
  claimed: boolean;
  status: string;
  is_me: boolean;
  /** The seat the member holds, when the viewer can see it. */
  seat: string | null;
}

export default function MemberLeadMenu({ member, societyId, societyName, confirm, onDone }: {
  member: LeadMenuMember;
  societyId: string;
  societyName: string;
  confirm: (config: ConfirmModalConfig) => Promise<ConfirmModalResult>;
  onDone: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const self = member.is_me;
  const canHead = !self && member.role === 'delegate';
  const headReason = !member.claimed ? 'They need a Gavelling account first.'
    : !ACCEPTED.has(member.status) ? 'The organiser has to accept them first.' : null;
  const canAdvisor = member.role === 'delegate' || member.role === 'head-delegate';

  // Close on an outside press or Escape; place the menu under the button,
  // flipped above and kept on screen near the edges.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = 260, h = 150;
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w));
      const top = r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6;
      setPos({ top, left });
    };
    place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
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
  }, [open]);

  if (!canHead && !canAdvisor) return null;

  async function makeHead() {
    setOpen(false);
    if (busyRef.current) return;
    const res = await confirm({
      title: `Make ${member.name} head delegate?`,
      body: (
        <div style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.5 }}>
          <p>{member.name} will lead {societyName}. You become a delegate and keep your seat.</p>
          <p style={{ marginTop: 8 }}>You lose the leader tools on this card unless you are also the faculty advisor. The organiser sees the change straight away. Delegation spots you pledged stay on your bill.</p>
        </div>
      ),
      confirmLabel: 'Make head delegate',
      danger: true,
    });
    if (!res.confirmed) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const client = await getFreshAuthedClient();
      if (!client) { notifyErr('Your session has expired. Refresh the page and sign in again.'); return; }
      const { data: out, error } = await client.rpc('delegation_transfer_head', { p_society: societyId, p_application_id: member.application_id });
      const r = out as { ok: boolean; error?: string } | null;
      if (error || !r?.ok) {
        notifyErr(error ? friendlyError(error, 'The role was not handed over. Try again.') : plainOrFallback(r?.error, 'The role was not handed over. Try again.'));
        return;
      }
      notifyOk(`${member.name} is now head delegate.`);
      await onDone();
    } catch (e) {
      notifyErr(friendlyError(e, 'The role was not handed over. Try again.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function makeAdvisor() {
    setOpen(false);
    if (busyRef.current) return;
    const seat = member.seat;
    const res = await confirm({
      title: self ? 'Become the faculty advisor?' : `Make ${member.name} faculty advisor?`,
      body: (
        <div style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.5 }}>
          <p>{self ? 'You' : member.name} will be {societyName}&apos;s faculty advisor{self ? ' and stop being head delegate' : ''}. The organiser sees the change straight away.</p>
          {seat && <p style={{ marginTop: 8 }}>Advisors hold no committee seat, so {self ? 'your' : 'their'} seat, {seat}, is given up.</p>}
          <p style={{ marginTop: 8 }}>No new credit is used. An unpaid registration fee follows the advisor price.</p>
        </div>
      ),
      confirmLabel: seat ? 'Make advisor and free the seat' : 'Make faculty advisor',
      danger: !!seat,
    });
    if (!res.confirmed) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const client = await getFreshAuthedClient();
      if (!client) { notifyErr('Your session has expired. Refresh the page and sign in again.'); return; }
      const rpc = (clear: boolean) => client.rpc('delegation_promote_to_advisor', {
        p_society: societyId, p_application_id: member.application_id, p_clear_seat: clear,
      });
      let { data: out, error } = await rpc(!!seat);
      let r = out as { ok: boolean; error?: string; needs_confirm?: boolean; seat?: string } | null;
      // A seat we did not know about (given moments ago): ask again, naming it.
      if (!error && r && !r.ok && r.needs_confirm) {
        const again = await confirm({
          title: 'This frees a seat',
          body: <p style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.5 }}>{self ? 'You hold' : `${member.name} holds`} {r.seat}. Advisors hold no seat, so it will be given up.</p>,
          confirmLabel: 'Free the seat',
          danger: true,
        });
        if (!again.confirmed) return;
        ({ data: out, error } = await rpc(true));
        r = out as typeof r;
      }
      if (error || !r?.ok) {
        notifyErr(error ? friendlyError(error, 'That change was not saved. Try again.') : plainOrFallback(r?.error, 'That change was not saved. Try again.'));
        return;
      }
      notifyOk(self ? 'You are now the faculty advisor.' : `${member.name} is now the faculty advisor.`);
      await onDone();
    } catch (e) {
      notifyErr(friendlyError(e, 'That change was not saved. Try again.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const item: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 10,
    border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={busy}
        aria-label={`Options for ${member.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Options"
        className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: open ? 'rgba(27,56,40,0.08)' : 'transparent', color: INK, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Options for ${member.name}`}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: 260, zIndex: 80, padding: 6, borderRadius: 14,
              background: '#FFFFFF', boxShadow: '0 12px 32px rgba(27,56,40,0.18), 0 0 0 1px rgba(27,56,40,0.08)',
            }}
          >
            {canHead && (
              <button type="button" role="menuitem" disabled={!!headReason} onClick={() => { void makeHead(); }} style={{ ...item, opacity: headReason ? 0.5 : 1, cursor: headReason ? 'default' : 'pointer' }}>
                <Crown size={17} strokeWidth={2.2} style={{ color: '#2A5A3C', marginTop: 1, flexShrink: 0 }} aria-hidden />
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: INK }}>Make head delegate</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: INK_SOFT }}>{headReason ?? 'You become a delegate.'}</span>
                </span>
              </button>
            )}
            {canAdvisor && (
              <button type="button" role="menuitem" onClick={() => { void makeAdvisor(); }} style={item}>
                <GraduationCap size={17} strokeWidth={2.2} style={{ color: '#2A5A3C', marginTop: 1, flexShrink: 0 }} aria-hidden />
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: INK }}>{self ? 'Become the faculty advisor' : 'Make faculty advisor'}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: INK_SOFT }}>{member.seat ? 'Frees their committee seat.' : 'Advisors hold no committee seat.'}</span>
                </span>
              </button>
            )}
          </div>
        </Portal>
      )}
    </>
  );
}
