// ============================================================
// src/lib/conferenceIntent.ts
//
// What the organiser told us they came here to do, asked once in the creation
// wizard and stored on `conferences.intent` (jsonb, NOT NULL, default '{}').
//
// It is asked BEFORE the insert now, as a required step, so the answer rides
// along in the conferences row itself and there is no follow-up UPDATE that can
// fail. The wizard therefore never produces `skipped: true` any more, but the
// state stays supported: conferences created before this, and the Settings
// editor, both still rely on it.
//
// WHY THIS EXISTS
// A secretariat arrives with one job in mind. Some want applications and
// allocations, some only want to run the rooms on the day, some are here
// because their payment provider is a spreadsheet. The dashboard priorities
// are a fixed nine-step build journey, so everyone is led with the same list
// regardless of what they said. This lets the list answer them.
//
// WHAT IT IS NOT
// It is not a permission, not a feature flag, and never a filter that removes
// work. `financials` in particular gates both the blue checkmark
// (conference_setup_status' verification_keys) and publishing itself
// (enforce_conference_publish_payment_gate), so hiding it would produce a
// conference that cannot publish and cannot be told why. Intent REORDERS the
// priorities and nothing else.
//
// STATES, all distinguishable, which is what the follow-up email needs:
//   intent = {}                     never asked (every conference before this shipped)
//   intent.skipped = true           asked, declined to answer
//   intent.keys.length > 0          answered
// ============================================================

export interface ConferenceIntent {
  keys: string[];
  other: string | null;
  answeredAt: string | null;
  skipped: boolean;
}

export interface IntentOption {
  key: string;
  label: string;
  /** The one-liner under the label in the wizard. */
  sub: string;
  /** Fluent 3D emoji name, matching the rest of the creation wizard. */
  emoji: string;
  /** Short label for the admin chip and hover panel. */
  short: string;
  /**
   * Dashboard checklist keys this intent makes urgent. Used only to sort the
   * pending rows; never to drop one.
   */
  boosts: string[];
}

export const INTENT_OPTIONS: IntentOption[] = [
  {
    key: 'applications',
    label: 'Applications & Allocations',
    sub: 'Collect applications, score them, assign countries.',
    emoji: 'Ballot box with ballot',
    short: 'APPLICATIONS',
    boosts: ['committees', 'delegate', 'publish'],
  },
  {
    key: 'payments',
    label: 'Payments',
    sub: 'Take delegate fees straight into your own account.',
    emoji: 'Credit card',
    short: 'PAYMENTS',
    boosts: ['financials'],
  },
  {
    key: 'committees',
    label: 'Running Committees',
    sub: 'Live rooms, speakers lists, voting, the scoreboard.',
    emoji: 'Classical building',
    short: 'COMMITTEES',
    boosts: ['committees', 'chairs'],
  },
  {
    key: 'emails',
    label: 'Emails',
    sub: 'One send to everyone, or to a committee, or to the unpaid.',
    emoji: 'Envelope',
    short: 'EMAILS',
    boosts: ['email'],
  },
  {
    key: 'chairs',
    label: 'Recruiting Chairs',
    sub: 'Post the roles and let chairs apply from anywhere.',
    emoji: 'Globe showing europe-africa',
    short: 'CHAIRS',
    boosts: ['chairs', 'publish'],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    sub: 'Conferences on Gavelling see a 10 to 20% larger delegate count.',
    emoji: 'Megaphone',
    short: 'MARKETING',
    boosts: ['page', 'publish'],
  },
];

const VALID_KEYS = new Set(INTENT_OPTIONS.map((o) => o.key));

export const EMPTY_INTENT: ConferenceIntent = { keys: [], other: null, answeredAt: null, skipped: false };

/**
 * Reads the blob defensively, the same contract `getAwardsConfig` uses.
 * Unknown keys are dropped rather than trusted, so a renamed option cannot
 * leak into the sort or the admin chip.
 */
export function getConferenceIntent(raw: unknown): ConferenceIntent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_INTENT;
  const o = raw as Record<string, unknown>;
  const keys = Array.isArray(o.keys)
    ? (o.keys as unknown[]).filter((k): k is string => typeof k === 'string' && VALID_KEYS.has(k))
    : [];
  return {
    keys,
    other: typeof o.other === 'string' && o.other.trim() ? o.other.trim() : null,
    answeredAt: typeof o.answered_at === 'string' ? o.answered_at : null,
    skipped: o.skipped === true,
  };
}

/** True once the question has been put to them, answered or skipped. */
export function intentAnswered(intent: ConferenceIntent): boolean {
  return intent.keys.length > 0 || intent.skipped;
}

/** The row shape written back to the column. */
export function intentPayload(keys: string[], other?: string | null): Record<string, unknown> {
  return {
    keys: keys.filter((k) => VALID_KEYS.has(k)),
    other: other?.trim() || null,
    answered_at: new Date().toISOString(),
    skipped: keys.length === 0,
  };
}

export function intentLabels(intent: ConferenceIntent): string[] {
  return intent.keys
    .map((k) => INTENT_OPTIONS.find((o) => o.key === k)?.short)
    .filter((s): s is string => !!s);
}

/**
 * Sort comparator for the dashboard's PENDING checklist rows.
 *
 * Stable and presentational: it reorders what is already on screen and can
 * never remove a row, so `doneCount`, the ring, the progress bar and
 * `SetupCompletionNotices` all keep reading the full unfiltered checklist and
 * cannot disagree with it. `publish` is pinned last whatever they said, because
 * it is the finish line and leading with it would be nonsense.
 */
export function intentRank(intent: ConferenceIntent): (key: string) => number {
  const boosted = new Set<string>();
  for (const k of intent.keys) {
    const opt = INTENT_OPTIONS.find((o) => o.key === k);
    for (const b of opt?.boosts ?? []) boosted.add(b);
  }
  return (key: string) => {
    if (key === 'publish') return 2;
    return boosted.has(key) ? 0 : 1;
  };
}
