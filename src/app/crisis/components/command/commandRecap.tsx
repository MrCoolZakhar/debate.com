'use client';
// Gavelling Crisis: the recap pop-up of one front room on Command. It is the organiser's session recap (the same shell, rail
// and bookmark tabs as src/app/manage/[slug]/live/LiveModals.tsx RecapModal), but the Documents tab is replaced by the two things
// a crisis room is run on: "Cabinet Directives" (that cabinet's directives, title first, with their status) and "Crisis News"
// (what was sent to that cabinet or to every room). Overview, Scoreboard, History and Attendance are the organiser's own pieces,
// reused as they are. The chair's Front Room lists the same two things (cabinetFeeds.tsx), so both sides see the same.
// Nothing here writes.

import { useMemo, type ReactNode } from 'react';
import { History as HistoryIcon, Newspaper, Radio, ScrollText, Trophy, Users } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { LogoDisc } from '@/components/LogoDisc';
import { NEU, OUTFIT } from '@/components/neu';
import { computeScores, flagCodeFor, fmtSpeakingTotal, ModalShell, PHASE_LABELS, presence, RailTab, RosterBody, type LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import { committeeIdentity } from '@/app/manage/[slug]/live/identity';
import { SessionLoadState, SessionScoreboardBoard } from '@/app/manage/[slug]/live/SessionBoard';
import { useSessionCommittee } from '@/app/manage/[slug]/live/useSessionCommittee';
import { SOFT } from '@/app/manage/[slug]/live/tokens';
import type { Directive, News } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';
import { CabinetDirectivesList, CrisisNewsList, cabinetDirectivesOf, cabinetNewsOf } from './cabinetFeeds';

export type CrisisRecapTab = 'overview' | 'directives' | 'news' | 'scoreboard' | 'history' | 'attendance';

/** A big number with the word beside it. */
function Stat({ n, word }: { n: string | number; word: string }) {
  return (
    <div style={{ background: NEU.base, borderRadius: 14, padding: '11px 14px', boxShadow: NEU.inSm, fontFamily: OUTFIT }}>
      <b style={{ display: 'block', fontSize: 24, lineHeight: 1, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: NEU.ink }}>{n}</b>
      <span style={{ display: 'block', marginTop: 4, fontSize: 12, fontWeight: 600, color: SOFT }}>{word}</span>
    </div>
  );
}

export default function CrisisRecap({ data, cabinetId, tab, onTab, directives, news, floorDetail, onOpenDirective, onOpenNews, onOpenScoreboard, onClose }: {
  data: LiveCommittee;
  cabinetId: string;
  tab: CrisisRecapTab;
  onTab: (t: CrisisRecapTab) => void;
  directives: Directive[] | null;
  news: News[] | null;
  floorDetail: ReactNode;
  onOpenDirective: (d: Directive) => void;
  onOpenNews: (n: News) => void;
  onOpenScoreboard: () => void;
  onClose: () => void;
}) {
  const session = data.session;
  const ident = committeeIdentity(data.conf);
  const phaseLabel = !session ? 'No session' : session.endedAt ? 'Adjourned' : session.phase === 'adjourned' ? 'Suspended' : (PHASE_LABELS[session.phase] ?? session.phase);

  // The session itself (for Scoreboard and History) is read the first time one of them opens, then kept.
  const wantsSession = tab === 'scoreboard' || tab === 'history';
  const live = useSessionCommittee(wantsSession ? session?.code : null);

  const directiveCount = useMemo(() => cabinetDirectivesOf(directives, cabinetId)?.length ?? 0, [directives, cabinetId]);
  const newsCount = useMemo(() => cabinetNewsOf(news, cabinetId)?.length ?? 0, [news, cabinetId]);

  const speeches = data.speechLogs.length;
  const motionsLogged = data.eventLogs.filter((e) => e.type === 'motion-raised').length;
  const speakingSeconds = data.speechLogs.reduce((sum, l) => sum + (l.seconds || 0), 0);
  const { present, total: votingTotal } = presence(data);
  const scores = computeScores(data).sort((a, b) => b.total - a.total);
  const top = scores[0];
  const quietest = scores.length > 1 ? scores[scores.length - 1] : undefined;

  const rail = (side: boolean) => (
    <>
      <RailTab side={side} icon={Radio} label="Overview" active={tab === 'overview'} onClick={() => onTab('overview')} title="What this room is doing now and what it has done" />
      <RailTab side={side} icon={ScrollText} label="Cabinet Directives" count={directiveCount} active={tab === 'directives'} onClick={() => onTab('directives')} title="The directives sent in this cabinet's name, with where each one stands" />
      <RailTab side={side} icon={Newspaper} label="Crisis News" count={newsCount} active={tab === 'news'} onClick={() => onTab('news')} title="The news this cabinet has received, its own and everyone's" />
      <RailTab side={side} icon={Trophy} label="Scoreboard" active={tab === 'scoreboard'} onClick={() => onTab('scoreboard')} title="The full delegate performance table, the same one the chairs score from" />
      <RailTab side={side} icon={HistoryIcon} label="History" active={tab === 'history'} onClick={() => onTab('history')} title="The session in the order it happened" />
      <RailTab side={side} icon={Users} label="Attendance" count={votingTotal} active={tab === 'attendance'} onClick={() => onTab('attendance')} title="The roll: present, present and voting, absent" />
    </>
  );

  const heading = (text: string) => <h3 style={{ margin: '0 0 8px', fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: NEU.ink }}>{text}</h3>;

  return (
    <ModalShell onClose={onClose} maxWidth={760} rail={rail}>
      <div className="flex items-center gap-3.5 mb-1" style={{ paddingInlineEnd: 36 }}>
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={ident.mono} alt={ident.title} />
        <div className="min-w-0">
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: SOFT }}>Session recap</p>
          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
            <h2 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1, margin: 0 }}>{ident.title}</h2>
            <span style={{ fontSize: 13, fontWeight: 700, color: NEU.forest, fontFamily: OUTFIT }}>{phaseLabel}</span>
          </div>
        </div>
      </div>
      {ident.subtitle ? <p className="text-sm mb-5" style={{ color: SOFT, fontFamily: OUTFIT }}>{ident.subtitle}</p> : <div className="mb-5" />}

      {tab === 'overview' && (
        <>
          {floorDetail}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat n={speeches} word="speeches given" />
            <Stat n={fmtSpeakingTotal(speakingSeconds)} word="total speaking time" />
            <Stat n={motionsLogged} word="motions raised" />
            <Stat n={`${present}/${votingTotal}`} word="delegates present" />
          </div>
          {scores.length > 0 && (
            <div className="flex flex-col gap-2">
              {[{ label: 'Top delegate', row: top }, ...(quietest ? [{ label: 'Quietest delegate', row: quietest }] : [])].map((e) => (
                <div key={e.label} className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ padding: '11px 14px', borderRadius: 14, background: NEU.base, boxShadow: NEU.inSm, fontFamily: OUTFIT }}>
                  <span className="flex-shrink-0 basis-full sm:basis-[130px]" style={{ fontSize: 12, fontWeight: 700, color: SOFT }}>{e.label}</span>
                  <CircleFlag code={flagCodeFor(e.row.country)} label={e.row.country} size={24} decorative />
                  <span className="text-sm font-bold flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ color: NEU.ink }}>{e.row.country}</span>
                  <span className="text-sm font-black" style={{ color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>{e.row.total} pts</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'directives' && (
        <div style={{ fontFamily: CK.font }}>
          {heading('Cabinet Directives')}
          <CabinetDirectivesList directives={directives} cabinetId={cabinetId} onOpen={onOpenDirective} />
        </div>
      )}

      {tab === 'news' && (
        <div style={{ fontFamily: CK.font }}>
          {heading('Crisis News')}
          <CrisisNewsList news={news} cabinetId={cabinetId} onOpen={onOpenNews} />
        </div>
      )}

      {tab === 'scoreboard' && (
        <>
          <SessionLoadState loading={live.loading && !live.data} error={live.error} hasSession={!!session}>
            {live.data && <SessionScoreboardBoard committee={live.data.committee} feedback={live.data.feedback} tabs={['ranking', 'matrix']} />}
          </SessionLoadState>
          <button type="button" onClick={onOpenScoreboard} className="mt-3 text-xs font-bold focus:outline-none" style={{ color: NEU.forest, fontFamily: OUTFIT, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Open this scoreboard on its own
          </button>
        </>
      )}

      {tab === 'history' && (
        <SessionLoadState loading={live.loading && !live.data} error={live.error} hasSession={!!session}>
          {live.data && <SessionScoreboardBoard committee={live.data.committee} feedback={live.data.feedback} tabs={['history']} showChips={false} />}
        </SessionLoadState>
      )}

      {tab === 'attendance' && <RosterBody data={data} />}
    </ModalShell>
  );
}
