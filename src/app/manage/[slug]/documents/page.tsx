'use client';

// Conference Documents (prompt 129, 16 Oct 2026; Financials look since prompt
// 131): ONE page, no tabs. From a wide screen up it is two equal columns that
// fit the viewport with no page scroll, every card a Financials DashCard (3D
// emoji hanging over its top-left corner, an "i" beside the title):
//   LEFT   Position Papers and Study Guides: six committee tiles in view (three
//          by two from 1280px, two a row below), no inner scroll, Page 1 of N
//          with arrows; each tile opens its pop-up (CommitteeDocsPopup).
//   RIGHT  Things to Do (DocumentsTodo) and Additional Documents, stacked,
//          sharing the column's height.
// Below the breakpoint the columns stack and the page scrolls.
//
// Deep links: ?committee=<id> (with &pane=settings) opens that committee's
// pop-up; ?tab=everyone&doc=<id> opens that document's returned copies. Both
// leave the URL once read (replaceUrlInPlace).

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileText, ScrollText } from 'lucide-react';
import Link from 'next/link';
import DocumentsTodo from './DocumentsTodo';
import AdditionalDocuments from './AdditionalDocuments';
import { fetchDocsOverview } from '@/lib/conferenceDocuments';
import CommitteeDocsPopup, { CommitteeLogo, formatDate, shortName, type CommitteeDoc, type DocsPane } from './CommitteeDocsPopup';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useNow } from '@/lib/useNow';
import { NEU } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, DashCard, TINT_GOLD } from '../financials/dashboardKit';

const OUTFIT = "var(--font-brand), sans-serif";
const PER_PAGE = 6;
const GREEN = '#2F6644';

interface GuideMark { conference_committee_id: string; is_published: boolean }

/** The three lines on a committee card. */
function studyGuideLine(c: CommitteeDoc, guides: GuideMark[], now: number): { text: string; on: boolean } {
  const mine = guides.filter(g => g.conference_committee_id === c.id);
  const at = c.study_guides_publish_at ? new Date(c.study_guides_publish_at).getTime() : null;
  if (mine.some(g => g.is_published) || (mine.length > 0 && at !== null && at <= now)) return { text: 'Study guide published', on: true };
  if (mine.length > 0 && at !== null && at > now) return { text: `Study guide releases ${formatDate(c.study_guides_publish_at!)}`, on: false };
  return { text: 'Study guide not published', on: false };
}

function CommitteeCard({ c, guides, now, onOpen }: {
  c: CommitteeDoc;
  guides: GuideMark[];
  now: number;
  onOpen: (pane: DocsPane) => void;
}) {
  const sg = studyGuideLine(c, guides, now);
  const label = shortName(c);
  return (
    <article className="gv-docs-ccard">
      <div className="flex items-start gap-2.5 min-w-0">
        <CommitteeLogo c={c} size={40} />
        <div className="min-w-0">
          <h3 className="gv-docs-cname">{label}</h3>
          {c.abbreviation && c.abbreviation !== c.name && <p className="gv-docs-cfull">{c.name}</p>}
        </div>
      </div>
      <ul className="gv-docs-lines">
        <li style={{ color: sg.on ? GREEN : NEU.inkSoft }}>{sg.text}</li>
        <li style={{ color: c.pp_submissions_enabled ? GREEN : NEU.inkSoft }}>
          {c.pp_submissions_enabled ? 'Position papers enabled' : 'Position papers disabled'}
        </li>
        {c.position_paper_deadline && <li style={{ color: NEU.ink }}>Due {formatDate(c.position_paper_deadline)}</li>}
      </ul>
      <div className="gv-docs-cactions">
        <button type="button" className="gv-docs-btn gv-docs-btn-primary" onClick={() => onOpen('submissions')}>View submissions</button>
        <button type="button" className="gv-docs-btn gv-docs-btn-outline" onClick={() => onOpen('settings')}>Edit</button>
      </div>
    </article>
  );
}

export default function DocumentsPage() {
  const now = useNow();
  const { conference } = useManage();
  const { session } = useAuth();
  /** The stable half of `session`: loaders key on the token string, never the
   *  session object (CLAUDE.md §6, "No page reloads by itself"). */
  const accessToken = session?.access_token;

  const [committees, setCommittees] = useState<CommitteeDoc[]>([]);
  const [guides, setGuides] = useState<GuideMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<{ id: string; pane: DocsPane } | null>(null);
  const [deepDocId, setDeepDocId] = useState<string | null>(null);
  const [deepCommittee, setDeepCommittee] = useState<{ id: string; pane: DocsPane } | null>(null);
  // docs_extra on for the conference (returned copies, View submissions, step 4).
  const [extraOn, setExtraOn] = useState(false);
  // Bumped after anything that may change Things to Do.
  const [todoVersion, setTodoVersion] = useState(0);
  const conferenceIdForMode = conference?.id ?? null;
  useEffect(() => {
    if (!conferenceIdForMode || !accessToken) return;
    let alive = true;
    void fetchDocsOverview(conferenceIdForMode).then(res => { if (alive) setExtraOn(res.ok && res.enabled); });
    return () => { alive = false; };
    // Keyed on whether a token exists, never on its value (a refresh must not refetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferenceIdForMode, !!accessToken]);

  // Deep links, read once.
  useEffect(() => {
    const url = new URL(window.location.href);
    const committee = url.searchParams.get('committee');
    const pane: DocsPane = url.searchParams.get('pane') === 'settings' ? 'settings' : 'submissions';
    const doc = url.searchParams.get('tab') === 'everyone' ? url.searchParams.get('doc') : null;
    if (!committee && !doc && !url.searchParams.has('tab')) return;
    void Promise.resolve().then(() => {
      if (committee) setDeepCommittee({ id: committee, pane });
      if (doc) setDeepDocId(doc);
    });
    ['committee', 'pane', 'tab', 'doc'].forEach(k => url.searchParams.delete(k));
    replaceUrlInPlace(url.pathname + url.search + url.hash);
  }, []);

  const loadCommittees = useCallback(async () => {
    if (!conference || !accessToken) return;
    const supabase = getAuthedClient(accessToken);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation, logo_url, committee_type, position_paper_deadline, pp_submissions_enabled, study_guides_publish_at, notification_email')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    const rows = (data ?? []) as CommitteeDoc[];
    setCommittees(rows);
    if (rows.length > 0) {
      const { data: g } = await supabase
        .from('study_guides')
        .select('conference_committee_id, is_published')
        .in('conference_committee_id', rows.map(r => r.id));
      setGuides((g ?? []) as GuideMark[]);
    } else {
      setGuides([]);
    }
    setLoading(false);
  }, [conference, accessToken]);

  useEffect(() => { void Promise.resolve().then(() => loadCommittees()); }, [loadCommittees]);

  // A committee opened from a deep link: its pop-up, and the page that holds it.
  if (deepCommittee && committees.length > 0) {
    const ix = committees.findIndex(c => c.id === deepCommittee.id);
    setDeepCommittee(null);
    if (ix >= 0) {
      setPage(Math.floor(ix / PER_PAGE));
      setOpen(deepCommittee);
    }
  }

  if (!conference) return null;

  const pages = Math.max(1, Math.ceil(committees.length / PER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const shown = committees.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);
  const openCommittee = open ? committees.find(c => c.id === open.id) ?? null : null;
  const guideIds = new Set(guides.map(g => g.conference_committee_id));

  return (
    <div className="gv-docs-page px-6 md:px-10 py-8">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{PAGE_CSS}</style>
      <header className="gv-docs-head">
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: NEU.inkSoft, letterSpacing: '0.06em', marginBottom: 6 }}>
          {conference.acronym} / Documents
        </p>
        <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 'clamp(32px, 3.4vw, 42px)', letterSpacing: '-0.025em', lineHeight: 1.05, color: '#1C1410', margin: 0 }}>
          Conference <GoldWord>Documents</GoldWord>
        </h1>
      </header>

      <div className="gv-docs-grid">
        {/* LEFT: Position Papers and Study Guides */}
        <DashCard
          title="Position Papers and Study Guides"
          hint="Each committee's study guide and position papers. Open a committee to see its papers or change its release date, submissions and deadline"
          icon={{ emoji: 'Scroll', lucide: ScrollText, tint: TINT_GOLD }}
          hang="start"
          className="gv-docs-dash gv-docs-left"
        >
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
            </div>
          ) : committees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 12px' }}>
              <span className="inline-flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(150deg, rgba(27,56,40,0.1), rgba(27,56,40,0.04))', border: '1px solid rgba(27,56,40,0.18)', marginBottom: 16 }}>
                <FileText size={26} strokeWidth={1.8} style={{ color: '#1B3828' }} />
              </span>
              <p style={{ fontFamily: OUTFIT, fontSize: 22, fontWeight: 800, color: '#1C1410', marginBottom: 6 }}>No committees yet</p>
              <p style={{ fontFamily: OUTFIT, fontSize: 15, color: NEU.inkSoft, marginBottom: 20 }}>Add committees before managing documents.</p>
              <Link
                href={`/manage/${conference.slug}/committees`}
                style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 15, color: '#EED98A', background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%)', borderRadius: 12, padding: '0 22px', minHeight: 48, lineHeight: '48px', textDecoration: 'none', display: 'inline-block' }}
              >
                Add committees
              </Link>
            </div>
          ) : (
            <>
              <div className="gv-docs-committees">
                {shown.map(c => (
                  <CommitteeCard key={c.id} c={c} guides={guides} now={now} onOpen={pane => setOpen({ id: c.id, pane })} />
                ))}
              </div>
              {pages > 1 && (
                <div className="gv-docs-pager">
                  <span>Page {safePage + 1} of {pages}</span>
                  <button type="button" className="gv-docs-arrow" aria-label="Previous committees" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                    <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
                  </button>
                  <button type="button" className="gv-docs-arrow" aria-label="More committees" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
                    <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
                  </button>
                </div>
              )}
            </>
          )}
        </DashCard>

        {/* RIGHT: Things to Do, then Additional Documents (prompt 130). */}
        <div className="gv-docs-col gv-docs-right">
          <DocumentsTodo
            conferenceId={conference.id}
            extraOn={extraOn}
            version={todoVersion}
            onReviewed={() => { void loadCommittees(); }}
          />
          <AdditionalDocuments
            conferenceId={conference.id}
            extra={extraOn}
            initialDocId={deepDocId}
            onInitialDocUsed={() => setDeepDocId(null)}
            onChanged={() => setTodoVersion(v => v + 1)}
          />
        </div>
      </div>

      {open && openCommittee && (
        <CommitteeDocsPopup
          key={openCommittee.id}
          conferenceId={conference.id}
          conferenceSlug={conference.slug}
          committee={openCommittee}
          committees={committees}
          guideCommitteeIds={guideIds}
          initialPane={open.pane}
          onCommitteeChange={next => setCommittees(prev => prev.map(c => (c.id === next.id ? next : c)))}
          onClose={() => { setOpen(null); void loadCommittees(); setTodoVersion(v => v + 1); }}
        />
      )}
    </div>
  );
}

// From 1100px wide the page is the viewport: the header, then two equal
// columns filling what is left (no page scroll at 1280x800 and up). The six
// committee tiles share the left card's height in rows (three by two from
// 1280px); the right column's two cards share its height. Below that the
// columns stack and the page scrolls.
const PAGE_CSS = `
.gv-docs-page{display:flex;flex-direction:column;gap:22px;width:100%;box-sizing:border-box}
.gv-docs-grid{display:grid;grid-template-columns:1fr;gap:20px;min-height:0}
.gv-docs-dash{min-width:0;min-height:0}
.gv-docs-dash .gv-st-card-head{margin-bottom:12px}
.gv-docs-dash .gv-st-card-title{font-size:clamp(20px,1.6vw,24px);letter-spacing:-0.015em;line-height:1.15}
.gv-docs-committees{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}
.gv-docs-ccard{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:16px;background:#FAF8F3;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.07);min-width:0;min-height:0}
.gv-docs-cname{margin:0;font-family:${OUTFIT};font-size:17px;font-weight:800;letter-spacing:-0.01em;line-height:1.15;color:#1C1410;overflow-wrap:anywhere}
.gv-docs-cfull{margin:2px 0 0;font-family:${OUTFIT};font-size:12px;line-height:1.3;color:${NEU.inkSoft};overflow-wrap:anywhere}
.gv-docs-lines{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;font-family:${OUTFIT};font-size:12.5px;font-weight:600;line-height:1.3}
.gv-docs-cactions{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}
.gv-docs-btn{flex:1 1 auto;min-height:34px;padding:0 10px;border-radius:10px;font-family:${OUTFIT};font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.gv-docs-btn:focus{outline:none}
.gv-docs-btn:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
.gv-docs-btn-primary{border:none;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF}
.gv-docs-btn-outline{border:none;background:#FFFFFF;color:#1C1410;box-shadow:inset 0 0 0 1.5px rgba(28,20,16,0.55)}
.gv-docs-right{display:flex;flex-direction:column;gap:20px;min-width:0;min-height:0}
.gv-docs-pager{display:flex;align-items:center;justify-content:flex-end;gap:6px;padding-top:12px;font-family:${OUTFIT};font-size:13.5px;font-weight:600;color:${NEU.inkSoft};font-variant-numeric:tabular-nums}
.gv-docs-pager span{margin-right:4px}
.gv-docs-arrow{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:none;border-radius:999px;background:#FAF8F3;color:#1B3828;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.12)}
.gv-docs-arrow:disabled{opacity:0.35;cursor:default}
.gv-docs-arrow:focus{outline:none}
.gv-docs-arrow:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
@media (min-width:1100px){
  .gv-docs-page{height:calc(100dvh - 56px);overflow:hidden}
  .gv-docs-grid{flex:1 1 auto;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr);padding-top:4px}
  .gv-docs-committees{flex:1 1 auto;min-height:0;grid-template-rows:repeat(3,minmax(0,1fr));align-content:stretch}
  .gv-docs-right{height:100%}
  .gv-docs-right>.gv-docs-dash{flex:1 1 0;box-sizing:border-box}
}
@media (min-width:1280px){
  .gv-docs-committees{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
  .gv-docs-cactions{flex-direction:column}
  .gv-docs-btn{flex:0 0 auto;width:100%}
}
`;
