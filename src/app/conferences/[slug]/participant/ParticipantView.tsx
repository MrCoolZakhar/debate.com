'use client';

// Participant view, the person tab. Orchestrates: role pill switcher (when
// the viewer has more than one application here), the pay-gated content for
// the selected application, and Q&R, the latter never gated. Payment itself
// lives on its own /pay page now, reached from the "YOUR APPLICATION" card.
// Deliberately has no conference summary card: the page around this tab
// already is one.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { type FormBlock } from '@/lib/customQuestions';
import { SectionCardSkeleton } from '@/components/Skeleton';
import { SectionCard, OUTFIT, getGateState, roleLabel, statusPriority } from './shared';
import { PayGate, RejectedCard } from './PayGate';
import DelegateParticipant from './DelegateParticipant';
import AdvisorParticipant from './AdvisorParticipant';
import ChairParticipant from './ChairParticipant';
import ObserverParticipant from './ObserverParticipant';
import RequestsPanel from './RequestsPanel';
import ApplyPointer from './ApplyPointer';
import type { ParticipantApplication, ParticipantRoleConfig, ParticipantAllocation, ParticipantCommittee } from './types';

const DELEGATE_ROLES = new Set(['delegate', 'head-delegate']);

function RolePlaceholder({ role }: { role: string }) {
  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center py-10">
        <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          Your {roleLabel(role).toLowerCase()} dashboard is coming soon
        </p>
        <p className="text-[13px] max-w-[340px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          Role-specific tools for {roleLabel(role).toLowerCase()}s are on the way.
        </p>
      </div>
    </SectionCard>
  );
}

const STATUS_DOT: Record<string, string> = {
  assigned: '#3D7A52', 'checked-in': '#3D7A52', accepted: '#B6871F', submitted: '#9A8A78',
  rejected: '#8B2020', withdrawn: '#9A8A78',
};

function pickDefault(apps: ParticipantApplication[]): ParticipantApplication {
  return [...apps].sort((a, b) => statusPriority(a.status) - statusPriority(b.status))[0];
}

export interface ParticipantViewProps {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  myApplications: ParticipantApplication[];
  roleConfigs: ParticipantRoleConfig[];
  myAllocation: ParticipantAllocation | null;
  committees: ParticipantCommittee[];
  allocationSwapMode: string;
  /** True when the viewer runs this conference — they never "apply", so the
   *  empty state should say they're the organizer, not "you haven't applied". */
  isOrganizer?: boolean;
  /** Conference-level financial aid config (separate application, financial_aid_requests table). */
  financialAidEnabled: boolean;
  aidBlocks: FormBlock[];
  aidIntro: string | null;
  /** The role segment from /conferences/[slug]/role/[role], or null on the
   *  bare /role resolver route. Whenever this doesn't match a role the
   *  viewer actually holds (missing, wrong, or stale), the effect below
   *  redirects to their default role's URL. */
  initialRole: string | null;
  /** True until this viewer's own applications and allocation for this
   *  conference are actually known (auth still resolving counts as loading
   *  too). While true, every branch below, signed-out prompt, "no
   *  applications" empty state, or real content, is unreachable, so an
   *  empty state can never render as a placeholder for data that just
   *  hasn't arrived yet. */
  participantDataLoading: boolean;
  /** > 0 when claim_my_imported_applications just attached previously
   *  unclaimed imported applications/allocations to this signed-in user on
   *  this load (an existing account whose organizer imported them, the
   *  counterpart to the signup claim flow). Drives a one-time quiet notice
   *  below; 0 means nothing changed. */
  justClaimedCount: number;
}

export default function ParticipantView({
  conferenceId, conferenceSlug, conferenceStartDate, myApplications, roleConfigs, myAllocation, committees, allocationSwapMode, isOrganizer = false,
  initialRole, participantDataLoading, justClaimedCount,
}: ParticipantViewProps) {
  const { user } = useAuth();
  const router = useRouter();
  const holdsInitialRole = !!initialRole && myApplications.some(a => a.role === initialRole);
  // Dismissible, not persisted anywhere, "dismissed on navigation" falls out
  // naturally: this component remounts fresh on every real route
  // navigation, so leaving and coming back never resurrects a stale notice.
  const [claimNoticeDismissed, setClaimNoticeDismissed] = useState(false);

  // Resolver (/role) and "not holding that role" fallback (/role/[role] for
  // a role the viewer doesn't actually have) both land here: once
  // applications are known, redirect to the default role's real URL.
  useEffect(() => {
    if (!user || myApplications.length === 0 || holdsInitialRole) return;
    const target = pickDefault(myApplications).role;
    router.replace(`/conferences/${conferenceSlug}/role/${target}`);
  }, [user, myApplications, holdsInitialRole, conferenceSlug, router]);

  function selectApplication(app: ParticipantApplication) {
    router.push(`/conferences/${conferenceSlug}/role/${app.role}`);
  }

  if (participantDataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <SectionCardSkeleton />
        <SectionCardSkeleton />
      </div>
    );
  }

  if (!user) {
    const next = `/conferences/${conferenceSlug}/role${initialRole ? `/${initialRole}` : ''}`;
    return <ApplyPointer conferenceSlug={conferenceSlug} signedOut next={next} />;
  }
  // The organizer never "applies" to their own conference — don't nudge them
  // to apply; tell them they run it and point to the manage dashboard.
  if (isOrganizer && myApplications.length === 0) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center text-center py-8">
          <div
            className="flex items-center justify-center mb-4"
            style={{ width: 56, height: 56, borderRadius: 9999, backgroundColor: 'rgba(42,90,60,0.12)', border: '1px solid rgba(42,90,60,0.28)' }}
          >
            <span aria-hidden style={{ fontSize: 26 }}>🪑</span>
          </div>
          <p className="text-[16px] font-extrabold mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            You&apos;re the organizer
          </p>
          <p className="text-[13.5px] mb-5 max-w-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
            You run this conference — there&apos;s nothing to apply for here. Manage applications,
            committees and your public page from the organizer dashboard.
          </p>
          <Link
            href={`/manage/${conferenceSlug}`}
            className="inline-flex items-center gap-2 rounded-full"
            style={{ padding: '11px 20px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, letterSpacing: '0.03em', textDecoration: 'none' }}
          >
            Manage conference →
          </Link>
        </div>
      </SectionCard>
    );
  }
  if (myApplications.length === 0) {
    return <ApplyPointer conferenceSlug={conferenceSlug} signedOut={false} />;
  }

  // While the redirect effect above corrects a missing or unheld role in the
  // URL, render the eventual default selection rather than flashing the
  // wrong role's content in the meantime.
  const selected = (holdsInitialRole ? myApplications.find(a => a.role === initialRole) : null) ?? pickDefault(myApplications);
  const roleConfig = roleConfigs.find(rc => rc.role === selected.role) ?? null;
  const paymentTiming = roleConfig?.payment_timing ?? 'anytime';
  const gateState = getGateState(paymentTiming, selected.status, selected.payment_status);

  return (
    <div className="flex flex-col gap-6">
      {justClaimedCount > 0 && !claimNoticeDismissed && (
        <SectionCard className="!py-3 !px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px]" style={{ color: '#2A5A3C', fontFamily: OUTFIT }}>
              We found your registration and attached it to your account.
            </p>
            <button
              onClick={() => setClaimNoticeDismissed(true)}
              className="flex-shrink-0 focus:outline-none"
              style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </SectionCard>
      )}

      {myApplications.length > 1 && (
        <SectionCard className="!p-3">
          <div className="flex flex-wrap gap-1.5">
            {myApplications.map(app => {
              const active = app.id === selected.id;
              return (
                <button
                  key={app.id}
                  onClick={() => selectApplication(app)}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold focus:outline-none transition-colors"
                  style={{
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    color: active ? '#EED98A' : '#6B5F52',
                    border: active ? 'none' : '1px solid #DDD4C0',
                    fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: STATUS_DOT[app.status] ?? '#9A8A78', flexShrink: 0 }} />
                  {roleLabel(app.role)}
                </button>
              );
            })}
          </div>
        </SectionCard>
      )}

      {selected.status === 'rejected' ? (
        // Payment and role content are meaningless once rejected, replaces
        // both rather than gating them (a rejection isn't a PayGate state).
        <RejectedCard
          conferenceSlug={conferenceSlug}
          role={selected.role}
          organizerNote={selected.organizer_note}
          allowResubmission={roleConfig?.allow_resubmission ?? false}
        />
      ) : (
        <>
          {selected.status === 'submitted' && (
            <SectionCard className="!py-4 !px-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[13px]" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
                  Need to change something before it&apos;s reviewed?
                </p>
                <Link
                  href={`/conferences/${conferenceSlug}/apply?role=${selected.role}&edit=1`}
                  className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-3.5 text-xs font-bold focus:outline-none transition-colors flex-shrink-0"
                  style={{ border: '1px solid #DDD4C0', color: '#1C1410', textDecoration: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <Pencil size={12} />
                  EDIT APPLICATION
                </Link>
              </div>
            </SectionCard>
          )}

          <PayGate gateState={gateState}>
            {DELEGATE_ROLES.has(selected.role) ? (
              <DelegateParticipant
                conferenceId={conferenceId}
                conferenceSlug={conferenceSlug}
                conferenceStartDate={conferenceStartDate}
                application={selected}
                myAllocation={myAllocation}
                committees={committees}
                allocationSwapMode={allocationSwapMode}
              />
            ) : selected.role === 'faculty-advisor' ? (
              <AdvisorParticipant
                conferenceId={conferenceId}
                conferenceStartDate={conferenceStartDate}
                application={selected}
                allocationSwapMode={allocationSwapMode}
              />
            ) : selected.role === 'chair' ? (
              <ChairParticipant conferenceId={conferenceId} conferenceSlug={conferenceSlug} />
            ) : selected.role === 'observer' ? (
              <ObserverParticipant conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} />
            ) : (
              <RolePlaceholder role={selected.role} />
            )}
          </PayGate>
        </>
      )}

      <RequestsPanel conferenceId={conferenceId} applicationId={selected.id} myApplications={myApplications} activeRole={selected.role} />
    </div>
  );
}
