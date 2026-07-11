// Shared block model for the email composer + renderer. email_templates.body_blocks
// is the structured source of truth; body is kept as its flattened plain-text
// mirror so the older resolver/preview/history code paths (which only know
// about plain text) keep working unchanged.

export type ButtonDestination = 'conference_page' | 'apply_page' | 'documents' | 'custom';

export interface ParagraphBlock {
  type: 'paragraph';
  content: string;
}

export interface ButtonBlock {
  type: 'button';
  label: string;
  destination: ButtonDestination;
  role?: string;
  url?: string;
}

export type EmailBlock = ParagraphBlock | ButtonBlock;

export const BUTTON_DESTINATION_LABELS: Record<ButtonDestination, string> = {
  conference_page: 'Conference page',
  apply_page: 'Apply page',
  documents: 'Documents',
  custom: 'Custom URL',
};

export interface ButtonUrlConference {
  slug: string;
}

/** NEXT_PUBLIC_SITE_URL with the same production fallback used elsewhere for metadata/sitemap. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://gavelling.com';
}

export function resolveButtonUrl(block: ButtonBlock, conference: ButtonUrlConference): string {
  const siteUrl = getSiteUrl();
  switch (block.destination) {
    case 'conference_page':
    case 'documents':
      return `${siteUrl}/conferences/${conference.slug}`;
    case 'apply_page':
      return `${siteUrl}/conferences/${conference.slug}/apply${block.role ? `?role=${encodeURIComponent(block.role)}` : ''}`;
    case 'custom':
      return block.url?.trim() || '#';
  }
}

/** Plain-text mirror of the block array: paragraphs joined, buttons rendered as "Label: URL". */
export function flattenBlocksToPlainText(blocks: EmailBlock[], conference: ButtonUrlConference): string {
  return blocks
    .map(b => (b.type === 'paragraph' ? b.content : `${b.label}: ${resolveButtonUrl(b, conference)}`))
    .filter(s => s.trim().length > 0)
    .join('\n\n');
}

/** Templates saved before body_blocks existed have body_blocks=[] and only a plain body — treat that as a single paragraph. */
export function normalizeBlocks(bodyBlocks: unknown, legacyBody: string): EmailBlock[] {
  if (Array.isArray(bodyBlocks) && bodyBlocks.length > 0) return bodyBlocks as EmailBlock[];
  if (legacyBody.trim()) return [{ type: 'paragraph', content: legacyBody }];
  return [];
}
