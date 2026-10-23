'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Gavelling staff → Live committees → one room.
//
// Builds the organiser live wall's `LiveCommittee` for ONE room, so the admin
// board can open the very same recap the organiser gets on /manage/<slug>/live
// (RecapModal, FloorDetail, SessionDocuments, SessionScoreboardBoard,
// RosterBody / SessionAttendance). Read only: nothing here writes.
//
// The mapping mirrors `loadAll` in manage/[slug]/live/page.tsx for a single
// session id. The session tables carry public SELECT policies (anon client);
// the conference side (conference_committees, chair profiles, pending invites,
// the awards config) is read with the staff member's own token: platform admins
// pass `is_conference_organizer`, so every conference read the organiser makes
// works for them too.
//
// Standalone rooms have no conference_committees row, so the `conf` half is
// synthesised from the session itself (name, chair names, roster size). What a
// platform admin cannot read there today: the attendance timeline
// (`delegate_status_history` admits only the session's chairs and the
// conference's organisers; see scratch-admin-live-rooms.sql).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase as anonSupabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { getScoringConfig, everPresentFromHistory } from '@/lib/scoring';
import type { ScoringConfig } from '@/lib/settingsStore';
import { sessionHeadlineScores } from '@/lib/conferenceScoreboard';
import { readStatusHistory } from '@/lib/attendanceHistory';
import { fetchPendingChairInvites, pendingInviteName } from '@/lib/chairInvites';
import type {
  LiveCommittee, ChairPerson, PendingChairPerson, CaucusJson,
} from '@/app/manage/[slug]/live/LiveModals';

type Row = Record<string, unknown>;

export interface AdminRoomConference {
  id: string;
  slug: string;
  label: string;
  awardsConfig: unknown;
  awardsPublishedAt: string | null;
  endDate: string | null;
}

export interface AdminRoom {
  data: LiveCommittee;
  /** Null for a standalone room. */
  conference: AdminRoomConference | null;
}

/** Load one room. Throws a plain Error on a failed spine read (the committee
 *  row); every other slice degrades to empty, like the organiser page. */
export async function loadAdminRoom(sessionId: string, conferenceId: string | null): Promise<AdminRoom> {
  const authed = await getFreshAuthedClient();

  const [sRes, csRes, dRes, qRes, docRes, msgRes, fbRes, statusHistory] = await Promise.all([
    anonSupabase.from('committees')
      .select('id, code, name, phase, caucus, chair_names, suspended_at, ended_at, settings, updated_at, resuming_chair')
      .eq('id', sessionId)
      .maybeSingle(),
    anonSupabase.from('current_speaker')
      .select('committee_id, country, time_remaining, started_at')
      .eq('committee_id', sessionId),
    anonSupabase.from('delegates')
      .select('committee_id, country, status, is_observer, logo_url')
      .eq('committee_id', sessionId),
    anonSupabase.from('speakers_list')
      .select('committee_id, country, position, list_type')
      .eq('committee_id', sessionId)
      .order('position', { ascending: true }),
    anonSupabase.from('documents')
      .select('committee_id, type, status, doc_code, title, sponsors, approval, file_url, file_name, content, created_at')
      .eq('committee_id', sessionId),
    // Paged: one request stops at 1,000 rows.
    fetchAllRows((from, to) => anonSupabase.from('messages')
      .select('id, committee_id, sender, recipient, content, created_at')
      .eq('committee_id', sessionId)
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(from, to)),
    anonSupabase.from('feedback')
      .select('committee_id, country, chair_name, content, created_at, level, factor_scores, speech_context, speech_seconds, speech_topic, spoken_at')
      .eq('committee_id', sessionId)
      .order('created_at', { ascending: true }),
    // The roll-call history, for attendance "present at any point" like the chair's
    // board. Read with the staff member's token; a refused or failed read (a
    // standalone room) is null and attendance follows the current status.
    readStatusHistory(authed, sessionId),
  ]);

  if (sRes.error) throw new Error('room');
  const sRow = (sRes.data as Row | null) ?? null;
  const speakerRow = ((csRes.data ?? []) as Row[])[0] ?? null;
  const delegates = (dRes.data ?? []) as Row[];
  const queues = (qRes.data ?? []) as Row[];
  const documents = (docRes.data ?? []) as Row[];
  const messages = (msgRes.data ?? []) as Row[];
  const feedback = (fbRes.data ?? []) as Row[];

  // ── Conference half ──
  let conf: LiveCommittee['conf'];
  let conference: AdminRoomConference | null = null;
  const confRow = conferenceId && authed
    ? ((await authed.from('conference_committees')
        .select('id, name, abbreviation, logo_url, topics, total_slots, session_id, session_code, chair_user_ids, display_chairs, released_to_chairs_at, delegation_size')
        .eq('session_id', sessionId)
        .maybeSingle()).data as Row | null)
    : null;

  if (conferenceId && authed && confRow) {
    const chairIds = (confRow.chair_user_ids as string[] | null) ?? [];
    const [invites, profsRes, confRes] = await Promise.all([
      fetchPendingChairInvites(authed, conferenceId),
      chairIds.length > 0
        ? authed.from('profiles').select('id, display_name, avatar_url').in('id', chairIds)
        : Promise.resolve({ data: [] as Row[] }),
      authed.from('conferences')
        .select('id, slug, acronym, full_name, awards_config, awards_published_at, end_date')
        .eq('id', conferenceId)
        .maybeSingle(),
    ]);
    const profiles = new Map<string, Row>();
    for (const p of ((profsRes.data ?? []) as Row[])) profiles.set(p.id as string, p);
    const displayChairs = (confRow.display_chairs as { name: string; avatar_url: string | null }[] | null) ?? [];
    const chairs: ChairPerson[] = chairIds.map((uid, i) => {
      const prof = profiles.get(uid);
      const fallback = displayChairs[i];
      return {
        id: uid,
        name: (prof?.display_name as string | undefined) ?? fallback?.name ?? 'Chair',
        avatarUrl: (prof?.avatar_url as string | null | undefined) ?? fallback?.avatar_url ?? null,
      };
    });
    if (chairs.length === 0 && displayChairs.length > 0) {
      for (const d of displayChairs) chairs.push({ id: null, name: d.name, avatarUrl: d.avatar_url ?? null });
    }
    const pendingChairs: PendingChairPerson[] = invites
      .filter((inv) => inv.committee_id === confRow.id)
      .map((inv) => ({ id: inv.id, name: pendingInviteName(inv), avatarUrl: inv.profiles?.avatar_url ?? null }));
    conf = {
      id: confRow.id as string,
      name: confRow.name as string,
      abbreviation: (confRow.abbreviation as string | null) ?? null,
      logoUrl: (confRow.logo_url as string | null) ?? null,
      topics: (confRow.topics as string[] | null) ?? null,
      totalSlots: (confRow.total_slots as number) ?? 0,
      sessionId,
      sessionCode: (confRow.session_code as string | null) ?? null,
      releasedToChairsAt: (confRow.released_to_chairs_at as string | null) ?? null,
      delegationSize: (confRow.delegation_size as number | null) ?? 1,
      chairUserIds: chairIds,
      chairs,
      pendingChairs,
    };
    const c = (confRes.data as Row | null) ?? null;
    if (c) {
      conference = {
        id: c.id as string,
        slug: (c.slug as string) ?? '',
        label: ((c.acronym as string | null) || (c.full_name as string | null) || 'Conference'),
        awardsConfig: c.awards_config ?? null,
        awardsPublishedAt: (c.awards_published_at as string | null) ?? null,
        endDate: (c.end_date as string | null) ?? null,
      };
    }
  } else {
    // Standalone (or a conference row this account could not read): the
    // session is the whole committee. The id is the session's own, so nothing
    // conference-scoped (awards) can ever match it; the caller hides Awards.
    conf = {
      id: sessionId,
      name: (sRow?.name as string) ?? 'Committee',
      abbreviation: null,
      logoUrl: null,
      topics: null,
      totalSlots: delegates.length,
      sessionId,
      sessionCode: (sRow?.code as string | null) ?? null,
      releasedToChairsAt: null,
      delegationSize: 1,
      chairUserIds: [],
      chairs: [],
      pendingChairs: [],
    };
  }

  // ── Session half, exactly as the organiser page maps it ──
  const allLogs = messages
    .filter((m) => m.sender === '__system__' && typeof m.content === 'string' && (m.content as string).startsWith('__log__:'))
    .map((m) => {
      try {
        const p = JSON.parse((m.content as string).slice('__log__:'.length)) as Row;
        if (!p || typeof p !== 'object') return null;
        return {
          country: typeof p.country === 'string' ? p.country : '',
          type: typeof p.type === 'string' ? p.type : 'speech',
          seconds: typeof p.seconds === 'number' ? p.seconds : 0,
          context: typeof p.context === 'string' ? p.context : '',
          topic: typeof p.topic === 'string' ? p.topic : '',
          at: (typeof p.timestamp === 'string' ? p.timestamp : (m.created_at as string | null)) ?? null,
        };
      } catch { return null; }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
  const speechLogs = allLogs
    .filter((e) => e.type === 'speech' && e.country !== '__chair__')
    .map(({ country, seconds, context, topic, at }) => ({ country, seconds, context, topic, at }));
  const eventLogs = allLogs.map(({ country, type, at }) => ({ country, type, at }));

  const scoring = getScoringConfig({ dbScoring: (sRow?.settings as { scoring?: ScoringConfig } | null)?.scoring ?? null });

  const latest = (times: (string | null | undefined)[]): string | null => {
    const ms = times.filter((t): t is string => !!t).map((t) => Date.parse(t)).filter((n) => Number.isFinite(n));
    return ms.length > 0 ? new Date(Math.max(...ms)).toISOString() : null;
  };
  const lastActivityAt = latest([
    ...allLogs.map((e) => e.at),
    (speakerRow?.started_at as string | null) ?? null,
    ...documents.map((d) => d.created_at as string | null),
    ...feedback.map((f) => f.created_at as string | null),
  ]);
  const lastMessageAt = latest(messages.map((m) => m.created_at as string | null));

  const hasHistory = !!sRow && (
    queues.length > 0 || documents.length > 0 || allLogs.length > 0 || feedback.length > 0
    || !!speakerRow?.country || !!(sRow.suspended_at as string | null)
  );

  const data: LiveCommittee = {
    conf,
    session: sRow
      ? {
          id: sRow.id as string,
          code: sRow.code as string,
          name: sRow.name as string,
          phase: sRow.phase as string,
          caucus: (sRow.caucus as CaucusJson | null) ?? null,
          chairNames: (sRow.chair_names as string[] | null) ?? [],
          headChair: (((sRow.settings as { headChair?: unknown } | null)?.headChair) as string | undefined)
            || ((sRow.chair_names as string[] | null) ?? [])[0]
            || null,
          suspendedAt: (sRow.suspended_at as string | null) ?? null,
          endedAt: (sRow.ended_at as string | null) ?? null,
          updatedAt: (sRow.updated_at as string | null) ?? null,
          resumingChair: (sRow.resuming_chair as string | null) ?? null,
          quorumThreshold: ((sRow.settings as { quorumThreshold?: string } | null)?.quorumThreshold) ?? 'none',
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
    delegates: delegates.map((d) => ({
      country: d.country as string,
      status: d.status as string,
      isObserver: (d.is_observer as boolean | null) ?? false,
      logoUrl: (d.logo_url as string | null) ?? null,
    })),
    gslQueue: queues.filter((q) => q.list_type === 'gsl').map((q) => q.country as string),
    caucusQueue: queues.filter((q) => q.list_type === 'caucus').map((q) => q.country as string),
    documents: documents.map((d) => ({
      type: d.type as string,
      status: d.status as string,
      docCode: (d.doc_code as string) ?? '',
      title: (d.title as string) ?? '',
      sponsors: (d.sponsors as string[] | null) ?? [],
      fileUrl: (d.file_url as string | null) ?? null,
      fileName: (d.file_name as string | null) ?? null,
      content: (d.content as string | null) ?? null,
      createdAt: (d.created_at as string | null) ?? null,
    })),
    speechLogs,
    eventLogs,
    scores: sRow
      ? sessionHeadlineScores(sRow, delegates, messages, documents, feedback, { everPresent: everPresentFromHistory(statusHistory) }).map((x) => ({ country: x.country, total: x.headline }))
      : [],
    lastActivityAt,
    lastMessageAt,
    hasHistory,
    feedback: feedback.map((f) => ({
      country: f.country as string,
      chairName: (f.chair_name as string) ?? '',
      content: (f.content as string) ?? '',
      createdAt: (f.created_at as string) ?? '',
      level: (f.level as string) ?? 'speech',
      factorScores: (f.factor_scores as Record<string, number> | null) ?? {},
      speechContext: (f.speech_context as string | null) ?? null,
      speechSeconds: (f.speech_seconds as number | null) ?? null,
      speechTopic: (f.speech_topic as string | null) ?? null,
      spokenAt: (f.spoken_at as string | null) ?? null,
    })),
  };

  return { data, conference };
}
