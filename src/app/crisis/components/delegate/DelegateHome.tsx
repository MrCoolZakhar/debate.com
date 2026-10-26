'use client';
// Gavelling Crisis: the delegate's home, three columns on a wide screen and no bar at the top.
//   Left (small, 280px): the character card (portrait over the top edge, opens My Character), the two
//   buttons (Request to speak, Chat), the compact speakers list, then the small facts (in-world date,
//   directives open or paused) and the resources, two per row.
//   Middle: Send a Directive, sized to fit one screen at 1440x900.
//   Right: the latest news (with this cabinet's big numbers), then My Directives.
// On a phone it stacks: character and buttons, my directives (where replies arrive), send directive, speakers list, news, facts and resources.
// The live room is loaded once (useCrisisRoom) and shared by the speakers list, the request and the chat.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  crisisError, listDirectives, loadResources, loadSecrets, loadWorld, type CrisisRef,
} from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { CharacterSecret, Directive, DirectiveNote, News, Resource, ResourceType } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Card, CK } from '../../crisisKit';
import DirectiveForm, { type WorldCharacter } from './DirectiveForm';
import MyDirectives, { type PersonRef } from './MyDirectives';
import RoomActions from './RoomActions';
import CharacterDialog from './CharacterDialog';
import ChatDialog from './ChatDialog';
import NewsDialog from './NewsDialog';
import ProfileCard from './ProfileCard';
import FactsCard from './FactsCard';
import NewsPanel from './NewsPanel';
import SpeakersList from './SpeakersList';
import { useCrisisNews } from '../news/useCrisisNews';
import { useCrisisRoom } from './useCrisisRoom';
import { listAllNotes, listCoauthors } from './delegateData';

export default function DelegateHome() {
  const v = useCrisis();
  const { ref, characterId, cabinetId, memberId, core, settings } = v;
  const crisis = core.crisis;
  const room = useCrisisRoom();

  const me = useMemo(() => core.characters.find((c) => c.id === characterId) ?? null, [core.characters, characterId]);
  const cabinetNames = useMemo(() => Object.fromEntries(core.cabinets.map((c) => [c.id, c.name])), [core.cabinets]);

  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [notes, setNotes] = useState<DirectiveNote[]>([]);
  const [coauthors, setCoauthors] = useState<Array<{ directive_id: string; character_id: string }>>([]);
  const [res, setRes] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [secrets, setSecrets] = useState<CharacterSecret[] | null>(null);
  const [world, setWorld] = useState<WorldCharacter[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'character' | 'news' | 'chat' | null>(null);
  const [story, setStory] = useState<News | null>(null);
  const news = useCrisisNews(ref);
  const seq = useRef<Record<string, number>>({});

  // Each slice keeps only the newest answer, and a failed re-read keeps what is on screen.
  const slice = useCallback(async <T,>(name: string, read: () => Promise<T>, apply: (x: T) => void) => {
    const mine = (seq.current[name] = (seq.current[name] ?? 0) + 1);
    try {
      const x = await read();
      if (mine === seq.current[name]) { apply(x); setLoadError(null); }
    } catch (e) {
      if (mine === seq.current[name]) setLoadError(crisisError(e, 'Could not refresh this page.'));
    }
  }, []);

  const readDirectives = useCallback((r: CrisisRef) => slice('directives', async () => {
    const [d, n, c] = await Promise.all([listDirectives(r), listAllNotes(r), listCoauthors(r)]);
    return { d, n, c };
  }, ({ d, n, c }) => { setDirectives(d); setNotes(n); setCoauthors(c); }), [slice]);
  const readResources = useCallback((r: CrisisRef) => slice('resources', () => loadResources(r), setRes), [slice]);
  const readSecrets = useCallback((r: CrisisRef) => slice('secrets', () => loadSecrets(r), setSecrets), [slice]);
  const readWorld = useCallback((r: CrisisRef) => slice('world', () => loadWorld(r), setWorld), [slice]);

  useEffect(() => {
    // Deferred one tick so the first read never sets state inside the effect body.
    const t = window.setTimeout(() => { void readDirectives(ref); void readResources(ref); void readSecrets(ref); void readWorld(ref); }, 0);
    return () => window.clearTimeout(t);
  }, [ref, readDirectives, readResources, readSecrets, readWorld]);

  useCrisisLive(
    ref.id,
    ['crisis_directives', 'crisis_directive_notes', 'crisis_news', 'crisis_resources', 'crisis_resource_types', 'crisis_character_secrets', 'crisis_characters', 'crises'],
    (changed) => {
      const all = changed === null;
      if (all || changed.has('crisis_directives') || changed.has('crisis_directive_notes')) void readDirectives(ref);
      if (all || changed.has('crisis_resources') || changed.has('crisis_resource_types')) void readResources(ref);
      if (all || changed.has('crisis_character_secrets')) void readSecrets(ref);
      if (all || changed.has('crisis_characters')) void readWorld(ref);
    },
  );

  const cabinetColor = useMemo(() => Object.fromEntries(core.cabinets.map((c) => [c.id, c.color])) as Record<string, string>, [core.cabinets]);
  const myColor = (cabinetId && cabinetColor[cabinetId]) || CK.red;

  // Everyone a joint directive can be signed with: my cabinet in full, the others as the crisis shows them.
  const everyone = useMemo<WorldCharacter[]>(() => {
    const byId = new Map<string, WorldCharacter>();
    for (const c of world) byId.set(c.id, c);
    for (const c of core.characters) byId.set(c.id, c);
    return [...byId.values()];
  }, [world, core.characters]);

  const personOf = useCallback((id: string | null): PersonRef => {
    const c = id ? everyone.find((x) => x.id === id) : undefined;
    if (c) return { name: c.name, picture_url: c.picture_url ?? null, color: (c.cabinet_id && cabinetColor[c.cabinet_id]) || CK.red };
    if (me) return { name: me.name, picture_url: me.picture_url, color: myColor };
    return { name: '?', picture_url: null, color: CK.red };
  }, [everyone, cabinetColor, me, myColor]);
  const memberName = useCallback((id: string | null) => (id ? core.members.find((m) => m.id === id)?.display_name ?? null : null), [core.members]);

  const goals = secrets?.find((s) => s.character_id === characterId)?.goals?.trim() || '';
  const myResources = (res?.resources ?? []).filter((r) => (cabinetId && r.cabinet_id === cabinetId) || (characterId && r.character_id === characterId));
  const open = crisis.directives_open;

  const cabinet = cabinetId ? core.cabinets.find((c) => c.id === cabinetId) ?? null : null;

  return (
    <div style={{ paddingTop: 4 }}>
      {loadError && <p role="status" style={{ margin: '0 0 10px', fontSize: 13, color: CK.danger }}>{loadError}</p>}

      <div className="flex flex-col gap-6 xl:grid xl:items-start xl:gap-5 xl:grid-cols-[280px_minmax(0,6fr)_minmax(0,5fr)]">
        {/* Left: the character, the buttons, the speakers list; the facts and resources come last on a phone. */}
        <div className="contents xl:flex xl:flex-col xl:gap-5 xl:min-w-0">
          <div className="contents xl:flex xl:flex-col xl:gap-3 xl:min-w-0">
            <div className="order-1 xl:order-none min-w-0 flex flex-col gap-3">
              <section aria-label="My profile">
                <ProfileCard me={me} cabinet={cabinet} color={myColor} onOpen={() => setDialog('character')} />
              </section>
              <section aria-label="Actions">
                <RoomActions room={room} onChat={() => setDialog('chat')} />
              </section>
            </div>
            <div className="order-4 xl:order-none min-w-0">
              <Card style={{ padding: '10px 12px 12px' }}>
                <section aria-label="Speakers list">
                  <h2 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 800, color: CK.ink }}>Speakers List</h2>
                  <SpeakersList room={room} characters={everyone} />
                </section>
              </Card>
            </div>
          </div>
          <div className="order-6 xl:order-none min-w-0">
            <FactsCard crisis={crisis} types={res?.types ?? null} resources={myResources} characterId={characterId} color={myColor} />
          </div>
        </div>

        {/* Middle: the most important thing on the page. */}
        <div className="order-3 xl:order-none min-w-0 xl:pt-[38px]">
          <DirectiveForm
            cref={ref}
            memberId={memberId}
            characterId={characterId}
            world={everyone}
            ownCabinetId={cabinetId}
            cabinetNames={cabinetNames}
            wordLimit={settings.wordLimit}
            open={open}
            pausedNote={crisis.directives_paused_note}
            onSent={() => { void readDirectives(ref); }}
          />
        </div>

        {/* Right: the news, then my directives. */}
        <div className="contents xl:flex xl:flex-col xl:gap-6 xl:min-w-0 xl:pt-[38px]">
          <div className="order-5 xl:order-none min-w-0">
            <NewsPanel
              items={news.items}
              cabinetId={cabinetId}
              onOpen={(n) => { setStory(n); setDialog('news'); }}
              onAll={() => { setStory(null); setDialog('news'); }}
            />
          </div>
          <div className="order-2 xl:order-none min-w-0">
            <MyDirectives
              cref={ref}
              directives={directives}
              notes={notes}
              coauthors={coauthors}
              personOf={personOf}
              memberName={memberName}
              myMemberId={memberId}
              onChanged={() => { void readDirectives(ref); }}
            />
          </div>
        </div>
      </div>

      {dialog === 'character' && me && (
        <CharacterDialog me={me} color={myColor} goals={goals} goalsLoaded={secrets !== null} onClose={() => setDialog(null)} />
      )}
      {dialog === 'news' && <NewsDialog items={news.items} error={news.error} initial={story} onClose={() => setDialog(null)} />}
      {dialog === 'chat' && <ChatDialog room={room} onClose={() => setDialog(null)} />}
    </div>
  );
}
