'use client';
// Gavelling Crisis: the facts of an opened directive, in the white band beside the character at the top of the
// pop-up (their own grid, then who is responsible in a column of its own on the same row), as a tidy grid of small labelled cells: how long it has waited (or when it was answered), when the author
// last heard back, the length in words, who it is for, the themes, the secret goals (staff only), and who is
// responsible for THIS directive with a picture and a compact picker to hand just this directive to another backroomer (a character's
// own backroomer is changed on the character's page only; a cabinet directive never shows the character's backroomer). While someone is writing the
// reply it says so, and handing the directive to somebody else then asks first, in place.
// Handing over is the one thing here that writes at once (it is who the directive is with, not part of the reply);
// the reply itself, with its outcome and every change, goes out only on Send reply.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Clock, FileText, Lock, Pencil, UserRound, VenetianMask } from 'lucide-react';
import GSelect from '@/components/GSelect';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, loadSecrets } from '@/lib/crisis/api';
import { ROLE_LABEL, type Directive } from '@/lib/crisis/types';
import { Avatar, Btn, CK, ThemeTag, agoLabel, cabinetTint, waitLabel, waitSeverity } from '../../crisisKit';
import { CharacterLink, CharacterName } from '../character/CharacterProfileHost';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { StaffPic, ThemeIcons } from './directiveParts';
import { authorName, isBeingWritten, memberName, type Names } from './directiveKit';
import { useNow } from './useNow';

const SEV_COLOR = { ok: CK.ink, late: CK.goldDeep, very: CK.danger } as const;

/** One cell of the grid: a small label over its value. */
function Fact({ icon, label, children, span, big }: { icon: ReactNode; label: string; children: ReactNode; span?: number; /** The compact row of a cabinet directive: 12.5px labels, 14px values. */ big?: boolean }) {
  return (
    <div style={{ minWidth: 0, gridColumn: span ? `span ${span}` : undefined }}>
      <p className="flex items-center" style={{ margin: 0, gap: 5, fontSize: big ? 12.5 : 11.5, fontWeight: 700, color: CK.muted }}>
        <span aria-hidden style={{ lineHeight: 0, color: CK.red, flex: 'none' }}>{icon}</span>{label}
      </p>
      <div style={{ marginTop: 2, fontSize: big ? 14 : 13, fontWeight: 800, color: CK.ink, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

export default function DirectiveFacts({ d, names, editing, onChanged, compact = false }: {
  d: Directive;
  names: Names;
  /** An answered directive being answered again counts as open for handing over. */
  editing: boolean;
  onChanged?: (what: 'claimed' | 'assigned' | 'answered') => void;
  /** A cabinet directive (owner, 1 Nov 2026): no tall band; the facts are items of ONE tight row, led by "From" (the author is only a fact). */
  compact?: boolean;
}) {
  const { ref, core, memberId } = useCrisis();
  const character = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const ownerId = character?.owner_member_id ?? null;

  const now = useNow();
  const [handing, setHanding] = useState(false);
  /** A hand-over waiting for "Move it anyway?" because somebody is writing the reply. */
  const [confirmTo, setConfirmTo] = useState<string | null>(null);

  const open = d.status === 'queued' || d.status === 'claimed' || d.status === 'clarify' || editing;

  const answered = d.status === 'answered';
  const waitLabelText = answered ? 'Answered' : d.status === 'clarify' ? 'Status' : 'Waiting since';
  const waitValue = answered ? agoLabel(d.answered_at, now) : d.status === 'clarify' ? 'Waiting for the delegate' : waitLabel(d.waiting_since, now);
  const sev = d.status === 'queued' || d.status === 'claimed' ? waitSeverity(d.waiting_since, now) : 'ok';
  const covertShown = d.covert && !d.themes.some((t) => t.toLowerCase() === 'covert');

  const staffOptions = useMemo(
    () => core.members
      .filter((m) => m.role === 'director' || m.role === 'assistant_director' || m.role === 'backroomer')
      .map((m) => ({ value: m.id, label: m.id === memberId ? `${m.display_name} (you)` : m.display_name, hint: ROLE_LABEL[m.role], icon: <StaffPic member={m} size={24} /> })),
    [core.members, memberId],
  );

  // Somebody else is writing the reply right now.
  const writer = isBeingWritten(d, now) && d.drafting_member && d.drafting_member !== memberId ? d.drafting_member : null;

  const doHand = async (to: string) => {
    if (!to || handing) return;
    setHanding(true);
    setConfirmTo(null);
    try {
      if (to === memberId) { await assignDirective(ref, d.id); notifyOk('Directive is yours', 'crisis-directive'); onChanged?.('claimed'); }
      else { await assignDirective(ref, d.id, to); notifyOk(`Handed to ${memberName(to, names)}`, 'crisis-directive'); onChanged?.('assigned'); }
    } catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setHanding(false); }
  };
  const hand = (to: string) => {
    if (!to || to === d.assigned_member_id) return;
    if (writer && to !== writer) { setConfirmTo(to); return; }
    void doHand(to);
  };

  const responsibleBody = confirmTo ? (
    <div className="flex flex-col" role="alertdialog" aria-label="Move it anyway?" style={{ gap: 6 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: CK.goldDeep, lineHeight: 1.35 }}>
        {memberName(writer, names)} is writing a reply. Move it anyway?
      </p>
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        <Btn tone="green" size="sm" onClick={() => { void doHand(confirmTo); }}>Move it</Btn>
        <Btn tone="ghost" size="sm" onClick={() => setConfirmTo(null)}>Keep it</Btn>
      </div>
    </div>
  ) : open && staffOptions.length > 0 ? (
    <GSelect size="sm" value={d.assigned_member_id ?? ''} onChange={(v) => hand(v)} options={staffOptions}
      placeholder="Unclaimed, choose a person" aria-label="Responsible for this directive" disabled={handing} />
  ) : (
    <span className="inline-flex items-center" style={{ gap: 7 }}>
      <StaffPic member={d.assigned_member_id ? names.members.get(d.assigned_member_id) : null} size={24} />
      {memberName(d.assigned_member_id, names, 'Unassigned')}
    </span>
  );

  if (compact) {
    // ONE tight row of small facts (wraps on a narrow width): From, Waiting since, Length, Themes, then Responsible at the right end. No secret goals chip.
    const who = authorName(d, names);
    const themeCount = d.themes.length + (covertShown ? 1 : 0);
    return (
      <>
        <Fact big icon={<UserRound size={13} strokeWidth={1.6} />} label="From">
          <span className="inline-flex items-center" style={{ gap: 6 }}>
            <CharacterLink id={character?.id} style={{ borderRadius: '50%', lineHeight: 0, flex: 'none' }}>
              <Avatar name={who} src={character?.picture_url} size={20} color={character?.cabinet_id ? names.cabinets.get(character.cabinet_id)?.color ?? CK.red : CK.red} />
            </CharacterLink>
            <span>{character ? <CharacterName id={character.id}>{who}</CharacterName> : who}</span>
          </span>
        </Fact>
        <Fact big icon={<Clock size={13} strokeWidth={1.6} />} label={waitLabelText}><span style={{ color: SEV_COLOR[sev] }}>{waitValue}</span></Fact>
        <Fact big icon={<FileText size={13} strokeWidth={1.6} />} label="Length">{d.word_count} words</Fact>
        {themeCount > 0 && (
          <Fact big icon={<VenetianMask size={13} strokeWidth={1.6} />} label={covertShown && d.themes.length === 0 ? 'Covert' : 'Themes'}>
            {themeCount > 2 ? (
              <ThemeIcons themes={covertShown ? [...d.themes, 'Covert'] : d.themes} size="md" />
            ) : (
              <span className="flex flex-wrap items-center" style={{ gap: 6 }}>
                {d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}
                {covertShown && <span style={{ fontSize: 12, fontWeight: 800, color: CK.redDeep, background: cabinetTint(CK.redDeep, 0.08), borderRadius: 8, padding: '2px 9px' }}>Covert</span>}
              </span>
            )}
          </Fact>
        )}
        {/* Pushed to the right end of the SAME row; it drops to its own line only when the pop-up is too narrow for one row. */}
        <div style={{ flex: '0 1 220px', minWidth: 190, marginLeft: 'auto' }}>
          <Fact big icon={<UserRound size={13} strokeWidth={1.6} />} label="Responsible for this directive">{responsibleBody}</Fact>
          {writer && !confirmTo && (
            <div style={{ marginTop: 4 }}>
              <span className="inline-flex items-center" style={{ gap: 7, fontSize: 12.5, fontWeight: 800, color: CK.goldDeep }}>
                <StaffPic member={names.members.get(writer)} size={20} />
                {memberName(writer, names)} is writing a reply
              </span>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    // Three pieces that sit in the pop-up's white band beside the character, on ONE row when there is room (owner,
    // 30 Oct 2026): the small facts in a grid, then who is responsible in its own column, then the secret goals full width.
    <>
    <div className="dp-facts flex flex-col" style={{ flex: '0 1 150px', gap: 8, minWidth: 120, paddingTop: 12 }}>
      <Fact icon={<Clock size={13} strokeWidth={1.6} />} label={waitLabelText}><span style={{ color: SEV_COLOR[sev] }}>{waitValue}</span></Fact>
      <Fact icon={<FileText size={13} strokeWidth={1.6} />} label="Length">{d.word_count} words</Fact>
    </div>
    {(d.themes.length > 0 || covertShown) && (
      <div className="flex flex-col" style={{ flex: '0 1 150px', minWidth: 110, paddingTop: 12 }}>
        <Fact icon={<VenetianMask size={13} strokeWidth={1.6} />} label={covertShown && d.themes.length === 0 ? 'Covert' : 'Themes'}>
          {d.themes.length + (covertShown ? 1 : 0) > 2 ? (
            // More than two: icons only on one line, so the band never grows (each icon's title is the theme).
            <ThemeIcons themes={covertShown ? [...d.themes, 'Covert'] : d.themes} size="md" />
          ) : (
            <span className="flex flex-col items-start" style={{ gap: 4 }}>
              {d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}
              {covertShown && <span style={{ fontSize: 12, fontWeight: 800, color: CK.redDeep, background: cabinetTint(CK.redDeep, 0.08), borderRadius: 8, padding: '2px 9px' }}>Covert</span>}
            </span>
          )}
        </Fact>
      </div>
    )}

    <div className="dp-resp flex flex-col" style={{ flex: '0 1 230px', gap: 8, minWidth: 180, paddingTop: 12, marginLeft: 'auto' }}>
      <Fact icon={<UserRound size={13} strokeWidth={1.6} />} label="Responsible for this directive">
        {responsibleBody}
        {!confirmTo && ownerId && ownerId !== d.assigned_member_id && d.kind !== 'committee' && (
          <span className="inline-flex items-center" title="The backroomer for this character" style={{ gap: 6, marginTop: 4, fontSize: 12, fontWeight: 600, color: CK.inkSoft }}>
            <StaffPic member={names.members.get(ownerId)} size={18} />
            Usually {memberName(ownerId, names)}
          </span>
        )}
      </Fact>
      {writer && !confirmTo && (
        <Fact icon={<Pencil size={13} strokeWidth={1.6} />} label="Being written">
          <span className="inline-flex items-center" style={{ gap: 7, color: CK.goldDeep }}>
            <StaffPic member={names.members.get(writer)} size={22} />
            {memberName(writer, names)} is writing a reply
          </span>
        </Fact>
      )}

    </div>
    </>
  );
}

/** The author's secret goals (staff only; the read is refused for anyone else). Shown as a chip beside the character's
 *  name in the pop-up, opening a POPOVER anchored to the chip (it no longer expands the band and pushes the layout). */
export function useSecretGoals(d: Directive): string | null {
  const { ref } = useCrisis();
  const [goals, setGoals] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!d.author_character_id) return;
    loadSecrets(ref).then((rows) => {
      if (!cancelled) setGoals(rows.find((r) => r.character_id === d.author_character_id)?.goals?.trim() || null);
    }).catch(() => { if (!cancelled) setGoals(null); });
    return () => { cancelled = true; };
  }, [ref, d.author_character_id]);
  return d.author_character_id ? goals : null;
}

const GOALS_W = 340;

/** The chip and its popover. The popover is portaled at fixed coordinates from the chip's rectangle, follows scroll and resize,
 *  flips above the chip near the bottom edge, closes on an outside press or Escape (Escape closes only the popover, so the
 *  directive pop-up underneath stays), and sits above the directive pop-up (z-index 200). */
export function SecretGoalsChip({ goals }: { goals: string }) {
  const [open, setOpen] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);

  const place = () => {
    const el = chip.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(GOALS_W, vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const below = vh - r.bottom - 14;
    const above = r.top - 14;
    if (below < 170 && above > below) setPos({ left, bottom: vh - r.top + 6, width, maxH: Math.min(300, above) });
    else setPos({ left, top: r.bottom + 6, width, maxH: Math.min(300, Math.max(120, below)) });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const on = () => place();
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on, true); window.removeEventListener('resize', on); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (pop.current?.contains(t) || chip.current?.contains(t)) return;
      setOpen(false);
    };
    // Capture phase on the window: this Escape closes the popover and goes no further.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      chip.current?.focus();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true); };
  }, [open]);

  return (
    <>
      <button ref={chip} type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-haspopup="dialog" title="Only staff see this"
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ gap: 5, border: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12, fontWeight: 700, color: CK.goldDeep, background: cabinetTint(CK.gold, 0.45), borderRadius: 9, padding: '3px 9px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}`, flex: 'none' }}>
        <Lock size={12} strokeWidth={1.8} aria-hidden />
        Secret goals
        <ChevronDown size={13} strokeWidth={1.8} aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={pop}
            data-crisis-popover
            role="dialog"
            aria-label="Secret goals"
            style={{
              position: 'fixed', zIndex: 210, left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH, overflowY: 'auto',
              background: `linear-gradient(180deg, ${cabinetTint(CK.gold, 0.5)}, ${cabinetTint(CK.gold, 0.26)}), ${CK.card}`, borderRadius: 14, padding: '10px 13px',
              boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.3)}, 0 14px 34px rgba(58,14,15,0.28)`, fontFamily: CK.font,
            }}
          >
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: CK.goldDeep }}>Secret goals, only staff see this</span>
            <b style={{ display: 'block', fontSize: 13.5, marginTop: 3, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', color: CK.ink }}>{goals}</b>
          </div>
        </Portal>
      )}
    </>
  );
}
