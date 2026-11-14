'use client';
// Gavelling Crisis: the chair's home, "Front Room": ONE dashboard that fits a screen (1280x800 and up, no page scrolling; each
// card scrolls inside itself). Left: the chair console, resources and the cabinet's meetings. Middle: Crisis News. Right: the
// cabinet's directives and, bottom right, "Waiting for You". Cabinet directives are read and decided in the pop-up
// (ChairDirectivePrompt.tsx), never inline. Below 1024px the cards stack, Waiting for You first.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Boxes, CalendarCheck, CalendarClock, ChevronRight, MonitorPlay, Newspaper, ScrollText } from 'lucide-react';
import { crisisError, listDirectives, listMeetings, loadChairRooms, loadResources, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import { meetingInProgress } from '@/lib/crisis/meetings';
import { useClockOverlay } from '@/lib/crisis/meetingClockStore';
import type { Directive, Meeting, Resource, ResourceType } from '@/lib/crisis/types';
import { serverNow } from '@/lib/serverClock';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Card, CardTitle, CK, resourceIcon, scenarioLabel, Skeleton, Tick } from '../../crisisKit';
import DirectiveDeepLink from '../notifications/DirectiveDeepLink';
import MeetingHistory from '../meetings/MeetingHistory';
import { useMeetingPeople } from '../meetings/MeetingRequestsStrip';
import StaffMeetingCard from '../meetings/StaffMeetingCard';
import { useMeetingResponses } from '../meetings/useMeetingResponses';
import { useCrisisNews } from '../news/useCrisisNews';
import { cabinetDirectivesOf, CrisisNewsList } from '../command/cabinetFeeds';
import { ChairDirectiveRow, openChairDirective } from './chairDirectiveKit';
import ChairWaitingCard from './ChairWaitingCard';

interface Room { cabinetId: string; name: string; code: string | null; chairPassword: string | null }

/** The room each of the chair's cabinets sits in: its code and chair password, from the database's chair-only read
 *  (a chair cannot read the committees table). */
async function loadRooms(ref: CrisisRef, cabinets: Array<{ id: string; name: string }>): Promise<Room[]> {
  const rows = await loadChairRooms(ref);
  const byCabinet = new Map(rows.map((x) => [x.cabinet_id, x]));
  return cabinets.map((c) => {
    const row = byCabinet.get(c.id);
    return { cabinetId: c.id, name: c.name, code: row?.code ?? null, chairPassword: row?.chair_password ?? null };
  });
}

/** The cabinet's meetings on the Front Room, read only: those still asking the others, approved ones (the one running first, with
 *  its clock) and, collapsed, what was held. Requests waiting for a yes or no are listed first. A chair sees these and may run
 *  the clock; only the backroom decides (owner, 1 Nov 2026). */
function ChairMeetings() {
  const { ref, core, cabinetId } = useCrisis();
  const people = useMeetingPeople(ref, true);
  const [fetched, setFetched] = useState<Meeting[] | null>(null);
  const meetings = useClockOverlay(fetched);
  const [now, setNow] = useState(() => serverNow());
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try { const r = await listMeetings(ref); if (mine === seq.current) setFetched(r); }
    catch { /* a failed re-read keeps what is on screen; the next ping or poll tries again */ }
  }, [ref]);
  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    const tick = window.setInterval(() => setNow(serverNow()), 30_000);
    return () => { window.clearTimeout(t); window.clearInterval(tick); };
  }, [load]);
  useCrisisLive(ref.id, ['crisis_meetings'], () => { void load(); });

  // Only meetings that involve a character of this cabinet, never another cabinet's (docs/crisis/sql/039).
  const involvesMine = useCallback((m: Meeting): boolean => {
    if (!cabinetId) return true;
    const ids = [...m.character_ids, ...(m.requested_by_character ? [m.requested_by_character] : [])];
    return ids.some((id) => (people.get(id)?.cabinet_id ?? core.characters.find((c) => c.id === id)?.cabinet_id) === cabinetId);
  }, [cabinetId, people, core.characters]);
  const mine = useMemo(() => (meetings ?? []).filter((m) => involvesMine(m)), [meetings, involvesMine]);
  const approved = useMemo(
    () => mine.filter((m) => m.status === 'approved').sort((x, y) => Number(meetingInProgress(y)) - Number(meetingInProgress(x)) || new Date(y.decided_at ?? y.created_at).getTime() - new Date(x.decided_at ?? x.created_at).getTime()),
    [mine],
  );
  const asking = useMemo(() => mine.filter((m) => m.status === 'awaiting_delegates'), [mine]);
  const waiting = useMemo(() => mine.filter((m) => m.status === 'pending'), [mine]);
  const { responses } = useMeetingResponses(ref, true, asking.length > 0);
  const past = useMemo(() => mine.filter((m) => m.status !== 'awaiting_delegates' && m.status !== 'pending' && m.status !== 'approved'), [mine]);
  const running = approved.filter(meetingInProgress).length;

  return (
    <Card warm className="fr-pane fr-grow">
      <CardTitle
        icon={<CalendarCheck size={18} strokeWidth={1.5} />}
        right={
          <Link
            href={`${crisisBase(ref)}/meetings`}
            className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ fontSize: 13, fontWeight: 800, color: CK.forest, textDecoration: 'underline' }}
          >
            All meetings<ChevronRight size={14} strokeWidth={1.6} aria-hidden />
          </Link>
        }
      >
        Meetings
      </CardTitle>
      <div className="fr-body">
      {meetings === null ? <Skeleton h={90} r={18} /> : (
        <>
          {approved.length > 0 && (
            <p className="flex items-baseline gap-2" style={{ margin: 0 }}>
              <b style={{ fontSize: 24, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ok }}>{approved.length}</b>
              <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>approved{running > 0 ? `, ${running} running now` : ''}</span>
            </p>
          )}
          {approved.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No meetings are approved yet.</p>}
          {waiting.map((m) => (
            <StaffMeetingCard key={m.id} m={m} refx={ref} people={people} cabinets={core.cabinets} members={core.members} canAct={false} onChanged={() => void load()} now={now} />
          ))}
          {asking.map((m) => (
            <StaffMeetingCard key={m.id} m={m} refx={ref} people={people} cabinets={core.cabinets} members={core.members} canAct={false} onChanged={() => void load()} now={now} responses={responses} />
          ))}
          {approved.map((m) => (
            <StaffMeetingCard key={m.id} m={m} refx={ref} people={people} cabinets={core.cabinets} members={core.members} canAct={false} canClock={involvesMine(m)} onChanged={() => void load()} now={now} />
          ))}
          <MeetingHistory meetings={past} people={people} now={now} />
        </>
      )}
      </div>
    </Card>
  );
}

const DASH_CSS = `
.fr-wrap { display: flex; flex-direction: column; gap: 12px; padding-top: 6px; }
.fr-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.fr-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
@media (max-width: 1023px) { .fr-col-c { order: -1; } }
@media (min-width: 1024px) and (min-height: 620px) {
  .fr-wrap { height: calc(100dvh - 78px); }
  .fr-grid { flex: 1; min-height: 0; grid-template-columns: minmax(0, 1fr) minmax(0, 1.12fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
  .fr-col { min-height: 0; }
  .fr-pane { display: flex; flex-direction: column; min-height: 0; }
  .fr-grow { flex: 1 1 0; }
  .fr-fixed { flex: none; }
  .fr-body { flex: 1; min-height: 0; overflow-y: auto; }
  .fr-body-cap { max-height: 24dvh; overflow-y: auto; }
}
`;

export default function ChairHome() {
  const v = useCrisis();
  const { ref, cabinetId, core } = v;
  const { items: news } = useCrisisNews(ref);

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [res, setRes] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deepTick, setDeepTick] = useState(0);
  const seq = useRef({ d: 0, r: 0 });
  const deepId = useRef<string | null>(null);

  const myCabinets = useMemo(() => (cabinetId ? core.cabinets.filter((c) => c.id === cabinetId) : core.cabinets), [core.cabinets, cabinetId]);

  useEffect(() => {
    let cancelled = false;
    loadRooms(ref, myCabinets)
      .then((r) => { if (!cancelled) setRooms(r); })
      .catch(() => { if (!cancelled) setRooms(myCabinets.map((c) => ({ cabinetId: c.id, name: c.name, code: null, chairPassword: null }))); });
    return () => { cancelled = true; };
  }, [ref, myCabinets]);

  const readDirectives = useCallback(async () => {
    const mine = ++seq.current.d;
    try { const d = await listDirectives(ref); if (mine === seq.current.d) { setDirectives(d); setError(null); } }
    catch (e) { if (mine === seq.current.d) setError(crisisError(e, 'Could not refresh this page.')); }
  }, [ref]);
  const readResources = useCallback(async () => {
    const mine = ++seq.current.r;
    try { const r = await loadResources(ref); if (mine === seq.current.r) { setRes(r); setError(null); } }
    catch (e) { if (mine === seq.current.r) setError(crisisError(e, 'Could not refresh this page.')); }
  }, [ref]);

  useEffect(() => {
    const t = window.setTimeout(() => { void readDirectives(); void readResources(); }, 0);
    return () => window.clearTimeout(t);
  }, [readDirectives, readResources]);
  useCrisisLive(ref.id, ['crisis_directives', 'crisis_resources', 'crisis_resource_types'], (changed) => {
    if (changed === null || changed.has('crisis_directives')) void readDirectives();
    if (changed === null || changed.has('crisis_resources') || changed.has('crisis_resource_types')) void readResources();
  });

  // A notification link (?d=<directive id>) opens that directive in the pop-up once the list is read.
  const onDeepId = useCallback((id: string) => { deepId.current = id; setDeepTick((x) => x + 1); }, []);
  useEffect(() => {
    void deepTick;
    const id = deepId.current;
    if (!id || !directives) return;
    deepId.current = null;
    const hit = directives.find((d) => d.id === id);
    if (hit) openChairDirective(hit);
  }, [deepTick, directives]);

  const crisis = core.crisis;
  const typeById = useMemo(() => new Map((res?.types ?? []).map((t) => [t.id, t])), [res]);
  const cabinetRes = (res?.resources ?? []).filter((r) => r.cabinet_id && (cabinetId ? r.cabinet_id === cabinetId : true));
  // Only this chair's cabinet: the Front Room is projected to the room (docs/crisis/sql/039).
  const cabinetList = useMemo(() => cabinetDirectivesOf(directives, cabinetId), [directives, cabinetId]);

  return (
    <div className="fr-wrap">
      <style>{DASH_CSS}</style>
      <DirectiveDeepLink onId={onDeepId} />
      <header className="flex items-center justify-between flex-wrap" style={{ gap: '4px 16px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: CK.ink }}>Front Room</h1>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: CK.inkSoft }}>
          <CalendarClock size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />
          {scenarioLabel(crisis.scenario_at)}
        </span>
        {error && <p role="status" style={{ flexBasis: '100%', margin: 0, fontSize: 13, color: CK.danger }}>{error}</p>}
      </header>

      <div className="fr-grid">
        <div className="fr-col">
          <Card warm className="fr-fixed">
            <CardTitle icon={<MonitorPlay size={18} strokeWidth={1.5} />}>Chair Console</CardTitle>
            {rooms === null ? <Skeleton h={40} r={12} /> : (
              <div className="grid gap-2">
                {rooms.map((r) => (
                  <div key={r.cabinetId} className="flex items-center justify-between gap-3 flex-wrap">
                    <span style={{ fontSize: 14, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>{r.name}</span>
                    {r.code ? (
                      <Link
                        // A crisis chair joins through the join page (like the Crisis Director's "Join as chair"); /chair/<code> alone is the read-only view.
                        href={`/join?code=${encodeURIComponent(r.chairPassword ? `${r.code}-${r.chairPassword}` : r.code)}&mode=chair`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                        style={{ textDecoration: 'none', borderRadius: 11, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, background: CK.greenBtn, color: '#FFFFFF', boxShadow: CK.shadowSm }}
                      >
                        <MonitorPlay size={15} strokeWidth={1.5} aria-hidden />
                        Open chair console
                      </Link>
                    ) : (
                      <span style={{ fontSize: 13, color: CK.muted }}>The committee room is not ready yet</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="fr-pane fr-fixed">
            <CardTitle icon={<Boxes size={18} strokeWidth={1.5} />}>Cabinet Resources</CardTitle>
            <div className="fr-body-cap">
              {res === null ? <Skeleton h={30} /> : cabinetRes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No resources yet.</p>
              ) : (
                <div className="grid gap-x-4 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))' }}>
                  {cabinetRes.map((r) => {
                    const t = typeById.get(r.type_id);
                    const cab = !cabinetId && core.cabinets.length > 1 ? core.cabinets.find((c) => c.id === r.cabinet_id)?.name : null;
                    return (
                      <div key={r.id} className="flex items-start" style={{ gap: 8, minWidth: 0 }}>
                        <span style={{ color: CK.red, lineHeight: 0, paddingTop: 3 }}>{resourceIcon(t?.name ?? '', 18)}</span>
                        <span style={{ minWidth: 0 }}>
                          <b style={{ display: 'block', fontSize: 22, lineHeight: 1.05, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: CK.ink }}><Tick value={Number(r.amount).toLocaleString()} /></b>
                          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{`${t?.name ?? 'Resource'}${t?.unit ? ` (${t.unit})` : ''}`}</span>
                          {cab && <span style={{ display: 'block', fontSize: 11.5, color: CK.muted, overflowWrap: 'anywhere' }}>{cab}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <ChairMeetings />
        </div>

        <div className="fr-col">
          <Card warm className="fr-pane fr-grow" >
            <CardTitle icon={<Newspaper size={18} strokeWidth={1.5} />}>Crisis News</CardTitle>
            <div className="fr-body"><CrisisNewsList news={news} cabinetId={cabinetId} /></div>
          </Card>
        </div>

        <div className="fr-col fr-col-c">
          <Card warm className="fr-pane fr-grow">
            <CardTitle
              icon={<ScrollText size={18} strokeWidth={1.5} />}
              right={cabinetList !== null && (
                <span className="inline-flex items-baseline" style={{ gap: 6 }}>
                  <b style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink }}><Tick value={cabinetList.length} /></b>
                  <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>sent</span>
                </span>
              )}
            >
              Cabinet Directives
            </CardTitle>
            <div className="fr-body">
              {cabinetList === null ? <div className="grid gap-2"><Skeleton h={46} r={12} /><Skeleton h={46} r={12} /></div>
                : cabinetList.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>No cabinet directives yet.</p>
                : cabinetList.slice(0, 8).map((d) => <ChairDirectiveRow key={d.id} d={d} />)}
              <Link
                href={`${crisisBase(ref)}/directives`}
                className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: CK.forest, textDecoration: 'underline' }}
              >
                All directives<ChevronRight size={14} strokeWidth={1.6} aria-hidden />
              </Link>
            </div>
          </Card>
          <ChairWaitingCard directives={directives} />
        </div>
      </div>
    </div>
  );
}
