'use client';
// Gavelling Crisis: the delegate's home. Header (in-world date, directives open or paused), my character,
// my secret goals, my cabinet's resources, the directive form and my directives. Phone first, three columns at 1440.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Lock, MapPin, PauseCircle, PlayCircle, Boxes, UserRound } from 'lucide-react';
import {
  crisisError, listDirectives, loadResources, loadSecrets, loadWorld, type CrisisRef,
} from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { CharacterSecret, CharacterStatus, Directive, DirectiveNote, Resource, ResourceType } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { BigCount, Card, CardTitle, CK, scenarioLabel, Skeleton } from '../../crisisKit';
import DirectiveForm, { type WorldCharacter } from './DirectiveForm';
import MyDirectives from './MyDirectives';
import { listAllNotes, listCoauthors } from './delegateData';

const STATUS_WORD: Record<CharacterStatus, string> = {
  active: 'Active', spare: 'Not in play', dead: 'Dead', arrested: 'Arrested', missing: 'Missing',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>{children}</p>;
}

export default function DelegateHome() {
  const v = useCrisis();
  const { ref, characterId, cabinetId, memberId, core, settings } = v;
  const crisis = core.crisis;

  const me = useMemo(() => core.characters.find((c) => c.id === characterId) ?? null, [core.characters, characterId]);
  const cabinetNames = useMemo(() => Object.fromEntries(core.cabinets.map((c) => [c.id, c.name])), [core.cabinets]);

  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [notes, setNotes] = useState<DirectiveNote[]>([]);
  const [coauthors, setCoauthors] = useState<Array<{ directive_id: string; character_id: string }>>([]);
  const [res, setRes] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [secrets, setSecrets] = useState<CharacterSecret[] | null>(null);
  const [world, setWorld] = useState<WorldCharacter[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const goals = secrets?.find((s) => s.character_id === characterId)?.goals?.trim() || '';
  const typeById = useMemo(() => new Map((res?.types ?? []).map((t) => [t.id, t])), [res]);
  const myResources = (res?.resources ?? []).filter((r) => (cabinetId && r.cabinet_id === cabinetId) || (characterId && r.character_id === characterId));

  const open = crisis.directives_open;

  return (
    <div style={{ paddingTop: 8 }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{crisis.name}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1" style={{ marginTop: 6 }}>
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: CK.inkSoft }}>
            <CalendarClock size={16} strokeWidth={1.5} aria-hidden />
            {scenarioLabel(crisis.scenario_at)}
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 800, color: open ? CK.ok : CK.red }}>
            {open ? <PlayCircle size={16} strokeWidth={1.5} aria-hidden /> : <PauseCircle size={16} strokeWidth={1.5} aria-hidden />}
            {open ? 'Directives are open' : 'Directives are paused'}
          </span>
        </div>
        {!open && crisis.directives_paused_note && (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: CK.red2, fontWeight: 600, overflowWrap: 'anywhere' }}>{crisis.directives_paused_note}</p>
        )}
        {loadError && <p role="status" style={{ margin: '6px 0 0', fontSize: 13, color: CK.danger }}>{loadError}</p>}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,1fr)] items-start">
        <div className="grid gap-4 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <Card>
            <CardTitle icon={<UserRound size={18} strokeWidth={1.5} />}>My Character</CardTitle>
            {me ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 grid place-items-center" style={{ width: 64, height: 64, borderRadius: '50%', background: CK.redGrad, color: '#FFF4E6', fontWeight: 800, fontSize: 22, overflow: 'hidden', boxShadow: `0 0 0 2px ${CK.gold}` }}>
                    {me.picture_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={me.picture_url} alt="" width={64} height={64} style={{ width: 64, height: 64, objectFit: 'cover' }} />
                      : initials(me.name)}
                  </span>
                  <div className="min-w-0">
                    <b style={{ display: 'block', fontSize: 18, lineHeight: 1.2, color: CK.ink, overflowWrap: 'anywhere' }}>{me.name}</b>
                    {me.title && <span style={{ display: 'block', fontSize: 13.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{me.title}</span>}
                  </div>
                </div>
                <dl className="grid gap-2" style={{ margin: '12px 0 0', fontSize: 13.5 }}>
                  <div>
                    <dt style={{ fontSize: 12, fontWeight: 700, color: CK.muted }}>Status</dt>
                    <dd style={{ margin: 0, fontWeight: 700, color: me.status === 'active' ? CK.ok : CK.danger }}>
                      {STATUS_WORD[me.status]}{me.status_note ? `. ${me.status_note}` : ''}
                    </dd>
                  </div>
                  {me.location && (
                    <div>
                      <dt style={{ fontSize: 12, fontWeight: 700, color: CK.muted }}>Location</dt>
                      <dd className="flex items-center gap-1.5" style={{ margin: 0, color: CK.ink, overflowWrap: 'anywhere' }}>
                        <MapPin size={14} strokeWidth={1.5} aria-hidden />{me.location}
                      </dd>
                    </div>
                  )}
                  {me.powers && (
                    <div>
                      <dt style={{ fontSize: 12, fontWeight: 700, color: CK.muted }}>Powers</dt>
                      <dd style={{ margin: 0, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{me.powers}</dd>
                    </div>
                  )}
                </dl>
              </>
            ) : (
              <Hint>You have no character yet. Ask your Crisis Director to give you one.</Hint>
            )}
          </Card>

          {me && (
            <Card warm>
              <CardTitle icon={<Lock size={17} strokeWidth={1.5} />} sub="Only you can see these.">My Secret Goals</CardTitle>
              {secrets === null ? <Skeleton h={48} r={12} /> : goals ? (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{goals}</p>
              ) : <Hint>No secret goals were given to you.</Hint>}
            </Card>
          )}

          <Card>
            <CardTitle icon={<Boxes size={18} strokeWidth={1.5} />}>My Cabinet&apos;s Resources</CardTitle>
            {res === null ? (
              <div className="grid gap-2"><Skeleton h={30} /><Skeleton h={30} /></div>
            ) : myResources.length === 0 ? (
              <Hint>No resources yet.</Hint>
            ) : (
              <div className="grid gap-3">
                {myResources.map((r) => {
                  const t = typeById.get(r.type_id);
                  const own = !!characterId && r.character_id === characterId;
                  return (
                    <div key={r.id}>
                      <BigCount n={Number(r.amount).toLocaleString()} word={`${t?.name ?? 'Resource'}${t?.unit ? ` (${t.unit})` : ''}`} />
                      {own && <span style={{ display: 'block', fontSize: 12, color: CK.muted, marginTop: 2 }}>Just for you</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-start-2 lg:row-start-1 xl:row-span-2 min-w-0">
          <DirectiveForm
            cref={ref}
            memberId={memberId}
            characterId={characterId}
            world={world.length ? world : core.characters}
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
    </div>
  );
}
