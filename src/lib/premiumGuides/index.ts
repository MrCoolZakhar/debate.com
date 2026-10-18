import 'server-only';

// ── Premium MUN guides: the catalogue ────────────────────────────────────────
//
// Server only, on purpose. The full text of every guide lives in ./content and
// must never reach the public HTML or the client bundle: the public page
// renders the teaser (the first `teaserSections` H2 sections) and the table of
// contents, and the rest leaves the server only through
// src/app/api/guides/[slug]/route.ts, after my_unlimited_status() says the
// caller is on Unlimited. A client component that imported this file would
// fail the build ('server-only'), which is the guard.
//
// Honesty rule (owner, 25 Sep 2026): no guide promises an award or a result,
// and nothing says it was written by "world champions" or any named person
// unless that is real. `authors` stays empty until the owner supplies real
// contributor credits.

import type { Block, GuideMeta, GuideSource } from './types';
import { countWords, parseGuide } from './parse';
import sponsorship from './content/sponsorship-playbook';
import bestDelegate from './content/best-delegate-playbook';
import chairing from './content/chairing-playbook';
import growth from './content/regional-growth-playbook';
import clauseBank from './content/clause-bank';
import committeeDesign from './content/committee-design';
import specialised from './content/specialised-committees';
import partnerships from './content/partnerships-playbook';
import paidChairing from './content/paid-chairing-playbook';

/** Display order on /blog and /guides. /blog's three picks are the first
 *  guide of each audience (GuideCardGrid), so the lead guide per audience
 *  comes first: best delegate, chairing, sponsorship. */
const SOURCES: GuideSource[] = [
  bestDelegate, chairing, sponsorship, paidChairing, partnerships, growth, clauseBank, committeeDesign, specialised,
];

/** A card's preview runs to about PREVIEW_MAX characters and is never
 *  shorter than PREVIEW_MIN when the teaser has that much to give. */
const PREVIEW_MIN = 120;
const PREVIEW_MAX = 200;

/**
 * The card preview: the opening paragraphs of the PUBLIC teaser, **markup**
 * stripped, whole sentences up to about PREVIEW_MAX (adding one more while the
 * preview is under PREVIEW_MIN). A preview that still runs long is cut at a
 * word and ends in an ellipsis
 * (free text, never an identity: CLAUDE.md §8 rule 11; the card carries the
 * paragraphs it drew from as its title). Never reads the premium blocks.
 */
function buildPreview(teaser: Block[]): { preview: string; previewFull: string } {
  const paras: string[] = [];
  for (const b of teaser) {
    if (b.t !== 'p') continue;
    paras.push(b.text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim());
    if (paras.join(' ').length > PREVIEW_MAX) break;
  }
  const full = paras.join(' ');
  if (full.length <= PREVIEW_MAX) return { preview: full, previewFull: full };
  const sentences = full.match(/[^.!?]+[.!?]+(?:\s+|$)/g) ?? [full];
  let out = '';
  for (const s of sentences) {
    if (out.trim().length >= PREVIEW_MIN && (out + s).trim().length > PREVIEW_MAX) break;
    out += s;
    if (out.trim().length >= PREVIEW_MAX) break;
  }
  out = out.trim();
  if (out.length > PREVIEW_MAX + 30) {
    const cut = out.slice(0, PREVIEW_MAX);
    // Prefer a clause break; else the last whole word.
    const comma = cut.lastIndexOf(', ');
    const end = comma >= PREVIEW_MIN ? comma : cut.lastIndexOf(' ');
    out = `${cut.slice(0, end).replace(/[,;:]$/, '')}…`;
  }
  return { preview: out, previewFull: full };
}

export interface Guide {
  meta: GuideMeta;
  teaser: Block[];
  premium: Block[];
}

function build(src: GuideSource): Guide {
  const blocks = parseGuide(src.body);
  // Split at the (teaserSections + 1)th H2: everything before it is public.
  let seen = 0;
  let cut = blocks.length;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].t === 'h2') {
      seen++;
      if (seen === src.teaserSections + 1) { cut = i; break; }
    }
  }
  const teaser = blocks.slice(0, cut);
  const premium = blocks.slice(cut);
  const words = countWords(blocks);
  const toc = blocks.flatMap((b, i) => (b.t === 'h2' ? [{ id: b.id, text: b.text.replace(/\*\*/g, ''), free: i < cut }] : []));
  return {
    meta: {
      slug: src.slug,
      title: src.title,
      description: src.description,
      promise: src.promise,
      audience: src.audience,
      icon: src.icon,
      updated: src.updated,
      authors: src.authors,
      words,
      readingMinutes: Math.max(1, Math.round(words / 220)),
      toc,
      ...buildPreview(teaser),
    },
    teaser,
    premium,
  };
}

const GUIDES: Guide[] = SOURCES.map(build);
const BY_SLUG = new Map(GUIDES.map((g) => [g.meta.slug, g]));

export function listGuides(): GuideMeta[] {
  return GUIDES.map((g) => g.meta);
}

export function getGuide(slug: string): Guide | null {
  return BY_SLUG.get(slug) ?? null;
}
