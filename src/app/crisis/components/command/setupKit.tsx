'use client';
// Gavelling Crisis: shared pieces of the set-up pages (Characters, Staff and access, Settings).
// A hover hint, a switch row, a side drawer, an in-place confirm, copy to clipboard and the
// director-only card. Nothing here talks to the database.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Info, Lock, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { Btn, Card, CK, Eyebrow, useScrollLock } from '../../crisisKit';
import type { Member } from '@/lib/crisis/types';

// ─────────── Who may change things ───────────

export function DirectorOnlyCard({ title }: { title: string }) {
  return (
    <Card style={{ marginTop: 8 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: CK.ink }}>{title}</h1>
      <p className="flex items-center gap-2" style={{ margin: '8px 0 0', fontSize: 14, color: CK.inkSoft }}>
        <Lock size={16} strokeWidth={1.5} aria-hidden />
        Only the Crisis Director can change this
      </p>
    </Card>
  );
}

export function PageHeading({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between flex-wrap" style={{ gap: '10px 16px', margin: '4px 0 14px' }}>
      <div style={{ minWidth: 0 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

/** People who can answer a character's directives by default. */
export function responsibleMembers(members: Member[]): Member[] {
  const rank = { director: 0, assistant_director: 1, backroomer: 2 } as Record<string, number>;
  return members
    .filter((m) => m.role === 'backroomer' || m.role === 'director' || m.role === 'assistant_director')
    .sort((a, b) => (rank[a.role] - rank[b.role]) || a.display_name.localeCompare(b.display_name));
}

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─────────── Hover hint ───────────

export function Hint({ text, label = 'More information' }: { text: string; label?: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const show = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const above = r.bottom + 140 > window.innerHeight;
    const x = Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150);
    setPos({ x, y: above ? r.top - 8 : r.bottom + 8, above });
  };
  return (
    <>
      <span
        ref={anchor}
        tabIndex={0}
        role="img"
        aria-label={`${label}: ${text}`}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ color: CK.muted, cursor: 'help', lineHeight: 0, borderRadius: 99 }}
      >
        <Info size={15} strokeWidth={1.5} />
      </span>
      {pos && (
        <Portal>
          <div
            role="tooltip"
            style={{
              position: 'fixed', left: pos.x, top: pos.y, transform: `translate(-50%, ${pos.above ? '-100%' : '0'})`, zIndex: 10060,
              width: 280, maxWidth: 'calc(100vw - 24px)', padding: '9px 12px', borderRadius: 12, background: CK.ink, color: '#FFF4E6',
              fontSize: 12.5, lineHeight: 1.45, fontFamily: CK.font, boxShadow: '0 10px 28px rgba(28,20,16,0.3)', pointerEvents: 'none',
            }}
          >
            {text}
          </div>
        </Portal>
      )}
    </>
  );
}

// ─────────── Switch row ───────────

export function ToggleRow({ checked, onChange, title, hint, disabled }: {
  checked: boolean; onChange: (next: boolean) => void; title: string; hint?: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderTop: `1px solid ${CK.hair}` }}>
      <span className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: CK.ink, minWidth: 0 }}>
        <span style={{ overflowWrap: 'anywhere' }}>{title}</span>
        {hint && <Hint text={hint} />}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] disabled:opacity-50"
        style={{
          position: 'relative', width: 44, height: 26, borderRadius: 99, border: 0, padding: 0, cursor: disabled ? 'default' : 'pointer',
          background: checked ? CK.greenBtn : 'rgba(110,30,30,0.18)', boxShadow: checked ? CK.shadowSm : `inset 0 0 0 1px ${CK.hair}`,
          transition: 'background 160ms ease',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 160ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </button>
    </div>
  );
}

/** A setting with a choice: label and hint on the left, the control on the right. */
export function ChoiceRow({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2" style={{ padding: '10px 0', borderTop: `1px solid ${CK.hair}` }}>
      <span className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: CK.ink, minWidth: 0 }}>
        <span style={{ overflowWrap: 'anywhere' }}>{title}</span>
        {hint && <Hint text={hint} />}
      </span>
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ─────────── Side drawer ───────────

export function Drawer({ title, sub, onClose, children, footer }: {
  title: string; sub?: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock();
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // A dropdown inside the drawer closes first.
      if (e.key === 'Escape' && !document.querySelector('[data-gsel-popover]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, fontFamily: CK.font }}>
        <div aria-hidden onMouseDown={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.38)' }} />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className="focus:outline-none"
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: CK.surface, display: 'flex', flexDirection: 'column',
            boxShadow: '-12px 0 40px rgba(58,14,15,0.28)',
          }}
        >
          <div className="flex items-start justify-between gap-3" style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${CK.hair}` }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{title}</h2>
              {sub && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{sub}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ border: 0, background: CK.card, borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: CK.forest, boxShadow: CK.shadowSm }}
            >
              <X size={17} strokeWidth={1.6} style={{ margin: 'auto' }} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 20px' }}>{children}</div>
          {footer && <div style={{ padding: '12px 18px', borderTop: `1px solid ${CK.hair}`, background: CK.card }}>{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

// ─────────── In-place confirm ───────────

export function ConfirmInline({ text, confirmLabel, keepLabel = 'Keep', busy, onConfirm, onCancel, style }: {
  text: string; confirmLabel: string; keepLabel?: string; busy?: boolean; onConfirm: () => void; onCancel: () => void; style?: CSSProperties;
}) {
  return (
    <div role="alert" style={{ background: 'rgba(163,65,47,0.08)', borderRadius: 14, padding: '10px 12px', boxShadow: 'inset 0 0 0 1px rgba(163,65,47,0.25)', ...style }}>
      <p style={{ margin: '0 0 8px', fontSize: 13.5, color: CK.ink, lineHeight: 1.45 }}>{text}</p>
      <div className="flex flex-wrap gap-2">
        <Btn tone="red" size="sm" onClick={onConfirm} disabled={busy}>{confirmLabel}</Btn>
        <Btn tone="ghost" size="sm" onClick={onCancel} disabled={busy}>{keepLabel}</Btn>
      </div>
    </div>
  );
}

// ─────────── Copy ───────────

/**
 * Copy inside the click. If the browser refuses, select the text in `fallback` so Cmd or Ctrl C works.
 * Returns true when the clipboard took it.
 */
export async function copyText(text: string, fallback?: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallback) {
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); const range = document.createRange(); range.selectNodeContents(fallback); sel.addRange(range); }
    }
    return false;
  }
}

/** A field label above a control. */
export function Labelled({ label, hint, children, style }: { label: string; hint?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ minWidth: 0, ...style }}>
      <p className="flex items-center gap-1.5" style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>
        {label}
        {hint && <Hint text={hint} />}
      </p>
      {children}
    </div>
  );
}
