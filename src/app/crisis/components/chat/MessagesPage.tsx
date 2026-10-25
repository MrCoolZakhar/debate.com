'use client';
// Gavelling Crisis: /messages. Staff see every conversation (grouped by pair, read only) and a lane
// of messages waiting for approval. Anyone else sees their own chat, the same body as the dialog.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, MessageSquare, Search, X } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, decideMessage } from '@/lib/crisis/api';
import type { Cabinet, CrisisMessage } from '@/lib/crisis/types';
import { Btn, Card, CK, Segmented, Skeleton, fieldStyle } from '../../crisisKit';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import ChatBody from './ChatBody';
import {
  Avatar, BUBBLE_MINE, REMOVED_PERSON, cabinetLabel, clock, dayLabel, fullStamp, iconBtn, msTime, sameDay, stamp, useChatData,
  type Person,
} from './chatKit';

interface Pair { key: string; aId: string | null; bId: string | null; messages: CrisisMessage[]; last: CrisisMessage; pending: number }

const MODE_LINE = { free: 'Chat is free', approval: 'Messages need backroom approval', off: 'Chat is off' } as const;

export default function MessagesPage() {
  const { staff, director, ref, settings } = useCrisis();
  if (!staff) return <OwnChat />;
  return <StaffMessages director={director} base={crisisBase(ref)} mode={settings.messages} />;
}

function OwnChat() {
  const { characterId, settings } = useCrisis();
  return (
    <div className="flex flex-col" style={{ gap: 10, marginTop: 6, width: '100%' }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: CK.ink }}>Messages</h1>
        <span style={{ fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>{MODE_LINE[settings.messages]}</span>
      </div>
      <Card style={{ padding: 0, overflow: 'hidden', height: 'calc(100dvh - 170px)', minHeight: 420 }}>
        {characterId ? <ChatBody /> : <p style={{ margin: 0, padding: 20, fontSize: 14, color: CK.inkSoft }}>Chat is for delegates. Only people with a character can write to other characters.</p>}
      </Card>
    </div>
  );
}

function StaffMessages({ director, base, mode }: { director: boolean; base: string; mode: keyof typeof MODE_LINE }) {
  const { ref } = useCrisis();
  const { messages, error, people, cabinets, reload, retry } = useChatData();
  const [lane, setLane] = useState<'all' | 'waiting'>('all');
  const [cabinet, setCabinet] = useState('');
  const [character, setCharacter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t); }, []);

  const personOf = (id: string | null): Person => (id ? people.get(id) ?? { ...REMOVED_PERSON, id } : REMOVED_PERSON);
  const cabOf = (p: Person) => (p.cabinetId ? cabinets.get(p.cabinetId) : undefined);

  const pairs = useMemo(() => {
    const by = new Map<string, Pair>();
    for (const m of messages ?? []) {
      const ids = [m.from_character_id, m.to_character_id];
      const key = ids.map((x) => x ?? 'removed').sort().join('|');
      let p = by.get(key);
      if (!p) { p = { key, aId: m.from_character_id, bId: m.to_character_id, messages: [], last: m, pending: 0 }; by.set(key, p); }
      p.messages.push(m);
    }
    const out = [...by.values()];
    for (const p of out) {
      p.messages.sort((a, b) => msTime(a.created_at) - msTime(b.created_at));
      p.last = p.messages[p.messages.length - 1];
      p.pending = p.messages.filter((m) => m.status === 'pending').length;
      p.aId = p.messages[0].from_character_id;
      p.bId = p.messages[0].to_character_id;
    }
    return out.sort((a, b) => msTime(b.last.created_at) - msTime(a.last.created_at));
  }, [messages]);

  const q = search.trim().toLowerCase();
  const matchesMessage = (m: CrisisMessage) => {
    const a = personOf(m.from_character_id); const b = personOf(m.to_character_id);
    if (cabinet && a.cabinetId !== cabinet && b.cabinetId !== cabinet) return false;
    if (character && m.from_character_id !== character && m.to_character_id !== character) return false;
    if (q && !`${a.name} ${b.name} ${m.body}`.toLowerCase().includes(q)) return false;
    return true;
  };
  const shownPairs = pairs.filter((p) => matchesMessage(p.last) || p.messages.some(matchesMessage));
  const waiting = (messages ?? []).filter((m) => m.status === 'pending').sort((a, b) => msTime(a.created_at) - msTime(b.created_at));
  const shownWaiting = waiting.filter(matchesMessage);

  const selected = pairs.find((p) => p.key === selectedKey) ?? null;
  if (!selected && !selectedKey && shownPairs.length && lane === 'all' && typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
    setSelectedKey(shownPairs[0].key);
  }

  const decide = async (m: CrisisMessage, approve: boolean) => {
    setBusy((s) => new Set(s).add(m.id));
    try {
      await decideMessage(ref, m.id, approve);
      notifyOk(approve ? 'Message approved' : 'Message declined', 'crisis-chat-decide');
      await reload();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save that decision.'), 'crisis-chat-decide');
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(m.id); return n; });
    }
  };

  const cabinetOptions = [{ value: '', label: 'All cabinets' }, ...[...cabinets.values()].map((c) => ({ value: c.id, label: c.name }))];
  const characterOptions = [
    { value: '', label: 'All characters' },
    ...[...people.values()].filter((p) => p.status !== 'spare').sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name })),
  ];

  const nameLine = (p: Person) => {
    const cab = cabOf(p);
    return (
      <span style={{ overflowWrap: 'anywhere' }}>
        <span style={{ fontWeight: 800 }}>{p.name}</span>
        {cab && <span style={{ color: cab.color, fontWeight: 700 }}> · {cabinetLabel(cab)}</span>}
      </span>
    );
  };

  const paneH = 'lg:h-[calc(100dvh-230px)] lg:min-h-[420px]';

  return (
    <div className="flex flex-col" style={{ gap: 10, marginTop: 6, width: '100%' }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: CK.ink }}>Messages</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: CK.inkSoft, fontWeight: 600 }}>
            {MODE_LINE[mode]}
            {director && <> <Link href={`${base}/settings`} style={{ fontWeight: 800, textDecoration: 'underline', color: CK.forest }}>Change in Settings</Link></>}
          </p>
        </div>
        <Segmented ariaLabel="Message lanes" value={lane} onChange={(v) => { setLane(v); setMobileOpen(false); }}
          options={[{ value: 'all', label: `Conversations ${pairs.length}` }, { value: 'waiting', label: `Waiting for approval ${waiting.length}` }]} />
      </div>

      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <div style={{ width: 170 }}><GSelect size="sm" aria-label="Cabinet" value={cabinet} options={cabinetOptions} onChange={setCabinet} /></div>
        <div style={{ width: 200 }}><GSelect size="sm" aria-label="Character" value={character} options={characterOptions} onChange={setCharacter} /></div>
        <label className="relative" style={{ flex: '1 1 200px', maxWidth: 360 }}>
          <Search size={15} strokeWidth={1.5} aria-hidden style={{ position: 'absolute', left: 10, top: 9, color: CK.muted }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search messages" placeholder="Search names and text"
            style={{ ...fieldStyle, padding: '6px 10px 6px 31px', fontSize: 13, minHeight: 30 }} />
        </label>
      </div>

      {messages === null && !error && (
        <Card><div className="flex flex-col" style={{ gap: 8 }} aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={60} r={12} />)}</div></Card>
      )}
      {error && (
        <Card>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: CK.inkSoft }}>{error}</p>
          <Btn onClick={retry}>Try again</Btn>
        </Card>
      )}

      {messages !== null && lane === 'waiting' && (
        <Card style={{ padding: 10 }}>
          {shownWaiting.length === 0 && <p style={{ margin: 0, padding: 12, fontSize: 14, color: CK.muted }}>{waiting.length ? 'Nothing waiting matches those filters' : 'No messages are waiting for approval'}</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid grid-cols-1 xl:grid-cols-2" >
            {shownWaiting.map((m) => {
              const a = personOf(m.from_character_id); const b = personOf(m.to_character_id);
              const working = busy.has(m.id);
              return (
                <li key={m.id} style={{ padding: 6 }}>
                  <div style={{ borderRadius: 16, padding: '12px 14px', background: CK.redWash, boxShadow: CK.shadowSm }}>
                    <div className="flex items-start justify-between" style={{ gap: 10 }}>
                      <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
                        <Avatar person={a} cabinet={cabOf(a)} size={32} />
                        <div style={{ fontSize: 13, minWidth: 0 }}>{nameLine(a)}<span style={{ color: CK.muted }}> to </span>{nameLine(b)}</div>
                      </div>
                      <span title={fullStamp(m.created_at)} style={{ fontSize: 12, fontWeight: 700, color: CK.inkSoft, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{stamp(m.created_at, now)}</span>
                    </div>
                    <p style={{ margin: '8px 0 10px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p>
                    <div className="flex" style={{ gap: 8 }}>
                      <Btn tone="green" size="sm" icon={<Check size={14} strokeWidth={1.5} />} disabled={working} onClick={() => void decide(m, true)}>Approve</Btn>
                      <Btn tone="danger" size="sm" icon={<X size={14} strokeWidth={1.5} />} disabled={working} onClick={() => void decide(m, false)}>Decline</Btn>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {messages !== null && lane === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]" style={{ gap: 12, alignItems: 'start' }}>
          <Card className={`${mobileOpen ? 'hidden lg:block' : 'block'} ${paneH} lg:overflow-y-auto`} style={{ padding: 8 }}>
            {shownPairs.length === 0 && <p style={{ margin: 0, padding: 16, fontSize: 14, color: CK.muted }}>{pairs.length ? 'No conversations match those filters' : 'Nobody has written to anybody yet'}</p>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {shownPairs.map((p) => {
                const a = personOf(p.aId); const b = personOf(p.bId);
                const sel = p.key === selectedKey;
                return (
                  <li key={p.key} style={{ margin: '2px 0' }}>
                    <button onClick={() => { setSelectedKey(p.key); setMobileOpen(true); }} aria-current={sel}
                      className="w-full text-left flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                      style={{ gap: 10, border: 0, borderRadius: 12, padding: '8px 10px', cursor: 'pointer', fontFamily: CK.font, color: CK.ink,
                        background: sel ? CK.well : 'transparent', boxShadow: sel ? `inset 0 0 0 1px ${CK.hair}` : 'none' }}>
                      <span className="flex" style={{ flex: 'none' }}>
                        <Avatar person={a} cabinet={cabOf(a)} size={34} />
                        <span style={{ marginLeft: -10 }}><Avatar person={b} cabinet={cabOf(b)} size={34} /></span>
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="flex items-baseline justify-between" style={{ gap: 8 }}>
                          <span style={{ fontSize: 13.5, overflowWrap: 'anywhere' }}>{nameLine(a)}<span style={{ color: CK.muted }}> and </span>{nameLine(b)}</span>
                          <span title={fullStamp(p.last.created_at)} style={{ fontSize: 11.5, color: CK.muted, fontWeight: 600, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{stamp(p.last.created_at, now)}</span>
                        </span>
                        <span className="flex items-center" style={{ gap: 6 }}>
                          <span title={p.last.body} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: CK.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.last.body.replace(/\s+/g, ' ')}
                          </span>
                          {p.pending > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: CK.warn, flex: 'none' }}>{p.pending} waiting</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className={`${mobileOpen ? 'block' : 'hidden lg:block'} ${paneH} lg:overflow-y-auto`} style={{ padding: '14px 16px' }}>
            {!selected ? (
              <div className="flex flex-col items-center justify-center" style={{ gap: 8, padding: 24, color: CK.muted, textAlign: 'center' }}>
                <MessageSquare size={30} strokeWidth={1.5} aria-hidden />
                <p style={{ margin: 0, fontSize: 14 }}>Pick a conversation to read it</p>
              </div>
            ) : (
              <StaffThread pair={selected} personOf={personOf} cabOf={cabOf} nameLine={nameLine} now={now} busy={busy} onDecide={decide} onBack={() => setMobileOpen(false)} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function StaffThread({ pair, personOf, cabOf, nameLine, now, busy, onDecide, onBack }: {
  pair: Pair;
  personOf: (id: string | null) => Person;
  cabOf: (p: Person) => Cabinet | undefined;
  nameLine: (p: Person) => React.ReactNode;
  now: number;
  busy: Set<string>;
  onDecide: (m: CrisisMessage, approve: boolean) => Promise<void>;
  onBack: () => void;
}) {
  const a = personOf(pair.aId); const b = personOf(pair.bId);
  return (
    <div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${CK.hair}` }}>
        <button onClick={onBack} aria-label="Back to conversations" className="lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={iconBtn}>
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <span className="flex" style={{ flex: 'none' }}>
          <Avatar person={a} cabinet={cabOf(a)} size={36} />
          <span style={{ marginLeft: -10 }}><Avatar person={b} cabinet={cabOf(b)} size={36} /></span>
        </span>
        <div style={{ fontSize: 14, minWidth: 0 }}>{nameLine(a)}<span style={{ color: CK.muted }}> and </span>{nameLine(b)}</div>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: CK.muted, fontWeight: 600 }}>Read only. Staff do not write as characters</p>
      {pair.messages.map((m, i) => {
        const prev = pair.messages[i - 1];
        const mine = m.from_character_id === pair.aId;
        const sender = personOf(m.from_character_id);
        const working = busy.has(m.id);
        return (
          <div key={m.id}>
            {(!prev || !sameDay(prev.created_at, m.created_at)) && (
              <div style={{ textAlign: 'center', margin: '10px 0 6px', fontSize: 11.5, fontWeight: 700, color: CK.muted }}>{dayLabel(m.created_at, now)}</div>
            )}
            <div className="flex flex-col" style={{ alignItems: mine ? 'flex-end' : 'flex-start', margin: '4px 0' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: CK.inkSoft, margin: '0 6px 2px', overflowWrap: 'anywhere' }}>{sender.name}</span>
              <div title={fullStamp(m.created_at)} style={{
                maxWidth: 'min(560px, 88%)', padding: '8px 12px', borderRadius: 16, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                background: mine ? BUBBLE_MINE : CK.surface, color: CK.ink,
                outline: m.status === 'pending' ? `1px dashed ${CK.warn}` : m.status === 'rejected' ? `1px dashed ${CK.danger}` : 'none',
              }}>
                {m.body}
              </div>
              <div className="flex items-center" style={{ gap: 8, marginTop: 2, fontSize: 11.5, color: CK.muted, fontWeight: 600 }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{clock(m.created_at)}</span>
                {m.status === 'rejected' && <span style={{ color: CK.danger }}>Declined</span>}
                {m.status === 'pending' && (
                  <>
                    <span style={{ color: CK.warn }}>Waiting for approval</span>
                    <Btn tone="green" size="sm" icon={<Check size={13} strokeWidth={1.5} />} disabled={working} onClick={() => void onDecide(m, true)}>Approve</Btn>
                    <Btn tone="danger" size="sm" icon={<X size={13} strokeWidth={1.5} />} disabled={working} onClick={() => void onDecide(m, false)}>Decline</Btn>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
