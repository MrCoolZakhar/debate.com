'use client';
// Gavelling Crisis: resources. Typed counters per cabinet and per character, a reason on every change.
// Staff and chairs see everything; delegates see what the database lets them (their cabinet and themselves).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Plus } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, loadResources } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Resource, ResourceType } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, Skeleton, waitLabel } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import AddResourceType from './AddResourceType';
import ResourceTile, { signed, type LastChange } from './ResourceTile';

interface LogRow { id: string; resource_id: string; delta: number; amount_after: number; reason: string | null; member_id: string | null; created_at: string }

export default function ResourcesPage() {
  const { ref, role, staff, director, settings, core } = useCrisis();
  const [data, setData] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const canEdit = director || (role === 'backroomer' && settings.backroomPowers.resources);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const read = useCallback(async () => {
    const d = await loadResources(ref);
    let rows: LogRow[] = [];
    if (staff) {
      const client = await getCrisisClient(ref.conf, ref.crisis);
      const res = await client.from('crisis_resource_log').select('id, resource_id, delta, amount_after, reason, member_id, created_at').eq('crisis_id', ref.id).order('created_at', { ascending: false }).limit(300);
      if (!res.error) rows = res.data as LogRow[];
    }
    return { d, rows };
  }, [ref, staff]);

  const apply = useCallback((r: { d: { types: ResourceType[]; resources: Resource[] }; rows: LogRow[] }) => { setData(r.d); setLog(r.rows); setError(null); }, []);

  useEffect(() => {
    let cancelled = false;
    read().then((r) => { if (!cancelled) apply(r); }).catch((e) => { if (!cancelled) setError(crisisError(e, 'Could not load the resources.')); });
    return () => { cancelled = true; };
  }, [read, apply]);
  useCrisisLive(ref.id, ['crisis_resources', 'crisis_resource_types'], () => {
    read().then(apply).catch((e) => notifyErr(crisisError(e, 'Could not refresh the resources.'), 'crisis-resources-refresh'));
  });

  const byKey = useMemo(() => {
    const m = new Map<string, Resource>();
    for (const r of data?.resources ?? []) m.set(`${r.type_id}:${r.cabinet_id ?? ''}:${r.character_id ?? ''}`, r);
    return m;
  }, [data]);
  const lastByResource = useMemo(() => {
    const m = new Map<string, LastChange>();
    for (const l of log) if (!m.has(l.resource_id)) m.set(l.resource_id, { delta: Number(l.delta), reason: l.reason });
    return m;
  }, [log]);

  if (error && !data) return <Card style={{ marginTop: 8 }}><p role="alert" style={{ margin: 0, color: CK.red, fontWeight: 700 }}>{error}</p></Card>;
  if (!data) return <div className="flex flex-col" style={{ gap: 12, marginTop: 8 }}><Skeleton h={28} w={220} /><Skeleton h={130} r={22} /><Skeleton h={130} r={22} /></div>;

  const cabinetTypes = data.types.filter((t) => t.scope === 'cabinet');
  const characterTypes = data.types.filter((t) => t.scope === 'character');
  const resById = new Map(data.resources.map((r) => [r.id, r]));
  const typeById = new Map(data.types.map((t) => [t.id, t]));

  const describe = (r: Resource | undefined): string => {
    if (!r) return 'Removed resource';
    const t = typeById.get(r.type_id)?.name ?? 'Resource';
    const who = r.character_id ? core.characters.find((c) => c.id === r.character_id)?.name : core.cabinets.find((c) => c.id === r.cabinet_id)?.name;
    return who ? `${t}, ${who}` : t;
  };

  // A delegate sees only the cabinets the database let through; staff see all.
  const visibleCabinets = core.cabinets.filter((cab) => staff || data.resources.some((r) => r.cabinet_id === cab.id) || core.characters.some((ch) => ch.cabinet_id === cab.id && data.resources.some((r) => r.character_id === ch.id)));

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap" style={{ margin: '8px 0 14px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: CK.ink }}>Resources</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13.5, color: CK.inkSoft }}>{staff ? 'Every change needs a reason, and the log keeps it.' : 'What your cabinet and you hold.'}</p>
        </div>
        {canEdit && !adding && <Btn tone="green" icon={<Plus size={15} strokeWidth={1.5} aria-hidden />} onClick={() => setAdding(true)}>Add a resource type</Btn>}
      </div>

      {adding && <AddResourceType refx={ref} onClose={() => setAdding(false)} />}

      {!data.types.length && <Card><p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>{canEdit ? 'No resources yet. Add the first type to start.' : 'No resources have been set up yet.'}</p></Card>}

      <div className="flex flex-col" style={{ gap: 18 }}>
        {visibleCabinets.map((cab) => {
          const chars = core.characters.filter((c) => c.cabinet_id === cab.id && c.status !== 'spare');
          const hasAny = cabinetTypes.length > 0 || characterTypes.length > 0;
          if (!hasAny) return null;
          return (
            <Card key={cab.id}>
              <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                {cab.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cab.logo_url} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#FDFCF9', boxShadow: '0 2px 8px rgba(27,56,40,0.18)' }} />
                ) : <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', background: cab.color, boxShadow: '0 2px 8px rgba(27,56,40,0.18)', flex: 'none' }} />}
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{cab.name}</h2>
              </div>
              {cabinetTypes.length > 0 && (
                <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                  {cabinetTypes.map((t) => {
                    const r = byKey.get(`${t.id}:${cab.id}:`) ?? null;
                    if (!r && !canEdit) return null;
                    return <ResourceTile key={t.id} refx={ref} type={t} resource={r} target={{ cabinet_id: cab.id }} last={r ? lastByResource.get(r.id) ?? null : null} canEdit={canEdit} />;
                  })}
                </div>
              )}
              {characterTypes.map((t) => {
                const tiles = chars.map((ch) => ({ ch, r: byKey.get(`${t.id}::${ch.id}`) ?? null })).filter((x) => x.r || canEdit);
                if (!tiles.length) return null;
                return (
                  <div key={t.id} style={{ marginTop: 16 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: CK.inkSoft }}>{t.name} per character</p>
                    <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                      {tiles.map(({ ch, r }) => (
                        <ResourceTile key={ch.id} refx={ref} type={t} resource={r} target={{ character_id: ch.id }} last={r ? lastByResource.get(r.id) ?? null : null} canEdit={canEdit}
                          who={{ name: ch.name, picture_url: ch.picture_url, color: cab.color }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>

      {staff && (
        <Card style={{ marginTop: 18 }}>
          <CardTitle icon={<History size={17} strokeWidth={1.5} aria-hidden />} right={<span><b style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>{log.length}</b> <span style={{ fontSize: 13, color: CK.inkSoft, fontWeight: 600 }}>changes</span></span>}>Change log</CardTitle>
          {!log.length && <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No changes yet.</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {log.map((l) => {
              const who = core.members.find((m) => m.id === l.member_id)?.display_name ?? 'The system';
              return (
                <li key={l.id} className="flex items-baseline gap-3 flex-wrap" style={{ padding: '8px 0', borderTop: `1px solid ${CK.hair}` }}>
                  <span style={{ width: 70, fontSize: 12, color: CK.muted, fontWeight: 600 }}>{waitLabel(l.created_at, now)}</span>
                  <b style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: Number(l.delta) < 0 ? CK.danger : CK.ok, minWidth: 48 }}>{signed(Number(l.delta))}</b>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>{describe(resById.get(l.resource_id))}</span>
                  <span style={{ fontSize: 13, color: CK.inkSoft, overflowWrap: 'anywhere', flex: '1 1 200px' }}>{l.reason ?? 'No reason given'} · {who}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
