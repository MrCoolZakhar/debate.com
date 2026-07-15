'use client';

// Financial aid review, organizer side. Aid is a SEPARATE application
// (financial_aid_requests table) from the conference application itself —
// reviewing/granting here never touches the applicant's application row
// except for the one explicit side effect: a full grant also waives payment.

import { useCallback, useEffect, useState } from 'react';
import { Check, HeartHandshake, TriangleAlert, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { queueEventEmail, notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { formatFee } from '@/lib/utils';
import { activePhaseFee, type FeePhase } from '@/lib/finance';
import { NEU, OUTFIT } from '@/components/neu';

interface AidQuestion {
  id: string;
  label: string;
  required: boolean;
  type: string;
}

interface AidRequestRow {
  id: string;
  application_id: string;
  user_id: string;
  statement: string | null;
  requested_amount: number | null;
  custom_answers: Record<string, string> | null;
  status: 'pending' | 'approved' | 'denied';
  granted_amount: number | null;
  reviewed_at: string | null;
  created_at: string;
  applications: {
    id: string;
    role: string;
    payment_status: string;
    profiles: { display_name: string; email: string } | null;
  } | null;
}

interface RoleFee {
  role: string;
  fee_amount: number | null;
  fee_currency: string | null;
  fee_phases: FeePhase[] | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    delegate: 'Delegate', chair: 'Chair', 'head-delegate': 'Head Delegate',
    'faculty-advisor': 'Faculty Advisor', observer: 'Observer',
  };
  return map[role] ?? role;
}

const STATUS_STYLES: Record<AidRequestRow['status'], { bg: string; color: string; border: string; label: string }> = {
  pending: { bg: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: 'rgba(184,132,74,0.42)', label: 'PENDING' },
  approved: { bg: 'rgba(61,122,82,0.17)', color: '#2A5A3C', border: 'rgba(61,122,82,0.45)', label: 'APPROVED' },
  denied: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52', border: 'rgba(154,138,120,0.35)', label: 'DENIED' },
};

function StatusChip({ status }: { status: AidRequestRow['status'] }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
      style={{ fontSize: 9, fontFamily: OUTFIT, letterSpacing: '0.08em', backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

export default function AidRequestsSection({ conferenceId, conferenceSlug, aidQuestions }: { conferenceId: string; conferenceSlug: string; aidQuestions: AidQuestion[] }) {
  const { session } = useAuth();
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const { confirm, modal: confirmModal } = useConfirmModal();

  const [requests, setRequests] = useState<AidRequestRow[]>([]);
  const [roleFees, setRoleFees] = useState<RoleFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | AidRequestRow['status']>('pending');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const loadRequests = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [reqRes, cfgRes] = await Promise.all([
      supabase
        .from('financial_aid_requests')
        .select(`
          id, application_id, user_id, statement, requested_amount, custom_answers, status, granted_amount, reviewed_at, created_at,
          applications (id, role, payment_status, profiles (display_name, email))
        `)
        .eq('conference_id', conferenceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('application_role_configs')
        .select('role, fee_amount, fee_currency, fee_phases')
        .eq('conference_id', conferenceId),
    ]);
    setRequests((reqRes.data ?? []) as unknown as AidRequestRow[]);
    setRoleFees((cfgRes.data ?? []) as RoleFee[]);
    setLoading(false);
  }, [conferenceId, session]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  function roleFeeFor(role: string): { amount: number; currency: string } {
    const rc = roleFees.find(r => r.role === role);
    const { amount } = activePhaseFee({ fee_amount: rc?.fee_amount ?? 0, fee_phases: rc?.fee_phases ?? null });
    return { amount: amount ?? 0, currency: rc?.fee_currency ?? 'GBP' };
  }

  const filtered = requests.filter(r => statusFilter === 'all' || r.status === statusFilter);
  const reviewing = requests.find(r => r.id === reviewId) ?? null;

  function openReview(r: AidRequestRow) {
    setActionError('');
    setGrantAmount(r.requested_amount != null ? String(r.requested_amount) : '');
    setReviewId(r.id);
  }

  async function handleApprove(r: AidRequestRow) {
    if (!session || busyId || !r.applications) return;
    const granted = parseFloat(grantAmount);
    if (Number.isNaN(granted) || granted < 0) {
      setActionError('Enter a valid amount to grant.');
      return;
    }
    setBusyId(r.id);
    setActionError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBusyId(null);
      setActionError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase
      .from('financial_aid_requests')
      .update({ status: 'approved', granted_amount: granted, reviewed_at: new Date().toISOString() })
      .eq('id', r.id)
      .select('id');
    if (error || !data || data.length !== 1) {
      setBusyId(null);
      setActionError(error ? error.message : 'Could not save the decision. Please try again.');
      return;
    }

    // Full grant: nothing is owed, waive the application's fee so they have access.
    const { amount: fee } = roleFeeFor(r.applications.role);
    if (granted >= fee) {
      const { data: waiveData, error: waiveError } = await supabase
        .from('applications')
        .update({ payment_status: 'waived' })
        .eq('id', r.application_id)
        .select('id');
      if (waiveError || !waiveData || waiveData.length !== 1) {
        setBusyId(null);
        setActionError('Aid approved, but marking the fee as waived failed. Please waive it manually from Applications.');
        await loadRequests();
        return;
      }
    }

    try {
      const result = await queueEventEmail(supabase, conferenceId, 'aid_approved', [r.application_id]);
      notifyIfNeeded(result, pushDraftNotice);
    } catch {
      setActionError('Aid approved, but the notification email could not be queued.');
    }

    setBusyId(null);
    setReviewId(null);
    await loadRequests();
  }

  async function openDenyConfirm(r: AidRequestRow) {
    if (!session || busyId) return;
    const { confirmed } = await confirm({
      title: 'Deny this aid request?',
      body: 'The applicant will be notified. The standard fee still applies, and their conference application is not affected.',
      confirmLabel: 'Deny Aid',
      danger: true,
    });
    if (!confirmed) return;
    handleDeny(r);
  }

  async function handleDeny(r: AidRequestRow) {
    if (!session || busyId) return;
    setBusyId(r.id);
    setActionError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBusyId(null);
      setActionError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase
      .from('financial_aid_requests')
      .update({ status: 'denied', reviewed_at: new Date().toISOString() })
      .eq('id', r.id)
      .select('id');
    if (error || !data || data.length !== 1) {
      setBusyId(null);
      setActionError(error ? error.message : 'Could not save the decision. Please try again.');
      return;
    }
    try {
      const result = await queueEventEmail(supabase, conferenceId, 'aid_denied', [r.application_id]);
      notifyIfNeeded(result, pushDraftNotice);
    } catch {
      setActionError('Aid denied, but the notification email could not be queued.');
    }
    setBusyId(null);
    setReviewId(null);
    await loadRequests();
  }

  const FILTER_TABS: { value: 'all' | AidRequestRow['status']; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div>
      <DraftNoticeList
        notices={draftNotices}
        conferenceSlug={conferenceSlug}
        onDismiss={dismissDraftNotice}
        onTurnOn={async (eventKey) => {
          if (!session) return;
          const supabase = getAuthedClient(session.access_token);
          await turnOnDefaultEmail(supabase, conferenceId, eventKey);
        }}
      />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {FILTER_TABS.map(tab => {
          const active = statusFilter === tab.value;
          const count = tab.value === 'all' ? requests.length : requests.filter(r => r.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className="inline-flex items-center gap-1.5 focus:outline-none"
              style={{
                padding: '7px 14px', borderRadius: 999,
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
                color: active ? NEU.gold : NEU.ink,
                backgroundColor: active ? NEU.forest : NEU.surface,
                boxShadow: active ? 'none' : NEU.outSm,
                border: 'none', cursor: 'pointer',
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {actionError && !reviewId && (
        <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 mb-4" style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)' }}>
          <TriangleAlert size={14} style={{ color: '#8B2020', marginTop: 1, flexShrink: 0 }} />
          <p className="text-[12.5px]" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.5 }}>{actionError}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16">
          <HeartHandshake size={28} style={{ color: NEU.muted, marginBottom: 10 }} />
          <p className="text-sm font-semibold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>No {statusFilter === 'all' ? '' : statusFilter} aid requests</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(r => {
            const name = r.applications?.profiles?.display_name ?? 'Unknown applicant';
            const { amount: fee, currency } = roleFeeFor(r.applications?.role ?? '');
            return (
              <button
                key={r.id}
                onClick={() => openReview(r)}
                className="w-full text-left rounded-2xl px-5 py-4 focus:outline-none transition-shadow"
                style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none' }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{name}</p>
                    <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{roleLabel(r.applications?.role ?? '')}</span>
                    <StatusChip status={r.status} />
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                      Fee {formatFee(fee, currency)}
                      {r.requested_amount != null && ` · Requested ${formatFee(r.requested_amount, currency)}`}
                      {r.status === 'approved' && r.granted_amount != null && ` · Granted ${formatFee(r.granted_amount, currency)}`}
                    </span>
                    <span className="text-[11px]" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{formatDate(r.created_at)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {reviewing && (
        <ModalOverlay onClose={() => { if (!busyId) setReviewId(null); }}>
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                {reviewing.applications?.profiles?.display_name ?? 'Unknown applicant'}
              </p>
              <StatusChip status={reviewing.status} />
            </div>
            <p className="text-xs -mt-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              {roleLabel(reviewing.applications?.role ?? '')} · Fee {formatFee(roleFeeFor(reviewing.applications?.role ?? '').amount, roleFeeFor(reviewing.applications?.role ?? '').currency)}
              {reviewing.requested_amount != null && ` · Requested ${formatFee(reviewing.requested_amount, roleFeeFor(reviewing.applications?.role ?? '').currency)}`}
            </p>

            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '0.08em' }}>STATEMENT</p>
              <p
                className="text-sm whitespace-pre-wrap"
                style={{ color: reviewing.statement ? '#1C1410' : '#9A8A78', fontFamily: OUTFIT, fontStyle: reviewing.statement ? 'normal' : 'italic' }}
              >
                {reviewing.statement || 'No statement provided.'}
              </p>
            </div>

            {aidQuestions.length > 0 && (
              <div className="flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                {aidQuestions.map(q => (
                  <div key={q.id}>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{q.label}</p>
                    <p className="text-sm" style={{ color: (reviewing.custom_answers?.[q.id] ?? '').trim() ? '#1C1410' : '#9A8A78', fontFamily: OUTFIT, fontStyle: (reviewing.custom_answers?.[q.id] ?? '').trim() ? 'normal' : 'italic' }}>
                      {(reviewing.custom_answers?.[q.id] ?? '').trim() || 'No answer provided.'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {reviewing.status === 'pending' ? (
              <div className="pt-3 flex flex-col gap-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Amount to grant
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                    style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
                  />
                  <p className="text-[11px] mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                    Granting the full fee amount also waives their remaining balance automatically.
                  </p>
                </div>

                {actionError && (
                  <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5" style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)' }}>
                    <TriangleAlert size={14} style={{ color: '#8B2020', marginTop: 1, flexShrink: 0 }} />
                    <p className="text-[12.5px]" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.5 }}>{actionError}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(reviewing)}
                    disabled={busyId === reviewing.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold focus:outline-none transition-colors"
                    style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', border: '1px solid rgba(61,122,82,0.3)', fontFamily: OUTFIT, opacity: busyId === reviewing.id ? 0.6 : 1 }}
                  >
                    <Check size={14} />
                    {busyId === reviewing.id ? 'SAVING…' : 'APPROVE AID'}
                  </button>
                  <button
                    onClick={() => openDenyConfirm(reviewing)}
                    disabled={busyId === reviewing.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold focus:outline-none transition-colors"
                    style={{ backgroundColor: 'rgba(139,32,32,0.1)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: OUTFIT, opacity: busyId === reviewing.id ? 0.6 : 1 }}
                  >
                    <X size={14} />
                    DENY AID
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #F0EDE6' }}>
                {reviewing.status === 'approved' ? <Check size={14} style={{ color: '#2A5A3C' }} /> : <X size={14} style={{ color: '#6B5F52' }} />}
                <p className="text-xs" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
                  {reviewing.status === 'approved'
                    ? `Approved${reviewing.granted_amount != null ? `, granted ${formatFee(reviewing.granted_amount, roleFeeFor(reviewing.applications?.role ?? '').currency)}` : ''}${reviewing.reviewed_at ? ` on ${formatDate(reviewing.reviewed_at)}` : ''}.`
                    : `Denied${reviewing.reviewed_at ? ` on ${formatDate(reviewing.reviewed_at)}` : ''}.`}
                </p>
              </div>
            )}

            <button
              onClick={() => setReviewId(null)}
              className="rounded-xl py-2 text-sm font-semibold focus:outline-none"
              style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
            >
              CLOSE
            </button>
          </div>
        </ModalOverlay>
      )}

      {confirmModal}
    </div>
  );
}
