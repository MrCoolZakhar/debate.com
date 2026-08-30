'use client';

// Overlapping profile-picture stack — the standard avatar-stack idiom.
//
// Deliberately name-free VISUALLY: the corner of a committee card has no room
// for a dais roster, and a long list of names crowds out the committee's own
// identity. The names are never lost semantically though — every avatar carries
// `title` (native hover tooltip, no portal needed, cannot be clipped) plus an
// `aria-label`, and the container announces the full list in reading order.
//
// Uses the shared `Avatar` (a sixth local duplicate must never be written).
// Logical properties only, so the stack overlaps the correct way in RTL.

import Avatar from '@/components/Avatar';
import ProfileLink from '@/components/ProfileLink';

export interface StackPerson {
  /** profiles.id when the chair is a Gavelling account; null for a name-only dais entry. */
  id?: string | null;
  name: string;
  avatarUrl: string | null;
}

export default function AvatarStack({
  people,
  size = 28,
  max = 4,
  /** Names the group for screen readers, e.g. "Chairs". */
  label = 'Chairs',
  /**
   * Link each avatar to that person's public MUN CV.
   *
   * Opt-IN rather than default because the stack is usually pinned to a card
   * that already navigates somewhere — turning the avatars into links there
   * would put an anchor inside the card's own click target. Pass `nested` too
   * when that ancestor is a JS onClick row; do NOT enable this inside an outer
   * `<a>`/`<Link>` (see ProfileLink). Entries with no `id` (a name-only dais
   * member) stay unlinked on their own.
   */
  linkToCv = false,
  nested = false,
  /** Colour of the separating ring drawn around each avatar (the card surface). */
  ringColor = '#F0EBDD',
  /** Shadow applied to each disc, so the stack sits in the host's material. */
  shadow = '-3px -3px 7px rgba(255,255,255,0.9), 4px 4px 9px rgba(27,56,40,0.15)',
  /** Rendered instead of the stack when `people` is empty. */
  empty = null,
  style,
}: {
  people: StackPerson[];
  size?: number;
  max?: number;
  label?: string;
  ringColor?: string;
  shadow?: string;
  empty?: React.ReactNode;
  style?: React.CSSProperties;
  linkToCv?: boolean;
  nested?: boolean;
}) {
  if (people.length === 0) return <>{empty}</>;

  const shown = people.slice(0, max);
  const rest = people.slice(max);
  const overlap = -Math.round(size * 0.3);

  return (
    <div
      className="inline-flex items-center"
      role="group"
      aria-label={`${label}: ${people.map((p) => p.name).join(', ')}`}
      style={style}
    >
      {shown.map((p, i) => {
        // The overlap geometry (negative inline margin + stacking order) must
        // live on the FLEX ITEM itself. When the avatar becomes a link, the
        // link IS that item — wrapping the styled span in an extra element
        // would leave the margin on a child and collapse the overlap.
        const itemStyle: React.CSSProperties = {
          marginInlineStart: i === 0 ? 0 : overlap,
          // First avatar on top, so the stack reads front-to-back in the
          // same order the aria-label lists the names.
          zIndex: shown.length - i,
          position: 'relative',
          boxShadow: `0 0 0 2px ${ringColor}, ${shadow}`,
          borderRadius: '50%',
          backgroundColor: ringColor,
        };
        const key = `${p.id ?? p.name}-${i}`;
        const disc = <Avatar url={p.avatarUrl} name={p.name} size={size} rounded />;

        // ProfileLink falls back to rendering its children bare when the person
        // has no account, which would drop `itemStyle` — so only take the link
        // branch when there is genuinely an id to link to.
        return linkToCv && p.id ? (
          <ProfileLink
            key={key}
            userId={p.id}
            name={p.name}
            nested={nested}
            className="inline-flex rounded-full flex-shrink-0"
            style={itemStyle}
          >
            {disc}
          </ProfileLink>
        ) : (
          <span
            key={key}
            className="inline-flex rounded-full flex-shrink-0"
            title={p.name}
            aria-label={p.name}
            role="img"
            style={itemStyle}
          >
            {disc}
          </span>
        );
      })}
      {rest.length > 0 && (
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          title={rest.map((p) => p.name).join(', ')}
          aria-label={`${rest.length} more: ${rest.map((p) => p.name).join(', ')}`}
          role="img"
          style={{
            width: size,
            height: size,
            marginInlineStart: overlap,
            zIndex: 0,
            position: 'relative',
            borderRadius: '50%',
            backgroundColor: 'rgba(27,56,40,0.10)',
            color: '#1B3828',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 900,
            fontSize: Math.round(size * 0.36),
            lineHeight: 1,
            boxShadow: `0 0 0 2px ${ringColor}, ${shadow}`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          +{rest.length}
        </span>
      )}
    </div>
  );
}
