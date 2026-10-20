'use client';

// Shared confirm dialog, styled replacement for window.confirm/alert across
// the site. Since prompt 144 it is the current pop-up style: a white card on
// the house ModalOverlay backdrop, a Title Case title, one line, sentence-case
// buttons right-aligned (outline Cancel, forest confirm, or the "danger" red for
// destructive actions), and a busy state. Use the useConfirmModal() hook
// from call sites: `const { confirmed, checked } = await confirm({ ... })`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ModalOverlay } from '@/components/ModalOverlay';

const OUTFIT = "var(--font-brand), sans-serif";

export interface ConfirmModalCheckboxConfig {
  label: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  disabledNote?: string;
}

export interface ConfirmModalConfig {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  checkbox?: ConfirmModalCheckboxConfig;
  /** Optional async work to run before the modal resolves/closes, the confirm
   *  button shows a loading spinner and both buttons disable while it's pending. */
  onConfirm?: (checked: boolean) => void | Promise<void>;
}

export interface ConfirmModalResult {
  confirmed: boolean;
  checked: boolean;
}

export interface ConfirmModalProps {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  checkbox?: ConfirmModalCheckboxConfig;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  loading?: boolean;
  /** Disables the confirm button (e.g. a type-to-confirm gate) without disabling the whole modal. */
  confirmDisabled?: boolean;
  /** Card width in px (default 440). */
  width?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Presentational component, usable standalone or via the hook below ──────

export function ConfirmModal({
  title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false,
  checkbox, checked = false, onCheckedChange, loading = false, confirmDisabled = false, width = 440, onConfirm, onCancel,
}: ConfirmModalProps) {
  // Enter confirms. Escape is NOT handled here — ModalOverlay owns it, via a
  // stack that only ever dismisses the top-most overlay. Doing it locally as
  // well would close a confirm AND the drawer underneath it with one keypress.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (loading || e.defaultPrevented) return;
      if (e.key === 'Enter') { if (confirmDisabled) return; e.preventDefault(); onConfirm(); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, confirmDisabled, onConfirm]);

  const disabled = loading || confirmDisabled;

  return (
    <ModalOverlay
      onClose={() => { if (!loading) onCancel(); }}
      // The card below already declares role="alertdialog", so the backdrop
      // stays role-less rather than nesting a second dialog.
      dialogRole={null}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="gv-confirm flex flex-col"
        style={{ width, maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <style>{CONFIRM_CSS}</style>
        <h2 id="confirm-modal-title" className="gv-confirm-title">{title}</h2>
        {body && <div className="gv-confirm-body">{body}</div>}
        {checkbox && (
          <label
            className="flex items-start gap-2.5"
            style={{ cursor: checkbox.disabled || loading ? 'not-allowed' : 'pointer', opacity: checkbox.disabled ? 0.55 : 1 }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={checkbox.disabled || loading}
              onChange={(e) => onCheckedChange?.(e.target.checked)}
              className="flex-shrink-0"
              style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--gv-main)' }}
            />
            <span style={{ fontSize: 14, color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.45 }}>
              {checkbox.label}
              {checkbox.disabled && checkbox.disabledNote && (
                <span className="block mt-0.5" style={{ fontSize: 12.5, color: '#6B5F52' }}>
                  {checkbox.disabledNote}
                </span>
              )}
            </span>
          </label>
        )}
        <div className="gv-confirm-foot">
          <button type="button" onClick={onCancel} disabled={loading} className="gv-confirm-btn gv-confirm-cancel">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            aria-busy={loading || undefined}
            className={`gv-confirm-btn ${danger ? 'gv-confirm-danger' : 'gv-confirm-main'}`}
          >
            {loading && <span className="gv-confirm-spin" aria-hidden />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// The site's current pop-up look (prompt 144): a white card with a soft shadow,
// a Title Case title, one plain line, and sentence-case buttons on the right
// (an outline Cancel, then the forest or danger action, with a busy spinner).
const CONFIRM_CSS = `
.gv-confirm{gap:12px;padding:24px 24px 20px;border-radius:22px;background:#FFFFFF;font-family:${OUTFIT};box-shadow:0 30px 70px -28px color-mix(in srgb, var(--gv-main) 55%, transparent),0 0 0 1px color-mix(in srgb, var(--gv-main) 6%, transparent)}
.gv-confirm-title{margin:0;font-size:21px;font-weight:800;line-height:1.25;letter-spacing:-0.01em;color:#1C1410;overflow-wrap:anywhere}
.gv-confirm-body{font-size:15px;line-height:1.5;color:#544B3E;overflow-wrap:anywhere}
.gv-confirm-foot{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:8px}
.gv-confirm-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 18px;border:none;border-radius:12px;font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer;transition:filter 140ms ease,transform 120ms ease,opacity 140ms ease}
.gv-confirm-btn:active:not(:disabled){transform:scale(0.98)}
.gv-confirm-btn:disabled{opacity:0.55;cursor:not-allowed}
.gv-confirm-btn:focus{outline:none}
.gv-confirm-btn:focus-visible{outline:2px solid var(--gv-main);outline-offset:2px}
.gv-confirm-cancel{background:#FFFFFF;color:#1C1410;box-shadow:inset 0 0 0 1.5px #1C1410}
.gv-confirm-cancel:hover:not(:disabled){background:#F6F3EC}
.gv-confirm-main{background:linear-gradient(90deg,var(--gv-main) 0%,var(--gv-main-mid) 100%);color:#FFFFFF}
.gv-confirm-danger{background:#8B2020;color:#FFFFFF}
.gv-confirm-main:hover:not(:disabled),.gv-confirm-danger:hover:not(:disabled){filter:brightness(1.1)}
.gv-confirm-spin{width:14px;height:14px;border-radius:999px;border:2px solid currentColor;border-top-color:transparent;animation:gv-confirm-spin 0.8s linear infinite;flex-shrink:0}
@keyframes gv-confirm-spin{to{transform:rotate(360deg)}}
@media (max-width:420px){.gv-confirm-foot .gv-confirm-btn{flex:1 1 140px}}
@media (prefers-reduced-motion:reduce){.gv-confirm-spin{animation-duration:2s}}
`;

// ── useConfirmModal(), imperative await-style API ───────────────────────────

interface PendingConfirm {
  config: ConfirmModalConfig;
  resolve: (result: ConfirmModalResult) => void;
}

export function useConfirmModal() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef<PendingConfirm | null>(null);
  pendingRef.current = pending;

  const confirm = useCallback((config: ConfirmModalConfig): Promise<ConfirmModalResult> => {
    return new Promise((resolve) => {
      setChecked(config.checkbox?.defaultChecked ?? false);
      setLoading(false);
      setPending({ config, resolve });
    });
  }, []);

  const handleCancel = useCallback(() => {
    const current = pendingRef.current;
    if (!current || loading) return;
    current.resolve({ confirmed: false, checked });
    setPending(null);
  }, [checked, loading]);

  const handleConfirm = useCallback(async () => {
    const current = pendingRef.current;
    if (!current || loading) return;
    if (current.config.onConfirm) {
      setLoading(true);
      try {
        await current.config.onConfirm(checked);
      } finally {
        setLoading(false);
      }
    }
    current.resolve({ confirmed: true, checked });
    setPending(null);
  }, [checked, loading]);

  const modal = pending ? (
    <ConfirmModal
      title={pending.config.title}
      body={pending.config.body}
      confirmLabel={pending.config.confirmLabel}
      cancelLabel={pending.config.cancelLabel}
      danger={pending.config.danger}
      checkbox={pending.config.checkbox}
      checked={checked}
      onCheckedChange={setChecked}
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, modal };
}
