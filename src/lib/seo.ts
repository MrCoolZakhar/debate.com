import type { Metadata } from 'next';

// ── Shared page metadata ─────────────────────────────────────────────────────
//
// WHY THIS FILE EXISTS
//
// Next.js does NOT deep-merge `openGraph` from a layout into a page: a page that
// declares `openGraph` at all REPLACES the parent's object wholesale. So a page
// writing `openGraph: { url: '…' }` silently drops the layout's images,
// siteName, locale and type — and a link shared to WhatsApp, iMessage or Slack
// comes back as a bare URL with no picture, because those scrapers read Open
// Graph only (they ignore twitter:image). That regression has now shipped twice.
//
// The fix is not "remember to spread OG_BASE". The fix is `pageMetadata()`:
// every field a link preview needs — og:title, og:description, og:url, og:image
// (with dimensions, type and secure_url), the matching twitter block and the
// per-page canonical — is produced in one place from a tiny input. Forgetting
// og:image is now structurally impossible rather than merely unlikely.
//
// TWO RULES FOR ANY NEW PAGE
//
//  1. Use `pageMetadata({ title, description, path })`. Do not hand-roll an
//     `openGraph` object. If you genuinely must, spread `OG_BASE` first.
//  2. `path` is mandatory and must be THIS page's own path. `og:url` is the
//     object identity Facebook/WhatsApp key their preview cache on — a page
//     claiming to be '/' shares one cache entry with the homepage, which is
//     exactly why previews "break at random" and why fixes appear not to apply.
//     For that reason the root layout deliberately sets NO `openGraph.url`:
//     a wrong og:url is far worse than an absent one (scrapers fall back to the
//     requested URL when it is missing).
//
// `npm run check:og` enforces both rules against a real production server.

export const SITE_URL = 'https://gavelling.com';

/** Absolute URL for a route path. `''` and `'/'` both mean the homepage. */
export function absoluteUrl(path = ''): string {
  if (!path || path === '/') return SITE_URL;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// The share card. JPEG rather than the original RGBA PNG: WhatsApp in
// particular is unreliable with alpha-channel PNG thumbnails, and an opaque
// baseline JPEG at q85 is ~1/3 the bytes, comfortably under WhatsApp's
// practical thumbnail ceiling. Pixel-identical to og-image.png, which stays in
// public/ for any consumer that still references it.
export const OG_IMAGE_URL = `${SITE_URL}/og-image.jpg`;
const OG_IMAGE_ALT = 'Gavelling: MUN Conferences & Committee Software';

// NB: deliberately NOT `as const` — that widens to readonly tuples, which
// Next's OpenGraph type rejects.
export const OG_IMAGE = {
  url: OG_IMAGE_URL,
  secureUrl: OG_IMAGE_URL,
  type: 'image/jpeg',
  width: 1200,
  height: 630,
  alt: OG_IMAGE_ALT,
};

/**
 * Spread into any hand-written page-level `openGraph` so the card keeps its
 * image. Prefer `pageMetadata()` — this is the escape hatch, not the default.
 */
export const OG_BASE = {
  siteName: 'Gavelling',
  locale: 'en_US',
  type: 'website' as const,
  images: [OG_IMAGE],
};

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Build a complete OG image descriptor for an arbitrary absolute URL (a
 * conference banner, say). Emits og:image:type and og:image:secure_url when it
 * can work them out; omits width/height for images whose size we don't know,
 * since lying about dimensions makes scrapers discard the image.
 */
export function ogImage(url?: string | null, alt?: string) {
  if (!url || url === OG_IMAGE_URL) return OG_IMAGE;
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const type = EXT_MIME[ext];
  return {
    url,
    ...(url.startsWith('https://') ? { secureUrl: url } : {}),
    ...(type ? { type } : {}),
    alt: alt || OG_IMAGE_ALT,
  };
}

export interface PageMetadataInput {
  /**
   * The <title>. A plain string goes through the root `%s | Gavelling`
   * template; pass `{ absolute: '…' }` to opt out when the brand is already in
   * the string.
   */
  title: string | { absolute: string };
  description: string;
  /** THIS page's own path, e.g. `'/about'`. `''` is the homepage. */
  path: string;
  /** og:title / twitter:title. Defaults to `title` (its `absolute` if given). */
  ogTitle?: string;
  /** og:description / twitter:description. Defaults to `description`. */
  ogDescription?: string;
  /** Absolute image URL. Defaults to the site share card. */
  image?: string | null;
  imageAlt?: string;
  /** og:type. `'article'` for blog posts. */
  type?: 'website' | 'article';
  /** hreflang alternates, if the page has them. */
  languages?: Record<string, string>;
  /** Override the inherited robots directives (e.g. noindex a private page). */
  robots?: Metadata['robots'];
  keywords?: string[];
}

/**
 * The one way to declare page metadata. Always emits a complete Open Graph
 * block (title, description, url, siteName, locale, type, image + dimensions +
 * mime + secure_url), the matching twitter card, and a per-page canonical.
 *
 * There is deliberately no root-level canonical (see src/app/layout.tsx) — a
 * root canonical is inherited by every child and marks it a duplicate of the
 * homepage. Each page declares its own, here.
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const {
    title,
    description,
    path,
    ogTitle,
    ogDescription,
    image,
    imageAlt,
    type = 'website',
    languages,
    robots,
    keywords,
  } = input;

  const url = absoluteUrl(path);
  const plainTitle = typeof title === 'string' ? title : title.absolute;
  const socialTitle = ogTitle ?? plainTitle;
  const socialDescription = ogDescription ?? description;
  const img = ogImage(image, imageAlt ?? socialTitle);

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    ...(robots ? { robots } : {}),
    alternates: {
      canonical: url,
      ...(languages ? { languages } : {}),
    },
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      url,
      siteName: 'Gavelling',
      locale: 'en_US',
      type,
      images: [img],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: socialDescription,
      creator: '@wearegavelling',
      images: [img.url],
    },
  };
}
