// ============================================================================
// supabase-functions/advisor-push/index.ts   (Deno edge function, a DRAFT: not deployed)
//
// Sends the faculty advisor board's web push alerts (23 Oct 2026, owner-approved).
// Deploy as the edge function `advisor-push` with verify_jwt = false (it is called only
// by pg_cron through public.advisor_push_kick(), which carries the DB-held
// `x-cron-secret`; anything without it gets 403, failing closed, CLAUDE.md §6).
// Steps and secrets: docs/sessions/advisor-push.md. The SQL: scratch-advisor-push.sql.
//
// What it does, nothing more:
//   1. checks x-cron-secret against public.internal_secrets (cron_edge_secret);
//   2. claims queued pushes (advisor_push_claim), at most 3 rounds of 100;
//   3. encrypts each payload for its subscription (RFC 8291, aes128gcm) and signs a VAPID
//      JWT (RFC 8292, ES256), then POSTs it to the browser vendor's push service: the
//      endpoint the browser gave, already limited by the database to FCM, Mozilla, Apple
//      and WNS. TTL 120 s (a late "speaks next" is useless), Urgency high, and a Topic per
//      delegation seat so a phone that was offline gets only the newest one;
//   4. reports every status back (advisor_push_report): 2xx sent, 404 / 410 deletes the
//      subscription, anything else is retried and counted.
//
// No third-party push SDK and no imports at all: Web Crypto and fetch only, so there is
// no version to pin and the file also type-checks inside the Next.js project.
//
// Secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY   base64url, the raw 65-byte P-256 public key (the same value as the
//                      site's NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY  base64url, the raw 32-byte private scalar
//   VAPID_SUBJECT      optional, default mailto:wearegavelling@gmail.com
//   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
// ============================================================================

interface DenoLike {
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  env: { get(name: string): string | undefined };
}
const DenoRt = (globalThis as unknown as { Deno?: DenoLike }).Deno;
const env = (name: string): string => DenoRt?.env.get(name) ?? '';

const TTL_SECONDS = 120;
const CLAIM_BATCH = 100;
const CLAIM_ROUNDS = 3;
const SEND_CONCURRENCY = 10;
const SEND_TIMEOUT_MS = 10_000;

// ── Bytes ───────────────────────────────────────────────────────────────────

type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const utf8 = (s: string): Bytes => {
  const src = encoder.encode(s);
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
};

export function concatBytes(...parts: (Uint8Array | number[])[]): Bytes {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Bytes {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

// ── RFC 8291: message encryption for Web Push (aes128gcm, one record) ───────

export async function encryptPayload(plaintext: Bytes, uaPublic: Bytes, authSecret: Bytes): Promise<Bytes> {
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('bad subscription keys');
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  // IKM = HKDF(salt = auth_secret, ikm = ecdh_secret, info = "WebPush: info\0" || ua || as, 32)
  const prkKey = await hmac(authSecret, ecdhSecret);
  const ikm = await hmac(prkKey, concatBytes(utf8('WebPush: info'), [0], uaPublic, asPublic, [1]));

  // CEK / NONCE = HKDF(salt, IKM, "Content-Encoding: aes128gcm\0" / "Content-Encoding: nonce\0")
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concatBytes(utf8('Content-Encoding: aes128gcm'), [0], [1]))).slice(0, 16);
  const nonce = (await hmac(prk, concatBytes(utf8('Content-Encoding: nonce'), [0], [1]))).slice(0, 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record: the data, then the 0x02 last-record delimiter (no extra padding).
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concatBytes(plaintext, [2])));

  // Header: salt (16) | record size (4, big endian) | key id length (1) | key id = as_public (65)
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = 65;
  return concatBytes(header, asPublic, ciphertext);
}

// ── RFC 8292: VAPID ─────────────────────────────────────────────────────────

export interface VapidSigner {
  publicKey: string;
  authorization(endpoint: string): Promise<string>;
}

export async function vapidSigner(publicKeyB64: string, privateKeyB64: string, subject: string): Promise<VapidSigner> {
  const pub = b64urlDecode(publicKeyB64);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY must be a raw uncompressed P-256 key');
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256', ext: false,
    x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: privateKeyB64.replace(/=+$/, ''),
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const cache = new Map<string, { token: string; exp: number }>();
  return {
    publicKey: b64urlEncode(pub),
    async authorization(endpoint: string) {
      const aud = new URL(endpoint).origin;
      const now = Math.floor(Date.now() / 1000);
      let hit = cache.get(aud);
      if (!hit || hit.exp - now < 600) {
        const exp = now + 12 * 60 * 60;
        const head = b64urlEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
        const body = b64urlEncode(utf8(JSON.stringify({ aud, exp, sub: subject })));
        // Web Crypto's ECDSA signature is already the raw r || s that JWS ES256 wants.
        const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${head}.${body}`)));
        hit = { token: `${head}.${body}.${b64urlEncode(sig)}`, exp };
        cache.set(aud, hit);
      }
      return `vapid t=${hit.token}, k=${b64urlEncode(pub)}`;
    },
  };
}

/** A Topic header (at most 32 base64url characters) for one delegation seat, so a newer
 *  push replaces one the phone has not received yet. */
async function topicFor(seat: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(seat)));
  return b64urlEncode(digest.slice(0, 24));   // 24 bytes = 32 characters
}

// ── Database (PostgREST with the service role) ──────────────────────────────

interface ClaimRow { id: number; endpoint: string; p256dh: string; auth: string; payload: Record<string, unknown> }

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await rest(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${fn} answered ${res.status}`);
  return (await res.json()) as T;
}

async function cronSecret(): Promise<string | null> {
  try {
    const res = await rest('internal_secrets?name=eq.cron_edge_secret&select=value');
    if (!res.ok) return null;
    const rows = (await res.json()) as { value?: string }[];
    return rows[0]?.value || null;
  } catch {
    return null;
  }
}

// ── Sending ─────────────────────────────────────────────────────────────────

async function sendOne(row: ClaimRow, vapid: VapidSigner): Promise<number> {
  try {
    const body = await encryptPayload(utf8(JSON.stringify(row.payload ?? {})), b64urlDecode(row.p256dh), b64urlDecode(row.auth));
    const headers: Record<string, string> = {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(TTL_SECONDS),
      Urgency: 'high',
      Authorization: await vapid.authorization(row.endpoint),
    };
    const seat = typeof row.payload?.seat === 'string' ? row.payload.seat : null;
    if (seat) headers.Topic = await topicFor(seat);
    const res = await fetch(row.endpoint, { method: 'POST', headers, body, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
    try { await res.body?.cancel(); } catch { /* nothing to read */ }
    return res.status;
  } catch {
    return 0;   // no answer: retried by advisor_push_report
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function handle(req: Request): Promise<Response> {
  const secret = await cronSecret();
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403);

  const pub = env('VAPID_PUBLIC_KEY');
  const priv = env('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return json({ error: 'vapid_not_configured' }, 500);
  let vapid: VapidSigner;
  try {
    vapid = await vapidSigner(pub, priv, env('VAPID_SUBJECT') || 'mailto:wearegavelling@gmail.com');
  } catch {
    return json({ error: 'vapid_invalid' }, 500);
  }

  const totals = { sent: 0, gone: 0, failed: 0 };
  try {
    for (let round = 0; round < CLAIM_ROUNDS; round++) {
      const rows = await rpc<ClaimRow[]>('advisor_push_claim', { p_limit: CLAIM_BATCH });
      if (!Array.isArray(rows) || rows.length === 0) break;
      const results = await mapLimit(rows, SEND_CONCURRENCY, async (r) => ({ id: r.id, status: await sendOne(r, vapid) }));
      const report = await rpc<{ ok: number; gone: number; failed: number }>('advisor_push_report', { p_results: results });
      totals.sent += report.ok ?? 0;
      totals.gone += report.gone ?? 0;
      totals.failed += report.failed ?? 0;
      if (rows.length < CLAIM_BATCH) break;
    }
  } catch (e) {
    return json({ error: 'db', detail: String(e), ...totals }, 500);
  }
  return json({ ok: true, ...totals });
}

DenoRt?.serve(handle);
