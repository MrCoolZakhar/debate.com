'use client';
// Gavelling Crisis: the cards for the extras in the backroom's "to reply" lanes (see inboxItems.tsx), in the one-by-one reader's
// own frames. Both are decided IN PLACE, never in a pop-up:
//   - a meeting request, on its own MEETING CARD (owner, 2 Nov 2026: clearly not a directive): framed in meeting blue with a "Meeting Request"
//     badge on its top edge, the asker's portrait with the invited ones overlapping, "<Asker> wants to meet <A> and <B>" (the asker is never
//     listed among the people asked), the reason (or "No reason given"), the length, how long it has waited; Approve, or Decline with an
//     optional note. A request still asking the others is greyed, shows who answered so far and says nothing is to be decided yet.
//   - a delegate whose character died, was arrested or went missing: the character they had (greyed, with its state) and the spare
//     picker (SpareOffer) to give them a new one. It disappears once they play a living character.

import { useState, type CSSProperties } from 'react';
import { CalendarClock, Check, ChevronDown, Clock, Hourglass, Timer, UserRoundPlus, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError } from '@/lib/crisis/api';
import type { Character } from '@/lib/crisis/types';
import { Avatar, Btn, CK, fieldStyle, agoLabel, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { decideMeetingChecked, MEETING_ALREADY_DECIDED } from '../meetings/decide';
import { AnswerList, AvatarStack, dueClock, hasWhen, requesterName, usePeople, whenText, type MeetingX, type Person } from '../meetings/meetingKit';
import { useMeetingResponses } from '../meetings/useMeetingResponses';
import SpareOffer from '../character/SpareOffer';
import { CharacterName } from '../character/CharacterProfileHost';
import { cabinetWash } from './cabinetStamp';
import { NavControls, FrontShell } from './readerParts';
import type { MeetingItem, SpareItem } from './inboxItems';

/** The meeting colour: a deep blue, so a meeting is never mistaken for a directive (red) or a cabinet directive (its own colour). */
export const MEETING_BLUE = '#2F5C93';
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
/** The people ASKED: everyone named except the one who asks (their own character is in `character_ids`). */
function invitedOf(m: MeetingItem['m']): string[] {
  return [...new Set(m.character_ids.filter((id) => id !== m.requested_by_character))];
}
/** The reason typed with the request; nothing when it is empty or only the placeholder word "meeting". */
function reasonOf(m: MeetingItem['m']): string | null {
  const t = (m.intention ?? '').trim();
  return !t || t.toLowerCase() === 'meeting' ? null : t;
}
/** "1 minute", "15 minutes", "1 hour", "1 hour 30 minutes". */
function lengthLabel(min: number): string {
  if (min < 60) return `${min} ${min === 1 ? 'minute' : 'minutes'}`;
  const h = Math.floor(min / 60); const r = min % 60;
  return `${h} ${h === 1 ? 'hour' : 'hours'}${r ? ` ${r} ${r === 1 ? 'minute' : 'minutes'}` : ''}`;
}
/** "A", "A and B", "A, B and C"; each name a link to the character when `link`. */
function InvitedNames({ ids, people, link }: { ids: string[]; people: Map<string, Person>; link?: boolean }) {
  return (
    <>
      {ids.map((id, i) => {
        const name = people.get(id)?.name ?? 'Unknown';
        return (
          <span key={id}>
            {i === 0 ? '' : i === ids.length - 1 ? ' and ' : ', '}
            <b style={{ fontWeight: 800 }}>{link ? <CharacterName id={id} name={name} /> : name}</b>
          </span>
        );
      })}
    </>
  );
}

/** The "Meeting Request" badge that hangs over a meeting card's top edge. */
export function MeetingBadge({ small, grey, style }: { small?: boolean; grey?: boolean; style?: CSSProperties }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: small ? 5 : 7, padding: small ? '3px 10px 3px 8px' : '5px 14px 5px 11px', borderRadius: 999, background: grey ? CK.muted : MEETING_BLUE, color: '#FFFFFF',
        fontFamily: CK.font, fontSize: small ? 11.5 : 13, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(27,56,40,0.28)', ...style,
      }}
    >
      <CalendarClock size={small ? 13 : 16} strokeWidth={1.7} aria-hidden />Meeting Request
    </span>
  );
}

const metaRow: CSSProperties = { margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12.5, fontWeight: 700, color: CK.inkSoft };

function MeetingFront({ item, now, index, total, onPrev, onNext, onChanged }: FrontProps & { item: MeetingItem }) {
  const { ref, core } = useCrisis();
  const m = item.m;
  const people = usePeople(core.characters, NO_WORLD);
  const asking = m.status === 'awaiting_delegates';
  const who = requesterName(m, people, core.members);
  const invited = invitedOf(m);
  const reason = reasonOf(m);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const sev = asking ? null : waitSeverity(m.created_at, now);
  const due = dueClock(m as MeetingX);
  // Who has answered so far: only while the others are still being asked (re-read every 8 s).
  const { responses } = useMeetingResponses(ref, asking, true);

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
    <FrontShell color={MEETING_BLUE} ring tint={cabinetWash(MEETING_BLUE)} label={`Meeting request from ${who}`}>
      <span style={{ position: 'absolute', zIndex: 2, top: -15, left: 26 }}><MeetingBadge grey={asking} /></span>
      <div style={{ flex: 'none', padding: '30px 26px 0 30px', opacity: asking ? 0.72 : 1 }}>
        <div className="flex items-center" style={{ gap: 14 }}>
          <AvatarStack ids={meetingPeople(m).slice(0, 5)} people={people} cabinets={core.cabinets} size={62} />
          <span className="flex-1" />
          <span className="inline-flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sev ? WAIT_COLOR[sev] : CK.inkSoft }}>
            <Clock size={14} strokeWidth={1.6} aria-hidden />{asking ? `Asked ${agoLabel(m.created_at, now)}` : `Waiting ${waitLabel(m.created_at, now)}`}
          </span>
        </div>
        <h2 style={{ margin: '14px 0 0', fontSize: 28, lineHeight: 1.2, fontWeight: 600, overflowWrap: 'anywhere' }}>
          <b style={{ fontWeight: 800 }}><CharacterName id={m.requested_by_character ?? undefined} name={who} /></b>
          {invited.length > 0 ? <> wants to meet <InvitedNames ids={invited} people={people} link /></> : ' asks for a meeting'}
        </h2>
        <p className="flex items-center flex-wrap" style={{ margin: '10px 0 0', gap: '4px 16px', fontSize: 14, fontWeight: 800, color: MEETING_BLUE }}>
          <span className="inline-flex items-center" style={{ gap: 6 }}><Timer size={16} strokeWidth={1.6} aria-hidden />{lengthLabel(m.duration_minutes)}</span>
          {hasWhen(m) && <span className="inline-flex items-center" style={{ gap: 6 }}><CalendarClock size={16} strokeWidth={1.6} aria-hidden />{whenText(m)}</span>}
          {asking && <span className="inline-flex items-center" style={{ gap: 5, color: CK.goldDeep }}><Hourglass size={14} strokeWidth={1.6} aria-hidden />Asking the others</span>}
        </p>
      </div>
      <div className="rd-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 26px 12px 30px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: CK.card, borderRadius: 16, padding: '12px 15px', boxShadow: `inset 0 0 0 1px ${cabinetWash(MEETING_BLUE, 22)}` }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: MEETING_BLUE }}>Why they want to meet</p>
          {reason
            ? <p style={{ margin: '4px 0 0', fontSize: 17, lineHeight: 1.6, fontWeight: 500, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{reason}</p>
            : <p style={{ margin: '4px 0 0', fontSize: 15.5, lineHeight: 1.5, fontWeight: 600, color: CK.muted }}>No reason given</p>}
        </div>
        {asking && (
          <div>
            <AnswerList m={{ ...(m as MeetingX), character_ids: invited }} responses={responses} people={people} cabinets={core.cabinets} />
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: CK.goldDeep, fontWeight: 700 }}>
              Nothing to decide until they all answer{due ? `. It moves on by itself around ${due}` : ''}.
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center flex-wrap" data-no-open style={{ flex: 'none', gap: '8px 16px', padding: '12px 20px 14px 30px', boxShadow: `0 -1px 0 ${cabinetWash(MEETING_BLUE, 22)}`, borderRadius: '0 0 24px 24px', background: 'transparent' }}>
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
  const invited = invitedOf(m);
  const reason = reasonOf(m);
  const sev = asking ? null : waitSeverity(m.created_at, now);
  // The "Meeting Request" badge on the card's top edge says what it is; the body is the headline, the people, the length and wait, the reason.
  return (
    <>
      <span style={{ display: 'block', flex: 'none', fontSize: 17, fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
        <b style={{ fontWeight: 800 }}>{who}</b>
        {invited.length > 0 ? <> wants to meet <InvitedNames ids={invited} people={people} /></> : ' asks for a meeting'}
      </span>
      <span className="flex items-center" style={{ flex: 'none', gap: 9, marginTop: 11 }}>
        <AvatarStack ids={meetingPeople(m).slice(0, 3)} people={people} cabinets={core.cabinets} size={32} />
      </span>
      <span className="flex items-center flex-wrap" style={{ flex: 'none', gap: '2px 10px', marginTop: 10, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        <span className="inline-flex items-center" style={{ gap: 3, color: MEETING_BLUE }}><Timer size={12} strokeWidth={1.6} aria-hidden />{lengthLabel(m.duration_minutes)}</span>
        <span className="inline-flex items-center" style={{ gap: 3, color: sev ? WAIT_COLOR[sev] : CK.inkSoft }}>
          <Clock size={12} strokeWidth={1.6} aria-hidden />{asking ? `Asked ${agoLabel(m.created_at, now)}` : waitLabel(m.created_at, now)}
        </span>
        {asking && <span className="inline-flex items-center" style={{ gap: 3, color: CK.goldDeep }}><Hourglass size={12} strokeWidth={1.6} aria-hidden />Asking the others</span>}
      </span>
      <span className="rd-fade" style={{ display: 'block', flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 11, fontSize: 14, lineHeight: 1.55, fontWeight: reason ? 500 : 600, color: reason ? CK.inkSoft : CK.muted, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{reason ?? 'No reason given'}</span>
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
