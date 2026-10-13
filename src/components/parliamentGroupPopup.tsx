'use client';

// ============================================================
// src/components/parliamentGroupPopup.tsx
//
// The group pop-up of a custom (parliamentary) committee. Clicking a group card
// opens it: customise the group (name, short name, colour, crest, remove) and
// fill it (its seats, seats pulled in from Unassigned, new named seats).
//
// It wears the committee editor's own look (owner, 12 Oct 2026: "it should look
// basically the same as the committee set-up ... two columns ... one smaller
// page"): the editor's surface and shadow, SetupLabel / SETUP_INPUT_CLS, plain
// headings in ink and forest, no gold italic, no emoji headings, no numbered
// seats. Left column: the group. Right column: its seats and Unassigned.
//
// Presentation only: every change is a callback ConferenceRosterSelected owns.
// Portaled dialog, focus trap, Escape through the shared modal stack, focus
// returned on close. A bottom sheet below 640px.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, Megaphone, PenLine, ImagePlus, Replace, Undo2, Trash2, Plus } from 'lucide-react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT } from '@/components/neu';
import { CircleFlag } from '@/components/CircleFlag';
import { useModalEscape } from '@/components/ModalOverlay';
import { useScrollLock } from '@/hooks/useScrollLock';
import { groupShort, type SlotGroup } from '@/lib/slotGroups';
import { GroupColorSwatches, GroupDisc } from '@/components/parliamentSetup';
import { SetupLabel, SETUP_INPUT_CLS } from '@/components/committeeSetupKit';

const INK = '#1C1410';
const INK_SOFT = '#544B3E';
const MUTED = '#8A7C6B';
const FOREST = '#1B3828';
const DANGER = '#8B2020';

export interface GroupPopupSeat {
  /** Index into the roster (`value`), stable for this render. */
  idx: number;
  name: string;
  logoUrl: string | null;
  isObserver: boolean;
}

export function ParliamentGroupPopup({
  group, members, unassigned, canUpload, uploadingCrest,
  onClose, onRename, onShortName, onColor, onUploadCrest, onClearCrest, onRemoveGroup,
  onUnassign, onAssign, onAddNamed, onRenameSeat, onToggleObserver, onSeatFlag, onRemoveSeat,
}: {
  group: SlotGroup;
  members: GroupPopupSeat[];
  unassigned: GroupPopupSeat[];
  canUpload: boolean;
  uploadingCrest: boolean;
  onClose: () => void;
  /** False when another group already has that name. */
  onRename: (name: string) => boolean;
  onShortName: (short: string) => void;
  onColor: (color: string) => void;
  onUploadCrest: () => void;
  onClearCrest: () => void;
  onRemoveGroup: () => void;
  onUnassign: (idx: number) => void;
  onAssign: (idxs: number[]) => void;
  /** Returns how many were added; names already on the roster are skipped. */
  onAddNamed: (names: string[]) => number;
  /** False when the name is empty or taken. */
  onRenameSeat: (idx: number, name: string) => boolean;
  onToggleObserver: (idx: number) => void;
  onSeatFlag?: (idx: number) => void;
  onRemoveSeat: (idx: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  useScrollLock(true);
  useModalEscape(onClose, true);

  // Focus: remember who opened us, start on the name field, give focus back.
  useEffect(() => {
    returnRef.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
      const el = returnRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const list = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  // ── Name and short name: drafts, committed on blur / Enter ──
  const [nameDraft, setNameDraft] = useState(group.name);
  const [nameError, setNameError] = useState('');
  const [shortDraft, setShortDraft] = useState(group.short_name ?? '');
  const commitName = () => {
    const n = nameDraft.trim();
    if (!n) { setNameDraft(group.name); setNameError(''); return; }
    if (n === group.name) { setNameError(''); return; }
    if (onRename(n)) setNameError('');
    else setNameError('Another group already has that name.');
  };
  const commitShort = () => {
    const s = shortDraft.trim().slice(0, 16);
    if (s !== (group.short_name ?? '')) onShortName(s);
  };

  // ── Add from unassigned ──
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const pickedLive = useMemo(() => new Set([...picked].filter((i) => unassigned.some((u) => u.idx === i))), [picked, unassigned]);
  const allPicked = unassigned.length > 0 && pickedLive.size === unassigned.length;

  // ── Add new seats ──
  const [newNames, setNewNames] = useState('');
  const [addNote, setAddNote] = useState('');
  const short = groupShort(group);
  const typedNames = newNames.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

  // ── Seat rename ──
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const commitSeat = (idx: number) => {
    if (onRenameSeat(idx, editDraft)) setEditing(null);
  };

  const [confirmRemove, setConfirmRemove] = useState(false);

  const addTyped = () => {
    if (typedNames.length === 0) return;
    const n = onAddNamed(typedNames);
    const skipped = typedNames.length - n;
    setNewNames('');
    setAddNote(n === 0 ? 'Those names are already on the list.' : skipped > 0 ? `Added ${n}. ${skipped} already on the list.` : `Added ${n}.`);
  };

  return (
    <Portal>
      <div className="gv-gp-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <style>{GROUP_POPUP_CSS}</style>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gv-gp-title"
          className="gv-gp"
          style={{ backgroundColor: NEU.surface, boxShadow: NEU.out }}
          onKeyDown={onKeyDown}
        >
          <span className="gv-gp-grab" aria-hidden />
          <div className="gv-gp-head">
            <GroupDisc group={group} size={44} />
            <div className="min-w-0 flex-1">
              <h2 id="gv-gp-title" className="gv-gp-title">{short}</h2>
              {short !== group.name && <p className="gv-gp-sub">{group.name}</p>}
            </div>
            <button type="button" className="gv-gp-x" onClick={onClose} aria-label="Close" title="Close"><X size={18} /></button>
          </div>

          <div className="gv-gp-cols">
            {/* ── Left: the group ── */}
            <div className="gv-gp-col">
              <div className="gv-gp-two">
                <div>
                  <SetupLabel htmlFor="gv-gp-name">Name</SetupLabel>
                  <input
                    id="gv-gp-name"
                    data-autofocus
                    className={SETUP_INPUT_CLS}
                    value={nameDraft}
                    onChange={(e) => { setNameDraft(e.target.value); setNameError(''); }}
                    onBlur={commitName}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitName(); } }}
                    aria-invalid={!!nameError}
                  />
                </div>
                <div>
                  <SetupLabel htmlFor="gv-gp-short">Short name</SetupLabel>
                  <input
                    id="gv-gp-short"
                    className={SETUP_INPUT_CLS}
                    value={shortDraft}
                    maxLength={16}
                    placeholder="e.g. EPP"
                    onChange={(e) => setShortDraft(e.target.value)}
                    onBlur={commitShort}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitShort(); } }}
                  />
                </div>
              </div>
              {nameError && <p className="gv-gp-err" role="alert">{nameError}</p>}

              <div>
                <SetupLabel>Colour</SetupLabel>
                <GroupColorSwatches value={group.color} onPick={onColor} />
              </div>

              {canUpload && (
                <div>
                  <SetupLabel>Crest</SetupLabel>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="gv-gp-btn gv-gp-ghost" onClick={onUploadCrest} disabled={uploadingCrest}>
                      {group.logo_url ? <Replace size={15} aria-hidden /> : <ImagePlus size={15} aria-hidden />}
                      {uploadingCrest ? 'Uploading…' : group.logo_url ? 'Replace crest' : 'Upload a crest'}
                    </button>
                    {group.logo_url && (
                      <button type="button" className="gv-gp-link" onClick={onClearCrest}>Remove crest</button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <SetupLabel htmlFor="gv-gp-new">Add seats</SetupLabel>
                <textarea
                  id="gv-gp-new"
                  rows={3}
                  className={`${SETUP_INPUT_CLS} resize-none`}
                  value={newNames}
                  placeholder={'One name per line\ne.g. Ursula Weber'}
                  onChange={(e) => { setNewNames(e.target.value); setAddNote(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addTyped(); } }}
                />
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" className="gv-gp-btn gv-gp-ghost" disabled={typedNames.length === 0} onClick={addTyped}>
                    <Plus size={15} aria-hidden />
                    {typedNames.length > 1 ? `Add ${typedNames.length} seats` : 'Add seat'}
                  </button>
                  {addNote && <span className="gv-gp-note" role="status">{addNote}</span>}
                </div>
              </div>

              <div className="gv-gp-remove">
                {confirmRemove ? (
                  <div className="gv-gp-confirm" role="alertdialog" aria-label={`Remove ${short}?`}>
                    <p>
                      Remove {short}?{' '}
                      {members.length > 0 ? `Its ${members.length} ${members.length === 1 ? 'seat goes' : 'seats go'} back to Unassigned.` : 'It has no seats.'}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" className="gv-gp-btn gv-gp-ghost" autoFocus onClick={() => setConfirmRemove(false)}>Keep it</button>
                      <button type="button" className="gv-gp-btn gv-gp-red" onClick={onRemoveGroup}>Remove group</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="gv-gp-link gv-gp-danger" onClick={() => setConfirmRemove(true)}>
                    <Trash2 size={14} aria-hidden /> Remove this group
                  </button>
                )}
              </div>
            </div>

            {/* ── Right: its seats, then Unassigned ── */}
            <div className="gv-gp-col gv-gp-right">
              <div className="gv-gp-listwrap">
                <SetupLabel aside={`${members.length}`}>Seats in {short}</SetupLabel>
                {members.length === 0 ? (
                  <p className="gv-gp-empty">No seats yet. Add some, or pick them from Unassigned.</p>
                ) : (
                  <ul className="gv-gp-list">
                    {members.map((m) => (
                      <li key={`${m.idx}-${m.name}`} className="gv-gp-row">
                        {m.logoUrl
                          ? <CircleFlag logoUrl={m.logoUrl} label={m.name} size={28} logoFit="contain" decorative />
                          : <GroupDisc group={group} size={28} />}
                        {editing === m.idx ? (
                          <input
                            autoFocus
                            className="gv-gp-rename"
                            value={editDraft}
                            aria-label={`Rename ${m.name}`}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onBlur={() => commitSeat(m.idx)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); commitSeat(m.idx); }
                              else if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); }
                            }}
                          />
                        ) : (
                          <span className="gv-gp-name">
                            {m.name}
                            {m.isObserver && <Megaphone size={13} className="gv-gp-obs" aria-label="Observer" />}
                          </span>
                        )}
                        {editing !== m.idx && (
                          <span className="gv-gp-ctls">
                            <button type="button" className="gv-gp-ic" onClick={() => { setEditing(m.idx); setEditDraft(m.name); }} title="Rename" aria-label={`Rename ${m.name}`}><PenLine size={15} /></button>
                            <button type="button" className={`gv-gp-ic${m.isObserver ? ' gv-gp-lit' : ''}`} aria-pressed={m.isObserver} onClick={() => onToggleObserver(m.idx)} title={m.isObserver ? 'Observer. Make a voting member' : 'Mark as observer'} aria-label={`${m.isObserver ? 'Make voting member' : 'Mark as observer'}: ${m.name}`}><Megaphone size={15} /></button>
                            {onSeatFlag && (
                              <button type="button" className={`gv-gp-ic${m.logoUrl ? ' gv-gp-lit' : ''}`} onClick={() => onSeatFlag(m.idx)} title={m.logoUrl ? 'Replace this seat\u2019s picture' : 'Give this seat its own picture'} aria-label={`Picture for ${m.name}`}><ImagePlus size={15} /></button>
                            )}
                            <button type="button" className="gv-gp-ic" onClick={() => onUnassign(m.idx)} title="Move back to Unassigned" aria-label={`Move ${m.name} back to Unassigned`}><Undo2 size={15} /></button>
                            <button type="button" className="gv-gp-ic gv-gp-danger" onClick={() => onRemoveSeat(m.idx)} title="Delete this seat" aria-label={`Delete ${m.name}`}><Trash2 size={15} /></button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {unassigned.length > 0 && (
                <div className="gv-gp-listwrap gv-gp-unassigned">
                  <SetupLabel
                    aside={
                      <button type="button" className="gv-gp-link" style={{ fontSize: 12, padding: 0 }} onClick={() => setPicked(allPicked ? new Set() : new Set(unassigned.map((u) => u.idx)))}>
                        {allPicked ? 'Clear' : 'Select all'}
                      </button>
                    }
                  >
                    Unassigned
                  </SetupLabel>
                  <ul className="gv-gp-list">
                    {unassigned.map((u) => {
                      const on = pickedLive.has(u.idx);
                      return (
                        <li key={`${u.idx}-${u.name}`}>
                          <label className="gv-gp-row gv-gp-check" data-on={on ? '' : undefined}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(u.idx)) n.delete(u.idx); else n.add(u.idx); return n; })}
                            />
                            <span className="gv-gp-box" aria-hidden>{on && <Check size={12} strokeWidth={3.2} />}</span>
                            <span className="gv-gp-name">{u.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    className="gv-gp-btn gv-gp-ghost mt-2 w-full"
                    disabled={pickedLive.size === 0}
                    onClick={() => { onAssign([...pickedLive]); setPicked(new Set()); }}
                  >
                    {pickedLive.size === 0 ? 'Pick seats to move here' : `Move ${pickedLive.size} ${pickedLive.size === 1 ? 'seat' : 'seats'} to ${short}`}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="gv-gp-foot">
            <button type="button" className="gv-gp-btn gv-gp-forest" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

const GROUP_POPUP_CSS = `
.gv-gp-back{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(28,20,16,0.42);font-family:${OUTFIT};animation:gv-gp-fade 160ms ease}
.gv-gp{position:relative;display:flex;flex-direction:column;width:min(780px,100%);max-height:min(620px,calc(100dvh - 48px));border-radius:24px;overflow:hidden;color:${INK};animation:gv-gp-rise 220ms cubic-bezier(0.22,1,0.36,1)}
.gv-gp-grab{display:none}
.gv-gp-head{display:flex;align-items:center;gap:12px;padding:16px 14px 10px 20px}
.gv-gp-title{margin:0;font-size:17px;font-weight:800;letter-spacing:-0.01em;line-height:1.2;color:${INK};overflow-wrap:anywhere}
.gv-gp-sub{margin:1px 0 0;font-size:13px;font-weight:500;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-gp-x{display:flex;align-items:center;justify-content:center;width:40px;height:40px;flex-shrink:0;border-radius:999px;border:none;background:transparent;color:${INK_SOFT};cursor:pointer}
.gv-gp-x:hover{background:rgba(27,56,40,0.07)}
.gv-gp-x:focus{outline:none}.gv-gp-x:focus-visible{box-shadow:0 0 0 2px ${FOREST}}
.gv-gp-cols{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);gap:16px;padding:6px 20px 12px;overflow-y:auto;overscroll-behavior:contain}
.gv-gp-col{display:flex;flex-direction:column;gap:14px;min-width:0}
@media (min-width:720px){
  .gv-gp-cols{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;overflow:hidden}
  .gv-gp-col{overflow-y:auto;overscroll-behavior:contain;padding:2px 4px 4px;margin:-2px -4px -4px}
  .gv-gp-right{overflow:hidden;display:flex}
  .gv-gp-right .gv-gp-listwrap{flex:1 1 0;min-height:0;display:flex;flex-direction:column}
  .gv-gp-right .gv-gp-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:2px}
}
.gv-gp-two{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:10px}
.gv-gp-err{margin:-6px 0 0;font-size:12.5px;font-weight:600;color:${DANGER}}
.gv-gp-note{font-size:12.5px;font-weight:600;color:${FOREST}}
.gv-gp-empty{margin:0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,0.6);font-size:13px;color:${INK_SOFT}}
.gv-gp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.gv-gp-unassigned .gv-gp-list{max-height:200px;overflow-y:auto}
.gv-gp-row{display:flex;align-items:center;gap:10px;min-height:42px;padding:4px 6px 4px 8px;border-radius:12px;background:rgba(255,255,255,0.8);box-shadow:inset 0 0 0 1px rgba(27,56,40,0.08)}
.gv-gp-name{flex:1;min-width:0;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${INK};overflow-wrap:anywhere}
.gv-gp-obs{flex-shrink:0;color:${INK_SOFT}}
.gv-gp-ctls{display:flex;align-items:center;gap:1px;flex-shrink:0}
.gv-gp-ic{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;border:none;background:transparent;color:${MUTED};cursor:pointer}
.gv-gp-ic:hover{background:rgba(27,56,40,0.07);color:${FOREST}}
.gv-gp-ic:focus{outline:none}.gv-gp-ic:focus-visible{box-shadow:0 0 0 2px ${FOREST}}
.gv-gp-ic.gv-gp-lit{color:${FOREST}}
.gv-gp-ic.gv-gp-danger:hover{color:${DANGER}}
.gv-gp-check{cursor:pointer;position:relative}
.gv-gp-check input{position:absolute;opacity:0;width:1px;height:1px}
.gv-gp-check[data-on]{box-shadow:inset 0 0 0 1.5px ${FOREST}}
.gv-gp-check:focus-within{box-shadow:0 0 0 2px ${FOREST}}
.gv-gp-box{display:flex;align-items:center;justify-content:center;width:20px;height:20px;flex-shrink:0;border-radius:6px;border:1.5px solid rgba(27,56,40,0.35);background:#FFFFFF;color:#FFFFFF}
.gv-gp-check[data-on] .gv-gp-box{background:${FOREST};border-color:${FOREST}}
.gv-gp-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:0 16px;border-radius:12px;border:none;cursor:pointer;font-family:${OUTFIT};font-size:14px;font-weight:700;transition:transform 120ms ease,opacity 140ms ease,background-color 140ms ease}
.gv-gp-btn:active:not(:disabled){transform:scale(0.98)}
.gv-gp-btn:disabled{opacity:0.5;cursor:default}
.gv-gp-btn:focus{outline:none}.gv-gp-btn:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-gp-forest{min-width:140px;background-image:linear-gradient(135deg,#2E6446 0%,#1F4230 42%,#1B3828 62%,#122A1D 100%);color:#FFFFFF;box-shadow:0 2px 4px rgba(27,56,40,0.16),0 10px 24px rgba(27,56,40,0.24)}
.gv-gp-ghost{background:transparent;color:${FOREST};box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.22)}
.gv-gp-ghost:hover:not(:disabled){background:rgba(27,56,40,0.06)}
.gv-gp-red{background:${DANGER};color:#FFFFFF}
.gv-gp-link{display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:4px 0;font-family:${OUTFIT};font-size:13px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-gp-link.gv-gp-danger{color:${DANGER}}
.gv-gp-link:focus{outline:none}.gv-gp-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-gp-remove{margin-top:auto;padding-top:4px}
.gv-gp-confirm{background:rgba(255,255,255,0.85);border-radius:14px;padding:12px 14px;box-shadow:inset 0 0 0 1.5px rgba(139,32,32,0.35)}
.gv-gp-confirm p{margin:0 0 10px;font-size:13.5px;line-height:1.45}
.gv-gp-foot{display:flex;justify-content:flex-end;padding:10px 20px calc(14px + env(safe-area-inset-bottom));box-shadow:0 -1px 0 rgba(27,56,40,0.07)}
@keyframes gv-gp-fade{from{opacity:0}to{opacity:1}}
@keyframes gv-gp-rise{from{opacity:0;transform:translateY(12px) scale(0.985)}to{opacity:1;transform:none}}
@media (max-width:639px){
  .gv-gp-back{align-items:flex-end;padding:0}
  .gv-gp{width:100%;max-height:92dvh;border-radius:22px 22px 0 0;animation:gv-gp-sheet 240ms cubic-bezier(0.22,1,0.36,1)}
  .gv-gp-grab{display:block;position:absolute;top:9px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:99px;background:rgba(28,20,16,0.2);z-index:1}
  .gv-gp-head{padding-top:22px}
  .gv-gp-ic{width:38px;height:38px}
  .gv-gp-foot .gv-gp-btn{width:100%}
}
@keyframes gv-gp-sheet{from{transform:translateY(40px);opacity:0.6}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.gv-gp-back,.gv-gp{animation:none}}
`;
