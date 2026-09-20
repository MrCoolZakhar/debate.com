/**
 * The blog's five shelves, and the design language that hangs off them.
 *
 * A post declares nothing but `category: BlogCategory` in the manifest. Every
 * visible consequence of that choice is decided HERE, once: the words a reader
 * sees, the Lucide glyph, the accent colour, and which cover drawing the post
 * gets. Add a shelf by adding one entry; nothing else needs touching.
 *
 * The five accents are the Settings tab hues from the sessions side
 * (AGENTS.md → FEATURE: SETTINGS, "Icon colour"), on purpose: the blog is the
 * same product and should not invent a sixth palette. Every one of them clears
 * 4.4:1 on the ivory page AND on the gold ribbon, so the colour is never the
 * only signal and never the weak link.
 */

import { Gavel, Scale, Mic, CalendarRange, LayoutGrid } from 'lucide-react';
import type { BlogCategory, BlogPost } from '@/app/blog/posts';

export type PlateMotif = 'gavel' | 'ladder' | 'podium' | 'rooms' | 'panels' | 'ballot' | 'paper';

export interface Shelf {
  key: BlogCategory;
  /** The filter chip and the card eyebrow. Sentence case, never a shouted eyebrow. */
  label: string;
  /** One line under the shelf heading on the index. Short: §7 hates walls of text. */
  lead: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties; className?: string }>;
  /** Ink-strength accent: glyphs, rules, the cover drawing's line work. */
  accent: string;
  /** The same hue at wash strength, for a cover ground or a chip fill. */
  wash: string;
  /** The drawings this shelf's covers are made from. A post picks one of them
   *  by a hash of its slug, so a shelf of twelve guides is not one picture
   *  twelve times. Two is enough with the per-drawing variation on top. */
  motifs: PlateMotif[];
}

export const SHELVES: Record<BlogCategory, Shelf> = {
  chairing: {
    key: 'chairing',
    label: 'Chairing',
    lead: 'Running the room, from the gavel down.',
    icon: Gavel,
    accent: '#2A5A3C',
    wash: 'rgba(42, 90, 60, 0.10)',
    motifs: ['gavel', 'podium'],
  },
  procedure: {
    key: 'procedure',
    label: 'Rules and procedure',
    lead: 'What the rules actually say, and what conferences actually do.',
    icon: Scale,
    accent: '#2F6076',
    wash: 'rgba(47, 96, 118, 0.10)',
    motifs: ['ladder', 'ballot'],
  },
  delegates: {
    key: 'delegates',
    label: 'For delegates',
    lead: 'Speeches, papers, blocs and the awards at the end of them.',
    icon: Mic,
    accent: '#3D7A52',
    wash: 'rgba(61, 122, 82, 0.11)',
    motifs: ['podium', 'paper'],
  },
  organisers: {
    key: 'organisers',
    label: 'For organisers',
    lead: 'Planning a conference, briefing a dais, getting through the day.',
    icon: CalendarRange,
    accent: '#8A3B12',
    wash: 'rgba(138, 59, 18, 0.09)',
    motifs: ['rooms', 'paper'],
  },
  software: {
    key: 'software',
    label: 'Tools and comparisons',
    lead: 'What the software does, what it costs, and where each one wins.',
    icon: LayoutGrid,
    accent: '#7A5812',
    wash: 'rgba(122, 88, 18, 0.10)',
    motifs: ['panels', 'rooms'],
  },
};

/** Index order of the shelves. The filter row and the index sections read this. */
export const SHELF_ORDER: BlogCategory[] = ['chairing', 'delegates', 'procedure', 'organisers', 'software'];

/**
 * A small stable number from a slug, 0..(n-1).
 *
 * The cover drawings vary per post (how many delegation discs, where the gold
 * one sits, how the rule breaks) so that a shelf of twelve guides does not read
 * as twelve copies of one picture. It has to be DETERMINISTIC: the same post
 * must draw the same cover on the server and on the client, or React hydration
 * reports a mismatch, and the same cover on the index and on the article.
 * Hence a hash of the slug rather than anything random or time-based.
 */
export function seedFor(slug: string, n: number): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % n;
}

/**
 * Which of its shelf's drawings a post gets.
 *
 * By POSITION within the shelf, not by a hash of the slug. Hashing looked
 * cleaner and was measurably worse: hashing the nine delegate guides into two
 * buckets happened to land seven in one of them, so that shelf read as one
 * picture repeated down the page, which is the exact failure the drawings exist
 * to avoid. Position alternates them perfectly, and it is just as deterministic
 * (the manifest order is fixed), so the server and the client draw the same
 * thing and the index and the article agree.
 *
 * The cost: inserting a post in the middle of a shelf shifts the drawings of
 * the ones after it. That is cosmetic, and cheaper than a shelf of duplicates.
 */
export function motifFor(post: Pick<BlogPost, 'slug' | 'category'>, all: BlogPost[]): PlateMotif {
  const shelf = SHELVES[post.category];
  const within = all.filter((a) => a.category === post.category).findIndex((a) => a.slug === post.slug);
  return shelf.motifs[(within < 0 ? 0 : within) % shelf.motifs.length];
}

/** ISO date to the words a reader wants: "7 June 2026". */
export function formatPostDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Newest first, ties keeping the manifest's editorial order. */
export function byNewest(posts: BlogPost[]): BlogPost[] {
  return posts
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const d = (b.p.updated ?? b.p.date).localeCompare(a.p.updated ?? a.p.date);
      return d !== 0 ? d : a.i - b.i;
    })
    .map((x) => x.p);
}
