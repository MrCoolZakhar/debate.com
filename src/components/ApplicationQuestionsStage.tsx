'use client';

/**
 * ApplicationQuestionsStage — the full-page body of the apply wizard's
 * Questions step: the conference plate, the section treatment, and the list of
 * ApplicationQuestionCards.
 *
 * Fork of the inline CustomQuestionsField renderer, NOT a restyle of it — that
 * one still serves AidRequestModal / PledgeInvoicingCard / AidFormEditor,
 * where this much furniture would be wrong.
 */

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import ApplicationQuestionCard from '@/components/ApplicationQuestionCard';
import {
  type FormBlock, type QuestionBlock, type CustomAnswers, type CustomAnswerValue, questionsOf,
} from '@/lib/customQuestions';
import { stagePhoto } from '@/lib/applyQuestionPages';

const HELP_INK = NEU.inkSoft;

// ── Two-up pairing ─────────────────────────────────────────────────────────
// A column of full-width cards for "Full Name" / "School Name" / "Phone
// Number" wastes the whole right half of a 720px stage and makes a six-field
// roster form look longer than it is. Two consecutive SHORT questions with
// SHORT labels share a row on desktop; everything else stays full width, and
// the grid collapses to one column below 640px so nothing is cramped on a
// phone. Essays and choice lists never pair — their heights are unbounded and
// a ragged pair reads worse than a column.
const PAIRABLE_TYPES = new Set(['short_text', 'number', 'date']);
const PAIR_LABEL_MAX = 44;

function pairable(b: FormBlock): b is QuestionBlock {
  return b.kind === 'question'
    && PAIRABLE_TYPES.has(b.type)
    && b.label.length <= PAIR_LABEL_MAX
    && !b.help;
}

// ── Conference plate ───────────────────────────────────────────────────────
// The applicant is about to write about why this conference matters to them.
// Until now the page carried no evidence the conference existed. Uses the
// conference's own banner when it has one, a deterministic /public/onboarding
// photo otherwise, and a forest gradient if even that fails to paint — no new
// assets, no external pipeline.
export function ConferencePlate({
  seed, bannerUrl, logoUrl, acronym, fullName, questionCount,
}: {
  seed: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  acronym: string;
  fullName: string;
  questionCount: number;
}) {
  const photo = bannerUrl || stagePhoto(seed);
  const showFullName = fullName && fullName.trim().toLowerCase() !== acronym.trim().toLowerCase();

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: 152, borderRadius: 20, marginBottom: 20,
        // Last-resort ground, visible only if neither image paints.
        background: `linear-gradient(135deg, ${NEU.forest}, #2F6644)`,
        boxShadow: NEU.out,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      {/* DIRECTIONAL scrim, not a flat wash. All the plate's text sits on the
          LEFT, so the darkening is heaviest there and thins out to the right
          where the photograph can still be seen. A uniform 0.74 veil (the
          first version) turned an already-dark organiser banner into a plain
          green rectangle — which defeats the whole point of showing it. The
          light bottom band keeps the meta pill legible over a bright photo. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(100deg, rgba(20,36,27,0.88) 0%, rgba(20,36,27,0.66) 44%, rgba(20,36,27,0.22) 100%)' }}
      />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(20,36,27,0.45) 0%, rgba(20,36,27,0) 58%)' }}
      />
      <div className="absolute inset-0 flex items-center gap-3.5" style={{ padding: '0 20px' }}>
        {/* Always rendered: LogoDisc falls back to a gold monogram, so a
            conference with no logo still gets an identity mark rather than a
            hole where one should be. */}
        <span
          className="flex-shrink-0 rounded-full"
          style={{ boxShadow: '0 0 0 2px rgba(238,217,138,0.45), 0 6px 18px rgba(0,0,0,0.28)', borderRadius: 999 }}
        >
          <LogoDisc src={logoUrl} alt="" size={54} fallbackText={acronym.slice(0, 3)} />
        </span>
        <div className="min-w-0 flex-1">
          <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 22, lineHeight: 1.1, color: '#FFFCF4', letterSpacing: '-0.01em' }}>
            {acronym}
          </p>
          {showFullName && (
            <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 500, fontSize: 13, color: 'rgba(255,252,244,0.78)', marginTop: 2 }}>
              {fullName}
            </p>
          )}
          <span
            className="inline-flex items-center"
            style={{
              marginTop: 9, padding: '4px 11px', borderRadius: 999,
              backgroundColor: 'rgba(238,217,138,0.17)', border: '1px solid rgba(238,217,138,0.42)',
              fontFamily: OUTFIT, fontWeight: 700, fontSize: 11.5, color: NEU.gold,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {/* Count only. The "· about N min" estimate was removed on
                purpose — see the note in src/lib/applyQuestionPages.ts. */}
            {questionCount} {questionCount === 1 ? 'question' : 'questions'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Section strip (pages 2..n) ─────────────────────────────────────────────
// A slim continuation of the first page's plate. It carries the CONFERENCE,
// not the section name: the section title is already the page's H1 directly
// above, and printing it twice reads as a rendering bug. What the strip adds
// is continuity (the same photography) and position ("SECTION 2 OF 3"), which
// the H1 cannot say.
export function SectionStrip({
  seed, index, total, acronym, bannerUrl,
}: {
  seed: string;
  /** 0-based page index. */
  index: number;
  total: number;
  acronym: string;
  bannerUrl?: string | null;
}) {
  const photo = bannerUrl || stagePhoto(seed, index);
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 52, borderRadius: 16, marginBottom: 18, boxShadow: NEU.outSm, background: NEU.forest }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(20,36,27,0.88) 0%, rgba(20,36,27,0.60) 55%, rgba(20,36,27,0.26) 100%)' }} />
      <div className="absolute inset-0 flex items-center justify-between gap-3" style={{ padding: '0 16px' }}>
        <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: '#FFFCF4', letterSpacing: '0.01em' }}>
          {acronym}
        </p>
        <span
          className="flex-shrink-0"
          style={{
            fontFamily: OUTFIT, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.13em',
            color: NEU.gold, fontVariantNumeric: 'tabular-nums',
            padding: '4px 10px', borderRadius: 999,
            backgroundColor: 'rgba(238,217,138,0.15)', border: '1px solid rgba(238,217,138,0.38)',
          }}
        >
          SECTION {index + 1} OF {total}
        </span>
      </div>
    </div>
  );
}

// ── Missing-answer summary ─────────────────────────────────────────────────
export function MissingSummary({ count, onJump }: { count: number; onJump: () => void }) {
  const [hover, setHover] = useState(false);
  if (count < 1) return null;
  return (
    <button
      type="button"
      onClick={onJump}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full flex items-center gap-2.5 text-left focus:outline-none"
      style={{
        marginBottom: 16, padding: '12px 16px', borderRadius: 14,
        backgroundColor: 'rgba(139,32,32,0.07)', border: '1.5px solid rgba(139,32,32,0.34)',
        boxShadow: hover ? NEU.outSm : 'none', cursor: 'pointer',
        transition: `box-shadow 200ms ${EASE}`,
      }}
    >
      <AlertCircle size={16} strokeWidth={2.5} style={{ color: '#8B2020', flexShrink: 0 }} />
      <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13.5, color: '#8B2020' }}>
        {count === 1 ? '1 question still needs an answer' : `${count} questions still need an answer`}
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: HELP_INK, marginLeft: 'auto', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        Show me
      </span>
    </button>
  );
}

// ── The stage body ─────────────────────────────────────────────────────────
export default function ApplicationQuestionsStage({
  blocks, answers, onChange, missingIds = [], hideBlockId, solo = false,
}: {
  blocks: FormBlock[];
  answers: CustomAnswers;
  onChange: (next: CustomAnswers) => void;
  missingIds?: string[];
  /** Block promoted to the stage heading — rendered there, not again here. */
  hideBlockId?: string | null;
  /** This page holds exactly one essay question. */
  solo?: boolean;
}) {
  const visible = blocks.filter(b => !(b.kind === 'question' && b.archived) && b.id !== hideBlockId);
  const setAnswer = (id: string, v: CustomAnswerValue) => onChange({ ...answers, [id]: v });

  // Walk once, emitting either a single block or a pair. `n` is the visible
  // question number and must keep counting in document order across pairs —
  // title/section blocks never consume one.
  const rows: Array<{ key: string; blocks: FormBlock[]; numbers: number[] }> = [];
  let n = 0;
  for (let i = 0; i < visible.length; i++) {
    const block = visible[i];
    const next = visible[i + 1];
    if (!solo && pairable(block) && next && pairable(next)) {
      rows.push({ key: `${block.id}+${next.id}`, blocks: [block, next], numbers: [n + 1, n + 2] });
      n += 2;
      i += 1;
      continue;
    }
    if (block.kind === 'question') n += 1;
    rows.push({ key: block.id, blocks: [block], numbers: block.kind === 'question' ? [n] : [] });
  }

  const renderBlock = (block: FormBlock, num: number | undefined, compact: boolean) => {
    if (block.kind === 'title' || block.kind === 'section') {
      return (
        <div key={block.id} style={{ paddingLeft: 2 }}>
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15.5, color: NEU.ink }}>{block.title}</p>
          {block.description && (
            <p className="whitespace-pre-wrap" style={{ fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.55, color: HELP_INK, marginTop: 4 }}>
              {block.description}
            </p>
          )}
        </div>
      );
    }
    return (
      <ApplicationQuestionCard
        key={block.id}
        question={block}
        index={num ?? 1}
        value={answers[block.id]}
        onChange={(v) => setAnswer(block.id, v)}
        hasError={missingIds.includes(block.id)}
        solo={solo}
        compact={compact}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {rows.map(row => (
        row.blocks.length === 2 ? (
          <div
            key={row.key}
            className="grid gap-4"
            // One column on a phone, two from 640px up. `items-start` so the
            // shorter of the pair keeps its natural height instead of being
            // stretched to match its neighbour.
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', alignItems: 'start' }}
          >
            {row.blocks.map((b, j) => renderBlock(b, row.numbers[j], true))}
          </div>
        ) : renderBlock(row.blocks[0], row.numbers[0], false)
      ))}
    </div>
  );
}

/** Question count for the plate. */
export function countQuestions(blocks: FormBlock[]): number {
  return questionsOf(blocks).length;
}
