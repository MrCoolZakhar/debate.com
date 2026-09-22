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
// Owner review of the previews (22 Sep 2026):
//  5. The circle behind an uploaded logo stays WHITE in dark mode: bgcolor, a
//     white-disc background IMAGE (Gmail's app recolours colours, never
//     images), color-scheme:light only on the cell, and .e-tile rules for
//     prefers-color-scheme, [data-ogsc] and [data-ogsb] (logoDisc below).
//  6. The conference's own banner is the header image of the pass with no
//     organiser action; an email-specific image (email_theme.bannerUrl) wins.
//     Absolute https only, cropped 3:1, on a forest ground so a broken image is
//     a forest band carrying the name.
//  7. Countries are round flags (public/email/flags, the circle artwork as
//     PNG), committees and conferences are logos in a white circle.
//  8. allocation_assigned leads with the allocation itself: a big round flag
//     and the country as the headline, then the committee, then the
//     conference, with the Gavelling mark and gavelling.com, because that email
//     is shared as a screenshot.
//  9. Cards sit on a soft forest-tinted shadow, with a border and a 3px ground
//     lip where box-shadow is not supported (Outlook).
//
// Images are served from EMAIL_ASSET_BASE: the email-assets storage bucket
// until public/email/ is deployed, then https://gavelling.com/email/ (same
// files). Mirrors public.gavelling_email_asset_base_v2().
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

/** Where the email images live (round flags, icon discs, the white logo disc,
 *  banner crops, product shots). Keep in step with gavelling_email_asset_base_v2(). */
export const EMAIL_ASSET_BASE = 'https://luruhkwrgisytejswlas.supabase.co/storage/v1/object/public/email-assets/';
const LEGACY_ASSETS = 'https://luruhkwrgisytejswlas.supabase.co/storage/v1/object/public/session-documents/email-assets/';

/** ISO codes that have round-flag artwork in public/email/flags. */
const FLAG_CODES = new Set(('ac ad ae af ag ai al am an ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw '
  + 'by bz ca cc cd cf cg ch ci ck cl cm cn co cp cq cr cu cv cw cx cy cz de dg dj dk dm do dz ea ec ee eg eh er es et eu fi fj fk fm fo fr fx '
  + 'ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu ic id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp '
  + 'kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np '
  + 'nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st su sv sx sy sz ta '
  + 'tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug uk um un us uy uz va vc ve vg vi vn vu wf ws xk xx ye yt yu za zm zw').split(' '));

/** Icons in public/email/icons: a Lucide glyph in forest on a baked pale-gold disc. */
export type EmailIcon = 'page' | 'committees' | 'chairs' | 'email' | 'secretariat' | 'payments' | 'publish' | 'applications'
  | 'questions' | 'checkin' | 'live' | 'sessions' | 'invites' | 'calendar' | 'award' | 'paper' | 'clock' | 'globe'
  | 'seats' | 'receipt' | 'place' | 'dot' | 'check' | 'done';


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
const EVENT_CARD: Record<string, { pill: string; snapshot?: keyof typeof EMAIL_SNAPSHOTS; icon?: EmailIcon; seat?: boolean }> = {
  application_received: { pill: 'Application received', icon: 'applications' },
  draft_reminder: { pill: 'Draft saved', icon: 'paper' },
  application_accepted: { pill: 'Accepted', snapshot: 'conferencePage', icon: 'check' },
  application_rejected: { pill: 'Application update' },
  payment_available: { pill: 'Payment open', icon: 'payments', seat: true },
  payment_received: { pill: 'Paid', icon: 'receipt', seat: true },
  fee_waived: { pill: 'Fee waived', icon: 'payments', seat: true },
  aid_approved: { pill: 'Aid approved', icon: 'payments' },
  aid_denied: { pill: 'Aid update' },
  // No snapshot: this email is the share card, and it stays short.
  allocation_assigned: { pill: 'Allocated', icon: 'seats' },
  allocation_changed: { pill: 'Allocation changed', icon: 'seats' },
  allocation_removed: { pill: 'Allocation removed' },
  pledge_received: { pill: 'Pledge received', icon: 'payments' },
  added_to_delegation: { pill: 'In a delegation', icon: 'secretariat' },
  removed_from_delegation: { pill: 'Delegation update' },
  spot_received: { pill: 'Spot confirmed', icon: 'seats', seat: true },
  spot_lost: { pill: 'Spot update' },
  not_attending: { pill: 'Not attending' },
  attendance_restored: { pill: 'Attending', icon: 'check' },
  documents_published: { pill: 'Study guide out', icon: 'paper' },
  position_paper_due: { pill: 'Paper due', icon: 'clock' },
  chair_assigned: { pill: 'Chair', snapshot: 'chairConsole', icon: 'chairs' },
  committee_chair_invite: { pill: 'Chair invitation', snapshot: 'chairConsole', icon: 'chairs' },
  organizer_invite: { pill: 'Team invitation', snapshot: 'organiserDashboard', icon: 'secretariat' },
  session_chair_invite: { pill: 'Your room is ready', snapshot: 'chairConsole', icon: 'sessions' },
  session_join_invite: { pill: 'Join the session', snapshot: 'delegatePhone', icon: 'sessions' },
  request_reply: { pill: 'Reply', icon: 'questions' },
  request_received: { pill: 'New question', icon: 'questions' },
  delegation_swap: { pill: 'Allocation swapped', icon: 'seats' },
  import_join_invite: { pill: 'Registration waiting', icon: 'invites' },
  awards_open: { pill: 'Awards open', icon: 'award' },
  award_received: { pill: 'Verified', icon: 'award' },
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

export function emailCardFor(event?: string, isDefault?: boolean): { pill: string | null; snapshot: EmailSnapshot | null; icon: EmailIcon | null; seat: boolean } {
  const e = event ? EVENT_CARD[event] : undefined;
  return {
    pill: e?.pill ?? null,
    snapshot: isDefault && e?.snapshot ? EMAIL_SNAPSHOTS[e.snapshot] : null,
    icon: e?.icon ?? null,
    seat: !!e?.seat,
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

/** The round flag PNG for an ISO alpha-2 code, or null when there is no artwork. */
export function flagUrl(code?: string | null): string | null {
  const cc = (code ?? '').trim().toLowerCase();
  return FLAG_CODES.has(cc) ? `${EMAIL_ASSET_BASE}flags/${cc}.png` : null;
}

function roundFlag(url: string, px: number, alt: string): string {
  return `<img src="${escapeHtml(url)}" width="${px}" height="${px}" alt="${escapeHtml(alt)}" style="display:block;width:${px}px;height:${px}px;border:0;border-radius:${px / 2}px;margin:0 auto;font-family:${SANS};font-size:11px;line-height:1.2;color:${INK_SOFT};" />`;
}

/** An uploaded logo in a circle that stays white in dark mode (rule 5 above). */
function logoDisc(url: string, px: number, alt: string): string {
  const inner = Math.round(px * 0.78);
  const disc = `${EMAIL_ASSET_BASE}disc-white.png`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>`
    + `<td align="center" valign="middle" width="${px}" height="${px}" class="e-tile" bgcolor="#FFFFFF" background="${disc}" style="width:${px}px;height:${px}px;background-color:#FFFFFF;background-image:url('${disc}');background-size:${px}px ${px}px;background-repeat:no-repeat;background-position:center;border-radius:${px / 2}px;color-scheme:light only;box-shadow:0 3px 10px rgba(10,24,16,0.22);line-height:0;font-size:0;">`
    + `<img src="${escapeHtml(emailImageUrl(url, inner * 2))}" width="${inner}" height="${inner}" alt="${escapeHtml(alt)}" style="display:block;width:${inner}px;height:${inner}px;border:0;margin:0 auto;object-fit:contain;font-family:${SANS};font-size:9px;line-height:1.2;color:${FOREST};" /></td></tr></table>`;
}

/** A logo URL an email client can show. The preset SVG emblems (/logos/*.svg,
 *  /committee-emblems/*.svg, used by hundreds of committees) map to their PNG
 *  renders; other site paths become absolute; SVG anywhere else is dropped,
 *  because Gmail does not render SVG. Mirrors gavelling_email_logo_url_v2. */
export function emailLogoUrl(url: string | null | undefined, siteUrl: string): string | null {
  const v = (url ?? '').trim();
  if (!v) return null;
  const preset = /^\/(logos|committee-emblems)\/([A-Za-z0-9_-]+)\.svg$/.exec(v);
  if (preset) return `${EMAIL_ASSET_BASE}emblems/${preset[1]}/${preset[2]}.png`;
  if (/\.svg(\?|$)/i.test(v)) return null;
  const abs = absolutizeUrl(v, siteUrl);
  return abs && /^https?:\/\//i.test(abs) && !/["<>\s]/.test(abs) ? abs : null;
}

/** The header image: the email-specific image when set, else the conference's
 *  own banner. Absolute https only; presets map to their 3:1 email crops and
 *  storage uploads are cropped 1200 x 400. Mirrors gavelling_email_banner_url_v2. */
export function emailBannerUrl(conference: { banner_url?: string | null; email_theme?: unknown }): string | null {
  const themed = (conference.email_theme as { bannerUrl?: unknown } | null | undefined)?.bannerUrl;
  let v = (typeof themed === 'string' && themed.trim()) || (conference.banner_url ?? '').trim();
  if (!v) return null;
  const preset = /^\/banners\/(preset-[1-9][0-9]?\.jpg)$/.exec(v);
  if (preset) return `${EMAIL_ASSET_BASE}banners/${preset[1]}`;
  if (/^\/[A-Za-z0-9]/.test(v)) v = `https://gavelling.com${v}`;
  if (!/^https:\/\/[A-Za-z0-9.-]+\//i.test(v) || /["<>\s]/.test(v)) return null;
  const marker = '/storage/v1/object/public/';
  if (v.includes(marker)) return `${v.split('?')[0].replace(marker, '/storage/v1/render/image/public/')}?width=1200&height=400&resize=cover`;
  return v;
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

type RowIcon = { kind: 'flag' | 'logo'; url: string; alt: string };

function rowIcon(i: RowIcon, px: number): string {
  return i.kind === 'flag' ? roundFlag(i.url, px, i.alt) : logoDisc(i.url, px, i.alt);
}

interface PassRow { label: string; valueHtml: string; icon?: RowIcon | null; from?: 'country' | 'committee' }

function passCard(opts: { top?: number; pill: string | null; pillIcon?: EmailIcon | null; chip: string | null; logo: { url: string; alt: string; baked: boolean } | null; name: string; place: string | null; banner?: string | null; rows: PassRow[] }): string {
  const { pill, chip, logo, name, place, rows } = opts;
  const padTop = opts.top ?? 0;
  const body = rows.map((r, i) => {
    const top = i === 0 ? 18 : 8;
    const bottom = i === rows.length - 1 ? 16 : 8;
    const img = r.icon ? `<td valign="middle" width="56" style="width:56px;padding:${top}px 0 ${bottom}px 8px;">${rowIcon(r.icon, 56)}</td>` : '';
    return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${img}`
      + `<td valign="middle" style="padding:${top}px 8px ${bottom}px ${img ? 16 : 8}px;font-family:${SANS};">`
      + `<div class="e-label" style="font-size:12.5px;line-height:1.3;font-weight:bold;color:${LABEL};">${escapeHtml(r.label)}</div>`
      + `<div class="e-ink" style="font-size:19px;line-height:1.3;font-weight:bold;color:#1C1410;padding-top:2px;">${r.valueHtml}</div>`
      + `</td></tr></table></td></tr>`;
  }).join('');

  const logoCell = !logo ? '' : logo.baked
    ? `<td valign="middle" width="64" style="width:64px;line-height:0;font-size:0;"><img src="${escapeHtml(logo.url)}" width="64" height="64" alt="${escapeHtml(logo.alt)}" style="display:block;width:64px;height:64px;border:0;font-family:${SANS};font-size:10px;line-height:1.2;color:${GOLD};" /></td>`
    : `<td valign="middle" width="64" style="width:64px;">${logoDisc(logo.url, 64, logo.alt)}</td>`;

  const topRow = pill || chip
    ? `<tr><td class="e-hero-pad" style="padding:13px 13px 0 13px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`
      + `<td align="left" valign="top">${pill
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#F0EBDD" style="background-color:#F0EBDD;border-radius:999px;padding:5px 12px 5px 10px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;color:#1C1410;white-space:nowrap;">${opts.pillIcon ? `<img src="${EMAIL_ASSET_BASE}icons/${opts.pillIcon}.png" width="16" height="16" alt="" style="display:inline-block;width:16px;height:16px;border:0;vertical-align:-3px;" />` : '<span style="color:#2A5A3C;font-size:13px;">&#9679;</span>'}&nbsp;${escapeHtml(pill)}</td></tr></table>`
        : '&nbsp;'}</td>`
      + `<td align="right" valign="top">${chip
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td style="border:1px solid #58775F;border-radius:999px;padding:4px 10px;font-family:${SANS};font-size:11.5px;line-height:15px;font-weight:600;color:#FAF8F3;white-space:nowrap;">${escapeHtml(chip)}</td></tr></table>`
        : '&nbsp;'}</td></tr></table></td></tr>`
    : '';

  return `<tr><td class="e-pad" style="padding:${padTop}px 36px 0 36px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-pass" bgcolor="#F0EBDD" style="background-color:#F0EBDD;border-radius:22px;">`
    + `<tr><td style="padding:12px 12px ${rows.length ? 4 : 12}px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FOREST}" style="background-color:${FOREST};border-radius:16px;box-shadow:0 12px 24px -14px rgba(10,24,16,0.65);">`
    + (opts.banner ? bannerRow(opts.banner, name) : '')
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

/** The allocation share card: the seat first (a big round flag and the country
 *  as the headline), then the committee, then the conference, then the
 *  Gavelling mark. Built to be screenshotted: centred, one column, solid forest
 *  ground so light and dark mode render it the same way. */
function sharePanel(o: {
  eyebrow: string; country: string; countryIcon: RowIcon | null;
  committee: string | null; committeeName: string | null; committeeLogo: string | null;
  confName: string; confLogo: string | null; confMeta: string | null; banner: string | null;
}): string {
  const IVORY = '#FAF8F3';
  const SOFT = '#D9E0D9';
  const flag = o.countryIcon ? rowIcon({ ...o.countryIcon, alt: `Flag of ${o.country}` }, 132) : '';
  const showFull = !!o.committeeName && !!o.committee && o.committeeName.trim().toLowerCase() !== o.committee.trim().toLowerCase();
  const committee = o.committee
    ? `<tr><td class="e-hero-pad" style="padding:24px 18px 0 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#24472F" style="background-color:#24472F;border-radius:16px;"><tr>`
      + (o.committeeLogo ? `<td valign="middle" width="60" style="width:60px;padding:14px 0 14px 14px;">${logoDisc(o.committeeLogo, 60, '')}</td>` : '')
      + `<td valign="middle" style="padding:14px 16px 14px ${o.committeeLogo ? 14 : 18}px;font-family:${SANS};">`
      + `<div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${SOFT};" class="e-share-soft">Committee</div>`
      + `<div style="font-size:24px;line-height:1.15;font-weight:800;letter-spacing:-0.01em;color:${GOLD};padding-top:2px;">${escapeHtml(o.committee)}</div>`
      + (showFull ? `<div style="font-size:13px;line-height:1.4;color:${SOFT};padding-top:3px;" class="e-share-soft">${escapeHtml(o.committeeName!)}</div>` : '')
      + `</td></tr></table></td></tr>`
    : '';
  const conf = `<tr><td class="e-hero-pad" style="padding:18px 18px 0 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`
    + (o.confLogo ? `<td valign="middle" width="40" style="width:40px;">${logoDisc(o.confLogo, 40, '')}</td>` : '')
    + `<td valign="middle" style="padding-left:${o.confLogo ? 12 : 0}px;font-family:${SANS};">`
    + `<div style="font-size:15px;line-height:1.3;font-weight:800;color:${IVORY};">${escapeHtml(o.confName)}</div>`
    + (o.confMeta ? `<div style="font-size:12.5px;line-height:1.4;color:${SOFT};padding-top:1px;" class="e-share-soft">${escapeHtml(o.confMeta)}</div>` : '')
    + `</td></tr></table></td></tr>`;
  const brand = `<tr><td align="center" style="padding:18px 18px 18px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #36563F;"><tr><td style="padding-top:14px;">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>`
    + `<td valign="middle" width="24" style="width:24px;line-height:0;font-size:0;"><img src="${LEGACY_ASSETS}tile-gavelling.png" width="24" height="24" alt="" style="display:block;width:24px;height:24px;border:0;" /></td>`
    + `<td valign="middle" style="padding-left:8px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};"><a href="https://gavelling.com" target="_blank" style="color:${GOLD};text-decoration:none;">gavelling.com</a></td>`
    + `</tr></table></td></tr></table></td></tr>`;
  return `<tr><td class="e-pad" style="padding:20px 36px 0 36px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FOREST}" style="background-color:${FOREST};border-radius:20px;box-shadow:0 18px 36px -18px rgba(10,24,16,0.7);">`
    + (o.banner ? bannerRow(o.banner, o.confName).replace(/16px 16px 0 0/g, '20px 20px 0 0') : '')
    + `<tr><td align="center" style="padding:${o.banner ? 24 : 30}px 20px 0 20px;font-family:${SANS};font-size:11.5px;line-height:1.4;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${SOFT};" class="e-share-soft">${escapeHtml(o.eyebrow)}</td></tr>`
    + (flag ? `<tr><td align="center" style="padding:16px 20px 0 20px;">${flag}</td></tr>` : '')
    + `<tr><td align="center" style="padding:16px 20px 0 20px;font-family:${SANS};"><div class="e-share-title" style="font-size:38px;line-height:1.08;font-weight:800;letter-spacing:-0.02em;color:${IVORY};">${escapeHtml(o.country)}</div></td></tr>`
    + committee + conf + brand
    + `</table></td></tr>`;
}

/** The banner at the top of the forest hero. A fixed forest ground and gold
 *  alt text, so a slow or broken image is a band carrying the name. */
function bannerRow(url: string, name: string): string {
  return `<tr><td align="center" bgcolor="${FOREST}" style="background-color:${FOREST};border-radius:16px 16px 0 0;line-height:0;font-size:0;padding:0;">`
    + `<img src="${escapeHtml(url)}" width="504" alt="${escapeHtml(name)}" style="display:block;width:100%;max-width:504px;height:auto;border:0;border-radius:16px 16px 0 0;font-family:${SANS};font-size:15px;line-height:48px;font-weight:bold;color:${GOLD};text-align:center;" /></td></tr>`;
}

function primaryButton(label: string, url: string): string {
  const l = escapeHtml(label);
  const u = escapeHtml(url);
  return `<tr><td align="center" class="e-pad" style="padding:26px 36px 26px 36px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td align="center" bgcolor="${FOREST}" class="e-btn" style="background-color:${FOREST};border-radius:999px;box-shadow:0 8px 18px -8px rgba(27,56,40,0.6);">`
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
    `<img src="${escapeHtml(s.url)}" width="${s.width}" alt="${escapeHtml(s.alt)}" style="display:block;width:100%;max-width:${s.width}px;height:auto;border:1px solid #DDD4C0;border-radius:14px;margin:0 auto;box-shadow:0 14px 30px -16px rgba(27,56,40,0.45);font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_SOFT};" />`
    + (s.caption ? `<div class="e-muted" style="font-family:${SANS};font-size:12.5px;line-height:1.5;color:${MUTED};padding-top:8px;text-align:center;">${escapeHtml(s.caption)}</div>` : ''),
    '26px 36px 0 36px', 'center');
}

const STYLE = `<style>
:root{color-scheme:light dark;supported-color-schemes:light dark;}
.e-tile{background-color:#FFFFFF !important;color-scheme:light only;}
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a{text-decoration:none;}
@media only screen and (max-width:620px){.e-pad{padding-left:20px !important;padding-right:20px !important;}.e-h1{font-size:24px !important;}.e-hero-name{font-size:23px !important;}.e-hero-pad{padding-left:14px !important;padding-right:14px !important;}.e-share-title{font-size:32px !important;}}
@media (prefers-color-scheme: dark){body,.e-page{background-color:#0E0D0A !important;}.e-card{background-color:#232019 !important;border-color:#3A352A !important;border-bottom-color:#15130F !important;}.e-pass{background-color:#1B1811 !important;box-shadow:none !important;}.e-hair{border-color:#3A352A !important;}.e-ink,.e-ink div,.e-ink span,.e-ink strong,.e-ink em{color:#F3EFE6 !important;}.e-soft{color:#CFC7B8 !important;}.e-muted,.e-muted a,.e-muted div{color:#A79D8D !important;}.e-accent{color:#D9E4DC !important;}.e-label{color:#8FC3A0 !important;}.e-tile{background-color:#FFFFFF !important;}.e-share-soft{color:#D9E0D9 !important;}.e-link{color:#BFD3C6 !important;}.e-btn{background-color:#2F5A40 !important;}}
[data-ogsc] .e-page{background-color:#0E0D0A !important;}[data-ogsc] .e-card{background-color:#232019 !important;}[data-ogsc] .e-pass{background-color:#1B1811 !important;}[data-ogsc] .e-ink,[data-ogsc] .e-ink div,[data-ogsc] .e-ink span,[data-ogsc] .e-ink strong{color:#F3EFE6 !important;}[data-ogsc] .e-soft{color:#CFC7B8 !important;}[data-ogsc] .e-muted,[data-ogsc] .e-muted a{color:#A79D8D !important;}[data-ogsc] .e-accent{color:#D9E4DC !important;}[data-ogsc] .e-label{color:#8FC3A0 !important;}[data-ogsc] .e-link{color:#BFD3C6 !important;}[data-ogsc] .e-btn{background-color:#2F5A40 !important;}
[data-ogsc] .e-tile,[data-ogsb] .e-tile{background-color:#FFFFFF !important;}
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
  const logoAbs = theme.showLogo ? emailLogoUrl(conference.logo_url, siteUrl) : null;
  const logo = logoAbs ? { url: logoAbs, alt: `${conference.acronym || conference.full_name} logo`, baked: false } : null;
  const place = [conference.city, conference.country].map(s => (s ?? '').trim()).filter(Boolean).join(', ') || null;
  const chip = emailDatesLabel(conference.start_date, conference.end_date, conference.dates_tbd);

  // Pass rows come from the FIRST facts block (the same rows, the same drop
  // rule for all-marker values as the classic renderer).
  // A country is its round flag (or the seat's own crest in a white circle); a
  // committee is its emblem in a white circle.
  const countryIcon = (): RowIcon | null => {
    const crest = emailLogoUrl(media?.seatLogo, siteUrl);
    if (crest) return { kind: 'logo', url: crest, alt: '' };
    const flag = flagUrl(media?.countryCode);
    return flag ? { kind: 'flag', url: flag, alt: '' } : null;
  };
  const committeeIcon = (): RowIcon | null => {
    const url = emailLogoUrl(media?.committeeEmblem, siteUrl);
    return url ? { kind: 'logo', url, alt: '' } : null;
  };
  const iconFor = (from: 'country' | 'committee' | undefined, label: string): RowIcon | null => {
    if (from === 'country') return countryIcon();
    if (from === 'committee' || /^committee$/i.test(label)) return committeeIcon();
    return null;
  };
  const resolvedOrNull = (token: string): string | null => {
    const v = resolveTokens(token, ctx).trim();
    return v && v.replace(new RegExp(UNRESOLVED_MARKER_PATTERN), '').trim() !== '' && !new RegExp(UNRESOLVED_MARKER_PATTERN).test(v) ? v : null;
  };
  const countryName = resolvedOrNull('{{country}}');
  const factRows = (b: Extract<EmailBlock, { type: 'facts' }>): PassRow[] => {
    const rows = b.items
      .map(i => ({ label: i.label.trim(), value: resolveTokens(i.value, ctx).trim(), from: i.iconFrom }))
      .filter(i => i.label && i.value && i.value.replace(new RegExp(UNRESOLVED_MARKER_PATTERN), '').trim() !== '')
      .map(i => ({ label: i.label, valueHtml: renderMarkedHtml(i.value, LINK), icon: iconFor(i.from, i.label), from: i.from }));
    // Money and seat events name the delegate's country with its flag even when
    // the template has no country row (card design only; the text is the
    // allocation already on the application, never an organiser's words).
    if (card.seat && countryName && !rows.some(r => r.from === 'country')) {
      const at = rows.findIndex(r => /^committee$/i.test(r.label));
      rows.splice(at >= 0 ? at + 1 : 0, 0, { label: 'Representing', valueHtml: escapeHtml(countryName), icon: countryIcon(), from: 'country' });
    }
    return rows;
  };

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

  // The conference's banner heads the pass on every email, with nothing for an
  // organiser to set (email_theme.bannerUrl wins when present).
  const banner = emailBannerUrl(conference);
  const firstRows = firstFacts >= 0 ? factRows(blocks[firstFacts] as Extract<EmailBlock, { type: 'facts' }>) : [];

  // The allocation email is a share card: it leads with the seat itself.
  const share = event === 'allocation_assigned' && !!countryName;
  const committeeLabel = resolvedOrNull('{{committee}}');
  const shareHtml = share ? sharePanel({
    eyebrow: (() => {
      const h = firstHeading >= 0 ? resolveTokens((blocks[firstHeading] as Extract<EmailBlock, { type: 'paragraph' }>).content, ctx).trim() : '';
      return h && h.length <= 40 && !new RegExp(UNRESOLVED_MARKER_PATTERN).test(h) ? h : 'Your allocation';
    })(),
    country: countryName!,
    countryIcon: countryIcon(),
    committee: committeeLabel,
    committeeName: (media?.committeeName ?? '').trim() || null,
    committeeLogo: emailLogoUrl(media?.committeeEmblem, siteUrl),
    confName: name,
    confLogo: logoAbs,
    confMeta: [chip, place].filter(Boolean).join(' · ') || null,
    banner,
  }) : '';
  // Rows the share card already shows (country, committee) are not repeated.
  const shareRest = firstRows.filter(r => r.from !== 'country' && r.from !== 'committee' && !/^committee$/i.test(r.label));

  const passArgs = {
    pill: card.pill,
    pillIcon: card.icon,
    chip,
    logo,
    name,
    place,
    banner,
    rows: firstRows,
  };

  let out = '';
  let buttons = 0;
  let passDone = false;
  // 'heading' | 'body' | 'pass' | 'button' | 'other': what was drawn last, for spacing.
  let last = 'other';
  const secondaryFacts = (rows: PassRow[]) => row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-pass" bgcolor="#F6F2E8" style="background-color:#F6F2E8;border-radius:16px;"><tr><td style="padding:4px 8px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map((r, k) =>
      `<tr>${r.icon ? `<td valign="middle" width="44" style="width:44px;padding:${k === 0 ? 12 : 6}px 0 ${k === rows.length - 1 ? 12 : 6}px 8px;">${rowIcon(r.icon, 40)}</td>` : ''}<td style="padding:${k === 0 ? 12 : 6}px 8px ${k === rows.length - 1 ? 12 : 6}px ${r.icon ? 12 : 8}px;font-family:${SANS};"><div class="e-label" style="font-size:12.5px;font-weight:bold;color:${LABEL};">${escapeHtml(r.label)}</div><div class="e-ink" style="font-size:17px;line-height:1.3;font-weight:bold;color:#1C1410;padding-top:2px;">${r.valueHtml}</div></td></tr>`).join('')}</table></td></tr></table>`,
    '18px 36px 0 36px');
  const emitPass = () => {
    if (passDone) return;
    if (share) {
      if (shareRest.length) { out += secondaryFacts(shareRest); last = 'other'; }
    } else { out += passCard({ ...passArgs, top: last === 'heading' ? 22 : 0 }); last = 'pass'; }
    passDone = true;
  };
  if (share) { out += shareHtml; last = 'pass'; }
  let bodyRun = '';
  const flushBody = (afterPass: boolean) => {
    if (!bodyRun) return;
    out += row(bodyRun, `${afterPass ? 24 : 22}px 36px ${afterPass ? 0 : 20}px 36px`);
    bodyRun = '';
    last = 'body';
  };

  blocks.forEach((b, i) => {
    // The share card is already drawn at the top; with nothing left of the
    // facts to show, the greeting and the next paragraph stay one run of text.
    if (i === passAt) { if (!(share && !shareRest.length)) flushBody(passDone); emitPass(); }
    if (b.type === 'paragraph') {
      if (!b.content.trim()) return;
      const v = b.variant ?? 'body';
      const resolved = resolveTokens(b.content, ctx);
      if (v === 'heading') {
        if (share && i === firstHeading) return; // it is the share card's eyebrow
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
      out += secondaryFacts(rows);
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-card" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #DDD4C0;border-bottom:3px solid #D2C7AF;border-radius:18px;box-shadow:0 1px 2px rgba(27,56,40,0.06),0 22px 44px -22px rgba(27,56,40,0.35);">
<tr><td align="center" style="padding:28px 24px 0 24px;"><div class="e-soft" style="font-family:${SANS};font-size:12px;line-height:16px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:${FOREST};">Gavelling</div></td></tr>
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
