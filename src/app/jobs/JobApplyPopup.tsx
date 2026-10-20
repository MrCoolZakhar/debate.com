'use client';

// ── The apply pop-up for a Gavelling listing (/jobs) ────────────────────────
//
// The purchase pop-up shell (src/components/purchase/purchaseKit.tsx), one
// column. ONE pop-up whose steps replace each other, never a pop-up on a
// pop-up:
//   "1 of 2" Screening   the listing's questions (Yes/No, one choice, a short
//                        answer), all required; skipped when there are none.
//   "2 of 2" Continue    one line, then "Continue application", which calls
//                        job_submit_screening and follows `next`.
//   Final screens        stopped / added / done (and a refusal), the server's
//                        own sentence and a single "Close".
// job_screening saying `stopped` opens straight onto the stopped screen.
// Every button holds a busy guard; nothing is optimistic.
//
// Signed out (prompt 5, like every other application on Gavelling): the
// questions come from job_screening_public and "Continue application" calls
// job_check_screening, which stores nothing. A pass keeps the answers on this
// device for 14 days under the listing id, and the apply page claims them
// once the person is signed in and has applied (ListingApplyLine.tsx). A
// premium listing still needs sign-in (onNeedSignIn).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { useAuth } from '@/components/AuthProvider';
import {
  JOB_ROLE_LABEL, checkJobScreening, fetchJobScreening, fetchJobScreeningPublic, storeJobAnswers, submitJobScreening,
  type JobListingDetail, type JobQuestion, type JobRole,
} from '@/lib/jobBoard';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';
const DANGER = '#9E2A12';

type Phase =
  | { k: 'loading' }
  | { k: 'questions' }
  | { k: 'continue' }
  | { k: 'final'; title: string; message: string; good: boolean };

export default function JobApplyPopup({ listing, onClose, onSettled, onNeedSignIn }: {
  listing: JobListingDetail;
  onClose: () => void;
  /** Called after an answer the server stored (stopped, added, done), so the page reads its state again. */
  onSettled: () => void;
  /** Signed out on a listing that needs sign-in (premium): the page closes this and opens sign-in. */
  onNeedSignIn?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const signedIn = !!user;
  // The page passes a fresh arrow each render; a ref keeps the load stable.
  const needSignInRef = useRef(onNeedSignIn);
  useEffect(() => { needSignInRef.current = onNeedSignIn; }, [onNeedSignIn]);
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [role, setRole] = useState<JobRole>(listing.role);
  const [short, setShort] = useState<string>(listing.conference.short || listing.conference.name || 'this conference');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<{ id: string; message: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setPhase({ k: 'loading' });
    setErr('');
    const res = signedIn ? await fetchJobScreening(listing.id) : await fetchJobScreeningPublic(listing.id);
    if (!res.ok) {
      if (!signedIn && res.code === 'signin' && needSignInRef.current) {
        needSignInRef.current();
        return;
      }
      if (res.code === 'stopped') {
        setPhase({ k: 'final', title: 'Not a Match for This Role', message: res.message, good: false });
      } else {
        setPhase({ k: 'final', title: 'You Can’t Apply Here Yet', message: res.message, good: false });
      }
      return;
    }
    setQuestions(res.questions);
    setRole(res.role);
    if (res.conference?.short) setShort(res.conference.short);
    setPhase(res.questions.length ? { k: 'questions' } : { k: 'continue' });
  }, [listing.id, signedIn]);

  useEffect(() => { void load(); }, [load]);

  function goToContinue() {
    const missing = questions.find((q) => !(answers[q.id] ?? '').trim());
    if (missing) {
      setBad({ id: missing.id, message: 'Answer this question to go on' });
      document.getElementById(`gv-jq-${missing.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setBad(null);
    setErr('');
    setPhase({ k: 'continue' });
  }

  async function submit() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const given = questions.map((q) => ({ id: q.id, answer: (answers[q.id] ?? '').trim() }));
      if (!signedIn) {
        // Checked, never stored on the server: the answers wait on this device.
        const check = await checkJobScreening(listing.id, given);
        if (!check.ok) {
          if (check.stopped) {
            setPhase({ k: 'final', title: 'Not a Match for This Role', message: check.message, good: false });
          } else if (check.field && questions.some((q) => q.id === check.field)) {
            setBad({ id: check.field, message: check.message });
            setPhase({ k: 'questions' });
          } else {
            setErr(check.message);
          }
          return;
        }
        const url = check.continue_url;
        if (url.startsWith('/') && !url.startsWith('//')) {
          storeJobAnswers(listing.id, given);
          setLeaving(true);
          router.push(url);
          return;
        }
        setErr('We could not open the application. Try again.');
        return;
      }
      const res = await submitJobScreening(listing.id, given);
      if (!res.ok) {
        if (res.stopped) {
          onSettled();
          setPhase({ k: 'final', title: 'Not a Match for This Role', message: res.message, good: false });
        } else if (res.field && questions.some((q) => q.id === res.field)) {
          setBad({ id: res.field, message: res.message });
          setPhase({ k: 'questions' });
        } else {
          setErr(res.message);
        }
        return;
      }
      if (res.next === 'continue') {
        const url = res.continue_url;
        if (url.startsWith('/') && !url.startsWith('//')) {
          setLeaving(true);
          router.push(url);
          return;
        }
        setErr('We could not open the application. Try again.');
        return;
      }
      onSettled();
      setPhase({
        k: 'final',
        title: res.next === 'added' ? 'Added to Your Application' : 'Application Sent',
        message: res.message,
        good: true,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const step = phase.k === 'questions' ? 1 : phase.k === 'continue' ? 2 : null;
  const roleWord = JOB_ROLE_LABEL[role].toLowerCase();

  return (
    <PurchaseShell tone="light" label={listing.title} onClose={onClose} panelClass="gv-japply" testId="job-apply">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-japply-col">
        {phase.k === 'loading' && (
          <div className="gv-japply-wait" role="status">
            <Loader2 size={22} className="animate-spin" aria-hidden />
            <span>Loading the questions</span>
          </div>
        )}

        {step !== null && (
          <header className="gv-japply-head">
            {questions.length > 0 && <p className="gv-japply-step">{step} of 2</p>}
            <h2 className="gv-japply-title">{listing.title}</h2>
            {listing.committee && <p className="gv-japply-sub">{listing.committee}</p>}
          </header>
        )}

        {phase.k === 'questions' && (
          <>
            <ol className="gv-japply-qs">
              {questions.map((q, i) => (
                <QuestionField
                  key={q.id}
                  index={i}
                  q={q}
                  value={answers[q.id] ?? ''}
                  error={bad?.id === q.id ? bad.message : null}
                  onChange={(v) => {
                    setAnswers((a) => ({ ...a, [q.id]: v }));
                    if (bad?.id === q.id) setBad(null);
                  }}
                />
              ))}
            </ol>
            <div className="gv-japply-actions">
              <button type="button" className="gv-japply-main" onClick={goToContinue}>Next</button>
            </div>
          </>
        )}

        {phase.k === 'continue' && (
          <>
            <p className="gv-japply-line">
              Next you finish your {roleWord} application at {short}. Your profile and MUN CV fill in what they can
            </p>
            {err && <p role="alert" className="gv-japply-err">{err}</p>}
            <div className="gv-japply-actions">
              {questions.length > 0 && (
                <button
                  type="button"
                  className="gv-japply-back"
                  onClick={() => { setErr(''); setPhase({ k: 'questions' }); }}
                  disabled={busy || leaving}
                >
                  <ArrowLeft size={16} strokeWidth={2.4} aria-hidden />
                  Back
                </button>
              )}
              <button
                type="button"
                className="gv-japply-main"
                onClick={() => { void submit(); }}
                disabled={busy || leaving}
                aria-busy={busy || leaving || undefined}
              >
                {busy || leaving ? <><Loader2 size={17} className="animate-spin" aria-hidden /> One moment</> : 'Continue application'}
              </button>
            </div>
          </>
        )}

        {phase.k === 'final' && (
          <div className="gv-japply-final">
            {phase.good && (
              <span className="gv-japply-done" aria-hidden><Check size={26} strokeWidth={2.6} /></span>
            )}
            <h2 className="gv-japply-title">{phase.title}</h2>
            <p className="gv-japply-line">{phase.message}</p>
            <div className="gv-japply-actions">
              <button type="button" className="gv-japply-main" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </PurchaseShell>
  );
}

function QuestionField({ q, index, value, error, onChange }: {
  q: JobQuestion; index: number; value: string; error: string | null; onChange: (v: string) => void;
}) {
  const labelId = `gv-jq-${q.id}-label`;
  const errId = `gv-jq-${q.id}-err`;
  const options = q.type === 'yesno' ? ['Yes', 'No'] : q.type === 'choice' ? q.options : [];
  return (
    <li id={`gv-jq-${q.id}`} className={`gv-japply-q${error ? ' gv-japply-q-bad' : ''}`}>
      <p id={labelId} className="gv-japply-qtext">
        <span className="gv-japply-qnum" aria-hidden>{index + 1}</span>
        <span>{q.text}</span>
      </p>
      {q.type === 'text' ? (
        <input
          aria-labelledby={labelId}
          aria-describedby={error ? errId : undefined}
          aria-invalid={!!error || undefined}
          value={value}
          maxLength={1000}
          onChange={(e) => onChange(e.target.value)}
          className="gv-japply-input"
          placeholder="Your answer"
        />
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          aria-describedby={error ? errId : undefined}
          className={`gv-japply-opts${q.type === 'yesno' ? ' gv-japply-opts-two' : ''}`}
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={value === o}
              onClick={() => onChange(o)}
              className="gv-japply-opt"
            >
              <span className="gv-japply-dot" aria-hidden>{value === o && <span />}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{o}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p id={errId} role="alert" className="gv-japply-err">{error}</p>}
    </li>
  );
}

const CSS = `
.gv-buy-panel.gv-japply{max-width:620px;min-height:0}
.gv-buy-panel.gv-japply .gv-buy-body{display:block}
.gv-japply-col{display:flex;flex-direction:column;gap:20px;padding:34px 32px 28px;font-family:${FONT};color:${INK}}
.gv-japply-head{padding-right:40px}
.gv-japply-step{margin:0 0 8px;font-size:13px;font-weight:700;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-japply-title{margin:0;font-size:clamp(24px,3vw,30px);font-weight:800;letter-spacing:-0.02em;line-height:1.12;color:${INK};overflow-wrap:anywhere;text-wrap:balance}
.gv-japply-sub{margin:6px 0 0;font-size:15px;font-weight:600;color:${FOREST};overflow-wrap:anywhere}
.gv-japply-line{margin:0;font-size:16px;line-height:1.55;color:#3E352C;text-wrap:pretty}
.gv-japply-wait{display:flex;align-items:center;gap:10px;min-height:160px;justify-content:center;color:${INK_SOFT};font-size:15px}
.gv-japply-qs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
.gv-japply-q{padding:16px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.06)}
.gv-japply-q-bad{box-shadow:0 0 0 1.5px ${DANGER},0 4px 14px rgba(158,42,18,0.08)}
.gv-japply-qtext{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;font-size:15.5px;font-weight:600;line-height:1.4;color:${INK}}
.gv-japply-qnum{flex-shrink:0;width:24px;height:24px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:rgba(238,217,138,0.55);color:#4A3410}
.gv-japply-opts{display:flex;flex-direction:column;gap:8px}
.gv-japply-opts-two{display:grid;grid-template-columns:1fr 1fr}
.gv-japply-opt{display:flex;align-items:center;gap:10px;min-height:46px;padding:10px 14px;border-radius:12px;border:1.5px solid rgba(28,20,16,0.14);background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:600;color:${INK};text-align:left;transition:border-color 140ms ease,background-color 140ms ease}
.gv-japply-opt:hover{border-color:rgba(27,56,40,0.45)}
.gv-japply-opt[aria-checked="true"]{border-color:${FOREST};background:#EEF3EC}
.gv-japply-dot{flex-shrink:0;width:18px;height:18px;border-radius:9999px;border:1.5px solid rgba(28,20,16,0.35);display:inline-flex;align-items:center;justify-content:center;background:#FFFFFF}
.gv-japply-opt[aria-checked="true"] .gv-japply-dot{border-color:${FOREST}}
.gv-japply-dot span{width:9px;height:9px;border-radius:9999px;background:${FOREST}}
.gv-japply-input{width:100%;height:48px;padding:0 14px;border-radius:12px;border:1.5px solid rgba(28,20,16,0.14);background:#FFFFFF;font-family:${FONT};font-size:16px;color:${INK}}
.gv-japply-input:focus{outline:none;border-color:${FOREST};box-shadow:inset 0 0 0 1px ${FOREST}}
.gv-japply-err{margin:8px 0 0;font-size:13.5px;line-height:1.45;color:${DANGER}}
.gv-japply-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap}
.gv-japply-main{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 26px;border:none;border-radius:11px;cursor:pointer;font-family:${FONT};font-size:16px;font-weight:700;color:#FFFFFF;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);box-shadow:0 6px 16px rgba(27,56,40,0.22);transition:transform 120ms ease,opacity 160ms ease}
.gv-japply-main:hover:not(:disabled){transform:translateY(-1px)}
.gv-japply-main:disabled{opacity:0.7;cursor:default}
.gv-japply-back{display:inline-flex;align-items:center;gap:6px;min-height:50px;padding:0 18px;border-radius:11px;border:1.5px solid ${INK};background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK}}
.gv-japply-back:disabled{opacity:0.6;cursor:default}
.gv-japply-final{display:flex;flex-direction:column;gap:14px;padding-right:24px}
.gv-japply-final .gv-japply-actions{margin-top:8px}
.gv-japply-done{width:52px;height:52px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;color:${FOREST};background:linear-gradient(180deg,#FFFFFF 0%,#EEF3EC 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 3px 10px rgba(27,56,40,0.14)}
.gv-japply :is(button,input):focus{outline:none}
.gv-japply :is(button,input):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (max-width:743px){
  .gv-japply-col{padding:calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}
  .gv-japply-main,.gv-japply-back{flex:1 1 auto}
}
`;
