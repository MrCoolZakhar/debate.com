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
import { Card, CardTitle, CK, Skeleton } from '../../crisisKit';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { loadLastChanges } from './commandData';
import { ApprovalCard, CommandHeader, LinkBtn, NewsCard, ResourcesCard } from './commandParts';
import { DirectiveDrawer, WaitingCard } from './commandQueue';
import { BackroomCard, FrontRoomsCard } from './commandRooms';

const WarMap = dynamic(() => import('../map/WarMap'), {
  ssr: false,
  loading: () => <Skeleton h={300} r={16} />,
});

// Crisis Command fits one screen from 1240px wide: the grid takes the height left under the header
// (56px bar, 4px top, 8px page top, 48px strip, 10px gap, 18px bottom), every card scrolls inside itself
// and the map fills its cell. Below 1240px the cards stack and the page scrolls as usual.
const GRID_CSS = `
.cmd-grid { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "map" "needs" "side" "res"; }
.cmd-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.cmd-needs { grid-area: needs; } .cmd-map { grid-area: map; min-width: 0; } .cmd-side { grid-area: side; } .cmd-res { grid-area: res; min-width: 0; }
.cmd-mapbox { position: relative; height: clamp(320px, 50vh, 560px); border-radius: 16px; overflow: hidden; }
@media (min-width: 768px) and (max-width: 1239px) {
  .cmd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "map map" "needs side" "res res"; }
}
@media (min-width: 1240px) {
  .cmd-grid { height: calc(100dvh - 146px); min-height: 540px; grid-template-columns: minmax(300px, 330px) minmax(0, 1fr) minmax(290px, 320px); grid-template-rows: minmax(0, 1fr) auto; grid-template-areas: "needs map side" "needs res side"; }
  .cmd-col { min-height: 0; }
  .cmd-map > section { height: 100%; overflow: hidden; }
  .cmd-mapbox { flex: 1 1 0; height: auto; min-height: 0; }
  .cmd-mapbox .wm-root { min-height: 0; }
  .cmd-mapbox .wm-body { min-height: 0; }
  .cmd-card { min-height: 0; overflow: auto; flex: 0 1 auto; }
  .cmd-wait { flex: 1 1 0; min-height: 0; display: flex; }
  .cmd-wait > section { flex: 1; min-height: 0; overflow: auto; }
  .cmd-needs > .cmd-card:nth-child(2) { max-height: 30%; }
  .cmd-needs > .cmd-card:nth-child(3) { max-height: 27%; }
  .cmd-side > .cmd-card:first-child { max-height: 55%; }
  .cmd-side > .cmd-card:last-child { flex: 1 1 0; }
  .cmd-res > .cmd-card { max-height: 210px; }
}
`;

export default function CommandPage() {
  const v = useCrisis();
  const { ref, core, reloadCore } = v;
  const base = crisisBase(ref);

  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [news, setNews] = useState<News[] | null>(null);
  const [res, setRes] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [changes, setChanges] = useState<Map<string, number>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seq = useRef({ d: 0, n: 0, r: 0 });
  const failedOnce = useRef({ d: false, n: false, r: false });

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

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
    <div style={{ paddingTop: 8 }}>
      <style>{GRID_CSS}</style>
      <CommandHeader
        crisis={crisis}
        cref={ref}
        acronym={v.conference.acronym}
        logoUrl={v.conference.logo_url}
        members={core.members}
        now={now}
        onChanged={() => { void reloadCore(); }}
      />

      <div className="cmd-grid">
        <section className="cmd-col cmd-needs">
          <div className="cmd-wait">
            <WaitingCard directives={directives} base={base} now={now} onOpen={(d) => setOpen(d.id)} />
          </div>
          <ApprovalCard news={news} cabinets={core.cabinets} members={core.members} cref={ref} base={base} now={now} onChanged={() => { void readNews(); }} />
          <NewsCard news={news} cabinets={core.cabinets} members={core.members} base={base} now={now} />
        </section>

        <section className="cmd-map">
          <Card style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px 14px' }}>
            <CardTitle
              icon={<MapIcon size={17} strokeWidth={1.5} />}
              right={<LinkBtn href={`${base}/map`}>Open the full map</LinkBtn>}
            >
              War Map
            </CardTitle>
            <div className="cmd-mapbox">
              <WarMap compact />
            </div>
          </Card>
        </section>

        <section className="cmd-col cmd-side">
          <FrontRoomsCard cref={ref} cabinets={core.cabinets} base={base} />
          <BackroomCard cref={ref} members={core.members} directives={directives} base={base} onChanged={() => { void readDirectives(); }} />
        </section>

        <section className="cmd-res">
          <ResourcesCard cabinets={core.cabinets} types={res?.types ?? []} resources={res?.resources ?? []} changes={changes} loaded={res !== null} base={base} />
        </section>
      </div>

      {openDirective && <DirectiveDrawer directive={openDirective} onClose={closeDrawer} />}
    </div>
  );
}
