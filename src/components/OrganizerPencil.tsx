'use client';

// Organizer-only edit affordances for the public conference page.
// - variant="corner": quiet 28px icon button pinned to a card corner
//   (recipe: account/cv edit-entry button).
// - variant="cover": full-bleed hover overlay for images, transparent at
//   rest, grey-out + centred pencil-in-circle on hover. The button spans the
//   whole target (absolute inset-0), so hovering the image hovers the button;
//   no parent `group` class needed (which lets covers nest, e.g. logo inside
//   banner).
//
// Both variants must only ever be rendered for organizer viewers, the
// public page keeps zero edit affordances in the DOM for everyone else.

import { Pencil } from 'lucide-react';

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

export function OrganizerPencil({ variant, onClick, label, ariaLabel, style }: {
  variant: 'corner' | 'cover';
  onClick: () => void;
  /** Optional letter-spaced uppercase label under the pencil (cover variant only). */
  label?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
}) {
  if (variant === 'corner') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? 'Edit'}
        className="flex items-center justify-center rounded-lg focus:outline-none transition-colors"
        style={{ width: 28, height: 28, background: 'none', border: 'none', color: '#9A8A78', cursor: 'pointer', ...style }}
        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.backgroundColor = 'transparent'; }}
      >
        <Pencil size={13} strokeWidth={1.9} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label ?? 'Edit'}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 focus:outline-none"
      style={{
        backgroundColor: 'rgba(28,20,16,0.38)',
        border: 'none',
        cursor: 'pointer',
        opacity: 0,
        transition: `opacity 250ms ${EASE}`,
        zIndex: 20,
        ...style,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
      onFocus={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      onBlur={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 40, height: 40, borderRadius: '9999px',
          border: '1.5px solid rgba(255,255,255,0.85)',
          backgroundColor: 'rgba(28,20,16,0.35)',
          color: '#FFFFFF',
        }}
      >
        <Pencil size={15} strokeWidth={1.9} />
      </span>
      {label && (
        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.16em', color: '#FFFFFF' }}>
          {label}
        </span>
      )}
    </button>
  );
}
