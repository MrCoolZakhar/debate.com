// JSON-LD for the two Sessions entry pages, /join and /create/sessions.
// Server-only data (no 'use client'), rendered by each segment's layout.
//
// The FAQ is built from the ENGLISH values of the cj_join_* keys, the same
// strings JoinGuide renders under the /join card (English is what the server
// renders; a reader's own language is swapped in on the client). So the FAQPage
// can never claim something the page does not say.
import { absoluteUrl, JSONLD_PUBLISHER, OG_IMAGE_URL } from '@/lib/seo';
import { createJoinTranslations } from '@/lib/translationsCreateJoin';

const en = createJoinTranslations.en;

/** The Q/A pairs shown on /join, in display order. */
export const JOIN_FAQ = [
  ['cj_join_q_account', 'cj_join_a_account'],
  ['cj_join_q_code', 'cj_join_a_code'],
  ['cj_join_q_chair', 'cj_join_a_chair'],
  ['cj_join_q_phone', 'cj_join_a_phone'],
  ['cj_join_q_free', 'cj_join_a_free'],
  ['cj_join_q_lang', 'cj_join_a_lang'],
] as const;

/** The live-session app itself. Free: nothing in a committee room is charged. */
function webApplication(path: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Gavelling Sessions',
    url: absoluteUrl(path),
    description,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript. Works in any modern browser on a laptop, tablet or phone.',
    inLanguage: ['en', 'es', 'fr', 'ar', 'pt-BR'],
    isAccessibleForFree: true,
    image: OG_IMAGE_URL,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: JSONLD_PUBLISHER,
  };
}

function breadcrumbs(items: [string, string][]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}

export const JOIN_SCHEMAS = [
  webApplication(
    '/join',
    'Join a Model UN committee with the session code your chair shares. Delegates follow the speakers list, ask to speak, chat, submit papers and vote from their own phone. Chairs join with the chair code.',
  ),
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: JOIN_FAQ.map(([q, a]) => ({
      '@type': 'Question',
      name: en[q],
      acceptedAnswer: { '@type': 'Answer', text: en[a] },
    })),
  },
  breadcrumbs([
    ['Home', '/'],
    ['Sessions', '/sessions'],
    ['Join a session', '/join'],
  ]),
];

export const CREATE_SESSION_SCHEMAS = [
  webApplication(
    '/create/sessions',
    'Set up a Model UN committee in under a minute: name, topic, chairs and delegations. Then run roll call, the speakers list, motions, caucuses, documents and voting live. Free, no account needed.',
  ),
  breadcrumbs([
    ['Home', '/'],
    ['Create', '/create'],
    ['Create a committee', '/create/sessions'],
  ]),
];

/** JSON for a <script type="application/ld+json">, with `<` escaped so no value can close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
