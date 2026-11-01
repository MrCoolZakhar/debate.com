// Gavelling Crisis: the bulk resource writes behind templates, "copy a cabinet" and removing a type. Resource types and resources
// are written straight through their tables (the 'resources' power is checked by the database policies); every new resource
// logs its own "Starting amount" row. Each write asks for the rows back and counts them.

import { crisisError, loadResources, type CrisisRef } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import type { Cabinet, Character, Resource, ResourceType } from '@/lib/crisis/types';
import { UserFacingError } from '@/lib/friendlyError';
import type { TemplateScope } from '@/lib/crisis/resourceTemplates';

const BATCH = 100;

export const typeKey = (name: string) => name.trim().toLowerCase();
const resKey = (typeId: string, cabinetId: string | null, characterId: string | null) => `${typeId}:${cabinetId ?? ''}:${characterId ?? ''}`;

export interface PlanLine { key: string; name: string; unit: string; scope: TemplateScope; amount: number }
export interface NewRow { cabinet_id: string | null; character_id: string | null; amount: number }
export interface PlannedLine {
  line: PlanLine;
  /** The type that already has this name, or null when it will be made. */
  existing: ResourceType | null;
  /** An existing type keeps its own scope. */
  scope: TemplateScope;
  /** The amounts that do not exist yet. */
  rows: NewRow[];
}

/** What a template would make, line by line, against what the crisis already has. Pure: the screen shows it, the write follows it. */
export function planLines(lines: PlanLine[], types: ResourceType[], resources: Resource[], targetCabinets: Cabinet[], characters: Character[]): PlannedLine[] {
  const byName = new Map(types.map((t) => [typeKey(t.name), t]));
  const have = new Set(resources.map((r) => resKey(r.type_id, r.cabinet_id, r.character_id)));
  return lines.map((line) => {
    const existing = byName.get(typeKey(line.name)) ?? null;
    const scope: TemplateScope = existing ? existing.scope : line.scope;
    const rows: NewRow[] = [];
    for (const cab of targetCabinets) {
      if (scope === 'cabinet') {
        if (!existing || !have.has(resKey(existing.id, cab.id, null))) rows.push({ cabinet_id: cab.id, character_id: null, amount: line.amount });
      } else {
        for (const ch of characters) {
          if (ch.cabinet_id !== cab.id || ch.status === 'spare') continue;
          if (!existing || !have.has(resKey(existing.id, null, ch.id))) rows.push({ cabinet_id: null, character_id: ch.id, amount: line.amount });
        }
      }
    }
    return { line, existing, scope, rows };
  });
}

async function insertRows(ref: CrisisRef, rows: Array<{ type_id: string } & NewRow>): Promise<number> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((r) => ({
      crisis_id: ref.id, type_id: r.type_id, amount: r.amount,
      ...(r.cabinet_id ? { cabinet_id: r.cabinet_id } : {}),
      ...(r.character_id ? { character_id: r.character_id } : {}),
    }));
    const res = await client.from('crisis_resources').insert(chunk).select('id');
    if (res.error || (res.data?.length ?? 0) !== chunk.length) {
      const sofar = done + (res.data?.length ?? 0);
      throw new UserFacingError(`${crisisError(res.error, 'Could not add the resources.')}${sofar > 0 ? ` ${sofar} were added before it stopped.` : ''}`);
    }
    done += chunk.length;
  }
  return done;
}

export interface RunResult { typesAdded: number; resourcesAdded: number }

/** Makes the ticked template lines: the missing types, then the missing amounts for the target cabinets. Reads the crisis fresh first. */
export async function runTemplateLines(ref: CrisisRef, lines: PlanLine[], targetCabinets: Cabinet[], characters: Character[]): Promise<RunResult> {
  const fresh = await loadResources(ref);
  const planned = planLines(lines, fresh.types, fresh.resources, targetCabinets, characters);
  const client = await getCrisisClient(ref.conf, ref.crisis);

  // The new types, after the ones that exist.
  const make = planned.filter((p) => !p.existing);
  const idByName = new Map<string, string>();
  for (const p of planned) if (p.existing) idByName.set(typeKey(p.line.name), p.existing.id);
  let typesAdded = 0;
  if (make.length) {
    const start = fresh.types.reduce((m, t) => Math.max(m, t.sort ?? 0), 0) + 1;
    const res = await client.from('crisis_resource_types')
      .insert(make.map((p, i) => ({ crisis_id: ref.id, name: p.line.name.trim(), unit: p.line.unit.trim() || null, scope: p.line.scope, sort: start + i })))
      .select('id, name');
    if (res.error || (res.data?.length ?? 0) !== make.length) throw new UserFacingError(crisisError(res.error, 'Could not add the resource types.'));
    for (const t of res.data as Array<{ id: string; name: string }>) idByName.set(typeKey(t.name), t.id);
    typesAdded = make.length;
  }

  const rows: Array<{ type_id: string } & NewRow> = [];
  for (const p of planned) {
    const id = idByName.get(typeKey(p.line.name));
    if (!id) continue;
    for (const r of p.rows) rows.push({ type_id: id, ...r });
  }
  const resourcesAdded = rows.length ? await insertRows(ref, rows) : 0;
  return { typesAdded, resourcesAdded };
}

/** Copies chosen cabinet amounts from one cabinet to others. An amount a target already has is left alone. */
export async function copyCabinetAmounts(ref: CrisisRef, items: Array<{ typeId: string; amount: number }>, targetCabinetIds: string[]): Promise<number> {
  const fresh = await loadResources(ref);
  const have = new Set(fresh.resources.map((r) => resKey(r.type_id, r.cabinet_id, r.character_id)));
  const rows: Array<{ type_id: string } & NewRow> = [];
  for (const cabId of targetCabinetIds) {
    for (const it of items) {
      if (have.has(resKey(it.typeId, cabId, null))) continue;
      rows.push({ type_id: it.typeId, cabinet_id: cabId, character_id: null, amount: it.amount });
    }
  }
  return rows.length ? insertRows(ref, rows) : 0;
}

/** Removes a resource type. Its amounts and their history go with it (the database cascades); if it does not, they are removed first. */
export async function deleteResourceType(ref: CrisisRef, typeId: string): Promise<void> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  let res = await client.from('crisis_resource_types').delete().eq('id', typeId).eq('crisis_id', ref.id).select('id');
  if (res.error) {
    const gone = await client.from('crisis_resources').delete().eq('type_id', typeId).eq('crisis_id', ref.id).select('id');
    if (gone.error) throw new UserFacingError(crisisError(gone.error, 'Could not remove the resource.'));
    res = await client.from('crisis_resource_types').delete().eq('id', typeId).eq('crisis_id', ref.id).select('id');
  }
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not remove the resource.'));
}
