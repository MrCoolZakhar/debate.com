'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { RefreshCw, Radio, PauseCircle, Megaphone } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import {
  NeuCard, NeuInset, NeuIconDisc, Emoji3D,
  NEU, NEU_GRADIENTS, OUTFIT, EASE,
} from '@/components/neu';
import { getScoringConfig } from '@/lib/scoring';
import type { ScoringConfig } from '@/lib/settingsStore';
import { loadConferenceScoreboard, type ConferenceScoreboard } from '@/lib/conferenceScoreboard';
import {
  type LiveCommittee, type ChairPerson, type CaucusJson,
  presence, RecapModal, AwardsModal, RosterModal, type DocFilter,
} from './LiveModals';
import {
  BroadcastComposer, RecentBroadcasts, broadcastTargets, groupBroadcasts,
  mapBroadcastRow, deleteBroadcastGroup, BROADCAST_COLUMNS,
  type BroadcastRow, type BroadcastGroup,
} from './BroadcastComposer';
import { CommitteeCard, StatusFilterBar, GridFootnote } from './CommitteeCard';
import { FloorDetail, useNowTick } from './PhaseVariants';
import { CommitteeScoreboardModal } from './CommitteeScoreboardModal';
import {
  type RoomStatus, roomStatus, STATUS_META, sortByUrgency, cardWarnings,
  committeeIdentities,
} from './cardModel';
import { SOFT, AMBER_INK, RED } from './tokens';

/** Deadline on the in-flight load guard. Longer than any healthy load (the
 *  batch is eight indexed `in` queries) but short enough that a hung request
 *  costs at most a couple of poll cycles rather than the whole session. */
const LOAD_TIMEOUT_MS = 30_000;

// ── Small shared bits ───────────────────────────────────────────────────────

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] font-bold uppercase"
      style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.08em', ...style }}
    >
      {children}
    </p>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function LiveStatusPage() {
  const { conference } = useManage();
  const { session: authSession } = useAuth();

  const [rows, setRows] = useState<LiveCommittee[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [recapFor, setRecapFor] = useState<string | null>(null);
  const [awardsFor, setAwardsFor] = useState<string | null>(null);
  const [rosterFor, setRosterFor] = useState<string | null>(null);
  // Which documents section the recap should open on. Set by the WP / DR chips
  // on a card, reset to 'all' whenever the recap is opened from the card body,
  // so the previous chip's choice never leaks into the next room.
  const [recapDocFilter, setRecapDocFilter] = useState<DocFilter>('all');
  const [scoreboardFor, setScoreboardFor] = useState<string | null>(null);
  /** The committee a SCOPED broadcast is being written to, or null for the
   *  floor-wide composer. Same component either way — see `composerTargets`. */
  const [broadcastFor, setBroadcastFor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | RoomStatus>('all');
  // The conference-wide scoreboard, loaded ONCE and lazily — only when an
  // organiser first opens a Points view. Loading it on mount would put a second
  // multi-table read behind every visit to a page that polls every ten seconds.
  const [scoreboard, setScoreboard] = useState<ConferenceScoreboard | null>(null);
  const [scoreboardLoading, setScoreboardLoading] = useState(false);
  const [scoreboardError, setScoreboardError] = useState('');
  const [refreshHover, setRefreshHover] = useState(false);
  const [broadcastHover, setBroadcastHover] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [broadcastBusyKey, setBroadcastBusyKey] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const loadStartedRef = useRef(0);

  const loadAll = useCallback(async () => {
    if (!conference || !authSession) return;
    // In-flight guard WITH a deadline. Without one, a single request that never
    // settles (a dropped socket mid-flight leaves the promise pending forever)
    // pinned `loadingRef` true and silently killed the 10s poll for the rest of
    // the session, while the page kept showing a stale floor.
    if (loadingRef.current && Date.now() - loadStartedRef.current < LOAD_TIMEOUT_MS) return;
    loadingRef.current = true;
    loadStartedRef.current = Date.now();
    setRefreshing(true);
    // Every read that failed this pass, so a silent failure can't render as a
    // calm, empty floor stamped "Refreshed 2s ago".
    const failures: string[] = [];
    try {
      const authed = getAuthedClient(authSession.access_token);
      const { data: confCommittees, error: confErr } = await authed
        .from('conference_committees')
        .select('id, name, abbreviation, logo_url, topics, difficulty, committee_type, total_slots, session_id, session_code, chair_user_ids, display_chairs')
        .eq('conference_id', conference.id)
        .order('name', { ascending: true });

      // The committee list is the spine of this page. If it fails there is
      // nothing honest to draw, so bail out loudly and leave whatever was last
      // known on screen rather than blanking the floor.
      if (confErr) {
        setLoadError("Couldn't load the committee list: " + confErr.message);
        return;
      }

      const confRows = confCommittees ?? [];
      const sessionIds = confRows.map((c) => c.session_id).filter((id): id is string => !!id);

      // Chair profile pictures. `display_chairs` is a trigger-maintained mirror
      // index-aligned with chair_user_ids and already carries {name, avatar_url},
      // so it is the fallback whenever a chair's profile row is not readable
      // under the organiser's RLS (a chair who never applied to this conference).
      const chairIds = Array.from(new Set(confRows.flatMap((c) => (c.chair_user_ids as string[] | null) ?? [])));
      const chairProfiles = new Map<string, { display_name: string; avatar_url: string | null }>();
      if (chairIds.length > 0) {
        const { data: profs } = await authed
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', chairIds);
        for (const p of (profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]) {
          chairProfiles.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
        }
      }

      // Batched anon reads, live session tables carry public RLS.
      let sessions: Record<string, unknown>[] = [];
      let speakers: Record<string, unknown>[] = [];
      let delegates: Record<string, unknown>[] = [];
      let queues: Record<string, unknown>[] = [];
      let motions: Record<string, unknown>[] = [];
      let documents: Record<string, unknown>[] = [];
      let sysMessages: Record<string, unknown>[] = [];
      let feedback: Record<string, unknown>[] = [];

      if (sessionIds.length > 0) {
        const [sRes, csRes, dRes, qRes, mRes, docRes, msgRes, fbRes] = await Promise.all([
          // `updated_at` and `resuming_chair` are the STATUS axis. Without
          // `updated_at` this page had no way to tell a room that is running
          // from a room whose chair walked out three hours ago — "In session"
          // meant nothing more than `phase !== 'pre-session'`.
          anonSupabase.from('committees')
            .select('id, code, name, phase, caucus, chair_names, suspended_at, ended_at, settings, updated_at, resuming_chair')
            .in('id', sessionIds),
          anonSupabase.from('current_speaker')
            .select('committee_id, country, time_remaining, started_at')
            .in('committee_id', sessionIds),
          anonSupabase.from('delegates')
            .select('committee_id, country, status, is_observer')
            .in('committee_id', sessionIds),
          anonSupabase.from('speakers_list')
            .select('committee_id, country, position, list_type')
            .in('committee_id', sessionIds)
            .order('position', { ascending: true }),
          // `proposed_by`, `total_time` and `created_at` are what turn a motion
          // row into a sentence ("Germany · 10-minute moderated caucus, raised
          // 40s ago"). `created_at` also carries the whole "is this motion
          // being decided right now" judgement — see `motionOnTheFloor`.
          anonSupabase.from('motions')
            .select('committee_id, type, topic, disruptiveness, proposed_by, total_time, created_at')
            .eq('status', 'pending')
            .in('committee_id', sessionIds),
          // file_url / file_name / content are what make a document readable
          // rather than just countable. The chair console already renders the
          // same `file_url` in its inline viewer (DocumentsModal.tsx:877), and
          // `documents` carries a public SELECT policy, so no new RLS is needed.
          anonSupabase.from('documents')
            .select('committee_id, type, status, doc_code, title, sponsors, file_url, file_name, content, created_at')
            .in('committee_id', sessionIds),
          // The `sender = '__system__'` filter is deliberately GONE. The ledger
          // still only ever comes from `__system__` rows (filtered below), but
          // `max(created_at)` over EVERY message is the second half of the
          // activity clock, and delegates chatting is the one kind of life that
          // touches neither the `committees` row nor the ledger.
          //
          // Cost, measured: 483 message rows across the whole platform, 459 of
          // them already `__system__`, so this widens the read by 24 rows today.
          // At a busy conference chat becomes the bulk of this table, and this
          // query — like the ledger read it replaces — is unbounded. If that
          // ever bites, the fix is a per-committee `max(created_at)` view, not
          // narrowing the clock back to `updated_at`.
          anonSupabase.from('messages')
            .select('committee_id, sender, content, created_at')
            .in('committee_id', sessionIds),
          // Chair feedback: ratings AND private notes. In practice almost every
          // row is a factor rating with no prose, so factor_scores is as much
          // the payload as `content` is.
          anonSupabase.from('feedback')
            .select('committee_id, country, chair_name, content, created_at, level, factor_scores, speech_context, speech_seconds')
            .in('committee_id', sessionIds)
            .order('created_at', { ascending: true }),
        ]);
        // Name each read so a partial outage can say WHICH slice is missing
        // instead of quietly rendering zeroes for it.
        for (const [label, res] of [
          ['sessions', sRes], ['current speaker', csRes], ['delegates', dRes],
          ['queues', qRes], ['motions', mRes], ['documents', docRes],
          ['speaking log', msgRes], ['feedback', fbRes],
        ] as const) {
          if (res.error) failures.push(label);
        }

        sessions = sRes.data ?? [];
        speakers = csRes.data ?? [];
        delegates = dRes.data ?? [];
        queues = qRes.data ?? [];
        motions = mRes.data ?? [];
        documents = docRes.data ?? [];
        sysMessages = msgRes.data ?? [];
        feedback = fbRes.data ?? [];

        // Everything failed: the floor is unknown, not empty. Do not draw it and
        // do not stamp a refresh time over it.
        if (failures.length === 8) {
          setLoadError('Live session data is unreachable. Showing the last known floor.');
          return;
        }
      }

      const bySession = <T extends Record<string, unknown>>(list: T[], sid: string) =>
        list.filter((r) => r.committee_id === sid);

      const assembled: LiveCommittee[] = confRows.map((c) => {
        const sid = c.session_id as string | null;
        const sRow = sid ? sessions.find((s) => s.id === sid) ?? null : null;
        const speakerRow = sid ? speakers.find((s) => s.committee_id === sid) ?? null : null;

        // ── Ledger parsing ──
        // `logEvent` (committeeService.ts:899-914) writes SIX event types onto
        // this one `__log__:` channel — speech, motion-raised, right-of-reply,
        // manual-award, manual-deduct, custom. Measured in production: 454 rows,
        // of which 333 speech, 95 motion-raised, 13 manual-award, 12
        // right-of-reply, 1 manual-deduct — 121 of 454 (27%) are not speeches,
        // so treating the whole feed as speeches over-reported every speech
        // count on this page by 36% (454/333).
        // The messages read is no longer pre-filtered to `__system__`, so the
        // ledger filter now states both halves of what a ledger row is.
        const allLogs = sid
          ? bySession(sysMessages, sid)
              .filter((m) => m.sender === '__system__'
                && typeof m.content === 'string' && (m.content as string).startsWith('__log__:'))
              .map((m) => {
                try {
                  const p = JSON.parse((m.content as string).slice('__log__:'.length)) as Record<string, unknown>;
                  if (!p || typeof p !== 'object') return null;
                  return {
                    country: typeof p.country === 'string' ? p.country : '',
                    type: typeof p.type === 'string' ? p.type : 'speech',
                    seconds: typeof p.seconds === 'number' ? p.seconds : 0,
                    context: typeof p.context === 'string' ? p.context : '',
                    topic: typeof p.topic === 'string' ? p.topic : '',
                    // The payload carries its own timestamp; `messages.created_at`
                    // is the fallback so every row has a usable clock.
                    at: (typeof p.timestamp === 'string' ? p.timestamp : (m.created_at as string | null)) ?? null,
                  };
                } catch { return null; }
              })
              .filter((e): e is NonNullable<typeof e> => e !== null)
          : [];

        // `__chair__` is a sentinel country, not a delegation (17 production rows,
        // all on motion-raised). It must never reach a per-delegation aggregate.
        const speechLogs = allLogs
          .filter((e) => e.type === 'speech' && e.country !== '__chair__')
          .map(({ country, seconds, context, topic, at }) => ({ country, seconds, context, topic, at }));
        const eventLogs = allLogs.map(({ country, type, at }) => ({ country, type, at }));

        const chairUserIds = (c.chair_user_ids as string[] | null) ?? [];
        const displayChairs = (c.display_chairs as { name: string; avatar_url: string | null }[] | null) ?? [];
        const chairs: ChairPerson[] = chairUserIds.map((uid, i) => {
          const prof = chairProfiles.get(uid);
          const fallback = displayChairs[i];
          return {
            id: uid,
            name: prof?.display_name ?? fallback?.name ?? 'Chair',
            avatarUrl: prof?.avatar_url ?? fallback?.avatar_url ?? null,
          };
        });
        // A dais seeded straight into display_chairs (no linked account) still
        // deserves a face in the stack.
        if (chairs.length === 0 && displayChairs.length > 0) {
          for (const d of displayChairs) chairs.push({ id: null, name: d.name, avatarUrl: d.avatar_url ?? null });
        }

        // committees.settings.scoring → the chair's own ranking factors, so the
        // feedback recap labels ratings the way the dais named them. Read as a
        // pure function of the row; the settings store is never touched here.
        const scoring = getScoringConfig({ dbScoring: (sRow?.settings as { scoring?: ScoringConfig } | null)?.scoring ?? null });

        const sessionDocs = sid ? bySession(documents, sid) : [];
        const sessionQueues = sid ? bySession(queues, sid) : [];
        const sessionFeedback = sid ? bySession(feedback, sid) : [];

        // Most recent sign of life in the room, across every timestamp we can
        // see. Used to decide whether an "introduced" resolution or a lingering
        // phase='voting' still describes something happening now.
        const activityTimes = [
          ...allLogs.map((e) => e.at),
          (speakerRow?.started_at as string | null) ?? null,
          ...sessionDocs.map((d) => (d.created_at as string | null) ?? null),
          ...sessionFeedback.map((f) => (f.created_at as string | null) ?? null),
        ]
          .filter((t): t is string => !!t)
          .map((t) => Date.parse(t))
          .filter((n) => Number.isFinite(n));
        const lastActivityAt = activityTimes.length > 0
          ? new Date(Math.max(...activityTimes)).toISOString()
          : null;

        // `max(messages.created_at)` over every message in the room, chat rows
        // included — the second term of the activity clock the STATUS axis runs
        // on (`lastActiveAt` in cardModel.ts).
        const messageTimes = (sid ? bySession(sysMessages, sid) : [])
          .map((m) => Date.parse((m.created_at as string | null) ?? ''))
          .filter((n) => Number.isFinite(n));
        const lastMessageAt = messageTimes.length > 0
          ? new Date(Math.max(...messageTimes)).toISOString()
          : null;

        // Has this room ever actually SAT? A resume roll call and a session that
        // was never opened both sit at phase='pre-session'
        // (committeeService.ts:1097-1105), so only accumulated proceedings
        // separate them: a preserved GSL or caucus queue, documents, ledger
        // rows, chair feedback, a speaker row, or a suspension on file.
        //
        // `chairNames` is DELIBERATELY not in this list. A chair joining is what
        // opens the room for its FIRST roll call, so folding it in here made
        // every first sitting claim to be resuming and left `cardStatus`'s
        // 'roll-call' branch unreachable. `cardStatus` reads the two signals
        // separately: proceedings ⇒ resumed, chairs-only ⇒ first roll call.
        const hasHistory = !!sRow && (
          sessionQueues.length > 0
          || sessionDocs.length > 0
          || allLogs.length > 0
          || sessionFeedback.length > 0
          || !!speakerRow?.country
          || !!(sRow.suspended_at as string | null)
        );

        return {
          conf: {
            id: c.id as string,
            name: c.name as string,
            abbreviation: (c.abbreviation as string | null) ?? null,
            logoUrl: (c.logo_url as string | null) ?? null,
            topics: (c.topics as string[] | null) ?? null,
            totalSlots: (c.total_slots as number) ?? 0,
            sessionId: sid,
            sessionCode: (c.session_code as string | null) ?? null,
            chairUserIds,
            chairs,
          },
          session: sRow
            ? {
                id: sRow.id as string,
                code: sRow.code as string,
                name: sRow.name as string,
                phase: sRow.phase as string,
                caucus: (sRow.caucus as CaucusJson | null) ?? null,
                chairNames: (sRow.chair_names as string[] | null) ?? [],
                suspendedAt: (sRow.suspended_at as string | null) ?? null,
                endedAt: (sRow.ended_at as string | null) ?? null,
                updatedAt: (sRow.updated_at as string | null) ?? null,
                resumingChair: (sRow.resuming_chair as string | null) ?? null,
                // Straight off the row. AGENTS.md rule 14: never `getSettings(code)`
                // outside the chair page — the store is not hydrated here.
                quorumThreshold:
                  ((sRow.settings as { quorumThreshold?: string } | null)?.quorumThreshold) ?? 'none',
                scoringFactors: scoring.factors.filter((f) => f.enabled).map((f) => ({ id: f.id, name: f.name })),
                factorScaleMax: scoring.factorScaleMax,
              }
            : null,
          currentSpeaker: speakerRow
            ? {
                country: (speakerRow.country as string | null) ?? null,
                timeRemaining: (speakerRow.time_remaining as number) ?? 0,
                startedAt: (speakerRow.started_at as string | null) ?? null,
              }
            : null,
          delegates: sid
            ? bySession(delegates, sid).map((d) => ({
                country: d.country as string,
                status: d.status as string,
                isObserver: (d.is_observer as boolean | null) ?? false,
              }))
            : [],
          gslQueue: sid ? bySession(queues, sid).filter((q) => q.list_type === 'gsl').map((q) => q.country as string) : [],
          caucusQueue: sid ? bySession(queues, sid).filter((q) => q.list_type === 'caucus').map((q) => q.country as string) : [],
          pendingMotions: sid
            ? bySession(motions, sid)
                .filter((m) => m.type !== 'join-request' && m.type !== 'gsl-request')
                .map((m) => ({
                  type: m.type as string,
                  topic: (m.topic as string) ?? '',
                  proposedBy: (m.proposed_by as string) ?? '',
                  totalTime: (m.total_time as number) ?? 0,
                  createdAt: (m.created_at as string | null) ?? null,
                }))
            : [],
          documents: sid
            ? bySession(documents, sid).map((d) => ({
                type: d.type as string,
                status: d.status as string,
                docCode: (d.doc_code as string) ?? '',
                title: (d.title as string) ?? '',
                sponsors: (d.sponsors as string[] | null) ?? [],
                fileUrl: (d.file_url as string | null) ?? null,
                fileName: (d.file_name as string | null) ?? null,
                content: (d.content as string | null) ?? null,
                createdAt: (d.created_at as string | null) ?? null,
              }))
            : [],
          speechLogs,
          eventLogs,
          lastActivityAt,
          lastMessageAt,
          hasHistory,
          feedback: sid
            ? bySession(feedback, sid).map((f) => ({
                country: f.country as string,
                chairName: (f.chair_name as string) ?? '',
                content: (f.content as string) ?? '',
                createdAt: (f.created_at as string) ?? '',
                level: (f.level as string) ?? 'speech',
                factorScores: (f.factor_scores as Record<string, number> | null) ?? {},
                speechContext: (f.speech_context as string | null) ?? null,
                speechSeconds: (f.speech_seconds as number | null) ?? null,
              }))
            : [],
        };
      });

      setRows(assembled);
      setLoadError(failures.length > 0
        ? `Partly loaded — ${failures.join(', ')} could not be read. Those figures may be wrong.`
        : null);
      setLastRefreshed(Date.now());
    } catch (e) {
      // A thrown request (network down, aborted fetch) is a failed load, not an
      // empty floor. Same rule: say so, and don't stamp a fresh timestamp.
      setLoadError("Couldn't refresh the floor: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [conference?.id, authSession?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcasts this conference has sent. Kept out of loadAll so a broadcast
  // send/withdraw can refresh just this slice without re-fetching every
  // session table. `expires_at` is the natural horizon: a broadcast past it is
  // no longer on any dais, so the log stops at the ones that still matter plus
  // a short tail of history.
  const loadBroadcasts = useCallback(async () => {
    if (!conference || !authSession) return;
    const authed = getAuthedClient(authSession.access_token);
    const { data } = await authed
      .from('session_broadcasts')
      .select(BROADCAST_COLUMNS)
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false })
      .limit(120);
    setBroadcasts(((data ?? []) as Record<string, unknown>[]).map(mapBroadcastRow));
  }, [conference?.id, authSession?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + 10s polling (kept simple + robust for N committees, no per-committee channels)
  useEffect(() => {
    loadAll();
    loadBroadcasts();
    const poll = setInterval(() => { loadAll(); loadBroadcasts(); }, 10_000);
    return () => clearInterval(poll);
  }, [loadAll, loadBroadcasts]);


  // Lazy, once-per-visit load of the conference scoreboard, triggered the first
  // time an organiser opens a Points view.
  const conferenceId = conference?.id;
  const accessToken = authSession?.access_token;
  //
  // THE IN-FLIGHT LATCH IS A REF, AND THAT IS NOT A STYLE CHOICE.
  //
  // This effect used to guard on `scoreboardLoading` and ALSO list it as a
  // dependency, which deadlocked the modal on its spinner every single time it
  // was opened — verified on the real page, not reasoned about:
  //
  //   1. the effect passes its guard and calls `setScoreboardLoading(true)`;
  //   2. that state IS a dependency, so React tears the effect down and runs it
  //      again — and the teardown sets `cancelled = true` on the fetch that was
  //      started one line earlier;
  //   3. the new pass bails on the very flag it just set;
  //   4. the fetch resolves into the cancelled closure, so neither
  //      `setScoreboard` nor `setScoreboardLoading(false)` ever runs.
  //
  // A ref cannot re-trigger the effect, so the latch and the render state stop
  // fighting. `scoreboardFor` is no longer cancellable either: the payload is
  // the WHOLE conference, so switching committees mid-load must keep the same
  // request rather than abandon it and re-latch.
  const scoreboardReq = useRef(false);
  useEffect(() => {
    if (scoreboardReq.current || !scoreboardFor || !conferenceId || !accessToken) return;
    scoreboardReq.current = true;
    setScoreboardLoading(true);
    void (async () => {
      try {
        const result = await loadConferenceScoreboard(getAuthedClient(accessToken), conferenceId);
        setScoreboard(result);
        setScoreboardError('');
      } catch (err) {
        console.error('[LiveStatusPage] scoreboard load failed:', err);
        // Unlatch, so the next Points click retries instead of being stuck with
        // a permanent error message.
        scoreboardReq.current = false;
        setScoreboardError("Couldn't load the scoreboard for this committee.");
      } finally {
        setScoreboardLoading(false);
      }
    })();
  }, [scoreboardFor, conferenceId, accessToken]);

  // ── Derived ──
  const recapData = recapFor ? rows?.find((r) => r.conf.id === recapFor) ?? null : null;
  const awardsData = awardsFor ? rows?.find((r) => r.conf.id === awardsFor) ?? null : null;
  const rosterData = rosterFor ? rows?.find((r) => r.conf.id === rosterFor) ?? null : null;
  const scoreboardData = scoreboardFor ? rows?.find((r) => r.conf.id === scoreboardFor) ?? null : null;
  const broadcastData = broadcastFor ? rows?.find((r) => r.conf.id === broadcastFor) ?? null : null;

  // Stable identity: `rows ?? []` minted a fresh array on every tick while the
  // page was still loading, which would re-run every memo hanging off it.
  const allRows = useMemo(() => rows ?? [], [rows]);

  // ── The STATUS axis, floor-wide ──
  //
  // ONE wall clock for the whole page, from the shared external store in
  // PhaseVariants. It replaces the page's own `setInterval(setTick)` (one timer
  // saved) and, more importantly, it is the SAME instant every card, every
  // count, the filter and the sort order are computed from — so a room can
  // never be sorted as stalled while its card still says idle.
  const now = useNowTick(true);
  const statusOf = useMemo(() => {
    const m = new Map<string, RoomStatus>();
    for (const r of allRows) m.set(r.conf.id, roomStatus(r, now));
    return m;
  }, [allRows, now]);

  const counts = useMemo(() => {
    const c: Record<RoomStatus, number> = {
      live: 0, idle: 0, stalled: 0, suspended: 0, 'not-started': 0, ended: 0,
    };
    for (const r of allRows) c[statusOf.get(r.conf.id) ?? 'not-started'] += 1;
    return c;
  }, [allRows, statusOf]);

  const needsAttention = useMemo(
    () => allRows.filter((r) => {
      const st = statusOf.get(r.conf.id);
      return st === 'stalled' || st === 'suspended' || cardWarnings(r, now).length > 0;
    }).length,
    [allRows, statusOf, now],
  );

  // Acronym-over-full-name, resolved for the whole conference in one pass:
  // an acronym two committees would share is dropped for both, so this cannot
  // be done a card at a time.
  const identities = useMemo(() => committeeIdentities(allRows), [allRows]);

  const onFloor = counts.live + counts.idle + counts.stalled;
  const presentTotal = allRows.reduce((sum, r) => sum + presence(r).present, 0);

  // URGENCY ORDER, not the alphabet. `.order('name')` is still what the query
  // asks the database for — it is the only stable base ordering — but the grid
  // is re-sorted here so the rooms that need feet are the ones at the top.
  const visibleRows = useMemo(() => {
    const filtered = statusFilter === 'all'
      ? allRows
      : allRows.filter((r) => statusOf.get(r.conf.id) === statusFilter);
    return sortByUrgency(filtered, now);
  }, [allRows, statusFilter, statusOf, now]);

  const secondsAgo = lastRefreshed ? Math.max(0, Math.floor((now - lastRefreshed) / 1000)) : null;

  // Only a committee with a linked session (and not already adjourned for good)
  // has a `committees.id` to address, so those are the only broadcast targets.
  // Memoised: the composer diffs this list to fold in committees that come
  // online while it is open, so a fresh array on every 1s tick would churn.
  const targets = useMemo(() => broadcastTargets(allRows), [allRows]);

  // A SCOPED broadcast is the same composer with a one-entry target list — not a
  // second composer. `broadcastTargets` already drops committees with no session
  // and committees that have been gavelled out, so a scoped list can legitimately
  // come back empty; the composer is then not opened at all (see `canBroadcast`
  // on the card's modal).
  const composerTargets = useMemo(
    () => (broadcastData ? targets.filter((t) => t.confCommitteeId === broadcastData.conf.id) : targets),
    [targets, broadcastData],
  );
  const broadcastGroups = useMemo(() => groupBroadcasts(broadcasts).slice(0, 5), [broadcasts]);

  async function handleWithdraw(g: BroadcastGroup) {
    setBroadcastBusyKey(g.key);
    setBroadcastError('');
    const err = await deleteBroadcastGroup(g.ids);
    setBroadcastBusyKey(null);
    if (err) { setBroadcastError("Couldn't withdraw that broadcast: " + err); return; }
    await loadBroadcasts();
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl" style={{ fontFamily: OUTFIT }}>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Eyebrow>Live status</Eyebrow>
          <h1 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 28, lineHeight: 1.1, marginTop: 2 }}>
            Committee floor
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {secondsAgo !== null && (
            <span className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
              {loadError ? `Last good refresh ${secondsAgo}s ago` : `Refreshed ${secondsAgo}s ago`}
            </span>
          )}
          <button
            onClick={loadAll}
            disabled={refreshing}
            onMouseEnter={() => setRefreshHover(true)}
            onMouseLeave={() => setRefreshHover(false)}
            className="inline-flex items-center gap-2 rounded-full py-2.5 px-4 text-xs font-bold uppercase focus:outline-none"
            style={{
              border: 'none', color: NEU.forest, backgroundColor: NEU.surface,
              fontFamily: OUTFIT, letterSpacing: '0.06em',
              boxShadow: refreshHover && !refreshing ? NEU.outSmHover : NEU.outSm,
              opacity: refreshing ? 0.6 : 1, cursor: refreshing ? 'default' : 'pointer',
              transition: `box-shadow 200ms ${EASE}`,
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {/* Broadcast — writes session_broadcasts rows, one per targeted
              committee. Nothing here suspends or ends a session itself. */}
          <button
            onClick={() => setComposerOpen(true)}
            onMouseEnter={() => setBroadcastHover(true)}
            onMouseLeave={() => setBroadcastHover(false)}
            className="inline-flex items-center gap-2 rounded-full py-2.5 px-4 text-xs font-bold uppercase focus:outline-none"
            style={{
              border: 'none', color: NEU.gold,
              background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
              fontFamily: OUTFIT, letterSpacing: '0.06em',
              boxShadow: broadcastHover
                ? `0 6px 16px ${NEU_GRADIENTS.forest[0]}66, ${NEU.outSmHover}`
                : `0 4px 10px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}`,
              transform: broadcastHover ? 'translateY(-2px)' : 'translateY(0)',
              cursor: 'pointer',
              transition: `box-shadow 220ms ${EASE}, transform 200ms ${EASE}`,
            }}
            title="Send a message to every committee on the floor"
          >
            <Megaphone size={13} />
            Broadcast
          </button>
        </div>
      </div>

      {/* Load failure — stated plainly. A live-ops surface must never present a
          failed read as a quiet, empty floor. */}
      {loadError && (
        <NeuInset className="flex items-start gap-2.5 mb-4" style={{ padding: '12px 14px', borderRadius: 14 }}>
          <PauseCircle size={15} style={{ color: AMBER_INK, flexShrink: 0, marginBlockStart: 1 }} />
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{loadError}</p>
            <p className="text-[11px] mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
              Retrying automatically every 10 seconds.
            </p>
          </div>
        </NeuInset>
      )}

      {/* Status filter — REPLACES the five-glyph row.
          Those glyphs were floor-wide totals that named no committee: "Motions:
          3" tells an organiser nothing without WHICH room. These count the
          status axis, and every one of them is a filter, so the row is
          navigation rather than decoration. */}
      <StatusFilterBar
        active={statusFilter}
        onPick={(k) => setStatusFilter(k as 'all' | RoomStatus)}
        counts={[
          { key: 'all', label: 'All rooms', value: allRows.length, color: NEU.forest, ink: NEU.ink },
          { key: 'stalled', label: STATUS_META.stalled.label, value: counts.stalled, color: STATUS_META.stalled.color, ink: STATUS_META.stalled.ink },
          { key: 'suspended', label: STATUS_META.suspended.label, value: counts.suspended, color: STATUS_META.suspended.color, ink: STATUS_META.suspended.ink },
          { key: 'live', label: STATUS_META.live.label, value: counts.live, color: STATUS_META.live.color, ink: STATUS_META.live.ink },
          { key: 'idle', label: STATUS_META.idle.label, value: counts.idle, color: STATUS_META.idle.color, ink: STATUS_META.idle.ink },
          { key: 'not-started', label: STATUS_META['not-started'].label, value: counts['not-started'], color: STATUS_META['not-started'].color, ink: STATUS_META['not-started'].ink },
          { key: 'ended', label: STATUS_META.ended.label, value: counts.ended, color: STATUS_META.ended.color, ink: STATUS_META.ended.ink },
        ]}
      />

      {/* Summary strip — floor overview + live counts */}
      <NeuCard
        className="mb-7 flex items-center justify-between gap-6 flex-wrap relative overflow-hidden"
        style={{ padding: '20px 24px' }}
      >
        {/* Gold accent rail — a small hit of colour on the left edge */}
        <span
          className="absolute left-0 top-0 bottom-0"
          style={{ width: 5, background: `linear-gradient(180deg, ${NEU.gold}, ${NEU.deepGold})`, boxShadow: `2px 0 6px ${NEU.deepGold}44` }}
        />
        <div className="flex items-center gap-4 min-w-0" style={{ paddingLeft: 8 }}>
          <span className="relative inline-flex flex-shrink-0">
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} emoji="Satellite antenna" icon={Radio} size={58} />
            {counts.live > 0 && (
              <span
                className="absolute rounded-full animate-pulse"
                style={{ top: 0, right: 0, width: 13, height: 13, backgroundColor: NEU.green, boxShadow: `0 0 0 3px ${NEU.surface}, 0 0 0 5px ${NEU.green}33` }}
              />
            )}
          </span>
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', color: NEU.forest }}>
              {conference?.acronym ?? '…'} · FLOOR OVERVIEW
            </p>
            {/* The headline now reports the STATUS axis. "Committees are in
                session" used to be true of any room whose phase had ever left
                pre-session, including one abandoned three hours earlier. */}
            <p className="font-black truncate" style={{ color: needsAttention > 0 ? RED : counts.live > 0 ? NEU.forest : NEU.ink, fontFamily: OUTFIT, fontSize: 21, lineHeight: 1.12, marginTop: 2 }}>
              {needsAttention > 0
                ? `${needsAttention} room${needsAttention === 1 ? '' : 's'} need${needsAttention === 1 ? 's' : ''} attention`
                : counts.live > 0
                  ? `${counts.live} committee${counts.live === 1 ? '' : 's'} running normally`
                  : 'All quiet on the floor'}
            </p>
            <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
              {onFloor > 0
                ? `${onFloor} room${onFloor === 1 ? '' : 's'} open${presentTotal > 0 ? ` · ${presentTotal} delegate${presentTotal === 1 ? '' : 's'} present` : ''}`
                : 'No committee has been opened yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          {/* "Chairs joined" is gone. It summed `chair_names` across the whole
              conference — a number that names no room and moves for reasons an
              organiser cannot act on. Attention needed replaces it. */}
          {[
            { value: rows?.length ?? 0, label: 'COMMITTEES', color: NEU.ink },
            { value: counts.live, label: 'LIVE NOW', color: counts.live > 0 ? NEU.green : SOFT },
            { value: needsAttention, label: 'NEED ATTENTION', color: needsAttention > 0 ? RED : SOFT },
          ].map((s) => (
            <NeuInset key={s.label} className="text-center" style={{ padding: '10px 18px', borderRadius: 14, minWidth: 92 }}>
              <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
              <p style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em', color: SOFT, marginTop: 5 }}>{s.label}</p>
            </NeuInset>
          ))}
        </div>
      </NeuCard>

      {/* What the secretariat has already sent to the floor */}
      <RecentBroadcasts
        groups={broadcastGroups}
        onDelete={(g) => { void handleWithdraw(g); }}
        busyKey={broadcastBusyKey}
        error={broadcastError}
      />

      {/* Grid */}
      {rows === null && loadError ? (
        /* First load failed outright: there is no floor to draw. A shimmering
           skeleton here would read as "still loading" forever, which is the same
           lie as an empty floor stamped with a fresh refresh time. */
        <NeuCard style={{ padding: 40, textAlign: 'center' }}>
          <Emoji3D name="Satellite antenna" size={34} fallback={Radio} fallbackColor={SOFT} style={{ opacity: 0.9 }} />
          <p className="text-sm font-bold mt-3 mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            The floor could not be loaded
          </p>
          <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT }}>
            Nothing is being hidden — this page has never had a successful read this session.
          </p>
        </NeuCard>
      ) : rows === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-[22px] animate-pulse" style={{ height: 320, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <NeuCard style={{ padding: 40, textAlign: 'center' }}>
          <p className="text-sm font-bold mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>No committees yet</p>
          <Link
            href={conference ? `/manage/${conference.slug}/committees` : '#'}
            className="text-sm font-bold transition-colors"
            style={{ color: NEU.forest, fontFamily: OUTFIT, textDecoration: 'none' }}
          >
            Create them in Committees →
          </Link>
        </NeuCard>
      ) : visibleRows.length === 0 ? (
        <NeuCard style={{ padding: 40, textAlign: 'center' }}>
          <p className="text-sm font-bold mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            No committee is {STATUS_META[statusFilter as RoomStatus]?.label.toLowerCase() ?? 'matching'} right now
          </p>
          <button
            onClick={() => setStatusFilter('all')}
            className="text-sm font-bold focus:outline-none"
            style={{ color: NEU.forest, fontFamily: OUTFIT, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Show all rooms →
          </button>
        </NeuCard>
      ) : (
        <>
          {/* ONE card for every state.
              `items-stretch` + a `flex-1` band inside the card is the pattern
              from `committees/page.tsx:1568, 1587`. Without the `flex-1` the
              grid still stretches every card to the tallest in its row, but no
              child claims the surplus and it all pools at the bottom as a dead
              band — which is exactly what this page was doing. */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {visibleRows.map((r) => (
              <CommitteeCard
                key={r.conf.id}
                data={r}
                identity={identities.get(r.conf.id)!}
                now={now}
                onOpen={(d) => { setRecapDocFilter('all'); setRecapFor(d.conf.id); }}
                onOpenRoster={(d) => setRosterFor(d.conf.id)}
                onOpenScoreboard={(d) => setScoreboardFor(d.conf.id)}
                onOpenDocuments={(d, type) => { setRecapDocFilter(type); setRecapFor(d.conf.id); }}
              />
            ))}
          </div>
          <GridFootnote />
        </>
      )}

      {/* Modals */}
      {recapData && (
        <RecapModal
          // Keyed on the committee AND on the section it was asked to open,
          // because the jump-to-documents scroll is a mount effect: without the
          // key, clicking a DR chip while the same room's recap is already open
          // would set the filter but leave the reader at the top.
          key={`${recapData.conf.id}:${recapDocFilter}`}
          data={recapData}
          initialDocFilter={recapDocFilter}
          onClose={() => setRecapFor(null)}
          // The caucus clock, ballot breakdown and unmod countdown moved OFF the
          // card (four card shapes were the cause of the height chaos) and into
          // the detail view, where a caller has already chosen one room.
          floorDetail={<FloorDetail data={recapData} />}
          onOpenScoreboard={(d) => { setRecapFor(null); setScoreboardFor(d.conf.id); }}
          // A room with no session (or one already gavelled out) has nothing to
          // address, so the affordance is absent rather than dead.
          onBroadcast={targets.some((t) => t.confCommitteeId === recapData.conf.id)
            ? (d) => { setRecapFor(null); setBroadcastFor(d.conf.id); }
            : null}
        />
      )}
      {awardsData && <AwardsModal data={awardsData} onClose={() => setAwardsFor(null)} />}
      {rosterData && <RosterModal data={rosterData} onClose={() => setRosterFor(null)} />}
      {scoreboardData && conference && (
        <CommitteeScoreboardModal
          data={scoreboardData}
          scoreboard={scoreboard}
          loading={scoreboardLoading}
          error={scoreboardError}
          conferenceSlug={conference.slug}
          onClose={() => setScoreboardFor(null)}
        />
      )}
      {/* SCOPED broadcast — the same composer, handed a one-committee target
          list. `session_broadcasts` has zero production rows, so this path was
          exercised end to end rather than assumed to work. */}
      {broadcastData && conference && (
        <BroadcastComposer
          conferenceId={conference.id}
          conferenceLabel={conference.acronym ?? conference.full_name}
          createdBy={authSession?.user?.id ?? null}
          targets={composerTargets}
          onClose={() => setBroadcastFor(null)}
          onSent={() => { void loadBroadcasts(); }}
        />
      )}
      {composerOpen && conference && (
        <BroadcastComposer
          conferenceId={conference.id}
          conferenceLabel={conference.acronym ?? conference.full_name}
          createdBy={authSession?.user?.id ?? null}
          targets={targets}
          onClose={() => setComposerOpen(false)}
          onSent={() => { void loadBroadcasts(); }}
        />
      )}
    </div>
  );
}
