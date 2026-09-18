// Where a visitor to a public conference page came from, as a CATEGORY.
//
// Privacy contract (CLAUDE.md §4, /privacy): this is aggregate, first-party
// counting. Nothing here is a cookie, nothing identifies a person, and the only
// things that ever leave the browser are the category below and, for 'other',
// the bare referring HOSTNAME (never a path or a query string). The server
// stores one integer per (conference, day, source); see the migration
// `conference_page_views_and_traffic_source` and /api/conference-view.

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

const SOCIAL = [
  'instagram.com', 'facebook.com', 'fb.com', 'fb.me', 'messenger.com', 'whatsapp.com', 'wa.me',
  'linkedin.com', 'lnkd.in', 'x.com', 'twitter.com', 't.co', 'tiktok.com', 'reddit.com',
  'youtube.com', 'youtu.be', 'threads.net', 'snapchat.com', 'discord.com', 'discord.gg',
  'telegram.org', 't.me', 'pinterest.com',
];
const SOCIAL_WORDS = ['instagram', 'facebook', 'fb', 'ig', 'whatsapp', 'linkedin', 'twitter', 'x', 'tiktok', 'reddit', 'youtube', 'threads', 'snapchat', 'discord', 'telegram', 'social'];
const SEARCH = ['bing.com', 'duckduckgo.com', 'yahoo.com', 'ecosia.org', 'yandex.ru', 'yandex.com', 'baidu.com', 'search.brave.com', 'qwant.com', 'startpage.com', 'naver.com'];
const SEARCH_WORDS = ['bing', 'duckduckgo', 'yahoo', 'ecosia', 'yandex', 'baidu', 'brave', 'qwant'];
const MAIL_HOSTS = ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'mail.yahoo.com', 'mail.proton.me', 'mail.aol.com', 'mail.zoho.com'];

function endsWithDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

/** google.com, google.co.uk, news.google.com, www.google.es ... */
function isGoogleHost(host: string): boolean {
  return /(^|\.)google\.[a-z.]{2,8}$/.test(host) || host === 'com.google.android.googlequicksearchbox';
}

function cleanHost(raw: string): string | null {
  const h = raw.toLowerCase().replace(/^www\./, '').slice(0, 253);
  return /^[a-z0-9.-]{1,253}$/.test(h) ? h : null;
}

export interface Classified { source: TrafficSource; host: string | null }

/**
 * Classify one page view. `ownOrigin` is the site's origin (location.origin);
 * `internalNav` is true when the page was reached by an in-app navigation, in
 * which case document.referrer still names the page the SITE was entered from
 * and must not be trusted.
 */
export function classifyTraffic(opts: {
  referrer: string;
  search: string;
  ownOrigin: string;
  internalNav: boolean;
}): Classified {
  const params = new URLSearchParams(opts.search);
  const utmSource = (params.get('utm_source') || '').trim().toLowerCase();
  const utmMedium = (params.get('utm_medium') || '').trim().toLowerCase();

  if (utmMedium === 'email' || utmMedium === 'e-mail' || utmMedium === 'newsletter' || utmSource === 'email' || utmSource === 'newsletter') {
    return { source: 'email', host: null };
  }
  if (utmSource) {
    if (utmSource === 'google' || utmSource.startsWith('google.')) return { source: 'google', host: null };
    if (utmSource === 'gavelling') return { source: 'gavelling', host: null };
    if (SOCIAL_WORDS.includes(utmSource) || SOCIAL.some(d => endsWithDomain(utmSource, d))) return { source: 'social', host: null };
    if (SEARCH_WORDS.includes(utmSource) || SEARCH.some(d => endsWithDomain(utmSource, d))) return { source: 'other_search', host: null };
    if (['social', 'paid_social', 'social-media'].includes(utmMedium)) return { source: 'social', host: null };
    return { source: 'other', host: cleanHost(utmSource) };
  }

  if (opts.internalNav) return { source: 'gavelling', host: null };
  if (!opts.referrer) return { source: 'direct', host: null };

  let url: URL;
  try { url = new URL(opts.referrer); } catch { return { source: 'direct', host: null }; }
  if (url.origin === opts.ownOrigin) return { source: 'gavelling', host: null };
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'gavelling.com' || host.endsWith('.gavelling.com')) return { source: 'gavelling', host: null };

  // Mail clients before Google / Yahoo: mail.google.com is not a search.
  if (MAIL_HOSTS.some(d => endsWithDomain(host, d)) || /^(web)?mail\./.test(host)) return { source: 'email', host: null };
  if (isGoogleHost(host) || (url.protocol === 'android-app:' && host.includes('google'))) return { source: 'google', host: null };
  if (SOCIAL.some(d => endsWithDomain(host, d))) return { source: 'social', host: null };
  if (SEARCH.some(d => endsWithDomain(host, d))) return { source: 'other_search', host: null };
  return { source: 'other', host: cleanHost(host) };
}

// ── First touch, kept in this browser only ──────────────────────────────────
// localStorage, never a cookie, so it is never sent anywhere by itself. The
// apply flow reads it once, when the application is created, and writes only
// the category onto the row. Expires after 90 days.

const FIRST_TOUCH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const firstTouchKey = (slug: string) => `gavelling-first-touch:${slug}`;

export function rememberFirstTouch(slug: string, source: TrafficSource): void {
  try {
    const existing = readFirstTouch(slug);
    if (existing) return;
    localStorage.setItem(firstTouchKey(slug), JSON.stringify({ s: source, t: Date.now() }));
  } catch { /* storage blocked: nothing to remember */ }
}

export function readFirstTouch(slug: string): TrafficSource | null {
  try {
    const raw = localStorage.getItem(firstTouchKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { s?: unknown; t?: unknown };
    if (!isTrafficSource(parsed.s) || typeof parsed.t !== 'number') return null;
    if (Date.now() - parsed.t > FIRST_TOUCH_TTL_MS) {
      localStorage.removeItem(firstTouchKey(slug));
      return null;
    }
    return parsed.s;
  } catch {
    return null;
  }
}
