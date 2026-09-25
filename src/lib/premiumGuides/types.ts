// Types shared by the premium guides: the content modules (server only), the
// block renderer (server and client) and the paywalled body route.
//
// A guide is written as a small markdown-like source (see parse.ts for the
// grammar) and parsed into Blocks. The public page renders the teaser blocks
// on the server; the rest only ever leaves the server through
// /api/guides/[slug], and only for a caller on Unlimited.

export type GuideAudience = 'Delegates' | 'Chairs' | 'Organisers';

/** Lucide icon names the cards and headers draw (see GuideIcon). */
export type GuideIconName =
  | 'Handshake'
  | 'Trophy'
  | 'Gavel'
  | 'TrendingUp'
  | 'ScrollText'
  | 'LayoutGrid'
  | 'Scale';

/**
 * A contributor credit. The owner will supply real contributor credits;
 * until then every guide ships with `authors: []` and no byline is shown.
 * Never invent a name, a title or an achievement here.
 */
export interface GuideAuthor {
  name: string;
  /** One honest line, e.g. "Secretary-General, Example MUN 2025". */
  credential?: string;
}

/** What a content module under ./content exports. */
export interface GuideSource {
  slug: string;
  title: string;
  /** Meta description, at most about 160 characters. */
  description: string;
  /** One line for the cards on /blog and /guides. */
  promise: string;
  audience: GuideAudience;
  icon: GuideIconName;
  /** How many leading H2 sections are public (the SEO teaser). */
  teaserSections: number;
  /** Content date, YYYY-MM-DD. Bump when the text changes. */
  updated: string;
  /** Real contributor credits only. Empty until the owner supplies them. */
  authors: GuideAuthor[];
  body: string;
}

export type Inline = string; // may contain **bold**; rendered by GuideBlocks

export type Block =
  | { t: 'h2'; id: string; text: Inline }
  | { t: 'h3'; id: string; text: Inline }
  | { t: 'p'; text: Inline }
  | { t: 'ul'; items: Inline[] }
  | { t: 'ol'; items: Inline[] }
  | { t: 'check'; items: Inline[] }
  | { t: 'note'; text: Inline }
  | { t: 'template'; title: string; lines: string[] }
  | { t: 'table'; head: Inline[]; rows: Inline[][] };

export interface TocEntry {
  id: string;
  text: string;
  /** False for sections behind the paywall. */
  free: boolean;
}

/** Public metadata: safe to render anywhere. */
export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  promise: string;
  audience: GuideAudience;
  icon: GuideIconName;
  updated: string;
  authors: GuideAuthor[];
  words: number;
  readingMinutes: number;
  toc: TocEntry[];
}
