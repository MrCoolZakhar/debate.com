'use client';

// One student, up close: where they are now, today's objective counts beside the room
// average, a newest-first timeline, the papers they sponsor, and the two coaching cues.
// Never points, rank, ratings, chair notes or nominations (owner).

import { useMemo } from 'react';
import { Clock3, FileText, Gavel, Info, ListPlus, MessageSquareReply, Mic } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { describeMotion, type MotionFields } from '@/lib/motionLog';
import { serverNow } from '@/lib/serverClock';
import {
  countsFor, cuesFor, papersFor, roomAverage, timelineFor,
  type MotionItem, type SeatState, type TimelineItem,
} from '@/lib/advisorBoard/derive';
import type { FollowedSeat, RoomData } from '@/lib/advisorBoard/types';
import type { TranslationKey } from '@/lib/translations';
import BottomSheet from './BottomSheet';
import { StateLine, seatSubtitle, seatTitle } from './SeatCard';
import { C, FONT, avg, duration } from './tokens';

const CONTEXT_KEY: Record<string, TranslationKey> = {
  'speakers-list': 'sb_hist_seg_gsl',
  'moderated-caucus': 'sb_hist_seg_moderated',
  'unmoderated-caucus': 'sb_hist_seg_unmoderated',
  'tour-de-table': 'sb_hist_seg_tour',
};

const OUTCOME_KEY: Record<NonNullable<MotionItem['outcome']>, TranslationKey> = {
  passed: 'sb_hist_motion_passed',
  rejected: 'sb_hist_motion_rejected',
  failed: 'sb_hist_motion_failed',
  fell: 'sb_hist_motion_fell',
};

const DOC_STATUS_KEY: Record<string, TranslationKey> = {
  submitted: 'adv_doc_submitted',
  'on-floor': 'adv_doc_on_floor',
  introduced: 'adv_doc_introduced',
  passed: 'adv_doc_passed',
  failed: 'adv_doc_failed',
};

function timeOf(iso: string | null, language: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(d);
}

export default function StudentSheet({
  seat,
  state,
  room,
  onClose,
}: {
  seat: FollowedSeat;
  state: SeatState;
  room: RoomData | null;
  onClose: () => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const country = state.delegate?.country ?? seat.country;
  const committeeName = room?.name ?? seat.committeeName;

  const data = useMemo(() => {
    if (!room) return null;
    return {
      counts: countsFor(room, country),
      average: roomAverage(room),
      timeline: timelineFor(room, country),
      papers: papersFor(room, country),
    };
  }, [room, country]);
  // Read once per open; the cues are about 90-minute stretches, not seconds.
  const cues = useMemo(() => cuesFor(room, state, country, seat.followingSince, serverNow()), [room, state, country, seat.followingSince]);

  return (
    <BottomSheet open onClose={onClose} title={seatTitle(seat, language)} closeLabel={t('adv_close')}>
      <div style={{ fontFamily: FONT }}>
        <div className="flex items-center gap-4">
          <CircleFlag country={seat.country} code={seat.countryCode} logoUrl={state.delegate?.logoUrl ?? null} size={72} decorative loading="eager" />
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft }}>{seatSubtitle(seat, committeeName, language) || committeeName}</div>
            <div className="mt-1"><StateLine state={state} big /></div>
            {state.caucusLabel && <div className="mt-0.5 truncate" style={{ fontSize: 13, color: C.inkSoft }}>{state.caucusLabel}</div>}
          </div>
        </div>

        {(cues.notOnList || cues.quiet) && (
          <ul className="mt-4 flex flex-col gap-2">
            {cues.notOnList && <Cue icon={<ListPlus size={17} aria-hidden />} text={t('adv_cue_not_on_list')} />}
            {cues.quiet && <Cue icon={<Clock3 size={17} aria-hidden />} text={t('adv_cue_quiet')} />}
          </ul>
        )}

        {!room && (
          <p className="mt-5" style={{ fontSize: 14.5, color: C.inkSoft }}>{t('adv_sheet_no_room')}</p>
        )}

        {data && (
          <>
            <h3 className="mb-2 mt-6" style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.forestSoft }}>{t('adv_today')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t('adv_stat_speeches')} value={String(data.counts.speeches)} average={data.average ? avg(data.average.speeches) : null} />
              <Stat label={t('adv_stat_time')} value={duration(data.counts.seconds)} average={data.average ? duration(data.average.seconds) : null} />
              <Stat label={t('adv_stat_motions_raised')} value={String(data.counts.motionsRaised)} average={data.average ? avg(data.average.motionsRaised) : null} />
              <Stat label={t('adv_stat_motions_passed')} value={String(data.counts.motionsPassed)} average={data.average ? avg(data.average.motionsPassed) : null} />
            </div>
            <p className="mt-2 flex items-start gap-1.5" style={{ fontSize: 12.5, color: C.inkSoft }}>
              <Info size={14} aria-hidden className="mt-px shrink-0" />
              {t('adv_average_note')}
            </p>

            <h3 className="mb-2 mt-6" style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.forestSoft }}>{t('adv_timeline')}</h3>
            {data.timeline.length === 0 ? (
              <p style={{ fontSize: 14, color: C.inkSoft }}>{t('adv_timeline_empty')}</p>
            ) : (
              <ol className="flex flex-col">
                {data.timeline.map((item, i) => <TimelineRow key={i} item={item} />)}
              </ol>
            )}

            {data.papers.length > 0 && (
              <>
                <h3 className="mb-2 mt-6" style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.forestSoft }}>{t('adv_papers')}</h3>
                <ul className="flex flex-col gap-1.5">
                  {data.papers.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: C.surface }}>
                      <FileText size={17} aria-hidden style={{ color: C.forestSoft }} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>
                          {p.docCode ? `${p.docCode} · ` : ''}{p.title}
                        </span>
                      </span>
                      <span className="shrink-0" style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft }}>
                        {DOC_STATUS_KEY[p.status] ? t(DOC_STATUS_KEY[p.status]) : p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

      </div>
    </BottomSheet>
  );
}

function Cue({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(238,217,138,0.35)', color: '#5A4210' }}>
      <span className="shrink-0">{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700 }}>{text}</span>
    </li>
  );
}

function Stat({ label, value, average }: { label: string; value: string; average: string | null }) {
  const t = useT();
  return (
    <div className="rounded-2xl px-3.5 py-3" style={{ backgroundColor: '#fff', boxShadow: `inset 0 0 0 1px ${C.hairline}` }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.forest, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{value}</div>
      {average !== null && (
        <div style={{ fontSize: 12.5, fontWeight: 500, color: C.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{t('adv_room_average', { value: average })}</div>
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const t = useT();
  const { language } = useLanguage();
  let icon: React.ReactNode;
  let title: string;
  let detail: string | null = null;
  if (item.kind === 'speech') {
    icon = <Mic size={15} aria-hidden />;
    title = item.context && CONTEXT_KEY[item.context] ? t(CONTEXT_KEY[item.context]) : t('sb_hist_seg_other');
    detail = duration(item.seconds);
  } else if (item.kind === 'reply') {
    icon = <MessageSquareReply size={15} aria-hidden />;
    title = t('adv_right_of_reply');
  } else {
    icon = <Gavel size={15} aria-hidden />;
    const m = item.motion;
    const fields: MotionFields = {
      motionType: m.motionType as MotionFields['motionType'],
      topic: m.topic, totalTime: m.totalTime, speakingTime: m.speakingTime,
    };
    title = describeMotion(null, fields, language) ?? t('adv_motion');
    detail = m.outcome ? t(OUTCOME_KEY[m.outcome]) : null;
  }
  return (
    <li className="flex items-start gap-3 py-2.5" style={{ boxShadow: `0 1px 0 ${C.hairline}` }}>
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: C.surface, color: C.forest }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{title}</span>
        {item.kind === 'motion' && <span className="block" style={{ fontSize: 12.5, color: C.inkSoft }}>{t('adv_motion_raised')}</span>}
      </span>
      <span className="shrink-0 text-end">
        {detail && <span className="block" style={{ fontSize: 14, fontWeight: 700, color: C.forest, fontVariantNumeric: 'tabular-nums' }}>{detail}</span>}
        <span className="block" style={{ fontSize: 12.5, color: C.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{timeOf(item.at, language)}</span>
      </span>
    </li>
  );
}
