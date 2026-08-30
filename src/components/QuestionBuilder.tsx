'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlignLeft, Archive, Calendar, ChevronDown, ChevronDownCircle, CircleDot, Copy, GripHorizontal,
  Hash, Heading, Info, MoreVertical, Plus, Rows3, RotateCcw, SquareCheck, Text, Trash2, X,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { Pill, PillToggle } from '@/app/account/accountUi';
import { useConfirmModal } from '@/components/ConfirmModal';
import {
  type QuestionType, type FormBlock, type QuestionBlock, type TitleBlock, type SectionBlock,
  isChoiceType, QUESTION_TYPE_LABELS,
} from '@/lib/customQuestions';

/** The seven types in the three groups Google uses: free text, choices, and
 *  the constrained scalars. Order within the menu only, never data. */
const TYPE_GROUPS: QuestionType[][] = [
  ['short_text', 'paragraph'],
  ['multiple_choice', 'checkboxes', 'dropdown'],
  ['number', 'date'],
];

const TYPE_ICONS: Record<QuestionType, typeof AlignLeft> = {
  short_text: AlignLeft,
  paragraph: Text,
  multiple_choice: CircleDot,
  checkboxes: SquareCheck,
  dropdown: ChevronDownCircle,
  number: Hash,
  date: Calendar,
};

/** Types that can carry a placeholder. A date picker and the choice types have
 *  nowhere to put one. */
function supportsPlaceholder(t: QuestionType): boolean {
  return t === 'short_text' || t === 'paragraph' || t === 'number';
}

/** Muted one-liner standing in for the input the applicant will get. */
const PREVIEW_TEXT: Partial<Record<QuestionType, string>> = {
  short_text: 'Short answer text',
  paragraph: 'Long answer text',
  number: 'Number',
  date: 'Date',
};

const softInput: React.CSSProperties = {
  width: '100%',
  border: 'none',
  borderBottom: '1px solid transparent',
  backgroundColor: 'transparent',
  color: '#1C1410',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  padding: '4px 0',
};

/** Borderless field that grows a Forest underline while focused. The 2px is
 *  drawn as a box-shadow so gaining focus never shifts the line below it. */
function focusUnderline(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.boxShadow = 'inset 0 -2px 0 0 #1B3828';
}
function blurUnderline(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.boxShadow = 'none';
}

// ── Anchored menu ────────────────────────────────────────────────────────────
// Portaled to fixed viewport coordinates taken from the trigger, so no card's
// rounded overflow and no scrolling panel can clip it. Flips up and clamps
// left when it would otherwise leave the viewport.

function menuPosition(anchor: HTMLElement, width: number, height: number) {
  const r = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
  const below = r.bottom + 6;
  const flip = below + height > window.innerHeight - 8 && r.top - height - 6 > 8;
  return { left, top: flip ? r.top - height - 6 : below };
}

function AnchoredMenu({ anchor, width, height, onClose, children }: {
  anchor: HTMLElement;
  width: number;
  height: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState(() => menuPosition(anchor, width, height));
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reposition = () => setPos(menuPosition(anchor, width, height));
    // Capture phase: a scroll inside the settings panel never bubbles to window.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, width, height, onClose]);

  return (
    <Portal>
      <div
        ref={panelRef}
        className="fixed z-50 rounded-xl overflow-hidden py-1.5"
        style={{
          left: pos.left, top: pos.top, width,
          backgroundColor: '#FFFDF9',
          border: '1px solid #D8CDB6',
          boxShadow: '0 4px 14px rgba(27,56,40,0.10)',
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

function MenuItem({ icon, label, active, onClick }: {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left focus:outline-none transition-colors"
      style={{
        backgroundColor: active ? 'rgba(27,56,40,0.08)' : 'transparent',
        color: active ? '#1B3828' : '#1C1410',
        fontFamily: "'Outfit', sans-serif",
        fontSize: '13px',
        fontWeight: active ? 700 : 500,
        border: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Answer preview ───────────────────────────────────────────────────────────
// What the applicant will see, drawn inert. The choice types are the exception:
// their options are the question, so they stay editable here.

function OptionGlyph({ type, index }: { type: QuestionType; index: number }) {
  if (type === 'dropdown') {
    return (
      <span className="flex-shrink-0 text-center" style={{ width: 16, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontSize: '13px' }}>
        {index + 1}.
      </span>
    );
  }
  return (
    <span
      className="flex-shrink-0"
      style={{
        width: 15, height: 15,
        border: '1.5px solid #B8AC98',
        borderRadius: type === 'checkboxes' ? '3px' : '999px',
      }}
    />
  );
}

function AnswerPreview({ block, onPatch }: {
  block: QuestionBlock;
  onPatch: (patch: Partial<QuestionBlock>) => void;
}) {
  if (!isChoiceType(block.type)) {
    return (
      <div
        className="mt-4 pb-1"
        style={{ borderBottom: '1px dotted #B8AC98', maxWidth: '65%' }}
      >
        <span className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          {PREVIEW_TEXT[block.type]}
        </span>
      </div>
    );
  }

  const options = block.options && block.options.length > 0 ? block.options : ['', ''];
  const canRemove = options.length > 2;

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <OptionGlyph type={block.type} index={i} />
          <input
            type="text"
            value={opt}
            onChange={(e) => onPatch({ options: options.map((o, j) => (j === i ? e.target.value : o)) })}
            placeholder={`Option ${i + 1}`}
            className="text-sm flex-1 min-w-0"
            style={softInput}
            onFocus={focusUnderline}
            onBlur={blurUnderline}
          />
          <button
            type="button"
            aria-label={`Remove option ${i + 1}`}
            disabled={!canRemove}
            onClick={() => onPatch({ options: options.filter((_, j) => j !== i) })}
            className="p-1 rounded-lg focus:outline-none flex-shrink-0"
            style={{ background: 'none', border: 'none', color: canRemove ? '#B8AC98' : '#DDD4C0', cursor: canRemove ? 'pointer' : 'default' }}
            onMouseEnter={(e) => { if (canRemove) (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
            onMouseLeave={(e) => { if (canRemove) (e.currentTarget as HTMLElement).style.color = '#B8AC98'; }}
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onPatch({ options: [...options, ''] })}
        className="flex items-center gap-2.5 focus:outline-none text-left"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <OptionGlyph type={block.type} index={options.length} />
        <span className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Add option
        </span>
      </button>
    </div>
  );
}

// ── Archived question row ────────────────────────────────────────────────────
// Collapsed and muted: no type/required pills, no edit or duplicate — an
// archived question is off the live form, its only actions are bringing it
// back or forgetting it (and its answers) for good.

function ArchivedRow({ block, onRestore, onDeleteForever }: {
  block: QuestionBlock;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
      style={{ backgroundColor: 'rgba(154,138,120,0.07)', border: '1px solid #EDE7D9' }}
    >
      <span className="flex-1 min-w-0 truncate text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
        {block.label || 'Untitled question'}
      </span>
      <button
        onClick={onRestore}
        className="flex items-center gap-1 text-xs font-semibold focus:outline-none hover:underline flex-shrink-0"
        style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
      >
        <RotateCcw size={11} /> RESTORE
      </button>
      <button
        onClick={onDeleteForever}
        className="p-1 rounded-lg focus:outline-none flex-shrink-0"
        style={{ color: '#B8AC98' }}
        title="Delete permanently"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Right rail ───────────────────────────────────────────────────────────────

const RAIL_ACTIONS = [
  { key: 'question', icon: Plus, label: 'Add question' },
  { key: 'title', icon: Heading, label: 'Add title and description' },
  { key: 'section', icon: Rows3, label: 'Add section' },
] as const;

function RailButton({ icon: Icon, label, horizontal, onClick }: {
  icon: typeof Plus;
  label: string;
  horizontal: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center justify-center gap-2 rounded-[10px] focus:outline-none transition-colors"
        style={{
          width: horizontal ? 'auto' : '36px',
          height: '36px',
          padding: horizontal ? '0 12px' : 0,
          background: 'none',
          border: 'none',
          color: '#1B3828',
          cursor: 'pointer',
        }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.10)'; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
      >
        <Icon size={17} strokeWidth={2.2} />
        {horizontal && (
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 700 }}>{label}</span>
        )}
      </button>
      {hovered && !horizontal && (
        <span
          role="tooltip"
          className="absolute whitespace-nowrap rounded-lg px-2.5 py-1.5 pointer-events-none"
          style={{
            right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px',
            backgroundColor: '#1B3828', color: '#EED98A',
            fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 700,
            boxShadow: '0 4px 14px rgba(27,56,40,0.10)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ── Builder ───────────────────────────────────────────────────────────────────

type MenuState =
  | { kind: 'type'; blockId: string; anchor: HTMLElement }
  | { kind: 'more'; blockId: string; anchor: HTMLElement }
  | null;

export default function QuestionBuilder({ value, onChange, hasApplications = false }: {
  value: FormBlock[];
  onChange: (next: FormBlock[]) => void;
  /** True when this role/form already has applications in the pipeline.
   *  Never locks anything — the builder is fully editable regardless — it
   *  only softens the copy shown while rewording an existing question and is
   *  otherwise unused. Deleting still always archives an existing question
   *  rather than destroying it; see newIds below for the one case (a question
   *  added and deleted in the same sitting, never seen by an applicant) that
   *  removes it outright. */
  hasApplications?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  // Which optional fields the organizer has asked to see on a given block.
  const [extras, setExtras] = useState<Record<string, { help?: boolean; placeholder?: boolean }>>({});
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // A card is only draggable once the grip is pressed, otherwise selecting text
  // inside its inputs would start a drag instead.
  const [dragArmedId, setDragArmedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Ids of question blocks created during this sitting (added or duplicated,
  // not yet part of the persisted form when the builder mounted). Deleting
  // one of these can never orphan an answer, so it's removed outright instead
  // of archived.
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const { confirm, modal: confirmModal } = useConfirmModal();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [railTop, setRailTop] = useState(0);

  // The wording each question had when this sitting began. Comparing against it
  // is what tells us an EXISTING question has been reworded, which is the only
  // thing hasApplications changes.
  const [originals] = useState<Map<string, QuestionBlock>>(
    () => new Map(value.filter((b): b is QuestionBlock => b.kind === 'question').map(b => [b.id, b])),
  );

  const activeBlocks = value.filter(b => !(b.kind === 'question' && b.archived));
  const archivedBlocks = value.filter((b): b is QuestionBlock => b.kind === 'question' && !!b.archived);
  const sectionIds = activeBlocks.filter(b => b.kind === 'section').map(b => b.id);

  // Keep the rail beside the selected card. Measured in a frame so the card has
  // already grown into its selected height before we read the offset.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stack = stackRef.current;
      const card = selectedId ? cardRefs.current[selectedId] : null;
      if (!stack || !card) { setRailTop(0); return; }
      setRailTop(card.getBoundingClientRect().top - stack.getBoundingClientRect().top);
    });
    return () => cancelAnimationFrame(id);
  }, [selectedId, value]);

  // Clicking away from the builder puts every card back to its read-only face.
  // While a menu is open nothing is cleared: the menu is portaled, so its own
  // items count as outside, and AnchoredMenu already closes itself on that
  // click. The next outside click, with no menu open, drops the selection.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menu) return;
      if (wrapperRef.current?.contains(e.target as Node)) return;
      setSelectedId(null);
    };
    // Releasing the grip disarms dragging, so a press that never became a drag
    // does not leave the card draggable and swallowing text selection.
    const onUp = () => setDragArmedId(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
    };
  }, [menu]);

  function commit(nextActive: FormBlock[]) {
    onChange([...nextActive, ...archivedBlocks]);
  }

  function patchBlock(id: string, patch: Partial<QuestionBlock> | Partial<TitleBlock> | Partial<SectionBlock>) {
    onChange(value.map(b => (b.id === id ? ({ ...b, ...patch } as FormBlock) : b)));
  }

  /** Insert after the selected card, or at the end when nothing is selected,
   *  then select it so the organizer types straight into the new block. */
  function addBlock(kind: 'question' | 'title' | 'section') {
    const id = crypto.randomUUID();
    const block: FormBlock =
      kind === 'question'
        ? { kind: 'question', id, label: '', type: 'short_text', required: false, options: [] }
        : kind === 'title'
          ? { kind: 'title', id, title: '' }
          : { kind: 'section', id, title: '' };
    if (kind === 'question') setNewIds(prev => new Set(prev).add(id));
    const at = selectedId ? activeBlocks.findIndex(b => b.id === selectedId) : -1;
    const next = [...activeBlocks];
    next.splice(at === -1 ? next.length : at + 1, 0, block);
    commit(next);
    setSelectedId(id);
  }

  function handleDuplicate(idx: number) {
    const clone: FormBlock = { ...activeBlocks[idx], id: crypto.randomUUID() };
    if (clone.kind === 'question') setNewIds(prev => new Set(prev).add(clone.id));
    const nextActive = [...activeBlocks];
    nextActive.splice(idx + 1, 0, clone);
    commit(nextActive);
    setSelectedId(clone.id);
  }

  function handleDelete(id: string) {
    const block = value.find(b => b.id === id);
    if (!block) return;
    if (selectedId === id) setSelectedId(null);
    if (block.kind === 'question' && !newIds.has(id)) {
      // Could already have answers — archive instead of destroying them.
      onChange(value.map(b => (b.id === id ? { ...b, archived: true } : b)));
      return;
    }
    onChange(value.filter(b => b.id !== id));
    setNewIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleRestore(id: string) {
    onChange(value.map(b => (b.id === id ? { ...b, archived: false } : b)));
  }

  async function handlePermanentDelete(id: string) {
    const { confirmed } = await confirm({
      title: 'Delete this question permanently?',
      body: 'Answers already given to it will no longer be shown. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      danger: true,
    });
    if (!confirmed) return;
    onChange(value.filter(b => b.id !== id));
  }

  /** Changing type has to keep the options array legal: a choice type always
   *  offers at least two, anything else carries none. */
  function handleTypeChange(block: QuestionBlock, type: QuestionType) {
    const existing = block.options ?? [];
    const options = isChoiceType(type)
      ? (existing.length >= 2 ? existing : ['', ''])
      : [];
    patchBlock(block.id, { type, options });
    setMenu(null);
  }

  function handleDrop(dropIdx: number) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    setDragArmedId(null);
    if (from === null || from === dropIdx) return;
    const reordered = [...activeBlocks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(from < dropIdx ? dropIdx - 1 : dropIdx, 0, moved);
    commit(reordered);
  }

  const menuBlock = menu ? value.find(b => b.id === menu.blockId) : undefined;

  return (
    <>
      <div ref={wrapperRef} className="flex items-start" style={{ gap: '16px' }}>
        <div className="flex-1 min-w-0" style={{ maxWidth: '720px' }}>
          <div ref={stackRef} className="flex flex-col" style={{ gap: '12px' }}>
            {activeBlocks.length === 0 ? (
              <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                No questions yet.
              </p>
            ) : (
              activeBlocks.map((block, idx) => {
                const selected = selectedId === block.id;
                const original = block.kind === 'question' ? originals.get(block.id) : undefined;
                const validOptions = block.kind === 'question'
                  ? (block.options ?? []).map(o => o.trim()).filter(Boolean)
                  : [];
                const choice = block.kind === 'question' && isChoiceType(block.type);
                const needsLabel = block.kind === 'question' && block.label.trim().length === 0;
                const needsOptions = choice && validOptions.length < 2;
                // Quiet caution, not a blocker: once an applicant may already
                // have answered, flag that rewording leaves their answer
                // attached to different wording than the one they saw.
                const reworded = !!original && block.kind === 'question' && (
                  block.label.trim() !== original.label
                  || (choice && JSON.stringify(validOptions) !== JSON.stringify(original.options ?? []))
                );
                const shown = extras[block.id] ?? {};
                const showHelp = shown.help || (block.kind === 'question' && !!block.help);
                const showPlaceholder = block.kind === 'question'
                  && supportsPlaceholder(block.type)
                  && (shown.placeholder || !!block.placeholder);
                const sectionNumber = block.kind === 'section' ? sectionIds.indexOf(block.id) + 1 : 0;
                const TypeIcon = block.kind === 'question' ? TYPE_ICONS[block.type] : AlignLeft;

                return (
                  <div key={block.id}>
                    {dragOverIndex === idx && dragOverIndex !== dragIndexRef.current && (
                      <div className="h-0.5 rounded-full mx-2 mb-2" style={{ backgroundColor: '#1B3828' }} />
                    )}

                    {/* The section tab rides above its card, like a file tab. */}
                    {block.kind === 'section' && (
                      <div
                        className="inline-block px-3 py-1"
                        style={{
                          backgroundColor: '#1B3828',
                          borderTopLeftRadius: '10px', borderTopRightRadius: '10px',
                          color: '#EED98A', fontFamily: "'Outfit', sans-serif",
                          fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Section {sectionNumber} of {sectionIds.length}
                      </div>
                    )}

                    <div
                      ref={(el) => { cardRefs.current[block.id] = el; }}
                      draggable={dragArmedId === block.id}
                      onDragStart={() => { dragIndexRef.current = idx; }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); setDragArmedId(null); }}
                      onMouseEnter={() => setHoveredId(block.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => { if (!selected) setSelectedId(block.id); }}
                      className="relative rounded-xl"
                      style={{
                        backgroundColor: selected ? '#FFFDF9' : 'rgba(27,56,40,0.03)',
                        border: selected ? '1px solid #D8CDB6' : '1px solid rgba(27,56,40,0.1)',
                        borderTopLeftRadius: block.kind === 'section' ? 0 : undefined,
                        boxShadow: selected ? '0 4px 14px rgba(27,56,40,0.10)' : 'none',
                        cursor: selected ? 'default' : 'pointer',
                        transition: 'box-shadow 200ms ease, background-color 200ms ease',
                      }}
                    >
                      {/* Accent bar: forest for a question or section, gold for a title. */}
                      {selected && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-0 bottom-0"
                          style={{
                            width: '6px',
                            backgroundColor: block.kind === 'title' ? '#B6871F' : '#1B3828',
                            borderTopLeftRadius: block.kind === 'section' ? 0 : '12px',
                            borderBottomLeftRadius: '12px',
                          }}
                        />
                      )}

                      {/* Grip: the only drag origin, so text selection inside the
                          card's inputs is never mistaken for a drag. */}
                      {hoveredId === block.id && (
                        <span
                          onMouseDown={() => setDragArmedId(block.id)}
                          className="absolute flex items-center justify-center"
                          style={{ left: '50%', top: '2px', transform: 'translateX(-50%)', color: '#B8AC98', cursor: 'grab' }}
                        >
                          <GripHorizontal size={16} />
                        </span>
                      )}

                      <div style={{ padding: selected ? '18px 18px 0 22px' : '14px 14px 14px 16px' }}>
                        {!selected ? (
                          block.kind === 'question' ? (
                            <>
                              <p className="font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                {block.label || 'Untitled question'}
                              </p>
                              <div className="flex items-center gap-2 pb-1">
                                <Pill tone="neutral" size="sm">{QUESTION_TYPE_LABELS[block.type]}</Pill>
                                {block.required && <Pill tone="forest" size="sm">Required</Pill>}
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                {block.title || (block.kind === 'section' ? 'Untitled section' : 'Untitled title')}
                              </p>
                              {block.description && (
                                <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                  {block.description}
                                </p>
                              )}
                            </>
                          )
                        ) : block.kind === 'question' ? (
                          <>
                            <div className="flex items-start gap-3">
                              <input
                                type="text"
                                value={block.label}
                                onChange={(e) => patchBlock(block.id, { label: e.target.value })}
                                placeholder="Question"
                                className="text-sm font-semibold"
                                style={{
                                  ...softInput,
                                  flex: '0 1 60%',
                                  backgroundColor: 'rgba(27,56,40,0.04)',
                                  borderRadius: '8px 8px 0 0',
                                  padding: '10px 12px',
                                }}
                                onFocus={focusUnderline}
                                onBlur={blurUnderline}
                              />
                              <button
                                type="button"
                                onClick={(e) => setMenu({ kind: 'type', blockId: block.id, anchor: e.currentTarget })}
                                className="flex items-center gap-2 rounded-[10px] flex-shrink-0 focus:outline-none"
                                style={{
                                  marginLeft: 'auto',
                                  padding: '9px 12px',
                                  border: '1px solid #DDD4C0',
                                  backgroundColor: '#FAF8F3',
                                  color: '#1C1410',
                                  fontFamily: "'Outfit', sans-serif",
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <TypeIcon size={15} strokeWidth={2.1} style={{ color: '#1B3828' }} />
                                {QUESTION_TYPE_LABELS[block.type]}
                                <ChevronDown size={14} style={{ color: '#9A8A78' }} />
                              </button>
                            </div>

                            <AnswerPreview
                              block={block}
                              onPatch={(patch) => patchBlock(block.id, patch)}
                            />

                            {showHelp && (
                              <input
                                type="text"
                                value={block.help ?? ''}
                                onChange={(e) => patchBlock(block.id, { help: e.target.value.trim() ? e.target.value : undefined })}
                                placeholder="Description"
                                className="text-xs mt-3"
                                style={{ ...softInput, color: '#9A8A78' }}
                                onFocus={focusUnderline}
                                onBlur={blurUnderline}
                              />
                            )}
                            {showPlaceholder && (
                              <input
                                type="text"
                                value={block.placeholder ?? ''}
                                onChange={(e) => patchBlock(block.id, { placeholder: e.target.value.trim() ? e.target.value : undefined })}
                                placeholder="Placeholder"
                                className="text-xs mt-3"
                                style={{ ...softInput, color: '#9A8A78' }}
                                onFocus={focusUnderline}
                                onBlur={blurUnderline}
                              />
                            )}

                            {(needsLabel || needsOptions) && (
                              <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                                {needsLabel ? 'A question needs a label.' : 'At least 2 options are required.'}
                              </p>
                            )}
                            {hasApplications && reworded && (
                              <p className="flex items-start gap-1.5 text-xs mt-3 rounded-lg px-3 py-2" style={{ color: '#8A5A2C', backgroundColor: 'rgba(184,132,74,0.12)', fontFamily: "'Outfit', sans-serif" }}>
                                <Info size={12} className="flex-shrink-0 mt-0.5" />
                                Existing answers were given to the previous wording.
                              </p>
                            )}

                            <div className="flex items-center justify-end gap-1 mt-4 pt-2.5" style={{ borderTop: '1px solid #EDE7D9' }}>
                              <button
                                type="button"
                                aria-label="Duplicate question"
                                title="Duplicate"
                                onClick={() => handleDuplicate(idx)}
                                className="p-2 rounded-lg focus:outline-none"
                                style={{ background: 'none', border: 'none', color: '#9A8A78', cursor: 'pointer' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete question"
                                title="Delete"
                                onClick={() => handleDelete(block.id)}
                                className="p-2 rounded-lg focus:outline-none"
                                style={{ background: 'none', border: 'none', color: '#9A8A78', cursor: 'pointer' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                              >
                                <Trash2 size={16} />
                              </button>
                              <span aria-hidden style={{ width: '1px', height: '22px', backgroundColor: '#EDE7D9', margin: '0 6px' }} />
                              <span className="text-xs font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                Required
                              </span>
                              <PillToggle
                                value={block.required}
                                onChange={(v) => patchBlock(block.id, { required: v })}
                                size="sm"
                              />
                              <button
                                type="button"
                                aria-label="More options"
                                onClick={(e) => setMenu({ kind: 'more', blockId: block.id, anchor: e.currentTarget })}
                                className="p-2 rounded-lg focus:outline-none"
                                style={{ background: 'none', border: 'none', color: '#9A8A78', cursor: 'pointer', marginLeft: '2px' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="pb-4">
                            <input
                              type="text"
                              value={block.title}
                              onChange={(e) => patchBlock(block.id, { title: e.target.value })}
                              placeholder={block.kind === 'section' ? 'Section title' : 'Title'}
                              className="font-semibold"
                              style={{ ...softInput, fontSize: '18px' }}
                              onFocus={focusUnderline}
                              onBlur={blurUnderline}
                            />
                            <textarea
                              rows={2}
                              value={block.description ?? ''}
                              onChange={(e) => patchBlock(block.id, { description: e.target.value.trim() ? e.target.value : undefined })}
                              placeholder="Description"
                              className="text-sm mt-1"
                              style={{ ...softInput, color: '#9A8A78', resize: 'vertical' }}
                              onFocus={focusUnderline}
                              onBlur={blurUnderline}
                            />
                            <div className="flex items-center justify-end gap-1 mt-3 pt-2.5" style={{ borderTop: '1px solid #EDE7D9' }}>
                              <button
                                type="button"
                                aria-label="Duplicate block"
                                title="Duplicate"
                                onClick={() => handleDuplicate(idx)}
                                className="p-2 rounded-lg focus:outline-none"
                                style={{ background: 'none', border: 'none', color: '#9A8A78', cursor: 'pointer' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete block"
                                title="Delete"
                                onClick={() => handleDelete(block.id)}
                                className="p-2 rounded-lg focus:outline-none"
                                style={{ background: 'none', border: 'none', color: '#9A8A78', cursor: 'pointer' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Below md the rail lies down under the stack, labels showing. */}
          <div
            className="flex md:hidden items-center gap-1 mt-4 rounded-2xl"
            style={{ backgroundColor: '#FFFDF9', border: '1px solid #D8CDB6', boxShadow: '0 4px 14px rgba(27,56,40,0.10)', padding: '6px' }}
          >
            {RAIL_ACTIONS.map(a => (
              <RailButton key={a.key} icon={a.icon} label={a.label} horizontal onClick={() => addBlock(a.key)} />
            ))}
          </div>
        </div>

        {/* The rail tracks the selected card, so "add" always means "add here". */}
        <div className="hidden md:block relative flex-shrink-0" style={{ width: '48px' }}>
          <div
            className="flex flex-col rounded-2xl"
            style={{
              gap: '4px', padding: '6px',
              backgroundColor: '#FFFDF9',
              border: '1px solid #D8CDB6',
              boxShadow: '0 4px 14px rgba(27,56,40,0.10)',
              transform: `translateY(${railTop}px)`,
              transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {RAIL_ACTIONS.map(a => (
              <RailButton key={a.key} icon={a.icon} label={a.label} horizontal={false} onClick={() => addBlock(a.key)} />
            ))}
          </div>
        </div>
      </div>

      {archivedBlocks.length > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid #EDE7D9' }}>
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}>
            <Archive size={12} /> ARCHIVED QUESTIONS
          </p>
          <div className="flex flex-col gap-2">
            {archivedBlocks.map(block => (
              <ArchivedRow
                key={block.id}
                block={block}
                onRestore={() => handleRestore(block.id)}
                onDeleteForever={() => handlePermanentDelete(block.id)}
              />
            ))}
          </div>
        </div>
      )}

      {menu?.kind === 'type' && menuBlock?.kind === 'question' && (
        <AnchoredMenu anchor={menu.anchor} width={220} height={300} onClose={() => setMenu(null)}>
          {TYPE_GROUPS.map((group, gi) => (
            <div key={gi} style={gi > 0 ? { borderTop: '1px solid #EDE7D9', marginTop: '4px', paddingTop: '4px' } : undefined}>
              {group.map(t => {
                const Icon = TYPE_ICONS[t];
                return (
                  <MenuItem
                    key={t}
                    icon={<Icon size={15} strokeWidth={2.1} style={{ color: menuBlock.type === t ? '#1B3828' : '#9A8A78' }} />}
                    label={QUESTION_TYPE_LABELS[t]}
                    active={menuBlock.type === t}
                    onClick={() => handleTypeChange(menuBlock, t)}
                  />
                );
              })}
            </div>
          ))}
        </AnchoredMenu>
      )}

      {menu?.kind === 'more' && menuBlock?.kind === 'question' && (
        <AnchoredMenu anchor={menu.anchor} width={200} height={100} onClose={() => setMenu(null)}>
          <MenuItem
            label="Add description"
            onClick={() => {
              setExtras(prev => ({ ...prev, [menu.blockId]: { ...prev[menu.blockId], help: true } }));
              setMenu(null);
            }}
          />
          {supportsPlaceholder(menuBlock.type) && (
            <MenuItem
              label="Add placeholder"
              onClick={() => {
                setExtras(prev => ({ ...prev, [menu.blockId]: { ...prev[menu.blockId], placeholder: true } }));
                setMenu(null);
              }}
            />
          )}
        </AnchoredMenu>
      )}

      {confirmModal}
    </>
  );
}
