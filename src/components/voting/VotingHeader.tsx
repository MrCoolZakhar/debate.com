'use client';

/**
 * VotingHeader: the one bar across the top of /voting/[code].
 *
 * Reads start to end the way a chair thinks about the screen:
 *   Session (a quiet way out) · the committee (emblem + acronym) · the document on the
 *   floor (code + title, the document crumb goes back to the list) · where the vote is
 *   (stage + cast/total with a slim progress line) · who is driving (Moderator chip, or
 *   "Following {name}" for a Commenter) · tally, rules, settings · End debate.
 *
 * End debate is destructive but understated: red ink, no fill, and the page always puts a
 * confirmation in front of it. The progress line shows ballots CAST only, never the
 * direction of the vote, so it is safe with the tally hidden.
 *
 * Declared at module scope and stable across renders: the rules popover it hosts keeps its
 * open state while votes are being cast.
 */

import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Eye, EyeOff, Flag, Gavel, Settings } from 'lucide-react';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { CommitteeEmblem } from '@/components/CommitteeIdentityBadge';
import type { VotingCommitteeIdentity } from '@/components/voting/useCommitteeEmblem';

const INK = '#1C1410';
const INK_SOFT = '#6A5A4A';
const FOREST = '#1B3828';
const GOLD = '#EED98A';

const QUIET_BTN =
  'inline-flex items-center justify-center gap-2 h-10 min-w-10 rounded-full text-[13px] font-bold shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.96] motion-reduce:transition-none disabled:opacity-50';

export interface VotingHeaderProps {
  identity: VotingCommitteeIdentity;
  onBack: () => void;
  backBusy?: boolean;
  /** The document on the floor, when one is open. */
  doc?: { code: string; title: string } | null;
  /** Label of the document list crumb ("Draft Resolutions"); with `onDocs` it is a button. */
  docsLabel?: string;
  onDocs?: () => void;
  /** Where the vote stands. Cast count only, never the direction of the vote. */
  progress?: { stage: string; cast: number; total: number } | null;
  /** Commenter (or a same-name second device): UI gate only. */
  isViewOnly: boolean;
  /** The chair holding the gavel, for the Commenter's chip. */
  headName?: string | null;
  tally?: { hidden: boolean; onToggle: () => void } | null;
  rules?: ReactNode;
  onOpenSettings: () => void;
  onEndDebate: () => void;
}

/** Show / hide the running tally. Both icons stay mounted and cross-fade. */
function TallyButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const t = useT();
  const icon = 'absolute inset-0 m-auto transition-[opacity,transform,filter] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';
  const off = { opacity: 0, transform: 'scale(0.25)', filter: 'blur(4px)' };
  const on = { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' };
  const label = hidden ? t('voting_show_tally') : t('voting_hide_tally');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={`${QUIET_BTN} xl:ps-3 xl:pe-3.5`}
      style={{ backgroundColor: hidden ? FOREST : 'transparent', color: hidden ? GOLD : '#4A3F33' }}
      onMouseEnter={(e) => { if (!hidden) e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.08)'; }}
      onMouseLeave={(e) => { if (!hidden) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <span className="relative w-[17px] h-[17px] shrink-0" aria-hidden>
        <Eye size={17} strokeWidth={2.25} className={icon} style={hidden ? off : on} />
        <EyeOff size={17} strokeWidth={2.25} className={icon} style={hidden ? on : off} />
      </span>
      <span className="hidden xl:inline">{hidden ? t('voting_tally_hidden') : t('voting_hide_tally')}</span>
    </button>
  );
}

export function VotingHeader({
  identity, onBack, backBusy = false, doc, docsLabel, onDocs, progress,
  isViewOnly, headName, tally, rules, onOpenSettings, onEndDebate,
}: VotingHeaderProps) {
  const t = useT();
  const { language } = useLanguage();
  const rtl = language === 'ar';
  const pct = progress && progress.total > 0 ? Math.min(1, progress.cast / progress.total) : 0;

  return (
    <header
      className="relative z-20 h-14 shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4"
      style={{ backgroundColor: '#F0EBDD', boxShadow: '0 1px 0 rgba(27,56,40,0.07), 0 6px 18px rgba(27,56,40,0.06)' }}
    >
      {/* Way out */}
      <button
        type="button"
        onClick={onBack}
        disabled={backBusy}
        title={t('voting_hdr_back_title')}
        aria-label={t('voting_hdr_back_title')}
        className={`${QUIET_BTN} sm:ps-2.5 sm:pe-3.5`}
        style={{ color: INK_SOFT }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.08)'; e.currentTarget.style.color = INK; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = INK_SOFT; }}
      >
        <ArrowLeft size={17} strokeWidth={2.25} aria-hidden style={{ transform: rtl ? 'scaleX(-1)' : undefined }} />
        <span className="hidden sm:inline">{t('voting_hdr_back')}</span>
      </button>

      {/* Identity + the document on the floor */}
      <div className="flex-1 min-w-0 flex items-center gap-2 ps-1 sm:ps-2">
        <CommitteeEmblem src={identity.src} monogram={identity.monogram} alt={identity.primary} size={30} onLight />
        <span
          className="text-[15px] font-black truncate shrink-0 max-w-[10rem] lg:max-w-[16rem]"
          style={{ color: INK }}
          title={identity.secondary ?? identity.primary}
        >
          {identity.primary}
        </span>
        {docsLabel && (
          <>
            <ChevronRight size={15} className="shrink-0 hidden md:block" style={{ color: '#9A8A78', transform: rtl ? 'scaleX(-1)' : undefined }} aria-hidden />
            {onDocs ? (
              <button
                type="button"
                onClick={onDocs}
                className="hidden md:inline-flex items-center h-8 px-2.5 rounded-full text-[13px] font-semibold shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,color] duration-150"
                style={{ color: INK_SOFT }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.08)'; e.currentTarget.style.color = INK; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = INK_SOFT; }}
              >
                {docsLabel}
              </button>
            ) : (
              <span className="hidden md:inline text-[13px] font-semibold shrink-0 px-1" style={{ color: INK_SOFT }}>{docsLabel}</span>
            )}
          </>
        )}
        {doc && (
          <>
            <ChevronRight size={15} className="shrink-0" style={{ color: '#9A8A78', transform: rtl ? 'scaleX(-1)' : undefined }} aria-hidden />
            <span
              className="shrink-0 text-[12px] font-black tabular-nums px-2 py-1 rounded-md"
              style={{ backgroundColor: 'rgba(27,56,40,0.09)', color: FOREST }}
            >
              {doc.code}
            </span>
            <span className="min-w-0 truncate text-[14px] font-bold hidden lg:inline" style={{ color: INK }} title={doc.title}>
              {doc.title}
            </span>
          </>
        )}
      </div>

      {/* Where the vote stands */}
      {progress && (
        <div className="hidden md:flex flex-col justify-center gap-1 w-[150px] shrink-0 me-1" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] truncate" style={{ color: '#8A6414' }}>{progress.stage}</span>
            <span className="text-[12px] font-bold tabular-nums shrink-0" style={{ color: INK }}>{progress.cast}/{progress.total}</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
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

      {/* Who is driving */}
      {isViewOnly ? (
        <span
          className="hidden sm:inline-flex items-center gap-1.5 h-8 ps-2.5 pe-3 rounded-full text-[12px] font-bold shrink-0 max-w-[13rem]"
          style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: INK_SOFT }}
          title={t('voting_view_only_note')}
        >
          <Eye size={14} strokeWidth={2.25} aria-hidden className="shrink-0" />
          <span className="truncate">{headName ? t('voting_role_following', { name: headName }) : t('voting_view_only_badge')}</span>
        </span>
      ) : (
        <span
          className="hidden sm:inline-flex items-center gap-1.5 h-8 ps-2.5 pe-3 rounded-full text-[12px] font-black shrink-0"
          style={{ backgroundColor: FOREST, color: GOLD, boxShadow: '0 1px 2px rgba(27,56,40,0.25)' }}
        >
          <Gavel size={14} strokeWidth={2.25} aria-hidden />
          {t('gavel_chairing_badge')}
        </span>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        {tally && <TallyButton hidden={tally.hidden} onToggle={tally.onToggle} />}
        {rules}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t('voting_hdr_settings')}
          title={t('voting_hdr_settings')}
          className={QUIET_BTN}
          style={{ color: '#4A3F33' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Settings size={17} strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      {!isViewOnly && (
        <button
          type="button"
          onClick={onEndDebate}
          aria-label={t('voting_hdr_end')}
          title={t('voting_hdr_end')}
          className={`${QUIET_BTN} lg:ps-3 lg:pe-3.5 ms-1`}
          style={{ color: '#8B2020' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(139,32,32,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Flag size={16} strokeWidth={2.25} aria-hidden />
          <span className="hidden lg:inline">{t('voting_hdr_end')}</span>
        </button>
      )}
    </header>
  );
}
