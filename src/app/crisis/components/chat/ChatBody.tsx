'use client';
// Gavelling Crisis chat: the conversations of one character. A list on the left and the open
// thread on the right (one pane with a back button on phones). "New chat" replaces the list with
// a character picker. Used inside the dialog and, for non-staff, on the Messages page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, MessageCircle, Search, Send, SquarePen, TriangleAlert } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, sendMessage } from '@/lib/crisis/api';
import type { CrisisMessage } from '@/lib/crisis/types';
import { Btn, CK, Skeleton, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import {
  Avatar, BUBBLE_MINE, buildThreads, cabinetLabel, clock, dayLabel, fullStamp, iconBtn, isUnreadFor, markRead, msTime,
  sameDay, stamp, useChatData, useReadMarks, type Person,
} from './chatKit';

interface Outgoing { id: string; to: string; body: string; at: string; state: 'sending' | 'failed' }

const UNKNOWN = (id: string): Person => ({ id, name: 'Unknown character', cabinetId: null, status: 'active', title: null, pictureUrl: null });
const ownerOf = (m: CrisisMessage, me: string) => m.from_character_id === me;

export default function ChatBody({ initialCharacterId = null }: { initialCharacterId?: string | null }) {
  const { ref, characterId, memberId, cabinetId, settings } = useCrisis();
  const { messages, error, people, cabinets, reload, addLocal, retry } = useChatData();
  const who = memberId ?? characterId ?? 'me';
  const marks = useReadMarks(ref.id, who);

  const [openId, setOpenId] = useState<string | null>(initialCharacterId);
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [search, setSearch] = useState('');
  const [pickSearch, setPickSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t); }, []);

  const threads = useMemo(() => (characterId ? buildThreads(messages ?? [], characterId) : []), [messages, characterId]);
  const personOf = useCallback((id: string): Person => people.get(id) ?? UNKNOWN(id), [people]);
  const threadMessages = useMemo(() => threads.find((t) => t.otherId === openId)?.messages ?? [], [threads, openId]);
  const openOut = useMemo(() => outbox.filter((o) => o.to === openId), [outbox, openId]);

  // Opening a thread reads it; so does a message that arrives while it is open.
  const latestIncoming = useMemo(() => {
    let t = 0;
    for (const m of threadMessages) if (characterId && m.to_character_id === characterId && m.status === 'sent') t = Math.max(t, msTime(m.created_at));
    return t;
  }, [threadMessages, characterId]);
  useEffect(() => {
    if (openId && latestIncoming > (marks[openId] ?? 0)) markRead(ref.id, who, openId, latestIncoming);
  }, [openId, latestIncoming, marks, ref.id, who]);

  // Keep the newest message in view unless the reader scrolled up.
  const itemCount = threadMessages.length + openOut.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [itemCount, openId]);

  useEffect(() => {
    stickRef.current = true;
    if (openId && window.matchMedia('(min-width: 768px)').matches) areaRef.current?.focus();
  }, [openId]);

  const draft = openId ? drafts[openId] ?? '' : '';
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft, openId]);

  const send = useCallback(async (to: string, body: string, retryId?: string) => {
    const id = retryId ?? `out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setOutbox((o) => (retryId
      ? o.map((x) => (x.id === id ? { ...x, state: 'sending' } : x))
      : [...o, { id, to, body, at: new Date().toISOString(), state: 'sending' }]));
    stickRef.current = true;
    try {
      const r = await sendMessage(ref, to, body);
      if (!r.ok) {
        setOutbox((o) => o.map((x) => (x.id === id ? { ...x, state: 'failed' } : x)));
        notifyErr('Chat is off in this crisis', 'crisis-chat-send');
        return;
      }
      addLocal({
        id: r.id, crisis_id: ref.id, from_member_id: memberId, from_character_id: characterId, to_character_id: to,
        body, status: r.status, decided_by: null, created_at: new Date().toISOString(),
      });
      setOutbox((o) => o.filter((x) => x.id !== id));
      void reload();
    } catch (e) {
      setOutbox((o) => o.map((x) => (x.id === id ? { ...x, state: 'failed' } : x)));
      notifyErr(crisisError(e, 'Could not send the message. It is kept, try again.'), 'crisis-chat-send');
    }
  }, [ref, memberId, characterId, addLocal, reload]);

  const submit = () => {
    if (!openId) return;
    const body = (drafts[openId] ?? '').trim();
    if (!body) return;
    setDrafts((d) => ({ ...d, [openId]: '' }));
    void send(openId, body);
  };

  if (!characterId) {
    return <p style={{ margin: 0, padding: 20, fontSize: 14, color: CK.inkSoft }}>Chat is for delegates. Only people with a character can write to other characters.</p>;
  }

  // ───── list ─────
  const q = search.trim().toLowerCase();
  const rows = threads.filter((t) => {
    if (!q) return true;
    const p = personOf(t.otherId);
    const cab = p.cabinetId ? cabinets.get(p.cabinetId) : undefined;
    return `${p.name} ${cab?.name ?? ''} ${cab?.short_name ?? ''}`.toLowerCase().includes(q) || t.messages.some((m) => m.body.toLowerCase().includes(q));
  });
  const showDraftRow = !!openId && !threads.some((t) => t.otherId === openId) && !q;

  const renderRow = (otherId: string, last: CrisisMessage | null) => {
    const p = personOf(otherId);
    const cab = p.cabinetId ? cabinets.get(p.cabinetId) : undefined;
    const sel = otherId === openId;
    const unread = !sel && !!last && threads.find((t) => t.otherId === otherId)?.messages.some((m) => isUnreadFor(m, characterId, marks));
    const preview = last ? `${ownerOf(last, characterId) ? 'You: ' : ''}${last.body.replace(/\s+/g, ' ')}` : 'No messages yet';
    return (
      <li key={otherId} style={{ margin: '2px 0' }}>
        <button onClick={() => setOpenId(otherId)} aria-current={sel}
          className="w-full text-left flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ gap: 10, border: 0, borderRadius: 12, padding: '8px 10px', cursor: 'pointer', fontFamily: CK.font, color: CK.ink,
            background: sel ? CK.well : 'transparent', boxShadow: sel ? `inset 0 0 0 1px ${CK.hair}` : 'none' }}>
          <Avatar person={p} cabinet={cab} dim={p.status === 'dead'} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="flex items-baseline justify-between" style={{ gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: unread ? 800 : 700, overflowWrap: 'anywhere' }}>{p.name}</span>
              {last && <span title={fullStamp(last.created_at)} style={{ fontSize: 11.5, color: unread ? CK.red : CK.muted, fontWeight: unread ? 800 : 600, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{stamp(last.created_at, now)}</span>}
            </span>
            {cab && <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: cab.color, overflowWrap: 'anywhere' }}>{cabinetLabel(cab)}{p.status === 'dead' ? ' · Dead' : ''}</span>}
            <span className="flex items-center" style={{ gap: 6 }}>
              <span title={last?.body} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: unread ? CK.ink : CK.inkSoft, fontWeight: unread ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview}</span>
              {unread && <span role="img" aria-label="Unread" style={{ width: 9, height: 9, borderRadius: '50%', background: CK.red, flex: 'none' }} />}
            </span>
          </span>
        </button>
      </li>
    );
  };

  // ───── picker ─────
  const recipients = [...people.values()].filter((p) => p.id !== characterId && p.status !== 'spare');
  const pq = pickSearch.trim().toLowerCase();
  const groups = (() => {
    const by = new Map<string, Person[]>();
    for (const p of recipients) {
      const cab = p.cabinetId ? cabinets.get(p.cabinetId) : undefined;
      if (pq && !`${p.name} ${p.title ?? ''} ${cab?.name ?? ''} ${cab?.short_name ?? ''}`.toLowerCase().includes(pq)) continue;
      const key = p.cabinetId ?? '';
      const list = by.get(key);
      if (list) list.push(p); else by.set(key, [p]);
    }
    const keys = [...by.keys()].sort((a, b) => {
      if (a === cabinetId) return -1;
      if (b === cabinetId) return 1;
      return (cabinets.get(a)?.sort ?? 999) - (cabinets.get(b)?.sort ?? 999);
    });
    return keys.map((k) => ({ cab: cabinets.get(k), list: (by.get(k) ?? []).sort((x, y) => x.name.localeCompare(y.name)) }));
  })();

  const chatOff = settings.messages === 'off';
  const openPerson = openId ? personOf(openId) : null;
  const openCab = openPerson?.cabinetId ? cabinets.get(openPerson.cabinetId) : undefined;
  const dead = openPerson?.status === 'dead';

  // ───── thread ─────
  type Item = { key: string; at: string; m?: CrisisMessage; o?: Outgoing };
  const items: Item[] = [
    ...threadMessages.map((m) => ({ key: m.id, at: m.created_at, m })),
    ...openOut.map((o) => ({ key: o.id, at: o.at, o })),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]" style={{ height: '100%', minHeight: 0 }}>
      {/* Left pane */}
      <div className={`${openId ? 'hidden md:flex' : 'flex'} flex-col`} style={{ minHeight: 0, borderRight: `1px solid ${CK.hair}` }}>
        {mode === 'new' ? (
          <>
            <div className="flex items-center" style={{ gap: 6, padding: '10px 10px 6px' }}>
              <button onClick={() => { setMode('list'); setPickSearch(''); }} aria-label="Back to chats" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={iconBtn}>
                <ArrowLeft size={18} strokeWidth={1.5} />
              </button>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>New Chat</h3>
            </div>
            <label className="relative" style={{ display: 'block', margin: '0 10px 6px' }}>
              <Search size={15} strokeWidth={1.5} aria-hidden style={{ position: 'absolute', left: 10, top: 9, color: CK.muted }} />
              <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} aria-label="Search characters" placeholder="Search characters"
                style={{ ...fieldStyle, padding: '6px 10px 6px 31px', fontSize: 13, minHeight: 30 }} />
            </label>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 6px 8px' }}>
              {recipients.length === 0 && <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: CK.muted }}>{messages === null ? 'Loading' : 'There is nobody to write to yet'}</p>}
              {recipients.length > 0 && groups.length === 0 && <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: CK.muted }}>Nobody matches that</p>}
              {groups.map((g) => (
                <section key={g.cab?.id ?? 'none'} style={{ marginBottom: 6 }}>
                  <h4 style={{ margin: '8px 10px 4px', fontSize: 12, fontWeight: 800, color: g.cab?.color ?? CK.inkSoft, overflowWrap: 'anywhere' }}>{g.cab?.name ?? 'No cabinet'}</h4>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {g.list.map((p) => {
                      const gone = p.status === 'dead';
                      return (
                        <li key={p.id}>
                          <button disabled={gone} onClick={() => { setOpenId(p.id); setMode('list'); setPickSearch(''); }}
                            className="w-full text-left flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                            style={{ gap: 10, border: 0, borderRadius: 12, padding: '7px 10px', background: 'transparent', cursor: gone ? 'not-allowed' : 'pointer', fontFamily: CK.font, color: CK.ink, opacity: gone ? 0.6 : 1 }}>
                            <Avatar person={p} cabinet={g.cab} size={34} dim={gone} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere' }}>{p.name}</span>
                              {(p.title || gone) && <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{gone ? 'Dead' : p.title}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center" style={{ gap: 8, padding: '10px 10px 6px' }}>
              <label className="relative" style={{ flex: 1, minWidth: 0 }}>
                <Search size={15} strokeWidth={1.5} aria-hidden style={{ position: 'absolute', left: 10, top: 9, color: CK.muted }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search chats" placeholder="Search chats"
                  style={{ ...fieldStyle, padding: '6px 10px 6px 31px', fontSize: 13, minHeight: 30 }} />
              </label>
              <Btn size="sm" tone="ghost" icon={<SquarePen size={14} strokeWidth={1.5} />} disabled={chatOff} title={chatOff ? 'Chat is off in this crisis' : undefined}
                onClick={() => setMode('new')}>New chat</Btn>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 6px 8px' }}>
              {messages === null && !error && (
                <div className="flex flex-col" style={{ gap: 8, padding: 4 }} aria-busy="true">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={56} r={12} />)}
                </div>
              )}
              {error && (
                <div style={{ padding: 12 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 14, color: CK.inkSoft }}>{error}</p>
                  <Btn onClick={retry}>Try again</Btn>
                </div>
              )}
              {messages !== null && rows.length === 0 && !showDraftRow && (
                <p style={{ margin: 0, padding: 16, fontSize: 14, color: CK.muted }}>{q ? 'No chats match that' : 'No chats yet. Start one with New chat'}</p>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {showDraftRow && openId && renderRow(openId, null)}
                {rows.map((t) => renderRow(t.otherId, t.last))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Right pane */}
      <div className={`${openId ? 'flex' : 'hidden md:flex'} flex-col`} style={{ minHeight: 0, minWidth: 0 }}>
        {!openId || !openPerson ? (
          <div className="flex flex-1 flex-col items-center justify-center" style={{ gap: 8, padding: 24, color: CK.muted, textAlign: 'center' }}>
            <MessageCircle size={30} strokeWidth={1.5} aria-hidden />
            <p style={{ margin: 0, fontSize: 14 }}>Pick a chat, or start a new one</p>
          </div>
        ) : (
          <>
            <div className="flex items-center" style={{ gap: 8, padding: '10px 12px', borderBottom: `1px solid ${CK.hair}` }}>
              <button onClick={() => setOpenId(null)} aria-label="Back to chats" className="md:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={iconBtn}>
                <ArrowLeft size={18} strokeWidth={1.5} />
              </button>
              <Avatar person={openPerson} cabinet={openCab} size={36} dim={dead} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, overflowWrap: 'anywhere' }}>{openPerson.name}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                  {openCab && <span style={{ color: openCab.color, fontWeight: 700 }}>{openCab.name}</span>}
                  {openCab && (openPerson.title || dead) ? ' · ' : ''}
                  {dead ? 'Dead' : openPerson.title}
                </div>
              </div>
            </div>

            <div ref={scrollRef} onScroll={(e) => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px', background: CK.surface }}>
              {items.length === 0 && <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 13.5, color: CK.muted }}>No messages yet. Say hello</p>}
              {items.map((it, i) => {
                const prev = items[i - 1];
                const newDay = !prev || !sameDay(prev.at, it.at);
                const m = it.m;
                const o = it.o;
                const mine = o ? true : m ? ownerOf(m, characterId) : false;
                const body = o ? o.body : m?.body ?? '';
                return (
                  <div key={it.key}>
                    {newDay && <div style={{ textAlign: 'center', margin: '10px 0 6px', fontSize: 11.5, fontWeight: 700, color: CK.muted }}>{dayLabel(it.at, now)}</div>}
                    <div className="flex flex-col" style={{ alignItems: mine ? 'flex-end' : 'flex-start', margin: '3px 0' }}>
                      <div title={fullStamp(it.at)} style={{
                        maxWidth: 'min(520px, 86%)', padding: '8px 12px', borderRadius: 16, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                        background: mine ? BUBBLE_MINE : CK.card, color: CK.ink, boxShadow: mine ? 'none' : CK.shadowSm,
                        borderBottomRightRadius: mine ? 5 : 16, borderBottomLeftRadius: mine ? 16 : 5,
                      }}>
                        {body}
                      </div>
                      <div className="flex items-center" style={{ gap: 6, marginTop: 2, fontSize: 11.5, color: CK.muted, fontWeight: 600 }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{clock(it.at)}</span>
                        {o?.state === 'sending' && <span className="inline-flex items-center" style={{ gap: 4 }}><Clock size={12} strokeWidth={1.5} aria-hidden />Sending</span>}
                        {o?.state === 'failed' && (
                          <>
                            <span className="inline-flex items-center" style={{ gap: 4, color: CK.danger }}><TriangleAlert size={12} strokeWidth={1.5} aria-hidden />Not sent, try again</span>
                            <button onClick={() => void send(o.to, o.body, o.id)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                              style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontWeight: 800, textDecoration: 'underline', color: CK.forest, fontSize: 11.5, fontFamily: CK.font }}>Retry</button>
                            <button onClick={() => setOutbox((x) => x.filter((y) => y.id !== o.id))} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                              style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontWeight: 800, textDecoration: 'underline', color: CK.inkSoft, fontSize: 11.5, fontFamily: CK.font }}>Discard</button>
                          </>
                        )}
                        {m && mine && m.status === 'pending' && <span className="inline-flex items-center" style={{ gap: 4 }}><Clock size={12} strokeWidth={1.5} aria-hidden />Waiting for the backroom</span>}
                        {m && mine && m.status === 'rejected' && <span className="inline-flex items-center" style={{ gap: 4, color: CK.danger }}><TriangleAlert size={12} strokeWidth={1.5} aria-hidden />Not delivered</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '10px 12px', borderTop: `1px solid ${CK.hair}`, background: CK.card }}>
              {chatOff ? (
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: CK.inkSoft }}>Chat is off in this crisis</p>
              ) : dead ? (
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{openPerson.name} is dead and cannot be messaged</p>
              ) : (
                <div className="flex items-end" style={{ gap: 8 }}>
                  <textarea ref={areaRef} rows={1} maxLength={4000} value={draft} aria-label={`Message to ${openPerson.name}`} placeholder="Write a message"
                    onChange={(e) => setDrafts((d) => ({ ...d, [openId]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
                    }}
                    style={{ ...fieldStyle, resize: 'none', maxHeight: 120, minHeight: 40, padding: '9px 12px' }} />
                  <Btn tone="green" onClick={submit} disabled={!draft.trim()} aria-label="Send message" icon={<Send size={15} strokeWidth={1.5} />} style={{ height: 40 }}>Send</Btn>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
