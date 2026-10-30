'use client';
// Gavelling Crisis: Crisis Command, the Crisis Director's home. The in-world date, whether
// directives are open, who is online, what waits for a reply, what needs approval, the war map,
// the front rooms, the backroom and the resources. Design: docs/crisis/design/crisis-dashboard.src.html.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Map as MapIcon } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, listDirectives, listNews, loadResources } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive, News, Resource, ResourceType } from '@/lib/crisis/types';
import { Card, CK, Skeleton } from '../../crisisKit';
import { crisisBase, useCrisis, usePresencePoll } from '../../[conference]/[crisis]/CrisisContext';
import { loadLastChanges } from './commandData';
import { ApprovalCard, CommandHeader, LinkBtn } from './commandParts';
import { ResourcesStrip } from './commandResources';
import { DirectiveDrawer, WaitingCard } from './commandQueue';
import { NeedsAttentionCard } from './commandAttention';
import { FrontRoomsCard, useRoomStates } from './commandRooms';
import StatsDialog, { StatsButton } from './commandStats';
import { serverNow } from '@/lib/serverClock';

const WarMap = dynamic(() => import('../map/WarMap'), {
  ssr: false,
  loading: () => <Skeleton h={300} r={16} />,
});

// Layout (owner, 27 Oct 2026, asked three times: "it's not on one page anymore"). From 1100px wide the page is EXACTLY the
// screen under the top bar and never scrolls: the page is a flex column (header strip, then the grid filling the rest).
// Left: Waiting for a Reply (tall, its list scrolls inside) over Needs Your Approval. Middle: the Map card filling the
// height, with Cabinet Resources directly under it, as tall as its tinted cabinet bands and no taller. Right: Front Rooms
// (the organiser's Live Status cards, smaller; they share the card's height and drop their small rows when short) over
// Needs Attention, which takes whatever is left (meeting requests, the rebalance suggestion, the oldest late directive,
// a room with no chair). Every card is flex with min-height 0, so there are no empty bands. Below 1100px the cards stack
// and the page scrolls. Height maths: 56px top bar + 4px main top padding + 18px main bottom padding = 78px, plus 2px of slack.
const GRID_CSS = `
.cmd-page { display: flex; flex-direction: column; padding-top: 8px; }
.cmd-grid { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "map" "needs" "side"; }
.cmd-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.cmd-needs { grid-area: needs; } .cmd-mapcol { grid-area: map; } .cmd-side { grid-area: side; }
.cmd-mapcard { display: flex; flex-direction: column; padding: 10px 12px 12px; height: clamp(380px, 56vh, 560px); }
.cmd-mapbox { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
.cmd-mapbox .wm-root { flex: 1 1 0; height: auto; min-height: 0; }
.cmd-mapbox .wm-body { min-height: 0; }
@media (min-width: 768px) and (max-width: 1099px) {
  .cmd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "map map" "needs side"; }
}
@media (min-width: 1100px) {
  .cmd-page { height: calc(100dvh - 80px); min-height: 560px; }
  .cmd-grid { flex: 1 1 0; min-height: 0; grid-template-columns: minmax(250px, 23%) minmax(0, 1fr) minmax(340px, 34%); grid-template-rows: minmax(0, 1fr); grid-template-areas: "needs map side"; }
  .cmd-col { min-height: 0; }
  .cmd-col > .cmd-card { min-height: 0; overflow: auto; }
  .cmd-wait { flex: 1 1 0; display: flex; flex-direction: column; overflow: hidden !important; }
  .cmd-scroll { flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 12px 3px 4px; margin: -8px -3px 0; }
  .cmd-approval { flex: 0 1 auto; max-height: 42%; min-height: 96px; }
  .cmd-mapcard { flex: 1 1 0; min-height: 0; height: auto; overflow: hidden; }
  .cmd-col > .cmd-res { flex: 0 1 auto; max-height: 44%; }
  .cmd-col > .cmd-rooms { flex: 0 1 auto; overflow: hidden !important; }
  .cmd-col > .cmd-attn { flex: 1 0 auto; min-height: 92px; max-height: 46%; }
}
/* The map's header: no "See the map as" label (the switch says it), and the title row sits a little higher. */
.cmd-mapbox .wm-see > span:first-child { display: none; }
.cmd-mapcard { padding-top: 7px; }
.cmd-mapbox .wm-root[data-compact] .wm-top { margin-top: -2px; margin-bottom: 5px; }
`;

export default function CommandPage() {
  const v = useCrisis();
  const { ref, core, reloadCore } = v;
  const base = crisisBase(ref);
  usePresencePoll(); // the Online figure: a heartbeat no longer pings the live channel

  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [news, setNews] = useState<News[] | null>(null);
  const [res, setRes] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [changes, setChanges] = useState<Map<string, number>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [stats, setStats] = useState(false);
  const [now, setNow] = useState(() => serverNow());
  const { rooms, failed: roomsFailed } = useRoomStates(ref, core.cabinets);
  const seq = useRef({ d: 0, n: 0, r: 0 });
  const failedOnce = useRef({ d: false, n: false, r: false });

  useEffect(() => { const t = window.setInterval(() => setNow(serverNow()), 30_000); return () => window.clearInterval(t); }, []);

  // A failed re-read keeps what is on screen and says so once; the next ping or poll tries again.
  const failed = useCallback((part: 'd' | 'n' | 'r', e: unknown) => {
    if (failedOnce.current[part]) return;
    failedOnce.current[part] = true;
    notifyErr(crisisError(e, 'Could not refresh this page.'), 'crisis-command-refresh');
  }, []);

  const readDirectives = useCallback(async () => {
    const mine = ++seq.current.d;
    try { const d = await listDirectives(ref); if (mine === seq.current.d) { setDirectives(d); failedOnce.current.d = false; } }
    catch (e) { if (mine === seq.current.d) failed('d', e); }
  }, [ref, failed]);
  const readNews = useCallback(async () => {
    const mine = ++seq.current.n;
    try { const n = await listNews(ref); if (mine === seq.current.n) { setNews(n); failedOnce.current.n = false; } }
    catch (e) { if (mine === seq.current.n) failed('n', e); }
  }, [ref, failed]);
  const readResources = useCallback(async () => {
    const mine = ++seq.current.r;
    try {
      const [r, c] = await Promise.all([loadResources(ref), loadLastChanges(ref)]);
      if (mine === seq.current.r) { setRes(r); setChanges(c); failedOnce.current.r = false; }
    } catch (e) { if (mine === seq.current.r) failed('r', e); }
  }, [ref, failed]);

  useEffect(() => {
    const t = window.setTimeout(() => { void readDirectives(); void readNews(); void readResources(); }, 0);
    return () => window.clearTimeout(t);
  }, [readDirectives, readNews, readResources]);

  useCrisisLive(ref.id, ['crisis_directives', 'crisis_news', 'crisis_resources', 'crisis_members'], (changed) => {
    if (changed === null || changed.has('crisis_directives')) void readDirectives();
    if (changed === null || changed.has('crisis_news')) void readNews();
    if (changed === null || changed.has('crisis_resources')) void readResources();
    if (changed === null || changed.has('crisis_members')) void reloadCore();
  });

  const openDirective = useMemo(() => (open ? directives?.find((d) => d.id === open) ?? null : null), [open, directives]);
  const closeDrawer = useCallback(() => setOpen(null), []);

  if (!v.director) {
    return <Card style={{ marginTop: 8 }}><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>Crisis Command is for the Crisis Director and their assistants.</p></Card>;
  }

  const crisis = core.crisis;
  return (
    <div className="cmd-page">
      <style>{GRID_CSS}</style>
      <CommandHeader
        crisis={crisis}
        cref={ref}
        acronym={v.conference.acronym}
        logoUrl={v.conference.logo_url}
        members={core.members}
        now={now}
        onChanged={() => { void reloadCore(); }}
        extra={<StatsButton onClick={() => setStats(true)} />}
      />

      <div className="cmd-grid">
        <section className="cmd-col cmd-needs">
          <WaitingCard directives={directives} base={base} now={now} onOpen={(d) => setOpen(d.id)} onChanged={() => { void readDirectives(); }} />
          <ApprovalCard news={news} cabinets={core.cabinets} members={core.members} cref={ref} now={now} onChanged={() => { void readNews(); }} />
        </section>

        <section className="cmd-col cmd-mapcol">
          <Card className="cmd-mapcard">
            <div className="cmd-mapbox">
              <WarMap
                compact
                title={<span className="inline-flex items-center" style={{ gap: 7 }}><MapIcon size={17} strokeWidth={1.5} style={{ color: CK.red }} aria-hidden />Map</span>}
                actions={<LinkBtn href={`${base}/map`}>Open the full map</LinkBtn>}
              />
            </div>
          </Card>
          <ResourcesStrip cabinets={core.cabinets} types={res?.types ?? []} resources={res?.resources ?? []} changes={changes} loaded={res !== null} />
        </section>

        <section className="cmd-col cmd-side">
          <FrontRoomsCard cabinets={core.cabinets} conferenceId={v.conference.id} rooms={rooms} failed={roomsFailed} />
          <NeedsAttentionCard
            cref={ref}
            cabinets={core.cabinets}
            members={core.members}
            directives={directives}
            rooms={rooms}
            now={now}
            onOpenDirective={(d) => setOpen(d.id)}
            onChanged={() => { void readDirectives(); }}
          />
        </section>
      </div>

      {stats && <StatsDialog directives={directives} members={core.members} characters={core.characters} cabinets={core.cabinets} now={now} onClose={() => setStats(false)} />}
      {openDirective && <DirectiveDrawer directive={openDirective} directives={directives} onSelect={setOpen} onClose={closeDrawer} />}
    </div>
  );
}
