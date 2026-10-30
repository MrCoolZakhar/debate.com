'use client';
// Gavelling Crisis: the chair's home, "Front Room". The live chair console, the in-world date,
// the news, the directives the chair may read and the cabinet's resources.

import { dirNumber } from '@/lib/crisis/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Boxes, CalendarClock, MonitorPlay, Newspaper, ScrollText } from 'lucide-react';
import { crisisError, listDirectives, loadResources, type CrisisRef } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { useCrisisLive } from '@/lib/crisis/live';
import { KIND_LABEL, type Directive, type Resource, type ResourceType } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { BigCount, Card, CardTitle, CK, scenarioLabel, Skeleton } from '../../crisisKit';
import { StatusLine, whenLabel } from '../delegate/directiveUi';
import ChairApproval from './ChairApproval';
import { CharacterName } from '../character/CharacterProfileHost';
import MeetingRequestsStrip from '../meetings/MeetingRequestsStrip';
import { useCrisisNews } from '../news/useCrisisNews';
import { plainText } from '../directives/attachedImage';
import { CabinetDirectivesList, CrisisNewsList } from '../command/cabinetFeeds';

interface Room { cabinetId: string; name: string; code: string | null; chairPassword: string | null }

/** The live room of each cabinet's conference committee: its code and chair password (committees.settings.chairJoinSuffix, readable
 *  by the room's code), the same read the Crisis Director's "Join as chair" uses (command/commandData.ts). */
async function loadRooms(ref: CrisisRef, cabinets: Array<{ id: string; name: string; conference_committee_id: string | null }>): Promise<Room[]> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const ids = cabinets.map((c) => c.conference_committee_id).filter((x): x is string => !!x);
  const links = new Map<string, { session_id: string | null; session_code: string | null }>();
  const rooms = new Map<string, { code: string | null; chairPassword: string | null }>();
  if (ids.length) {
    const r = await client.from('conference_committees').select('id, session_id, session_code').in('id', ids);
    for (const row of (r.data ?? []) as Array<{ id: string; session_id: string | null; session_code: string | null }>) links.set(row.id, row);
    const sids = [...links.values()].map((l) => l.session_id).filter((x): x is string => !!x);
    if (sids.length) {
      const cm = await client.from('committees').select('id, code, settings').in('id', sids);
      for (const row of (cm.data ?? []) as Array<{ id: string; code: string | null; settings: { chairJoinSuffix?: unknown } | null }>) {
        const pw = row.settings?.chairJoinSuffix;
        rooms.set(row.id, { code: row.code, chairPassword: typeof pw === 'string' && pw ? pw : null });
      }
    }
  }
  return cabinets.map((c) => {
    const link = c.conference_committee_id ? links.get(c.conference_committee_id) : undefined;
    const room = link?.session_id ? rooms.get(link.session_id) : undefined;
    return { cabinetId: c.id, name: c.name, code: room?.code ?? link?.session_code ?? null, chairPassword: room?.chairPassword ?? null };
  });
}

export default function ChairHome() {
  const v = useCrisis();
  const { ref, cabinetId, core } = v;
  const { items: news } = useCrisisNews(ref);

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [res, setRes] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef({ d: 0, r: 0 });

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

  const crisis = core.crisis;
  const typeById = useMemo(() => new Map((res?.types ?? []).map((t) => [t.id, t])), [res]);
  const cabinetRes = (res?.resources ?? []).filter((r) => r.cabinet_id && (cabinetId ? r.cabinet_id === cabinetId : true));
  // Cabinet directives (waiting or sent on) live in the approval card above; the rest is listed here.
  const otherDirectives = useMemo(() => (directives ?? []).filter((d) => d.kind !== 'committee'), [directives]);
  const charName = useCallback((id: string | null) => core.characters.find((c) => c.id === id)?.name ?? null, [core.characters]);

  return (
    <div style={{ paddingTop: 8 }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: CK.ink }}>Front Room</h1>
        <span className="inline-flex items-center gap-1.5" style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: CK.inkSoft }}>
          <CalendarClock size={16} strokeWidth={1.5} aria-hidden />
          {scenarioLabel(crisis.scenario_at)}
        </span>
        {error && <p role="status" style={{ margin: '6px 0 0', fontSize: 13, color: CK.danger }}>{error}</p>}
      </header>

      <MeetingRequestsStrip bottomGap={16} />

      <div style={{ marginBottom: 16 }}>
        <ChairApproval
          cref={ref}
          directives={directives}
          cabinetId={cabinetId}
          characters={core.characters}
          members={core.members}
          cabinets={core.cabinets}
          onChanged={() => { void readDirectives(); }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 items-start">
        <div className="grid gap-4">
          <Card warm>
            <CardTitle icon={<MonitorPlay size={18} strokeWidth={1.5} />} sub="The committee room where your committee debates.">Chair Console</CardTitle>
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
                      <span style={{ fontSize: 13, color: CK.muted }}>The committee room is not ready yet.</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle icon={<Boxes size={18} strokeWidth={1.5} />}>Cabinet Resources</CardTitle>
            {res === null ? <Skeleton h={30} /> : cabinetRes.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No resources yet.</p>
            ) : (
              <div className="grid gap-3">
                {cabinetRes.map((r) => {
                  const t = typeById.get(r.type_id);
                  const cab = !cabinetId && core.cabinets.length > 1 ? core.cabinets.find((c) => c.id === r.cabinet_id)?.name : null;
                  return (
                    <div key={r.id}>
                      <BigCount n={Number(r.amount).toLocaleString()} word={`${t?.name ?? 'Resource'}${t?.unit ? ` (${t.unit})` : ''}`} />
                      {cab && <span style={{ display: 'block', fontSize: 12, color: CK.muted, marginTop: 2 }}>{cab}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <section aria-label="Crisis News" className="min-w-0">
          <Card warm>
            <CardTitle icon={<Newspaper size={18} strokeWidth={1.5} />} sub="What your cabinet and every room has been told.">Crisis News</CardTitle>
            <CrisisNewsList news={news} cabinetId={cabinetId} />
          </Card>
        </section>

        <section aria-label="Directives" className="min-w-0 lg:col-span-2 xl:col-span-1">
          {/* The same list the Crisis Director sees in this cabinet's room pop-up on Command (command/cabinetFeeds.tsx). */}
          <Card warm style={{ marginBottom: otherDirectives.length ? 12 : 0 }}>
            <CardTitle icon={<ScrollText size={18} strokeWidth={1.5} />} sub="Sent in your cabinet's name, with where each one stands.">Cabinet Directives</CardTitle>
            <CabinetDirectivesList directives={directives} cabinetId={cabinetId} />
          </Card>
          {otherDirectives.length > 0 && <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: CK.ink }}>Other Directives</h2>}
          <div className="grid gap-3">
            {otherDirectives.map((d) => (
              <Card key={d.id}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: CK.muted }}>Directive {dirNumber(d)} · {KIND_LABEL[d.kind]} · {whenLabel(d.created_at)}</p>
                <h3 style={{ margin: '2px 0 4px', fontSize: 15, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</h3>
                <StatusLine s={d.status} />
                {charName(d.author_character_id) && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>From <CharacterName id={d.author_character_id} name={charName(d.author_character_id)} /></p>}
                <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.5, color: CK.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{plainText(d.body)}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
