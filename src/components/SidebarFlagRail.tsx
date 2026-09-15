'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SidebarFlagRail: the chair sidebar, collapsed (15 Sep 2026).
//
// No panel and no rail background: a narrow column that floats on the page ground with
// the committee emblem at the top, then the round flags of the queue in speaking order,
// the delegation holding the floor first (gold ring + microphone), then the list with
// small order numbers. Every item is a button that reopens the sidebar, and so is the
// emblem; the divider beside the column (SidebarResizer) drags it back open too.
//
// Reads the SAME committee object the expanded RollCallPanel is given (the GSL, or the
// caucus queue with `currentSpeaker: null` and the caucus speaker in `caucus`), so the two
// views can never disagree about the order. Read-only: it never writes, never calls
// updateLocal and never touches localUpdateTime (RULES 3/4). Memoised on the fields it
// reads, so a timer tick on the chair page does not re-render it.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';
import type { Committee } from '@/lib/types';
import { getCountryDisplayName } from '@/lib/countries';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { CommitteeEmblem } from '@/components/CommitteeIdentityBadge';
import { liveCaucus } from '@/components/FeedbackLogPanel';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { SIDEBAR_RAIL_WIDTH } from '@/lib/sidebarWidth';

const FLAG = 40;
const SPEAKER_FLAG = 44;
/** Flags drawn before the column says "+N more": keeps it inside an 820px-tall console. */
const MAX_FLAGS = 12;

function SidebarFlagRailInner({
  committee,
  emblem,
  onExpand,
}: {
  committee: Committee;
  emblem: { src: string | null; monogram: string; alt: string };
  onExpand: () => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  // The latest onExpand without making it a memo key: the chair page passes an inline arrow
  // and re-renders every second while a clock runs.
  const expandRef = useRef(onExpand);
  useEffect(() => { expandRef.current = onExpand; });
  const expand = () => expandRef.current();
  const caucus = liveCaucus(committee);
  const byId = new Map(committee.delegates.map((d) => [d.id, d]));
  const speaker = committee.currentSpeaker?.delegateId
    ? byId.get(committee.currentSpeaker.delegateId) ?? null
    : (caucus?.currentSpeaker ? committee.delegates.find((d) => d.country === caucus.currentSpeaker) ?? null : null);
  const queue = (committee.speakersList ?? [])
    .map((s) => byId.get(s.delegateId))
    .filter((d): d is NonNullable<typeof d> => !!d && d.id !== speaker?.id);
  const entries = [
    ...(speaker ? [{ d: speaker, speaking: true }] : []),
    ...queue.map((d) => ({ d, speaking: false })),
  ];
  const shown = entries.slice(0, MAX_FLAGS);
  const more = entries.length - shown.length;
  const expandLabel = t('sidebar_expand');

  return (
    <nav aria-label={t('sidebar_rail_label')} className="h-full flex flex-col items-center" style={{ width: SIDEBAR_RAIL_WIDTH, paddingBlock: 12 }}>
      <button
        type="button"
        onClick={expand}
        aria-label={expandLabel}
        title={expandLabel}
        aria-expanded={false}
        className="shrink-0 rounded-full p-1 transition-transform duration-150 hover:scale-[1.04] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
      >
        <CommitteeEmblem src={emblem.src} monogram={emblem.monogram} alt="" size={46} onLight />
      </button>
      <ol className="m-0 p-0 list-none flex flex-col items-center gap-2.5 mt-4 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingBlock: 6, paddingInline: 8 }}>
        {shown.map(({ d, speaking }, i) => {
          // Same numbering as the expanded list: the floor is #1, the queue follows.
          const n = i + 1;
          const name = getCountryDisplayName(d.country, language);
          const label = speaking ? `${name}, ${t('rollcall_speaking')}` : t('sidebar_rail_item', { country: name, n });
          const px = speaking ? SPEAKER_FLAG : FLAG;
          return (
            <li key={d.id} className="relative shrink-0">
              <button
                type="button"
                onClick={expand}
                aria-label={`${label}. ${expandLabel}`}
                title={label}
                className="relative block rounded-full transition-transform duration-150 hover:scale-[1.06] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE7D8]"
              >
                <SeatCircleFlag
                  country={d.country}
                  size={px}
                  decorative
                  ring={speaking ? false : 'rgba(28,20,16,0.14)'}
                  style={{
                    boxShadow: speaking
                      ? '0 0 0 2.5px #EED98A, 0 0 0 4px #1B3828, 0 3px 10px rgba(27,56,40,0.35)'
                      : '0 1px 2px rgba(27,56,40,0.28), 0 3px 9px rgba(27,56,40,0.20)',
                    opacity: d.status === 'absent' ? 0.55 : 1,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute -top-1 -end-1.5 min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center font-black leading-none text-[10.5px] tabular-nums"
                  style={{ backgroundColor: speaking ? '#EED98A' : '#1B3828', color: speaking ? '#1B3828' : '#EDE7D8', boxShadow: '0 0 0 1.5px #EDE7D8, 0 1px 3px rgba(0,0,0,0.25)' }}
                >
                  {speaking ? <Mic size={10} strokeWidth={3} /> : n}
                </span>
              </button>
            </li>
          );
        })}
        {more > 0 && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={expand}
              aria-label={`${t('sidebar_rail_more', { n: more })}. ${expandLabel}`}
              className="rounded-full px-2 py-1 tabular-nums transition-colors hover:bg-[rgba(27,56,40,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
              style={{ fontSize: 11, fontWeight: 800, color: '#1B3828' }}
            >
              {t('sidebar_rail_more', { n: more })}
            </button>
          </li>
        )}
      </ol>
    </nav>
  );
}

const SidebarFlagRail = React.memo(SidebarFlagRailInner, (a, b) =>
  a.committee.delegates === b.committee.delegates
  && a.committee.speakersList === b.committee.speakersList
  && a.committee.currentSpeaker === b.committee.currentSpeaker
  && a.committee.caucus?.currentSpeaker === b.committee.caucus?.currentSpeaker
  && a.committee.phase === b.committee.phase
  && a.emblem.src === b.emblem.src
  && a.emblem.monogram === b.emblem.monogram,
);

export default SidebarFlagRail;
