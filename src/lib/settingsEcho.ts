// ============================================================
// src/lib/settingsEcho.ts
// Which settings values did THIS device just write? (V3)
//
// `useSettingsSync` re-hydrates the settings store whenever `committee.dbSettings` changes
// and shows "Settings updated by another chair" when a changed key differs from the store.
// This device's own write comes back as a realtime echo. If the chair changed the key again
// before the echo landed (two quick slider moves), the echo carries the OLDER value, differs
// from the store, and used to be treated as another chair's change: the control flickered
// back and the notice fired for the chair's own click.
//
// Every settings patch records each key's flushed value here, keyed by committee id, and
// the hook skips an echo that matches a value this device flushed recently. Recent values
// (not only the last one) are kept, because the echo of an older flush can arrive after a
// newer flush was issued.
// ============================================================

import { stableSettingsKey } from './settingsStore';

const ECHO_TTL_MS = 15000;
const MAX_PER_KEY = 6;

type Flushed = { sig: string; at: number };
const flushed = new Map<string, Map<string, Flushed[]>>();

/** Record the values of a settings patch this device is about to write. */
export function noteFlushedSettings(committeeId: string, patch: Record<string, unknown>): void {
  if (!committeeId) return;
  let byKey = flushed.get(committeeId);
  if (!byKey) { byKey = new Map(); flushed.set(committeeId, byKey); }
  const now = Date.now();
  for (const [k, v] of Object.entries(patch)) {
    const list = (byKey.get(k) ?? []).filter((f) => now - f.at < ECHO_TTL_MS);
    list.push({ sig: stableSettingsKey(v), at: now });
    byKey.set(k, list.slice(-MAX_PER_KEY));
  }
}

/** Is `value` for `key` an echo of a recent write from this device? */
export function isOwnSettingsEcho(committeeId: string, key: string, value: unknown): boolean {
  const list = flushed.get(committeeId)?.get(key);
  if (!list || list.length === 0) return false;
  const now = Date.now();
  const sig = stableSettingsKey(value);
  return list.some((f) => now - f.at < ECHO_TTL_MS && f.sig === sig);
}
