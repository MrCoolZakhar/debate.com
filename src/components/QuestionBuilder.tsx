'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Plus, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { Pill } from '@/app/account/accountUi';
import {
  type CustomQuestion, type QuestionType, isChoiceType, QUESTION_TYPE_LABELS,
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

function QuestionEditModal({ existing, onSave, onClose }: {
  existing: CustomQuestion | null;
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
  const canSave = label.trim().length > 0 && (!choice || validOptions.length >= 2);

  function moveOption(idx: number, dir: -1 | 1) {
    setOptions(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleSave() {
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
          {existing ? 'Edit Question' : 'Add Question'}
        </h2>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Question Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Why do you want to attend this conference?"
            style={inputStyle}
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
                onClick={() => setType(t)}
                className="py-2 px-3 rounded-[10px] font-bold text-xs focus:outline-none transition-all"
                style={{
                  backgroundColor: type === t ? '#1B3828' : 'transparent',
                  color: type === t ? '#EED98A' : '#1C1410',
                  border: type === t ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.04em',
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
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={fgInput}
                    onBlur={bgInput}
                  />
                  <button
                    type="button"
                    onClick={() => moveOption(idx, -1)}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg focus:outline-none"
                    style={{ color: idx === 0 ? '#DDD4C0' : '#1C1410', cursor: idx === 0 ? 'default' : 'pointer' }}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveOption(idx, 1)}
                    disabled={idx === options.length - 1}
                    className="p-1.5 rounded-lg focus:outline-none"
                    style={{ color: idx === options.length - 1 ? '#DDD4C0' : '#1C1410', cursor: idx === options.length - 1 ? 'default' : 'pointer' }}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptions(prev => prev.filter((_, i) => i !== idx))}
                    disabled={options.length <= 2}
                    className="p-1.5 rounded-lg focus:outline-none"
                    style={{ color: options.length <= 2 ? '#DDD4C0' : '#8B2020', cursor: options.length <= 2 ? 'default' : 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOptions(prev => [...prev, ''])}
              className="mt-2 flex items-center gap-1 text-xs font-semibold focus:outline-none hover:underline"
              style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
            >
              <Plus size={12} /> ADD OPTION
            </button>
            {validOptions.length < 2 && (
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
              style={inputStyle}
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
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
            style={{ accentColor: '#1B3828' }}
          />
          <label htmlFor="qb-required" className="text-sm font-medium cursor-pointer" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
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

export default function QuestionBuilder({ questions, onChange }: {
  questions: CustomQuestion[];
  onChange: (next: CustomQuestion[]) => void;
}) {
  const [modal, setModal] = useState<{ open: boolean; existing: CustomQuestion | null }>({ open: false, existing: null });

  function moveQuestion(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  function handleSave(q: CustomQuestion) {
    const next = modal.existing
      ? questions.map(eq => (eq.id === q.id ? q : eq))
      : [...questions, q];
    onChange(next);
    setModal({ open: false, existing: null });
  }

  function handleDelete(id: string) {
    onChange(questions.filter(q => q.id !== id));
  }

  return (
    <>
      <div className="flex flex-col gap-3 mb-4">
        {questions.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            No questions yet.
          </p>
        ) : (
          questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-xl p-4"
              style={{ backgroundColor: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.1)' }}
            >
              <p className="font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {q.label}
              </p>
              <div className="flex items-center gap-2 mb-2">
                <Pill tone="neutral" size="sm">{QUESTION_TYPE_LABELS[q.type]}</Pill>
                {q.required && <Pill tone="forest" size="sm">Required</Pill>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => moveQuestion(idx, -1)}
                  disabled={idx === 0}
                  className="text-xs font-semibold focus:outline-none"
                  style={{ color: idx === 0 ? '#DDD4C0' : '#1C1410', fontFamily: "'Outfit', sans-serif", cursor: idx === 0 ? 'default' : 'pointer' }}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => moveQuestion(idx, 1)}
                  disabled={idx === questions.length - 1}
                  className="text-xs font-semibold focus:outline-none"
                  style={{ color: idx === questions.length - 1 ? '#DDD4C0' : '#1C1410', fontFamily: "'Outfit', sans-serif", cursor: idx === questions.length - 1 ? 'default' : 'pointer' }}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => setModal({ open: true, existing: q })}
                  className="text-xs font-semibold focus:outline-none hover:underline"
                  style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
                >
                  EDIT
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="text-xs font-semibold focus:outline-none hover:underline"
                  style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}
                >
                  DELETE
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => setModal({ open: true, existing: null })}
        className="w-full rounded-xl py-2.5 text-sm font-semibold focus:outline-none transition-all"
        style={{ border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent', color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
      >
        + ADD QUESTION
      </button>

      {modal.open && (
        <QuestionEditModal
          existing={modal.existing}
          onSave={handleSave}
          onClose={() => setModal({ open: false, existing: null })}
        />
      )}
    </>
  );
}
