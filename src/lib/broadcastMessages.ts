/**
 * Organiser broadcasts as messages from the Secretariat in the Everyone chat.
 *
 * Owner, 11 Oct 2026: "previously i have mentioned for the announcements to be a separate
 * chat in sessions, revert that - instead the announcement should now live in the everyone
 * chat as a message from secretariat. make sure images also come through!"
 *
 * Every `session_broadcasts` row of the committee (src/lib/broadcastHistory.ts reads them) is
 * merged into the chat's message list AT RENDER TIME as a virtual public message:
 *   - id `bc-<broadcast uuid>`: `messages.id` is a uuid column, so no real row can collide;
 *   - sender SECRETARIAT_SENDER, never the reader, so it counts as received everywhere;
 *   - timestamp = the broadcast's `created_at`, interleaved by time with the real messages;
 *   - `broadcast` = the action and the image, which only these objects ever carry.
 * Nothing is written to `messages`. So past broadcasts appear, an organiser's Withdraw makes
 * one disappear, and nobody can post "as the Secretariat" from the chat: a real row that names
 * SECRETARIAT_SENDER has no `broadcast` field and chatConversations drops it (isSystemLog).
 *
 * Every unread count and every thread is computed over the SAME merged array
 * (withBroadcastMessages), so chatUnreadTotal, chatConvKeyForMessage, the list rows and the
 * thread cannot disagree. Pure and memoised on array identity; nothing runs per second.
 */

import type { ChatMessage } from './types';
import type { SessionBroadcast } from './committeeService';

/** The sender of every Secretariat message. Chair names may not start with `__`
 *  (src/lib/chairNameRules.ts), so no reader can ever be this sender. */
export const SECRETARIAT_SENDER = '__secretariat__';

/** Read-count key used when chat is off for the committee: the chair's chat icon then opens
 *  only the Secretariat messages, and their read state must not overwrite Everyone's. */
export const SECRETARIAT_READ_KEY = '__secretariat__';

export const BROADCAST_MESSAGE_PREFIX = 'bc-';

export const EMPTY_BROADCASTS: SessionBroadcast[] = [];

const messageCache = new WeakMap<SessionBroadcast, ChatMessage>();

/** One broadcast as a Secretariat message (the same object every time for the same row). */
export function broadcastMessage(b: SessionBroadcast): ChatMessage {
  const hit = messageCache.get(b);
  if (hit) return hit;
  const m: ChatMessage = {
    id: `${BROADCAST_MESSAGE_PREFIX}${b.id}`,
    sender: SECRETARIAT_SENDER,
    content: b.message,
    timestamp: new Date(b.createdAt),
    isPrivate: false,
    broadcast: { id: b.id, kind: b.kind, action: b.action, actionAt: b.actionAt, imageUrl: b.imageUrl },
  };
  messageCache.set(b, m);
  return m;
}

/** A Secretariat message built here (never a row from `messages`). */
export function isBroadcastMessage(m: ChatMessage): boolean {
  return !!m.broadcast && m.sender === SECRETARIAT_SENDER && String(m.id).startsWith(BROADCAST_MESSAGE_PREFIX);
}

const mergeCache = new WeakMap<ChatMessage[], WeakMap<SessionBroadcast[], ChatMessage[]>>();
const onlyCache = new WeakMap<SessionBroadcast[], ChatMessage[]>();

/**
 * The committee's messages with every broadcast interleaved by time. Returns `messages`
 * itself when there are no broadcasts. Memoised on both arrays' identity (committee.messages
 * is replaced, never mutated; useBroadcastHistory keeps its array while nothing changed).
 */
export function withBroadcastMessages(messages: ChatMessage[], broadcasts: SessionBroadcast[] | null | undefined): ChatMessage[] {
  if (!broadcasts || broadcasts.length === 0) return messages;
  let inner = mergeCache.get(messages);
  const hit = inner?.get(broadcasts);
  if (hit) return hit;

  const bcs = broadcasts.map(broadcastMessage)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || (a.id < b.id ? -1 : 1));
  // Two-pointer merge: the messages keep their own order, each broadcast goes before the
  // first message that is newer than it.
  const out: ChatMessage[] = [];
  let i = 0;
  for (const m of messages) {
    const t = new Date(m.timestamp).getTime();
    while (i < bcs.length && bcs[i].timestamp.getTime() <= t) out.push(bcs[i++]);
    out.push(m);
  }
  while (i < bcs.length) out.push(bcs[i++]);

  if (!inner) { inner = new WeakMap(); mergeCache.set(messages, inner); }
  inner.set(broadcasts, out);
  return out;
}

/** Only the Secretariat messages (chat is off: the chair still reads them). */
export function broadcastOnlyMessages(broadcasts: SessionBroadcast[] | null | undefined): ChatMessage[] {
  if (!broadcasts || broadcasts.length === 0) return [];
  const hit = onlyCache.get(broadcasts);
  if (hit) return hit;
  const out = withBroadcastMessages([], broadcasts);
  onlyCache.set(broadcasts, out);
  return out;
}

/** Unread Secretariat messages while chat is off (the chair's chat icon count). */
export function secretariatUnread(broadcasts: SessionBroadcast[] | null | undefined, readCounts: Record<string, number>): number {
  const n = broadcasts?.length ?? 0;
  return Math.max(0, n - (readCounts[SECRETARIAT_READ_KEY] ?? 0));
}
