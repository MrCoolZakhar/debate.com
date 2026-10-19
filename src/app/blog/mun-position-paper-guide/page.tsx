import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, H3, Callout } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUN Position Paper: Format, Structure and How to Write One';
const DESCRIPTION =
  'A MUN position paper is a one to two page statement of your country\'s stance on the topic, sent to the dais before the conference. Format and sections.';

const FAQ: FaqItem[] = [
  {
    question: 'What is a position paper in MUN?',
    answer:
      'A one- to two-page document written from your assigned country\'s perspective on the committee topic and submitted to the dais before the conference. It states the country\'s stance, the reasoning behind it and the solutions it will advocate.',
  },
  {
    question: 'What is the format of a MUN position paper?',
    answer:
      'A short header block (committee, topic, country, delegate and school), then three sections: country background and topic overview, the country\'s position, and proposed solutions. Always check your conference\'s own guidelines.',
  },
  {
    question: 'How long should a MUN position paper be?',
    answer:
      'Usually one to two pages. If the conference sets a page limit, keep to it exactly: chairs penalise papers that ignore instructions.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-position-paper-guide',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-position-paper-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-position-paper-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Position Paper Guide', item: 'https://gavelling.com/blog/mun-position-paper-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-position-paper-guide"
        pitch="Use Gavelling to manage your committee sessions with the same preparation mindset."
      >

        <p>A MUN position paper is a one- to two-page document, written from your assigned country&apos;s perspective, that sets out its stance on the committee topic and the solutions it will push for. It is submitted to the dais before the conference.</p>
        <p>A position paper is your entry ticket to serious MUN. Many conferences require one before committee even begins. Done well, it forces you to clarify your country&apos;s stance before walking in the door, and signals to chairs that you are prepared to lead. Done poorly, it reads like a Wikipedia summary with a flag at the top. This guide shows you how to write one that actually matters, and our <Link href="/blog/mun-position-paper-examples">position paper examples</Link> show finished papers, annotated.</p>

        <H2>What Is a MUN Position Paper?</H2>
        <p>A position paper is a one- to two-page document written from your assigned country&apos;s perspective on the committee topic(s). It is submitted to the dais before the conference and may be graded as part of your overall award. Its purpose is to articulate your country&apos;s official stance, the reasoning behind it, and the solutions your delegation will advocate for.</p>

        <PhotoFigure id="mun-delegate-notes" caption="Your position paper becomes your notes once debate starts." />


        <H2>Standard Format</H2>
        <p>Most conferences follow a similar structure. Always check your specific conference&apos;s guidelines; some have strict page limits, required headings, or particular citation formats.</p>

        <H3>Header Block</H3>
        <p>At the top of the paper include: Committee name, Topic, Country, Delegate name(s), and School/Institution. Keep this concise; it should not take up more than four lines.</p>

        <H3>Section 1: Country Background and Topic Overview</H3>
        <p>Briefly establish your country&apos;s relevant context. Our <Link href="/blog/mun-country-profiles">country profiles</Link> are a starting point. This is not a history lesson. It is a tight paragraph explaining why this issue matters to your country specifically. For example, if the topic is climate change adaptation and you represent Bangladesh, you would note that Bangladesh is among the most climate-vulnerable nations on earth, with 17% of its territory at risk from a one-metre sea level rise.</p>

        <H3>Section 2: Country Position</H3>
        <p>State your country&apos;s position explicitly. Not what you personally think, but what the government of your assigned country officially supports. Reference actual UN votes, treaties your country has signed, or statements from ministers. This is where research pays off. Our <Link href="/blog/mun-country-research">country research method</Link> shows where to find it.</p>
        <Callout>Avoid writing &quot;Country X believes...&quot; with no evidence. Always cite something: a UN resolution vote, a treaty, a government press release. It shows you did the work.</Callout>

        <H3>Section 3: Proposed Solutions</H3>
        <p>This is the most important and most under-written section. What does your country actually want the committee to do? Propose specific, actionable solutions that align with your country&apos;s interests. These should translate directly into <Link href="/blog/mun-clause-phrases">operative clauses</Link> in your eventual working paper. Vague proposals (&quot;increase international cooperation&quot;) are forgettable. Specific ones (&quot;establish a UN technology transfer fund capitalised at $10 billion annually&quot;) are not.</p>

        <H2>Research Sources That Actually Work</H2>
        <ul>
          <li><strong>UN Digital Library (digitallibrary.un.org):</strong> Full text of resolutions, voting records, and official UN documents.</li>
          <li><strong>Ministry of Foreign Affairs websites:</strong> Official government positions, speeches, and policy documents.</li>
          <li><strong>CIA World Factbook:</strong> Quick country background data.</li>
          <li><strong>UN data portal (data.un.org):</strong> Official UN statistics by country.</li>
          <li><strong>UN Treaty Collection:</strong> Which treaties has your country signed or ratified?</li>
          <li><strong>ReliefWeb, OCHA, UNHCR:</strong> For humanitarian and refugee topics.</li>
        </ul>

        <H2>Common Mistakes to Avoid</H2>
        <ul>
          <li><strong>Writing your personal opinion.</strong> You are representing a country, not yourself. Check every sentence: does the government of this country actually hold this view?</li>
          <li><strong>Padding with general topic information.</strong> Chairs have read fifty position papers. They do not need a paragraph explaining what climate change is. Get to your country&apos;s stance fast.</li>
          <li><strong>Proposing things your country opposes.</strong> Surprising as it sounds, delegates often propose solutions that contradict their country&apos;s actual UN votes. Check the voting record.</li>
          <li><strong>No citations.</strong> Every factual claim should have a source. Footnotes are fine.</li>
          <li><strong>Exceeding the page limit.</strong> If the limit is one page, write one page. Chairs penalise papers that ignore instructions.</li>
        </ul>

        <H2>Using Your Position Paper in Committee</H2>
        <p>Your position paper is also a speech outline. Your <Link href="/blog/mun-opening-speech">opening GSL speech</Link> should cover the same ground in sixty to ninety seconds. Your proposed solutions become the operative clauses of your working paper. If you have written a strong position paper, you have already done most of the intellectual work needed to lead debate.</p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
