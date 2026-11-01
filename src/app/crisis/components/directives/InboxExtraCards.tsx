'use client';
// Gavelling Crisis: the cards for the extras in the backroom's "to reply" lanes (see inboxItems.tsx), in the one-by-one reader's
// own frames. Both are decided IN PLACE, never in a pop-up:
//   - a meeting request: who asks, whom they want to meet, why, how long; Approve, or Decline with an optional note. A request still
//     asking the others is greyed and says so (nothing to decide yet).
//   - a delegate whose character died, was arrested or went missing: the character they had (greyed, with its state) and the spare
//     picker (SpareOffer) to give them a new one. It disappears once they play a living character.

import { useState, type CSSProperties } from 'react';
import { CalendarClock, Check, ChevronDown, Clock, Hourglass, UserRoundPlus, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError } from '@/lib/crisis/api';
import type { Character } from '@/lib/crisis/types';
import { Avatar, Btn, CK, fieldStyle, agoLabel, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { decideMeetingChecked, MEETING_ALREADY_DECIDED } from '../meetings/decide';
import { AvatarStack, dueClock, hasWhen, requesterName, usePeople, whenText, type MeetingX, type Person } from '../meetings/meetingKit';
import SpareOffer from '../character/SpareOffer';
import { NavControls, FrontShell } from './readerParts';
import type { MeetingItem, SpareItem } from './inboxItems';

const MEETING_BLUE = '#3E6A9A';
/** Staff already hold every character, so the people map needs no extra world list. */
const NO_WORLD: Person[] = [];
const WAIT_COLOR = { ok: CK.ink, late: CK.goldDeep, very: CK.danger } as const;
const GONE_WORD: Record<string, string> = { dead: 'Dead', arrested: 'Arrested', missing: 'Missing' };
const goneWord = (c: Character) => GONE_WORD[c.status] ?? c.status;

interface FrontProps { now: number; index: number; total: number; onPrev: () => void; onNext: () => void; onChanged: () => void }

/** Everyone in a request, requester first, no one twice. */
function meetingPeople(m: MeetingItem['m']): string[] {
  return [...new Set([m.requested_by_character, ...m.character_ids].filter((x): x is string => !!x))];
}
const namesOf = (ids: string[], people: Map<string, Person>) => ids.map((id) => people.get(id)?.name ?? 'Unknown').join(', ');

const metaRow: CSSProperties = { margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12.5, fontWeight: 700, color: CK.inkSoft };

function MeetingFront({ item, now, index, total, onPrev, onNext, onChanged }: FrontProps & { item: MeetingItem }) {
  const { ref, core } = useCrisis();
  const m = item.m;
  const people = usePeople(core.characters, NO_WORLD);
  const asking = m.status === 'awaiting_delegates';
  const who = requesterName(m, people, core.members);
  const invited = m.character_ids.filter((id) => id !== m.requested_by_character);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const sev = asking ? null : waitSeverity(m.created_at, now);
  const due = dueClock(m as MeetingX);

  const decide = async (status: 'approved' | 'declined') => {
    if (busy) return;
    setBusy(true);
    try {
      const landed = await decideMeetingChecked(ref, m.id, status, status === 'declined' ? note : null, null);
      if (landed) notifyOk(status === 'approved' ? 'Meeting approved' : 'Meeting declined', 'crisis-meeting');
      else notifyErr(MEETING_ALREADY_DECIDED, 'crisis-meeting');
      setDeclining(false); setNote('');
      onChanged();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save that meeting decision.'), 'crisis-meeting');
    } finally { setBusy(false); }
  };

  return (
    <FrontShell color={MEETING_BLUE} label={`Meeting request from ${who}`}>
      <div style={{ flex: 'none', padding: '24px 26px 0 30px', opacity: asking ? 0.7 : 1 }}>
        <p style={metaRow}>
          <span className="inline-flex items-center" style={{ gap: 6 }}><CalendarClock size={15} strokeWidth={1.5} aria-hidden style={{ color: MEETING_BLUE }} />Meeting request</span>
          {asking && <span className="inline-flex items-center" style={{ gap: 5, color: CK.goldDeep }}><Hourglass size={13} strokeWidth={1.6} aria-hidden />Asking the others</span>}
          <span className="flex-1" />
          <span className="inline-flex items-center" style={{ gap: 4, fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sev ? WAIT_COLOR[sev] : CK.inkSoft }}>
            <Clock size={14} strokeWidth={1.6} aria-hidden />{asking ? `Asked ${agoLabel(m.created_at, now)}` : waitLabel(m.created_at, now)}
          </span>
        </p>
        <h2 style={{ margin: '8px 0 0', fontSize: 28, lineHeight: 1.18, fontWeight: 800, overflowWrap: 'anywhere' }}>
          {who} asks to meet {namesOf(invited.length ? invited : meetingPeople(m), people)}
        </h2>
        <div className="flex items-center" style={{ gap: 12, marginTop: 14 }}>
          <AvatarStack ids={meetingPeople(m).slice(0, 5)} people={people} cabinets={core.cabinets} size={54} />
        </div>
      </div>
      <div className="rd-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 26px 12px 30px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: CK.well, borderRadius: 16, padding: '11px 14px' }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: CK.inkSoft }}>Why they want to meet</p>
          <p style={{ margin: '4px 0 0', fontSize: 16, lineHeight: 1.6, fontWeight: 500, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.intention}</p>
        </div>
        <p className="flex flex-wrap items-center" style={{ margin: 0, gap: '2px 14px', fontSize: 12.5, fontWeight: 700, color: CK.muted }}>
          <span>{m.duration_minutes} min</span>
          {hasWhen(m) && <span>{whenText(m)}</span>}
        </p>
        {asking && (
          <p style={{ margin: 0, fontSize: 14, color: CK.goldDeep, fontWeight: 700 }}>
            The others have not all answered yet{due ? `. It moves on by itself around ${due}` : ''}. Nothing to decide until they do.
          </p>
        )}
      </div>
      <div className="flex items-center flex-wrap" data-no-open style={{ flex: 'none', gap: '8px 16px', padding: '12px 20px 14px 30px', boxShadow: `0 -1px 0 ${CK.hair}`, borderRadius: '0 0 24px 24px', background: CK.card }}>
        <div className="flex items-center flex-wrap" style={{ flex: '1 1 260px', minWidth: 0, gap: 8 }}>
          {!asking && !declining && (
            <>
              <Btn tone="green" icon={<Check size={16} strokeWidth={1.6} aria-hidden />} disabled={busy} onClick={() => { void decide('approved'); }}>Approve</Btn>
              <Btn tone="danger" icon={<X size={16} strokeWidth={1.6} aria-hidden />} disabled={busy} onClick={() => setDeclining(true)}>Decline</Btn>
            </>
          )}
          {!asking && declining && (
            <>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 300))}
                placeholder="Note to the delegates (optional)"
                aria-label="Note to the delegates"
                autoFocus
                style={{ ...fieldStyle, flex: '1 1 220px', minWidth: 0, padding: '9px 12px', fontSize: 14.5, minHeight: 42, borderRadius: 11 }}
              />
              <Btn tone="red" disabled={busy} onClick={() => { void decide('declined'); }}>Decline meeting</Btn>
              <Btn tone="ghost" disabled={busy} onClick={() => { setDeclining(false); setNote(''); }}>Back</Btn>
            </>
          )}
        </div>
        <NavControls index={index} total={total} onPrev={onPrev} onNext={onNext} />
      </div>
    </FrontShell>
  );
}

function SpareFront({ item, index, total, onPrev, onNext, onChanged }: FrontProps & { item: SpareItem }) {
  const { core } = useCrisis();
  const { member, char } = item;
  const cab = core.cabinets.find((c) => c.id === char.cabinet_id);
  return (
    <FrontShell color={CK.danger} label={`${member.display_name} needs a new character`}>
      <div style={{ flex: 'none', padding: '24px 26px 0 30px' }}>
        <p style={metaRow}>
          <span className="inline-flex items-center" style={{ gap: 6, color: CK.danger }}><UserRoundPlus size={15} strokeWidth={1.5} aria-hidden />Needs a new character</span>
        </p>
        <h2 style={{ margin: '8px 0 0', fontSize: 28, lineHeight: 1.18, fontWeight: 800, overflowWrap: 'anywhere' }}>Give {member.display_name} a new character</h2>
        <div className="flex items-center" style={{ gap: 14, marginTop: 14 }}>
          <span style={{ lineHeight: 0, opacity: 0.6, filter: 'grayscale(0.9)' }}><Avatar name={char.name} src={char.picture_url} size={58} color={cab?.color ?? CK.red} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{char.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 800, color: CK.danger }}>{goneWord(char)}{cab ? <span style={{ color: CK.muted, fontWeight: 600 }}> · {cab.name}</span> : null}</p>
          </div>
        </div>
      </div>
      <div className="rd-scroll" data-no-open style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 26px 12px 30px' }}>
        <SpareOffer delegate={member} char={char} framed={false} onDone={onChanged} />
      </div>
      <div className="flex items-center justify-end" data-no-open style={{ flex: 'none', padding: '12px 20px 14px 30px', boxShadow: `0 -1px 0 ${CK.hair}`, borderRadius: '0 0 24px 24px', background: CK.card }}>
        <NavControls index={index} total={total} onPrev={onPrev} onNext={onNext} />
      </div>
    </FrontShell>
  );
}

/** The front card of an extra. */
export function ExtraFront({ item, ...rest }: FrontProps & { item: MeetingItem | SpareItem }) {
  return item.extra === 'meeting' ? <MeetingFront item={item} {...rest} /> : <SpareFront item={item} {...rest} />;
}

/** What a stacked (smaller) card of an extra says: an icon and a label, the headline, the people, the wait. */
export function ExtraNextBody({ item, now }: { item: MeetingItem | SpareItem; now: number }) {
  const { core } = useCrisis();
  const people = usePeople(core.characters, NO_WORLD);
  if (item.extra === 'spare') {
    const { member, char } = item;
    const cab = core.cabinets.find((c) => c.id === char.cabinet_id);
    return (
      <>
        <span className="inline-flex items-center" style={{ flex: 'none', gap: 5, fontSize: 12, fontWeight: 800, color: CK.danger }}><UserRoundPlus size={14} strokeWidth={1.5} aria-hidden />Needs a new character</span>
        <span style={{ display: 'block', flex: 'none', marginTop: 6, fontSize: 18, fontWeight: 800, lineHeight: 1.22, overflowWrap: 'anywhere' }}>Give {member.display_name} a new character</span>
        <span className="flex items-center" style={{ flex: 'none', gap: 9, marginTop: 11 }}>
          <span style={{ lineHeight: 0, opacity: 0.6, filter: 'grayscale(0.9)' }}><Avatar name={char.name} src={char.picture_url} size={38} color={cab?.color ?? CK.red} /></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: CK.inkSoft, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{char.name}</span>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: CK.danger, lineHeight: 1.25 }}>{goneWord(char)}</span>
          </span>
        </span>
      </>
    );
  }
  const m = item.m;
  const asking = m.status === 'awaiting_delegates';
  const who = requesterName(m, people, core.members);
  const sev = asking ? null : waitSeverity(m.created_at, now);
  return (
    <>
      <span className="inline-flex items-center" style={{ flex: 'none', gap: 5, fontSize: 12, fontWeight: 800, color: asking ? CK.goldDeep : MEETING_BLUE }}>
        {asking ? <Hourglass size={14} strokeWidth={1.5} aria-hidden /> : <CalendarClock size={14} strokeWidth={1.5} aria-hidden />}{asking ? 'Asking the others' : 'Meeting request'}
      </span>
      <span style={{ display: 'block', flex: 'none', marginTop: 6, fontSize: 18, fontWeight: 800, lineHeight: 1.22, overflowWrap: 'anywhere' }}>
        {who} asks to meet {namesOf(m.character_ids.filter((id) => id !== m.requested_by_character), people) || 'others'}
      </span>
      <span className="flex items-center" style={{ flex: 'none', gap: 9, marginTop: 11 }}>
        <AvatarStack ids={meetingPeople(m).slice(0, 3)} people={people} cabinets={core.cabinets} size={32} />
      </span>
      <span className="inline-flex items-center" style={{ flex: 'none', gap: 3, marginTop: 10, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sev ? WAIT_COLOR[sev] : CK.inkSoft }}>
        <Clock size={12} strokeWidth={1.6} aria-hidden />{asking ? `Asked ${agoLabel(m.created_at, now)}` : waitLabel(m.created_at, now)}
      </span>
      <span className="rd-fade" style={{ display: 'block', flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 11, fontSize: 14, lineHeight: 1.55, fontWeight: 500, color: CK.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.intention}</span>
    </>
  );
}

/**
 * Command's "Waiting for a Reply": a delegate whose character is dead, arrested or missing sits at the very TOP as a compact row (greyed
 * portrait, "Give <delegate> a new character", the state). Pressing it opens the spare picker (SpareOffer) in place, under the row;
 * it leaves by itself once the delegate plays a living character. Nothing here writes except SpareOffer's own give.
 */
export function SpareTopRow({ item, onChanged }: { item: SpareItem; onChanged?: () => void }) {
  const { core } = useCrisis();
  const [open, setOpen] = useState(false);
  const { member, char } = item;
  const cab = core.cabinets.find((c) => c.id === char.cabinet_id);
  return (
    <div style={{ background: 'rgba(163,65,47,0.07)', borderRadius: 14, boxShadow: 'inset 0 0 0 1px rgba(163,65,47,0.22)', margin: '0 0 8px' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ gap: 10, padding: '8px 10px', border: 0, background: 'transparent', cursor: 'pointer', borderRadius: 14, fontFamily: CK.font, color: CK.ink }}
      >
        <span style={{ lineHeight: 0, opacity: 0.6, filter: 'grayscale(0.9)', flex: 'none' }}><Avatar name={char.name} src={char.picture_url} size={34} color={cab?.color ?? CK.red} /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="flex items-center" style={{ gap: 5, fontSize: 14.5, fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
            <UserRoundPlus size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none', color: CK.danger }} />
            Give {member.display_name} a new character
          </span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: CK.danger, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
            {char.name}, {goneWord(char).toLowerCase()}
          </span>
        </span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden style={{ flex: 'none', color: CK.inkSoft, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
      </button>
      {open && (
        <div style={{ padding: '0 10px 10px' }}>
          <SpareOffer delegate={member} char={char} framed={false} onDone={() => { setOpen(false); onChanged?.(); }} />
        </div>
      )}
    </div>
  );
}
