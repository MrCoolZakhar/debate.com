/**
 * Per-reader chat read-state storage.
 *
 * Read counts are a high-water mark of RECEIVED messages per conversation, and they are
 * inherently per-identity: what chair "Alice" has read says nothing about what the delegate
 * for France has read. The key used to be `chat-read-${code}` with no identity in it, so two
 * readers sharing one browser — two chairs on one dais laptop, or a chair who also opens the
 * delegate view to check something — overwrote each other's map and resurrected unread
 * badges on threads they had already read.
 *
 * Both the chair page and the delegate page build this key, so it lives here once rather
 * than as two string templates that can drift apart.
 *
 * This module owns the KEY only. The semantics are unchanged: own messages never count
 * toward unread, and the badge still clears when a conversation is opened.
 */

export type ChatReaderRole = 'chair' | 'delegate';

export interface ChatReader {
  role: ChatReaderRole;
  /** myChairName for a chair, country for a delegate. May be empty. */
  identity: string | null | undefined;
}

/** Readers with no identity yet (chair joined without ?chairName=) share one bucket. */
const ANONYMOUS = '~anon';

/**
 * Role is part of the key on purpose: a chair may legitimately be named "France" while a
 * delegate represents France, and those two must not share a bucket.
 */
export function chatReadStorageKey(code: string, reader: ChatReader): string {
  const identity = (reader.identity ?? '').trim();
  return `chat-read-${code}-${reader.role}:${identity || ANONYMOUS}`;
}

/** The pre-identity key. Read once for migration; never written again. */
export function legacyChatReadStorageKey(code: string): string {
  return `chat-read-${code}`;
}

function parse(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, number>;
  } catch {
    return null;
  }
}

/**
 * Returns the stored read-state for this reader, or null when there is none.
 *
 * MIGRATION: when this reader has no entry yet, the pre-identity value is adopted (copied
 * forward, not moved). Orphaning it would give every existing user one burst of phantom
 * unread badges covering the entire backlog of every committee they are in; adopting it
 * reproduces exactly what that browser displayed before the change. The legacy key is left
 * in place so a second identity in the same browser inherits the same starting point rather
 * than getting the full-backlog burst — the shared blob was already what both of them saw,
 * so nothing gets worse, and from the first save onward the two identities diverge into
 * their own keys and never collide again.
 */
export function loadChatReadCounts(code: string, reader: ChatReader): Record<string, number> | null {
  if (typeof window === 'undefined' || !code) return null;
  try {
    const own = parse(window.localStorage.getItem(chatReadStorageKey(code, reader)));
    if (own) return own;
    return parse(window.localStorage.getItem(legacyChatReadStorageKey(code)));
  } catch {
    return null;
  }
}

export function saveChatReadCounts(code: string, reader: ChatReader, counts: Record<string, number>): void {
  if (typeof window === 'undefined' || !code) return;
  try {
    window.localStorage.setItem(chatReadStorageKey(code, reader), JSON.stringify(counts));
  } catch {}
}
