'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CommitteeIdentityBadge: the masthead at the top of the chair's forest sidebar,
// and the ONE place the committee's identity is stated in that column. The sidebar
// now runs the full height of the viewport (the chair top bar starts at its right
// edge), so this block is the first thing at the top-left of the chair screen.
//
// Anatomy, top to bottom, no hairlines anywhere:
//   • The emblem, the hero of the column (EMBLEM px). Resolution is the caller's:
//     conference committee logo, then the conference logo, then the preset match
//     for the name, then the UN emblem (DEFAULT_EMBLEM). A logo that fails to load
//     drops to the UN emblem, and that failing drops to gold initials, so there is
//     never a broken image or an empty slot.
//   • Beside it: the acronym big with the full name small beneath (AGENTS.md UI
//     RULE, resolved by the caller via committeeDisplayName), and the topic. The
//     topic is a button only when `onTopicClick` is set (the Moderator switching
//     the agenda).
//   • QuorumRings: present, two thirds, simple majority, labelled, plus the quorum
//     pill when a quorum rule is set. Passed in as `present`/`total`; omit
//     `present` to hide the rings.
//
// Contrast on #1B3828: body ivory #EDE7D8 is 11:1; the full name at 78% ivory and
// the topic at 84% gold both clear 4.5:1. Committee artwork is arbitrary (the UN
// mark is bright cyan, the ICJ seal dark navy), so the emblem sits on a soft ivory
// glow and wears a light alpha-following rim, which lifts dark marks and leaves
// light ones alone.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { NEU, OUTFIT } from '@/components/neu';
import QuorumRings from '@/components/QuorumRings';

export const DEFAULT_EMBLEM = '/logos/un.svg';

const EMBLEM = 84;

/** Light rim (follows the artwork's alpha) plus a grounding shadow. */
const FLOAT_FILTER =
  'drop-shadow(0 0 0.75px rgba(255,255,255,0.55)) drop-shadow(0 3px 7px rgba(0,0,0,0.32))';

function Emblem({ src, monogram, alt }: { src: string | null; monogram: string; alt: string }) {
  // Failures remembered per URL, so a later logo (the conference row arriving) gets a try.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const chain = [src, DEFAULT_EMBLEM].filter((s): s is string => !!s && !failed.has(s));
  const shown = chain[0] ?? null;
  return (
    <span
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: EMBLEM, height: EMBLEM }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -10,
          background: 'radial-gradient(circle at 50% 45%, rgba(237,231,216,0.16) 0%, rgba(237,231,216,0.06) 45%, rgba(237,231,216,0) 70%)',
        }}
      />
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={shown}
          src={shown}
          alt={alt}
          width={EMBLEM}
          height={EMBLEM}
          decoding="async"
          draggable={false}
          onError={() => setFailed((prev) => { const n = new Set(prev); n.add(shown); return n; })}
          className="relative block"
          style={{ width: '100%', height: '100%', objectFit: 'contain', filter: FLOAT_FILTER }}
        />
      ) : (
        <span
          role="img"
          aria-label={alt}
          className="relative"
          style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, letterSpacing: '0.02em', color: NEU.gold }}
        >
          {monogram}
        </span>
      )}
    </span>
  );
}

export default function CommitteeIdentityBadge({
  logoSrc,
  primary,
  secondary,
  topic,
  topicLabel,
  onTopicClick,
  topicActionTitle,
  present,
  total = 0,
  quorumNeeded = null,
}: {
  /** When set, the topic becomes a button (the Moderator switching the agenda on a
   *  conference committee with 2+ topics). */
  onTopicClick?: () => void;
  /** Tooltip for the topic button. */
  topicActionTitle?: string;
  /** Resolved emblem URL, or null for the UN emblem default. */
  logoSrc: string | null;
  /** Big label: the acronym for a long name, otherwise the name itself. */
  primary: string;
  /** Full name, shown small beneath. Null when `primary` already IS the name. */
  secondary?: string | null;
  topic?: string | null;
  /** Translated "Topic:" label, read by screen readers only. */
  topicLabel?: string;
  /** Voting delegations present. Omit to hide the quorum rings. */
  present?: number;
  /** Voting delegations on the roster. */
  total?: number;
  /** Delegations the quorum rule needs, or null when there is no rule. */
  quorumNeeded?: number | null;
}) {
  const monogram = primary.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() || '?';
  const longPrimary = primary.length > 12;

  const topicText = topic ? (
    <>
      {topicLabel && <span className="sr-only">{topicLabel} </span>}
      {topic}
    </>
  ) : null;
  const topicStyle: React.CSSProperties = {
    fontFamily: OUTFIT,
    fontSize: 13.5,
    fontWeight: 500,
    lineHeight: 1.3,
    color: 'rgba(238,217,138,0.86)',
    margin: 0,
    textWrap: 'pretty',
  };

  return (
    <div className="shrink-0" style={{ padding: '18px 16px 12px', backgroundColor: 'rgba(255,255,255,0.035)' }}>
      <div className="flex items-start gap-3.5">
        <Emblem src={logoSrc} monogram={monogram} alt={secondary ?? primary} />
        <div className="min-w-0 flex-1 flex flex-col gap-1" style={{ minHeight: EMBLEM, justifyContent: 'center' }}>
          <h2
            className={longPrimary ? 'line-clamp-2' : 'truncate'}
            // A `title` only when the label stands alone: with the full name ALSO
            // rendered beneath, it would make a screen reader announce it twice.
            title={secondary ? undefined : primary}
            style={{
              fontFamily: OUTFIT,
              fontWeight: 900,
              fontSize: longPrimary ? 20 : 27,
              lineHeight: 1.05,
              letterSpacing: longPrimary ? '-0.005em' : '0.005em',
              color: NEU.gold,
              margin: 0,
              textWrap: 'balance',
            }}
          >
            {primary}
          </h2>
          {secondary && (
            <p
              className="line-clamp-2"
              title={secondary}
              style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 500, lineHeight: 1.25, color: 'rgba(237,231,216,0.78)', margin: 0, textWrap: 'balance' }}
            >
              {secondary}
            </p>
          )}
          {topicText && !onTopicClick && (
            <p className="line-clamp-2 mt-0.5" title={topic ?? undefined} style={topicStyle}>
              {topicText}
            </p>
          )}
          {topicText && onTopicClick && (
            <button
              type="button"
              onClick={onTopicClick}
              title={topicActionTitle ? `${topicActionTitle}: ${topic}` : topic ?? undefined}
              className="line-clamp-2 w-full text-start rounded-md cursor-pointer mt-0.5 transition-colors hover:bg-[rgba(238,217,138,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70"
              style={{ ...topicStyle, padding: '1px 4px', marginInlineStart: -4 }}
            >
              <span className="underline decoration-dotted decoration-[rgba(238,217,138,0.55)] underline-offset-[3px]">{topicText}</span>
            </button>
          )}
        </div>
      </div>
      {typeof present === 'number' && (
        <div className="mt-3.5">
          <QuorumRings present={present} total={total} quorumNeeded={quorumNeeded} />
        </div>
      )}
    </div>
  );
}
