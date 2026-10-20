'use client';

// ── Post a listing (organizer Job Board) ───────────────────────────────────
//
// The Store pop-up shell, ONE pop-up whose steps replace each other with a
// back arrow (never a pop-up on a pop-up):
//   1 Role          Chair / Secretariat / Staff, and how people apply
//   2 The listing   title, committee, description (prefilled), posted by
//   3 What You Offer
//   4 Screening Questions   (On Gavelling only)
//   5 Deadline
//   6 Review        a JobCard preview, then Publish / Publish and promote
//   then, after "Publish and promote", the promotion step in the same pop-up.
// The draft is saved (job_listing_save, only the changed keys) when leaving
// step 2 and every step after it, so closing half way keeps a Draft. Edit
// opens on Review with every step reachable. A refusal that names a field
// jumps back to its step and marks the field. Short on credits closes this
// pop-up first and hands the retry to the page (useJobTopUp).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowLeft, ArrowUp, Briefcase, Gavel, Globe, Landmark, Plus, Trash2, Users,
} from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import GSelect from '@/components/GSelect';
import { DatePicker } from '@/components/DatePicker';
import { JOB_OFFER_LABEL, JOB_OFFER_ORDER, JOB_ROLE_LABEL, type JobCard as JobCardData, type JobOffers, type JobRole } from '@/lib/jobBoard';
import JobCard from '@/app/jobs/JobCard';
import {
  draftDescription, publishListing, saveListing, dayLabel, ROLE_PLURAL,
  type JobPanel, type ListingPatch, type OrgListing, type OrgQuestion, type Refusal,
} from './jobsApi';
import { PromoteContent } from './PromotePopup';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const DANGER = '#9E2A12';

type Step = 'role' | 'listing' | 'offers' | 'questions' | 'deadline' | 'review';
type Kind = 'gavelling' | 'outside';

const STEP_TITLE: Record<Step, string> = {
  role: 'Choose a Role',
  listing: 'About the Listing',
  offers: 'What You Offer',
  questions: 'Screening Questions',
  deadline: 'Deadline',
  review: 'Review',
};
const STEP_SHORT: Record<Step, string> = {
  role: 'Role', listing: 'Listing', offers: 'Offers', questions: 'Questions', deadline: 'Deadline', review: 'Review',
};

/** Which step owns each field the server can name. */
const FIELD_STEP: Record<string, Step> = {
  kind: 'role', role: 'role', outside_url: 'role',
  title: 'listing', committee_id: 'listing', description: 'listing', poster_user_id: 'listing',
  offers: 'offers', paid_amount: 'offers',
  questions: 'questions', auto_reject: 'questions',
  deadline: 'deadline',
};

const ROLE_ICON: Record<JobRole, typeof Gavel> = { chair: Gavel, secretariat: Landmark, staff: Users };
export const NO_OFFERS: JobOffers = { paid: false, paid_amount: null, accommodation: false, travel: false, certificate: false, letter: false };
const MAX_QUESTIONS = 5;
const LINK_RE = /(https?:\/\/|www\.)/i;

export interface PostingConference {
  id: string; slug: string; acronym: string; full_name: string; logo_url: string | null; is_verified: boolean;
  city: string | null; country: string | null; format: string | null; student_level: string | null;
  start_date: string | null; end_date: string | null;
}

export interface ShortRequest {
  need: number;
  retry: () => Promise<{ ok: true } | Refusal>;
  okMessage: (answer: Record<string, unknown>) => string;
}

interface Draft {
  kind: Kind;
  role: JobRole | null;
  outside_url: string;
  title: string;
  committee_id: string;
  description: string;
  poster_user_id: string;
  offers: JobOffers;
  questions: OrgQuestion[];
  auto_reject: boolean;
  deadline: string;
}

function draftOf(l: OrgListing | null, myUserId: string | null, panel: JobPanel): Draft {
  const me = myUserId && panel.organizers.some((o) => o.user_id === myUserId) ? myUserId : panel.organizers[0]?.user_id ?? '';
  if (!l) {
    return {
      kind: 'gavelling', role: null, outside_url: '', title: '', committee_id: '', description: '',
      poster_user_id: me, offers: { ...NO_OFFERS }, questions: [], auto_reject: false, deadline: '',
    };
  }
  return {
    kind: l.kind === 'outside' ? 'outside' : 'gavelling',
    role: l.role,
    outside_url: l.outside_url ?? '',
    title: l.title ?? '',
    committee_id: l.committee_id ?? '',
    description: l.description ?? '',
    poster_user_id: l.poster_user_id ?? me,
    offers: { ...NO_OFFERS, ...(l.offers ?? {}) },
    questions: (l.questions ?? []).map((q) => ({ ...q, options: Array.isArray(q.options) ? q.options : [], ideal: q.ideal ?? null, essential: !!q.essential })),
    auto_reject: !!l.auto_reject,
    deadline: l.deadline ? l.deadline.slice(0, 10) : '',
  };
}

/** The keys of a draft as job_listing_save takes them. */
function patchOf(d: Draft): Required<Omit<ListingPatch, 'id' | 'conference_id'>> {
  return {
    kind: d.kind,
    role: (d.role ?? 'chair') as JobRole,
    committee_id: d.committee_id || null,
    title: d.title.trim(),
    description: d.description,
    offers: { ...d.offers, paid_amount: d.offers.paid ? (d.offers.paid_amount?.trim() || null) : null },
    questions: d.kind === 'gavelling' ? d.questions.map((q) => ({
      ...q,
      text: q.text.trim(),
      options: q.type === 'choice' ? q.options.map((o) => o.trim()) : [],
      ideal: q.type === 'text' ? null : q.ideal,
      essential: q.type === 'text' ? false : q.essential,
    })) : [],
    auto_reject: d.kind === 'gavelling' ? d.auto_reject : false,
    deadline: d.deadline || null,
    outside_url: d.kind === 'outside' ? d.outside_url.trim() || null : null,
    poster_user_id: d.poster_user_id || null,
  };
}

function nextQuestionId(qs: OrgQuestion[]): string {
  const n = qs.reduce((m, q) => Math.max(m, parseInt(q.id.replace(/\D/g, ''), 10) || 0), 0);
  return `q${n + 1}`;
}

export default function PostingPopup({
  conference, panel, listing, myUserId, onClose, onSaved, onPublished, onShort, onPromoted,
}: {
  conference: PostingConference;
  panel: JobPanel;
  /** An existing listing to edit; null posts a new one. */
  listing: OrgListing | null;
  myUserId: string | null;
  onClose: () => void;
  /** A draft or an edit landed: the page reads the panel again. */
  onSaved: () => void;
  /** Published (or a live listing saved): the page closes this, toasts and reads again. */
  onPublished: (message: string) => void;
  /** Short on credits: the page closes this pop-up, then buys and retries. */
  onShort: (req: ShortRequest) => void;
  /** Promoted from the last step. */
  onPromoted: (endsOn: string | null) => void;
}) {
  const [id, setId] = useState<string | null>(listing?.id ?? null);
  const [shown] = useState(listing?.shown ?? 'draft');
  const [draft, setDraft] = useState<Draft>(() => draftOf(listing, myUserId, panel));
  const [saved, setSaved] = useState<ReturnType<typeof patchOf> | null>(() => (listing ? patchOf(draftOf(listing, myUserId, panel)) : null));
  const [step, setStep] = useState<Step>(listing ? 'review' : 'role');
  const [mode, setMode] = useState<'steps' | 'promote'>('steps');
  const [bad, setBad] = useState<{ field: string; message: string } | null>(null);
  const [err, setErr] = useState<React.ReactNode>('');
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'promote-publish'>(null);
  const [askDeadline, setAskDeadline] = useState<{ message: string; promote: boolean } | null>(null);
  const [reached, setReached] = useState<boolean>(!!listing);
  const busyRef = useRef(false);
  const prefilled = useRef(false);

  const steps: Step[] = useMemo(
    () => (draft.kind === 'gavelling' ? ['role', 'listing', 'offers', 'questions', 'deadline', 'review'] : ['role', 'listing', 'offers', 'deadline', 'review']),
    [draft.kind],
  );
  const index = Math.max(0, steps.indexOf(step));
  const set = useCallback(<K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setBad((b) => (b && (b.field === k || FIELD_STEP[b.field] === FIELD_STEP[k as string]) ? null : b));
  }, []);

  const roleRow = panel.roles.find((r) => r.role === draft.role) ?? null;
  const roleCloses = roleRow?.closes_at ? roleRow.closes_at.slice(0, 10) : null;
  const outsidePrice = panel.prices.outside_listing;
  const committeeName = panel.committees.find((c) => c.id === draft.committee_id)?.name ?? null;

  // The description is prefilled from the conference page when the listing step opens empty.
  useEffect(() => {
    if (step !== 'listing' || prefilled.current || draft.description.trim() || !draft.role) return;
    prefilled.current = true;
    const role = draft.role;
    void draftDescription(conference.id, role, draft.committee_id || null).then((text) => {
      if (!text) return;
      setDraft((d) => (d.description.trim() ? d : { ...d, description: text }));
    });
  }, [step, draft.description, draft.role, draft.committee_id, conference.id]);

  // ── Checks done here first, so the server rarely has to refuse ──
  function checkStep(s: Step): { field: string; message: string } | null {
    if (s === 'role') {
      if (!draft.role) return { field: 'role', message: 'Choose a role' };
      if (draft.kind === 'gavelling' && roleRow && !roleRow.enabled) return { field: 'role', message: 'Applications for this role are off. Turn them on in Settings, or apply on another site' };
      if (draft.kind === 'outside') {
        const u = draft.outside_url.trim();
        if (!u) return { field: 'outside_url', message: 'Add the link where people apply' };
        if (!/^https:\/\/[^\s.]+\.[^\s]+$/i.test(u)) return { field: 'outside_url', message: 'Use a full link that starts with https://' };
      }
    }
    if (s === 'listing') {
      const t = draft.title.trim();
      if (!t) return { field: 'title', message: 'Give the listing a title' };
      if (t.length > 80) return { field: 'title', message: 'Keep the title to 80 characters' };
      if (LINK_RE.test(t)) return { field: 'title', message: 'A title cannot hold a link' };
      if (draft.description.length > 4000) return { field: 'description', message: 'Keep the description to 4,000 characters' };
    }
    if (s === 'questions' && draft.kind === 'gavelling') {
      for (const q of draft.questions) {
        if (!q.text.trim()) return { field: `question:${q.id}`, message: 'Write the question, or remove it' };
        if (q.type === 'choice') {
          const opts = q.options.map((o) => o.trim());
          if (opts.length < 2 || opts.some((o) => !o)) return { field: `question:${q.id}`, message: 'A choice question needs 2 to 6 filled-in options' };
        }
      }
    }
    if (s === 'deadline' && draft.deadline && draft.kind === 'gavelling' && roleCloses && draft.deadline > roleCloses) {
      return { field: 'deadline', message: `The deadline can't be after ${dayLabel(roleCloses)}, when applications for ${ROLE_PLURAL[draft.role ?? 'chair']} close` };
    }
    return null;
  }

  /** Refusal from the server: jump to the field's step and mark it. */
  const showRefusal = useCallback((r: Refusal) => {
    const f = r.field;
    if (f) {
      const target = FIELD_STEP[f] ?? (f.startsWith('question') ? 'questions' : null);
      if (target) {
        setStep(target);
        setBad({ field: f, message: r.message });
        return;
      }
    }
    if (r.code === 'role_off') {
      setErr(<>{r.message} <Link href={`/manage/${conference.slug}/settings?tab=applications`} className="gv-jp-a">Open Settings</Link></>);
      return;
    }
    setErr(r.message);
  }, [conference.slug]);

  /** Saves the changed keys (or creates the draft). Returns the id, or null after a refusal. */
  const persist = useCallback(async (): Promise<string | null> => {
    const now = patchOf(draft);
    let body: ListingPatch;
    if (!id) {
      body = { conference_id: conference.id, ...now };
    } else {
      const changed: ListingPatch = { id };
      (Object.keys(now) as (keyof typeof now)[]).forEach((k) => {
        if (!saved || JSON.stringify(now[k]) !== JSON.stringify(saved[k])) (changed as Record<string, unknown>)[k] = now[k];
      });
      if (Object.keys(changed).length === 1) return id;
      body = changed;
    }
    const r = await saveListing(body);
    if (!r.ok) { showRefusal(r); return null; }
    setId(r.id);
    setSaved(now);
    onSaved();
    return r.id;
  }, [draft, id, saved, conference.id, onSaved, showRefusal]);

  async function go(to: Step) {
    if (busyRef.current) return;
    setErr('');
    const forward = steps.indexOf(to) > index;
    if (forward) {
      // Every step up to the target must hold before going past it.
      for (const s of steps.slice(index, steps.indexOf(to))) {
        const problem = checkStep(s);
        if (problem) { setStep(s); setBad(problem); return; }
      }
    }
    // From step 2 on (and on every step of an existing listing), leaving a
    // step saves the draft, so closing half way keeps it.
    if ((forward && index >= 1) || id) {
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
    for (const s of steps.slice(0, -1)) {
      const problem = checkStep(s);
      if (problem) { setStep(s); setBad(problem); return; }
    }
    busyRef.current = true;
    setBusy(promote ? 'promote-publish' : 'publish');
    try {
      const listingId = await persist();
      if (!listingId) return;
      if (shown === 'live' || shown === 'closed' || shown === 'hidden') {
        onPublished('Listing saved');
        return;
      }
      const r = await publishListing(listingId, false, confirmDeadline);
      if (r.ok) {
        setAskDeadline(null);
        if (promote && panel.can_promote) { setMode('promote'); return; }
        onPublished(r.message || 'Your listing is live');
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

  // ── The promotion step, in this same pop-up ──
  if (mode === 'promote' && id) {
    return (
      <PurchaseShell tone="light" label="Promote your listing" onClose={() => onPublished('Your listing is live')} panelClass="gv-st-pop" testId="job-promote-after-publish">
        <style>{PURCHASE_CSS}</style>
        <PromoteContent
          listingId={id}
          listingTitle={draft.title}
          conferenceCredits={panel.conference_credits}
          heading="Your listing is live"
          onClose={() => onPublished('Your listing is live')}
          onDone={onPromoted}
          onShort={(req) => onShort({ ...req, okMessage: (a) => `Promoted until ${dayLabel(typeof a.ends_on === 'string' ? a.ends_on : null)}` })}
        />
      </PurchaseShell>
    );
  }

  const live = shown !== 'draft';
  const isBusy = busy !== null;
  const markOf = (field: string) => (bad && bad.field === field ? bad.message : null);
  const preview: JobCardData = {
    id: id ?? 'preview', kind: draft.kind, title: draft.title.trim() || 'Your listing title', role: draft.role ?? 'chair',
    committee: committeeName, committee_id: draft.committee_id || null, offers: draft.offers, promoted: false, premium: false,
    standalone: false, closes_at: draft.deadline || roleCloses, urgency: null, published_at: null,
    conference: {
      id: conference.id, slug: conference.slug, short: conference.acronym, name: conference.full_name, logo_url: conference.logo_url,
      verified: conference.is_verified, city: conference.city, country: conference.country, format: conference.format,
      level: conference.student_level, start_date: conference.start_date, end_date: conference.end_date, theme: null, website: null,
    },
  };

  return (
    <PurchaseShell tone="light" label={listing ? 'Edit your listing' : 'Post a listing'} onClose={onClose} panelClass="gv-st-pop gv-jp" testId="job-posting">
      <style>{PURCHASE_CSS}{POSTING_CSS}</style>
      <div className="gv-jp-col">
        <header className="gv-jp-head">
          <div className="gv-jp-headrow">
            {index > 0 && (
              <button type="button" className="gv-jp-back" onClick={() => { void go(steps[index - 1]); }} disabled={isBusy} aria-label="Back">
                <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
              </button>
            )}
            <p className="gv-jp-count">Step {index + 1} of {steps.length}</p>
          </div>
          <h2 className="gv-jp-title">{STEP_TITLE[step]}</h2>
          {reached && (
            <nav className="gv-jp-steps" aria-label="Steps">
              {steps.map((s) => (
                <button key={s} type="button" aria-current={s === step ? 'step' : undefined} className={`gv-jp-stepbtn${s === step ? ' gv-jp-stepbtn-on' : ''}`} onClick={() => { void go(s); }} disabled={isBusy}>
                  {STEP_SHORT[s]}
                </button>
              ))}
            </nav>
          )}
        </header>

        {/* ── 1 Role ── */}
        {step === 'role' && (
          <>
            <div className="gv-jp-roles" role="radiogroup" aria-label="Role">
              {(['chair', 'secretariat', 'staff'] as JobRole[]).map((r) => {
                const row = panel.roles.find((x) => x.role === r);
                const off = !!row && !row.enabled;
                const blocked = off && draft.kind === 'gavelling';
                const Icon = ROLE_ICON[r];
                return (
                  <div key={r} className={`gv-jp-role${draft.role === r ? ' gv-jp-role-on' : ''}${blocked ? ' gv-jp-role-off' : ''}`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={draft.role === r}
                      aria-disabled={blocked || undefined}
                      onClick={() => { if (!blocked) set('role', r); }}
                      className="gv-jp-role-btn"
                    >
                      <span className="gv-jp-role-disc" aria-hidden><Icon size={22} strokeWidth={2} /></span>
                      <span className="gv-jp-role-name">{JOB_ROLE_LABEL[r]}</span>
                    </button>
                    {off && (
                      <p className="gv-jp-role-note">
                        Applications are off{' '}
                        <Link href={`/manage/${conference.slug}/settings?tab=applications`} className="gv-jp-a">Open Settings</Link>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {markOf('role') && <p role="alert" className="gv-jp-err">{markOf('role')}</p>}

            <fieldset className="gv-jp-field">
              <legend className="gv-jp-label">How do people apply?</legend>
              <div className="gv-jp-choices" role="radiogroup">
                <Choice on={draft.kind === 'gavelling'} onClick={() => set('kind', 'gavelling')} icon={Briefcase} title="On Gavelling" note="Free" />
                <Choice on={draft.kind === 'outside'} onClick={() => set('kind', 'outside')} icon={Globe} title={`On another site (${outsidePrice} ${outsidePrice === 1 ? 'credit' : 'credits'})`} />
              </div>
            </fieldset>
            {draft.kind === 'outside' && (
              <label className="gv-jp-field">
                <span className="gv-jp-label">Where do people apply?</span>
                <input
                  className={`gv-jp-input${markOf('outside_url') ? ' gv-jp-input-bad' : ''}`}
                  value={draft.outside_url}
                  onChange={(e) => set('outside_url', e.target.value)}
                  placeholder="https://"
                  inputMode="url"
                  autoComplete="url"
                  aria-invalid={!!markOf('outside_url') || undefined}
                />
                {markOf('outside_url') && <span role="alert" className="gv-jp-err">{markOf('outside_url')}</span>}
              </label>
            )}
          </>
        )}

        {/* ── 2 The listing ── */}
        {step === 'listing' && (
          <>
            <label className="gv-jp-field">
              <span className="gv-jp-label">Title</span>
              <input
                className={`gv-jp-input${markOf('title') ? ' gv-jp-input-bad' : ''}`}
                value={draft.title}
                maxLength={80}
                onChange={(e) => set('title', e.target.value)}
                placeholder="UNSC Chair"
                aria-invalid={!!markOf('title') || undefined}
              />
              <span className="gv-jp-hint">{draft.title.length} of 80</span>
              {markOf('title') && <span role="alert" className="gv-jp-err">{markOf('title')}</span>}
            </label>
            <div className="gv-jp-field">
              <span className="gv-jp-label" id="gv-jp-committee">Committee (optional)</span>
              <GSelect
                value={draft.committee_id}
                onChange={(v) => set('committee_id', v)}
                options={[{ value: '', label: 'No committee' }, ...panel.committees.map((c) => ({ value: c.id, label: c.abbreviation ? `${c.abbreviation} · ${c.name}` : c.name }))]}
                invalid={!!markOf('committee_id')}
              />
              {markOf('committee_id') && <span role="alert" className="gv-jp-err">{markOf('committee_id')}</span>}
            </div>
            <DescriptionField value={draft.description} onChange={(v) => set('description', v)} mark={markOf('description')} />
            <PosterField panel={panel} myUserId={myUserId} value={draft.poster_user_id} onChange={(v) => set('poster_user_id', v)} mark={markOf('poster_user_id')} />
          </>
        )}

        {/* ── 3 What You Offer ── */}
        {step === 'offers' && (
          <>
            <OffersEditor offers={draft.offers} onChange={(o) => set('offers', o)} mark={markOf('offers') || markOf('paid_amount')} />
          </>
        )}

        {/* ── 4 Screening Questions ── */}
        {step === 'questions' && (
          <QuestionsEditor
            questions={draft.questions}
            autoReject={draft.auto_reject}
            bad={bad}
            onChange={(qs) => set('questions', qs)}
            onAutoReject={(v) => set('auto_reject', v)}
          />
        )}

        {/* ── 5 Deadline ── */}
        {step === 'deadline' && (
          <>
            <div className="gv-jp-field" style={{ maxWidth: 320 }}>
              <span className="gv-jp-label">Deadline (optional)</span>
              <DatePicker
                value={draft.deadline}
                onChange={(v) => set('deadline', v)}
                futureOnly
                clearable
                max={draft.kind === 'gavelling' && roleCloses ? roleCloses : undefined}
                invalid={!!markOf('deadline')}
                placeholder="No deadline"
              />
              {markOf('deadline') && <span role="alert" className="gv-jp-err">{markOf('deadline')}</span>}
            </div>
            {draft.kind === 'gavelling' && roleCloses && draft.role && (
              <p className="gv-jp-line">Applications for {ROLE_PLURAL[draft.role]} close {dayLabel(roleCloses)}</p>
            )}
            <p className="gv-jp-line gv-jp-soft">A listing closes at the earliest of its deadline, the role&rsquo;s closing, the conference start, or when you close it</p>
          </>
        )}

        {/* ── 6 Review ── */}
        {step === 'review' && (
          <>
            <div className="gv-jp-preview">
              <JobCard card={preview} onSelect={() => {}} />
              {draft.description.trim() && <p className="gv-jp-desc">{draft.description}</p>}
              {draft.kind === 'gavelling' && draft.questions.length > 0 && (
                <p className="gv-jp-line gv-jp-soft">{draft.questions.length} {draft.questions.length === 1 ? 'question' : 'questions'} before people apply{draft.auto_reject ? ', with automatic rejection on Essential answers' : ''}</p>
              )}
            </div>
            {draft.kind === 'outside' && !live && (
              <p className="gv-jp-line">
                Publishing costs {outsidePrice} {outsidePrice === 1 ? 'credit' : 'credits'} from your conference credits. After publishing, the role, title, link and dates are fixed, with one free fix in the first 24 hours
              </p>
            )}
            {askDeadline && (
              <div className="gv-jp-ask" role="group" aria-label="Is this really the application deadline?">
                <p className="gv-jp-ask-q">Is this really the application deadline?</p>
                <p className="gv-jp-line">{askDeadline.message}</p>
                <div className="gv-jp-actions" style={{ justifyContent: 'flex-start' }}>
                  <button type="button" className="gv-jp-main" disabled={isBusy} onClick={() => { void publish(askDeadline.promote, true); }}>Yes, publish</button>
                  <button type="button" className="gv-jp-second" disabled={isBusy} onClick={() => { setAskDeadline(null); setStep('deadline'); }}>Change the deadline</button>
                </div>
              </div>
            )}
          </>
        )}

        {err && <p role="alert" className="gv-jp-err gv-jp-err-block">{err}</p>}

        {!askDeadline && (
          <div className="gv-jp-actions">
            {step !== 'review' ? (
              <button type="button" className="gv-jp-main" onClick={() => { void go(steps[index + 1]); }} disabled={isBusy} aria-busy={busy === 'save' || undefined}>
                {busy === 'save' ? 'Saving' : 'Continue'}
              </button>
            ) : live ? (
              <button type="button" className="gv-jp-main" onClick={() => { void publish(false); }} disabled={isBusy} aria-busy={isBusy || undefined}>
                {isBusy ? 'Saving' : 'Save changes'}
              </button>
            ) : (
              <>
                {panel.can_promote && (
                  <button type="button" className="gv-jp-second" onClick={() => { void publish(true); }} disabled={isBusy} aria-busy={busy === 'promote-publish' || undefined}>
                    {busy === 'promote-publish' ? 'Publishing' : 'Publish and promote'}
                  </button>
                )}
                <button type="button" className="gv-jp-main" onClick={() => { void publish(false); }} disabled={isBusy} aria-busy={busy === 'publish' || undefined}>
                  {busy === 'publish' ? 'Publishing' : draft.kind === 'outside' ? `Publish for ${outsidePrice} ${outsidePrice === 1 ? 'credit' : 'credits'}` : 'Publish'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </PurchaseShell>
  );
}

/** The description field (up to 4,000 characters). */
export function DescriptionField({ value, onChange, mark }: { value: string; onChange: (v: string) => void; mark: string | null }) {
  return (
    <label className="gv-jp-field">
      <span className="gv-jp-label">Description</span>
      <textarea
        className={`gv-jp-input gv-jp-area${mark ? ' gv-jp-input-bad' : ''}`}
        value={value}
        maxLength={4000}
        rows={8}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What the role involves, who you are looking for, and what they get"
        aria-invalid={!!mark || undefined}
      />
      <span className="gv-jp-hint">{value.length.toLocaleString('en-US')} of 4,000</span>
      {mark && <span role="alert" className="gv-jp-err">{mark}</span>}
    </label>
  );
}

/** Posted by: the conference's organizers, the current one first. */
export function PosterField({ panel, myUserId, value, onChange, mark }: { panel: JobPanel; myUserId: string | null; value: string; onChange: (v: string) => void; mark: string | null }) {
  return (
    <div className="gv-jp-field">
      <span className="gv-jp-label">Posted by</span>
      <GSelect
        value={value}
        onChange={onChange}
        options={[...panel.organizers]
          .sort((a, b) => (a.user_id === myUserId ? -1 : b.user_id === myUserId ? 1 : 0))
          .map((o) => ({ value: o.user_id, label: o.name || 'Organizer', hint: o.title ?? undefined }))}
        invalid={!!mark}
      />
      {mark && <span role="alert" className="gv-jp-err">{mark}</span>}
    </div>
  );
}

/** What You Offer: the chips, and Paid with an optional amount. `mark` is the offers or paid_amount refusal. */
export function OffersEditor({ offers, onChange, mark }: { offers: JobOffers; onChange: (o: JobOffers) => void; mark: string | null }) {
  return (
    <>
      <div className="gv-jp-offers" role="group" aria-label="What you offer">
        {JOB_OFFER_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={!!offers[k]}
            className={`gv-jp-offer${offers[k] ? ' gv-jp-offer-on' : ''}`}
            onClick={() => onChange({ ...offers, [k]: !offers[k] })}
          >
            {JOB_OFFER_LABEL[k]}
          </button>
        ))}
      </div>
      {offers.paid && (
        <label className="gv-jp-field" style={{ maxWidth: 260 }}>
          <span className="gv-jp-label">Amount (optional)</span>
          <input
            className={`gv-jp-input${mark ? ' gv-jp-input-bad' : ''}`}
            value={offers.paid_amount ?? ''}
            maxLength={20}
            onChange={(e) => onChange({ ...offers, paid_amount: e.target.value })}
            placeholder="$200"
          />
        </label>
      )}
      {mark && <p role="alert" className="gv-jp-err">{mark}</p>}
    </>
  );
}

export function Choice({ on, onClick, icon: Icon, title, note }: { on: boolean; onClick: () => void; icon: typeof Globe; title: string; note?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`gv-jp-choice${on ? ' gv-jp-choice-on' : ''}`}>
      <span className="gv-jp-dot" aria-hidden>{on && <span />}</span>
      <Icon size={18} strokeWidth={2.2} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
      <span className="gv-jp-choice-title">{title}</span>
      {note && <span className="gv-jp-choice-note">{note}</span>}
    </button>
  );
}

export function QuestionsEditor({ questions, autoReject, bad, onChange, onAutoReject }: {
  questions: OrgQuestion[];
  autoReject: boolean;
  bad: { field: string; message: string } | null;
  onChange: (qs: OrgQuestion[]) => void;
  onAutoReject: (v: boolean) => void;
}) {
  const edit = (i: number, patch: Partial<OrgQuestion>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const anyEssential = questions.some((q) => q.essential && q.type !== 'text');
  const fieldBad = bad && (bad.field === 'questions' || bad.field === 'auto_reject') ? bad.message : null;

  return (
    <>
      {questions.length === 0 && <p className="gv-jp-line gv-jp-soft">No questions yet. People go straight to your application</p>}
      <ol className="gv-jp-qs">
        {questions.map((q, i) => {
          const qBad = bad && (bad.field === `question:${q.id}` || bad.field === q.id) ? bad.message : null;
          return (
            <li key={q.id} className={`gv-jp-q${qBad ? ' gv-jp-q-bad' : ''}`}>
              <div className="gv-jp-q-top">
                <span className="gv-jp-q-n" aria-hidden>{i + 1}</span>
                <input
                  className="gv-jp-input"
                  value={q.text}
                  maxLength={200}
                  onChange={(e) => edit(i, { text: e.target.value })}
                  placeholder="Have you chaired before?"
                  aria-label={`Question ${i + 1}`}
                />
                <div className="gv-jp-q-tools">
                  <button type="button" className="gv-jp-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} strokeWidth={2.4} aria-hidden /></button>
                  <button type="button" className="gv-jp-icon" aria-label="Move down" disabled={i === questions.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} strokeWidth={2.4} aria-hidden /></button>
                  <button type="button" className="gv-jp-icon gv-jp-icon-danger" aria-label={`Remove question ${i + 1}`} onClick={() => onChange(questions.filter((_, j) => j !== i))}><Trash2 size={16} strokeWidth={2.4} aria-hidden /></button>
                </div>
              </div>

              <div className="gv-jp-q-row">
                <div className="gv-jp-seg" role="radiogroup" aria-label="Answer type">
                  {([['yesno', 'Yes/No'], ['choice', 'Choice'], ['text', 'Short text']] as const).map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={q.type === t}
                      className={`gv-jp-segbtn${q.type === t ? ' gv-jp-segbtn-on' : ''}`}
                      onClick={() => edit(i, {
                        type: t,
                        options: t === 'choice' ? (q.options.length >= 2 ? q.options : ['', '']) : [],
                        ideal: null,
                        essential: t === 'text' ? false : q.essential,
                      })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {q.type === 'choice' && (
                <div className="gv-jp-opts">
                  {q.options.map((o, k) => (
                    <div key={k} className="gv-jp-opt">
                      <input
                        className="gv-jp-input"
                        value={o}
                        maxLength={80}
                        onChange={(e) => {
                          const opts = [...q.options];
                          const was = opts[k];
                          opts[k] = e.target.value;
                          edit(i, { options: opts, ideal: q.ideal === was ? (e.target.value || null) : q.ideal });
                        }}
                        placeholder={`Option ${k + 1}`}
                        aria-label={`Option ${k + 1}`}
                      />
                      {q.options.length > 2 && (
                        <button type="button" className="gv-jp-icon" aria-label={`Remove option ${k + 1}`} onClick={() => edit(i, { options: q.options.filter((_, m) => m !== k), ideal: q.ideal === o ? null : q.ideal })}>
                          <Trash2 size={15} strokeWidth={2.4} aria-hidden />
                        </button>
                      )}
                    </div>
                  ))}
                  {q.options.length < 6 && (
                    <button type="button" className="gv-jp-a" onClick={() => edit(i, { options: [...q.options, ''] })}>Add an option</button>
                  )}
                </div>
              )}

              {q.type !== 'text' && (
                <div className="gv-jp-q-row gv-jp-q-ideal">
                  <div className="gv-jp-field" style={{ minWidth: 200, flex: '1 1 200px', marginTop: 0 }}>
                    <span className="gv-jp-label">Ideal answer (optional)</span>
                    <GSelect
                      value={q.ideal ?? ''}
                      onChange={(v) => edit(i, { ideal: v || null })}
                      options={[
                        { value: '', label: 'Any answer' },
                        ...(q.type === 'yesno' ? ['Yes', 'No'] : q.options.filter((o) => o.trim())).map((o) => ({ value: o, label: o })),
                      ]}
                    />
                  </div>
                  <label className="gv-jp-tick">
                    <input type="checkbox" checked={q.essential} onChange={(e) => edit(i, { essential: e.target.checked })} />
                    <span>Essential</span>
                  </label>
                </div>
              )}
              {qBad && <p role="alert" className="gv-jp-err">{qBad}</p>}
            </li>
          );
        })}
      </ol>
      {questions.length < MAX_QUESTIONS && (
        <button
          type="button"
          className="gv-jp-second gv-jp-add"
          onClick={() => onChange([...questions, { id: nextQuestionId(questions), text: '', type: 'yesno', options: [], ideal: null, essential: false }])}
        >
          <Plus size={16} strokeWidth={2.6} aria-hidden /> Add a question
        </button>
      )}
      <div className="gv-jp-switchrow">
        <button type="button" role="switch" aria-checked={autoReject} className={`gv-jp-switch${autoReject ? ' gv-jp-switch-on' : ''}`} onClick={() => onAutoReject(!autoReject)} disabled={!anyEssential && !autoReject}>
          <span aria-hidden />
        </button>
        <span className="gv-jp-switch-label">Reject automatically if an Essential answer is wrong</span>
      </div>
      {autoReject && <p className="gv-jp-line gv-jp-soft">People who miss an Essential answer are stopped before applying. No application is created and no email is sent</p>}
      {fieldBad && <p role="alert" className="gv-jp-err">{fieldBad}</p>}
    </>
  );
}

export const POSTING_CSS = `
.gv-buy-panel.gv-jp{max-width:780px;min-height:0}
.gv-buy-panel.gv-jp .gv-buy-body{display:block}
.gv-jp-col{display:flex;flex-direction:column;gap:18px;padding:30px 32px 26px;font-family:${FONT};color:${INK}}
.gv-jp-head{padding-right:44px}
.gv-jp-headrow{display:flex;align-items:center;gap:10px;min-height:36px}
.gv-jp-back{width:36px;height:36px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:${FOREST};background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 2px 6px rgba(27,56,40,0.14)}
.gv-jp-count{margin:0;font-size:13px;font-weight:700;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-jp-title{margin:6px 0 0;font-size:clamp(24px,2.6vw,30px);font-weight:800;letter-spacing:-0.02em;line-height:1.12;color:${INK}}
.gv-jp-steps{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.gv-jp-stepbtn{min-height:32px;padding:0 12px;border-radius:9999px;border:1px solid rgba(28,20,16,0.14);background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-jp-stepbtn-on{border-color:${FOREST};color:${FOREST};background:#EEF3EC;font-weight:700}
.gv-jp-roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:600px){.gv-jp-roles{grid-template-columns:1fr}}
.gv-jp-role{display:flex;flex-direction:column;gap:6px}
.gv-jp-role-btn{display:flex;flex-direction:column;align-items:flex-start;gap:12px;width:100%;min-height:108px;padding:16px;border-radius:16px;border:1.5px solid rgba(28,20,16,0.12);background:#FFFFFF;cursor:pointer;font-family:${FONT};text-align:left;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.06);transition:border-color 140ms ease,box-shadow 140ms ease}
.gv-jp-role-btn:hover{border-color:rgba(27,56,40,0.4)}
.gv-jp-role-on .gv-jp-role-btn{border-color:${FOREST};box-shadow:inset 0 0 0 1px ${FOREST},0 6px 18px rgba(27,56,40,0.12)}
.gv-jp-role-off .gv-jp-role-btn{cursor:not-allowed;opacity:0.55}
.gv-jp-role-disc{width:44px;height:44px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;color:${FOREST};background:rgba(238,217,138,0.55)}
.gv-jp-role-name{font-size:17px;font-weight:700;color:${INK}}
.gv-jp-role-note{margin:0;font-size:13px;color:${INK_SOFT}}
.gv-jp-field{display:flex;flex-direction:column;gap:6px;border:none;margin:0;padding:0;min-width:0}
.gv-jp-label{font-size:14px;font-weight:700;color:${INK};padding:0}
.gv-jp-hint{font-size:12.5px;color:${INK_SOFT};font-variant-numeric:tabular-nums;align-self:flex-end}
.gv-jp-input{width:100%;min-height:46px;padding:10px 14px;border-radius:12px;border:1.5px solid rgba(28,20,16,0.14);background:#FFFFFF;font-family:${FONT};font-size:15.5px;color:${INK}}
.gv-jp-input:focus{outline:none;border-color:${FOREST};box-shadow:inset 0 0 0 1px ${FOREST}}
.gv-jp-input-bad{border-color:${DANGER}}
.gv-jp-area{min-height:180px;line-height:1.55;resize:vertical}
.gv-jp-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:4px}
.gv-jp-choice{display:flex;align-items:center;gap:10px;min-height:52px;padding:10px 14px;border-radius:14px;border:1.5px solid rgba(28,20,16,0.14);background:#FFFFFF;cursor:pointer;font-family:${FONT};text-align:left}
.gv-jp-choice-on{border-color:${FOREST};background:#EEF3EC}
.gv-jp-choice-title{flex:1 1 auto;font-size:15px;font-weight:700;color:${INK}}
.gv-jp-choice-note{font-size:13px;font-weight:700;color:${FOREST}}
.gv-jp-dot{flex-shrink:0;width:18px;height:18px;border-radius:9999px;border:1.5px solid rgba(28,20,16,0.35);display:inline-flex;align-items:center;justify-content:center;background:#FFFFFF}
.gv-jp-choice-on .gv-jp-dot{border-color:${FOREST}}
.gv-jp-dot span{width:9px;height:9px;border-radius:9999px;background:${FOREST}}
.gv-jp-offers{display:flex;flex-wrap:wrap;gap:10px}
.gv-jp-offer{min-height:44px;padding:0 16px;border-radius:9999px;border:1.5px solid rgba(28,20,16,0.16);background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:14.5px;font-weight:600;color:${INK}}
.gv-jp-offer-on{border-color:${FOREST};background:#EEF3EC;color:${FOREST};font-weight:700}
.gv-jp-qs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.gv-jp-q{display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.06)}
.gv-jp-q-bad{box-shadow:0 0 0 1.5px ${DANGER}}
.gv-jp-q-top{display:flex;align-items:center;gap:10px}
.gv-jp-q-n{flex-shrink:0;width:26px;height:26px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:rgba(238,217,138,0.55);color:#4A3410}
.gv-jp-q-tools{display:flex;gap:4px;flex-shrink:0}
.gv-jp-icon{width:34px;height:34px;border-radius:10px;border:1px solid rgba(28,20,16,0.12);background:#FFFFFF;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:${INK}}
.gv-jp-icon:disabled{opacity:0.35;cursor:default}
.gv-jp-icon-danger{color:${DANGER}}
.gv-jp-q-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 18px}
.gv-jp-seg{display:inline-flex;padding:3px;border-radius:12px;background:#F3EFE6}
.gv-jp-segbtn{min-height:36px;padding:0 14px;border:none;border-radius:9px;background:transparent;cursor:pointer;font-family:${FONT};font-size:13.5px;font-weight:600;color:${INK_SOFT}}
.gv-jp-segbtn-on{background:#FFFFFF;color:${INK};font-weight:700;box-shadow:0 1px 4px rgba(27,56,40,0.14)}
.gv-jp-opts{display:flex;flex-direction:column;gap:8px;padding-left:36px}
.gv-jp-opt{display:flex;align-items:center;gap:8px}
.gv-jp-tick{display:inline-flex;align-items:center;gap:8px;min-height:46px;font-size:14.5px;font-weight:700;color:${INK};cursor:pointer}
.gv-jp-tick input{width:18px;height:18px;accent-color:${FOREST}}
.gv-jp-add{align-self:flex-start}
.gv-jp-switchrow{display:flex;align-items:center;gap:12px}
.gv-jp-switch{position:relative;flex-shrink:0;width:46px;height:26px;border-radius:9999px;border:none;cursor:pointer;background:rgba(28,20,16,0.2);transition:background-color 160ms ease}
.gv-jp-switch span{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:9999px;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:transform 180ms cubic-bezier(0.22,1,0.36,1)}
.gv-jp-switch-on{background:${FOREST}}
.gv-jp-switch-on span{transform:translateX(20px)}
.gv-jp-switch:disabled{opacity:0.45;cursor:default}
.gv-jp-switch-label{font-size:14.5px;font-weight:600;color:${INK}}
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
.gv-jp-a{background:none;border:none;padding:0;cursor:pointer;font-family:${FONT};font-size:inherit;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px;align-self:flex-start}
.gv-jp-err{margin:0;font-size:13.5px;line-height:1.45;color:${DANGER}}
.gv-jp-err-block{padding:10px 12px;border-radius:12px;background:rgba(158,42,18,0.07)}
.gv-jp :is(button,input,textarea,a):focus{outline:none}
.gv-jp :is(button,input,textarea,a):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (max-width:743px){
  .gv-jp-col{padding:calc(20px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom))}
  .gv-jp-main,.gv-jp-second{flex:1 1 auto}
}
`;
