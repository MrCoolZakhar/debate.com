'use client';

// The next step at the top of the Delegation section for anyone in a
// delegation (owner, 19 Oct 2026: the Delegation section IS their overview,
// there is no Overview section for them any more). One white card in the
// leader card's style: what to do now in one line with at most one main
// button, and Join session while the room is live. Everything the delegation
// card already shows (people, seats, money) stays there.
//
// Owner, 20 Oct 2026: no application status chip ("I really don't like the
// tab of whatever kind of accepted"), and the card draws NOTHING when it has
// nothing to do: a 'done' step is shown only while the application is still
// being reviewed. Genuine actions (Pay now, a role's own step, Join session)
// stay the one next step; documents needed back ride under it as `notice`.
//
// Built by ParticipantView and handed down through DelegationLeadContext;
// DelegationPanel draws it right UNDER the leader card's header (the
// delegation's name is the first thing in the section) and above the member
// card, the skeleton or the error otherwise.

import { createContext } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, DoorOpen } from 'lucide-react';
import LockedPayButton from '../PaymentsLocked';
import type { NextStep } from '../dashboardKit';
import { effectiveReleaseTime } from '../shared';
import type { ParticipantAllocation } from '../types';
import { BTN_CLASS, cardStyle, FONT, INK, INK_SOFT, primaryBtn, secondaryBtn, STROKE } from './leaderKit';

/** The page's DelegationLead, for DelegationPanel to place (null outside a delegation). */
export const DelegationLeadContext = createContext<React.ReactNode>(null);

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

export default function DelegationLead({ step, status, roomCode, notice }: {
  step: NextStep | null;
  /** The application's status: a 'done' step is drawn only while it is 'submitted'. */
  status: string;
  /** The live committee room's code, for Join session. */
  roomCode: string | null;
  /** Documents the organisers still need back, when there are some. */
  notice?: React.ReactNode;
}) {
  const action = step?.kind === 'action' ? step.action : undefined;
  const joinHref = roomCode ? `/join?code=${roomCode}` : null;
  // Join session is its own button unless the next step already is it.
  const joinExtra = !!joinHref && !(action && 'href' in action && action.href === joinHref);
  // A 'done' line is worth a card only while the organisers are still deciding.
  const showDone = step?.kind === 'done' && status === 'submitted';
  const hasStep = step?.kind === 'action' || showDone;

  if (!hasStep && !joinExtra) return <>{notice}</>;

  return (
    <>
      <section aria-label="Your next step" className="flex flex-col gap-3" style={{ ...cardStyle, padding: '20px 24px' }}>
        <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#8A6614', margin: 0 }}>Your next step</p>

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
