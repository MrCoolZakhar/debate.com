'use client';

// "Your delegation" on a double-delegation seat (owner, 24 Sep 2026: "they
// should be able to see the name and email of their double delegate. Make
// sure they are set up to share a delegate portal"). Both seat holders of the
// same committee + country see the same card: the partner, the shared seat,
// the shared position paper and the shared live-session seat.
//
// What is shared, and where it already was:
// • The partner's name and email come from `my_co_delegates(conference)`, a
//   SECURITY DEFINER read that answers for the CALLER's own allocations only.
//   Profiles RLS would not give an email to a seatmate, so this is the one
//   read path for it.
// • The position paper is one row per (committee, country); the seatmate RLS
//   policies on `position_papers` already let either holder read and submit it.
// • The live seat is one delegation: `delegate_seat_claims` capacity is the
//   slot's delegation_size, so both can hold it at once.
// Renders nothing on a single seat.

import { useEffect, useState } from 'react';
import { Users, Copy, Check, FileText, Radio, Armchair } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { FlagImg } from '@/components/FlagImg';
import ProfileLink from '@/components/ProfileLink';
import { SectionCard, OUTFIT } from './shared';
import type { ParticipantAllocation } from './types';

interface CoDelegateRow {
  allocation_id: string;
  committee_name: string;
  committee_abbreviation: string | null;
  country_code: string;
  country_name: string;
  my_seat: number | null;
  capacity: number;
  partner_user_id: string | null;
  partner_name: string | null;
  partner_email: string | null;
  partner_avatar_url: string | null;
  partner_seat: number | null;
}

const PAPER_WORDS: Record<string, string> = {
  submitted: 'Submitted, waiting for the chairs',
  approved: 'Approved by the chairs',
  rejected: 'Returned by the chairs',
};

function initials(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export default function CoDelegateCard({ conferenceId, myAllocation }: {
  conferenceId: string;
  myAllocation: ParticipantAllocation | null;
}) {
  const { session } = useAuth();
  const [row, setRow] = useState<CoDelegateRow | null>(null);
  const [paperStatus, setPaperStatus] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const token = session?.access_token ?? null;
  const allocationId = myAllocation?.id ?? null;

  useEffect(() => {
    if (!token || !allocationId) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(token);
      const { data, error } = await supabase.rpc('my_co_delegates', { p_conference: conferenceId });
      if (cancelled || error) return;
      const mine = ((data ?? []) as CoDelegateRow[]).find(r => r.allocation_id === allocationId) ?? null;
      setRow(mine && mine.capacity >= 2 ? mine : null);
      if (mine && mine.capacity >= 2 && myAllocation) {
        const { data: paper } = await supabase
          .from('position_papers')
          .select('status')
          .eq('conference_committee_id', myAllocation.conference_committee_id)
          .eq('country_code', myAllocation.country_code)
          .maybeSingle();
        if (!cancelled) setPaperStatus((paper as { status: string } | null)?.status ?? null);
      }
    })().catch(() => { /* the card simply stays hidden */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, allocationId, conferenceId]);

  if (!row || !myAllocation) return null;

  const hasPartner = !!(row.partner_name || row.partner_email);
  const committeeLabel = row.committee_abbreviation || row.committee_name;
  const sessionCode = myAllocation.conference_committees?.session_code ?? null;

  function copyEmail() {
    if (!row?.partner_email) return;
    navigator.clipboard?.writeText(row.partner_email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <SectionCard>
      <div className="flex items-center gap-2.5 mb-5">
        <Users size={18} strokeWidth={2.2} style={{ color: '#1B3828' }} aria-hidden />
        <h3 className="font-bold text-[16px]" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
          Your Delegation
        </h3>
      </div>

      {/* The partner */}
      <div className="flex items-center gap-4">
        {row.partner_avatar_url ? (
          <img
            src={row.partner_avatar_url}
            alt=""
            style={{ width: 56, height: 56, borderRadius: 9999, objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(27,56,40,0.18)' }}
          />
        ) : (
          <div
            aria-hidden
            className="flex items-center justify-center font-bold"
            style={{ width: 56, height: 56, borderRadius: 9999, flexShrink: 0, backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontSize: 18 }}
          >
            {hasPartner ? initials(row.partner_name ?? row.partner_email) : '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', color: '#8A6614', margin: 0 }}>
            YOUR CO-DELEGATE
          </p>
          {hasPartner ? (
            <>
              <p className="font-bold text-[17px] [overflow-wrap:anywhere]" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: '2px 0 0' }}>
                {row.partner_name
                  ? <ProfileLink userId={row.partner_user_id} name={row.partner_name}>{row.partner_name}</ProfileLink>
                  : row.partner_email}
              </p>
              {row.partner_email && (
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <span className="text-[13px] min-w-0 [overflow-wrap:anywhere] select-all" style={{ color: '#574B40', fontFamily: OUTFIT }}>
                    {row.partner_email}
                  </span>
                  <button
                    type="button"
                    onClick={copyEmail}
                    aria-label={copied ? 'Email copied' : 'Copy email address'}
                    title={copied ? 'Copied' : 'Copy email address'}
                    className="flex items-center justify-center focus:outline-none flex-shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 9999, border: 'none', cursor: 'pointer', backgroundColor: 'rgba(27,56,40,0.07)' }}
                  >
                    {copied
                      ? <Check size={13} strokeWidth={2.6} style={{ color: '#3D7A52' }} />
                      : <Copy size={13} strokeWidth={2.4} style={{ color: '#574B40' }} />}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-[14px]" style={{ color: '#574B40', fontFamily: OUTFIT, margin: '4px 0 0' }}>
              Not assigned yet. We will email you when they are.
            </p>
          )}
        </div>
      </div>

      {/* What the two of you share */}
      <div className="mt-6 pt-5 flex flex-col gap-3.5" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
        <div className="flex items-center gap-3">
          <Armchair size={16} strokeWidth={2.2} style={{ color: '#1B3828', flexShrink: 0 }} aria-hidden />
          <FlagImg code={row.country_code} size={20} className="rounded-sm" label={row.country_name} />
          <span className="text-[13.5px]" style={{ color: '#2E2820', fontFamily: OUTFIT }}>
            One seat: <strong>{row.country_name}</strong> in {committeeLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <FileText size={16} strokeWidth={2.2} style={{ color: '#1B3828', flexShrink: 0 }} aria-hidden />
          <span className="text-[13.5px]" style={{ color: '#2E2820', fontFamily: OUTFIT }}>
            One position paper:{' '}
            {paperStatus === undefined ? '' : paperStatus ? (PAPER_WORDS[paperStatus] ?? 'Submitted') : 'not submitted yet. Either of you can submit it.'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Radio size={16} strokeWidth={2.2} style={{ color: '#1B3828', flexShrink: 0 }} aria-hidden />
          <span className="text-[13.5px]" style={{ color: '#2E2820', fontFamily: OUTFIT }}>
            {sessionCode
              ? 'One placard in the live session. You can both join the same seat, each on your own phone.'
              : 'One placard in the live session. You can both join the same seat once it opens.'}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
