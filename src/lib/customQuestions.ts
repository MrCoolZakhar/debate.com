// Shared custom-question types for conference applications (and, next, the
// financial aid form). One question shape, one set of helpers, used by the
// organizer builder, the applicant renderer, and the read-only display.

export type QuestionType =
  | 'short_text'
  | 'paragraph'
  | 'dropdown'
  | 'multiple_choice'
  | 'checkboxes'
  | 'number'
  | 'date';
// TODO: file-upload type needs storage plumbing (bucket + upload UI) — not in this pass.

export interface CustomQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
}

export type CustomAnswerValue = string | string[];
export type CustomAnswers = Record<string, CustomAnswerValue>;

const QUESTION_TYPES: readonly QuestionType[] = [
  'short_text', 'paragraph', 'dropdown', 'multiple_choice', 'checkboxes', 'number', 'date',
];

/** Legacy 'text'/'textarea' → new types; unknown types fall back to short_text. */
export function normalizeQuestion(raw: unknown): CustomQuestion {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawType = typeof r.type === 'string' ? r.type : 'short_text';
  const type: QuestionType =
    rawType === 'text' ? 'short_text'
    : rawType === 'textarea' ? 'paragraph'
    : (QUESTION_TYPES as readonly string[]).includes(rawType) ? (rawType as QuestionType)
    : 'short_text';
  return {
    id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
    label: typeof r.label === 'string' ? r.label : '',
    type,
    required: r.required === true,
    options: Array.isArray(r.options) ? r.options.filter((o): o is string => typeof o === 'string') : [],
    placeholder: typeof r.placeholder === 'string' ? r.placeholder : undefined,
    help: typeof r.help === 'string' ? r.help : undefined,
  };
}

export function normalizeQuestions(raw: unknown[] | null | undefined): CustomQuestion[] {
  return (raw ?? []).map(normalizeQuestion);
}

export function isChoiceType(t: QuestionType): boolean {
  return t === 'dropdown' || t === 'multiple_choice' || t === 'checkboxes';
}

export function answerIsEmpty(v: CustomAnswerValue | undefined): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  return v.trim() === '';
}

export function validateAnswers(
  questions: CustomQuestion[],
  answers: CustomAnswers
): { valid: boolean; missingIds: string[] } {
  const missingIds = questions
    .filter(q => q.required && answerIsEmpty(answers[q.id]))
    .map(q => q.id);
  return { valid: missingIds.length === 0, missingIds };
}

export function displayAnswer(q: CustomQuestion, v: CustomAnswerValue | undefined): string {
  if (v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return v;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: 'Short answer',
  paragraph: 'Paragraph',
  dropdown: 'Dropdown',
  multiple_choice: 'Multiple choice',
  checkboxes: 'Checkboxes',
  number: 'Number',
  date: 'Date',
};
