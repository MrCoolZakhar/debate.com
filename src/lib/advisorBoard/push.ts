'use client';

// ============================================================
// src/lib/advisorBoard/push.ts
//
// Web push alerts for the faculty advisor board (23 Oct 2026, owner-approved): the board's
// reminders ("Maya speaks next") reach a phone in a pocket. Standard Web Push only (Push
// API + VAPID, delivered by the browser vendor's own push service); no third-party SDK.
//
//   * The service worker is public/sw-advisor.js, scope '/advisor': push and
//     notificationclick only, no fetch handler, no caching.
//   * Permission is asked ONLY inside the tap on "Get alerts on this phone".
//   * The subscription (endpoint + keys) is saved with save_advisor_push_subscription
//     (scratch-advisor-push.sql), with the rooms added by code on this phone as
//     (code, country) pairs. Names typed on this phone never leave it: they go to this
//     phone's IndexedDB with the wording in the board's language, for the worker to read.
//   * The database decides when to push (the same moments as reminders.ts) and the
//     edge function advisor-push sends it (supabase-functions/advisor-push).
//
// The control shows only when NEXT_PUBLIC_VAPID_PUBLIC_KEY is set, which it is not until
// the server side is deployed (docs/sessions/advisor-push.md), so shipping this is safe.
// ============================================================

import { getFreshAuthedClient } from '../supabase-auth';

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const SW_URL = '/sw-advisor.js';
export const SW_SCOPE = '/advisor';
const LOCAL_KEY = 'gavelling-advisor-push-v1';
const IDB_NAME = 'gavelling-advisor-push';
const IDB_STORE = 'kv';

/** The browser vendors' push services. Mirrors _advisor_push_endpoint_ok in
 *  scratch-advisor-push.sql: change both. */
const PUSH_ENDPOINT_RE = /^https:\/\/(fcm\.googleapis\.com|jmt17\.google\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

export type PushSupport = 'none' | 'ios-home-screen' | 'ok';

function iosVersion(): [number, number] | null {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!ios) return null;
  const m = ua.match(/OS (\d+)[_.](\d+)/) ?? ua.match(/Version\/(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

function isStandalone(): boolean {
  try {
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/** 'ok': this browser can take alerts now. 'ios-home-screen': an iPhone or iPad on iOS
 *  16.4+ that must first add the board to the Home Screen and open it from there.
 *  'none': hide the control (no VAPID key yet, or no Push API). */
export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY || typeof window === 'undefined') return 'none';
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (hasApi) return 'ok';
  const ios = iosVersion();
  if (ios && !isStandalone()) {
    const [major, minor] = ios;
    if (major > 16 || (major === 16 && minor >= 4)) return 'ios-home-screen';
  }
  return 'none';
}

export function endpointSupported(endpoint: string): boolean {
  return PUSH_ENDPOINT_RE.test(endpoint);
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const norm = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

// ── What this phone remembers (per account) ─────────────────────────────────

interface LocalPushState { uid: string; endpoint: string; sig: string; savedAt: number }

export function readLocalPush(): LocalPushState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<LocalPushState>) : null;
    if (!v || typeof v.uid !== 'string' || typeof v.endpoint !== 'string') return null;
    return { uid: v.uid, endpoint: v.endpoint, sig: typeof v.sig === 'string' ? v.sig : '', savedAt: Number(v.savedAt) || 0 };
  } catch {
    return null;
  }
}

function writeLocalPush(v: LocalPushState | null) {
  try {
    if (v) localStorage.setItem(LOCAL_KEY, JSON.stringify(v));
    else localStorage.removeItem(LOCAL_KEY);
  } catch { /* storage blocked: the browser subscription is still the truth */ }
}

// ── Wording and names for the worker (this phone's IndexedDB only) ──────────

export interface WorkerLocalData {
  lang: string;
  dir: 'ltr' | 'rtl';
  templates: Record<'speaking' | 'speaking_many' | 'next' | 'next_many' | 'soon' | 'soon_many' | 'test_title' | 'test_body', string>;
  /** "CODE|country (lower case)" → the first names typed on this phone for that seat. */
  names: Record<string, string[]>;
}

export function writeWorkerLocal(data: WorkerLocalData): Promise<void> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(IDB_NAME, 1);
      open.onupgradeneeded = () => { open.result.createObjectStore(IDB_STORE); };
      open.onerror = () => resolve();
      open.onsuccess = () => {
        try {
          const db = open.result;
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(data, 'local');
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); resolve(); };
        } catch { resolve(); }
      };
    } catch { resolve(); }
  });
}

function clearWorkerLocal(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(IDB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch { resolve(); }
  });
}

// ── The subscription ────────────────────────────────────────────────────────

export interface DeviceFollow { code: string; country: string }

/** The signature of what the server holds for this phone: re-saved when it changes. */
export function pushSignature(enabled: boolean, follows: DeviceFollow[]): string {
  const list = follows.map((f) => `${f.code}|${f.country.trim().toLowerCase()}`).sort();
  return JSON.stringify([enabled, list]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Whether the server still holds this phone for the signed-in account. Null when it
 *  could not be read (never a verdict). */
export async function serverHasSubscription(endpoint: string): Promise<boolean | null> {
  try {
    const client = await getFreshAuthedClient();
    if (!client) return null;
    const { data, error } = await client.from('advisor_push_subscriptions').select('id').eq('endpoint', endpoint).limit(1);
    if (error) return null;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return null;
  }
}

type SaveResult = 'ok' | 'signed-out' | 'unsupported' | 'failed';

async function save(sub: PushSubscription, enabled: boolean, follows: DeviceFollow[], uid: string): Promise<SaveResult> {
  const keys = sub.toJSON().keys ?? {};
  try {
    const client = await getFreshAuthedClient();
    if (!client) return 'signed-out';
    const { data, error } = await client.rpc('save_advisor_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: keys.p256dh ?? '',
      p_auth: keys.auth ?? '',
      p_enabled: enabled,
      p_device_follows: follows.slice(0, 60),
    });
    if (error) return 'failed';
    const res = (data ?? {}) as { ok?: boolean; reason?: string };
    if (!res.ok) return res.reason === 'signed_out' ? 'signed-out' : res.reason === 'unsupported_endpoint' ? 'unsupported' : 'failed';
    writeLocalPush({ uid, endpoint: sub.endpoint, sig: pushSignature(enabled, follows), savedAt: Date.now() });
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** Re-save an existing subscription (the Alerts toggle, rooms added by code, a refresh). */
export async function resavePush(enabled: boolean, follows: DeviceFollow[], uid: string): Promise<SaveResult> {
  const sub = await currentSubscription();
  if (!sub) return 'failed';
  return save(sub, enabled, follows, uid);
}

export type EnableResult = SaveResult | 'denied';

/**
 * Turn alerts on. MUST be called from the tap itself: the permission prompt is the first
 * thing it does, before any other await, as Safari requires.
 */
export async function enablePush(opts: {
  uid: string;
  enabled: boolean;
  follows: DeviceFollow[];
  local: WorkerLocalData;
}): Promise<EnableResult> {
  let permission: NotificationPermission = Notification.permission;
  if (permission !== 'granted') {
    try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; }
  }
  if (permission !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE, updateViaCache: 'none' });
    await activated(reg);
    const appKey = keyBytes(VAPID_PUBLIC_KEY);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options.applicationServerKey, appKey)) {
      // Made with another server key (the keys were rotated): start again.
      try { await sub.unsubscribe(); } catch { /* replaced below anyway */ }
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    if (!endpointSupported(sub.endpoint)) {
      try { await sub.unsubscribe(); } catch { /* nothing to keep */ }
      return 'unsupported';
    }
    await writeWorkerLocal(opts.local);
    const saved = await save(sub, opts.enabled, opts.follows, opts.uid);
    if (saved !== 'ok') return saved;
    // A first notification at once, from this phone: it proves the alerts show here.
    try {
      await reg.showNotification(opts.local.templates.test_title, {
        body: opts.local.templates.test_body,
        tag: 'gavelling-advisor|test',
        icon: '/android-chrome-192x192.png',
        badge: '/gavelling-mark.png',
        lang: opts.local.lang,
        dir: opts.local.dir,
      });
    } catch { /* the save is what matters */ }
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** Turn alerts off on this phone: the browser subscription goes whatever happens; the
 *  server row is deleted when it can be (a push to a dropped subscription answers 410 and
 *  the server forgets it anyway). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (sub) {
    try {
      const client = await getFreshAuthedClient();
      if (client) await client.rpc('delete_advisor_push_subscription', { p_endpoint: sub.endpoint });
    } catch { /* the 410 cleans it up */ }
    try { await sub.unsubscribe(); } catch { /* already gone */ }
  }
  writeLocalPush(null);
  await clearWorkerLocal();
}

function activated(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return Promise.resolve();
  const worker = reg.installing ?? reg.waiting;
  if (!worker) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { if (worker.state === 'activated' || worker.state === 'redundant') { worker.removeEventListener('statechange', done); resolve(); } };
    worker.addEventListener('statechange', done);
    window.setTimeout(resolve, 8000);
  });
}
