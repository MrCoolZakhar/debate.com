// Shared block model for the email composer + renderer. email_templates.body_blocks
// is the structured source of truth; body is kept as its flattened plain-text
// mirror so the older resolver/preview/history code paths (which only know
// about plain text) keep working unchanged.

export type ButtonDestination = 'conference_page' | 'apply_page' | 'documents' | 'custom' | 'chair_invite_accept';

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
  chair_invite_accept: 'Accept chair invite link',
};

export interface ButtonUrlConference {
  slug: string;
}

/** Per-recipient values a button URL may need beyond the conference — currently just the chair invite token. */
export interface ButtonUrlExtra {
  chairInviteToken?: string;
}

/** NEXT_PUBLIC_SITE_URL with the same production fallback used elsewhere for metadata/sitemap. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://gavelling.com';
}

export function resolveButtonUrl(block: ButtonBlock, conference: ButtonUrlConference, extra?: ButtonUrlExtra): string {
  const siteUrl = getSiteUrl();
  switch (block.destination) {
    case 'conference_page':
    case 'documents':
      return `${siteUrl}/conferences/${conference.slug}`;
    case 'apply_page':
      return `${siteUrl}/conferences/${conference.slug}/apply${block.role ? `?role=${encodeURIComponent(block.role)}` : ''}`;
    case 'chair_invite_accept':
      return extra?.chairInviteToken ? `${siteUrl}/invites/chair/${extra.chairInviteToken}` : '#';
    case 'custom':
      return block.url?.trim() || '#';
  }
}

/** Plain-text mirror of the block array: paragraphs joined, buttons rendered as "Label: URL". */
export function flattenBlocksToPlainText(blocks: EmailBlock[], conference: ButtonUrlConference, extra?: ButtonUrlExtra): string {
  return blocks
    .map(b => (b.type === 'paragraph' ? b.content : `${b.label}: ${resolveButtonUrl(b, conference, extra)}`))
    .filter(s => s.trim().length > 0)
    .join('\n\n');
}

/** Templates saved before body_blocks existed have body_blocks=[] and only a plain body — treat that as a single paragraph. */
export function normalizeBlocks(bodyBlocks: unknown, legacyBody: string): EmailBlock[] {
  if (Array.isArray(bodyBlocks) && bodyBlocks.length > 0) return bodyBlocks as EmailBlock[];
  if (legacyBody.trim()) return [{ type: 'paragraph', content: legacyBody }];
  return [];
}
