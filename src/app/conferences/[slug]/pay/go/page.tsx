'use client';

// /conferences/[slug]/pay/go — "Taking You to the Payment Page" (prompt 101).
// The Pay click on /pay opens THIS tab inside the click (a tab a timer opens
// is blocked by browsers), then sends it here once the started payment
// exists. Here it counts down "Opening in 5" with dots cycling through each
// second, then replaces itself with the conference's payment link. "Go now"
// goes at once. Only https:// links are followed. Kept out of search by the
// X-Robots-Tag on /conferences/:slug/pay/:path* (next.config.ts).

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { PAY_CSS, INK, INK_SOFT } from '../payKit';
import { readPayOverview } from '../payApi';

const SECONDS = 5;
const STEPS_PER_SECOND = 3;

type State =
  | { kind: 'loading' }
  | { kind: 'go'; url: string }
  | { kind: 'nolink' }
  | { kind: 'error'; text: string };

function safeHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export default function PayGoPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [conf, setConf] = useState<{ acronym: string | null; full_name: string; logo_url: string | null } | null>(null);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    let alive = true;
    (async () => {
      try {
        const c = await getFreshAuthedClient();
        if (!c) throw new Error('session');
        const { data } = await c.from('conferences').select('id, acronym, full_name, logo_url').eq('slug', slug).maybeSingle();
        const row = data as { id: string; acronym: string | null; full_name: string; logo_url: string | null } | null;
        if (!alive) return;
        if (!row) { setState({ kind: 'nolink' }); return; }
        setConf(row);
        const o = await readPayOverview(row.id);
        if (!alive) return;
        const url = safeHttps(o.conference.payment_url);
        setState(url ? { kind: 'go', url } : { kind: 'nolink' });
      } catch (e) {
        if (alive) setState({ kind: 'error', text: friendlyError(e, 'The payment page could not be found. Go back to your payments tab') });
      }
    })();
    return () => { alive = false; };
  }, [slug, user, authLoading]);

  // The countdown: three steps a second, the dots cycling ".", "..", "...".
  useEffect(() => {
    if (state.kind !== 'go') return;
    const t = setInterval(() => setStep(s => s + 1), 1000 / STEPS_PER_SECOND);
    return () => clearInterval(t);
  }, [state.kind]);

  useEffect(() => {
    if (state.kind === 'go' && step >= SECONDS * STEPS_PER_SECOND) window.location.replace(state.url);
  }, [state, step]);

  const left = Math.max(1, SECONDS - Math.floor(step / STEPS_PER_SECOND));
  const dots = '.'.repeat((step % STEPS_PER_SECOND) + 1);

  return (
    <main className="gv-pay min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: '#EDE7D8' }}>
      <style>{PAY_CSS}</style>
      <div className="gv-pay-card" style={{ width: '100%', maxWidth: 440, padding: '32px 28px', textAlign: 'center' }}>
        {conf?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={conf.logo_url} alt="" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 999, margin: '0 auto 10px', display: 'block' }} />
        )}
        {conf && <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: INK_SOFT, letterSpacing: '0.04em', overflowWrap: 'anywhere' }}>{conf.acronym || conf.full_name}</p>}
        <h1 style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: INK }}>Taking You to the Payment Page</h1>

        {!authLoading && !user ? (
          <div style={{ marginTop: 18 }}>
            <button type="button" className="gv-pay-btn gv-pay-forest" onClick={() => openAuth({ next: `/conferences/${slug}/pay/go` })}>Sign in to continue</button>
          </div>
        ) : state.kind === 'go' ? (
          <>
            <p style={{ margin: '12px 0 0', fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} aria-live="off">
              Opening in {left}<span style={{ display: 'inline-block', width: '1.2em', textAlign: 'left' }}>{dots}</span>
            </p>
            <div style={{ marginTop: 18 }}>
              <button type="button" className="gv-pay-btn gv-pay-forest" onClick={() => window.location.replace(state.url)}>
                <ExternalLink size={16} strokeWidth={2.4} aria-hidden /> Go now
              </button>
            </div>
          </>
        ) : state.kind === 'nolink' ? (
          <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: INK_SOFT }}>This conference has not added a payment page link yet. Go back to your payments tab</p>
        ) : state.kind === 'error' ? (
          <p className="gv-pay-err" role="alert" style={{ marginTop: 12 }}>{state.text}</p>
        ) : (
          <p className="gv-pay-quiet" style={{ marginTop: 12 }} aria-live="polite">Finding the payment page</p>
        )}
      </div>
    </main>
  );
}
