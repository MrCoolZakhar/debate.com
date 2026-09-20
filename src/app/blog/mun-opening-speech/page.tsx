import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3 } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Write a MUN Opening Speech: Templates and Examples',
  description:
    'Write a standout MUN opening speech with this complete guide: structure, length, what to include, what to avoid, and real examples for different countries.',
  path: '/blog/mun-opening-speech',
  ogDescription:
    'Write a MUN opening speech that leads your bloc from minute one.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Write a MUN Opening Speech: Templates and Examples',
  description: 'Complete guide to writing a MUN opening speech.',
  url: 'https://gavelling.com/blog/mun-opening-speech',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-opening-speech' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Opening Speech', item: 'https://gavelling.com/blog/mun-opening-speech' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-opening-speech"
        pitch="Track your position on the GSL in real time with Gavelling as a delegate."
      >

        <p>Your opening speech on the General Speakers List is your first, and sometimes only, chance to define your delegation's position and attract bloc members. Most delegates waste it with a generic country summary. This guide shows you how to write one that actually moves the room.</p>

        <H2>How Long Should a MUN Opening Speech Be?</H2>
        <p>Match your conference's default speaker time, typically sixty to ninety seconds. If the default is sixty seconds, aim for fifty-five. Running over is disrespectful and gets you cut off mid-sentence. Running five seconds short is fine; it shows control. Do not pad.</p>
        <p>At sixty seconds of spoken word, you have approximately 140–160 words. That is not much. Every word must earn its place.</p>

        <H2>The Four-Part Structure</H2>

        <H3>1. Hook (one sentence)</H3>
        <p>Open with something that demands attention. The best hooks are specific, surprising, or directly challenge a prevailing assumption. Avoid: "The delegation of Norway is pleased to address this committee on the topic of..."</p>
        <p>Use instead: a statistic, a provocative claim, or a direct call to action.</p>

        <H3>2. Country Context (one to two sentences)</H3>
        <p>Why does this issue matter specifically to your country? Do not explain the issue to the committee; they know what it is. Explain your country's unique stake. "Norway, as a major hydrocarbon producer and simultaneously one of the world's highest per-capita investors in renewable energy, holds a particular responsibility to this debate."</p>

        <H3>3. Position (two to three sentences)</H3>
        <p>State what your country supports. Be specific. Reference real votes, treaties, or domestic policy if possible. This is what delegates will remember and react to.</p>

        <H3>4. Call to Action (one sentence)</H3>
        <p>End by inviting collaboration. "Norway looks forward to working with like-minded delegations on a framework that balances emission reductions with economic development needs." This signals that you are open to coalition-building without showing your hand on specific compromises.</p>

        <H2>Example Opening Speech: Climate Finance</H2>
        <div className="gv-script">
          <p>
            "The delegate of Germany rises to address one of the defining failures of the last decade: the developed world's broken promise of $100 billion annually in climate finance. Germany recognises its own obligations here; we have not always delivered. But recognition without action is insufficient. Germany strongly supports a new, binding climate finance architecture with transparent reporting requirements, loss-and-damage provisions, and meaningful technology transfer to the developing world. Germany invites all delegations, particularly fellow Annex II parties, to join us in drafting a resolution that closes the accountability gap. The time for aspirational language has passed."
          </p>
        </div>
        <p className="gv-note">Word count: 112. Approximate length at moderate pace: 55 seconds.</p>

        <H2>Example Opening Speech: Refugee Protection</H2>
        <div className="gv-script">
          <p>
            "One hundred and seventeen million people are currently displaced from their homes, a record that shames the international community. Jordan, as the country hosting the highest number of refugees per capita in the world, does not speak about this crisis abstractly. We live it. Jordan calls upon this committee to adopt a binding burden-sharing mechanism that distributes refugee admission quotas equitably among all member states, not just the neighbours of conflict zones. We are prepared to co-sponsor a working paper on this framework and urge delegations from the European Union and the Gulf states to join us at the table."
          </p>
        </div>

        <H2>Common Mistakes</H2>
        <ul>
          <li><strong>Starting with "The delegation of X is honoured/pleased/proud to..."</strong>: every delegate uses this. It wastes your first five seconds.</li>
          <li><strong>Explaining the topic.</strong> Everyone in the room knows what climate change is. Skip the background.</li>
          <li><strong>No concrete position.</strong> "X supports international cooperation" tells the room nothing.</li>
          <li><strong>No call to action.</strong> If you do not invite people to work with you, they will work with someone who did.</li>
          <li><strong>Reading word-for-word without eye contact.</strong> Know your speech well enough to look up frequently.</li>
        </ul>

        <H2>Getting on the GSL Early</H2>
        <p>Raise your placard the moment the chair opens the speakers list. Early slots matter, because delegates make bloc decisions based on what they hear in the first few speeches. Speaking fifth versus speaking fortieth is a significant advantage.</p>
      </ArticleLayout>
    </>
  );
}
