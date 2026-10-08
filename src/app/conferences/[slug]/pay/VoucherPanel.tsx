'use client';

// VoucherPanel — the voucher and referral code box beside the person's own
// ticket (Peter's, 7 Oct), MOVED here from page.tsx in prompt 95 with its
// logic unchanged:
//   - a referral code is checked with validate_voucher and RECORDED with
//     redeem_voucher (it discounts nothing, so it never touches an invoice);
//   - a discount voucher goes through apply_voucher, which re-nets the ticket
//     (an empty code removes it); the page re-reads afterwards;
//   - the referral already on record is read back with my_referral_code.

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { NEU, OUTFIT } from '@/components/neu';
import { money } from './payApi';

export default function VoucherPanel({ conferenceId, applicationId, discountCents, currency, onChanged }: {
  conferenceId: string;
  applicationId: string;
  /** How much a voucher already takes off the ticket (0 when none). */
  discountCents: number;
  currency: string;
  onChanged: () => void;
}) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Read back the referral code on record, once per account per conference.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase.rpc('my_referral_code', { p_conference: conferenceId });
      if (cancelled) return;
      const res = data as { ok?: boolean; code?: string | null } | null;
      if (res?.ok && res.code) setReferralCode(res.code);
    })();
    return () => { cancelled = true; };
  }, [session?.access_token, conferenceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applyVoucher(value: string) {
    if (applying || !session) return;
    setApplying(true);
    setError(null);
    const supabase = getAuthedClient(session.access_token);

    if (value) {
      const { data: vData } = await supabase.rpc('validate_voucher', {
        p_code: value,
        p_conference_id: conferenceId,
        p_context: 'conference_signup',
      });
      const v = vData as { valid?: boolean; reason?: string | null; voucher_id?: string; kind?: string } | null;
      if (v?.valid && v.kind === 'referral') {
        const { data: rData, error: rError } = await supabase.rpc('redeem_voucher', {
          p_voucher_id: v.voucher_id,
          p_context: 'conference_signup',
          p_application_id: applicationId,
        });
        const redeemed = rData as { ok?: boolean; reason?: string } | null;
        setApplying(false);
        // 'already_redeemed' is the happy path on a second press.
        if (rError || !(redeemed?.ok || redeemed?.reason === 'already_redeemed')) {
          setError(friendlyError(rError, 'Could not record that referral code. Please try again.'));
          return;
        }
        setReferralCode(value);
        setCode('');
        return;
      }
    }

    const { data, error: rpcError } = await supabase.rpc('apply_voucher', {
      p_application_id: applicationId,
      p_code: value,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    setApplying(false);
    if (rpcError || !result?.ok) {
      setError(result?.error ? plainOrFallback(result.error, 'Could not apply that code. Please try again.') : friendlyError(rpcError, 'Could not apply that code. Please try again.'));
      return;
    }
    if (!value) setCode('');
    onChanged();
  }

  if (referralCode) {
    return (
      <div style={{ marginTop: 8 }}>
        <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.green, margin: 0 }}>Referral code applied</p>
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, margin: '2px 0 0', overflowWrap: 'anywhere' }}>
          {referralCode}. It records who referred you and does not change your fee
        </p>
      </div>
    );
  }

  if (!open && discountCents === 0) {
    return (
      <button type="button" className="gv-pay-link" style={{ marginTop: 8, fontSize: 13 }} onClick={() => setOpen(true)}>
        Have a voucher or referral code?
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label htmlFor={`gv-voucher-${applicationId}`} style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 700, color: NEU.inkSoft, fontFamily: OUTFIT }}>
        Voucher or referral code
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`gv-voucher-${applicationId}`}
          type="text"
          value={code}
          // Uppercase the STATE, not just the pixels: apply_voucher matches case sensitively.
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="For example EARLYBIRD10"
          className="flex-1 min-w-0 uppercase focus:outline-none"
          style={{ height: 44, padding: '0 12px', borderRadius: 12, border: '1.5px solid rgba(27,56,40,0.25)', background: '#FFFFFF', color: NEU.ink, fontFamily: OUTFIT, fontSize: 16 }}
        />
        <button type="button" className="gv-pay-btn gv-pay-outline" style={{ minHeight: 44 }}
          onClick={() => applyVoucher(code.trim().toUpperCase())} disabled={applying || !code.trim()}>
          {applying ? 'Applying' : 'Apply'}
        </button>
      </div>
      {discountCents > 0 ? (
        <div className="flex items-center justify-between gap-3" style={{ marginTop: 6 }}>
          <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.green, fontWeight: 700 }}>
            Voucher applied: {money(discountCents, currency)} off
          </span>
          <button type="button" className="gv-pay-link" style={{ color: '#8B2020', fontSize: 13 }} onClick={() => applyVoucher('')} disabled={applying}>
            Remove
          </button>
        </div>
      ) : (
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, margin: '6px 0 0' }}>
          A voucher comes off before you pay. A referral code records who referred you and changes nothing you pay
        </p>
      )}
      {error && <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', margin: '6px 0 0' }}>{error}</p>}
    </div>
  );
}
