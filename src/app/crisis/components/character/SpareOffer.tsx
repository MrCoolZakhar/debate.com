'use client';
// Gavelling Crisis: giving a delegate a character, asked IN PLACE (never a second pop-up).
//   1. A character a delegate plays has died, been arrested or gone missing: "Give <delegate> a spare character?" (`char` is the
//      character they play now).
//   2. A spare delegate (a delegate with no character yet) in Staff and Access: "Give <delegate> a character?" (no `char`).
// The list is the characters nobody plays: spare characters first, then active ones nobody has. A character picked from it can
// also go to a SPARE DELEGATE instead (the second step replaces the list; Back returns). The database does the work
// (crisis_give_spare for a spare character): the delegate's room seat is renamed, and their directives and points stay with them.
// `AssignSpareDelegate` is the other direction: one character, pick which spare delegate plays it (Staff and Access uses it too).

import { useMemo, useState } from 'react';
import { ArrowLeft, UserRoundPlus } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError } from '@/lib/crisis/api';
import { placeDelegate } from '@/lib/crisis/placeDelegate';
import type { Character, Member } from '@/lib/crisis/types';
import { Avatar, Btn, CK, cabinetTint } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';

const KEY = 'crisis-spare';

/** A character that has to be replaced for the delegate who plays it. */
export const isGoneStatus = (s: Character['status']) => s === 'dead' || s === 'arrested' || s === 'missing';

/** The cabinet's spare characters nobody plays. */
export function freeSpares(characters: Character[], members: Member[], cabinetId: string | null): Character[] {
  const played = new Set(members.map((m) => m.character_id).filter((x): x is string => !!x));
  return characters.filter((c) => c.status === 'spare' && c.cabinet_id === cabinetId && !played.has(c.id));
}

/** Characters nobody plays that a delegate could be given: spare ones first, then active ones; the preferred cabinet leads each kind. */
export function freeCharacters(characters: Character[], members: Member[], preferCabinet: string | null = null): Character[] {
  const played = new Set(members.map((m) => m.character_id).filter((x): x is string => !!x));
  const rank = (c: Character) => (c.status === 'spare' ? 0 : 2) + (preferCabinet && c.cabinet_id === preferCabinet ? 0 : 1);
  return characters
    .filter((c) => (c.status === 'spare' || c.status === 'active') && !played.has(c.id))
    .sort((a, b) => rank(a) - rank(b) || a.sort - b.sort || a.name.localeCompare(b.name));
}

/** A delegate with no character yet: they can sign in and wait. */
export const isSpareDelegate = (m: Member) => m.role === 'delegate' && !m.character_id;

export default function SpareOffer({ delegate, char, onDone, onNotNow, framed = true }: {
  delegate: Member;
  /** The character the delegate plays now. Leave out for a spare delegate who has none yet. */
  char?: Character;
  /** Called after a character was given. */
  onDone?: () => void;
  /** Called by "Not now". Leave out to hide the button. */
  onNotNow?: () => void;
  framed?: boolean;
}) {
  const { ref, core, reloadCore } = useCrisis();
  const prefer = char?.cabinet_id ?? delegate.cabinet_id ?? null;
  const list = useMemo(() => freeCharacters(core.characters, core.members, prefer), [core.characters, core.members, prefer]);
  const spareDelegates = useMemo(() => core.members.filter((m) => isSpareDelegate(m) && m.id !== delegate.id), [core.members, delegate.id]);
  const [pick, setPick] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toDelegate, setToDelegate] = useState(false);
  const cabinetOf = (id: string | null) => core.cabinets.find((c) => c.id === id);
  const chosen = list.find((s) => s.id === pick) ?? null;

  if (toDelegate && chosen) {
    return (
      <AssignSpareDelegate
        character={chosen}
        exclude={delegate.id}
        framed={framed}
        onBack={() => setToDelegate(false)}
        onDone={() => { setToDelegate(false); onDone?.(); }}
      />
    );
  }

  const give = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    try {
      const r = await placeDelegate(ref, delegate, chosen);
      if (!r.ok) {
        notifyErr(`${chosen.name} was just given to someone else. Pick another character`, KEY);
        await reloadCore();
        setPick('');
        return;
      }
      notifyOk(`${delegate.display_name} now plays ${chosen.name}`, KEY);
      await reloadCore();
      onDone?.();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not give the character.'), KEY);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col" style={{ gap: 10, fontFamily: CK.font, ...(framed ? { background: 'rgba(163,65,47,0.07)', borderRadius: 16, padding: 14, boxShadow: 'inset 0 0 0 1px rgba(163,65,47,0.2)' } : {}) }}>
      <p className="flex items-center" style={{ margin: 0, gap: 8, fontSize: 14, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>
        <UserRoundPlus size={17} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
        {char ? `Give ${delegate.display_name} a new character?` : `Give ${delegate.display_name} a character?`}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>
        {char
          ? 'Their seat in the room takes the new character’s name and picture. Their directives and points stay with them.'
          : 'Spare characters come first, then characters nobody plays. Their cabinet follows the character.'}
      </p>
      {list.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>Every character has a delegate. Add a character and set its status to Spare.</p>
      ) : (
        <div role="radiogroup" aria-label={`Character for ${delegate.display_name}`} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', maxHeight: 300, overflowY: 'auto', padding: 2 }}>
          {list.map((s) => {
            const on = pick === s.id;
            const cab = cabinetOf(s.cabinet_id);
            const color = cab?.color ?? CK.red;
            return (
              <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(s.id)}
                className="flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform"
                style={{ gap: 9, border: 0, cursor: 'pointer', borderRadius: 14, padding: '8px 10px', fontFamily: CK.font, background: on ? cabinetTint(color, 0.14) : CK.card, boxShadow: on ? `inset 0 0 0 2px ${color}` : `inset 0 0 0 1px ${CK.hair}` }}>
                <Avatar name={s.name} src={s.picture_url} size={38} color={color} />
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{s.name}</b>
                  <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                    {s.status === 'spare' ? 'Spare' : 'Active'}{cab ? ` · ${cab.name}` : ''}
                  </span>
                  {s.title && <span style={{ display: 'block', fontSize: 12, color: CK.muted, overflowWrap: 'anywhere' }}>{s.title}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        {list.length > 0 && <Btn size="sm" onClick={() => { void give(); }} disabled={!pick || busy}>{busy ? 'Giving' : `Give to ${delegate.display_name}`}</Btn>}
        {list.length > 0 && spareDelegates.length > 0 && (
          <Btn size="sm" tone="ghost" icon={<UserRoundPlus size={13} strokeWidth={1.5} />} onClick={() => setToDelegate(true)} disabled={!pick || busy}>Give it to a spare delegate</Btn>
        )}
        {onNotNow && <Btn size="sm" tone="ghost" onClick={onNotNow} disabled={busy}>Not now</Btn>}
      </div>
    </div>
  );
}

/** One character, and the spare delegates who could play it. Picking one sets their character (their cabinet follows). */
export function AssignSpareDelegate({ character, exclude, onDone, onBack, framed = true }: {
  character: Character;
  /** A delegate not to offer (the one the page is already about). */
  exclude?: string;
  onDone?: () => void;
  /** Called by Back. Leave out to hide it. */
  onBack?: () => void;
  framed?: boolean;
}) {
  const { ref, core, reloadCore } = useCrisis();
  const people = useMemo(() => core.members.filter((m) => isSpareDelegate(m) && m.id !== exclude), [core.members, exclude]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const cab = core.cabinets.find((c) => c.id === character.cabinet_id);
  const color = cab?.color ?? CK.red;

  const assign = async () => {
    const who = people.find((m) => m.id === pick);
    if (!who || busy) return;
    setBusy(true);
    try {
      const r = await placeDelegate(ref, who, character);
      if (!r.ok) {
        notifyErr(`${character.name} was just given to someone else`, KEY);
        await reloadCore();
        return;
      }
      notifyOk(`${who.display_name} now plays ${character.name}`, KEY);
      await reloadCore();
      onDone?.();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not assign the delegate.'), KEY);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col" style={{ gap: 10, fontFamily: CK.font, ...(framed ? { background: 'rgba(163,65,47,0.07)', borderRadius: 16, padding: 14, boxShadow: 'inset 0 0 0 1px rgba(163,65,47,0.2)' } : {}) }}>
      <p className="flex items-center" style={{ margin: 0, gap: 10, fontSize: 14, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>
        <Avatar name={character.name} src={character.picture_url} size={32} color={color} />
        Who plays {character.name}?
      </p>
      {people.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>There are no spare delegates. Add one under Spare Delegates.</p>
      ) : (
        <div role="radiogroup" aria-label={`Spare delegate for ${character.name}`} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', maxHeight: 300, overflowY: 'auto', padding: 2 }}>
          {people.map((m) => {
            const on = pick === m.id;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(m.id)}
                className="flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform"
                style={{ gap: 9, border: 0, cursor: 'pointer', borderRadius: 14, padding: '8px 10px', fontFamily: CK.font, background: on ? cabinetTint(color, 0.14) : CK.card, boxShadow: on ? `inset 0 0 0 2px ${color}` : `inset 0 0 0 1px ${CK.hair}` }}>
                <Avatar name={m.display_name} size={38} color={core.cabinets.find((c) => c.id === m.cabinet_id)?.color ?? CK.forest2} />
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{m.display_name}</b>
                  {m.email && <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{m.email}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        {people.length > 0 && <Btn size="sm" onClick={() => { void assign(); }} disabled={!pick || busy}>{busy ? 'Assigning' : `Assign to ${character.name}`}</Btn>}
        {onBack && <Btn size="sm" tone="ghost" icon={<ArrowLeft size={13} strokeWidth={1.5} />} onClick={onBack} disabled={busy}>Back</Btn>}
      </div>
    </div>
  );
}
