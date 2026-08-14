'use client';

// Shared profile avatar. Five near-identical local copies already exist
// (admin/ActivityTab, admin/UsersTab, admin/ConferencesTab,
// delegation/[societyId]/DelegationPortalClient, ProfileDropdown) — this is
// the one every NEW surface should import so a sixth never gets written.
// Behaviour matches those copies exactly: the image when `url` is set,
// otherwise a squircle initial disc. `rounded` switches the squircle for a
// true circle (the ProfileDropdown look).

const OUTFIT = "'Outfit', sans-serif";
const FOREST = '#1B3828';

export default function Avatar({
  url,
  name,
  size = 26,
  rounded = false,
}: {
  url: string | null;
  name: string;
  size?: number;
  /** true → full circle; false (default) → the squircle used across the app. */
  rounded?: boolean;
}) {
  const radius = rounded ? '50%' : Math.round(size * 0.34);

  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt=""
        className="object-cover flex-shrink-0"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: 'rgba(27,56,40,0.10)',
        color: FOREST,
        fontFamily: OUTFIT,
        fontWeight: 900,
        fontSize: Math.round(size * 0.44),
        lineHeight: 1,
      }}
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </span>
  );
}
