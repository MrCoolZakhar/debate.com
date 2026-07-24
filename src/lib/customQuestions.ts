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

// ── Form blocks ──────────────────────────────────────────────────────────────
// A Google-Forms-style block list: questions, plus non-input Title and
// Section blocks. Section blocks additionally mark a page break (see
// splitIntoSections). Shared by conference application forms and financial
// aid forms — one model, one builder, one renderer.

/** archived: soft-deleted from the live form. The block (and any answers
 *  already stored against its id in applications.custom_answers) is kept
 *  forever; only the "is this question currently on the form" view hides it.
 *  See questionsOf below for how consumers opt in or out. */
export type QuestionBlock = CustomQuestion & { kind: 'question'; archived?: boolean };

export interface TitleBlock {
  kind: 'title';
  id: string;
  title: string;
  description?: string;
}

export interface SectionBlock {
  kind: 'section';
  id: string;
  title: string;
  description?: string;
}

export type FormBlock = QuestionBlock | TitleBlock | SectionBlock;

/** Backward compatible: items with no `kind` (legacy CustomQuestion rows) or
 *  kind==='question' normalize as question blocks; kind==='title'/'section'
 *  normalize as those. Order is preserved. */
export function normalizeBlocks(raw: unknown): FormBlock[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((item): FormBlock => {
    const r = (item ?? {}) as Record<string, unknown>;
    const description = typeof r.description === 'string' && r.description.trim() ? r.description : undefined;
    if (r.kind === 'title') {
      return {
        kind: 'title',
        id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
        title: typeof r.title === 'string' ? r.title : '',
        description,
      };
    }
    if (r.kind === 'section') {
      return {
        kind: 'section',
        id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
        title: typeof r.title === 'string' ? r.title : '',
        description,
      };
    }
    return { ...normalizeQuestion(item), kind: 'question', archived: r.archived === true };
  });
}

/** Question blocks only, in order. Archived questions are excluded by
 *  default, so the live applicant form and its required-validation never see
 *  a soft-deleted question, pass includeArchived for organizer-side views
 *  that need to resolve a past answer against the question that produced it. */
export function questionsOf(blocks: FormBlock[], opts?: { includeArchived?: boolean }): QuestionBlock[] {
  return blocks.filter((b): b is QuestionBlock => b.kind === 'question' && (opts?.includeArchived === true || !b.archived));
}

/** Splits a flat block list into pages at each Section block. A Section
 *  block starts a new page and becomes that page's header (its own title
 *  block-ness is excluded from page.blocks); everything before the first
 *  section is the first page with section=null. */
export function splitIntoSections(blocks: FormBlock[]): Array<{ section: { title: string; description?: string } | null; blocks: FormBlock[] }> {
  const pages: Array<{ section: { title: string; description?: string } | null; blocks: FormBlock[] }> = [];
  let current: { section: { title: string; description?: string } | null; blocks: FormBlock[] } = { section: null, blocks: [] };
  for (const block of blocks) {
    if (block.kind === 'section') {
      pages.push(current);
      current = { section: { title: block.title, description: block.description }, blocks: [] };
    } else {
      current.blocks.push(block);
    }
  }
  pages.push(current);
  return pages;
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
