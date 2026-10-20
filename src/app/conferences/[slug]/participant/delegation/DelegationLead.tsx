'use client';

// The next step in the Overview section for anyone in a delegation. Owner,
// 20 Oct 2026: Overview is back for every member and it is the person's OWN
// page (their next step, Join session, documents needed back, their seat);
// Delegation is its own section again, second, with the leader or member card
// only. One white card in the leader card's style: what to do now in one line
// with at most one main button, and Join session while the room is live.
//
// Owner, 20 Oct 2026: no application status chip ("I really don't like the
// tab of whatever kind of accepted"), and the card draws NOTHING when it has
// nothing to do: a 'done' step is shown only while the application is still
// being reviewed, or with `showDone` (a faculty advisor, whose Overview would
// otherwise be empty). Genuine actions (Pay now, a role's own step, Join
// session) stay the one next step; documents needed back ride under it as
// `notice`. Built and placed by ParticipantView.

import Link from 'next/link';
import { ArrowDown, ArrowRight, DoorOpen } from 'lucide-react';
import LockedPayButton from '../PaymentsLocked';
import type { NextStep } from '../dashboardKit';
import { effectiveReleaseTime } from '../shared';
import type { ParticipantAllocation } from '../types';
import { BTN_CLASS, cardStyle, FONT, INK, INK_SOFT, primaryBtn, secondaryBtn, STROKE } from './leaderKit';

/** The committee room's code while it is open to delegates, else null. */
export function liveRoomCode(myAllocation: ParticipantAllocation | null, conferenceStartDate: string | null): string | null {
  const cc = myAllocation?.conference_committees;
  const code = cc?.session_code ?? null;
  if (!code) return null;
  const releaseMs = effectiveReleaseTime(cc?.released_to_delegates_at ?? null, conferenceStartDate);
  return releaseMs !== null && releaseMs <= Date.now() ? code : null;
}

function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export default function DelegationLead({ step, status, roomCode, notice, showDone = false }: {
  step: NextStep | null;
  /** The application's status: a 'done' step is drawn while it is 'submitted' (or with showDone). */
  status: string;
  /** The live committee room's code, for Join session. */
  roomCode: string | null;
  /** Documents the organisers still need back, when there are some. */
  notice?: React.ReactNode;
  /** Draw a 'done' step whatever the status ("You're all set"). */
  showDone?: boolean;
}) {
  const action = step?.kind === 'action' ? step.action : undefined;
  const joinHref = roomCode ? `/join?code=${roomCode}` : null;
  // Join session is its own button unless the next step already is it.
  const joinExtra = !!joinHref && !(action && 'href' in action && action.href === joinHref);
  // A 'done' line is worth a card only while the organisers are still deciding.
  const reviewing = status === 'submitted';
  const doneShown = step?.kind === 'done' && (reviewing || showDone);
  const hasStep = step?.kind === 'action' || doneShown;
  const label = step?.kind === 'action' || !hasStep ? 'Your next step' : reviewing ? 'Under review' : 'You\u2019re all set';

  if (!hasStep && !joinExtra) return <>{notice}</>;

  return (
    <>
      <section aria-label="Your next step" className="flex flex-col gap-3" style={{ ...cardStyle, padding: '20px 24px' }}>
        <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', margin: 0 }}>{label}</p>

        {step && hasStep && (
          <p
            className="[overflow-wrap:anywhere]"
            style={step.kind === 'action'
              ? { fontFamily: FONT, fontSize: 18, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.4 }
              : { fontFamily: FONT, fontSize: 15, color: INK_SOFT, margin: 0, lineHeight: 1.5 }}
          >
            {step.line}
          </p>
        )}

        {(action || joinExtra) && (
          <div className="flex items-center gap-2.5 flex-wrap mt-1">
            {action && 'href' in action && action.lockedSlug ? (
              <LockedPayButton slug={action.lockedSlug} label={<>{action.label}</>} className={BTN_CLASS} style={primaryBtn} />
            ) : action && 'href' in action ? (
              action.external
                ? <a href={action.href} className={BTN_CLASS} style={primaryBtn}>{action.label} <ArrowRight size={16} strokeWidth={STROKE} aria-hidden /></a>
                : <Link href={action.href} className={BTN_CLASS} style={primaryBtn}>{action.label} <ArrowRight size={16} strokeWidth={STROKE} aria-hidden /></Link>
            ) : action ? (
              <button type="button" onClick={() => scrollToAnchor(action.scrollTo)} className={BTN_CLASS} style={primaryBtn}>
                {action.label} <ArrowDown size={16} strokeWidth={STROKE} aria-hidden />
              </button>
            ) : null}
            {joinExtra && joinHref && (
              <Link href={joinHref} className={BTN_CLASS} style={action ? secondaryBtn : primaryBtn}>
                <DoorOpen size={17} strokeWidth={STROKE} aria-hidden />
                Join session
              </Link>
            )}
          </div>
        )}
      </section>
      {notice}
    </>
  );
}
