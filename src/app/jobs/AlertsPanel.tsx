'use client';

// ── Your job alerts (Unlimited members only) ────────────────────────────────
//
// A small white card listing job_alerts_mine(): each alert's name, its filters
// in plain words and Remove, asked in place ("Remove this alert?"). Nothing
// renders for someone signed out or not on Unlimited. The list is read on the
// user id and again whenever SaveAlertAction saves (JOB_ALERTS_CHANGED). A
// removal is verified: the list is read back and the alert must be gone.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { isUnlimited, useUnlimitedStatus } from '@/lib/unlimitedStatus';
import { JOB_OFFER_LABEL, JOB_ROLE_LABEL, fetchMyAlerts, removeJobAlert, type JobAlert, type JobFilters } from '@/lib/jobBoard';
import { JOB_REGION_LABEL } from './jobQuery';
import { JOB_ALERTS_CHANGED, joinWords } from './SaveAlertAction';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

const FORMAT_LABEL: Record<string, string> = { 'in-person': 'In person', online: 'Online', hybrid: 'Hybrid' };

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** An alert's filters in plain words, e.g. "Chair and staff · Europe · Paid · Closes this week". */
export function alertSummary(f: JobFilters | null | undefined): string {
  if (!f) return 'Every new role';
  const parts: string[] = [];
  if (f.roles?.length) parts.push(joinWords(f.roles.map((r, i) => (i === 0 ? JOB_ROLE_LABEL[r] : JOB_ROLE_LABEL[r].toLowerCase()))));
  const places = f.regions?.length ? f.regions.map((r) => JOB_REGION_LABEL[r] ?? r) : (f.countries ?? []);
  if (places.length) parts.push(joinWords(places));
  if (f.from && f.to) parts.push(`${shortDate(f.from)} to ${shortDate(f.to)}`);
  else if (f.from) parts.push(`From ${shortDate(f.from)}`);
  else if (f.to) parts.push(`Until ${shortDate(f.to)}`);
  if (f.level) parts.push(f.level === 'school' ? 'High school' : 'University');
  if (f.format) parts.push(FORMAT_LABEL[f.format] ?? f.format);
  if (f.offers?.length) parts.push(joinWords(f.offers.map((o) => JOB_OFFER_LABEL[o] ?? o)));
  if (f.deadline_days) parts.push(f.deadline_days <= 7 ? 'Closes this week' : 'Closes this month');
  if (f.under10) parts.push('Under 10 applicants');
  if (f.q?.trim()) parts.push(`Matching "${f.q.trim()}"`);
  return parts.length ? parts.join(' · ') : 'Every new role';
}

type Load = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'done'; alerts: JobAlert[] };

export default function AlertsPanel() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const status = useUnlimitedStatus();
  const member = !!userId && isUnlimited(status);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [asking, setAsking] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const seq = useRef(0);

  const read = useCallback(async (quiet = false) => {
    const mine = ++seq.current;
    if (!quiet) setLoad({ kind: 'loading' });
    const res = await fetchMyAlerts();
    if (mine !== seq.current) return null;
    if (!Array.isArray(res)) {
      if (!quiet) setLoad({ kind: 'failed', message: res.message });
      return null;
    }
    setLoad({ kind: 'done', alerts: res });
    return res;
  }, []);

  // Read on the user id (never the token), once the plan says member.
  useEffect(() => {
    if (!member) return;
    void read();
  }, [member, userId, read]);

  useEffect(() => {
    if (!member) return;
    const on = () => { void read(true); };
    window.addEventListener(JOB_ALERTS_CHANGED, on);
    return () => window.removeEventListener(JOB_ALERTS_CHANGED, on);
  }, [member, read]);

  const remove = async (id: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(id);
    try {
      const res = await removeJobAlert(id);
      if (!res.ok) { notifyErr(res.message, 'job-alert'); return; }
      const after = await read(true);
      if (!after) { notifyErr('We could not check that the alert was removed. Try again.', 'job-alert'); return; }
      if (after.some((a) => a.id === id)) { notifyErr('We could not remove this alert. Try again.', 'job-alert'); return; }
      setAsking(null);
      notifyOk('Alert removed', 'job-alert');
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  if (!member) return null;

  return (
    <section className="gv-ap" aria-labelledby="gv-ap-title" style={{ fontFamily: FONT }}>
      <style>{ALERTS_CSS}</style>
      <div className="gv-ap-head">
        <span className="gv-ap-icon" aria-hidden><Bell size={16} strokeWidth={2.3} /></span>
        <h2 id="gv-ap-title" className="gv-ap-title">Alerts</h2>
      </div>

      {load.kind === 'loading' && (
        <div className="gv-ap-list" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="gv-ap-row" aria-hidden>
              <span className="gv-ap-bone" style={{ width: '55%', height: 15 }} />
              <span className="gv-ap-bone" style={{ width: '80%', height: 12, marginTop: 7 }} />
            </div>
          ))}
        </div>
      )}

      {load.kind === 'failed' && (
        <div className="gv-ap-empty">
          <p className="gv-ap-line">{load.message}</p>
          <button type="button" className="gv-ap-link" onClick={() => { void read(); }}>Try again</button>
        </div>
      )}

      {load.kind === 'done' && load.alerts.length === 0 && (
        <p className="gv-ap-line">No alerts yet. Save your filters as an alert from All roles</p>
      )}

      {load.kind === 'done' && load.alerts.length > 0 && (
        <>
          <ul className="gv-ap-list">
            {load.alerts.map((a) => {
              const busy = busyId === a.id;
              return (
                <li key={a.id} className="gv-ap-row">
                  <div className="gv-ap-main">
                    <p className="gv-ap-name">{a.name}</p>
                    <p className="gv-ap-sum">{alertSummary(a.filters)}</p>
                  </div>
                  {asking === a.id ? (
                    <div className="gv-ap-ask" role="group" aria-label="Remove this alert?">
                      <span className="gv-ap-ask-q">Remove this alert?</span>
                      <button type="button" className="gv-ap-yes" onClick={() => { void remove(a.id); }} disabled={busy} aria-busy={busy || undefined}>
                        {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                        Remove
                      </button>
                      <button type="button" className="gv-ap-link" onClick={() => setAsking(null)} disabled={busy}>Keep</button>
                    </div>
                  ) : (
                    <button type="button" className="gv-ap-link" onClick={() => setAsking(a.id)} disabled={!!busyId}>Remove</button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="gv-ap-hint">We email you once a day when new roles match</p>
        </>
      )}
    </section>
  );
}

const ALERTS_CSS = `
.gv-ap{background:#FFFFFF;border-radius:20px;padding:18px 20px;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 8px 24px rgba(27,56,40,0.08);color:${INK}}
.gv-ap-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.gv-ap-icon{width:32px;height:32px;border-radius:9999px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:${FOREST};background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 2px 6px rgba(27,56,40,0.14)}
.gv-ap-title{margin:0;font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${INK}}
.gv-ap-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.gv-ap-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 14px;padding:11px 0;border-top:1px solid rgba(28,20,16,0.07)}
.gv-ap-row:first-child{border-top:none}
.gv-ap-row[aria-hidden]{display:block}
.gv-ap-main{flex:1 1 200px;min-width:0}
.gv-ap-name{margin:0;font-size:15px;font-weight:700;line-height:1.35;color:${INK};overflow-wrap:anywhere}
.gv-ap-sum{margin:2px 0 0;font-size:13.5px;line-height:1.45;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-ap-ask{display:inline-flex;align-items:center;flex-wrap:wrap;gap:10px}
.gv-ap-ask-q{font-size:14px;font-weight:600;color:${INK}}
.gv-ap-yes{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border:none;border-radius:10px;cursor:pointer;font-family:${FONT};font-size:14px;font-weight:700;color:#FFFFFF;background:#9E2A12}
.gv-ap-yes:disabled{opacity:0.6;cursor:default}
.gv-ap-link{display:inline-flex;align-items:center;min-height:36px;padding:0;background:none;border:none;cursor:pointer;font-family:${FONT};font-size:14px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-ap-link:hover:not(:disabled){color:${FOREST}}
.gv-ap-link:disabled{opacity:0.5;cursor:default}
.gv-ap-empty{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.gv-ap-line{margin:0;font-size:14.5px;line-height:1.5;color:${INK_SOFT}}
.gv-ap-hint{margin:10px 0 0;font-size:13px;line-height:1.45;color:${INK_SOFT}}
.gv-ap-bone{display:block;border-radius:6px;background:linear-gradient(90deg,#EFEAE0 0%,#F7F4EE 50%,#EFEAE0 100%);background-size:200% 100%;animation:gvApBone 1.3s ease-in-out infinite}
@keyframes gvApBone{from{background-position:100% 0}to{background-position:-100% 0}}
.gv-ap :is(button,a):focus{outline:none}
.gv-ap :is(button,a):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gv-ap-bone{animation:none}}
`;
