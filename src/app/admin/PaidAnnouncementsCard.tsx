'use client';

// Gavelling staff → Data → Paid announcements: the review queue.
// Every announcement an organiser paid for waits here until a platform admin
// approves it (it then sends, paced, through queue_paid_announcements_tick) or
// rejects it with a reason the organiser reads (their credits go back).
// Contract: scratch-paid-announcements.sql (not applied yet). Platform admins
// only, enforced by the functions. Before the SQL exists the card says so.

import { useCallback, useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuIconDisc } from '@/components/neu';
import {
  loadAdminAnnouncements, reviewAnnouncement, placeName, statusWords,
  type AdminAnnouncementItem, type AnnouncementStatus,
} from '@/lib/paidAnnouncements';

const TABS: { key: AnnouncementStatus | null; label: string }[] = [
  { key: 'in_review', label: 'To review' },
  { key: 'sending', label: 'Sending' },
  { key: 'sent', label: 'Sent' },
  { key: 'rejected', label: 'Rejected' },
  { key: null, label: 'All' },
];

export default function PaidAnnouncementsCard() {
  const [tab, setTab] = useState<AnnouncementStatus | null>('in_review');
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [items, setItems] = useState<AdminAnnouncementItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    const a = await loadAdminAnnouncements(tab);
    if (a.kind === 'missing') { setState('missing'); return; }
    if (a.kind !== 'ok') { setState('error'); return; }
    setItems(a.data);
    setState('ready');
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, approve: boolean) {
    if (!approve && !reason.trim()) { setMsg('Write the reason the organiser will read.'); return; }
    setBusy(true);
    setMsg('');
    const a = await reviewAnnouncement(id, approve, approve ? null : reason.trim());
    setBusy(false);
    if (a.kind === 'ok') { setMsg(a.data); setReason(''); setOpenId(null); void load(); }
    else setMsg(a.kind === 'refused' ? a.message : 'That did not work. Try again.');
  }

  return (
    <NeuCard className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Megaphone} size={40} />
        <div>
          <h3 style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 18, color: NEU.ink }}>Paid announcements</h3>
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>Approve before anything sends. Rejecting returns the credits.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.label}
            type="button"
            onClick={() => { setTab(t.key); setOpenId(null); }}
            className="focus:outline-none"
            style={{
              fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
              border: 'none', backgroundColor: tab === t.key ? '#1B3828' : 'rgba(27,56,40,0.07)', color: tab === t.key ? '#FFFFFF' : NEU.ink,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, marginBottom: 10 }}>{msg}</p>}

      {state === 'loading' && <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>Loading…</p>}
      {state === 'missing' && <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>Not set up yet. Apply scratch-paid-announcements.sql first.</p>}
      {state === 'error' && <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020' }}>Could not load the queue.</p>}
      {state === 'ready' && items.length === 0 && <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>Nothing here.</p>}

      {state === 'ready' && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map(i => (
            <div key={i.id} className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', boxShadow: NEU.ring }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>
                    {i.acronym || i.conference} · to {placeName(i.scope, i.target)} · {i.quoted_reach.toLocaleString()} people · {i.credits} credits
                  </p>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 16, color: NEU.ink, overflowWrap: 'anywhere' }}>{i.heading}</p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{i.body}</p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, marginTop: 6 }}>
                    {statusWords(i.status)}{i.status === 'sending' || i.status === 'sent' ? ` · ${i.reached} reached · ${i.clicked} clicked` : ''}
                    {i.reject_reason ? ` · Reason: ${i.reject_reason}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpenId(openId === i.id ? null : i.id)} style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 10, border: '1.5px solid #1C1410', background: '#FFFFFF', cursor: 'pointer' }}>
                    {openId === i.id ? 'Close' : 'Preview'}
                  </button>
                </div>
              </div>
              {openId === i.id && (
                <div className="mt-3">
                  {i.preview_html && (
                    <iframe title="Announcement preview" srcDoc={i.preview_html} sandbox="" style={{ width: '100%', height: 460, border: '1px solid rgba(27,56,40,0.12)', borderRadius: 10, background: '#FFFFFF' }} />
                  )}
                  {i.status === 'in_review' && (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={2} placeholder="Reason for rejecting (the organiser reads this)" style={{ fontFamily: OUTFIT, fontSize: 14, padding: 10, borderRadius: 10, border: '1px solid rgba(27,56,40,0.2)' }} />
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => void decide(i.id, true)} style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, padding: '8px 16px', borderRadius: 10, border: 'none', color: '#FFFFFF', background: 'linear-gradient(90deg,#1B3828,#2A5A3C)', cursor: 'pointer' }}>Approve and send</button>
                        <button type="button" disabled={busy} onClick={() => void decide(i.id, false)} style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, padding: '8px 16px', borderRadius: 10, border: '1.5px solid #8B2020', color: '#8B2020', background: '#FFFFFF', cursor: 'pointer' }}>Reject and refund</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </NeuCard>
  );
}
