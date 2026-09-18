'use client';

// ── Which chat conversation is on screen right now ─────────────────────────
//
// A tiny module-level fact, published by `ChatPanel` and read by notification
// producers on the session pages. It exists because "the chat panel is open"
// is the wrong question: a chair reading the Everyone thread must still hear
// about a delegate's DM, and a chair who has the DM open must not get a banner
// for the message that just landed in front of them.
//
// Module-level rather than a prop because the reader is a realtime-driven
// effect on the page and the writer is a child component; threading it back up
// through a callback would re-render the whole chair cockpit on every thread
// switch. Nothing here writes committee state or the DB (RULES 3-5 untouched).
//
// `ChatPanel` is a child of the page, so its effects run BEFORE the page's in
// the same commit: by the time the page's chat-notification effect sees a new
// message, the viewing state for that render is already published.

import type { ChatConvKey } from './chatConversations';

let viewing: { committeeId: string; convKey: ChatConvKey } | null = null;

/** Publish the conversation whose thread is VISIBLE, or null when none is. */
export function setViewingChatConversation(committeeId: string, convKey: ChatConvKey | null): void {
  viewing = convKey == null ? null : { committeeId, convKey };
}

/** Clear only if the published state still belongs to this committee (unmount race safe). */
export function clearViewingChatConversation(committeeId: string): void {
  if (viewing?.committeeId === committeeId) viewing = null;
}

export function isViewingChatConversation(committeeId: string, convKey: ChatConvKey | null): boolean {
  return !!viewing && convKey != null && viewing.committeeId === committeeId && viewing.convKey === convKey;
}
