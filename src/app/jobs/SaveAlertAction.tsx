'use client';

// ── "Save as alert": the current filters as a daily email (Unlimited) ───────
//
// A quiet link-button. Signed out it opens the sign-in pop-up; signed in and
// not on Unlimited it opens the Unlimited pop-up. A member gets the form in
// place: a name prefilled from the filters ("Chair roles in Europe", "Roles
// in Spain", "All roles"), Save alert and Cancel, and the one line about the
// daily email. The save is job_alert_save, verified: a refusal is shown, a
// code 'unlimited' opens the Unlimited pop-up, success is the glass card and
// tells AlertsPanel to read its list again (JOB_ALERTS_CHANGED).

import { useEffect, useRef, useState } from 'react';
import { BellPlus, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { openUnlimitedPopup } from '@/lib/purchasePopup';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { isUnlimited, useUnlimitedStatus } from '@/lib/unlimitedStatus';
import { JOB_ROLE_LABEL, saveJobAlert } from '@/lib/jobBoard';
import { JOB_REGION_LABEL, jobFiltersOf, type JobQuery } from './jobQuery';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

/** Fired on window after an alert is saved or removed. */
export const JOB_ALERTS_CHANGED = 'gavelling-job-alerts-changed';

const NAME_MAX = 80;

/** "A", "A and B", "A, B and C". */
export function joinWords(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** A plain name for the filters: "Chair roles in Europe", "Staff roles", "Roles in Spain", "All roles". */
export function alertNameFor(q: JobQuery): string {
  const roles = q.roles.map((r) => JOB_ROLE_LABEL[r]);
  const places = q.regions.length ? q.regions.map((r) => JOB_REGION_LABEL[r]) : q.countries;
  const search = q.q.trim();
  if (!roles.length && !places.length && !search) return 'All roles';
  let name = roles.length
    ? `${joinWords(roles.map((r, i) => (i === 0 ? r : r.toLowerCase())))} roles`
    : 'Roles';
  if (places.length) name += ` in ${joinWords(places)}`;
  if (search) name += ` matching "${search}"`;
  return name.length > NAME_MAX ? name.slice(0, NAME_MAX).trim() : name;
}

export default function SaveAlertAction({ query }: { query: JobQuery }) {
  const { user } = useAuth();
  const status = useUnlimitedStatus();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Signing out, or the plan ending, folds the form away.
  useEffect(() => {
    if (!user || (status !== null && !isUnlimited(status))) setOpen(false);
  }, [user, status]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const start = () => {
    if (!user) { openAuth(); return; }
    // null = the plan read is still in flight: the server decides on save.
    if (status !== null && !isUnlimited(status)) { openUnlimitedPopup(); return; }
    setName(alertNameFor(query));
    setOpen(true);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (busyRef.current || !trimmed) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await saveJobAlert(null, trimmed.slice(0, NAME_MAX), jobFiltersOf(query));
      if (!res.ok) {
        if (res.code === 'unlimited') { openUnlimitedPopup(); return; }
        if (res.code === 'signin') { openAuth(); return; }
        notifyErr(res.message, 'job-alert');
        return;
      }
      notifyOk('Alert saved', 'job-alert');
      setOpen(false);
      try { window.dispatchEvent(new Event(JOB_ALERTS_CHANGED)); } catch { /* nothing listening */ }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="gv-sa" style={{ fontFamily: FONT }}>
      <style>{SAVE_ALERT_CSS}</style>
      {!open ? (
        <button type="button" className="gv-sa-link" onClick={start}>
          <BellPlus size={16} strokeWidth={2.3} aria-hidden />
          Save as alert
        </button>
      ) : (
        <form
          className="gv-sa-form"
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); setOpen(false); } }}
        >
          <label className="gv-sa-label" htmlFor="gv-sa-name">Alert name</label>
          <div className="gv-sa-row">
            <input
              id="gv-sa-name"
              ref={inputRef}
              className="gv-sa-input"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
            <button type="submit" className="gv-sa-save" disabled={busy || !name.trim()} aria-busy={busy || undefined}>
              {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
              Save alert
            </button>
            <button type="button" className="gv-sa-cancel" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          </div>
          <p className="gv-sa-hint">We email you once a day when new roles match</p>
        </form>
      )}
    </div>
  );
}

const SAVE_ALERT_CSS = `
.gv-sa{color:${INK}}
.gv-sa-link{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 2px;background:none;border:none;cursor:pointer;font-family:${FONT};font-size:14.5px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-sa-link:hover{color:${FOREST}}
.gv-sa-form{display:flex;flex-direction:column;gap:6px;max-width:100%}
.gv-sa-label{font-size:13px;font-weight:700;color:${INK_SOFT}}
.gv-sa-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.gv-sa-input{flex:1 1 220px;min-width:0;min-height:44px;padding:0 14px;border-radius:11px;border:1.5px solid rgba(28,20,16,0.18);background:#FFFFFF;font-family:${FONT};font-size:15px;font-weight:500;color:${INK}}
.gv-sa-input:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-sa-save{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 18px;border:none;border-radius:11px;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);box-shadow:0 6px 16px rgba(27,56,40,0.22)}
.gv-sa-save:disabled{opacity:0.6;cursor:default}
.gv-sa-cancel{min-height:44px;padding:0 12px;background:none;border:none;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK_SOFT}}
.gv-sa-cancel:hover:not(:disabled){color:${INK}}
.gv-sa-hint{margin:2px 0 0;font-size:13px;line-height:1.45;color:${INK_SOFT}}
.gv-sa :is(button,a):focus{outline:none}
.gv-sa :is(button,a):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
`;
