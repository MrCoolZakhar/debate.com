// ── Shared Open Graph defaults ───────────────────────────────────────────────
// Next.js does NOT deep-merge `openGraph` from a layout into a page: a page that
// declares `openGraph` at all REPLACES the parent's object wholesale. So a page
// writing `openGraph: { url: '…' }` silently drops the layout's images,
// siteName, locale and type — and a link shared to WhatsApp, iMessage or Slack
// comes back as a bare URL with no picture, because those scrapers read Open
// Graph only (they ignore twitter:image).
//
// Every page that overrides openGraph must therefore spread OG_BASE first:
//
//   openGraph: { ...OG_BASE, url: '…', title: '…', description: '…' }

// NB: deliberately NOT `as const` — that widens to readonly tuples, which
// Next's OpenGraph type rejects.
export const OG_IMAGE = {
  url: 'https://gavelling.com/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Gavelling: MUN Conferences & Committee Software',
};

/** Spread this into any page-level `openGraph` so the card keeps its image. */
export const OG_BASE = {
  siteName: 'Gavelling',
  locale: 'en_US',
  type: 'website' as const,
  images: [OG_IMAGE],
};
