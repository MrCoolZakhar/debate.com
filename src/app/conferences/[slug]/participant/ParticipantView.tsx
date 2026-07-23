'use client';

// Participant view, the person tab. Orchestrates: role pill switcher (when
// the viewer has more than one application here), the pay-gated content for
// the selected application, and Q&R, the latter never gated. Payment itself
// lives on its own /pay page now, reached from the "YOUR APPLICATION" card.
// Deliberately has no conference summary card: the page around this tab
// already is one.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { type FormBlock } from '@/lib/customQuestions';
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
  /** Conference-level financial aid config (separate application, financial_aid_requests table). */
  financialAidEnabled: boolean;
  aidBlocks: FormBlock[];
  aidIntro: string | null;
}

export default function ParticipantView({
  conferenceId, conferenceSlug, conferenceStartDate, myApplications, roleConfigs, myAllocation, committees, allocationSwapMode,
}: ParticipantViewProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Deep-link the active role via ?role=head-delegate (alongside the
  // ?tab=participant param ConferenceDetailClient already reads the same
  // way), so a refresh or a shared link lands on the role that was showing
  // rather than always the default pick. Read post-mount from
  // window.location.search rather than useSearchParams(), same reason
  // ConferenceDetailClient avoids it: no Suspense boundary requirement.
  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get('role');
    if (!role) return;
    const match = myApplications.find(a => a.role === role);
    if (match) setSelectedId(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectApplication(app: ParticipantApplication) {
    setSelectedId(app.id);
    const url = new URL(window.location.href);
    url.searchParams.set('role', app.role);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  if (!user) {
    return <ApplyPointer conferenceSlug={conferenceSlug} signedOut />;
  }
  if (myApplications.length === 0) {
    return <ApplyPointer conferenceSlug={conferenceSlug} signedOut={false} />;
  }

  const selected = myApplications.find(a => a.id === selectedId) ?? pickDefault(myApplications);
  const roleConfig = roleConfigs.find(rc => rc.role === selected.role) ?? null;
  const paymentTiming = roleConfig?.payment_timing ?? 'anytime';
  const gateState = getGateState(paymentTiming, selected.status, selected.payment_status);

  return (
    <div className="flex flex-col gap-6">
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
