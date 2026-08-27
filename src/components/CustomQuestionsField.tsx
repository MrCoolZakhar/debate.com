'use client';

import { type FormBlock, type CustomQuestion, type CustomAnswers, type CustomAnswerValue } from '@/lib/customQuestions';
import { DatePicker } from '@/components/DatePicker';
import { NEU } from '@/components/neu';

// Correctness floor shared by every input this component renders:
//  - 16px is the smallest font iOS Safari will render WITHOUT auto-zooming the
//    page on focus. Never drop below it on a real text input.
//  - #8C7E68 clears WCAG 1.4.11 (3:1 non-text contrast) against every ground
//    this field is mounted on: 3.21:1 on the #EDE7D8 page, 3.33:1 on the
//    #F0EBDD card surface and 3.73:1 on its own #FAF8F3 fill. The previous
//    #DDD4C0 was 1.19:1 — the boundary was effectively invisible.
const INPUT_BORDER = '#8C7E68';
const INPUT_BORDER_FOCUS = '#1B3828';
const INPUT_BORDER_ERROR = '#8B2020';
/** Body/help copy. NEU.inkSoft is 6.44:1 on the page and 7.49:1 on the input
 *  fill. The previous #9A8A78 was 2.71:1 and failed AA at every size here. */
const HELP_INK = NEU.inkSoft;

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: '12px', padding: '12px 16px', fontSize: '16px',
  borderWidth: '1.5px', borderStyle: 'solid', borderColor: INPUT_BORDER, backgroundColor: '#FAF8F3', color: '#1C1410',
  fontFamily: "'Outfit', sans-serif",
};

function errorStyle(hasError: boolean): React.CSSProperties {
  return hasError ? { borderColor: INPUT_BORDER_ERROR } : {};
}

/** Renders a Google-Forms-style block list inline: Section blocks as a
 *  header/divider, Title blocks as static content, Question blocks as the
 *  actual inputs. One page for now — pagination on Section breaks comes in a
 *  later pass (see splitIntoSections in lib/customQuestions). */
export default function CustomQuestionsField({ blocks, answers, onChange, missingIds = [] }: {
  blocks: FormBlock[];
  answers: CustomAnswers;
  onChange: (next: CustomAnswers) => void;
  missingIds?: string[];
}) {
  function setAnswer(id: string, value: CustomAnswerValue) {
    onChange({ ...answers, [id]: value });
  }

  function toggleCheckbox(id: string, option: string) {
    const current = answers[id];
    const arr = Array.isArray(current) ? current : [];
    const next = arr.includes(option) ? arr.filter(o => o !== option) : [...arr, option];
    setAnswer(id, next);
  }

  // Archived questions are soft-deleted from the applicant's point of view:
  // never rendered here, regardless of which caller passed the block list.
  const visibleBlocks = blocks.filter(block => !(block.kind === 'question' && block.archived));

  return (
    <div className="flex flex-col gap-4">
      {visibleBlocks.map(block => {
        if (block.kind === 'section') {
          return (
            <div key={block.id} className="pt-1 pb-0.5" style={{ borderTop: '1px solid rgba(27,56,40,0.12)' }}>
              <p className="font-black text-base mt-3" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {block.title}
              </p>
              {block.description && (
                <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: HELP_INK, fontFamily: "'Outfit', sans-serif" }}>
                  {block.description}
                </p>
              )}
            </div>
          );
        }
        if (block.kind === 'title') {
          return (
            <div key={block.id}>
              <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {block.title}
              </p>
              {block.description && (
                <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: HELP_INK, fontFamily: "'Outfit', sans-serif" }}>
                  {block.description}
                </p>
              )}
            </div>
          );
        }
        const q: CustomQuestion = block;
        const hasError = missingIds.includes(q.id);
        const value = answers[q.id];
        return (
          <div key={q.id}>
            <label className="block font-semibold text-sm mb-1 whitespace-pre-wrap" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              {q.label}
              {q.required && <span className="ml-1" style={{ color: '#8B2020' }}>*</span>}
            </label>
            {q.help && (
              <p className="text-[13px] mb-1.5 whitespace-pre-wrap" style={{ color: HELP_INK, fontFamily: "'Outfit', sans-serif" }}>{q.help}</p>
            )}

            {q.type === 'short_text' && (
              <input
                type="text"
                value={(value as string) ?? ''}
                placeholder={q.placeholder}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="focus:outline-none"
                style={{ ...inputStyle, ...errorStyle(hasError) }}
                onFocus={(e) => { e.currentTarget.style.borderColor = INPUT_BORDER_FOCUS; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = hasError ? INPUT_BORDER_ERROR : INPUT_BORDER; }}
              />
            )}

            {q.type === 'paragraph' && (
              <textarea
                rows={4}
                value={(value as string) ?? ''}
                placeholder={q.placeholder}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="focus:outline-none resize-y"
                style={{ ...inputStyle, ...errorStyle(hasError) }}
                onFocus={(e) => { e.currentTarget.style.borderColor = INPUT_BORDER_FOCUS; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = hasError ? INPUT_BORDER_ERROR : INPUT_BORDER; }}
              />
            )}

            {q.type === 'number' && (
              <input
                type="number"
                value={(value as string) ?? ''}
                placeholder={q.placeholder}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="focus:outline-none"
                style={{ ...inputStyle, ...errorStyle(hasError) }}
                onFocus={(e) => { e.currentTarget.style.borderColor = INPUT_BORDER_FOCUS; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = hasError ? INPUT_BORDER_ERROR : INPUT_BORDER; }}
              />
            )}

            {q.type === 'date' && (
              <DatePicker
                value={(value as string) ?? ''}
                onChange={(iso) => setAnswer(q.id, iso)}
              />
            )}

            {q.type === 'dropdown' && (
              <select
                value={(value as string) ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="focus:outline-none"
                style={{ ...inputStyle, ...errorStyle(hasError) }}
                onFocus={(e) => { e.currentTarget.style.borderColor = INPUT_BORDER_FOCUS; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = hasError ? INPUT_BORDER_ERROR : INPUT_BORDER; }}
              >
                <option value="">Select an option…</option>
                {(q.options ?? []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {q.type === 'multiple_choice' && (
              <div className="flex flex-col gap-2">
                {(q.options ?? []).map(opt => (
                  <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={value === opt}
                      onChange={() => setAnswer(q.id, opt)}
                      className="w-4 h-4 cursor-pointer"
                      style={{ accentColor: '#1B3828' }}
                    />
                    <span className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {q.type === 'checkboxes' && (
              <div className="flex flex-col gap-2">
                {(q.options ?? []).map(opt => (
                  <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Array.isArray(value) && value.includes(opt)}
                      onChange={() => toggleCheckbox(q.id, opt)}
                      className="w-4 h-4 cursor-pointer"
                      style={{ accentColor: '#1B3828' }}
                    />
                    <span className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {hasError && (
              <p className="text-[13px] mt-1" style={{ color: INPUT_BORDER_ERROR, fontFamily: "'Outfit', sans-serif" }}>
                This question is required.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
