import type { ChatMessage } from './types';

// Single source of truth for how chat messages group into conversations and how
// "unread" is counted. Both ChatPanel and the parent pages (chair + delegate) use
// these helpers so the in-panel thread list and the header/tab badge never disagree.

export type ChatConvKey = 'everyone' | 'chairs' | string; // string = a country / chair name / `group:<id>`

export interface ChatConv {
  key: ChatConvKey;
  messages: ChatMessage[];
}

// ─── Group chats (stored in `messages`, no extra table) ─────────────────────
//
// A group is DEFINED by one row: sender `__system__`, recipient `__group__`, is_private true,
// content `__group__:{"id","name","members","by"}`. `__system__` rows are already ignored by
// every chat builder and by the scoring ledger (which also requires `__log__:`), so a
// definition never shows up as a message anywhere, on this bundle or an older one.
// A group MESSAGE is an ordinary row with recipient `group:<id>` and is_private true.
//
// The first definition row for an id wins, so a later forged row cannot rename a group or
// add members to it. Messages are shown only to members and only when their sender is a
// member.
//
// NOT PRIVATE. `messages` SELECT is `true` and every device downloads every row of its
// committee, group rows included. Membership decides what the UI shows, nothing more.

export const GROUP_DEF_PREFIX = '__group__:';
export const GROUP_DEF_RECIPIENT = '__group__';
export const GROUP_KEY_PREFIX = 'group:';
export const GROUP_NAME_MAX = 40;

export interface ChatGroupDef {
  id: string;
  name: string;
  members: string[];
  /** The creator's display name (chair name or delegation). */
  by: string;
  createdAt: Date;
}

export function isGroupKey(key: ChatConvKey | null | undefined): boolean {
  return typeof key === 'string' && key.startsWith(GROUP_KEY_PREFIX);
}

export function groupConvKey(id: string): ChatConvKey {
  return `${GROUP_KEY_PREFIX}${id}`;
}

/** Content of the definition row for a new group. */
export function encodeGroupDef(def: { id: string; name: string; members: string[]; by: string }): string {
  return GROUP_DEF_PREFIX + JSON.stringify({ id: def.id, name: def.name, members: def.members, by: def.by });
}

function parseGroupDefRow(m: ChatMessage): ChatGroupDef | null {
  if (m.recipient !== GROUP_DEF_RECIPIENT || !m.content.startsWith(GROUP_DEF_PREFIX)) return null;
  try {
    const raw = JSON.parse(m.content.slice(GROUP_DEF_PREFIX.length)) as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, GROUP_NAME_MAX) : '';
    const members = Array.isArray(raw.members)
      ? Array.from(new Set(raw.members.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())))
      : [];
    if (!/^[A-Za-z0-9-]{8,64}$/.test(id) || !name || members.length < 2) return null;
    return { id, name, members, by: typeof raw.by === 'string' ? raw.by : '', createdAt: new Date(m.timestamp) };
  } catch {
    return null;
  }
}

// Memoised on array identity, like parseLogEvents: `committee.messages` is replaced, never
// mutated (mergeMessagesById returns the previous array when nothing changed).
const groupCache = new WeakMap<ChatMessage[], Map<string, ChatGroupDef>>();

/** Every group defined in this committee, first definition per id wins. */
export function parseChatGroups(messages: ChatMessage[]): Map<string, ChatGroupDef> {
  const hit = groupCache.get(messages);
  if (hit) return hit;
  const out = new Map<string, ChatGroupDef>();
  const ts = (m: ChatMessage) => new Date(m.timestamp).getTime();
  const defs = messages.filter((m) => m.sender === '__system__' && m.recipient === GROUP_DEF_RECIPIENT)
    .sort((a, b) => ts(a) - ts(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const m of defs) {
    const def = parseGroupDefRow(m);
    if (def && !out.has(def.id)) out.set(def.id, def);
  }
  groupCache.set(messages, out);
  return out;
}

/** Groups this reader belongs to. */
export function chatGroupsFor(messages: ChatMessage[], senderName: string): ChatGroupDef[] {
  return Array.from(parseChatGroups(messages).values()).filter((g) => g.members.includes(senderName));
}

/** Rows that are never chat: the scoring ledger and group definitions. */
function isSystemLog(m: ChatMessage): boolean {
  return m.content.startsWith('__log__:') || m.recipient === GROUP_DEF_RECIPIENT || m.content.startsWith(GROUP_DEF_PREFIX);
}

function isGroupRecipient(recipient: string | undefined): boolean {
  return !!recipient && recipient.startsWith(GROUP_KEY_PREFIX);
}

export function buildChatConversations(
  messages: ChatMessage[],
  senderName: string,
  isChair: boolean,
  chairNames: string[],
): ChatConv[] {
  const allMsgs = messages.filter((m) => !isSystemLog(m));

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
      if (!m.isPrivate || isGroupRecipient(m.recipient)) return;
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
      if (!m.isPrivate || isGroupRecipient(m.recipient)) return;
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

  // Group threads this reader is a member of. Only members' messages count.
  for (const g of chatGroupsFor(messages, senderName)) {
    const key = groupConvKey(g.id);
    convs.push({
      key,
      messages: allMsgs.filter((m) => m.isPrivate && m.recipient === key && g.members.includes(m.sender)),
    });
  }

  return convs;
}

// Which conversation ONE message lands in, from this reader's point of view. Mirrors the
// routing in buildChatConversations above exactly (keep the two in step), so a notification
// can be matched against the thread that is on screen. Null = the message belongs to no
// thread this reader can see (system logs, or a DM between two other people).
// `allMessages` (the committee's rows) is needed to resolve group membership; without it a
// group message resolves to null.
export function chatConvKeyForMessage(
  m: ChatMessage,
  senderName: string,
  isChair: boolean,
  chairNames: string[],
  allMessages?: ChatMessage[],
): ChatConvKey | null {
  if (isSystemLog(m)) return null;
  if (!m.isPrivate) return 'everyone';
  if (isGroupRecipient(m.recipient)) {
    // A group row lands in the group's thread only for a member, and only from a member.
    // Without the committee's rows the group cannot be resolved, so it lands nowhere.
    const def = allMessages ? parseChatGroups(allMessages).get(String(m.recipient).slice(GROUP_KEY_PREFIX.length)) : undefined;
    if (!def || !def.members.includes(senderName) || !def.members.includes(m.sender)) return null;
    return String(m.recipient);
  }
  if (isChair) {
    if (m.recipient === 'Chairs' && !chairNames.includes(m.sender)) return m.sender;
    if (chairNames.includes(m.sender) && m.recipient && !chairNames.includes(m.recipient) && m.recipient !== 'Chairs') return m.recipient;
    if (chairNames.includes(m.sender) && m.sender !== senderName && m.recipient === senderName) return m.sender;
    if (m.sender === senderName && m.recipient && m.recipient !== 'Chairs' && chairNames.includes(m.recipient)) return m.recipient;
    return null;
  }
  if (m.sender === senderName && m.recipient === 'Chairs') return 'chairs';
  if (chairNames.includes(m.sender) && m.recipient === senderName) return 'chairs';
  if (m.sender === senderName && m.recipient && m.recipient !== 'Chairs') return m.recipient;
  if (m.recipient === senderName && !chairNames.includes(m.sender)) return m.sender;
  return null;
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
function sameMessage(a: ChatMessage | undefined, b: ChatMessage): boolean {
  if (!a) return false;
  if (a === b) return true;
  return a.id === b.id && a.content === b.content && a.sender === b.sender
    && (a.recipient ?? null) === (b.recipient ?? null) && !!a.isPrivate === !!b.isPrivate
    && new Date(a.timestamp).getTime() === new Date(b.timestamp).getTime();
}

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
    // Compared by CONTENT, not object identity: a catch-up refetch maps every row to a new
    // object, and returning a new array for identical rows invalidated the scoring memo
    // (parseLogEvents is memoised on array identity) and re-parsed the whole log.
    let changed = false;
    for (const m of prev) { if (!sameMessage(byId.get(m.id), m)) { changed = true; break; } }
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

// ─── The conversation directory (what the chat list shows) ──────────────────
//
// Every conversation the reader CAN have, not only the ones with messages, so nobody has to
// "start a new chat": Everyone, the dais (delegates only), every other delegation, every
// other chair (chairs only) and every group the reader belongs to. Who is listed follows the
// same DM rules as buildChatConversations: a delegate talks to the dais as a whole, never to
// one named chair, and delegate-to-delegate threads never appear on a chair's list.
//
// Order: Everyone pinned first; then every conversation with activity, newest first (a new
// message moves its thread to the top; a group counts from its creation); then the silent
// ones: the dais, then chairs, then delegations, each in `compare` order.

export type ChatEntryKind = 'everyone' | 'dais' | 'chair' | 'delegate' | 'group';

export interface ChatDirectoryEntry {
  key: ChatConvKey;
  kind: ChatEntryKind;
  messages: ChatMessage[];
  /** Epoch ms of the newest activity, or null for a conversation with none. */
  lastAt: number | null;
  group?: ChatGroupDef;
}

export function buildChatDirectory({
  messages,
  senderName,
  isChair,
  chairNames,
  delegations,
  extraActivity = {},
  compare = (a, b) => a.localeCompare(b),
}: {
  messages: ChatMessage[];
  senderName: string;
  isChair: boolean;
  chairNames: string[];
  /** Country names of the committee's delegations. */
  delegations: string[];
  /** Newer activity not yet in `messages` (the sender's own outbox), by conversation key. */
  extraActivity?: Record<string, number>;
  /** Tiebreak for silent conversations, by key. */
  compare?: (a: string, b: string) => number;
}): ChatDirectoryEntry[] {
  const groups = parseChatGroups(messages);
  const convs = buildChatConversations(messages, senderName, isChair, chairNames);
  const byKey = new Map<string, ChatConv>(convs.map((c) => [String(c.key), c]));

  const kindOf = (key: string): ChatEntryKind => {
    if (key === 'everyone') return 'everyone';
    if (key === 'chairs') return 'dais';
    if (isGroupKey(key)) return 'group';
    return chairNames.includes(key) ? 'chair' : 'delegate';
  };

  const keys = new Set<string>(convs.map((c) => String(c.key)));
  if (!isChair) keys.add('chairs');
  for (const d of delegations) {
    if (d && d !== senderName && !chairNames.includes(d)) keys.add(d);
  }
  if (isChair) for (const c of chairNames) if (c && c !== senderName) keys.add(c);

  const entries: ChatDirectoryEntry[] = Array.from(keys).map((key) => {
    const msgs = byKey.get(key)?.messages ?? [];
    const kind = kindOf(key);
    const group = kind === 'group' ? groups.get(key.slice(GROUP_KEY_PREFIX.length)) : undefined;
    let lastAt: number | null = msgs.length ? new Date(msgs[msgs.length - 1].timestamp).getTime() : null;
    if (group) lastAt = Math.max(lastAt ?? 0, group.createdAt.getTime());
    const extra = extraActivity[key];
    if (extra != null) lastAt = Math.max(lastAt ?? 0, extra);
    return { key, kind, messages: msgs, lastAt, group };
  });

  const silentRank: Record<ChatEntryKind, number> = { everyone: 0, dais: 1, group: 2, chair: 3, delegate: 4 };
  return entries.sort((a, b) => {
    if (a.kind === 'everyone') return -1;
    if (b.kind === 'everyone') return 1;
    if (a.lastAt != null && b.lastAt != null) return b.lastAt - a.lastAt || compare(String(a.key), String(b.key));
    if (a.lastAt != null) return -1;
    if (b.lastAt != null) return 1;
    return silentRank[a.kind] - silentRank[b.kind] || compare(String(a.key), String(b.key));
  });
}
