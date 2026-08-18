'use client';

// ============================================================
// /manage/[slug]/scoreboard — the secretariat's cross-committee scoreboard.
//
// Chairs score delegates inside the live session (ScoreboardPanel, scoped to one
// committee). This is the conference-wide read of the same data: every
// delegation in every committee, their points, their speeches, and the chairs'
// factor ratings and free-text notes on them.
//
// It computes NOTHING itself — src/lib/conferenceScoreboard.ts loads the rows
// and hands them to the same scoring functions the chair panel uses.
//
// Read-only by design. Organisers observe; only chairs award points.
// Manage surfaces render hardcoded English (no t()).
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Trophy, Search, Download, MessageSquareQuote, ChevronRight, Radio } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NeuPill } from '@/components/neu';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { committeeDisplayName } from '@/lib/presetNames';
import {
  loadConferenceScoreboard,
  formatSpeakingTime,
  COMMENT_LEVEL_LABEL,
  type ConferenceScoreboard,
  type ScoreboardDelegateRow,
} from '@/lib/conferenceScoreboard';

const OUTFIT = "'Outfit', sans-serif";
const CARD_SHADOW = '0 2px 8px rgba(27,56,40,0.05), 0 12px 32px rgba(27,56,40,0.06)';

// Manage surfaces are English-only, so country names resolve against 'en'.
const LOCALE = 'en';
const displayCountry = (c: string) => getCountryDisplayName(c, LOCALE);

type SortKey = 'score' | 'speeches' | 'time' | 'comments' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'score', label: 'SCORE' },
  { key: 'speeches', label: 'SPEECHES' },
  { key: 'time', label: 'SPEAKING TIME' },
  { key: 'comments', label: 'COMMENTS' },
  { key: 'name', label: 'DELEGATION' },
];

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Small presentational pieces ──────────────────────────────────────────────

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 14,
        padding: '14px 18px', boxShadow: CARD_SHADOW, flex: '1 1 150px', minWidth: 0,
      }}
    >
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 10, letterSpacing: '0.12em', color: '#9A8A78' }}>
        {label}
      </p>
      <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 22, color: '#1C1410', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
        {value}
      </p>
      {hint && (
        <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78', marginTop: 2 }}>{hint}</p>
      )}
    </div>
  );
}

/** A factor rating as a bar — no charting library, just a filled track. */
function FactorBar({ name, average, scaleMax, ratings }: { name: string; average: number; scaleMax: number; ratings: number }) {
  const pct = Math.max(0, Math.min(100, (average / Math.max(1, scaleMax)) * 100));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: '#1C1410' }}>{name}</span>
        <span
          style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78', marginInlineStart: 'auto', fontVariantNumeric: 'tabular-nums' }}
          title={`Average of ${ratings} rating${ratings === 1 ? '' : 's'}`}
        >
          {average} / {scaleMax}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.09)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, backgroundColor: '#1B3828' }} />
      </div>
    </div>
  );
}

function DelegateDetail({ row }: { row: ScoreboardDelegateRow }) {
  // Group the ledger by source, exactly as the chair's drill-in does. Only one
  // row is ever expanded at a time and a ledger is a few dozen entries, so this
  // runs on render without memoisation.
  const grouped: { sourceId: string; label: string; rows: typeof row.ledger; subtotal: number }[] = [];
  for (const r of row.ledger) {
    let g = grouped.find((x) => x.sourceId === r.sourceId);
    if (!g) { g = { sourceId: r.sourceId, label: r.label, rows: [], subtotal: 0 }; grouped.push(g); }
    g.rows.push(r);
    g.subtotal += r.pts;
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(27,56,40,0.035)', borderTop: '1px solid #E6DFCB',
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {/* Points breakdown */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: '#B6871F', marginBottom: 8 }}>
            POINTS BREAKDOWN
          </p>
          {grouped.length === 0 && (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#9A8A78' }}>No scored activity yet.</p>
          )}
          {grouped.map((g) => (
            <div key={g.sourceId} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: '#1B3828', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {g.label}
                </span>
                <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, marginInlineStart: 'auto', fontVariantNumeric: 'tabular-nums', color: g.subtotal < 0 ? '#8B2020' : '#1B3828' }}>
                  {g.subtotal < 0 ? '' : '+'}{g.subtotal}
                </span>
              </div>
              {g.rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                  <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#6A5A4A', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.detail || r.label}
                    {r.timestamp ? ` · ${new Date(r.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: r.pts < 0 ? '#8B2020' : '#1C1410', flexShrink: 0 }}>
                    {r.pts < 0 ? '' : '+'}{r.pts}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Chair ratings + comments */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: '#B6871F', marginBottom: 8 }}>
            CHAIR RATINGS
          </p>
          {row.factors.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#9A8A78', marginBottom: 14 }}>
              No factor ratings recorded by the chairs.
            </p>
          ) : (
            <div style={{ marginBottom: 14 }}>
              {row.factors.map((f) => (
                <FactorBar key={f.id} name={f.name} average={f.average} scaleMax={f.scaleMax} ratings={f.ratings} />
              ))}
            </div>
          )}

          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: '#B6871F', marginBottom: 8 }}>
            CHAIR COMMENTS
          </p>
          {row.comments.filter((c) => c.content.trim()).length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#9A8A78' }}>No written comments yet.</p>
          ) : (
            row.comments.filter((c) => c.content.trim()).map((c) => (
              <div
                key={c.id}
                style={{
                  backgroundColor: '#FAF8F3', border: '1px solid #E6DFCB', borderRadius: 10,
                  padding: '9px 11px', marginBottom: 7,
                }}
              >
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#1C1410', lineHeight: 1.5 }}>
                  {c.content}
                </p>
                <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: '#9A8A78', marginTop: 5 }}>
                  {COMMENT_LEVEL_LABEL[c.level]}
                  {c.chairName ? ` · ${c.chairName}` : ''}
                  {c.speechSeconds ? ` · ${c.speechSeconds}s speech` : ''}
                  {c.createdAt ? ` · ${new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ScoreboardPage() {
  const { conference } = useManage();
  const { session } = useAuth();

  const [data, setData] = useState<ConferenceScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState<string>('ALL');
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
    const filtered = allRows.filter((r) => {
      if (committeeFilter !== 'ALL' && r.committeeId !== committeeFilter) return false;
      if (!q) return true;
      return displayCountry(r.country).toLowerCase().includes(q)
        || r.country.toLowerCase().includes(q)
        || r.committeeName.toLowerCase().includes(q)
        || (r.committeeAbbrev ?? '').toLowerCase().includes(q);
    });
    const byName = (a: ScoreboardDelegateRow, b: ScoreboardDelegateRow) =>
      displayCountry(a.country).localeCompare(displayCountry(b.country), LOCALE);
    const withComments = (r: ScoreboardDelegateRow) => r.comments.filter((c) => c.content.trim()).length;

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'speeches': return (b.gslSpeeches + b.caucusSpeeches) - (a.gslSpeeches + a.caucusSpeeches) || byName(a, b);
        case 'time': return b.speakingSeconds - a.speakingSeconds || byName(a, b);
        case 'comments': return withComments(b) - withComments(a) || byName(a, b);
        case 'name': return byName(a, b);
        default: return b.headline - a.headline || byName(a, b);
      }
    });
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

  const showCommitteeColumn = committeeFilter === 'ALL';

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

  return (
    <div className="px-6 md:px-10 py-8">
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, color: '#9A8A78', letterSpacing: '0.12em', marginBottom: 4 }}>
        {conference.acronym} / Scoreboard
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 24, color: '#1C1410' }}>Scoreboard</h1>
        {!loading && allRows.length > 0 && (
          <button
            onClick={exportCsv}
            className="focus:outline-none"
            style={{
              fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, color: '#EED98A', backgroundColor: '#1B3828',
              border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7, marginInlineStart: 'auto',
            }}
          >
            <Download size={13} strokeWidth={2.5} />
            EXPORT CSV
          </button>
        )}
      </div>
      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78', marginBottom: 24, maxWidth: 640 }}>
        Every delegation across your committees, as scored by the chairs in their live sessions —
        points, speeches, factor ratings and written comments. Read-only: only chairs can award points.
      </p>

      {loadError && (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
          {loadError}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Nothing linked to a live session yet */}
      {!loading && committees.length === 0 && (
        <div style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <span className="inline-flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(150deg, rgba(27,56,40,0.1), rgba(27,56,40,0.04))', border: '1px solid rgba(27,56,40,0.18)', marginBottom: 16 }}>
            <Trophy size={26} strokeWidth={1.8} style={{ color: '#1B3828' }} />
          </span>
          <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, color: '#1C1410', marginBottom: 6 }}>
            No scored committees yet
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78', marginBottom: 20, maxWidth: 420, marginInline: 'auto' }}>
            Scores appear here once a chair runs one of your committees as a live session. Each committee
            gets its session when it is created, and the chair scores delegates from the dais.
          </p>
          <Link
            href={`/manage/${conference.slug}/committees`}
            style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: '#EED98A', backgroundColor: '#1B3828', borderRadius: 10, padding: '8px 20px', textDecoration: 'none', display: 'inline-block' }}
          >
            GO TO COMMITTEES →
          </Link>
        </div>
      )}

      {!loading && committees.length > 0 && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
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
            <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: '#B6871F' }}>
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
                backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 10,
                paddingInline: 11, paddingBlock: 7,
              }}
            >
              <Search size={13} style={{ color: '#9A8A78', flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search delegation or committee"
                aria-label="Search delegation or committee"
                className="focus:outline-none"
                style={{
                  fontFamily: OUTFIT, fontSize: 12.5, color: '#1C1410',
                  backgroundColor: 'transparent', border: 'none', width: 210, maxWidth: '50vw',
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div
            style={{
              backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16,
              boxShadow: CARD_SHADOW, overflow: 'hidden',
            }}
          >
            {/* Header row — hidden on narrow screens where the cards stack */}
            <div
              className="hidden md:flex"
              style={{
                alignItems: 'center', gap: 12, paddingInline: 18, paddingBlock: 10,
                borderBottom: '1px solid #E6DFCB', backgroundColor: 'rgba(27,56,40,0.04)',
              }}
            >
              <span style={{ width: 28, fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: '#9A8A78', textAlign: 'end' }}>#</span>
              <span style={{ width: 22 }} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: '#9A8A78' }}>DELEGATION</span>
              {showCommitteeColumn && (
                <span style={{ width: 120, fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: '#9A8A78' }}>COMMITTEE</span>
              )}
              <span style={{ width: 70, fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: '#9A8A78', textAlign: 'end' }}>SPEECHES</span>
              <span style={{ width: 78, fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: '#9A8A78', textAlign: 'end' }}>TIME</span>
              <span style={{ width: 62, fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: '#9A8A78', textAlign: 'end' }}>NOTES</span>
              <span style={{ width: 62, fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: '#9A8A78', textAlign: 'end' }}>SCORE</span>
              <span style={{ width: 16 }} />
            </div>

            {rows.length === 0 && (
              <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78', textAlign: 'center', padding: '40px 0' }}>
                No delegations match this filter.
              </p>
            )}

            {rows.map((r, i) => {
              const open = expanded === r.key;
              const noteCount = r.comments.filter((c) => c.content.trim()).length;
              return (
                <div key={r.key} style={{ borderBottom: i < rows.length - 1 || open ? '1px solid #F0EDE6' : 'none' }}>
                  <button
                    onClick={() => setExpanded(open ? null : r.key)}
                    aria-expanded={open}
                    className="w-full focus:outline-none"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      paddingInline: 18, paddingBlock: 11,
                      background: open ? 'rgba(27,56,40,0.05)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'start', flexWrap: 'wrap',
                    }}
                    onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLElement).style.background = 'rgba(27,56,40,0.03)'; }}
                    onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ width: 28, fontFamily: OUTFIT, fontSize: 11.5, color: '#9A8A78', fontVariantNumeric: 'tabular-nums', textAlign: 'end', flexShrink: 0 }}>
                      {sortKey === 'name' ? '' : i + 1}
                    </span>
                    <span style={{ width: 22, flexShrink: 0, display: 'inline-flex' }}>
                      <FlagImg code={getCountryByName(r.country)?.code ?? ''} size={20} />
                    </span>
                    <span style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: OUTFIT, fontWeight: 600, fontSize: 13.5, color: '#1C1410', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayCountry(r.country)}
                      </span>
                      {(r.status === 'absent' || r.isObserver) && (
                        <span style={{ fontFamily: OUTFIT, fontSize: 10.5, color: '#9A8A78' }}>
                          {r.isObserver ? 'Observer' : 'Absent'}
                        </span>
                      )}
                    </span>
                    {showCommitteeColumn && (
                      <span
                        style={{ width: 120, flexShrink: 0, fontFamily: OUTFIT, fontSize: 11.5, color: '#6A5A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={r.committeeName}
                      >
                        {committeeDisplayName(r.committeeName, r.committeeAbbrev)}
                      </span>
                    )}
                    <span
                      style={{ width: 70, flexShrink: 0, fontFamily: OUTFIT, fontSize: 12.5, color: '#6A5A4A', fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}
                      title={`${r.gslSpeeches} GSL · ${r.caucusSpeeches} caucus`}
                    >
                      {r.gslSpeeches + r.caucusSpeeches}
                    </span>
                    <span style={{ width: 78, flexShrink: 0, fontFamily: OUTFIT, fontSize: 12.5, color: '#6A5A4A', fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}>
                      {formatSpeakingTime(r.speakingSeconds)}
                    </span>
                    <span style={{ width: 62, flexShrink: 0, fontFamily: OUTFIT, fontSize: 12.5, color: noteCount ? '#1B3828' : '#C3B9A4', fontVariantNumeric: 'tabular-nums', textAlign: 'end', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <MessageSquareQuote size={12} strokeWidth={2.2} />
                      {noteCount}
                    </span>
                    <span style={{ width: 62, flexShrink: 0, textAlign: 'end' }}>
                      <span
                        style={{
                          fontFamily: OUTFIT, fontWeight: 800, fontSize: 12.5, fontVariantNumeric: 'tabular-nums',
                          backgroundColor: '#1B3828', color: '#EED98A', borderRadius: 999,
                          paddingInline: 9, paddingBlock: 2, display: 'inline-block',
                        }}
                        title={r.quality != null ? `${r.objective} objective points · quality ${r.quality}/100` : `${r.objective} objective points`}
                      >
                        {r.headline}
                      </span>
                    </span>
                    <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', color: '#9A8A78' }}>
                      <ChevronRight
                        size={14}
                        style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 160ms cubic-bezier(0.22,1,0.36,1)' }}
                      />
                    </span>
                  </button>
                  {open && <DelegateDetail row={r} />}
                </div>
              );
            })}
          </div>

          {/* Committees with no live session yet */}
          {(data?.unlinked.length ?? 0) > 0 && (
            <div
              style={{
                marginTop: 20, backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6',
                borderRadius: 14, padding: '14px 18px', boxShadow: CARD_SHADOW,
              }}
            >
              <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', color: '#9A8A78', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Radio size={12} strokeWidth={2.4} />
                NOT YET SCORED
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#6A5A4A' }}>
                {data!.unlinked.map((u) => committeeDisplayName(u.name, u.abbreviation)).join(', ')}
                {' — '}no live session is linked to {data!.unlinked.length === 1 ? 'this committee' : 'these committees'} yet.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
