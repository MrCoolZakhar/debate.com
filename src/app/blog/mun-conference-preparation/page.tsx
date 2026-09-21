import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Prepare for a MUN Conference: Complete Pre-Conference Checklist',
  description:
    'Everything you need to do before a Model UN conference: research, position papers, practice speeches, rules of procedure, and what to pack.',
  path: '/blog/mun-conference-preparation',
  ogDescription:
    'The complete MUN pre-conference preparation guide.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Prepare for a MUN Conference: Complete Pre-Conference Checklist',
  description: 'Complete MUN pre-conference preparation guide.',
  url: 'https://gavelling.com/blog/mun-conference-preparation',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-preparation' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Conference Preparation', item: 'https://gavelling.com/blog/mun-conference-preparation' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-conference-preparation"
        pitch="Chairs: prepare your committee setup in minutes with Gavelling."
      >

        <p>The gap between delegates who thrive at conferences and those who struggle almost always comes down to preparation done weeks before the gavel falls. This guide gives you a week-by-week preparation timeline and a complete checklist for everything you need before, during, and after your next MUN conference.</p>

        <H2>Six Weeks Out: Know Your Assignment</H2>
        <p>As soon as you receive your country and committee assignment, start researching. Do not wait for the background guide. The earlier you start, the deeper your understanding will be by conference day. If you are unsure what your committee does, read our guide to <Link href="/blog/mun-committee-types">MUN committee types</Link>.</p>
        <ul>
          <li>Look up your country&apos;s general foreign policy orientation: are they typically aligned with Western blocs, the G77, BRICS, or do they tend to take independent positions?</li>
          <li>Find your country&apos;s UN voting record on topics related to your committee&apos;s subject matter.</li>
          <li>Identify who the key decision-makers are in your country&apos;s foreign ministry and what recent statements they have made.</li>
        </ul>

        <H2>Four Weeks Out: Deep Research</H2>
        <p>When the background guide arrives, read it fully. Then go beyond it. Background guides are starting points, not finish lines.</p>
        <ul>
          <li><strong>Read at least three recent news articles</strong> on the committee topic from different perspectives (Western press, regional press, UN sources).</li>
          <li><strong>Find the most recent UN resolution</strong> on this topic and note how your country voted.</li>
          <li><strong>Identify two to three potential allies</strong> (countries likely to share your position) and two to three likely opponents.</li>
          <li><strong>Draft a rough position statement:</strong> three sentences: what is the problem, what does your country believe, what should the committee do.</li>
        </ul>

        <H2>Three Weeks Out: Write Your Position Paper</H2>
        <p>Most conferences require position papers three to four weeks before the conference. Do not treat this as an administrative task. Treat it as a speech outline. Your position paper becomes your opening speech, your working paper framework, and your negotiating position. Our <Link href="/blog/mun-position-paper-examples">position paper examples</Link> show what a finished one looks like.</p>
        <Callout>A good position paper has three sections: country background on the issue, your country&apos;s official stance with evidence, and specific proposed solutions. Two pages maximum. Every claim cited.</Callout>

        <H2>Two Weeks Out: Learn the Procedure</H2>
        <p>Read your conference&apos;s rules of procedure document. Every conference has one. The procedural differences between NMUN, HMUN, WIMUN, and school conferences can be significant. Know:</p>
        <ul>
          <li>What majority is required for substantive vs procedural votes?</li>
          <li>How are moderated caucuses proposed? What information is required?</li>
          <li>What is the speaker time default? Can it be changed by motion?</li>
          <li>What types of yields are permitted?</li>
          <li>How many sponsors and signatories are required for a draft resolution?</li>
        </ul>

        <H2>One Week Out: Practise Out Loud</H2>
        <p>Reading your speech is not the same as delivering it. Stand up and practise your opening speech out loud until it feels natural at the target length. Time yourself with a phone. If your conference has a sixty-second default, your speech should land in fifty to sixty seconds, not forty and not seventy.</p>
        <p>Practise one moderated caucus speech. Practise a point of information. If possible, do a practice session with your school&apos;s MUN club.</p>

        <H2>What to Pack</H2>
        <ul>
          <li><strong>Notepad and pens</strong>: you will be writing names, motion proposals, and resolution ideas constantly</li>
          <li><strong>Printed position paper copy</strong>: some dais teams ask to see it in person</li>
          <li><strong>Laptop or tablet</strong>: for collaborative document editing during caucuses</li>
          <li><strong>Portable charger</strong>: three days of full committee sessions drain every battery</li>
          <li><strong>Business cards</strong>: optional but impressive at large conferences for bloc-building</li>
          <li><strong><Link href="/blog/mun-dress-code">Appropriate dress</Link></strong>: western business formal is standard for most conferences</li>
        </ul>

        <H2>Day One: First Impressions Matter</H2>
        <p>Arrive early. Introduce yourself to the chairs and to delegates from your likely ally countries before the session opens. Being the person who starts conversations early sets the tone for the whole conference. The delegate who walks in with established relationships already has an advantage over the one who waits to be approached. For the rest of a first conference, hour by hour, see <Link href="/blog/mun-for-beginners">MUN for beginners</Link>.</p>

        <H2>After the Conference: Reflect and Improve</H2>
        <p>Write down three things that went well and three things to improve while the experience is fresh. Review any feedback from the dais, and check it against the <Link href="/blog/mun-common-mistakes">common mistakes</Link> chairs see. Keep your position papers: they are useful templates for future conferences on similar topics.</p>
      </ArticleLayout>
    </>
  );
}
