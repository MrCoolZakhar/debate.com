'use client';

import { useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Copy, GripVertical, Heading, Lock, Plus, Rows3, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { Pill } from '@/app/account/accountUi';
import {
  type CustomQuestion, type QuestionType, type FormBlock, type TitleBlock, type SectionBlock,
  isChoiceType, QUESTION_TYPE_LABELS,
} from '@/lib/customQuestions';

const QUESTION_TYPES: QuestionType[] = [
  'short_text', 'paragraph', 'dropdown', 'multiple_choice', 'checkboxes', 'number', 'date',
];

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: '10px', padding: '10px 14px', fontSize: '14px',
  border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410',
  fontFamily: "'Outfit', sans-serif",
};

function fgInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#1B3828';
}
function bgInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#DDD4C0';
}

// ── Question edit modal ──────────────────────────────────────────────────────

function QuestionEditModal({ existing, fieldsLocked, onSave, onClose }: {
  existing: CustomQuestion | null;
  fieldsLocked: boolean;
  onSave: (q: CustomQuestion) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? '');
  const [type, setType] = useState<QuestionType>(existing?.type ?? 'short_text');
  const [required, setRequired] = useState(existing?.required ?? false);
  const [options, setOptions] = useState<string[]>(existing?.options && existing.options.length > 0 ? existing.options : ['', '']);
  const [placeholder, setPlaceholder] = useState(existing?.placeholder ?? '');
  const [help, setHelp] = useState(existing?.help ?? '');

  const choice = isChoiceType(type);
  const showPlaceholder = type === 'short_text' || type === 'paragraph' || type === 'number';
  const validOptions = options.map(o => o.trim()).filter(Boolean);
  const canSave = fieldsLocked || (label.trim().length > 0 && (!choice || validOptions.length >= 2));

  function moveOption(idx: number, dir: -1 | 1) {
    if (fieldsLocked) return;
    setOptions(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleSave() {
    if (fieldsLocked && existing) {
      onSave({ ...existing, help: help.trim() ? help.trim() : undefined });
      return;
    }
    if (!canSave) return;
    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      label: label.trim(),
      type,
      required,
      options: choice ? validOptions : [],
      placeholder: showPlaceholder && placeholder.trim() ? placeholder.trim() : undefined,
      help: help.trim() ? help.trim() : undefined,
    });
  }

  const lockedFieldStyle: React.CSSProperties = fieldsLocked
    ? { ...inputStyle, backgroundColor: '#F0EDE6', color: '#9A8A78', cursor: 'not-allowed' }
    : inputStyle;

  return (
    <Portal><div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 my-auto"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-black text-lg mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          {existing ? 'Edit Question' : 'Add Question'}
        </h2>
        {fieldsLocked && (
          <p className="flex items-center gap-1.5 text-xs mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            <Lock size={11} /> Locked — only help text can be changed for a question with submitted answers.
          </p>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Question Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Why do you want to attend this conference?"
            style={lockedFieldStyle}
            disabled={fieldsLocked}
            onFocus={fgInput}
            onBlur={bgInput}
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Type
          </label>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { if (!fieldsLocked) setType(t); }}
                disabled={fieldsLocked}
                className="py-2 px-3 rounded-[10px] font-bold text-xs focus:outline-none transition-all"
                style={{
                  backgroundColor: type === t ? (fieldsLocked ? '#DDD4C0' : '#1B3828') : 'transparent',
                  color: type === t ? (fieldsLocked ? '#9A8A78' : '#EED98A') : (fieldsLocked ? '#B8AC98' : '#1C1410'),
                  border: type === t ? `1.5px solid ${fieldsLocked ? '#DDD4C0' : '#1B3828'}` : '1.5px solid #DDD4C0',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.04em',
                  cursor: fieldsLocked ? 'not-allowed' : 'pointer',
                }}
              >
                {QUESTION_TYPE_LABELS[t].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {choice && (
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Options
            </label>
            <div className="flex flex-col gap-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setOptions(prev => prev.map((o, i) => (i === idx ? e.target.value : o)))}
                    placeholder={`Option ${idx + 1}`}
                    style={{ ...lockedFieldStyle, flex: 1 }}
                    disabled={fieldsLocked}
                    onFocus={fgInput}
                    onBlur={bgInput}
                  />
                  <button
                    type="button"
                    onClick={() => moveOption(idx, -1)}
                    disabled={fieldsLocked || idx === 0}
                    className="p-1.5 rounded-lg focus:outline-none"
                    style={{ color: fieldsLocked || idx === 0 ? '#DDD4C0' : '#1C1410', cursor: fieldsLocked || idx === 0 ? 'default' : 'pointer' }}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveOption(idx, 1)}
                    disabled={fieldsLocked || idx === options.length - 1}
                    className="p-1.5 rounded-lg focus:outline-none"
                    style={{ color: fieldsLocked || idx === options.length - 1 ? '#DDD4C0' : '#1C1410', cursor: fieldsLocked || idx === options.length - 1 ? 'default' : 'pointer' }}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptions(prev => prev.filter((_, i) => i !== idx))}
                    disabled={fieldsLocked || options.length <= 2}
                    className="p-1.5 rounded-lg focus:outline-none"
                    style={{ color: fieldsLocked || options.length <= 2 ? '#DDD4C0' : '#8B2020', cursor: fieldsLocked || options.length <= 2 ? 'default' : 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { if (!fieldsLocked) setOptions(prev => [...prev, '']); }}
              disabled={fieldsLocked}
              className="mt-2 flex items-center gap-1 text-xs font-semibold focus:outline-none hover:underline"
              style={{ color: fieldsLocked ? '#B8AC98' : '#1B3828', fontFamily: "'Outfit', sans-serif", cursor: fieldsLocked ? 'not-allowed' : 'pointer' }}
            >
              <Plus size={12} /> ADD OPTION
            </button>
            {!fieldsLocked && validOptions.length < 2 && (
              <p className="text-xs mt-1.5" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                At least 2 options are required.
              </p>
            )}
          </div>
        )}

        {showPlaceholder && (
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Placeholder (optional)
            </label>
            <input
              type="text"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              style={lockedFieldStyle}
              disabled={fieldsLocked}
              onFocus={fgInput}
              onBlur={bgInput}
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Help text (optional)
          </label>
          <input
            type="text"
            value={help}
            onChange={(e) => setHelp(e.target.value)}
            placeholder="Shown in small text below the question"
            style={inputStyle}
            onFocus={fgInput}
            onBlur={bgInput}
          />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <input
            type="checkbox"
            id="qb-required"
            checked={required}
            onChange={(e) => { if (!fieldsLocked) setRequired(e.target.checked); }}
            disabled={fieldsLocked}
            className="w-4 h-4 cursor-pointer"
            style={{ accentColor: '#1B3828' }}
          />
          <label htmlFor="qb-required" className="text-sm font-medium cursor-pointer" style={{ color: fieldsLocked ? '#9A8A78' : '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Required question
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: canSave ? '#1B3828' : '#DDD4C0',
              color: canSave ? '#EED98A' : '#9A8A78',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.06em',
            }}
          >
            {existing ? 'SAVE' : 'ADD QUESTION'}
          </button>
        </div>
      </div>
    </div></Portal>
  );
}

// ── Title / Section edit modal ───────────────────────────────────────────────
// Small shared editor for the two non-input block kinds. A Section additionally
// marks a page break once pagination lands; for now it just renders as a
// divider (see CustomQuestionsField).

function BlockTextEditModal({ kind, existing, onSave, onClose }: {
  kind: 'title' | 'section';
  existing: TitleBlock | SectionBlock | null;
  onSave: (block: TitleBlock | SectionBlock) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const canSave = title.trim().length > 0;
  const heading = kind === 'section' ? (existing ? 'Edit Section' : 'Add Section') : (existing ? 'Edit Title & Description' : 'Add Title & Description');

  function handleSave() {
    if (!canSave) return;
    onSave({
      kind,
      id: existing?.id ?? crypto.randomUUID(),
      title: title.trim(),
      description: description.trim() || undefined,
    });
  }

  return (
    <Portal><div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 my-auto"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-black text-lg mb-5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          {heading}
        </h2>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            {kind === 'section' ? 'Section title' : 'Title'}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'section' ? 'e.g. Delegation Details' : 'e.g. Before You Apply'}
            style={inputStyle}
            onFocus={fgInput}
            onBlur={bgInput}
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Description (optional)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
            onFocus={fgInput}
            onBlur={bgInput}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: canSave ? '#1B3828' : '#DDD4C0',
              color: canSave ? '#EED98A' : '#9A8A78',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.06em',
            }}
          >
            {existing ? 'SAVE' : 'ADD'}
          </button>
        </div>
      </div>
    </div></Portal>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────

const ACCENT: Record<FormBlock['kind'], string | null> = {
  question: null,
  title: '#B6871F',
  section: '#1B3828',
};

function BlockCard({ block, locked, onEdit, onDuplicate, onDelete }: {
  block: FormBlock;
  locked: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const accent = ACCENT[block.kind];
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.1)' }}
    >
      {accent && <div style={{ height: 4, backgroundColor: accent }} />}
      <div className="p-4 flex items-start gap-2.5">
        <GripVertical size={15} className="mt-0.5 flex-shrink-0" style={{ color: locked ? '#DDD4C0' : '#B8AC98', cursor: locked ? 'not-allowed' : 'grab' }} />
        <div className="flex-1 min-w-0">
          {block.kind === 'question' ? (
            <>
              <p className="font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {block.label || 'Untitled question'}
              </p>
              <div className="flex items-center gap-2 mb-2">
                <Pill tone="neutral" size="sm">{QUESTION_TYPE_LABELS[block.type]}</Pill>
                {block.required && <Pill tone="forest" size="sm">Required</Pill>}
                {locked && (
                  <Pill tone="neutral" size="sm" icon={<Lock size={9} />}>Locked</Pill>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Pill tone={block.kind === 'section' ? 'forest' : 'gold'} size="sm">
                  {block.kind === 'section' ? 'SECTION' : 'TITLE'}
                </Pill>
              </div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {block.title || (block.kind === 'section' ? 'Untitled section' : 'Untitled title')}
              </p>
              {block.description && (
                <p className="text-xs mb-1.5 whitespace-pre-wrap" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  {block.description}
                </p>
              )}
            </>
          )}
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={onEdit}
              className="text-xs font-semibold focus:outline-none hover:underline"
              style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
            >
              EDIT
            </button>
            <button
              onClick={onDuplicate}
              className="flex items-center gap-1 text-xs font-semibold focus:outline-none hover:underline"
              style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
            >
              <Copy size={11} /> DUPLICATE
            </button>
            {!locked && (
              <button
                onClick={onDelete}
                className="text-xs font-semibold focus:outline-none hover:underline"
                style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}
              >
                DELETE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Builder ───────────────────────────────────────────────────────────────────

type ModalState =
  | { kind: 'question'; existing: CustomQuestion | null }
  | { kind: 'title'; existing: TitleBlock | null }
  | { kind: 'section'; existing: SectionBlock | null }
  | null;

export default function QuestionBuilder({ value, onChange, locked = false }: {
  value: FormBlock[];
  onChange: (next: FormBlock[]) => void;
  /** True once the role has submitted applications — existing questions can no
   *  longer be deleted or reordered (protects already-collected answers), but
   *  new questions/titles/sections may still be added and help text edited. */
  locked?: boolean;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const isLocked = (block: FormBlock) => locked && block.kind === 'question';

  function handleSaveQuestion(q: CustomQuestion) {
    const block: FormBlock = { ...q, kind: 'question' };
    const exists = value.some(b => b.id === block.id);
    onChange(exists ? value.map(b => (b.id === block.id ? block : b)) : [...value, block]);
    setModal(null);
  }

  function handleSaveTextBlock(block: TitleBlock | SectionBlock) {
    const exists = value.some(b => b.id === block.id);
    onChange(exists ? value.map(b => (b.id === block.id ? block : b)) : [...value, block]);
    setModal(null);
  }

  function handleEdit(block: FormBlock) {
    if (block.kind === 'question') setModal({ kind: 'question', existing: block });
    else if (block.kind === 'title') setModal({ kind: 'title', existing: block });
    else setModal({ kind: 'section', existing: block });
  }

  function handleDuplicate(idx: number) {
    const clone: FormBlock = { ...value[idx], id: crypto.randomUUID() };
    const next = [...value];
    next.splice(idx + 1, 0, clone);
    onChange(next);
  }

  function handleDelete(id: string) {
    const block = value.find(b => b.id === id);
    if (block && isLocked(block)) return;
    onChange(value.filter(b => b.id !== id));
  }

  function handleDrop(dropIdx: number) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    if (from === null || from === dropIdx) return;
    if (isLocked(value[from])) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(from < dropIdx ? dropIdx - 1 : dropIdx, 0, moved);
    onChange(next);
  }

  return (
    <>
      <div className="flex flex-col gap-3 mb-4">
        {value.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            No questions yet.
          </p>
        ) : (
          value.map((block, idx) => {
            const blockLocked = isLocked(block);
            return (
              <div key={block.id}>
                {dragOverIndex === idx && dragOverIndex !== dragIndexRef.current && (
                  <div className="h-0.5 rounded-full mx-2 mb-2" style={{ backgroundColor: '#1B3828' }} />
                )}
                <div
                  draggable={!blockLocked}
                  onDragStart={() => { if (!blockLocked) dragIndexRef.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                >
                  <BlockCard
                    block={block}
                    locked={blockLocked}
                    onEdit={() => handleEdit(block)}
                    onDuplicate={() => handleDuplicate(idx)}
                    onDelete={() => handleDelete(block.id)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setModal({ kind: 'question', existing: null })}
          className="flex items-center gap-1.5 rounded-xl py-2.5 px-4 text-sm font-semibold focus:outline-none transition-all"
          style={{ border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent', color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
        >
          <Plus size={14} /> QUESTION
        </button>
        <button
          onClick={() => setModal({ kind: 'title', existing: null })}
          className="flex items-center gap-1.5 rounded-xl py-2.5 px-4 text-sm font-semibold focus:outline-none transition-all"
          style={{ border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent', color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
        >
          <Heading size={14} /> TITLE &amp; DESCRIPTION
        </button>
        <button
          onClick={() => setModal({ kind: 'section', existing: null })}
          className="flex items-center gap-1.5 rounded-xl py-2.5 px-4 text-sm font-semibold focus:outline-none transition-all"
          style={{ border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent', color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
        >
          <Rows3 size={14} /> SECTION
        </button>
      </div>

      {modal?.kind === 'question' && (
        <QuestionEditModal
          existing={modal.existing}
          fieldsLocked={locked && modal.existing !== null}
          onSave={handleSaveQuestion}
          onClose={() => setModal(null)}
        />
      )}
      {(modal?.kind === 'title' || modal?.kind === 'section') && (
        <BlockTextEditModal
          kind={modal.kind}
          existing={modal.existing}
          onSave={handleSaveTextBlock}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
