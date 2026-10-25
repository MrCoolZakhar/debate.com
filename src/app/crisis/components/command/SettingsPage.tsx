'use client';
// Gavelling Crisis: Settings (Crisis Director). Grouped switches and choices. Every change is one
// key-level patch (patchSettings) with a "Saved" pill; the name goes through patchCrisis.
// Settings that do not apply to this crisis (map powers on the Basic package, other cabinets in a
// single-cabinet crisis) are hidden.

import { useState } from 'react';
import { MessageSquare, Newspaper, Presentation, ScrollText, ShieldCheck, Siren, UsersRound } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, patchCrisis, patchSettings } from '@/lib/crisis/api';
import { readSettings, type CrisisSettings } from '@/lib/crisis/types';
import { Card, CardTitle, CK, fieldStyle, Segmented } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { ChoiceRow, DirectorOnlyCard, PageHeading, ToggleRow } from './setupKit';

const COOLDOWNS = [
  { value: '0', label: 'Off' }, { value: '60', label: '1 minute' }, { value: '120', label: '2 minutes' },
  { value: '180', label: '3 minutes' }, { value: '300', label: '5 minutes' }, { value: '600', label: '10 minutes' },
];
const WORD_LIMITS = [
  { value: '0', label: 'No limit' }, { value: '100', label: '100 words' }, { value: '200', label: '200 words' },
  { value: '300', label: '300 words' }, { value: '500', label: '500 words' },
];

type Powers = CrisisSettings['backroomPowers'];

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
  const setPower = (k: keyof Powers, on: boolean) => save('backroomPowers', { ...s.backroomPowers, [k]: on });

  return (
    <div style={{ fontFamily: CK.font }}>
      <PageHeading eyebrow="SET UP" title="Settings" />
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
        <Card>
          <CardTitle icon={<ScrollText size={16} strokeWidth={1.5} />}>Directives</CardTitle>
          <ChoiceRow title="Time between directives" hint="How long a delegate waits before sending another directive.">
            <GSelect value={String(s.cooldownSeconds)} onChange={(x) => save('cooldownSeconds', Number(x))} options={COOLDOWNS} aria-label="Time between directives" style={{ minWidth: 170 }} />
          </ChoiceRow>
          <ChoiceRow title="Word limit" hint="The longest a directive's action text may be.">
            <GSelect value={String(s.wordLimit)} onChange={(x) => save('wordLimit', Number(x))} options={WORD_LIMITS} aria-label="Word limit" style={{ minWidth: 170 }} />
          </ChoiceRow>
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
          {full && <ToggleRow title="Edit the map" checked={s.backroomPowers.map} onChange={(on) => setPower('map', on)} hint="Move borders and draw shapes on the war map." />}
          {full && <ToggleRow title="Change resources" checked={s.backroomPowers.resources} onChange={(on) => setPower('resources', on)} hint="Add or take away resources, with a reason." />}
          {full && <ToggleRow title="Fog of war" checked={s.backroomPowers.fog} onChange={(on) => setPower('fog', on)} hint="Choose what each cabinet can see on the map." />}
          {full && <ToggleRow title="Units" checked={s.backroomPowers.units} onChange={(on) => setPower('units', on)} hint="Place and move units on the war map." />}
          <ToggleRow title="See all directives" checked={s.backroomPowers.seeAll} onChange={(on) => setPower('seeAll', on)} hint="Off means a backroomer sees only the directives of their own characters." />
          <ToggleRow title="Publish news without approval" checked={s.backroomPowers.news} onChange={(on) => setPower('news', on)} hint="Off means a backroomer's news waits for the Crisis Director." />
        </Card>

        <Card>
          <CardTitle icon={<Newspaper size={16} strokeWidth={1.5} />}>News</CardTitle>
          <ToggleRow title="News needs the Crisis Director's approval" checked={s.newsNeedsApproval} onChange={(on) => save('newsNeedsApproval', on)} hint="Off means news goes live as soon as it is published." />
        </Card>

        <Card>
          <CardTitle icon={<MessageSquare size={16} strokeWidth={1.5} />}>Messages</CardTitle>
          <ChoiceRow title="Messages between delegates" hint="Free: delegates write to each other at once and backroomers can read them. Need approval: the backroom approves each message. Off: no messages.">
            <Segmented
              ariaLabel="Messages between delegates"
              value={s.messages}
              onChange={(x) => save('messages', x)}
              options={[{ value: 'free', label: 'Free' }, { value: 'approval', label: 'Need backroom approval' }, { value: 'off', label: 'Off' }]}
            />
          </ChoiceRow>
          <ToggleRow title="Meetings need approval" checked={s.meetingsNeedApproval} onChange={(on) => save('meetingsNeedApproval', on)} hint="Meetings happen in person. The backroomer or the Crisis Director approves the request." />
        </Card>

        {joint && (
          <Card>
            <CardTitle icon={<UsersRound size={16} strokeWidth={1.5} />}>Other Cabinets&apos; Characters</CardTitle>
            <ChoiceRow title="What delegates see" hint="Hidden: nothing about the other cabinets. Names only: who they are. Full: bio, picture and title as well.">
              <Segmented
                ariaLabel="What delegates see of other cabinets"
                value={s.otherCabinets}
                onChange={(x) => save('otherCabinets', x)}
                options={[{ value: 'hidden', label: 'Hidden' }, { value: 'names', label: 'Names only' }, { value: 'full', label: 'Full' }]}
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
