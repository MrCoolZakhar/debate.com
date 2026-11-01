'use client';
// Gavelling Crisis: Staff and Access (Crisis Director). Everyone in the crisis by role, how they
// get in (a Gavelling account or a personal code), when they were last seen, and the tools to add
// people, change a role, hand out a code and password, and set the responsible backroomer for a
// whole cabinet at once.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Copy, Gavel, Hourglass, Inbox, KeyRound, Landmark, Newspaper, Pencil, Plus, UserRoundPlus, UsersRound, X } from 'lucide-react';
import GSelect, { type GSelectOption } from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addMember, crisisError, issueCode, removeMember, saveCharacter, saveMember } from '@/lib/crisis/api';
import { ROLE_LABEL, type Cabinet, type Character, type Member } from '@/lib/crisis/types';
import SpareOffer, { AssignSpareDelegate, freeCharacters, isGoneStatus, isSpareDelegate } from '../character/SpareOffer';
import { STATUS_WORD } from '../character/characterStatus';
import { Avatar, Btn, Card, CardTitle, CK, fieldStyle, agoLabel } from '../../crisisKit';
import { useCrisis, usePresencePoll } from '../../[conference]/[crisis]/CrisisContext';
import { ConfirmInline, copyText, DirectorOnlyCard, Labelled, PageHeading, responsibleMembers } from './setupKit';
import { serverNow } from '@/lib/serverClock';

type MemberRole = Member['role'];
const ROLE_OPTIONS: GSelectOption<MemberRole>[] = (['director', 'assistant_director', 'backroomer', 'chair', 'press', 'delegate'] as MemberRole[])
  .map((r) => ({ value: r, label: ROLE_LABEL[r] }));

const GROUPS: Array<{ title: string; roles: MemberRole[]; empty: string }> = [
  { title: 'Directors', roles: ['director', 'assistant_director'], empty: 'No directors yet.' },
  { title: 'Backroomers', roles: ['backroomer'], empty: 'No backroomers yet. They answer the directives.' },
  { title: 'Chairs', roles: ['chair'], empty: 'No chairs yet.' },
  { title: 'Press', roles: ['press'], empty: 'No press yet.' },
  { title: 'Delegates', roles: ['delegate'], empty: 'No delegates with a character yet. Bring them in from Characters, or add them here.' },
];

const GROUP_ICON: Record<string, ReactNode> = {
  Directors: <Landmark size={16} strokeWidth={1.5} />,
  Backroomers: <Inbox size={16} strokeWidth={1.5} />,
  Chairs: <Gavel size={16} strokeWidth={1.5} />,
  Press: <Newspaper size={16} strokeWidth={1.5} />,
  Delegates: <UsersRound size={16} strokeWidth={1.5} />,
};

const CSS = `
.stf-head, .stf-row { display: grid; gap: 6px 14px; align-items: center; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.stf-head { display: none; }
.stf-name, .stf-act { grid-column: 1 / -1; }
.stf-cell::before { content: attr(data-label); display: block; font-size: 11px; font-weight: 700; color: ${CK.muted}; }
.stf-cell { min-width: 0; overflow-wrap: anywhere; font-size: 13.5px; color: ${CK.ink}; }
@media (min-width: 900px) {
  .stf-head, .stf-row { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr) auto; }
  .stf-head.stf-del, .stf-row.stf-del { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.5fr) minmax(0, 1fr) auto; }
  .stf-head { display: grid; padding: 0 0 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: ${CK.muted}; }
  .stf-name, .stf-act { grid-column: auto; }
  .stf-cell::before { display: none; }
}
`;

export default function StaffPage() {
  const v = useCrisis();
  if (!v.director) return <DirectorOnlyCard title="Staff and Access" />;
  return <StaffBody />;
}

interface Issued { code: string; password: string }

function StaffBody() {
  const { core, memberId, reloadCore } = useCrisis();
  usePresencePoll(); // the online dots: a heartbeat no longer pings the live channel
  const [now, setNow] = useState(() => serverNow());
  const [showAdd, setShowAdd] = useState(false);
  const [showAddSpare, setShowAddSpare] = useState(false);
  const [issued, setIssued] = useState<Record<string, Issued>>({});
  useEffect(() => { const t = window.setInterval(() => setNow(serverNow()), 30_000); return () => window.clearInterval(t); }, []);

  const cabinetName = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c.name])), [core.cabinets]);
  const cabinetColor = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c.color])), [core.cabinets]);
  const charPicture = useMemo(() => new Map(core.characters.map((c) => [c.id, c.picture_url])), [core.characters]);
  const charName = useMemo(() => new Map(core.characters.map((c) => [c.id, c.name])), [core.characters]);
  const charById = useMemo(() => new Map(core.characters.map((c) => [c.id, c])), [core.characters]);

  const renderRow = (m: Member, delegates: boolean, spare = false) => (
    <PersonRow
      key={m.id}
      m={m}
      delegates={delegates}
      spare={spare}
      now={now}
      isMe={m.id === memberId}
      cabinetName={m.cabinet_id ? cabinetName.get(m.cabinet_id) ?? '' : ''}
      characterName={m.character_id ? charName.get(m.character_id) ?? '' : ''}
      character={m.character_id ? charById.get(m.character_id) : undefined}
      picture={m.character_id ? charPicture.get(m.character_id) ?? null : null}
      color={m.cabinet_id ? cabinetColor.get(m.cabinet_id) : undefined}
      issued={issued[m.id]}
      onIssued={(i) => setIssued((p) => ({ ...p, [m.id]: i }))}
      onClearIssued={() => setIssued((p) => { const n = { ...p }; delete n[m.id]; return n; })}
    />
  );
  const spareDelegates = core.members.filter(isSpareDelegate);

  return (
    <div style={{ fontFamily: CK.font }}>
      <style>{CSS}</style>
      <PageHeading
        eyebrow="SET UP"
        title="Staff and Access"
        right={<Btn icon={<UserRoundPlus size={15} strokeWidth={1.5} />} onClick={() => setShowAdd((s) => !s)}>{showAdd ? 'Close' : 'Add person'}</Btn>}
      />

      {showAdd && <AddPersonCard onDone={() => { setShowAdd(false); }} onAdded={reloadCore} />}

      <div className="flex flex-col" style={{ gap: 14 }}>
        {GROUPS.map((g) => {
          const delegates = g.roles[0] === 'delegate';
          // A delegate with no character is a spare delegate: they have their own group below.
          const people = core.members.filter((m) => g.roles.includes(m.role) && !(delegates && isSpareDelegate(m)));
          return (
            <Card key={g.title}>
              <CardTitle icon={GROUP_ICON[g.title] ?? <UsersRound size={16} strokeWidth={1.5} />} right={<b style={{ fontSize: 13, color: CK.inkSoft }}>{people.length}</b>}>{g.title}</CardTitle>
              {delegates && people.length > 0 && <AssignBackroomers cabinets={core.cabinets} characters={core.characters} members={core.members} />}
              {people.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>{g.empty}</p>
              ) : (
                <div>
                  <div className={`stf-head${delegates ? ' stf-del' : ''}`} aria-hidden>
                    <span>NAME</span><span>CABINET</span>{delegates && <span>CHARACTER</span>}<span>GETS IN WITH</span><span>LAST SEEN</span><span />
                  </div>
                  {people.map((m) => renderRow(m, delegates))}
                </div>
              )}
            </Card>
          );
        })}

        <Card>
          <CardTitle
            icon={<Hourglass size={16} strokeWidth={1.5} />}
            sub="Delegates with no character yet. They can sign in and wait; give them a character when one is free."
            right={
              <span className="flex items-center gap-3">
                <span className="inline-flex items-baseline gap-1.5"><b style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{spareDelegates.length}</b><span style={{ fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>waiting</span></span>
                <Btn size="sm" icon={<UserRoundPlus size={14} strokeWidth={1.5} />} onClick={() => setShowAddSpare((x) => !x)}>{showAddSpare ? 'Close' : 'Add a spare delegate'}</Btn>
              </span>
            }
          >
            Spare Delegates
          </CardTitle>
          {showAddSpare && <AddSpareDelegate onDone={() => setShowAddSpare(false)} onAdded={reloadCore} />}
          {spareDelegates.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No spare delegates. Add a few so a character can be filled in a moment.</p>
          ) : (
            <div>
              <div className="stf-head stf-del" aria-hidden>
                <span>NAME</span><span>CABINET</span><span>CHARACTER</span><span>GETS IN WITH</span><span>LAST SEEN</span><span />
              </div>
              {spareDelegates.map((m) => renderRow(m, true, true))}
            </div>
          )}
        </Card>

        {spareDelegates.length > 0 && <CharactersNobodyPlays />}
      </div>
    </div>
  );
}

/** Characters with nobody playing them: each can be given to a spare delegate in place. Folded until opened (there can be many). */
function CharactersNobodyPlays() {
  const { core } = useCrisis();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const free = useMemo(() => freeCharacters(core.characters, core.members), [core.characters, core.members]);
  if (free.length === 0) return null;
  return (
    <Card>
      <CardTitle
        icon={<UsersRound size={16} strokeWidth={1.5} />}
        sub="Spare delegates can take a character that nobody plays."
        right={
          <Btn tone="ghost" size="sm" icon={<ChevronDown size={14} strokeWidth={1.5} style={{ transform: open ? 'rotate(180deg)' : undefined }} />} onClick={() => setOpen((x) => !x)} aria-expanded={open}>
            {open ? 'Hide' : 'Show'}
          </Btn>
        }
      >
        <span className="inline-flex items-baseline gap-2">Characters Nobody Plays <b style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>{free.length}</b></span>
      </CardTitle>
      {open && (
        <div>
          {free.map((c) => {
            const cab = core.cabinets.find((x) => x.id === c.cabinet_id);
            return (
              <div key={c.id} style={{ borderTop: `1px solid ${CK.hair}`, padding: '10px 0' }}>
                <div className="flex items-center flex-wrap" style={{ gap: 12 }}>
                  <Avatar name={c.name} src={c.picture_url} size={38} color={cab?.color ?? CK.red} />
                  <span style={{ minWidth: 0, flex: '1 1 180px' }}>
                    <b style={{ display: 'block', fontSize: 14.5, fontWeight: 800, overflowWrap: 'anywhere' }}>{c.name}</b>
                    <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{c.status === 'spare' ? 'Spare' : 'Active'}{cab ? ` · ${cab.name}` : ''}</span>
                  </span>
                  <Btn tone="ghost" size="sm" icon={<UserRoundPlus size={13} strokeWidth={1.5} />} onClick={() => setOpenId((x) => (x === c.id ? null : c.id))} aria-expanded={openId === c.id}>
                    {openId === c.id ? 'Close' : 'Assign a spare delegate'}
                  </Btn>
                </div>
                {openId === c.id && (
                  <div style={{ marginTop: 10 }}>
                    <AssignSpareDelegate character={c} onDone={() => setOpenId(null)} onBack={() => setOpenId(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** The cabinet taken from the chosen character: shown, not editable. Clear the character to choose a cabinet by hand. */
function CabinetFromCharacter({ cabinet }: { cabinet: Cabinet | undefined }) {
  return (
    <Labelled label="Cabinet" hint="Taken from the character. Clear the character to pick a cabinet by hand.">
      <div className="flex items-center" style={{ ...fieldStyle, gap: 8, background: CK.well, cursor: 'default' }} aria-label="Cabinet, from the character">
        <i aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: cabinet?.color ?? CK.muted, display: 'inline-block', flex: 'none' }} />
        <span style={{ overflowWrap: 'anywhere', fontWeight: 600 }}>{cabinet?.name ?? 'Not set'}</span>
      </div>
    </Labelled>
  );
}

// ─────────── Add a person ───────────

function AddPersonCard({ onDone, onAdded }: { onDone: () => void; onAdded: () => Promise<void> }) {
  const { ref, core } = useCrisis();
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('backroomer');
  const [email, setEmail] = useState('');
  const [cabinet, setCabinet] = useState(core.cabinets.length === 1 ? core.cabinets[0].id : '');
  const [character, setCharacter] = useState('');
  const [busy, setBusy] = useState(false);

  const needsCabinet = role !== 'director' && role !== 'assistant_director';
  // A delegate's cabinet follows their character (the database keeps them equal): with a character picked it is read only.
  const pickedChar = role === 'delegate' && character ? core.characters.find((c) => c.id === character) : undefined;
  const effectiveCabinet = pickedChar ? pickedChar.cabinet_id ?? '' : cabinet;
  const charOptions: GSelectOption[] = [
    { value: '', label: 'No character yet' },
    ...core.characters
      .filter((c) => c.status !== 'spare' && (!cabinet || c.cabinet_id === cabinet))
      .map((c) => {
        const taken = core.members.find((m) => m.character_id === c.id);
        return { value: c.id, label: c.name, hint: taken ? `Played by ${taken.display_name}` : undefined };
      }),
  ];

  const submit = async () => {
    const n = name.trim();
    if (!n || busy) return;
    if (role === 'delegate' && core.cabinets.length > 0 && !effectiveCabinet) { notifyErr('Pick a cabinet for the delegate.', 'crisis-staff'); return; }
    setBusy(true);
    try {
      await addMember(ref, {
        role, name: n, email: email.trim() || null,
        cabinetId: needsCabinet && effectiveCabinet ? effectiveCabinet : null,
        characterId: role === 'delegate' && character ? character : null,
      });
      notifyOk(`Added ${n}`, 'crisis-staff');
      await onAdded();
      onDone();
    } catch (e) { notifyErr(crisisError(e, 'Could not add this person.'), 'crisis-staff'); }
    finally { setBusy(false); }
  };

  return (
    <Card warm style={{ marginBottom: 14 }}>
      <CardTitle icon={<UserRoundPlus size={16} strokeWidth={1.5} />}>Add Person</CardTitle>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <Labelled label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} maxLength={120} aria-label="Name" autoFocus />
        </Labelled>
        <Labelled label="Role">
          <GSelect value={role} onChange={(r) => { setRole(r as MemberRole); if (r !== 'delegate') setCharacter(''); }} options={ROLE_OPTIONS} aria-label="Role" />
        </Labelled>
        <Labelled label="Email (optional)" hint="An email that matches a Gavelling account links that account. Without one, make a personal code afterwards.">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={fieldStyle} aria-label="Email" />
        </Labelled>
        {needsCabinet && core.cabinets.length > 0 && (pickedChar ? (
          <CabinetFromCharacter cabinet={core.cabinets.find((c) => c.id === effectiveCabinet)} />
        ) : (
          <Labelled label="Cabinet">
            <GSelect
              value={cabinet}
              onChange={(c) => { setCabinet(c); setCharacter(''); }}
              options={[...(role === 'delegate' ? [] : [{ value: '', label: 'No cabinet' }]), ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))]}
              placeholder="Pick a cabinet"
              aria-label="Cabinet"
            />
          </Labelled>
        ))}
        {role === 'delegate' && (
          <Labelled label="Character">
            <GSelect value={character} onChange={setCharacter} options={charOptions} aria-label="Character" />
          </Labelled>
        )}
        <div className="flex items-end gap-2" style={{ gridColumn: '1 / -1' }}>
          <Btn type="submit" disabled={!name.trim() || busy || (role === 'delegate' && core.cabinets.length > 0 && !effectiveCabinet)} icon={<Plus size={15} strokeWidth={1.5} />}>Add person</Btn>
          <Btn type="button" tone="ghost" onClick={onDone} disabled={busy}>Cancel</Btn>
        </div>
      </form>
    </Card>
  );
}

// ─────────── Add a spare delegate ───────────

/** A delegate with no character: name, an optional email, a cabinet. They can sign in and wait. */
function AddSpareDelegate({ onDone, onAdded }: { onDone: () => void; onAdded: () => Promise<void> }) {
  const { ref, core } = useCrisis();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cabinet, setCabinet] = useState(core.cabinets.length === 1 ? core.cabinets[0].id : '');
  const [busy, setBusy] = useState(false);
  const needCabinet = core.cabinets.length > 0 && !cabinet;

  const submit = async () => {
    const n = name.trim();
    if (!n || busy || needCabinet) return;
    setBusy(true);
    try {
      await addMember(ref, { role: 'delegate', name: n, email: email.trim() || null, cabinetId: cabinet || null, characterId: null });
      notifyOk(`Added ${n} as a spare delegate`, 'crisis-staff');
      await onAdded();
      onDone();
    } catch (e) { notifyErr(crisisError(e, 'Could not add this spare delegate.'), 'crisis-staff'); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', background: CK.well, borderRadius: 16, padding: 12, marginBottom: 12 }}>
      <Labelled label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} maxLength={120} aria-label="Name" autoFocus />
      </Labelled>
      <Labelled label="Email (optional)" hint="An email that matches a Gavelling account links that account. Without one, make a personal code afterwards.">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={fieldStyle} aria-label="Email" />
      </Labelled>
      {core.cabinets.length > 0 && (
        <Labelled label="Cabinet" hint="Changes to the character's cabinet once they have one.">
          <GSelect value={cabinet} onChange={setCabinet} options={core.cabinets.map((c) => ({ value: c.id, label: c.name }))} placeholder="Pick a cabinet" aria-label="Cabinet" />
        </Labelled>
      )}
      <div className="flex items-end gap-2" style={{ gridColumn: '1 / -1' }}>
        <Btn type="submit" disabled={!name.trim() || busy || needCabinet} icon={<Plus size={15} strokeWidth={1.5} />}>Add spare delegate</Btn>
        <Btn type="button" tone="ghost" onClick={onDone} disabled={busy}>Cancel</Btn>
      </div>
    </form>
  );
}

// ─────────── Assign backroomers by cabinet ───────────

function AssignBackroomers({ cabinets, characters, members }: { cabinets: Cabinet[]; characters: Character[]; members: Member[] }) {
  const { ref, reloadCore } = useCrisis();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const options: GSelectOption[] = responsibleMembers(members).map((m) => ({ value: m.id, label: m.display_name, hint: m.role === 'backroomer' ? 'Backroomer' : 'Crisis Director' }));

  const assign = async (cab: Cabinet) => {
    const owner = members.find((m) => m.id === pick[cab.id]);
    const list = characters.filter((c) => c.cabinet_id === cab.id);
    if (!owner || busy || list.length === 0) return;
    setBusy(cab.id);
    try {
      for (let i = 0; i < list.length; i += 8) {
        await Promise.all(list.slice(i, i + 8).map((c) => saveCharacter(ref, { id: c.id, owner_member_id: owner.id })));
      }
      notifyOk(`${owner.display_name} now answers for ${list.length} ${list.length === 1 ? 'character' : 'characters'}`, 'crisis-staff');
      await reloadCore();
    } catch (e) { notifyErr(crisisError(e, 'Could not assign the backroomer.'), 'crisis-staff'); }
    finally { setBusy(null); }
  };

  if (options.length === 0 || cabinets.length === 0) return null;
  return (
    <div style={{ background: CK.well, borderRadius: 16, padding: 12, marginBottom: 12 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 700, color: CK.ink }}>Assign backroomers</p>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {cabinets.map((cab) => {
          const count = characters.filter((c) => c.cabinet_id === cab.id).length;
          return (
            <div key={cab.id} className="flex items-end flex-wrap gap-2">
              <Labelled label={cab.name} style={{ flex: '1 1 160px' }}>
                <GSelect value={pick[cab.id] ?? ''} onChange={(id) => setPick((p) => ({ ...p, [cab.id]: id }))} options={options} placeholder="Pick a backroomer" aria-label={`Backroomer for ${cab.name}`} />
              </Labelled>
              <Btn size="sm" onClick={() => assign(cab)} disabled={!pick[cab.id] || busy !== null || count === 0}>
                {count === 0 ? 'No characters' : `Assign to ${count}`}
              </Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────── One person ───────────

function accessText(m: Member): ReactNode {
  const account = !!m.user_id;
  if (account && m.access_code) return <>Gavelling account and personal code <b style={{ letterSpacing: '0.06em' }}>{m.access_code}</b></>;
  if (account) return 'Gavelling account';
  if (m.access_code) return <>Personal code <b style={{ letterSpacing: '0.06em' }}>{m.access_code}</b></>;
  return <span style={{ color: CK.red, fontWeight: 700 }}>No way in yet</span>;
}

function PersonRow({ m, delegates, spare = false, now, isMe, cabinetName, characterName, character, picture, color, issued, onIssued, onClearIssued }: {
  m: Member; delegates: boolean; spare?: boolean; now: number; isMe: boolean; cabinetName: string; characterName: string; character?: Character; picture: string | null; color?: string;
  issued?: Issued; onIssued: (i: Issued) => void; onClearIssued: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [spareOpen, setSpareOpen] = useState(false);
  // A delegate whose character died, was arrested or is missing can be given a spare, asked in place under the row.
  const needsSpare = delegates && !!character && isGoneStatus(character.status);
  const online = !!m.last_seen_at && now - new Date(m.last_seen_at).getTime() < 3 * 60_000;
  const seen = online ? null : m.last_seen_at ? agoLabel(m.last_seen_at, now) : 'Never';
  const expanded = open || !!issued;

  return (
    <div style={{ borderTop: `1px solid ${CK.hair}`, padding: '10px 0' }}>
      <div className={`stf-row${delegates ? ' stf-del' : ''}`}>
        <div className="stf-cell stf-name flex items-center" data-label="" style={{ gap: 12 }}>
          <Avatar name={m.display_name} src={delegates ? picture : null} size={38} color={color ?? CK.forest2} />
          <span style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14.5, fontWeight: 800 }}>{m.display_name}</b>
            {m.role === 'assistant_director' && <span style={{ color: CK.inkSoft, fontSize: 12.5 }}> · Assistant</span>}
            {isMe && <span style={{ color: CK.inkSoft, fontSize: 12.5 }}> · You</span>}
            {m.email && <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft }}>{m.email}</span>}
          </span>
        </div>
        <div className="stf-cell" data-label="Cabinet">{cabinetName || <span style={{ color: CK.muted }}>None</span>}</div>
        {delegates && (
          <div className="stf-cell" data-label="Character">
            {characterName || <span style={{ color: CK.muted }}>{spare ? 'Waiting for one' : 'None'}</span>}
            {needsSpare && character && <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CK.danger }}>{STATUS_WORD[character.status]}</span>}
          </div>
        )}
        <div className="stf-cell" data-label="Gets in with">{accessText(m)}</div>
        <div className="stf-cell" data-label="Last seen">
          {online ? (
            <span className="inline-flex items-center gap-1.5" style={{ fontWeight: 700, color: CK.ok }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: CK.ok }} />
              Online
            </span>
          ) : <span style={{ color: CK.inkSoft }}>{seen}</span>}
        </div>
        <div className="stf-act flex flex-wrap gap-2">
          {needsSpare && <Btn tone="ghost" size="sm" icon={<UserRoundPlus size={13} strokeWidth={1.5} />} onClick={() => setSpareOpen((x) => !x)} aria-expanded={spareOpen}>{spareOpen ? 'Close' : 'Give a spare'}</Btn>}
          {spare && <Btn size="sm" icon={<UserRoundPlus size={13} strokeWidth={1.5} />} onClick={() => setSpareOpen((x) => !x)} aria-expanded={spareOpen}>{spareOpen ? 'Close' : 'Give a character'}</Btn>}
          <Btn tone="ghost" size="sm" icon={<Pencil size={13} strokeWidth={1.5} />} onClick={() => { if (expanded) { setOpen(false); onClearIssued(); } else setOpen(true); }} aria-expanded={expanded}>{expanded ? 'Close' : 'Manage'}</Btn>
        </div>
      </div>
      {spareOpen && needsSpare && character && (
        <div style={{ marginTop: 10 }}>
          <SpareOffer delegate={m} char={character} onDone={() => setSpareOpen(false)} onNotNow={() => setSpareOpen(false)} />
        </div>
      )}
      {spareOpen && spare && (
        <div style={{ marginTop: 10 }}>
          <SpareOffer delegate={m} onDone={() => setSpareOpen(false)} onNotNow={() => setSpareOpen(false)} />
        </div>
      )}
      {expanded && <PersonPanel m={m} isMe={isMe} issued={issued} onIssued={onIssued} onClearIssued={onClearIssued} onClose={() => { setOpen(false); onClearIssued(); }} />}
    </div>
  );
}

function PersonPanel({ m, isMe, issued, onIssued, onClearIssued, onClose }: {
  m: Member; isMe: boolean; issued?: Issued; onIssued: (i: Issued) => void; onClearIssued: () => void; onClose: () => void;
}) {
  const { ref, core, reloadCore } = useCrisis();
  const [name, setName] = useState(m.display_name);
  const [role, setRole] = useState<MemberRole>(m.role);
  const [cabinet, setCabinet] = useState(m.cabinet_id ?? '');
  const [character, setCharacter] = useState(m.character_id ?? '');
  const [busy, setBusy] = useState<'save' | 'code' | 'remove' | null>(null);
  const [ask, setAsk] = useState<'remove' | 'reissue' | null>(null);
  const credEl = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const needsCabinet = role !== 'director' && role !== 'assistant_director';
  const pickedChar = role === 'delegate' && character ? core.characters.find((c) => c.id === character) : undefined;
  const effectiveCabinet = pickedChar ? pickedChar.cabinet_id ?? '' : cabinet;
  const charOptions: GSelectOption[] = [
    { value: '', label: 'No character yet' },
    ...core.characters
      .filter((c) => c.status !== 'spare' && (!cabinet || c.cabinet_id === cabinet))
      .map((c) => {
        const taken = core.members.find((x) => x.character_id === c.id && x.id !== m.id);
        return { value: c.id, label: c.name, hint: taken ? `Played by ${taken.display_name}` : undefined };
      }),
  ];

  const dirty = name.trim() !== m.display_name || role !== m.role || effectiveCabinet !== (m.cabinet_id ?? '') || character !== (m.character_id ?? '');

  const save = async () => {
    if (busy || !name.trim() || !dirty) return;
    setBusy('save');
    try {
      await saveMember(ref, m.id, {
        display_name: name.trim(), role, cabinet_id: needsCabinet ? effectiveCabinet || null : null, character_id: role === 'delegate' ? character || null : null,
      });
      notifyOk('Saved', 'crisis-staff');
      await reloadCore();
    } catch (e) { notifyErr(crisisError(e, 'Could not save this person.'), 'crisis-staff'); }
    finally { setBusy(null); }
  };

  const makeCode = async () => {
    if (busy) return;
    setAsk(null);
    setBusy('code');
    try {
      const r = await issueCode(ref, m.id);
      onIssued(r);
      notifyOk(m.access_code ? 'New password made' : 'Personal code made', 'crisis-staff');
      await reloadCore();
    } catch (e) { notifyErr(crisisError(e, 'Could not make a code for this person.'), 'crisis-staff'); }
    finally { setBusy(null); }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('remove');
    try {
      await removeMember(ref, m.id);
      notifyOk(`Removed ${m.display_name}`, 'crisis-staff');
      await reloadCore();
    } catch (e) { notifyErr(crisisError(e, 'Could not remove this person.'), 'crisis-staff'); setBusy(null); }
  };

  const copyBoth = async () => {
    if (!issued) return;
    const ok = await copyText(`Code: ${issued.code}\nPassword: ${issued.password}`, credEl.current);
    if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 2500); notifyOk('Copied', 'crisis-staff'); }
    else notifyErr('Could not copy. The text is selected, press Cmd or Ctrl C.', 'crisis-staff');
  };

  return (
    <div className="flex flex-col" style={{ gap: 12, marginTop: 10, padding: 12, background: CK.well, borderRadius: 16 }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Labelled label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} maxLength={120} aria-label="Name" />
        </Labelled>
        <Labelled label="Role">
          <GSelect value={role} onChange={(r) => { setRole(r as MemberRole); if (r !== 'delegate') setCharacter(''); }} options={ROLE_OPTIONS} aria-label="Role" disabled={isMe} />
        </Labelled>
        {needsCabinet && core.cabinets.length > 0 && (pickedChar ? (
          <CabinetFromCharacter cabinet={core.cabinets.find((c) => c.id === effectiveCabinet)} />
        ) : (
          <Labelled label="Cabinet">
            <GSelect
              value={cabinet}
              onChange={(c) => { setCabinet(c); setCharacter(''); }}
              options={[...(role === 'delegate' ? [] : [{ value: '', label: 'No cabinet' }]), ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))]}
              placeholder="Pick a cabinet"
              aria-label="Cabinet"
            />
          </Labelled>
        ))}
        {role === 'delegate' && (
          <Labelled label="Character">
            <GSelect value={character} onChange={setCharacter} options={charOptions} aria-label="Character" />
          </Labelled>
        )}
      </div>

      {issued && (
        <div style={{ background: CK.card, borderRadius: 14, padding: 12, boxShadow: `inset 0 0 0 1px ${CK.hair}` }}>
          <div className="flex items-center flex-wrap gap-x-8 gap-y-2">
            <div ref={credEl} className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: CK.muted }}>Code</p>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{issued.code}</span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: CK.muted }}>Password</p>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{issued.password}</span>
            </div>
            </div>
            <Btn tone="ghost" size="sm" icon={copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />} onClick={copyBoth}>{copied ? 'Copied' : 'Copy both'}</Btn>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700, color: CK.red }}>Write this down now. The password will not be shown again.</p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: CK.inkSoft }}>They can also enter with their committee&apos;s room code and this password, at gavelling.com/crisis or through /join.</p>
        </div>
      )}

      {ask === 'reissue' && (
        <ConfirmInline
          text={`Make a new password for ${m.display_name}? The old password stops working and they are signed out.`}
          confirmLabel="Make a new password"
          keepLabel="Keep the old one"
          onConfirm={makeCode}
          onCancel={() => setAsk(null)}
        />
      )}
      {ask === 'remove' && (
        <ConfirmInline
          text={`Remove ${m.display_name} from this crisis? Their directives stay, but they can no longer get in.`}
          confirmLabel="Remove"
          busy={busy === 'remove'}
          onConfirm={remove}
          onCancel={() => setAsk(null)}
        />
      )}

      <div className="flex items-center flex-wrap gap-2">
        <Btn size="sm" onClick={save} disabled={!dirty || !name.trim() || busy !== null}>Save</Btn>
        <Btn
          tone="ghost"
          size="sm"
          icon={<KeyRound size={14} strokeWidth={1.5} />}
          onClick={() => (m.access_code && !issued ? setAsk('reissue') : void makeCode())}
          disabled={busy !== null}
        >
          {m.access_code ? 'Make a new password' : 'Make a personal code'}
        </Btn>
        {!isMe && <Btn tone="danger" size="sm" icon={<X size={14} strokeWidth={1.5} />} onClick={() => setAsk('remove')} disabled={busy !== null}>Remove</Btn>}
        <span className="flex-1" />
        <Btn tone="ghost" size="sm" onClick={() => { onClearIssued(); onClose(); }}>Done</Btn>
      </div>
    </div>
  );
}
