'use client';

// ── One listing: the right pane of /jobs, and the phone's full screen ───────
//
// Top to bottom: the header card (logo, title, the conference, place, dates,
// offer chips, urgency) with the action row inside it; a reserved spot for
// prompt 5's Unlimited insights strip (renders nothing yet); then About the
// Role, and beside it on wide screens Posted by, the question count and About
// the Conference. A slim bar keeps the title and Apply one click away once the
// header card scrolls out of view.
//
// Signed out everything reads; Apply and Save open the site's sign-in pop-up
// and the action carries on by itself once signed in (the pending action is
// kept in sessionStorage with the listing id). An "Apply on their site" link
// opens without sign-in: a new tab can only open inside the click itself.
// Every write is verified: a refusal is shown, never an optimistic success.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bookmark, BookmarkCheck, Check, ExternalLink, ListChecks, Loader2, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { notifyErr } from '@/lib/appNotify';
import {
  fetchJobListing, jobAppliesOutside, jobContinuePath, recordJobEvent, saveJob,
  type JobCard as JobCardData, type JobListingResult,
} from '@/lib/jobBoard';
import { JOB_FORMAT_LABEL, JobLogo, JobTag, OfferChips, UrgencyLine, jobDates, jobPlace } from './JobCard';
import JobApplyPopup from './JobApplyPopup';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

const PENDING_KEY = 'gavelling-job-pending';
type PendingAction = { id: string; action: 'apply' | 'save' };

function readPending(): PendingAction | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingAction;
    return p && typeof p.id === 'string' && (p.action === 'apply' || p.action === 'save') ? p : null;
  } catch { return null; }
}
function writePending(p: PendingAction | null) {
  try {
    if (p) window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch { /* storage off: the person presses again after signing in */ }
}

function shortDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function JobListing({
  id, initialCard, initialDetail, onBack, scrollRoot, appliedAt, onChanged,
}: {
  id: string;
  /** The card from the list, so the header draws at once. */
  initialCard?: JobCardData | null;
  /** The server-rendered read (signed out), when the page opened on this listing. */
  initialDetail?: JobListingResult | null;
  /** Phones: the back arrow to the list. */
  onBack?: () => void;
  /** The element the pane scrolls in (desktop); null = the window (phones). */
  scrollRoot?: HTMLElement | null;
  /** When the viewer applied, from job_my(), for the status line. */
  appliedAt?: string | null;
  /** Saved or applied state changed: the page reads job_my() again. */
  onChanged?: () => void;
}) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [detail, setDetail] = useState<JobListingResult | null>(initialDetail && initialDetail.listing.id === id ? initialDetail : null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(!detail);
  const [saved, setSaved] = useState<boolean>(detail?.saved ?? false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const headRef = useRef<HTMLElement | null>(null);
  const seq = useRef(0);
  const saveBusyRef = useRef(false);

  const load = useCallback(async (quiet = false) => {
    const mine = ++seq.current;
    if (!quiet) setLoading(true);
    const res = await fetchJobListing(id);
    if (mine !== seq.current) return;
    if (!res.ok) {
      setFailed(res.message);
      setDetail(null);
    } else {
      setFailed(null);
      setDetail(res);
      setSaved(res.saved);
      recordJobEvent(id, 'view');
    }
    setLoading(false);
  }, [id]);

  // Read on open, and again when the viewer signs in or out (their own
  // saved and applied state rides on the same read). Keyed on the user id.
  useEffect(() => {
    if (authLoading) return;
    void load(!!detail && detail.listing.id === id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId, authLoading, load]);

  // The slim bar shows once the header card has scrolled out of view.
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting),
      { root: scrollRoot ?? null, threshold: 0, rootMargin: scrollRoot ? '0px' : '-12px 0px 0px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot, id, detail]);

  const listing = detail?.listing ?? null;
  const card: JobCardData | null = listing ?? (initialCard && initialCard.id === id ? initialCard : null);

  const toggleSave = useCallback(async (on?: boolean) => {
    if (saveBusyRef.current) return;
    if (!userId) {
      writePending({ id, action: 'save' });
      openAuth();
      return;
    }
    const want = on ?? !saved;
    saveBusyRef.current = true;
    setSaveBusy(true);
    try {
      const res = await saveJob(id, want);
      if (!res.ok) { notifyErr(res.message, 'job-save'); return; }
      setSaved(res.saved);
      onChanged?.();
    } finally {
      saveBusyRef.current = false;
      setSaveBusy(false);
    }
  }, [id, userId, saved, onChanged]);

  const startApply = useCallback(() => {
    if (!listing) return;
    if (!userId) {
      writePending({ id, action: 'apply' });
      openAuth({ apply: true });
      return;
    }
    recordJobEvent(id, 'click');
    setApplyOpen(true);
  }, [id, listing, userId]);

  // After signing in, the action pressed while signed out carries on.
  useEffect(() => {
    if (!userId || !detail || detail.listing.id !== id) return;
    const p = readPending();
    if (!p || p.id !== id) return;
    writePending(null);
    if (p.action === 'save') {
      if (!detail.saved) void toggleSave(true);
    } else if (detail.listing.open && !detail.mine && !jobAppliesOutside(detail.listing)) {
      recordJobEvent(id, 'click');
      setApplyOpen(true);
    }
  }, [userId, detail, id, toggleSave]);

  if (!card && failed) {
    return (
      <div className="gv-jl" style={{ fontFamily: FONT }}>
        <style>{LISTING_CSS}</style>
        {onBack && <BackLink onBack={onBack} />}
        <div className="gv-jl-card gv-jl-gone">
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: INK }}>{failed}</p>
          <button type="button" className="gv-jl-link" onClick={() => { void load(); }}>Try again</button>
        </div>
      </div>
    );
  }

  if (!card) return <ListingSkeleton onBack={onBack} />;

  const conf = card.conference;
  const outside = listing ? jobAppliesOutside(listing) : jobAppliesOutside(card);
  const mine = detail?.mine ?? null;
  const open = listing ? listing.open : true;
  const slug = conf.slug;
  const confName = conf.name && conf.name !== conf.short ? conf.name : null;
  const meta = [jobPlace(conf), conf.format ? JOB_FORMAT_LABEL[conf.format] ?? null : null, jobDates(conf)].filter(Boolean) as string[];
  const applied = shortDay(appliedAt);

  const onOutside = () => {
    if (!listing?.outside_url) return;
    recordJobEvent(id, 'click');
    window.open(listing.outside_url, '_blank', 'noopener,noreferrer');
  };

  // The main action, or the applicant's state in its place.
  let primary: React.ReactNode;
  if (!listing) {
    primary = <span className="gv-jl-main gv-jl-main-wait" aria-hidden><Loader2 size={17} className="animate-spin" /></span>;
  } else if (mine?.status === 'started' && slug) {
    primary = <Link href={jobContinuePath(slug, listing.role, listing.id)} className="gv-jl-main">Continue application</Link>;
  } else if (mine?.status === 'stopped') {
    primary = <span className="gv-jl-state"><X size={16} strokeWidth={2.6} aria-hidden /> Not a match for this role</span>;
  } else if (mine && (mine.status === 'submitted' || mine.status === 'accepted' || mine.status === 'rejected')) {
    const lead = mine.status === 'accepted' ? 'Accepted. ' : mine.status === 'rejected' ? 'Not accepted this time. ' : '';
    primary = (
      <span className="gv-jl-state">
        <Check size={16} strokeWidth={2.6} aria-hidden />
        {lead}{applied ? `You applied on ${applied}` : 'You applied'}
      </span>
    );
  } else if (outside) {
    primary = (
      <button type="button" className="gv-jl-main" onClick={onOutside} disabled={!listing.outside_url}>
        Apply on their site <ExternalLink size={16} strokeWidth={2.4} aria-hidden />
      </button>
    );
  } else {
    primary = <button type="button" className="gv-jl-main" onClick={startApply}>Apply</button>;
  }

  const saveButton = (
    <button
      type="button"
      className={`gv-jl-save${saved ? ' gv-jl-save-on' : ''}`}
      onClick={() => { void toggleSave(); }}
      disabled={saveBusy || !listing}
      aria-pressed={saved}
      aria-busy={saveBusy || undefined}
    >
      {saveBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : saved ? <BookmarkCheck size={17} strokeWidth={2.3} aria-hidden /> : <Bookmark size={17} strokeWidth={2.3} aria-hidden />}
      {saved ? 'Saved' : 'Save'}
    </button>
  );

  const actions = open ? (
    <div className="gv-jl-actions">{primary}{saveButton}</div>
  ) : (
    <p className="gv-jl-closed">No longer taking applicants</p>
  );

  const about = detail?.conference_about ?? null;
  const poster = detail?.poster ?? null;
  const qCount = listing?.questions_count ?? 0;

  return (
    <article className="gv-jl" style={{ fontFamily: FONT }} aria-label={card.title}>
      <style>{LISTING_CSS}</style>

      {/* The slim bar: title and the main action, once the header is out of view. */}
      <div className={`gv-jl-bar${stuck ? ' gv-jl-bar-on' : ''}${scrollRoot ? '' : ' gv-jl-bar-page'}`} aria-hidden={!stuck} inert={!stuck}>
        <span className="gv-jl-bar-title">{card.title}</span>
        {open && <span className="gv-jl-bar-act">{primary}</span>}
      </div>

      {onBack && <BackLink onBack={onBack} />}

      <header ref={headRef} className="gv-jl-card gv-jl-head">
        <div className="flex items-start" style={{ gap: 16 }}>
          <JobLogo conf={conf} size={68} standalone={card.standalone} />
          <div className="flex-1 min-w-0">
            {(card.promoted || card.premium) && (
              <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
                {card.premium && <JobTag kind="premium" />}
                {card.promoted && <JobTag kind="promoted" />}
              </div>
            )}
            <h2 className="gv-jl-title">{card.title}</h2>
            {card.committee && <p className="gv-jl-committee">{card.committee}</p>}
            <p className="gv-jl-conf">
              {slug ? (
                <Link href={`/conferences/${encodeURIComponent(slug)}`} className="gv-jl-conflink">{conf.short || conf.name}</Link>
              ) : (
                <span style={{ fontWeight: 700, color: INK }}>{conf.short || conf.name}</span>
              )}
              {confName && <span className="gv-jl-confname">{confName}</span>}
            </p>
            <p className="gv-jl-meta">
              {meta.map((m, i) => (
                <span key={i}>{i > 0 && <span aria-hidden className="gv-jl-dot">·</span>}{m}</span>
              ))}
            </p>
          </div>
        </div>
        {(card.offers || card.urgency) && (
          <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 16 }}>
            <OfferChips card={card} />
            <UrgencyLine text={card.urgency} />
          </div>
        )}
        <div style={{ marginTop: 18 }}>{actions}</div>
      </header>

      {/* Prompt 5 puts the Unlimited insights strip here, directly under the
          header card. Nothing renders in this spot yet. */}

      {loading && !detail ? (
        <BodySkeleton />
      ) : (
        <div className="gv-jl-body">
          <section className="gv-jl-card gv-jl-main-col" aria-labelledby={`gv-jl-role-${id}`}>
            <h3 id={`gv-jl-role-${id}`} className="gv-jl-h">About the Role</h3>
            {listing?.description?.trim() ? (
              <p className="gv-jl-text">{listing.description}</p>
            ) : (
              <p className="gv-jl-text" style={{ color: INK_SOFT }}>The conference has not written a description yet</p>
            )}
            {failed && <p role="alert" className="gv-jl-text" style={{ color: '#9E2A12', marginTop: 12 }}>{failed}</p>}
          </section>

          <aside className="gv-jl-side">
            {poster?.name && (
              <section className="gv-jl-card">
                <h3 className="gv-jl-h gv-jl-h-sm">Posted by</h3>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <Avatar name={poster.name} src={poster.avatar_url} />
                  <div className="min-w-0">
                    <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{poster.name}</p>
                    {poster.title && <p style={{ margin: '2px 0 0', fontSize: 13.5, color: INK_SOFT, overflowWrap: 'anywhere' }}>{poster.title}</p>}
                  </div>
                </div>
              </section>
            )}

            {qCount > 0 && open && !outside && (
              <section className="gv-jl-card gv-jl-qcount">
                <span className="gv-jl-qicon" aria-hidden><ListChecks size={18} strokeWidth={2.3} /></span>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: INK }}>
                  <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{qCount}</span>{' '}
                  {qCount === 1 ? 'question' : 'questions'} before you apply
                </p>
              </section>
            )}

            {card.standalone ? (
              conf.website && (
                <section className="gv-jl-card">
                  <h3 className="gv-jl-h gv-jl-h-sm">About the Conference</h3>
                  <a href={conf.website} target="_blank" rel="noopener noreferrer nofollow" className="gv-jl-link">
                    Visit their website <ExternalLink size={14} strokeWidth={2.4} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} />
                  </a>
                </section>
              )
            ) : about && (about.about?.trim() || about.slug) ? (
              <section className="gv-jl-card">
                <h3 className="gv-jl-h gv-jl-h-sm">About the Conference</h3>
                {about.about?.trim() && <p className="gv-jl-text gv-jl-text-sm">{about.about}</p>}
                {about.slug && (
                  <Link href={`/conferences/${encodeURIComponent(about.slug)}`} className="gv-jl-link" style={{ marginTop: about.about?.trim() ? 12 : 0 }}>
                    See the conference page
                  </Link>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      )}

      {applyOpen && listing && (
        <JobApplyPopup
          listing={listing}
          onClose={() => setApplyOpen(false)}
          onSettled={() => { void load(true); onChanged?.(); }}
        />
      )}
    </article>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="gv-jl-back">
      <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
      All roles
    </button>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return src && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={46} height={46} onError={() => setBroken(true)} style={{ width: 46, height: 46, borderRadius: 9999, objectFit: 'cover', flexShrink: 0, border: '2px solid #FFFFFF', boxShadow: '0 3px 10px rgba(27,56,40,0.14)' }} />
  ) : (
    <span aria-hidden style={{ width: 46, height: 46, borderRadius: 9999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(238,217,138,0.55)', color: '#4A3410', fontSize: 15, fontWeight: 800 }}>
      {initials}
    </span>
  );
}

function ListingSkeleton({ onBack }: { onBack?: () => void }) {
  return (
    <div className="gv-jl" style={{ fontFamily: FONT }} aria-busy="true">
      <style>{LISTING_CSS}</style>
      {onBack && <BackLink onBack={onBack} />}
      <div className="gv-jl-card gv-jl-head" aria-hidden>
        <div className="flex items-start" style={{ gap: 16 }}>
          <span className="gv-jl-bone" style={{ width: 68, height: 68, borderRadius: 9999 }} />
          <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
            <span className="gv-jl-bone" style={{ width: '58%', height: 22 }} />
            <span className="gv-jl-bone" style={{ width: '40%', height: 14 }} />
            <span className="gv-jl-bone" style={{ width: '72%', height: 14 }} />
          </div>
        </div>
        <div className="flex" style={{ gap: 10, marginTop: 22 }}>
          <span className="gv-jl-bone" style={{ width: 130, height: 48, borderRadius: 11 }} />
          <span className="gv-jl-bone" style={{ width: 100, height: 48, borderRadius: 11 }} />
        </div>
      </div>
      <BodySkeleton />
    </div>
  );
}

function BodySkeleton() {
  return (
    <div className="gv-jl-body" aria-hidden>
      <div className="gv-jl-card gv-jl-main-col" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="gv-jl-bone" style={{ width: 160, height: 18 }} />
        {[96, 92, 88, 70].map((w, i) => <span key={i} className="gv-jl-bone" style={{ width: `${w}%`, height: 13 }} />)}
      </div>
      <div className="gv-jl-side">
        <div className="gv-jl-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="gv-jl-bone" style={{ width: 46, height: 46, borderRadius: 9999 }} />
          <span className="gv-jl-bone" style={{ width: '50%', height: 14 }} />
        </div>
      </div>
    </div>
  );
}

const LISTING_CSS = `
.gv-jl{position:relative;display:flex;flex-direction:column;gap:16px;color:${INK}}
.gv-jl-card{background:#FFFFFF;border-radius:20px;padding:22px 24px;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 8px 24px rgba(27,56,40,0.08)}
.gv-jl-head{padding:26px 26px 24px}
.gv-jl-gone{display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.gv-jl-title{margin:0;font-size:clamp(24px,2.2vw,32px);font-weight:800;letter-spacing:-0.02em;line-height:1.12;color:${INK};overflow-wrap:anywhere;text-wrap:balance}
.gv-jl-committee{margin:6px 0 0;font-size:15.5px;font-weight:600;color:${FOREST};overflow-wrap:anywhere}
.gv-jl-conf{margin:10px 0 0;display:flex;flex-direction:column;gap:1px;font-size:15.5px}
.gv-jl-conflink{font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
.gv-jl-conflink:hover{color:${FOREST}}
.gv-jl-confname{font-size:13.5px;font-weight:500;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-jl-meta{margin:8px 0 0;font-size:14px;font-weight:500;line-height:1.5;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-jl-dot{margin:0 7px;color:rgba(28,20,16,0.3)}
.gv-jl-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gv-jl-main{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;min-width:120px;padding:0 24px;border:none;border-radius:11px;cursor:pointer;text-decoration:none;
  font-family:${FONT};font-size:16px;font-weight:700;color:#FFFFFF;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);box-shadow:0 6px 16px rgba(27,56,40,0.22);transition:transform 120ms ease,box-shadow 160ms ease,opacity 160ms ease}
.gv-jl-main:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 22px rgba(27,56,40,0.26)}
.gv-jl-main:disabled{opacity:0.6;cursor:default}
.gv-jl-main-wait{opacity:0.6;cursor:default}
.gv-jl-save{display:inline-flex;align-items:center;gap:7px;min-height:48px;padding:0 18px;border-radius:11px;border:1.5px solid ${INK};background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK};transition:background-color 140ms ease}
.gv-jl-save:hover:not(:disabled){background:#F7F4EE}
.gv-jl-save-on{border-color:${FOREST};color:${FOREST};background:#EEF3EC}
.gv-jl-save:disabled{cursor:default;opacity:0.7}
.gv-jl-state{display:inline-flex;align-items:center;gap:8px;min-height:48px;font-size:15.5px;font-weight:700;color:${FOREST}}
.gv-jl-closed{margin:0;display:inline-flex;align-items:center;min-height:48px;padding:0 16px;border-radius:11px;background:rgba(28,20,16,0.06);font-size:15px;font-weight:700;color:${INK_SOFT}}
.gv-jl-body{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
@media (min-width:1280px){.gv-jl-body{grid-template-columns:minmax(0,1fr) minmax(260px,320px);align-items:start}}
.gv-jl-side{display:flex;flex-direction:column;gap:16px;min-width:0}
.gv-jl-h{margin:0 0 12px;font-size:19px;font-weight:800;letter-spacing:-0.01em;color:${INK}}
.gv-jl-h-sm{font-size:16px;margin-bottom:10px}
.gv-jl-text{margin:0;font-size:15.5px;line-height:1.65;color:#2E271F;white-space:pre-line;overflow-wrap:anywhere;max-width:75ch}
.gv-jl-text-sm{font-size:14.5px;line-height:1.6}
.gv-jl-link{display:inline-flex;align-items:center;gap:5px;background:none;border:none;padding:0;cursor:pointer;font-family:${FONT};font-size:14.5px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-jl-link:hover{color:${FOREST}}
.gv-jl-qcount{display:flex;align-items:center;gap:12px;padding:16px 20px}
.gv-jl-qicon{width:38px;height:38px;border-radius:9999px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:${FOREST};background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 2px 6px rgba(27,56,40,0.14)}
.gv-jl-back{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 4px;background:none;border:none;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK}}
.gv-jl-bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:-80px;min-height:64px;padding:8px 10px 8px 20px;border-radius:16px;
  background:rgba(255,255,255,0.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 20px rgba(27,56,40,0.14);
  opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity 180ms ease,transform 220ms cubic-bezier(0.22,1,0.36,1)}
.gv-jl-bar-page{top:calc(8px + env(safe-area-inset-top,0px))}
.gv-jl-bar-on{opacity:1;transform:none;pointer-events:auto}
.gv-jl-bar-title{min-width:0;font-size:15.5px;font-weight:800;line-height:1.25;color:${INK};overflow-wrap:anywhere}
.gv-jl-bar-act{flex-shrink:0}
.gv-jl-bar .gv-jl-main{min-height:44px;padding:0 18px;font-size:15px}
.gv-jl-bar .gv-jl-state{min-height:44px;font-size:14px}
.gv-jl-bone{display:block;border-radius:6px;background:linear-gradient(90deg,#EFEAE0 0%,#F7F4EE 50%,#EFEAE0 100%);background-size:200% 100%;animation:gvJlBone 1.3s ease-in-out infinite}
@keyframes gvJlBone{from{background-position:100% 0}to{background-position:-100% 0}}
.gv-jl :is(button,a):focus{outline:none}
.gv-jl :is(button,a):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (max-width:639px){.gv-jl-card{padding:18px}.gv-jl-head{padding:20px 18px}}
@media (prefers-reduced-motion:reduce){.gv-jl-bar,.gv-jl-main{transition:none}.gv-jl-bone{animation:none}}
`;
