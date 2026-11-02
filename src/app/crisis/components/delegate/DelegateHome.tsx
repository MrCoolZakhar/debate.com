'use client';
// Gavelling Crisis: the delegate's home, three columns on a wide screen and no bar at the top.
//   Left (small, 320px): the character card (portrait over the top edge, opens My Character), the two
//   buttons (Request to speak, Chat), the speakers list (half width) beside the quick glance (in-world
//   date, directives open or paused, cooldown), then the resources, two per row.
//   Middle: Send a Directive, sized to fit one screen at 1440x900.
//   Right: the latest news (with this cabinet's big numbers), then My Directives.
// On a phone it stacks: character and buttons, my directives (where replies arrive), send directive, speakers list, news, facts and resources.
// The live room is loaded once (useCrisisRoom) and shared by the speakers list, the request and the chat.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  crisisError, listDirectives, loadMyGoals, loadResources, loadWorld, type CrisisRef,
} from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive, DirectiveNote, News, Resource, ResourceType } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { UserX } from 'lucide-react';
import { Card, CK } from '../../crisisKit';
import DirectiveForm, { inactiveBanner, type DirectivePrefill, type DirectiveResend, type WorldCharacter } from './DirectiveForm';
import { splitAttached } from '../directives/attachedImage';
import { dirNumber } from '@/lib/crisis/format';
import MyDirectives, { type PersonRef } from './MyDirectives';
import RoomActions from './RoomActions';
import CharacterDialog from './CharacterDialog';
import ChatDialog from './ChatDialog';
import NewsDialog from './NewsDialog';
import ProfileCard from './ProfileCard';
import FactsCard from './FactsCard';
import GlanceCard from './GlanceCard';
import NewsPanel from './NewsPanel';
import SpeakersList from './SpeakersList';
import { useCrisisNews } from '../news/useCrisisNews';
import { useCrisisRoom } from './useCrisisRoom';
import { listAllNotes, listCoauthors } from './delegateData';

export default function DelegateHome() {
  const v = useCrisis();
  const { ref, memberId, core, settings } = v;
  // Who I play right now. The page's own member row is kept live by the core, so when staff give me another character
  // (or move me to another cabinet) the page switches to it without a reload.
  const liveMember = core.members.find((m) => m.id === memberId) ?? null;
  const characterId = liveMember ? liveMember.character_id : v.characterId;
  const cabinetId = liveMember ? liveMember.cabinet_id : v.cabinetId;
  const crisis = core.crisis;
  const room = useCrisisRoom();

  const me = useMemo(() => core.characters.find((c) => c.id === characterId) ?? null, [core.characters, characterId]);
  const cabinetNames = useMemo(() => Object.fromEntries(core.cabinets.map((c) => [c.id, c.name])), [core.cabinets]);

  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [notes, setNotes] = useState<DirectiveNote[]>([]);
  const [coauthors, setCoauthors] = useState<Array<{ directive_id: string; character_id: string }>>([]);
  const [res, setRes] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [goalsRead, setGoalsRead] = useState<{ forCharacter: string | null; text: string } | null>(null);
  const [world, setWorld] = useState<WorldCharacter[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'character' | 'news' | 'chat' | null>(null);
  const [story, setStory] = useState<News | null>(null);
  const [prefill, setPrefill] = useState<DirectivePrefill | null>(null);
  const [resend, setResend] = useState<DirectiveResend | null>(null);
  // When the cooldown before the next directive ends (told by the form), for the glance card.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
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
  // The delegate's own goals only (crisis_my_goals); the answer remembers which character it was read for.
  const readGoals = useCallback((r: CrisisRef, forCharacter: string | null) => slice('goals', () => loadMyGoals(r), (text) => setGoalsRead({ forCharacter, text: text ?? '' })), [slice]);
  const readWorld = useCallback((r: CrisisRef) => slice('world', () => loadWorld(r), setWorld), [slice]);

  useEffect(() => {
    // Deferred one tick so the first read never sets state inside the effect body.
    const t = window.setTimeout(() => { void readDirectives(ref); void readResources(ref); void readWorld(ref); }, 0);
    return () => window.clearTimeout(t);
  }, [ref, readDirectives, readResources, readWorld]);
  // Goals are read again whenever I play someone else.
  useEffect(() => {
    const t = window.setTimeout(() => { void readGoals(ref, characterId); }, 0);
    return () => window.clearTimeout(t);
  }, [ref, characterId, readGoals]);

  useCrisisLive(
    ref.id,
    ['crisis_directives', 'crisis_directive_notes', 'crisis_news', 'crisis_resources', 'crisis_resource_types', 'crisis_character_secrets', 'crisis_characters', 'crisis_members', 'crises'],
    (changed) => {
      const all = changed === null;
      if (all || changed.has('crisis_directives') || changed.has('crisis_directive_notes')) void readDirectives(ref);
      if (all || changed.has('crisis_resources') || changed.has('crisis_resource_types')) void readResources(ref);
      if (all || changed.has('crisis_character_secrets') || changed.has('crisis_members')) void readGoals(ref, characterId);
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

  // "Edit and send again": a directive the chair sent back is copied into the form, and the form comes into view.
  const sendAgain = useCallback((d: Directive) => {
    const { text, image } = splitAttached(d.body);
    setPrefill({
      token: Date.now(), kind: d.kind, title: d.title, body: text, image: image ?? null, themes: d.themes,
      coauthors: coauthors.filter((x) => x.directive_id === d.id).map((x) => x.character_id),
    });
    document.getElementById('crisis-send-directive')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [coauthors]);

  // "Edit and send again" on a directive the chair asked changes for: the form opens it in edit mode.
  const editReturned = useCallback((d: Directive) => {
    const { text, image } = splitAttached(d.body);
    setResend({
      token: Date.now(), directiveId: d.id, label: String(dirNumber(d)), note: d.reply?.trim() || null, title: d.title, body: text, image: image ?? null,
      themes: d.themes, receiver: d.receiver, covert: d.covert,
    });
    document.getElementById('crisis-send-directive')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const goalsFresh = goalsRead !== null && goalsRead.forCharacter === characterId;
  const goals = goalsFresh ? goalsRead.text.trim() : '';
  const myResources = (res?.resources ?? []).filter((r) => (cabinetId && r.cabinet_id === cabinetId) || (characterId && r.character_id === characterId));
  const cabinet = cabinetId ? core.cabinets.find((c) => c.id === cabinetId) ?? null : null;
  // Paused for everyone, or for my cabinet only (the crisis-wide note wins when both are paused).
  const open = crisis.directives_open && cabinet?.directives_open !== false;
  const pausedNote = !crisis.directives_open ? crisis.directives_paused_note : cabinet?.directives_paused_note ?? null;
  // A dead, arrested or missing character cannot send; the page says so and the form is locked.
  const inactive = me && (me.status === 'dead' || me.status === 'arrested' || me.status === 'missing') ? inactiveBanner(me.status, me.status_note) : null;

  return (
    <div style={{ paddingTop: 4 }}>
      {loadError && <p role="status" style={{ margin: '0 0 10px', fontSize: 13, color: CK.danger }}>{loadError}</p>}

      {inactive && (
        <section
          role="status"
          aria-label="Your character"
          className="flex items-start"
          style={{ gap: 12, background: CK.redGrad, color: '#FFF4E6', borderRadius: 20, boxShadow: CK.shadow, padding: '14px 18px', margin: '0 0 16px' }}
        >
          <span aria-hidden style={{ lineHeight: 0, paddingTop: 2 }}><UserX size={22} strokeWidth={1.5} /></span>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{inactive.title}</b>
            {inactive.note && <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 600, opacity: 0.95, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inactive.note}</p>}
            <p style={{ margin: '3px 0 0', fontSize: 13.5, opacity: 0.9 }}>The crisis team will give you a new character. You cannot send directives until then.</p>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-6 xl:grid xl:items-start xl:gap-5 xl:grid-cols-[320px_minmax(0,6fr)_minmax(0,5fr)]">
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
            {/* The speakers list at half its old width, with the quick glance beside it. */}
            <div className="order-4 xl:order-none min-w-0 grid items-stretch" style={{ gridTemplateColumns: '140px minmax(0, 1fr)', gap: 10 }}>
              <Card style={{ padding: '10px 10px 12px' }}>
                <section aria-label="Speakers list">
                  <h2 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 800, color: CK.ink }}>Speakers List</h2>
                  <SpeakersList room={room} characters={everyone} />
                </section>
              </Card>
              <GlanceCard scenarioAt={crisis.scenario_at} crisisOpen={crisis.directives_open} cabinetOpen={cabinet?.directives_open !== false} pausedNote={pausedNote} cooldownUntil={cooldownUntil} />
            </div>
          </div>
          <div className="order-6 xl:order-none min-w-0">
            <FactsCard types={res?.types ?? null} resources={myResources} characterId={characterId} color={myColor} />
          </div>
        </div>

        {/* Middle: the most important thing on the page. */}
        <div id="crisis-send-directive" className="order-3 xl:order-none min-w-0">
          <DirectiveForm
            cref={ref}
            memberId={memberId}
            characterId={characterId}
            world={everyone}
            ownCabinetId={cabinetId}
            cabinetNames={cabinetNames}
            wordLimit={settings.wordLimit}
            open={open}
            pausedNote={pausedNote}
            blockedReason={inactive ? inactive.title : null}
            onSent={() => { void readDirectives(ref); }}
            prefill={prefill}
            cabinet={cabinet ? { name: cabinet.name, logo_url: cabinet.logo_url, color: cabinet.color } : null}
            resend={resend}
            onResendDone={() => setResend(null)}
            onCooldown={setCooldownUntil}
          />
        </div>

        {/* Right: the news, then my directives. */}
        <div className="contents xl:flex xl:flex-col xl:gap-6 xl:min-w-0">
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
              onSendAgain={sendAgain}
              onEditReturned={editReturned}
            />
          </div>
        </div>
      </div>

      {dialog === 'character' && me && (
        <CharacterDialog me={me} color={myColor} goals={goals} goalsLoaded={goalsFresh} onClose={() => setDialog(null)} />
      )}
      {dialog === 'news' && <NewsDialog items={news.items} error={news.error} initial={story} onClose={() => setDialog(null)} />}
      {dialog === 'chat' && <ChatDialog room={room} onClose={() => setDialog(null)} />}
    </div>
  );
}
