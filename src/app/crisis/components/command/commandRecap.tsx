'use client';
// Gavelling Crisis: the recap pop-up of one front room on Command. It is the organiser's session recap (the same shell, rail
// and bookmark tabs as src/app/manage/[slug]/live/LiveModals.tsx RecapModal), but the Documents tab is replaced by the two things
// a crisis room is run on: ONE tab, "Directives" (that cabinet's directives, title first, with their status, and under them the
// crisis news that was sent to that cabinet or to every room). Overview, Scoreboard, History and Attendance are the organiser's own pieces,
// reused as they are. The chair's Front Room lists the same two things (cabinetFeeds.tsx), so both sides see the same.
// Nothing here writes.

import { useMemo, type ReactNode } from 'react';
import { History as HistoryIcon, MessageCircle, Radio, ScrollText, Trophy, Users, type LucideIcon } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { SeatPortrait } from './commandRoomLive';
import { LogoDisc } from '@/components/LogoDisc';
import { NEU, OUTFIT } from '@/components/neu';
import { computeScores, flagCodeFor, fmtSpeakingTotal, ModalShell, PHASE_LABELS, presence, RailTab, RosterBody, type LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import { committeeIdentity } from '@/app/manage/[slug]/live/identity';
import { SessionLoadState, SessionScoreboardBoard } from '@/app/manage/[slug]/live/SessionBoard';
import { useSessionCommittee } from '@/app/manage/[slug]/live/useSessionCommittee';
import { SOFT } from '@/app/manage/[slug]/live/tokens';
import type { Directive, News } from '@/lib/crisis/types';
import { CK, Tick } from '../../crisisKit';
import { CabinetDirectivesList, CrisisNewsList, cabinetDirectivesOf, cabinetNewsOf } from './cabinetFeeds';
import StaffRoomChat, { type StaffChat } from './staffChat';

/** 'news' is the old tab of its own; it now opens the merged 'directives' tab (directives first, news under them). */
export type CrisisRecapTab = 'overview' | 'directives' | 'news' | 'chat' | 'scoreboard' | 'history' | 'attendance';

/** One bookmark of the rail. On a wide screen it is narrower than the organiser's RailTab (148 instead of 184) and never wraps, so
 *  the rail stays inside the room the shell reserves for it; on a narrow screen the shell's own bookmark strip is used as it is. */
function CrisisRailTab({ side, icon: Icon, label, count, active, onClick, title }: {
  side: boolean; icon: LucideIcon; label: string; count?: number; active: boolean; onClick: () => void; title: string;
}) {
  if (!side) return <RailTab side={false} icon={Icon} label={label} count={count} active={active} onClick={onClick} title={title} />;
  const ink = active ? NEU.forest : SOFT;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={active ? 'page' : undefined}
      className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{
        border: 'none', cursor: 'pointer', fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: ink, whiteSpace: 'nowrap',
        gap: 8, width: 148, minHeight: 46, padding: '11px 12px 11px 16px', justifyContent: 'flex-start',
        borderRadius: '0 12px 12px 0',
        backgroundColor: active ? NEU.surface : NEU.base,
        boxShadow: active ? 'inset 0 0 0 1px rgba(27,56,40,0.12), 4px 3px 12px -4px rgba(27,56,40,0.22)' : NEU.outSm,
        transform: active ? 'translateX(3px)' : 'translateX(0)',
        transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1), background-color 200ms, color 200ms',
      }}
    >
      <Icon size={17} strokeWidth={1.5} style={{ flexShrink: 0, color: ink }} aria-hidden />
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span style={{ marginInlineStart: 'auto', fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: SOFT, flexShrink: 0 }}>{count}</span>
      )}
    </button>
  );
}

/** A big number with the word beside it. */
function Stat({ n, word }: { n: string | number; word: string }) {
  return (
    <div style={{ background: NEU.base, borderRadius: 14, padding: '11px 14px', boxShadow: NEU.inSm, fontFamily: OUTFIT }}>
      <b style={{ display: 'block', fontSize: 24, lineHeight: 1, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: NEU.ink }}><Tick value={n} /></b>
      <span style={{ display: 'block', marginTop: 4, fontSize: 12, fontWeight: 600, color: SOFT }}>{word}</span>
    </div>
  );
}

export default function CrisisRecap({ data, cabinetId, tab, onTab, directives, news, chat, floorDetail, onOpenDirective, onOpenNews, onOpenScoreboard, onClose }: {
  data: LiveCommittee;
  cabinetId: string;
  tab: CrisisRecapTab;
  onTab: (t: CrisisRecapTab) => void;
  directives: Directive[] | null;
  news: News[] | null;
  /** The staff's chat in this room (staffChat.tsx), opened on the Chat tab. */
  chat: StaffChat;
  floorDetail: ReactNode;
  onOpenDirective: (d: Directive) => void;
  onOpenNews: (n: News) => void;
  onOpenScoreboard: () => void;
  onClose: () => void;
}) {
  const session = data.session;
  // The old separate News tab is the same page as Directives now.
  const shown: CrisisRecapTab = tab === 'news' ? 'directives' : tab;
  const ident = committeeIdentity(data.conf);
  const phaseLabel = !session ? 'No session' : session.endedAt ? 'Adjourned' : session.phase === 'adjourned' ? 'Suspended' : (PHASE_LABELS[session.phase] ?? session.phase);

  // The session itself (for Scoreboard and History) is read the first time one of them opens, then kept.
  const wantsSession = shown === 'scoreboard' || shown === 'history';
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
      <CrisisRailTab side={side} icon={Radio} label="Overview" active={shown === 'overview'} onClick={() => onTab('overview')} title="What this room is doing now and what it has done" />
      <CrisisRailTab side={side} icon={ScrollText} label="Directives" count={directiveCount + newsCount} active={shown === 'directives'} onClick={() => onTab('directives')} title="The directives sent in this cabinet's name, with where each one stands, and the crisis news this cabinet has received" />
      <CrisisRailTab side={side} icon={MessageCircle} label="Chat" count={chat.unread > 0 ? chat.unread : undefined} active={shown === 'chat'} onClick={() => onTab('chat')} title="Read and write in this committee room's chat as the Crisis Team" />
      <CrisisRailTab side={side} icon={Trophy} label="Scoreboard" active={shown === 'scoreboard'} onClick={() => onTab('scoreboard')} title="The full delegate performance table, the same one the chairs score from" />
      <CrisisRailTab side={side} icon={HistoryIcon} label="History" active={shown === 'history'} onClick={() => onTab('history')} title="The session in the order it happened" />
      <CrisisRailTab side={side} icon={Users} label="Attendance" count={votingTotal} active={shown === 'attendance'} onClick={() => onTab('attendance')} title="The roll: present, present and voting, absent" />
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

      {shown === 'overview' && (
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
                  <SeatPortrait name={e.row.country} size={26} cabinetId={cabinetId} fallback={<CircleFlag code={flagCodeFor(e.row.country)} label={e.row.country} size={24} decorative />} />
                  <span className="text-sm font-bold flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ color: NEU.ink }}>{e.row.country}</span>
                  <span className="text-sm font-black" style={{ color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>{e.row.total} pts</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {shown === 'directives' && (
        <div style={{ fontFamily: CK.font }}>
          {heading('Cabinet Directives')}
          <CabinetDirectivesList directives={directives} cabinetId={cabinetId} onOpen={onOpenDirective} />
          <div style={{ marginTop: 22 }}>
            {heading('Crisis News')}
            <CrisisNewsList news={news} cabinetId={cabinetId} onOpen={onOpenNews} />
          </div>
        </div>
      )}

      {shown === 'chat' && (
        <div style={{ fontFamily: CK.font }}>
          {heading('Chat')}
          <StaffRoomChat chat={chat} />
        </div>
      )}

      {shown === 'scoreboard' && (
        <>
          <SessionLoadState loading={live.loading && !live.data} error={live.error} hasSession={!!session}>
            {live.data && <SessionScoreboardBoard committee={live.data.committee} feedback={live.data.feedback} tabs={['ranking', 'matrix']} />}
          </SessionLoadState>
          <button type="button" onClick={onOpenScoreboard} className="mt-3 text-xs font-bold focus:outline-none" style={{ color: NEU.forest, fontFamily: OUTFIT, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Open this scoreboard on its own
          </button>
        </>
      )}

      {shown === 'history' && (
        <SessionLoadState loading={live.loading && !live.data} error={live.error} hasSession={!!session}>
          {live.data && <SessionScoreboardBoard committee={live.data.committee} feedback={live.data.feedback} tabs={['history']} showChips={false} />}
        </SessionLoadState>
      )}

      {shown === 'attendance' && <RosterBody data={data} />}
    </ModalShell>
  );
}
