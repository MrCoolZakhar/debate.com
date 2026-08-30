'use client';

/**
 * ApplicationQuestionCard — the applicant-facing rendering of ONE custom
 * question in the full-page conference apply wizard.
 *
 * This is a deliberate FORK of CustomQuestionsField, not a restyle of it.
 * CustomQuestionsField is mounted by AidRequestModal, PledgeInvoicingCard and
 * AidFormEditor — compact/modal surfaces owned by the conferences workstream
 * where a 340px essay card would be flatly wrong. That component keeps the
 * tight inline look (with the 16px / 3:1 correctness floor applied); this one
 * carries the full stage treatment.
 *
 * House rules honoured here:
 *  - every real text input is >= 16px, so iOS Safari never auto-zooms on focus
 *  - control boundaries clear 3:1 (WCAG 1.4.11); helper copy clears 4.5:1
 *  - choice rows are >= 52px tall (WCAG 2.5.5 / Apple HIG want 44px)
 *  - NO native <select> anywhere: <= 6 options become tap rows, more than that
 *    becomes a Portal listbox at fixed viewport coords (never clipped, flips
 *    up near the bottom edge, clamped at the right edge)
 *  - NO maxLength on an essay, ever. Word targets are advice, never a cap.
 *  - absent help text reserves NO vertical space — 210 of 211 live blocks have
 *    no placeholder and 200 have no help, so the bare label + well IS the
 *    common case and has to look deliberate on its own.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, AlertCircle, Minus, Plus } from 'lucide-react';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import Portal from '@/components/Portal';
import { DatePicker } from '@/components/DatePicker';
import { type CustomQuestion, type CustomAnswerValue } from '@/lib/customQuestions';
import { wordCount, parseWordTarget } from '@/lib/applyQuestionPages';

// ── Contrast-checked tokens ────────────────────────────────────────────────
// BOUNDARY: 3.21:1 on the #EDE7D8 page, 3.33:1 on the #F0EBDD card surface.
const BOUNDARY = '#8C7E68';
const BOUNDARY_FOCUS = NEU.forest;      // 10.36:1 on the page
const DANGER = '#8B2020';               // 7.32:1 on the page
// HELP: NEU.inkSoft is the house readable-secondary ink — 6.44:1 on the page,
// 6.67:1 on the card surface. NEU.muted (#9A8A78) is 2.71:1 and must never
// carry a real sentence.
const HELP_INK = NEU.inkSoft;
const ESSAY_MIN_H = 168;

/** DOM id of a question's CARD. The missing-answer jump targets this, never
 *  `q-${id}`: three of the seven types (date, and the choice types rendered as
 *  tap rows) have no single element carrying that id, so scrolling to the
 *  control silently no-ops for them. The card always exists. */
export function questionCardId(questionId: string): string {
  return `qcard-${questionId}`;
}

/** Scroll a question's card into view and put focus on its first control, so
 *  the applicant lands ON the field and can start typing. Falls back to
 *  focusing the card itself (it is tabIndex={-1}) when there is no control —
 *  which is why the card, not the input, is the anchor. */
export function focusQuestion(questionId: string): void {
  const card = document.getElementById(questionCardId(questionId));
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const control = card.querySelector<HTMLElement>('textarea, input, [role="combobox"], [role="radio"], [role="checkbox"]');
  (control ?? card).focus({ preventScroll: true });
}

/** Per-type message. "This question is required." for all seven types told the
 *  applicant nothing about what to actually do. */
function errorMessage(q: CustomQuestion): string {
  switch (q.type) {
    case 'paragraph': return 'Please answer this one — a few sentences is enough.';
    case 'number': return 'Please enter a number.';
    case 'date': return 'Please pick a date.';
    case 'checkboxes': return 'Please pick at least one.';
    case 'multiple_choice':
    case 'dropdown': return 'Please choose one.';
    default: return 'Please fill this in.';
  }
}

function answered(v: CustomAnswerValue | undefined): boolean {
  if (v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  return v.trim() !== '';
}

// ── The gold numeral that becomes a forest tick ────────────────────────────
// Reuses the GoldCheck motion vocabulary from wizard.tsx so a finished
// question reads with the same language as a selected option card. Scanning
// the column of discs is how the applicant sees what is left.
function QuestionNumeral({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: 26, height: 26, borderRadius: 999,
        background: done
          ? `linear-gradient(135deg, ${NEU.green}, ${NEU.forest})`
          : `linear-gradient(135deg, ${NEU.gold}, ${NEU.deepGold})`,
        boxShadow: done ? `0 2px 7px ${NEU.forest}44` : `0 2px 7px ${NEU.deepGold}55`,
        transition: `background 320ms ${EASE}, box-shadow 320ms ${EASE}`,
      }}
    >
      <span
        style={{
          position: 'absolute', fontFamily: OUTFIT, fontWeight: 900, fontSize: 12,
          color: NEU.forest, fontVariantNumeric: 'tabular-nums',
          opacity: done ? 0 : 1,
          transform: done ? 'scale(0.25)' : 'scale(1)',
          filter: done ? 'blur(4px)' : 'blur(0px)',
          transition: `opacity 260ms ${EASE}, transform 260ms ${EASE}, filter 260ms ${EASE}`,
        }}
      >
        {n}
      </span>
      <span
        className="absolute inline-flex"
        style={{
          opacity: done ? 1 : 0,
          transform: done ? 'scale(1)' : 'scale(0.25)',
          filter: done ? 'blur(0px)' : 'blur(4px)',
          transition: `opacity 260ms ${EASE}, transform 260ms ${EASE}, filter 260ms ${EASE}`,
        }}
      >
        <Check size={14} strokeWidth={3.2} style={{ color: NEU.gold }} />
      </span>
    </span>
  );
}

function StatusPill({ required }: { required: boolean }) {
  return (
    <span
      style={{
        fontFamily: OUTFIT, fontWeight: 800, fontSize: 9.5, letterSpacing: '0.11em',
        padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
        color: required ? DANGER : HELP_INK,
        backgroundColor: required ? 'rgba(139,32,32,0.09)' : 'rgba(27,56,40,0.07)',
      }}
    >
      {required ? 'REQUIRED' : 'OPTIONAL'}
    </span>
  );
}

// ── The pressed-in well every input sits in ────────────────────────────────
function wellStyle(focused: boolean, error: boolean): React.CSSProperties {
  return {
    width: '100%',
    backgroundColor: error ? 'rgba(139,32,32,0.035)' : NEU.base,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: error ? DANGER : focused ? BOUNDARY_FOCUS : BOUNDARY,
    boxShadow: focused ? `${NEU.in}, 0 0 0 3px rgba(27,56,40,0.13)` : NEU.in,
    transition: `border-color 200ms ${EASE}, box-shadow 220ms ${EASE}, background-color 220ms ${EASE}`,
  };
}

const bareInput: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none', outline: 'none',
  fontFamily: OUTFIT, fontSize: 16, color: NEU.ink,
};

// ── Empty-essay watermark. Inline SVG, no asset, fades on first keystroke. ──
function QuillMark({ visible }: { visible: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      style={{
        position: 'absolute', right: 18, bottom: 14, width: 74, height: 74,
        color: NEU.forest, opacity: visible ? 0.055 : 0, pointerEvents: 'none',
        transition: `opacity 320ms ${EASE}`,
      }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 54c0-16 8-30 20-38 6-4 14-6 22-6 0 10-2 18-6 24-8 12-22 20-36 20Z" />
        <path d="M10 54c8-8 18-16 30-22" />
        <path d="M6 58h30" />
      </g>
    </svg>
  );
}

// ── Essay field ────────────────────────────────────────────────────────────
function EssayField({
  q, value, onChange, hasError, describedBy,
}: {
  q: CustomQuestion; value: string; onChange: (v: string) => void;
  hasError: boolean; describedBy?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [cap, setCap] = useState(420);

  useEffect(() => {
    const recap = () => setCap(Math.round(Math.min(560, Math.max(280, window.innerHeight * 0.5))));
    recap();
    window.addEventListener('resize', recap);
    return () => window.removeEventListener('resize', recap);
  }, []);

  // Autogrow: the box follows the answer until it hits the viewport-derived
  // cap, then scrolls internally with a visible fade so it is obvious there
  // is more text below. rows={4} meant a 300-word essay showed 4 of ~25 lines.
  const grow = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.max(ESSAY_MIN_H, Math.min(el.scrollHeight, cap));
    el.style.height = `${next}px`;
    setOverflowing(el.scrollHeight - next > 1);
  }, [cap]);

  useLayoutEffect(() => { grow(); }, [grow, value]);

  const words = wordCount(value);
  const target = parseWordTarget(q.help);
  const onTarget = target ? words >= target.min : words >= 40;

  return (
    <div>
      <div className="relative" style={wellStyle(focused, hasError)}>
        <QuillMark visible={words === 0} />
        <textarea
          ref={ref}
          id={`q-${q.id}`}
          aria-describedby={describedBy}
          aria-invalid={hasError || undefined}
          aria-required={q.required || undefined}
          value={value}
          placeholder={q.placeholder ?? 'Write your answer here'}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          style={{
            ...bareInput,
            display: 'block',
            minHeight: ESSAY_MIN_H,
            maxHeight: cap,
            padding: '16px 18px',
            lineHeight: 1.65,
            letterSpacing: '0.005em',
            resize: 'none',
            overflowY: 'auto',
          }}
        />
        {overflowing && (
          <span
            aria-hidden
            style={{
              position: 'absolute', left: 2, right: 2, bottom: 2, height: 26, borderRadius: '0 0 12px 12px',
              background: `linear-gradient(to top, ${NEU.base}, rgba(237,231,216,0))`,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      <div className="flex items-center justify-end gap-1.5" style={{ marginTop: 7, minHeight: 16 }}>
        {target && (
          <span style={{ fontFamily: OUTFIT, fontSize: 12, color: HELP_INK, marginRight: 'auto' }}>
            aim for {target.min === target.max ? target.max : `${target.min}–${target.max}`} words
          </span>
        )}
        <span
          style={{
            fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
            color: onTarget && words > 0 ? NEU.green : HELP_INK,
            transition: `color 260ms ${EASE}`,
          }}
        >
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        <Check
          size={13}
          strokeWidth={3}
          aria-hidden
          style={{
            color: NEU.green,
            opacity: onTarget && words > 0 ? 1 : 0,
            transform: onTarget && words > 0 ? 'scale(1)' : 'scale(0.4)',
            transition: `opacity 240ms ${EASE}, transform 240ms ${EASE}`,
          }}
        />
      </div>
    </div>
  );
}

// ── Short text ─────────────────────────────────────────────────────────────
function ShortField({
  q, value, onChange, hasError, describedBy,
}: {
  q: CustomQuestion; value: string; onChange: (v: string) => void;
  hasError: boolean; describedBy?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={wellStyle(focused, hasError)}>
      <input
        id={`q-${q.id}`}
        type="text"
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
        aria-required={q.required || undefined}
        value={value}
        placeholder={q.placeholder ?? 'Type your answer'}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...bareInput, height: 50, padding: '0 18px' }}
      />
    </div>
  );
}

// ── Number ─────────────────────────────────────────────────────────────────
// type="text" + inputMode="numeric" on purpose: type="number" ships desktop
// spinners AND silently rewrites the answer when the wheel scrolls over a
// focused field. A stepper is offered only for genuine count questions.
function NumberField({
  q, value, onChange, hasError, describedBy,
}: {
  q: CustomQuestion; value: string; onChange: (v: string) => void;
  hasError: boolean; describedBy?: string;
}) {
  const [focused, setFocused] = useState(false);
  const isCount = /^\s*how many\b|\bnumber of\b/i.test(q.label);
  const n = Number.parseInt(value, 10);
  const bump = (d: number) => onChange(String(Math.max(0, (Number.isFinite(n) ? n : 0) + d)));

  return (
    <div className="flex items-center gap-2.5">
      {isCount && <StepButton icon={<Minus size={16} strokeWidth={2.8} />} label="Decrease" onClick={() => bump(-1)} />}
      <div className="flex-1" style={wellStyle(focused, hasError)}>
        <input
          id={`q-${q.id}`}
          type="text"
          inputMode="numeric"
          aria-describedby={describedBy}
          aria-invalid={hasError || undefined}
          aria-required={q.required || undefined}
          value={value}
          placeholder={q.placeholder ?? '0'}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...bareInput, height: 50, padding: '0 18px',
            textAlign: isCount ? 'center' : 'left', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
          }}
        />
      </div>
      {isCount && <StepButton icon={<Plus size={16} strokeWidth={2.8} />} label="Increase" onClick={() => bump(1)} />}
    </div>
  );
}

function StepButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center justify-center flex-shrink-0 focus:outline-none"
      style={{
        width: 48, height: 48, borderRadius: 999, border: 'none',
        backgroundColor: NEU.surface, color: NEU.forest, cursor: 'pointer',
        boxShadow: hover ? NEU.outSmHover : NEU.outSm,
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: `box-shadow 200ms ${EASE}, transform 200ms ${EASE}`,
      }}
    >
      {icon}
    </button>
  );
}

// ── Choice rows (radio / checkbox / small dropdown) ────────────────────────
function OptionRows({
  q, options, selected, onPick, multiple, hasError, describedBy, labelledBy,
}: {
  q: CustomQuestion; options: string[]; selected: string[];
  onPick: (opt: string) => void; multiple: boolean; hasError: boolean;
  describedBy?: string;
  /** id of the visible question label — the group is named by it, so screen
   *  readers announce the question and not just the option. */
  labelledBy?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [press, setPress] = useState<string | null>(null);
  // Two-up only when every option is short enough to stay on one line.
  const twoUp = options.length >= 3 && options.every(o => o.length <= 18);

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }} aria-describedby={describedBy}>
      <legend className="sr-only">{q.label}</legend>
      {multiple && selected.length > 0 && (
        <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.11em', color: NEU.deepGold, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
          {selected.length} SELECTED
        </p>
      )}
      <div
        role={multiple ? 'group' : 'radiogroup'}
        aria-labelledby={labelledBy}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: twoUp ? 'repeat(auto-fit, minmax(150px, 1fr))' : '1fr' }}
      >
        {options.map(opt => {
          const on = selected.includes(opt);
          const hov = hover === opt;
          const prs = press === opt;
          return (
            <button
              key={opt}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => onPick(opt)}
              onMouseEnter={() => setHover(opt)}
              onMouseLeave={() => { setHover(null); setPress(null); }}
              onPointerDown={() => setPress(opt)}
              onPointerUp={() => setPress(null)}
              className="relative flex items-center gap-3 text-left focus-visible:outline-none"
              style={{
                minHeight: 52, padding: '10px 44px 10px 14px', borderRadius: 14,
                backgroundColor: on ? NEU.surface : NEU.base,
                borderWidth: on ? 2 : 1.5,
                borderStyle: 'solid',
                borderColor: on ? NEU.forest : hasError ? DANGER : BOUNDARY,
                boxShadow: on ? NEU.out : hov ? NEU.outSm : 'none',
                transform: prs ? 'scale(0.98)' : hov && !on ? 'translateY(-1px)' : 'translateY(0)',
                transition: `box-shadow 240ms ${EASE}, transform 180ms ${EASE}, border-color 240ms ${EASE}, background-color 240ms ${EASE}`,
                cursor: 'pointer', fontFamily: OUTFIT,
              }}
            >
              <span
                aria-hidden
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 20, height: 20, borderRadius: multiple ? 7 : 999,
                  border: `2px solid ${on ? NEU.forest : BOUNDARY}`,
                  backgroundColor: on ? NEU.forest : 'transparent',
                  transition: `background-color 200ms ${EASE}, border-color 200ms ${EASE}`,
                }}
              >
                <Check size={12} strokeWidth={3.4} style={{ color: NEU.gold, opacity: on ? 1 : 0, transition: `opacity 200ms ${EASE}` }} />
              </span>
              <span style={{ fontSize: 15, fontWeight: on ? 700 : 500, color: on ? NEU.forest : NEU.ink, lineHeight: 1.35 }}>
                {opt}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── Portal listbox (dropdowns with more options than fit as rows) ──────────
// Fixed viewport coords from the trigger rect, repositioned on scroll (capture)
// and resize, flipped upward with no room below, clamped at the right edge —
// the PaymentMenu pattern the UI rules mandate. Never a native <select>.
function PortalSelect({
  q, options, value, onChange, hasError, describedBy,
}: {
  q: CustomQuestion; options: string[]; value: string;
  onChange: (v: string) => void; hasError: boolean; describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const width = Math.max(200, r.width);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const flip = below < 200 && above > below;
    setPos({
      top: flip ? Math.max(8, r.top - Math.min(above, 300) - 8) : r.bottom + 8,
      left: Math.min(Math.max(8, r.left), window.innerWidth - width - 8),
      width,
      maxHeight: Math.min(300, flip ? above : below),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        id={`q-${q.id}`}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between text-left focus:outline-none"
        style={{
          ...wellStyle(open, hasError), height: 52, padding: '0 16px 0 18px',
          fontFamily: OUTFIT, fontSize: 16, color: value ? NEU.ink : HELP_INK, cursor: 'pointer',
        }}
      >
        <span className="truncate">{value || q.placeholder || 'Choose an option'}</span>
        <ChevronDown
          size={18}
          strokeWidth={2.4}
          style={{ color: NEU.forest, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: `transform 220ms ${EASE}` }}
        />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={panelRef}
            role="listbox"
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight,
              overflowY: 'auto', zIndex: 9999, padding: 6, borderRadius: 16,
              backgroundColor: NEU.surface, border: `1px solid ${BOUNDARY}`,
              boxShadow: '0 16px 44px rgba(27,56,40,0.24)',
            }}
          >
            {options.map(opt => {
              const on = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className="w-full flex items-center justify-between text-left focus:outline-none"
                  style={{
                    minHeight: 46, padding: '8px 12px', borderRadius: 11, border: 'none',
                    backgroundColor: on ? 'rgba(27,56,40,0.09)' : 'transparent',
                    fontFamily: OUTFIT, fontSize: 15, fontWeight: on ? 700 : 500,
                    color: on ? NEU.forest : NEU.ink, cursor: 'pointer',
                  }}
                >
                  <span>{opt}</span>
                  {on && <Check size={15} strokeWidth={3} style={{ color: NEU.forest }} />}
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </>
  );
}

// ── The card ───────────────────────────────────────────────────────────────
export default function ApplicationQuestionCard({
  question: q, index, value, onChange, hasError, solo = false, compact = false,
}: {
  question: CustomQuestion;
  /** 1-based position within the current page. */
  index: number;
  value: CustomAnswerValue | undefined;
  onChange: (v: CustomAnswerValue) => void;
  hasError: boolean;
  /** This card is the only question on its page (an essay stage). */
  solo?: boolean;
  /** Rendered in a two-up desktop pair — tighter padding, slightly smaller
   *  label, and it must not force its partner's height. */
  compact?: boolean;
}) {
  const [within, setWithin] = useState(false);
  const done = answered(value);
  const str = typeof value === 'string' ? value : '';
  const arr = Array.isArray(value) ? value : [];
  const options = q.options ?? [];
  const helpId = q.help ? `q-${q.id}-help` : undefined;
  const errId = hasError ? `q-${q.id}-err` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined;
  const labelId = `q-${q.id}-label`;

  // `q-${id}` lands on a real form control ONLY for the types that have one.
  // Choice types render a fieldset of buttons and `date` renders the shared
  // DatePicker, so a <label htmlFor> would point at nothing and clicking the
  // label would do nothing. Those get a plain span plus aria-labelledby on the
  // group instead. The scroll/focus target for the missing-answer jump is the
  // CARD, never the control, so it works uniformly for all seven types.
  const hasBoundControl =
    q.type === 'paragraph' || q.type === 'short_text' || q.type === 'number'
    || q.type === 'date' || (q.type === 'dropdown' && options.length > 6);

  const toggle = (opt: string) => onChange(arr.includes(opt) ? arr.filter(o => o !== opt) : [...arr, opt]);

  const labelStyle: React.CSSProperties = {
    fontFamily: OUTFIT, fontWeight: 700,
    fontSize: solo ? 18 : compact ? 16 : 17,
    lineHeight: 1.35, color: NEU.ink,
  };

  return (
    <div
      id={questionCardId(q.id)}
      tabIndex={-1}
      onFocusCapture={() => setWithin(true)}
      onBlurCapture={() => setWithin(false)}
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 20,
        padding: solo ? '24px 24px 20px' : compact ? '18px 18px 16px' : '20px 20px 17px',
        boxShadow: within ? NEU.outHover : NEU.out,
        transform: within ? 'translateY(-1px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 220ms ${EASE}`,
        outline: 'none',
      }}
    >
      {/* Label row. Help and error are conditional and carry their own
          margins, so a bare label + well never leaves a reserved gap. */}
      <div className="flex items-start gap-3" style={{ marginBottom: q.help ? 8 : 13 }}>
        <span style={{ marginTop: 2 }}><QuestionNumeral n={index} done={done} /></span>
        {hasBoundControl ? (
          <label id={labelId} htmlFor={`q-${q.id}`} className="flex-1 whitespace-pre-wrap" style={labelStyle}>
            {q.label}
          </label>
        ) : (
          <span id={labelId} className="flex-1 whitespace-pre-wrap" style={labelStyle}>
            {q.label}
          </span>
        )}
        <span style={{ marginTop: 3 }}><StatusPill required={q.required} /></span>
      </div>

      {q.help && (
        <p
          id={helpId}
          className="whitespace-pre-wrap"
          style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.55, color: HELP_INK, margin: '0 0 13px 38px' }}
        >
          {q.help}
        </p>
      )}

      {q.type === 'paragraph' && (
        <EssayField q={q} value={str} onChange={onChange} hasError={hasError} describedBy={describedBy} />
      )}
      {q.type === 'short_text' && (
        <ShortField q={q} value={str} onChange={onChange} hasError={hasError} describedBy={describedBy} />
      )}
      {q.type === 'number' && (
        <NumberField q={q} value={str} onChange={onChange} hasError={hasError} describedBy={describedBy} />
      )}
      {q.type === 'date' && (
        <DatePicker
          id={`q-${q.id}`}
          variant="well"
          describedBy={describedBy}
          invalid={hasError}
          value={str}
          onChange={(iso) => onChange(iso)}
          placeholder={q.placeholder ?? 'Pick a date'}
        />
      )}
      {q.type === 'multiple_choice' && (
        <OptionRows q={q} options={options} selected={str ? [str] : []} onPick={(o) => onChange(o)} multiple={false} hasError={hasError} describedBy={describedBy} labelledBy={labelId} />
      )}
      {q.type === 'checkboxes' && (
        <OptionRows q={q} options={options} selected={arr} onPick={toggle} multiple hasError={hasError} describedBy={describedBy} labelledBy={labelId} />
      )}
      {/* A dropdown with few options is just a one-tap choice; only long
          lists earn a menu. Either way, never a native <select>. */}
      {q.type === 'dropdown' && (options.length <= 6
        ? <OptionRows q={q} options={options} selected={str ? [str] : []} onPick={(o) => onChange(o)} multiple={false} hasError={hasError} describedBy={describedBy} labelledBy={labelId} />
        : <PortalSelect q={q} options={options} value={str} onChange={onChange} hasError={hasError} describedBy={describedBy} />
      )}

      {hasError && (
        <p id={errId} className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: DANGER, marginTop: 9 }}>
          <AlertCircle size={14} strokeWidth={2.6} style={{ flexShrink: 0 }} />
          {errorMessage(q)}
        </p>
      )}
    </div>
  );
}
