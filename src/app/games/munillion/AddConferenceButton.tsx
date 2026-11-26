'use client';

import { PlusIcon } from '@/components/munillion/PixelArt';
import { ADD_CONFERENCE_HREF } from '@/lib/munillion';

/** The plus every player gets: list a conference on Gavelling, in a new tab so the game keeps going. */
export default function AddConferenceButton({ href = ADD_CONFERENCE_HREF, small = true }: { href?: string; small?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`mn-btn is-gold${small ? ' is-small' : ''}`}
      style={{ textDecoration: 'none' }}
    >
      <PlusIcon size={14} />
      Add your conference
    </a>
  );
}
