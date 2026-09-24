'use client';

/**
 * VotingHeader: the one bar across the top of /voting/[code].
 *
 * Owner, 17 Sep 2026: "Simply the top right with settings, scoreboard, chat and code needs to
 * stay the same all throughout." The inline-end cluster is the chair console's own, built from
 * the same primitives (src/components/ChairTopBar.tsx) with the same sizes, order and
 * `data-tutorial` targets, so the dialogs grow out of the same icons:
 *   session code (click to present it full screen, SessionCodePresenter) · Chat (unread count)
 *   · Scoreboard · Settings.
 * It is identical on every voting screen: the resolution list, the roll call's page behind
 * it, the ballot, the rights speakers and the result.
 *
 * Inline-start stays simple: Session (the way back) and the draft resolution on the floor
 * (the list crumb goes back to the list). While the roll call is open the page hands this
 * bar the roll call's own Back (`backLabel` + `onBack`) and drops the list crumb, so there
 * is ONE Back in the top left and no "Draft Resolutions" (owner, 17 Sep 2026). Between them and the cluster: where the vote stands
 * (cast / total, never the direction) and End debate, a solid red button with its label
 * (owner, 17 Sep 2026: "Make End debate more striking"), still behind the page's
 * confirmation. There is no voting-rules popover any more (owner: "remove 'voting rules'
 * altogether, it's in Settings anyway"); the rules live in Settings → Voting and in the roll
 * call's bookmarks. The tally toggle is no longer here: it sits under the
 * ballot (owner: "the hide tally needs to be moved to the bottom, below voting").
 *
 * Declared at module scope and stable across renders.
 */

import { useCallback, useState } from 'react';
import { ArrowLeft, ChevronRight, Flag, Maximize2, MessageCircle, Settings, Trophy } from 'lucide-react';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { TopBarIconButton } from '@/components/ChairTopBar';
import SessionCodePresenter from '@/components/SessionCodePresenter';

const INK = '#1C1410';
const INK_SOFT = '#6A5A4A';
const FOREST = '#1B3828';

const QUIET_BTN =
  'inline-flex items-center justify-center gap-2 h-9 min-w-9 rounded-xl text-[13.5px] font-semibold shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.96] motion-reduce:transition-none disabled:opacity-50';

export interface VotingHeaderProps {
  onBack: () => void;
  /** Overrides the inline-start button's label. The roll call passes its own Back here, so
   *  there is ONE Back in the top left while it is open (owner, 17 Sep 2026). */
  backLabel?: string;
  backBusy?: boolean;
  /** The document on the floor, when one is open. */
  doc?: { code: string; title: string } | null;
  /** Label of the document list crumb ("Draft Resolutions"); with `onDocs` it is a button. */
  docsLabel?: string;
  onDocs?: () => void;
  /** Where the vote stands. Cast count only, never the direction of the vote. */
  progress?: { stage: string; cast: number; total: number } | null;
  /** Commenter (or a same-name second device): UI gate only. No End debate. */
  isViewOnly: boolean;
  onEndDebate: () => void;
  /** The SESSION code, never the chair code. */
  sessionCode: string;
  /** Null when the room has ended (the chair page hides chat then too). */
  chat: { unread: number; open: boolean; onToggle: () => void } | null;
  onOpenScoreboard: () => void;
  onOpenSettings: () => void;
}

export function VotingHeader({
  onBack, backLabel, backBusy = false, doc, docsLabel, onDocs, progress,
  isViewOnly, onEndDebate, sessionCode, chat, onOpenScoreboard, onOpenSettings,
}: VotingHeaderProps) {
  const t = useT();
  const { language } = useLanguage();
  const rtl = language === 'ar';
  const backText = backLabel ?? t('voting_hdr_back');
  const pct = progress && progress.total > 0 ? Math.min(1, progress.cast / progress.total) : 0;
  const [codeOrigin, setCodeOrigin] = useState<DOMRect | null>(null);
  const closeCode = useCallback(() => setCodeOrigin(null), []);

  return (
    <header
      className="relative z-20 bg-[#FAF8F3] ps-2 pe-3 h-11 flex items-center gap-1.5 shrink-0"
      style={{ boxShadow: '0 1px 0 rgba(27,56,40,0.07)' }}
      data-tutorial="topbar"
    >
      {/* Way out */}
      <button
        type="button"
        onClick={onBack}
        disabled={backBusy}
        title={backLabel ?? t('voting_hdr_back_title')}
        aria-label={backLabel ?? t('voting_hdr_back_title')}
        className={`${QUIET_BTN} sm:ps-2 sm:pe-3 hover:bg-[rgba(27,56,40,0.07)] hover:text-[#1C1410]`}
        style={{ color: INK_SOFT }}
      >
        <ArrowLeft size={17} strokeWidth={2.25} aria-hidden style={{ transform: rtl ? 'scaleX(-1)' : undefined }} />
        <span className="hidden sm:inline">{backText}</span>
      </button>

      {/* The document on the floor */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 ps-1">
        {docsLabel && (
          onDocs ? (
            <button
              type="button"
              onClick={onDocs}
              className="hidden md:inline-flex items-center h-8 px-2.5 rounded-lg text-[14px] font-medium shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,color] duration-150 hover:bg-[rgba(27,56,40,0.07)] hover:text-[#1C1410]"
              style={{ color: INK_SOFT }}
            >
              {docsLabel}
            </button>
          ) : (
            <span className="text-[15px] font-semibold truncate px-1" style={{ color: INK }}>{docsLabel}</span>
          )
        )}
        {doc && (
          <>
            {docsLabel && onDocs && (
              <ChevronRight size={15} className="shrink-0 hidden md:block" style={{ color: '#9A8A78', transform: rtl ? 'scaleX(-1)' : undefined }} aria-hidden />
            )}
            <span className="shrink-0 text-[12.5px] font-semibold tabular-nums px-2 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(27,56,40,0.09)', color: FOREST }}>
              {doc.code}
            </span>
            <span className="min-w-0 truncate text-[14.5px] font-semibold hidden lg:inline" style={{ color: INK }} title={doc.title}>
              {doc.title}
            </span>
          </>
        )}
      </div>

      {/* Where the vote stands */}
      {progress && (
        <div className="hidden md:flex flex-col justify-center gap-1 w-[150px] shrink-0 me-1" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium truncate" style={{ color: INK_SOFT }}>{progress.stage}</span>
            <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: INK }}>{progress.cast}/{progress.total}</span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(27,56,40,0.10)' }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.cast}
            aria-label={t('voting_voted_of', { cast: progress.cast, total: progress.total })}
          >
            <div
              className="h-full rounded-full transition-transform duration-500 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
              style={{ backgroundColor: FOREST, transform: `scaleX(${pct})`, transformOrigin: rtl ? 'right' : 'left' }}
            />
          </div>
        </div>
      )}

      {!isViewOnly && (
        <button
          type="button"
          onClick={onEndDebate}
          aria-label={t('voting_hdr_end')}
          title={t('voting_hdr_end')}
          className="gv-end-debate inline-flex items-center justify-center gap-2 h-8 min-w-8 px-2.5 sm:ps-3 sm:pe-3.5 rounded-lg text-[13.5px] font-bold shrink-0 ms-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-1 transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.96] motion-reduce:transition-none"
          style={{ backgroundColor: '#A32424', color: '#FFFFFF', boxShadow: '0 0 0 1px rgba(90,20,20,0.35), 0 1px 2px rgba(90,20,20,0.3), 0 4px 12px rgba(139,32,32,0.28)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#8B1A1A'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#A32424'; }}
        >
          <Flag size={15} strokeWidth={2.5} aria-hidden fill="currentColor" />
          <span className="hidden sm:inline whitespace-nowrap">{t('voting_hdr_end')}</span>
        </button>
      )}

      {/* ── The chair console's cluster, unchanged on every screen ── */}
      <button
        type="button"
        onClick={(e) => setCodeOrigin(e.currentTarget.getBoundingClientRect())}
        data-tutorial="join-code"
        aria-haspopup="dialog"
        aria-expanded={!!codeOrigin}
        aria-label={t('chair_hdr_show_code', { code: sessionCode })}
        title={t('chair_hdr_show_code', { code: sessionCode })}
        className="shrink min-w-0 max-w-[9.5rem] inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#EDE7D8] hover:bg-[#E2DAC8] text-[#1C1410] transition-[background-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.96] ms-1 me-1"
        style={{ fontFamily: "var(--font-brand), sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: '0.08em' }}
      >
        <Maximize2 size={13} strokeWidth={2.4} aria-hidden className="shrink-0" style={{ opacity: 0.6 }} />
        <span className="tabular-nums truncate min-w-0">{sessionCode}</span>
      </button>
      {codeOrigin && <SessionCodePresenter code={sessionCode} origin={codeOrigin} onClose={closeCode} />}
      {chat && (
        <TopBarIconButton
          tutorial="tab-chat"
          onClick={chat.onToggle}
          active={chat.open}
          count={chat.open ? 0 : chat.unread}
          label={!chat.open && chat.unread > 0 ? t('chair_hdr_chat_unread', { n: chat.unread }) : t('tab_chat')}
        >
          <MessageCircle size={21} strokeWidth={2} aria-hidden />
        </TopBarIconButton>
      )}
      <TopBarIconButton tutorial="tab-scoreboard" onClick={onOpenScoreboard} label={t('chair_hdr_scoreboard')}>
        <Trophy size={21} strokeWidth={2} aria-hidden />
      </TopBarIconButton>
      <TopBarIconButton tutorial="tab-settings" onClick={onOpenSettings} label={t('chair_hdr_settings')}>
        <Settings size={21} strokeWidth={2} aria-hidden />
      </TopBarIconButton>
    </header>
  );
}
