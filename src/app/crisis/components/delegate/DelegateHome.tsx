'use client';
// Gavelling Crisis: the delegate's home. Three columns at 1440: the profile with the actions, facts and
// resources on the left, "Send a Directive" in the middle, "My Directives" on the right. On a phone one
// column: profile, actions, send, my directives. Character, news and chat open as dialogs.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, MessagesSquare, Newspaper, PauseCircle, PlayCircle } from 'lucide-react';
import {
  crisisError, listDirectives, loadResources, loadSecrets, loadWorld, type CrisisRef,
} from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { CharacterSecret, Directive, DirectiveNote, Resource, ResourceType } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, Card, CK, scenarioLabel, Skeleton } from '../../crisisKit';
import CrisisChatDialog from '../chat/CrisisChatDialog';
import { useChatUnread } from '../chat/useChatUnread';
import DirectiveForm, { type WorldCharacter } from './DirectiveForm';
import MyDirectives from './MyDirectives';
import RoomActions from './RoomActions';
import CharacterDialog from './CharacterDialog';
import NewsDialog from './NewsDialog';
import { CharacterPicture } from './characterBits';
import { listAllNotes, listCoauthors } from './delegateData';

function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>{children}</p>;
}

export default function DelegateHome() {
  const v = useCrisis();
  const { ref, characterId, cabinetId, memberId, core, settings } = v;
  const crisis = core.crisis;
  const unreadChat = useChatUnread();

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

  const nameOfCharacter = useCallback((id: string | null) => {
    if (!id) return null;
    return world.find((c) => c.id === id)?.name ?? core.characters.find((c) => c.id === id)?.name ?? null;
  }, [world, core.characters]);

  // Everyone a joint directive can be signed with: my cabinet in full, the others as the crisis shows them.
  const everyone = useMemo<WorldCharacter[]>(() => {
    const byId = new Map<string, WorldCharacter>();
    for (const c of world) byId.set(c.id, c);
    for (const c of core.characters) byId.set(c.id, c);
    return [...byId.values()];
  }, [world, core.characters]);

  const goals = secrets?.find((s) => s.character_id === characterId)?.goals?.trim() || '';
  const typeById = useMemo(() => new Map((res?.types ?? []).map((t) => [t.id, t])), [res]);
  const myResources = (res?.resources ?? []).filter((r) => (cabinetId && r.cabinet_id === cabinetId) || (characterId && r.character_id === characterId));

  const open = crisis.directives_open;

  const bigBtn = { width: '100%', justifyContent: 'flex-start', padding: '14px 16px', fontSize: 15, borderRadius: 14 } as const;

  return (
    <div style={{ paddingTop: 8 }}>
      <h1 style={{ margin: '0 0 14px', fontSize: 24, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{crisis.name}</h1>
      {loadError && <p role="status" style={{ margin: '-6px 0 12px', fontSize: 13, color: CK.danger }}>{loadError}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,1fr)] items-start">
        <div className="grid gap-4 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <section aria-label="My profile">
            {me ? (
              <button
                type="button"
                onClick={() => setDialog('character')}
                aria-label={`Open my character, ${me.name}`}
                className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ border: 0, background: CK.redGrad, borderRadius: 26, boxShadow: CK.redShadow, padding: '28px 18px 24px', cursor: 'pointer', textAlign: 'center', fontFamily: CK.font }}
              >
                <span className="flex justify-center">
                  <CharacterPicture name={me.name} url={me.picture_url} size={168} />
                </span>
                <b style={{ display: 'block', marginTop: 16, fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: '#FFF4E6', overflowWrap: 'anywhere' }}>{me.name}</b>
                {me.title && <span style={{ display: 'block', marginTop: 4, fontSize: 14.5, fontWeight: 600, color: 'rgba(255,232,214,0.78)', overflowWrap: 'anywhere' }}>{me.title}</span>}
              </button>
            ) : (
              <Card><Hint>You have no character yet. Ask your Crisis Director to give you one.</Hint></Card>
            )}
          </section>

          <section aria-label="Actions" className="grid gap-2.5">
            <RoomActions />
            <Btn tone="ghost" icon={<Newspaper size={18} strokeWidth={1.5} />} onClick={() => setDialog('news')} style={bigBtn}>News</Btn>
            <Btn tone="green" icon={<MessagesSquare size={18} strokeWidth={1.5} />} onClick={() => setDialog('chat')} style={bigBtn}>
              Chat with delegates
              {unreadChat > 0 && <span aria-label={`${unreadChat} unread`} style={{ marginLeft: 'auto', width: 9, height: 9, borderRadius: '50%', background: CK.gold, boxShadow: '0 0 0 2px rgba(255,255,255,0.5)' }} />}
            </Btn>
          </section>

          <Card style={{ padding: '12px 16px' }}>
            <div className="grid gap-2">
              <span className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 700, color: CK.inkSoft }}>
                <CalendarClock size={16} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />
                {scenarioLabel(crisis.scenario_at)}
              </span>
              <span className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 800, color: open ? CK.ok : CK.red }}>
                {open ? <PlayCircle size={16} strokeWidth={1.5} aria-hidden /> : <PauseCircle size={16} strokeWidth={1.5} aria-hidden />}
                {open ? 'Directives are open' : 'Directives are paused'}
              </span>
              {!open && crisis.directives_paused_note && (
                <p style={{ margin: 0, fontSize: 13.5, color: CK.red2, fontWeight: 600, overflowWrap: 'anywhere' }}>{crisis.directives_paused_note}</p>
              )}
            </div>
          </Card>

          <Card style={{ padding: '12px 16px' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: CK.ink }}>Resources</h2>
            {res === null ? (
              <div className="grid gap-2"><Skeleton h={22} /><Skeleton h={22} /></div>
            ) : myResources.length === 0 ? (
              <Hint>No resources yet.</Hint>
            ) : (
              <ul className="grid gap-1.5" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {myResources.map((r) => {
                  const t = typeById.get(r.type_id);
                  const own = !!characterId && r.character_id === characterId;
                  return (
                    <li key={r.id} className="flex items-baseline gap-2 flex-wrap">
                      <b style={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{Number(r.amount).toLocaleString()}</b>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                        {t?.name ?? 'Resource'}{t?.unit ? ` (${t.unit})` : ''}{own ? ', just for you' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-start-2 lg:row-start-1 xl:row-span-2 min-w-0">
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

        <div className="lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1 xl:row-span-2 min-w-0">
          <MyDirectives
            cref={ref}
            directives={directives}
            notes={notes}
            coauthors={coauthors}
            nameOfCharacter={nameOfCharacter}
            myMemberId={memberId}
            onChanged={() => { void readDirectives(ref); }}
          />
        </div>
      </div>

      {dialog === 'character' && me && (
        <CharacterDialog me={me} goals={goals} goalsLoaded={secrets !== null} onClose={() => setDialog(null)} />
      )}
      {dialog === 'news' && <NewsDialog onClose={() => setDialog(null)} />}
      <CrisisChatDialog open={dialog === 'chat'} onClose={() => setDialog(null)} />
    </div>
  );
}
