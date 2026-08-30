// The palette's vocabulary: what a block IS to the person adding it, and the
// starter arrangements built out of those same three primitives.
//
// There are exactly three block types (paragraph / button / image) because
// there are exactly three the renderer can produce — see `@/lib/emailBlocks`.
// The palette therefore never invents a "divider" or a "two-column" tile it
// cannot honour; the Starters section below is how the builder still offers
// "layouts" without lying about what the email can hold.

import { Type, MousePointerClick, Image as ImageIcon } from 'lucide-react';
import type { EmailBlock, ParagraphVariant } from '@/lib/emailBlocks';

export type BlockKind = 'paragraph' | 'button' | 'image';

/** What the palette drops onto the canvas. `paragraph:heading` etc. exist so
 *  the three text sizes are a first-class choice at insert time rather than a
 *  setting you have to go looking for afterwards. */
export type PaletteKind = 'paragraph:heading' | 'paragraph:body' | 'paragraph:small' | 'button' | 'image';

export interface PaletteItem {
  kind: PaletteKind;
  label: string;
  hint: string;
  emoji: string;
  icon: typeof Type;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { kind: 'paragraph:heading', label: 'Headline', hint: 'One big line', emoji: 'Memo', icon: Type },
  { kind: 'paragraph:body', label: 'Text', hint: 'A paragraph', emoji: 'Page facing up', icon: Type },
  { kind: 'paragraph:small', label: 'Small print', hint: 'Quiet footnote', emoji: 'Card index', icon: Type },
  { kind: 'button', label: 'Button', hint: 'Somewhere to click', emoji: 'Ticket', icon: MousePointerClick },
  { kind: 'image', label: 'Picture', hint: 'A photo or poster', emoji: 'Framed picture', icon: ImageIcon },
];

/** A palette kind → a fresh block. Note `body` is stored as an ABSENT variant,
 *  exactly as the old composer did, so an untouched paragraph keeps the shape
 *  every pre-variant row already has. */
export function blockForKind(kind: PaletteKind): EmailBlock {
  if (kind === 'button') return { type: 'button', label: '', destination: 'conference_page' };
  if (kind === 'image') return { type: 'image', url: '', alt: '' };
  const variant = kind.split(':')[1] as ParagraphVariant;
  return variant === 'body' ? { type: 'paragraph', content: '' } : { type: 'paragraph', content: '', variant };
}

export interface Starter {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  /** Miniature of the arrangement, drawn as bar heights: 'h' headline,
   *  't' text, 's' small, 'b' button, 'i' image. */
  shape: ('h' | 't' | 's' | 'b' | 'i')[];
  blocks: EmailBlock[];
}

export const STARTERS: Starter[] = [
  {
    id: 'announce',
    label: 'Announcement',
    hint: 'Headline, a paragraph, one button',
    emoji: 'Loudspeaker',
    shape: ['h', 't', 'b'],
    blocks: [
      { type: 'paragraph', content: 'Something to announce', variant: 'heading' },
      { type: 'paragraph', content: 'Hi {{first_name}} — write the news here.' },
      { type: 'button', label: 'Read more', destination: 'conference_page' },
    ],
  },
  {
    id: 'reminder',
    label: 'Reminder',
    hint: 'Headline, the ask, the small print',
    emoji: 'Hourglass not done',
    shape: ['h', 't', 's'],
    blocks: [
      { type: 'paragraph', content: 'A quick reminder', variant: 'heading' },
      { type: 'paragraph', content: 'Hi {{first_name}} — here is what still needs doing.' },
      { type: 'paragraph', content: 'If you have already done this, ignore this email.', variant: 'small' },
    ],
  },
  {
    id: 'picture',
    label: 'With a picture',
    hint: 'Image on top, then the words',
    emoji: 'Framed picture',
    shape: ['i', 'h', 't'],
    blocks: [
      { type: 'image', url: '', alt: '' },
      { type: 'paragraph', content: 'A headline under the picture', variant: 'heading' },
      { type: 'paragraph', content: 'Say what the picture is about.' },
    ],
  },
  {
    id: 'welcome',
    label: 'Welcome',
    hint: 'A greeting and a way in',
    emoji: 'Party popper',
    shape: ['h', 't', 'b', 's'],
    blocks: [
      { type: 'paragraph', content: 'Welcome to {{conference}}', variant: 'heading' },
      { type: 'paragraph', content: 'Hi {{first_name}}, we are glad to have you with us.' },
      { type: 'button', label: 'Open my conference', destination: 'documents' },
      { type: 'paragraph', content: 'Any questions? Just reply to this email.', variant: 'small' },
    ],
  },
];
