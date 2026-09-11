'use client';

// ── Who goes first among the root-layout gates ────────────────────────────────
//
// CompleteBasicsGate (nationality + date of birth) is blocking and takes
// precedence over CreditsWelcomeGate and SetupReminderGate. It publishes its
// status here; the other two read `useBasicsGateBlocking()` and render nothing
// while it is true, then open as normal once it clears. Their own state is
// untouched, so a new Google user still gets the credits welcome, just after
// the basics are saved rather than stacked on top of them.
//
// Blocking = 'checking' | 'needed'. 'idle' (signed out, or not checked yet on
// an excluded route) and 'ok' never block, and a failed profile read resolves
// to 'ok', so this can never hold the other gates shut indefinitely.

import { useSyncExternalStore } from 'react';

export type BasicsGateStatus = 'idle' | 'checking' | 'needed' | 'ok';

let status: BasicsGateStatus = 'idle';
const listeners = new Set<() => void>();

export function setBasicsGateStatus(next: BasicsGateStatus): void {
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getSnapshot(): BasicsGateStatus {
  return status;
}

function getServerSnapshot(): BasicsGateStatus {
  return 'idle';
}

export function useBasicsGateStatus(): BasicsGateStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True while the basics gate is deciding or open. Other gates must stay closed. */
export function useBasicsGateBlocking(): boolean {
  const s = useBasicsGateStatus();
  return s === 'checking' || s === 'needed';
}
