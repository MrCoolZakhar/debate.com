'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X, Mic, FileText, ScrollText, Users, Gavel, Trophy, History as HistoryIcon, ExternalLink, Clock, Megaphone, Radio, Medal } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import {
  slateState, SLATE_STATE_LABEL, slateCompleteness, chairDeadline,
  type AwardsConfig, type AwardTier, type ConferenceAwardRow, type SlateState,
} from '@/lib/awards';
import { loadCommitteeAwards } from '@/lib/awardsService';
import { CircleFlag } from '@/components/CircleFlag';
import { LogoDisc } from '@/components/LogoDisc';
import { getCountryByName } from '@/lib/countries';
import Portal from '@/components/Portal';
import ProfileLink from '@/components/ProfileLink';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useModalEscape } from '@/components/ModalOverlay';
import { useDialogFocusTrap } from '@/components/dialogFocus';
import Avatar from '@/components/Avatar';
import {
  NeuInset, NeuIconDisc, NEU, NEU_GRADIENTS, type NeuGradient, OUTFIT, EASE,
} from '@/components/neu';
// `NEU.muted` measures 2.81:1 on this surface and no longer appears in this
// file at all: every label, caption and sentence here is SOFT (5.55:1). The two
// accent colours that were also carrying text are read through their inks —
// `NEU.green` is 4.30:1 and drops to 3.86:1 inside the adopted-resolution tint,
// so GREEN_INK carries the words and `NEU.green` survives on dots and fills
// only, where the 3:1 non-text bar applies. See ./tokens for the full sweep.
import { SessionScoreboardBoard, SessionLoadState } from './SessionBoard';
import { SessionDocuments } from './SessionDocuments';
import { SessionAttendance } from './SessionAttendance';
import { useSessionCommittee } from './useSessionCommittee';
import { SOFT, GREEN_INK, AMBER_INK, RED } from './tokens';
import { committeeIdentity } from './identity';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

// ── Shared types (page.tsx imports these, page files can't export extras) ──

export interface CaucusJson {
  active?: boolean;
  type?: 'moderated' | 'unmoderated';
  motionLabel?: string;
  purpose?: string;
  totalTime?: number;
  remainingTime?: number;
  speakingTime?: number;
  currentSpeaker?: string | null;
  /** Wall-clock anchor for the total caucus countdown; null = paused.
   *  `remainingTime` is the value AT this instant — see caucusRemainingNow(). */
  totalStartedAt?: string | null;
  spokenCountries?: string[];
  isConsultation?: boolean;
}

/** A chair on the dais, resolved to a Gavelling profile where one exists.
 *  `id` is null for a hand-seeded display_chairs entry with no account. */
export interface ChairPerson {
  id: string | null;
  name: string;
  avatarUrl: string | null;
}

/** A chair who has been invited and has not accepted. Deliberately NOT a
 *  `ChairPerson`: there is no `id`, so nothing can link an unaccepted invitee
 *  to a public CV, and no accidental `[...chairs, ...pendingChairs]` typechecks
 *  its way past the distinction the two lists exist to keep. */
export interface PendingChairPerson {
  /** `conference_chair_invites.id` — the React key, nothing more. */
  id: string;
  /** Their account name, else the name the organiser typed, else their email
   *  (`pendingInviteName`). Organiser-only: this is never rendered publicly. */
  name: string;
  avatarUrl: string | null;
}

/** One `feedback` row. All five extra columns beyond the original
 *  country/chair/content triple are real: `level` ('speech' today), the
 *  per-factor ratings blob, and the speech the note was attached to. */
export interface FeedbackEntry {
  country: string;
  chairName: string;
  content: string;
  createdAt: string;
  level: string;
  factorScores: Record<string, number>;
  speechContext: string | null;
  speechSeconds: number | null;
  /** WHAT the speech was about: the caucus topic or motion label, or the committee
   *  topic on the GSL. `speechContext` is a three-value enum, so without this every
   *  note in a long session reads the same.
   *
   *  OPTIONAL, unlike the fields above, because this wall's loader
   *  (`live/page.tsx`) does not select `speech_topic` / `spoken_at` yet — adding the
   *  two column names to that one `.select()` is all it takes to light this up. */
  speechTopic?: string | null;
  /** When the SPEECH happened, which is not `createdAt` — that is when the chair
   *  typed, and can be an hour later for a note written on a past speech. */
  spokenAt?: string | null;
}

export interface LiveCommittee {
  conf: {
    id: string;
    name: string;
    abbreviation: string | null;
    logoUrl: string | null;
    topics: string[] | null;
    totalSlots: number;
    sessionId: string | null;
    sessionCode: string | null;
    /** `conference_committees.released_to_chairs_at` — when the chairs' invite
     *  went (or is scheduled to go) out. Read ONLY so a never-opened room can
     *  say whether its dais has actually been told; nothing here writes it. The
     *  committees page owns that write. */
    releasedToChairsAt: string | null;
    /** `conference_committees.delegation_size` — 1, or 2 for a DOUBLE
     *  DELEGATION committee (two people share one country seat).
     *
     *  This is the committee-wide mirror of
     *  `committee_country_slots.delegation_size`, and reading it rather than the
     *  slot rows is a deliberate, measured choice: in production all 22
     *  committees with any double slot have EVERY slot double, the two columns
     *  never disagree, and `committee_country_slots` is 17,189 rows against 393
     *  committees. See ./allocations for the full model. */
    delegationSize: number;
    chairUserIds: string[];
    /** chair_user_ids resolved against profiles, falling back to the
     *  trigger-maintained display_chairs entry at the same index.
     *
     *  ACCEPTED CHAIRS ONLY. This list means "people who are on the dais and
     *  can get into the room", and `nowPlaying` reads its length to say
     *  "Chairs have the code". A pending invitee has no code, so folding one
     *  in here would make an operational headline lie. Pending invites are
     *  `pendingChairs` below, and the two are never merged. */
    chairs: ChairPerson[];
    /** Chairs who have been INVITED and have not accepted:
     *  `conference_chair_invites` rows with status 'pending'. They are NOT in
     *  `chair_user_ids` and never reach `display_chairs` — see
     *  `src/lib/chairInvites.ts`. Organiser-only, like every other surface that
     *  shows them; the public conference page must never print these names. */
    pendingChairs: PendingChairPerson[];
  };
  session: {
    id: string;
    code: string;
    name: string;
    phase: string;
    caucus: CaucusJson | null;
    chairNames: string[];
    /** Who holds the gavel: `settings.headChair`, else `chair_names[0]` (the
     *  same default the chair page uses). A NAME, never the chair suffix.
     *  Optional so older fixtures still typecheck; the live card orders its
     *  dais by it. */
    headChair?: string | null;
    suspendedAt: string | null;
    endedAt: string | null;
    /** `committees.updated_at`, maintained by `committees_updated_at_trigger`
     *  (BEFORE UPDATE ON committees). Half of the STATUS axis — see
     *  `lastActiveAt` in cardModel.ts for why it is never used on its own. */
    updatedAt: string | null;
    /** The one-shot resume latch (`committees.resuming_chair`). NOT the gavel —
     *  see AGENTS.md, "resuming_chair is NOT the gavel". Read here only so a
     *  suspended card can name who is bringing the room back, and so a latch
     *  that was claimed and never cleared can be reported as the deadlock it is. */
    resumingChair: string | null;
    /** `settings.quorumThreshold` straight off the row — never via the settings
     *  store, which is never hydrated outside the chair page (AGENTS.md rule 14).
     *  Default 'none'; only 13 of 509 production committees set it at all. */
    quorumThreshold: string;
    /** Enabled ranking factors + scale from committees.settings.scoring, so
     *  feedback ratings can be labelled with the chair's own factor names. */
    scoringFactors: { id: string; name: string }[];
    factorScaleMax: number;
  } | null;
  currentSpeaker: { country: string | null; timeRemaining: number; startedAt: string | null } | null;
  /** `isObserver` mirrors `delegates.is_observer`. Observers sit in the room but
   *  are NOT part of the voting body, so every present/total count on this page
   *  excludes them — the same rule the chair console applies
   *  (`chair/[code]/page.tsx:2620, 2627-2628`). */
  /** `logoUrl` is the seat's own crest (`delegates.logo_url`), flattened from
   *  the conference side at seed time. Null on a standalone session. */
  delegates: { country: string; status: string; isObserver: boolean; logoUrl?: string | null }[];
  gslQueue: string[];
  caucusQueue: string[];
  // The `motions` table is DELIBERATELY not read by this page. The cards report
  // the stage a room is in, never what is sitting on the chair's desk, and the
  // recap's "Motions raised" tile counts `motion-raised` ledger events in
  // `messages` (see `motionsLogged` below) rather than motion rows — which are
  // hard-deleted on both accept and reject and so cannot be counted anyway.
  documents: {
    type: string; status: string; docCode: string; title: string; sponsors: string[];
    /** Public Supabase Storage URL, or null — 17 of 23 production rows (74%) have none. */
    fileUrl: string | null;
    fileName: string | null;
    /** Inline body, used only when there is no file. Blank on 22 of 23 production rows. */
    content: string | null;
    createdAt: string | null;
  }[];
  /** ONLY `type: 'speech'` ledger rows, with the `__chair__` sentinel country
   *  removed. `logEvent` (committeeService.ts:899-914) writes six event types
   *  onto the same `__log__:` channel; treating all of them as speeches inflated
   *  every count on this page by ~37%. `at` is the payload timestamp, falling
   *  back to `messages.created_at`. */
  speechLogs: { country: string; seconds: number; context: string; topic: string; at: string | null }[];
  /** Every ledger row regardless of type, for counting non-speech activity. */
  eventLogs: { country: string; type: string; at: string | null }[];
  /** Every delegation's HEADLINE score, computed by `sessionHeadlineScores`
   *  (conferenceScoreboard.ts) with the chair scoreboard's own arithmetic. */
  scores: { country: string; total: number }[];
  /** Most recent sign of life in the room, from any source we can see. Drives
   *  the staleness guard on the voting variant — see `votingLooksLive`. */
  lastActivityAt: string | null;
  /** `max(messages.created_at)` over EVERY message in the room, chat included —
   *  the other half of `GREATEST(committees.updated_at, max(messages.created_at))`.
   *  Chat is the one kind of activity that touches neither the `committees` row
   *  nor the ledger, so without it a room where delegates are talking but the
   *  chair has not pressed anything reads as stalled. */
  lastMessageAt: string | null;
  /** True when this committee has demonstrably run before: chairs joined, a
   *  preserved queue, documents, ledger rows or chair feedback. Separates a
   *  resume roll call from a session that was never opened — both sit at
   *  `phase='pre-session'` (`committeeService.ts:1097-1105`). */
  hasHistory: boolean;
  feedback: FeedbackEntry[];
}

/** Delegates who count toward the voting body — observers excluded, matching
 *  the chair console exactly. */
export function votingBody(lc: LiveCommittee): LiveCommittee['delegates'] {
  return lc.delegates.filter((d) => !d.isObserver);
}

/** `{ present, total }` over the voting body, the chair's own numbers. */
export function presence(lc: LiveCommittee): { present: number; total: number } {
  const body = votingBody(lc);
  return { present: body.filter((d) => d.status !== 'absent').length, total: body.length };
}

/** `not-started` = never opened. `roll-call` = opened, initial roll call underway.
 *  `resumed` = ran before and is doing its roll call after a break. The last two
 *  are live rooms and must NOT get the dead "Session not in progress yet"
 *  placeholder — a resumed committee still holds its GSL, documents and chat. */
export type CardStatus =
  | 'no-session' | 'not-started' | 'roll-call' | 'resumed' | 'live' | 'suspended' | 'ended';

export function cardStatus(lc: LiveCommittee): CardStatus {
  if (!lc.session) return 'no-session';
  if (lc.session.endedAt) return 'ended';
  if (lc.session.phase === 'adjourned') return 'suspended';
  if (lc.session.phase === 'pre-session' || lc.session.phase === 'roll-call') {
    // A resume roll call is indistinguishable from a first roll call by phase
    // alone, so the room's own history is what separates them.
    if (lc.hasHistory) return 'resumed';
    if ((lc.session.chairNames?.length ?? 0) > 0) return 'roll-call';
    return 'not-started';
  }
  return 'live';
}

/** The three statuses that mean "a room is actually doing something right now". */
export function isOnTheFloor(s: CardStatus): boolean {
  return s === 'live' || s === 'roll-call' || s === 'resumed';
}

export const PHASE_LABELS: Record<string, string> = {
  'pre-session': 'Pre-session',
  'roll-call': 'Roll Call',
  'speakers-list': "General Speakers' List",
  'moderated-caucus': 'Moderated Caucus',
  'unmoderated-caucus': 'Unmoderated Caucus',
  'voting': 'Voting Procedure',
  'adjourned': 'Adjourned',
};

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1h 12m" / "4m 20s" / "0m". Mirrors `formatSpeakingTime` in
 *  `conferenceScoreboard.ts` so the recap and the scoreboard read alike. */
export function fmtSpeakingTotal(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function flagCodeFor(name: string): string {
  return getCountryByName(name)?.code ?? '';
}

// The live wall's scores ARE the chair's scores (18 Sep 2026). This used to replicate an
// old formula by hand (attendance 5, WP 10, DR 20, a point per 10 s, GSL 10, caucus 8) with
// no motion, right-of-reply or manual points, the committee's own point values ignored and
// no blend, so the recap's "top" and "quietest" disagreed with the chair's board. The page
// now computes them with scoring.ts (`sessionHeadlineScores`), and this only reads them.
export function computeScores(lc: LiveCommittee): { country: string; total: number }[] {
  const byCountry = new Map(lc.scores.map((x) => [x.country, x.total]));
  return lc.delegates.map((d) => ({ country: d.country, total: byCountry.get(d.country) ?? 0 }));
}

// ── Small shared bits ───────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-bold uppercase"
      style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.08em' }}
    >
      {children}
    </p>
  );
}

/** Exported so the per-committee scoreboard and the scoped broadcast composer
 *  open in the SAME shell as the recap, roster and awards modals rather than
 *  each growing their own. `maxWidth` widens it for the scoreboard's table.
 *
 *  `rail` is the bookmark strip — see `ModalRail` below. It is rendered OUTSIDE
 *  the scrolling card on purpose. */
export function ModalShell({ children, onClose, maxWidth = 672, rail, label }: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: number;
  /** Accessible name when the content has no heading. Normally not needed:
   *  the dialog is labelled by the first h1/h2/h3 inside it. */
  label?: string;
  /** Tabs pinned to the modal's edge. MUST NOT scroll with the body and MUST
   *  NOT be clipped by it, so it is a SIBLING of the scroll container rather
   *  than a child — see the layout note in the body. */
  rail?: (side: boolean) => React.ReactNode;
}) {
  /* The page behind a dialog must not scroll, and Escape must dismiss it.
     Both come from the shared implementations rather than being hand-rolled
     here: the lock is reference counted (a confirm stacked on this must not
     release it when IT closes), and the Escape stack is shared with
     ModalOverlay so one keypress reaches the top-most dialog only, whichever
     component drew it.

     This keeps its own backdrop markup rather than delegating to ModalOverlay:
     that component wraps its children in an auto-width div, which would break
     the `w-full` + maxWidth sizing the card below relies on. */
  useScrollLock(true);
  useModalEscape(onClose);

  /* A real modal dialog (23 Sep 2026): role="dialog" + aria-modal on the
     panel (card AND rail), labelled by its own heading, focus moved into it on
     open, Tab trapped inside (the shared GrowDialog trap, which lets a confirm
     or popover portaled AFTER this layer keep focus), and focus handed back to
     whatever opened it on close. Escape is the shared stack above. */
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const closingRef = useRef(false);
  const focusedRef = useRef(false);
  // Captured during the first render, before the dialog exists, so it is the
  // control that opened it (Portal mounts its children a render later).
  const [returnTo] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null));
  useDialogFocusTrap(dialogRef, layerRef, closingRef);
  const labelFromHeading = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const h = node.querySelector<HTMLElement>('h1, h2, h3');
    if (h) {
      if (!h.id) h.id = titleId;
      if (node.getAttribute('aria-labelledby') !== h.id) node.setAttribute('aria-labelledby', h.id);
    }
  }, [titleId]);
  const setDialogNode = useCallback((node: HTMLDivElement | null) => {
    dialogRef.current = node;
    if (!node) return;
    labelFromHeading(node);
    if (!focusedRef.current) {
      focusedRef.current = true;
      node.focus({ preventScroll: true });
    }
  }, [labelFromHeading]);
  // The heading can change (a tab switch re-renders the body): keep the label.
  useLayoutEffect(() => { labelFromHeading(dialogRef.current); });
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    closingRef.current = false;
    return () => {
      mountedRef.current = false;
      closingRef.current = true;
      // Deferred, and only when the shell is really gone: React's StrictMode
      // unmounts and re-mounts effects once in dev (the re-run sets
      // mountedRef back to true before this fires), which would otherwise send
      // focus back to the trigger and leave the trap switched off.
      setTimeout(() => {
        if (mountedRef.current) { closingRef.current = false; return; }
        if (returnTo && returnTo.isConnected && returnTo !== document.body) {
          returnTo.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, [returnTo]);

  // The narrow bookmark strip is ONE scrolling row, so the tab you are on can
  // be off-screen. Bring it back whenever the active bookmark CHANGES.
  //
  // Deliberately not `scrollIntoView`: it scrolls ancestors as well as the
  // strip, and inside a portaled, scroll-locked dialog it under-scrolled (the
  // active tab was left half under the fade). This scrolls the one element that
  // should move, by exactly the amount needed, keeping the tab clear of the
  // 22px fade at either end.
  //
  // No dependency array — `rail` is a fresh closure every render, so a dep on
  // it would fire this on every render regardless. The `lastActive` guard is
  // what makes it act once per tab change instead.
  const topRailRef = useRef<HTMLDivElement | null>(null);
  const lastActiveTabRef = useRef<string | null>(null);
  useEffect(() => {
    const el = topRailRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    const key = active?.textContent ?? null;
    if (key === lastActiveTabRef.current) return;
    lastActiveTabRef.current = key;
    if (!active) return;
    const a = active.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    const PAD = 26;
    // Assigning `scrollLeft` rather than `scrollBy({behavior:'smooth'})`:
    // measured, the smooth form is a NO-OP on this element (the dialog's scroll
    // lock is in force and the environment may be honouring reduced motion),
    // while the instant form works. A tab strip that jumps to the right place
    // beats one that animates nowhere.
    if (a.right > c.right - PAD) el.scrollLeft += a.right - c.right + PAD;
    else if (a.left < c.left + 6) el.scrollLeft += a.left - c.left - 6;
  });

  // Portal'd so the dim backdrop escapes the manage layout's `relative z-10`
  // content wrapper and covers the header/sidebar too.
  return (
    <Portal>
      {/* `lg:pe-[156px]` when there is a side rail, and it is a bug fix.
          The rail hangs 148px PAST the card's inline end, but only the CARD was
          centred — so at 1024px (the width the side rail switches on at) the
          card's right edge landed at 892 and the rail's at 1040, 16px off the
          screen. Reserving the rail's width as end padding centres the pair
          instead of the card, which is what "tucked under the card's edge"
          means once the tabs are part of the object. */}
      <div
        ref={layerRef}
        className={`fixed inset-0 z-50 flex items-center justify-center px-3 py-5 sm:px-4 sm:py-8${rail ? ' lg:pe-[156px]' : ''}`}
        style={{ backgroundColor: 'rgba(27,20,16,0.42)' }}
        onClick={onClose}
      >
        {/* THE POSITIONING SHELL, and the reason the rail cannot be inside the
            card. The card is the scroll container (`overflow-y: auto`), so a
            rail rendered as its child would scroll away with the body — and the
            card is also rounded, so an absolutely positioned rail inside it
            would be clipped at the corner. AGENTS.md forbids both. The rail is
            therefore a SIBLING, anchored to this wrapper.

            BELOW `lg` (1024px) THE RAIL IS NOT A SIDE RAIL AT ALL. There is not
            enough room beside a 672–760px card on a narrow screen — the tabs
            would be pushed off-screen or over the backdrop's edge — so the
            bookmarks come off the TOP of the card instead.

            IT IS ONE ROW, AND IT SCROLLS. It used to be `flex-wrap`, which at
            375px measured 106px tall — three rows of six pills stacked above a
            card whose own max-height still assumed one. That is the thing the
            owner is looking at when he says the bookmarks are wrong. A wrapping
            strip also has no stable height, so `max-h` could not be right for
            both a three-row and a one-row case, and the card ran off the bottom
            of the screen.

            So: `flex-nowrap` + `overflow-x: auto`, one fixed row of 46px
            bookmarks, tucked 12px under the card's top edge exactly as the side
            rail tucks under its inline edge — same object, same bookmark reading, rotated. The
            active tab is scrolled into view on mount and on change, so the tab
            you are on is never the one off-screen. */}
        <div
          ref={setDialogNode}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className="w-full relative flex flex-col min-h-0 focus:outline-none"
          style={{ maxWidth }}
          onClick={(e) => e.stopPropagation()}
        >
          {rail && (
            <>
              <div
                ref={topRailRef}
                className="lg:hidden flex flex-nowrap items-end overflow-x-auto flex-shrink-0"
                style={{
                  // -12 rather than -10: the card must cover the strip's own
                  // 6px horizontal scrollbar (globals.css styles it visibly and
                  // is a shared file this change does not touch) as well as the
                  // bookmarks' square bottom edge.
                  gap: 4, zIndex: 0, marginBlockEnd: -12,
                  scrollbarWidth: 'none', msOverflowStyle: 'none',
                  // The strip runs to the card's edges, but the last bookmark
                  // must not sit flush against the rounded corner — and the
                  // fade tells a reader there is more strip to scroll to.
                  paddingInlineEnd: 14,
                  WebkitMaskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 22px), transparent 100%)',
                  maskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 22px), transparent 100%)',
                }}
              >
                {rail(false)}
              </div>
              <div
                className="hidden lg:flex flex-col"
                style={{
                  position: 'absolute', insetInlineStart: '100%', insetBlockStart: 26,
                  gap: 6, zIndex: 0, marginInlineStart: -10,
                }}
              >
                {rail(true)}
              </div>
            </>
          )}
        <div
          className={`w-full rounded-[22px] p-5 sm:p-7 lg:p-8 relative overflow-y-auto${rail ? ' max-h-[calc(100vh-94px)] sm:max-h-[calc(100vh-118px)] lg:max-h-[calc(100vh-64px)]' : ''}`}
          style={{
            backgroundColor: NEU.surface, boxShadow: NEU.out, fontFamily: OUTFIT,
            // The card paints ON TOP of the rail, so the tabs read as bookmarks
            // tucked behind its edge rather than as buttons floating beside it.
            zIndex: 1,
            ...(rail ? {} : { maxHeight: 'calc(100vh - 64px)' }),
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 inline-flex items-center justify-center rounded-full focus:outline-none"
            style={{ width: 32, height: 32, color: SOFT, backgroundColor: NEU.surface, boxShadow: NEU.outSm, transition: `box-shadow 200ms ${EASE}`, cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; (e.currentTarget as HTMLElement).style.color = NEU.ink; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; (e.currentTarget as HTMLElement).style.color = SOFT; }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
          {children}
        </div>
        </div>
      </div>
    </Portal>
  );
}

/** ONE BOOKMARK on the rail.
 *
 *  A real `<button>` in both orientations — the rail is keyboard-reachable and
 *  the tabs are in DOM order, which is why the narrow strip can be the same
 *  component rotated into a row rather than a second implementation.
 *
 *  BOTH orientations are the same bookmark shape — square on the edge that
 *  meets the card, rounded on the outside, tucked 10px under the card by the
 *  rail's own negative margin so the two read as one object. `side` puts that
 *  edge on the inline start; the narrow variant puts it on the bottom.
 *
 *  The narrow variant used to be a free-floating pill, which is what let the
 *  strip wrap into three rows of tabs hovering over a card they had no visible
 *  relationship to. It is now 46px tall — a real touch target, measured up
 *  from 31 — and physically attached to the card's top edge.
 *
 *  COLOUR: the label is `NEU.forest` (10.73:1) when active and `SOFT` (5.55:1)
 *  when not. Neither is `NEU.muted`, which is 2.81:1 and decoration only. */
export function RailTab({
  icon: Icon, label, count, active, side, onClick, title,
}: {
  icon: LucideIcon;
  label: string;
  /** Rendered as a small tabular figure after the label. Omit for an action. */
  count?: number;
  active?: boolean;
  side: boolean;
  onClick: () => void;
  title?: string;
}) {
  const ink = active ? NEU.forest : SOFT;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={active ? 'page' : undefined}
      className="inline-flex items-center gap-2 focus:outline-none"
      style={{
        border: 'none', cursor: 'pointer', fontFamily: OUTFIT,
        fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em', color: ink,
        backgroundColor: active ? NEU.surface : NEU.base,
        boxShadow: active
          ? (side
              ? 'inset 0 0 0 1px rgba(27,56,40,0.12), 4px 3px 12px -4px rgba(27,56,40,0.22)'
              : 'inset 0 0 0 1px rgba(27,56,40,0.12), 3px 4px 12px -4px rgba(27,56,40,0.22)')
          : NEU.outSm,
        ...(side
          ? {
              borderRadius: '0 12px 12px 0',
              padding: '9px 12px 9px 16px',
              width: 158, justifyContent: 'flex-start',
              transform: active ? 'translateX(3px)' : 'translateX(0)',
            }
          : {
              // Bookmark, not pill: rounded on top, square where it meets the
              // card. 44px tall INCLUDING the 10px that is tucked under the
              // card, so the visible tab is 34px and the touch target is 44.
              borderRadius: '12px 12px 0 0',
              padding: '11px 13px 22px 13px',
              minHeight: 46, flexShrink: 0, whiteSpace: 'nowrap',
              transform: active ? 'translateY(3px)' : 'translateY(0)',
            }),
        transitionProperty: 'transform, box-shadow, background-color, color',
        transitionDuration: '200ms', transitionTimingFunction: EASE,
      }}
    >
      <Icon size={13} style={{ flexShrink: 0, color: ink }} />
      <span className="min-w-0" style={{ overflowWrap: side ? 'anywhere' : 'normal' }}>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          style={{
            marginInlineStart: 'auto', fontSize: 10.5, fontWeight: 800,
            fontVariantNumeric: 'tabular-nums', color: SOFT, flexShrink: 0,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatTile({ icon: Icon, emoji, gradient, value, label, onClick, title }: {
  icon: LucideIcon; emoji: string; gradient: NeuGradient; value: string; label: string;
  onClick?: () => void;
  /** The caveat this figure carries, if it carries one.
   *
   *  These used to be a paragraph printed under the tile grid — "Speeches counts
   *  logged speeches only… Motions raised counts motions a chair accepted…" —
   *  which the owner asked to remove. The caveats are true and are not dropped;
   *  they moved here, onto the number they qualify, where a reader who wonders
   *  can get them and a reader who does not is not made to read them. A native
   *  `title` is the right affordance for a one-line explainer (AGENTS.md, UI
   *  RULES: informational hints reveal on hover, never on click) and cannot be
   *  clipped by the modal's own scroll container. */
  title?: string;
}) {
  // THE TILE STACKS BELOW `sm`, AND THAT IS THE FIX, NOT A PREFERENCE.
  //
  // Measured at 375px: the grid is two columns, so a tile is 133px wide. Take
  // its 28px of padding, the 36px disc and the 12px gap and the text column is
  // left with 55px. "Total speaking time" needs 102px and was `truncate`d to
  // "Total spea…"; worse, the VALUE was truncated too — `9/11` needs 38px and
  // had 7, so the headline figure on the Delegates-present tile rendered as a
  // sliver. That is a large part of "scores seem broken" on a phone.
  //
  // Below `sm` the disc sits ABOVE the figure instead of beside it, which hands
  // the full 105px to both lines, and the label wraps rather than truncating.
  const body = (
    <>
      <span className="flex-shrink-0 hidden sm:inline-flex">
        <NeuIconDisc gradient={gradient} emoji={emoji} icon={Icon} size={36} />
      </span>
      <span className="flex-shrink-0 inline-flex sm:hidden">
        <NeuIconDisc gradient={gradient} emoji={emoji} icon={Icon} size={26} />
      </span>
      <div className="min-w-0 text-left">
        <p className="font-black text-lg sm:text-xl leading-none" style={{ color: NEU.ink, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        <p className="text-[11px] font-semibold mt-1 leading-tight" style={{ color: SOFT, fontFamily: OUTFIT, textWrap: 'pretty' }}>{label}</p>
      </div>
    </>
  );
  // A tile that leads somewhere says so by behaving like a control; the rest
  // stay inert insets.
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 w-full focus:outline-none"
        style={{
          backgroundColor: NEU.base, borderRadius: 14, padding: '11px 12px',
          boxShadow: NEU.inSm, border: 'none', cursor: 'pointer',
          transition: `box-shadow 200ms ${EASE}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `inset 0 0 0 1px rgba(27,56,40,0.22)`; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.inSm; }}
        title={title ?? 'Open this section'}
      >
        {body}
      </button>
    );
  }
  return (
    <NeuInset className="flex items-center gap-3" style={{ padding: '11px 12px', borderRadius: 14 }}>
      {/* The caveat rides on a wrapper rather than on `NeuInset`, which takes no
          `title` — and `neu.tsx` is a shared surface another workstream is
          editing, so it is not widened for this. */}
      <span title={title} className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 w-full min-w-0">{body}</span>
    </NeuInset>
  );
}

export type DocFilter = 'all' | 'working-paper' | 'draft-resolution';

// ── Recap modal ─────────────────────────────────────────────────────────────

export type RecapTab = 'overview' | 'documents' | 'scoreboard' | 'history' | 'attendance' | 'awards';

/** THE RECAP IS NO LONGER ONE LONG SCROLL.
 *
 *  The owner: "opening the committee for the session recap looks messy… I'm
 *  just cleaning up so it's not that big and scrollable. Add a 'side tab' kinda
 *  like a bookmark attached to the session recap that opens the documents as
 *  well as the full scoreboard and chair feedback, and also delegate
 *  attendance. Add also the broadcast tool into here. Make sure these always
 *  stay there attached to the status."
 *
 *  So the five sections that used to be stacked in one column are five panels
 *  behind a bookmark rail, and NOT ONE OF THEM WAS REBUILT:
 *
 *    Documents   → `SessionDocuments`          (23 Sep 2026: the chair's voting
 *                                               picker look, every paper a card)
 *    Scoreboard  → `SessionScoreboardBoard`    (23 Sep 2026: the chair's own
 *                                               Ranking + Matrix, read only)
 *    History     → `SessionScoreboardBoard`    (23 Sep 2026: was "Chair
 *                                               feedback"; the chair's History tab)
 *    Attendance  → `RosterBody`                (the exact body `RosterModal`
 *                                               renders: the roll-call look and
 *                                               the status timeline)
 *    Broadcast   → `BroadcastComposer`, via `onBroadcast`
 *
 *  BROADCAST IS AN ACTION TAB, not a panel, and that is deliberate:
 *  `BroadcastComposer` is its own portalled full-screen dialog with its own
 *  backdrop and its own send/confirm flow. Rendering it inside a panel would
 *  mean rebuilding it, which is exactly what the owner asked not to happen, so
 *  the tab hands off to the real composer — the same handoff the "MESSAGE THIS
 *  COMMITTEE" button used to make from the bottom of the scroll.
 *
 *  The rail is rendered by `ModalShell` OUTSIDE the scrolling card, so it can
 *  neither be clipped by the card's rounded overflow nor scroll away from the
 *  status it is attached to. Below `lg` it becomes a horizontal strip above the
 *  card — see the layout note in `ModalShell`. Scroll lock and the shared
 *  Escape stack are untouched; they still come from `ModalShell`. */
export function RecapModal({
  data, onClose, onOpenScoreboard, onBroadcast, floorDetail = null, initialDocFilter = 'all',
  conferenceSlug, awardsConfig, awardsPublishedAt, conferenceEndDate = null,
}: {
  data: LiveCommittee;
  onClose: () => void;
  /** Set when the recap was opened by a WP or DR chip on the card rather than by
   *  the card body. The modal then opens ON the Documents tab, already narrowed
   *  to that type.
   *
   *  This replaces a scroll-into-view dance that had to be done from a ref
   *  callback because `Portal` commits nothing on its first pass. With tabs
   *  there is nothing to scroll to: the section the reader asked for is the only
   *  one rendered. */
  initialDocFilter?: DocFilter;
  /** The phase-specific body (caucus clock, ballot breakdown, unmod countdown).
   *  Passed IN rather than imported, because `PhaseVariants` already imports
   *  this module and reaching back the other way would make the pair circular. */
  floorDetail?: React.ReactNode;
  /** Points → the standalone scoreboard modal. Still reachable, for a reader who
   *  wants it at its own full width. */
  onOpenScoreboard: (d: LiveCommittee) => void;
  /** Broadcast scoped to THIS room. Absent when the committee has no session to
   *  address. */
  onBroadcast: ((d: LiveCommittee) => void) | null;
  conferenceSlug: string;
  /** `getAwardsConfig(conference.awards_config)` and `conference.awards_published_at`,
   *  passed in from the page so the Awards tab can name the slate's state
   *  without a second conference fetch. */
  awardsConfig: AwardsConfig;
  awardsPublishedAt: string | null;
  conferenceEndDate?: string | null;
}) {
  const session = data.session;
  // `phase` is left at whatever the room was last doing when it was gavelled out
  // or suspended, so it must not be shown for either — an adjourned committee
  // badged "General Speakers' List" reads as still sitting. Same rule as
  // `phaseChip` on the card; kept inline because cardModel imports this module.
  const phaseLabel = !session
    ? 'No session'
    : session.endedAt
      ? 'Adjourned'
      : session.phase === 'adjourned'
        ? 'Suspended'
        : (PHASE_LABELS[session.phase] ?? session.phase);
  const ident = committeeIdentity(data.conf);

  const [tab, setTab] = useState<RecapTab>(initialDocFilter === 'all' ? 'overview' : 'documents');
  const [docFilter, setDocFilter] = useState<DocFilter>(initialDocFilter);
  // The session itself, read the way the chair's console reads it, for the
  // Scoreboard, History and Documents tabs. Loaded the first time one of them is
  // opened and kept (polled) from then on, so switching tabs never reloads it.
  const [wantsSession, setWantsSession] = useState(initialDocFilter !== 'all');
  const live = useSessionCommittee(wantsSession ? session?.code : null);

  function openDocs(type: DocFilter) {
    setDocFilter(type);
    setWantsSession(true);
    setTab('documents');
  }
  function openScoreboardTab() {
    setWantsSession(true);
    setTab('scoreboard');
  }
  function openHistoryTab() {
    setWantsSession(true);
    setTab('history');
  }

  // Speech-only: `speechLogs` no longer carries motions, rights of reply or
  // manual point adjustments, so this tile stops over-reporting.
  const speeches = data.speechLogs.length;

  // MOTIONS RAISED, from the ledger — replacing "Motions pending", which the
  // owner asked to drop.
  //
  // It is NOT derivable from the `motions` table: rows there are hard-deleted on
  // BOTH accept and reject (`committeeService.ts:683, 688, 846, 851, 884`), which
  // is why that whole table holds about five rows platform-wide. `motion-raised`
  // ledger events survive — 95 of them in production.
  const motionsLogged = data.eventLogs.filter((e) => e.type === 'motion-raised').length;

  // TOTAL SPEAKING TIME — fully derivable, no caveat needed. All 333 production
  // speech rows carry their own `seconds`.
  const totalSpeakingSeconds = data.speechLogs.reduce((sum, l) => sum + (l.seconds || 0), 0);

  const wps = data.documents.filter((d) => d.type === 'working-paper').length;
  const drs = data.documents.filter((d) => d.type === 'draft-resolution').length;
  const { present, total: votingTotal } = presence(data);
  const observers = data.delegates.filter((d) => d.isObserver).length;

  const scores = computeScores(data).sort((a, b) => b.total - a.total);
  const top = scores[0];
  const quietest = scores.length > 1 ? scores[scores.length - 1] : undefined;

  function joinAsSecretariat() {
    if (!session) return;
    // TODO(merge): route to dedicated secretariat/co-chair mode once merged with production branch
    window.open(`/chair/${session.code}?chairName=Secretariat`, '_blank');
  }

  const rail = (side: boolean) => (
    <>
      <RailTab
        side={side} icon={Radio} label="Overview" active={tab === 'overview'}
        onClick={() => setTab('overview')}
        title="What this room has done: speeches, time, motions, top and quietest delegation"
      />
      <RailTab
        side={side} icon={FileText} label="Documents" count={data.documents.length}
        active={tab === 'documents'} onClick={() => openDocs('all')}
        title="Working papers and draft resolutions, grouped by where they are in the pipeline"
      />
      <RailTab
        side={side} icon={Trophy} label="Scoreboard" active={tab === 'scoreboard'}
        onClick={openScoreboardTab}
        title="The full delegate performance table, the same one the chairs score from"
      />
      <RailTab
        side={side} icon={HistoryIcon} label="History"
        active={tab === 'history'} onClick={openHistoryTab}
        title="The session in the order it happened: every debate, motion and speech, with the chairs' comments"
      />
      <RailTab
        side={side} icon={Users} label="Attendance" count={votingTotal}
        active={tab === 'attendance'} onClick={() => setTab('attendance')}
        title="The roll: present, present & voting, absent, and each delegation's speaking time"
      />
      <RailTab
        side={side} icon={Medal} label="Awards" active={tab === 'awards'}
        onClick={() => setTab('awards')}
        title="This committee's award slate: what the chairs nominated and where it is in ratification"
      />
      {onBroadcast && (
        <RailTab
          side={side} icon={Megaphone} label="Broadcast"
          onClick={() => onBroadcast(data)}
          title="Send a message to this committee. Opens the broadcast composer"
        />
      )}
    </>
  );

  return (
    <ModalShell onClose={onClose} maxWidth={760} rail={rail}>
      {/* Header — same acronym-over-full-name rule the cards follow. */}
      <div className="flex items-center gap-3.5 mb-1" style={{ paddingInlineEnd: 36 }}>
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={ident.mono} alt={ident.title} />
        <div className="min-w-0">
          <Eyebrow>Session recap</Eyebrow>
          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
            <h2 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
              {ident.title}
            </h2>
            <span
              className="text-[13px] font-bold"
              style={{ color: NEU.forest, fontFamily: OUTFIT }}
            >
              {phaseLabel}
            </span>
          </div>
        </div>
      </div>
      {ident.subtitle
        ? <p className="text-sm mb-5" style={{ color: SOFT, fontFamily: OUTFIT }}>{ident.subtitle}</p>
        : <div className="mb-5" />}

      {tab === 'overview' && (
        <>
          {/* THE LIVE FLOOR, IN FULL.
              The caucus clock, the ballot breakdown and the unmoderated
              countdown used to live on the CARD, where they forced four
              different card shapes and with them the height chaos. They are
              detail, not scanning information, so they moved here. */}
          {floorDetail}

          {/* Stat tiles. The WP and DR tiles open the Documents tab.
              THE PARAGRAPH THAT SAT UNDER THIS GRID IS GONE, on the owner's
              instruction: "no need for the description below 'speeches counts
              logged…'". Both caveats it carried are still told — they moved into
              the tiles' own hover titles, where they are available to a reader
              who wonders and invisible to one who does not. Nothing was
              silently dropped. */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <StatTile
              icon={Mic} emoji="Studio microphone" gradient={NEU_GRADIENTS.forest}
              value={String(speeches)} label="Speeches given"
              title="Logged speeches only. Motions, rights of reply and manual point adjustments share the same ledger but are not speeches"
            />
            <StatTile icon={Clock} emoji="Stopwatch" gradient={NEU_GRADIENTS.sage} value={fmtSpeakingTotal(totalSpeakingSeconds)} label="Total speaking time" />
            <StatTile
              icon={Gavel} emoji="Ballot box with ballot" gradient={NEU_GRADIENTS.gold}
              value={String(motionsLogged)} label="Motions raised"
              title="Motions a chair ACCEPTED: a rejected motion is deleted from the database outright and leaves no record, so the true total can only be higher than this"
            />
            <StatTile
              icon={Users} emoji="Busts in silhouette" gradient={NEU_GRADIENTS.sage}
              value={`${present}/${votingTotal}`} label="Delegates present"
              title={observers > 0
                ? `Excludes ${observers} observer${observers === 1 ? '' : 's'}, matching the chair's roll`
                : "The voting body, matching the chair's roll"}
            />
            <StatTile icon={FileText} emoji="Page facing up" gradient={NEU_GRADIENTS.green} value={String(wps)} label="Working papers" onClick={wps > 0 ? () => openDocs('working-paper') : undefined} />
            <StatTile icon={ScrollText} emoji="Scroll" gradient={NEU_GRADIENTS.amber} value={String(drs)} label="Draft resolutions" onClick={drs > 0 ? () => openDocs('draft-resolution') : undefined} />
          </div>

          {/* Points, in summary. The full table is one tab away. */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <Eyebrow>Points</Eyebrow>
            <button
              onClick={openScoreboardTab}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 focus:outline-none"
              style={{
                color: NEU.forest, fontFamily: OUTFIT, backgroundColor: NEU.surface,
                boxShadow: NEU.outSm, border: 'none', cursor: 'pointer',
                transition: `box-shadow 200ms ${EASE}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
            >
              <Trophy size={12} />
              Full delegate performance
            </button>
          </div>
          {scores.length > 0 && (
            <div className="mb-6 flex flex-col gap-2">
              {[{ label: 'Top delegate', row: top }, ...(quietest ? [{ label: 'Quietest delegate', row: quietest }] : [])].map((entry) => (
                <NeuInset
                  key={entry.label}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                  style={{ padding: '11px 14px', borderRadius: 14 }}
                >
                  {/* The label was `width: 130` at every width. On a phone that
                      left 69px for the delegation and truncated "United
                      Kingdom" to "United Kin…" — so it wraps onto its own line
                      below `sm` and only becomes a fixed column when there is
                      room for one. */}
                  <span className="text-[11px] font-bold uppercase flex-shrink-0 basis-full sm:basis-[130px]" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
                    {entry.label}
                  </span>
                  <CircleFlag code={flagCodeFor(entry.row.country)} label={entry.row.country} size={24} decorative />
                  <span className="text-sm font-bold flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{entry.row.country}</span>
                  <span className="text-sm font-black" style={{ color: NEU.forest, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                    {entry.row.total} pts
                  </span>
                </NeuInset>
              ))}
            </div>
          )}

          {/* Join as secretariat — the one action that belongs on every tab's
              floor, kept on Overview so it is not repeated five times. */}
          {session && (
            <button
              onClick={joinAsSecretariat}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3 font-bold text-sm focus:outline-none"
              style={{
                background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
                color: NEU.gold, fontFamily: OUTFIT, border: 'none', cursor: 'pointer',
                boxShadow: `0 4px 10px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 30%, transparent), ${NEU.outSm}`,
                transition: `box-shadow 220ms ${EASE}, transform 220ms ${EASE}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 16px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 40%, transparent), ${NEU.outSmHover}`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 10px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 30%, transparent), ${NEU.outSm}`; }}
            >
              Join as secretariat
              <ExternalLink size={14} />
            </button>
          )}
        </>
      )}

      {tab === 'documents' && (
        <SessionLoadState loading={live.loading && !live.data} error={live.error} hasSession={!!session}>
          {live.data && <SessionDocuments committee={live.data.committee} voteStates={live.data.voteStates} initialFilter={docFilter} />}
        </SessionLoadState>
      )}

      {tab === 'scoreboard' && (
        <SessionLoadState loading={live.loading && !live.data} error={live.error} hasSession={!!session}>
          {live.data && <SessionScoreboardBoard committee={live.data.committee} feedback={live.data.feedback} tabs={['ranking', 'matrix']} />}
        </SessionLoadState>
      )}

      {tab === 'history' && (
        <SessionLoadState loading={live.loading && !live.data} error={live.error} hasSession={!!session}>
          {live.data && <SessionScoreboardBoard committee={live.data.committee} feedback={live.data.feedback} tabs={['history']} showChips={false} />}
        </SessionLoadState>
      )}

      {tab === 'attendance' && <RosterBody data={data} />}

      {tab === 'awards' && (
        <AwardsRecap
          committeeId={data.conf.id}
          conferenceSlug={conferenceSlug}
          config={awardsConfig}
          publishedAt={awardsPublishedAt}
          conferenceEndDate={conferenceEndDate}
        />
      )}

      {/* The standalone Points modal stays reachable for a reader who wants the
          table at its own wider width; the card footer opens it directly. */}
      {tab === 'scoreboard' && (
        <button
          onClick={() => onOpenScoreboard(data)}
          className="inline-flex items-center gap-2 mt-3 text-xs font-bold focus:outline-none"
          style={{
            color: NEU.forest, fontFamily: OUTFIT, background: 'transparent',
            border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <ExternalLink size={12} />
          Open this scoreboard on its own
        </button>
      )}
    </ModalShell>
  );
}

// ── Roster / present-delegate detail modal ──────────────────────────────────


/** Small forest disc holding a chair's initials — a lightweight avatar. */
function ChairAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.34),
        background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        color: NEU.gold, fontFamily: OUTFIT, fontWeight: 900, fontSize: size * 0.4,
        boxShadow: `0 3px 8px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 20%, transparent), ${NEU.outSm}`,
        letterSpacing: '0.02em',
      }}
      title={name}
    >
      {initials}
    </span>
  );
}

/** Committee chairs as small labelled avatars — reused inside the roster detail.
 *  Prefers the conference dais (real profile pictures) and falls back to the
 *  names that actually joined the session, which may include a chair with no
 *  Gavelling account. Names stay visible here: this is a detail surface, unlike
 *  the card corner where the stack is deliberately name-free.
 *
 *  `pending` is the invited-but-not-accepted list, drawn after the seated dais
 *  and visibly quieter. It is a THIRD list, not a fallback for the other two:
 *  an invitee has neither joined the session nor taken a seat on the dais, and
 *  "No chairs joined yet" over a committee whose invite is out is the reading
 *  this strip exists to correct. */
function ChairStrip({ chairs, chairNames, pending }: {
  chairs: ChairPerson[];
  chairNames: string[];
  pending: PendingChairPerson[];
}) {
  const people: ChairPerson[] = chairs.length > 0
    ? chairs
    : chairNames.map((name) => ({ id: null, name, avatarUrl: null }));
  return (
    <div>
      <Eyebrow>Chairs</Eyebrow>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {people.length === 0 && pending.length === 0 && (
          <span className="inline-flex items-center gap-2 text-sm" style={{ color: SOFT, fontFamily: OUTFIT }}>
            <Gavel size={14} /> No chairs joined yet
          </span>
        )}
        {
          people.map((p, i) => (
            /* Not `nested`: this strip sits inside the modal body, which has no
               click target of its own. A chair carried only as a name string
               (`id: null`) renders bare — ProfileLink handles that itself. */
            <ProfileLink key={`${p.id ?? p.name}-${i}`} userId={p.id} name={p.name}>
              <span
                className="inline-flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5"
                style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
              >
                {p.avatarUrl
                  ? <Avatar url={p.avatarUrl} name={p.name} size={26} rounded />
                  : <ChairAvatar name={p.name} size={26} />}
                <span className="text-xs font-bold [overflow-wrap:anywhere]" style={{ color: NEU.ink, fontFamily: OUTFIT, maxWidth: 180 }}>{p.name}</span>
              </span>
            </ProfileLink>
          ))
        }
        {/* No ProfileLink: an invitee has not taken this seat, so nothing here
            points at a CV as though they had. */}
        {pending.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5"
            style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, opacity: 0.72 }}
            title={`${p.name} has been invited to chair and has not accepted yet`}
          >
            {p.avatarUrl
              ? <Avatar url={p.avatarUrl} name={p.name} size={26} rounded />
              : <ChairAvatar name={p.name} size={26} />}
            <span className="text-xs font-bold [overflow-wrap:anywhere]" style={{ color: '#7A5A10', fontFamily: OUTFIT, maxWidth: 180 }}>{p.name}</span>
            <span
              className="inline-flex items-center gap-1 flex-shrink-0"
              style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, lineHeight: 1.4, color: '#7A5A10' }}
            >
              <Clock size={11} aria-hidden />
              Pending
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function RosterModal({ data, onClose }: { data: LiveCommittee; onClose: () => void }) {
  const ident = committeeIdentity(data.conf);
  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-1">
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={ident.mono} alt={ident.title} />
        <div className="min-w-0">
          <Eyebrow>Roll call · present delegates</Eyebrow>
          <h2 className="font-black mt-0.5" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
            {ident.title}
          </h2>
        </div>
      </div>
      {data.conf.abbreviation && data.conf.abbreviation !== data.conf.name && (
        <p className="text-sm" style={{ color: SOFT, fontFamily: OUTFIT }}>{data.conf.name}</p>
      )}
      <RosterBody data={data} />
    </ModalShell>
  );
}

/** THE ROLL, WITHOUT A HEADER OF ITS OWN — one implementation, two callers.
 *
 *  `RosterModal` above (opened from a card's present/total chip) and the recap
 *  modal's "Attendance" side-tab, which the owner asked for and which must show
 *  the same roll rather than a second, thinner version of it. Only the heading
 *  differs, so only the heading lives outside this. */
export function RosterBody({ data }: { data: LiveCommittee }) {
  const chairNames = data.session?.chairNames ?? [];
  return (
    <>
      <div className="mt-4 mb-5">
        <ChairStrip chairs={data.conf.chairs} chairNames={chairNames} pending={data.conf.pendingChairs} />
      </div>
      <SessionAttendance
        sessionId={data.session?.id ?? null}
        seats={data.delegates}
        endedAt={data.session?.endedAt ?? null}
      />
    </>
  );
}


// ── Awards tab (inside the recap) ───────────────────────────────────────────
//
// Replaces the placeholder `AwardsModal` that used to sit here, unreachable
// (`awardsFor` was never set). The chairs nominate from their conference page,
// the secretariat ratifies and publishes from /manage/[slug]/awards; this tab
// is the read-only window on ONE committee's slate from Live Status. It loads
// its own two rows on open (the committee's awards_* stamps and its
// conference_awards rows) rather than widening the page's polled select, so
// the polling loop is untouched.

const TIER_COLOR: Record<AwardTier, string> = {
  gold: NEU.deepGold, silver: '#8C8C94', bronze: '#9C6B3C', special: NEU.forest,
};

const SLATE_STYLE: Record<SlateState, { bg: string; fg: string }> = {
  off: { bg: 'rgba(27,56,40,0.08)', fg: SOFT },
  open: { bg: 'rgba(27,56,40,0.08)', fg: SOFT },
  submitted: { bg: 'rgba(184,132,74,0.15)', fg: AMBER_INK },
  returned: { bg: 'rgba(139,32,32,0.08)', fg: RED },
  approved: { bg: 'rgba(61,122,82,0.12)', fg: GREEN_INK },
  published: { bg: NEU.forest, fg: NEU.gold },
};

interface SlateStampRow {
  awards_submitted_at: string | null;
  awards_approved_at: string | null;
  awards_return_note: string | null;
}

// `conferenceSlug` stays in the props type (the caller still passes it) but is
// no longer read here: the only consumer was the link to the retired awards desk.
function AwardsRecap({ committeeId, config, publishedAt, conferenceEndDate }: {
  committeeId: string;
  conferenceSlug: string;
  config: AwardsConfig;
  publishedAt: string | null;
  conferenceEndDate: string | null;
}) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [stamps, setStamps] = useState<SlateStampRow | null>(null);
  const [rows, setRows] = useState<ConferenceAwardRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const supabase = getAuthedClient(accessToken);
    void (async () => {
      const [stampRes, awardRows] = await Promise.all([
        supabase
          .from('conference_committees')
          .select('awards_submitted_at, awards_approved_at, awards_return_note')
          .eq('id', committeeId)
          .maybeSingle(),
        loadCommitteeAwards(supabase, committeeId),
      ]);
      if (cancelled) return;
      if (stampRes.error) { setError("Couldn't load this committee's slate."); return; }
      setStamps((stampRes.data as SlateStampRow | null) ?? { awards_submitted_at: null, awards_approved_at: null, awards_return_note: null });
      setRows(awardRows);
    })();
    return () => { cancelled = true; };
  }, [accessToken, committeeId]);

  const deadline = chairDeadline(config, conferenceEndDate);
  const state: SlateState | null = stamps ? slateState(stamps, publishedAt, config) : null;
  const order = new Map(config.types.map((t, i) => [t.key, i]));
  const sorted = [...(rows ?? [])].sort((a, b) =>
    (order.get(a.award_type) ?? 99) - (order.get(b.award_type) ?? 99) || a.position - b.position);
  const completeness = rows ? slateCompleteness(rows, config) : null;

  // "Open the awards desk" linked to /manage/[slug]/awards. That desk is
  // retired for now (Settings → Awards is a coming-soon screen), so there is
  // nowhere to send anyone. This panel still reads the slate, which is
  // untouched in the database. Restore the link with the rest of the feature.
  const deskLink = null;

  if (error) return <p className="text-sm" style={{ color: RED, fontFamily: OUTFIT }}>{error}</p>;
  if (!rows || !state) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
      </div>
    );
  }
  if (state === 'off') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: SOFT, fontFamily: OUTFIT }}>Awards are off for this conference.</p>
        {deskLink}
      </div>
    );
  }

  const pill = SLATE_STYLE[state];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Eyebrow>Award slate</Eyebrow>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: pill.bg, color: pill.fg, fontFamily: OUTFIT }}
        >
          {SLATE_STATE_LABEL[state]}
        </span>
        {completeness && (
          <span className="text-[11px] font-bold" style={{ color: completeness.over.length ? RED : SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
            {completeness.filled} of {completeness.total} slots
            {completeness.over.length > 0 && ` · over quota: ${completeness.over.join(', ')}`}
          </span>
        )}
        {deadline && state !== 'published' && state !== 'approved' && (
          <span className="text-[11px]" style={{ color: SOFT, fontFamily: OUTFIT, marginInlineStart: 'auto' }}>
            Chairs&apos; deadline {deadline.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {stamps?.awards_return_note && state === 'returned' && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ color: RED, backgroundColor: 'rgba(139,32,32,0.06)', fontFamily: OUTFIT }}>
          Return note: {stamps.awards_return_note}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm" style={{ color: SOFT, fontFamily: OUTFIT }}>
          Nothing nominated yet. The chairs nominate from their conference page; the slate appears here as they fill it.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((r) => {
            const type = config.types.find((t) => t.key === r.award_type);
            const code = r.country_code || flagCodeFor(r.country_name ?? '');
            return (
              <NeuInset key={r.id} className="flex items-start gap-3 px-4 py-3" style={{ borderRadius: 14 }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: TIER_COLOR[type?.tier ?? 'special'], flexShrink: 0, marginTop: 6 }} />
                <CircleFlag code={code} label={r.country_name ?? undefined} size={24} decorative />
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                    <span className="font-bold">{r.award_label}</span>
                    <span style={{ color: SOFT }}> · {r.country_name ?? r.recipient_name ?? 'Seat'}</span>
                    {r.recipient_name && r.country_name && <span style={{ color: SOFT }}> · {r.recipient_name}</span>}
                    {r.status === 'published' && <span className="font-bold" style={{ color: GREEN_INK }}> · published</span>}
                  </p>
                  {r.rationale && (
                    <p className="text-xs italic mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT }}>{r.rationale}</p>
                  )}
                </div>
              </NeuInset>
            );
          })}
        </div>
      )}

      <p className="text-[11px]" style={{ color: SOFT, fontFamily: OUTFIT }}>
        Awards are being rebuilt, so there is nowhere to ratify or publish this slate yet. Everything
        recorded here is saved and nothing is lost.
      </p>
      {deskLink}
    </div>
  );
}
