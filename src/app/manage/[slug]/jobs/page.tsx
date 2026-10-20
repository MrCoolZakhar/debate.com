'use client';

// /manage/[slug]/jobs, the organizer Job Board (docs/conferences/job-board.md).
// Rewritten for prompt 2: the legacy postings code is gone. The manage layout
// gates the page by the job_board permission (SECTION_PERMS jobs); owners
// always pass, and the server answers with a sentence when promoting or a paid
// listing also needs the Store permission.
//
// Two columns that fill the width: the listings (drafts first) as the main
// column; the digest (job_digest) and the emails card (job_settings_set) at
// the side. Pop-ups: PostingPopup (post and edit, with "Publish and promote")
// and PromotePopup. Short on credits closes the pop-up first, then
// useJobTopUp opens the credits pop-up and retries the same call once.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Briefcase, Layers, Mail, Plus } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { GoldWord } from '@/components/BrandHeading';
import { NEU, OUTFIT } from '@/components/neu';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, DashCard, TINT_GOLD, TINT_GREEN } from '../financials/dashboardKit';
import ListingRow, { ROW_CSS } from './ListingRow';
import PostingPopup, { type ShortRequest } from './PostingPopup';
import PromotePopup from './PromotePopup';
import CommitteePackPopup from './CommitteePackPopup';
import { useJobTopUp } from './useJobTopUp';
import {
  dayLabel, readDigest, readPanel, setJobSettings,
  type DigestLine, type JobPanel, type MyMode, type OrgListing,
} from './jobsApi';

const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

type Popup = { kind: 'post'; listing: OrgListing | null } | { kind: 'promote'; listing: OrgListing } | { kind: 'pack' } | null;

const ORDER: Record<string, number> = { draft: 0, live: 1, hidden: 2, closed: 3 };

export default function JobBoardPage() {
  const { conference } = useManage();
  const { user } = useAuth();
  const confId = conference?.id ?? null;
  const [panel, setPanel] = useState<JobPanel | null>(null);
  const [panelErr, setPanelErr] = useState<string | null>(null);
  const [digest, setDigest] = useState<{ lines: DigestLine[]; views_week: number; clicks_week: number } | null>(null);
  const [digestErr, setDigestErr] = useState<string | null>(null);
  const [popup, setPopup] = useState<Popup>(null);
  const topUp = useJobTopUp();
  const seq = useRef(0);

  const apply = useCallback((p: Awaited<ReturnType<typeof readPanel>>, d: Awaited<ReturnType<typeof readDigest>>) => {
    if (p.ok) { setPanel(p); setPanelErr(null); } else setPanelErr(p.message);
    if (d.ok) { setDigest({ lines: d.lines, views_week: d.views_week, clicks_week: d.clicks_week }); setDigestErr(null); } else setDigestErr(d.message);
  }, []);

  const reload = useCallback(async () => {
    if (!confId) return;
    const mine = ++seq.current;
    const [p, d] = await Promise.all([readPanel(confId), readDigest(confId)]);
    if (mine === seq.current) apply(p, d);
  }, [confId, apply]);

  useEffect(() => {
    if (!confId) return;
    const mine = ++seq.current;
    void Promise.all([readPanel(confId), readDigest(confId)]).then(([p, d]) => {
      if (mine === seq.current) apply(p, d);
    });
  }, [confId, apply]);

  // ?promote=<listing id> (the "Promote for 3 credits" button in the poster's
  // nudge emails): once the panel has loaded, the Promote pop-up for that
  // listing when it is live and promotable, else a quiet line; the param then
  // leaves the URL.
  const [promoteGone, setPromoteGone] = useState(false);
  const promoteDone = useRef(false);
  useEffect(() => {
    if (!panel || promoteDone.current) return;
    const url = new URL(window.location.href);
    const pid = url.searchParams.get('promote');
    if (!pid) { promoteDone.current = true; return; }
    const t = window.setTimeout(() => {
      if (promoteDone.current) return;
      promoteDone.current = true;
      url.searchParams.delete('promote');
      replaceUrlInPlace(url.pathname + url.search + url.hash);
      const target = panel.listings.find((l) => l.id === pid);
      if (target && target.shown === 'live') {
        if (panel.can_promote) setPopup({ kind: 'promote', listing: target });
      } else {
        setPromoteGone(true);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [panel]);

  const listings = useMemo(
    () => [...(panel?.listings ?? [])].sort((a, b) => (ORDER[a.shown] ?? 9) - (ORDER[b.shown] ?? 9)),
    [panel],
  );

  const handOffShort = useCallback((req: ShortRequest) => {
    setPopup(null);
    topUp({ need: req.need, retry: req.retry, okMessage: req.okMessage, onSettled: () => { void reload(); } });
  }, [topUp, reload]);

  const promoted = useCallback((endsOn: string | null) => {
    setPopup(null);
    notifyOk(endsOn ? `Promoted until ${dayLabel(endsOn)}` : 'Your listing is promoted', 'jobs');
    void reload();
  }, [reload]);

  if (!conference) return null;
  const slug = conference.slug;

  return (
    <div className="gv-jb px-6 md:px-10 py-8">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{ROW_CSS}</style>
      <style>{PAGE_CSS}</style>

      <header className="gv-jb-head">
        <div>
          <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: NEU.inkSoft, letterSpacing: '0.06em', margin: '0 0 6px' }}>
            {conference.acronym} / Job Board
          </p>
          <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 'clamp(32px, 3.4vw, 42px)', letterSpacing: '-0.025em', lineHeight: 1.05, color: INK, margin: 0 }}>
            Job <GoldWord>Board</GoldWord>
          </h1>
        </div>
        {panel && (
          <div className="flex flex-wrap items-center gap-2.5">
            {panel.committees.length > 0 && panel.roles.some((r) => r.role === 'chair' && r.enabled) && (
              <button type="button" className="gv-st-btn gv-st-outline gv-jb-post" onClick={() => setPopup({ kind: 'pack' })}>
                <Layers size={17} strokeWidth={2.4} aria-hidden /> Post chair roles for every committee
              </button>
            )}
            <button type="button" className="gv-st-btn gv-st-forest gv-jb-post" onClick={() => setPopup({ kind: 'post', listing: null })}>
              <Plus size={17} strokeWidth={2.6} aria-hidden /> Post a listing
            </button>
          </div>
        )}
      </header>

      {promoteGone && (
        <p style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: '-18px 0 22px' }}>This listing is no longer live.</p>
      )}

      {!panel && panelErr ? (
        <p className="gv-st-err" role="alert">{panelErr} <button type="button" className="gv-st-link" onClick={() => { void reload(); }}>Try again</button></p>
      ) : !panel ? (
        <div className="gv-jb-grid" aria-busy="true">
          <div className="gv-jb-skel" style={{ minHeight: 420 }} />
          <div className="gv-jb-side"><div className="gv-jb-skel" style={{ minHeight: 220 }} /><div className="gv-jb-skel" style={{ minHeight: 160 }} /></div>
        </div>
      ) : (
        <div className="gv-jb-grid">
          {/* ── Listings ── */}
          <DashCard
            title="Your Listings"
            hint="Chair, secretariat and staff listings on the Job Board. Listings where people apply on Gavelling are free; a listing that applies on another site costs credits once"
            icon={{ emoji: 'Briefcase', lucide: Briefcase, tint: TINT_GOLD }}
            hang="start"
            className="gv-jb-main"
          >
            {listings.length === 0 ? (
              <div className="gv-jb-first">
                <p className="gv-jb-first-title">Post your first listing</p>
                <p className="gv-jb-first-line">Listings are free when people apply on Gavelling, as many as you like</p>
                <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setPopup({ kind: 'post', listing: null })}>
                  <Plus size={16} strokeWidth={2.6} aria-hidden /> Post a listing
                </button>
              </div>
            ) : (
              <ul className="gv-jb-list">
                {listings.map((l) => (
                  <ListingRow
                    key={l.id}
                    listing={l}
                    canPromote={panel.can_promote}
                    onEdit={() => setPopup({ kind: 'post', listing: l })}
                    onPromote={() => setPopup({ kind: 'promote', listing: l })}
                    onChanged={(m) => { notifyOk(m, 'jobs'); void reload(); }}
                  />
                ))}
              </ul>
            )}
          </DashCard>

          <div className="gv-jb-side">
            <DigestCard slug={slug} digest={digest} err={digestErr} onRetry={() => { void reload(); }} />
            <EmailsCard
              confId={conference.id}
              settings={panel.settings}
              onSaved={(s) => setPanel((p) => (p ? { ...p, settings: s } : p))}
            />
          </div>
        </div>
      )}

      {popup?.kind === 'pack' && panel && (
        <CommitteePackPopup
          conference={{
            id: conference.id, slug, acronym: conference.acronym, full_name: conference.full_name, logo_url: conference.logo_url,
            is_verified: !!conference.is_verified, city: conference.city ?? null, country: conference.country ?? null,
            format: conference.format ?? null, student_level: conference.student_level ?? null,
            start_date: conference.start_date ?? null, end_date: conference.end_date ?? null,
          }}
          panel={panel}
          myUserId={user?.id ?? null}
          onClose={() => setPopup(null)}
          onDone={() => { void reload(); }}
        />
      )}
      {popup?.kind === 'post' && panel && (
        <PostingPopup
          conference={{
            id: conference.id, slug, acronym: conference.acronym, full_name: conference.full_name, logo_url: conference.logo_url,
            is_verified: !!conference.is_verified, city: conference.city ?? null, country: conference.country ?? null,
            format: conference.format ?? null, student_level: conference.student_level ?? null,
            start_date: conference.start_date ?? null, end_date: conference.end_date ?? null,
          }}
          panel={panel}
          listing={popup.listing}
          myUserId={user?.id ?? null}
          onClose={() => setPopup(null)}
          onSaved={() => { void reload(); }}
          onPublished={(m) => { setPopup(null); notifyOk(m, 'jobs'); void reload(); }}
          onShort={handOffShort}
          onPromoted={promoted}
        />
      )}
      {popup?.kind === 'promote' && panel && (
        <PromotePopup
          listingId={popup.listing.id}
          listingTitle={popup.listing.title}
          conferenceCredits={panel.conference_credits}
          onClose={() => setPopup(null)}
          onDone={promoted}
          onShort={(req) => handOffShort({ ...req, okMessage: (a) => `Promoted until ${dayLabel(typeof a.ends_on === 'string' ? a.ends_on : null)}` })}
        />
      )}
    </div>
  );
}

function DigestCard({ slug, digest, err, onRetry }: {
  slug: string;
  digest: { lines: DigestLine[]; views_week: number; clicks_week: number } | null;
  err: string | null;
  onRetry: () => void;
}) {
  const yesterday = (digest?.lines ?? []).filter((l) => l.yesterday > 0);
  const week = (digest?.lines ?? []).filter((l) => l.week > 0);
  const hrefOf = (l: DigestLine) => (l.link === 'team' ? `/manage/${slug}/settings?tab=team` : `/manage/${slug}/applications`);
  const line = (l: DigestLine, n: number) => (
    <li key={l.listing_id}>
      <Link href={hrefOf(l)} className="gv-jb-dl">
        <b>{n.toLocaleString('en-US')}</b> {n === 1 ? 'person' : 'people'} applied to {l.title}
      </Link>
    </li>
  );
  return (
    <DashCard
      title="Applicants"
      hint="New applicants who came through your listings, and how often the listings were seen this week. Chair applications open in Applications; secretariat and staff in Settings, Team"
      icon={{ emoji: 'Bar chart', lucide: BarChart3, tint: TINT_GREEN }}
      hang="start"
    >
      {err && !digest ? (
        <p className="gv-st-err" role="alert">{err} <button type="button" className="gv-st-link" onClick={onRetry}>Try again</button></p>
      ) : !digest ? (
        <div className="gv-jb-skel" style={{ minHeight: 120 }} aria-hidden />
      ) : (
        <>
          {week.length === 0 ? (
            <p className="gv-jb-quiet">No new applicants this week</p>
          ) : (
            <>
              {yesterday.length > 0 && (
                <section className="gv-jb-dsec">
                  <h3 className="gv-jb-dh">Yesterday</h3>
                  <ul className="gv-jb-dlist">{yesterday.map((l) => line(l, l.yesterday))}</ul>
                </section>
              )}
              <section className="gv-jb-dsec">
                <h3 className="gv-jb-dh">This Week</h3>
                <ul className="gv-jb-dlist">{week.map((l) => line(l, l.week))}</ul>
              </section>
            </>
          )}
          <div className="gv-jb-dstats">
            <p><b>{digest.views_week.toLocaleString('en-US')}</b> views</p>
            <p><b>{digest.clicks_week.toLocaleString('en-US')}</b> clicks to apply</p>
            <span className="gv-jb-quiet" style={{ fontSize: 12.5 }}>this week</span>
          </div>
        </>
      )}
    </DashCard>
  );
}

function EmailsCard({ confId, settings, onSaved }: {
  confId: string;
  settings: { emails_on: boolean; my_mode: MyMode };
  onSaved: (s: { emails_on: boolean; my_mode: MyMode }) => void;
}) {
  const [local, setLocal] = useState(settings);
  const [seen, setSeen] = useState(settings);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  if (seen !== settings) { setSeen(settings); setLocal(settings); }

  const save = async (emailsOn: boolean | null, mode: MyMode | null) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const before = local;
    setLocal({ emails_on: emailsOn ?? local.emails_on, my_mode: mode ?? local.my_mode });
    try {
      const r = await setJobSettings(confId, emailsOn, mode);
      if (!r.ok) {
        setLocal(before);
        notifyErr(r.message, 'jobs');
        return;
      }
      onSaved({ emails_on: r.emails_on, my_mode: r.my_mode });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const MODES: { key: MyMode; label: string }[] = [
    { key: 'each', label: 'Every new applicant' },
    { key: 'digest', label: 'One daily digest' },
    { key: 'off', label: 'No emails for me' },
  ];

  return (
    <DashCard
      title="Emails"
      hint="The switch is for the whole conference. When it is on, each organizer chooses for themselves how often they hear about new applicants"
      icon={{ emoji: 'Envelope', lucide: Mail, tint: TINT_GOLD }}
      hang="start"
    >
      <div className="gv-jb-switchrow">
        <button
          type="button"
          role="switch"
          aria-checked={local.emails_on}
          aria-label="Email organizers about new applicants"
          className={`gv-jb-switch${local.emails_on ? ' gv-jb-switch-on' : ''}`}
          onClick={() => { void save(!local.emails_on, null); }}
          disabled={busy}
        >
          <span aria-hidden />
        </button>
        <span className="gv-jb-switch-label">Email organizers about new applicants</span>
      </div>
      {local.emails_on && (
        <div className="gv-jb-modes" role="radiogroup" aria-label="Your emails">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={local.my_mode === m.key}
              className={`gv-jb-mode${local.my_mode === m.key ? ' gv-jb-mode-on' : ''}`}
              onClick={() => { if (local.my_mode !== m.key) void save(null, m.key); }}
              disabled={busy}
            >
              <span className="gv-jb-dot" aria-hidden>{local.my_mode === m.key && <span />}</span>
              {m.label}
            </button>
          ))}
        </div>
      )}
    </DashCard>
  );
}

const PAGE_CSS = `
.gv-jb-head{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:34px}
.gv-jb-post{min-height:48px;padding:0 22px;font-size:15px}
.gv-jb-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:34px 24px;align-items:start}
@media (min-width:1100px){.gv-jb-grid{grid-template-columns:minmax(0,1fr) minmax(320px,380px)}}
@media (min-width:1600px){.gv-jb-grid{grid-template-columns:minmax(0,1fr) minmax(360px,440px)}}
.gv-jb-side{display:flex;flex-direction:column;gap:34px;min-width:0}
.gv-jb-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.gv-jb-first{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:24px 4px 8px}
.gv-jb-first-title{margin:0;font-family:${OUTFIT};font-size:22px;font-weight:800;color:${INK}}
.gv-jb-first-line{margin:0 0 6px;font-family:${OUTFIT};font-size:15px;color:${INK_SOFT}}
.gv-jb-quiet{margin:0;font-family:${OUTFIT};font-size:14.5px;color:${INK_SOFT}}
.gv-jb-dsec{margin-bottom:14px}
.gv-jb-dh{margin:0 0 8px;font-family:${OUTFIT};font-size:14px;font-weight:800;color:${INK}}
.gv-jb-dlist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.gv-jb-dl{font-family:${OUTFIT};font-size:14.5px;line-height:1.45;color:${INK};text-decoration:underline;text-decoration-color:rgba(28,20,16,0.25);text-underline-offset:3px;overflow-wrap:anywhere}
.gv-jb-dl:hover{text-decoration-color:${FOREST};color:${FOREST}}
.gv-jb-dl b{font-weight:800;font-variant-numeric:tabular-nums}
.gv-jb-dstats{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 18px;padding-top:14px;border-top:1px solid rgba(28,20,16,0.08)}
.gv-jb-dstats p{margin:0;font-family:${OUTFIT};font-size:13.5px;color:${INK_SOFT}}
.gv-jb-dstats b{font-size:22px;font-weight:800;color:${INK};font-variant-numeric:tabular-nums;margin-right:4px}
.gv-jb-switchrow{display:flex;align-items:center;gap:12px}
.gv-jb-switch{position:relative;flex-shrink:0;width:46px;height:26px;border-radius:9999px;border:none;cursor:pointer;background:rgba(28,20,16,0.2);transition:background-color 160ms ease}
.gv-jb-switch span{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:9999px;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:transform 180ms cubic-bezier(0.22,1,0.36,1)}
.gv-jb-switch-on{background:${FOREST}}
.gv-jb-switch-on span{transform:translateX(20px)}
.gv-jb-switch:disabled{cursor:default;opacity:0.7}
.gv-jb-switch:focus{outline:none}
.gv-jb-switch:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-jb-switch-label{font-family:${OUTFIT};font-size:14.5px;font-weight:600;color:${INK}}
.gv-jb-modes{display:flex;flex-direction:column;gap:6px;margin-top:14px}
.gv-jb-mode{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border-radius:12px;border:1.5px solid rgba(28,20,16,0.12);background:#FFFFFF;cursor:pointer;font-family:${OUTFIT};font-size:14.5px;font-weight:600;color:${INK};text-align:left}
.gv-jb-mode-on{border-color:${FOREST};background:#EEF3EC}
.gv-jb-mode:disabled{cursor:default}
.gv-jb-mode:focus{outline:none}
.gv-jb-mode:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-jb-dot{flex-shrink:0;width:18px;height:18px;border-radius:9999px;border:1.5px solid rgba(28,20,16,0.35);display:inline-flex;align-items:center;justify-content:center;background:#FFFFFF}
.gv-jb-mode-on .gv-jb-dot{border-color:${FOREST}}
.gv-jb-dot span{width:9px;height:9px;border-radius:9999px;background:${FOREST}}
.gv-jb-skel{border-radius:20px;background:linear-gradient(90deg,#EFEAE0 0%,#F7F4EE 50%,#EFEAE0 100%);background-size:200% 100%;animation:gvJbSkel 1.3s ease-in-out infinite}
@keyframes gvJbSkel{from{background-position:100% 0}to{background-position:-100% 0}}
@media (prefers-reduced-motion:reduce){.gv-jb-skel{animation:none}}
`;
