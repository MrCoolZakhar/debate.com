'use client';
// Gavelling Crisis: who looks after a delegate's character, changeable right from the directive reader. A small
// picture and name of the responsible backroomer; the Crisis Director can pick another. Picking asks first, in
// place: the character's future directives go to the new backroomer, and the open directives nobody has claimed
// can move with them (through crisis_assign_directive). A directive somebody is writing at this moment is never
// moved from under them. Only the director may change a character's backroomer (like on the character's own page).

import { useMemo, useState } from 'react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import GSelect from '@/components/GSelect';
import { assignDirective, crisisError, saveCharacter } from '@/lib/crisis/api';
import { ROLE_LABEL, type Character, type Directive } from '@/lib/crisis/types';
import { Btn, CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { StaffPic } from './directiveParts';
import { isBeingWritten, isOpenStatus, memberName, type Names } from './directiveKit';
import { useNow } from './useNow';

export default function CharacterBackroomer({ character, names, all, onChanged }: {
  character: Character;
  names: Names;
  /** Every directive of the crisis, to find the character's open ones. */
  all: Directive[];
  /** The move landed: re-read the directives. */
  onChanged: () => void;
}) {
  const { ref, core, director, memberId, reloadCore } = useCrisis();
  const now = useNow();
  const owner = character.owner_member_id ? names.members.get(character.owner_member_id) : undefined;
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () => core.members
      .filter((m) => m.role === 'director' || m.role === 'assistant_director' || m.role === 'backroomer')
      .map((m) => ({ value: m.id, label: m.id === memberId ? `${m.display_name} (you)` : m.display_name, hint: ROLE_LABEL[m.role], icon: <StaffPic member={m} size={24} /> })),
    [core.members, memberId],
  );

  // The character's open directives nobody has claimed; one being written stays where it is.
  const open = all.filter((x) => x.author_character_id === character.id && isOpenStatus(x) && x.assigned_member_id === null);
  const movable = open.filter((x) => !isBeingWritten(x, now));
  const kept = open.length - movable.length;

  const run = async (moveOpen: boolean) => {
    if (!pick || busy) return;
    setBusy(true);
    try {
      await saveCharacter(ref, { id: character.id, owner_member_id: pick });
      let moved = 0;
      if (moveOpen) for (const x of movable) { await assignDirective(ref, x.id, pick); moved += 1; }
      await reloadCore();
      notifyOk(moved ? `${character.name} is with ${memberName(pick, names)} now, with ${moved} open ${moved === 1 ? 'directive' : 'directives'}` : `${character.name} is with ${memberName(pick, names)} now`, 'crisis-reassign');
      setPick(null);
      onChanged();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not move the character. Try again.'), 'crisis-reassign');
    } finally { setBusy(false); }
  };

  if (pick) {
    return (
      <div className="flex flex-col" role="alertdialog" aria-label={`Reassign ${character.name}`} style={{ gap: 6, minWidth: 0, fontFamily: CK.font }}>
        <p className="flex items-center" style={{ margin: 0, gap: 8, fontSize: 13.5, fontWeight: 800, color: CK.ink, lineHeight: 1.3 }}>
          <StaffPic member={names.members.get(pick)} size={24} />
          <span style={{ overflowWrap: 'anywhere' }}>Reassign {character.name} to {memberName(pick, names)}?</span>
        </p>
        <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft, lineHeight: 1.35 }}>
          Their new directives go to {memberName(pick, names)}.
          {movable.length > 0 ? ` ${movable.length} open ${movable.length === 1 ? 'directive has' : 'directives have'} nobody on it yet.` : ''}
          {kept > 0 ? ` ${kept} being written stays with ${kept === 1 ? 'its writer' : 'the writers'}.` : ''}
        </p>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {movable.length > 0 && <Btn tone="green" size="sm" disabled={busy} onClick={() => { void run(true); }}>{`Reassign and move ${movable.length} open`}</Btn>}
          <Btn tone={movable.length > 0 ? 'ghost' : 'green'} size="sm" disabled={busy} onClick={() => { void run(false); }}>{movable.length > 0 ? 'Reassign only' : 'Reassign'}</Btn>
          <Btn tone="ghost" size="sm" disabled={busy} onClick={() => setPick(null)}>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center" style={{ gap: 9, minWidth: 0, fontFamily: CK.font }}>
      <StaffPic member={owner ?? null} size={30} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: CK.muted }}>Backroomer for {character.name}</span>
        <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{owner ? owner.display_name : 'Nobody yet'}</b>
      </span>
      {director && options.length > 0 && (
        <div style={{ width: 150, flex: 'none' }} data-no-open>
          <GSelect size="sm" value={owner?.id ?? ''} options={options} onChange={(v) => { if (v && v !== owner?.id) setPick(v); }}
            placeholder="Reassign" aria-label={`Reassign ${character.name} to another backroomer`} />
        </div>
      )}
    </div>
  );
}
