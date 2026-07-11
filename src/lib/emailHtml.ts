// Branded, email-safe HTML renderer for the composer preview and the outbox.
// Table-based layout only (no flexbox/grid) so it degrades correctly in
// Outlook; all styling is inlined since many clients (Gmail webmail
// included) strip <style> tags in the body.

import { resolveTokens, splitResolvedText, type EmailTokenContext } from './emailTokens';
import { type EmailBlock, resolveButtonUrl, getSiteUrl } from './emailBlocks';

export interface EmailRenderConference {
  slug: string;
  full_name: string;
  acronym: string;
  banner_url: string | null;
  logo_url: string | null;
  contact_email: string;
}

export interface RenderEmailHtmlArgs {
  blocks: EmailBlock[];
  conference: EmailRenderConference;
  ctx: EmailTokenContext;
  /** Per-invite token for a 'chair_invite_accept' button block, if one is present. */
  chairInviteToken?: string;
}

const FONT_STACK = "Georgia, 'Times New Roman', Arial, sans-serif";
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const CREAM = '#FAF8F3';
const INK = '#2A2118';
const MUTED = '#9A8A78';

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

function renderHeader(conference: EmailRenderConference): string {
  const hasLogo = !!conference.logo_url;
  const hasBanner = !!conference.banner_url;

  const logoCell = hasLogo
    ? `<td width="64" valign="middle" align="center" style="background-color:${hasBanner ? '#FFFFFF' : FOREST};padding:0 16px;">
         <img src="${escapeHtml(conference.logo_url!)}" width="44" height="44" alt=""
              style="display:block;width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ${GOLD};" />
       </td>`
    : '';

  const mainCell = hasBanner
    ? `<td style="padding:0;">
         <img src="${escapeHtml(conference.banner_url!)}" width="${hasLogo ? 536 : 600}" alt="${escapeHtml(conference.full_name)}"
              style="display:block;width:100%;height:auto;" />
       </td>`
    : `<td align="center" style="background-color:${FOREST};padding:34px 20px;">
         <span style="font-family:${FONT_STACK};font-size:26px;font-weight:bold;letter-spacing:0.08em;color:${GOLD};">
           ${escapeHtml(conference.acronym)}
         </span>
       </td>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${mainCell}${logoCell}</tr></table>`;
}

function renderBlock(block: EmailBlock, conference: EmailRenderConference, ctx: EmailTokenContext, chairInviteToken?: string): string {
  if (block.type === 'paragraph') {
    if (!block.content.trim()) return '';
    return `<tr><td class="email-padding" style="padding:0 0 20px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.65;color:${INK};">
      ${renderTokenizedHtml(block.content, ctx)}
    </td></tr>`;
  }
  const url = resolveButtonUrl(block, conference, { chairInviteToken });
  return `<tr><td align="center" style="padding:8px 0 24px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="${GOLD}" style="border-radius:8px;">
        <a href="${escapeHtml(url)}" target="_blank"
           style="display:inline-block;padding:14px 34px;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${FOREST};text-decoration:none;border-radius:8px;">
          ${escapeHtml(block.label || 'Learn more')}
        </a>
      </td>
    </tr></table>
  </td></tr>`;
}

/** Renders a complete, standalone HTML email document from the block model. */
export function renderEmailHtml({ blocks, conference, ctx, chairInviteToken }: RenderEmailHtmlArgs): string {
  const siteUrl = getSiteUrl();
  const bodyRows = blocks.map(b => renderBlock(b, conference, ctx, chairInviteToken)).join('');

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
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container"
               style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:14px;overflow:hidden;">
          <tr><td>${renderHeader(conference)}</td></tr>
          <tr>
            <td class="email-padding" style="padding:32px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${bodyRows}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="email-padding" style="background-color:#F0EDE6;padding:22px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${MUTED};">
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
