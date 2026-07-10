'use client';

// Shared confirm dialog — styled replacement for window.confirm/alert across
// the manage area. Cream card on the house ModalOverlay backdrop (see
// CommitteeEditorModal.tsx), forest-green confirm by default, muted-red
// "danger" variant for destructive actions. Use the useConfirmModal() hook
// from call sites: `const { confirmed, checked } = await confirm({ ... })`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ModalOverlay } from '@/components/CommitteeEditorModal';

const OUTFIT = "'Outfit', sans-serif";

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
  /** Optional async work to run before the modal resolves/closes — the confirm
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
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Presentational component — usable standalone or via the hook below ──────

export function ConfirmModal({
  title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false,
  checkbox, checked = false, onCheckedChange, loading = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  // Esc cancels, Enter confirms — scoped to this modal's lifetime.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (loading) return;
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onConfirm, onCancel]);

  const confirmBg = loading ? '#DDD4C0' : danger ? '#8B2020' : '#1B3828';
  const confirmColor = loading ? '#9A8A78' : danger ? '#FFFFFF' : '#EED98A';
  const spinnerColor = danger ? '#FFFFFF' : '#EED98A';

  return (
    <ModalOverlay onClose={() => { if (!loading) onCancel(); }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 400, maxWidth: '90vw' }}
      >
        <p id="confirm-modal-title" className="text-base font-bold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {title}
        </p>
        {body && (
          <div className="text-sm" style={{ color: '#4A4238', fontFamily: OUTFIT, lineHeight: 1.55 }}>
            {body}
          </div>
        )}
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
              style={{ width: 15, height: 15, marginTop: 2, accentColor: '#1B3828' }}
            />
            <span style={{ fontSize: 13, color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.45 }}>
              {checkbox.label}
              {checkbox.disabled && checkbox.disabledNote && (
                <span className="block mt-0.5" style={{ fontSize: 11.5, color: '#9A8A78' }}>
                  {checkbox.disabledNote}
                </span>
              )}
            </span>
          </label>
        )}
        <div className="flex gap-3 mt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none"
            style={{
              border: '1.5px solid #DDD4C0', color: loading ? '#C8BEA8' : '#1C1410',
              backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel.toUpperCase()}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none inline-flex items-center justify-center gap-2"
            style={{
              backgroundColor: confirmBg, color: confirmColor, fontFamily: OUTFIT,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading && (
              <span
                className="w-3.5 h-3.5 rounded-full border-2 animate-spin flex-shrink-0"
                style={{ borderColor: spinnerColor, borderTopColor: 'transparent' }}
              />
            )}
            {confirmLabel.toUpperCase()}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── useConfirmModal() — imperative await-style API ───────────────────────────

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
