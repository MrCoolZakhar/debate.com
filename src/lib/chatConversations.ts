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
  if (isChair) {
    allMsgs.forEach((m) => {
      if (!m.isPrivate) return;
      if (m.recipient === 'Chairs' && !chairNames.includes(m.sender)) partners.add(m.sender);
      if (chairNames.includes(m.sender) && m.recipient && !chairNames.includes(m.recipient) && m.recipient !== 'Chairs') partners.add(m.recipient);
    });
  } else {
    allMsgs.forEach((m) => {
      if (!m.isPrivate) return;
      if (m.sender === senderName && m.recipient && m.recipient !== 'Chairs') partners.add(m.recipient);
      if (m.recipient === senderName && !chairNames.includes(m.sender)) partners.add(m.sender);
    });
  }

  Array.from(partners).sort().forEach((partner) => {
    const msgs = isChair
      ? allMsgs.filter((m) => m.isPrivate && ((m.sender === partner && m.recipient === 'Chairs') || (chairNames.includes(m.sender) && m.recipient === partner)))
      : allMsgs.filter((m) => m.isPrivate && ((m.sender === senderName && m.recipient === partner) || (m.sender === partner && m.recipient === senderName)));
    convs.push({ key: partner, messages: msgs });
  });

  return convs;
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
