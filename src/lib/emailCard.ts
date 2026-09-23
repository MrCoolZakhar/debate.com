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
//  6. (Second review) No forest hero. The top of the card is the conference's
//     own banner as a 4:1 strip (full width, never cut at the sides),
//     with the conference logo in its white circle overlapping the banner's
//     bottom edge by a negative margin; Outlook drops negative margins and
//     stacks the logo under the banner instead. No banner: a slim row (logo,
//     name, dates) over a hairline. email_theme.bannerUrl, when set, wins.
//  7. Countries are round flags (public/email/flags, the circle artwork as
//     PNG), committees and conferences are logos in a white circle, and an
//     award is the medallion the website draws (public/email/awards).
//  8. allocation_assigned leads with the allocation itself on a light ivory
//     card: a big round flag and the country as the headline, then the
//     committee, then the Gavelling mark. Green is only the accents.
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
export const EMAIL_CARD_DESIGN = true;

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
const LINK = '#1B3828';

/** Where the email images live (round flags, icon discs, the white logo disc,
 *  banner crops, product shots). Keep in step with gavelling_email_asset_base_v2(). */
export const EMAIL_ASSET_BASE = 'https://gavelling.com/email/';
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
  /** PLACEHOLDER: the applications page with the check-in buttons, to be
   *  captured by hand (organiser session) as shots/check-in.jpg, 1200px wide.
   *  Until it exists nothing renders it. Set it to
   *  { url: `${EMAIL_ASSET_BASE}shots/check-in.jpg`, width: 528, alt, caption }. */
  checkIn: null as EmailSnapshot | null,
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
 *  own banner, as a wide 4:1 strip (598 x 150 in the 600px card) that is never
 *  cut at the sides. Presets map to their 4:1 renders (full width, top and
 *  bottom cropped on the focal point); storage uploads go through the image
 *  renderer at 1200 x 300, resize=cover, which keeps the full width of any
 *  banner narrower than 4:1. Absolute https only. Mirrors
 *  gavelling_email_banner_url_v2. */
export function emailBannerUrl(conference: { banner_url?: string | null; email_theme?: unknown }): string | null {
  const themed = (conference.email_theme as { bannerUrl?: unknown } | null | undefined)?.bannerUrl;
  let v = (typeof themed === 'string' && themed.trim()) || (conference.banner_url ?? '').trim();
  if (!v) return null;
  const preset = /^\/banners\/(preset-[1-9][0-9]?\.jpg)$/.exec(v);
  if (preset) return `${EMAIL_ASSET_BASE}banners-wide/${preset[1]}`;
  if (/^\/[A-Za-z0-9]/.test(v)) v = `https://gavelling.com${v}`;
  if (!/^https:\/\/[A-Za-z0-9.-]+\//i.test(v) || /["<>\s]/.test(v)) return null;
  const marker = '/storage/v1/object/public/';
  if (v.includes(marker)) return `${v.split('?')[0].replace(marker, '/storage/v1/render/image/public/')}?width=1200&height=300&resize=cover`;
  return v;
}

/** The award medallion the website draws (AwardArtwork in account/accountUi.tsx),
 *  as a hosted PNG. Mirrors gavelling_email_award_url_v2. */
export function awardArtUrl(name: string): string {
  const n = name.toLowerCase();
  const kind = /best delegate/.test(n) ? 'best-delegate'
    : /diplomacy/.test(n) ? 'diplomacy'
    : /outstanding/.test(n) ? 'outstanding'
    : /honou?rable mention/.test(n) ? 'honourable-mention'
    : /verbal commendation/.test(n) ? 'verbal-commendation'
    : /position paper/.test(n) ? 'position-paper'
    : /delegation/.test(n) ? 'delegation'
    : 'special';
  return `${EMAIL_ASSET_BASE}awards/${kind}.png`;
}

// ── Pieces ──────────────────────────────────────────────────────────────────

const row = (inner: string, pad: string, align = '') =>
  `<tr><td${align ? ` align="${align}"` : ''} class="e-pad" style="padding:${pad};">${inner}</td></tr>`;

function bodyCell(html: string, variant: 'body' | 'small'): string {
  const style = variant === 'small'
    ? `font-family:${SANS};font-size:13px;line-height:1.65;color:${MUTED};`
    : `font-family:${SANS};font-size:16px;line-height:1.6;color:${INK};`;
  return `<div class="${variant === 'small' ? 'e-muted' : 'e-ink'}" style="${style}">${html}</div>`;
}

type RowIcon = { kind: 'flag' | 'logo' | 'art'; url: string; alt: string };

function rowIcon(i: RowIcon, px: number): string {
  if (i.kind === 'flag') return roundFlag(i.url, px, i.alt);
  if (i.kind === 'art') return `<img src="${escapeHtml(i.url)}" width="${px}" height="${px}" alt="${escapeHtml(i.alt)}" style="display:block;width:${px}px;height:${px}px;border:0;" />`;
  return logoDisc(i.url, px, i.alt);
}

interface PassRow { label: string; valueHtml: string; icon?: RowIcon | null; from?: 'country' | 'committee' }

// ── The calm layout (third review, after the mymun allocation email) ────────
// One centred column, lots of white space, no boxes inside boxes. From the top:
// the conference banner with its logo overlapping the bottom edge (or a small
// centred logo), one big centred hero (the round flag for a seat, otherwise the
// event's icon), one large light headline sentence, a short rule, the plain
// statement or a few plain detail rows, the body, one button, a sign-off by the
// named secretariat, the conference's own social icons, and a small Gavelling
// footer line.

/** "[LIMUN 2027] Payment received". Card design only (the classic design keeps
 *  its subjects). Our default subjects end with ": {conference}", " for
 *  {conference}" or " at {conference}"; with the prefix that tail is noise and
 *  is dropped. Organiser-written subjects are only prefixed, never cut. */
export function emailCardSubject(subject: string, conference: { acronym: string; full_name: string; start_date?: string | null }, isDefault: boolean): string {
  if (!emailCardDesignEnabled()) return subject;
  const label = shortName(conference as Parameters<typeof shortName>[0]);
  const s = subject.trim();
  if (!label || s.startsWith('[')) return s;
  let body = s;
  if (isDefault) {
    const full = (conference.full_name ?? '').trim();
    for (const name of [full, label].filter(Boolean)) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body.replace(new RegExp(`(?:\\s*[:,]\\s*|\\s+(?:for|at|to)\\s+)${esc}$`), '');
    }
    for (const name of [full, label].filter(Boolean)) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body.replace(new RegExp(`\\bYour ${esc} `), 'Your ');
    }
  }
  return `[${label}] ${body || s}`;
}

function hairlineRule(): string {
  return `<tr><td align="center" style="padding:18px 36px 0 36px;line-height:0;font-size:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>`
    + `<td width="44" height="2" bgcolor="#C9A63A" class="e-rule" style="width:44px;height:2px;background-color:#C9A63A;border-radius:1px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`;
}

/** The top of a conference email, centred. With a banner: the banner, whole,
 *  edge to edge, and the conference logo in its white circle overlapping the
 *  bottom edge by a negative margin (Outlook drops negative margins and stacks
 *  the logo under the banner, which still reads cleanly). Without: a small
 *  centred logo. The conference name and dates sit quietly beneath. */
function masthead(o: { banner: string | null; logo: string | null; logoAlt: string; name: string; meta: string | null }): string {
  const nameRow = `<tr><td align="center" class="e-pad" style="padding:${o.banner && o.logo ? 10 : 12}px 36px 0 36px;font-family:${SANS};">`
    + `<div class="e-accent" style="font-size:15px;line-height:1.3;font-weight:800;letter-spacing:0.02em;color:${FOREST};">${escapeHtml(o.name)}</div>`
    + (o.meta ? `<div class="e-soft" style="font-size:12.5px;line-height:1.45;color:${INK_SOFT};padding-top:2px;">${escapeHtml(o.meta)}</div>` : '')
    + `</td></tr>`;
  if (o.banner) {
    return `<tr><td align="center" bgcolor="#E4DCC8" style="background-color:#E4DCC8;padding:0;line-height:0;font-size:0;border-radius:17px 17px 0 0;">`
      + `<img src="${escapeHtml(o.banner)}" width="598" alt="${escapeHtml(o.name)}" style="display:block;width:100%;max-width:598px;height:auto;border:0;border-radius:17px 17px 0 0;font-family:${SANS};font-size:15px;line-height:56px;font-weight:bold;color:${FOREST};text-align:center;" /></td></tr>`
      + (o.logo ? `<tr><td align="center" style="padding:0;"><div class="e-lift" style="margin-top:-40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td class="e-ring" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:50%;padding:4px;">${logoDisc(o.logo, 76, o.logoAlt)}</td></tr></table></div></td></tr>` : '')
      + nameRow;
  }
  return (o.logo ? `<tr><td align="center" style="padding:30px 36px 0 36px;">${logoDisc(o.logo, 56, o.logoAlt)}</td></tr>` : '<tr><td style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>')
    + nameRow;
}

/** The one big centred hero under the masthead. */
function heroRow(html: string): string {
  return `<tr><td align="center" class="e-pad" style="padding:30px 36px 0 36px;">${html}</td></tr>`;
}

/** The headline: one large, light sentence, centred. */
function headline(html: string, top: number): string {
  return `<tr><td align="center" class="e-pad" style="padding:${top}px 36px 0 36px;"><h1 class="e-h1 e-accent" style="margin:0;font-family:${SANS};font-size:29px;line-height:1.25;font-weight:300;letter-spacing:-0.01em;color:${FOREST};text-align:center;">${html}</h1></td></tr>`;
}

/** Detail rows: plain, no panel. Label in grey on the left, the value on the
 *  right with its small flag, emblem or medallion. Hairlines between. */
function detailRows(rows: PassRow[], top = 22): string {
  const body = rows.map((r, i) => {
    const hair = i === 0 ? '' : 'border-top:1px solid #EDE6D6;';
    return `<tr><td valign="middle" class="e-hair e-soft" style="${hair}padding:12px 12px 12px 0;font-family:${SANS};font-size:14px;line-height:1.4;color:${INK_SOFT};">${escapeHtml(r.label)}</td>`
      + `<td valign="middle" align="right" class="e-hair" style="${hair}padding:12px 0 12px 0;font-family:${SANS};">`
      + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr>`
      + (r.icon ? `<td valign="middle" style="padding-right:10px;line-height:0;">${rowIcon(r.icon, 28)}</td>` : '')
      + `<td valign="middle" class="e-ink" style="font-size:16px;line-height:1.35;font-weight:bold;color:#1C1410;text-align:right;">${r.valueHtml}</td></tr></table></td></tr>`;
  }).join('');
  return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-hair" style="border-top:1px solid #EDE6D6;border-bottom:1px solid #EDE6D6;">${body}</table>`, `${top}px 36px 0 36px`);
}

/** The seat, stated plainly: "France, DISEC", then the committee's full name
 *  and topic small beneath, beside its emblem. */
function seatStatement(o: { country: string; committee: string | null; committeeName: string | null; topic: string | null; committeeLogo: string | null }): string {
  const showFull = !!o.committeeName && !!o.committee && o.committeeName.trim().toLowerCase() !== o.committee.trim().toLowerCase();
  const sub = [showFull ? escapeHtml(o.committeeName!) : '', o.topic ? `Topic: ${escapeHtml(o.topic)}` : ''].filter(Boolean);
  return `<tr><td align="center" class="e-pad" style="padding:20px 36px 0 36px;font-family:${SANS};">`
    + `<div class="e-ink" style="font-size:22px;line-height:1.35;font-weight:700;color:#1C1410;">${escapeHtml(o.country)}${o.committee ? `, ${escapeHtml(o.committee)}` : ''}</div>`
    + (sub.length || o.committeeLogo
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:12px auto 0 auto;"><tr>`
        + (o.committeeLogo ? `<td valign="middle" style="padding-right:12px;">${logoDisc(o.committeeLogo, 40, '')}</td>` : '')
        + (sub.length ? `<td valign="middle" class="e-soft" style="font-size:13.5px;line-height:1.5;color:${INK_SOFT};text-align:left;">${sub.join('<br>')}</td>` : '')
        + `</tr></table>`
      : '')
    + `</td></tr>`;
}

/** The award, stated plainly: the award name big, then the seat it was won in:
 *  the round flag and country, the emblem and committee. */
function awardStatement(o: { award: string; country: string | null; flag: RowIcon | null; committee: string | null; committeeName: string | null; committeeLogo: string | null }): string {
  // The two seat cells sit side by side on a desktop card and STACK on a
  // phone (.e-stack in the media query). Left in one row, their min-content is
  // the sum of both columns: "The Democratic Republic of the Congo" beside a
  // 71-character committee needs 326px, which pushed the whole card past a
  // 320px screen and put the email into sideways scroll (QA, 23 Sep 2026).
  // Outlook desktop ignores the media query and keeps the row, which is right
  // at 600px.
  const cell = (img: string, top: string, sub: string | null) =>
    `<td valign="middle" class="e-stack" style="padding:0 10px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + (img ? `<td valign="middle" style="padding-right:10px;line-height:0;">${img}</td>` : '')
    + `<td valign="middle" style="font-family:${SANS};text-align:left;"><div class="e-ink" style="font-size:16px;line-height:1.3;font-weight:bold;color:#1C1410;">${escapeHtml(top)}</div>`
    + (sub ? `<div class="e-soft" style="font-size:12.5px;line-height:1.4;color:${INK_SOFT};">${escapeHtml(sub)}</div>` : '')
    + `</td></tr></table></td>`;
  const showFull = !!o.committeeName && !!o.committee && o.committeeName.trim().toLowerCase() !== o.committee.trim().toLowerCase();
  const seat = (o.country ? cell(o.flag ? rowIcon({ ...o.flag, alt: `Flag of ${o.country}` }, 40) : '', o.country, 'Representing') : '')
    + (o.committee ? cell(o.committeeLogo ? logoDisc(o.committeeLogo, 40, '') : '', o.committee, showFull ? o.committeeName : 'Committee') : '');
  return `<tr><td align="center" class="e-pad" style="padding:20px 36px 0 36px;font-family:${SANS};">`
    + `<div class="e-ink" style="font-size:24px;line-height:1.3;font-weight:700;color:#1C1410;">${escapeHtml(o.award)}</div>`
    + (seat ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 0 auto;"><tr>${seat}</tr></table>` : '')
    + `</td></tr>`;
}

function primaryButton(label: string, url: string): string {
  const l = escapeHtml(label);
  const u = escapeHtml(url);
  return `<tr><td align="center" class="e-pad" style="padding:30px 36px 8px 36px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td align="center" bgcolor="${FOREST}" class="e-btn" style="background-color:${FOREST};border-radius:999px;box-shadow:0 8px 18px -8px rgba(27,56,40,0.6);">`
    + `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${u}" style="height:50px;v-text-anchor:middle;width:300px;" arcsize="50%" stroke="f" fillcolor="${FOREST}"><center style="color:${GOLD};font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;">${l}</center></v:roundrect><![endif]-->`
    + `<!--[if !mso]><!--><a href="${u}" target="_blank" style="display:inline-block;padding:15px 40px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:bold;color:${GOLD};text-decoration:none;border-radius:999px;">${l}</a><!--<![endif]-->`
    + `</td></tr></table></td></tr>`;
}

function secondaryLink(label: string, url: string): string {
  return row(
    `<a href="${escapeHtml(url)}" target="_blank" class="e-accent" style="font-family:${SANS};font-size:15px;line-height:1.5;font-weight:bold;color:${FOREST};text-decoration:underline;">${escapeHtml(label)}</a>`,
    '14px 36px 0 36px', 'center');
}

function snapshotRow(s: EmailSnapshot): string {
  return row(
    `<img src="${escapeHtml(s.url)}" width="${s.width}" alt="${escapeHtml(s.alt)}" style="display:block;width:100%;max-width:${s.width}px;height:auto;border:1px solid #DDD4C0;border-radius:14px;margin:0 auto;box-shadow:0 14px 30px -16px rgba(27,56,40,0.45);font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_SOFT};" />`
    + (s.caption ? `<div class="e-muted" style="font-family:${SANS};font-size:12.5px;line-height:1.5;color:${MUTED};padding-top:8px;text-align:center;">${escapeHtml(s.caption)}</div>` : ''),
    '26px 36px 0 36px', 'center');
}

/** Who signs: the named secretariat (Secretary-General first, then up to two
 *  more), each with their title, then the conference. Falls back to the team. */
export function secretariatSignature(list: { name?: string | null; title?: string | null }[] | null | undefined): { name: string; title: string | null }[] {
  const people = (list ?? [])
    .map(p => ({ name: (p?.name ?? '').trim(), title: (p?.title ?? '').trim() || null }))
    .filter(p => p.name);
  const rank = (t: string | null) => (/secretary[- ]general/i.test(t ?? '') ? 0 : /deputy/i.test(t ?? '') ? 1 : 2);
  return people.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p.title) - rank(b.p.title) || a.i - b.i).slice(0, 3).map(x => x.p);
}

const STYLE = `<style>
:root{color-scheme:light dark;supported-color-schemes:light dark;}
.e-tile{background-color:#FFFFFF !important;color-scheme:light only;}
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a{text-decoration:none;}
@media only screen and (max-width:620px){.e-pad{padding-left:22px !important;padding-right:22px !important;}.e-h1{font-size:25px !important;}.e-card table{max-width:100% !important;}.e-card td{word-break:break-word;}.e-stack{display:block !important;width:100% !important;padding:0 0 14px 0 !important;}}
@media (prefers-color-scheme: dark){body,.e-page{background-color:#0E0D0A !important;}.e-card{background-color:#232019 !important;border-color:#3A352A !important;}.e-hair{border-color:#3A352A !important;}.e-ink,.e-ink div,.e-ink span,.e-ink strong,.e-ink em{color:#F3EFE6 !important;}.e-soft{color:#CFC7B8 !important;}.e-muted,.e-muted a,.e-muted div{color:#A79D8D !important;}.e-accent{color:#D9E4DC !important;}.e-label{color:#8FC3A0 !important;}.e-ring{background-color:#232019 !important;}.e-tile{background-color:#FFFFFF !important;}.e-link{color:#BFD3C6 !important;}.e-btn{background-color:#2F5A40 !important;}}
[data-ogsc] .e-page{background-color:#0E0D0A !important;}[data-ogsc] .e-card{background-color:#232019 !important;}[data-ogsc] .e-ink,[data-ogsc] .e-ink div,[data-ogsc] .e-ink span,[data-ogsc] .e-ink strong{color:#F3EFE6 !important;}[data-ogsc] .e-soft{color:#CFC7B8 !important;}[data-ogsc] .e-muted,[data-ogsc] .e-muted a{color:#A79D8D !important;}[data-ogsc] .e-accent{color:#D9E4DC !important;}[data-ogsc] .e-label{color:#8FC3A0 !important;}[data-ogsc] .e-link{color:#BFD3C6 !important;}[data-ogsc] .e-btn{background-color:#2F5A40 !important;}
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
  const marker = new RegExp(UNRESOLVED_MARKER_PATTERN);

  const logoAbs = theme.showLogo ? emailLogoUrl(conference.logo_url, siteUrl) : null;
  const place = [conference.city, conference.country].map(s => (s ?? '').trim()).filter(Boolean).join(', ') || null;
  const chip = emailDatesLabel(conference.start_date, conference.end_date, conference.dates_tbd);

  const countryIcon = (): RowIcon | null => {
    const crest = emailLogoUrl(media?.seatLogo, siteUrl);
    if (crest) return { kind: 'logo', url: crest, alt: '' };
    const flag = flagUrl(media?.countryCode);
    return flag ? { kind: 'flag', url: flag, alt: '' } : null;
  };
  const committeeLogo = emailLogoUrl(media?.committeeEmblem, siteUrl);
  const iconFor = (from: 'country' | 'committee' | undefined, label: string, value: string): RowIcon | null => {
    if (from === 'country') return countryIcon();
    if (from === 'committee' || /^committee$/i.test(label)) return committeeLogo ? { kind: 'logo', url: committeeLogo, alt: '' } : null;
    if (/^award$/i.test(label)) return { kind: 'art', url: awardArtUrl(value), alt: '' };
    return null;
  };
  const resolvedOrNull = (token: string): string | null => {
    const v = resolveTokens(token, ctx).trim();
    return v && !marker.test(v) ? v : null;
  };
  const countryName = resolvedOrNull('{{country}}');
  const committeeLabel = resolvedOrNull('{{committee}}');
  const factRows = (b: Extract<EmailBlock, { type: 'facts' }>): PassRow[] => {
    const rows = b.items
      .map(i => ({ label: i.label.trim(), value: resolveTokens(i.value, ctx).trim(), from: i.iconFrom }))
      .filter(i => i.label && i.value && i.value.replace(marker, '').trim() !== '')
      .map(i => ({ label: i.label, valueHtml: renderMarkedHtml(i.value, LINK), icon: iconFor(i.from, i.label, i.value), from: i.from }));
    // Money and seat events name the delegate's country with its flag even when
    // the template has no country row (the allocation already on the application).
    if (card.seat && countryName && !rows.some(r => r.from === 'country')) {
      const at = rows.findIndex(r => /^committee$/i.test(r.label));
      rows.splice(at >= 0 ? at + 1 : 0, 0, { label: 'Representing', valueHtml: escapeHtml(countryName), icon: countryIcon(), from: 'country' });
    }
    // Only the essentials: the dates are in the masthead already.
    return rows.filter(r => !/^dates?$/i.test(r.label));
  };

  const firstFacts = blocks.findIndex(b => b.type === 'facts');
  const firstHeading = blocks.findIndex(b => b.type === 'paragraph' && b.variant === 'heading' && !!b.content.trim());
  const banner = emailBannerUrl(conference);
  const firstRows = firstFacts >= 0 ? factRows(blocks[firstFacts] as Extract<EmailBlock, { type: 'facts' }>) : [];

  // The seat emails lead with the seat: a big round flag, then the plain line.
  const seatLed = (event === 'allocation_assigned' || event === 'allocation_changed' || event === 'delegation_swap') && !!countryName;
  const flag = countryIcon();
  const awardName = event === 'award_received' ? resolvedOrNull('{{award}}') : null;
  let hero = '';
  if (seatLed && flag) hero = rowIcon({ ...flag, alt: `Flag of ${countryName}` }, 140);
  else if (event === 'award_received') {
    const award = resolvedOrNull('{{award}}');
    if (award) hero = `<img src="${escapeHtml(awardArtUrl(award))}" width="112" height="112" alt="" style="display:block;width:112px;height:112px;border:0;margin:0 auto;" />`;
  } else if (card.icon) hero = `<img src="${EMAIL_ASSET_BASE}icons/${card.icon}.png" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border:0;margin:0 auto;" />`;

  let out = masthead({ banner, logo: logoAbs, logoAlt: `${conference.acronym || conference.full_name} logo`, name, meta: [chip, place].filter(Boolean).join(' · ') || null });
  if (hero) out += heroRow(hero);
  let headlineDone = false;
  const emitHeadline = (html: string) => {
    out += headline(html, hero ? 22 : 28) + hairlineRule();
    if (awardName) out += awardStatement({ award: awardName, country: countryName, flag, committee: committeeLabel, committeeName: (media?.committeeName ?? '').trim() || null, committeeLogo });
    if (seatLed) out += seatStatement({ country: countryName!, committee: committeeLabel, committeeName: (media?.committeeName ?? '').trim() || null, topic: (media?.committeeTopic ?? '').trim() || null, committeeLogo });
    headlineDone = true;
  };
  if (firstHeading < 0) emitHeadline(escapeHtml(name));

  let buttons = 0;
  let last = 'head';
  let bodyRun = '';
  const flushBody = () => {
    if (!bodyRun) return;
    out += row(bodyRun, '24px 36px 0 36px');
    bodyRun = '';
    last = 'body';
  };

  blocks.forEach((b, i) => {
    if (b.type === 'paragraph') {
      if (!b.content.trim()) return;
      const v = b.variant ?? 'body';
      const resolved = resolveTokens(b.content, ctx);
      if (v === 'heading') {
        flushBody();
        const html = renderMarkedHtml(resolved.replace(/\s*\n\s*/g, ' '), LINK);
        if (i === firstHeading && !headlineDone) emitHeadline(html);
        else out += row(`<div class="e-accent" style="font-family:${SANS};font-size:19px;line-height:1.3;font-weight:700;color:${FOREST};">${html}</div>`, '24px 36px 0 36px');
        last = 'heading';
        return;
      }
      const html = renderParagraphChunks(resolved, LINK, v === 'small' ? 10 : 12);
      if (html) bodyRun += (bodyRun ? `<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>` : '') + bodyCell(html, v === 'small' ? 'small' : 'body');
      return;
    }
    if (b.type === 'facts') {
      // The seat emails already said the seat; other rows stay, plainly.
      const rows = (i === firstFacts ? firstRows : factRows(b))
        .filter(r => !((seatLed || awardName) && (r.from === 'country' || r.from === 'committee' || /^committee$/i.test(r.label))))
        .filter(r => !(awardName && /^award$/i.test(r.label)));
      if (!rows.length) return;
      flushBody();
      out += detailRows(rows);
      last = 'facts';
      return;
    }
    if (b.type === 'image') {
      const abs = absolutizeUrl(b.url, siteUrl);
      if (!abs || /^data:/i.test(abs)) return;
      flushBody();
      out += row(`<img src="${escapeHtml(abs)}" width="528" alt="${escapeHtml(b.alt)}" style="display:block;width:100%;max-width:528px;height:auto;border-radius:12px;border:0;margin:0 auto;" />`, '22px 36px 0 36px', 'center');
      return;
    }
    // button
    const url = resolveButtonUrl(b, conference, { chairInviteToken, organizerInviteToken, importClaimToken });
    if (!url) return;
    const label = b.label?.trim() || BUTTON_FALLBACK_LABEL[b.destination] || 'Open link';
    flushBody();
    if (buttons === 0 && card.snapshot) out += snapshotRow(card.snapshot);
    out += buttons === 0 ? primaryButton(resolveTokens(label, ctx), url) : secondaryLink(resolveTokens(label, ctx), url);
    buttons++;
    last = 'button';
  });
  flushBody();
  if (buttons === 0 && card.snapshot) out += snapshotRow(card.snapshot);

  const footerLine = theme.footerLine.trim();
  if (footerLine) out += row(bodyCell(escapeHtml(footerLine).replace(/\n/g, '<br>'), 'small'), '22px 36px 0 36px');

  // Sign-off: named people, like a letter from the secretariat. The reply line
  // is true: send-emails sets reply_to to the conference's contact address.
  const signers = secretariatSignature(conference.display_secretariat);
  const canReply = !!(conference.contact_email ?? '').trim();
  const signoff = transactional || signers.length
    ? row(`<div class="e-hair" style="border-top:1px solid #EDE6D6;padding-top:22px;font-family:${SANS};">`
      + (canReply ? `<p class="e-soft" style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${INK_SOFT};">Reply to this email to reach the organisers.</p>` : '')
      + `<p class="e-soft" style="margin:0;font-size:15px;line-height:1.6;color:${INK_SOFT};">Warm regards,</p>`
      + (signers.length
        ? signers.map(p => `<p class="e-ink" style="margin:6px 0 0 0;font-size:15px;line-height:1.45;color:#1C1410;"><strong>${escapeHtml(p.name)}</strong>${p.title ? `<span class="e-soft" style="color:${INK_SOFT};">, ${escapeHtml(p.title)}</span>` : ''}</p>`).join('')
          + `<p class="e-soft" style="margin:6px 0 0 0;font-size:15px;line-height:1.45;color:${INK_SOFT};">${escapeHtml(name)}</p>`
        : `<p class="e-ink" style="margin:6px 0 0 0;font-size:15px;line-height:1.45;color:#1C1410;"><strong>The ${escapeHtml(name)} team</strong></p>`)
      + `</div>`, `${last === 'button' ? 22 : 30}px 36px 32px 36px`)
    : `<tr><td style="height:32px;line-height:32px;font-size:0;">&nbsp;</td></tr>`;

  // The conference's own social icons, in one row near the end.
  const socials = socialLinks(conference);
  const socialRow = socials.length
    ? row(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${socials
      .map(x => `<td style="padding:0 6px;"><a href="${escapeHtml(x.url)}" target="_blank" style="text-decoration:none;"><img src="${EMAIL_ASSET_BASE}social/${x.icon}.png" width="32" height="32" alt="${escapeHtml(x.label)}" style="display:block;width:32px;height:32px;border:0;" /></a></td>`)
      .join('')}</tr></table>`, '0 36px 30px 36px', 'center')
    : '';

  // Preheader: the seat when there is one, otherwise the first real paragraph.
  const preheader = seatLed
    ? `${countryName}${committeeLabel ? `, ${committeeLabel}` : ''} at ${name}. ${buildPreheader(blocks, ctx)}`.slice(0, 140)
    : buildPreheader(blocks, ctx);
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-card" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #E4DCC8;border-radius:18px;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 18px 40px -24px rgba(27,56,40,0.3);">
${out}
${signoff}
${socialRow}
</table>
</td></tr>
<tr><td align="center" style="padding:20px 20px 0 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td valign="middle" style="line-height:0;font-size:0;padding-right:7px;"><img src="${LEGACY_ASSETS}tile-gavelling.png" width="18" height="18" alt="" style="display:block;width:18px;height:18px;border:0;" /></td>
<td valign="middle" class="e-muted" style="font-family:${SANS};font-size:12px;line-height:18px;color:${MUTED};">Made with <a href="${escapeHtml(siteUrl)}" target="_blank" style="color:${MUTED};text-decoration:underline;">Gavelling</a> for ${escapeHtml(name)}</td>
</tr></table>
<div class="e-muted" style="font-family:${SANS};font-size:11.5px;line-height:1.7;color:${MUTED};padding-top:8px;"><a href="${escapeHtml(siteUrl)}/account/profile" target="_blank" style="color:${MUTED};text-decoration:underline;">Email preferences</a> &middot; <a href="${UNSUBSCRIBE_MARK}" target="_blank" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a></div>
${legal.length ? `<div class="e-muted" style="font-family:${SANS};font-size:10.5px;line-height:1.6;color:${MUTED};padding-top:8px;">${legal.map(l => escapeHtml(l)).join('<br>')}</div>` : ''}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
