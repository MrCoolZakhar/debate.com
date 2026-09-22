'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { Committee, type ChatMessage } from '@/lib/types';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { sendMessage as sendMessageToDB } from '@/lib/committeeService';
import { markDelegateActivity } from '@/lib/delegateIdle';
import {
  buildChatDirectory,
  chatConvUnread,
  chatIncomingCount,
  encodeGroupDef,
  encodeGroupEdit,
  groupConvKey,
  isGroupKey,
  parseChatGroups,
  GROUP_DEF_RECIPIENT,
  GROUP_NAME_MAX,
  type ChatConvKey,
  type ChatDirectoryEntry,
  type ChatEntryKind,
} from '@/lib/chatConversations';
import {
  useOutbox, addOutbox, markOutboxFailed, markOutboxSending,
  reconcileOutbox, newOutboxId, type OutboxMsg,
} from '@/lib/chatOutbox';
import { setViewingChatConversation, clearViewingChatConversation } from '@/lib/chatViewing';
import { dismissWhere, notifyKey } from '@/lib/sessionNotifications';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import ChatConversationList, { type ConvRow } from './chat/ChatConversationList';
import ChatThread from './chat/ChatThread';
import ChatComposer, { type AttachmentDraft } from './chat/ChatComposer';
import {
  checkChatFile, encodeAttachment, readImageSize, uploadChatFile, type ChatAttachment, type UploadHandle,
} from '@/lib/chatAttachments';
import { useGifsEnabled, type GifItem } from '@/lib/gifClient';
import { delegationNameLabel, useSessionDelegationNames } from '@/lib/sessionDelegationNames';
import NewGroupSheet, { type GroupCandidate } from './chat/NewGroupSheet';
import { CHAT, type ChatThreadEvent } from './chat/chatTokens';

const LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES', fr: 'fr-FR', ar: 'ar' };

/* Two panes (list + thread) when the PANEL is at least this wide, one pane with a back button
   below it. Measured on the panel itself, not the viewport: the same component lives in a
   centred dialog on the chair laptop and in a phone-width sheet on the delegate page. */
const WIDE_PX = 640;

/** A v4 UUID: it becomes the definition row's primary key (messages.id is uuid). */
function newGroupId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  // randomUUID is missing outside a secure context (plain http on a LAN address).
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Threads where more than two people talk, so incoming bubbles carry a name and a flag. */
function isMultiParty(kind: ChatEntryKind, isChair: boolean): boolean {
  return kind === 'everyone' || kind === 'dais' || kind === 'group' || (isChair && kind === 'delegate');
}

export default function ChatPanel({
  committee,
  senderName,
  isChair = false,
  readOnly = false,
  readCounts = {},
  onReadCountsChange,
  onClose,
  embedded = false,
}: {
  committee: Committee;
  senderName: string;
  isChair?: boolean;
  /** When given, a close button sits in the list header (the chair dialog). */
  onClose?: () => void;
  readOnly?: boolean;
  readCounts?: Record<string, number>;
  onReadCountsChange?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  /** Inside a container that already has a title and a close control (the delegate sheet):
   *  the list header drops its own title and close button. */
  embedded?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const locale = LOCALES[language] ?? 'en-GB';

  const [activeConv, setActiveConv] = useState<ChatConvKey>('everyone');
  const [showThread, setShowThread] = useState(false); // one-pane: false = list, true = thread
  const [msg, setMsg] = useState('');
  // High-water mark captured when the thread was OPENED, so the "New messages" divider
  // survives the markRead that fires immediately on open.
  const [unreadAnchor, setUnreadAnchor] = useState(() => readCounts.everyone ?? 0);
  const [groupSheet, setGroupSheet] = useState(false);
  const [groupError, setGroupError] = useState(false);
  // Groups created on this device whose definition row has not come back yet.
  const [pendingGroups, setPendingGroups] = useState<ChatMessage[]>([]);
  // Group edits (rename, add members) written from this device whose row has not come back
  // yet. Folded by parseChatGroups like any edit, so the header and member list change at once.
  const [pendingEdits, setPendingEdits] = useState<ChatMessage[]>([]);
  // The "Edit group" sheet: which group, and after a refused save what was typed and picked.
  const [editSheet, setEditSheet] = useState<{ groupId: string; error: boolean; name?: string; picked?: string[] } | null>(null);

  // A photo or PDF picked in the composer (src/lib/chatAttachments.ts). One at a time.
  const [draft, setDraft] = useState<AttachmentDraft | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const uploadRef = useRef<{ id: string; handle: UploadHandle | null; attachment: ChatAttachment | null } | null>(null);
  const gifsEnabled = useGifsEnabled();

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { chairNames } = committee;

  // ── Panel width → one pane or two ────────────────────────────────────────
  const [wide, setWide] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // offsetWidth ignores transforms, so a dialog mid-scale still measures its resting width.
    setWide(el.offsetWidth >= WIDE_PX);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWide(el.offsetWidth >= WIDE_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Outbox is module-level and keyed by committee id, so in-flight and failed messages
  // survive this component unmounting (chat closing / delegate switching tab).
  const outbox = useOutbox(committee.id);

  // ── Messages, plus this device's not-yet-echoed group definitions ────────
  const messages = useMemo(
    () => (pendingGroups.length || pendingEdits.length ? [...committee.messages, ...pendingGroups, ...pendingEdits] : committee.messages),
    [committee.messages, pendingGroups, pendingEdits],
  );
  // An optimistic edit is retired when its real row (same uuid) arrives.
  useEffect(() => {
    if (pendingEdits.length === 0) return;
    const ids = new Set(committee.messages.map((m) => String(m.id)));
    const left = pendingEdits.filter((p) => !ids.has(String(p.id).slice('pending-groupedit-'.length)));
    if (left.length !== pendingEdits.length) setPendingEdits(left);
  }, [committee.messages, pendingEdits]);
  useEffect(() => {
    if (pendingGroups.length === 0) return;
    const real = parseChatGroups(committee.messages);
    const left = pendingGroups.filter((p) => {
      try { return !real.has((JSON.parse(p.content.slice('__group__:'.length)) as { id: string }).id); } catch { return false; }
    });
    if (left.length !== pendingGroups.length) setPendingGroups(left);
  }, [committee.messages, pendingGroups]);

  // ── Labels ────────────────────────────────────────────────────────────────
  const groups = useMemo(() => parseChatGroups(messages), [messages]);
  const senderLabel = useCallback(
    (name: string) => (chairNames.includes(name) ? name : getCountryDisplayName(name, language)),
    [chairNames, language],
  );
  const labelFor = useCallback((key: string): string => {
    if (key === 'everyone') return t('chat_everyone');
    if (key === 'chairs') return t('chat_chairs_label');
    if (isGroupKey(key)) return groups.get(key.slice('group:'.length))?.name ?? key;
    return senderLabel(key);
  }, [t, groups, senderLabel]);

  // ── Who is in the seat (conference sessions, chair devices only) ─────────
  // src/lib/sessionDelegationNames.ts: one chair-gated read per session, shared with
  // Settings → People. Null everywhere else, so a standalone room and every delegate phone
  // render exactly as before.
  const delegationNames = useSessionDelegationNames(committee, isChair);
  /** The allocated person behind a delegation key, or '' when there is none to show. */
  const personFor = useCallback((key: string): string => {
    if (!delegationNames) return '';
    if (key === 'everyone' || key === 'chairs' || isGroupKey(key) || chairNames.includes(key)) return '';
    return delegationNameLabel(delegationNames, key);
  }, [delegationNames, chairNames]);

  // ── The directory ─────────────────────────────────────────────────────────
  const delegations = useMemo(() => committee.delegates.map((d) => d.country), [committee.delegates]);
  const outboxActivity = useMemo(() => {
    const out: Record<string, number> = {};
    for (const o of outbox) {
      const ts = new Date(o.timestamp).getTime();
      const k = String(o.convKey);
      if (out[k] == null || ts > out[k]) out[k] = ts;
    }
    return out;
  }, [outbox]);

  const directory = useMemo<ChatDirectoryEntry[]>(() => buildChatDirectory({
    messages,
    senderName,
    isChair,
    chairNames,
    delegations,
    extraActivity: outboxActivity,
    compare: (a, b) => compareCountryNames(labelFor(a), labelFor(b), language),
  }), [messages, senderName, isChair, chairNames, delegations, outboxActivity, labelFor, language]);

  const activeEntry = directory.find((c) => c.key === activeConv) ?? directory[0];
  const activeKey = activeEntry?.key ?? 'everyone';
  const activeOutbox = useMemo(() => outbox.filter((p) => p.convKey === activeKey), [outbox, activeKey]);

  // ── Retire outbox bubbles as their real rows arrive ───────────────────────
  // reconcileOutbox tracks seen ids itself, at module scope: only ids new to this committee
  // count, and each retires AT MOST ONE entry (RC5).
  useEffect(() => {
    reconcileOutbox(committee.id, committee.messages);
  }, [committee.messages, committee.id]);

  // ── Is the active thread actually on screen? ─────────────────────────────
  // In one-pane mode the panel opens on the LIST. Read-state and banner suppression key off
  // this, never off `activeConv` alone, so a badge is not cleared while the user reads the list.
  const threadVisible = wide === true || showThread;

  // ── Read state ────────────────────────────────────────────────────────────
  const markRead = useCallback((entry: ChatDirectoryEntry) => {
    if (!onReadCountsChange) return;
    const incoming = chatIncomingCount({ key: entry.key, messages: entry.messages }, senderName);
    onReadCountsChange((prev) => (prev[entry.key] === incoming ? prev : { ...prev, [entry.key]: incoming }));
  }, [onReadCountsChange, senderName]);

  // Re-marks on EVERY change to the visible thread's incoming count, so a message that lands
  // while the user is reading it never leaves a badge behind.
  const activeIncoming = activeEntry ? chatIncomingCount({ key: activeEntry.key, messages: activeEntry.messages }, senderName) : 0;
  useEffect(() => {
    if (!threadVisible || !activeEntry) return;
    markRead(activeEntry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntry?.key, activeIncoming, threadVisible]);

  // ── Tell the notification producers which thread is on screen ────────────
  // See src/lib/chatViewing.ts. Any banner already raised for it is cleared on view.
  const visibleKey = threadVisible ? activeKey : null;
  useEffect(() => {
    setViewingChatConversation(committee.id, visibleKey);
    if (visibleKey != null) dismissWhere(notifyKey.chatConversation(String(visibleKey)));
  }, [committee.id, visibleKey, activeIncoming]);
  useEffect(() => () => clearViewingChatConversation(committee.id), [committee.id]);

  // ── Sending ───────────────────────────────────────────────────────────────
  const chairSuffix = isChair ? (committee.dbChairJoinSuffix ?? undefined) : undefined;
  const deliver = useCallback(async (entry: OutboxMsg) => {
    // RLS write-gate: this must keep going through sendMessage's sessionClient(code,
    // chairSuffix) routing with unchanged headers.
    const ok = await sendMessageToDB(
      committee.id, entry.sender, entry.content, committee.code, chairSuffix,
      entry.isPrivate, entry.recipient,
    );
    if (!ok) markOutboxFailed(committee.id, entry.id);
  }, [committee.id, committee.code, chairSuffix]);

  /** Queue one message into the outbox and deliver it to the active conversation. */
  const sendContent = (content: string) => {
    if (!activeEntry) return;
    let isPrivate = false;
    let recipient: string | undefined;
    if (activeKey === 'chairs') { isPrivate = true; recipient = 'Chairs'; }
    else if (activeKey !== 'everyone') { isPrivate = true; recipient = String(activeKey); }

    const entry: OutboxMsg = {
      id: newOutboxId(),
      convKey: activeKey,
      sender: senderName,
      content,
      isPrivate,
      recipient,
      timestamp: new Date(),
      status: 'sending',
    };
    addOutbox(committee.id, entry);
    void deliver(entry);
  };

  const discardDraft = useCallback(() => {
    uploadRef.current?.handle?.abort();
    uploadRef.current = null;
    setDraft((d) => { if (d?.localUrl) URL.revokeObjectURL(d.localUrl); return null; });
  }, []);
  // Abort an upload still running when the chat closes.
  useEffect(() => () => { uploadRef.current?.handle?.abort(); }, []);

  const handleSend = () => {
    if (readOnly || !activeEntry) return;
    const content = msg.trim();
    const ready = draft?.status === 'ready' ? uploadRef.current?.attachment : null;
    if (draft && !ready) return; // still uploading (or failed): Send stays disabled
    if (!content && !ready) return;
    // Counts as activity for the delegate idle logout. A no-op on every other surface.
    markDelegateActivity();
    if (ready) {
      sendContent(encodeAttachment(ready));
      uploadRef.current = null;
      setDraft((d) => { if (d?.localUrl) URL.revokeObjectURL(d.localUrl); return null; });
    }
    // A caption goes as its own message right after the file.
    if (content) sendContent(content);
    setMsg('');
    setAttachError(null);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const handlePickFile = async (file: File) => {
    if (readOnly) return;
    markDelegateActivity();
    const check = checkChatFile(file);
    if (!check.ok) {
      setAttachError(t(check.reason === 'size' ? 'chat_attach_too_big' : 'chat_attach_bad_type'));
      return;
    }
    discardDraft();
    setAttachError(null);
    const id = newOutboxId();
    const localUrl = check.kind === 'image' ? URL.createObjectURL(file) : undefined;
    uploadRef.current = { id, handle: null, attachment: null };
    setDraft({ id, kind: check.kind, name: file.name, size: file.size, localUrl, progress: 0, status: 'uploading' });

    const dims = check.kind === 'image' ? await readImageSize(file) : null;
    if (uploadRef.current?.id !== id) return; // removed while measuring
    const handle = uploadChatFile(committee.id, file, (f) => {
      if (uploadRef.current?.id !== id) return;
      setDraft((d) => (d && d.id === id ? { ...d, progress: f } : d));
    });
    uploadRef.current.handle = handle;
    const res = await handle.promise;
    if (uploadRef.current?.id !== id) return; // removed or replaced meanwhile
    if (!res) {
      uploadRef.current.handle = null;
      setDraft((d) => (d && d.id === id ? { ...d, status: 'failed' } : d));
      return;
    }
    uploadRef.current.attachment = {
      kind: check.kind, url: res.url, name: file.name,
      mime: file.type || 'application/pdf', size: file.size,
      width: dims?.width, height: dims?.height,
    };
    setDraft((d) => (d && d.id === id ? { ...d, progress: 1, status: 'ready' } : d));
  };

  const handleSendGif = (g: GifItem) => {
    if (readOnly || !activeEntry) return;
    markDelegateActivity();
    sendContent(encodeAttachment({
      kind: 'gif', url: g.original.url, preview: g.send.url, name: g.title || 'GIF',
      width: g.send.width, height: g.send.height,
    }));
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const handleRetry = useCallback((outboxId: string) => {
    const entry = outbox.find((o) => o.id === outboxId);
    if (!entry) return;
    markOutboxSending(committee.id, outboxId);
    void deliver({ ...entry, status: 'sending' });
  }, [outbox, committee.id, deliver]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const selectConv = useCallback((key: ChatConvKey) => {
    setUnreadAnchor(readCounts[key] ?? 0);
    setActiveConv(key);
    setShowThread(true);
    const entry = directory.find((c) => c.key === key);
    if (entry) markRead(entry);
  }, [readCounts, directory, markRead]);

  // ── Groups ────────────────────────────────────────────────────────────────
  const groupCandidates = useMemo<GroupCandidate[]>(() => {
    const dels = committee.delegates
      .map((d) => d.country)
      .filter((c) => c !== senderName && !chairNames.includes(c))
      .sort((a, b) => compareCountryNames(a, b, language))
      .map((c) => ({ key: c, label: getCountryDisplayName(c, language), sublabel: personFor(c), isChair: false }));
    // A delegation talks to the dais as a whole, never to one named chair (same rule as DMs).
    const chairs = isChair ? chairNames.filter((n) => n && n !== senderName).map((n) => ({ key: n, label: n, isChair: true })) : [];
    return [...chairs, ...dels];
  }, [committee.delegates, chairNames, senderName, isChair, language, personFor]);

  const createGroup = useCallback(async (name: string, picked: string[]) => {
    const id = newGroupId();
    const members = Array.from(new Set([senderName, ...picked]));
    const content = encodeGroupDef({ id, name, members, by: senderName });
    const key = groupConvKey(id);
    const pending: ChatMessage = {
      id: `pending-group-${id}`, sender: '__system__', content, timestamp: new Date(),
      isPrivate: true, recipient: GROUP_DEF_RECIPIENT,
    };
    // Optimistic: the group is listed and open at once; the row confirms it.
    setPendingGroups((p) => [...p, pending]);
    setGroupError(false);
    setGroupSheet(false);
    setUnreadAnchor(0);
    setActiveConv(key);
    setShowThread(true);
    markDelegateActivity();
    // The definition row's own id IS the group id (primary key), so no later row can claim it.
    const ok = await sendMessageToDB(committee.id, '__system__', content, committee.code, chairSuffix, true, GROUP_DEF_RECIPIENT, undefined, id);
    if (!ok) {
      setPendingGroups((p) => p.filter((x) => x.id !== pending.id));
      setActiveConv((cur) => (cur === key ? 'everyone' : cur));
      setShowThread(false);
      setGroupError(true);
      setGroupSheet(true);
    }
  }, [senderName, committee.id, committee.code, chairSuffix]);

  /** Rename and / or add members: one append-only edit row, optimistic, rolled back if refused. */
  const editGroup = useCallback(async (groupId: string, name: string, picked: string[]) => {
    const g = groups.get(groupId);
    if (!g || readOnly || !g.members.includes(senderName)) return;
    const nextName = name.trim().slice(0, GROUP_NAME_MAX) !== g.name ? name.trim().slice(0, GROUP_NAME_MAX) : undefined;
    const add = picked.filter((k) => !g.members.includes(k));
    if (!nextName && add.length === 0) { setEditSheet(null); return; }
    const rowId = newGroupId();
    const content = encodeGroupEdit({ group: groupId, name: nextName, add, by: senderName, at: new Date().toISOString() });
    const pending: ChatMessage = {
      id: `pending-groupedit-${rowId}`, sender: '__system__', content, timestamp: new Date(),
      isPrivate: true, recipient: GROUP_DEF_RECIPIENT,
    };
    setPendingEdits((p) => [...p, pending]);
    setEditSheet(null);
    markDelegateActivity();
    const ok = await sendMessageToDB(committee.id, '__system__', content, committee.code, chairSuffix, true, GROUP_DEF_RECIPIENT, undefined, rowId);
    if (!ok) {
      // Rolled back: the fold no longer sees the edit, so the old name and members return.
      setPendingEdits((p) => p.filter((x) => x.id !== pending.id));
      setEditSheet({ groupId, error: true, name: name.trim(), picked: add });
    }
  }, [groups, readOnly, senderName, committee.id, committee.code, chairSuffix]);

  // ── Rows for the list ─────────────────────────────────────────────────────
  const rows = useMemo<ConvRow[]>(() => directory.map((e) => {
    const last = e.messages[e.messages.length - 1] ?? null;
    const multi = isMultiParty(e.kind, isChair);
    const label = labelFor(String(e.key));
    const person = personFor(String(e.key));
    return {
      key: e.key,
      kind: e.kind,
      label,
      personLabel: person,
      // Searching the dais for a person by name, not only by delegation.
      search: `${label} ${person} ${String(e.key)}`.toLowerCase(),
      last,
      lastSenderLabel: !last ? '' : last.sender === senderName ? t('chat_you_prefix') : multi ? senderLabel(last.sender) : '',
      lastAt: e.lastAt,
      unread: chatConvUnread({ key: e.key, messages: e.messages }, readCounts, senderName),
      idleLine: e.kind === 'group' ? t('chat_group_member_count', { n: e.group?.members.length ?? 0 })
        : e.kind === 'everyone' ? t('chat_everyone_subtitle')
        : e.kind === 'dais' ? t('chat_dais_subtitle')
        : t('chat_no_messages'),
    };
  }), [directory, isChair, labelFor, personFor, senderName, senderLabel, readCounts, t]);

  // ── The open thread ───────────────────────────────────────────────────────
  const thread = activeEntry ? (() => {
    const kind = activeEntry.kind;
    const g = activeEntry.group;
    /** "France (Ana Pérez)" in a member list, "France" when there is no name to add. */
    const memberLabel = (m: string) => {
      if (m === senderName) return t('chat_you_prefix');
      const person = personFor(m);
      return person ? `${senderLabel(m)} (${person})` : senderLabel(m);
    };
    // A delegate thread leads with WHO is in the seat when the conference knows; the message
    // count is what a room without allocations still shows.
    const person = kind === 'delegate' ? personFor(String(activeEntry.key)) : '';
    const subtitle = kind === 'everyone' ? t('chat_everyone_subtitle')
      : kind === 'dais' ? t('chat_dais_subtitle')
      : g ? g.members.map(memberLabel).join(', ')
      : person ? person
      : activeEntry.messages.length === 1 ? t('chat_message_count_one')
      : t('chat_message_count_other').replace('{n}', String(activeEntry.messages.length));
    const info = kind === 'everyone' ? t('chat_everyone_info')
      : kind === 'group' ? t('chat_group_info')
      : isChair && kind === 'delegate' ? t('chat_dais_shared_info')
      : t('chat_thread_info');
    const intro = g ? t('chat_group_created', { name: g.by === senderName ? t('chat_you_prefix') : senderLabel(g.by) }) : undefined;
    // One system line per change: "Alice added Brazil, Chile", "Alice renamed the group to …".
    const events: ChatThreadEvent[] = [];
    if (g) {
      for (const e of g.events) {
        const mine = e.by === senderName;
        // The reader being added gets their own line ("Alice added you"); anyone added with
        // them gets the ordinary one, so no locale has to fit "you" into a list.
        if (e.added?.includes(senderName)) {
          events.push({ id: `${e.id}-add-me`, at: e.at, label: t('chat_group_event_added_me', { name: senderLabel(e.by) }) });
        }
        const others = (e.added ?? []).filter((m) => m !== senderName);
        if (others.length) {
          const members = others.map(senderLabel).join(', ');
          events.push({
            id: `${e.id}-add`, at: e.at,
            label: mine ? t('chat_group_event_added_you', { members }) : t('chat_group_event_added', { name: senderLabel(e.by), members }),
          });
        }
        if (e.name) {
          events.push({
            id: `${e.id}-name`, at: e.at,
            label: mine ? t('chat_group_event_renamed_you', { group: e.name }) : t('chat_group_event_renamed', { name: senderLabel(e.by), group: e.name }),
          });
        }
      }
    }
    return { kind, subtitle, info, intro, events };
  })() : null;

  const onePane = wide === false;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full min-h-0 overflow-hidden"
      style={{
        backgroundColor: 'var(--gv-surface, #FAF8F3)',
        ['--chat-bar' as string]: CHAT.bar,
        ['--chat-bar-shadow' as string]: CHAT.barShadow,
      } as React.CSSProperties}
    >
      {wide !== null && (!onePane || !showThread) && (
        <div
          className="relative z-10 h-full flex min-h-0"
          style={{
            width: onePane ? '100%' : 'clamp(280px, 34%, 360px)',
            flexShrink: 0,
            backgroundColor: 'var(--gv-surface, #FAF8F3)',
            boxShadow: onePane ? 'none' : `inset -1px 0 0 ${CHAT.hairline}`,
          }}
        >
          <ChatConversationList
            rows={rows}
            /* One pane: no row reads as selected while the list is up. */
            activeKey={threadVisible ? activeKey : ''}
            onSelect={selectConv}
            onNewGroup={() => { setGroupError(false); setGroupSheet(true); }}
            onClose={embedded ? undefined : onClose}
            showTitle={!embedded}
            canCreateGroup={!readOnly}
            t={t}
            locale={locale}
          />
        </div>
      )}

      {wide !== null && (!onePane || showThread) && activeEntry && thread && (
        <div className="relative z-10 flex-1 flex flex-col min-w-0 min-h-0" style={{ backgroundColor: CHAT.canvas }}>
          <ChatThread
            convKey={String(activeEntry.key)}
            kind={thread.kind}
            label={labelFor(String(activeEntry.key))}
            subtitle={thread.subtitle}
            info={thread.info}
            messages={activeEntry.messages}
            outbox={activeOutbox}
            senderName={senderName}
            chairNames={chairNames}
            multiParty={isMultiParty(thread.kind, isChair)}
            labelForSender={senderLabel}
            unreadAnchor={unreadAnchor}
            onRetry={handleRetry}
            onBack={onePane ? () => setShowThread(false) : undefined}
            intro={thread.intro}
            events={thread.events}
            onEditGroup={
              activeEntry.group && !readOnly && activeEntry.group.members.includes(senderName)
                ? () => { setGroupSheet(false); setEditSheet({ groupId: activeEntry.group!.id, error: false }); }
                : undefined
            }
            t={t}
            locale={locale}
          />
          <ChatComposer
            ref={inputRef}
            value={msg}
            onChange={setMsg}
            onSend={handleSend}
            readOnly={readOnly}
            t={t}
            draft={draft}
            onPickFile={(f) => { void handlePickFile(f); }}
            onRemoveDraft={discardDraft}
            attachError={attachError}
            gifsEnabled={gifsEnabled}
            onSendGif={handleSendGif}
            lang={language}
          />
        </div>
      )}

      {groupSheet && !readOnly && (
        <NewGroupSheet
          candidates={groupCandidates}
          onCancel={() => { setGroupSheet(false); setGroupError(false); }}
          onCreate={createGroup}
          busy={false}
          error={groupError}
          t={t}
        />
      )}

      {editSheet && !readOnly && groups.get(editSheet.groupId) && (() => {
        const g = groups.get(editSheet.groupId)!;
        return (
          <NewGroupSheet
            key={`edit-${g.id}-${editSheet.error ? 'retry' : 'open'}`}
            mode="edit"
            initialName={editSheet.name ?? g.name}
            currentName={g.name}
            initialPicked={editSheet.picked}
            // The DM rules decide who may be added, minus whoever is already in.
            candidates={groupCandidates.filter((c) => !g.members.includes(c.key))}
            onCancel={() => setEditSheet(null)}
            onCreate={(name, picked) => { void editGroup(g.id, name, picked); }}
            busy={false}
            error={editSheet.error}
            t={t}
          />
        );
      })()}
    </div>
  );
}
