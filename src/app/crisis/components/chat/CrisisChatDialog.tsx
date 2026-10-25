'use client';
// Gavelling Crisis chat: the delegate's conversations with other characters, in a dialog.
// Props stay as they are; the delegate page imports this default export.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import { CK } from '../../crisisKit';
import ChatBody from './ChatBody';
import { iconBtn } from './chatKit';

export interface CrisisChatDialogProps { open: boolean; onClose: () => void; initialCharacterId?: string | null }

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CrisisChatDialog({ open, onClose, initialCharacterId = null }: CrisisChatDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus moves in once the panel is mounted (Portal mounts a microtask late).
    const focusTimer = window.setTimeout(() => {
      const p = panelRef.current;
      if (p && !p.contains(document.activeElement)) p.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const p = panelRef.current;
      if (!p) return;
      const nodes = Array.from(p.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) { e.preventDefault(); return; }
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === p)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      before?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 1000 }}>
        <div onClick={() => closeRef.current()} aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.45)' }} />
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Chat with delegates" tabIndex={-1}
          className="relative flex flex-col w-full h-full md:w-[900px] md:h-[640px] md:max-w-[calc(100vw-48px)] md:max-h-[calc(100dvh-48px)] md:rounded-[22px] focus:outline-none"
          style={{ background: CK.card, boxShadow: '0 24px 60px rgba(58,14,15,0.35)', overflow: 'hidden', fontFamily: CK.font, color: CK.ink }}>
          <div className="flex items-center justify-between" style={{ padding: '10px 14px', borderBottom: `1px solid ${CK.hair}`, background: CK.redWash }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Chat with Delegates</h2>
            <button onClick={onClose} aria-label="Close chat" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={iconBtn}>
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatBody initialCharacterId={initialCharacterId} />
          </div>
        </div>
      </div>
    </Portal>
  );
}
