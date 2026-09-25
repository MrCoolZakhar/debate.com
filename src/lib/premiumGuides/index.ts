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

/** Display order on /blog and /guides. */
const SOURCES: GuideSource[] = [bestDelegate, chairing, sponsorship, growth, clauseBank, committeeDesign, specialised];

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
