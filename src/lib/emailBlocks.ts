// Shared block model for the email composer + renderer. email_templates.body_blocks
// is the structured source of truth; body is kept as its flattened plain-text
// mirror so the older resolver/preview/history code paths (which only know
// about plain text) keep working unchanged.

export type ButtonDestination = 'conference_page' | 'apply_page' | 'documents' | 'custom' | 'chair_invite_accept' | 'organizer_invite_accept' | 'signup_page' | 'import_claim';

/** Fixed size presets only — never a free-form font size. A numeric size
 *  control would let a single template break the 600px table layout and
 *  drift off the conference email theme, so paragraphs pick from these
 *  three named variants instead. A missing `variant` is 'body', which keeps
 *  every stored row rendering byte-identically to before variants existed. */
export type ParagraphVariant = 'heading' | 'body' | 'small';

export interface ParagraphBlock {
  type: 'paragraph';
  content: string;
  variant?: ParagraphVariant;
}

export interface ButtonBlock {
  type: 'button';
  label: string;
  destination: ButtonDestination;
  role?: string;
  url?: string;
}

export interface ImageBlock {
  type: 'image';
  /** Public URL in the conference-assets bucket (never a data: URI — most
   *  mail clients block those, so the renderer skips them too). */
  url: string;
  alt: string;
}

export type EmailBlock = ParagraphBlock | ButtonBlock | ImageBlock;

// ── Inline marks (**bold** / *italic*) ───────────────────────────────────────
// Markdown-ish emphasis shared by the renderer (emailHtml) and the composer
// (EmailComposer). Flanking rules are a deliberate subset of CommonMark: a
// delimiter only OPENS when its inner edge touches a non-space, non-asterisk
// character, and only CLOSES the same way. This is what keeps existing stored
// content byte-identical — e.g. a real production template contains the
// literal text `"* Name of Participant*"` (space after the opening `*`),
// which under these rules stays plain text. There is no escape syntax; a
// literal `**word**` in old content was always rare enough that the only
// occurrence in production (above) does not parse.

export interface InlineMarkRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

// Triple first (bold+italic), then bold (inner may contain single `*`s but
// never `**`), then italic (inner may not contain `*` at all — so it cannot
// swallow half of a bold delimiter). Inner must start and end on a
// non-space, non-asterisk character; a closer may not be followed by another
// `*` (that would be a mis-split of a longer delimiter run).
const TRIPLE_RE = /\*\*\*(?![\s*])((?:(?!\*\*\*)[\s\S])*?[^\s*])\*\*\*(?!\*)/g;
const BOLD_RE = /\*\*(?![\s*])((?:(?!\*\*)[\s\S])*?[^\s*])\*\*(?!\*)/g;
const ITALIC_RE = /\*(?![\s*])([^*]*?[^\s*])\*(?!\*)/g;

function splitByRegex(text: string, re: RegExp, onPlain: (s: string) => void, onMatch: (inner: string) => void) {
  re.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) onPlain(text.slice(last, m.index));
    onMatch(m[1]);
    last = m.index + m[0].length;
  }
  if (last < text.length) onPlain(text.slice(last));
}

/** Parses **bold** / *italic* marks into styled runs. Text with no valid
 *  marks comes back as a single plain run — the unchanged-content fast path
 *  the compatibility guarantee rests on. Nesting supported one way only:
 *  italic inside bold (`**a *b* c**`); bold inside italic stays literal. */
export function parseInlineMarks(text: string): InlineMarkRun[] {
  if (!text.includes('*')) return [{ text, bold: false, italic: false }];
  const runs: InlineMarkRun[] = [];
  const push = (t: string, bold: boolean, italic: boolean) => {
    if (!t) return;
    const prev = runs[runs.length - 1];
    if (prev && prev.bold === bold && prev.italic === italic) prev.text += t;
    else runs.push({ text: t, bold, italic });
  };
  splitByRegex(
    text, TRIPLE_RE,
    plain => splitByRegex(
      plain, BOLD_RE,
      p2 => splitByRegex(p2, ITALIC_RE, p3 => push(p3, false, false), inner => push(inner, false, true)),
      boldInner => splitByRegex(boldInner, ITALIC_RE, p3 => push(p3, true, false), inner => push(inner, true, true)),
    ),
    tripleInner => push(tripleInner, true, true),
  );
  if (runs.length === 0) runs.push({ text: '', bold: false, italic: false });
  return runs;
}

/** Drops mark delimiters, keeping the text — used for the plain-text `body`
 *  mirror so it reads naturally, without asterisks. Literal asterisks that
 *  don't form a valid mark are preserved as-is. */
export function stripInlineMarks(text: string): string {
  if (!text.includes('*')) return text;
  return parseInlineMarks(text).map(r => r.text).join('');
}

export const BUTTON_DESTINATION_LABELS: Record<ButtonDestination, string> = {
  conference_page: 'Conference page',
  apply_page: 'Apply page',
  // 'documents' is a legacy key — that tab is now the participant person-view.
  // Kept as-is (no migration) so templates saved with this destination keep
  // resolving, just to the current URL.
  documents: 'My conference view',
  custom: 'Custom URL',
  chair_invite_accept: 'Accept chair invite link',
  organizer_invite_accept: 'Accept organizer invite link',
  signup_page: 'Gavelling sign-up page (returns to this conference)',
  import_claim: 'Imported delegate claim link',
};

export interface ButtonUrlConference {
  slug: string;
}

/** Per-recipient values a button URL may need beyond the conference — the
 *  chair and organizer invite tokens. */
export interface ButtonUrlExtra {
  chairInviteToken?: string;
  organizerInviteToken?: string;
  importClaimToken?: string;
}

/** NEXT_PUBLIC_SITE_URL with the same production fallback used elsewhere for metadata/sitemap. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://gavelling.com';
}

/**
 * Prefixes a relative path (e.g. a bundled banner preset like
 * "/banners/preset-1.jpg") with the site origin so it resolves outside a
 * browser context — an email client has no page origin to resolve a
 * relative URL against. Absolute URLs (http/https/protocol-relative) and
 * data:/mailto:/tel: URIs pass through unchanged.
 */
export function absolutizeUrl(url: string | null | undefined, siteUrl: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^([a-z]+:)?\/\//i.test(trimmed) || /^(data|mailto|tel):/i.test(trimmed)) return trimmed;
  return `${siteUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export function resolveButtonUrl(block: ButtonBlock, conference: ButtonUrlConference, extra?: ButtonUrlExtra): string {
  const siteUrl = getSiteUrl();
  switch (block.destination) {
    case 'conference_page':
      return `${siteUrl}/conferences/${conference.slug}`;
    case 'documents':
      return `${siteUrl}/conferences/${conference.slug}/role`;
    case 'apply_page':
      return `${siteUrl}/conferences/${conference.slug}/apply${block.role ? `?role=${encodeURIComponent(block.role)}` : ''}`;
    case 'chair_invite_accept':
      return extra?.chairInviteToken ? `${siteUrl}/invites/chair/${extra.chairInviteToken}` : '#';
    case 'organizer_invite_accept':
      return extra?.organizerInviteToken ? `${siteUrl}/invites/organizer/${extra.organizerInviteToken}` : '#';
    case 'import_claim':
      return extra?.importClaimToken ? `${siteUrl}/invites/import/${extra.importClaimToken}` : '#';
    case 'signup_page':
      // Carries the new account straight to this conference's role view
      // after signup and onboarding (both already honor ?next= end to end),
      // rather than dropping an imported delegate on the generic home page.
      return `${siteUrl}/auth/signup?next=${encodeURIComponent(`/conferences/${conference.slug}/role`)}`;
    case 'custom':
      return absolutizeUrl(block.url, siteUrl) ?? '#';
  }
}

/** Plain-text mirror of the block array: paragraphs joined (inline marks
 *  stripped so the mirror reads naturally, no asterisks), buttons rendered as
 *  "Label: URL", images as their alt text (an image with no alt contributes
 *  nothing, same as an empty paragraph). */
export function flattenBlocksToPlainText(blocks: EmailBlock[], conference: ButtonUrlConference, extra?: ButtonUrlExtra): string {
  return blocks
    .map(b => {
      if (b.type === 'paragraph') return stripInlineMarks(b.content);
      if (b.type === 'button') return `${b.label}: ${resolveButtonUrl(b, conference, extra)}`;
      return b.alt;
    })
    .filter(s => s.trim().length > 0)
    .join('\n\n');
}

/** Templates saved before body_blocks existed have body_blocks=[] and only a plain body — treat that as a single paragraph. */
export function normalizeBlocks(bodyBlocks: unknown, legacyBody: string): EmailBlock[] {
  if (Array.isArray(bodyBlocks) && bodyBlocks.length > 0) return bodyBlocks as EmailBlock[];
  if (legacyBody.trim()) return [{ type: 'paragraph', content: legacyBody }];
  return [];
}
