/**
 * guestApplyDraft.ts — browser-storage autosave for a SIGNED OUT applicant.
 *
 * applyDraft.ts's header explains why the apply flow moved off
 * `gavelling-apply-resume:${slug}:${role}` in localStorage and onto a
 * server-owned draft. This file deliberately reintroduces browser storage —
 * a knowing exception, scoped to signed-out visitors only, who have no
 * server row to write because they have no `auth.uid()` yet.
 *
 * Of applyDraft.ts's three original problems, the first is UNFIXABLE here.
 * The old key was not user-scoped, so two applicants on one shared library
 * machine inherited each other's answers. A signed-out visitor has no
 * identity to scope a key with, so that cannot be solved, only made
 * visible: this draft is NEVER restored automatically. The flow offers it
 * — "Continue where I left off" / "Start fresh" — and the visitor chooses.
 *
 * The second problem becomes a feature instead of a bug. A guest draft
 * genuinely cannot follow someone to another device, so rather than
 * pretending to be durable it carries a real, short expiry (below).
 *
 * `delegationInviteToken` is deliberately NOT stored, unlike the server
 * draft. The server draft can carry it safely because that row is
 * user-scoped. In an unscoped browser key on a shared machine, that token
 * is a capability: the next person to use the computer would inherit a
 * bypass into someone else's delegation. For a guest the invite token stays
 * in the URL only.
 *
 * `appliedVoucher` is not stored either, for the same reason applyDraft.ts
 * gives: a voucher can expire or be revoked between saving and returning.
 * Only the raw `voucherCode` string is kept, same as the server draft.
 */

import type { ApplyDraftAnswers } from '@/lib/applyDraft';

export const GUEST_DRAFT_VERSION = 1;

/** A guest draft cannot follow its owner anywhere, so it is not kept
 *  indefinitely the way the server draft is — seven days. */
export const GUEST_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Deliberately a different prefix from the retired
 *  `gavelling-apply-resume:` key, so a stale value left by the old code can
 *  never be read by this one. */
export function guestDraftKey(slug: string, role: string): string {
  return `gavelling-guest-apply:v1:${slug}:${role}`;
}

/** Structurally identical to ApplyDraftAnswers, minus the invite token — see
 *  the file header. Derived with Omit so the two can never drift apart. */
export type GuestApplyAnswers = Omit<ApplyDraftAnswers, 'delegationInviteToken'>;

interface GuestDraftEnvelope {
  v: number;
  savedAt: number;
  step: number;
  answers: GuestApplyAnswers;
}

/** Writes the guest draft. Silent on any failure — a private window, blocked
 *  site data, or a full quota must degrade to "no draft", never to an error
 *  the applicant sees. */
export function saveGuestDraft(slug: string, role: string, answers: GuestApplyAnswers, step: number): void {
  try {
    const envelope: GuestDraftEnvelope = { v: GUEST_DRAFT_VERSION, savedAt: Date.now(), step, answers };
    window.localStorage.setItem(guestDraftKey(slug, role), JSON.stringify(envelope));
  } catch {
    // Storage refused or unavailable (private window, blocked site data,
    // server render). A guest without a draft is a completely normal flow.
  }
}

/** Reads the guest draft, or null when there is none, it is unreadable, it
 *  is the wrong version, or it has expired. The expired and malformed cases
 *  also remove the key, so a bad value can never sit there forever. */
export function loadGuestDraft(slug: string, role: string): { answers: GuestApplyAnswers; step: number; savedAt: number } | null {
  try {
    const key = guestDraftKey(slug, role);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    let parsed: GuestDraftEnvelope;
    try {
      parsed = JSON.parse(raw) as GuestDraftEnvelope;
    } catch {
      window.localStorage.removeItem(key);
      return null;
    }

    if (!parsed || parsed.v !== GUEST_DRAFT_VERSION) {
      window.localStorage.removeItem(key);
      return null;
    }
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > GUEST_DRAFT_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return { answers: parsed.answers, step: parsed.step, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

/** Removes the guest draft. Silent on any failure, same reasoning as save. */
export function clearGuestDraft(slug: string, role: string): void {
  try {
    window.localStorage.removeItem(guestDraftKey(slug, role));
  } catch {
    // Nothing to clear if storage never worked in the first place.
  }
}
