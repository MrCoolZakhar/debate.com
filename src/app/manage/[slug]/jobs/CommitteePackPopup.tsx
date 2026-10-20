'use client';

// ── Post chair listings for many committees at once (organizer Job Board) ──
//
// The Store pop-up shell, ONE pop-up whose steps replace each other with a
// back arrow (never a pop-up on a pop-up):
//   1 Committees      every committee ticked, those with a draft or live
//                     chair listing shown unticked and disabled; at most 40
//   2 Shared details  description, What You Offer, Screening Questions,
//                     deadline, posted by: PostingPopup's own field parts
//   3 Review          the titles, then "Post N listings" (job_committee_pack)
//   then the result in place: created, skipped and failed, and Done.
// Nothing is saved before step 3; the pack is free.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { DatePicker } from '@/components/DatePicker';
import type { JobOffers } from '@/lib/jobBoard';
import {
  committeePack, dayLabel, draftDescription, plural,
  type JobPanel, type OrgQuestion, type PackCreated, type PackFailed, type PackSkipped,
} from './jobsApi';
import {
  DescriptionField, NO_OFFERS, OffersEditor, PosterField, POSTING_CSS, QuestionsEditor, type PostingConference,
} from './PostingPopup';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

const MAX_PACK = 40;
const SHOWN_TITLES = 6;

type Step = 'committees' | 'details' | 'review';
const STEPS: Step[] = ['committees', 'details', 'review'];
const STEP_TITLE: Record<Step, string> = {
  committees: 'Choose Committees',
  details: 'Shared Details',
  review: 'Review',
};
/** The template fields the server can name. */
const DETAIL_FIELDS = new Set(['description', 'offers', 'paid_amount', 'questions', 'auto_reject', 'deadline', 'poster_user_id']);

type Committee = JobPanel['committees'][number];

function chairTitle(c: Committee): string {
  return `${c.abbreviation?.trim() || c.name} Chair`;
}

interface Result { created: PackCreated[]; skipped: PackSkipped[]; failed: PackFailed[] }

export default function CommitteePackPopup({
  conference, panel, myUserId, onClose, onDone,
}: {
  conference: PostingConference;
  panel: JobPanel;
  myUserId: string | null;
  onClose: () => void;
  /** Reads the panel again. */
  onDone: () => void;
}) {
  const taken = useMemo(() => new Set(
    panel.listings
      .filter((l) => l.role === 'chair' && l.committee_id && (l.shown === 'draft' || l.shown === 'live'))
      .map((l) => l.committee_id as string),
  ), [panel.listings]);
  const open = useMemo(() => panel.committees.filter((c) => !taken.has(c.id)), [panel.committees, taken]);

  const [step, setStep] = useState<Step>('committees');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(open.slice(0, MAX_PACK).map((c) => c.id)));
  const [description, setDescription] = useState('');
  const [offers, setOffers] = useState<JobOffers>({ ...NO_OFFERS });
  const [questions, setQuestions] = useState<OrgQuestion[]>([]);
  const [autoReject, setAutoReject] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [poster, setPoster] = useState<string>(() => (
    myUserId && panel.organizers.some((o) => o.user_id === myUserId) ? myUserId : panel.organizers[0]?.user_id ?? ''
  ));
  const [bad, setBad] = useState<{ field: string; message: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const busyRef = useRef(false);
  const prefilled = useRef(false);

  const chairRole = panel.roles.find((r) => r.role === 'chair') ?? null;
  const roleCloses = chairRole?.closes_at ? chairRole.closes_at.slice(0, 10) : null;
  const index = STEPS.indexOf(step);
  const pickedList = panel.committees.filter((c) => picked.has(c.id));
  const full = picked.size >= MAX_PACK;
  const markOf = (field: string) => (bad && bad.field === field ? bad.message : null);

  // The description is prefilled from the conference page when the details step opens empty.
  useEffect(() => {
    if (step !== 'details' || prefilled.current || description.trim()) return;
    prefilled.current = true;
    void draftDescription(conference.id, 'chair', null).then((text) => {
      if (!text) return;
      setDescription((d) => (d.trim() ? d : text));
    });
  }, [step, description, conference.id]);

  function clearBad(fields: string[]) {
    setBad((b) => (b && (fields.includes(b.field) || (fields.includes('questions') && b.field.startsWith('question'))) ? null : b));
  }

  function toggle(id: string) {
    setErr('');
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PACK) next.add(id);
      return next;
    });
  }

  function checkStep(s: Step): { field: string; message: string } | null {
    if (s === 'committees' && picked.size === 0) return { field: 'committees', message: 'Pick at least one committee' };
    if (s === 'details') {
      if (description.length > 4000) return { field: 'description', message: 'Keep the description to 4,000 characters' };
      for (const q of questions) {
        if (!q.text.trim()) return { field: `question:${q.id}`, message: 'Write the question, or remove it' };
        if (q.type === 'choice') {
          const opts = q.options.map((o) => o.trim());
          if (opts.length < 2 || opts.some((o) => !o)) return { field: `question:${q.id}`, message: 'A choice question needs 2 to 6 filled-in options' };
        }
      }
      if (deadline && roleCloses && deadline > roleCloses) {
        return { field: 'deadline', message: `The deadline can't be after ${dayLabel(roleCloses)}, when applications for chairs close` };
      }
    }
    return null;
  }

  function go(to: Step) {
    if (busyRef.current) return;
    setErr('');
    if (STEPS.indexOf(to) > index) {
      for (const s of STEPS.slice(index, STEPS.indexOf(to))) {
        const problem = checkStep(s);
        if (problem) { setStep(s); setBad(problem); return; }
      }
    }
    setBad(null);
    setStep(to);
  }

  async function post() {
    if (busyRef.current) return;
    setErr('');
    for (const s of STEPS.slice(0, -1)) {
      const problem = checkStep(s);
      if (problem) { setStep(s); setBad(problem); return; }
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await committeePack(conference.id, pickedList.map((c) => c.id), {
        description,
        offers: { ...offers, paid_amount: offers.paid ? (offers.paid_amount?.trim() || null) : null },
        questions: questions.map((q) => ({
          ...q,
          text: q.text.trim(),
          options: q.type === 'choice' ? q.options.map((o) => o.trim()) : [],
          ideal: q.type === 'text' ? null : q.ideal,
          essential: q.type === 'text' ? false : q.essential,
        })),
        auto_reject: autoReject,
        deadline: deadline || null,
        poster_user_id: poster || null,
      });
      if (!r.ok) {
        const f = r.field;
        if (f && (DETAIL_FIELDS.has(f) || f.startsWith('question'))) {
          setStep('details');
          setBad({ field: f, message: r.message });
          return;
        }
        setErr(r.message);
        return;
      }
      setResult({ created: r.created, skipped: r.skipped, failed: r.failed });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function finish() {
    onDone();
    onClose();
  }

  // ── The result, in this same pop-up ──
  if (result) {
    const n = result.created.length;
    const others = [
      ...result.skipped.map((s) => ({ id: s.committee_id, name: s.name, message: s.message })),
      ...result.failed.map((f) => ({ id: f.committee_id, name: f.name, message: f.kept_as_draft ? 'Saved as a draft' : f.message })),
    ];
    return (
      <PurchaseShell tone="light" label="Chair listings posted" onClose={finish} panelClass="gv-st-pop gv-jp" testId="job-committee-pack">
        <style>{PURCHASE_CSS}{POSTING_CSS}{PACK_CSS}</style>
        <div className="gv-jp-col">
          <header className="gv-jp-head">
            <h2 className="gv-jp-title">{n > 0 ? 'Your Listings Are Live' : 'Nothing Was Posted'}</h2>
          </header>
          <p className="gv-jp-line">
            {n > 0 ? `${plural(n, 'chair listing')} ${n === 1 ? 'is' : 'are'} live on the Job Board` : 'No listing went live'}
          </p>
          {others.length > 0 && (
            <ul className="gv-pk-list" aria-label="Not posted">
              {others.map((o) => (
                <li key={o.id} className="gv-pk-res">
                  <span className="gv-pk-name">{o.name}</span>
                  <span className="gv-pk-sub">{o.message}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="gv-jp-actions">
            <button type="button" className="gv-jp-main" onClick={finish}>Done</button>
          </div>
        </div>
      </PurchaseShell>
    );
  }

  const titles = pickedList.map(chairTitle);
  const more = titles.length - SHOWN_TITLES;

  return (
    <PurchaseShell tone="light" label="Post chair listings" onClose={onClose} panelClass="gv-st-pop gv-jp" testId="job-committee-pack">
      <style>{PURCHASE_CSS}{POSTING_CSS}{PACK_CSS}</style>
      <div className="gv-jp-col">
        <header className="gv-jp-head">
          <div className="gv-jp-headrow">
            {index > 0 && (
              <button type="button" className="gv-jp-back" onClick={() => go(STEPS[index - 1])} disabled={busy} aria-label="Back">
                <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
              </button>
            )}
            <p className="gv-jp-count">Step {index + 1} of {STEPS.length}</p>
          </div>
          <h2 className="gv-jp-title">{STEP_TITLE[step]}</h2>
        </header>

        {/* ── 1 Committees ── */}
        {step === 'committees' && (
          <>
            {panel.committees.length === 0 ? (
              <p className="gv-jp-line gv-jp-soft">Add committees first, then post a chair listing for each</p>
            ) : (
              <>
                <div className="gv-pk-tools">
                  <p className="gv-jp-line"><strong>{picked.size}</strong> picked</p>
                  <button type="button" className="gv-jp-a" onClick={() => { setErr(''); setBad(null); setPicked(new Set(open.slice(0, MAX_PACK).map((c) => c.id))); }} disabled={open.length === 0}>Select all</button>
                  <button type="button" className="gv-jp-a" onClick={() => setPicked(new Set())} disabled={picked.size === 0}>Clear</button>
                </div>
                {open.length > MAX_PACK && (
                  <p className="gv-jp-line gv-jp-soft">You can post up to {MAX_PACK} listings at a time. Post these, then come back for the rest</p>
                )}
                <ul className="gv-pk-list" aria-label="Committees">
                  {panel.committees.map((c) => {
                    const has = taken.has(c.id);
                    const on = picked.has(c.id);
                    const locked = has || (!on && full);
                    const abbr = c.abbreviation?.trim();
                    return (
                      <li key={c.id}>
                        <label className={`gv-pk-row${on ? ' gv-pk-row-on' : ''}${locked ? ' gv-pk-row-off' : ''}`}>
                          <input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(c.id)} />
                          <span className="gv-pk-text">
                            <span className="gv-pk-name">{abbr || c.name}</span>
                            {abbr && abbr !== c.name && <span className="gv-pk-sub">{c.name}</span>}
                            {has && <span className="gv-pk-sub">Already has a chair listing</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {markOf('committees') && <p role="alert" className="gv-jp-err">{markOf('committees')}</p>}
          </>
        )}

        {/* ── 2 Shared details ── */}
        {step === 'details' && (
          <>
            <p className="gv-jp-line">These details go on every listing. You can edit each listing afterwards.</p>
            <DescriptionField value={description} onChange={(v) => { setDescription(v); clearBad(['description']); }} mark={markOf('description')} />
            <h3 className="gv-pk-h">What You Offer</h3>
            <OffersEditor offers={offers} onChange={(o) => { setOffers(o); clearBad(['offers', 'paid_amount']); }} mark={markOf('offers') || markOf('paid_amount')} />
            <h3 className="gv-pk-h">Screening Questions</h3>
            <QuestionsEditor
              questions={questions}
              autoReject={autoReject}
              bad={bad}
              onChange={(qs) => { setQuestions(qs); clearBad(['questions', 'auto_reject']); }}
              onAutoReject={(v) => { setAutoReject(v); clearBad(['questions', 'auto_reject']); }}
            />
            <div className="gv-jp-field" style={{ maxWidth: 320 }}>
              <span className="gv-jp-label">Deadline (optional)</span>
              <DatePicker
                value={deadline}
                onChange={(v) => { setDeadline(v); clearBad(['deadline']); }}
                futureOnly
                clearable
                max={roleCloses ?? undefined}
                invalid={!!markOf('deadline')}
                placeholder="No deadline"
              />
              {markOf('deadline') && <span role="alert" className="gv-jp-err">{markOf('deadline')}</span>}
            </div>
            {roleCloses && <p className="gv-jp-line gv-jp-soft">Applications for chairs close {dayLabel(roleCloses)}</p>}
            <PosterField panel={panel} myUserId={myUserId} value={poster} onChange={(v) => { setPoster(v); clearBad(['poster_user_id']); }} mark={markOf('poster_user_id')} />
          </>
        )}

        {/* ── 3 Review ── */}
        {step === 'review' && (
          <div className="gv-jp-preview">
            <p className="gv-pk-sum">
              {plural(titles.length, 'chair listing')}: {titles.slice(0, SHOWN_TITLES).join(', ')}{more > 0 ? ` and ${more} more` : ''}
            </p>
            <p className="gv-jp-line gv-jp-soft">
              Each one goes live on the Job Board straight away{questions.length > 0 ? `, with ${plural(questions.length, 'question')} before people apply` : ''}{deadline ? `, until ${dayLabel(deadline)}` : ''}
            </p>
          </div>
        )}

        {err && <p role="alert" className="gv-jp-err gv-jp-err-block">{err}</p>}

        <div className="gv-jp-actions">
          {step !== 'review' ? (
            <button type="button" className="gv-jp-main" onClick={() => go(STEPS[index + 1])} disabled={busy || (step === 'committees' && picked.size === 0)}>
              Continue
            </button>
          ) : (
            <button type="button" className="gv-jp-main" onClick={() => { void post(); }} disabled={busy || picked.size === 0} aria-busy={busy || undefined}>
              {busy ? 'Posting' : `Post ${plural(picked.size, 'listing')}`}
            </button>
          )}
        </div>
      </div>
    </PurchaseShell>
  );
}

const PACK_CSS = `
.gv-pk-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px}
.gv-pk-tools .gv-jp-a:disabled{opacity:0.45;cursor:default}
.gv-pk-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.gv-pk-row{display:flex;align-items:flex-start;gap:12px;min-height:56px;padding:12px 14px;border-radius:14px;border:1.5px solid rgba(28,20,16,0.12);background:#FFFFFF;cursor:pointer;font-family:${FONT}}
.gv-pk-row-on{border-color:${FOREST};background:#EEF3EC}
.gv-pk-row-off{cursor:default;opacity:0.6}
.gv-pk-row input{flex-shrink:0;width:18px;height:18px;margin-top:2px;accent-color:${FOREST}}
.gv-pk-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.gv-pk-name{font-size:15px;font-weight:700;color:${INK};overflow-wrap:anywhere}
.gv-pk-sub{font-size:13px;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-pk-res{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:14px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.06)}
.gv-pk-h{margin:6px 0 0;font-size:17px;font-weight:700;color:${INK}}
.gv-pk-sum{margin:0;font-size:16px;font-weight:700;line-height:1.5;color:${INK};overflow-wrap:anywhere}
`;
