# Writing a blog post

Everything you need to add a guide to `/blog`. Two files change: the manifest,
and the post itself. Nothing else, ever: the sitemap, the index, the shelf
filters, the cross-links, the cover art, the contents rail and the call to
action all read from those two.

---

## 1. The shape

```
src/app/blog/posts.ts              the manifest: one entry per post
src/app/blog/<slug>/page.tsx       the post: metadata, JSON-LD, words
src/app/blog/blog.css              the prose styles (you will not need to touch this)
src/components/blog/               ArticleLayout, the prose kit, the cards, the art
docs/blog-authoring.md             this file
```

A post file contains exactly three things:

1. `export const metadata` from `pageMetadata()` (the `<title>`, description,
   canonical and the OG card),
2. the JSON-LD blocks,
3. `<ArticleLayout>` wrapping the words.

It contains **no styling**. There is no `style` object, no colour, no font
size, no padding. If a post could style itself, fifty posts would become fifty
designs, which is exactly how the section ended up with thirty-four hand-rolled
stylesheets and a 247px reading column on a phone.

---

## 2. Add the manifest entry

In `src/app/blog/posts.ts`, in the array, at the position you want it read in
(see "Order matters" below):

```ts
{
  slug: 'mun-crisis-directives',
  title: 'MUN Crisis Directives: How to Write One That Gets Executed',
  description: 'What a directive is, the three kinds, how to word them, and what backrooms actually reject.',
  category: 'chairing',
  date: '2026-09-20',
  readingMinutes: 9,
},
```

| Field | What it is |
|---|---|
| `slug` | The URL. `/blog/<slug>`. Lowercase, hyphens, never changes once published. |
| `title` | Written for a search result: the keyword first, a colon, then the promise. This is the card headline and, by default, the `<h1>`. |
| `description` | One sentence, no full stop needed. It is the card standfirst and the article's standfirst. |
| `category` | One of `chairing`, `delegates`, `procedure`, `organisers`, `software`. Decides the shelf, the icon, the accent colour and the cover drawing. |
| `date` | ISO, the day it is published. |
| `updated` | ISO. **Leave it out** until the content really changes. It is the sitemap's `lastmod`, and a lastmod that moves for nothing teaches Google to ignore ours. |
| `readingMinutes` | Whole minutes: words / 220, rounded up. |
| `featured` | At most ONE post in the file may set it. That post takes the lead card at the top of `/blog`. |
| `related` | Optional. Slugs to put FIRST in this post's "Keep reading" block. Rarely needed; see below. |
| `photo` | Optional. A photo id from `src/components/blog/photos.ts`: the article hero and the index card. Leave it out and the post gets the drawn cover. See section 5. |
| `author` | Optional. `'peter'` (see `src/components/blog/authors.ts`). Adds a byline and an author box; the post's JSON-LD `author` must then be `authorJsonLd('peter')`. Leave it out for a post published by Gavelling. |

**Order matters.** The array is the editorial order, and `RelatedGuides` walks
it: each post offers up to three guides from its own shelf and then tops up
from the posts that follow it in the array. That top-up is what guarantees post
N always links to post N+1, so the link graph is an unbroken ring and no post
is a dead end. Add new posts wherever they belong; do not sort the array.

A post whose slug is not in the manifest **throws at render**, on purpose: it
would otherwise be a page nothing links to and the sitemap never lists.

### "Keep reading", and when to override it

Six cards at the foot of every article, chosen in this order:

1. anything the post named in `related`, in that order (at most five),
2. up to three guides from the **same shelf**, nearest in the array first,
3. topped up from the **ring**: the posts immediately after this one, wrapping.

The default is right most of the time, so reach for `related` only when a guide
has a real sequel somewhere else, e.g. a delegate's position-paper guide
pointing at the chair's guide to judging them. Unknown slugs are skipped rather
than thrown: a typo costs one link, not the page.

Step 3 is not decoration. It always starts at the very next post in the array,
so post N always links to post N+1, the graph is an unbroken ring, and no post
can be a dead end. That is why `related` is capped at five of the six slots.

---

## 3. The post file

`src/app/blog/<slug>/page.tsx`. Copy this and replace the five marked values.

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Crisis Directives: How to Write One That Gets Executed',
  description:
    'What a directive is, the three kinds, how to word them, and what backrooms actually reject.',
  path: '/blog/mun-crisis-directives',          // MUST be this page's own path
  ogDescription: 'How to write a crisis directive that gets executed.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Crisis Directives: How to Write One That Gets Executed',
  description: 'How to write a crisis directive that gets executed.',
  url: 'https://gavelling.com/blog/mun-crisis-directives',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-crisis-directives' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Crisis Directives', item: 'https://gavelling.com/blog/mun-crisis-directives' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-crisis-directives"
        pitch="Gavelling keeps the crisis room on procedure: timers, speakers and motions in one place."
      >
        <p>The opening paragraph. It is set larger than the rest, automatically.</p>

        <H2>A section heading</H2>
        <p>Ordinary prose. Plain tags. <strong>Bold</strong> and <em>italic</em> work, and so does a
          link to <Link href="/blog/mun-glossary">another guide</Link>.</p>

        <H3>A sub heading</H3>
        <ul>
          <li>An ordinary list item</li>
        </ul>
      </ArticleLayout>
    </>
  );
}
```

### `<ArticleLayout>` props

| Prop | |
|---|---|
| `slug` | **Required.** Everything else about the post comes from the manifest entry with this slug. |
| `pitch` | The sentence in the call to action at the foot. Say what THIS guide's reader gets. Defaults to a generic line; write a real one. |
| `title` | Only if the `<h1>` should differ from the manifest title. Rare; one post uses it. |
| `dek` | Only if the standfirst should differ from the manifest description. Rare. |

Import only the prose components you actually use, or lint will complain.

---

## 4. The prose kit

Plain HTML for everything ordinary. These six for everything else. **Nothing
here takes a colour, a size or a `style`.**

### Links

- **Internal links use `<Link>` from `next/link`**, never a plain `<a>`:
  `<Link href="/blog/mun-glossary">the glossary</Link>`. A plain `<a href="/...">`
  to one of our own pages fails lint (`@next/next/no-html-link-for-pages`) and
  throws away client-side navigation. `<Link>` still renders a real `<a href>` in
  the server HTML, so crawlers see it exactly as they would a plain tag.
- **External links are a plain `<a href="https://...">`.**
- Link other guides in the body where the topic comes up, two to five per post,
  with anchor text that says what the reader gets. "Keep reading" at the foot is
  automatic and does not replace in-body links. Only link to a slug whose
  `src/app/blog/<slug>/` directory exists.

### `<H2>` and `<H3>`

```tsx
<H2>Chair's discretion</H2>
```

Use `<H2>` for every section heading, never a bare `<h2>`. It mints the anchor
id from the text (`#chairs-discretion`), hangs a copyable `#` link off it, and
**is what the contents rail counts**. `<H3>` is anchored too but never listed:
three levels is a table of contents nobody reads.

### Table of contents: automatic

There is nothing to declare. `ArticleLayout` walks the post's own JSX on the
server, collects the `<H2>`s in order, and renders the rail. Writing a heading
IS declaring a contents entry, so the two cannot disagree.

It appears at **four `<H2>`s or more**. Below that a contents list is furniture.
On desktop it is a sticky rail beside the prose; on a phone it is a folded
"In this guide" above it.

### `<Callout>`

```tsx
<Callout>Chair test: ask whether a reasonable person would call the statement a
misrepresentation, or simply a policy disagreement.</Callout>
```

The aside a reader should remember: a rule of thumb, a caution, the thing that
catches people out. One per section at most. Takes a string, or block children.

### `<ChairScript>`

```tsx
<ChairScript>"The motion passes. The committee will now enter a moderated
caucus of fifteen minutes, with ninety seconds per speaker."</ChairScript>
```

Words to say out loud from the dais. Forest ground, gold quote mark, set in
Playfair. **Only for actual spoken script.** It is loud, and it stops meaning
"say this" the moment it becomes a general quote box.

### `<FactCard title="...">`

```tsx
<FactCard title="Motion for a Moderated Caucus">
  Suspends the GSL for structured debate on a sub-topic. Requires a topic, a
  total time and a per-speaker time. Simple majority.
</FactCard>
```

One motion, one rule, one option. A run of them reads as a reference list.

### `<TableWrap>`

```tsx
<TableWrap>
  <table>
    <thead><tr><th>Feature</th><th>Gavelling</th></tr></thead>
    <tbody><tr><td>Price</td><td>Free</td></tr></tbody>
  </table>
</TableWrap>
```

**Wrap every table.** A comparison table is wider than a phone, and
`html, body { overflow-x: clip }` (globals.css) is the site's overflow
backstop: a table that overflows the page is not merely off screen, it is
unreachable. The wrapper scrolls instead, and it is the only thing that does.

Do not hand-stripe the rows. The zebra is a CSS `nth-child` rule.

### `<p className="gv-note">`

Small print under an example: a word count, a source line, an "as of" date.

### `<ul className="gv-check">`

A checklist: things ticked off rather than things in an order.

---

## 5. Cover photo, and the drawing behind it

Every post names a `photo` in the manifest. It is the article's hero (eager,
with its credit underneath) and the picture on its index and "Keep reading"
cards. Pick one relevant to the topic, and not one already used by the posts
next to it on the same shelf.

**Only photos from `src/components/blog/photos.ts`, and only licensed ones.**
Every entry there is free for commercial use, checked on the file's own source
page: Wikimedia Commons under CC0, public domain (US federal works included),
CC BY or CC BY-SA. No UN Photo library images, no stock agencies, nothing from
a Model UN platform, nothing associated with MyMUN, and nothing whose only
licence is "credit us". Credit is shown next to every photo: under the hero,
under an inline figure, as plain text on a card, and with links in the
"Photo credits" list at the foot of `/blog`.

To add a photo: a 1200 x 750 WebP (16:10, quality about 78) in
`public/blog/photos/`, and an entry in `photos.ts` with its alt text (what is
actually in it), author, licence, licence URL and source page.

**An inline photo** in the body: `<PhotoFigure id="..." caption="..." />` from
`@/components/blog/BlogPhoto`. One per post at most, where it genuinely helps.

A post with no `photo` (or whose photo is removed from `photos.ts`) falls back
to the drawn cover: inline SVG chosen by its `category` and varied by its
position on the shelf (`GuidePlate.tsx`, `blogTaxonomy.ts`).

---

## 6. House style

These are the rules the rest of the site is held to
(`CLAUDE.md` §8, `docs/ui-audit/00-DESIGN-RULEBOOK.md` §7). They apply here.

- **No em dashes.** Short sentences. A colon or a full stop instead.
- **No count or status pills.** Counts are plain typography.
- **Write the `pitch`.** A guide to the right of reply should not end on the
  same sentence as a guide to conference budgets.
- **One idea per section**, and a `<H2>` for each. Guides run 7 to 13 minutes.
- Escape `'` and `"` in JSX text (`&apos;`, `&quot;`) or lint will flag it.

---

## 7. Before you ship

```bash
npx tsc --noEmit
npx eslint src/app/blog src/components/blog
npm run check:indexability -- --base=http://localhost:3000   # with `npm run dev` up
```

Then look at the post at **375px and at 1280px**. Check that the contents rail
appears (or correctly does not), that the cover drawing is not the same one as
its neighbour on the index, and that any table scrolls inside its own box
rather than pushing the page sideways.

`npm run check:indexability` is the one that matters most: `/blog` must keep
linking to every post with a plain server-rendered `<a href>`, the new URL must
answer 200 with no redirect, be self-canonical, not be noindex, and carry a
title, an h1 and real text in the raw HTML. All of that is automatic if you
followed this file; the check is there for when it is not.
