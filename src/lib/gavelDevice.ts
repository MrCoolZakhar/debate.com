// ============================================================
// GAVEL DEVICE — one device at a time holds the Moderator role
// ============================================================
// A chair's identity is only the `?chairName=` URL param, so two devices with the SAME
// name (one account on a laptop and a phone, or a name typed twice) used to both derive
// "I am the Moderator": both skipped current_speaker events, both debounced, both ran the
// caucus clock and wrote, and the room drifted.
//
// `committees.settings.headChairDevice` records WHICH device holds the gavel for the name in
// `headChair`. It is a random per-device id kept in localStorage under
// `gavelling-gavel-device:<CODE>`. It is published raw on purpose: the settings blob is
// anon-readable and this id confers nothing (isViewOnly is a UI gate, rule 15). It is NOT
// the seat token, which is a claim credential and is never stored raw.
//
// Rule: newest wins. A device claims on its first load when its name holds the gavel, when
// the gavel reaches its name with no device recorded, and on an explicit take ("Take the
// gavel", join as Moderator, "Use this device"). Nothing else ever steals it back.
//
// Two tabs on the SAME device share localStorage, so they share the role, exactly as before.

import type { Committee } from '@/lib/types';

const DEVICE_PREFIX = 'gavelling-gavel-device:';
// Used only when localStorage is unavailable: the id then lives as long as this tab.
const memoryIds: Record<string, string> = {};

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* insecure context: fall through */ }
  try {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch { /* no Web Crypto at all */ }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/** This device's gavel id for a session, created on first use. '' during SSR. */
export function getGavelDeviceId(code: string): string {
  if (typeof window === 'undefined' || !code) return '';
  const key = DEVICE_PREFIX + code.toUpperCase();
  try {
    const stored = localStorage.getItem(key);
    if (stored && stored.length >= 16) return stored;
  } catch { /* storage blocked */ }
  if (memoryIds[key]) return memoryIds[key];
  const fresh = randomId();
  memoryIds[key] = fresh;
  try { localStorage.setItem(key, fresh); } catch { /* keep the in-memory copy */ }
  return fresh;
}

type GavelRow = Pick<Committee, 'dbHeadChair' | 'dbHeadChairDevice' | 'chairNames'>;

export interface GavelRole {
  /** Resolved holder name: headChair, else the creator, else this chair. */
  head: string | null;
  /** This chair's NAME holds the gavel (the pre-device rule). */
  nameHolds: boolean;
  /** The name holds it, but a different device is recorded as the Moderator. */
  heldElsewhere: boolean;
  /** This device is the Moderator. */
  isModerator: boolean;
}

/**
 * The one role derivation. Moderator iff the name matches AND (no device recorded OR the
 * recorded device is this one). `pinDevice` lets a device that has just claimed keep its
 * claim while a refetch that predates its own write is still arriving.
 */
export function deriveGavelRole(
  committee: GavelRow | null | undefined,
  myChairName: string,
  deviceId: string,
  pinDevice?: string | null,
): GavelRole {
  const head = committee?.dbHeadChair || committee?.chairNames?.[0] || myChairName || null;
  const recorded = pinDevice || committee?.dbHeadChairDevice || null;
  // No `?chairName=` (an old rejoin link): this page has no identity to hold the gavel with,
  // so it can never be "the same name on another device" and never offers "Use this device"
  // (that would write the holder's name with THIS device). With a device recorded it is a
  // view-only Commenter; with none it keeps the pre-device behaviour (Moderator).
  if (!myChairName) {
    const mine = !recorded || (!!deviceId && recorded === deviceId);
    return { head, nameHolds: mine, heldElsewhere: false, isModerator: mine };
  }
  const nameHolds = !(!!head && head !== myChairName);
  const heldElsewhere = nameHolds && !!recorded && !!deviceId && recorded !== deviceId;
  return { head, nameHolds, heldElsewhere, isModerator: nameHolds && !heldElsewhere };
}

// ── Resume latch ownership ──────────────────────────────────────────────────
// `resuming_chair` stores a NAME, so a same-name device on another laptop looks like "mine"
// and could take the self-heal path and run the second write a second time. This device
// remembers the suspension it actually claimed (keyed by `suspended_at`, which is new for
// every suspension, so a leftover marker can never match a later one).
const RESUME_PREFIX = 'gavelling-resume-claim:';

export function markResumeClaim(code: string, suspendedAt: string | null | undefined): void {
  if (!suspendedAt) return;
  try { localStorage.setItem(RESUME_PREFIX + code.toUpperCase(), suspendedAt); } catch { /* ignore */ }
}

export function clearResumeClaim(code: string): void {
  try { localStorage.removeItem(RESUME_PREFIX + code.toUpperCase()); } catch { /* ignore */ }
}

/** True only when THIS device claimed the latch for THIS suspension. */
export function resumeClaimIsMine(code: string, suspendedAt: string | null | undefined): boolean {
  if (!suspendedAt) return false;
  try { return localStorage.getItem(RESUME_PREFIX + code.toUpperCase()) === suspendedAt; } catch { return false; }
}
