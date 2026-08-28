// Applicant-side page layout for a conference application's custom questions.
//
// Deliberately NOT in src/lib/customQuestions.ts: that file is the shared block
// MODEL, mounted by the organiser builder, the financial-aid form and the
// pledge card. Everything here is presentation policy for the full-page apply
// wizard only, and must never leak into those compact/modal surfaces.

import {
  type FormBlock,
  type QuestionBlock,
  type TitleBlock,
  type CustomQuestion,
  splitIntoSections,
} from '@/lib/customQuestions';

export interface QuestionPage {
  section: { title: string; description?: string } | null;
  blocks: FormBlock[];
}

/**
 * "Essay weight" — a paragraph question the applicant will spend real time on,
 * as opposed to a short free-text note that happens to be a paragraph type.
 *
 * Only used to decide whether a question earns its OWN page. The roomy
 * autogrow textarea is given to every `paragraph` regardless, because that is
 * what the organiser asked for when they picked the type.
 */
export function isEssayQuestion(q: CustomQuestion): boolean {
  if (q.type !== 'paragraph') return false;
  return q.label.length > 60 || /\bwhy\b|\bdescribe\b|\bexplain\b|\btell us\b|\bwhat would you\b/i.test(q.label);
}

/**
 * Page list for the Questions step.
 *
 * RULE: if the organiser used ANY section block, their pagination is law —
 * `splitIntoSections` is returned untouched. We never re-cut a form somebody
 * deliberately laid out.
 *
 * Only when there are no sections at all do we split essays onto their own
 * pages, so a 10-essay application (Harvard WorldMUN 2027 is exactly this: 12
 * blocks, 0 sections, 10 paragraphs) stops being one unanswerable wall.
 * Non-essay blocks accumulate into shared pages around them. A run that
 * contains only static title blocks is never flushed as a page of its own —
 * it rides along with the essay that follows it.
 */
export function buildQuestionPages(blocks: FormBlock[]): QuestionPage[] {
  const live = blocks.filter(b => !(b.kind === 'question' && b.archived));
  if (live.some(b => b.kind === 'section')) return dropEmptyPages(splitIntoSections(live));

  const essays = live.filter((b): b is QuestionBlock => b.kind === 'question' && isEssayQuestion(b));
  if (essays.length < 2) return dropEmptyPages(splitIntoSections(live));

  const pages: QuestionPage[] = [];
  let buf: FormBlock[] = [];
  const bufHasInput = () => buf.some(b => b.kind === 'question');

  for (const block of live) {
    if (block.kind === 'question' && isEssayQuestion(block)) {
      if (bufHasInput()) {
        pages.push({ section: null, blocks: buf });
        buf = [];
      }
      // buf is title-only (or empty) — carry it onto the essay's page.
      pages.push({ section: null, blocks: [...buf, block] });
      buf = [];
      continue;
    }
    buf.push(block);
  }
  if (buf.length > 0) {
    if (bufHasInput() || pages.length === 0) pages.push({ section: null, blocks: buf });
    else pages[pages.length - 1].blocks.push(...buf);
  }
  return pages.length > 0 ? pages : [{ section: null, blocks: [] }];
}

/**
 * `splitIntoSections` always emits a first page, even when the form OPENS with
 * a section block — in which case that page holds nothing at all. As an inline
 * list that was invisible; as a wizard page it is a whole screen with a
 * heading, a conference plate and a Continue button, and no question. Drop any
 * page with no blocks, but never return an empty list.
 */
function dropEmptyPages(pages: QuestionPage[]): QuestionPage[] {
  const kept = pages.filter(p => p.blocks.length > 0);
  return kept.length > 0 ? kept : [pages[0] ?? { section: null, blocks: [] }];
}

/**
 * The leading Title block of the whole form, if the organiser wrote one.
 *
 * It gets PROMOTED to the stage's H1/subtitle instead of being rendered as
 * 14px body copy under our own generic "A few questions" placeholder — which
 * meant our filler text outranked the organiser's own words.
 */
export function leadTitleBlock(blocks: FormBlock[]): TitleBlock | null {
  for (const b of blocks) {
    if (b.kind === 'title') return b;
    if (b.kind === 'question' && b.archived) continue;
    return null;
  }
  return null;
}

// NO TIME ESTIMATE LIVES HERE ANY MORE.
// The plate used to read "12 questions · about 8 min", off a per-type seconds
// table. It was a guess dressed as a fact: the same five questions take one
// applicant three minutes and another twenty, and an under-estimate reads as
// the form lying to you. The plate now states only what is actually known —
// the question count. Do not reintroduce an estimator.

/** Photography already in /public/onboarding — no new asset pipeline. */
const STAGE_PHOTOS = [
  '/onboarding/lecture-01.jpg',
  '/onboarding/classroom-01.jpg',
  '/onboarding/hall-01.jpg',
  '/onboarding/hall-02.jpg',
  '/onboarding/campus-01.jpg',
  '/onboarding/city-01.jpg',
];

/** Deterministic per-conference (and per-section) pick. Never random per
 *  render — a header that changes photo on every keystroke is disorienting. */
export function stagePhoto(seed: string, offset = 0): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return STAGE_PHOTOS[(h + offset) % STAGE_PHOTOS.length];
}

/** Live word count for the essay meter. */
export function wordCount(v: string): number {
  const t = v.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** A word target the ORGANISER named in their help text ("around 300 words",
 *  "200-250 words"). We never invent one: telling an applicant to write 300
 *  words for a question the organiser wanted 50 on is worse than silence. */
export function parseWordTarget(help?: string): { min: number; max: number } | null {
  if (!help) return null;
  const range = /(\d{2,4})\s*(?:-|–|—|to)\s*(\d{2,4})\s*words?/i.exec(help);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const single = /(?:max(?:imum)?|up to|under|about|around|approx\.?|roughly|at least|min(?:imum)?)?\s*(\d{2,4})\s*words?/i.exec(help);
  if (single) {
    const n = Number(single[1]);
    return { min: Math.round(n * 0.6), max: n };
  }
  return null;
}
