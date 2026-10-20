'use client';

// ── Post a listing for a conference that is not on Gavelling (/jobs) ───────
//
// docs/conferences/job-board.md, prompt 5. The Store pop-up shell, ONE pop-up
// whose steps replace each other with a back arrow (never a pop-up on a
// pop-up), in the look of the organizer posting pop-up
// (manage/[slug]/jobs/PostingPopup.tsx):
//   (ask)  "Is this for a conference on Gavelling?" when the person organizes
//          one: each conference links to its own Job Board, where listings
//          that apply on Gavelling are free; "No, another conference" goes on
//   1 About the Conference   name, short name, city, country, format, level,
//                            dates, logo and website
//   2 About the Role         role, title, description, where people apply
//   3 What You Offer
//   4 Deadline
//   5 Review                 a JobCard preview, then Post / Post and promote
//   then, after "Post and promote", the promotion step in the same pop-up.
// The draft is created (job_listing_save WITHOUT conference_id) when leaving
// step 2, the first point every required field exists; later saves send only
// the keys that changed. A refusal that names a field jumps to its step.
// Short on credits closes this pop-up first and hands the retry to the page
// (useStandalonePosting in PostListingButton.tsx).
//
// After posting, the role, title, link, conference details and dates are
// fixed (one free fix in the first 24 hours, `fix_available`), and the
// deadline can only move earlier.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gavel, ImagePlus, Landmark, Users } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { DatePicker } from '@/components/DatePicker';
import { CountryField } from '@/components/CountryField';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { uploadConferenceAsset } from '@/lib/conferenceAssets';
import { notifyOk } from '@/lib/appNotify';
import { useCredits } from '@/hooks/useCredits';
import {
  JOB_OFFER_LABEL, JOB_OFFER_ORDER, JOB_ROLE_LABEL, fetchJobPrice,
  type JobCard as JobCardData, type JobMyListing, type JobOffers, type JobRole,
} from '@/lib/jobBoard';
import { publishListing, saveListing, dayLabel, type ListingPatch, type Refusal } from '@/app/manage/[slug]/jobs/jobsApi';
import { PromoteContent } from '@/app/manage/[slug]/jobs/PromotePopup';
import JobCard from './JobCard';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const DANGER = '#9E2A12';

type Step = 'conference' | 'role' | 'offers' | 'deadline' | 'review';
const STEPS: Step[] = ['conference', 'role', 'offers', 'deadline', 'review'];

const STEP_TITLE: Record<Step, string> = {
  conference: 'About the Conference',
  role: 'About the Role',
  offers: 'What You Offer',
  deadline: 'Deadline',
  review: 'Review',
};
const STEP_SHORT: Record<Step, string> = {
  conference: 'Conference', role: 'Role', offers: 'Offers', deadline: 'Deadline', review: 'Review',
};

/** Which step owns each field the server can name. */
const FIELD_STEP: Record<string, Step> = {
  ext_name: 'conference', ext_acronym: 'conference', ext_city: 'conference', ext_country: 'conference',
  ext_format: 'conference', ext_level: 'conference', ext_start: 'conference', ext_end: 'conference',
  ext_logo_url: 'conference', ext_website: 'conference',
  kind: 'role', role: 'role', title: 'role', description: 'role', outside_url: 'role',
  offers: 'offers', paid_amount: 'offers',
  deadline: 'deadline',
};

const ROLE_ICON: Record<JobRole, typeof Gavel> = { chair: Gavel, secretariat: Landmark, staff: Users };
const FORMATS: { value: string; label: string }[] = [
  { value: 'in-person', label: 'In person' }, { value: 'online', label: 'Online' }, { value: 'hybrid', label: 'Hybrid' },
];
const LEVELS: { value: string; label: string }[] = [
  { value: 'school', label: 'High school' }, { value: 'university', label: 'University' }, { value: 'both', label: 'Both' },
];
const NO_OFFERS: JobOffers = { paid: false, paid_amount: null, accommodation: false, travel: false, certificate: false, letter: false };
const LINK_RE = /(https?:\/\/|www\.)/i;
const HTTPS_RE = /^https:\/\/[^\s.]+\.[^\s]+$/i;

/** job_listing_save with the standalone conference keys (jobsApi's type has no ext_* keys). */
type StandalonePatch = ListingPatch & {
  ext_name?: string; ext_acronym?: string; ext_city?: string; ext_country?: string | null;
  ext_format?: string | null; ext_level?: string | null; ext_start?: string | null; ext_end?: string | null;
  ext_logo_url?: string | null; ext_website?: string | null;
};

export interface StandaloneShortRequest {
  need: number;
  retry: () => Promise<{ ok: true } | Refusal>;
  okMessage: (answer: Record<string, unknown>) => string;
}

interface Draft {
  ext_name: string; ext_acronym: string; ext_city: string; ext_country: string;
  ext_format: string; ext_level: string; ext_start: string; ext_end: string;
  ext_logo_url: string; ext_website: string;
  role: JobRole | null; title: string; description: string; outside_url: string;
  offers: JobOffers; deadline: string;
}

const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

function draftOf(l: JobMyListing | null): Draft {
  const c = l?.conference;
  return {
    ext_name: c?.name ?? '', ext_acronym: c?.short ?? '', ext_city: c?.city ?? '', ext_country: c?.country ?? '',
    ext_format: c?.format ?? '', ext_level: c?.level ?? '', ext_start: day(c?.start_date), ext_end: day(c?.end_date),
    ext_logo_url: c?.logo_url ?? '', ext_website: c?.website ?? '',
    role: l?.role ?? null, title: l?.title ?? '', description: l?.description ?? '', outside_url: l?.outside_url ?? '',
    offers: { ...NO_OFFERS, ...(l?.offers ?? {}) }, deadline: day(l?.deadline),
  };
}

function patchOf(d: Draft) {
  return {
    kind: 'outside' as const,
    role: (d.role ?? 'chair') as JobRole,
    title: d.title.trim(),
    description: d.description,
    outside_url: d.outside_url.trim() || null,
    offers: { ...d.offers, paid_amount: d.offers.paid ? (d.offers.paid_amount?.trim() || null) : null },
    deadline: d.deadline || null,
    ext_name: d.ext_name.trim(),
    ext_acronym: d.ext_acronym.trim(),
    ext_city: d.ext_city.trim(),
    ext_country: d.ext_country || null,
    ext_format: d.ext_format || null,
    ext_level: d.ext_level || null,
    ext_start: d.ext_start || null,
    ext_end: d.ext_end || null,
    ext_logo_url: d.ext_logo_url || null,
    ext_website: d.ext_website.trim() || null,
  };
}
type Saved = ReturnType<typeof patchOf>;

/** "20 Oct, 14:30", 24 hours after the listing was published. */
function fixUntil(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return null;
  const d = new Date(t + 24 * 3600 * 1000);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

interface OrganizedConference { id: string; slug: string; acronym: string | null; full_name: string | null }

/** The conferences this person organizes that have not ended. Null when the read failed. */
async function readOrganizedConferences(userId: string): Promise<OrganizedConference[] | null> {
  try {
    const client = await getFreshAuthedClient();
    if (!client) return null;
    const cols = 'id, slug, acronym, full_name, end_date';
    const [team, owned] = await Promise.all([
      client.from('conference_organizers').select(`conferences (${cols})`).eq('user_id', userId),
      client.from('conferences').select(cols).eq('organizer_id', userId),
    ]);
    if (team.error && owned.error) return null;
    type Row = OrganizedConference & { end_date: string | null };
    const rows: Row[] = [];
    for (const r of (team.data ?? []) as { conferences: Row | Row[] | null }[]) {
      const c = Array.isArray(r.conferences) ? r.conferences[0] : r.conferences;
      if (c) rows.push(c);
    }
    for (const c of (owned.data ?? []) as Row[]) rows.push(c);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const seen = new Set<string>();
    return rows.filter((c) => {
      if (!c.slug || seen.has(c.id)) return false;
      seen.add(c.id);
      return !c.end_date || c.end_date.slice(0, 10) >= today;
    });
  } catch { return null; }
}

export default function StandalonePostingPopup({
  listing, userId, onClose, onSaved, onPublished, onShort, onPromoted,
}: {
  /** A listing to edit; null posts a new one. */
  listing: JobMyListing | null;
  userId: string;
  onClose: () => void;
  /** A draft or an edit landed: the page reads job_my again. */
  onSaved: () => void;
  /** Published (or a live listing saved): the page closes this, toasts and reads again. */
  onPublished: (message: string) => void;
  /** Short on credits: the page closes this pop-up, then buys and retries once. */
  onShort: (req: StandaloneShortRequest) => void;
  /** Promoted from the last step. */
  onPromoted: (endsOn: string | null) => void;
}) {
  const { balance } = useCredits();
  const [id, setId] = useState<string | null>(listing?.id ?? null);
  const [shown] = useState(listing?.shown ?? 'draft');
  const [fixAvailable, setFixAvailable] = useState(!!listing?.fix_available);
  const [draft, setDraft] = useState<Draft>(() => draftOf(listing));
  const [saved, setSaved] = useState<Saved | null>(() => (listing ? patchOf(draftOf(listing)) : null));
  const [phase, setPhase] = useState<'checking' | 'ask' | 'steps' | 'promote'>(listing ? 'steps' : 'checking');
  const [orgConfs, setOrgConfs] = useState<OrganizedConference[]>([]);
  const [step, setStep] = useState<Step>(listing ? 'review' : 'conference');
  const [reached, setReached] = useState<boolean>(!!listing);
  const [bad, setBad] = useState<{ field: string; message: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'promote-publish' | 'logo'>(null);
  const [askDeadline, setAskDeadline] = useState<{ message: string; promote: boolean } | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const busyRef = useRef(false);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const assetId = useRef<string | null>(null);

  const live = shown !== 'draft';
  const origDeadline = useMemo(() => day(listing?.deadline), [listing]);
  // The fixed fields after posting: role, title, link, conference details, dates.
  const fixed = live && !fixAvailable && (!!listing?.locked || (listing?.charged_credits ?? 0) > 0);
  const fixLine = live && fixAvailable ? fixUntil(listing?.published_at ?? null) : null;

  useEffect(() => {
    let cancelled = false;
    void fetchJobPrice('outside_listing').then((n) => { if (!cancelled) setPrice(n); });
    return () => { cancelled = true; };
  }, []);

  // A new listing: does this person organize a conference on Gavelling?
  useEffect(() => {
    if (listing) return;
    let cancelled = false;
    void readOrganizedConferences(userId).then((list) => {
      if (cancelled) return;
      if (list && list.length > 0) { setOrgConfs(list); setPhase('ask'); } else { setPhase('steps'); }
    });
    return () => { cancelled = true; };
  }, [listing, userId]);

  const index = Math.max(0, STEPS.indexOf(step));
  const set = useCallback(<K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setBad((b) => (b && (b.field === k || (k === 'offers' && b.field === 'paid_amount')) ? null : b));
  }, []);

  function checkStep(s: Step): { field: string; message: string } | null {
    if (s === 'conference') {
      const n = draft.ext_name.trim();
      if (!n) return { field: 'ext_name', message: 'Add the conference name' };
      if (n.length > 120) return { field: 'ext_name', message: 'Keep the name to 120 characters' };
      if (!draft.ext_acronym.trim()) return { field: 'ext_acronym', message: 'Add a short name, like HMUN' };
      if (draft.ext_acronym.trim().length > 20) return { field: 'ext_acronym', message: 'Keep the short name to 20 characters' };
      if (!draft.ext_city.trim()) return { field: 'ext_city', message: 'Add the city' };
      if (!draft.ext_country) return { field: 'ext_country', message: 'Choose the country' };
      if (!draft.ext_format) return { field: 'ext_format', message: 'Choose the format' };
      if (!draft.ext_level) return { field: 'ext_level', message: 'Choose who it is for' };
      if (!draft.ext_start) return { field: 'ext_start', message: 'Add the first day' };
      if (!draft.ext_end) return { field: 'ext_end', message: 'Add the last day' };
      if (draft.ext_end < draft.ext_start) return { field: 'ext_end', message: 'The last day cannot be before the first day' };
      const w = draft.ext_website.trim();
      if (w && !HTTPS_RE.test(w)) return { field: 'ext_website', message: 'Use a full link that starts with https://' };
    }
    if (s === 'role') {
      if (!draft.role) return { field: 'role', message: 'Choose a role' };
      const t = draft.title.trim();
      if (!t) return { field: 'title', message: 'Give the listing a title' };
      if (t.length > 80) return { field: 'title', message: 'Keep the title to 80 characters' };
      if (LINK_RE.test(t)) return { field: 'title', message: 'A title cannot hold a link' };
      if (draft.description.length > 4000) return { field: 'description', message: 'Keep the description to 4,000 characters' };
      const u = draft.outside_url.trim();
      if (!u) return { field: 'outside_url', message: 'Add the link where people apply' };
      if (!HTTPS_RE.test(u)) return { field: 'outside_url', message: 'Use a full link that starts with https://' };
    }
    if (s === 'deadline' && live && origDeadline && draft.deadline && draft.deadline > origDeadline) {
      return { field: 'deadline', message: `The deadline can only move earlier than ${dayLabel(origDeadline)}` };
    }
    return null;
  }

  /** A refusal from the server: jump to the field's step and mark it. */
  const showRefusal = useCallback((r: Refusal) => {
    if (r.code === 'locked') { setErr(r.message); return; }
    const target = r.field ? FIELD_STEP[r.field] : undefined;
    if (r.field && target) {
      setStep(target);
      setBad({ field: r.field, message: r.message });
      return;
    }
    setErr(r.message);
  }, []);

  /** Saves the changed keys (or creates the draft). Returns the id, or null after a refusal. */
  const persist = useCallback(async (): Promise<string | null> => {
    const now = patchOf(draft);
    let body: StandalonePatch;
    if (!id) {
      body = { ...now };
    } else {
      const changed: StandalonePatch = { id };
      (Object.keys(now) as (keyof Saved)[]).forEach((k) => {
        if (!saved || JSON.stringify(now[k]) !== JSON.stringify(saved[k])) (changed as Record<string, unknown>)[k] = now[k];
      });
      if (Object.keys(changed).length === 1) return id;
      body = changed;
    }
    const r = await saveListing(body as ListingPatch);
    if (!r.ok) { showRefusal(r); return null; }
    if (r.fix_used) {
      setFixAvailable(false);
      notifyOk('Saved. That was your one free fix.', 'jobs');
    }
    setId(r.id);
    setSaved(now);
    onSaved();
    return r.id;
  }, [draft, id, saved, onSaved, showRefusal]);

  async function go(to: Step) {
    if (busyRef.current) return;
    setErr('');
    const forward = STEPS.indexOf(to) > index;
    if (forward) {
      for (const s of STEPS.slice(index, STEPS.indexOf(to))) {
        const problem = checkStep(s);
        if (problem) { setStep(s); setBad(problem); return; }
      }
    }
    // From leaving the role step on (and on every step of an existing
    // listing), leaving a step saves the draft, so closing half way keeps it.
    if ((forward && STEPS.indexOf(to) >= 2) || id) {
      busyRef.current = true;
      setBusy('save');
      try {
        const ok = await persist();
        if (!ok) return;
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    }
    setBad(null);
    if (to === 'review') setReached(true);
    setStep(to);
  }

  async function publish(promote: boolean, confirmDeadline = false) {
    if (busyRef.current) return;
    setErr('');
    for (const s of STEPS.slice(0, -1)) {
      const problem = checkStep(s);
      if (problem) { setStep(s); setBad(problem); return; }
    }
    busyRef.current = true;
    setBusy(promote ? 'promote-publish' : 'publish');
    try {
      const listingId = await persist();
      if (!listingId) return;
      if (live) { onPublished('Listing saved'); return; }
      const r = await publishListing(listingId, false, confirmDeadline);
      if (r.ok) {
        setAskDeadline(null);
        if (promote) { setPhase('promote'); return; }
        onPublished('Your listing is live');
        return;
      }
      if (r.code === 'confirm_deadline') { setAskDeadline({ message: r.message, promote }); return; }
      if (r.code === 'short' || (typeof r.need_credits === 'number' && r.need_credits > 0)) {
        onShort({
          need: r.need_credits ?? 1,
          retry: () => publishListing(listingId, true, confirmDeadline),
          okMessage: () => 'Your listing is live',
        });
        return;
      }
      showRefusal(r);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function uploadLogo(file: File) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy('logo');
    setBad(null);
    try {
      const client = await getFreshAuthedClient();
      if (!client) { setBad({ field: 'ext_logo_url', message: 'Your session has ended. Sign in again to upload a logo' }); return; }
      if (!assetId.current) assetId.current = crypto.randomUUID();
      const res = await uploadConferenceAsset(client, 'logos', assetId.current, file);
      if (res.error || !res.url) { setBad({ field: 'ext_logo_url', message: res.error || 'We could not upload this image. Try another one' }); return; }
      set('ext_logo_url', res.url);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  // ── The promotion step, in this same pop-up ──
  if (phase === 'promote' && id) {
    return (
      <PurchaseShell tone="light" label="Promote your listing" onClose={() => onPublished('Your listing is live')} panelClass="gv-st-pop gv-pr-pop" testId="job-standalone-promote">
        <style>{PURCHASE_CSS}</style>
        <PromoteContent
          listingId={id}
          listingTitle={draft.title}
          conferenceCredits={balance ?? 0}
          payer="you"
          heading="Your listing is live"
          onClose={() => onPublished('Your listing is live')}
          onDone={onPromoted}
          onShort={(req) => onShort({ ...req, okMessage: (a) => `Promoted until ${dayLabel(typeof a.ends_on === 'string' ? a.ends_on : null)}` })}
        />
      </PurchaseShell>
    );
  }

  const isBusy = busy !== null;
  const markOf = (field: string) => (bad && bad.field === field ? bad.message : null);
  const credits = price === null ? null : `${price} ${price === 1 ? 'credit' : 'credits'}`;
  const preview: JobCardData = {
    id: id ?? 'preview', kind: 'outside', title: draft.title.trim() || 'Your listing title', role: draft.role ?? 'chair',
    committee: null, committee_id: null, offers: draft.offers, promoted: false, premium: false,
    standalone: true, closes_at: draft.deadline || null, urgency: null, published_at: null,
    conference: {
      id: 'preview', slug: null, short: draft.ext_acronym.trim() || null, name: draft.ext_name.trim() || null,
      logo_url: draft.ext_logo_url || null, verified: false, city: draft.ext_city.trim() || null, country: draft.ext_country || null,
      format: draft.ext_format || null, level: draft.ext_level || null, start_date: draft.ext_start || null, end_date: draft.ext_end || null,
      theme: null, website: draft.ext_website.trim() || null,
    },
  };

  return (
    <PurchaseShell tone="light" label={listing ? 'Edit your listing' : 'Post a listing'} onClose={onClose} panelClass="gv-st-pop gv-jp" testId="job-standalone-posting">
      <style>{PURCHASE_CSS}{STANDALONE_CSS}</style>
      <div className="gv-jp-col">
        {phase === 'checking' && (
          <div aria-busy="true" aria-label="Loading" className="gv-jp-skelcol">
            <span className="gv-jp-skel" style={{ height: 30, width: '60%' }} />
            <span className="gv-jp-skel" style={{ height: 64 }} />
            <span className="gv-jp-skel" style={{ height: 64 }} />
          </div>
        )}

        {phase === 'ask' && (
          <>
            <header className="gv-jp-head">
              <h2 className="gv-jp-title">Is this for a conference on Gavelling?</h2>
              <p className="gv-jp-line gv-jp-soft" style={{ marginTop: 8 }}>Post it from that conference&rsquo;s Job Board, where listings that apply on Gavelling are free</p>
            </header>
            <ul className="gv-jp-confs">
              {orgConfs.map((c) => (
                <li key={c.id}>
                  <Link href={`/manage/${c.slug}/jobs`} className="gv-jp-conf">
                    <span className="gv-jp-conf-short">{c.acronym || c.full_name}</span>
                    {c.acronym && c.full_name && c.full_name !== c.acronym && <span className="gv-jp-conf-full">{c.full_name}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="gv-jp-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="gv-jp-second" onClick={() => setPhase('steps')}>No, another conference</button>
            </div>
          </>
        )}

        {phase === 'steps' && (
          <>
            <header className="gv-jp-head">
              <div className="gv-jp-headrow">
                {(index > 0 || (!listing && orgConfs.length > 0)) && (
                  <button
                    type="button"
                    className="gv-jp-back"
                    onClick={() => { if (index > 0) void go(STEPS[index - 1]); else setPhase('ask'); }}
                    disabled={isBusy}
                    aria-label="Back"
                  >
                    <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
                  </button>
                )}
                <p className="gv-jp-count">Step {index + 1} of {STEPS.length}</p>
              </div>
              <h2 className="gv-jp-title">{STEP_TITLE[step]}</h2>
              {reached && (
                <nav className="gv-jp-steps" aria-label="Steps">
                  {STEPS.map((s) => (
                    <button key={s} type="button" aria-current={s === step ? 'step' : undefined} className={`gv-jp-stepbtn${s === step ? ' gv-jp-stepbtn-on' : ''}`} onClick={() => { void go(s); }} disabled={isBusy}>
                      {STEP_SHORT[s]}
                    </button>
                  ))}
                </nav>
              )}
            </header>

            {live && fixLine && (step === 'conference' || step === 'role') && (
              <p className="gv-jp-note">You have one free fix until {fixLine}</p>
            )}
            {fixed && (step === 'conference' || step === 'role') && (
              <p className="gv-jp-line gv-jp-soft">The role, title, link, conference details and dates are fixed now that the listing is posted</p>
            )}

            {/* ── 1 About the Conference ── */}
            {step === 'conference' && (
              <>
                <div className="gv-jp-two">
                  <TextField label="Conference name" value={draft.ext_name} onChange={(v) => set('ext_name', v)} max={120} placeholder="Harvard Model United Nations" bad={markOf('ext_name')} disabled={fixed} />
                  <TextField label="Short name" value={draft.ext_acronym} onChange={(v) => set('ext_acronym', v)} max={20} placeholder="HMUN" bad={markOf('ext_acronym')} disabled={fixed} />
                </div>
                <div className="gv-jp-two">
                  <TextField label="City" value={draft.ext_city} onChange={(v) => set('ext_city', v)} max={80} placeholder="Boston" bad={markOf('ext_city')} disabled={fixed} />
                  <div className="gv-jp-field">
                    <span className="gv-jp-label">Country</span>
                    {fixed ? (
                      <input className="gv-jp-input" value={draft.ext_country} disabled readOnly aria-label="Country" />
                    ) : (
                      <CountryField
                        value={draft.ext_country}
                        onChange={(v) => set('ext_country', v)}
                        placeholder="Start typing a country"
                        ariaLabel="Country"
                        id="gv-jp-country"
                        invalid={!!markOf('ext_country')}
                        circleFlag
                      />
                    )}
                    {markOf('ext_country') && <span role="alert" className="gv-jp-err">{markOf('ext_country')}</span>}
                  </div>
                </div>
                <Segments label="Format" options={FORMATS} value={draft.ext_format} onChange={(v) => set('ext_format', v)} bad={markOf('ext_format')} disabled={fixed} />
                <Segments label="Who it is for" options={LEVELS} value={draft.ext_level} onChange={(v) => set('ext_level', v)} bad={markOf('ext_level')} disabled={fixed} />
                <div className="gv-jp-two">
                  <div className="gv-jp-field">
                    <span className="gv-jp-label">First day</span>
                    <DatePicker value={draft.ext_start} onChange={(v) => set('ext_start', v)} futureOnly disabled={fixed} invalid={!!markOf('ext_start')} placeholder="Choose a day" />
                    {markOf('ext_start') && <span role="alert" className="gv-jp-err">{markOf('ext_start')}</span>}
                  </div>
                  <div className="gv-jp-field">
                    <span className="gv-jp-label">Last day</span>
                    <DatePicker value={draft.ext_end} onChange={(v) => set('ext_end', v)} futureOnly min={draft.ext_start || undefined} disabled={fixed} invalid={!!markOf('ext_end')} placeholder="Choose a day" />
                    {markOf('ext_end') && <span role="alert" className="gv-jp-err">{markOf('ext_end')}</span>}
                  </div>
                </div>
                <div className="gv-jp-field">
                  <span className="gv-jp-label">Logo (optional)</span>
                  <div className="gv-jp-logo">
                    {draft.ext_logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.ext_logo_url} alt="" className="gv-jp-logo-img" />
                    ) : (
                      <span className="gv-jp-logo-img gv-jp-logo-empty" aria-hidden><ImagePlus size={22} strokeWidth={2} /></span>
                    )}
                    {!fixed && (
                      <>
                        <button type="button" className="gv-jp-second gv-jp-small" onClick={() => logoInput.current?.click()} disabled={isBusy} aria-busy={busy === 'logo' || undefined}>
                          {busy === 'logo' ? 'Uploading' : draft.ext_logo_url ? 'Change logo' : 'Upload a logo'}
                        </button>
                        {draft.ext_logo_url && busy !== 'logo' && (
                          <button type="button" className="gv-jp-a" onClick={() => set('ext_logo_url', '')} disabled={isBusy}>Remove</button>
                        )}
                        <input
                          ref={logoInput}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          hidden
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadLogo(f); }}
                        />
                      </>
                    )}
                  </div>
                  {markOf('ext_logo_url') && <span role="alert" className="gv-jp-err">{markOf('ext_logo_url')}</span>}
                </div>
                <TextField label="Website (optional)" value={draft.ext_website} onChange={(v) => set('ext_website', v)} max={300} placeholder="https://" bad={markOf('ext_website')} disabled={fixed} url />
              </>
            )}

            {/* ── 2 About the Role ── */}
            {step === 'role' && (
              <>
                <div className="gv-jp-roles" role="radiogroup" aria-label="Role">
                  {(['chair', 'secretariat', 'staff'] as JobRole[]).map((r) => {
                    const Icon = ROLE_ICON[r];
                    return (
                      <div key={r} className={`gv-jp-role${draft.role === r ? ' gv-jp-role-on' : ''}${fixed && draft.role !== r ? ' gv-jp-role-off' : ''}`}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={draft.role === r}
                          aria-disabled={fixed || undefined}
                          onClick={() => { if (!fixed) set('role', r); }}
                          className="gv-jp-role-btn"
                        >
                          <span className="gv-jp-role-disc" aria-hidden><Icon size={22} strokeWidth={2} /></span>
                          <span className="gv-jp-role-name">{JOB_ROLE_LABEL[r]}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {markOf('role') && <p role="alert" className="gv-jp-err">{markOf('role')}</p>}
                <TextField label="Title" value={draft.title} onChange={(v) => set('title', v)} max={80} placeholder="UNSC Chair" bad={markOf('title')} disabled={fixed} count />
                <label className="gv-jp-field">
                  <span className="gv-jp-label">Description</span>
                  <textarea
                    className={`gv-jp-input gv-jp-area${markOf('description') ? ' gv-jp-input-bad' : ''}`}
                    value={draft.description}
                    maxLength={4000}
                    rows={8}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="What the role involves, who you are looking for, and what they get"
                    aria-invalid={!!markOf('description') || undefined}
                  />
                  <span className="gv-jp-hint">{draft.description.length.toLocaleString('en-US')} of 4,000</span>
                  {markOf('description') && <span role="alert" className="gv-jp-err">{markOf('description')}</span>}
                </label>
                <TextField label="Where do people apply?" value={draft.outside_url} onChange={(v) => set('outside_url', v)} max={500} placeholder="https://" bad={markOf('outside_url')} disabled={fixed} url />
              </>
            )}

            {/* ── 3 What You Offer ── */}
            {step === 'offers' && (
              <>
                <div className="gv-jp-offers" role="group" aria-label="What you offer">
                  {JOB_OFFER_ORDER.map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={!!draft.offers[k]}
                      className={`gv-jp-offer${draft.offers[k] ? ' gv-jp-offer-on' : ''}`}
                      onClick={() => set('offers', { ...draft.offers, [k]: !draft.offers[k] })}
                    >
                      {JOB_OFFER_LABEL[k]}
                    </button>
                  ))}
                </div>
                {draft.offers.paid && (
                  <label className="gv-jp-field" style={{ maxWidth: 260 }}>
                    <span className="gv-jp-label">Amount (optional)</span>
                    <input
                      className={`gv-jp-input${markOf('paid_amount') || markOf('offers') ? ' gv-jp-input-bad' : ''}`}
                      value={draft.offers.paid_amount ?? ''}
                      maxLength={20}
                      onChange={(e) => set('offers', { ...draft.offers, paid_amount: e.target.value })}
                      placeholder="$200"
                    />
                  </label>
                )}
                {(markOf('offers') || markOf('paid_amount')) && <p role="alert" className="gv-jp-err">{markOf('offers') || markOf('paid_amount')}</p>}
              </>
            )}

            {/* ── 4 Deadline ── */}
            {step === 'deadline' && (
              <>
                <div className="gv-jp-field" style={{ maxWidth: 320 }}>
                  <span className="gv-jp-label">Deadline (optional)</span>
                  <DatePicker
                    value={draft.deadline}
                    onChange={(v) => set('deadline', v)}
                    futureOnly
                    clearable={!(live && origDeadline)}
                    max={live && origDeadline ? origDeadline : undefined}
                    invalid={!!markOf('deadline')}
                    placeholder="No deadline"
                  />
                  {markOf('deadline') && <span role="alert" className="gv-jp-err">{markOf('deadline')}</span>}
                </div>
                {live && origDeadline && <p className="gv-jp-line">The deadline can only move earlier now that the listing is posted</p>}
                <p className="gv-jp-line gv-jp-soft">A listing closes at the earliest of its deadline, the conference start, or when you close it</p>
              </>
            )}

            {/* ── 5 Review ── */}
            {step === 'review' && (
              <>
                <div className="gv-jp-preview">
                  <JobCard card={preview} onSelect={() => {}} />
                  {draft.description.trim() && <p className="gv-jp-desc">{draft.description}</p>}
                </div>
                {!live && (
                  <p className="gv-jp-line">
                    {credits ? `Posting costs ${credits} from your credits.` : 'Posting is paid from your credits.'} After posting, the role, title, link, conference details and dates are fixed, with one free fix in the first 24 hours
                  </p>
                )}
                {askDeadline && (
                  <div className="gv-jp-ask" role="group" aria-label="Is this really the application deadline?">
                    <p className="gv-jp-ask-q">Is this really the application deadline?</p>
                    <p className="gv-jp-line">{askDeadline.message}</p>
                    <div className="gv-jp-actions" style={{ justifyContent: 'flex-start' }}>
                      <button type="button" className="gv-jp-main" disabled={isBusy} onClick={() => { void publish(askDeadline.promote, true); }}>Yes, publish</button>
                      <button type="button" className="gv-jp-second" disabled={isBusy} onClick={() => { setAskDeadline(null); setStep('conference'); }}>Change the dates</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {err && <p role="alert" className="gv-jp-err gv-jp-err-block">{err}</p>}

            {!askDeadline && (
              <div className="gv-jp-actions">
                {step !== 'review' ? (
                  <button type="button" className="gv-jp-main" onClick={() => { void go(STEPS[index + 1]); }} disabled={isBusy} aria-busy={busy === 'save' || undefined}>
                    {busy === 'save' ? 'Saving' : 'Continue'}
                  </button>
                ) : live ? (
                  <button type="button" className="gv-jp-main" onClick={() => { void publish(false); }} disabled={isBusy} aria-busy={isBusy || undefined}>
                    {isBusy ? 'Saving' : 'Save changes'}
                  </button>
                ) : (
                  <>
                    <button type="button" className="gv-jp-second" onClick={() => { void publish(true); }} disabled={isBusy} aria-busy={busy === 'promote-publish' || undefined}>
                      {busy === 'promote-publish' ? 'Posting' : 'Post and promote'}
                    </button>
                    <button type="button" className="gv-jp-main" onClick={() => { void publish(false); }} disabled={isBusy} aria-busy={busy === 'publish' || undefined}>
                      {busy === 'publish' ? 'Posting' : credits ? `Post for ${credits}` : 'Post'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PurchaseShell>
  );
}

function TextField({ label, value, onChange, max, placeholder, bad, disabled, url, count }: {
  label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string;
  bad: string | null; disabled?: boolean; url?: boolean; count?: boolean;
}) {
  return (
    <label className="gv-jp-field">
      <span className="gv-jp-label">{label}</span>
      <input
        className={`gv-jp-input${bad ? ' gv-jp-input-bad' : ''}`}
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={url ? 'url' : undefined}
        autoComplete={url ? 'url' : 'off'}
        aria-invalid={!!bad || undefined}
      />
      {count && <span className="gv-jp-hint">{value.length} of {max}</span>}
      {bad && <span role="alert" className="gv-jp-err">{bad}</span>}
    </label>
  );
}

function Segments({ label, options, value, onChange, bad, disabled }: {
  label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
  bad: string | null; disabled?: boolean;
}) {
  return (
    <div className="gv-jp-field">
      <span className="gv-jp-label">{label}</span>
      <div className={`gv-jp-seg${bad ? ' gv-jp-seg-bad' : ''}`} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={disabled}
            className={`gv-jp-segbtn${value === o.value ? ' gv-jp-segbtn-on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {bad && <span role="alert" className="gv-jp-err">{bad}</span>}
    </div>
  );
}

// The organizer posting pop-up's look (PostingPopup.tsx POSTING_CSS), copied
// because that file exports no styles, plus what the standalone steps add.
const STANDALONE_CSS = `
.gv-buy-panel.gv-jp{max-width:780px;min-height:0}
.gv-buy-panel.gv-jp .gv-buy-body{display:block}
.gv-jp-col{display:flex;flex-direction:column;gap:18px;padding:30px 32px 26px;font-family:${FONT};color:${INK}}
.gv-jp-head{padding-right:44px}
.gv-jp-headrow{display:flex;align-items:center;gap:10px;min-height:36px}
.gv-jp-back{width:36px;height:36px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:${FOREST};background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 2px 6px rgba(27,56,40,0.14)}
.gv-jp-count{margin:0;font-size:13px;font-weight:700;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-jp-title{margin:6px 0 0;font-size:clamp(24px,2.6vw,30px);font-weight:800;letter-spacing:-0.02em;line-height:1.12;color:${INK};text-wrap:balance}
.gv-jp-steps{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.gv-jp-stepbtn{min-height:32px;padding:0 12px;border-radius:9999px;border:1px solid rgba(28,20,16,0.14);background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-jp-stepbtn-on{border-color:${FOREST};color:${FOREST};background:#EEF3EC;font-weight:700}
.gv-jp-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:600px){.gv-jp-two{grid-template-columns:1fr}}
.gv-jp-roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:600px){.gv-jp-roles{grid-template-columns:1fr}}
.gv-jp-role{display:flex;flex-direction:column;gap:6px}
.gv-jp-role-btn{display:flex;flex-direction:column;align-items:flex-start;gap:12px;width:100%;min-height:108px;padding:16px;border-radius:16px;border:1.5px solid rgba(28,20,16,0.12);background:#FFFFFF;cursor:pointer;font-family:${FONT};text-align:left;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.06);transition:border-color 140ms ease,box-shadow 140ms ease}
.gv-jp-role-btn:hover{border-color:rgba(27,56,40,0.4)}
.gv-jp-role-on .gv-jp-role-btn{border-color:${FOREST};box-shadow:inset 0 0 0 1px ${FOREST},0 6px 18px rgba(27,56,40,0.12)}
.gv-jp-role-off .gv-jp-role-btn{cursor:not-allowed;opacity:0.55}
.gv-jp-role-disc{width:44px;height:44px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;color:${FOREST};background:rgba(238,217,138,0.55)}
.gv-jp-role-name{font-size:17px;font-weight:700;color:${INK}}
.gv-jp-field{display:flex;flex-direction:column;gap:6px;border:none;margin:0;padding:0;min-width:0}
.gv-jp-label{font-size:14px;font-weight:700;color:${INK};padding:0}
.gv-jp-hint{font-size:12.5px;color:${INK_SOFT};font-variant-numeric:tabular-nums;align-self:flex-end}
.gv-jp-input{width:100%;min-height:46px;padding:10px 14px;border-radius:12px;border:1.5px solid rgba(28,20,16,0.14);background:#FFFFFF;font-family:${FONT};font-size:15.5px;color:${INK}}
.gv-jp-input:focus{outline:none;border-color:${FOREST};box-shadow:inset 0 0 0 1px ${FOREST}}
.gv-jp-input:disabled{background:#F6F3EC;color:${INK_SOFT};cursor:not-allowed}
.gv-jp-input-bad{border-color:${DANGER}}
.gv-jp-area{min-height:180px;line-height:1.55;resize:vertical}
.gv-jp-offers{display:flex;flex-wrap:wrap;gap:10px}
.gv-jp-offer{min-height:44px;padding:0 16px;border-radius:9999px;border:1.5px solid rgba(28,20,16,0.16);background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:14.5px;font-weight:600;color:${INK}}
.gv-jp-offer-on{border-color:${FOREST};background:#EEF3EC;color:${FOREST};font-weight:700}
.gv-jp-seg{display:inline-flex;flex-wrap:wrap;align-self:flex-start;padding:3px;border-radius:12px;background:#F3EFE6}
.gv-jp-seg-bad{box-shadow:0 0 0 1.5px ${DANGER}}
.gv-jp-segbtn{min-height:40px;padding:0 16px;border:none;border-radius:9px;background:transparent;cursor:pointer;font-family:${FONT};font-size:14px;font-weight:600;color:${INK_SOFT}}
.gv-jp-segbtn-on{background:#FFFFFF;color:${INK};font-weight:700;box-shadow:0 1px 4px rgba(27,56,40,0.14)}
.gv-jp-segbtn:disabled{cursor:not-allowed}
.gv-jp-seg:has(.gv-jp-segbtn:disabled) .gv-jp-segbtn:not(.gv-jp-segbtn-on){opacity:0.5}
.gv-jp-logo{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.gv-jp-logo-img{width:56px;height:56px;border-radius:14px;object-fit:contain;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.08)}
.gv-jp-logo-empty{display:inline-flex;align-items:center;justify-content:center;color:${INK_SOFT}}
.gv-jp-small{min-height:42px;padding:0 16px;font-size:14px}
.gv-jp-confs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.gv-jp-conf{display:flex;flex-direction:column;gap:2px;padding:14px 16px;border-radius:16px;background:#FFFFFF;text-decoration:none;color:${INK};box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.07);border:1.5px solid transparent;transition:border-color 140ms ease}
.gv-jp-conf:hover{border-color:rgba(27,56,40,0.4)}
.gv-jp-conf-short{font-size:17px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.gv-jp-conf-full{font-size:13.5px;line-height:1.4;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-jp-note{margin:0;padding:10px 14px;border-radius:12px;background:rgba(238,217,138,0.32);font-size:14.5px;font-weight:600;color:#4A3410}
.gv-jp-line{margin:0;font-size:14.5px;line-height:1.55;color:#3E352C}
.gv-jp-soft{color:${INK_SOFT}}
.gv-jp-preview{display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:18px;background:#EDE7D8}
.gv-jp-desc{margin:0;padding:16px 18px;border-radius:16px;background:#FFFFFF;font-size:14.5px;line-height:1.6;color:#2E271F;white-space:pre-line;overflow-wrap:anywhere;max-height:260px;overflow-y:auto}
.gv-jp-ask{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;background:rgba(238,217,138,0.28)}
.gv-jp-ask-q{margin:0;font-size:16px;font-weight:800;color:${INK}}
.gv-jp-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px;margin-top:4px}
.gv-jp-main{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border:none;border-radius:11px;cursor:pointer;font-family:${FONT};font-size:15.5px;font-weight:700;color:#FFFFFF;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);box-shadow:0 6px 16px rgba(27,56,40,0.22)}
.gv-jp-main:disabled{opacity:0.65;cursor:default}
.gv-jp-second{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 20px;border-radius:11px;border:1.5px solid ${INK};background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK}}
.gv-jp-second:disabled{opacity:0.6;cursor:default}
.gv-jp-a{background:none;border:none;padding:0;cursor:pointer;font-family:${FONT};font-size:14px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-jp-err{margin:0;font-size:13.5px;line-height:1.45;color:${DANGER}}
.gv-jp-err-block{padding:10px 12px;border-radius:12px;background:rgba(158,42,18,0.07)}
.gv-jp-skelcol{display:flex;flex-direction:column;gap:14px}
.gv-jp-skel{display:block;width:100%;border-radius:14px;background:rgba(28,20,16,0.08);animation:gvJpPulse 1.2s ease-in-out infinite}
@keyframes gvJpPulse{0%,100%{opacity:1}50%{opacity:0.55}}
@media (prefers-reduced-motion:reduce){.gv-jp-skel{animation:none}}
.gv-jp :is(button,input,textarea,a):focus{outline:none}
.gv-jp :is(button,input,textarea,a):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (max-width:743px){
  .gv-jp-col{padding:calc(20px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom))}
  .gv-jp-main,.gv-jp-second{flex:1 1 auto}
}
`;
