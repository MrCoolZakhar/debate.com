'use client';

// Gavelling staff → Data → Email campaigns: every mass email (newsletter) and
// what it did. Per campaign: queued and sent, unique clickers and the click
// rate, clicks per link, and conversions: recipients who did a real thing in
// the 7 days after their email that they had not done in the 30 days before
// it, clickers against non-clickers and per action. The definitions live in
// admin_email_campaign_report() (scratch-email-campaigns.sql); this card only
// draws them. Platform admins only, enforced by the functions. Raw errors are
// fine here (admin exemption), but a database without the functions yet gets
// a plain empty state rather than an error.

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuIconDisc } from '@/components/neu';
import type { CampaignListItem, CampaignReport } from '@/lib/emailCampaigns';
import { int, NUM, fmtDate } from './staffBits';

const LABEL: React.CSSProperties = {
  fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7,
};

function pct(n: number, d: number): string {
  if (!d) return '0%';
  const p = (n / d) * 100;
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}

function missingFunction(e: { code?: string; message?: string }): boolean {
  return e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? '');
}

/** A big number with its word beside it (the owner's preferred way to show a count). */
function Big({ n, word, sub }: { n: string; word: string; sub?: string }) {
  return (
    <div>
      <p className="flex items-baseline gap-2 flex-wrap">
        <span style={{ fontFamily: OUTFIT, fontSize: 30, fontWeight: 900, color: NEU.ink, lineHeight: 1.05, ...NUM }}>{n}</span>
        <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.inkSoft }}>{word}</span>
      </p>
      {sub && <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function Bar({ value, top }: { value: number; top: number }) {
  return (
    <span className="flex-1" style={{ minWidth: 40, height: 9, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
      <span style={{
        display: 'block', height: '100%', borderRadius: 999,
        width: value ? `max(${((value / Math.max(1, top)) * 100).toFixed(1)}%, 9px)` : 0,
        background: `linear-gradient(90deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        transition: `width 600ms ${EASE}`,
      }} />
    </span>
  );
}

function stateOf(c: { started_at: string | null; paused_at: string | null; finished_at: string | null }): string {
  if (c.finished_at) return `Finished ${fmtDate(c.finished_at)}`;
  if (c.paused_at) return `Paused ${fmtDate(c.paused_at)}`;
  if (c.started_at) return `Sending since ${fmtDate(c.started_at)}`;
  return 'Not started';
}

function CampaignBlock({ r }: { r: CampaignReport }) {
  const sent = r.delivery.sent;
  const conv = r.conversions;
  const topLink = Math.max(1, ...r.clicks.by_link.map(l => l.clicks));
  const actions = (conv.by_action ?? []).filter(a => a.clickers + a.non_clickers > 0);
  return (
    <div style={{ padding: '16px 0', borderTop: NEU.hairline }}>
      <div className="flex items-baseline gap-2 flex-wrap mb-3">
        <h3 style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: NEU.ink, overflowWrap: 'anywhere' }}>{r.campaign.subject}</h3>
        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>{r.campaign.slug} · {stateOf(r.campaign)}</span>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Big n={int(r.queued)} word="queued" sub={`${int(sent)} sent, ${int(r.delivery.in_flight)} waiting, ${int(r.delivery.failed)} failed, ${int(r.delivery.suppressed)} unsubscribed`} />
        <Big n={int(r.clicks.unique_clickers)} word="clicked" sub={`${pct(r.clicks.unique_clickers, sent)} of sent, ${int(r.clicks.total)} clicks`} />
        <Big
          n={int(conv.clickers.converted + conv.non_clickers.converted)}
          word="converted"
          sub={`${pct(conv.clickers.converted + conv.non_clickers.converted, conv.reached)} of ${int(conv.reached)} reached${conv.window_open ? `, ${int(conv.window_open)} still inside their 7 days` : ''}`}
        />
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <div>
          <p style={LABEL}>Clickers against non-clickers</p>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {([['Clicked', conv.clickers], ['Did not click', conv.non_clickers]] as const).map(([label, g]) => (
              <div key={label} className="flex items-baseline gap-2">
                <span style={{ fontFamily: OUTFIT, fontSize: 22, fontWeight: 900, color: NEU.ink, ...NUM }}>{pct(g.converted, g.n)}</span>
                <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>
                  {label}: {int(g.converted)} of {int(g.n)} converted
                </span>
              </div>
            ))}
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 2 }}>
              Signed in since the email: {int(conv.signed_in_since.clickers)} clickers, {int(conv.signed_in_since.non_clickers)} non-clickers
            </p>
          </div>
        </div>

        <div>
          <p style={LABEL}>Clicks per link</p>
          {r.clicks.by_link.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>No links.</p>
          ) : (
            <div className="flex flex-col" style={{ gap: 7 }}>
              {r.clicks.by_link.map(l => (
                <div key={l.key} className="flex items-center gap-2.5" title={l.url}>
                  <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, width: 120, flexShrink: 0, overflowWrap: 'anywhere' }}>{l.key}</span>
                  <Bar value={l.clicks} top={topLink} />
                  <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, width: 64, textAlign: 'end', flexShrink: 0, ...NUM }}>
                    {int(l.clicks)} <span style={{ fontWeight: 500, color: NEU.inkSoft }}>({int(l.clickers)})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p style={LABEL}>Conversions per action (clicked · did not)</p>
          {actions.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>No conversions yet.</p>
          ) : (
            <div className="flex flex-col" style={{ gap: 6 }}>
              {actions.map(a => (
                <div key={a.action} className="flex items-baseline gap-2.5">
                  <span style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, flex: 1, overflowWrap: 'anywhere' }}>{a.label}</span>
                  <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.ink, flexShrink: 0, ...NUM }}>
                    {int(a.clickers)} <span style={{ fontWeight: 500, color: NEU.inkSoft }}>·</span> {int(a.non_clickers)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmailCampaignsCard() {
  const { session, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<CampaignReport[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    let alive = true;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { data, error: e } = await supabase.rpc('admin_email_campaigns');
      if (!alive) return;
      if (e) {
        if (missingFunction(e)) setMissing(true); else setError(e.message);
        return;
      }
      const list = (data ?? []) as CampaignListItem[];
      const out: CampaignReport[] = [];
      for (const c of list.slice(0, 10)) {
        const { data: rep, error: re } = await supabase.rpc('admin_email_campaign_report', { p_slug: c.slug });
        if (!alive) return;
        if (re) { setError(re.message); return; }
        if (rep && (rep as CampaignReport).found) out.push(rep as CampaignReport);
      }
      setReports(out);
    })();
    return () => { alive = false; };
  }, [authLoading, session]);

  return (
    <NeuCard style={{ padding: '18px 20px 20px' }}>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Send} size={36} />
        <div className="min-w-0 flex-1">
          <h2 style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.01em' }}>Email campaigns</h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 1 }}>
            Converted = did something new within 7 days of their email that they had not done in the 30 days before.
          </p>
        </div>
      </div>
      {missing ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, marginTop: 8 }}>
          Campaign tracking is not set up yet. It starts once scratch-email-campaigns.sql is applied.
        </p>
      ) : error ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020', marginTop: 8 }}>{error}</p>
      ) : !reports ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 8 }}>Reading…</p>
      ) : reports.length === 0 ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, marginTop: 8 }}>No campaigns yet.</p>
      ) : (
        reports.map(r => <CampaignBlock key={r.campaign.slug} r={r} />)
      )}
    </NeuCard>
  );
}
