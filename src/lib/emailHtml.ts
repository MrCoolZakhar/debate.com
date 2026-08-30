// Branded, email-safe HTML renderer for the composer preview and the outbox.
//
// Table-based layout only (no flexbox/grid) so it degrades correctly in
// Outlook's Word engine; every style that MATTERS is inlined, because Gmail
// (webmail included, for some account types) and several mobile clients drop
// <style> blocks. The <style> block therefore carries only *enhancements* —
// the responsive breakpoint and the dark-mode overrides — never anything the
// email needs to be legible.
//
// Rewritten against real-inbox Gmail failures: bulletproof (table-cell)
// buttons, every image/link absolutized against NEXT_PUBLIC_SITE_URL (relative
// preset paths like /banners/preset-1.jpg have no origin to resolve against
// inside a mail client), and a fixed-height cover-cropped banner band.
//
// ── 2026 redesign notes ─────────────────────────────────────────────────────
// Shape borrowed from the transactional emails that actually work (Stripe,
// Linear, Vercel, Notion, Airbnb): one narrow column, one accent colour, a
// header that states who is writing, generous vertical rhythm, exactly one
// visually loud element (the CTA), and a footer that explains the email rather
// than apologising for it.
//
// What changed and why:
//  * The old header crammed a 44px circular logo into a cell BESIDE the
//    banner, squeezing the banner to 536px and cropping wide logos into a
//    crescent. Now the banner is full-bleed 600px and the identity (logo +
//    acronym + full name) is its own row underneath — the standard pattern,
//    and it also gives logo-less conferences a real header instead of nothing.
//  * Logos are `object-fit:contain` on a light chip, so a wide lockup
//    letterboxes instead of being cropped.
//  * Serif is now reserved for the conference name and headings (institutional
//    register, which suits MUN); body copy, buttons and footer are sans, which
//    is what makes an email read as an email rather than a blog post.
//  * Real stored templates are overwhelmingly ONE paragraph block holding a
//    whole letter separated by blank lines. Those blank lines used to collapse
//    into `<br><br>`. They now become real paragraph breaks with proper
//    leading, which is the single biggest legibility win on live content.
//  * Bare URLs and email addresses inside copy are auto-linked. Production
//    templates are full of pasted payment links, Google Forms and WhatsApp
//    invites that were previously dead text.
//  * Button and header ink are now derived from the chosen colour's luminance.
//    Conferences pick their own accent/button colours; the old hardcoded dark
//    ink went invisible the moment somebody picked a dark button.
//  * Dark mode: `color-scheme: light dark` + a `prefers-color-scheme` override
//    block + `[data-ogsc]` for Outlook. See DARK MODE below.

import { resolveTokens, splitResolvedText, type EmailTokenContext } from './emailTokens';
import {
  type EmailBlock,
  type ButtonDestination,
  type ParagraphVariant,
  resolveButtonUrl,
  absolutizeUrl,
  getSiteUrl,
  parseInlineMarks,
  stripInlineMarks,
} from './emailBlocks';

// ── Design theme ─────────────────────────────────────────────────────────────
// Persisted at conferences.email_theme (jsonb, default {}). Every field is
// optional — resolveEmailTheme fills gaps, so existing conferences (and every
// send path that doesn't thread a theme through yet) render with the house
// look and zero content migration.

export interface EmailTheme {
  headerStyle?: 'banner' | 'solid';
  accentColor?: string;
  buttonColor?: string;
  showLogo?: boolean;
  footerLine?: string;
}

export const DEFAULT_EMAIL_THEME: Required<EmailTheme> = {
  headerStyle: 'banner',
  accentColor: '#1B3828',
  buttonColor: '#EED98A',
  showLogo: true,
  footerLine: '',
};

export function resolveEmailTheme(theme?: EmailTheme | null): Required<EmailTheme> {
  return { ...DEFAULT_EMAIL_THEME, ...(theme ?? {}) };
}

export interface EmailRenderConference {
  slug: string;
  full_name: string;
  acronym: string;
  banner_url: string | null;
  logo_url: string | null;
  contact_email: string;
  email_theme?: EmailTheme | null;
}

export interface RenderEmailHtmlArgs {
  blocks: EmailBlock[];
  conference: EmailRenderConference;
  ctx: EmailTokenContext;
  /** Per-invite token for a 'chair_invite_accept' button block, if one is present. */
  chairInviteToken?: string;
  /** Per-invite token for an 'organizer_invite_accept' button block, if one is present. */
  organizerInviteToken?: string;
  /** Per-recipient token for an 'import_claim' button block, if one is present. */
  importClaimToken?: string;
}

// ── Type + colour system ─────────────────────────────────────────────────────
// Serif carries identity (conference name, headings). Sans carries everything
// a reader has to actually process. The sans stack deliberately starts with a
// font Word can resolve — a leading `-apple-system` makes Outlook's parser
// give up on the whole declaration and fall back to Times New Roman.

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Near-black / near-white rather than #000 / #FFF: several clients special-case
// the pure values when force-inverting, and the off values keep our own
// dark-mode overrides in charge instead.
const INK = '#241E17';        // body copy — 14.4:1 on the card
const INK_SOFT = '#544B3E';   // secondary copy — 8.1:1
const MUTED = '#6E6456';      // footer / small variant — 5.4:1 (was #9A8A78, 3.0:1)
const PAGE_BG = '#F1EDE4';
const CARD_BG = '#FFFFFF';
const CHIP_BG = '#FAF8F3';
const HAIRLINE = '#E7E1D3';
const FOOTER_BG = '#F7F4EC';

// Dark-mode counterparts, applied via the <style> block only.
const D_PAGE_BG = '#14130F';
const D_CARD_BG = '#1D1B16';
const D_CHIP_BG = '#26231D';
const D_INK = '#F3EFE6';
const D_INK_SOFT = '#CFC7B8';
const D_MUTED = '#A79D8D';
const D_HAIRLINE = '#332F26';
const D_FOOTER_BG = '#1A1813';

const BANNER_HEIGHT = 170;
const CONTENT_WIDTH = 520; // 600 canvas − 40px padding either side

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Colour maths ─────────────────────────────────────────────────────────────
// email_theme.accentColor / buttonColor are chair-chosen. Anything derived from
// them (label ink, header ink, link colour, button border) has to be computed,
// not assumed — production already contains a pale blue button (#DCEAF5) and a
// deep red accent (#8B2020) sitting behind the same hardcoded dark ink.

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function relLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mixHex(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  if (!a || !b) return hex;
  return toHex([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

/** Dark or light ink, whichever reads better on `bg`. Falls back to dark ink
 *  for an unparseable colour so a malformed theme value can never produce
 *  white-on-white. */
function inkOn(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return INK;
  const dark = hexToRgb(INK)!;
  const light: [number, number, number] = [255, 255, 255];
  return contrast(rgb, dark) >= contrast(rgb, light) ? INK : '#FFFFFF';
}

/** Darkens `color` toward black until it clears 4.5:1 against `bg`. Used for
 *  the in-copy link colour, so a conference that picked a pale accent still
 *  gets readable links rather than near-invisible ones. */
function readableOn(color: string, bg: string): string {
  const bgRgb = hexToRgb(bg);
  if (!bgRgb) return INK;
  let current = color;
  for (let i = 0; i <= 10; i++) {
    const rgb = hexToRgb(current);
    if (!rgb) return INK;
    if (contrast(rgb, bgRgb) >= 4.5) return current;
    current = mixHex(current, '#000000', 0.12);
  }
  return INK;
}

// ── Inline text ──────────────────────────────────────────────────────────────

const LINK_RE =
  /((?:https?:\/\/|www\.)[^\s<>"'`]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

/** Escapes plain copy and turns bare URLs / email addresses into real links.
 *  Live templates are full of pasted payment portals, Google Forms and
 *  WhatsApp invites that used to render as dead text a reader had to
 *  copy by hand. Escaping happens per fragment, so nothing here can emit
 *  attacker-controlled markup. */
function linkifyEscaped(text: string, linkColor: string): string {
  let out = '';
  let last = 0;
  LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(text))) {
    out += escapeHtml(text.slice(last, m.index));
    last = m.index + m[0].length;
    // Sentence punctuation that happens to sit against the URL is not part
    // of it — pull it back out so "visit https://x.com." doesn't 404.
    const trail = /[.,;:!?)\]}'"»]+$/.exec(m[0]);
    const tail = trail ? trail[0] : '';
    const token = tail ? m[0].slice(0, -tail.length) : m[0];
    if (!token) {
      out += escapeHtml(m[0]);
      continue;
    }
    const href = m[2] ? `mailto:${token}` : /^www\./i.test(token) ? `https://${token}` : token;
    out +=
      `<a href="${escapeHtml(href)}" target="_blank" class="e-link" style="color:${linkColor};text-decoration:underline;">` +
      `${escapeHtml(token)}</a>${escapeHtml(tail)}`;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

/** Escapes one resolved-text run, links bare URLs, and wraps unresolved
 *  ⚠token⚠ markers in an amber highlight so they read as obviously broken
 *  wherever the string ends up — a preview render or a queued outbox row. */
function renderResolvedRun(text: string, linkColor: string): string {
  return splitResolvedText(text)
    .map(seg => {
      if (seg.unresolved) {
        return `<span style="background-color:#F4E9C8;color:#8A6614;padding:0 3px;border-radius:3px;font-weight:600;">${escapeHtml(seg.text)}</span>`;
      }
      return linkifyEscaped(seg.text, linkColor).replace(/\n/g, '<br>');
    })
    .join('');
}

/** Applies **bold** / *italic* inline marks to already-resolved text. Marks
 *  are parsed AFTER token resolution and escaped per run — mark parsing never
 *  sees or emits raw HTML, so there is no injection surface. */
function renderMarkedHtml(resolved: string, linkColor: string): string {
  return parseInlineMarks(resolved)
    .map(run => {
      let html = renderResolvedRun(run.text, linkColor);
      if (run.italic) html = `<em>${html}</em>`;
      if (run.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join('');
}

/** Splits resolved copy on blank lines into real paragraphs. A single newline
 *  stays a `<br>` (address blocks, sign-offs, bullet-ish lists all depend on
 *  that); a blank line becomes vertical space, which is what turns the typical
 *  stored template — one block holding an entire letter — into something a
 *  person can read. Splitting after resolution is deliberate: a multi-line
 *  token value such as {{request_body}} gets the same treatment. */
function renderParagraphChunks(resolved: string, linkColor: string, gap: number): string {
  // CRLF first: a large share of stored templates were pasted out of Word or
  // Outlook and carry \r\n, which would otherwise defeat the blank-line split
  // and leave a stray \r inside the text.
  const chunks = resolved
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map(c => c.replace(/^\n+|\n+$/g, ''))
    .filter(c => c.trim().length > 0);
  if (chunks.length === 0) return '';
  return chunks
    .map((c, i) => {
      const margin = i === chunks.length - 1 ? 0 : gap;
      return `<div style="margin:0 0 ${margin}px 0;">${renderMarkedHtml(c, linkColor)}</div>`;
    })
    .join('');
}

// ── Header ───────────────────────────────────────────────────────────────────

/** True when the acronym is a genuine shorthand for the full name, i.e. worth
 *  printing both. Mirrors the app-wide "acronym big, full name small beneath"
 *  rule; when they're effectively the same string, printing both is noise. */
function hasDistinctFullName(conference: EmailRenderConference): boolean {
  // Punctuation-insensitive: production has acronym "TEDUTRAIN26" against full
  // name "TEDUTRAIN'26", which is the same string wearing an apostrophe and
  // must not print twice.
  const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const a = norm(conference.acronym);
  const f = norm(conference.full_name);
  return !!f && !!a && a !== f;
}

function renderIdentityRow(
  conference: EmailRenderConference,
  logoAbs: string | null,
  opts: { onAccent: boolean; accent: string }
): string {
  const bg = opts.onAccent ? opts.accent : CARD_BG;
  const nameInk = opts.onAccent ? inkOn(opts.accent) : INK;
  const subInk = opts.onAccent ? inkOn(opts.accent) : MUTED;
  const subOpacity = opts.onAccent ? 'opacity:0.78;' : '';
  const align = opts.onAccent ? 'center' : 'left';
  const cls = opts.onAccent ? '' : ' class="e-card e-hair"';
  const border = opts.onAccent ? '' : `border-bottom:1px solid ${HAIRLINE};`;
  const pad = opts.onAccent ? '30px 32px' : '22px 40px';

  // object-fit:contain on a light chip — a logo is a mark, not a portrait, so
  // it must never be cropped. NEVER point this at a Gavelling wide lockup
  // (/GavellingLogo.png, /Conferences.webp): if a Gavelling fallback is ever
  // wanted it must be the square mark, `${siteUrl}/gavelling-mark.png`.
  // See public/README.md.
  const logo = (display: 'block' | 'inline-block') =>
    logoAbs
      ? `<img src="${escapeHtml(logoAbs)}" width="52" height="52" alt="${escapeHtml(conference.acronym)}" class="e-chip"
              style="display:${display};width:52px;height:52px;object-fit:contain;border-radius:10px;background-color:${CHIP_BG};" />`
      : '';

  // Only the on-card variant gets the dark-mode classes. The on-accent variant
  // sits on a solid brand colour that no dark override repaints, so its ink is
  // already correct for both schemes and must be left alone.
  const nameCls = opts.onAccent ? '' : ' class="e-ink"';
  const subCls = opts.onAccent ? '' : ' class="e-muted"';
  const nameStack =
    `<div${nameCls} style="font-family:${SERIF};font-size:20px;line-height:1.25;font-weight:bold;letter-spacing:0.03em;color:${nameInk};">` +
    `${escapeHtml(conference.acronym || conference.full_name)}</div>` +
    (hasDistinctFullName(conference)
      ? `<div${subCls} style="font-family:${SANS};font-size:12px;line-height:1.45;color:${subInk};${subOpacity}padding-top:4px;">${escapeHtml(conference.full_name)}</div>`
      : '');

  if (opts.onAccent) {
    // Solid header: stacked and centred, so it reads as a masthead rather than
    // a toolbar. Outlook ignores border-radius on the chip; a square chip is a
    // fine degradation.
    return `<tr><td align="center" class="email-padding" style="background-color:${bg};padding:${pad};">
      ${logoAbs ? `<div style="padding:0 0 14px 0;">${logo('inline-block')}</div>` : ''}
      ${nameStack}
    </td></tr>`;
  }

  return `<tr><td${cls} style="background-color:${bg};padding:${pad};${border}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${logoAbs ? `<td width="52" valign="middle" style="width:52px;padding:0 14px 0 0;">${logo('block')}</td>` : ''}
      <td valign="middle" align="${align}">${nameStack}</td>
    </tr></table>
  </td></tr>`;
}

// ── Maker's mark ─────────────────────────────────────────────────────────────
// A quiet "made with Gavelling" mark tucked into the bottom-right of the banner
// band, between the banner image and the identity row.
//
// Why it is a ROW and not an OVERLAY. The obvious ask is "float it over the
// banner", and in email that means one of two things, both of which cost more
// than the mark is worth:
//   * `position:absolute` — Outlook 2007–2019/365 on Windows renders through
//     the WORD engine, which ignores position/z-index outright. The mark would
//     drop below the banner as a second stacked image.
//   * banner as a CSS `background-image` + a VML `<v:rect>/<v:fill type=frame>`
//     for Outlook — this genuinely works, but it puts the CONFERENCE's banner
//     (the loudest thing in the email) behind a property Gmail has repeatedly
//     broken: caniemail still lists Gmail's background-image support as
//     "partial and buggy — removes the entire style attribute or <style> tag
//     when a url() function with a valid image URL is present". Trading a
//     reliably-proxied <img> banner for a decorative maker's mark is a bad
//     trade, and it would also violate this file's own rule that the <style>
//     block never carries anything the email needs.
// So the mark gets its own row: nothing can overlap, nothing can stack wrong,
// and every client — Word engine included — renders the same tucked corner
// chip. Outlook drops only `border-radius`, so the chip is a small square
// instead of a rounded one. That is a deliberate-looking degradation.
//
// Placement: the conference's own logo sits at the LEFT of the identity row
// directly below (52px, `renderIdentityRow`). This mark is 20px and hard right,
// so the two never sit near each other or read as a co-brand.
//
// Only rendered when a banner is actually rendered — a solid-colour header is a
// centred masthead on the accent, and a chip floating above nothing would just
// look like a stray image.
const MARK_SIZE = 20;

/** Backing chip. Deliberately PAGE_BG rather than the `.e-chip` token: `.e-chip`
 *  is repainted dark by the prefers-color-scheme block, and the mark's artwork
 *  is a dark gavel — it would disappear. PAGE_BG is near-invisible on the white
 *  card in light mode (it reads as a notch of page showing through) and becomes
 *  a subtle light pill on the dark card, which is exactly where the artwork
 *  needs the backing. It carries no dark-mode class, so it stays light in both
 *  schemes by construction. */
const MARK_CHIP_BG = PAGE_BG;

function renderMakerMark(siteUrl: string): string {
  // Absolute HTTPS, same convention as every other asset here (getSiteUrl() →
  // NEXT_PUBLIC_SITE_URL, production fallback https://gavelling.com). This is
  // the 512px SQUARE mark, never a lockup — see public/README.md and the note
  // in renderIdentityRow about the crescent-"C" crop.
  const src = `${siteUrl}/gavelling-mark.png`;
  // Right padding is 40px, NOT the 18px this first shipped with, so the mark
  // sits on the SAME optical margin as the identity row below it and every
  // paragraph under that (all 40px). At 18px it hung further right than
  // anything else in the email, which is most of what made it read as a stray
  // floating chip rather than a corner mark. The identity row does not carry
  // `.email-padding` either, so 40px is correct at every width.
  return `<tr><td class="e-card" align="right" style="background-color:${CARD_BG};padding:8px 40px 0 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="border-collapse:collapse;"><tr>
      <td bgcolor="${MARK_CHIP_BG}" style="background-color:${MARK_CHIP_BG};border-radius:7px;padding:4px;">
        <a href="${escapeHtml(siteUrl)}" target="_blank" title="Made with Gavelling" style="text-decoration:none;">
          <img src="${escapeHtml(src)}" width="${MARK_SIZE}" height="${MARK_SIZE}" alt="Gavelling"
               style="display:block;width:${MARK_SIZE}px;height:${MARK_SIZE}px;border:0;font-family:${SANS};font-size:10px;line-height:${MARK_SIZE}px;color:${MUTED};" />
        </a>
      </td>
    </tr></table>
  </td></tr>`;
}

function renderHeader(conference: EmailRenderConference, siteUrl: string, theme: Required<EmailTheme>): string {
  const bannerAbs = absolutizeUrl(conference.banner_url, siteUrl);
  const logoAbs = theme.showLogo ? absolutizeUrl(conference.logo_url, siteUrl) : null;
  const useBanner = theme.headerStyle === 'banner' && !!bannerAbs;
  const accent = theme.accentColor;

  // A 5px accent spine at the very top. It is the cheapest possible way to
  // carry a conference's colour into every email without tinting type, and it
  // survives every client including Outlook (a background-colour on a cell).
  const spine = `<tr><td class="e-spine" style="height:5px;line-height:5px;font-size:0;background-color:${accent};">&nbsp;</td></tr>`;

  // Full-bleed 600px banner. Cover-crop via object-fit is supported by Gmail
  // (web + app), Apple Mail, Yahoo and Outlook.com webmail; Outlook desktop
  // ignores it and stretches instead, which is a fixed-height, non-broken
  // image — the deliberate trade-off rather than a VML background-fill.
  const banner = useBanner
    ? `<tr><td style="padding:0;font-size:0;line-height:0;">
         <img src="${escapeHtml(bannerAbs!)}" width="600" height="${BANNER_HEIGHT}" alt="${escapeHtml(conference.full_name)}" class="e-hero"
              style="display:block;width:100%;max-width:600px;height:${BANNER_HEIGHT}px;object-fit:cover;object-position:center;border:0;" />
       </td></tr>`
    : '';

  return (
    spine +
    banner +
    (useBanner ? renderMakerMark(siteUrl) : '') +
    renderIdentityRow(conference, logoAbs, { onAccent: !useBanner, accent })
  );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

/** Sensible label for a button whose label was left empty. Production is full
 *  of these (the composer allows an empty label), and every one of them used
 *  to render as the destination-blind "Learn more". */
const BUTTON_FALLBACK_LABEL: Record<ButtonDestination, string> = {
  conference_page: 'View the conference',
  apply_page: 'Continue my application',
  documents: 'View my conference',
  custom: 'Open link',
  chair_invite_accept: 'Accept the invitation',
  organizer_invite_accept: 'Accept the invitation',
  signup_page: 'Create my account',
  import_claim: 'View my invitation',
};

function renderBlock(
  block: EmailBlock,
  conference: EmailRenderConference,
  ctx: EmailTokenContext,
  theme: Required<EmailTheme>,
  linkColor: string,
  chairInviteToken?: string,
  organizerInviteToken?: string,
  importClaimToken?: string
): string {
  if (block.type === 'paragraph') {
    if (!block.content.trim()) return '';
    const variant: ParagraphVariant = block.variant ?? 'body';
    // Fixed presets, never a free-form size — see ParagraphVariant in
    // emailBlocks.ts. 17px serif body gave way to 16px sans at 1.7 leading:
    // it is the size the whole transactional-email world converged on because
    // it survives a phone without zooming.
    const cell: Record<ParagraphVariant, { style: string; gap: number }> = {
      body: {
        style: `padding:0 0 20px 0;font-family:${SANS};font-size:16px;line-height:1.7;color:${INK};`,
        gap: 15,
      },
      heading: {
        style: `padding:2px 0 12px 0;font-family:${SERIF};font-size:23px;line-height:1.3;font-weight:bold;letter-spacing:-0.01em;color:${INK};`,
        gap: 8,
      },
      small: {
        style: `padding:0 0 18px 0;font-family:${SANS};font-size:13px;line-height:1.65;color:${MUTED};`,
        gap: 10,
      },
    };
    const inkClass = variant === 'small' ? 'e-muted' : 'e-ink';
    const body = renderParagraphChunks(resolveTokens(block.content, ctx), linkColor, cell[variant].gap);
    if (!body) return '';
    return `<tr><td class="email-padding ${inkClass}" style="${cell[variant].style}">${body}</td></tr>`;
  }

  if (block.type === 'image') {
    const abs = absolutizeUrl(block.url, getSiteUrl());
    // Skip empty and data: URIs — most mail clients block data: images (Gmail
    // strips them entirely), so they must never reach an outbox row.
    if (!abs || /^data:/i.test(abs)) return '';
    return `<tr><td align="center" style="padding:2px 0 22px 0;">
      <img src="${escapeHtml(abs)}" width="${CONTENT_WIDTH}" alt="${escapeHtml(block.alt)}"
           style="display:block;width:100%;max-width:${CONTENT_WIDTH}px;height:auto;border-radius:10px;border:0;" />
    </td></tr>`;
  }

  const url = resolveButtonUrl(block, conference, { chairInviteToken, organizerInviteToken, importClaimToken });
  const label = block.label?.trim() || BUTTON_FALLBACK_LABEL[block.destination] || 'Open link';
  const btnBg = theme.buttonColor;
  const btnInk = inkOn(btnBg);
  const btnBorder = mixHex(btnBg, '#000000', 0.16);
  // Bulletproof CTA: background-colour, border-radius and padding all live on
  // the <td>, never on the <a> — Outlook (and older Gmail app builds) drop
  // padding/border-radius declared only on an inline <a>, silently collapsing
  // the button into a bare underlined link. The 1px border is what keeps the
  // shape when a dark-mode client repaints the fill.
  return `<tr><td align="center" style="padding:10px 0 26px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="${btnBg}" class="e-btn" style="background-color:${btnBg};border:1px solid ${btnBorder};border-radius:8px;">
        <a href="${escapeHtml(url)}" target="_blank" class="e-btn-a"
           style="display:block;padding:15px 34px;font-family:${SANS};font-size:15px;font-weight:bold;line-height:20px;letter-spacing:0.01em;color:${btnInk};text-decoration:none;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr></table>
  </td></tr>`;
}

// ── Preheader ────────────────────────────────────────────────────────────────

/** The grey line an inbox shows next to the subject. Without one, Gmail prints
 *  whatever text it finds first — historically the footer or an alt attribute.
 *  Derived from the first real paragraph so it is always true to the email. */
function buildPreheader(blocks: EmailBlock[], ctx: EmailTokenContext): string {
  const first = blocks.find(b => b.type === 'paragraph' && b.content.trim());
  if (!first || first.type !== 'paragraph') return '';
  const flat = stripInlineMarks(resolveTokens(first.content, ctx))
    .replace(/⚠(\w+)⚠/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return '';
  return flat.length > 140 ? `${flat.slice(0, 137).trimEnd()}…` : flat;
}

// ── Document ─────────────────────────────────────────────────────────────────

/** Renders a complete, standalone HTML email document from the block model. */
export function renderEmailHtml({
  blocks,
  conference,
  ctx,
  chairInviteToken,
  organizerInviteToken,
  importClaimToken,
}: RenderEmailHtmlArgs): string {
  const siteUrl = getSiteUrl();
  const theme = resolveEmailTheme(conference.email_theme);
  const linkColor = readableOn(theme.accentColor, CARD_BG);
  const bodyRows = blocks
    .map(b => renderBlock(b, conference, ctx, theme, linkColor, chairInviteToken, organizerInviteToken, importClaimToken))
    .join('');
  const footerLine = theme.footerLine.trim();
  const preheader = buildPreheader(blocks, ctx);
  const prefsUrl = `${siteUrl}/account/profile`;

  // DARK MODE. Three behaviours in the wild: Apple Mail and Outlook.com do a
  // *partial* invert unless told otherwise, the Gmail apps do a *full* invert
  // and ignore CSS, and Gmail web / Outlook desktop leave colours alone.
  // Declaring `color-scheme: light dark` is what stops the partial-inverters
  // guessing; the media block then repaints the surfaces we own. The Gmail
  // apps still force their own inversion, which is survivable here because
  // every foreground/background pair inverts together — the failure case we
  // are avoiding is a colour that inverts while its neighbour does not, which
  // is why the button carries a border and the muted ink was darkened.
  const styleBlock = `
  body, table, td { font-family: ${SANS}; }
  img { border: 0; outline: none; -ms-interpolation-mode: bicubic; }
  a { color: inherit; }
  .e-btn-a { color: ${inkOn(theme.buttonColor)} !important; }
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; }
    .email-padding { padding-left: 24px !important; padding-right: 24px !important; }
    .e-hero { height: 132px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .e-page, body { background-color: ${D_PAGE_BG} !important; }
    .e-card { background-color: ${D_CARD_BG} !important; }
    .e-hair { border-color: ${D_HAIRLINE} !important; }
    .e-ink, .e-ink div, .e-ink strong, .e-ink em { color: ${D_INK} !important; }
    .e-soft { color: ${D_INK_SOFT} !important; }
    .e-muted, .e-muted a, .e-muted div { color: ${D_MUTED} !important; }
    .e-footer { background-color: ${D_FOOTER_BG} !important; border-color: ${D_HAIRLINE} !important; }
    .e-chip { background-color: ${D_CHIP_BG} !important; }
    .e-link { color: ${mixHex(theme.accentColor, '#FFFFFF', 0.55)} !important; }
  }
  [data-ogsc] .e-page { background-color: ${D_PAGE_BG} !important; }
  [data-ogsc] .e-card { background-color: ${D_CARD_BG} !important; }
  [data-ogsc] .e-ink, [data-ogsc] .e-ink div { color: ${D_INK} !important; }
  [data-ogsc] .e-muted, [data-ogsc] .e-muted div { color: ${D_MUTED} !important; }
  [data-ogsc] .e-footer { background-color: ${D_FOOTER_BG} !important; }`;

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(conference.full_name)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>${styleBlock}
</style>
</head>
<body class="e-page" style="margin:0;padding:0;background-color:${PAGE_BG};">
  ${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${PAGE_BG};">${escapeHtml(preheader)}&#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847;</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-page" style="background-color:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 16px 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container e-card e-hair"
               style="width:600px;max-width:600px;background-color:${CARD_BG};border:1px solid ${HAIRLINE};border-radius:14px;overflow:hidden;">
          ${renderHeader(conference, siteUrl, theme)}
          <tr>
            <td class="email-padding e-card" style="background-color:${CARD_BG};padding:34px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${bodyRows}
              </table>
            </td>
          </tr>
          ${footerLine ? `<tr>
            <td class="email-padding e-card e-soft" style="background-color:${CARD_BG};padding:6px 40px 24px 40px;font-family:${SANS};font-size:14px;line-height:1.65;color:${INK_SOFT};">
              ${escapeHtml(footerLine).replace(/\n/g, '<br>')}
            </td>
          </tr>` : ''}
          <tr>
            <td class="email-padding e-footer e-hair" style="background-color:${FOOTER_BG};border-top:1px solid ${HAIRLINE};padding:26px 40px 28px 40px;">
              <div class="e-soft" style="font-family:${SANS};font-size:13px;line-height:1.6;font-weight:bold;color:${INK_SOFT};">
                ${escapeHtml(conference.full_name)}
              </div>
              <div class="e-muted" style="font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};padding-top:2px;">
                <a href="mailto:${escapeHtml(conference.contact_email)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(conference.contact_email)}</a>
              </div>
              <div class="e-muted" style="font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};padding-top:14px;">
                Sent to you by ${escapeHtml(conference.acronym || conference.full_name)} through Gavelling, the platform it runs on.
                <br>
                <a href="${escapeHtml(prefsUrl)}" target="_blank" style="color:${MUTED};text-decoration:underline;">Manage email preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(siteUrl)}" target="_blank" style="color:${MUTED};text-decoration:underline;">gavelling.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
