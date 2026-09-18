'use client';

/**
 * ProceedingsSetup: the timings screen before a paper is introduced (17 Sep 2026).
 *
 * Built like a dais docket, not a form: the paper on the left, and on the right an order of
 * proceedings with the three stages as a timeline marked by icons (Reading = an open book,
 * Presentation = a presentation board, Q&A = speech bubbles; owner, 17 Sep 2026: "instead of
 * I, II, III, add icons"). Each stage has a
 * tactile minute dial (a large numeral you can type into, minus / plus keys, Arrow and Page
 * keys, and 0 / 2 / 5 / 10 notches). A stage at 0 is shown as skipped on the timeline. The foot
 * shows the floor time as one proportional strip, when it would end, and what happens after.
 *
 * There is no bar above it any more (owner: the "Introduce" strip and its X "looked weird"). The
 * way out is the Back key at the top of the docket, or Escape (handled by the modal).
 *
 * Presentational: it only holds the three draft numbers. Confirming calls `onStart` once, and
 * the modal still writes timings + status in ONE update (unchanged).
 */
import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Check, MessagesSquare, Presentation, SkipForward, type LucideIcon } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import type { Committee, CommitteeDocument } from '@/lib/types';
import { docName } from '@/lib/docNames';
import { serverNow } from '@/lib/serverClock';
import PdfViewer, { type PdfZoom } from './PdfViewer';

const INK = '#1C1410';
const INK_SOFT = '#5C4E40';
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const OUTFIT = "'Outfit', sans-serif";
const MAX_MIN = 99;
const NOTCHES = [0, 2, 5, 10];
const STAGE_TINT = ['#1B3828', '#B98A2E', '#6E8B74'];

const clampMin = (n: number) => Math.min(MAX_MIN, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

function MinuteDial({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft !== null) { onChange(clampMin(parseInt(draft, 10) || 0)); setDraft(null); } };
  const keyBtn = 'w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg font-semibold leading-none select-none transition-[transform,box-shadow,background-color] duration-100 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] disabled:opacity-35';
  const keyStyle: React.CSSProperties = {
    color: FOREST, background: 'linear-gradient(180deg,#FBF7EE,#EFE7D4)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(27,56,40,0.14), 0 2px 0 rgba(27,56,40,0.14), 0 3px 8px rgba(27,56,40,0.10)',
  };
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2.5">
        <button type="button" className={keyBtn} style={keyStyle} onClick={() => onChange(clampMin(value - 1))} disabled={value <= 0}
          aria-label={`${label}: ${t('documents_setup_less')}`} title={t('documents_setup_less')}>
          <span aria-hidden>&#8722;</span>
        </button>
        <label className="relative flex items-baseline justify-center rounded-2xl px-3 h-14 min-w-[92px]"
          style={{ background: '#FFFDF7', boxShadow: 'inset 0 2px 4px rgba(27,56,40,0.10), inset 0 0 0 1px rgba(27,56,40,0.12)' }}>
          <span className="sr-only">{label}</span>
          <input
            type="text"
            inputMode="numeric"
            role="spinbutton"
            aria-valuemin={0}
            aria-valuemax={MAX_MIN}
            aria-valuenow={value}
            aria-valuetext={`${value} ${t('documents_setup_minutes_short')}`}
            value={draft ?? String(value)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onBlur={commit}
            onKeyDown={(e) => {
              const step = ({ ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5 } as Record<string, number>)[e.key];
              if (step) { e.preventDefault(); setDraft(null); onChange(clampMin(value + step)); return; }
              if (e.key === 'Home') { e.preventDefault(); setDraft(null); onChange(0); return; }
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') setDraft(null);
            }}
            className="w-[2.3ch] bg-transparent text-end tabular-nums font-semibold focus:outline-none self-center"
            style={{ fontSize: 34, lineHeight: 1, color: value === 0 ? 'rgba(28,20,16,0.38)' : INK, fontFamily: OUTFIT, letterSpacing: '-0.02em' }}
          />
          <span className="ms-1 text-[13px] font-medium self-center pt-2" style={{ color: INK_SOFT }}>{t('documents_setup_minutes_short')}</span>
        </label>
        <button type="button" className={keyBtn} style={keyStyle} onClick={() => onChange(clampMin(value + 1))} disabled={value >= MAX_MIN}
          aria-label={`${label}: ${t('documents_setup_more')}`} title={t('documents_setup_more')}>
          <span aria-hidden>+</span>
        </button>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label={label}>
        {NOTCHES.map((n) => (
          <button key={n} type="button" onClick={() => { setDraft(null); onChange(n); }} aria-pressed={value === n}
            className="h-7 min-w-[40px] px-2 rounded-full text-[12px] font-semibold tabular-nums transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={value === n
              ? { backgroundColor: FOREST, color: GOLD }
              : { color: INK_SOFT, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.16)' }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProceedingsSetup({ doc, committee, onStart, onSkip, onBack }: {
  doc: CommitteeDocument;
  committee: Committee;
  onStart: (readingMins: number, presentationMins: number, qaMins: number) => void;
  onSkip: () => void;
  /** Leave the setup without introducing (back to the documents list). */
  onBack: () => void;
}) {
  const t = useT();
  const isWP = doc.type === 'working-paper';
  const typeName = docName(committee, doc.type, 'singular', isWP ? t('documents_working_paper') : t('documents_draft_resolution'));
  const typeNamePlural = docName(committee, doc.type, 'plural', isWP ? t('documents_working_papers_tab') : t('documents_draft_resolutions_tab'));
  // Prefilled from the row, so a re-introduction keeps the chosen times.
  const [mins, setMins] = useState([doc.readingMinutes ?? 0, doc.presentationMinutes ?? 0, doc.qaMinutes ?? 0]);
  const [zoom, setZoom] = useState<PdfZoom>('fit');

  const stageName = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  const stages: { label: string; note: string; Icon: LucideIcon }[] = [
    { label: stageName(t('documents_stage_reading')), note: t('documents_stage_note_reading'), Icon: BookOpen },
    { label: stageName(t('documents_stage_presentation')), note: t('documents_stage_note_presentation'), Icon: Presentation },
    { label: t('documents_stage_qa'), note: isWP ? t('documents_qa_optional_doc', { doc: typeNamePlural }) : t('documents_qa_note'), Icon: MessagesSquare },
  ];
  const total = mins[0] + mins[1] + mins[2];
  const endsAt = new Date(serverNow() + total * 60_000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const set = (i: number) => (n: number) => setMins((m) => m.map((v, k) => (k === i ? n : v)));

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
      {/* The paper */}
      <section aria-label={t('documents_setup_preview')} className="relative lg:w-[46%] h-[340px] lg:h-auto shrink-0 min-h-0"
        style={{ boxShadow: 'inset -1px 0 0 rgba(27,56,40,0.10)' }}>
        {doc.fileUrl ? (
          <PdfViewer url={doc.fileUrl} title={doc.title} fileName={doc.fileName} zoom={zoom} onZoomChange={setZoom} compact className="absolute inset-0" />
        ) : doc.content ? (
          <div className="absolute inset-0 overflow-auto bg-[#E4DCCA] px-5 py-6">
            <div className="mx-auto max-w-[640px] bg-[#FFFDF8] rounded-[3px] px-7 py-7"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 10px 28px rgba(27,56,40,0.14)' }}>
              <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed" style={{ color: INK, textWrap: 'pretty' }}>{doc.content}</pre>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8 bg-[#E4DCCA]">
            <p className="max-w-xs text-center text-sm" style={{ color: INK_SOFT, textWrap: 'pretty' }}>{t('documents_no_content')}</p>
          </div>
        )}
      </section>

      {/* The docket */}
      <section className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[620px] mx-auto px-6 sm:px-10 py-8 lg:py-10 flex flex-col min-h-full">
          <div className="flex items-center gap-1.5 -ms-2">
            <button type="button" onClick={onBack} aria-label={t('documents_setup_back')} title={t('documents_setup_back')}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.96] text-[#5C4E40] hover:bg-[#1B3828]/[0.07] hover:text-[#1B3828] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
              <ArrowLeft size={19} strokeWidth={2.3} aria-hidden className="rtl:rotate-180" />
            </button>
            <p className="text-[12px] font-semibold uppercase" style={{ color: INK_SOFT, letterSpacing: '0.18em', fontFamily: OUTFIT }}>
              {t('documents_setup_eyebrow')}
            </p>
          </div>
          <div className="mt-3 flex items-baseline gap-3 min-w-0">
            <span className="shrink-0 text-[13px] font-bold tabular-nums px-2 py-0.5 rounded-md" style={{ color: GOLD, backgroundColor: FOREST }}>{doc.docCode}</span>
            <span className="text-[13px] font-medium truncate" style={{ color: INK_SOFT }}>{typeName}</span>
          </div>
          <h2 className="mt-2 font-semibold leading-tight" style={{ color: INK, fontSize: 30, fontFamily: OUTFIT, textWrap: 'balance', letterSpacing: '-0.01em' }}>
            {doc.title}
          </h2>

          <ol className="mt-8 relative">
            {stages.map((s, i) => {
              const on = mins[i] > 0;
              return (
                <li key={i} className="relative grid grid-cols-[52px_1fr] gap-x-4 pb-7 last:pb-0">
                  {i < stages.length - 1 && (
                    <span aria-hidden className="absolute top-[52px] bottom-0 start-[25px] w-[2px]"
                      style={{ background: mins[i + 1] > 0 && on ? 'rgba(27,56,40,0.35)' : 'repeating-linear-gradient(180deg, rgba(27,56,40,0.28) 0 4px, transparent 4px 9px)' }} />
                  )}
                  <span aria-hidden className="relative z-[1] w-[52px] h-[52px] rounded-full flex items-center justify-center transition-[background-color,box-shadow,color] duration-200"
                    style={on
                      ? { backgroundColor: FOREST, color: GOLD, boxShadow: '0 2px 0 rgba(0,0,0,0.12), 0 6px 14px rgba(27,56,40,0.22)' }
                      : { backgroundColor: '#F6F1E9', color: 'rgba(27,56,40,0.55)', boxShadow: 'inset 0 0 0 2px rgba(27,56,40,0.22)' }}>
                    <s.Icon size={22} strokeWidth={2} />
                  </span>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 min-w-0">
                    <div className="min-w-0 pt-1.5 flex-1 basis-[160px]">
                      <p className="text-[18px] font-semibold leading-snug" style={{ color: INK, fontFamily: OUTFIT }}>{s.label}</p>
                      <p className="mt-0.5 text-[13px]" style={{ color: INK_SOFT, textWrap: 'pretty' }}>
                        {on ? s.note : <span className="font-medium">{t('documents_setup_skipped')}</span>}
                      </p>
                    </div>
                    <MinuteDial value={mins[i]} onChange={set(i)} label={t('documents_setup_minutes_of', { stage: s.label })} />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-auto pt-8">
            <div className="rounded-2xl px-5 py-4" style={{ backgroundColor: '#FBF7EE', boxShadow: '0 0 0 1px rgba(27,56,40,0.10), 0 6px 18px rgba(27,56,40,0.07)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] font-semibold uppercase" style={{ color: INK_SOFT, letterSpacing: '0.16em' }}>{t('documents_setup_total')}</span>
                <span className="tabular-nums" style={{ color: INK }}>
                  <span className="text-[26px] font-semibold" style={{ fontFamily: OUTFIT }}>{total}</span>
                  <span className="ms-1 text-[13px]" style={{ color: INK_SOFT }}>{t('documents_setup_minutes_short')}</span>
                </span>
              </div>
              <div className="mt-2.5 flex h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(27,56,40,0.08)' }} aria-hidden>
                {total > 0 && mins.map((m, i) => m > 0 && (
                  <span key={i} style={{ width: `${(m / total) * 100}%`, backgroundColor: STAGE_TINT[i], transition: 'width 220ms cubic-bezier(0.22,1,0.36,1)', boxShadow: i > 0 ? 'inset 2px 0 0 #FBF7EE' : undefined }} />
                ))}
              </div>
              <p className="mt-2.5 text-[13px]" style={{ color: INK_SOFT, textWrap: 'pretty' }} aria-live="polite">
                {total > 0
                  ? <>{t('documents_setup_ends', { time: endsAt })}. {isWP ? t('documents_setup_outcome_wp') : t('documents_setup_outcome_dr')}</>
                  : (isWP ? t('documents_setup_all_zero_wp') : t('documents_setup_all_zero_dr'))}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => onStart(mins[0], mins[1], mins[2])}
                className="flex-1 min-w-[220px] h-[52px] rounded-2xl inline-flex items-center justify-center gap-2 text-[15px] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828] hover:bg-[#244A35]"
                style={{ backgroundColor: FOREST, color: GOLD, boxShadow: '0 2px 0 rgba(0,0,0,0.18), 0 10px 24px rgba(27,56,40,0.22)', fontFamily: OUTFIT }}>
                <Check size={18} strokeWidth={2.6} aria-hidden />
                {t('documents_setup_begin')}
              </button>
              <button type="button" onClick={onSkip}
                className="h-[52px] px-5 rounded-2xl inline-flex items-center gap-2 text-[14px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.96] hover:bg-[#1B3828]/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ color: INK_SOFT, fontFamily: OUTFIT }}>
                <SkipForward size={16} strokeWidth={2.4} aria-hidden className="rtl:rotate-180" />
                {t('documents_setup_skip')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
