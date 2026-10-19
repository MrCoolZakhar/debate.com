/**
 * A post's visible FAQ and its FAQPage JSON-LD, drawn from ONE list.
 *
 * Google only honours FAQPage markup whose questions and answers are visible
 * on the page, word for word. Writing the schema and the prose separately is
 * how the two drift apart, so a post declares its questions once:
 *
 *   const FAQ: FaqItem[] = [{ question: '…', answer: '…' }];
 *   …
 *   <H2>Frequently Asked Questions</H2>
 *   <Faq items={FAQ} />
 *
 * The <H2> stays in the post so the contents rail (collectHeadings) sees it.
 * Answers are plain strings: no links, no markup, so the visible text and the
 * JSON-LD text are byte-identical by construction.
 */

import { Fragment } from 'react';
import { H3 } from './prose';

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPageJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}

export default function Faq({ items }: { items: FaqItem[] }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(items)).replace(/</g, '\\u003c') }}
      />
      {items.map((it) => (
        <Fragment key={it.question}>
          <H3>{it.question}</H3>
          <p>{it.answer}</p>
        </Fragment>
      ))}
    </>
  );
}
