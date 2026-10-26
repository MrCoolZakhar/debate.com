'use client';
// "Try it as": one click into the crisis as any person in it, or into the live room as a chair,
// a delegate's room view or the faculty advisor board. For directors and organisers (through
// their own account). "View as" adds a token for this device only; "Back to my account" in the
// top bar removes it. Used on /crisis and on the Command page.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Gavel, GraduationCap, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { useAuth } from '@/components/AuthProvider';
import { notifyErr } from '@/lib/appNotify';
import { clearCrisisToken, getCrisisClient } from '@/lib/crisis/client';
import { crisisError, viewAs, type CrisisRef } from '@/lib/crisis/api';
import { MEMBER_COLUMNS, ROLE_LABEL, type Cabinet, type Character, type Member } from '@/lib/crisis/types';
import { Avatar, Btn, CK, Card, CardTitle, Skeleton } from '../../crisisKit';

interface Loaded {
  members: Member[];
  characters: Character[];
  cabinets: Cabinet[];
  rooms: Map<string, { code: string; chairPassword: string | null }>; // cabinet id -> live room
  selfUserId: string | null; // the signed-in account, to tell which member is you
}

async function loadTryAs(crisisId: string): Promise<Loaded> {
  const client = await getCrisisClient('', ''); // always the account, never a stored token
  const [m, ch, cb] = await Promise.all([
    client.from('crisis_members').select(MEMBER_COLUMNS).eq('crisis_id', crisisId).order('display_name'),
    client.from('crisis_characters').select('*').eq('crisis_id', crisisId),
    client.from('crisis_cabinets').select('*').eq('crisis_id', crisisId).order('sort'),
  ]);
  if (m.error || ch.error || cb.error) throw m.error || ch.error || cb.error;
  const selfUserId = (await client.auth.getSession()).data.session?.user.id ?? null;
  const cabinets = (cb.data ?? []) as Cabinet[];
  const rooms = new Map<string, { code: string; chairPassword: string | null }>();
  const ccIds = cabinets.map((c) => c.conference_committee_id).filter((x): x is string => !!x);
  if (ccIds.length) {
    const cc = await client.from('conference_committees').select('id, session_id, session_code').in('id', ccIds);
    const rows = (cc.data ?? []) as Array<{ id: string; session_id: string | null; session_code: string | null }>;
    const sids = rows.map((r) => r.session_id).filter((x): x is string => !!x);
    const cm = sids.length ? await client.from('committees').select('id, code, settings').in('id', sids) : { data: [] };
    const bySid = new Map(((cm.data ?? []) as Array<{ id: string; code: string; settings: { chairJoinSuffix?: string } | null }>).map((r) => [r.id, r]));
    for (const cab of cabinets) {
      const row = rows.find((r) => r.id === cab.conference_committee_id);
      const room = row?.session_id ? bySid.get(row.session_id) : undefined;
      const code = room?.code ?? row?.session_code ?? null;
      if (code) rooms.set(cab.id, { code, chairPassword: room?.settings?.chairJoinSuffix || null });
    }
  }
  return { members: (m.data ?? []) as unknown as Member[], characters: (ch.data ?? []) as Character[], cabinets, rooms, selfUserId };
}

function Chip({ onClick, href, icon, children, tone = 'plain', busy }: {
  onClick?: () => void; href?: string; icon: React.ReactNode; children: React.ReactNode; tone?: 'plain' | 'red'; busy?: boolean;
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 8px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
    background: tone === 'red' ? 'rgba(142,36,36,0.08)' : CK.well, color: tone === 'red' ? CK.red2 : CK.ink, border: 0, cursor: 'pointer',
    textDecoration: 'none', fontFamily: CK.font, opacity: busy ? 0.6 : 1, overflowWrap: 'anywhere', textAlign: 'left',
  };
  const cls = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform';
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{icon}{children}</a>;
  return <button type="button" onClick={onClick} disabled={busy} className={cls} style={style}>{icon}{children}</button>;
}

export default function TryAsPanel({ cref, compact }: { cref: CrisisRef; compact?: boolean }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // "View as" needs the director's own Gavelling account: someone signed in with a personal code has none.
  const { user, loading: authLoading } = useAuth();
  const noAccount = !authLoading && !user;

  useEffect(() => {
    if (noAccount || authLoading) return;
    let cancelled = false;
    loadTryAs(cref.id).then((d) => { if (!cancelled) setData(d); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [cref.id, noAccount, authLoading]);

  const charName = useMemo(() => new Map((data?.characters ?? []).map((c) => [c.id, c.name])), [data]);
  const charPicture = useMemo(() => new Map((data?.characters ?? []).map((c) => [c.id, c.picture_url])), [data]);
  const face = (m: Member, color: string) => <Avatar name={m.display_name} src={m.character_id ? charPicture.get(m.character_id) ?? null : null} size={22} color={color} />;

  const enter = async (m: Member) => {
    if (busy) return;
    setBusy(m.id);
    try {
      if (data?.selfUserId && m.user_id === data.selfUserId) {
        // That is you: drop the stored token and open the crisis as your own account.
        clearCrisisToken(cref.conf, cref.crisis);
        window.location.assign(`/crisis/${cref.conf}/${cref.crisis}`);
        return;
      }
      await viewAs(cref, m.id);
      // A full load so every part of the page re-reads as the new person.
      window.location.assign(`/crisis/${cref.conf}/${cref.crisis}`);
    } catch (e) {
      notifyErr(crisisError(e, 'Could not open the crisis as this person.'));
      setBusy(null);
    }
  };

  const teamRank: Record<string, number> = { director: 0, assistant_director: 1, backroomer: 2, press: 3 };
  const staff = (data?.members ?? [])
    .filter((m) => m.role === 'director' || m.role === 'backroomer' || m.role === 'assistant_director' || m.role === 'press')
    .sort((a, b) => (teamRank[a.role] - teamRank[b.role]) || a.display_name.localeCompare(b.display_name));
  const isYou = (m: Member) => !!data?.selfUserId && m.user_id === data.selfUserId;
  const chairs = (data?.members ?? []).filter((m) => m.role === 'chair');
  const delegates = (data?.members ?? []).filter((m) => m.role === 'delegate');

  return (
    <Card>
      <CardTitle icon={<Eye size={17} strokeWidth={1.5} />} sub="Open the crisis as someone else on this device. Use Back to my account at the top to return.">
        Try It As
      </CardTitle>
      {noAccount && <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>Try it as works when you are signed in with your Gavelling account.</p>}
      {!noAccount && failed && <p style={{ margin: 0, fontSize: 13, color: CK.danger }}>Could not load the people in this crisis.</p>}
      {!noAccount && !data && !failed && <div className="grid" style={{ gap: 8 }}><Skeleton h={30} /><Skeleton h={30} /></div>}
      {!noAccount && data && (
        <div className="grid" style={{ gap: compact ? 10 : 14 }}>
          {staff.length > 0 && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11.5, fontWeight: 800, color: CK.muted }}>Crisis team</p>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {staff.map((m) => (
                  <Chip key={m.id} busy={busy === m.id} onClick={() => enter(m)} icon={face(m, CK.forest2)}>
                    {ROLE_LABEL[m.role]} · {m.display_name}{isYou(m) ? ' (you)' : ''}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {data.cabinets.map((cab) => {
            const dels = delegates.filter((m) => m.cabinet_id === cab.id);
            const room = data.rooms.get(cab.id);
            const cabChairs = chairs.filter((m) => m.cabinet_id === cab.id);
            return (
              <div key={cab.id}>
                <p style={{ margin: '0 0 6px', fontSize: 11.5, fontWeight: 800, color: cab.color, overflowWrap: 'anywhere' }}>{cab.name}</p>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {dels.map((m) => (
                    <Chip key={m.id} busy={busy === m.id} onClick={() => enter(m)} icon={face(m, cab.color)}>
                      Delegate · {m.character_id ? charName.get(m.character_id) ?? m.display_name : m.display_name}
                    </Chip>
                  ))}
                  {cabChairs.map((m) => (
                    <Chip key={m.id} busy={busy === m.id} onClick={() => enter(m)} icon={face(m, cab.color)}>
                      Chair · {m.display_name}
                    </Chip>
                  ))}
                  {room && (
                    <>
                      <Chip tone="red" href={`/join?code=${encodeURIComponent(room.chairPassword ? `${room.code}-${room.chairPassword}` : room.code)}&mode=chair`} icon={<Gavel size={14} strokeWidth={1.5} />}>Live room as chair</Chip>
                      <Chip tone="red" href={`/chair/${room.code}?secretariat=1`} icon={<Eye size={14} strokeWidth={1.5} />}>Watch the room</Chip>
                      <Chip tone="red" href={`/advisor?add=${encodeURIComponent(room.code)}`} icon={<GraduationCap size={14} strokeWidth={1.5} />}>Faculty advisor board</Chip>
                    </>
                  )}
                  {!dels.length && !cabChairs.length && !room && <span style={{ fontSize: 12.5, color: CK.inkSoft }}>No one here yet.</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** The compact header button: "Try it as" opens the panel in a scrollable pop-up (loaded only when opened). */
export function TryAsButton({ cref }: { cref: CrisisRef }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <Btn tone="ghost" size="sm" icon={<Eye size={14} strokeWidth={1.5} aria-hidden />} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        Try it as
      </Btn>
      {open && (
        <Portal>
          <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'grid', placeItems: 'center', padding: 12, fontFamily: CK.font }}>
            <div aria-hidden onMouseDown={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.42)' }} />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Try it as"
              style={{ position: 'relative', width: 'min(760px, 100%)', maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', borderRadius: 24, background: CK.surface, boxShadow: '0 24px 60px rgba(58,14,15,0.35)' }}
            >
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ position: 'absolute', top: 12, right: 12, zIndex: 1, border: 0, background: CK.card, borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: CK.forest, boxShadow: CK.shadowSm, display: 'grid', placeItems: 'center' }}
              >
                <X size={18} strokeWidth={1.6} />
              </button>
              <TryAsPanel cref={cref} compact />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
