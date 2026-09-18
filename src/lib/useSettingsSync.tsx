'use client';

// ============================================================
// SETTINGS RE-HYDRATE (D-1)
// ============================================================
// The chair and voting loaders hydrate `committee.dbSettings` into the per-device settings
// store ONCE. Without this hook a co-chair's change never reached this device, and the
// Moderator kept enforcing the settings from when their page loaded.
//
// This watches the CONTENT of `committee.dbSettings` (a stable serialisation, not the
// object identity, which changes on every refetch) and, whenever it changes, copies ONLY
// the keys whose stored value changed into the store. Copying only changed keys matters:
// a key this chair edited a moment ago and has not flushed yet (SettingsPanel debounces
// 400 ms) is not in the diff, so a refetch triggered by something else cannot flash it back.
//
// Keys that never enter the store (`NON_HYDRATED_SETTING_KEYS`: the chair code, the gavel,
// the agenda index, the voting return phase) are stripped first.
//
// When a changed key's new value differs from what this device already had, and is not the
// echo of a value this device flushed recently (src/lib/settingsEcho.ts), the change came
// from another chair, and a subtle translated notice is shown for a few seconds.
//
// Read-only side effect: it never writes the DB and never touches committee state.

import { useEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { useT } from '@/contexts/LanguageContext';
import type { Committee } from '@/lib/types';
import {
  useSettingsStore,
  stripNonHydratedSettings,
  stableSettingsKey,
  changedSettingKeys,
  type CommitteeSettings,
} from '@/lib/settingsStore';
import { isOwnSettingsEcho } from '@/lib/settingsEcho';

const NOTICE_MS = 4500;

export function useSettingsSync(committee: Pick<Committee, 'id' | 'code' | 'dbSettings'> | null | undefined): {
  notice: React.ReactNode;
} {
  const t = useT();
  const [showNotice, setShowNotice] = useState(false);
  const prevRef = useRef<{ code: string; blob: Record<string, unknown> } | null>(null);
  const code = committee?.code ?? '';
  const committeeId = committee?.id ?? '';
  const blob = committee?.dbSettings ?? null;
  const key = stableSettingsKey(stripNonHydratedSettings(blob));

  useEffect(() => {
    if (!code || !blob) return;
    const next = stripNonHydratedSettings(blob) as Record<string, unknown>;
    const prev = prevRef.current;
    prevRef.current = { code, blob: next };
    // First sighting (or a different committee): the loader has already hydrated.
    if (!prev || prev.code !== code) return;
    const changed = changedSettingKeys(prev.blob, next);
    if (changed.length === 0) return;
    const store = useSettingsStore.getState();
    const local = store.getSettings(code) as unknown as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    let foreign = false;
    for (const k of changed) {
      if (!(k in next)) continue;   // a removed key: keep the local value (defaults cover it)
      // V3: the echo of a value THIS device flushed (possibly an older one, overtaken by a
      // newer flush still in flight) is not another chair's change. Skipping it avoids both
      // the flicker back to the older value and the notice.
      if (isOwnSettingsEcho(committeeId, k, next[k])) continue;
      if (stableSettingsKey(local[k]) !== stableSettingsKey(next[k])) {
        patch[k] = next[k];
        foreign = true;
      }
    }
    if (Object.keys(patch).length > 0) store.hydrateSettings(code, patch as Partial<CommitteeSettings>);
    // The notice reports an external change (another chair's DB write) only this diff can detect.
    if (foreign) setShowNotice(true);
  // `key` is the content signature of `blob`; keying on `blob` itself would run on every refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, key]);

  useEffect(() => {
    if (!showNotice) return;
    const timer = setTimeout(() => setShowNotice(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [showNotice, key]);

  const notice = showNotice ? (
    <Portal>
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] rounded-full px-4 py-2 flex items-center gap-2 text-xs font-semibold shadow-lg"
        style={{ backgroundColor: '#1B3828', color: '#EED98A', border: '1px solid rgba(238,217,138,0.3)' }}
      >
        <span>{t('settings_updated_by_other_chair')}</span>
        <button
          onClick={() => setShowNotice(false)}
          aria-label="Dismiss"
          className="opacity-70 hover:opacity-100 focus:outline-none"
        >
          ✕
        </button>
      </div>
    </Portal>
  ) : null;

  return { notice };
}
