'use client';

// Gavelling staff → Data → Cancellations: who cancelled Unlimited in the last
// 30 days and why (admin_unlimited_cancellations, platform admins only). The
// total, how many came back, the reasons as ranked bars (the chips' own
// wording) and the ten latest notes with dates. Raw errors are fine here.

import { useEffect, useState } from 'react';
import { UserMinus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuIconDisc } from '@/components/neu';
import { cancelReasonLabel } from '@/lib/subscriptionManage';
import { int, NUM, fmtDate } from './staffBits';

interface Cancellations {
  total: number;
  resumed: number;
  by_reason: { reason: string; count: number }[];
  recent: { plan: string | null; reasons: string[] | null; note: string | null; created_at: string; period_end: string | null; resumed_at: string | null }[];
}

export default function CancellationsCard() {
  const { session, loading: authLoading } = useAuth();
  const [c, setC] = useState<Cancellations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    let alive = true;
    const supabase = getAuthedClient(session.access_token);
    void supabase.rpc('admin_unlimited_cancellations', { p_days: 30 }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) { setError(e.message); return; }
      setC(data as Cancellations);
    });
    return () => { alive = false; };
  }, [authLoading, session]);

  const top = Math.max(1, ...(c?.by_reason ?? []).map(r => r.count));
  const notes = (c?.recent ?? []).filter(r => r.note && r.note.trim()).slice(0, 10);

  return (
    <NeuCard style={{ padding: '18px 20px 20px' }}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={UserMinus} size={36} />
        <div className="min-w-0 flex-1">
          <h2 style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.01em' }}>Cancellations</h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 1 }}>
            {c ? `${int(c.total)} cancelled Unlimited in 30 days, ${int(c.resumed)} resumed` : 'Unlimited, last 30 days'}
          </p>
        </div>
      </div>
      {error ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020' }}>{error}</p>
      ) : !c ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Reading…</p>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7 }}>Reasons</p>
            {c.by_reason.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Nobody gave a reason yet.</p>
            ) : (
              <div className="flex flex-col" style={{ gap: 7 }}>
                {c.by_reason.map(r => (
                  <div key={r.reason} className="flex items-center gap-2.5">
                    <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, width: 170, flexShrink: 0 }}>{cancelReasonLabel(r.reason)}</span>
                    <span className="flex-1" style={{ minWidth: 40, height: 9, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                      <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `max(${((r.count / top) * 100).toFixed(1)}%, 9px)`, background: `linear-gradient(90deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`, transition: `width 600ms ${EASE}` }} />
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, width: 36, textAlign: 'end', flexShrink: 0, ...NUM }}>{int(r.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7 }}>Latest notes</p>
            {notes.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>No notes yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notes.map((n, i) => (
                  <li key={`${n.created_at}-${i}`} style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                    <span style={{ color: NEU.inkSoft, fontWeight: 700 }}>{fmtDate(n.created_at)}{n.plan ? ` · ${n.plan.replace('unlimited_', '')}` : ''}{n.resumed_at ? ' · resumed' : ''}</span>
                    <br />
                    &ldquo;{n.note}&rdquo;
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </NeuCard>
  );
}
