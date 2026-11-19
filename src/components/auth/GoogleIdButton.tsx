'use client';

// Google's own "Continue with Google" button (Google Identity Services).
//
// Why (owner, 19 Nov 2026): the old redirect flow sent people through
// luruhkwrgisytejswlas.supabase.co, and Google's account chooser said "to continue to
// luruhkwrgisytejswlas.supabase.co", which looks like phishing. Here Google's script runs
// on gavelling.com, hands us a signed ID token for the chosen account, and the caller
// signs in with supabase.auth.signInWithIdToken. Nobody leaves the page.
//
// Needs, in Google Cloud > the OAuth client below > Authorised JavaScript origins:
// https://gavelling.com (and http://localhost:3000 for dev). Supabase checks the token's
// audience against the Google client configured in Auth > Providers > Google, which is
// this same client.
//
// If Google's script cannot load (blocked, offline, slow), `fallback` renders instead:
// the old redirect button, so Google sign-in never disappears.

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** The OAuth web client Supabase already uses for Google (public by design). */
export const GOOGLE_CLIENT_ID = '814363036743-ctibedjvsm13l5hh9eudrpje59qr7c8c.apps.googleusercontent.com';

/** Kill switch: false puts every Google button back on the old redirect flow. */
export const GOOGLE_ID_BUTTON = true;

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const LOAD_TIMEOUT_MS = 6000;

type GsiCredential = { credential?: string };
type GsiId = {
  initialize(opts: {
    client_id: string;
    callback: (r: GsiCredential) => void;
    nonce?: string;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
  disableAutoSelect(): void;
};
type GsiWindow = Window & { google?: { accounts?: { id?: GsiId } } };

let scriptPromise: Promise<GsiId> | null = null;

function loadGsi(): Promise<GsiId> {
  const w = window as GsiWindow;
  if (w.google?.accounts?.id) return Promise.resolve(w.google.accounts.id);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GsiId>((resolve, reject) => {
    const done = () => {
      const id = (window as GsiWindow).google?.accounts?.id;
      if (id) resolve(id); else reject(new Error('gsi missing'));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const s = existing ?? document.createElement('script');
    s.addEventListener('load', done, { once: true });
    s.addEventListener('error', () => reject(new Error('gsi failed to load')), { once: true });
    if (!existing) {
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    setTimeout(() => reject(new Error('gsi timed out')), LOAD_TIMEOUT_MS);
  });
  // A failed load may succeed on a later open (network back): forget it.
  scriptPromise.catch(() => { scriptPromise = null; });
  return scriptPromise;
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Google's button, as wide as its container (200 to 400 px, Google's limits).
 * `onToken` gets the ID token and the RAW nonce, both for signInWithIdToken.
 */
export function GoogleIdButton({ onToken, fallback, text = 'continue_with' }: {
  onToken: (idToken: string, nonce: string) => void;
  fallback: ReactNode;
  text?: 'continue_with' | 'signin_with' | 'signup_with';
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);
  const [failed, setFailed] = useState(!GOOGLE_ID_BUTTON);

  useEffect(() => {
    if (!GOOGLE_ID_BUTTON) return;
    let cancelled = false;
    void (async () => {
      try {
        // crypto.subtle exists only on secure origins (https, localhost).
        if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('no crypto.subtle');
        const [gsi, nonce] = await Promise.all([loadGsi(), Promise.resolve(randomNonce())]);
        const hashed = await sha256Hex(nonce);
        const host = hostRef.current;
        if (cancelled || !host) return;
        // One button is on screen at a time, so re-initialising on mount gives this
        // button its own nonce and callback.
        gsi.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
          callback: (r) => { if (r.credential) onTokenRef.current(r.credential, nonce); },
        });
        const width = Math.max(200, Math.min(400, Math.round(host.getBoundingClientRect().width) || 320));
        host.innerHTML = '';
        gsi.renderButton(host, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [text]);

  if (failed) return <>{fallback}</>;
  // A fixed height keeps the pop-up from jumping while Google's script loads.
  return <div ref={hostRef} style={{ width: '100%', minHeight: 44, display: 'flex', justifyContent: 'center' }} />;
}
