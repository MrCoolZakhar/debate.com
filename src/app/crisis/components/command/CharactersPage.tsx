'use client';
// Gavelling Crisis: the Characters page. Characters grouped by cabinet (the cabinet's logo, name and colour
// editable in place by the Crisis Director). Everyone who may see a character can open it: a click opens
// the character pop-up (profile, directives, performance). Editing follows the pop-up's rule: directors,
// and backroomers when "Edit characters" is on in Settings.

import { useMemo, useRef, useState } from 'react';
import { BookOpen, Camera, Check, Plus, RefreshCw, Settings, UserRound, UserRoundPlus, UsersRound } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { UserFacingError } from '@/lib/friendlyError';
import { crisisError, saveCabinet, syncRoster, uploadCrisisFile } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import type { Cabinet, Character, Member } from '@/lib/crisis/types';
import { Avatar, Btn, Card, CK, OverhangCard, cabinetTint } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CharacterModal from '../character/CharacterModal';
import NewCharacterDialog from '../character/NewCharacterDialog';
import { STATUS_WORD, StatusIcon, mayEditCharacters, statusColor } from '../character/characterStatus';
import { PageHeading } from './setupKit';

const SWATCHES = [
  { hex: '#8E2424', name: 'Crimson' }, { hex: '#C26A2A', name: 'Orange' }, { hex: '#B6871F', name: 'Gold' }, { hex: '#7A8F2A', name: 'Olive' },
  { hex: '#3D7A52', name: 'Green' }, { hex: '#2F7F86', name: 'Teal' }, { hex: '#3E6A9A', name: 'Blue' }, { hex: '#6B4E9A', name: 'Purple' },
  { hex: '#B8467A', name: 'Rose' }, { hex: '#5C5348', name: 'Stone' },
];

const nul = (s: string): string | null => (s.trim() ? s.trim() : null);

// ─────────── Small inputs ───────────

/** A text field that saves on Enter or when you leave it, and only if it changed. */
function InlineText({ value, onCommit, label, placeholder, bold }: {
  value: string; onCommit: (next: string) => void; label: string; placeholder?: string; bold?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const commit = () => {
    const next = (draft ?? value).trim();
    setDraft(null);
    if (next !== value) onCommit(next);
  };
  return (
    <input
      aria-label={label}
      value={shown}
      placeholder={placeholder}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); } }}
      className="focus:outline-none focus:ring-2 focus:ring-[#1B3828]/40"
      style={{
        border: 0, background: 'transparent', borderRadius: 8, padding: '3px 6px', margin: '0 -6px', fontFamily: CK.font, color: CK.ink,
        fontWeight: bold ? 800 : 600, fontSize: bold ? 17 : 13.5, width: `${Math.max(shown.length, placeholder?.length ?? 4) + 2}ch`, maxWidth: '100%',
        boxShadow: draft === null ? 'none' : `inset 0 0 0 1px ${CK.hair}`,
      }}
    />
  );
}

/** Ten colours that read on the war map and sit well with the crisis red and ivory. The current one is ringed. */
function SwatchPicker({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  return (
    <span role="group" aria-label="Cabinet colour" className="inline-flex flex-wrap items-center" style={{ gap: 6 }}>
      {SWATCHES.map(({ hex, name }) => {
        const on = hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            title={name}
            aria-label={`${name} colour`}
            aria-pressed={on}
            onClick={() => { if (!on) onPick(hex); }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] flex-shrink-0 transition-transform active:scale-[0.92]"
            style={{
              width: 22, height: 22, borderRadius: '50%', border: 0, padding: 0, cursor: on ? 'default' : 'pointer', background: hex,
              boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${CK.forest}` : 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(27,56,40,0.25)',
            }}
          />
        );
      })}
    </span>
  );
}

// ─────────── Page ───────────

export default function CharactersPage() {
  const v = useCrisis();
  const { core, reloadCore, ref } = v;
  const canEdit = mayEditCharacters(v.role, v.settings);
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  // The id of the cabinet a new character is being added to ('' = no cabinet); null = the pop-up is closed.
  const [adding, setAdding] = useState<string | null>(null);

  const byCabinet = useMemo(() => {
    const m = new Map<string | null, Character[]>();
    for (const c of core.characters) {
      const k = c.cabinet_id && core.cabinets.some((x) => x.id === c.cabinet_id) ? c.cabinet_id : null;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [core.characters, core.cabinets]);

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await syncRoster(ref);
      notifyOk(`Added ${r.characters_added} characters and ${r.members_added} delegates`, 'crisis-characters');
      await reloadCore();
    } catch (e) { notifyErr(crisisError(e, 'Could not bring in the seats and delegates.'), 'crisis-characters'); }
    finally { setSyncing(false); }
  };

  const unassigned = byCabinet.get(null) ?? [];

  return (
    <div style={{ fontFamily: CK.font }}>
      <PageHeading
        eyebrow="WORLD"
        title="Characters"
        right={v.director ? (
          <Btn tone="ghost" icon={<RefreshCw size={15} strokeWidth={1.5} className={syncing ? 'animate-spin' : undefined} />} onClick={sync} disabled={syncing}>
            Bring in seats and delegates
          </Btn>
        ) : undefined}
      />
      {v.staff && (
        <p className="flex items-center gap-2" style={{ margin: '-4px 0 14px', fontSize: 13.5, color: CK.inkSoft }}>
          <UserRoundPlus size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
          Spare characters are hidden from delegates. Use one to replace a character who dies or is arrested.
        </p>
      )}

      <div className="flex flex-col" style={{ gap: 14 }}>
        {core.cabinets.map((cab) => (
          <CabinetSection
            key={cab.id}
            cab={cab}
            characters={byCabinet.get(cab.id) ?? []}
            members={core.members}
            canEditCabinet={v.director}
            canAdd={canEdit}
            onOpen={setOpenId}
            onAdd={() => setAdding(cab.id)}
          />
        ))}
        {unassigned.length > 0 && (
          <CabinetSection cab={null} characters={unassigned} members={core.members} canEditCabinet={false} canAdd={canEdit} onOpen={setOpenId} onAdd={() => setAdding('')} />
        )}
        {core.cabinets.length === 0 && <Card><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>No cabinets yet.</p></Card>}
      </div>

      {openId && <CharacterModal key={openId} characterId={openId} onClose={() => setOpenId(null)} />}
      {adding !== null && <NewCharacterDialog cabinetId={adding || null} onClose={() => setAdding(null)} />}
    </div>
  );
}

// ─────────── A cabinet and its characters ───────────

/** The cabinet's logo or seal. The Crisis Director clicks it to upload a new one. */
function CabinetLogo({ cab, editable }: { cab: Cabinet; editable: boolean }) {
  const { ref, reloadCore } = useCrisis();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const change = async (file: File | undefined) => {
    if (!file || busy) return;
    if (!file.type.startsWith('image/')) { notifyErr('Use a JPG, PNG, WebP or GIF image.', 'crisis-characters'); return; }
    setBusy(true);
    try {
      const r = await uploadCrisisFile(ref, file);
      const client = await getCrisisClient(ref.conf, ref.crisis);
      const res = await client.from('crisis_cabinets').update({ logo_url: r.url }).eq('id', cab.id).select('id');
      if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save the logo.'));
      notifyOk('Logo changed', 'crisis-characters');
      await reloadCore();
    } catch (e) { notifyErr(crisisError(e, 'Could not change the logo.'), 'crisis-characters'); }
    finally { setBusy(false); }
  };

  const face = <Avatar name={cab.short_name || cab.name} src={cab.logo_url} size={44} color={cab.color} />;
  if (!editable) return face;
  return (
    <span style={{ position: 'relative', display: 'inline-block', flex: 'none', lineHeight: 0 }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="Choose a new logo"
        onChange={(e) => { void change(e.target.files?.[0]); e.target.value = ''; }} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Change the cabinet logo"
        title="Change the logo"
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: '50%', opacity: busy ? 0.6 : 1 }}
      >
        {face}
        <span aria-hidden style={{ position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', background: CK.card, color: CK.red, boxShadow: CK.shadowSm }}>
          <Camera size={11} strokeWidth={1.6} />
        </span>
      </button>
    </span>
  );
}

function CabinetSection({ cab, characters, members, canEditCabinet, canAdd, onOpen, onAdd }: {
  cab: Cabinet | null; characters: Character[]; members: Member[]; canEditCabinet: boolean; canAdd: boolean; onOpen: (id: string) => void; onAdd: () => void;
}) {
  const { ref, reloadCore } = useCrisis();
  const color = cab?.color ?? CK.muted;
  const [editing, setEditing] = useState(false);

  const save = async (patch: Partial<Pick<Cabinet, 'name' | 'short_name' | 'color'>>) => {
    if (!cab) return;
    try {
      await saveCabinet(ref, cab.id, patch);
      notifyOk('Saved', 'crisis-characters');
      await reloadCore();
    } catch (e) { notifyErr(crisisError(e, 'Could not save the cabinet.'), 'crisis-characters'); }
  };

  return (
    <Card style={{ padding: 0 }}>
      <div
        className="flex items-center flex-wrap"
        style={{ gap: '8px 12px', padding: '12px 16px', background: cabinetTint(color, 0.14), borderBottom: `3px solid ${color}`, borderRadius: '22px 22px 0 0' }}
      >
        {cab ? (
          <>
            <Avatar name={cab.short_name || cab.name} src={cab.logo_url} size={44} color={cab.color} />
            <div className="min-w-0">
              <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.2, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{cab.name}</h2>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>
                {cab.short_name ? `${cab.short_name} · ` : ''}{characters.length} {characters.length === 1 ? 'character' : 'characters'}
              </span>
            </div>
            {canEditCabinet && (
              <button
                type="button"
                onClick={() => setEditing((e) => !e)}
                aria-label={editing ? 'Close the cabinet settings' : 'Cabinet settings'}
                aria-expanded={editing}
                title="Cabinet settings"
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.95] transition-transform"
                style={{ border: 0, cursor: 'pointer', width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: editing ? CK.card : 'transparent', color: CK.forest, boxShadow: editing ? CK.shadowSm : 'none' }}
              >
                <Settings size={18} strokeWidth={1.5} />
              </button>
            )}
          </>
        ) : (
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.ink }}>No Cabinet</h2>
        )}
        <span className="flex-1" />
        {canAdd && <Btn tone="ghost" size="sm" icon={<Plus size={14} strokeWidth={1.5} />} onClick={onAdd}>Add character</Btn>}
      </div>
      {cab && canEditCabinet && editing && (
        <div className="flex items-end flex-wrap" style={{ gap: '12px 22px', padding: '14px 16px', background: CK.well, borderBottom: `1px solid ${CK.hair}` }}>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Crest</p>
            <CabinetLogo cab={cab} editable />
          </div>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Name</p>
            <InlineText value={cab.name} label="Cabinet name" placeholder="Cabinet name" bold onCommit={(name) => { if (name) void save({ name }); }} />
          </div>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Short name</p>
            <InlineText value={cab.short_name ?? ''} label="Short name" placeholder="Short name" onCommit={(sn) => save({ short_name: nul(sn) })} />
          </div>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Colour</p>
            <SwatchPicker value={cab.color} onPick={(hex) => save({ color: hex })} />
          </div>
          <span className="flex-1" />
          <Btn size="sm" icon={<Check size={14} strokeWidth={1.6} />} onClick={() => setEditing(false)}>Done</Btn>
        </div>
      )}
      <div style={{ padding: 14 }}>
        {characters.length === 0 ? (
          <EmptyCast color={color} canAdd={canAdd} onAdd={onAdd} />
        ) : (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', columnGap: 12 }}>
            {characters.map((c) => <CharacterCard key={c.id} c={c} color={color} members={members} onOpen={() => onOpen(c.id)} />)}
          </div>
        )}
      </div>
    </Card>
  );
}

function CharacterCard({ c, color, members, onOpen }: { c: Character; color: string; members: Member[]; onOpen: () => void }) {
  const owner = members.find((m) => m.id === c.owner_member_id);
  const delegates = members.filter((m) => m.character_id === c.id);
  const gone = c.status === 'dead' || c.status === 'arrested';
  return (
    <OverhangCard
      name={c.name}
      src={c.picture_url}
      color={color}
      size={60}
      place="top"
      onClick={onOpen}
      style={{ background: gone ? CK.well : CK.card, boxShadow: `${CK.shadowSm}, inset 0 3px 0 ${color}`, textAlign: 'center', filter: gone ? 'grayscale(0.6)' : undefined }}
    >
      <span style={{ display: 'block', minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{c.name}</b>
        {c.title && <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{c.title}</span>}
      </span>
      <span className="flex items-center justify-center gap-1.5" style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: statusColor(c.status), flexWrap: 'wrap' }}>
        <StatusIcon status={c.status} size={15} />
        {STATUS_WORD[c.status]}
        {c.status_note && <span style={{ fontWeight: 500, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{`· ${c.status_note}`}</span>}
      </span>
      <span className="flex flex-col" style={{ marginTop: 8, gap: 3, fontSize: 12.5, color: CK.inkSoft, lineHeight: 1.45, textAlign: 'left' }}>
        <span className="flex items-start gap-1.5" style={{ overflowWrap: 'anywhere' }}>
          <UserRound size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2, color: CK.red }} />
          <span>Backroomer: {owner ? <b style={{ color: CK.ink }}>{owner.display_name}</b> : <b style={{ color: CK.red }}>Not set</b>}</span>
        </span>
        <span className="flex items-start gap-1.5" style={{ overflowWrap: 'anywhere' }}>
          <UsersRound size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2, color: CK.forest2 }} />
          <span>Delegate: {delegates.length ? <b style={{ color: CK.ink }}>{delegates.map((d) => d.display_name).join(', ')}</b> : <span style={{ color: CK.muted }}>None</span>}</span>
        </span>
        {c.guide_url && (
          <span className="flex items-start gap-1.5" style={{ overflowWrap: 'anywhere' }}>
            <BookOpen size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2, color: CK.goldDeep }} />
            <span>Guide: <b style={{ color: CK.ink }}>{c.guide_name || 'Attached'}</b></span>
          </span>
        )}
      </span>
    </OverhangCard>
  );
}

/** A small illustrated empty state: a ring of empty portraits around a plus. */
function EmptyCast({ color, canAdd, onAdd }: { color: string; canAdd: boolean; onAdd: () => void }) {
  const ghost = (size: number, o: number) => (
    <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', border: `2px dashed ${color}`, background: cabinetTint(color, 0.08), opacity: o, display: 'grid', placeItems: 'center', color, flex: 'none' }}>
      <UserRound size={Math.round(size * 0.5)} strokeWidth={1.4} />
    </span>
  );
  return (
    <div className="flex flex-col items-center" style={{ gap: 10, padding: '14px 8px 6px', textAlign: 'center' }}>
      <div className="flex items-center" style={{ gap: 0 }}>
        <span style={{ marginRight: -14 }}>{ghost(44, 0.55)}</span>
        <span style={{ zIndex: 1 }}>{ghost(64, 1)}</span>
        <span style={{ marginLeft: -14 }}>{ghost(44, 0.55)}</span>
      </div>
      <b style={{ fontSize: 15, color: CK.ink }}>Nobody sits here yet</b>
      <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft, maxWidth: 420 }}>
        {canAdd ? 'Add the first character, or bring in the seats and delegates from the committee room.' : 'The Crisis Director has not added characters here.'}
      </p>
      {canAdd && <Btn icon={<Plus size={15} strokeWidth={1.5} />} onClick={onAdd}>Add the first character</Btn>}
    </div>
  );
}
