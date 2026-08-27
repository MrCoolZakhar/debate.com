// Branded, email-safe HTML renderer for the composer preview and the outbox.
// Table-based layout only (no flexbox/grid) so it degrades correctly in
// Outlook; all styling is inlined since many clients (Gmail webmail
// included) strip <style> tags in the body. Rewritten against real-inbox
// Gmail failures: bulletproof (table-cell) buttons, every image/link
// absolutized against NEXT_PUBLIC_SITE_URL (relative preset paths like
// /banners/preset-1.jpg have no origin to resolve against inside a mail
// client), and a fixed-height cover-cropped banner band.

import { resolveTokens, splitResolvedText, type EmailTokenContext } from './emailTokens';
import { type EmailBlock, resolveButtonUrl, absolutizeUrl, getSiteUrl } from './emailBlocks';

// ── Design theme ─────────────────────────────────────────────────────────────
// Persisted at conferences.email_theme (jsonb, default {}). Every field is
// optional — resolveEmailTheme fills gaps with the current look, so existing
// conferences (and every send path that doesn't thread a theme through yet)
// render exactly as before with zero content migration.

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

const FONT_STACK = "Georgia, 'Times New Roman', Arial, sans-serif";
const SANS_STACK = "Arial, Helvetica, sans-serif";
const INK = '#2A2118';
const MUTED = '#9A8A78';
const CREAM = '#FAF8F3';
const BUTTON_INK = '#1B3828';
const BANNER_HEIGHT = 180;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Resolves tokens, escapes the result, and wraps unresolved ⚠token⚠ markers in an amber highlight. */
function renderTokenizedHtml(raw: string, ctx: EmailTokenContext): string {
  const resolved = resolveTokens(raw, ctx);
  return splitResolvedText(resolved)
    .map(seg => {
      const html = escapeHtml(seg.text).replace(/\n/g, '<br>');
      if (!seg.unresolved) return html;
      return `<span style="background-color:#F4E9C8;color:#8A6614;padding:0 3px;border-radius:3px;font-weight:600;">${html}</span>`;
    })
    .join('');
}

function renderHeader(conference: EmailRenderConference, siteUrl: string, theme: Required<EmailTheme>): string {
  const bannerAbs = absolutizeUrl(conference.banner_url, siteUrl);
  const logoAbs = theme.showLogo ? absolutizeUrl(conference.logo_url, siteUrl) : null;
  const useBanner = theme.headerStyle === 'banner' && !!bannerAbs;

  // 44x44 circular + object-fit:cover — i.e. this cell CROPS its image to a
  // square. `logo_url` is a per-conference user upload, which is what that
  // treatment is for. NEVER default it to a Gavelling wide lockup
  // (/GavellingLogo.png, /Conferences.webp, /GavellingSessionsApp.webp): a
  // square crop of those keeps the mark plus the left bowl of the "G", which
  // reads as a crescent bitten out of the logo. If a Gavelling fallback is ever
  // wanted here it must be the square mark, `${siteUrl}/gavelling-mark.png`.
  // See public/README.md.
  const logoCell = logoAbs
    ? `<td width="64" valign="middle" align="center" style="background-color:${useBanner ? '#FFFFFF' : theme.accentColor};padding:0 16px;">
         <img src="${escapeHtml(logoAbs)}" width="44" height="44" alt="${escapeHtml(conference.acronym)} logo"
              style="display:block;width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ${theme.buttonColor};" />
       </td>`
    : '';

  // Cover-crop via object-fit on a plain <img> — supported by Gmail (web +
  // app), Apple Mail, Yahoo, and Outlook.com webmail. Outlook desktop
  // ignores object-fit and stretches instead of cropping; that graceful
  // degradation (still a fixed-height, non-broken image) is the deliberate
  // trade-off called for here rather than a VML background-fill.
  const mainCell = useBanner
    ? `<td style="padding:0;">
         <img src="${escapeHtml(bannerAbs!)}" width="${logoAbs ? 536 : 600}" height="${BANNER_HEIGHT}" alt="${escapeHtml(conference.full_name)}"
              style="display:block;width:100%;height:${BANNER_HEIGHT}px;object-fit:cover;object-position:center;" />
       </td>`
    : `<td align="center" style="background-color:${theme.accentColor};padding:34px 20px;">
         <span style="font-family:${FONT_STACK};font-size:26px;font-weight:bold;letter-spacing:0.08em;color:${theme.buttonColor};">
           ${escapeHtml(conference.acronym)}
         </span>
       </td>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${mainCell}${logoCell}</tr></table>`;
}

function renderBlock(
  block: EmailBlock,
  conference: EmailRenderConference,
  ctx: EmailTokenContext,
  theme: Required<EmailTheme>,
  chairInviteToken?: string,
  organizerInviteToken?: string,
  importClaimToken?: string
): string {
  if (block.type === 'paragraph') {
    if (!block.content.trim()) return '';
    return `<tr><td class="email-padding" style="padding:0 0 18px 0;font-family:${FONT_STACK};font-size:17px;line-height:1.6;color:${INK};">
      ${renderTokenizedHtml(block.content, ctx)}
    </td></tr>`;
  }
  const url = resolveButtonUrl(block, conference, { chairInviteToken, organizerInviteToken, importClaimToken });
  // Bulletproof CTA: background-color + border-radius + padding all live on
  // the <td>, not the <a> — Outlook (and older Gmail app builds) can drop
  // padding/border-radius declared only on an inline <a>, silently
  // collapsing the button into a bare underlined link.
  return `<tr><td align="center" style="padding:6px 0 22px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="${theme.buttonColor}" style="background-color:${theme.buttonColor};border-radius:8px;padding:14px 34px;">
        <a href="${escapeHtml(url)}" target="_blank"
           style="display:block;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BUTTON_INK};text-decoration:none;">
          ${escapeHtml(block.label || 'Learn more')}
        </a>
      </td>
    </tr></table>
  </td></tr>`;
}

/** Renders a complete, standalone HTML email document from the block model. */
export function renderEmailHtml({ blocks, conference, ctx, chairInviteToken, organizerInviteToken, importClaimToken }: RenderEmailHtmlArgs): string {
  const siteUrl = getSiteUrl();
  const theme = resolveEmailTheme(conference.email_theme);
  const bodyRows = blocks.map(b => renderBlock(b, conference, ctx, theme, chairInviteToken, organizerInviteToken, importClaimToken)).join('');
  const footerLine = theme.footerLine.trim();

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(conference.full_name)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body, table, td { font-family: ${FONT_STACK}; }
  img { border: 0; outline: none; -ms-interpolation-mode: bicubic; }
  a { color: inherit; }
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; }
    .email-padding { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container"
               style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:14px;overflow:hidden;">
          <tr><td>${renderHeader(conference, siteUrl, theme)}</td></tr>
          <tr>
            <td class="email-padding" style="padding:30px 40px 6px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${bodyRows}
              </table>
            </td>
          </tr>
          ${footerLine ? `<tr>
            <td align="center" class="email-padding" style="padding:0 40px;font-family:${SANS_STACK};font-size:12px;line-height:1.6;color:${INK};">
              ${escapeHtml(footerLine)}
            </td>
          </tr>` : ''}
          <tr>
            <td align="center" class="email-padding" style="background-color:#F0EDE6;padding:20px 40px;font-family:${SANS_STACK};font-size:12px;line-height:1.7;color:${MUTED};">
              ${escapeHtml(conference.full_name)} &middot; <a href="mailto:${escapeHtml(conference.contact_email)}" style="color:${MUTED};">${escapeHtml(conference.contact_email)}</a>
              <br>
              <a href="${escapeHtml(siteUrl)}" target="_blank" style="color:${MUTED};text-decoration:underline;">Sent via Gavelling</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
