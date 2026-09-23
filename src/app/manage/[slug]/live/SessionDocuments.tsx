'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Every paper of one committee, in the look of the chair's voting picker
// (`src/components/voting/ResolutionPicker.tsx`), READ ONLY (23 Sep 2026).
//
// Owner: "Redesign the documents page to be similar to the pre-voting page where
// they can see all the documents."
//
// Each working paper and draft resolution is a card: the code chip, a first-page
// preview (`PdfThumb`, or the opening lines of a text paper as a miniature page),
// the title, the sponsors as overlapping round flags, and where the paper stands:
// Submitted, On the floor, Introduced, Voting now, Passed, Failed or Vetoed. A
// voted paper changes colour completely, with the picker's own palettes (forest,
// muted red, aubergine). Opening a card shows the paper itself (`PdfViewer`, the
// chair's pdf.js reader; a text paper on a page; or a line saying there is no file).
//
// The picker's own `Card` is private and speaks the chair's vote vocabulary
// (Start / Resume / View), so the look is reproduced here with the picker's exact
// tokens rather than bent to fit. Nothing is written: no vote, no status.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleDot, FileText, Presentation, Radio, ShieldAlert, X, type LucideIcon } from 'lucide-react';
import PdfViewer, { PdfThumb, type PdfZoom } from '@/components/documents/PdfViewer';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { SeatArtProvider } from '@/components/SeatFlag';
import { getCountryDisplayName } from '@/lib/countries';
import { docName } from '@/lib/docNames';
import { sponsorLabel } from '@/lib/committeeFlags';
import type { Committee, CommitteeDocument } from '@/lib/types';
import type { VoteStateV1 } from '@/lib/voteState';

const INK = '#1C1410';
const INK_SOFT = '#6A5A4A';
const MUTED = '#8C7B69';
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const CARD = '#FAF8F3';

type Stage = 'submitted' | 'on-floor' | 'introduced' | 'voting' | 'passed' | 'failed' | 'vetoed';

interface Palette {
  bg: string; ink: string; soft: string; muted: string;
  codeBg: string; codeFg: string; pillBg: string; pillFg: string;
  arrowBg: string; arrowFg: string; rule: string; ring: string; track: string; fill: string;
}
// Byte-identical to ResolutionPicker's LIGHT / VOTED palettes.
const LIGHT: Palette = {
  bg: CARD, ink: INK, soft: INK_SOFT, muted: MUTED, codeBg: 'rgba(27,56,40,0.08)', codeFg: FOREST,
  pillBg: FOREST, pillFg: GOLD, arrowBg: FOREST, arrowFg: GOLD, rule: 'rgba(27,56,40,0.08)',
  ring: 'rgba(27,56,40,0.07)', track: 'rgba(27,56,40,0.10)', fill: FOREST,
};
const VOTED: Record<'passed' | 'failed' | 'vetoed', Palette> = {
  passed: {
    bg: FOREST, ink: '#F6EFDA', soft: 'rgba(246,239,218,0.80)', muted: 'rgba(238,217,138,0.72)',
    codeBg: 'rgba(238,217,138,0.16)', codeFg: GOLD, pillBg: GOLD, pillFg: FOREST,
    arrowBg: 'rgba(238,217,138,0.16)', arrowFg: GOLD, rule: 'rgba(255,255,255,0.12)',
    ring: 'rgba(27,56,40,0.5)', track: 'rgba(255,255,255,0.16)', fill: GOLD,
  },
  failed: {
    bg: '#8E3A33', ink: '#FFF3EE', soft: 'rgba(255,236,229,0.82)', muted: 'rgba(255,214,200,0.74)',
    codeBg: 'rgba(255,255,255,0.14)', codeFg: '#FFE7DE', pillBg: '#FFE1D6', pillFg: '#7A2A24',
    arrowBg: 'rgba(255,255,255,0.14)', arrowFg: '#FFE7DE', rule: 'rgba(255,255,255,0.14)',
    ring: 'rgba(110,30,26,0.5)', track: 'rgba(255,255,255,0.18)', fill: '#FFE1D6',
  },
  vetoed: {
    bg: '#3E2447', ink: '#F7EEFA', soft: 'rgba(240,226,246,0.82)', muted: 'rgba(222,200,232,0.72)',
    codeBg: 'rgba(255,255,255,0.13)', codeFg: '#EBDAF2', pillBg: '#E9D6F0', pillFg: '#3E2447',
    arrowBg: 'rgba(255,255,255,0.13)', arrowFg: '#EBDAF2', rule: 'rgba(255,255,255,0.13)',
    ring: 'rgba(40,20,48,0.5)', track: 'rgba(255,255,255,0.16)', fill: '#E9D6F0',
  },
};

const STAGE_LOOK: Record<Stage, { label: string; icon: LucideIcon | null; bg: string; fg: string }> = {
  submitted: { label: 'Submitted', icon: FileText, bg: 'rgba(28,20,16,0.07)', fg: INK_SOFT },
  'on-floor': { label: 'On the floor', icon: CircleDot, bg: 'rgba(27,56,40,0.10)', fg: FOREST },
  introduced: { label: 'Introduced', icon: Presentation, bg: 'rgba(238,217,138,0.55)', fg: '#5E4509' },
  voting: { label: 'Voting now', icon: null, bg: FOREST, fg: GOLD },
  passed: { label: 'Passed', icon: Check, bg: VOTED.passed.pillBg, fg: VOTED.passed.pillFg },
  failed: { label: 'Failed', icon: X, bg: VOTED.failed.pillBg, fg: VOTED.failed.pillFg },
  vetoed: { label: 'Vetoed', icon: ShieldAlert, bg: VOTED.vetoed.pillBg, fg: VOTED.vetoed.pillFg },
};

function stageOf(doc: CommitteeDocument, vote: VoteStateV1 | undefined): Stage {
  if (doc.status === 'failed' || (vote?.status === 'result' && vote.result === 'failed')) return vote?.vetoed ? 'vetoed' : 'failed';
  if (doc.status === 'passed' || (vote?.status === 'result' && vote.result === 'passed')) return 'passed';
  if (vote && vote.status !== 'result') return 'voting';
  return doc.status;
}
const paletteOf = (s: Stage): Palette => (s === 'passed' || s === 'failed' || s === 'vetoed' ? VOTED[s] : LIGHT);

function StagePill({ stage }: { stage: Stage }) {
  const look = STAGE_LOOK[stage];
  const Icon = look.icon;
  return (
    <span className="inline-flex items-center gap-1.5 h-[26px] ps-2.5 pe-3 rounded-full text-[12.5px] font-semibold whitespace-nowrap" style={{ backgroundColor: look.bg, color: look.fg }}>
      {stage === 'voting' ? (
        <span className="relative flex w-[7px] h-[7px]" aria-hidden>
          <span className="gv-pick-ping absolute inset-0 rounded-full" style={{ backgroundColor: GOLD }} />
          <span className="relative w-[7px] h-[7px] rounded-full" style={{ backgroundColor: GOLD }} />
        </span>
      ) : Icon ? <Icon size={13} strokeWidth={2.6} aria-hidden /> : null}
      {look.label}
    </span>
  );
}

const THUMB_W = 92;
const THUMB_H = 120;
function PaperPreview({ doc }: { doc: CommitteeDocument }) {
  const glyph = (
    <span className="w-full h-full rounded-[3px] flex items-center justify-center" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 4px 10px rgba(27,56,40,0.12)' }}>
      <FileText size={28} strokeWidth={1.8} style={{ color: FOREST, opacity: 0.45 }} />
    </span>
  );
  return (
    <div aria-hidden className="gv-pick-paper shrink-0 flex items-center justify-center" style={{ width: THUMB_W, height: THUMB_H }}>
      {doc.fileUrl ? (
        <PdfThumb url={doc.fileUrl} width={THUMB_W} height={THUMB_H} fallback={glyph} />
      ) : doc.content?.trim() ? (
        <span
          className="block w-full h-full overflow-hidden rounded-[3px] px-2 py-2.5"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 1px 2px rgba(27,56,40,0.10), 0 4px 10px rgba(27,56,40,0.12)' }}
        >
          <span className="block text-[6.5px] font-bold leading-[1.25] mb-1 line-clamp-2" style={{ color: INK }}>{doc.title || doc.docCode}</span>
          <span className="block whitespace-pre-wrap text-[5px] leading-[1.45]" style={{ color: '#4A3F33' }}>{doc.content.slice(0, 900)}</span>
        </span>
      ) : glyph}
    </div>
  );
}

function Sponsors({ sponsors, word, pal }: { sponsors: string[]; word: string; pal: Palette }) {
  if (sponsors.length === 0) {
    return <p className="text-[13.5px] font-medium" style={{ color: pal.muted }}>No {word.toLowerCase()} listed</p>;
  }
  const shown = sponsors.slice(0, 6);
  const extra = sponsors.length - shown.length;
  const names = sponsors.map((s) => getCountryDisplayName(s, 'en')).join(', ');
  return (
    <div className="min-w-0">
      <div className="flex items-center ps-1.5 mb-2" aria-hidden>
        {shown.map((s, i) => (
          <span key={`${s}-${i}`} className="gv-pick-flag rounded-full -ms-1.5" style={{ zIndex: shown.length - i, boxShadow: `0 0 0 2.5px ${pal.bg}` }}>
            <SeatCircleFlag country={s} size={26} decorative />
          </span>
        ))}
        {extra > 0 && (
          <span className="-ms-1.5 h-[26px] min-w-[26px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums"
            style={{ backgroundColor: '#EDE7D8', color: INK_SOFT, boxShadow: `0 0 0 2.5px ${pal.bg}` }}>
            +{extra}
          </span>
        )}
      </div>
      <p className="text-[13.5px] leading-snug line-clamp-2" style={{ color: pal.soft }} title={names}>
        <span style={{ color: pal.muted }}>{word}: </span>{names}
      </p>
    </div>
  );
}

function tallyOf(vote: VoteStateV1 | undefined) {
  if (!vote) return null;
  const f = vote.votes.filter((v) => v.choice === 'for' || v.choice === 'for-rights').length;
  const a = vote.votes.filter((v) => v.choice === 'against' || v.choice === 'against-rights').length;
  const ab = vote.votes.filter((v) => v.choice === 'abstain').length;
  return { f, a, ab };
}

function DocCard({ doc, stage, vote, typeName, sponsorWord, index, onOpen }: {
  doc: CommitteeDocument; stage: Stage; vote: VoteStateV1 | undefined; typeName: string;
  sponsorWord: string; index: number; onOpen: () => void;
}) {
  const pal = paletteOf(stage);
  const voted = stage === 'passed' || stage === 'failed' || stage === 'vetoed';
  const tally = voted ? tallyOf(vote) : null;
  const live = stage === 'voting' && vote;
  // A device ballot keeps its choices off vote_state until the reveal, so only a roll-call count is shown.
  const liveCast = live && vote.method !== 'device' ? vote.votes.length : null;
  const pct = (v: number, total: number) => (total > 0 ? Math.min(1, v / total) : 0);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="gv-pick-card gv-pick-in group relative text-start rounded-[20px] p-5 flex flex-col gap-4 min-h-[232px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE7D8]"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, backgroundColor: pal.bg, ['--gv-ring' as string]: live ? 'rgba(182,135,31,0.55)' : pal.ring }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold tabular-nums px-2 py-1 rounded-md truncate" style={{ backgroundColor: pal.codeBg, color: pal.codeFg }} title={typeName}>
          {doc.docCode || typeName}
        </span>
        <StagePill stage={stage} />
      </div>
      <div className="flex items-start gap-4 min-w-0">
        <PaperPreview doc={doc} />
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <h3 className="text-[18px] leading-[1.28] font-bold line-clamp-3 [text-wrap:balance]" style={{ color: pal.ink, letterSpacing: '-0.006em' }}>
            {doc.title || doc.docCode}
          </h3>
          <Sponsors sponsors={doc.sponsors} word={sponsorWord} pal={pal} />
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-3">
        {liveCast !== null && vote && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium tabular-nums" style={{ color: INK_SOFT }}>{liveCast} of {vote.order.length} voted</span>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: pal.track }} aria-hidden>
              <div className="h-full rounded-full" style={{ backgroundColor: pal.fill, transform: `scaleX(${pct(liveCast, vote.order.length)})`, transformOrigin: 'left' }} />
            </div>
          </div>
        )}
        {tally && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium tabular-nums" style={{ color: pal.soft }}>
              {tally.f} for, {tally.a} against{tally.ab ? `, ${tally.ab} abstained` : ''}
            </span>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: pal.track }} aria-hidden>
              <div className="h-full rounded-full" style={{ backgroundColor: pal.fill, transform: `scaleX(${pct(tally.f, tally.f + tally.a)})`, transformOrigin: 'left' }} />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 pt-3.5" style={{ boxShadow: `inset 0 1px 0 ${pal.rule}` }}>
          <span className="text-[14px] font-semibold" style={{ color: voted ? pal.ink : FOREST }}>
            {doc.fileUrl || doc.content?.trim() ? 'Read the paper' : 'See details'}
          </span>
          <span className="gv-pick-arrow w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: voted ? pal.arrowBg : FOREST, color: voted ? pal.arrowFg : GOLD }} aria-hidden>
            <ArrowRight size={17} strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </button>
  );
}

function PaperReader({ doc, stage, typeName, sponsorWord, onBack }: {
  doc: CommitteeDocument; stage: Stage; typeName: string; sponsorWord: string; onBack: () => void;
}) {
  const [zoom, setZoom] = useState<PdfZoom>('fit');
  const submitted = doc.submittedAt ? new Date(doc.submittedAt) : null;
  return (
    <div className="gv-pick-in flex flex-col gap-4">
      <div className="flex items-start gap-3 flex-wrap">
        <button type="button" onClick={onBack} aria-label="Back to all documents" title="Back to all documents"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.96] transition-transform"
          style={{ backgroundColor: CARD, color: FOREST, boxShadow: '0 0 0 1px rgba(27,56,40,0.12), 0 2px 6px rgba(27,56,40,0.07)' }}>
          <ArrowLeft size={18} strokeWidth={2.25} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[13px] font-semibold tabular-nums px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST }}>{doc.docCode || typeName}</span>
            <StagePill stage={stage} />
          </div>
          <h3 className="text-[20px] font-bold leading-snug [text-wrap:balance]" style={{ color: INK }}>{doc.title || doc.docCode}</h3>
          <p className="text-[13px] mt-1" style={{ color: INK_SOFT }}>
            {typeName}
            {submitted && !Number.isNaN(submitted.getTime()) && ` · submitted ${submitted.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
            {doc.sponsors.length > 0 && ` · ${sponsorWord}: ${doc.sponsors.map((s) => getCountryDisplayName(s, 'en')).join(', ')}`}
          </p>
        </div>
      </div>
      {doc.fileUrl ? (
        <PdfViewer url={doc.fileUrl} title={doc.title || doc.docCode} fileName={doc.fileName} zoom={zoom} onZoomChange={setZoom}
          compact className="relative w-full h-[68vh] min-h-[420px] rounded-2xl overflow-hidden" />
      ) : doc.content?.trim() ? (
        <div className="rounded-2xl p-6 sm:p-8 max-h-[68vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 8px 22px rgba(27,56,40,0.08)' }}>
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed" style={{ color: INK }}>{doc.content}</p>
        </div>
      ) : (
        <p className="text-[14px] rounded-2xl p-6 text-center" style={{ backgroundColor: CARD, color: INK_SOFT, boxShadow: '0 0 0 1px rgba(27,56,40,0.07)' }}>
          No file or text was attached to this paper. The chairs worked from a copy outside Gavelling.
        </p>
      )}
    </div>
  );
}

export type DocTypeFilter = 'all' | 'working-paper' | 'draft-resolution';

export function SessionDocuments({ committee, voteStates, initialFilter = 'all' }: {
  committee: Committee;
  voteStates: Record<string, VoteStateV1>;
  initialFilter?: DocTypeFilter;
}) {
  const [filter, setFilter] = useState<DocTypeFilter>(initialFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  const wpPlural = docName(committee, 'working-paper', 'plural', 'Working Papers');
  const drPlural = docName(committee, 'draft-resolution', 'plural', 'Draft Resolutions');
  const nameOf = (d: CommitteeDocument) => docName(committee, d.type, 'singular', d.type === 'working-paper' ? 'Working Paper' : 'Draft Resolution');
  const sponsorWord = sponsorLabel(committee, 'Sponsors');

  const all = useMemo(() => [...(committee.documents ?? [])].sort((a, b) =>
    (a.type === b.type ? 0 : a.type === 'working-paper' ? -1 : 1)
    || (a.docCode || '').localeCompare(b.docCode || '', 'en', { numeric: true })), [committee.documents]);
  const docs = filter === 'all' ? all : all.filter((d) => d.type === filter);
  const stages = new Map(all.map((d) => [d.id, stageOf(d, voteStates[d.id])]));
  const counts = (['voting', 'passed', 'failed', 'vetoed'] as const).map((s) => ({ s, n: all.filter((d) => stages.get(d.id) === s).length })).filter((c) => c.n > 0);
  const opened = openId ? all.find((d) => d.id === openId) ?? null : null;

  return (
    <SeatArtProvider delegates={committee.delegates}>
      <div className="gv-pick">
        <style>{`
          @keyframes gvPickIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
          @keyframes gvPickPing { 0% { transform: scale(1); opacity: .7 } 80%, 100% { transform: scale(2.4); opacity: 0 } }
          .gv-pick .gv-pick-in { animation: gvPickIn 380ms cubic-bezier(0.2,0,0,1) backwards }
          .gv-pick .gv-pick-ping { animation: gvPickPing 1.6s cubic-bezier(0,0,0.2,1) infinite }
          .gv-pick .gv-pick-card { box-shadow: 0 0 0 1px var(--gv-ring), 0 1px 2px rgba(27,56,40,0.05), 0 8px 22px rgba(27,56,40,0.07); transition: transform 200ms cubic-bezier(0.2,0,0,1), box-shadow 200ms cubic-bezier(0.2,0,0,1); }
          .gv-pick .gv-pick-card:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px var(--gv-ring), 0 2px 4px rgba(27,56,40,0.07), 0 18px 36px rgba(27,56,40,0.12); }
          .gv-pick .gv-pick-card:active { transform: translateY(-1px) scale(0.99); transition-duration: 90ms }
          .gv-pick .gv-pick-arrow, .gv-pick .gv-pick-paper, .gv-pick .gv-pick-flag { transition: transform 200ms cubic-bezier(0.2,0,0,1) }
          .gv-pick .gv-pick-card:hover .gv-pick-arrow { transform: translateX(3px) }
          .gv-pick .gv-pick-card:hover .gv-pick-paper { transform: translateY(-2px) rotate(-1.5deg) }
          .gv-pick .gv-pick-card:hover .gv-pick-flag { transform: translateY(-2px) }
          @media (prefers-reduced-motion: reduce) {
            .gv-pick .gv-pick-in, .gv-pick .gv-pick-ping { animation: none }
            .gv-pick .gv-pick-card, .gv-pick .gv-pick-arrow, .gv-pick .gv-pick-flag, .gv-pick .gv-pick-paper { transition: none }
            .gv-pick .gv-pick-card:hover, .gv-pick .gv-pick-card:active, .gv-pick .gv-pick-card:hover .gv-pick-arrow, .gv-pick .gv-pick-card:hover .gv-pick-flag, .gv-pick .gv-pick-card:hover .gv-pick-paper { transform: none }
          }
        `}</style>

        {opened ? (
          <PaperReader doc={opened} stage={stages.get(opened.id) ?? opened.status} typeName={nameOf(opened)} sponsorWord={sponsorWord} onBack={() => setOpenId(null)} />
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-5">
              <div role="radiogroup" aria-label="Show" className="inline-flex p-1 rounded-full" style={{ backgroundColor: 'rgba(27,56,40,0.06)' }}>
                {([['all', `All (${all.length})`], ['working-paper', `${wpPlural} (${all.filter((d) => d.type === 'working-paper').length})`], ['draft-resolution', `${drPlural} (${all.filter((d) => d.type === 'draft-resolution').length})`]] as const).map(([key, label]) => (
                  <button key={key} type="button" role="radio" aria-checked={filter === key} onClick={() => setFilter(key)}
                    className="h-9 px-3.5 rounded-full text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-colors"
                    style={{ backgroundColor: filter === key ? FOREST : 'transparent', color: filter === key ? GOLD : INK_SOFT }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 ms-auto flex-wrap">
                {counts.map(({ s, n }) => (
                  <span key={s} className="inline-flex items-baseline gap-1.5 text-[13.5px]" style={{ color: s === 'voting' || s === 'passed' ? FOREST : s === 'vetoed' ? '#3E2447' : '#8E3A33' }}>
                    <span className="font-bold tabular-nums text-[17px]">{n}</span>{STAGE_LOOK[s].label.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
            {docs.length === 0 ? (
              <div className="rounded-[20px] p-7 text-center" style={{ backgroundColor: CARD, boxShadow: '0 0 0 1px rgba(27,56,40,0.07)' }}>
                <Radio size={22} strokeWidth={2} style={{ color: FOREST, opacity: 0.5, margin: '0 auto 10px' }} aria-hidden />
                <p className="text-[15px] font-semibold" style={{ color: INK }}>No papers yet</p>
                <p className="text-[13.5px] mt-1" style={{ color: INK_SOFT }}>Papers appear here the moment a delegation or a chair submits one in the session.</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {docs.map((d, i) => (
                  <DocCard key={d.id} doc={d} stage={stages.get(d.id) ?? d.status} vote={voteStates[d.id]} typeName={nameOf(d)} sponsorWord={sponsorWord} index={i + 1} onOpen={() => setOpenId(d.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SeatArtProvider>
  );
}
