'use client';
// Gavelling Crisis: Settings (Crisis Director). Grouped switches and choices. Every change is one
// key-level patch (patchSettings) with a "Saved" pill; the name goes through patchCrisis.
// Settings that do not apply to this crisis (map powers on the Basic package, other cabinets in a
// single-cabinet crisis) are hidden.

import { useState } from 'react';
import { Award, MessageSquare, Newspaper, Presentation, ScrollText, ShieldCheck, Siren, UsersRound } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, patchCrisis, patchSettings } from '@/lib/crisis/api';
import { DEFAULT_POINTS, readPoints, type PointsConfig } from '@/lib/crisis/points';
import { readSettings, type CrisisSettings } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, fieldStyle, Segmented } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { ChoiceRow, DirectorOnlyCard, Hint, PageHeading, ToggleRow } from './setupKit';

const COOLDOWNS = [
  { value: '0', label: 'Off' }, { value: '60', label: '1 minute' }, { value: '120', label: '2 minutes' },
  { value: '180', label: '3 minutes' }, { value: '300', label: '5 minutes' }, { value: '600', label: '10 minutes' },
];
const WORD_LIMITS = [
  { value: '0', label: 'No limit' }, { value: '100', label: '100 words' }, { value: '200', label: '200 words' },
  { value: '300', label: '300 words' }, { value: '500', label: '500 words' },
];

type Powers = CrisisSettings['backroomPowers'] & { characters?: boolean };

export default function SettingsPage() {
  const v = useCrisis();
  if (!v.director) return <DirectorOnlyCard title="Settings" />;
  return <SettingsBody />;
}

function SettingsBody() {
  const { ref, core, reloadCore } = useCrisis();
  // What we just saved shows at once; the live read takes over as soon as it brings a newer copy.
  const [local, setLocal] = useState<{ base: unknown; blob: Record<string, unknown> } | null>(null);
  const raw = (local && local.base === core.crisis.settings ? local.blob : core.crisis.settings) as Record<string, unknown>;
  const s = readSettings(raw);
  const full = core.crisis.package === 'full';
  const joint = core.crisis.kind === 'joint';

  const save = async (key: string, value: unknown) => {
    const before = local;
    const next = { ...raw, [key]: value };
    setLocal({ base: core.crisis.settings, blob: next });
    try {
      const blob = await patchSettings(ref, { [key]: value });
      setLocal({ base: core.crisis.settings, blob });
      notifyOk('Saved', 'crisis-settings');
      void reloadCore();
    } catch (e) {
      setLocal(before);
      notifyErr(crisisError(e, 'Could not save that setting.'), 'crisis-settings');
    }
  };
  const powers = s.backroomPowers as Powers;
  const setPower = (k: keyof Powers, on: boolean) => save('backroomPowers', { ...s.backroomPowers, [k]: on });
  const points = readPoints(raw);

  return (
    <div style={{ fontFamily: CK.font }}>
      <PageHeading eyebrow="SET UP" title="Settings" />
      <div className="crisis-settings-cols">
        <style>{`.crisis-settings-cols{column-width:420px;column-gap:14px}.crisis-settings-cols>*{break-inside:avoid;margin-bottom:14px;display:block}`}</style>
        <Card>
          <CardTitle icon={<ScrollText size={16} strokeWidth={1.5} />}>Directives</CardTitle>
          <ChoiceRow title="Time between directives" hint="How long a delegate waits before sending another directive.">
            <GSelect value={String(s.cooldownSeconds)} onChange={(x) => save('cooldownSeconds', Number(x))} options={COOLDOWNS} aria-label="Time between directives" style={{ minWidth: 170 }} />
          </ChoiceRow>
          <ChoiceRow title="Word limit" hint="The longest a directive's action text may be.">
            <GSelect value={String(s.wordLimit)} onChange={(x) => save('wordLimit', Number(x))} options={WORD_LIMITS} aria-label="Word limit" style={{ minWidth: 170 }} />
          </ChoiceRow>
          <ToggleRow title="Cabinet directives go to the chair first" checked={s.chairApprovesCabinetDirectives} onChange={(on) => save('chairApprovesCabinetDirectives', on)} hint="The chair of the cabinet approves them before the backroom sees them." />
          <ChoiceRow title="Queue order" hint="Fair: the longest wait first, then whoever heard back least recently. Oldest and newest go by when the directive was sent.">
            <Segmented
              ariaLabel="Queue order"
              value={s.queueOrder}
              onChange={(x) => save('queueOrder', x)}
              options={[{ value: 'fair', label: 'Fair' }, { value: 'oldest', label: 'Oldest first' }, { value: 'newest', label: 'Newest first' }]}
            />
          </ChoiceRow>
        </Card>

        <Card>
          <CardTitle icon={<ShieldCheck size={16} strokeWidth={1.5} />}>Backroom Powers</CardTitle>
          <p style={{ margin: '-4px 0 6px', fontSize: 13, color: CK.inkSoft }}>One set of powers for every backroomer.</p>
          {full && <ToggleRow title="Edit the map" checked={s.backroomPowers.map} onChange={(on) => setPower('map', on)} hint="Move borders and draw shapes on the map." />}
          {full && <ToggleRow title="Change resources" checked={s.backroomPowers.resources} onChange={(on) => setPower('resources', on)} hint="Add or take away resources, with a reason." />}
          {full && <ToggleRow title="Fog of war" checked={s.backroomPowers.fog} onChange={(on) => setPower('fog', on)} hint="Choose what each cabinet can see on the map." />}
          {full && <ToggleRow title="Units" checked={s.backroomPowers.units} onChange={(on) => setPower('units', on)} hint="Place and move units on the map." />}
          <ToggleRow title="Edit characters" checked={!!powers.characters} onChange={(on) => setPower('characters', on)} hint="Change a character's bio, picture, powers, status and guide. Off means a backroomer can only read them." />
          <ToggleRow title="See all directives" checked={s.backroomPowers.seeAll} onChange={(on) => setPower('seeAll', on)} hint="Off means a backroomer sees only the directives of their own characters." />
          <ToggleRow title="Publish news without approval" checked={s.backroomPowers.news} onChange={(on) => setPower('news', on)} hint="Off means a backroomer's news waits for the Crisis Director." />
        </Card>

        <Card>
          <CardTitle icon={<Award size={16} strokeWidth={1.5} />}>Points</CardTitle>
          <p style={{ margin: '-4px 0 6px', fontSize: 13, color: CK.inkSoft }}>What each action is worth in a character&apos;s crisis points. They help judge awards.</p>
          <PointsFields points={points} onSave={(next) => save('points', next)} />
        </Card>

        <Card>
          <CardTitle icon={<Newspaper size={16} strokeWidth={1.5} />}>News</CardTitle>
          <ToggleRow title="News needs the Crisis Director's approval" checked={s.newsNeedsApproval} onChange={(on) => save('newsNeedsApproval', on)} hint="Off means news goes live as soon as it is published." />
        </Card>

        <Card>
          <CardTitle icon={<MessageSquare size={16} strokeWidth={1.5} />}>Meetings</CardTitle>
          <ToggleRow title="Meetings need approval" checked={s.meetingsNeedApproval} onChange={(on) => save('meetingsNeedApproval', on)} hint="Meetings happen in person. The backroomer or the Crisis Director approves the request." />
        </Card>

        {joint && (
          <Card>
            <CardTitle icon={<UsersRound size={16} strokeWidth={1.5} />}>Other Cabinets</CardTitle>
            <ChoiceRow title="What delegates see of the other cabinets" hint="Nothing: delegates see only their own cabinet. Names and pictures: who the other characters are. Full profiles: their bio and location as well. Delegates never see another character's directives or performance.">
              <Segmented
                ariaLabel="What delegates see of the other cabinets"
                value={s.otherCabinets}
                onChange={(x) => save('otherCabinets', x)}
                options={[{ value: 'hidden', label: 'Nothing' }, { value: 'names', label: 'Names and pictures' }, { value: 'profiles', label: 'Full profiles' }]}
              />
            </ChoiceRow>
          </Card>
        )}

        <Card>
          <CardTitle icon={<Presentation size={16} strokeWidth={1.5} />}>Front Room</CardTitle>
          <ToggleRow title="Chair can read personal directives" checked={s.chairReadsPersonal} onChange={(on) => save('chairReadsPersonal', on)} hint="Off keeps personal directives between the delegate and the backroom." />
        </Card>

        <Card>
          <CardTitle icon={<Siren size={16} strokeWidth={1.5} />}>The Crisis</CardTitle>
          <CrisisName key={core.crisis.name} name={core.crisis.name} />
          <ChoiceRow title="Package" hint="Your organiser chooses the package in Manage, under Committees.">
            <b style={{ fontSize: 14, color: CK.ink }}>{full ? 'Full package' : 'Basic crisis'}</b>
          </ChoiceRow>
        </Card>
      </div>
    </div>
  );
}

function CrisisName({ name }: { name: string }) {
  const { ref, reloadCore } = useCrisis();
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const changed = draft.trim() !== name && draft.trim().length > 0;
  const commit = async () => {
    if (!changed || busy) return;
    setBusy(true);
    try {
      await patchCrisis(ref, { name: draft.trim() });
      notifyOk('Saved', 'crisis-settings');
      await reloadCore();
    } catch (e) { notifyErr(crisisError(e, 'Could not save the name.'), 'crisis-settings'); setDraft(name); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ padding: '10px 0', borderTop: `1px solid ${CK.hair}` }}>
      <label htmlFor="crisis-name" style={{ display: 'block', margin: '0 0 5px', fontSize: 14, fontWeight: 600, color: CK.ink }}>Name</label>
      <input
        id="crisis-name"
        value={draft}
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={fieldStyle}
      />
    </div>
  );
}

// ─────────── Points ───────────

const POINT_ROWS: Array<{ key: keyof PointsConfig; title: string; hint?: string }> = [
  { key: 'directiveSent', title: 'Directive sent', hint: 'Every personal, joint or cabinet directive a character sends.' },
  { key: 'approved', title: 'Approved', hint: 'Extra when the backroom approves a directive.' },
  { key: 'partial', title: 'Partly works', hint: 'Extra when a directive partly works.' },
  { key: 'denied', title: 'Denied', hint: 'Extra when a directive is denied. Zero or negative.' },
  { key: 'cabinetDirective', title: 'Cabinet directive', hint: 'Extra for a directive sent in the name of the cabinet.' },
  { key: 'jointDirective', title: 'Joint directive co-written', hint: 'Each co-author of a joint directive.' },
  { key: 'meetingHeld', title: 'Meeting held', hint: 'Each meeting the character took part in that was held.' },
  { key: 'manual', title: 'Staff adjustment', hint: 'Reserved for a later release. Not counted yet.' },
];

function PointsFields({ points, onSave }: { points: PointsConfig; onSave: (next: PointsConfig) => void }) {
  const [draft, setDraft] = useState<Partial<Record<keyof PointsConfig, string>>>({});
  const changed = POINT_ROWS.some((r) => points[r.key] !== DEFAULT_POINTS[r.key]);

  const commit = (key: keyof PointsConfig) => {
    const raw = draft[key];
    setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
    if (raw === undefined) return;
    const n = Math.round(Number(raw));
    if (raw.trim() === '' || !Number.isFinite(n)) return;
    const value = Math.max(-100, Math.min(100, n));
    if (value !== points[key]) onSave({ ...points, [key]: value });
  };

  return (
    <>
      {POINT_ROWS.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3" style={{ padding: '8px 0', borderTop: `1px solid ${CK.hair}` }}>
          <span className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: CK.ink, minWidth: 0 }}>
            <span style={{ overflowWrap: 'anywhere' }}>{r.title}</span>
            {r.hint && <Hint text={r.hint} />}
          </span>
          <span className="inline-flex items-center gap-2" style={{ flex: 'none' }}>
            <span style={{ fontSize: 12, color: CK.muted }}>Default {DEFAULT_POINTS[r.key]}</span>
            <input
              type="number"
              inputMode="numeric"
              min={-100}
              max={100}
              step={1}
              aria-label={`${r.title} points`}
              value={draft[r.key] ?? String(points[r.key])}
              onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
              onBlur={() => commit(r.key)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              style={{ ...fieldStyle, width: 76, padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            />
          </span>
        </div>
      ))}
      {changed && (
        <div style={{ paddingTop: 10 }}>
          <Btn size="sm" tone="ghost" onClick={() => onSave({ ...DEFAULT_POINTS })}>Back to the defaults</Btn>
        </div>
      )}
    </>
  );
}
