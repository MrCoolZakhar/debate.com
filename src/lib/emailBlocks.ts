// Shared block model for the email composer + renderer. email_templates.body_blocks
// is the structured source of truth; body is kept as its flattened plain-text
// mirror so the older resolver/preview/history code paths (which only know
// about plain text) keep working unchanged.

/**
 * CLOSED union. `custom` carries a literal `url`, and a button URL is never
 * run through the token resolver — resolveButtonUrl works from the conference
 * row and the per-recipient tokens below, not from EmailTokenContext.
 *
 * `add_to_calendar` is the one destination built from conference DATA rather
 * than from a route: a Google Calendar template URL
 * https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&location=…
 * assembled from this conference's name, dates and location. That is why
 * ButtonUrlConference carries the whole date/location set and not just the
 * slug, and why every caller has to supply them. The same URL is mirrored on
 * the SQL side by `gavelling_calendar_url()`, which `gavelling_email_html`
 * resolves from the literal CTA url 'add_to_calendar'.
 *
 * It is also the one destination that can legitimately fail to produce a URL
 * (dates to be confirmed, or no start date on record). resolveButtonUrl
 * returns '' there, and BOTH renderers drop the whole button rather than
 * emit a dateless calendar entry — see renderBlock in emailHtml.ts and
 * flattenBlocksToPlainText below.
 */
export type ButtonDestination = 'conference_page' | 'apply_page' | 'documents' | 'custom' | 'chair_invite_accept' | 'organizer_invite_accept' | 'signup_page' | 'import_claim' | 'add_to_calendar';

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

/**
 * Labelled facts — "Committee: UNSC", "Country: Brazil", "Fee: ₹3,500" — as
 * discrete rows rather than a sentence.
 *
 * The single most useful thing mymun's emails do. Their newsletter answers
 * Where? / When? / Fee? / Deadline? as labelled fields, and the reader gets
 * every answer without reading a word of prose. Our allocation email buried
 * the two facts a delegate actually needs — their committee and their country
 * — mid-paragraph, where they are easy to skim past and impossible to find
 * again three weeks later when they are packing.
 *
 * Values go through the same token resolution as a paragraph, so `{{committee}}`
 * works here exactly as it does in body copy.
 */
export interface FactsBlock {
  type: 'facts';
  items: {
    label: string;
    value: string;
    /** Draw a small image beside the value. Not a URL: the renderer resolves it
     *  from the recipient's own data, so a template can say "show the flag"
     *  without a template author ever handling an asset path. */
    iconFrom?: 'country' | 'committee';
  }[];
}

export type EmailBlock = ParagraphBlock | ButtonBlock | ImageBlock | FactsBlock;

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
  add_to_calendar: 'Add to calendar (Google)',
};

/**
 * Everything a button URL can be built from. Deliberately NOT just the slug:
 * `add_to_calendar` needs the name, the dates and the location, and every
 * field here is required-but-nullable so a new send path cannot quietly omit
 * one and ship a dateless calendar link. A caller that genuinely has no value
 * passes null and the calendar button is dropped, which is the honest outcome.
 */
export interface ButtonUrlConference {
  slug: string;
  full_name: string;
  start_date: string | null;
  end_date: string | null;
  /** Organiser said "dates to be confirmed". Never put a guess in a calendar. */
  dates_tbd: boolean | null;
  city: string | null;
  country: string | null;
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

/**
 * YYYYMMDD/YYYYMMDD for a Google Calendar all-day event, or null when there is
 * no usable start date.
 *
 * THE END IS EXCLUSIVE in Google Calendar: a conference running 19 to 21 Feb
 * 2027 must pass 20270219/20270222, or it lands in the diary a day short. A
 * missing end date falls back to the start, so a one-day event still spans one
 * day rather than none.
 *
 * Shared with the registration confirmation page (RegistrationConfirmation.tsx
 * imports this) so the page and the email can never drift apart.
 */
export function googleCalendarDates(start: string | null | undefined, end: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec((start ?? '').trim());
  if (!m) return null;
  const e = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec((end ?? '').trim()) ?? m;
  const pad = (n: number) => String(n).padStart(2, '0');
  const startStamp = `${m[1]}${pad(+m[2])}${pad(+m[3])}`;
  // +1 day, in UTC so no local timezone can roll it backwards.
  const exclusive = new Date(Date.UTC(+e[1], +e[2] - 1, +e[3] + 1));
  const endStamp = `${exclusive.getUTCFullYear()}${pad(exclusive.getUTCMonth() + 1)}${pad(exclusive.getUTCDate())}`;
  return `${startStamp}/${endStamp}`;
}

/** The Google Calendar template URL for this conference, or '' when it cannot
 *  honestly be built (dates to be confirmed, or no start date on record).
 *  Callers treat '' as "drop the button". */
export function calendarUrlFor(conference: ButtonUrlConference): string {
  if (conference.dates_tbd) return '';
  const dates = googleCalendarDates(conference.start_date, conference.end_date);
  if (!dates) return '';
  const siteUrl = getSiteUrl();
  const title = (conference.full_name ?? '').trim() || 'Conference';
  const place = [conference.city, conference.country].map(s => (s ?? '').trim()).filter(Boolean).join(', ');
  const details = `Your place at ${title}. Details: ${siteUrl}/conferences/${conference.slug}`;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(title)}`
    + `&dates=${dates}`
    + (place ? `&location=${encodeURIComponent(place)}` : '')
    + `&details=${encodeURIComponent(details)}`;
}

/** Returns '' for an `add_to_calendar` button that cannot be built. Every
 *  renderer must drop a button whose URL is empty. */
export function resolveButtonUrl(block: ButtonBlock, conference: ButtonUrlConference, extra?: ButtonUrlExtra): string {
  const siteUrl = getSiteUrl();
  switch (block.destination) {
    case 'add_to_calendar':
      return calendarUrlFor(conference);
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
      if (b.type === 'button') {
        const url = resolveButtonUrl(b, conference, extra);
        // No URL means the button does not exist in this email (a calendar
        // link for a conference with no dates). Contributing "Label: " to the
        // plain-text mirror would print a promise with nothing behind it.
        if (!url) return '';
        return `${b.label}: ${url}`;
      }
      // The text/plain alternative matters more here than anywhere else: these
      // ARE the facts, so a client rendering only text must still get them.
      if (b.type === 'facts') {
        return b.items
          .filter(i => i.label.trim() || i.value.trim())
          .map(i => `${stripInlineMarks(i.label)}: ${stripInlineMarks(i.value)}`)
          .join('\n');
      }
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
