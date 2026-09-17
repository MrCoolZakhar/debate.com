'use client';

/**
 * ResolutionPicker: the landing of /voting/[code]. Every introduced draft resolution as a
 * card (code, title, sponsors as round flags, a status pill, a live-vote or result line).
 * The Documents "Vote" button lands here; choosing a card that has no vote yet opens the
 * roll call, which starts the vote.
 *
 * It owns no vote logic. `stateOf` is the page's decision for each card (start, resume,
 * view, follow, or nothing a Commenter can open) and `onOpen` hands the choice back.
 *
 * TYPE (16 Sep 2026). One scale, shared with VotingRollCall, VotingHeader and the ballot
 * screens, so the whole vote reads as one document rather than four posters:
 *   28/700  screen title      19/700  card title      15/500  body
 *   13.5/500 meta             12.5/600 small label (sentence case, normal tracking)
 * Nothing is uppercased, nothing is letterspaced, nothing is heavier than 700. The old
 * screen ran 40px/900 headings over letterspaced uppercase eyebrows, which is what made it
 * read as generated rather than designed.
 *
 * Motion: cards enter with a short stagger (opacity + 8px), lift on hover and settle on
 * press; all of it is off under prefers-reduced-motion.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardList, FileText, Radio, X } from 'lucide-react';
import { PdfThumb } from '@/components/documents/PdfViewer';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import type { CommitteeDocument } from '@/lib/types';
import type { VoteStateV1 } from '@/lib/voteState';
import { getDeviceVoteStatus } from '@/lib/deviceVoting';

const INK = '#1C1410';
const INK_SOFT = '#6A5A4A';
const MUTED = '#8C7B69';
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const CARD = '#FAF8F3';

export type PickCardState =
  | { kind: 'ready'; canOpen: boolean }
  | { kind: 'live'; vote: VoteStateV1; canOpen: boolean }
  | { kind: 'voted'; result: 'passed' | 'failed'; vote: VoteStateV1 | null; canOpen: boolean };

export interface ResolutionPickerProps {
  docs: CommitteeDocument[];
  stateOf: (doc: CommitteeDocument) => PickCardState;
  onOpen: (doc: CommitteeDocument) => void;
  isViewOnly: boolean;
  hideTally: boolean;
  docSingular: string;
  docPlural: string;
  sponsorWord: string;
  /** Moderator: open the roll call without choosing a document. */
  onOpenRollCall?: () => void;
  /** Commenter who stopped following: go back to the live vote. */
  onFollowLive?: () => void;
  onBackToSession: () => void;
  /** Session code and chair code: a live DEVICE ballot's card reads its cast count through the
   *  chair-gated `device_vote_status` (choices are not in vote_state until the reveal). */
  code: string;
  chairSuffix?: string | null;
  /** Banners, notices: rendered above the heading. */
  children?: ReactNode;
}

function StatusPill({ state }: { state: PickCardState }) {
  const t = useT();
  const base = 'inline-flex items-center gap-1.5 h-[26px] ps-2.5 pe-3 rounded-full text-[12.5px] font-semibold whitespace-nowrap';
  if (state.kind === 'live') {
    return (
      <span className={base} style={{ backgroundColor: FOREST, color: GOLD }}>
        <span className="relative flex w-[7px] h-[7px]" aria-hidden>
          <span className="gv-pick-ping absolute inset-0 rounded-full" style={{ backgroundColor: GOLD }} />
          <span className="relative w-[7px] h-[7px] rounded-full" style={{ backgroundColor: GOLD }} />
        </span>
        {t('voting_pick_status_live')}
      </span>
    );
  }
  if (state.kind === 'voted') {
    const passed = state.result === 'passed';
    return (
      <span className={base} style={{ backgroundColor: passed ? 'rgba(47,107,69,0.13)' : 'rgba(139,32,32,0.10)', color: passed ? '#2F6B45' : '#8B2020' }}>
        {passed ? <Check size={13} strokeWidth={2.75} aria-hidden /> : <X size={13} strokeWidth={2.75} aria-hidden />}
        {passed ? t('voting_pick_status_passed') : t('voting_pick_status_failed')}
      </span>
    );
  }
  // A paper with no vote yet carries no pill at all (owner, 17 Sep 2026: "remove the
  // 'ready to vote'"): the resting state needs no label, the card's action already says it.
  return null;
}

/** Page one of the paper, small: the PDF through pdf.js (`PdfThumb`, lazy, shared document
 *  cache), a text paper as a miniature page of its opening lines, otherwise a page glyph.
 *  Decorative: the title beside it names the paper. */
const THUMB_W = 92;
const THUMB_H = 120;
function PaperPreview({ doc }: { doc: CommitteeDocument }) {
  const glyph = (
    <span className="w-full h-full rounded-[3px] flex items-center justify-center" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 4px 10px rgba(27,56,40,0.12)' }}>
      <FileText size={28} strokeWidth={1.8} style={{ color: FOREST, opacity: 0.45 }} />
    </span>
  );
  return (
    <div aria-hidden className="gv-pick-paper shrink-0 flex items-center justify-center" style={{ width: THUMB_W, height: THUMB_H }}>
      {doc.fileUrl ? (
        <PdfThumb url={doc.fileUrl} width={THUMB_W} height={THUMB_H} fallback={glyph} />
      ) : doc.content?.trim() ? (
        <span
          className="block w-full h-full overflow-hidden rounded-[3px] px-2 py-2.5"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 1px 2px rgba(27,56,40,0.10), 0 4px 10px rgba(27,56,40,0.12)' }}
        >
          <span className="block text-[6.5px] font-bold leading-[1.25] mb-1 line-clamp-2" style={{ color: INK }}>{doc.title || doc.docCode}</span>
          <span className="block whitespace-pre-wrap text-[5px] leading-[1.45]" style={{ color: '#4A3F33' }}>{doc.content.slice(0, 900)}</span>
        </span>
      ) : glyph}
    </div>
  );
}

function Sponsors({ sponsors, word }: { sponsors: string[]; word: string }) {
  const t = useT();
  const { language } = useLanguage();
  if (sponsors.length === 0) {
    return <p className="text-[13.5px] font-medium" style={{ color: MUTED }}>{t('voting_pick_no_sponsors')}</p>;
  }
  const shown = sponsors.slice(0, 6);
  const extra = sponsors.length - shown.length;
  const names = sponsors.map((s) => getCountryDisplayName(s, language)).join(language === 'ar' ? '، ' : ', ');
  return (
    <div className="min-w-0">
      <div className="flex items-center ps-1.5 mb-2" aria-hidden>
        {shown.map((s, i) => (
          <span key={`${s}-${i}`} className="gv-pick-flag rounded-full -ms-1.5" style={{ zIndex: shown.length - i, boxShadow: `0 0 0 2.5px ${CARD}` }}>
            <SeatCircleFlag country={s} size={26} decorative />
          </span>
        ))}
        {extra > 0 && (
          <span
            className="-ms-1.5 h-[26px] min-w-[26px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums"
            style={{ backgroundColor: '#EDE7D8', color: INK_SOFT, boxShadow: `0 0 0 2.5px ${CARD}` }}
          >
            {t('voting_pick_more', { n: extra })}
          </span>
        )}
      </div>
      {/* The label runs inline with the names instead of sitting above them as a
          letterspaced caps rubric. Same information, one line, no shouting. */}
      <p className="text-[13.5px] leading-snug line-clamp-2" style={{ color: INK_SOFT }} title={names}>
        <span style={{ color: MUTED }}>{word}: </span>{names}
      </p>
    </div>
  );
}

function ProgressLine({ value, total, tone }: { value: number; total: number; tone: 'forest' | 'green' | 'red' }) {
  const { language } = useLanguage();
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const fill = tone === 'forest' ? FOREST : tone === 'green' ? '#2F6B45' : '#8B2020';
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(27,56,40,0.10)' }} aria-hidden>
      <div
        className="h-full rounded-full transition-transform duration-500 motion-reduce:transition-none"
        style={{ backgroundColor: fill, transform: `scaleX(${pct})`, transformOrigin: language === 'ar' ? 'right' : 'left' }}
      />
    </div>
  );
}

/** Cast count of an unrevealed device ballot. null = not read (yet): the count is hidden
 *  rather than shown as 0. A light 5 s poll while the tab is visible. */
function useDeviceCast(code: string, chairSuffix: string | null | undefined, documentId: string, ballot: string | null): number | null {
  const [read, setRead] = useState<{ key: string; cast: number } | null>(null);
  const key = ballot ? `${documentId}:${ballot}` : null;
  useEffect(() => {
    if (!key || !chairSuffix) return;
    let alive = true;
    const load = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const st = await getDeviceVoteStatus(code, documentId, chairSuffix);
      if (!alive || !st) return;
      if (`${documentId}:${st.ballot}` !== key) return;
      setRead((prev) => (prev?.key === key && prev.cast === st.cast ? prev : { key, cast: st.cast }));
    };
    void load();
    const timer = setInterval(() => { void load(); }, 5000);
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [code, chairSuffix, documentId, key]);
  return read && read.key === key ? read.cast : null;
}

function Card({ doc, state, index, props }: { doc: CommitteeDocument; state: PickCardState; index: number; props: ResolutionPickerProps }) {
  const t = useT();
  const { isViewOnly, hideTally, onOpen, sponsorWord } = props;
  const action = !state.canOpen
    ? t('voting_pick_not_started')
    : state.kind === 'live'
    ? (isViewOnly ? t('voting_pick_follow') : t('voting_pick_resume'))
    : state.kind === 'voted'
    ? t('voting_pick_view')
    : t('voting_pick_start');

  const vote = state.kind === 'ready' ? null : state.vote;
  const forCount = vote ? vote.votes.filter((v) => v.choice === 'for' || v.choice === 'for-rights').length : 0;
  const againstCount = vote ? vote.votes.filter((v) => v.choice === 'against' || v.choice === 'against-rights').length : 0;
  const live = state.kind === 'live';
  // An unrevealed device ballot has no votes in vote_state; its count comes from the devices.
  const deviceBallot = live && vote?.method === 'device' && vote.status === 'voting' && vote.currentVoterIndex < vote.order.length
    ? vote.startedAt : null;
  const deviceCast = useDeviceCast(props.code, props.chairSuffix, doc.id, deviceBallot);
  const liveCast = deviceBallot ? deviceCast : vote ? vote.votes.length : 0;

  return (
    <button
      type="button"
      onClick={() => { if (state.canOpen) onOpen(doc); }}
      disabled={!state.canOpen}
      // Concentric: 20px outer radius over 20px padding, inner pills at 999px, the
      // action rule inset by the same padding.
      className="gv-pick-card gv-pick-in group relative text-start rounded-[20px] p-5 flex flex-col gap-4 min-h-[248px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE7D8] disabled:cursor-default"
      style={{
        animationDelay: `${Math.min(index, 8) * 60}ms`,
        backgroundColor: CARD,
        ['--gv-ring' as string]: live ? 'rgba(182,135,31,0.55)' : 'rgba(27,56,40,0.07)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold tabular-nums px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST }}>
          {doc.docCode}
        </span>
        <StatusPill state={state} />
      </div>

      <div className="flex items-start gap-4 min-w-0">
        <PaperPreview doc={doc} />
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <h2 className="text-[19px] leading-[1.28] font-bold line-clamp-3 [text-wrap:balance]" style={{ color: INK, letterSpacing: '-0.006em' }}>
            {doc.title || doc.docCode}
          </h2>
          <Sponsors sponsors={doc.sponsors} word={sponsorWord} />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {live && vote && liveCast !== null && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium tabular-nums" style={{ color: INK_SOFT }}>
              {t('voting_voted_of', { cast: liveCast, total: vote.order.length })}
            </span>
            <ProgressLine value={liveCast} total={vote.order.length} tone="forest" />
          </div>
        )}
        {state.kind === 'voted' && vote && !hideTally && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium tabular-nums" style={{ color: INK_SOFT }}>
              {t('voting_pick_tally', { for: forCount, against: againstCount })}
            </span>
            <ProgressLine value={forCount} total={forCount + againstCount} tone={state.result === 'passed' ? 'green' : 'red'} />
          </div>
        )}
        <div
          className="flex items-center justify-between gap-3 pt-3.5"
          style={{ boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.08)' }}
        >
          <span className="text-[14px] font-semibold" style={{ color: state.canOpen ? FOREST : MUTED }}>{action}</span>
          {state.canOpen && (
            <span
              className="gv-pick-arrow w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: live || state.kind === 'ready' ? FOREST : 'rgba(27,56,40,0.09)', color: live || state.kind === 'ready' ? GOLD : FOREST }}
              aria-hidden
            >
              <ArrowRight size={17} strokeWidth={2.25} className="gv-pick-arrow-icon" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/** Nothing has been introduced yet. This is the only screen that has to teach, so it
 *  names the three steps in order and hands the chair back to the room. */
function EmptyState({ docSingular, isViewOnly, onBackToSession }: {
  docSingular: string;
  isViewOnly: boolean;
  onBackToSession: () => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const doc = docSingular.toLowerCase();
  const steps = [
    t('voting_pick_empty_step_1'),
    t('voting_pick_empty_step_2', { doc }),
    t('voting_pick_empty_step_3'),
  ];
  return (
    <div
      className="gv-pick-in mx-auto mt-[6vh] max-w-[36rem] rounded-[20px] p-7 sm:p-8"
      style={{ backgroundColor: CARD, boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 10px 28px rgba(27,56,40,0.07)' }}
    >
      <h2 className="text-[20px] font-bold leading-snug [text-wrap:balance]" style={{ color: INK }}>
        {t('voting_pick_empty_title', { doc })}
      </h2>
      <p className="text-[15px] mt-2 leading-relaxed [text-wrap:pretty]" style={{ color: INK_SOFT }}>
        {isViewOnly ? t('voting_pick_empty_body_follow', { doc }) : t('voting_pick_empty_body', { doc })}
      </p>

      {!isViewOnly && (
        <>
          <p className="text-[12.5px] font-semibold mt-6 mb-3" style={{ color: MUTED }}>{t('voting_pick_empty_steps_label')}</p>
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12.5px] font-semibold tabular-nums mt-px"
                  style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST }}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="text-[15px] leading-relaxed [text-wrap:pretty]" style={{ color: INK }}>{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <button
        type="button"
        onClick={onBackToSession}
        className="mt-7 inline-flex items-center gap-2 h-11 ps-4 pe-5 rounded-full text-[14px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
        style={{ backgroundColor: FOREST, color: GOLD, boxShadow: '0 1px 2px rgba(27,56,40,0.2), 0 8px 20px rgba(27,56,40,0.18)' }}
      >
        <ArrowLeft size={17} strokeWidth={2.25} aria-hidden style={{ transform: language === 'ar' ? 'scaleX(-1)' : undefined }} />
        {t('voting_pick_empty_cta')}
      </button>
    </div>
  );
}

export function ResolutionPicker(props: ResolutionPickerProps) {
  const t = useT();
  const { language } = useLanguage();
  const { docs, stateOf, isViewOnly, docSingular, docPlural, onOpenRollCall, onFollowLive, onBackToSession, children } = props;
  const states = docs.map((d) => stateOf(d));
  const counts = {
    live: states.filter((s) => s.kind === 'live').length,
    passed: states.filter((s) => s.kind === 'voted' && s.result === 'passed').length,
    failed: states.filter((s) => s.kind === 'voted' && s.result === 'failed').length,
  };
  const cols = Math.min(Math.max(docs.length, 1), 3);

  return (
    <div className="gv-pick flex-1 min-h-0 overflow-y-auto" dir={language === 'ar' ? 'rtl' : undefined} style={{ ['--gv-dir' as string]: language === 'ar' ? -1 : 1 }}>
      <style>{`
        @keyframes gvPickIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes gvPickPing { 0% { transform: scale(1); opacity: .7 } 80%, 100% { transform: scale(2.4); opacity: 0 } }
        .gv-pick .gv-pick-in { animation: gvPickIn 380ms cubic-bezier(0.2,0,0,1) backwards }
        .gv-pick .gv-pick-ping { animation: gvPickPing 1.6s cubic-bezier(0,0,0.2,1) infinite }
        .gv-pick .gv-pick-card {
          box-shadow: 0 0 0 1px var(--gv-ring), 0 1px 2px rgba(27,56,40,0.05), 0 8px 22px rgba(27,56,40,0.07);
          transition: transform 200ms cubic-bezier(0.2,0,0,1), box-shadow 200ms cubic-bezier(0.2,0,0,1);
        }
        .gv-pick .gv-pick-card:not(:disabled):hover {
          transform: translateY(-3px);
          box-shadow: 0 0 0 1px var(--gv-ring), 0 2px 4px rgba(27,56,40,0.07), 0 18px 36px rgba(27,56,40,0.12);
        }
        .gv-pick .gv-pick-card:not(:disabled):active { transform: translateY(-1px) scale(0.99); transition-duration: 90ms }
        .gv-pick .gv-pick-card:disabled { opacity: .72 }
        .gv-pick .gv-pick-arrow { transition: transform 200ms cubic-bezier(0.2,0,0,1) }
        .gv-pick .gv-pick-arrow-icon { transform: scaleX(var(--gv-dir, 1)) }
        .gv-pick .gv-pick-card:not(:disabled):hover .gv-pick-arrow { transform: translateX(calc(var(--gv-dir, 1) * 3px)) }
        .gv-pick .gv-pick-paper { transition: transform 200ms cubic-bezier(0.2,0,0,1) }
        .gv-pick .gv-pick-card:not(:disabled):hover .gv-pick-paper { transform: translateY(-2px) rotate(calc(var(--gv-dir, 1) * -1.5deg)) }
        .gv-pick .gv-pick-flag { transition: transform 200ms cubic-bezier(0.2,0,0,1) }
        .gv-pick .gv-pick-card:not(:disabled):hover .gv-pick-flag { transform: translateY(-2px) }
        @media (prefers-reduced-motion: reduce) {
          .gv-pick .gv-pick-in, .gv-pick .gv-pick-ping { animation: none }
          .gv-pick .gv-pick-card, .gv-pick .gv-pick-arrow, .gv-pick .gv-pick-flag, .gv-pick .gv-pick-paper { transition: none }
          .gv-pick .gv-pick-card:not(:disabled):hover, .gv-pick .gv-pick-card:not(:disabled):active { transform: none }
          .gv-pick .gv-pick-card:not(:disabled):hover .gv-pick-arrow, .gv-pick .gv-pick-card:not(:disabled):hover .gv-pick-flag, .gv-pick .gv-pick-card:not(:disabled):hover .gv-pick-paper { transform: none }
        }
      `}</style>
      {children}
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-8 pt-7 pb-10">
        {/* With nothing to choose, "Choose the draft resolution" would contradict the screen:
            the empty state carries the heading instead. */}
        {docs.length > 0 && (
        <div className="gv-pick-in flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-8 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-[26px] sm:text-[28px] font-bold leading-[1.15] [text-wrap:balance]" style={{ color: INK, letterSpacing: '-0.012em' }}>
              {t('voting_pick_title', { doc: docSingular.toLowerCase() })}
            </h1>
            <p className="text-[15px] mt-1.5 leading-relaxed [text-wrap:pretty]" style={{ color: INK_SOFT }}>
              {isViewOnly ? t('voting_pick_sub_follow') : t('voting_pick_sub')}
            </p>
          </div>
          {docs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {counts.live > 0 && <Count n={counts.live} label={t('voting_pick_status_live')} tone="forest" />}
              {counts.passed > 0 && <Count n={counts.passed} label={t('voting_pick_status_passed')} tone="green" />}
              {counts.failed > 0 && <Count n={counts.failed} label={t('voting_pick_status_failed')} tone="red" />}
              {onOpenRollCall && (
                <button
                  type="button"
                  onClick={onOpenRollCall}
                  className="inline-flex items-center gap-2 h-10 ps-3 pe-4 rounded-full text-[13.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,transform] duration-150 active:scale-[0.96] motion-reduce:transition-none"
                  style={{ backgroundColor: CARD, color: FOREST, boxShadow: '0 0 0 1px rgba(27,56,40,0.12), 0 2px 6px rgba(27,56,40,0.07)' }}
                >
                  <ClipboardList size={16} strokeWidth={2.25} aria-hidden />
                  {t('voting_roll_call_heading')}
                </button>
              )}
              {onFollowLive && (
                <button
                  type="button"
                  onClick={onFollowLive}
                  className="inline-flex items-center gap-2 h-10 ps-3 pe-4 rounded-full text-[13.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
                  style={{ backgroundColor: FOREST, color: GOLD }}
                >
                  <Radio size={15} strokeWidth={2.25} aria-hidden />
                  {t('voting_follow_live')}
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {docs.length === 0 ? (
          <EmptyState docSingular={docSingular} isViewOnly={isViewOnly} onBackToSession={onBackToSession} />
        ) : (
          <div
            className={`grid gap-4 sm:gap-5 grid-cols-1 ${cols >= 2 ? 'md:grid-cols-2' : ''} ${cols >= 3 ? 'xl:grid-cols-3' : ''} ${cols === 1 ? 'max-w-xl' : ''}`}
            aria-label={docPlural}
          >
            {docs.map((doc, i) => <Card key={doc.id} doc={doc} state={states[i]} index={i + 1} props={props} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Count({ n, label, tone }: { n: number; label: string; tone: 'forest' | 'gold' | 'green' | 'red' }) {
  const palette = {
    forest: { bg: FOREST, fg: GOLD },
    gold: { bg: 'rgba(182,135,31,0.15)', fg: '#6A4A0A' },
    green: { bg: 'rgba(47,107,69,0.13)', fg: '#2F6B45' },
    red: { bg: 'rgba(139,32,32,0.10)', fg: '#8B2020' },
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[13.5px] font-medium" style={{ backgroundColor: palette.bg, color: palette.fg }}>
      <span className="font-semibold tabular-nums">{n}</span>
      <span>{label}</span>
    </span>
  );
}
