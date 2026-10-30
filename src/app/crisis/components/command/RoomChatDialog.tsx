'use client';
// Gavelling Crisis: "Room chat", the crisis staff's way into a cabinet's committee-room chat from where they work (the Directives
// page header, so backroomers, the Crisis Director and the assistants all have it). One pop-up with two steps: the list of cabinets,
// then that room's chat, which REPLACES the list (a back button returns to it). The chat is staffChat.tsx: the staff write as
// the Crisis Team. Command's room cards and room pop-up open the same chat from there.

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { getCrisisClient } from '@/lib/crisis/client';
import { crisisError, type CrisisRef } from '@/lib/crisis/api';
import { notifyErr } from '@/lib/appNotify';
import type { Cabinet } from '@/lib/crisis/types';
import { Btn, CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import { CabinetLogo } from '../directives/directiveParts';
import StaffRoomChat, { useStaffChat } from './staffChat';

/** Each cabinet's committee-room code (null when the cabinet has no room yet). */
async function loadRoomCodes(ref: CrisisRef, cabinets: Cabinet[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>(cabinets.map((c) => [c.id, null]));
  const ids = cabinets.map((c) => c.conference_committee_id).filter((x): x is string => !!x);
  if (!ids.length) return out;
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const r = await client.from('conference_committees').select('id, session_code').in('id', ids);
  if (r.error) throw r.error;
  const byCc = new Map(((r.data ?? []) as Array<{ id: string; session_code: string | null }>).map((x) => [x.id, x.session_code]));
  for (const c of cabinets) out.set(c.id, c.conference_committee_id ? byCc.get(c.conference_committee_id) ?? null : null);
  return out;
}

/** Step two: one room's chat. Mounted only while it is open, so the room is read and joined only then. */
function RoomChatStep({ cab, code, onBack, onClose }: { cab: Cabinet; code: string; onBack: () => void; onClose: () => void }) {
  const chat = useStaffChat(code, true);
  return (
    <CrisisDialog title={`${cab.name} Chat`} eyebrow="Writing as the Crisis Team" onBack={onBack} onClose={onClose} width={860} step={`chat:${cab.id}`}>
      <StaffRoomChat chat={chat} height="min(560px, calc(100dvh - 230px))" />
    </CrisisDialog>
  );
}

function RoomChatPopup({ onClose }: { onClose: () => void }) {
  const { ref, core } = useCrisis();
  const [codes, setCodes] = useState<Map<string, string | null> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const cabinets = core.cabinets;

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      loadRoomCodes(ref, cabinets)
        .then((m) => { if (!cancelled) { setCodes(m); setFailed(false); } })
        .catch((e) => { if (!cancelled) { setFailed(true); notifyErr(crisisError(e, 'Could not read the committee rooms.'), 'crisis-room-chat-list'); } });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [ref, cabinets, attempt]);

  const open = useMemo(() => cabinets.find((c) => c.id === openId) ?? null, [cabinets, openId]);
  const openCode = open ? codes?.get(open.id) ?? null : null;
  if (open && openCode) return <RoomChatStep cab={open} code={openCode} onBack={() => setOpenId(null)} onClose={onClose} />;

  return (
    <CrisisDialog title="Room Chat" onClose={onClose} width={560} step="list">
      {cabinets.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>There are no cabinets yet.</p>
      ) : codes === null && !failed ? (
        <div className="flex flex-col" style={{ gap: 8 }} aria-busy="true">{cabinets.map((c) => <Skeleton key={c.id} h={52} r={14} />)}</div>
      ) : failed && codes === null ? (
        <div className="flex flex-col items-start" style={{ gap: 10 }}>
          <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>The committee rooms did not load.</p>
          <Btn tone="ghost" size="sm" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }}>Try again</Btn>
        </div>
      ) : (
        <ul className="flex flex-col" style={{ gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
          {cabinets.map((c) => {
            const code = codes?.get(c.id) ?? null;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!code}
                  onClick={() => setOpenId(c.id)}
                  className="flex w-full items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.99] transition-transform disabled:cursor-not-allowed"
                  style={{ gap: 12, padding: '10px 14px', border: 0, borderRadius: 14, background: CK.card, boxShadow: CK.shadowSm, cursor: code ? 'pointer' : 'not-allowed', opacity: code ? 1 : 0.6, fontFamily: CK.font }}
                >
                  <CabinetLogo cabinet={c} size={32} />
                  <span className="min-w-0 flex-1">
                    <b style={{ display: 'block', fontSize: 15, color: CK.ink, overflowWrap: 'anywhere' }}>{c.name}</b>
                    {!code && <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft }}>No committee room yet</span>}
                  </span>
                  {code && <MessageCircle size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </CrisisDialog>
  );
}

/** The "Room chat" button for a page header, with its pop-up. */
export default function RoomChatButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn tone="ghost" size="sm" icon={<MessageCircle size={15} strokeWidth={1.5} aria-hidden />} onClick={() => setOpen(true)} title="Read and write in a cabinet's committee room chat">
        Room chat
      </Btn>
      {open && <RoomChatPopup onClose={() => setOpen(false)} />}
    </>
  );
}
