'use client';

// Overview, Preferences, Experience and Answers for the applicant pop-up.
// Read-only. Every decision still lives in the page's own handlers, which the
// dialog renders in its action bar; nothing here writes.

import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Award, BadgeCheck, Cake, CircleDashed, FileQuestion, Flag,
  GraduationCap, Landmark, ListOrdered, MessageSquareText, Receipt, Trophy, UserRoundCheck, Wallet,
} from 'lucide-react';
import { DelegationIdentity } from '../DelegationAvatar';
import { LogoDisc } from '@/components/LogoDisc';
import VerifiedCheck, { VERIFIED_BLUE } from '@/components/VerifiedCheck';
import { committeeDisplayName } from '@/lib/presetNames';
import { centsToFee } from '@/lib/invoices';
import { LevelInsignia, LEVEL_ACCENT, AwardArtwork, monogramFor } from '@/app/account/accountUi';
import type { ApplicantApp, CvEntry, LedgerTotals } from './data';
import {
  C, OUTFIT, NUM, SeatFlag, SectionTitle, FactRow, Empty, Spinner, ErrorLine, fmtDay, fmtDateTime, ordinal,
} from './kit';
import type { ApplicantTab } from './url';

// ── helpers ─────────────────────────────────────────────────────────────────

type Pref = ApplicantApp['application_preferences'][number];

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** The preference this applicant was allocated, if their seat matches one. */
export function matchedPreference(app: ApplicantApp): Pref | null {
  if (!app.assigned_committee_id) return null;
  const prefs = app.application_preferences ?? [];
  const isChair = app.role === 'chair';
  // A committee-only ranking (chairs, and conferences that let delegates
  // rank committees without countries) matches on the committee alone.
  return prefs.find(p => p.conference_committee_id === app.assigned_committee_id && (
    isChair
    || (!p.country_code && !p.country_name)
    || (app.assigned_country_code && norm(p.country_code) === norm(app.assigned_country_code))
    || (app.assigned_country_name && norm(p.country_name) === norm(app.assigned_country_name))
  )) ?? null;
}

function committeeLabel(c: { name: string; abbreviation: string | null } | null | undefined) {
  if (!c) return { primary: 'Unknown committee', secondary: null as string | null };
  const primary = committeeDisplayName(c.name, c.abbreviation);
  return { primary, secondary: primary !== c.name ? c.name : null };
}

function levelLabel(level: string) {
  const k = (level ?? '').toLowerCase();
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Unranked';
}

// ── Overview ────────────────────────────────────────────────────────────────
//
// Everything an organiser decides on, on one page (owner, 23 Sep 2026: "the
// answers are quite important so they should be in the main overview"). The
// hero above already says who they are (name, email, nationality, date of
// birth, role, status), so nothing here repeats it.

export interface OverviewDelegation {
  name: string;
  members: number;
  country: string | null;
  lead: string | null;
  leadRole: string | null;
  isHead: boolean;
  logoUrl?: string | null;
  city?: string | null;
  countryCode?: string | null;
}

export function OverviewTab({
  app, isDelegate, conferenceSlug, experienceLevel, cvCount, totals, ledgerLoading, feeCharged, onTab,
  answerItems, orphanAnswers, delegation, onOpenDelegation, dob, age,
}: {
  app: ApplicantApp;
  isDelegate: boolean;
  conferenceSlug: string;
  experienceLevel: string;
  cvCount: number | null;
  totals: LedgerTotals | null;
  ledgerLoading: boolean;
  feeCharged: boolean;
  onTab: (t: ApplicantTab) => void;
  answerItems: AnswerItem[];
  orphanAnswers: AnswerItem[];
  delegation: OverviewDelegation | null;
  onOpenDelegation?: () => void;
  dob: string | null;
  age: number | null;
}) {
  const allocated = !!app.assigned_committee && (app.status === 'assigned' || app.status === 'checked-in' || !!app.assigned_country_name);
  const pref = matchedPreference(app);
  const committee = committeeLabel(app.assigned_committee);
  const accent = LEVEL_ACCENT[experienceLevel.toLowerCase()] ?? '#9A8A78';
  const accepted = app.status === 'accepted' || app.status === 'assigned' || app.status === 'checked-in';
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
  const answered = answerItems.filter(i => i.answer).length;
  const showsSeat = isDelegate || app.role === 'chair';

  return (
    <div className="apdTwo">
      <div className="min-w-0 flex flex-col" style={{ gap: 26 }}>
        {app.status === 'rejected' && app.organizer_note && (
          <section style={{ padding: '14px 16px', borderRadius: 16, border: '1.5px solid rgba(139,32,32,0.3)', background: 'rgba(139,32,32,0.05)' }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: C.red }}>Note sent to them</p>
            <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.6, color: C.ink, overflowWrap: 'anywhere' }}>
              &ldquo;{app.organizer_note}&rdquo;
            </p>
          </section>
        )}

        {/* The seat, once there is one. */}
        {showsSeat && allocated && (
          <section aria-labelledby="apd-alloc">
            <SectionTitle icon={Flag}><span id="apd-alloc">Allocation</span></SectionTitle>
            <div
              className="flex items-center gap-4"
              style={{ padding: 18, borderRadius: 20, background: `radial-gradient(120% 160% at 0% 0%, ${C.forestMid} 0%, ${C.forest} 70%)`, color: C.ivory, boxShadow: '0 14px 30px -18px rgba(27,56,40,0.7), inset 0 1px 0 rgba(255,255,255,0.08)' }}
            >
              {app.role === 'chair' || !app.assigned_country_name ? (
                <LogoDisc src={app.assigned_committee?.logo_url ?? null} size={68} alt={committee.primary} fallbackText={monogramFor(app.assigned_committee?.name ?? '')} />
              ) : (
                <SeatFlag name={app.assigned_country_name} code={app.assigned_country_code} size={72} />
              )}
              <div className="min-w-0 flex-1">
                <p style={{ fontFamily: OUTFIT, fontSize: 24, fontWeight: 900, lineHeight: 1.1, color: '#FFFFFF', overflowWrap: 'anywhere' }}>
                  {app.role === 'chair' ? 'Chair' : (app.assigned_country_name ?? 'Seat to be named')}
                </p>
                <p className="mt-1.5 min-w-0" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: C.gold }}>
                  {committee.primary}
                  {committee.secondary && (
                    <span className="block" style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(237,231,216,0.8)' }}>{committee.secondary}</span>
                  )}
                </p>
                {pref ? (
                  <p className="mt-2 inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#CDE9D5' }}>
                    <BadgeCheck size={14} aria-hidden /> Their {ordinal(pref.preference_order)} preference
                  </p>
                ) : prefs.length > 0 ? (
                  <p className="mt-2 inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: 'rgba(237,231,216,0.8)' }}>
                    <CircleDashed size={14} aria-hidden /> Outside their preferences
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {/* What they asked for, before a seat exists. */}
        {showsSeat && !allocated && (
          <section aria-labelledby="apd-prefs">
            <SectionTitle
              icon={ListOrdered}
              aside={accepted && isDelegate ? (
                <Link href={`/manage/${conferenceSlug}/assignment`} className="inline-flex items-center gap-1 focus:outline-none" style={{ color: C.forest, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  Allocate
                </Link>
              ) : 'Not allocated yet'}
            >
              <span id="apd-prefs">Preferences</span>
            </SectionTitle>
            {prefs.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: C.inkSoft }}>They did not rank anything.</p>
            ) : (
              <ol>
                {prefs.slice(0, 5).map((p, i) => {
                  const c = committeeLabel(p.conference_committees);
                  const committeeOnly = app.role === 'chair' || !p.country_name;
                  return (
                    <li key={p.preference_order} className="flex items-center gap-3 min-w-0" style={{ padding: '8px 0', borderTop: i ? `1px solid ${C.parchment}` : 'none' }}>
                      <span style={{ width: 22, fontFamily: OUTFIT, fontSize: 14, fontWeight: 900, color: C.goldDeep, ...NUM }} aria-label={`${ordinal(p.preference_order)} choice`}>{p.preference_order}</span>
                      {committeeOnly
                        ? <LogoDisc src={p.conference_committees?.logo_url ?? null} size={26} alt="" fallbackText={monogramFor(p.conference_committees?.name ?? '')} />
                        : <SeatFlag name={p.country_name} code={p.country_code} size={26} />}
                      <span className="min-w-0 flex-1" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: C.ink, overflowWrap: 'anywhere' }}>
                        {committeeOnly ? c.primary : p.country_name}
                        {!committeeOnly && <span style={{ fontWeight: 600, color: C.inkSoft }}>{`  ${c.primary}`}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {prefs.length > 5 && (
              <button
                type="button"
                onClick={() => onTab('preferences')}
                className="mt-1.5 inline-flex items-center gap-1 focus:outline-none"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: C.forest }}
              >
                All {prefs.length} preferences <ArrowRight size={13} aria-hidden />
              </button>
            )}
          </section>
        )}

        {/* Their answers: the application itself. */}
        {(answerItems.length > 0 || orphanAnswers.length > 0) && (
          <section aria-labelledby="apd-answers">
            <SectionTitle icon={MessageSquareText} aside={answerItems.length > 0 ? <span style={NUM}>{answered} of {answerItems.length} answered</span> : undefined}>
              <span id="apd-answers">Application</span>
            </SectionTitle>
            {answerItems.length > 0 && <ol>{answerItems.map((it, i) => <AnswerBlock key={it.key} item={it} index={i} />)}</ol>}
            {orphanAnswers.length > 0 && (
              <div className="mt-3">
                <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>Answers to questions no longer on the form</p>
                <ol>{orphanAnswers.map((it, i) => <AnswerBlock key={it.key} item={it} index={i} />)}</ol>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="min-w-0 flex flex-col" style={{ gap: 22 }}>
        {delegation && (
          <section aria-label="Delegation">
            <div style={{ padding: 14, borderRadius: 18, border: `1px solid ${C.parchment}`, background: 'rgba(27,56,40,0.035)' }}>
              <DelegationIdentity
                name={delegation.name}
                size={56}
                nameSize={16.5}
                logoUrl={delegation.logoUrl}
                city={delegation.city}
                countryCode={delegation.countryCode}
                members={delegation.members}
                country={delegation.country}
                lead={delegation.isHead ? 'This Applicant' : delegation.lead}
                leadRole={delegation.leadRole}
              />
              {onOpenDelegation && (
                <button
                  type="button"
                  onClick={onOpenDelegation}
                  className="mt-3 inline-flex items-center gap-1 focus:outline-none"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: C.forest }}
                >
                  Open delegation <ArrowRight size={13} aria-hidden />
                </button>
              )}
            </div>
          </section>
        )}

        <section aria-labelledby="apd-exp" className="flex items-center gap-3.5">
          <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 50, height: 50, borderRadius: 999, background: `${accent}1F`, border: `1.5px solid ${accent}66` }}>
            <LevelInsignia level={experienceLevel} size={28} />
          </span>
          <div className="min-w-0">
            <p id="apd-exp" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 900, color: C.ink, lineHeight: 1.15 }}>{levelLabel(experienceLevel)}</p>
            <button
              type="button"
              onClick={() => onTab('experience')}
              className="inline-flex items-center gap-1 focus:outline-none"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: C.forest, ...NUM }}
            >
              {cvCount === null ? 'MUN record' : `${cvCount} ${cvCount === 1 ? 'conference' : 'conferences'} on their CV`}
              <ArrowRight size={12} aria-hidden />
            </button>
          </div>
        </section>

        <section aria-labelledby="apd-money">
          <SectionTitle icon={Wallet} tint={C.goldDeep}><span id="apd-money">Payment</span></SectionTitle>
          {!feeCharged && !totals ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: C.inkSoft }}>This role is free.</p>
          ) : ledgerLoading ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft }}>Reading the ledger</p>
          ) : !totals ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: C.inkSoft }}>No invoice yet.</p>
          ) : (
            <MoneyStrip totals={totals} compact />
          )}
          <button
            type="button"
            onClick={() => onTab('payment')}
            className="mt-2 inline-flex items-center gap-1 focus:outline-none"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: C.forest }}
          >
            Open payment <ArrowRight size={13} aria-hidden />
          </button>
        </section>

        <section aria-label="Details">
          {dob ? (
            <FactRow icon={Cake} tint={C.plum} label="Date of birth">
              {fmtDay(dob)}{age !== null ? <span style={{ fontWeight: 600, color: C.inkSoft }}>{`, ${age}`}</span> : null}
            </FactRow>
          ) : age !== null ? (
            <FactRow icon={Cake} tint={C.plum} label="Age">{age}</FactRow>
          ) : null}
          <FactRow icon={Receipt} tint={C.goldDeep} label="Applied">
            {fmtDay(app.submitted_at)}
            {app.resubmitted_at && <span style={{ fontWeight: 600, color: C.inkSoft }}>{`, resubmitted ${fmtDay(app.resubmitted_at)}`}</span>}
          </FactRow>
          {app.checked_in_at && app.status === 'checked-in' && (
            <FactRow icon={UserRoundCheck} tint={C.forestLight} label="Checked in">{fmtDateTime(app.checked_in_at)}</FactRow>
          )}
        </section>
      </div>
    </div>
  );
}

/** Received / offline / outstanding, shown apart and never added (CLAUDE.md §3). */
export function MoneyStrip({ totals, compact }: { totals: LedgerTotals; compact?: boolean }) {
  const cells: { label: string; value: number; tint: string; title: string }[] = [
    { label: 'Received via Gavelling', value: totals.receivedCents, tint: C.forestLight, title: 'Succeeded Stripe payments' },
    { label: 'Outstanding', value: totals.outstandingCents, tint: totals.outstandingCents > 0 ? C.red : C.inkSoft, title: 'Open invoice balances' },
  ];
  if (totals.offlineCents > 0 || !compact) {
    cells.splice(1, 0, { label: 'Recorded offline', value: totals.offlineCents, tint: C.goldInk, title: 'Marked paid, or proof approved, outside Gavelling' });
  }
  return (
    <div>
      <div className="apdMoney grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`, gap: 0, borderRadius: 16, border: `1.5px solid ${C.parchment}`, background: '#FFFFFF', overflow: 'hidden' }}>
        {cells.map((c, i) => (
          <div key={c.label} title={c.title} style={{ padding: compact ? '12px 14px' : '14px 16px', borderInlineStart: i ? `1px solid ${C.parchment}` : 'none' }}>
            <p style={{ fontFamily: OUTFIT, fontSize: compact ? 19 : 24, fontWeight: 900, color: c.tint, letterSpacing: '-0.02em', lineHeight: 1.1, ...NUM }}>
              {centsToFee(c.value, totals.currency)}
            </p>
            <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: C.inkSoft, lineHeight: 1.3 }}>{c.label}</p>
          </div>
        ))}
      </div>
      {(totals.pendingProofs > 0 || totals.aidCents > 0 || totals.otherCurrencies.length > 0) && (
        <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.inkSoft, ...NUM }}>
          {[
            totals.pendingProofs > 0 ? `${totals.pendingProofs} proof${totals.pendingProofs === 1 ? '' : 's'} waiting for review` : null,
            totals.aidCents > 0 ? `${centsToFee(totals.aidCents, totals.currency)} of financial aid applied` : null,
            totals.otherCurrencies.length > 0 ? `Also billed in ${totals.otherCurrencies.join(', ')}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}

// ── Preferences ─────────────────────────────────────────────────────────────

export function PreferencesTab({ app }: { app: ApplicantApp }) {
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
  const isChair = app.role === 'chair';
  const got = matchedPreference(app);
  const anyCountry = prefs.some(p => !!p.country_name);
  if (prefs.length === 0) {
    return <Empty icon={ListOrdered} title="No preferences" body={isChair ? 'They did not rank any committee.' : 'They did not rank any committee or country.'} />;
  }
  const outside = !!app.assigned_committee_id && !got && (app.status === 'assigned' || app.status === 'checked-in');
  return (
    <div>
      <SectionTitle
        icon={ListOrdered}
        aside={got ? <span style={{ color: C.forestLight, fontWeight: 700 }}>Allocated their {ordinal(got.preference_order)} choice</span>
          : outside ? 'Allocated outside these' : undefined}
      >
        {anyCountry ? 'Committee and country ranking' : 'Committee ranking'}
      </SectionTitle>
      <ol className="apdPrefGrid">
        {prefs.map(p => {
          const on = got?.preference_order === p.preference_order;
          const c = committeeLabel(p.conference_committees);
          const committeeOnly = isChair || !p.country_name;
          return (
            <li
              key={p.preference_order}
              className="flex items-center gap-3 min-w-0"
              aria-current={on ? 'true' : undefined}
              style={{
                padding: '10px 12px', borderRadius: 16,
                border: `1.5px solid ${on ? C.goldDeep : C.parchment}`,
                background: on ? 'linear-gradient(135deg, #FFF8DF, #FBF1CF)' : '#FFFFFF',
                boxShadow: on ? '0 8px 20px -14px rgba(182,135,31,0.9)' : 'none',
              }}
            >
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 30, height: 30, borderRadius: 999, fontFamily: OUTFIT, fontSize: 14, fontWeight: 900, ...NUM,
                  background: on ? C.forest : C.ivory, color: on ? C.gold : C.forest,
                }}
                aria-label={`${ordinal(p.preference_order)} choice`}
              >
                {p.preference_order}
              </span>
              {committeeOnly ? (
                <LogoDisc src={p.conference_committees?.logo_url ?? null} size={34} alt="" fallbackText={monogramFor(p.conference_committees?.name ?? '')} />
              ) : (
                <SeatFlag name={p.country_name} code={p.country_code} size={34} />
              )}
              <div className="min-w-0 flex-1">
                <p style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: C.ink, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                  {committeeOnly ? c.primary : p.country_name}
                </p>
                {(committeeOnly ? c.secondary : c.primary) && (
                  <p title={p.conference_committees?.name} style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: C.inkSoft, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                    {committeeOnly ? c.secondary : c.primary}
                  </p>
                )}
              </div>
              {on && (
                <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: C.goldInk }}>
                  <BadgeCheck size={15} aria-hidden /> Allocated
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Experience ──────────────────────────────────────────────────────────────

function awardsOf(e: { awards?: string[] | null; award?: string | null }) {
  if (e.awards && e.awards.length) return e.awards;
  return e.award && e.award !== 'None' ? [e.award] : [];
}

function entryRole(t: string | null) {
  return t === 'chair' ? 'Chair' : t === 'secretariat' ? 'Secretariat' : t === 'faculty-advisor' ? 'Faculty advisor' : t === 'other' ? 'Other' : 'Delegate';
}

function CvRow({ e }: { e: CvEntry }) {
  const verified = e.source === 'gavelling_verified';
  const where = [e.committee, e.allocation].map(s => (s ?? '').trim()).filter(Boolean).join(' · ');
  const awards = awardsOf(e);
  return (
    <li className="flex items-start gap-3" style={{ padding: '11px 0', borderTop: `1px solid ${C.parchment}` }}>
      <LogoDisc src={e.logo_url} size={40} fallbackText={monogramFor(e.conference_name)} alt={e.conference_name} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 flex-wrap" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: C.ink, lineHeight: 1.25 }}>
          <span style={{ overflowWrap: 'anywhere' }}>{e.conference_name}</span>
          <VerifiedCheck
            verified={verified}
            showUnverified
            size={15}
            title={verified ? 'Verified by Gavelling: written by the conference’s awards' : 'Self-reported'}
          />
        </p>
        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
          {[entryRole(e.entry_type), where, fmtDay(e.event_date)].filter(Boolean).join(' · ')}
        </p>
      </div>
      {awards.length > 0 && (
        <span className="flex items-center gap-1 flex-shrink-0" title={awards.join(', ')}>
          {awards.slice(0, 3).map(a => <AwardArtwork key={a} name={a} size={24} />)}
        </span>
      )}
    </li>
  );
}

export function ExperienceTab({
  app, experienceLevel, cv, cvLoading, cvError, onRetry, listedEntries, showListed,
}: {
  app: ApplicantApp;
  experienceLevel: string;
  cv: CvEntry[] | undefined;
  cvLoading: boolean;
  cvError: string | undefined;
  onRetry: () => void;
  listedEntries: ApplicantApp['experience_entries'];
  showListed: boolean;
}) {
  const accent = LEVEL_ACCENT[experienceLevel.toLowerCase()] ?? '#9A8A78';
  const verified = (cv ?? []).filter(e => e.source === 'gavelling_verified');
  const self = (cv ?? []).filter(e => e.source !== 'gavelling_verified');
  const allAwards = (cv ?? []).flatMap(awardsOf);

  return (
    <div className="flex flex-col" style={{ gap: 26 }}>
      {/* Level + the three numbers that matter. */}
      <div className="flex items-center gap-4 flex-wrap" style={{ padding: 18, borderRadius: 20, border: `1.5px solid ${C.parchment}`, background: '#FFFFFF' }}>
        <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 64, height: 64, borderRadius: 999, background: `${accent}1F`, border: `2px solid ${accent}66` }}>
          <LevelInsignia level={experienceLevel} size={36} />
        </span>
        <div className="min-w-0" style={{ flex: '1 1 140px' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: C.inkSoft }}>MUN experience</p>
          <p style={{ fontFamily: OUTFIT, fontSize: 22, fontWeight: 900, color: C.ink, lineHeight: 1.1 }}>{levelLabel(experienceLevel)}</p>
        </div>
        {app.user_id && cv && (
          <div className="flex items-stretch" style={{ gap: 22 }}>
            {[
              { n: cv.length, label: cv.length === 1 ? 'conference' : 'conferences', tint: C.ink },
              { n: verified.length, label: 'verified', tint: VERIFIED_BLUE },
              { n: allAwards.length, label: allAwards.length === 1 ? 'award' : 'awards', tint: C.goldDeep },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p style={{ fontFamily: OUTFIT, fontSize: 26, fontWeight: 900, color: s.tint, lineHeight: 1, ...NUM }}>{s.n}</p>
                <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: C.inkSoft }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showListed && (
        <section aria-labelledby="apd-listed">
          <SectionTitle icon={GraduationCap} aside={`${listedEntries.length}`}>
            <span id="apd-listed">Listed on this application</span>
          </SectionTitle>
          {listedEntries.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 13, color: C.inkSoft }}>No MUN experience listed.</p>
          ) : (
            <ul>
              {listedEntries.map(e => (
                <li key={e.id} className="flex items-start gap-3" style={{ padding: '11px 0', borderTop: `1px solid ${C.parchment}` }}>
                  <LogoDisc src={null} size={40} fallbackText={monogramFor(e.conference_name)} alt={e.conference_name} />
                  <div className="min-w-0 flex-1">
                    <p style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: C.ink, overflowWrap: 'anywhere' }}>{e.conference_name}</p>
                    <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft, overflowWrap: 'anywhere' }}>
                      {[entryRole(e.entry_type), [e.allocation, e.committee].filter(Boolean).join(' · '), fmtDay(e.event_date)].filter(Boolean).join(' · ')}
                    </p>
                    {e.description && (
                      <p className="mt-1 whitespace-pre-wrap" style={{ fontFamily: OUTFIT, fontSize: 13, color: C.ink, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{e.description}</p>
                    )}
                  </div>
                  {e.awards.length > 0 && (
                    <span className="flex items-center gap-1 flex-shrink-0" title={e.awards.join(', ')}>
                      {e.awards.slice(0, 3).map(a => <AwardArtwork key={a} name={a} size={24} />)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="apd-cv">
        <SectionTitle icon={Trophy} tint={C.goldDeep}><span id="apd-cv">MUN CV</span></SectionTitle>
        {!app.user_id ? (
          <Empty icon={Landmark} title="No account yet" body="They were invited or imported and have not signed up, so there is no MUN CV to show." />
        ) : cvError ? (
          <ErrorLine text={cvError} onRetry={onRetry} />
        ) : cvLoading || !cv ? (
          <Spinner label="Reading their MUN CV" />
        ) : cv.length === 0 ? (
          <Empty icon={Award} title="No conferences yet" body="Their MUN CV is empty." />
        ) : (
          <div className="flex flex-col" style={{ gap: 18 }}>
            {verified.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: VERIFIED_BLUE, marginBottom: 2 }}>
                  <VerifiedCheck verified size={13} /> Verified by Gavelling
                </p>
                <ul>{verified.map(e => <CvRow key={e.id} e={e} />)}</ul>
              </div>
            )}
            {self.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: C.inkSoft, marginBottom: 2 }}>
                  <VerifiedCheck verified={false} showUnverified size={13} /> Self-reported
                </p>
                <ul>{self.map(e => <CvRow key={e.id} e={e} />)}</ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Answers ─────────────────────────────────────────────────────────────────

const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;

/** Plain text with links made clickable (a Drive file, a portfolio). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5" style={{ color: C.forest, fontWeight: 700, overflowWrap: 'anywhere', textDecoration: 'underline', textUnderlineOffset: 2 }}>
          {part.replace(/^https?:\/\//, '')}<ArrowUpRight size={13} aria-hidden />
        </a>
      ) : <span key={i}>{part}</span>))}
    </>
  );
}

export interface AnswerItem { key: string; label: string; answer: string; archived?: boolean }

function AnswerBlock({ item, index }: { item: AnswerItem; index: number }) {
  const long = item.answer.length > 220 || item.answer.includes('\n');
  return (
    <li style={{ padding: '14px 0', borderTop: index ? `1px solid ${C.parchment}` : 'none' }}>
      <p className="flex items-baseline gap-2" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: C.forest, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
        {/* A question saved with no label rendered as a blank heading over its answer. */}
        <span>{item.label?.trim() || 'Untitled question'}</span>
        {item.archived && <span style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft }}>(no longer on the form)</span>}
      </p>
      {item.answer ? (
        <p
          className="mt-1 whitespace-pre-wrap"
          style={{
            fontFamily: OUTFIT, fontSize: long ? 14.5 : 15, lineHeight: 1.62, color: C.ink, maxWidth: '68ch',
            overflowWrap: 'anywhere', fontWeight: long ? 400 : 600,
          }}
        >
          <Linkified text={item.answer} />
        </p>
      ) : (
        <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: C.inkSoft, fontStyle: 'italic' }}>No answer.</p>
      )}
    </li>
  );
}

export function AnswersTab({ items, orphans }: { items: AnswerItem[]; orphans: AnswerItem[] }) {
  if (items.length === 0 && orphans.length === 0) {
    return <Empty icon={FileQuestion} title="No questions for this role" body="Add questions to this role's application form in Settings." />;
  }
  const answered = items.filter(i => i.answer).length;
  return (
    <div className="flex flex-col" style={{ gap: 22 }}>
      {items.length > 0 && (
        <section aria-labelledby="apd-answers">
          <SectionTitle icon={MessageSquareText} aside={<span style={NUM}>{answered} of {items.length} answered</span>}>
            <span id="apd-answers">Their answers</span>
          </SectionTitle>
          <ol>{items.map((it, i) => <AnswerBlock key={it.key} item={it} index={i} />)}</ol>
        </section>
      )}
      {orphans.length > 0 && (
        <section aria-labelledby="apd-orphans">
          <SectionTitle icon={FileQuestion} tint={C.inkSoft}><span id="apd-orphans">Answers to removed questions</span></SectionTitle>
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft, marginBottom: 4 }}>
            These questions are gone from the form, so each answer shows the field it was saved as.
          </p>
          <ol>{orphans.map((it, i) => <AnswerBlock key={it.key} item={it} index={i} />)}</ol>
        </section>
      )}
    </div>
  );
}
