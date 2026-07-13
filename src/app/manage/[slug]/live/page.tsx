'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  RefreshCw, Copy, Check, Gavel, Users, Mic, MicOff,
  FileText, ScrollText, FileCheck, Trophy, Radio, PauseCircle, Flag,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { FlagImg } from '@/components/FlagImg';
import {
  type LiveCommittee, type CaucusJson, cardStatus, PHASE_LABELS, fmtClock, flagCodeFor,
  RecapModal, AwardsModal,
} from './LiveModals';

const OUTFIT = "'Outfit', sans-serif";

// Grain texture, same feTurbulence data-URI as conferences/ConferenceCard.tsx
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

// ── Small shared bits ───────────────────────────────────────────────────────

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] font-bold uppercase"
      style={{ color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.08em', ...style }}
    >
      {children}
    </p>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center justify-center rounded-lg focus:outline-none transition-colors flex-shrink-0"
      style={{ width: 28, height: 28, border: '1px solid #DDD4C0', backgroundColor: 'transparent', color: copied ? '#2A5A3C' : '#6B5F52' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function FlagDot({ country }: { country: string }) {
  return (
    <span
      className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
      style={{ width: 22, height: 22, border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', marginLeft: -6 }}
      title={country}
    >
      <FlagImg code={flagCodeFor(country)} size={14} />
    </span>
  );
}

// ── Not-started card ────────────────────────────────────────────────────────

function NotStartedCard({
  data,
  committeesHref,
}: {
  data: LiveCommittee;
  committeesHref: string;
}) {
  const session = data.session;

  return (
    <div
      className="rounded-[20px] p-5 flex flex-col relative"
      style={{
        backgroundColor: '#FAF8F3',
        border: '1px solid #DDD4C0',
        boxShadow: '0 1px 3px rgba(27,56,40,0.05)',
      }}
    >
      {/* Greyed-out committee identity */}
      <div style={{ opacity: 0.55, filter: 'saturate(0.7)' }}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="font-extrabold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 22, lineHeight: 1.1 }}>
            {data.conf.abbreviation ?? data.conf.name}
          </h3>
          <span
            className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase flex-shrink-0"
            style={{ backgroundColor: 'rgba(28,20,16,0.06)', color: '#6B5F52', border: '1px solid rgba(28,20,16,0.14)', fontFamily: OUTFIT, letterSpacing: '0.08em' }}
          >
            Not started
          </span>
        </div>
        <p className="text-sm truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{data.conf.name}</p>
      </div>

      {/* Centered overlay, session code, ready to share */}
      <div
        className="rounded-2xl px-5 py-7 my-4 flex flex-col items-center text-center"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 8px 24px rgba(27,56,40,0.1)' }}
      >
        {session ? (
          <>
            <Eyebrow style={{ letterSpacing: '0.12em' }}>Session not in progress yet</Eyebrow>
            <div className="flex items-center gap-2.5 mt-3">
              <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: '#1C1410', letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {session.code}
              </span>
              <CopyButton value={session.code} />
            </div>
            <p className="text-[11px] mt-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Session code: share with your chairs
            </p>
          </>
        ) : (
          <>
            <Eyebrow style={{ letterSpacing: '0.12em' }}>Session not in progress yet</Eyebrow>
            <p className="text-sm font-bold mt-3" style={{ color: '#1C1410', fontFamily: OUTFIT }}>No session code yet</p>
            <Link
              href={committeesHref}
              className="text-sm font-bold inline-block mt-1 transition-colors"
              style={{ color: '#1B3828', fontFamily: OUTFIT, textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
            >
              Generate it in Committees →
            </Link>
          </>
        )}
      </div>

      {/* Chair assignment line (greyed) */}
      <div style={{ opacity: 0.55 }}>
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
          <Gavel size={12} style={{ flexShrink: 0 }} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {data.conf.chairUserIds.length} chair{data.conf.chairUserIds.length === 1 ? '' : 's'} assigned
          </span>
        </p>
        {session && session.chairNames.length > 0 && (
          <p className="text-xs mt-1 truncate" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
            Joined: {session.chairNames.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Live / suspended / ended card ───────────────────────────────────────────

function currentMotionLabel(phase: string, caucus: CaucusJson | null): { label: string; detail: string | null; remaining: number | null } {
  if (caucus && (caucus.active ?? true)) {
    const label = caucus.type === 'unmoderated' ? 'Unmoderated Caucus' : 'Moderated Caucus';
    return {
      label: caucus.motionLabel || label,
      detail: caucus.purpose || null,
      remaining: typeof caucus.remainingTime === 'number' ? caucus.remainingTime : null,
    };
  }
  if (phase === 'speakers-list') return { label: "General Speakers' List (GSL)", detail: null, remaining: null };
  return { label: PHASE_LABELS[phase] ?? phase, detail: null, remaining: null };
}

function LiveCard({
  data,
  onOpenRecap,
  onOpenAwards,
}: {
  data: LiveCommittee;
  onOpenRecap: (data: LiveCommittee) => void;
  onOpenAwards: (data: LiveCommittee) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const status = cardStatus(data);
  const session = data.session!;
  const caucusActive = !!session.caucus && (session.caucus.active ?? true);
  const motion = currentMotionLabel(session.phase, session.caucus);

  const speaker = data.currentSpeaker;
  const present = data.delegates.filter((d) => d.status !== 'absent').length;

  const wps = data.documents.filter((d) => d.type === 'working-paper');
  const drs = data.documents.filter((d) => d.type === 'draft-resolution');
  const wpsPresented = wps.filter((d) => d.status !== 'submitted').length;
  const drsPresented = drs.filter((d) => d.status !== 'submitted').length;
  const passedCount = data.documents.filter((d) => d.status === 'passed').length;
  // Voting indicator: an introduced DR means the voting page is (about to be) driving —
  // do NOT rely on phase='voting', the voting page never sets it.
  const votingDr = drs.find((d) => d.status === 'introduced');

  const upNext = caucusActive ? data.caucusQueue : data.gslQueue;
  const shownFlags = upNext.slice(0, 10);
  const overflow = upNext.length - shownFlags.length;

  const chipStyle: React.CSSProperties = {
    backgroundColor: 'rgba(27,56,40,0.05)',
    border: '1px solid rgba(221,212,192,0.7)',
    color: '#6B5F52',
    fontFamily: OUTFIT,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div
      className="rounded-[20px] p-5 flex flex-col cursor-pointer"
      onClick={() => onOpenRecap(data)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#FAF8F3',
        border: '1px solid #DDD4C0',
        boxShadow: hovered
          ? '0 20px 48px rgba(27,56,40,0.16), 0 2px 8px rgba(27,56,40,0.08)'
          : '0 1px 3px rgba(27,56,40,0.05)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: `transform 260ms ${EASE}, box-shadow 260ms ${EASE}`,
      }}
    >
      {/* Status eyebrow */}
      {status === 'live' && (
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-full animate-pulse flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: '#3D7A52' }} />
          <span className="text-[11px] font-bold uppercase" style={{ color: '#1B3828', fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
            In session
          </span>
        </div>
      )}
      {status === 'suspended' && (
        <div
          className="flex items-center gap-2 mb-3 rounded-xl px-3 py-2"
          style={{ backgroundColor: 'rgba(238,217,138,0.25)', border: '1px solid rgba(182,135,31,0.45)' }}
        >
          <PauseCircle size={14} style={{ color: '#B6871F', flexShrink: 0 }} />
          <span className="text-[11px] font-extrabold uppercase" style={{ color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
            Suspended
          </span>
        </div>
      )}
      {status === 'ended' && (
        <div
          className="flex items-center gap-2 mb-3 rounded-xl px-3 py-2"
          style={{ backgroundColor: 'rgba(28,20,16,0.05)', border: '1px solid rgba(28,20,16,0.14)' }}
        >
          <Flag size={14} style={{ color: '#6B5F52', flexShrink: 0 }} />
          <span className="text-[11px] font-extrabold uppercase" style={{ color: '#6B5F52', fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
            Adjourned
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-extrabold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 22, lineHeight: 1.1 }}>
            {data.conf.abbreviation ?? data.conf.name}
          </h3>
          <p className="text-sm truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{data.conf.name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 min-w-0" style={{ maxWidth: '45%' }}>
          <Gavel size={13} style={{ color: '#9A8A78', flexShrink: 0 }} />
          <span className="text-xs truncate" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
            {session.chairNames.length > 0 ? session.chairNames.join(', ') : 'No chairs joined'}
          </span>
        </div>
      </div>

      {/* Current motion */}
      <div
        className="rounded-xl px-3.5 py-2.5 mt-4"
        style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1px solid rgba(221,212,192,0.7)' }}
      >
        <Eyebrow style={{ fontSize: 10 }}>Current motion</Eyebrow>
        <div className="flex items-baseline justify-between gap-3 mt-0.5">
          <p className="text-sm font-bold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{motion.label}</p>
          {motion.remaining !== null && (
            <span className="text-sm font-black flex-shrink-0" style={{ color: '#1B3828', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
              {fmtClock(motion.remaining)}
            </span>
          )}
        </div>
        {motion.detail && (
          <p className="text-xs truncate mt-0.5" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>{motion.detail}</p>
        )}
      </div>

      {/* Current speaker */}
      <div className="flex items-center gap-2 mt-3.5" style={{ minHeight: 26 }}>
        {speaker?.country ? (
          <>
            <FlagImg code={flagCodeFor(speaker.country)} size={24} />
            <span className="text-sm font-bold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{speaker.country}</span>
            {speaker.startedAt ? (
              <Mic size={14} style={{ color: '#3D7A52', flexShrink: 0 }} />
            ) : (
              <span className="inline-flex items-center gap-1 text-xs flex-shrink-0" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                <MicOff size={13} /> paused
              </span>
            )}
          </>
        ) : (
          <span className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No speaker on the floor</span>
        )}
      </div>

      {/* Voting procedure banner */}
      {votingDr && (
        <div
          className="rounded-xl px-3.5 py-2.5 mt-3"
          style={{ backgroundColor: 'rgba(238,217,138,0.25)', border: '1px solid rgba(182,135,31,0.45)' }}
        >
          <p className="text-xs font-extrabold uppercase" style={{ color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
            Voting procedure: {votingDr.docCode || 'draft resolution'} on the floor
          </p>
        </div>
      )}

      {/* Doc + delegate chips */}
      <div className="flex flex-wrap gap-2 mt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={chipStyle}>
          <FileText size={12} />
          WPs {wpsPresented}/{wps.length}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={chipStyle}>
          <ScrollText size={12} />
          DRs {drsPresented}/{drs.length}
        </span>
        {passedCount > 0 && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ ...chipStyle, color: '#2A5A3C', backgroundColor: 'rgba(61,122,82,0.1)', border: '1px solid rgba(61,122,82,0.3)' }}
          >
            <FileCheck size={12} />
            {passedCount} passed
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={chipStyle}>
          <Users size={12} />
          {present}/{data.delegates.length} present
        </span>
      </div>

      {/* Up next, flowing speakers strip */}
      <div className="mt-4">
        <Eyebrow style={{ fontSize: 10 }}>Up next</Eyebrow>
        <div className="flex items-center mt-1.5" style={{ paddingLeft: 6, minHeight: 22 }}>
          {shownFlags.length > 0 ? (
            <>
              {shownFlags.map((country, i) => <FlagDot key={`${country}-${i}`} country={country} />)}
              {overflow > 0 && (
                <span
                  className="flex items-center justify-center rounded-full text-[9px] font-extrabold flex-shrink-0"
                  style={{ width: 22, height: 22, marginLeft: -6, backgroundColor: '#1B3828', color: '#EED98A', border: '1px solid #DDD4C0', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
                >
                  +{overflow}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Queue empty</span>
          )}
        </div>
      </div>

      {/* Awards footer */}
      {/* TODO(merge): wire to chair award allocation from production branch */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenAwards(data); }}
        className="flex items-center gap-2 mt-4 pt-3 w-full text-left focus:outline-none transition-colors"
        style={{ borderTop: '1px solid rgba(221,212,192,0.55)', color: '#9A8A78', fontFamily: OUTFIT, backgroundColor: 'transparent' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
      >
        <Trophy size={13} style={{ flexShrink: 0 }} />
        <span className="text-xs font-semibold">Awards: not allocated</span>
      </button>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function LiveStatusPage() {
  const { conference } = useManage();
  const { session: authSession } = useAuth();

  const [rows, setRows] = useState<LiveCommittee[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [recapFor, setRecapFor] = useState<string | null>(null);
  const [awardsFor, setAwardsFor] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (!conference || !authSession) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    try {
      const authed = getAuthedClient(authSession.access_token);
      const { data: confCommittees } = await authed
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots, session_id, session_code, chair_user_ids')
        .eq('conference_id', conference.id)
        .order('name', { ascending: true });

      const confRows = confCommittees ?? [];
      const sessionIds = confRows.map((c) => c.session_id).filter((id): id is string => !!id);

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
          anonSupabase.from('committees')
            .select('id, code, name, phase, caucus, chair_names, suspended_at, ended_at')
            .in('id', sessionIds),
          anonSupabase.from('current_speaker')
            .select('committee_id, country, time_remaining, started_at')
            .in('committee_id', sessionIds),
          anonSupabase.from('delegates')
            .select('committee_id, country, status')
            .in('committee_id', sessionIds),
          anonSupabase.from('speakers_list')
            .select('committee_id, country, position, list_type')
            .in('committee_id', sessionIds)
            .order('position', { ascending: true }),
          anonSupabase.from('motions')
            .select('committee_id, type, topic, disruptiveness')
            .eq('status', 'pending')
            .in('committee_id', sessionIds),
          anonSupabase.from('documents')
            .select('committee_id, type, status, doc_code, sponsors')
            .in('committee_id', sessionIds),
          anonSupabase.from('messages')
            .select('committee_id, sender, content, created_at')
            .eq('sender', '__system__')
            .in('committee_id', sessionIds),
          anonSupabase.from('feedback')
            .select('committee_id, country, chair_name, content, created_at')
            .in('committee_id', sessionIds),
        ]);
        sessions = sRes.data ?? [];
        speakers = csRes.data ?? [];
        delegates = dRes.data ?? [];
        queues = qRes.data ?? [];
        motions = mRes.data ?? [];
        documents = docRes.data ?? [];
        sysMessages = msgRes.data ?? [];
        feedback = fbRes.data ?? [];
      }

      const bySession = <T extends Record<string, unknown>>(list: T[], sid: string) =>
        list.filter((r) => r.committee_id === sid);

      const assembled: LiveCommittee[] = confRows.map((c) => {
        const sid = c.session_id as string | null;
        const sRow = sid ? sessions.find((s) => s.id === sid) ?? null : null;
        const speakerRow = sid ? speakers.find((s) => s.committee_id === sid) ?? null : null;

        const speechLogs = sid
          ? bySession(sysMessages, sid)
              .filter((m) => typeof m.content === 'string' && (m.content as string).startsWith('__log__:'))
              .map((m) => {
                try { return JSON.parse((m.content as string).slice('__log__:'.length)); } catch { return null; }
              })
              .filter((e): e is { country: string; seconds: number; context: string; topic: string } => e !== null)
          : [];

        return {
          conf: {
            id: c.id as string,
            name: c.name as string,
            abbreviation: (c.abbreviation as string | null) ?? null,
            topics: (c.topics as string[] | null) ?? null,
            totalSlots: (c.total_slots as number) ?? 0,
            sessionId: sid,
            sessionCode: (c.session_code as string | null) ?? null,
            chairUserIds: (c.chair_user_ids as string[] | null) ?? [],
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
              }
            : null,
          currentSpeaker: speakerRow
            ? {
                country: (speakerRow.country as string | null) ?? null,
                timeRemaining: (speakerRow.time_remaining as number) ?? 0,
                startedAt: (speakerRow.started_at as string | null) ?? null,
              }
            : null,
          delegates: sid ? bySession(delegates, sid).map((d) => ({ country: d.country as string, status: d.status as string })) : [],
          gslQueue: sid ? bySession(queues, sid).filter((q) => q.list_type === 'gsl').map((q) => q.country as string) : [],
          caucusQueue: sid ? bySession(queues, sid).filter((q) => q.list_type === 'caucus').map((q) => q.country as string) : [],
          pendingMotions: sid
            ? bySession(motions, sid)
                .filter((m) => m.type !== 'join-request' && m.type !== 'gsl-request')
                .map((m) => ({ type: m.type as string, topic: (m.topic as string) ?? '' }))
            : [],
          documents: sid
            ? bySession(documents, sid).map((d) => ({
                type: d.type as string,
                status: d.status as string,
                docCode: (d.doc_code as string) ?? '',
                sponsors: (d.sponsors as string[] | null) ?? [],
              }))
            : [],
          speechLogs,
          feedback: sid
            ? bySession(feedback, sid).map((f) => ({
                country: f.country as string,
                chairName: (f.chair_name as string) ?? '',
                content: (f.content as string) ?? '',
                createdAt: (f.created_at as string) ?? '',
              }))
            : [],
        };
      });

      setRows(assembled);
      setLastRefreshed(Date.now());
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [conference?.id, authSession?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + 10s polling (kept simple + robust for N committees, no per-committee channels)
  useEffect(() => {
    loadAll();
    const poll = setInterval(loadAll, 10_000);
    return () => clearInterval(poll);
  }, [loadAll]);

  // 1s tick for the "Refreshed Xs ago" label
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Derived ──
  const recapData = recapFor ? rows?.find((r) => r.conf.id === recapFor) ?? null : null;
  const awardsData = awardsFor ? rows?.find((r) => r.conf.id === awardsFor) ?? null : null;

  const liveCount = (rows ?? []).filter((r) => cardStatus(r) === 'live').length;
  const chairsJoined = (rows ?? []).reduce((sum, r) => sum + (r.session?.chairNames.length ?? 0), 0);

  const secondsAgo = lastRefreshed ? Math.max(0, Math.floor((Date.now() - lastRefreshed) / 1000)) : null;

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Eyebrow>Live status</Eyebrow>
          <h1 className="font-black" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 28, lineHeight: 1.1, marginTop: 2 }}>
            Committee floor
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {secondsAgo !== null && (
            <span className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
              Refreshed {secondsAgo}s ago
            </span>
          )}
          <button
            onClick={loadAll}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl py-2 px-4 text-xs font-bold uppercase transition-colors focus:outline-none"
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', opacity: refreshing ? 0.6 : 1 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary hero strip */}
      <div
        className="mb-7 rounded-[22px] overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #16301F 0%, #1B3828 46%, #2A5A3C 100%)',
          border: '2px solid rgba(238,217,138,0.22)',
          boxShadow: '0 4px 14px rgba(27,56,40,0.2), 0 24px 60px rgba(27,56,40,0.24)',
        }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }} />
        <div
          className="pointer-events-none absolute"
          style={{ top: -120, right: -80, width: 380, height: 380, borderRadius: '9999px', background: 'radial-gradient(circle, rgba(238,217,138,0.22), transparent 66%)' }}
        />
        <div className="relative px-6 md:px-8 py-6 flex items-center gap-8 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(238,217,138,0.14)', border: '1px solid rgba(238,217,138,0.3)' }}>
              <Radio size={20} style={{ color: '#EED98A' }} />
            </span>
            <div>
              <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: 'rgba(238,217,138,0.78)' }}>
                {conference?.acronym ?? '…'} · FLOOR OVERVIEW
              </p>
              <p className="font-black" style={{ color: '#F7F3E9', fontFamily: OUTFIT, fontSize: 18, lineHeight: 1.15 }}>
                {liveCount > 0 ? 'Committees are in session' : 'All quiet on the floor'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            {[
              { value: rows?.length ?? 0, label: 'COMMITTEES' },
              { value: liveCount, label: 'IN SESSION' },
              { value: chairsJoined, label: 'CHAIRS JOINED' },
            ].map((s) => (
              <div key={s.label}>
                <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, color: '#F7F3E9', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                <p style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(238,217,138,0.78)', marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {rows === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-[20px] animate-pulse" style={{ height: 300, backgroundColor: 'rgba(250,248,243,0.7)', border: '1px solid #DDD4C0' }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <p className="text-sm font-bold mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>No committees yet</p>
          <Link
            href={conference ? `/manage/${conference.slug}/committees` : '#'}
            className="text-sm font-bold transition-colors"
            style={{ color: '#1B3828', fontFamily: OUTFIT, textDecoration: 'none' }}
          >
            Create them in Committees →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => {
            const status = cardStatus(r);
            return status === 'no-session' || status === 'not-started' ? (
              <NotStartedCard
                key={r.conf.id}
                data={r}
                committeesHref={conference ? `/manage/${conference.slug}/committees` : '#'}
              />
            ) : (
              <LiveCard
                key={r.conf.id}
                data={r}
                onOpenRecap={(d) => setRecapFor(d.conf.id)}
                onOpenAwards={(d) => setAwardsFor(d.conf.id)}
              />
            );
          })}
        </div>
      )}

      {/* Modals */}
      {recapData && <RecapModal data={recapData} onClose={() => setRecapFor(null)} />}
      {awardsData && <AwardsModal data={awardsData} onClose={() => setAwardsFor(null)} />}
    </div>
  );
}
