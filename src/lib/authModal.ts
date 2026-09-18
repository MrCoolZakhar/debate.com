'use client';

// ── The "Log in or sign up" modal: one global store ─────────────────────────
//
// Signing in is a pop-up, never a separate page (owner, 18 Sep 2026: "the user
// never goes to a different page", modelled on Airbnb). Any button anywhere
// calls `openAuth()`; the one <AuthModalHost /> in the root layout renders the
// modal (src/components/auth/AuthModal.tsx).
//
//   openAuth()                     stay on this page after signing in
//   openAuth({ next: '/x' })       go to /x after signing in
//   openAuth({ step: 'signup' })   a "Sign up" button: same modal, same first
//                                  step (the email decides), only the title
//                                  differs
//
// /auth/signin and /auth/signup still exist for deep links (emails, redirect
// guards, old bookmarks). They redirect to `/?auth=signin&next=...`, and the
// host opens the modal from those query params (`authUrl`).
//
// Precedence: while the modal is open CompleteBasicsGate stands down and the
// gates behind it stay closed (src/lib/basicsGateState.ts), so two modals never
// stack. The modal's own "Finish signing up" step asks the same two questions.

import { useSyncExternalStore } from 'react';

export type AuthEntry = 'signin' | 'signup' | 'finish' | 'forgot';

export interface AuthRequest {
  /** Where to go after signing in. Same-origin relative path only. */
  next?: string;
  /** Which variant opened it. 'finish' = after an OAuth return. */
  step?: AuthEntry;
  /** Prefill the email field (an invite that knows the address). */
  email?: string;
  /** Show the "continue your application" line. */
  apply?: boolean;
  /** Short status line shown above the email field (verified, failed...). */
  notice?: string;
}

export interface AuthModalState {
  open: boolean;
  request: AuthRequest;
  /** Bumped on every open, so the modal can reset its steps. */
  nonce: number;
}

let state: AuthModalState = { open: false, request: {}, nonce: 0 };
const listeners = new Set<() => void>();

function emit(next: AuthModalState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Only a same-origin relative path is honoured (open-redirect guard). */
export function safeNextPath(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : undefined;
}

export function openAuth(request: AuthRequest = {}): void {
  emit({
    open: true,
    request: { ...request, next: safeNextPath(request.next) },
    nonce: state.nonce + 1,
  });
}

export function closeAuth(): void {
  if (!state.open) return;
  emit({ ...state, open: false });
}

export function isAuthModalOpen(): boolean {
  return state.open;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const SERVER_STATE: AuthModalState = { open: false, request: {}, nonce: 0 };

export function useAuthModal(): AuthModalState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

export function useAuthModalOpen(): boolean {
  return useAuthModal().open;
}

/** A plain URL that opens the modal: for emails, server redirects and the
 *  href of a link whose click opens the modal in place. */
export function authUrl(opts: { next?: string; step?: AuthEntry; email?: string; apply?: boolean } = {}): string {
  const p = new URLSearchParams();
  p.set('auth', opts.step ?? 'signin');
  const next = safeNextPath(opts.next);
  if (next) p.set('next', next);
  if (opts.email) p.set('email', opts.email);
  if (opts.apply) p.set('apply', '1');
  return `/?${p.toString()}`;
}

/** The query keys the host consumes and strips from the address bar. */
export const AUTH_QUERY_KEYS = ['auth', 'next', 'email', 'apply', 'verified', 'error'] as const;
