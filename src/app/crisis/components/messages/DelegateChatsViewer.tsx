'use client';
// Gavelling Crisis: the crisis team reads what delegates write to each other in a cabinet's committee-room chat, view only
// (owner, 21 Nov 2026). The room chat's rows are readable by anyone with the room (messages SELECT is true); this screen only
// shows them. Kept light on purpose: no live subscription, ONE read of the room's private rows while the viewer is open,
// again every 60 s while the tab is visible and on Refresh. Delegate-to-delegate private threads and group chats only; messages
// to the dais, the Secretariat and the room-wide chat are not here (the room chat has those).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, RefreshCw, UsersRound } from 'lucide-react';
import { anonClient } from '@/lib/crisis/client';
import { GROUP_DEF_RECIPIENT, GROUP_KEY_PREFIX, parseChatGroups } from '@/lib/chatConversations';
import { serverNow } from '@/lib/serverClock';
import type { ChatMessage } from '@/lib/types';
import type { Character } from '@/lib/crisis/types';
import { Avatar, Btn, Card, CK, Segmented, agoLabel } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { PageHeading } from '../command/setupKit';

const POLL_MS = 60_000;
const PANE_H = 'calc(100dvh - 170px)';

interface Thread { key: string; kind: 'pair' | 'group'; title: string; members: string[]; messages: ChatMessage[]; last: ChatMessage }

export default function DelegateChatsViewer({ onBack }: { onBack: () => void }) {
  const { core } = useCrisis();
  const cabinets = useMemo(() => core.cabinets.filter((c) => c.conference_committee_id), [core.cabinets]);
  const [cabId, setCabId] = useState(cabinets[0]?.id ?? '');
  const cab = cabinets.find((c) => c.id === cabId) ?? cabinets[0] ?? null;
  const [data, setData] = useState<{ cab: string; seats: string[]; messages: ChatMessage[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cab?.conference_committee_id) return;
    setBusy(true);
    try {
      const cc = await anonClient.from('conference_committees').select('session_id').eq('id', cab.conference_committee_id).maybeSingle();
      const sid = (cc.data as { session_id?: string | null } | null)?.session_id;
      if (!sid) { setData({ cab: cab.id, seats: [], messages: [] }); setFailed(false); return; }
      const [seatsRes, msgRes] = await Promise.all([
        anonClient.from('delegates').select('country').eq('committee_id', sid),
        anonClient.from('messages').select('id, sender, content, created_at, is_private, recipient')
          .eq('committee_id', sid).eq('is_private', true).order('created_at', { ascending: false }).limit(3000),
      ]);
      if (seatsRes.error || msgRes.error) throw new Error('read failed');
      const seats = ((seatsRes.data ?? []) as Array<{ country: string }>).map((d) => d.country);
      const messages = ((msgRes.data ?? []) as Array<Record<string, unknown>>).reverse().map((m) => ({
        id: m.id as string, sender: m.sender as string, content: m.content as string,
        timestamp: new Date(m.created_at as string), isPrivate: true, recipient: (m.recipient as string | null) ?? undefined,
      }));
      setData({ cab: cab.id, seats, messages });
      setFailed(false);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }, [cab]);

  useEffect(() => {
    void Promise.resolve().then(load);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const charByName = useMemo(() => new Map(core.characters.map((c) => [c.name.trim().toLowerCase(), c])), [core.characters]);
  const color = (c: Character | undefined) => (c?.cabinet_id ? core.cabinets.find((x) => x.id === c.cabinet_id)?.color ?? CK.red : CK.red);
  const charOf = (seat: string) => charByName.get(seat.trim().toLowerCase());

  const threads = useMemo<Thread[]>(() => {
    if (!data || data.cab !== cab?.id) return [];
    const seats = new Set(data.seats);
    const groups = parseChatGroups(data.messages);
    const by = new Map<string, Thread>();
    for (const m of data.messages) {
      if (m.sender === '__system__' || m.recipient === GROUP_DEF_RECIPIENT || !m.recipient) continue;
      let key: string; let kind: Thread['kind']; let title: string; let members: string[];
      if (m.recipient.startsWith(GROUP_KEY_PREFIX)) {
        const g = groups.get(m.recipient.slice(GROUP_KEY_PREFIX.length));
        if (!g) continue;
        key = m.recipient; kind = 'group'; title = g.name; members = g.members;
      } else {
        // Only delegation to delegation: both ends are seats of the room (never the dais, the Secretariat or a staff name).
        if (!seats.has(m.sender) || !seats.has(m.recipient)) continue;
        const pair = [m.sender, m.recipient].sort((a, b) => a.localeCompare(b));
        key = `pair:${pair.join('\u0000')}`; kind = 'pair'; title = `${pair[0]} and ${pair[1]}`; members = pair;
      }
      const t = by.get(key);
      if (t) { t.messages.push(m); t.last = m; } else by.set(key, { key, kind, title, members, messages: [m], last: m });
    }
    return [...by.values()].sort((a, b) => b.last.timestamp.getTime() - a.last.timestamp.getTime());
  }, [data, cab?.id]);

  const shown = threads.find((t) => t.key === open) ?? threads[0] ?? null;

  return (
    <div style={{ fontFamily: CK.font }}>
      <PageHeading
        eyebrow="RUN"
        title="Delegate Chats"
        right={(
          <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
            {cabinets.length > 1 && (
              <Segmented ariaLabel="Cabinet" value={cab?.id ?? ''} onChange={(v) => { setCabId(v); setOpen(null); }} options={cabinets.map((c) => ({ value: c.id, label: c.short_name || c.name }))} />
            )}
            <Btn tone="ghost" size="sm" disabled={busy} onClick={() => void load()} icon={<RefreshCw size={14} strokeWidth={1.6} />}>Refresh</Btn>
            <Btn tone="ghost" size="sm" onClick={onBack} icon={<ArrowLeft size={14} strokeWidth={1.6} />}>Back to messages</Btn>
          </span>
        )}
      />
      <p className="flex items-center" style={{ gap: 6, margin: '-6px 0 12px', fontSize: 13, color: CK.inkSoft }}>
        <Eye size={14} strokeWidth={1.6} aria-hidden />View only. Private chats and group chats between delegates in the committee room.
      </p>
      <div className="grid gap-3.5 md:grid-cols-[minmax(260px,340px)_1fr]">
        <Card style={{ padding: 8, height: PANE_H, minHeight: 320, overflowY: 'auto' }}>
          {!data && !failed ? (
            <div style={{ padding: 6 }}>{[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 52, borderRadius: 12, background: CK.well, marginBottom: 8 }} />)}</div>
          ) : failed && !data ? (
            <p style={{ margin: 0, padding: 14, fontSize: 14, color: CK.inkSoft }}>Could not load the chats. Press Refresh to try again.</p>
          ) : threads.length === 0 ? (
            <p style={{ margin: 0, padding: 14, fontSize: 14, color: CK.inkSoft }}>Delegates have not written to each other yet.</p>
          ) : threads.map((t) => {
            const active = shown?.key === t.key;
            const first = charOf(t.members[0] ?? '');
            const second = charOf(t.members[1] ?? '');
            return (
              <button key={t.key} type="button" onClick={() => setOpen(t.key)}
                className="flex items-start w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ gap: 10, padding: 10, border: 0, borderRadius: 12, cursor: 'pointer', fontFamily: CK.font, background: active ? CK.well : 'transparent', marginBottom: 2 }}>
                {t.kind === 'group' ? (
                  <span className="grid place-items-center" style={{ width: 38, height: 38, flex: 'none', color: CK.inkSoft }}><UsersRound size={22} strokeWidth={1.5} aria-hidden /></span>
                ) : (
                  <span className="flex" style={{ flex: 'none' }}>
                    <Avatar name={t.members[0]} src={first?.picture_url} size={30} color={color(first)} />
                    <Avatar name={t.members[1]} src={second?.picture_url} size={30} color={color(second)} style={{ marginLeft: -10, boxShadow: `0 0 0 2px ${CK.card}` }} />
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="flex items-baseline" style={{ gap: 6 }}>
                    <b style={{ fontSize: 14, color: CK.ink, overflowWrap: 'anywhere' }}>{t.title}</b>
                    <span style={{ marginLeft: 'auto', fontSize: 11.5, color: CK.muted, flex: 'none' }}>{agoLabel(t.last.timestamp.toISOString(), serverNow())}</span>
                  </span>
                  {t.kind === 'group' && <span style={{ display: 'block', fontSize: 11.5, color: CK.muted }}>{t.members.length} members</span>}
                  <span title={t.last.content} style={{ display: 'block', marginTop: 2, fontSize: 13, color: CK.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.last.sender}: {t.last.content}
                  </span>
                </span>
              </button>
            );
          })}
        </Card>
        <Card style={{ padding: 0, height: PANE_H, minHeight: 320, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!shown ? (
            <p style={{ margin: 'auto', padding: 24, fontSize: 14, color: CK.inkSoft, textAlign: 'center' }}>Pick a chat to read it.</p>
          ) : (
            <>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${CK.hair}`, flex: 'none' }}>
                <b style={{ display: 'block', fontSize: 15, color: CK.ink, overflowWrap: 'anywhere' }}>{shown.title}</b>
                {shown.kind === 'group' && <span style={{ display: 'block', fontSize: 12, color: CK.muted, overflowWrap: 'anywhere' }}>{shown.members.join(', ')}</span>}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
                {shown.messages.map((m) => {
                  const ch = charOf(m.sender);
                  return (
                    <div key={m.id} className="flex" style={{ gap: 8, marginBottom: 10 }}>
                      <Avatar name={m.sender} src={ch?.picture_url} size={28} color={color(ch)} style={{ marginTop: 18 }} />
                      <div style={{ maxWidth: 'min(620px, 85%)' }}>
                        <span className="flex items-center" style={{ gap: 6, fontSize: 11.5, fontWeight: 700, color: CK.muted, marginBottom: 3 }}>
                          <span style={{ overflowWrap: 'anywhere' }}>{m.sender}</span>
                          <span style={{ fontWeight: 500 }}>{agoLabel(m.timestamp.toISOString(), serverNow())}</span>
                        </span>
                        <div style={{ padding: '9px 13px', borderRadius: 14, borderTopLeftRadius: 4, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: CK.well, color: CK.ink }}>
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
