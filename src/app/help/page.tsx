import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import { HELP_SECTIONS } from '@/lib/helpContent';
import HelpClient from './HelpClient';

// ── /help ────────────────────────────────────────────────────────────────────
// Public and indexable. The h1, every section heading and every question are
// in the server-rendered HTML (HelpClient renders the full list on the server;
// the search box only filters what is already there).

export const metadata: Metadata = pageMetadata({
  title: 'Help center',
  description:
    'Answers about Gavelling: running a committee session, applying to a conference as a delegate or chair, organising a conference, and how credits and Unlimited work.',
  path: '/help',
  ogTitle: 'Gavelling Help Center',
});

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  url: 'https://gavelling.com/help',
  publisher: JSONLD_PUBLISHER,
  mainEntity: HELP_SECTIONS.flatMap((s) =>
    s.entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  ),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Help center', item: 'https://gavelling.com/help' },
  ],
};

export default function HelpPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <HelpClient />
    </>
  );
}
