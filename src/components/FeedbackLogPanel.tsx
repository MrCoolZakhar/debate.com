'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlagImg } from '@/components/FlagImg';
import { CaucusState, Committee } from '@/lib/types';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { getScoringConfig } from '@/lib/scoring';
import { factorName } from '@/lib/scoringNames';
import { addFeedback, updateFeedback, getFeedbackForCommittee } from '@/lib/committeeService';

type ItemKind = 'past' | 'live' | 'next';
interface FeedItem {
  key: string;
  kind: ItemKind;
  country: string;
  context: string;
  seconds?: number;
  timestamp?: string;
}
interface RowState { id?: string; content: string; scores: Record<string, number>; country: string; reconciled?: boolean; }
/** Another chair's note on the same speech. Read-only here — each chair edits only their own row. */
interface OtherNote { chairName: string; content: string; scores: Record<string, number>; }

interface PastSpeech { country: string; context: string; seconds: number; timestamp: string; }
function pastSpeeches(committee: Committee): PastSpeech[] {
  return (committee.messages ?? [])
    .filter((m) => m.sender === '__system__' && m.recipient === '__log__' && m.content.startsWith('__log__:'))
    .map((m) => { try { return JSON.parse(m.content.slice('__log__:'.length)); } catch { return null; } })
    .filter((e): e is { country: string; type?: string; context?: string; seconds?: number; timestamp?: string } =>
      !!e && (!e.type || e.type === 'speech') && typeof e.seconds === 'number')
    .map((e) => ({ country: e.country, context: e.context ?? 'speakers-list', seconds: e.seconds ?? 0, timestamp: e.timestamp ?? '' }));
}

// The caucus that is ACTUALLY on the floor right now. `committee.caucus` alone is not
// enough: the phase and the caucus JSONB can diverge (a suspend/end-debate leaves the
// caucus object behind, and the two writes that end a caucus land as separate rows), so
// a leftover object would otherwise keep the dock claiming a caucus long after the
// committee is back on the GSL. Both must agree before we call it a caucus.
export function liveCaucus(committee: Committee): CaucusState | null {
  const inCaucusPhase = committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus';
  return inCaucusPhase && committee.caucus ? committee.caucus : null;
}

// The context the live/upcoming speakers will be logged under (for later reconciliation).
function liveContext(committee: Committee): string {
  const caucus = liveCaucus(committee);
  if (!caucus) return 'speakers-list';
  return caucus.type === 'unmoderated' ? 'unmoderated-caucus' : 'moderated-caucus';
}

export default function FeedbackLogPanel({ committee, chairName, currentCountry, feedbackVersion = 0 }: {
  committee: Committee; chairName: string; currentCountry: string | null;
  /** Bumped by the chair page on every realtime `feedback` event — the refetch key. */
  feedbackVersion?: number;
}) {
  const { language } = useLanguage();
  const t = useT();
  const cfg = getScoringConfig(committee);
  // Ratings are opt-in (Settings -> Points). When off there are no factors, so the
  // rating column collapses and the note gets the full width of the dock.
  const factors = cfg.factorRatingsEnabled ? cfg.factors.filter((f) => f.enabled) : [];
  const caucus = liveCaucus(committee);
  const ctx = liveContext(committee);

  const past = useMemo(() => pastSpeeches(committee), [committee.messages]);
  // Upcoming queue (GSL or caucus), excluding whoever currently holds the floor.
  const queue = (caucus ? committee.caucusQueue : committee.speakersList) ?? [];
  const upcoming = queue.filter((s) => s.country !== currentCountry);

  const [state, setState] = useState<Record<string, RowState>>({});
  // Other chairs' notes on the same speeches, keyed by the same item key. Never edited
  // here: a row belongs to the chair whose name is on it.
  const [others, setOthers] = useState<Record<string, OtherNote[]>>({});
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const creatingRef = useRef<Set<string>>(new Set());
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const turnStartRef = useRef<number>(Date.now());

  // Focus-dock state. The focused bubble is the hero (editing UI); the live bubble is
  // primary by default. Hover lifts/sharpens any non-focused bubble.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // Live card key, a fresh turn (even same country, e.g. right of reply) gets a new card.
  const liveKey = currentCountry ? `live|${currentCountry}|${turnStartRef.current}` : null;

  const items: FeedItem[] = useMemo(() => {
    const out: FeedItem[] = [];
    for (const p of past) out.push({ key: `past|${p.country}|${p.timestamp}`, kind: 'past', country: p.country, context: p.context, seconds: p.seconds, timestamp: p.timestamp });
    if (currentCountry && liveKey) out.push({ key: liveKey, kind: 'live', country: currentCountry, context: ctx });
    for (const u of upcoming) out.push({ key: `next|${u.delegateId}`, kind: 'next', country: u.country, context: ctx });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, currentCountry, liveKey, JSON.stringify(upcoming.map((u) => u.delegateId)), ctx]);

  // Load every chair's speech feedback, and re-load whenever a realtime `feedback`
  // event lands (`feedbackVersion`). This used to run exactly once per mount behind a
  // `loadedRef` latch, which broke the moment a second chair joined: neither could see
  // the other's notes, and — worse — the greedy match below took the FIRST row for a
  // speech regardless of who wrote it, so chair B would adopt chair A's row id and the
  // next keystroke would UPDATE it, silently overwriting A's note. Rows are now split
  // by author: you edit yours, you read theirs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await getFeedbackForCommittee(committee.id);
      if (cancelled) return;
      const fb = all.filter((f) => f.level === 'speech');

      const mineNext: Record<string, RowState> = {};
      const theirsNext: Record<string, OtherNote[]> = {};
      const used = new Set<string>();

      const claim = (key: string, f: typeof fb[number], reconciled: boolean) => {
        if (used.has(f.id)) return;
        if (f.chairName === chairName) {
          if (mineNext[key]) return;            // one row per speech per chair
          used.add(f.id);
          mineNext[key] = { id: f.id, content: f.content, scores: f.factorScores ?? {}, country: f.country, reconciled };
        } else {
          used.add(f.id);
          // One entry per chair per speech. Duplicate rows for the same chair DO exist in
          // production — before this effect matched unreconciled rows, a reload mid-speech
          // made a second row rather than adopting the first — so collapse them here
          // instead of listing the same name twice. The row with prose wins; failing that
          // the newest, since getFeedbackForCommittee returns them created_at ascending.
          const bucket = (theirsNext[key] ??= []);
          const at = bucket.findIndex((o) => o.chairName === f.chairName);
          const entry = { chairName: f.chairName, content: f.content, scores: f.factorScores ?? {} };
          if (at < 0) bucket.push(entry);
          else if (!bucket[at].content.trim()) bucket[at] = entry;
        }
      };

      // A LOGGED speech is identified by country + context + seconds.
      for (const p of past) {
        const key = `past|${p.country}|${p.timestamp}`;
        for (const f of fb) {
          if (f.country !== p.country) continue;
          if ((f.speechContext ?? '') !== p.context || (f.speechSeconds ?? 0) !== p.seconds) continue;
          claim(key, f, true);
        }
      }
      // PASS 2 — ORPHAN REPAIR. A row saved in the last moments of a speech is INSERTed
      // asynchronously, so `speech_seconds` is still null when the speech gets logged, and
      // the reconcile effect below skips it (it requires an id that has not arrived yet).
      // The row is then orphaned: it matches no past key, and pass 3 would hand it to the
      // NEXT card for the same country — whose first keystroke would UPDATE it, destroying
      // the earlier speech's note. Countries speak repeatedly in a moderated caucus, so
      // this fires constantly.
      //
      // So: adopt each orphan onto the earliest logged speech it can belong to (same
      // country and author, created before that speech was logged), and patch the DB so it
      // is exact from then on. This repairs rows already orphaned in production, and it
      // consumes them BEFORE pass 3 can steal them, which is what stops the overwrite.
      for (const p of past) {
        const key = `past|${p.country}|${p.timestamp}`;
        if (mineNext[key]) continue;
        const orphan = fb.find((f) =>
          !used.has(f.id) && f.country === p.country && f.chairName === chairName &&
          f.speechSeconds == null &&
          (!p.timestamp || !f.createdAt || f.createdAt <= p.timestamp));
        if (!orphan) continue;
        claim(key, orphan, true);
        updateFeedback(orphan.id, { speechContext: p.context, speechSeconds: p.seconds },
          committee.code, committee.dbChairJoinSuffix ?? undefined);
      }

      // PASS 3 — a row written while the delegate still HOLDS the floor genuinely has no
      // seconds yet, so whatever survives pass 2 belongs to the live/next card.
      for (const item of items) {
        if (item.kind === 'past') continue;
        for (const f of fb) {
          if (f.country !== item.country || f.speechSeconds != null) continue;
          claim(item.key, f, false);
        }
      }

      if (cancelled) return;
      setOthers(theirsNext);
      setState((prev) => {
        const merged = { ...prev };
        for (const [key, row] of Object.entries(mineNext)) {
          const cur = merged[key];
          // A refetch must NEVER overwrite what this chair is typing — our own write
          // echoes back through realtime, so this runs mid-edit routinely. Adopt the
          // row only to learn its id (so the next keystroke UPDATEs rather than
          // inserting a duplicate); local text and scores always win.
          merged[key] = cur
            ? { ...cur, id: cur.id ?? row.id, reconciled: cur.reconciled || row.reconciled }
            : row;
        }
        return merged;
      });
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.id, past.length, feedbackVersion, chairName, currentCountry]);

  // On speaker change: FLUSH FIRST, then start the new turn.
  //
  // The order matters. Once `turnStartRef` moves, the outgoing speaker's live card has a
  // key nothing renders any more, so anything still unsaved is unreachable. `flushAll`
  // reads stateRef and the recorded item metadata, both of which still describe the
  // OUTGOING turn at this point, so the note lands on the right speech.
  //
  // `flushRef` keeps this effect off `flushAll`'s identity — it is redefined every
  // render, and depending on it would re-run this on every keystroke and reset the
  // chair's focus mid-sentence.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    return () => { flushRef.current(); };   // outgoing turn, and unmount
  }, [currentCountry]);
  useEffect(() => {
    turnStartRef.current = Date.now();
    setFocusKey(null);
  }, [currentCountry]);

  // Reconcile live/upcoming comments onto a speech once it's actually logged.
  useEffect(() => {
    for (const p of past) {
      const pastKey = `past|${p.country}|${p.timestamp}`;
      if (stateRef.current[pastKey]?.id) continue;
      const candKey = Object.keys(stateRef.current).find((k) =>
        (k.startsWith('live|') || k.startsWith('next|')) &&
        stateRef.current[k].country === p.country &&
        stateRef.current[k].id && !stateRef.current[k].reconciled);
      if (!candKey) continue;
      const entry = stateRef.current[candKey];
      updateFeedback(entry.id!, { speechContext: p.context, speechSeconds: p.seconds }, committee.code, committee.dbChairJoinSuffix ?? undefined);
      setState((prev) => ({
        ...prev,
        [pastKey]: { ...entry, reconciled: true },
        [candKey]: { ...prev[candKey], reconciled: true },
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.messages]);

  const persist = (item: FeedItem, content: string, scores: Record<string, number>) => {
    const cur = stateRef.current[item.key];
    if (cur?.id) { updateFeedback(cur.id, { content, factorScores: scores }, committee.code, committee.dbChairJoinSuffix ?? undefined); return; }
    // Nothing worth a row yet. Blurring an untouched note box used to INSERT an empty
    // one — production carries several, each a chair who clicked into the box and
    // clicked straight back out. They render as a delegate having been "commented on"
    // when nobody wrote anything.
    if (!content.trim() && !Object.values(scores).some((v) => (v ?? 0) > 0)) return;
    if (creatingRef.current.has(item.key)) return;
    creatingRef.current.add(item.key);
    addFeedback(committee.id, item.country, chairName, content, committee.code, committee.dbChairJoinSuffix ?? undefined, {
      level: 'speech', factorScores: scores, speechContext: item.context, speechSeconds: item.seconds ?? null,
    }).then((id) => {
      creatingRef.current.delete(item.key);
      if (!id) return;
      setState((prev) => {
        const latest = prev[item.key] ?? { content, scores, country: item.country };
        if (latest.content !== content || JSON.stringify(latest.scores) !== JSON.stringify(scores)) {
          updateFeedback(id, { content: latest.content, factorScores: latest.scores }, committee.code, committee.dbChairJoinSuffix ?? undefined);
        }
        return { ...prev, [item.key]: { ...latest, id, country: item.country } };
      });
    });
  };

  // ── Saving a note must NEVER depend on the textarea losing focus ───────────
  //
  // It used to: `persist` ran on `onBlur` only. The chair who writes notes is the
  // COMMENTER, and the chair who advances the speaker is the MODERATOR — a different
  // person on a different device. So the ordinary case is: the Commenter is mid-sentence,
  // the Moderator clicks Next, `currentCountry` changes, `turnStartRef` resets, the live
  // card's key changes, the card unmounts, and the text that was never blurred is gone.
  // It never reached the database at all. That is the note loss chairs reported, and it
  // gets worse the faster the committee moves.
  //
  // Two belts: a debounced autosave while typing, and a hard flush of everything dirty
  // the moment the speaker changes (and on unmount).
  const dirtyRef = useRef<Set<string>>(new Set());
  const itemMetaRef = useRef<Record<string, FeedItem>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Typed text captured SYNCHRONOUSLY on every keystroke. `stateRef` is updated in an
  // effect, and React runs every cleanup before any effect — so if a keystroke and the
  // speaker change land in the same commit, the flush below would read the value from
  // before that keystroke and drop the last thing the chair typed. This ref cannot be
  // stale: it is written in the event handler itself.
  const typedRef = useRef<Record<string, string>>({});

  const flushKey = (key: string) => {
    const meta = itemMetaRef.current[key];
    const row = stateRef.current[key];
    const content = typedRef.current[key] ?? row?.content ?? '';
    if (!meta) return;
    dirtyRef.current.delete(key);
    persist(meta, content, row?.scores ?? {});
  };
  const flushAll = () => {
    for (const key of Array.from(dirtyRef.current)) flushKey(key);
  };
  // Kept current so the speaker-change cleanup above always calls today's closure
  // without taking a dependency on it.
  flushRef.current = flushAll;

  const setNote = (item: FeedItem, content: string) => {
    itemMetaRef.current[item.key] = item;
    dirtyRef.current.add(item.key);
    typedRef.current[item.key] = content;
    setState((prev) => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { scores: {}, country: item.country }), content, country: item.country } }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushAll, 700);
  };
  const setScore = (item: FeedItem, factorId: string, v: number) => {
    itemMetaRef.current[item.key] = item;
    return setState((prev) => {
      const cur = prev[item.key] ?? { content: '', scores: {}, country: item.country };
      const scores = { ...cur.scores, [factorId]: v };
      const nextRow = { ...cur, scores, country: item.country };
      dirtyRef.current.delete(item.key);
      persist(item, nextRow.content, scores);
      return { ...prev, [item.key]: nextRow };
    });
  };

  const effectiveFocus = focusKey ?? liveKey;
  const focusIdx = items.findIndex((i) => i.key === effectiveFocus);

  // Roll the focused row to the vertical centre whenever focus changes.
  useEffect(() => {
    if (!effectiveFocus) return;
    const id = setTimeout(() => {
      rowRefs.current[effectiveFocus]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 30);
    return () => clearTimeout(id);
  }, [effectiveFocus]);

  const PILL_TRANSITION = 'transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease, opacity 260ms ease, box-shadow 260ms ease, background-color 260ms ease';
  // Reserved so pills/grids stay aligned across rows. Collapses to 0 when ratings are
  // switched off, handing the full width of the dock back to the note.
  const GRID_COL = factors.length ? 280 : 0;
  // The tag belongs to the ROW, not to the room: a past speech keeps the context it was
  // actually given under. Only rows sitting on the live context borrow the running caucus's
  // own label — otherwise a finished caucus speech would be re-tagged by whatever is on the
  // floor now (or, once the caucus ends, re-tag the GSL rows as a caucus).
  const tagFor = (item: FeedItem) => {
    if (item.context === 'speakers-list') return t('fb_tag_gsl');
    if (item.context === ctx && caucus?.motionLabel) return caucus.motionLabel;
    return item.context === 'unmoderated-caucus' ? t('fb_tag_unmod') : t('fb_tag_caucus');
  };
  const maxScale = Math.max(1, cfg.factorScaleMax);

  // Every chair's note on one speech, mine first. The author prefix appears ONLY when
  // more than one chair has written — a single chair (the overwhelmingly common case)
  // reads exactly as it always did, with no name eating the width.
  const notesFor = (key: string, mine: RowState): { chairName: string; content: string; isMine: boolean }[] => {
    const out: { chairName: string; content: string; isMine: boolean }[] = [];
    if (mine.content.trim()) out.push({ chairName, content: mine.content.trim(), isMine: true });
    for (const o of others[key] ?? []) {
      if (o.content.trim()) out.push({ chairName: o.chairName || t('fb_chair'), content: o.content.trim(), isMine: false });
    }
    return out;
  };

  // Distance-based recede (index 0 = focused). Gentle on scale so pills stay wide.
  const scaleByDist = [1, 0.98, 0.96, 0.94];
  const opacityByDist = [1, 0.7, 0.55, 0.45];
  const blurByDist = [0, 0.6, 1.2, 1.6];

  // Qualitative ratings, sliders (lowest 0 … highest max) on the focused pill;
  // compact greyed read-only bars on the nearest neighbour.
  // Compact 2×2 grid of small rating sliders (interactive on the focused pill; greyed
  // read-only values on the nearest neighbour). The slider track itself reads low→high.
  const metricStack = (item: FeedItem, rs: RowState, interactive: boolean) => (
    <div className="grid gap-x-4 gap-y-1.5" style={{ width: GRID_COL, gridTemplateColumns: '1fr 1fr' }}>
      {/* Every ENABLED factor, not the first four. The old cap meant a chair could add
          a fifth factor in Settings, never be offered a slider for it here, and then see
          a permanently empty row for it on the scoreboard — which renders whatever is
          enabled. The grid simply grows another row. */}
      {factors.map((f) => {
        const v = rs.scores[f.id] ?? 0;
        if (!interactive) {
          return (
            <div key={f.id} className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wide truncate flex-1" style={{ color: '#B8AE9C' }}>{factorName(f, language)}</span>
              <span className="text-[11px] font-bold shrink-0" style={{ color: '#9A8A78' }}>{v}</span>
            </div>
          );
        }
        return (
          <div key={f.id}>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color: '#6A5A4A' }}>{factorName(f, language)}</span>
              <span className="text-xs font-black shrink-0" style={{ color: '#1B3828' }}>{v}</span>
            </div>
            <input
              type="range" min={0} max={maxScale} step={1} value={v}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setScore(item, f.id, parseInt(e.target.value))}
              className="w-full" style={{ accentColor: '#1B3828', height: 14 }}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ fontFamily: "'Poppins','Outfit',sans-serif" }}>
      <style>{`.fb-dock-scroll::-webkit-scrollbar{display:none}`}</style>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs px-4" style={{ color: '#9A8A78' }}>{t('fb_empty')}</p>
        </div>
      ) : (
        <div className="fb-dock-scroll flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex flex-col justify-start gap-2 pt-2 pb-6 px-6">
            {items.map((item, idx) => {
              const rs = state[item.key] ?? { content: '', scores: {}, country: item.country };
              const isLive = item.kind === 'live';
              const isFocused = item.key === effectiveFocus;
              const isHover = hoverKey === item.key && !isFocused;
              const scored = Object.values(rs.scores).some((x) => (x ?? 0) > 0);
              const notes = notesFor(item.key, rs);
              const theirs = notes.filter((n) => !n.isMine);
              const dist = focusIdx >= 0 ? Math.min(Math.abs(idx - focusIdx), 3) : 0;

              let scale = scaleByDist[dist], opacity = opacityByDist[dist], blur = blurByDist[dist];
              let boxShadow = '0 3px 12px rgba(28,20,16,0.07)';
              if (isFocused) {
                scale = 1; opacity = 1; blur = 0;
                boxShadow = '0 0 0 2px #B8844A, 0 14px 36px rgba(28,20,16,0.18)';
              } else if (isHover) {
                scale = 1.02; opacity = 1; blur = 0;
                boxShadow = '0 10px 26px rgba(28,20,16,0.16)';
              }

              return (
                <div
                  key={item.key}
                  ref={(el) => { rowRefs.current[item.key] = el; }}
                  className="w-full flex items-center gap-3 shrink-0"
                  style={{ opacity, transition: PILL_TRANSITION }}
                >
                  {isFocused ? (
                    /* Active, wide, 2-row writing bubble */
                    <div
                      className="flex-1 min-w-0"
                      style={{
                        borderRadius: 22, backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(221,212,192,0.85)', boxShadow,
                        transform: `scale(${scale})`, transformOrigin: 'center', transition: PILL_TRANSITION,
                        padding: '12px 16px',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-black uppercase tracking-wider shrink-0" style={{ color: '#1B3828' }}>{tagFor(item)}</span>
                        <FlagImg code={getCountryByName(item.country)?.code ?? ''} size={26} className="shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-base font-bold" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
                        {!isLive && <button onClick={(e) => { e.stopPropagation(); setFocusKey(null); }} className="shrink-0 text-sm" style={{ color: '#9A8A78' }}>✕</button>}
                      </div>
                      <textarea
                        rows={2}
                        value={rs.content}
                        onChange={(e) => setNote(item, e.target.value)}
                        onBlur={() => persist(item, rs.content, rs.scores)}
                        placeholder={t('fb_private_note')}
                        className="w-full mt-2 text-sm rounded-lg px-3 py-2 outline-none resize-none"
                        style={{ color: '#1C1410', backgroundColor: '#FAF8F3', border: '1px solid #EDE7D8' }}
                      />
                      {/* What the other chairs wrote on this same speech — read-only, in the
                          same box, so the dais reads as one record rather than N private ones.
                          Each chair edits only the row carrying their own name. */}
                      {theirs.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs leading-snug px-1">
                          {theirs.map((n, ni) => (
                            <span key={ni} className="inline-flex items-baseline gap-1">
                              {ni > 0 && <span style={{ color: '#B8AE9C' }}>/</span>}
                              <span style={{ fontWeight: 700, color: '#1B3828' }}>{n.chairName}</span>
                              <span style={{ color: '#6A5A4A' }}>{n.content}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Collapsed capsule, shows the note written for this delegate */
                    <div
                      onMouseEnter={() => setHoverKey(item.key)}
                      onMouseLeave={() => setHoverKey((k) => (k === item.key ? null : k))}
                      onClick={() => setFocusKey(item.key)}
                      className="flex-1 min-w-0 flex items-center gap-3"
                      style={{
                        height: 54, borderRadius: 9999, backgroundColor: '#EDE7D8',
                        border: '1px solid rgba(221,212,192,0.85)', boxShadow,
                        transform: `scale(${scale})`, filter: blur ? `blur(${blur}px)` : 'none',
                        transformOrigin: 'center', transition: PILL_TRANSITION,
                        cursor: 'pointer', padding: '0 20px',
                      }}
                    >
                      <FlagImg code={getCountryByName(item.country)?.code ?? ''} size={22} className="shrink-0" />
                      <span className="font-semibold shrink-0" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
                      {notes.length > 0 ? (
                        <span className="flex-1 min-w-0 truncate text-sm" style={{ color: '#6A5A4A' }}>
                          {/* Drop the author ONLY when the single note is your own — that is the
                              common case and it should read exactly as it always did. A lone note
                              written by SOMEONE ELSE must still carry their name, or you cannot tell
                              your own note from a colleague's. */}
                          {notes.length === 1 && notes[0].isMine ? `— ${notes[0].content}` : notes.map((n, ni) => (
                            <span key={ni}>
                              {ni > 0 && <span style={{ color: '#B8AE9C' }}> / </span>}
                              <span style={{ fontWeight: 700, color: '#1B3828' }}>{n.chairName}: </span>
                              {n.content}
                            </span>
                          ))}
                        </span>
                      ) : <span className="flex-1" />}
                      {scored && <span className="shrink-0 text-sm font-black" style={{ color: '#1B3828' }}>✓</span>}
                    </div>
                  )}

                  {/* 2×2 metric grid, interactive for focused, greyed read-only for nearest, absent otherwise */}
                  <div className="shrink-0" style={{ width: GRID_COL }}>
                    {factors.length > 0 && (isFocused || dist === 1) && metricStack(item, rs, isFocused)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
