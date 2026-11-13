'use client';
// Gavelling Crisis: the delegate's page of ALL their directives (owner, 1 Nov 2026: "my directives should bring them to the page of all
// directives"). Newest first, every status, filter chips on top (Waiting, Answered, Changes asked for, Withdrawn, All). A card opens the same
// directive pop-up as on the home page, where the author can write a clarification, edit or withdraw it while nobody has answered it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crisisError, listDirectives, loadWorld, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive, DirectiveNote, DirectiveStatus } from '@/lib/crisis/types';
import { Card, CK, Skeleton } from '../../crisisKit';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import DirectiveDialog from './DirectiveDialog';
import DirectiveDeepLink from '../notifications/DirectiveDeepLink';
import { DirectiveCard, type PersonRef } from './MyDirectives';
import DraftCard from './DraftCard';
import { requestOpenDraft, useSavedDrafts } from './draftStore';
import { isCoauthorOf, listAllNotes, listCoauthors } from './delegateData';
import type { WorldCharacter } from './DirectiveForm';

type FilterKey = 'waiting' | 'answered' | 'changes' | 'withdrawn' | 'drafts' | 'all';

const GROUP: Record<DirectiveStatus, Exclude<FilterKey, 'all' | 'drafts'>> = {
  awaiting_chair: 'waiting',
  queued: 'waiting',
  claimed: 'waiting',
  changes_requested: 'changes',
  clarify: 'changes',
  answered: 'answered',
  rejected: 'answered',
  withdrawn: 'withdrawn',
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'answered', label: 'Answered' },
  { key: 'changes', label: 'Changes asked for' },
  { key: 'withdrawn', label: 'Withdrawn' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'all', label: 'All' },
];

export default function MyDirectivesPage() {
  const { ref, memberId, characterId, core } = useCrisis();
  const router = useRouter();
  const { drafts, remove: removeDraft } = useSavedDrafts(ref.id, memberId);
  const liveMember = core.members.find((m) => m.id === memberId) ?? null;
  const myCharacterId = liveMember ? liveMember.character_id : characterId;
  const me = useMemo(() => core.characters.find((c) => c.id === myCharacterId) ?? null, [core.characters, myCharacterId]);

  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [notes, setNotes] = useState<DirectiveNote[]>([]);
  const [coauthors, setCoauthors] = useState<Array<{ directive_id: string; character_id: string }>>([]);
  const [world, setWorld] = useState<WorldCharacter[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const seq = useRef(0);

  const read = useCallback(async (r: CrisisRef) => {
    const mine = ++seq.current;
    try {
      const [d, n, c, w] = await Promise.all([listDirectives(r), listAllNotes(r), listCoauthors(r), loadWorld(r)]);
      if (mine !== seq.current) return;
      setDirectives(d); setNotes(n); setCoauthors(c); setWorld(w); setLoadError(null);
    } catch (e) {
      if (mine === seq.current) setLoadError(crisisError(e, 'Could not refresh this page.'));
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => { void read(ref); }, 0);
    return () => window.clearTimeout(t);
  }, [ref, read]);

  useCrisisLive(ref.id, ['crisis_directives', 'crisis_directive_notes', 'crisis_characters', 'crisis_members'], () => { void read(ref); });

  const cabinetColor = useMemo(() => Object.fromEntries(core.cabinets.map((c) => [c.id, c.color])) as Record<string, string>, [core.cabinets]);
  const everyone = useMemo<WorldCharacter[]>(() => {
    const byId = new Map<string, WorldCharacter>();
    for (const c of world) byId.set(c.id, c);
    for (const c of core.characters) byId.set(c.id, c);
    return [...byId.values()];
  }, [world, core.characters]);
  const personOf = useCallback((id: string | null): PersonRef => {
    const c = id ? everyone.find((x) => x.id === id) : undefined;
    if (c) return { name: c.name, picture_url: c.picture_url ?? null, color: (c.cabinet_id && cabinetColor[c.cabinet_id]) || CK.red };
    if (me) return { name: me.name, picture_url: me.picture_url, color: (me.cabinet_id && cabinetColor[me.cabinet_id]) || CK.red };
    return { name: '?', picture_url: null, color: CK.red };
  }, [everyone, cabinetColor, me]);
  const memberName = useCallback((id: string | null) => (id ? core.members.find((m) => m.id === id)?.display_name ?? null : null), [core.members]);

  const all = useMemo(() => [...(directives ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)), [directives]);
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { waiting: 0, answered: 0, changes: 0, withdrawn: 0, drafts: drafts.length, all: all.length + drafts.length };
    for (const d of all) c[GROUP[d.status]] += 1;
    return c;
  }, [all, drafts.length]);
  const shown = filter === 'all' ? all : filter === 'drafts' ? [] : all.filter((d) => GROUP[d.status] === filter);
  const shownDrafts = filter === 'all' || filter === 'drafts' ? drafts : [];
  // A draft opens in the Send a Directive form, which lives on the home page.
  const openDraft = (id: string) => { requestOpenDraft(ref.id, memberId, id); router.push(crisisBase(ref)); };
  const openOne = openId ? all.find((d) => d.id === openId) ?? null : null;

  return (
    <div style={{ paddingTop: 4, fontFamily: CK.font }}>
      <DirectiveDeepLink onId={setOpenId} />
      {loadError && <p role="status" style={{ margin: '0 0 10px', fontSize: 13, color: CK.danger }}>{loadError}</p>}
      <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: CK.ink }}>My Directives</h1>
      <div className="flex flex-wrap" role="group" aria-label="Filter directives" style={{ gap: 8, marginBottom: 18 }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform active:scale-[0.97]"
              style={{
                height: 34, padding: '0 14px', borderRadius: 12, border: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 13.5, fontWeight: 800,
                background: on ? CK.red : CK.card, color: on ? '#FFF' : CK.inkSoft, boxShadow: on ? 'none' : CK.shadowSm,
              }}
            >
              {f.label} <span style={{ fontVariantNumeric: 'tabular-nums', opacity: on ? 0.85 : 0.7 }}>{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {directives === null ? (
        <div className="grid gap-3"><Skeleton h={112} r={20} /><Skeleton h={112} r={20} /></div>
      ) : shown.length === 0 && shownDrafts.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>{all.length === 0 && drafts.length === 0 ? 'You have not sent a directive yet.' : filter === 'drafts' ? 'No saved drafts. Press Save as draft when you write a directive to keep it here.' : 'No directives here.'}</p></Card>
      ) : (
        <div className="grid" style={{ gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', alignItems: 'start' }}>
          {shownDrafts.map((e) => (
            <div key={e.id} style={{ marginTop: 6 }}><DraftCard entry={e} onOpen={() => openDraft(e.id)} onDelete={() => removeDraft(e.id)} /></div>
          ))}
          {shown.map((d) => <DirectiveCard key={d.id} d={d} author={personOf(d.author_character_id)} onOpen={() => setOpenId(d.id)} />)}
        </div>
      )}

      {openOne && (
        <DirectiveDialog
          key={openOne.id}
          cref={ref}
          d={openOne}
          notes={notes.filter((n) => n.directive_id === openOne.id)}
          withNames={coauthors.filter((c) => c.directive_id === openOne.id).map((c) => personOf(c.character_id).name).filter((n) => n !== '?')}
          myMemberId={memberId}
          author={personOf(openOne.author_character_id)}
          isAuthor={openOne.author_member_id === memberId}
          canReply={openOne.author_member_id === memberId || (openOne.kind === 'committee' && isCoauthorOf(coauthors, openOne.id, myCharacterId))}
          answeredBy={memberName(openOne.answered_by)}
          onChanged={() => { void read(ref); }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
