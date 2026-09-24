// Where a visitor to a public conference page came from, as a CATEGORY plus,
// when it is known, a one-word DETAIL (the platform or site: instagram,
// whatsapp, bing, gmail, a utm_source value, or a bare referring hostname).
//
// Privacy contract (CLAUDE.md §4, /privacy): this is aggregate, first-party
// counting. Nothing here is a cookie, nothing identifies a person, and the only
// things that ever leave the browser are the category and, for 'other', the
// bare referring HOSTNAME (never a path or a query string). The user agent is
// read only in this browser, to recognise an in-app browser (Instagram,
// Facebook, ...), and never leaves it. The server stores one integer per
// (conference, day, source); see the migration
// `conference_page_views_and_traffic_source` and /api/conference-view. The
// first touch (category + detail word) is written onto an application when it
// is created (`applications.traffic_source` / `traffic_detail`).
//
// WHERE THE VISIT BEGAN (25 Sep 2026). A page reached by a client-side
// navigation still carries the referrer of the page the SITE was entered on,
// and a page reached after signing in carries the auth round trip (the auth
// modal's `?auth=`, Google's accounts page, the Supabase callback). Both used
// to read as "gavelling", which is how MUNBU's own shared link turned into
// "Gavelling conversion". So a visit is judged by its LANDING document (the
// navigation entry, i.e. the URL the browser really loaded after any HTTP
// redirect), never by the current location:
//   - landed on this conference (any page under /conferences/<slug>): the
//     referrer and utm_* of that landing decide, exactly as before;
//   - landed on an auth step (`?auth=`, /auth/*, a Google / Supabase / Apple
//     referrer): nothing is decided, unless the auth redirect was for THIS
//     conference and still carries an outside referrer;
//   - landed on another Gavelling page people discover conferences from
//     (home, Explore, map, country hubs, /conferences/all, roles, blog,
//     another conference): 'gavelling';
//   - landed on the visitor's own surfaces (/my-conferences, /account,
//     /manage, drafts, invites, session rooms): nothing is decided.
// "Nothing is decided" keeps what was stored and keeps looking.

export const TRAFFIC_SOURCES = [
  'google', 'gavelling', 'social', 'other_search', 'email', 'direct', 'other',
] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

export function isTrafficSource(v: unknown): v is TrafficSource {
  return typeof v === 'string' && (TRAFFIC_SOURCES as readonly string[]).includes(v);
}

export const TRAFFIC_SOURCE_LABEL: Record<TrafficSource | 'unknown', string> = {
  google: 'Google',
  gavelling: 'Gavelling',
  social: 'Social media',
  other_search: 'Other search',
  email: 'Email',
  direct: 'Direct link',
  other: 'Other websites',
  unknown: 'Not tracked',
};

/** The shape `applications.traffic_detail` accepts (CHECK in the database). */
const DETAIL_RE = /^[a-z0-9][a-z0-9.-]{0,79}$/;
export function cleanDetail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase().replace(/^www\./, '').replace(/[\s_]+/g, '-').slice(0, 80);
  return DETAIL_RE.test(v) ? v : null;
}

// host (or any subdomain of it) -> platform word
const SOCIAL_HOSTS: Record<string, string> = {
  'instagram.com': 'instagram', 'facebook.com': 'facebook', 'fb.com': 'facebook', 'fb.me': 'facebook',
  'messenger.com': 'facebook', 'whatsapp.com': 'whatsapp', 'wa.me': 'whatsapp',
  'linkedin.com': 'linkedin', 'lnkd.in': 'linkedin', 'x.com': 'x', 'twitter.com': 'x', 't.co': 'x',
  'tiktok.com': 'tiktok', 'reddit.com': 'reddit', 'youtube.com': 'youtube', 'youtu.be': 'youtube',
  'threads.net': 'threads', 'threads.com': 'threads', 'snapchat.com': 'snapchat', 'discord.com': 'discord',
  'discord.gg': 'discord', 'telegram.org': 'telegram', 't.me': 'telegram', 'pinterest.com': 'pinterest',
};
const SEARCH_HOSTS: Record<string, string> = {
  'bing.com': 'bing', 'duckduckgo.com': 'duckduckgo', 'yahoo.com': 'yahoo', 'ecosia.org': 'ecosia',
  'yandex.ru': 'yandex', 'yandex.com': 'yandex', 'yandex.com.tr': 'yandex', 'baidu.com': 'baidu',
  'search.brave.com': 'brave', 'qwant.com': 'qwant', 'startpage.com': 'startpage', 'naver.com': 'naver',
};
const MAIL_HOSTS: Record<string, string> = {
  'mail.google.com': 'gmail', 'outlook.live.com': 'outlook', 'outlook.office.com': 'outlook',
  'outlook.office365.com': 'outlook', 'mail.yahoo.com': 'yahoo-mail', 'mail.proton.me': 'proton',
  'mail.aol.com': 'aol', 'mail.zoho.com': 'zoho',
};
// Android app referrers (android-app://<package>/)
const APP_PACKAGES: Record<string, { source: TrafficSource; detail: string }> = {
  'com.whatsapp': { source: 'social', detail: 'whatsapp' },
  'com.whatsapp.w4b': { source: 'social', detail: 'whatsapp' },
  'com.instagram.android': { source: 'social', detail: 'instagram' },
  'com.facebook.katana': { source: 'social', detail: 'facebook' },
  'com.facebook.orca': { source: 'social', detail: 'facebook' },
  'com.facebook.lite': { source: 'social', detail: 'facebook' },
  'com.linkedin.android': { source: 'social', detail: 'linkedin' },
  'com.twitter.android': { source: 'social', detail: 'x' },
  'com.zhiliaoapp.musically': { source: 'social', detail: 'tiktok' },
  'com.ss.android.ugc.trill': { source: 'social', detail: 'tiktok' },
  'org.telegram.messenger': { source: 'social', detail: 'telegram' },
  'com.discord': { source: 'social', detail: 'discord' },
  'com.snapchat.android': { source: 'social', detail: 'snapchat' },
  'com.reddit.frontpage': { source: 'social', detail: 'reddit' },
  'com.google.android.youtube': { source: 'social', detail: 'youtube' },
  'com.instagram.barcelona': { source: 'social', detail: 'threads' },
  'com.google.android.gm': { source: 'email', detail: 'gmail' },
  'com.microsoft.office.outlook': { source: 'email', detail: 'outlook' },
  'com.google.android.googlequicksearchbox': { source: 'google', detail: 'google' },
};
// utm_source spellings -> platform word
const UTM_ALIASES: Record<string, string> = {
  ig: 'instagram', insta: 'instagram', fb: 'facebook', twitter: 'x', wa: 'whatsapp', whatsapp_status: 'whatsapp',
  yt: 'youtube', li: 'linkedin', tg: 'telegram', tt: 'tiktok',
};
const SOCIAL_WORDS = new Set(['instagram', 'facebook', 'whatsapp', 'linkedin', 'x', 'tiktok', 'reddit', 'youtube', 'threads', 'snapchat', 'discord', 'telegram', 'pinterest', 'social']);
const SEARCH_WORDS = new Set(['bing', 'duckduckgo', 'yahoo', 'ecosia', 'yandex', 'baidu', 'brave', 'qwant', 'startpage', 'naver']);
// Hosts a sign-in round trip passes through. Their referrer is never a source.
const AUTH_HOSTS = ['accounts.google.com', 'accounts.youtube.com', 'appleid.apple.com', 'supabase.co', 'supabase.com'];

function endsWithDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}
function lookup(map: Record<string, string>, host: string): string | null {
  for (const d of Object.keys(map)) if (endsWithDomain(host, d)) return map[d];
  return null;
}

/** google.com, google.co.uk, news.google.com, www.google.es ... */
function isGoogleHost(host: string): boolean {
  return /(^|\.)google\.[a-z.]{2,8}$/.test(host) || host === 'com.google.android.googlequicksearchbox';
}

function cleanHost(raw: string): string | null {
  const h = raw.toLowerCase().replace(/^www\./, '').slice(0, 253);
  return /^[a-z0-9.-]{1,253}$/.test(h) ? h : null;
}

/** An in-app browser that names itself in the user agent (read locally only). */
function inAppBrowser(ua: string): string | null {
  if (!ua) return null;
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/\bFB(AN|AV|_IAB)\b|FBIOS|\[FB/i.test(ua)) return 'facebook';
  if (/LinkedInApp/i.test(ua)) return 'linkedin';
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'tiktok';
  if (/Snapchat/i.test(ua)) return 'snapchat';
  if (/Twitter/i.test(ua)) return 'x';
  if (/Telegram/i.test(ua)) return 'telegram';
  return null;
}

// Gavelling paths that are the visitor's OWN surfaces or an auth step: an
// arrival from one of them says nothing about how the conference was found.
const OWN_SURFACE = /^\/(auth|my-conferences|account|manage|drafts|invites|delegate|chair|advisor|voting|unsubscribe|admin|delegation|api)(\/|$)/;

export interface Classified {
  source: TrafficSource;
  /** Bare host, only for 'other' (the page-view pipeline stores it). */
  host: string | null;
  /** Platform or site word, when known (instagram, whatsapp, bing, gmail, a host...). */
  detail: string | null;
}

/**
 * Classify one arrival. `ownOrigin` is the site's origin; `internalNav` is true
 * when the page was reached by an in-app navigation (then document.referrer
 * names the page the SITE was entered from and must not be trusted).
 * Returns NULL for an auth hop: a same-origin /auth/* referrer, a Google
 * accounts / Supabase / Apple referrer, or one of the visitor's own surfaces.
 * Null means "decide nothing, keep what was stored".
 */
export function classifyTraffic(opts: {
  referrer: string;
  search: string;
  ownOrigin: string;
  internalNav: boolean;
  userAgent?: string;
}): Classified | null {
  const params = new URLSearchParams(opts.search);
  const rawUtm = (params.get('utm_source') || '').trim().toLowerCase();
  const utmSource = UTM_ALIASES[rawUtm] ?? rawUtm;
  const utmMedium = (params.get('utm_medium') || '').trim().toLowerCase();

  if (utmMedium === 'email' || utmMedium === 'e-mail' || utmMedium === 'newsletter' || utmSource === 'email' || utmSource === 'newsletter') {
    const d = utmSource && utmSource !== 'email' && utmSource !== 'newsletter' ? cleanDetail(utmSource) : null;
    return { source: 'email', host: null, detail: d };
  }
  if (utmSource) {
    const asHost = utmSource.replace(/^www\./, '');
    if (utmSource === 'google' || utmSource.startsWith('google.')) return { source: 'google', host: null, detail: 'google' };
    if (utmSource === 'gavelling') return { source: 'gavelling', host: null, detail: null };
    if (SOCIAL_WORDS.has(utmSource)) return { source: 'social', host: null, detail: utmSource === 'social' ? null : utmSource };
    const socialByHost = lookup(SOCIAL_HOSTS, asHost);
    if (socialByHost) return { source: 'social', host: null, detail: socialByHost };
    if (SEARCH_WORDS.has(utmSource)) return { source: 'other_search', host: null, detail: utmSource };
    const searchByHost = lookup(SEARCH_HOSTS, asHost);
    if (searchByHost) return { source: 'other_search', host: null, detail: searchByHost };
    if (['social', 'paid_social', 'social-media'].includes(utmMedium)) return { source: 'social', host: null, detail: cleanDetail(utmSource) };
    return { source: 'other', host: cleanHost(utmSource), detail: cleanDetail(utmSource) };
  }

  if (opts.internalNav) return { source: 'gavelling', host: null, detail: null };
  if (!opts.referrer) {
    const app = inAppBrowser(opts.userAgent ?? '');
    if (app) return { source: 'social', host: null, detail: app };
    return { source: 'direct', host: null, detail: null };
  }

  let url: URL;
  try { url = new URL(opts.referrer); } catch { return { source: 'direct', host: null, detail: null }; }

  if (url.protocol === 'android-app:') {
    const pkg = url.hostname.toLowerCase();
    const known = APP_PACKAGES[pkg];
    if (known) return { source: known.source, host: null, detail: known.detail };
    if (pkg.includes('google')) return { source: 'google', host: null, detail: 'google' };
    return { source: 'other', host: cleanHost(pkg), detail: cleanDetail(pkg) };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const sameSite = url.origin === opts.ownOrigin || host === 'gavelling.com' || host.endsWith('.gavelling.com');
  if (sameSite) {
    if (OWN_SURFACE.test(url.pathname) || url.searchParams.has('auth')) return null;
    return { source: 'gavelling', host: null, detail: null };
  }
  if (AUTH_HOSTS.some(d => endsWithDomain(host, d))) return null;

  // Mail clients before Google / Yahoo: mail.google.com is not a search.
  const mail = lookup(MAIL_HOSTS, host);
  if (mail) return { source: 'email', host: null, detail: mail };
  if (/^(web)?mail\./.test(host)) return { source: 'email', host: null, detail: cleanDetail(host) };
  if (isGoogleHost(host)) return { source: 'google', host: null, detail: 'google' };
  const social = lookup(SOCIAL_HOSTS, host);
  if (social) return { source: 'social', host: null, detail: social };
  const search = lookup(SEARCH_HOSTS, host);
  if (search) return { source: 'other_search', host: null, detail: search };
  return { source: 'other', host: cleanHost(host), detail: cleanDetail(host) };
}

export interface Landing extends Classified {
  /** True when the visit began on a page of THIS conference. */
  onThisConference: boolean;
}

/** Is `path` a page of the conference `slug` (/conferences/<slug> or below)? */
function isConferencePath(path: string, slug: string): boolean {
  const base = `/conferences/${slug}`.toLowerCase();
  const p = path.toLowerCase();
  return p === base || p.startsWith(base + '/');
}

/**
 * Pure core of `classifyLanding`, so it can be checked without a browser.
 * `landingUrl` is the URL the browser really loaded (the navigation entry,
 * after any HTTP redirect), `referrer` that document's referrer.
 */
export function classifyLandingFrom(opts: {
  slug: string;
  landingUrl: string;
  referrer: string;
  ownOrigin: string;
  userAgent?: string;
}): Landing | null {
  let landing: URL;
  try { landing = new URL(opts.landingUrl); } catch { return null; }
  const base = { referrer: opts.referrer, ownOrigin: opts.ownOrigin, internalNav: false, userAgent: opts.userAgent };

  // An auth step (the modal's ?auth=, OAuth's ?auth=finish, /auth/*).
  if (landing.searchParams.has('auth') || OWN_SURFACE.test(landing.pathname)) {
    if (landing.pathname.startsWith('/auth/callback')) return null;
    // /auth/signin?next=/conferences/<slug>/... is a server redirect to
    // /?auth=signin&next=...: the browser keeps the referrer of the link that
    // started it, so an outside referrer still names where they came from.
    const next = landing.searchParams.get('next') || '';
    if (landing.searchParams.get('auth') !== 'finish' && isConferencePath(next.split('?')[0], opts.slug)) {
      const c = classifyTraffic({ ...base, search: '' });
      if (c && c.source !== 'gavelling') return { ...c, onThisConference: true };
    }
    return null;
  }

  if (isConferencePath(landing.pathname, opts.slug)) {
    const c = classifyTraffic({ ...base, search: landing.search });
    return c ? { ...c, onThisConference: true } : null;
  }

  // Began somewhere else on Gavelling (home, Explore, map, a country hub,
  // /conferences/all, roles, blog, another conference) and came here in the app.
  return { source: 'gavelling', host: null, detail: null, onThisConference: false };
}

/**
 * Where THIS visit to the conference `slug` began, judged by the landing
 * document. Browser only; null on the server or for an auth hop.
 */
export function classifyLanding(slug: string): Landing | null {
  if (typeof window === 'undefined' || !slug) return null;
  let landingUrl = window.location.href;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.name) landingUrl = nav.name;
  } catch { /* use the current location */ }
  try {
    return classifyLandingFrom({
      slug,
      landingUrl,
      referrer: document.referrer,
      ownOrigin: window.location.origin,
      userAgent: navigator.userAgent,
    });
  } catch {
    return null;
  }
}

// ── First touch, kept in this browser only ──────────────────────────────────
// localStorage, never a cookie, so it is never sent anywhere by itself. The
// apply flow reads it once, when the application is created, and writes the
// category and the detail word onto the row. Expires after 90 days.
// Version 2 (25 Sep 2026) adds the detail. A version-1 entry that says
// 'gavelling' was very likely an auth round trip filed under the old rule, so
// it is ignored (and replaced by the next real classification).

const FIRST_TOUCH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const firstTouchKey = (slug: string) => `gavelling-first-touch:${slug}`;

export interface FirstTouch { source: TrafficSource; detail: string | null }

export function readFirstTouch(slug: string): FirstTouch | null {
  try {
    const raw = localStorage.getItem(firstTouchKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { s?: unknown; d?: unknown; t?: unknown; v?: unknown };
    if (!isTrafficSource(parsed.s) || typeof parsed.t !== 'number') return null;
    if (Date.now() - parsed.t > FIRST_TOUCH_TTL_MS) {
      localStorage.removeItem(firstTouchKey(slug));
      return null;
    }
    if (parsed.v !== 2 && parsed.s === 'gavelling') return null;
    return { source: parsed.s, detail: typeof parsed.d === 'string' ? cleanDetail(parsed.d) : null };
  } catch {
    return null;
  }
}

export function rememberFirstTouch(slug: string, touch: FirstTouch): void {
  try {
    if (readFirstTouch(slug)) return;
    localStorage.setItem(firstTouchKey(slug), JSON.stringify({ s: touch.source, d: touch.detail ?? undefined, t: Date.now(), v: 2 }));
  } catch { /* storage blocked: nothing to remember */ }
}

/**
 * Keep where this visitor first came from, for the conference `slug`, if
 * nothing is stored yet and this visit's landing says something. Called on
 * the first render of every page under /conferences/<slug> (its layout), and
 * by the apply page. Counts no view and sends nothing anywhere.
 */
export function ensureFirstTouch(slug: string): FirstTouch | null {
  if (typeof window === 'undefined' || !slug) return null;
  const stored = readFirstTouch(slug);
  if (stored) return stored;
  const landing = classifyLanding(slug);
  if (!landing) return null;
  const touch = { source: landing.source, detail: landing.detail };
  rememberFirstTouch(slug, touch);
  return touch;
}
