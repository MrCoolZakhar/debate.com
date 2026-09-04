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
import { companyLegalLines } from './companyDetails';
import { conferenceAcronymLabel } from './conferenceLabels';
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
  // Forest, NOT the pale gold this used to be. Gold #EED98A on the white card
  // is 1.41:1 — the CTA was reliably the palest thing on the page, on emails
  // whose entire job is to be clicked (a delegate's fee, an acceptance). Worse,
  // `inkOn()` correctly answered that pale fill with near-black ink, which is
  // exactly the treatment a client gives a DISABLED button. Forest on white is
  // 12.7:1. Gold stays the accent, where a thin ornamental line is the point.
  buttonColor: '#1B3828',
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
  /* Socials for the footer. All optional: a caller that does not select them
     simply renders no social row, so adding them broke no existing send path.
     Worth threading through — 106 of 170 conferences already have an Instagram
     URL set, and none of it was reaching a single email. */
  instagram_url?: string | null;
  website_url?: string | null;
  tiktok_url?: string | null;
  facebook_url?: string | null;
  whatsapp_url?: string | null;
  /** Only for the edition year in the masthead ("SISMUN 2026"). */
  start_date?: string | null;
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
  /**
   * What kind of email this is, which decides the masthead.
   *
   * 'transactional' (an event: accepted, allocated, fee ready) puts a small
   * identity mark ABOVE the card and shows no banner. The reader already knows
   * which conference this is; what they need is the news, and a 170px banner
   * plus a second identity band pushed it below the fold of a Gmail reading
   * pane. mymun does the same — a small platform mark on the field, then
   * straight into the headline.
   *
   * 'broadcast' (an organiser's own composed blast) keeps the full banner
   * masthead, where the artwork IS the point.
   *
   * Defaults to 'broadcast', which is the behaviour every existing caller
   * already had — so no send path changes look until it opts in.
   */
  variant?: 'transactional' | 'broadcast';
  /**
   * Per-recipient imagery for `facts` rows that declare an `iconFrom`.
   * Deliberately passed in rather than tokenised: an organiser editing a
   * template should never have to paste an asset URL, and these differ for
   * every single recipient.
   */
  media?: { countryCode?: string | null; committeeEmblem?: string | null };
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
/** Bullet marker. Deep enough to sit on white (the pale brand gold is 1.4:1
 *  there, which is why it is not the button colour either). */
const GOLD_DOT = '#C9A63A';

// Dark-mode counterparts, applied via the <style> block only.
// The card has to be VISIBLE against the page. These were #14130F and #1D1B16
// — nine points apart, 1.04:1, so in dark mode the card simply stopped
// existing and the email became a floating column of text. Widened, and the
// hairline below does the rest: at the dark end an explicit edge draws a card
// far more reliably than a background delta does.
const D_PAGE_BG = '#0E0D0A';
const D_CARD_BG = '#232019';
/* The logo chip stays LIGHT in dark mode, on purpose.
   A conference logo is an arbitrary upload: dark seals and dark-ink wordmarks
   are common, and painting them onto a near-black tile makes them vanish. This
   is the same reasoning as LogoDisc on the web side, which sits every logo on a
   near-white disc rather than trusting the artwork. A soft ring gives it an
   edge against the dark card without a box-shadow, which Outlook drops. */
const D_CHIP_BG = '#F4F1EA';
const D_INK = '#F3EFE6';
const D_INK_SOFT = '#CFC7B8';
const D_MUTED = '#A79D8D';
const D_HAIRLINE = '#3A352A';
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
      const list = renderBulletList(c, linkColor, margin);
      if (list) return list;
      return `<div style="margin:0 0 ${margin}px 0;">${renderMarkedHtml(c, linkColor)}</div>`;
    })
    .join('');
}

/**
 * A chunk whose every line starts with "- " becomes a real list.
 *
 * Previously these rendered as `<br>- item`, i.e. a hyphen and a line break —
 * which is what a plain-text email looks like, not what a list looks like. The
 * chair reminder is mostly a list of what the room can do, so this is the
 * difference between something a chair skims and something they scroll past.
 *
 * A two-cell table row per item rather than <ul>: Outlook's list indentation is
 * unpredictable and Gmail strips list-style in places, whereas a fixed-width
 * marker cell beside a text cell renders identically everywhere. The marker is
 * a small gold disc — brand, and enough colour to break up a wall of forest
 * and ink without adding an image that a client might block.
 *
 * Returns null when the chunk is not a list, so ordinary paragraphs are
 * untouched.
 */
function renderBulletList(chunk: string, linkColor: string, marginBottom: number): string | null {
  const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  if (!lines.every(l => /^[-•]\s+/.test(l))) return null;

  const rows = lines
    .map(l => l.replace(/^[-•]\s+/, ''))
    .map(
      (text, idx, all) => `<tr>
        <td width="20" valign="top" style="width:20px;padding:0 0 ${idx === all.length - 1 ? 0 : 9}px 0;">
          <div style="width:6px;height:6px;border-radius:3px;background-color:${GOLD_DOT};margin-top:8px;font-size:0;line-height:0;">&nbsp;</div>
        </td>
        <td valign="top" style="padding:0 0 ${idx === all.length - 1 ? 0 : 9}px 0;font-family:${SANS};font-size:15.5px;line-height:1.6;">
          ${renderMarkedHtml(text, linkColor)}
        </td>
      </tr>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 ${marginBottom}px 0;">${rows}</table>`;
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

/**
 * The transactional masthead: a small logo disc and the acronym, sitting on the
 * page field ABOVE the card rather than inside it.
 *
 * This replaces a stack of two header bands — a 170px banner AND a bordered
 * identity row — that between them put three horizontal rules ahead of any
 * content. That composition is right for an announcement blast and wrong for
 * "your fee is ready to pay", where the first thing in the reading pane should
 * be the sentence, not a group photo.
 *
 * A disc, not a rounded square, matching LogoDisc on the web side and the
 * share card. Kept light in dark mode for the same reason as the in-card chip:
 * a conference logo is an arbitrary upload and dark seals are common.
 */
function renderAboveCardIdentity(conference: EmailRenderConference, logoAbs: string | null): string {
  // WITH THE EDITION YEAR. The masthead said "SISMUN" where every other
  // surface in the product says "SISMUN 2026" — and the year is the single
  // most useful disambiguator in a mailbox, because a delegate who did last
  // year's conference has the previous edition's mail sitting right above it.
  // conferenceAcronymLabel is the same helper the share cards and the site
  // use, so it never doubles a year that is already in the acronym.
  const acronym =
    conferenceAcronymLabel({ acronym: conference.acronym, start_date: conference.start_date ?? null }) ||
    conference.acronym ||
    conference.full_name;
  return `<tr><td align="center" style="padding:0 0 20px 0;">
    ${logoAbs
      ? `<div style="padding:0 0 11px 0;"><img src="${escapeHtml(logoAbs)}" width="58" height="58" alt="${escapeHtml(acronym)}" class="e-chip"
             style="display:inline-block;width:58px;height:58px;object-fit:contain;border-radius:29px;background-color:${CHIP_BG};" /></div>`
      : ''}
    <div class="e-accent" style="font-family:${SANS};font-size:15px;line-height:1.3;font-weight:800;letter-spacing:0.12em;color:${INK_SOFT};text-transform:uppercase;">
      ${escapeHtml(acronym)}
    </div>
  </td></tr>`;
}

/**
 * "Questions? Reply to this email and it reaches the {acronym} team."
 *
 * True, not a comforting fiction: `send-emails` sets the outbox row's
 * `reply_to` from `conferences.contact_email`, so a reply genuinely lands with
 * the organisers. mymun carries the same line for the same reason, and it is
 * the cheapest possible answer to "who do I even ask".
 */
function renderReplyPanel(conference: EmailRenderConference, accent: string): string {
  return `<tr><td class="email-padding" style="padding:2px 0 4px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-panel" style="background-color:${CHIP_BG};border-radius:10px;">
      <tr>
        <td class="e-rule" width="4" style="width:4px;background-color:${accent};font-size:0;line-height:0;border-radius:10px 0 0 10px;">&nbsp;</td>
        <td class="e-soft" style="padding:15px 18px;font-family:${SANS};font-size:14px;line-height:1.6;color:${INK_SOFT};">
          <strong class="e-ink" style="color:${INK};">Questions?</strong> Reply to this email and it reaches the ${escapeHtml(conference.acronym || conference.full_name)} team.
        </td>
      </tr>
    </table>
  </td></tr>`;
}

/**
 * Social links the conference actually has, as line-art icons.
 *
 * The icons are hosted PNGs (public/email/*.png), monochrome in the footer's
 * own ink so they sit at footer weight rather than shouting. Remote images ARE
 * blocked by default in Outlook and in Gmail's ask-before-displaying mode —
 * which is why each one's `alt` is its plain label. A client that blocks the
 * image shows "Instagram · Facebook", i.e. it degrades to exactly the text row
 * this replaced, rather than to a line of broken-image boxes.
 *
 * The web-side social row in ConferenceDetailClient currently draws Facebook
 * with a Globe, TikTok with a Music note and WhatsApp with a MessageCircle —
 * lucide dropped its brand icons, and those stand-ins were never replaced.
 * These are proper marks; the web row is worth bringing in line separately.
 */
function socialLinks(conference: EmailRenderConference): { label: string; url: string; icon: string }[] {
  const pairs: [string, string, string | null | undefined][] = [
    ['Instagram', 'instagram', conference.instagram_url],
    ['Facebook', 'facebook', conference.facebook_url],
    ['TikTok', 'tiktok', conference.tiktok_url],
    ['WhatsApp', 'whatsapp', conference.whatsapp_url],
    ['Website', 'website', conference.website_url],
  ];
  const out: { label: string; url: string; icon: string }[] = [];
  for (const [label, icon, url] of pairs) {
    if (url && /^https?:\/\//i.test(url)) out.push({ label, url, icon });
  }
  return out;
}

function renderHeader(
  conference: EmailRenderConference,
  siteUrl: string,
  theme: Required<EmailTheme>,
  transactional: boolean
): string {
  const bannerAbs = absolutizeUrl(conference.banner_url, siteUrl);
  const logoAbs = theme.showLogo ? absolutizeUrl(conference.logo_url, siteUrl) : null;
  // A transactional email never shows the banner: its identity mark already
  // sits above the card, and the two together were the double header.
  const useBanner = !transactional && theme.headerStyle === 'banner' && !!bannerAbs;

  // ...and it shows no in-card identity row either, for the same reason.
  if (transactional) {
    return `<tr><td class="e-spine" style="height:4px;line-height:4px;font-size:0;background-color:${theme.accentColor};">&nbsp;</td></tr>`;
  }
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
  media?: RenderEmailHtmlArgs['media'],
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
      // BOLD SANS, not serif. The serif was the wrong read of mymun: look at
      // their "Your assignment comes next" and it is a heavy geometric sans in
      // their brand navy, with the body in the same family beneath it. A serif
      // headline over a sans body reads as a newsletter masthead, which is the
      // opposite of what a transactional email wants.
      //
      // 29px against 16px body. Weight 800, not `bold` (700) — the whole
      // effect depends on the headline being visibly heavier than the bolded
      // words inside the body copy, or it stops being a headline.
      //
      // Coloured with the accent, through `readableOn`: accentColor is
      // organiser-settable and production already holds a pale blue (#DCEAF5),
      // and a headline is the last thing that may be unreadable.
      heading: {
        style: `padding:2px 0 14px 0;font-family:${SANS};font-size:29px;line-height:1.2;font-weight:800;letter-spacing:-0.021em;color:${readableOn(theme.accentColor, CARD_BG)};`,
        gap: 8,
      },
      small: {
        style: `padding:0 0 18px 0;font-family:${SANS};font-size:13px;line-height:1.65;color:${MUTED};`,
        gap: 10,
      },
    };
    // The heading owns its colour (the accent), so it takes `e-accent` and is
    // brightened in dark mode rather than being flattened to body ink.
    const inkClass = variant === 'small' ? 'e-muted' : variant === 'heading' ? 'e-accent' : 'e-ink';
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

  if (block.type === 'facts') {
    // The flag comes from twemoji as a PNG, not the SVG the web app uses:
    // Outlook and several Android clients will not render an SVG <img> at all,
    // and a flag that silently disappears is worse than none. Same CDN the
    // share-card route already fetches from.
    const flagUrl = (code?: string | null): string | null => {
      const cc = (code ?? '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc)) return null;
      const pts = [...cc].map(ch => (ch.codePointAt(0)! + 0x1f1a5).toString(16)).join('-');
      return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${pts}.png`;
    };
    const iconFor = (from?: 'country' | 'committee'): string | null => {
      if (from === 'country') return flagUrl(media?.countryCode);
      if (from === 'committee') return absolutizeUrl(media?.committeeEmblem ?? null, getSiteUrl());
      return null;
    };

    const items = block.items
      .map(i => ({ label: i.label.trim(), value: resolveTokens(i.value, ctx).trim(), icon: iconFor(i.iconFrom) }))
      .filter(i => i.label && i.value);
    if (!items.length) return '';

    /* A panel of labelled rows, not a sentence. This is the mymun idea: their
       newsletter answers Where? / When? / Fee? / Deadline? as fields, and a
       reader gets every answer without reading prose. Our allocation email put
       a delegate's committee and country mid-paragraph, where they are easy to
       skim past and impossible to find again three weeks later.

       Two columns via a real table with a fixed-width label cell — Outlook has
       no grid, no flexbox and unreliable percentage widths on divs, so a table
       is the only layout that holds. Rows are separated by a hairline rather
       than by margins, for the same reason. */
    const rows = items
      .map((i, idx) => {
        const border = idx === 0 ? '' : `border-top:1px solid ${HAIRLINE};`;
        return `<tr>
          <td class="e-hair e-muted" width="150" style="width:150px;${border}padding:${idx === 0 ? '0' : '11px'} 14px 11px 0;font-family:${SANS};font-size:11px;line-height:1.4;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};vertical-align:top;">
            ${escapeHtml(i.label)}
          </td>
          <td class="e-hair e-ink" style="${border}padding:${idx === 0 ? '0' : '11px'} 0 11px 0;font-family:${SANS};font-size:16px;line-height:1.45;font-weight:bold;color:${INK};vertical-align:middle;">
            ${i.icon
              ? `<img src="${escapeHtml(i.icon)}" width="24" height="24" alt="" style="width:24px;height:24px;object-fit:contain;border-radius:4px;vertical-align:middle;margin-right:9px;" />`
              : ''}<span style="vertical-align:middle;">${escapeHtml(i.value)}</span>
          </td>
        </tr>`;
      })
      .join('');

    return `<tr><td class="email-padding" style="padding:2px 0 24px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-panel" style="background-color:${CHIP_BG};border-radius:10px;">
        <tr><td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        </td></tr>
      </table>
    </td></tr>`;
  }

  const url = resolveButtonUrl(block, conference, { chairInviteToken, organizerInviteToken, importClaimToken });
  const label = block.label?.trim() || BUTTON_FALLBACK_LABEL[block.destination] || 'Open link';
  const btnBg = theme.buttonColor;
  const btnInk = inkOn(btnBg);
  // Bulletproof CTA: background-colour, border-radius and padding all live on
  // the <td>, never on the <a> — Outlook (and older Gmail app builds) drop
  // padding/border-radius declared only on an inline <a>, silently collapsing
  // the button into a bare underlined link.
  //
  // No border any more. It existed to give the old pale-gold fill an edge it
  // could not give itself; on a solid fill it only muddies the shape. Centred,
  // like mymun's — a centred button at roughly a third of the way down is the
  // single most-clicked arrangement in transactional mail, and left-aligning it
  // let it sit in the body's optical rhythm and read as another paragraph.
  // A gentle vertical gradient, light at the top. Three layers on purpose:
  // `bgcolor` for Outlook (which ignores CSS backgrounds entirely),
  // `background-color` as the base every client understands, and
  // `background-image` on top for the ones that render gradients. Any client
  // that drops the gradient still gets the solid brand colour, so this can
  // never degrade below where it was.
  const btnTop = mixHex(btnBg, '#FFFFFF', 0.16);
  return `<tr><td align="center" style="padding:14px 0 30px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="${btnBg}" class="e-btn" style="background-color:${btnBg};background-image:linear-gradient(180deg, ${btnTop} 0%, ${btnBg} 100%);border-radius:10px;">
        <a href="${escapeHtml(url)}" target="_blank" class="e-btn-a"
           style="display:block;padding:17px 40px;font-family:${SANS};font-size:16px;font-weight:bold;line-height:20px;letter-spacing:0.01em;color:${btnInk};text-decoration:none;">
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
  const paragraphs = blocks.filter(
    (b): b is Extract<EmailBlock, { type: 'paragraph' }> => b.type === 'paragraph' && !!b.content.trim(),
  );
  if (paragraphs.length === 0) return '';

  // A bullet list makes a terrible preheader: it reads "- one - two - three"
  // in the one line Gmail shows beside the subject. Prefer the first paragraph
  // that ISN'T a list, and only fall back to a list if that is all there is —
  // in which case the markers are stripped and the items joined with a middot,
  // which at least reads as a sentence fragment rather than as raw markup.
  const isList = (c: string) => {
    const lines = c.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.length >= 2 && lines.every(l => /^[-•]\s+/.test(l));
  };

  // Skip the heading too. The preheader sits directly beside the subject in
  // the inbox, and a heading is usually a restatement of it — "Your allocation
  // is ready" next to "Your committee allocation for SISMUN 2026" spends the
  // one line of extra context saying the same thing twice. The first body
  // paragraph is what actually adds something.
  const body = paragraphs.filter(p => (p.variant ?? 'body') !== 'heading');
  const pool = body.length > 0 ? body : paragraphs;
  const chosen = pool.find(p => !isList(p.content)) ?? pool[0];
  const raw = stripInlineMarks(resolveTokens(chosen.content, ctx)).replace(/⚠(\w+)⚠/g, '');
  const flat = (isList(chosen.content)
    ? raw.split('\n').map(l => l.trim().replace(/^[-•]\s+/, '')).filter(Boolean).join(' · ')
    : raw
  )
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
  variant = 'broadcast',
  media,
}: RenderEmailHtmlArgs): string {
  const siteUrl = getSiteUrl();
  const transactional = variant === 'transactional';
  const theme = resolveEmailTheme(conference.email_theme);
  const linkColor = readableOn(theme.accentColor, CARD_BG);
  const bodyRows = blocks
    .map(b => renderBlock(b, conference, ctx, theme, linkColor, media, chairInviteToken, organizerInviteToken, importClaimToken))
    .join('');
  const footerLine = theme.footerLine.trim();
  const preheader = buildPreheader(blocks, ctx);
  const prefsUrl = `${siteUrl}/account/profile`;
  const logoAbs = theme.showLogo ? absolutizeUrl(conference.logo_url, siteUrl) : null;

  // "Sent to you by X through Gavelling" + the preference links. Identical in
  // both variants; only where it sits differs.
  /* The Gavelling mark, so the footer is signed rather than just worded.
     /gavelling-mark.png is the SQUARE mark and is already live in production —
     deliberately not one of the new public/email/* icons, which only exist
     after a deploy. See public/README.md on never using the wide lockup here:
     a small square render of GavellingLogo.png crops to a meaningless
     crescent. */
  const brandMark =
    `<img src="${escapeHtml(siteUrl)}/gavelling-mark.png" width="26" height="26" alt="Gavelling" ` +
    `style="display:block;width:26px;height:26px;border:0;margin:0 auto 9px;opacity:0.75;" />`;

  const sentBy =
    `Sent to you by ${escapeHtml(conference.acronym || conference.full_name)} through Gavelling, the platform it runs on.` +
    `<br><a href="${escapeHtml(prefsUrl)}" target="_blank" style="color:${MUTED};text-decoration:underline;">Email preferences</a>` +
    `&nbsp;&middot;&nbsp;<a href="${escapeHtml(siteUrl)}" target="_blank" style="color:${MUTED};text-decoration:underline;">gavelling.com</a>`;

  const socials = socialLinks(conference);
  // A table, not inline-blocks: Outlook collapses inline-block spacing, and a
  // one-row table with padded cells is the only layout that holds everywhere.
  const socialRow = socials.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:11px;"><tr>` +
      socials
        .map(x => `<td style="padding:0 7px;"><a href="${escapeHtml(x.url)}" target="_blank" style="color:${MUTED};text-decoration:none;"><img src="${escapeHtml(siteUrl)}/email/${x.icon}.png" width="22" height="22" alt="${escapeHtml(x.label)}" style="display:block;width:22px;height:22px;border:0;" /></a></td>`)
        .join('') +
      `</tr></table>`
    : '';

  /* The registered-company lines. companyDetails.ts has held verified
     Companies House values since August and emailHtml.ts has never imported
     it — only the web footer did — so every email we have ever sent carried no
     legal entity and no registered address. companyLegalLines() returns []
     while a value is unverified, so nothing invented can ship. */
  const legal = companyLegalLines();
  const legalRow = legal.length
    ? `<div class="e-muted" style="font-family:${SANS};font-size:11px;line-height:1.65;color:${MUTED};padding-top:12px;">` +
      legal.map(l => escapeHtml(l)).join('<br>') +
      `</div>`
    : '';

  // Broadcast: footer stays a band inside the card, as it was.
  const cardFooter = `<tr>
            <td class="email-padding e-footer e-hair" style="background-color:${FOOTER_BG};border-top:1px solid ${HAIRLINE};padding:26px 40px 28px 40px;">
              <div class="e-soft" style="font-family:${SANS};font-size:13px;line-height:1.6;font-weight:bold;color:${INK_SOFT};">${escapeHtml(conference.full_name)}</div>
              <div class="e-muted" style="font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};padding-top:2px;">
                <a href="mailto:${escapeHtml(conference.contact_email)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(conference.contact_email)}</a>
              </div>
              ${socialRow}
              <div class="e-muted" style="font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};padding-top:14px;">${sentBy}</div>
              ${legalRow}
            </td>
          </tr>`;

  // Transactional: footer sits on the page field BELOW the card, centred.
  // Off the card it stops competing with the message, and the legal block can
  // be as dense as it needs to be without weighing down the content.
  const fieldFooter = `<tr>
            <td align="center" class="email-padding" style="padding:22px 24px 0 24px;">
              <div class="e-soft" style="font-family:${SANS};font-size:14px;line-height:1.6;font-weight:800;color:${INK_SOFT};">${escapeHtml(conference.full_name)}</div>
              <div class="e-muted" style="font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};padding-top:2px;">
                <a href="mailto:${escapeHtml(conference.contact_email)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(conference.contact_email)}</a>
              </div>
              ${socialRow}
              <div class="e-muted" style="font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};padding-top:18px;border-top:1px solid ${HAIRLINE};margin-top:18px;">${brandMark}${sentBy}</div>
              ${legalRow}
            </td>
          </tr>`;

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
    .e-chip { background-color: ${D_CHIP_BG} !important; box-shadow: 0 0 0 1px rgba(255,255,255,0.22) !important; }
    .e-link { color: ${mixHex(theme.accentColor, '#FFFFFF', 0.55)} !important; }
    /* The CTA is now a solid brand colour, and forest on a near-black card is
       about 1.2:1 — the button would disappear exactly where the old pale gold
       used to work. Lifted toward the light, with ink to match. Any future
       change to a solid dark button needs this pair or dark mode regresses. */
    .e-btn { background-color: ${mixHex(theme.buttonColor, '#FFFFFF', 0.30)} !important; }
    .e-btn-a { color: ${inkOn(mixHex(theme.buttonColor, '#FFFFFF', 0.30))} !important; }
    .e-accent, .e-accent div, .e-accent strong { color: ${mixHex(theme.accentColor, '#FFFFFF', 0.62)} !important; }
    .e-rule { background-color: ${mixHex(theme.accentColor, '#FFFFFF', 0.40)} !important; }
    .e-panel { background-color: #1B1811 !important; }
  }
  [data-ogsc] .e-page { background-color: ${D_PAGE_BG} !important; }
  [data-ogsc] .e-card { background-color: ${D_CARD_BG} !important; }
  [data-ogsc] .e-ink, [data-ogsc] .e-ink div { color: ${D_INK} !important; }
  [data-ogsc] .e-muted, [data-ogsc] .e-muted div { color: ${D_MUTED} !important; }
  [data-ogsc] .e-footer { background-color: ${D_FOOTER_BG} !important; }
  [data-ogsc] .e-btn { background-color: ${mixHex(theme.buttonColor, '#FFFFFF', 0.30)} !important; }
  [data-ogsc] .e-btn-a { color: ${inkOn(mixHex(theme.buttonColor, '#FFFFFF', 0.30))} !important; }
  [data-ogsc] .e-accent, [data-ogsc] .e-accent div { color: ${mixHex(theme.accentColor, '#FFFFFF', 0.62)} !important; }
  [data-ogsc] .e-panel { background-color: #1B1811 !important; }`;

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
      <td align="center" style="padding:${transactional ? '30px' : '32px'} 16px 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="width:600px;max-width:600px;">
          ${transactional ? renderAboveCardIdentity(conference, logoAbs) : ''}
          <tr><td style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-card e-hair"
                   style="background-color:${CARD_BG};border:1px solid ${HAIRLINE};border-radius:${transactional ? 16 : 14}px;overflow:hidden;">
              ${renderHeader(conference, siteUrl, theme, transactional)}
              <tr>
                <td class="email-padding e-card" style="background-color:${CARD_BG};padding:${transactional ? '44px 44px 10px 44px' : '34px 40px 8px 40px'};">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${bodyRows}
                    ${transactional ? renderReplyPanel(conference, theme.accentColor) : ''}
                  </table>
                </td>
              </tr>
              ${footerLine ? `<tr>
                <td class="email-padding e-card e-soft" style="background-color:${CARD_BG};padding:${transactional ? '18px 44px 26px 44px' : '6px 40px 24px 40px'};font-family:${SANS};font-size:14px;line-height:1.65;color:${INK_SOFT};">
                  ${escapeHtml(footerLine).replace(/\n/g, '<br>')}
                </td>
              </tr>` : `<tr><td class="e-card" style="background-color:${CARD_BG};height:${transactional ? 18 : 0}px;line-height:0;font-size:0;">&nbsp;</td></tr>`}
              ${transactional ? '' : cardFooter}
            </table>
          </td></tr>
          ${transactional ? fieldFooter : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
