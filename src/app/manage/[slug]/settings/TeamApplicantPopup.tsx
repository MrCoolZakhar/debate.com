'use client';

// ── Settings > Team: one applicant's review pop-up ─────────────────────────
//
// Job Board prompt 3. One pop-up, three contents, never a pop-up on a pop-up:
//   review   who they are, their MUN experience, their application answers
//            and their Job Board picks with the screening answers
//   access   (Accept) the sections they can open, all unticked, and the
//            public title, then "Add to the team"
//   reject   asked in place: "Reject this application?"
// Every decision is the parent's (TeamApplicants.tsx), which runs the shared
// code in applications/teamDecisions.ts. This file only draws and asks.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { useScrollLock } from '@/hooks/useScrollLock';
import { LogoDisc } from '@/components/LogoDisc';
import { AwardArtwork, monogramFor } from '@/app/account/accountUi';
import UnlimitedMark from '@/components/conferences/UnlimitedMark';
import { ORGANIZER_SECTIONS, TEAM_KEY, FINANCIALS_READONLY_KEY } from '@/lib/organizerPermissions';
import { questionsOf, displayAnswer, normalizeBlocks, type CustomAnswerValue } from '@/lib/customQuestions';
import JobPicksBlock from '../applications/JobPicksBlock';
import { AnswersTab, type AnswerItem } from '../applications/ApplicantDetail/tabs';
import { fmtDay } from '../applications/ApplicantDetail/kit';
import { type TeamApplicant, teamRoleLabel, firstPickTitle } from './teamApplicantsApi';

export type PopupStep = 'review' | 'access';

const INK = '#1C1410';
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const RED = '#8B2020';

// The sections that can be ticked. bundlePermissions('custom') drops the two
// bundle-defining keys, so they are never offered here.
const PICKABLE = ORGANIZER_SECTIONS.filter(s => s.key !== TEAM_KEY && s.key !== FINANCIALS_READONLY_KEY);

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}

export function Face({ name, url, size }: { name: string | null; url: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" onError={() => setFailed(true)} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: 'rgba(27,56,40,0.10)', color: FOREST, fontFamily: OUTFIT, fontWeight: 800, fontSize: Math.round(size * 0.36) }}>
      {initialsOf(name)}
    </span>
  );
}

function entryRole(t: string | null) {
  return t === 'chair' ? 'Chair' : t === 'secretariat' ? 'Secretariat' : t === 'faculty-advisor' ? 'Faculty advisor' : t === 'other' ? 'Other' : 'Delegate';
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: INK, fontFamily: OUTFIT }}>{children}</h3>;
}

export const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  minHeight: 40, padding: '0 18px', fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, letterSpacing: 0, border: 'none', borderRadius: 12,
  backgroundColor: disabled ? '#DDD4C0' : FOREST, color: disabled ? NEU.inkSoft : GOLD, cursor: disabled ? 'default' : 'pointer',
  transitionProperty: 'background-color, scale', transitionDuration: '150ms', transitionTimingFunction: EASE,
});
export const quietBtn = (disabled: boolean): React.CSSProperties => ({
  minHeight: 40, padding: '0 14px', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, borderRadius: 12,
  color: NEU.inkSoft, background: 'transparent', border: '1.5px solid #DDD4C0', opacity: disabled ? 0.5 : 1,
  cursor: disabled ? 'default' : 'pointer',
});
export const rejectBtn = (disabled: boolean): React.CSSProperties => ({
  minHeight: 40, padding: '0 14px', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, borderRadius: 12,
  color: RED, background: 'transparent', border: '1.5px solid rgba(139,32,32,0.3)', opacity: disabled ? 0.5 : 1,
  cursor: disabled ? 'default' : 'pointer',
});

export default function TeamApplicantPopup({
  applicant: a, initialStep, canAccept, busy, customQuestions, onAccept, onReject, onClose,
}: {
  applicant: TeamApplicant;
  initialStep: PopupStep;
  canAccept: boolean;
  busy: boolean;
  /** application_role_configs.custom_questions of the applicant's role. */
  customQuestions: unknown;
  /** Resolves true when the accept landed (the parent closes the pop-up). */
  onAccept: (picked: Set<string>, publicTitle: string) => Promise<boolean>;
  onReject: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<PopupStep>(canAccept ? initialStep : 'review');
  const [askReject, setAskReject] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [title, setTitle] = useState(() => firstPickTitle(a) ?? '');
  const bodyRef = useRef<HTMLDivElement>(null);
  useScrollLock(true);

  const waiting = a.status === 'submitted';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);

  // Answers, read the way the Applications page reads them: archived
  // questions included so an old answer stays labelled; answers with no
  // question at all are still shown under the field they were saved as.
  const { items, orphans } = useMemo(() => {
    const questions = questionsOf(normalizeBlocks(customQuestions ?? []), { includeArchived: true });
    const answers = (a.custom_answers ?? {}) as Record<string, CustomAnswerValue>;
    const ids = new Set(questions.map(q => q.id));
    const it: AnswerItem[] = questions.map(q => ({ key: q.id, label: q.label, answer: displayAnswer(q, answers[q.id]), archived: !!q.archived }));
    const or: AnswerItem[] = Object.entries(answers).filter(([k]) => !ids.has(k))
      .map(([key, value]) => ({ key, label: key, answer: Array.isArray(value) ? value.join(', ') : String(value ?? '') }));
    return { items: it, orphans: or };
  }, [customQuestions, a.custom_answers]);

  const experience = useMemo(() => [...(a.experience_entries ?? [])].sort((x, y) => {
    if (!x.event_date && !y.event_date) return 0;
    if (!x.event_date) return 1;
    if (!y.event_date) return -1;
    return y.event_date.localeCompare(x.event_date);
  }), [a.experience_entries]);

  const forTitle = firstPickTitle(a);
  const statusLine = a.status === 'accepted' ? `Accepted${a.decided_at ? ` ${fmtDay(a.decided_at)}` : ''}`
    : a.status === 'rejected' ? `Rejected${a.decided_at ? ` ${fmtDay(a.decided_at)}` : ''}` : null;

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center px-4"
        style={{ zIndex: 130, backgroundColor: 'rgba(28,20,16,0.42)', backdropFilter: 'blur(3px)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={step === 'access' ? 'Add to the team' : `Application from ${a.name ?? 'an applicant'}`}
          className="w-full flex flex-col"
          style={{
            maxWidth: 640, maxHeight: '88vh', backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 24,
            boxShadow: '0 26px 70px rgba(27,56,40,0.30)', fontFamily: OUTFIT, overflow: 'hidden',
          }}
        >
          {/* Head */}
          <div className="flex items-start gap-3" style={{ padding: '20px 22px 14px' }}>
            {step === 'access' ? (
              <button type="button" onClick={() => setStep('review')} disabled={busy} aria-label="Back to the application"
                className="flex items-center justify-center rounded-full flex-shrink-0 focus:outline-none"
                style={{ width: 36, height: 36, border: '1.5px solid #DDD4C0', background: 'transparent', color: INK, cursor: busy ? 'default' : 'pointer' }}>
                <ArrowLeft size={16} />
              </button>
            ) : (
              <Face name={a.name} url={a.avatar_url} size={56} />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ margin: 0, fontSize: 19, fontWeight: 800, color: INK, overflowWrap: 'anywhere', lineHeight: 1.25 }}>
                <span style={{ overflowWrap: 'anywhere' }}>{step === 'access' ? `Add ${a.name ?? 'them'} to the team` : (a.name ?? 'No name')}</span>
                {step === 'review' && a.unlimited && <UnlimitedMark />}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 13.5, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>
                {step === 'access'
                  ? 'Pick the pages they can open. Nothing is ticked until you tick it'
                  : [teamRoleLabel(a.role) + (forTitle ? ` for ${forTitle}` : ''), a.submitted_at ? `Applied ${fmtDay(a.submitted_at)}` : null].filter(Boolean).join(' · ')}
              </p>
              {step === 'review' && a.email && (
                <p style={{ margin: '2px 0 0', fontSize: 13.5, color: INK, overflowWrap: 'anywhere' }}>{a.email}</p>
              )}
              {step === 'review' && statusLine && (
                <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: a.status === 'accepted' ? FOREST : RED }}>
                  {statusLine}{a.status === 'accepted' && a.on_team ? ' · On the team' : ''}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
              className="flex items-center justify-center rounded-full flex-shrink-0 focus:outline-none"
              style={{ width: 36, height: 36, border: 'none', background: 'rgba(27,56,40,0.06)', color: INK, cursor: busy ? 'default' : 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div ref={bodyRef} className="flex-1 min-h-0" style={{ overflowY: 'auto', padding: '6px 22px 18px' }}>
            {step === 'review' ? (
              <div className="flex flex-col" style={{ gap: 24 }}>
                <section aria-label="MUN experience">
                  <SectionLabel>MUN Experience</SectionLabel>
                  {experience.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>No MUN experience listed.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {experience.map((e, i) => {
                        const awards = e.awards ?? [];
                        return (
                          <li key={e.id ?? i} className="flex items-start gap-3" style={{ padding: '11px 0', borderTop: i ? '1px solid #DDD4C0' : 'none' }}>
                            <LogoDisc src={null} size={40} fallbackText={monogramFor(e.conference_name)} alt={e.conference_name} />
                            <div className="min-w-0 flex-1">
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{e.conference_name}</p>
                              <p style={{ margin: 0, fontSize: 12.5, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>
                                {[entryRole(e.entry_type), [e.allocation, e.committee].filter(Boolean).join(' · '), fmtDay(e.event_date)].filter(Boolean).join(' · ')}
                              </p>
                              {e.description && (
                                <p className="mt-1 whitespace-pre-wrap" style={{ margin: '4px 0 0', fontSize: 13, color: INK, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{e.description}</p>
                              )}
                            </div>
                            {awards.length > 0 && (
                              <span className="flex items-center gap-1 flex-shrink-0" title={awards.join(', ')}>
                                {awards.slice(0, 3).map(w => <AwardArtwork key={w} name={w} size={24} />)}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {(items.length > 0 || orphans.length > 0) && (
                  <section aria-label="Their application">
                    <AnswersTab items={items} orphans={orphans} />
                  </section>
                )}

                <JobPicksBlock picks={a.picks} />
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: 18 }}>
                <div className="flex flex-wrap gap-2">
                  {PICKABLE.map(s => {
                    const on = picked.has(s.key);
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        aria-pressed={on}
                        title={`${s.label}: ${s.blurb}`}
                        disabled={busy}
                        onClick={() => setPicked(prev => {
                          const next = new Set(prev);
                          if (next.has(s.key)) next.delete(s.key); else next.add(s.key);
                          return next;
                        })}
                        className="flex items-center gap-1.5 rounded-xl focus:outline-none"
                        style={{
                          minHeight: 40, padding: '9px 12px', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700,
                          color: on ? FOREST : NEU.inkSoft,
                          backgroundColor: on ? 'rgba(27,56,40,0.10)' : 'transparent',
                          border: on ? '1.5px solid rgba(27,56,40,0.30)' : '1.5px dashed #D8CDB6',
                          cursor: busy ? 'default' : 'pointer',
                          transitionProperty: 'background-color, border-color, color', transitionDuration: '140ms', transitionTimingFunction: EASE,
                        }}
                      >
                        {on ? <Check size={14} strokeWidth={3} /> : <Icon size={14} strokeWidth={2.2} />}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                {picked.size === 0 && (
                  <p style={{ margin: 0, fontSize: 12.5, color: NEU.inkSoft }}>
                    Nothing picked yet. They would join able to see the dashboard and nothing else.
                  </p>
                )}
                <div>
                  <label htmlFor="team-applicant-title" className="block" style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6 }}>
                    Public title
                  </label>
                  <input
                    id="team-applicant-title"
                    type="text"
                    value={title}
                    maxLength={80}
                    disabled={busy}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Under-Secretary-General"
                    className="w-full focus:outline-none"
                    style={{ minHeight: 42, padding: '0 12px', borderRadius: 12, border: '1.5px solid #D8CDB6', background: '#FFFFFF', fontFamily: OUTFIT, fontSize: 14, color: INK }}
                  />
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: NEU.inkSoft, lineHeight: 1.5 }}>
                    Shown beside their photo on your public conference page.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 22px 18px', borderTop: '1px solid #E4DAC4' }}>
            {step === 'review' && waiting && askReject ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 min-w-0" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>
                  Reject this application? They get the usual rejection email
                </p>
                <button type="button" className="focus:outline-none" style={quietBtn(busy)} disabled={busy} onClick={() => setAskReject(false)}>Cancel</button>
                <button type="button" className="focus:outline-none" style={{ ...rejectBtn(busy), background: busy ? 'transparent' : 'rgba(139,32,32,0.06)' }} disabled={busy}
                  onClick={async () => { const ok = await onReject(); if (!ok) setAskReject(false); }}>
                  {busy ? 'Rejecting' : 'Yes, reject'}
                </button>
              </div>
            ) : step === 'review' ? (
              <div className="flex flex-wrap items-center gap-2">
                {waiting && !canAccept && (
                  <p className="w-full" style={{ margin: '0 0 6px', fontSize: 12.5, color: NEU.inkSoft }}>
                    Adding someone to the team needs the Team permission
                  </p>
                )}
                <button type="button" className="focus:outline-none" style={quietBtn(busy)} disabled={busy} onClick={onClose}>Close</button>
                <div className="flex-1" />
                {waiting && (
                  <>
                    <button type="button" className="focus:outline-none" style={rejectBtn(busy)} disabled={busy} onClick={() => setAskReject(true)}>Reject</button>
                    <button type="button" className="focus:outline-none" style={primaryBtn(busy || !canAccept)} disabled={busy || !canAccept}
                      title={canAccept ? undefined : 'Adding someone to the team needs the Team permission'}
                      onClick={() => setStep('access')}>
                      Accept
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className="flex items-center gap-1.5 focus:outline-none" style={quietBtn(busy)} disabled={busy} onClick={() => setStep('review')}>
                  <ArrowLeft size={14} /> Back
                </button>
                <div className="flex-1" />
                <button type="button" className="focus:outline-none" style={primaryBtn(busy || !canAccept)} disabled={busy || !canAccept}
                  onClick={() => { void onAccept(picked, title); }}>
                  {busy ? 'Adding' : 'Add to the team'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
