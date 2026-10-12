'use client';

// StripeState — where the conference's Stripe account stands (prompt 94),
// from connect_onboarding_status and connect_requirements (Stripe's own list
// of what it still needs; null until account.updated is switched on). Ready,
// or what Stripe still needs in plain words with "Finish onboarding", and
// "Check again" (connect-onboard 'status', then the conference is re-read).

import { useRef, useState } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { READ_ONLY_LINE } from '../dashboardKit';
import { connectStart, connectStatus, deadlineDate, requirementWords } from './paymentApi';

export function stripeIsReady(c: Conference): boolean {
  const req = c.connect_requirements;
  return c.connect_onboarding_status === 'complete' && (req?.charges_enabled ?? true);
}

export default function StripeState({ conference, countryCode, readOnly, onRefreshed, beforeLeave }: {
  conference: Conference;
  countryCode: string | null;
  readOnly: boolean;
  /** Re-read the conference after a status check. */
  onRefreshed: () => void;
  /** Called right before the page leaves for Stripe (e.g. to remember where the flow was). */
  beforeLeave?: () => void;
}) {
  const [busy, setBusy] = useState<'start' | 'status' | null>(null);
  const [err, setErr] = useState('');
  const [checked, setChecked] = useState('');
  const busyRef = useRef(false);

  const req = conference.connect_requirements;
  const due = [...(req?.past_due ?? []), ...(req?.currently_due ?? [])];
  const words = requirementWords(due);
  const deadline = deadlineDate(req?.current_deadline ?? null);
  const ready = stripeIsReady(conference);

  const start = async () => {
    if (busyRef.current || readOnly) return;
    busyRef.current = true; setBusy('start'); setErr('');
    const r = await connectStart(conference.id, countryCode);
    if ('error' in r) { setErr(r.error); busyRef.current = false; setBusy(null); return; }
    beforeLeave?.();
    window.location.assign(r.url);
  };

  const check = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy('status'); setErr(''); setChecked('');
    const r = await connectStatus(conference.id);
    busyRef.current = false; setBusy(null);
    if ('error' in r) { setErr(r.error); return; }
    setChecked(r.status === 'complete' ? 'Stripe says your account is ready' : 'Checked with Stripe just now');
    onRefreshed();
  };

  return (
    <div style={{ padding: 16, borderRadius: 14, background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ready ? (
        <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 15.5, fontWeight: 700, color: '#2A5A3C' }}>
          <CircleCheck size={20} strokeWidth={2.4} aria-hidden /> Ready. Card payments go straight to your Stripe account
        </p>
      ) : (
        <>
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 15.5, fontWeight: 700, color: '#1C1410' }}>
            <TriangleAlert size={20} strokeWidth={2.4} style={{ color: '#B6871F' }} aria-hidden /> Stripe needs a few more details
          </p>
          {words.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: '#1C1410' }}>
              {words.map(w => <li key={w}>{w}</li>)}
            </ul>
          )}
          {deadline && <p className="gv-fd-note">Stripe needs these by {deadline}</p>}
        </>
      )}
      {readOnly && <p className="gv-fd-note">{READ_ONLY_LINE}</p>}
      {err && <p className="gv-st-err" role="alert">{err}</p>}
      {checked && !err && <p className="gv-st-ok" role="status">{checked}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        {!ready && (
          <button type="button" className="gv-st-btn gv-st-forest" disabled={readOnly || busy !== null} onClick={() => { void start(); }}>
            {busy === 'start' ? 'Opening Stripe' : 'Finish onboarding'}
          </button>
        )}
        <button type="button" className="gv-st-btn gv-st-outline" disabled={busy !== null} onClick={() => { void check(); }}>
          {busy === 'status' ? 'Checking' : 'Check again'}
        </button>
      </div>
    </div>
  );
}
