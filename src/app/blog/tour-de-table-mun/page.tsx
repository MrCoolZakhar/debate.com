import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Tour de Table in MUN: What It Is and How Chairs Run It',
  description:
    'Everything about tour de table in Model UN: what it is, how it differs from the GSL, when to use it, and how chairs manage it with and without software.',
  path: '/blog/tour-de-table-mun',
  ogDescription:
    'The complete guide to tour de table in MUN committees.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Tour de Table in MUN: What It Is and How Chairs Run It',
  description: 'Complete guide to tour de table in MUN.',
  url: 'https://gavelling.com/blog/tour-de-table-mun',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/tour-de-table-mun' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Tour de Table MUN', item: 'https://gavelling.com/blog/tour-de-table-mun' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="tour-de-table-mun"
        pitch="Gavelling manages tour de table automatically: pre-filled queue, individual timers, total time tracking."
      >

        <p>Tour de table is one of the less commonly used debate formats in Model UN, but when deployed at the right moment it is extraordinarily effective. It gives every delegate a voice, ensures the committee has a complete picture of all positions, and prevents dominant blocs from monopolising the opening of debate. Here is everything chairs and delegates need to know.</p>

        <H2>What Is a Tour de Table?</H2>
        <p>Tour de table (French: "round the table") is a debate format in which every present delegation speaks in a fixed order (typically alphabetical by country name) for a short, equal amount of time. Unlike the General Speakers List, which delegates opt into, tour de table is inclusive by design: everyone gets a slot whether they want one or not.</p>
        <p>It is most commonly proposed at the very start of debate on a new topic, before positions have hardened, to ensure the committee hears from every delegation before blocs form. It is also used in smaller or more specialised committees where hearing every voice is particularly important.</p>

        <H2>How Tour de Table Differs from the GSL</H2>
        <ul>
          <li><strong>GSL:</strong> Voluntary, delegates add themselves, order determined by placard order, standard speaker time</li>
          <li><strong>Tour de table:</strong> Mandatory, all present delegates included, alphabetical order, typically shorter per-speaker time (thirty to sixty seconds)</li>
        </ul>
        <p>The GSL is better for sustained debate. Tour de table is better for getting a rapid snapshot of the full committee's positions.</p>

        <H2>How to Propose a Tour de Table</H2>
        <p>A delegate raises a placard and proposes: "I move for a tour de table of [total time] with [per-speaker time] per speaker." The motion requires a simple majority to pass. Total time should account for all present delegates. If forty delegates are present at thirty seconds each, that is twenty minutes minimum.</p>
        <Callout>Calculate before you propose. A tour de table with sixty delegations at sixty seconds each requires sixty minutes. Chairs can divide the question if the total time is too long, running half alphabetically per session.</Callout>

        <H2>Chairing a Tour de Table</H2>
        <p>As chair, your role is to call delegates in order and enforce the time limit strictly. With every delegation speaking, even small overruns compound into significant delays.</p>
        <ChairScript>"The committee has approved a tour de table of thirty minutes, with thirty seconds per speaker. Delegations will be called in alphabetical order. The chair will now call Argentina. The delegate of Argentina, you have the floor."</ChairScript>
        <p>If a delegate is absent when called, skip them and note it. They do not get a later slot unless the committee explicitly votes to allow it. Delegates who are present must speak when called. Passing is generally not permitted in tour de table.</p>

        <H3>Using Software for Tour de Table</H3>
        <p>Managing tour de table manually with a paper list and phone timer is feasible but error-prone, especially with large committees. Gavelling handles tour de table natively: it pre-populates the caucus queue with all present delegates in alphabetical order, runs the individual speaker timer, and tracks the total caucus time simultaneously. The chair simply calls each name and clicks Next Speaker.</p>

        <H2>What Delegates Should Do During Tour de Table</H2>
        <p>Tour de table speeches should be tight opening statements. With thirty or sixty seconds, you have room for exactly one thing: your country's core position. Do not try to cover multiple points. State your stance, and perhaps the one policy your country will advocate for most strongly.</p>
        <p>Listen carefully to other delegations' statements. You are getting real-time intelligence on where every bloc stands before the first unmoderated caucus begins. This is some of the most valuable information in the conference. Use it.</p>

        <H2>Strategic Considerations</H2>
        <p>For delegates with alphabetically early countries (Afghanistan, Albania, Algeria), tour de table is a gift: you speak first, set the tone, and have the rest of the tour to watch others respond to your framing. For delegates near the end of the alphabet, tour de table can feel frustrating as positions solidify before you speak. Counter this by being more decisive in your statement. If others have been vague, be specific.</p>
        <p>Tour de table is also strategically valuable for chairs who want to identify which delegates are unprepared early in the session, or to ensure shy delegates get at least one public speaking slot.</p>
      </ArticleLayout>
    </>
  );
}
