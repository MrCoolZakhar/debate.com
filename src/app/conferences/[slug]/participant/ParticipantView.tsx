'use client';

// Participant view, the person tab. Orchestrates: role pill switcher (when
// the viewer has more than one application here), the pay-gated content for
// the selected application, and Q&R, the latter never gated. Payment itself
// lives on its own /pay page now, reached from the "YOUR APPLICATION" card.
// Deliberately has no conference summary card: the page around this tab
// already is one.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Briefcase, ClipboardList, CreditCard, FileText, Gavel, Landmark, LayoutDashboard, LifeBuoy, LogOut, MessageCircle, Pencil, Radio, Users, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { roleFeeToday } from '@/lib/freeRegistration';
import { type FormBlock } from '@/lib/customQuestions';
import { SectionCardSkeleton } from '@/components/Skeleton';
import { SectionCard, OUTFIT, CARD_SHADOW, getGateState, roleLabel, statusPriority } from './shared';
import { RejectedCard, WithdrawnCard } from './PayGate';
import { DashboardShell, DashCard, OutlineLink, Pane, StatusRow, NextStepCard, NextStepReportProvider, useNextStepSlot, appStatusMark, type DashSection, type NextStep } from './dashboardKit';
import PaymentPane from './PaymentPane';
import DelegateParticipant from './DelegateParticipant';
import AdvisorParticipant from './AdvisorParticipant';
import ChairParticipant from './ChairParticipant';
import ObserverParticipant from './ObserverParticipant';
import RequestsPanel from './RequestsPanel';
import ApplyPointer from './ApplyPointer';
import type { ParticipantApplication, ParticipantRoleConfig, ParticipantAllocation, ParticipantCommittee } from './types';
import { friendlyError, UserFacingError } from '@/lib/friendlyError';

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

// The dashboard's sections per role (26 Sep 2026, MyMUN's sub-nav). While the
// pay gate is closed (under review, or a fee to settle first) only Overview,
// Payment and Support are offered: everything else would be the same lock card.
const OVERVIEW: DashSection = { key: 'overview', label: 'Overview', icon: LayoutDashboard };
const PAYMENT: DashSection = { key: 'payment', label: 'Payment', icon: CreditCard };
const SUPPORT: DashSection = { key: 'support', label: 'Support', icon: LifeBuoy };
const DOCUMENTS: DashSection = { key: 'documents', label: 'Documents', icon: FileText };
const DELEGATION: DashSection = { key: 'delegation', label: 'Delegation', icon: Users };
const COMMITTEES: DashSection = { key: 'committees', label: 'Committees', icon: Landmark };

function sectionsFor(app: ParticipantApplication, gateOpen: boolean): DashSection[] {
  if (!gateOpen) return [OVERVIEW, PAYMENT, SUPPORT];
  switch (app.role) {
    case 'delegate':
    case 'head-delegate':
      return [
        OVERVIEW,
        { key: 'committee', label: 'Committee', icon: Landmark },
        DOCUMENTS,
        ...(app.society_id ? [DELEGATION] : []),
        PAYMENT, SUPPORT,
      ];
    case 'chair':
      return [
        OVERVIEW,
        { key: 'committee', label: 'Committee', icon: Landmark },
        { key: 'session', label: 'Session', icon: Radio },
        DOCUMENTS, PAYMENT, SUPPORT,
      ];
    case 'faculty-advisor':
      return [OVERVIEW, DELEGATION, COMMITTEES, PAYMENT, SUPPORT];
    case 'observer':
      return [OVERVIEW, COMMITTEES, PAYMENT, SUPPORT];
    default:
      return [OVERVIEW, PAYMENT, SUPPORT];
  }
}

// Roles whose own dashboard reports its next step (useReportNextStep): the
// delegate (seat, room, paper) and the chair (the room, loaded inside).
const ROLES_WITH_OWN_STEP = new Set(['delegate', 'head-delegate', 'chair']);

/** The phone page's first card: what this person should do now. Money and
 *  review come first for every role; then the role's own step, else a plain
 *  "You're all set" with what happens next. */
function pageNextStep(o: {
  app: ParticipantApplication;
  conferenceSlug: string;
  conferenceName: string;
  locked: boolean;
  payNow: boolean;
  roleStep: NextStep | null;
}): NextStep | null {
  const pay = { label: 'Pay now', href: `/conferences/${o.conferenceSlug}/pay` };
  if (o.locked) {
    return { kind: 'action', line: `Pay your registration fee to open your ${o.conferenceName} dashboard.`, action: pay };
  }
  if (o.app.status === 'submitted') {
    return o.payNow
      ? { kind: 'action', line: 'Pay your registration fee while the organisers review your application.', action: pay }
      : { kind: 'done', line: 'The organisers are reviewing your application. You will get an email when they decide.' };
  }
  if (o.payNow) return { kind: 'action', line: 'Pay your registration fee to confirm your place.', action: pay };
  if (o.app.status === 'checked-in') return { kind: 'done', line: 'You are checked in. Enjoy the conference.' };
  if (ROLES_WITH_OWN_STEP.has(o.app.role)) return o.roleStep;
  switch (o.app.role) {
    case 'faculty-advisor':
      return {
        kind: 'done',
        line: o.app.society_id
          ? 'Follow your delegation below. The organisers email you when allocations go out.'
          : 'The organisers will link your delegation to your application.',
      };
    case 'observer':
      return { kind: 'done', line: 'The organisers will share the event details before the conference.' };
    default:
      return { kind: 'done', line: 'The organisers will share the next steps by email.' };
  }
}

function pickDefault(apps: ParticipantApplication[]): ParticipantApplication {
  return [...apps].sort((a, b) => statusPriority(a.status) - statusPriority(b.status))[0];
}

export interface ParticipantViewProps {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  /** The conference's short name, for the locked Overview's sentence. */
  conferenceName?: string;
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
   *  resolves it to their default role. */
  initialRole: string | null;
  /** Correct a missing/unheld role in the URL. Owned by the parent, which
   *  swaps the role in place (history.replaceState) — this used to be a
   *  router.replace here, which reloaded the whole conference page just to
   *  put the right slug in the URL. */
  onResolveRole: (role: string) => void;
  /** The viewer picked one of their other applications. Same deal: a pushState
   *  so Back returns to the previous role, no navigation. */
  onSelectRole: (role: string) => void;
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
  /** The viewer withdrew one of their own pending applications. The parent
   *  owns `myApplications`, so it patches that row to 'withdrawn' in place
   *  rather than this view refetching the whole conference. */
  onApplicationWithdrawn?: (applicationId: string) => void;
}

export default function ParticipantView({
  conferenceId, conferenceSlug, conferenceStartDate, conferenceName, myApplications, roleConfigs, myAllocation, committees, allocationSwapMode, isOrganizer = false,
  initialRole, onResolveRole, onSelectRole, participantDataLoading, justClaimedCount,
  onApplicationWithdrawn,
}: ParticipantViewProps) {
  const { user, session } = useAuth();
  const holdsInitialRole = !!initialRole && myApplications.some(a => a.role === initialRole);
  // Dismissible, not persisted anywhere, "dismissed on navigation" falls out
  // naturally: this component unmounts whenever the viewer leaves the You tab,
  // so leaving and coming back never resurrects a stale notice.
  const [claimNoticeDismissed, setClaimNoticeDismissed] = useState(false);

  // Withdraw your own pending application. Two-step, because it cannot be
  // undone from here: the applicant re-applies instead.
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  // The dashboard section, remembered for the application it was picked on,
  // so switching role opens the other one on Overview.
  const [section, setSection] = useState<{ appId: string; key: string }>({ appId: '', key: 'overview' });

  // The role dashboard's own next step (delegate, chair), reported upward.
  const [roleStep, reportRoleStep] = useNextStepSlot();

  // Resolver (/role) and "not holding that role" fallback (/role/[role] for
  // a role the viewer doesn't actually have) both land here: once
  // applications are known, settle on the default role's real URL.
  useEffect(() => {
    if (!user || myApplications.length === 0 || holdsInitialRole) return;
    onResolveRole(pickDefault(myApplications).role);
  }, [user, myApplications, holdsInitialRole, onResolveRole]);

  function selectApplication(app: ParticipantApplication) {
    setWithdrawConfirm(false);
    setWithdrawError('');
    onSelectRole(app.role);
  }

  // `applications` has no participant DELETE policy, and the "update own
  // submitted" RLS policy cannot move status OFF 'submitted' (its USING
  // clause doubles as the WITH CHECK). So this goes through the same
  // SECURITY DEFINER RPC the apply flow's edit mode already uses: it
  // re-verifies auth.uid() owns the row, refuses anything that is not still
  // 'submitted', flips the status and refunds any Gavelling credit that was
  // held — the identical refund path a rejection takes
  // (refund_credit_for_application), never a new one.
  async function handleWithdraw(applicationId: string) {
    if (!session) { setWithdrawError('Your session expired. Please sign in again.'); return; }
    setWithdrawing(true);
    setWithdrawError('');
    try {
      const supabase = getAuthedClient(session.access_token);
      const { data, error } = await supabase.rpc('withdraw_application', { p_application_id: applicationId });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) throw new UserFacingError(result?.error ?? 'Could not withdraw your application. Please try again.');
      setWithdrawConfirm(false);
      onApplicationWithdrawn?.(applicationId);
    } catch (err: unknown) {
      setWithdrawError(friendlyError(err, 'Could not withdraw your application. Please try again.'));
    } finally {
      setWithdrawing(false);
    }
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
            <Gavel size={24} strokeWidth={2} aria-hidden style={{ color: '#1B3828' }} />
          </div>
          <p className="text-[16px] font-extrabold mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            You&apos;re the organizer
          </p>
          <p className="text-[13.5px] mb-5 max-w-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
            You run this conference. There&apos;s nothing to apply for here. Manage applications,
            committees and your public page from the organizer dashboard.
          </p>
          <Link
            href={`/manage/${conferenceSlug}`}
            className="inline-flex items-center gap-2 rounded-full"
            style={{ padding: '11px 20px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}
          >
            Manage conference
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
  // Locked only when the organiser turned on "Hide dashboard until payment"
  // and this role charges a fee today (see getGateState).
  const gateState = getGateState(paymentTiming, selected.status, selected.payment_status, roleFeeToday(roleConfig), roleConfig?.hide_dashboard_until_paid === true);

  const feeToday = roleFeeToday(roleConfig);
  const isDelegateRole = DELEGATE_ROLES.has(selected.role);
  const isLeader = (selected.role === 'faculty-advisor' || selected.role === 'head-delegate') && !!selected.society_id;
  const gateOpen = gateState === 'full';
  const sections = sectionsFor(selected, gateOpen);
  // A section that no longer exists for this application (a role switch, the
  // gate closing) falls back to Overview.
  const activeSection = section.appId === selected.id && sections.some(x => x.key === section.key) ? section.key : 'overview';
  const selectSection = (key: string) => setSection({ appId: selected.id, key });

  const roleContent = isDelegateRole ? (
    <DelegateParticipant
      conferenceId={conferenceId}
      conferenceSlug={conferenceSlug}
      conferenceStartDate={conferenceStartDate}
      application={selected}
      myAllocation={myAllocation}
      committees={committees}
      allocationSwapMode={allocationSwapMode}
      section={activeSection}
    />
  ) : selected.role === 'faculty-advisor' ? (
    <AdvisorParticipant
      conferenceId={conferenceId}
      conferenceSlug={conferenceSlug}
      conferenceStartDate={conferenceStartDate}
      application={selected}
      allocationSwapMode={allocationSwapMode}
      section={activeSection}
      onSelectSection={selectSection}
    />
  ) : selected.role === 'chair' ? (
    <ChairParticipant conferenceId={conferenceId} conferenceSlug={conferenceSlug} section={activeSection} />
  ) : selected.role === 'observer' ? (
    <ObserverParticipant conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} section={activeSection} />
  ) : (
    <Pane show={activeSection === 'overview'} title="Your Role" icon={Briefcase}><RolePlaceholder role={selected.role} /></Pane>
  );

  const closed = selected.status === 'withdrawn' || selected.status === 'rejected';

  // Every role's dashboard is ONE page below xl (10 Oct 2026, delegates
  // first; every role the same day, owner: "there is still multiple tabs in
  // you ... not yet clear enough"). No pill row: the page opens on ONE card
  // that says what to do now (pay, join the room, hand in the paper, or
  // "You're all set"), then the role's own sections in the order that
  // matters (each under a heading), then Payment, the application and the
  // questions. From xl the sub-nav and one section at a time are unchanged:
  // the DOM order below changes nothing there.
  const stacked = true;
  const payNow = feeToday !== 0
    && !(selected.payment_status === 'paid' || selected.payment_status === 'waived')
    && !(paymentTiming === 'after_acceptance' && selected.status === 'submitted');
  const nextStep = pageNextStep({
    app: selected,
    conferenceSlug,
    conferenceName: conferenceName || 'conference',
    locked: gateState === 'locked',
    payNow,
    // A role step only counts while that role's dashboard is on the page.
    roleStep: gateOpen ? roleStep : null,
  });
  const paymentPane = (
    <Pane show={activeSection === 'payment'} title="Payment" icon={CreditCard}>
      <PaymentPane
        application={selected}
        conferenceId={conferenceId}
        conferenceSlug={conferenceSlug}
        userId={user?.id ?? null}
        feeToday={feeToday}
        paymentTiming={paymentTiming}
        isLeader={isLeader}
      />
    </Pane>
  );

  return (
    <div className="flex flex-col gap-5">
      {justClaimedCount > 0 && !claimNoticeDismissed && (
        <SectionCard className="!py-3 !px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13.5px]" style={{ color: '#2A5A3C', fontFamily: OUTFIT, margin: 0 }}>
              We found your registration and attached it to your account.
            </p>
            <button
              onClick={() => setClaimNoticeDismissed(true)}
              className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] rounded-full"
              style={{ color: '#6B5F52', background: 'none', border: 'none', cursor: 'pointer', padding: 14, margin: -10 }}
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </SectionCard>
      )}

      {/* More than one application here: pick which one the dashboard shows.
          Below xl (10 Oct 2026) ONE clear chooser at the top: a big card per
          role, the role large and its status as icon + word beneath, the
          one on screen ringed. One role at a time rather than every role's
          page stacked: each role has its own payment, papers and questions,
          and stacking them would repeat all three. From xl the pill row is
          unchanged. */}
      {myApplications.length > 1 && (
        <>
        <div className="xl:hidden" role="group" aria-label="Your roles at this conference">
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: '#6B5F52', margin: '0 0 8px 0' }}>
            You have {myApplications.length} roles here. Pick one to see its page.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {myApplications.map(app => {
              const active = app.id === selected.id;
              const st = appStatusMark(app.status);
              const StIcon = st.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => selectApplication(app)}
                  aria-pressed={active}
                  className="text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#B6871F]"
                  style={{
                    minHeight: 72, padding: '12px 16px', borderRadius: 16, cursor: 'pointer',
                    border: 'none', backgroundColor: '#FFFFFF',
                    boxShadow: active ? `inset 0 0 0 2px #1B3828, ${CARD_SHADOW}` : CARD_SHADOW,
                  }}
                >
                  <span className="block [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: active ? '#1B3828' : '#1C1410', lineHeight: 1.25 }}>
                    {roleLabel(app.role)}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: st.color }}>
                    <StIcon size={14} strokeWidth={2.2} aria-hidden />
                    {st.word}
                  </span>
                  {active && <span className="sr-only">, showing now</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div role="group" aria-label="Your roles at this conference" className="hidden xl:flex flex-wrap gap-2">
          {myApplications.map(app => {
            const active = app.id === selected.id;
            const st = appStatusMark(app.status);
            const StIcon = st.icon;
            return (
              <button
                key={app.id}
                onClick={() => selectApplication(app)}
                aria-pressed={active}
                title={st.word}
                className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
                style={{
                  minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
                  border: 'none',
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                  boxShadow: active ? CARD_SHADOW : 'inset 0 0 0 1.5px rgba(28,20,16,0.18)',
                  color: active ? '#1B3828' : '#6B5F52',
                  fontFamily: OUTFIT, fontSize: 14, fontWeight: active ? 800 : 600,
                }}
              >
                <StIcon size={15} strokeWidth={2.2} aria-hidden style={{ color: st.color }} />
                {roleLabel(app.role)}
                <span className="sr-only">, {st.word}</span>
              </button>
            );
          })}
        </div>
        </>
      )}

      {closed ? (
        <>
          {selected.status === 'withdrawn' ? (
            // Same reasoning as rejected: a withdrawn application has no fee to
            // settle and no committee to prepare for, so this replaces the
            // dashboard rather than sitting above it.
            <WithdrawnCard conferenceSlug={conferenceSlug} role={selected.role} />
          ) : (
            // Payment and role content are meaningless once rejected, replaces
            // both rather than gating them (a rejection isn't a PayGate state).
            <RejectedCard
              conferenceSlug={conferenceSlug}
              role={selected.role}
              organizerNote={selected.organizer_note}
              allowResubmission={roleConfig?.allow_resubmission ?? false}
            />
          )}
          <RequestsPanel conferenceId={conferenceId} applicationId={selected.id} myApplications={myApplications} activeRole={selected.role} />
        </>
      ) : (
        <DashboardShell
          key={selected.id}
          sections={sections}
          active={activeSection}
          onSelect={selectSection}
          ariaLabel={`${roleLabel(selected.role)} dashboard`}
          stackBelowXl={stacked}
        >
          <div className="flex flex-col gap-6">
            {/* Overview: MyMUN's three facts first, never gated. Below xl the
                next-step card takes their place (status at its top right,
                "what happens next" as its one line), so nothing repeats. */}
            <Pane show={activeSection === 'overview'}>
              {nextStep && <NextStepCard step={nextStep} status={selected.status} />}
              <div className="hidden xl:block">
              <StatusRow
                input={{
                  role: selected.role,
                  status: selected.status,
                  paymentStatus: selected.payment_status,
                  selfPaid: selected.self_paid,
                  amountPaid: selected.amount_paid,
                  feeToday,
                  paymentTiming,
                  hasAllocation: !!myAllocation,
                  paperDeadline: myAllocation?.conference_committees?.position_paper_deadline ?? null,
                  hasSociety: !!selected.society_id,
                  locked: gateState === 'locked',
                }}
              />
              </div>
              {gateState === 'locked' && (
                <p className="hidden xl:block" style={{ fontFamily: OUTFIT, fontSize: 14, color: '#5A5046', lineHeight: 1.55, marginTop: 14 }}>
                  {conferenceName || 'This conference'} shows your full dashboard once your payment is in. Pay in the Payment section to see your committee, documents and more.
                </p>
              )}
            </Pane>

            {/* The role's own sections. Mounted once; each hides the panes
                that are not showing. Behind the pay gate exactly as before:
                while it is closed the nav offers only Overview, Payment and
                Support, and Overview's status row says what to do. The role
                reports its next step to the card above. */}
            <NextStepReportProvider value={reportRoleStep}>
              {gateOpen ? roleContent : null}
            </NextStepReportProvider>

            {paymentPane}

            {/* MyMUN keeps "withdraw" at the bottom of My application; so do
                we (on the phone page it is its own section, before the
                questions; on desktop it closes Overview as before). */}
            {selected.status === 'submitted' && (
              <Pane show={activeSection === 'overview'} title="Your Application" icon={ClipboardList}>
                <DashCard>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[14px]" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600, margin: 0 }}>
                      Need to change something before it&apos;s reviewed?
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <OutlineLink href={`/conferences/${conferenceSlug}/apply?role=${selected.role}&edit=1`}>
                        <Pencil size={15} aria-hidden />
                        Edit application
                      </OutlineLink>
                      {/* Quieter than Edit on purpose: withdrawing is the rarer
                          choice and cannot be undone from here. */}
                      <button
                        onClick={() => { setWithdrawConfirm(true); setWithdrawError(''); }}
                        className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
                        style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#8B2020', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                      >
                        <LogOut size={15} aria-hidden />
                        Withdraw
                      </button>
                    </div>
                  </div>

                  {withdrawConfirm && (
                    <div className="mt-4 rounded-xl px-4 py-3.5" style={{ backgroundColor: 'rgba(139,32,32,0.05)' }}>
                      <p className="text-[14px] font-bold mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                        Withdraw this application?
                      </p>
                      <p className="text-[13px] mb-3" style={{ color: '#6B5F52', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                        It stops being reviewed by the organizing team. Any Gavelling credit
                        you spent is refunded. This cannot be undone from your account.
                      </p>
                      {withdrawError && (
                        <p className="text-[13px] mb-3" role="alert" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                          {withdrawError}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleWithdraw(selected.id)}
                          disabled={withdrawing}
                          className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8B2020]"
                          style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, backgroundColor: withdrawing ? 'rgba(139,32,32,0.4)' : '#8B2020', color: '#FFFFFF', border: 'none', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, cursor: withdrawing ? 'not-allowed' : 'pointer' }}
                        >
                          {withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}
                        </button>
                        <button
                          onClick={() => { setWithdrawConfirm(false); setWithdrawError(''); }}
                          disabled={withdrawing}
                          className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
                          style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, border: '1.5px solid rgba(28,20,16,0.55)', color: '#1C1410', background: '#FFFFFF', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, cursor: withdrawing ? 'not-allowed' : 'pointer' }}
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  )}
                </DashCard>
              </Pane>
            )}

            {/* Questions & requests, never gated. */}
            <Pane show={activeSection === 'support'} title="Ask the Organisers" icon={MessageCircle}>
              <RequestsPanel conferenceId={conferenceId} applicationId={selected.id} myApplications={myApplications} activeRole={selected.role} />
            </Pane>
          </div>
        </DashboardShell>
      )}
    </div>
  );
}
