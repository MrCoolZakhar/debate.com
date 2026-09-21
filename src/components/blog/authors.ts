/**
 * The people who put their name to a guide.
 *
 * A post names its author in the manifest (`author: 'peter'` in
 * src/app/blog/posts.ts). A post with no author is published by Gavelling and
 * renders exactly as it always has: no byline, no author box, and its own
 * JSON-LD keeps the Organization author.
 *
 * A post WITH an author gets a byline under its title and an author box at the
 * end (ArticleLayout), and its JSON-LD author should be `authorJsonLd(key)`,
 * a schema.org Person. The publisher stays the Organization (JSONLD_PUBLISHER).
 */

import { SITE_URL } from '@/lib/seo';

export type BlogAuthorKey = 'peter';

export interface BlogAuthor {
  key: BlogAuthorKey;
  name: string;
  /** Short, under the name in the byline, and the JSON-LD jobTitle. */
  role: string;
  /** Site-relative path to a square photo. */
  photo: string;
  /** Pixel size of the photo file (it is square). */
  photoSize: number;
  /** Two or three sentences for the box at the end of an article. */
  bio: string;
  /** Where "More about" points. */
  href: string;
}

export const AUTHORS: Record<BlogAuthorKey, BlogAuthor> = {
  peter: {
    key: 'peter',
    name: 'Peter Zakhar',
    role: 'Co-founder of Gavelling',
    photo: '/PeterPic.jpg',
    photoSize: 600,
    bio:
      'Peter has competed at 32 Model UN conferences, winning five awards at Harvard and one at Oxford. ' +
      'He went on to train his own delegation, which won over 100 awards in a single year.',
    href: '/about',
  },
};

/** The schema.org Person for an authored post's Article JSON-LD. */
export function authorJsonLd(key: BlogAuthorKey) {
  const a = AUTHORS[key];
  return {
    '@type': 'Person',
    name: a.name,
    url: `${SITE_URL}${a.href}`,
    jobTitle: a.role,
    image: `${SITE_URL}${a.photo}`,
    worksFor: { '@type': 'Organization', name: 'Gavelling', url: SITE_URL },
  };
}
