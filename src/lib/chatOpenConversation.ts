// chatOpenConversation.ts — which conversation a chat panel has open, and the text typed
// into it, kept OUTSIDE ChatPanel (prompt 116, 12 Oct 2026).
//
// "A new chat closes after one letter" (the owner's simulation, room RAAGKK, 10 Oct 2026):
// the open conversation, the one-pane "thread or list" flag and the unsent text lived only
// in ChatPanel's own state, so anything that unmounted and mounted it again (or made the
// chosen key miss the directory for one render) dropped the reader back to the list or to
// Everyone with the text gone. This store survives that, like src/lib/chatOutbox.ts does
// for messages in flight, keyed by committee id and the reader's name.
//
// It is forgotten when the chat really CLOSES: ChatPanel's unmount schedules the clear on
// the next task, and a mount of the same panel (a remount in the same commit, or React's
// development double effect) cancels it. So closing the sheet or the dialog opens Chat on
// the list next time, as before, and a remount changes nothing on screen.

import type { ChatConvKey } from './chatConversations';

export interface ChatOpenState {
  /** The conversation that is open (or selected, in two panes). */
  key: ChatConvKey;
  /** One pane: true = the thread is showing, false = the list. */
  showThread: boolean;
  /** The unsent text, which belongs to `key` only. */
  text: string;
}

const store = new Map<string, ChatOpenState>();
const pendingClear = new Map<string, ReturnType<typeof setTimeout>>();

export function chatOpenKey(committeeId: string, reader: string): string {
  return `${committeeId}|${reader}`;
}

export function readChatOpen(id: string): ChatOpenState | null {
  return store.get(id) ?? null;
}

export function writeChatOpen(id: string, state: ChatOpenState): void {
  store.set(id, state);
}

/** The panel mounted: keep what was there (it was only a remount). */
export function claimChatOpen(id: string): void {
  const t = pendingClear.get(id);
  if (t) { clearTimeout(t); pendingClear.delete(id); }
}

/** The panel unmounted: forget the open conversation unless it mounts again straight away. */
export function releaseChatOpen(id: string): void {
  const prev = pendingClear.get(id);
  if (prev) clearTimeout(prev);
  pendingClear.set(id, setTimeout(() => { pendingClear.delete(id); store.delete(id); }, 0));
}
