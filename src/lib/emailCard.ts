// The card email design (approved by the owner, 18 Sep 2026).
//
// One white card on an ivory page: the GAVELLING wordmark, a centred headline,
// a short greeting, then a "pass" (a solid forest hero carrying the conference
// logo, name, place, a status pill and the dates, with the facts beneath it as
// labelled rows), one button and a sign-off. The SQL twin is
// public.gavelling_email_html_v2 (every email the database writes), so the two
// renderers produce the same card.
//
// SWITCH: EMAIL_CARD_DESIGN below (or NEXT_PUBLIC_EMAIL_CARD_DESIGN=on). Off,
// renderEmailHtml renders the classic design exactly as before. The DB side is
// switched separately (see scratchpad cardv2/99_switch_on.sql in the handover);
// switch the DB FIRST, because its insert trigger is what turns the footer
// unsubscribe mark into each recipient's one-click link.
//
// Mobile and dark-mode rules this renderer keeps (learned on real phones):
//  1. No background images anywhere. Gmail's app dark mode inverts colours but
//     never images, so a gradient hero stayed dark while its gold text turned
//     dark too. Solid bgcolor only, so ground and ink invert together.
//  2. Gavelling artwork uses PNG tiles with the light disc baked in. An
//     organiser's uploaded logo sits on a CSS tile that the dark-mode rules keep
//     light (e-tile); flags do too and survive either way.
//  3. Fluid width: tables are 100% with max-width 600, and an Outlook-only
//     ghost table holds 600px on desktop Outlook. The Gmail app for non-Google
//     accounts strips <style>, so nothing may depend on the media query.
//  4. One button. Any further button in a template becomes a quiet text link.
//
// Organiser templates are untouched in meaning: merge fields resolve exactly as
// before (renderParagraphChunks, the same ⚠field⚠ highlight), a facts row whose
// value is only unresolved markers is dropped exactly as before, and nothing
// here adds text that could carry a marker, so emailUnresolved.ts (the pre-send
// hold) still describes what the reader will see.

import { resolveTokens, UNRESOLVED_MARKER_PATTERN } from './emailTokens';
import { companyLegalLines } from './companyDetails';
import { resolveButtonUrl, absolutizeUrl, getSiteUrl, type EmailBlock } from './emailBlocks';
import {
  type RenderEmailHtmlArgs,
  resolveEmailTheme,
  escapeHtml,
  renderParagraphChunks,
  renderMarkedHtml,
  shortName,
  emailImageUrl,
  socialLinks,
  buildPreheader,
  BUTTON_FALLBACK_LABEL,
} from './emailHtml';

/** THE switch for app-rendered email. Flip to true (or set the env var) to
 *  send every app email in the card design. */
export const EMAIL_CARD_DESIGN = false;

export function emailCardDesignEnabled(): boolean {
  return EMAIL_CARD_DESIGN || process.env.NEXT_PUBLIC_EMAIL_CARD_DESIGN === 'on';
}

/** A working link on its own (the profile page, where a signed-in reader can
 *  switch email off). The email_outbox insert trigger (v2) replaces this exact
 *  string with the recipient's tokenised one-click unsubscribe link. Keep it
 *  byte-identical to public.gavelling_email_unsub_mark(). */
export const UNSUBSCRIBE_MARK = 'https://gavelling.com/account/profile?unsubscribe=1';

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const INK = '#241E17';
const INK_SOFT = '#574B40';
const MUTED = '#6E6456';
const LABEL = '#226B49';
const LINK = '#1B3828';

/** A picture of the real product, shown under the pass on our own default copy
 *  where seeing the screen answers "what happens next". Captured from the app
 *  with fictional sample data only. */
export interface EmailSnapshot { url: string; alt: string; width: number; caption?: string }

const SNAP = 'https://luruhkwrgisytejswlas.supabase.co/storage/v1/object/public/session-documents/email-assets/snapshots/';

export const EMAIL_SNAPSHOTS = {
  chairConsole: {
    url: `${SNAP}chair-console-v1.jpg`, width: 528,
    alt: 'The Gavelling chair console: the speakers list across the top, France speaking with 1:05 left, and the room roster down the side.',
    caption: 'Your chair console: speakers list, clock, motions and voting on one screen.',
  } as EmailSnapshot | null,
  delegatePhone: {
    url: `${SNAP}delegate-phone-v1.jpg`, width: 300,
    alt: 'A delegate view on a phone: Kenya is first in the queue, with the speakers list and a Submit document button.',
    caption: 'What you see on your phone during the session.',
  } as EmailSnapshot | null,
  organiserDashboard: {
    url: `${SNAP}organiser-dashboard-v1.jpg`, width: 528,
    alt: 'The organiser dashboard: set-up priorities, and applicants against target with payments collected.',
    caption: 'The organiser dashboard you are being invited to.',
  } as EmailSnapshot | null,
  conferencePage: null as EmailSnapshot | null,
};

/** Per event: the status pill on the pass, and the snapshot (default copy only). */
const EVENT_CARD: Record<string, { pill: string; snapshot?: keyof typeof EMAIL_SNAPSHOTS }> = {
  application_received: { pill: 'Application received' },
  draft_reminder: { pill: 'Draft saved' },
  application_accepted: { pill: 'Accepted', snapshot: 'conferencePage' },
  application_rejected: { pill: 'Application update' },
  payment_available: { pill: 'Payment open' },
  payment_received: { pill: 'Paid' },
  fee_waived: { pill: 'Fee waived' },
  aid_approved: { pill: 'Aid approved' },
  aid_denied: { pill: 'Aid update' },
  allocation_assigned: { pill: 'Allocated', snapshot: 'delegatePhone' },
  allocation_changed: { pill: 'Allocation changed' },
  allocation_removed: { pill: 'Allocation removed' },
  pledge_received: { pill: 'Pledge received' },
  added_to_delegation: { pill: 'In a delegation' },
  removed_from_delegation: { pill: 'Delegation update' },
  spot_received: { pill: 'Spot confirmed' },
  spot_lost: { pill: 'Spot update' },
  not_attending: { pill: 'Not attending' },
  attendance_restored: { pill: 'Attending' },
  documents_published: { pill: 'Study guide out' },
  position_paper_due: { pill: 'Paper due' },
  chair_assigned: { pill: 'Chair', snapshot: 'chairConsole' },
  committee_chair_invite: { pill: 'Chair invitation', snapshot: 'chairConsole' },
  organizer_invite: { pill: 'Team invitation', snapshot: 'organiserDashboard' },
  session_chair_invite: { pill: 'Your room is ready', snapshot: 'chairConsole' },
  session_join_invite: { pill: 'Join the session', snapshot: 'delegatePhone' },
  request_reply: { pill: 'Reply' },
  request_received: { pill: 'New question' },
  delegation_swap: { pill: 'Allocation swapped' },
  import_join_invite: { pill: 'Registration waiting' },
  awards_open: { pill: 'Awards open' },
  award_received: { pill: 'Verified' },
  chair_invite_reminder_1: { pill: 'Chair invitation', snapshot: 'chairConsole' },
  chair_invite_reminder_2: { pill: 'Chair invitation', snapshot: 'chairConsole' },
  chair_invite_reminder_3: { pill: 'Chair invitation' },
  organizer_invite_reminder_1: { pill: 'Team invitation' },
  organizer_invite_reminder_2: { pill: 'Team invitation' },
  organizer_invite_reminder_3: { pill: 'Team invitation' },
  import_claim_reminder_1: { pill: 'Registration waiting' },
  import_claim_reminder_2: { pill: 'Registration waiting' },
  import_claim_reminder_3: { pill: 'Registration waiting' },
};

export function emailCardFor(event?: string, isDefault?: boolean): { pill: string | null; snapshot: EmailSnapshot | null } {
  const e = event ? EVENT_CARD[event] : undefined;
  return {
    pill: e?.pill ?? null,
    snapshot: isDefault && e?.snapshot ? EMAIL_SNAPSHOTS[e.snapshot] : null,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "19 to 21 Feb 2027". Mirrors public.gavelling_email_dates_label. */
export function emailDatesLabel(start: string | null | undefined, end: string | null | undefined, tbd?: boolean | null): string | null {
  if (tbd) return 'Dates to be confirmed';
  const p = (s: string | null | undefined) => {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec((s ?? '').trim());
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  };
  const a = p(start);
  if (!a) return null;
  const b = p(end);
  const full = (x: { y: number; m: number; d: number }) => `${x.d} ${MONTHS[x.m - 1]} ${x.y}`;
  if (!b || (b.y === a.y && b.m === a.m && b.d === a.d)) return full(a);
  if (a.y === b.y && a.m === b.m) return `${a.d} to ${full(b)}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} to ${full(b)}`;
  return `${full(a)} to ${full(b)}`;
}

function flagUrl(code?: string | null): string | null {
  const cc = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const pts = [...cc].map(ch => (ch.codePointAt(0)! + 0x1f1a5).toString(16)).join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${pts}.png`;
}

// ── Pieces (mirror scratchpad cardkit.py) ───────────────────────────────────

const row = (inner: string, pad: string, align = '') =>
  `<tr><td${align ? ` align="${align}"` : ''} class="e-pad" style="padding:${pad};">${inner}</td></tr>`;

function h1(text: string): string {
  return row(
    `<h1 class="e-h1 e-accent" style="margin:0;font-family:${SANS};font-size:27px;line-height:1.2;font-weight:700;letter-spacing:-0.015em;color:${FOREST};text-align:center;">${text}</h1>`,
    '12px 36px 0 36px', 'center');
}

function h2(text: string): string {
  return row(
    `<div class="e-accent" style="font-family:${SANS};font-size:20px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;color:${FOREST};">${text}</div>`,
    '18px 36px 0 36px');
}

function bodyCell(html: string, variant: 'body' | 'small'): string {
  const style = variant === 'small'
    ? `font-family:${SANS};font-size:13px;line-height:1.65;color:${MUTED};`
    : `font-family:${SANS};font-size:16px;line-height:1.6;color:${INK};`;
  return `<div class="${variant === 'small' ? 'e-muted' : 'e-ink'}" style="${style}">${html}</div>`;
}

function tileImage(url: string, alt: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td align="center" valign="middle" width="60" height="60" class="e-tile" bgcolor="#FFFFFF" style="width:60px;height:60px;background-color:#FFFFFF;border-radius:14px;line-height:0;font-size:0;">`
    + `<img src="${escapeHtml(url)}" width="44" height="44" alt="${escapeHtml(alt)}" style="display:block;width:44px;height:44px;border:0;margin:0 auto;object-fit:contain;font-family:${SANS};font-size:9px;line-height:1.2;color:${FOREST};" /></td></tr></table>`;
}

interface PassRow { label: string; valueHtml: string; icon?: { url: string; alt: string } | null }

function passCard(opts: { top?: number; pill: string | null; chip: string | null; logo: { url: string; alt: string; baked: boolean } | null; name: string; place: string | null; rows: PassRow[] }): string {
  const { pill, chip, logo, name, place, rows } = opts;
  const padTop = opts.top ?? 0;
  const body = rows.map((r, i) => {
    const top = i === 0 ? 18 : 8;
    const bottom = i === rows.length - 1 ? 16 : 8;
    const img = r.icon ? `<td valign="middle" width="60" style="width:60px;padding:${top}px 0 ${bottom}px 8px;">${tileImage(r.icon.url, r.icon.alt)}</td>` : '';
    return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${img}`
      + `<td valign="middle" style="padding:${top}px 8px ${bottom}px ${img ? 16 : 8}px;font-family:${SANS};">`
      + `<div class="e-label" style="font-size:12.5px;line-height:1.3;font-weight:bold;color:${LABEL};">${escapeHtml(r.label)}</div>`
      + `<div class="e-ink" style="font-size:19px;line-height:1.3;font-weight:bold;color:#1C1410;padding-top:2px;">${r.valueHtml}</div>`
      + `</td></tr></table></td></tr>`;
  }).join('');

  const logoCell = !logo ? '' : logo.baked
    ? `<td valign="middle" width="64" style="width:64px;line-height:0;font-size:0;"><img src="${escapeHtml(logo.url)}" width="64" height="64" alt="${escapeHtml(logo.alt)}" style="display:block;width:64px;height:64px;border:0;font-family:${SANS};font-size:10px;line-height:1.2;color:${GOLD};" /></td>`
    : `<td valign="middle" width="64" style="width:64px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
      + `<td align="center" valign="middle" width="64" height="64" class="e-tile" bgcolor="#FFFFFF" style="width:64px;height:64px;background-color:#FFFFFF;border-radius:32px;line-height:0;font-size:0;">`
      + `<img src="${escapeHtml(logo.url)}" width="52" height="52" alt="${escapeHtml(logo.alt)}" style="display:block;width:52px;height:52px;border:0;margin:0 auto;object-fit:contain;font-family:${SANS};font-size:9px;line-height:1.2;color:${FOREST};" /></td></tr></table></td>`;

  const topRow = pill || chip
    ? `<tr><td class="e-hero-pad" style="padding:13px 13px 0 13px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`
      + `<td align="left" valign="top">${pill
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#F0EBDD" style="background-color:#F0EBDD;border-radius:999px;padding:5px 12px 5px 10px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;color:#1C1410;white-space:nowrap;"><span style="color:#2A5A3C;font-size:13px;">&#9679;</span>&nbsp;${escapeHtml(pill)}</td></tr></table>`
        : '&nbsp;'}</td>`
      + `<td align="right" valign="top">${chip
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td style="border:1px solid #58775F;border-radius:999px;padding:4px 10px;font-family:${SANS};font-size:11.5px;line-height:15px;font-weight:600;color:#FAF8F3;white-space:nowrap;">${escapeHtml(chip)}</td></tr></table>`
        : '&nbsp;'}</td></tr></table></td></tr>`
    : '';

  return `<tr><td class="e-pad" style="padding:${padTop}px 36px 0 36px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-pass" bgcolor="#F0EBDD" style="background-color:#F0EBDD;border-radius:22px;">`
    + `<tr><td style="padding:12px 12px ${rows.length ? 4 : 12}px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FOREST}" style="background-color:${FOREST};border-radius:16px;">`
    + topRow
    + `<tr><td class="e-hero-pad" style="padding:${topRow ? 26 : 20}px 18px 20px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`
    + logoCell
    + `<td valign="middle" style="${logoCell ? 'padding-left:16px;' : ''}font-family:${SANS};">`
    + `<div class="e-hero-name" style="font-size:27px;line-height:1.08;font-weight:800;letter-spacing:-0.02em;color:${GOLD};">${escapeHtml(name)}</div>`
    + (place ? `<div style="font-size:11px;line-height:1.4;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#D9E0D9;padding-top:7px;">${escapeHtml(place)}</div>` : '')
    + `</td></tr></table></td></tr></table>`
    + (body ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>` : '')
    + `</td></tr></table></td></tr>`;
}

function primaryButton(label: string, url: string): string {
  const l = escapeHtml(label);
  const u = escapeHtml(url);
  return `<tr><td align="center" class="e-pad" style="padding:26px 36px 26px 36px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td align="center" bgcolor="${FOREST}" class="e-btn" style="background-color:${FOREST};border-radius:999px;">`
    + `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${u}" style="height:50px;v-text-anchor:middle;width:300px;" arcsize="50%" stroke="f" fillcolor="${FOREST}"><center style="color:${GOLD};font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;">${l}</center></v:roundrect><![endif]-->`
    + `<!--[if !mso]><!--><a href="${u}" target="_blank" style="display:inline-block;padding:15px 40px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:bold;color:${GOLD};text-decoration:none;border-radius:999px;">${l}</a><!--<![endif]-->`
    + `</td></tr></table></td></tr>`;
}

function secondaryLink(label: string, url: string): string {
  return row(
    `<a href="${escapeHtml(url)}" target="_blank" class="e-accent" style="font-family:${SANS};font-size:15px;line-height:1.5;font-weight:bold;color:${FOREST};text-decoration:underline;">${escapeHtml(label)}</a>`,
    '0 36px 22px 36px', 'center');
}

function snapshotRow(s: EmailSnapshot): string {
  return row(
    `<img src="${escapeHtml(s.url)}" width="${s.width}" alt="${escapeHtml(s.alt)}" style="display:block;width:100%;max-width:${s.width}px;height:auto;border:1px solid #DDD4C0;border-radius:14px;margin:0 auto;font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_SOFT};" />`
    + (s.caption ? `<div class="e-muted" style="font-family:${SANS};font-size:12.5px;line-height:1.5;color:${MUTED};padding-top:8px;text-align:center;">${escapeHtml(s.caption)}</div>` : ''),
    '26px 36px 0 36px', 'center');
}

const STYLE = `<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a{text-decoration:none;}
@media only screen and (max-width:620px){.e-pad{padding-left:20px !important;padding-right:20px !important;}.e-h1{font-size:24px !important;}.e-hero-name{font-size:23px !important;}.e-hero-pad{padding-left:14px !important;padding-right:14px !important;}}
@media (prefers-color-scheme: dark){body,.e-page{background-color:#0E0D0A !important;}.e-card{background-color:#232019 !important;border-color:#3A352A !important;}.e-pass{background-color:#1B1811 !important;}.e-hair{border-color:#3A352A !important;}.e-ink,.e-ink div,.e-ink span,.e-ink strong,.e-ink em{color:#F3EFE6 !important;}.e-soft{color:#CFC7B8 !important;}.e-muted,.e-muted a,.e-muted div{color:#A79D8D !important;}.e-accent{color:#D9E4DC !important;}.e-label{color:#8FC3A0 !important;}.e-tile{background-color:#F4F1EA !important;}.e-link{color:#BFD3C6 !important;}.e-btn{background-color:#2F5A40 !important;}}
[data-ogsc] .e-page{background-color:#0E0D0A !important;}[data-ogsc] .e-card{background-color:#232019 !important;}[data-ogsc] .e-pass{background-color:#1B1811 !important;}[data-ogsc] .e-ink,[data-ogsc] .e-ink div,[data-ogsc] .e-ink span,[data-ogsc] .e-ink strong{color:#F3EFE6 !important;}[data-ogsc] .e-soft{color:#CFC7B8 !important;}[data-ogsc] .e-muted,[data-ogsc] .e-muted a{color:#A79D8D !important;}[data-ogsc] .e-accent{color:#D9E4DC !important;}[data-ogsc] .e-label{color:#8FC3A0 !important;}[data-ogsc] .e-link{color:#BFD3C6 !important;}[data-ogsc] .e-btn{background-color:#2F5A40 !important;}
</style>`;

// ── Document ────────────────────────────────────────────────────────────────

export function renderEmailCardHtml({
  blocks,
  conference,
  ctx,
  chairInviteToken,
  organizerInviteToken,
  importClaimToken,
  variant = 'broadcast',
  media,
  event,
  isDefault,
}: RenderEmailHtmlArgs): string {
  const siteUrl = getSiteUrl();
  const transactional = variant === 'transactional';
  const theme = resolveEmailTheme(conference.email_theme);
  const card = emailCardFor(event, isDefault);
  const name = shortName(conference);

  // Hero identity.
  const logoAbs = theme.showLogo ? absolutizeUrl(conference.logo_url, siteUrl) : null;
  const logo = logoAbs ? { url: emailImageUrl(logoAbs, 104), alt: `${conference.acronym || conference.full_name} logo`, baked: false } : null;
  const place = [conference.city, conference.country].map(s => (s ?? '').trim()).filter(Boolean).join(', ') || null;
  const chip = emailDatesLabel(conference.start_date, conference.end_date, conference.dates_tbd);

  // Pass rows come from the FIRST facts block (the same rows, the same drop
  // rule for all-marker values as the classic renderer).
  const iconFor = (from?: 'country' | 'committee'): { url: string; alt: string } | null => {
    if (from === 'country') {
      const url = absolutizeUrl(media?.seatLogo ?? null, siteUrl) ?? flagUrl(media?.countryCode);
      return url ? { url, alt: '' } : null;
    }
    if (from === 'committee') {
      const url = absolutizeUrl(media?.committeeEmblem ?? null, siteUrl);
      return url ? { url: emailImageUrl(url, 88), alt: '' } : null;
    }
    return null;
  };
  const factRows = (b: Extract<EmailBlock, { type: 'facts' }>): PassRow[] => b.items
    .map(i => ({ label: i.label.trim(), value: resolveTokens(i.value, ctx).trim(), from: i.iconFrom }))
    .filter(i => i.label && i.value && i.value.replace(new RegExp(UNRESOLVED_MARKER_PATTERN), '').trim() !== '')
    .map(i => ({ label: i.label, valueHtml: renderMarkedHtml(i.value, LINK), icon: iconFor(i.from) }));

  const firstFacts = blocks.findIndex(b => b.type === 'facts');
  const firstHeading = blocks.findIndex(b => b.type === 'paragraph' && b.variant === 'heading' && !!b.content.trim());
  // Where the pass sits: at the first facts block; otherwise after the first
  // body paragraph (transactional) or straight under the headline (broadcast,
  // where it plays the masthead).
  let passAt: number;
  if (firstFacts >= 0) passAt = firstFacts;
  else if (transactional) {
    const firstBody = blocks.findIndex((b, i) => i !== firstHeading && b.type === 'paragraph' && (b.variant ?? 'body') === 'body' && !!b.content.trim());
    passAt = firstBody >= 0 ? firstBody + 1 : firstHeading + 1;
  } else passAt = firstHeading + 1;

  const passArgs = {
    pill: card.pill,
    chip,
    logo,
    name,
    place,
    rows: firstFacts >= 0 ? factRows(blocks[firstFacts] as Extract<EmailBlock, { type: 'facts' }>) : [],
  };

  // Broadcast keeps the organiser's banner artwork, as an image (never a
  // background), above everything else in the card.
  const bannerAbs = !transactional && theme.headerStyle === 'banner' ? absolutizeUrl(conference.banner_url, siteUrl) : null;

  let out = '';
  let buttons = 0;
  let passDone = false;
  // 'heading' | 'body' | 'pass' | 'button' | 'other': what was drawn last, for spacing.
  let last = 'other';
  const emitPass = () => { if (!passDone) { out += passCard({ ...passArgs, top: last === 'heading' ? 22 : 0 }); passDone = true; last = 'pass'; } };
  let bodyRun = '';
  const flushBody = (afterPass: boolean) => {
    if (!bodyRun) return;
    out += row(bodyRun, `${afterPass ? 24 : 22}px 36px ${afterPass ? 0 : 20}px 36px`);
    bodyRun = '';
    last = 'body';
  };

  blocks.forEach((b, i) => {
    if (i === passAt) { flushBody(passDone); emitPass(); }
    if (b.type === 'paragraph') {
      if (!b.content.trim()) return;
      const v = b.variant ?? 'body';
      const resolved = resolveTokens(b.content, ctx);
      if (v === 'heading') {
        flushBody(passDone);
        const html = renderMarkedHtml(resolved.replace(/\s*\n\s*/g, ' '), LINK);
        out += i === firstHeading ? h1(html) : h2(html);
        last = 'heading';
        return;
      }
      const html = renderParagraphChunks(resolved, LINK, v === 'small' ? 10 : 12);
      if (html) bodyRun += (bodyRun ? `<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>` : '') + bodyCell(html, v === 'small' ? 'small' : 'body');
      return;
    }
    if (b.type === 'facts') {
      if (i === firstFacts) return; // drawn inside the pass
      const rows = factRows(b);
      if (!rows.length) return;
      flushBody(passDone);
      out += row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-pass" bgcolor="#F6F2E8" style="background-color:#F6F2E8;border-radius:16px;"><tr><td style="padding:4px 8px;">`
        + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map((r, k) =>
          `<tr><td style="padding:${k === 0 ? 12 : 6}px 8px ${k === rows.length - 1 ? 12 : 6}px 8px;font-family:${SANS};"><div class="e-label" style="font-size:12.5px;font-weight:bold;color:${LABEL};">${escapeHtml(r.label)}</div><div class="e-ink" style="font-size:17px;line-height:1.3;font-weight:bold;color:#1C1410;padding-top:2px;">${r.valueHtml}</div></td></tr>`).join('')}</table></td></tr></table>`,
        '18px 36px 0 36px');
      return;
    }
    if (b.type === 'image') {
      const abs = absolutizeUrl(b.url, siteUrl);
      if (!abs || /^data:/i.test(abs)) return;
      flushBody(passDone);
      out += row(`<img src="${escapeHtml(abs)}" width="528" alt="${escapeHtml(b.alt)}" style="display:block;width:100%;max-width:528px;height:auto;border-radius:12px;border:0;margin:0 auto;" />`, '20px 36px 0 36px', 'center');
      return;
    }
    // button
    const url = resolveButtonUrl(b, conference, { chairInviteToken, organizerInviteToken, importClaimToken });
    if (!url) return;
    const label = b.label?.trim() || BUTTON_FALLBACK_LABEL[b.destination] || 'Open link';
    flushBody(passDone);
    if (buttons === 0 && card.snapshot) out += snapshotRow(card.snapshot);
    out += buttons === 0 ? primaryButton(resolveTokens(label, ctx), url) : secondaryLink(resolveTokens(label, ctx), url);
    buttons++;
    last = 'button';
  });
  flushBody(passDone);
  if (!passDone) emitPass();
  if (buttons === 0 && card.snapshot) out += snapshotRow(card.snapshot);

  const footerLine = theme.footerLine.trim();
  if (footerLine) { out += row(bodyCell(escapeHtml(footerLine).replace(/\n/g, '<br>'), 'small'), `${last === 'button' ? 0 : 24}px 36px 8px 36px`); last = 'body'; }

  // Sign-off. True, not decoration: send-emails sets reply_to from the
  // conference's contact address, so a reply reaches the organisers.
  const signoff = transactional
    ? row(`<p class="e-soft" style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK_SOFT};">Questions? Reply to this email and it reaches the ${escapeHtml(conference.acronym || name)} team.<br><strong class="e-ink" style="color:#1C1410;">${escapeHtml(name)} via Gavelling</strong></p>`,
      `${last === 'button' ? 0 : 24}px 36px 32px 36px`)
    : `<tr><td style="height:28px;line-height:28px;font-size:0;">&nbsp;</td></tr>`;

  const preheader = buildPreheader(blocks, ctx);
  const socials = socialLinks(conference);
  const socialRow = socials.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px auto;"><tr>${socials
      .map(x => `<td style="padding:0 7px;"><a href="${escapeHtml(x.url)}" target="_blank" style="text-decoration:none;"><img src="${escapeHtml(siteUrl)}/email/${x.icon}.png" width="22" height="22" alt="${escapeHtml(x.label)}" style="display:block;width:22px;height:22px;border:0;" /></a></td>`)
      .join('')}</tr></table>`
    : '';
  const contact = conference.contact_email
    ? `<div class="e-muted" style="font-family:${SANS};font-size:12.5px;line-height:1.6;color:${MUTED};padding-bottom:10px;"><strong>${escapeHtml(conference.full_name)}</strong> &middot; <a href="mailto:${escapeHtml(conference.contact_email.split(/[|,;\s]+/)[0])}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(conference.contact_email)}</a></div>`
    : '';
  const legal = companyLegalLines();

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(conference.full_name || name)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
${STYLE}
</head>
<body class="e-page" style="margin:0;padding:0;background-color:#EDE7D8;">
${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${'&#8199;&#65279;&#847; '.repeat(6)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-page" bgcolor="#EDE7D8" style="background-color:#EDE7D8;">
<tr><td align="center" style="padding:24px 10px 36px 10px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-card" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #DDD4C0;border-radius:18px;">
<tr><td align="center" style="padding:28px 24px 0 24px;"><div class="e-soft" style="font-family:${SANS};font-size:12px;line-height:16px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:${FOREST};">Gavelling</div></td></tr>
${bannerAbs ? row(`<img src="${escapeHtml(bannerAbs)}" width="528" alt="${escapeHtml(conference.full_name)}" style="display:block;width:100%;max-width:528px;height:auto;border-radius:14px;border:0;" />`, '18px 36px 0 36px', 'center') : ''}
${out}
${signoff}
</table>
</td></tr>
<tr><td align="center" style="padding:22px 20px 0 20px;">
${socialRow}${contact}
<div class="e-muted" style="font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};">Sent by Gavelling on behalf of ${escapeHtml(name)}.<br><a href="${escapeHtml(siteUrl)}/account/profile" target="_blank" style="color:${MUTED};text-decoration:underline;">Email preferences</a> &middot; <a href="${UNSUBSCRIBE_MARK}" target="_blank" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a> &middot; <a href="${escapeHtml(siteUrl)}" target="_blank" style="color:${MUTED};text-decoration:underline;">gavelling.com</a></div>
${legal.length ? `<div class="e-muted" style="font-family:${SANS};font-size:11px;line-height:1.65;color:${MUTED};padding-top:12px;">${legal.map(l => escapeHtml(l)).join('<br>')}</div>` : ''}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
