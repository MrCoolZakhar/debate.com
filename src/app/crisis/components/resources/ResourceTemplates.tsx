'use client';
// Gavelling Crisis: "Add from a template". One click on a template shows its resources, ready to add: untick what you do not want,
// change a starting amount, pick the cabinet (or every cabinet), and add. The second step REPLACES the list of templates (Back
// returns). A type that already exists by name is never made twice: it is only added to cabinets that do not have it yet.

import { useMemo, useState } from 'react';
import { ArrowLeft, Banknote, Eye, LayoutTemplate, Landmark, Plus, Rocket, Swords, ThumbsUp } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, type CrisisRef } from '@/lib/crisis/api';
import { RESOURCE_TEMPLATES, type ResourceTemplate, type TemplateScope } from '@/lib/crisis/resourceTemplates';
import type { Cabinet, Character, Resource, ResourceType } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, cabinetTint, fieldStyle, resourceIcon, Segmented } from '../../crisisKit';
import { planLines, runTemplateLines, type PlanLine } from './resourceApi';

const TEMPLATE_ICON: Record<string, React.ReactNode> = {
  military: <Swords size={20} strokeWidth={1.5} aria-hidden />,
  economy: <Banknote size={20} strokeWidth={1.5} aria-hidden />,
  politics: <ThumbsUp size={20} strokeWidth={1.5} aria-hidden />,
  intelligence: <Eye size={20} strokeWidth={1.5} aria-hidden />,
  'cold-war-1962': <Rocket size={20} strokeWidth={1.5} aria-hidden />,
};

interface LineState { on: boolean; name: string; unit: string; amount: string; scope: TemplateScope }

const toLines = (t: ResourceTemplate): LineState[] => t.lines.map((l) => ({ on: true, name: l.name, unit: l.unit, amount: String(l.amount), scope: l.scope }));

export default function ResourceTemplates({ refx, types, resources, cabinets, characters, presetCabinet, onCustom, onClose, onChanged }: {
  refx: CrisisRef; types: ResourceType[]; resources: Resource[]; cabinets: Cabinet[]; characters: Character[];
  /** A cabinet to add to from the start (the button on a cabinet's card). */
  presetCabinet?: string | null;
  /** "Custom": the page opens its own "Add a resource type". */
  onCustom: () => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tpl, setTpl] = useState<ResourceTemplate | null>(null);
  const [lines, setLines] = useState<LineState[]>([]);
  const [target, setTarget] = useState<string>(presetCabinet ?? 'all');
  const [busy, setBusy] = useState(false);

  const targetCabinets = useMemo(() => (target === 'all' ? cabinets : cabinets.filter((c) => c.id === target)), [target, cabinets]);
  const planLinesIn: PlanLine[] = useMemo(() => lines.flatMap((l, i) => (l.on && l.name.trim() ? [{
    key: String(i), name: l.name, unit: l.unit, scope: l.scope, amount: l.amount.trim() === '' ? NaN : Number(l.amount),
  }] : [])), [lines]);
  const badAmount = planLinesIn.some((l) => !Number.isFinite(l.amount));
  const planned = useMemo(
    () => planLines(planLinesIn.map((l) => ({ ...l, amount: Number.isFinite(l.amount) ? l.amount : 0 })), types, resources, targetCabinets, characters),
    [planLinesIn, types, resources, targetCabinets, characters],
  );
  const newTypes = planned.filter((p) => !p.existing).length;
  const newAmounts = planned.reduce((n, p) => n + p.rows.length, 0);

  const open = (t: ResourceTemplate) => { setTpl(t); setLines(toLines(t)); };
  const patch = (i: number, p: Partial<LineState>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const add = async () => {
    if (busy || badAmount || (newTypes === 0 && newAmounts === 0)) return;
    setBusy(true);
    try {
      const r = await runTemplateLines(refx, planLinesIn, targetCabinets, characters);
      notifyOk(`${r.resourcesAdded} ${r.resourcesAdded === 1 ? 'amount' : 'amounts'} added${r.typesAdded ? `, ${r.typesAdded} new ${r.typesAdded === 1 ? 'type' : 'types'}` : ''}`, 'crisis-resource');
      onChanged();
      onClose();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not add the template.'), 'crisis-resource');
      onChanged();
    } finally { setBusy(false); }
  };

  // ───── Step 1: the templates ─────
  if (!tpl) {
    return (
      <Card warm style={{ marginBottom: 16 }}>
        <CardTitle icon={<LayoutTemplate size={17} strokeWidth={1.5} aria-hidden />} sub="One click gives a cabinet a ready set of resources. You see everything before it is added." right={<Btn tone="ghost" size="sm" onClick={onClose}>Close</Btn>}>
          Add From a Template
        </CardTitle>
        <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {RESOURCE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => open(t)}
              className="flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform hover:-translate-y-px"
              style={{ gap: 6, border: 0, cursor: 'pointer', borderRadius: 18, padding: '14px 14px 12px', background: CK.card, boxShadow: CK.shadowSm, fontFamily: CK.font, color: CK.ink }}
            >
              <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: CK.red, background: cabinetTint(CK.red, 0.1), boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.red, 0.18)}` }}>
                {TEMPLATE_ICON[t.id] ?? <Landmark size={20} strokeWidth={1.5} />}
              </span>
              <b style={{ fontSize: 15, fontWeight: 800 }}>{t.name}</b>
              <span style={{ fontSize: 12.5, color: CK.inkSoft }}>{t.blurb}</span>
              <span style={{ fontSize: 12, color: CK.muted, overflowWrap: 'anywhere' }}>{t.lines.map((l) => l.name).join(', ')}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onCustom}
            className="flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform hover:-translate-y-px"
            style={{ gap: 6, border: `1.5px dashed ${CK.hair}`, cursor: 'pointer', borderRadius: 18, padding: '14px 14px 12px', background: 'transparent', fontFamily: CK.font, color: CK.ink }}
          >
            <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: CK.red, background: cabinetTint(CK.red, 0.1) }}>
              <Plus size={20} strokeWidth={1.5} />
            </span>
            <b style={{ fontSize: 15, fontWeight: 800 }}>Custom</b>
            <span style={{ fontSize: 12.5, color: CK.inkSoft }}>Make your own resource type, with your own name and measure.</span>
          </button>
        </div>
      </Card>
    );
  }

  // ───── Step 2: the preview ─────
  const targetOptions = [{ value: 'all', label: 'Every cabinet' }, ...cabinets.map((c) => ({ value: c.id, label: c.name }))];
  return (
    <Card warm style={{ marginBottom: 16 }}>
      <CardTitle
        icon={TEMPLATE_ICON[tpl.id] ?? <LayoutTemplate size={17} strokeWidth={1.5} aria-hidden />}
        sub="Untick a line to leave it out. Change an amount if you want a different start."
        right={<Btn tone="ghost" size="sm" icon={<ArrowLeft size={14} strokeWidth={1.5} aria-hidden />} onClick={() => setTpl(null)} disabled={busy}>All templates</Btn>}
      >
        {tpl.name}
      </CardTitle>

      <div style={{ maxWidth: 320, marginBottom: 12 }}>
        <span style={{ display: 'block', margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Add to</span>
        <GSelect value={target} onChange={setTarget} options={targetOptions} aria-label="Add to" />
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {lines.map((l, i) => {
          const p = planned.find((x) => x.line.key === String(i));
          const existing = types.find((t) => t.name.trim().toLowerCase() === l.name.trim().toLowerCase()) ?? null;
          const scope = existing ? existing.scope : l.scope;
          return (
            <li key={i} className="flex items-center flex-wrap" style={{ gap: '8px 12px', padding: '10px 0', borderTop: `1px solid ${CK.hair}`, opacity: l.on ? 1 : 0.55 }}>
              <input type="checkbox" checked={l.on} onChange={(e) => patch(i, { on: e.target.checked })} aria-label={`Add ${l.name}`} style={{ width: 18, height: 18, accentColor: '#8E2424', flex: 'none' }} />
              <span aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: CK.red, background: cabinetTint(CK.red, 0.1), flex: 'none' }}>{resourceIcon(l.name, 17)}</span>
              <span style={{ flex: '1 1 160px', minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 14.5, fontWeight: 800, overflowWrap: 'anywhere' }}>{l.name}</b>
                <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft }}>
                  {existing ? 'Already a resource type. It is added to cabinets that lack it.' : l.on ? 'New resource type' : 'Left out'}
                  {l.on && p && p.rows.length === 0 && existing ? ' Nothing to add here.' : ''}
                </span>
              </span>
              <Segmented<TemplateScope>
                ariaLabel={`Who holds ${l.name}`}
                value={scope}
                onChange={(v) => { if (!existing) patch(i, { scope: v }); }}
                options={[{ value: 'cabinet', label: 'Each cabinet' }, { value: 'character', label: 'Each character' }]}
              />
              <label className="flex items-center" style={{ gap: 6 }}>
                <input
                  type="number"
                  value={l.amount}
                  onChange={(e) => patch(i, { amount: e.target.value })}
                  aria-label={`Starting amount of ${l.name}`}
                  style={{ ...fieldStyle, width: 100, textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '7px 10px' }}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, minWidth: 54 }}>{l.unit}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center flex-wrap" style={{ gap: '10px 18px', marginTop: 14 }}>
        <span className="inline-flex items-baseline gap-2"><b style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{newAmounts}</b><span style={{ fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>{newAmounts === 1 ? 'amount' : 'amounts'} to add</span></span>
        <span className="inline-flex items-baseline gap-2"><b style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{newTypes}</b><span style={{ fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>new {newTypes === 1 ? 'type' : 'types'}</span></span>
        <span className="flex-1" />
        {badAmount && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: CK.red }}>Type a number for every amount.</span>}
        {!badAmount && newTypes === 0 && newAmounts === 0 && <span style={{ fontSize: 13, color: CK.inkSoft }}>Everything here is already added.</span>}
        <Btn tone="green" icon={<Plus size={15} strokeWidth={1.5} aria-hidden />} disabled={busy || badAmount || (newTypes === 0 && newAmounts === 0)} onClick={() => { void add(); }}>
          {busy ? 'Adding' : 'Add to ' + (target === 'all' ? 'every cabinet' : targetCabinets[0]?.name ?? 'the cabinet')}
        </Btn>
      </div>
    </Card>
  );
}
