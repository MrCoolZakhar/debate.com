'use client';

// ── The two purchase pop-ups: one global store ───────────────────────────────
//
// Buying credits and going Unlimited happen in a pop-up, on whatever page the
// person is on (the header counter, the pricing page, Manage account, the
// out-of-credits moment in an application, the pay page). Any button anywhere
// calls `openCreditsPopup()` or `openUnlimitedPopup()`; the one
// <PurchasePopupHost /> in the root layout renders them
// (src/components/purchase/PurchasePopupHost.tsx). Modelled on the auth modal
// store (src/lib/authModal.ts).
//
//   openCreditsPopup({ context: 'apply', conferenceName, onComplete })
//   openUnlimitedPopup({ renewOnce: true })   the failed-renewal fallback
//   closePurchasePopup()
//
// The two swap into each other from a link line at the foot of each; the
// original `onComplete` rides along, since a person who came to buy a credit
// and left with Unlimited still wants the same thing to happen next.

import { useSyncExternalStore } from 'react';
import type { CreditsContext } from './creditPricing';

export interface CreditsPopupRequest {
  context: CreditsContext;
  /** The apply context: names the conference in the subtitle. */
  conferenceName?: string;
  /** Which bundle opens selected; a quantity outside the bundles becomes "Another amount". */
  preselect?: number;
  /** Fired once the payment is complete (embedded) and the balance was refreshed. */
  onComplete?: () => void;
}

export interface UnlimitedPopupRequest {
  /** Offer only the one-time year ($30, nothing automatic): the failed-renewal fallback. */
  renewOnce?: boolean;
  onComplete?: () => void;
}

export type PurchasePopupState =
  | { open: false; nonce: number }
  | { open: true; kind: 'credits'; request: CreditsPopupRequest; nonce: number }
  | { open: true; kind: 'unlimited'; request: UnlimitedPopupRequest; nonce: number };

let state: PurchasePopupState = { open: false, nonce: 0 };
const listeners = new Set<() => void>();

function emit(next: PurchasePopupState) {
  state = next;
  listeners.forEach((l) => l());
}

export function openCreditsPopup(request: CreditsPopupRequest = { context: 'header' }): void {
  emit({ open: true, kind: 'credits', request, nonce: state.nonce + 1 });
}

export function openUnlimitedPopup(request: UnlimitedPopupRequest = {}): void {
  emit({ open: true, kind: 'unlimited', request, nonce: state.nonce + 1 });
}

export function closePurchasePopup(): void {
  if (!state.open) return;
  emit({ open: false, nonce: state.nonce });
}

/** From the credits pop-up to Unlimited, keeping the caller's onComplete. */
export function swapToUnlimited(): void {
  const onComplete = state.open ? state.request.onComplete : undefined;
  emit({ open: true, kind: 'unlimited', request: { onComplete }, nonce: state.nonce + 1 });
}

/** From the Unlimited pop-up to credits, keeping the caller's onComplete. */
export function swapToCredits(context: CreditsContext = 'header'): void {
  const onComplete = state.open ? state.request.onComplete : undefined;
  emit({ open: true, kind: 'credits', request: { context, onComplete }, nonce: state.nonce + 1 });
}

export function isPurchasePopupOpen(): boolean {
  return state.open;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const SERVER_STATE: PurchasePopupState = { open: false, nonce: 0 };

export function usePurchasePopup(): PurchasePopupState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}
