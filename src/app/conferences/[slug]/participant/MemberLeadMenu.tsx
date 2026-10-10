'use client';

// The leaders' role tool on the delegation card (27 Sep 2026): a small "…"
// menu on a member's row, shown to every leader of the delegation (faculty
// advisor or head delegate). The ONLY role move is delegate to head delegate
// and back, through delegation_set_head(p_society, p_application_id, p_head):
// "Make head delegate" on a delegate's row, "Make delegate" on a head
// delegate's row (the viewer's own included, to step down). Delegate and
// faculty advisor never swap (owner), so a faculty advisor's row has no menu.
// Several head delegates are allowed; promoting one demotes nobody. Each move
// asks first, reads a fresh token, has a busy guard, shows the server's
// sentence on refusal, toasts on success and re-reads the roster.

import { useEffect, useRef, useState } from 'react';
import { Crown, MoreHorizontal, UserRound } from 'lucide-react';
import Portal from '@/components/Portal';
import type { ConfirmModalConfig, ConfirmModalResult } from '@/components/ConfirmModal';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5A5046';

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
  // 'up' = delegate to head delegate; 'down' = head delegate to delegate.
  const move: 'up' | 'down' | null = member.role === 'delegate' ? 'up' : member.role === 'head-delegate' ? 'down' : null;

  // Close on an outside press or Escape; place the menu under the button,
  // flipped above and kept on screen near the edges.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = 260, h = 90;
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

  // A faculty advisor's row: no menu at all.
  if (!move) return null;

  async function setHead(head: boolean) {
    setOpen(false);
    if (busyRef.current) return;
    const res = await confirm(head
      ? {
          title: `Make ${member.name} a head delegate?`,
          body: <p style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.5 }}>They will lead {societyName} with you.</p>,
          confirmLabel: 'Make head delegate',
        }
      : self
        ? {
            title: 'Step down as head delegate?',
            body: <p style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.5 }}>You become a delegate and will no longer lead {societyName}. Your seat stays yours.</p>,
            confirmLabel: 'Make me a delegate',
            danger: true,
          }
        : {
            title: `Make ${member.name} a delegate?`,
            body: <p style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.5 }}>They will no longer lead the delegation.</p>,
            confirmLabel: 'Make delegate',
            danger: true,
          });
    if (!res.confirmed) return;
    busyRef.current = true;
    setBusy(true);
    const fallback = head ? 'They could not be made head delegate. Try again.' : 'That change was not saved. Try again.';
    try {
      const client = await getFreshAuthedClient();
      if (!client) { notifyErr('Your session has expired. Refresh the page and sign in again.'); return; }
      const { data: out, error } = await client.rpc('delegation_set_head', {
        p_society: societyId, p_application_id: member.application_id, p_head: head,
      });
      const r = out as { ok: boolean; error?: string } | null;
      if (error || !r?.ok) {
        notifyErr(error ? friendlyError(error, fallback) : plainOrFallback(r?.error, fallback));
        return;
      }
      notifyOk(head ? `${member.name} is now a head delegate.` : self ? 'You are now a delegate.' : `${member.name} is now a delegate.`);
      await onDone();
    } catch (e) {
      notifyErr(friendlyError(e, fallback));
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
        // A 44px hit area around the 34px disc; the negative margin keeps the row's layout as it was.
        style={{ width: 44, height: 44, margin: -5, padding: 0, borderRadius: 12, border: 'none', background: 'transparent', color: INK, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: open ? 'rgba(27,56,40,0.08)' : 'transparent' }}>
          <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden />
        </span>
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
            {move === 'up' ? (
              <button type="button" role="menuitem" onClick={() => { void setHead(true); }} style={item}>
                <Crown size={17} strokeWidth={2.2} style={{ color: '#2A5A3C', marginTop: 1, flexShrink: 0 }} aria-hidden />
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: INK }}>Make head delegate</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: INK_SOFT }}>They lead the delegation with you.</span>
                </span>
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={() => { void setHead(false); }} style={item}>
                <UserRound size={17} strokeWidth={2.2} style={{ color: '#2A5A3C', marginTop: 1, flexShrink: 0 }} aria-hidden />
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: INK }}>{self ? 'Step down to delegate' : 'Make delegate'}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: INK_SOFT }}>{self ? 'You stop leading the delegation.' : 'They stop leading the delegation.'}</span>
                </span>
              </button>
            )}
          </div>
        </Portal>
      )}
    </>
  );
}
