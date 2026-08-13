import type { ChatMessage } from './types';

// Single source of truth for how chat messages group into conversations and how
// "unread" is counted. Both ChatPanel and the parent pages (chair + delegate) use
// these helpers so the in-panel thread list and the header/tab badge never disagree.

export type ChatConvKey = 'everyone' | 'chairs' | string; // string = a country / chair name

export interface ChatConv {
  key: ChatConvKey;
  messages: ChatMessage[];
}

function isSystemLog(content: string): boolean {
  return content.startsWith('__log__:');
}

export function buildChatConversations(
  messages: ChatMessage[],
  senderName: string,
  isChair: boolean,
  chairNames: string[],
): ChatConv[] {
  const allMsgs = messages.filter((m) => !isSystemLog(m.content));

  // Everyone — public messages
  const convs: ChatConv[] = [{ key: 'everyone', messages: allMsgs.filter((m) => !m.isPrivate) }];

  // Chairs thread (delegate view only)
  if (!isChair) {
    convs.push({
      key: 'chairs',
      messages: allMsgs.filter((m) => {
        if (!m.isPrivate) return false;
        if (m.sender === senderName && m.recipient === 'Chairs') return true;
        if (chairNames.includes(m.sender) && m.recipient === senderName) return true;
        return false;
      }),
    });
  }

  // Per-partner private threads
  const partners = new Set<string>();
  // Chair partners are tracked separately: a delegate thread is shared by every chair
  // (any chair's reply shows in every chair's view), but a chair-to-chair DM is a private
  // two-person thread and must only ever appear for its two participants.
  const chairPartners = new Set<string>();
  if (isChair) {
    allMsgs.forEach((m) => {
      if (!m.isPrivate) return;
      if (m.recipient === 'Chairs' && !chairNames.includes(m.sender)) partners.add(m.sender);
      if (chairNames.includes(m.sender) && m.recipient && !chairNames.includes(m.recipient) && m.recipient !== 'Chairs') partners.add(m.recipient);
      // Chair ↔ chair DMs. The DM picker offers co-chairs, so these rows exist; without
      // this branch they matched no thread at all and were invisible forever (RC1).
      if (chairNames.includes(m.sender) && m.sender !== senderName && m.recipient === senderName) chairPartners.add(m.sender);
      if (m.sender === senderName && m.recipient && m.recipient !== 'Chairs' && chairNames.includes(m.recipient)) chairPartners.add(m.recipient);
    });
    chairPartners.forEach((p) => partners.add(p));
  } else {
    allMsgs.forEach((m) => {
      if (!m.isPrivate) return;
      if (m.sender === senderName && m.recipient && m.recipient !== 'Chairs') partners.add(m.recipient);
      if (m.recipient === senderName && !chairNames.includes(m.sender)) partners.add(m.sender);
    });
  }

  Array.from(partners).sort().forEach((partner) => {
    // Sender-scoped two-person filter — used for chair↔chair threads on the chair side and
    // for every thread on the delegate side.
    const twoPerson = (m: ChatMessage) =>
      m.isPrivate && ((m.sender === senderName && m.recipient === partner) || (m.sender === partner && m.recipient === senderName));
    const msgs = isChair
      ? (chairPartners.has(partner)
          ? allMsgs.filter(twoPerson)
          // Delegate thread: deliberately shared across the whole dais — ANY chair's reply
          // to this delegate shows in EVERY chair's view.
          : allMsgs.filter((m) => m.isPrivate && ((m.sender === partner && m.recipient === 'Chairs') || (chairNames.includes(m.sender) && m.recipient === partner))))
      : allMsgs.filter(twoPerson);
    convs.push({ key: partner, messages: msgs });
  });

  return convs;
}

// ─── Monotonic message merge (RC2) ──────────────────────────────────────────
// Realtime fetches are async and unsequenced: an earlier request can resolve last and
// clobber `messages` with a stale snapshot, deleting a just-arrived message from every
// thread. Union by id instead of replacing, so a stale snapshot can only fail to ADD a
// row — never remove one.
//
// Operates on the FULL row set, including `__system__` / `__log__:` rows. scoring.ts,
// FeedbackLogPanel and the delegate stats tab all read committee.messages and do their own
// `__log__:` filtering, so dropping system rows here would silently regress the scoreboard.
export function mergeMessagesById(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (prev.length === 0) return incoming;
  if (incoming.length === 0) return prev;

  const byId = new Map<string, ChatMessage>();
  for (const m of prev) byId.set(m.id, m);
  // The fresher server row wins for ids present in both (content/recipient edits).
  for (const m of incoming) byId.set(m.id, m);

  if (byId.size === prev.length) {
    // No new ids. Keep the existing array identity unless a row actually changed, so the
    // merge never triggers a pointless re-render of every chat surface.
    let changed = false;
    for (const m of prev) { if (byId.get(m.id) !== m) { changed = true; break; } }
    if (!changed) return prev;
  }

  const ts = (m: ChatMessage) => new Date(m.timestamp).getTime();
  return Array.from(byId.values()).sort((a, b) => {
    const d = ts(a) - ts(b);
    // Stable tiebreak on id so every view agrees on the order of same-timestamp rows.
    return d !== 0 ? d : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

// Read-state is stored per conversation key as "how many incoming (from-others)
// messages have been seen". Unread = incoming messages beyond that high-water mark.
export function chatConvUnread(conv: ChatConv, readCounts: Record<string, number>, senderName: string): number {
  const incoming = conv.messages.filter((m) => m.sender !== senderName).length;
  return Math.max(0, incoming - (readCounts[conv.key] ?? 0));
}

export function chatIncomingCount(conv: ChatConv, senderName: string): number {
  return conv.messages.filter((m) => m.sender !== senderName).length;
}

export function chatUnreadTotal(
  messages: ChatMessage[],
  senderName: string,
  isChair: boolean,
  chairNames: string[],
  readCounts: Record<string, number>,
): number {
  return buildChatConversations(messages, senderName, isChair, chairNames)
    .reduce((sum, c) => sum + chatConvUnread(c, readCounts, senderName), 0);
}
