'use client';
// Gavelling Crisis: Messages between delegates and the crisis team, outside any directive (docs/crisis/sql/052).
// Staff: every delegate's thread on the left (newest first, unread marked, "To you" when a delegate wrote to them by
// name), the open thread on the right with a reply box; "Write to a delegate" starts a thread. Delegates: their one
// thread with the backroom and a "To" picker (the whole backroom, or one person on the crisis team).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Eye, MessagesSquare, Send } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr } from '@/lib/appNotify';
import { backroomContacts, crisisError, markBackroomRead, sendBackroomMessage, type BackroomContact, type BackroomMessage } from '@/lib/crisis/api';
import { serverNow } from '@/lib/serverClock';
import { ROLE_LABEL, type Character } from '@/lib/crisis/types';
import { Avatar, Btn, Card, CK, agoLabel, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { PageHeading } from '../command/setupKit';
import { useBackroomMessages, type BackroomThread } from './useBackroomMessages';
import DelegateChatsViewer from './DelegateChatsViewer';

const MAX = 2000;
const PANE_H = 'calc(100dvh - 170px)';

export default function MessagesPage() {
  const v = useCrisis();
  return v.staff ? <StaffMessages /> : <DelegateMessages />;
}

// ─────────── The crisis team ───────────

function StaffMessages() {
  // The view-only reader of delegates' chats with each other (DelegateChatsViewer) replaces the page while it is open.
  const [delegateChats, setDelegateChats] = useState(false);
  if (delegateChats) return <DelegateChatsViewer onBack={() => setDelegateChats(false)} />;
  return <StaffInbox onDelegateChats={() => setDelegateChats(true)} />;
}

function StaffInbox({ onDelegateChats }: { onDelegateChats: () => void }) {
  const { ref, core, memberId } = useCrisis();
  const box = useBackroomMessages(ref, { enabled: true, staff: true, memberId });
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const picked = params.get('c');
  const charById = useMemo(() => new Map(core.characters.map((c) => [c.id, c])), [core.characters]);
  const cabById = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c])), [core.cabinets]);
  const memberName = useCallback((id: string | null) => (id ? core.members.find((m) => m.id === id)?.display_name ?? 'Crisis team' : 'Crisis team'), [core.members]);

  const open = picked ?? box.threads[0]?.characterId ?? null;
  const thread = box.threads.find((t) => t.characterId === open) ?? null;
  const select = (id: string) => router.replace(`${pathname}?c=${id}`, { scroll: false });

  // Characters a delegate plays, for "Write to a delegate".
  const writable = useMemo(() => {
    const played = new Set(core.members.filter((m) => m.role === 'delegate' && m.character_id).map((m) => m.character_id as string));
    return core.characters.filter((c) => played.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [core.members, core.characters]);

  const unreadOpen = thread?.unread ?? 0;
  const { markLocal } = box;
  useEffect(() => {
    if (!open || unreadOpen === 0) return;
    markLocal(open);
    markBackroomRead(ref, open).catch(() => undefined);
  }, [open, unreadOpen, ref, markLocal]);

  const ch = open ? charById.get(open) ?? null : null;
  const color = (c: Character | null | undefined) => (c?.cabinet_id ? cabById.get(c.cabinet_id)?.color ?? CK.red : CK.red);

  return (
    <div style={{ fontFamily: CK.font }}>
      <PageHeading
        eyebrow="RUN"
        title="Messages"
        right={(
          <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
          <Btn tone="ghost" size="sm" onClick={onDelegateChats} icon={<Eye size={14} strokeWidth={1.6} />}>Delegate chats</Btn>
          <GSelect
            value=""
            onChange={(id) => select(id)}
            options={writable.map((c) => ({ value: c.id, label: c.name, hint: c.cabinet_id ? cabById.get(c.cabinet_id)?.name : undefined }))}
            placeholder="Write to a delegate"
            aria-label="Write to a delegate"
            searchable
            style={{ minWidth: 220 }}
            align="end"
          />
          </span>
        )}
      />
      <div className="grid gap-3.5 md:grid-cols-[minmax(260px,340px)_1fr]">
        <Card style={{ padding: 8, height: PANE_H, minHeight: 320, overflowY: 'auto' }}>
          {!box.loaded ? (
            <Skeleton />
          ) : box.threads.length === 0 ? (
            <p style={{ margin: 0, padding: 14, fontSize: 14, color: CK.inkSoft }}>No messages yet. When a delegate writes to the backroom, it shows here.</p>
          ) : box.threads.map((t) => (
            <ThreadRow key={t.characterId} t={t} ch={charById.get(t.characterId)} color={color(charById.get(t.characterId))} active={t.characterId === open} onClick={() => select(t.characterId)} />
          ))}
        </Card>
        <Card style={{ padding: 0, height: PANE_H, minHeight: 320, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!open ? (
            <Empty text="Pick a conversation, or write to a delegate." />
          ) : (
            <>
              <div className="flex items-center" style={{ gap: 10, padding: '12px 16px', borderBottom: `1px solid ${CK.hair}`, flex: 'none' }}>
                <Avatar name={ch?.name ?? '?'} src={ch?.picture_url} size={36} color={color(ch)} />
                <div style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 15, color: CK.ink, overflowWrap: 'anywhere' }}>{ch?.name ?? 'A delegate'}</b>
                  <span style={{ display: 'block', fontSize: 12, color: CK.muted, overflowWrap: 'anywhere' }}>
                    {[ch?.title, ch?.cabinet_id ? cabById.get(ch.cabinet_id)?.name : null].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
              <Thread
                messages={thread?.messages ?? []}
                mineSide="staff"
                labelFor={(m) => (m.from_staff ? memberName(m.author_member_id) : ch?.name ?? 'Delegate')}
                toLabel={(m) => (!m.from_staff && m.to_member_id ? (m.to_member_id === memberId ? 'To you' : `To ${memberName(m.to_member_id)}`) : null)}
                avatarFor={(m) => (m.from_staff ? null : { name: ch?.name ?? '?', src: ch?.picture_url ?? null, color: color(ch) })}
              />
              <Composer
                key={open}
                placeholder={`Write to ${ch?.name ?? 'the delegate'}`}
                onSend={async (body) => {
                  const r = await sendBackroomMessage(ref, body, { character: open });
                  if (r.ok) void box.reload();
                  return r;
                }}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function ThreadRow({ t, ch, color, active, onClick }: { t: BackroomThread; ch: Character | undefined; color: string; active: boolean; onClick: () => void }) {
  const unread = t.unread > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{ gap: 10, padding: '10px 10px', border: 0, borderRadius: 12, cursor: 'pointer', fontFamily: CK.font, background: active ? CK.well : 'transparent', marginBottom: 2 }}
    >
      <Avatar name={ch?.name ?? '?'} src={ch?.picture_url} size={38} color={color} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="flex items-center" style={{ gap: 6 }}>
          <b style={{ fontSize: 14, fontWeight: unread ? 800 : 700, color: CK.ink, overflowWrap: 'anywhere' }}>{ch?.name ?? 'A delegate'}</b>
          {t.toMe && <span style={{ fontSize: 11, fontWeight: 800, color: CK.red, flex: 'none' }}>To you</span>}
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: CK.muted, flex: 'none' }}>{agoLabel(t.last.created_at, serverNow())}</span>
        </span>
        <span className="flex items-center" style={{ gap: 6, marginTop: 2 }}>
          <span title={t.last.body} style={{ flex: 1, minWidth: 0, fontSize: 13, color: unread ? CK.ink : CK.inkSoft, fontWeight: unread ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.last.from_staff ? 'You: ' : ''}{t.last.body}
          </span>
          {unread && (
            <span aria-label={`${t.unread} unread`} style={{ flex: 'none', minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px', background: CK.red, color: '#FFF4E6', fontSize: 11.5, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{t.unread}</span>
          )}
        </span>
      </span>
    </button>
  );
}

// ─────────── A delegate ───────────

function DelegateMessages() {
  const { ref, memberId, characterId, core } = useCrisis();
  const box = useBackroomMessages(ref, { enabled: !!characterId, staff: false, memberId });
  const [contacts, setContacts] = useState<BackroomContact[]>([]);
  const [to, setTo] = useState<string>('all');
  useEffect(() => {
    let off = false;
    backroomContacts(ref).then((c) => { if (!off) setContacts(c); }).catch(() => undefined);
    return () => { off = true; };
  }, [ref]);
  const thread = characterId ? box.threads.find((t) => t.characterId === characterId) ?? null : null;
  const unread = thread?.unread ?? 0;
  const { markLocal } = box;
  useEffect(() => {
    if (!characterId || unread === 0) return;
    markLocal(characterId);
    markBackroomRead(ref, characterId).catch(() => undefined);
  }, [characterId, unread, ref, markLocal]);
  const ch = characterId ? core.characters.find((c) => c.id === characterId) ?? null : null;
  const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name ?? core.members.find((m) => m.id === id)?.display_name ?? 'the crisis team';
  const options = [
    { value: 'all', label: 'The whole backroom' },
    ...contacts.map((c) => ({ value: c.id, label: c.name, hint: ROLE_LABEL[c.role] })),
  ];

  return (
    <div style={{ fontFamily: CK.font }}>
      <PageHeading eyebrow="BACKROOM" title="Messages" />
      <Card style={{ padding: 0, height: PANE_H, minHeight: 360, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!characterId ? (
          <Empty text="Messages open once you have a character." />
        ) : (
          <>
            <Thread
              messages={thread?.messages ?? []}
              mineSide="delegate"
              emptyText="Write to the crisis team here when you have a question that is not a directive. Directives still go through Send a Directive."
              labelFor={(m) => (m.from_staff ? contactName(m.author_member_id) : 'You')}
              toLabel={(m) => (!m.from_staff && m.to_member_id ? `To ${contactName(m.to_member_id)}` : null)}
              avatarFor={(m) => (m.from_staff ? null : { name: ch?.name ?? 'You', src: ch?.picture_url ?? null, color: CK.red })}
            />
            <Composer
              placeholder="Write to the backroom"
              lead={(
                <span className="flex items-center" style={{ gap: 8, fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>
                  To
                  <GSelect value={to} onChange={setTo} options={options} aria-label="Send to" size="sm" style={{ minWidth: 200 }} />
                </span>
              )}
              onSend={async (body) => {
                const r = await sendBackroomMessage(ref, body, { toMember: to === 'all' ? null : to });
                if (r.ok) void box.reload();
                return r;
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}

// ─────────── Shared pieces ───────────

function Thread({ messages, mineSide, labelFor, toLabel, avatarFor, emptyText }: {
  messages: BackroomMessage[];
  mineSide: 'staff' | 'delegate';
  labelFor: (m: BackroomMessage) => string;
  toLabel: (m: BackroomMessage) => string | null;
  avatarFor: (m: BackroomMessage) => { name: string; src: string | null; color: string } | null;
  emptyText?: string;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = messages.length;
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [count]);
  if (count === 0) return <Empty text={emptyText ?? 'No messages yet.'} />;
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
      {messages.map((m) => {
        const mine = (m.from_staff ? 'staff' : 'delegate') === mineSide;
        const av = avatarFor(m);
        const to = toLabel(m);
        return (
          <div key={m.id} className="flex" style={{ justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8, marginBottom: 10 }}>
            {!mine && av && <Avatar name={av.name} src={av.src} size={28} color={av.color} style={{ marginTop: 18 }} />}
            <div style={{ maxWidth: 'min(560px, 82%)' }}>
              <span className="flex items-center" style={{ gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', fontSize: 11.5, fontWeight: 700, color: CK.muted, marginBottom: 3 }}>
                <span style={{ overflowWrap: 'anywhere' }}>{labelFor(m)}</span>
                {to && <span style={{ color: CK.red, fontWeight: 800 }}>{to}</span>}
                <span style={{ fontWeight: 500 }}>{agoLabel(m.created_at, serverNow())}</span>
              </span>
              <div style={{
                padding: '9px 13px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                background: mine ? CK.forest : CK.well, color: mine ? '#FFFFFF' : CK.ink,
                borderTopRightRadius: mine ? 4 : 14, borderTopLeftRadius: mine ? 14 : 4,
              }}>
                {m.body}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Composer({ placeholder, onSend, lead }: {
  placeholder: string;
  lead?: React.ReactNode;
  onSend: (body: string) => Promise<{ ok: true; id: string } | { ok: false; reason: 'empty' | 'too_long' | 'slow_down'; limit?: number }>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const body = text.trim();
  const send = async () => {
    if (!body || busy || body.length > MAX) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await onSend(body);
      if (r.ok) setText('');
      else if (r.reason === 'slow_down') setProblem('That is a lot of messages in a few minutes. Wait a moment, then send again. Your text is kept.');
      else if (r.reason === 'too_long') setProblem(`Messages are at most ${MAX} characters.`);
    } catch (e) {
      notifyErr(crisisError(e, 'Could not send the message. Your text is kept, try again.'));
    } finally { setBusy(false); }
  };
  return (
    <div style={{ flex: 'none', borderTop: `1px solid ${CK.hair}`, padding: 12 }}>
      {lead && <div style={{ marginBottom: 8 }}>{lead}</div>}
      <div className="flex items-end" style={{ gap: 8 }}>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setProblem(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={placeholder}
          aria-label="Message"
          maxLength={MAX}
          rows={2}
          style={{ ...fieldStyle, resize: 'none', minHeight: 48, maxHeight: 160 }}
        />
        <Btn tone="green" onClick={() => void send()} disabled={!body || busy} icon={<Send size={15} strokeWidth={1.6} />}>Send</Btn>
      </div>
      {problem && <p style={{ margin: '6px 0 0', fontSize: 13, color: CK.danger }}>{problem}</p>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid place-items-center" style={{ flex: 1, padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 360 }}>
        <MessagesSquare size={28} strokeWidth={1.4} style={{ color: CK.muted, margin: '0 auto 8px' }} aria-hidden />
        <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>{text}</p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: 6 }}>
      {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 52, borderRadius: 12, background: CK.well, marginBottom: 8 }} />)}
    </div>
  );
}
