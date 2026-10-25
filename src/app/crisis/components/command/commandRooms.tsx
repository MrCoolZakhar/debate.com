'use client';
// Gavelling Crisis: "Front Rooms" (each cabinet's live room, re-read every 15 s) and "Backroom" (who has what).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Lightbulb, Presentation, Siren, UsersRound } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, type CrisisRef } from '@/lib/crisis/api';
import { ROLE_LABEL, type Cabinet, type Directive, type Member } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, Skeleton, cabinetTint } from '../../crisisKit';
import { loadRoomStates, minutesLabel, staffLoads, suggestRebalance, type RoomState } from './commandData';
import { EmptyLine, LinkBtn } from './commandParts';

// ─────────── Front rooms ───────────

function useRoomStates(cref: CrisisRef, cabinets: Cabinet[]): { rooms: RoomState[] | null; failed: boolean } {
  const [rooms, setRooms] = useState<RoomState[] | null>(null);
  const [failed, setFailed] = useState(false);
  const cabinetsRef = useRef(cabinets);
  useEffect(() => { cabinetsRef.current = cabinets; });
  const key = cabinets.map((c) => `${c.id}:${c.conference_committee_id ?? ''}`).join('|');
  const seq = useRef(0);

  const read = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const r = await loadRoomStates(cref, cabinetsRef.current);
      if (mine !== seq.current) return;
      setRooms(r);
      setFailed(false);
    } catch {
      // A failed re-read keeps what is on screen.
      if (mine === seq.current) setFailed(true);
    }
  }, [cref]);

  useEffect(() => {
    const first = window.setTimeout(() => { void read(); }, 0);
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void read(); }, 15_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void read(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(first); window.clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [read, key]);

  return { rooms, failed };
}

const TONE_DOT = { live: '#3D7A52', quiet: CK.warn, ended: '#9A9086' } as const;

export function FrontRoomsCard({ cref, cabinets, base }: { cref: CrisisRef; cabinets: Cabinet[]; base: string }) {
  const { rooms, failed } = useRoomStates(cref, cabinets);
  const byCab = useMemo(() => new Map((rooms ?? []).map((r) => [r.cabinetId, r])), [rooms]);

  return (
    <Card warm>
      <CardTitle icon={<Presentation size={17} strokeWidth={1.5} />}>Front Rooms</CardTitle>
      {cabinets.length === 0 ? <EmptyLine>No cabinets yet.</EmptyLine> : cabinets.map((cab, i) => {
        const r = byCab.get(cab.id);
        return (
          <div key={cab.id} style={{ padding: '10px 0', borderTop: i === 0 ? 0 : `1px solid ${CK.hair}`, paddingTop: i === 0 ? 2 : 10 }}>
            <div className="flex items-center justify-between" style={{ gap: 8 }}>
              <b style={{ fontSize: 14, color: cab.color, overflowWrap: 'anywhere', minWidth: 0 }}>{cab.name}</b>
              {r?.code && (
                <LinkBtn href={`/chair/${r.code}?secretariat=1`} newTab icon={<Eye size={13} strokeWidth={1.5} />}>Watch</LinkBtn>
              )}
            </div>
            <div className="flex items-center flex-wrap" style={{ gap: '2px 6px', marginTop: 3, fontSize: 12.5, color: CK.inkSoft }}>
              {rooms === null && !failed ? <Skeleton h={14} w="55%" /> : r?.phaseLabel ? (
                <>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: TONE_DOT[r.tone], boxShadow: `0 0 0 3px ${cabinetTint(TONE_DOT[r.tone], 0.2)}`, flex: 'none' }} />
                  <b style={{ color: CK.ink }}>{r.phaseLabel}</b>
                  {r.speaker && <span style={{ overflowWrap: 'anywhere' }}>· {r.speaker} speaking</span>}
                </>
              ) : failed && rooms === null ? <span>Could not read this room</span> : <span>No room linked</span>}
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 8 }}>
        <LinkBtn href={`${base}/news`} tone="red" icon={<Siren size={14} strokeWidth={1.5} />}>Send a crisis break</LinkBtn>
      </div>
    </Card>
  );
}

// ─────────── Backroom ───────────

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function BackroomCard({ cref, members, directives, base, onChanged }: {
  cref: CrisisRef; members: Member[]; directives: Directive[] | null; base: string; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const loads = useMemo(() => (directives ? staffLoads(members, directives) : null), [members, directives]);
  const tip = useMemo(() => (loads ? suggestRebalance(loads) : null), [loads]);
  const unassigned = useMemo(() => (directives ?? []).filter((d) => d.assigned_member_id === null && (d.status === 'queued' || d.status === 'claimed')).length, [directives]);

  const rebalance = async () => {
    if (!tip || busy) return;
    setBusy(true);
    try {
      for (const d of tip.move) await assignDirective(cref, d.id, tip.to.member.id);
      notifyOk(`Moved 2 directives to ${tip.to.member.display_name}`, 'crisis-command');
      onChanged();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not move those directives.'), 'crisis-command');
      onChanged();
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardTitle icon={<UsersRound size={17} strokeWidth={1.5} />} sub="Open directives per person and their average reply today">Backroom</CardTitle>
      {loads === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={34} /><Skeleton h={34} /><Skeleton h={34} /></div>
        : loads.length === 0 ? (
          <>
            <EmptyLine>No backroomers yet.</EmptyLine>
            <div style={{ marginTop: 8 }}><LinkBtn href={`${base}/staff`}>Add staff</LinkBtn></div>
          </>
        ) : (
          <>
            {loads.map((l) => {
              const n = l.open.length;
              const heavy = n >= 4;
              return (
                <div key={l.member.id} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 84px', gap: 9, alignItems: 'center', padding: '7px 0' }}>
                  <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: '#FFF', background: CK.forest2 }}>{initials(l.member.display_name)}</span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 13, color: CK.ink, overflowWrap: 'anywhere' }}>{l.member.display_name}</b>
                    <span style={{ display: 'block', fontSize: 11.5, color: CK.inkSoft }}>
                      {l.member.role === 'backroomer' ? 'Backroomer' : ROLE_LABEL[l.member.role]} · reply {minutesLabel(l.avgReplyMin)}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <b style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: heavy ? CK.red : CK.ink }}>{n}</b>
                    <span style={{ fontSize: 11.5, color: CK.inkSoft }}> open</span>
                    <span aria-hidden style={{ display: 'block', height: 5, borderRadius: 3, background: CK.well, marginTop: 4, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.min(100, (n / 6) * 100)}%`, borderRadius: 3, background: heavy ? CK.redBtn : CK.greenBtn }} />
                    </span>
                  </span>
                </div>
              );
            })}
            {unassigned > 0 && (
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: CK.inkSoft }}>
                <b style={{ color: CK.ink, fontVariantNumeric: 'tabular-nums' }}>{unassigned}</b> {unassigned === 1 ? 'directive has' : 'directives have'} nobody on {unassigned === 1 ? 'it' : 'them'} yet
              </p>
            )}
            {tip && (
              <div className="flex" style={{ gap: 8, marginTop: 10, padding: '10px 12px', borderRadius: 14, background: cabinetTint(CK.gold, 0.32), fontSize: 13, color: CK.ink }}>
                <Lightbulb size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 1, color: CK.goldDeep }} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ overflowWrap: 'anywhere' }}>
                    {tip.from.member.display_name} has {tip.from.open.length} open. Move the 2 oldest to {tip.to.member.display_name}?
                  </span>
                  <div style={{ marginTop: 6 }}>
                    <Btn size="sm" tone="green" onClick={rebalance} disabled={busy}>
                      <span style={{ overflowWrap: 'anywhere', whiteSpace: 'normal', textAlign: 'left' }}>Move 2 to {tip.to.member.display_name}</span>
                    </Btn>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </Card>
  );
}
