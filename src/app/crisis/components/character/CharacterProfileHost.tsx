'use client';
// Gavelling Crisis: open any character's whole profile from anywhere (owner, 30 Oct 2026: "clicking on a
// delegate name opens their entire delegate profile where previous directives and stats can be seen").
//
// HOW TO USE
//   <CharacterName id={c.id} />                  the name as a button that looks like the text around it
//   <CharacterName id={c.id} name="Fidel" />     show other words (a short form) for the same character
//   <CharacterName name="Fidel Castro" />        no id: found by exact name among the characters
//   <CharacterLink id={c.id}>anything</CharacterLink>   wrap an avatar, a card or any content
//   const open = useOpenCharacter();  open(id)   from code
//
// POP-UPS NEVER STACK. A pop-up that shows names cannot have the profile open on top of itself. Two ways:
//   1. <InPlaceCharacterScope onOpen={(id) => setProfileId(id)}> around the pop-up's content: every
//      CharacterName inside calls onOpen(id) instead of opening the global profile. The pop-up then renders
//      <CharacterModal characterId={profileId} onClose={() => setProfileId(null)} /> INSTEAD of its own shell
//      (and renders its own shell again on close), so only one pop-up exists at a time.
//   2. A single name can take `onOpenInPlace={(id) => ...}`, which wins over the scope and the global opener.
// Outside any pop-up nothing is needed: the provider (mounted in the crisis layout) opens the profile.
//
// A delegate or press member only gets a link where the Crisis Director lets them see the character (their own
// cabinet, or other cabinets set to names or profiles in Settings); elsewhere the name stays plain text.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { crisisError, loadWorld } from '@/lib/crisis/api';
import { notifyErr } from '@/lib/appNotify';
import type { Character } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CharacterModal from './CharacterModal';

type Opener = (id: string) => void;

const OpenCtx = createContext<Opener | null>(null);
const ScopeCtx = createContext<Opener | null>(null);

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();

/** Wrap a pop-up's content so every CharacterName inside swaps the pop-up's content instead of stacking. */
export function InPlaceCharacterScope({ onOpen, children }: { onOpen: (characterId: string) => void; children: ReactNode }) {
  return <ScopeCtx.Provider value={onOpen}>{children}</ScopeCtx.Provider>;
}

/** Mounted once, inside CrisisProvider (the crisis layout). Renders the profile pop-up. */
export function CharacterProfileProvider({ children }: { children: ReactNode }) {
  const { ref, core } = useCrisis();
  const [openId, setOpenId] = useState<string | null>(null);
  const [fallback, setFallback] = useState<Character | null>(null);
  const world = useRef<Map<string, Character> | null>(null);

  const open = useCallback<Opener>((id) => {
    if (core.characters.some((c) => c.id === id)) { setFallback(null); setOpenId(id); return; }
    // A character this viewer's core list does not carry (another cabinet): read the world list once.
    void (async () => {
      try {
        if (!world.current) {
          const rows = await loadWorld(ref);
          world.current = new Map(rows.map((r) => [r.id, {
            id: r.id, crisis_id: ref.id, cabinet_id: r.cabinet_id, name: r.name, title: r.title, bio: r.bio, picture_url: r.picture_url,
            powers: null, location: null, status: r.status, status_note: null, owner_member_id: null, slot_id: null, sort: 0, guide_url: null, guide_name: null,
          } satisfies Character]));
        }
        const c = world.current.get(id);
        if (!c) return;
        setFallback(c);
        setOpenId(id);
      } catch (e) { notifyErr(crisisError(e, 'Could not open this character.'), 'crisis-character-open'); }
    })();
  }, [core.characters, ref]);

  return (
    <OpenCtx.Provider value={open}>
      <style>{`.crisis-char-link:hover, .crisis-char-link:focus-visible { font-weight: 800; text-decoration: underline; text-decoration-color: ${CK.red}; text-underline-offset: 2px; }`}</style>
      {children}
      {openId && <CharacterModal key={openId} characterId={openId} fallback={fallback ?? undefined} onClose={() => { setOpenId(null); setFallback(null); }} />}
    </OpenCtx.Provider>
  );
}

/** The opener. Outside the provider it does nothing. */
export function useOpenCharacter(): Opener {
  return useContext(OpenCtx) ?? (() => undefined);
}

/** May this viewer open this character's profile? */
export function useCanOpenCharacter(): (c: { id: string; cabinet_id: string | null } | null | undefined) => boolean {
  const { role, cabinetId, characterId, settings } = useCrisis();
  return useCallback((c) => {
    if (!c) return false;
    if (role !== 'delegate' && role !== 'press') return true;
    if (c.id === characterId) return true;
    if (cabinetId && c.cabinet_id === cabinetId) return true;
    return settings.otherCabinets !== 'hidden';
  }, [role, cabinetId, characterId, settings.otherCabinets]);
}

interface TargetProps { id?: string | null; name?: string | null; onOpenInPlace?: (characterId: string) => void }

function useTarget({ id, name, onOpenInPlace }: TargetProps): { id: string | null; label: string | null; go: (() => void) | null } {
  const { core } = useCrisis();
  const global = useContext(OpenCtx);
  const scope = useContext(ScopeCtx);
  const canOpen = useCanOpenCharacter();
  const found = useMemo(() => {
    if (id) return core.characters.find((c) => c.id === id) ?? null;
    if (name) {
      const n = norm(name);
      return core.characters.find((c) => norm(c.name) === n) ?? null;
    }
    return null;
  }, [core.characters, id, name]);
  const cid = id ?? found?.id ?? null;
  // A character the core list does not carry is still openable by id (the provider reads the world list).
  const allowed = found ? canOpen(found) : !!cid && canOpen({ id: cid, cabinet_id: null });
  const opener = onOpenInPlace ?? scope ?? global;
  const go = cid && allowed && opener ? () => opener(cid) : null;
  return { id: cid, label: found?.name ?? null, go };
}

const LINK_STYLE = {
  border: 0, padding: 0, margin: 0, background: 'transparent', font: 'inherit', color: 'inherit', textAlign: 'inherit', cursor: 'pointer',
  overflowWrap: 'anywhere', display: 'inline',
} as const;

/** A character's name as a button styled like the text around it: bold and underlined on hover and focus. */
export function CharacterName({ id, name, children, onOpenInPlace, className, style }: TargetProps & {
  /** Words to show instead of the character's own name. */
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTarget({ id, name, onOpenInPlace });
  const shown = children ?? name ?? t.label ?? 'Unknown';
  if (!t.go) return <span className={className} style={style}>{shown}</span>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); t.go?.(); }}
      title={t.label ? `Open ${t.label}` : 'Open profile'}
      className={`crisis-char-link focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-sm ${className ?? ''}`}
      style={{ ...LINK_STYLE, ...style }}
    >
      {shown}
    </button>
  );
}

/** Wrap an avatar, a card or any content so a click opens the character's profile. */
export function CharacterLink({ id, name, children, onOpenInPlace, label, style, className }: TargetProps & {
  children: ReactNode; label?: string; style?: React.CSSProperties; className?: string;
}) {
  const t = useTarget({ id, name, onOpenInPlace });
  if (!t.go) return <span className={className} style={style}>{children}</span>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); t.go?.(); }}
      aria-label={label ?? (t.label ? `Open ${t.label}` : 'Open profile')}
      title={t.label ? `Open ${t.label}` : undefined}
      className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] ${className ?? ''}`}
      style={{ border: 0, padding: 0, margin: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'inherit', borderRadius: 'inherit', ...style }}
    >
      {children}
    </button>
  );
}
