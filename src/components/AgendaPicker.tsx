'use client';

// ─────────────────────────────────────────────────────────────────────────────
// AgendaPicker: "Setting the agenda" on a conference committee with 2-3 topics.
//
// A conference committee can carry up to three topics (`conference_committees.topics`,
// CHECK 1..3). Its live session is minted with topic 1, but in a real MUN the dais
// chooses which topic opens debate, and later moves to the next one. This file owns
// the whole feature so the chair page only mounts it:
//
//   • useSessionAgendaTopics  one read of `conference_committees.topics` by
//                             `session_id`. The anon client can read it for both
//                             published and unpublished conferences (policy "Anyone
//                             can read committees by link"), so no RPC is needed.
//   • useAgendaPicker         when to show the picker, and the optimistic pick.
//   • AgendaPicker            the full-screen ceremonial chooser.
//
// Contract: the chosen 0-based index lives at `committees.settings.agendaTopicIndex`
// (absent = never chosen) and is written together with `committees.topic` by
// `updateCommitteeAgendaInDB`. Both chair and voting loaders strip it on hydrate
// (AGENTS.md rule 12), so a stale store copy can never write it back.
//
// ABSOLUTELY NO CHANGE for a standalone session or a conference committee with 0 or
// 1 topics: the query does not even run for standalone sessions, nothing blocks
// render while it runs, and the picker appears only once it has returned 2+ topics.
// Commenters (`isViewOnly`) are never blocked; they see the topic change via realtime.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { updateCommitteeAgendaInDB } from '@/lib/committeeService';
import { useT } from '@/contexts/LanguageContext';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import type { Committee } from '@/lib/types';

/** Reads the topics of the conference committee linked to this session. Null until the
 *  query returns (and forever for a standalone session, where it never runs). */
export function useSessionAgendaTopics(sessionId: string | null): string[] | null {
  // Keyed by the session it was read for, so a different session never sees a stale
  // answer and nothing has to be reset synchronously inside the effect.
  const [result, setResult] = useState<{ id: string; topics: string[] } | null>(null);
  const topics = sessionId && result?.id === sessionId ? result.topics : null;
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    supabase
      .from('conference_committees')
      .select('topics')
      .eq('session_id', sessionId)
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error('Error reading agenda topics:', error); return; }
        const raw = (data?.[0]?.topics as unknown) ?? null;
        const clean = Array.isArray(raw)
          ? raw.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
          : [];
        setResult({ id: sessionId, topics: clean });
      });
    return () => { cancelled = true; };
  }, [sessionId]);
  return topics;
}

// PRESENCE of a numeric index means the agenda was chosen, even when it no longer
// fits (an organiser deleted that topic): the chair is not forced to choose again.
function hasStoredAgenda(committee: Committee | null): boolean {
  const v = committee?.dbSettings?.agendaTopicIndex;
  return typeof v === 'number' && Number.isInteger(v);
}

// The index only as a fallback for WHICH topic is current, and only when it fits.
function storedAgendaIndex(committee: Committee | null, count: number): number | null {
  const v = committee?.dbSettings?.agendaTopicIndex;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < count ? v : null;
}

export function useAgendaPicker({
  committee,
  isViewOnly,
  sessionEnded,
  sessionSuspended,
  applyLocal,
}: {
  committee: Committee | null;
  isViewOnly: boolean;
  sessionEnded: boolean;
  sessionSuspended: boolean;
  /** The chair page's `updateLocal(setCommittee, updater)` (non-structural). */
  applyLocal: (updater: (c: Committee) => Committee) => void;
}) {
  const t = useT();
  const isConference = committee?.sessionOrigin === 'conference';
  const topics = useSessionAgendaTopics(isConference ? committee?.id ?? null : null);
  const count = topics?.length ?? 0;
  const hasAgenda = count >= 2;

  const [manualOpen, setManualOpen] = useState(false);
  // Set the moment THIS device picks. A realtime snapshot fetched just before our write
  // landed carries no agendaTopicIndex yet; without this the picker would flash back open.
  const [localPick, setLocalPick] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const storedIndex = storedAgendaIndex(committee, count);
  const chosen = hasStoredAgenda(committee);
  // The room's own topic text first: an organiser can reorder topics after the pick,
  // which leaves the stored index pointing at a different topic than the room shows.
  const currentIndex = useMemo(() => {
    if (!topics || !hasAgenda) return null;
    const i = topics.indexOf((committee?.topic ?? '').trim());
    if (i >= 0) return i;
    if (localPick !== null && localPick < count) return localPick;
    return storedIndex;
  }, [topics, hasAgenda, storedIndex, localPick, count, committee?.topic]);

  const canSwitch = hasAgenda && !!committee && !isViewOnly && !sessionEnded;
  const mandatory = canSwitch
    && committee?.phase === 'pre-session'
    && !sessionSuspended
    && !chosen
    && localPick === null;
  const open = canSwitch && (mandatory || manualOpen);

  const openPicker = useCallback(() => { setError(null); setManualOpen(true); }, []);
  const closePicker = useCallback(() => { setError(null); setManualOpen(false); }, []);

  const pick = useCallback(async (index: number) => {
    if (!committee || !topics || busyRef.current) return;
    const topic = topics[index];
    if (!topic) return;
    // Re-picking the topic already under debate is a no-op, not a write.
    if (storedIndex === index && committee.topic === topic) { closePicker(); return; }

    busyRef.current = true;
    const prevTopic = committee.topic;
    const prevSettings = committee.dbSettings ?? null;
    const prevHadIndex = !!prevSettings && Object.prototype.hasOwnProperty.call(prevSettings, 'agendaTopicIndex');
    const prevIndexValue = prevSettings?.agendaTopicIndex;
    const prevLocalPick = localPick;

    // Optimistic first (AGENTS.md rule 5): the header and the sidebar show the new topic now.
    setError(null);
    setLocalPick(index);
    setManualOpen(false);
    applyLocal((c) => ({ ...c, topic, dbSettings: { ...(c.dbSettings ?? {}), agendaTopicIndex: index } }));

    const ok = await updateCommitteeAgendaInDB(
      committee.id, index, topic, committee.code, committee.dbChairJoinSuffix ?? undefined,
    );
    busyRef.current = false;
    if (ok) return;

    // The write did not land. Roll back, unless something newer has already replaced
    // the topic (a realtime refetch), in which case that newer truth stays.
    applyLocal((c) => {
      if (c.topic !== topic) return c;
      const s: Record<string, unknown> = { ...(c.dbSettings ?? {}) };
      if (prevHadIndex) s.agendaTopicIndex = prevIndexValue; else delete s.agendaTopicIndex;
      return { ...c, topic: prevTopic, dbSettings: s };
    });
    setLocalPick(prevLocalPick);
    setError(t('agenda_failed'));
    setManualOpen(true); // back on screen, so the chair sees the error and can choose again
  }, [committee, topics, storedIndex, localPick, applyLocal, closePicker, t]);

  const picker = open && topics ? (
    <AgendaPicker
      topics={topics}
      currentIndex={currentIndex}
      mandatory={mandatory}
      error={error}
      onPick={pick}
      onClose={closePicker}
    />
  ) : null;

  return { canSwitch, open, openPicker, picker };
}

const NUMERAL_COLOR = '#1B3828';

export default function AgendaPicker({
  topics,
  currentIndex,
  mandatory,
  error,
  onPick,
  onClose,
}: {
  topics: string[];
  /** Highlighted as CURRENT when switching later. Null on the first choice. */
  currentIndex: number | null;
  /** First choice before roll call: no way to dismiss it. */
  mandatory: boolean;
  error: string | null;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButtonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (mandatory) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mandatory, onClose]);

  const cols = topics.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gv-agenda-title"
      className="absolute inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto px-8 py-10"
      style={{ backgroundColor: '#EDE7D8', fontFamily: OUTFIT }}
    >
      <style>{`
        @keyframes gvAgendaIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .gv-agenda-in { animation: gvAgendaIn 420ms ${EASE} both; }
        .gv-agenda-card {
          transition: transform 180ms ${EASE}, box-shadow 180ms ${EASE}, background-color 180ms ease;
        }
        .gv-agenda-card:hover { transform: translateY(-3px); box-shadow: ${NEU.outHover}; }
        .gv-agenda-card:active { transform: translateY(-1px) scale(0.99); }
        .gv-agenda-card:hover .gv-agenda-num { color: #B6871F; }
        .gv-agenda-num { transition: color 180ms ease; }
        @media (prefers-reduced-motion: reduce) {
          .gv-agenda-in { animation: none; }
          .gv-agenda-card, .gv-agenda-num { transition: none; }
          .gv-agenda-card:hover, .gv-agenda-card:active { transform: none; }
        }
      `}</style>

      {/* Same grain the chair page lays over its ivory ground. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      {!mandatory && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 end-6 z-[1] px-4 py-2 rounded-xl text-sm font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-[#B6871F]/50 gv-lift"
          style={{ color: '#1B3828', backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
        >
          {t('agenda_keep')}
        </button>
      )}

      <div className="relative z-[1] w-full max-w-[1120px] flex flex-col items-center text-center">
        <p className="gv-agenda-in text-xs font-bold tracking-[0.28em] mb-4" style={{ color: '#8B5A20' }}>
          {t('agenda_eyebrow')}
        </p>
        <h1
          id="gv-agenda-title"
          className="gv-agenda-in text-5xl font-black tracking-tight mb-3"
          style={{ color: '#1B3828', textWrap: 'balance', animationDelay: '40ms' }}
        >
          {t('agenda_title')}
        </h1>
        <p className="gv-agenda-in text-base mb-10 max-w-xl" style={{ color: '#6A5A4A', textWrap: 'pretty', animationDelay: '80ms' }}>
          {mandatory ? t('agenda_subtitle_first') : t('agenda_subtitle_switch')}
        </p>

        <div className={`grid grid-cols-1 ${cols} gap-6 w-full`}>
          {topics.map((topic, i) => {
            const isCurrent = currentIndex === i;
            return (
              <button
                key={i}
                ref={i === 0 ? firstButtonRef : undefined}
                type="button"
                onClick={() => onPick(i)}
                aria-label={t('agenda_topic_aria', { n: String(i + 1), topic })}
                aria-current={isCurrent ? 'true' : undefined}
                className="gv-agenda-in gv-agenda-card relative flex flex-col items-start text-start rounded-3xl px-8 pt-6 pb-8 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#B6871F]/60"
                style={{
                  backgroundColor: NEU.surface,
                  boxShadow: NEU.out,
                  border: isCurrent ? '2px solid #1B3828' : '2px solid transparent',
                  animationDelay: `${140 + i * 70}ms`,
                }}
              >
                {isCurrent && (
                  <span
                    className="absolute top-5 end-6 text-[10px] font-black tracking-[0.18em] px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
                  >
                    {t('agenda_current')}
                  </span>
                )}
                <span
                  aria-hidden
                  className="gv-agenda-num font-black leading-none"
                  style={{ fontSize: 112, color: NUMERAL_COLOR, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}
                >
                  {i + 1}
                </span>
                <span aria-hidden className="block h-[3px] w-12 rounded-full mt-4 mb-4" style={{ backgroundColor: '#EED98A' }} />
                <span
                  className="block text-xl font-semibold leading-snug"
                  style={{ color: '#1C1410', textWrap: 'pretty', overflowWrap: 'anywhere' }}
                >
                  {topic}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-8 text-sm font-semibold max-w-xl" style={{ color: '#8B2020' }}>
            {error}
          </p>
        )}
        <p className="mt-8 text-sm" style={{ color: '#6A5A4A' }}>{t('agenda_hint')}</p>
      </div>
    </div>
  );
}
