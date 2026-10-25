'use client';
// Gavelling Crisis: the Characters page (Crisis Director). Characters grouped by cabinet, with the
// cabinet's name and colour editable in place, and a side drawer to edit one character: bio, powers,
// picture, status, responsible backroomer, secret goals and staff notes, and the spare-character swap.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CircleQuestionMark, ExternalLink, FileText, ImagePlus, Lock, Plus, RefreshCw, Skull, Trash2, Upload, UserCheck, UserRound, UserRoundPlus, UsersRound } from 'lucide-react';
import GSelect, { type GSelectOption } from '@/components/GSelect';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import {
  crisisError, deleteCharacter, loadSecrets, saveCabinet, saveCharacter, saveMember, saveSecret, syncRoster, uploadCrisisFile,
} from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Cabinet, Character, CharacterSecret, CharacterStatus, Member } from '@/lib/crisis/types';
import { Avatar, Btn, Card, CK, fieldStyle, OverhangCard, Skeleton, cabinetTint } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { ConfirmInline, DirectorOnlyCard, Drawer, Labelled, PageHeading, responsibleMembers } from './setupKit';

const SWATCHES = ['#8E2424', '#C26A2A', '#B6871F', '#3D7A52', '#2F7F86', '#3E6A9A', '#6B4E9A', '#5C5348'];

const STATUS_WORD: Record<CharacterStatus, string> = { active: 'Active', spare: 'Spare', dead: 'Dead', arrested: 'Arrested', missing: 'Missing' };
const STATUS_ORDER: CharacterStatus[] = ['active', 'spare', 'dead', 'arrested', 'missing'];

function StatusIcon({ status, size = 14 }: { status: CharacterStatus; size?: number }) {
  const p = { size, strokeWidth: 1.5, 'aria-hidden': true } as const;
  if (status === 'spare') return <UserRoundPlus {...p} />;
  if (status === 'dead') return <Skull {...p} />;
  if (status === 'arrested') return <Lock {...p} />;
  if (status === 'missing') return <CircleQuestionMark {...p} />;
  return <UserCheck {...p} />;
}
const statusColor = (s: CharacterStatus) => (s === 'active' ? CK.ok : s === 'spare' ? CK.inkSoft : s === 'missing' ? CK.warn : CK.danger);

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

function SwatchPicker({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof MouseEvent && ((e.target as HTMLElement | null)?.closest('[data-swatch-panel]') || btn.current?.contains(e.target as Node))) return;
      setPos(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos]);
  const open = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(8, r.left), window.innerWidth - 200);
    const y = r.bottom + 6 + 100 > window.innerHeight ? r.top - 6 - 92 : r.bottom + 6;
    setPos({ x, y });
  };
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label="Choose the cabinet colour"
        aria-haspopup="true"
        aria-expanded={!!pos}
        onClick={() => (pos ? setPos(null) : open())}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] flex-shrink-0"
        style={{ width: 26, height: 26, borderRadius: '50%', border: 0, padding: 0, cursor: 'pointer', background: value, boxShadow: `0 0 0 3px ${cabinetTint(value, 0.28)}, inset 0 1px 0 rgba(255,255,255,0.3)` }}
      />
      {pos && (
        <Portal>
          <div
            data-swatch-panel
            role="group"
            aria-label="Cabinet colours"
            style={{
              position: 'fixed', left: pos.x, top: pos.y, zIndex: 10060, display: 'grid', gridTemplateColumns: 'repeat(4, 32px)', gap: 8, padding: 12,
              background: CK.card, borderRadius: 16, boxShadow: '0 18px 44px rgba(27,56,40,0.18), 0 0 0 1px rgba(27,56,40,0.08)',
            }}
          >
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`Colour ${hex}`}
                aria-pressed={hex.toLowerCase() === value.toLowerCase()}
                onClick={() => { setPos(null); if (hex.toLowerCase() !== value.toLowerCase()) onPick(hex); }}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 0, cursor: 'pointer', background: hex,
                  boxShadow: hex.toLowerCase() === value.toLowerCase() ? `0 0 0 2px #fff, 0 0 0 4px ${CK.forest}` : 'inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
        </Portal>
      )}
    </>
  );
}

// ─────────── Page ───────────

export default function CharactersPage() {
  const v = useCrisis();
  if (!v.director) return <DirectorOnlyCard title="Characters" />;
  return <CharactersBody />;
}

type Opening = { kind: 'edit'; id: string } | { kind: 'new'; cabinetId: string | null } | null;

function CharactersBody() {
  const { ref, core, reloadCore } = useCrisis();
  const [secrets, setSecrets] = useState<Map<string, CharacterSecret> | null>(null);
  const [opening, setOpening] = useState<Opening>(null);
  const [syncing, setSyncing] = useState(false);
  const seq = useRef(0);

  const readSecrets = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const rows = await loadSecrets(ref);
      if (mine === seq.current) setSecrets(new Map(rows.map((r) => [r.character_id, r])));
    } catch (e) {
      if (mine === seq.current) notifyErr(crisisError(e, 'Could not load the secret goals.'), 'crisis-characters-secrets');
    }
  }, [ref]);
  useEffect(() => { void readSecrets(); }, [readSecrets]);
  useCrisisLive(ref.id, ['crisis_character_secrets'], () => { void readSecrets(); });

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

  const editing = opening?.kind === 'edit' ? core.characters.find((c) => c.id === opening.id) ?? null : null;
  const unassigned = byCabinet.get(null) ?? [];

  return (
    <div style={{ fontFamily: CK.font }}>
      <PageHeading
        eyebrow="WORLD"
        title="Characters"
        right={(
          <Btn tone="ghost" icon={<RefreshCw size={15} strokeWidth={1.5} className={syncing ? 'animate-spin' : undefined} />} onClick={sync} disabled={syncing}>
            Bring in seats and delegates
          </Btn>
        )}
      />
      <p className="flex items-center gap-2" style={{ margin: '-4px 0 14px', fontSize: 13.5, color: CK.inkSoft }}>
        <UserRoundPlus size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
        Spare characters are hidden from delegates. Use one to replace a character who dies or is arrested.
      </p>

      <div className="flex flex-col" style={{ gap: 14 }}>
        {core.cabinets.map((cab) => (
          <CabinetSection
            key={cab.id}
            cab={cab}
            characters={byCabinet.get(cab.id) ?? []}
            members={core.members}
            onOpen={(id) => setOpening({ kind: 'edit', id })}
            onAdd={() => setOpening({ kind: 'new', cabinetId: cab.id })}
          />
        ))}
        {unassigned.length > 0 && (
          <CabinetSection
            cab={null}
            characters={unassigned}
            members={core.members}
            onOpen={(id) => setOpening({ kind: 'edit', id })}
            onAdd={() => setOpening({ kind: 'new', cabinetId: null })}
          />
        )}
        {core.cabinets.length === 0 && <Card><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>No cabinets yet.</p></Card>}
      </div>

      {opening && (editing || opening.kind === 'new') && (
        <CharacterDrawer
          key={editing?.id ?? `new-${opening.kind === 'new' ? opening.cabinetId : ''}`}
          char={editing}
          newCabinetId={opening.kind === 'new' ? opening.cabinetId : null}
          secrets={secrets}
          onClose={() => setOpening(null)}
        />
      )}
    </div>
  );
}

// ─────────── A cabinet and its characters ───────────

function CabinetSection({ cab, characters, members, onOpen, onAdd }: {
  cab: Cabinet | null; characters: Character[]; members: Member[]; onOpen: (id: string) => void; onAdd: () => void;
}) {
  const { ref, reloadCore } = useCrisis();
  const color = cab?.color ?? CK.muted;

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
            <SwatchPicker value={cab.color} onPick={(hex) => save({ color: hex })} />
            <InlineText value={cab.name} label="Cabinet name" placeholder="Cabinet name" bold onCommit={(name) => { if (name) void save({ name }); }} />
            <InlineText value={cab.short_name ?? ''} label="Short name" placeholder="Short name" onCommit={(s) => save({ short_name: nul(s) })} />
          </>
        ) : (
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.ink }}>No Cabinet</h2>
        )}
        <span className="flex-1" />
        <Btn tone="ghost" size="sm" icon={<Plus size={14} strokeWidth={1.5} />} onClick={onAdd}>Add character</Btn>
      </div>
      <div style={{ padding: 14 }}>
        {characters.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No characters yet. Add one, or bring in the seats and delegates.</p>
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
      style={{ background: gone ? CK.well : CK.card, boxShadow: `${CK.shadowSm}, inset 0 3px 0 ${color}`, padding: '40px 14px 14px', textAlign: 'center', filter: gone ? 'grayscale(0.6)' : undefined }}
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

// ─────────── The drawer ───────────

function CharacterDrawer({ char, newCabinetId, secrets, onClose }: {
  char: Character | null; newCabinetId: string | null; secrets: Map<string, CharacterSecret> | null; onClose: () => void;
}) {
  const { ref, core, reloadCore } = useCrisis();
  const isNew = !char;
  const secret = char ? secrets?.get(char.id) : undefined;

  const [d, setD] = useState({
    name: char?.name ?? '', title: char?.title ?? '', bio: char?.bio ?? '', powers: char?.powers ?? '', location: char?.location ?? '',
    picture_url: char?.picture_url ?? '', status: (char?.status ?? 'active') as CharacterStatus, status_note: char?.status_note ?? '',
    cabinet: char?.cabinet_id ?? newCabinetId ?? '', owner: char?.owner_member_id ?? '',
  });
  const [goals, setGoals] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'picture' | 'guide' | null>(null);
  const [guide, setGuide] = useState<{ url: string | null; name: string | null }>({ url: char?.guide_url ?? null, name: char?.guide_name ?? null });
  const picInput = useRef<HTMLInputElement>(null);
  const guideInput = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof typeof d>(k: K, val: (typeof d)[K]) => setD((p) => ({ ...p, [k]: val }));

  const cabinetOptions: GSelectOption[] = [{ value: '', label: 'No cabinet' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))];
  const statusOptions: GSelectOption[] = STATUS_ORDER.map((s) => ({ value: s, label: STATUS_WORD[s], icon: <StatusIcon status={s} /> }));
  const ownerOptions: GSelectOption[] = [
    { value: '', label: 'Not set' },
    ...responsibleMembers(core.members).map((m) => ({ value: m.id, label: m.display_name, hint: m.role === 'backroomer' ? 'Backroomer' : 'Crisis Director' })),
  ];

  const upload = async (kind: 'picture' | 'guide', file: File | undefined) => {
    if (!file || uploading) return;
    setUploading(kind);
    try {
      const r = await uploadCrisisFile(ref, file);
      if (kind === 'picture') set('picture_url', r.url);
      else setGuide({ url: r.url, name: r.name });
      notifyOk(kind === 'picture' ? 'Picture added. Save to keep it' : 'Guide added. Save to keep it', 'crisis-characters');
    } catch (e) { notifyErr(crisisError(e, 'Could not upload the file. Try again.'), 'crisis-characters'); }
    finally { setUploading(null); }
  };

  const save = async () => {
    if (busy) return;
    const name = d.name.trim();
    if (!name) { notifyErr('Give the character a name.', 'crisis-characters'); return; }
    const pic = d.picture_url.trim();
    if (pic && !/^https?:\/\//i.test(pic)) { notifyErr('The picture link must start with https://', 'crisis-characters'); return; }
    setBusy(true);
    try {
      const siblings = core.characters.filter((c) => c.cabinet_id === (d.cabinet || null));
      const row: Partial<Character> = {
        name, title: nul(d.title), bio: nul(d.bio), powers: nul(d.powers), location: nul(d.location), picture_url: nul(pic),
        status: d.status, status_note: nul(d.status_note), cabinet_id: d.cabinet || null, owner_member_id: d.owner || null,
      };
      if (guide.url !== (char?.guide_url ?? null)) { row.guide_url = guide.url; row.guide_name = guide.url ? guide.name : null; }
      if (isNew) row.sort = siblings.reduce((m, c) => Math.max(m, c.sort), 0) + 1;
      const id = await saveCharacter(ref, isNew ? row : { ...row, id: char.id });
      const patch: Partial<Pick<CharacterSecret, 'goals' | 'staff_notes'>> = {};
      if (goals !== null && goals.trim() !== (secret?.goals ?? '').trim()) patch.goals = nul(goals);
      if (notes !== null && notes.trim() !== (secret?.staff_notes ?? '').trim()) patch.staff_notes = nul(notes);
      if (Object.keys(patch).length) await saveSecret(ref, id, patch);
      notifyOk('Saved', 'crisis-characters');
      await reloadCore();
      onClose();
    } catch (e) { notifyErr(crisisError(e, 'Could not save the character.'), 'crisis-characters'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!char || busy) return;
    setBusy(true);
    try {
      await deleteCharacter(ref, char.id);
      notifyOk('Character deleted', 'crisis-characters');
      await reloadCore();
      onClose();
    } catch (e) { notifyErr(crisisError(e, 'Could not delete the character.'), 'crisis-characters'); setBusy(false); }
  };

  const cab = core.cabinets.find((c) => c.id === (d.cabinet || null));

  return (
    <Drawer
      title={isNew ? 'New Character' : char.name}
      sub={cab?.name}
      onClose={onClose}
      footer={(
        <div className="flex items-center justify-between flex-wrap gap-2">
          {!isNew ? (
            <Btn tone="danger" size="sm" icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={() => setConfirmDelete(true)} disabled={busy || confirmDelete}>Delete</Btn>
          ) : <span />}
          <div className="flex gap-2">
            <Btn tone="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
            <Btn onClick={save} disabled={busy || !d.name.trim()}>{isNew ? 'Add character' : 'Save'}</Btn>
          </div>
        </div>
      )}
    >
      <div className="flex flex-col" style={{ gap: 14 }}>
        {confirmDelete && char && (
          <ConfirmInline
            text={`Delete ${char.name}? Their goals and resources go with them. Anyone playing this character is left without one. This cannot be undone.`}
            confirmLabel="Delete character"
            busy={busy}
            onConfirm={remove}
            onCancel={() => setConfirmDelete(false)}
          />
        )}

        <div className="flex items-center gap-3">
          <Avatar name={d.name || '?'} src={d.picture_url.trim() || null} color={cab?.color ?? CK.muted} size={64} style={{ margin: 4, filter: d.status === 'dead' || d.status === 'arrested' ? 'grayscale(1)' : undefined }} />
          <Labelled label="Name" style={{ flex: 1 }}>
            <input value={d.name} onChange={(e) => set('name', e.target.value)} style={fieldStyle} maxLength={120} aria-label="Name" />
          </Labelled>
        </div>

        <Labelled label="Title">
          <input value={d.title} onChange={(e) => set('title', e.target.value)} style={fieldStyle} maxLength={160} aria-label="Title" />
        </Labelled>
        <Labelled label="Bio">
          <textarea value={d.bio} onChange={(e) => set('bio', e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical' }} aria-label="Bio" />
        </Labelled>
        <Labelled label="Powers">
          <textarea value={d.powers} onChange={(e) => set('powers', e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} aria-label="Powers" />
        </Labelled>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Labelled label="Location">
            <input value={d.location} onChange={(e) => set('location', e.target.value)} style={fieldStyle} aria-label="Location" />
          </Labelled>
          <Labelled label="Picture">
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={picInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="Upload a picture"
                onChange={(e) => { void upload('picture', e.target.files?.[0]); e.target.value = ''; }} />
              <Btn tone="ghost" size="sm" icon={<ImagePlus size={14} strokeWidth={1.5} />} onClick={() => picInput.current?.click()} disabled={uploading !== null}>
                {uploading === 'picture' ? 'Uploading' : d.picture_url ? 'Change picture' : 'Upload a picture'}
              </Btn>
              {d.picture_url && <Btn tone="danger" size="sm" icon={<Trash2 size={13} strokeWidth={1.5} />} onClick={() => set('picture_url', '')}>Remove</Btn>}
            </div>
          </Labelled>
        </div>

        <div style={{ background: cabinetTint(CK.gold, 0.22), borderRadius: 16, padding: 12 }} className="flex flex-col gap-2">
          <p className="flex items-center gap-2" style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: CK.ink }}>
            <BookOpen size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.goldDeep }} />Character Guide
          </p>
          <input ref={guideInput} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" aria-label="Upload the character guide"
            onChange={(e) => { void upload('guide', e.target.files?.[0]); e.target.value = ''; }} />
          {guide.url ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13.5, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere', minWidth: 0 }}>
                <FileText size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.goldDeep, flex: 'none' }} />{guide.name || 'Character guide'}
              </span>
              <span className="flex-1" />
              <a href={guide.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ borderRadius: 9, padding: '5px 10px', fontSize: 12, fontWeight: 700, background: CK.card, color: CK.forest, boxShadow: `inset 0 0 0 1px ${CK.hair}`, textDecoration: 'none' }}>
                <ExternalLink size={13} strokeWidth={1.5} aria-hidden />Open
              </a>
              <Btn tone="ghost" size="sm" icon={<Upload size={13} strokeWidth={1.5} />} onClick={() => guideInput.current?.click()} disabled={uploading !== null}>Replace</Btn>
              <Btn tone="danger" size="sm" icon={<Trash2 size={13} strokeWidth={1.5} />} onClick={() => setGuide({ url: null, name: null })}>Remove</Btn>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Btn tone="ghost" size="sm" icon={<Upload size={14} strokeWidth={1.5} />} onClick={() => guideInput.current?.click()} disabled={uploading !== null}>
                {uploading === 'guide' ? 'Uploading' : 'Upload a guide'}
              </Btn>
              <span style={{ fontSize: 12.5, color: CK.inkSoft }}>PDF or Word, up to 20 MB</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Labelled label="Status">
            <GSelect value={d.status} onChange={(s) => set('status', s as CharacterStatus)} options={statusOptions} aria-label="Status" />
          </Labelled>
          <Labelled label="Status note">
            <input value={d.status_note} onChange={(e) => set('status_note', e.target.value)} style={fieldStyle} aria-label="Status note" />
          </Labelled>
          <Labelled label="Cabinet">
            <GSelect value={d.cabinet} onChange={(c) => set('cabinet', c)} options={cabinetOptions} aria-label="Cabinet" />
          </Labelled>
          <Labelled label="Responsible backroomer" hint="Answers this character's directives by default. Any other staff member can still claim them.">
            <GSelect value={d.owner} onChange={(o) => set('owner', o)} options={ownerOptions} aria-label="Responsible backroomer" />
          </Labelled>
        </div>

        <div style={{ background: CK.well, borderRadius: 16, padding: 12 }} className="flex flex-col gap-3">
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: CK.red }}>Staff only. The delegate never sees these</p>
          {secrets === null && !isNew ? (
            <>
              <Skeleton h={70} r={12} />
              <Skeleton h={70} r={12} />
            </>
          ) : (
            <>
              <Labelled label="Secret goals">
                <textarea value={goals ?? secret?.goals ?? ''} onChange={(e) => setGoals(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} aria-label="Secret goals" />
              </Labelled>
              <Labelled label="Staff notes">
                <textarea value={notes ?? secret?.staff_notes ?? ''} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} aria-label="Staff notes" />
              </Labelled>
            </>
          )}
        </div>

        {char && (char.status === 'dead' || char.status === 'arrested') && <SpareSwap char={char} onDone={onClose} />}
      </div>
    </Drawer>
  );
}

// ─────────── Give a delegate a spare character ───────────

function SpareSwap({ char, onDone }: { char: Character; onDone: () => void }) {
  const { ref, core, reloadCore } = useCrisis();
  const delegates = core.members.filter((m) => m.character_id === char.id);
  const spares = core.characters.filter((c) => c.status === 'spare' && c.cabinet_id === char.cabinet_id);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const give = async (m: Member) => {
    const spare = spares.find((s) => s.id === pick[m.id]);
    if (!spare || busy) return;
    setBusy(m.id);
    try {
      await saveMember(ref, m.id, { character_id: spare.id });
      await saveCharacter(ref, { id: spare.id, status: 'active', owner_member_id: spare.owner_member_id ?? char.owner_member_id });
      notifyOk(`${m.display_name} now plays ${spare.name}`, 'crisis-characters');
      await reloadCore();
      onDone();
    } catch (e) { notifyErr(crisisError(e, 'Could not give the spare character.'), 'crisis-characters'); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ background: 'rgba(163,65,47,0.07)', borderRadius: 16, padding: 12, boxShadow: 'inset 0 0 0 1px rgba(163,65,47,0.2)' }} className="flex flex-col gap-3">
      <p className="flex items-center gap-2" style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: CK.ink }}>
        <UserRoundPlus size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />
        Give this delegate a spare character
      </p>
      {delegates.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>Nobody plays {char.name} right now.</p>
      ) : spares.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>This cabinet has no spare characters. Add one and set its status to Spare.</p>
      ) : (
        delegates.map((m) => (
          <div key={m.id} className="flex items-end flex-wrap gap-2">
            <Labelled label={m.display_name} style={{ flex: '1 1 200px' }}>
              <GSelect
                value={pick[m.id] ?? ''}
                onChange={(id) => setPick((p) => ({ ...p, [m.id]: id }))}
                options={spares.map((s) => ({ value: s.id, label: s.name, hint: s.title ?? undefined }))}
                placeholder="Pick a spare character"
                aria-label={`Spare character for ${m.display_name}`}
              />
            </Labelled>
            <Btn size="sm" onClick={() => give(m)} disabled={!pick[m.id] || busy !== null}>Give spare character</Btn>
          </div>
        ))
      )}
    </div>
  );
}
