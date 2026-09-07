'use client';

// ============================================================
// /manage/[slug]/scoreboard — the CROSS-COMMITTEE scoreboard.
//
// NO LONGER A DASHBOARD TAB. Delegate performance is a property of a committee,
// not of the conference, so the primary way in is now a committee on Live
// Status: its card footer and the Points block in its recap both open
// `CommitteeScoreboardModal`, which renders the SAME table this page does.
//
// THE ROUTE STAYS REACHABLE BY URL, deliberately. Three things live here and
// nowhere else, and none of them is per-committee:
//   • comparing delegations ACROSS committees in one ranked list;
//   • the whole-conference CSV export the secretariat uses for awards;
//   • a full-page view for a table that is genuinely long.
// Deleting the route would delete those. Its permission mapping is kept in
// layout.tsx for exactly this reason — an ungated URL is worse than a tab.
//
// `?committee=<conference_committees.id>` deep-links it pre-filtered, which is
// how the per-committee modal hands off to it.
//
// It computes NOTHING itself — src/lib/conferenceScoreboard.ts loads the rows
// and hands them to the same scoring functions the chair panel uses, and the
// table itself is `@/components/ScoreboardTable`, shared with the modal.
//
// Read-only by design. Organisers observe; only chairs award points.
// Manage surfaces render hardcoded English (no t()).
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Trophy, Search, Download, Radio } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NeuPill, NEU, NeuCard } from '@/components/neu';
import { committeeDisplayName } from '@/lib/presetNames';
import {
  loadConferenceScoreboard,
  formatSpeakingTime,
  COMMENT_LEVEL_LABEL,
  type ConferenceScoreboard,
  type ScoreboardDelegateRow,
} from '@/lib/conferenceScoreboard';
import {
  ScoreboardTable, SORTS, sortScoreboardRows, displayCountry, type SortKey,
} from '@/components/ScoreboardTable';
// This page used to hardcode `#FAF8F3`, `#D8CDB6` and `#9A8A78`. The last of
// those measures 2.71:1 on this background and was carrying every column
// header, every secondary fact and the whole "not yet scored" footer. The
// tokens below are measured — see live/tokens.ts.
import { SOFT, RED, CARD_BORDER_COLOR } from '@/app/manage/[slug]/live/tokens';

const OUTFIT = "'Outfit', sans-serif";

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Small presentational pieces ──────────────────────────────────────────────

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <NeuCard style={{ padding: '14px 18px', flex: '1 1 150px', minWidth: 0 }}>
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 10, letterSpacing: '0.12em', color: SOFT }}>
        {label}
      </p>
      <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 22, color: NEU.ink, fontVariantNumeric: 'tabular-nums', marginBlockStart: 4 }}>
        {value}
      </p>
      {hint && <p style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, marginBlockStart: 2 }}>{hint}</p>}
    </NeuCard>
  );
}

// `FactorBar` and `DelegateDetail` are gone from this file — they now live in
// `@/components/ScoreboardTable` alongside the table itself, so the per-committee
// modal and this page render byte-identical drill-ins instead of two copies
// drifting apart.

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ScoreboardPage() {
  const { conference } = useManage();
  const { session } = useAuth();

  const [data, setData] = useState<ConferenceScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // `?committee=<conference_committees.id>` — how the per-committee scoreboard
  // modal on Live Status hands off to the full page. Read once as the initial
  // filter; the pills own it from then on.
  const searchParams = useSearchParams();
  const [committeeFilter, setCommitteeFilter] = useState<string>(
    () => searchParams.get('committee') || 'ALL',
  );
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // One read on mount (and whenever the conference or the auth token changes).
  // `cancelled` guards against a slow response landing after the effect has been
  // torn down — otherwise switching conferences could paint the previous one's
  // rows over the new load.
  const conferenceId = conference?.id;
  const accessToken = session?.access_token;

  useEffect(() => {
    if (!conferenceId || !accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await loadConferenceScoreboard(getAuthedClient(accessToken), conferenceId);
        if (cancelled) return;
        setData(result);
        setLoadError('');
      } catch (err) {
        console.error('[ScoreboardPage] load failed:', err);
        if (!cancelled) setLoadError("Couldn't load the scoreboard. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conferenceId, accessToken]);

  const committees = useMemo(() => data?.committees ?? [], [data]);
  const allRows = useMemo(() => data?.rows ?? [], [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allRows.filter((r: ScoreboardDelegateRow) => {
      if (committeeFilter !== 'ALL' && r.committeeId !== committeeFilter) return false;
      if (!q) return true;
      return displayCountry(r.country).toLowerCase().includes(q)
        || r.country.toLowerCase().includes(q)
        || r.committeeName.toLowerCase().includes(q)
        || (r.committeeAbbrev ?? '').toLowerCase().includes(q);
    });
    // Sorting lives with the table, so this page and the per-committee modal
    // cannot rank the same delegations differently.
    return sortScoreboardRows(filtered, sortKey);
  }, [allRows, committeeFilter, query, sortKey]);

  const totals = useMemo(() => {
    const scope = committeeFilter === 'ALL'
      ? allRows
      : allRows.filter((r) => r.committeeId === committeeFilter);
    return {
      delegations: scope.length,
      speeches: scope.reduce((s, r) => s + r.gslSpeeches + r.caucusSpeeches, 0),
      seconds: scope.reduce((s, r) => s + r.speakingSeconds, 0),
      comments: scope.reduce((s, r) => s + r.comments.filter((c) => c.content.trim()).length, 0),
    };
  }, [allRows, committeeFilter]);


  function exportCsv() {
    const header = [
      'Committee', 'Session code', 'Delegation', 'Status', 'Score', 'Objective points', 'Quality (0-100)',
      'GSL speeches', 'Caucus speeches', 'Speaking seconds', 'Motions', 'Rights of reply',
      'Working papers', 'Draft resolutions', 'Manual adjustment', 'Factor ratings', 'Chair comments',
    ];
    const lines = [header.map(csvEscape).join(',')];
    for (const r of rows) {
      lines.push([
        r.committeeAbbrev || r.committeeName,
        r.sessionCode,
        displayCountry(r.country),
        r.status,
        r.headline,
        r.objective,
        r.quality ?? '',
        r.gslSpeeches,
        r.caucusSpeeches,
        r.speakingSeconds,
        r.motions,
        r.rightsOfReply,
        r.workingPapers,
        r.draftResolutions,
        r.manual,
        r.factors.map((f) => `${f.name}: ${f.average}/${f.scaleMax}`).join(' | '),
        r.comments.filter((c) => c.content.trim())
          .map((c) => `[${COMMENT_LEVEL_LABEL[c.level]}${c.chairName ? ` · ${c.chairName}` : ''}] ${c.content}`)
          .join(' || '),
      ].map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conference?.acronym ?? 'conference'}-scoreboard.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!conference) return null;

  const scopedCommittee = committeeFilter === 'ALL'
    ? null
    : committees.find((c) => c.id === committeeFilter) ?? null;

  return (
    <div className="px-6 md:px-10 py-8">
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, color: SOFT, letterSpacing: '0.12em', marginBlockEnd: 4 }}>
        {conference.acronym} / Scoreboard
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBlockEnd: 6 }}>
        <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 24, color: NEU.ink }}>
          {scopedCommittee ? committeeDisplayName(scopedCommittee.name, scopedCommittee.abbreviation) : 'Scoreboard'}
        </h1>
        <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
          {/* The awards desk is where this evidence ends up: the secretariat
              ratifies each committee's slate against these numbers. */}
          <Link
            href={`/manage/${conference.slug}/awards`}
            className="focus:outline-none"
            style={{
              fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, color: NEU.forest, backgroundColor: NEU.surface,
              border: `1px solid ${CARD_BORDER_COLOR}`, boxShadow: NEU.outSm, borderRadius: 10, padding: '8px 14px',
              display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
            }}
          >
            <Trophy size={13} strokeWidth={2.5} />
            AWARDS
          </Link>
          {!loading && allRows.length > 0 && (
            <button
              onClick={exportCsv}
              className="focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, color: NEU.gold, backgroundColor: NEU.forest,
                border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              <Download size={13} strokeWidth={2.5} />
              EXPORT CSV
            </button>
          )}
        </div>
      </div>
      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, marginBlockEnd: 12, maxWidth: 660 }}>
        Every delegation across your committees, as scored by the chairs in their live sessions —
        points, speeches, factor ratings and written comments. Read-only: only chairs can award points.
      </p>
      {/* This page is no longer in the sidebar; say where it came from and how
          to get back, so an organiser who lands here by URL is not stranded. */}
      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, marginBlockEnd: 22 }}>
        <Radio size={11} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: -1, marginInlineEnd: 5 }} />
        A single committee&apos;s scoreboard opens straight from its card on{' '}
        <Link href={`/manage/${conference.slug}/live`} style={{ color: NEU.forest, fontWeight: 700, textDecoration: 'none' }}>
          Live Status
        </Link>
        . This page is the cross-committee view and the CSV export.
      </p>

      {loadError && (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: RED, backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px', marginBlockEnd: 16 }}>
          {loadError}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Nothing linked to a live session yet */}
      {!loading && committees.length === 0 && (
        <NeuCard style={{ padding: 40, textAlign: 'center' }}>
          <span className="inline-flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(150deg, rgba(27,56,40,0.1), rgba(27,56,40,0.04))', border: `1px solid ${CARD_BORDER_COLOR}`, marginBlockEnd: 16 }}>
            <Trophy size={26} strokeWidth={1.8} style={{ color: NEU.forest }} />
          </span>
          <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, color: NEU.ink, marginBlockEnd: 6 }}>
            No scored committees yet
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, marginBlockEnd: 20, maxWidth: 420, marginInline: 'auto' }}>
            Scores appear here once a chair runs one of your committees as a live session. Each committee
            gets its session when it is created, and the chair scores delegates from the dais.
          </p>
          <Link
            href={`/manage/${conference.slug}/committees`}
            style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: NEU.gold, backgroundColor: NEU.forest, borderRadius: 10, padding: '8px 20px', textDecoration: 'none', display: 'inline-block' }}
          >
            GO TO COMMITTEES →
          </Link>
        </NeuCard>
      )}

      {!loading && committees.length > 0 && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBlockEnd: 20 }}>
            <StatTile label="COMMITTEES" value={String(committeeFilter === 'ALL' ? committees.length : 1)} />
            <StatTile label="DELEGATIONS" value={String(totals.delegations)} />
            <StatTile label="SPEECHES" value={String(totals.speeches)} />
            <StatTile label="SPEAKING TIME" value={formatSpeakingTime(totals.seconds)} />
            <StatTile label="CHAIR COMMENTS" value={String(totals.comments)} />
          </div>

          {/* Committee filter */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <NeuPill active={committeeFilter === 'ALL'} onClick={() => { setCommitteeFilter('ALL'); setExpanded(null); }}>
              ALL COMMITTEES
            </NeuPill>
            {committees.map((c) => (
              <NeuPill
                key={c.id}
                active={committeeFilter === c.id}
                onClick={() => { setCommitteeFilter(c.id); setExpanded(null); }}
              >
                {committeeDisplayName(c.name, c.abbreviation)}
              </NeuPill>
            ))}
          </div>

          {/* Sort + search */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: SOFT }}>
              SORT BY
            </span>
            {SORTS.map((s) => (
              <NeuPill key={s.key} active={sortKey === s.key} onClick={() => setSortKey(s.key)}>
                {s.label}
              </NeuPill>
            ))}
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, marginInlineStart: 'auto',
                backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`, borderRadius: 10,
                paddingInline: 11, paddingBlock: 7,
              }}
            >
              <Search size={13} style={{ color: SOFT, flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search delegation or committee"
                aria-label="Search delegation or committee"
                className="focus:outline-none"
                style={{
                  fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink,
                  backgroundColor: 'transparent', border: 'none', width: 210, maxWidth: '50vw',
                }}
              />
            </div>
          </div>

          {/* The table — the SAME component the per-committee modal renders. */}
          <ScoreboardTable
            rows={rows}
            sortKey={sortKey}
            showCommitteeColumn={committeeFilter === 'ALL'}
            expanded={expanded}
            onExpand={setExpanded}
          />

          {/* Committees with no live session yet */}
          {(data?.unlinked.length ?? 0) > 0 && (
            <NeuCard style={{ marginBlockStart: 20, padding: '14px 18px' }}>
              <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', color: SOFT, marginBlockEnd: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Radio size={12} strokeWidth={2.4} />
                NOT YET SCORED
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT }}>
                {data!.unlinked.map((u) => committeeDisplayName(u.name, u.abbreviation)).join(', ')}
                {' — '}no live session is linked to {data!.unlinked.length === 1 ? 'this committee' : 'these committees'} yet.
              </p>
            </NeuCard>
          )}
        </>
      )}
    </div>
  );
}
