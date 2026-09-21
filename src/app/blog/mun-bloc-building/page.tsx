import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout } from '@/components/blog/prose';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Bloc Building: How to Form and Lead a Coalition',
  description:
    'A practical guide to building blocs in Model UN: how to find allies, draft collaboratively, handle defections, and lead a coalition to a successful resolution.',
  path: '/blog/mun-bloc-building',
  ogDescription:
    'Master coalition building in Model UN committees.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Bloc Building: How to Form and Lead a Coalition',
  description: 'Guide to bloc building in MUN.',
  url: 'https://gavelling.com/blog/mun-bloc-building',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-bloc-building' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Bloc Building', item: 'https://gavelling.com/blog/mun-bloc-building' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-bloc-building"
        pitch="Gavelling gives delegates real-time visibility into who is on the GSL, making it easier to spot allies and time your approaches."
      >
        <p>In Model UN, no resolution passes alone. Every passed resolution is the product of a coalition: delegates who found enough common ground to put their names on the same document and get it across the majority line. Bloc building is the skill that determines whether your ideas become committee output or stay in your notes. This is how to do it, and our guide to <Link href="/blog/mun-negotiation-tactics">MUN negotiation tactics</Link> covers the conversations that hold a bloc together.</p>

        <H2>Identify Your Natural Allies Before Committee Begins</H2>
        <p>Research the country list for your committee before the conference starts. Which countries typically vote together on your topic? Regional blocs (African Group, G77, EU, ASEAN) tend to vote in patterns that are well-documented in UN voting records. This research gives you your first target list before you have said a word in committee.</p>
        <p>Look up the last two or three UN resolutions on your topic and find which countries voted together. These are your likely natural allies.</p>

        <H2>Make Your Opening Speech a Recruitment Tool</H2>
        <p>Most delegates treat the <Link href="/blog/mun-opening-speech">opening speech</Link> as a statement. Strong delegates treat it as an invitation. End your speech with explicit coalition language: &quot;Denmark invites delegations that support a binding climate finance mechanism to collaborate on a working paper.&quot; You have just given potential allies a clear signal and a reason to find you during the first unmod.</p>

        <H2>First Unmoderated Caucus: Move Fast</H2>
        <p>The first <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus</Link> is where blocs form. Move immediately. Do not wait for people to come to you. Walk to your target allies, introduce yourself, and ask one question: &quot;What is [Country]&apos;s priority on this topic?&quot; Listen more than you speak. The delegate who listens in the first unmod learns more than the one who talks.</p>
        <ul>
          <li>Approach three to five delegates in the first five minutes</li>
          <li>Find the one or two who are most aligned and invite them to a small working group</li>
          <li>Start a shared document before the unmod ends, even if it only has a title and three bullet points</li>
        </ul>

        <H2>Giving Up Something to Gain More</H2>
        <p>No bloc forms without compromise. The delegate who insists on their exact language in every clause will end up with a small bloc and a failed resolution. Identify your non-negotiables (the two or three clauses you will not alter) and be flexible on everything else. Offering to adopt another delegate&apos;s preferred operative clause in exchange for their sponsorship is a trade worth making almost every time.</p>
        <Callout>A resolution with eight sponsors and broad support that passes beats a resolution with three sponsors and perfect language that fails. Always optimise for majority, not perfection.</Callout>

        <H2>Bringing in Swing Delegates</H2>
        <p>Every committee has swing delegates: delegations whose country position is genuinely ambiguous, or who have not committed publicly. These are your best targets for expanding a coalition. Approach them with a specific offer: &quot;If we add a clause on [their priority], would you be willing to sponsor?&quot; This is more effective than a general ask to join your bloc.</p>

        <H2>Handling Competing Working Papers</H2>
        <p>When two strong blocs emerge with competing <Link href="/blog/mun-working-paper-guide">working papers</Link>, you face a choice: compete or merge. Competing is only viable if you are confident your bloc can deliver the necessary majority without the other group&apos;s votes. If you cannot, merger negotiations are always worth attempting.</p>
        <p>In merger talks: identify the three clauses each side cares most about and try to preserve all six in the merged document. Accept that some language will be weakened. Agree on primary sponsor order upfront. Our <Link href="/blog/mun-resolution-example">MUN resolution example</Link> shows how a sponsor list signals a negotiated paper.</p>

        <H2>Keeping Your Bloc Together</H2>
        <p>Blocs fracture under pressure, especially when the other side makes targeted concessions to specific members. Keep your coalition informed: update them after every unmod, share the latest document version immediately, and be transparent about negotiations with opposing blocs. Defections happen when delegates feel uninformed or undervalued.</p>
        <p>Give your bloc members specific roles: one drafts preambulatory language, one manages the signatory list, one handles liaison with the opposing bloc. When people have ownership of a piece of the work, they stay invested.</p>

        <H2>The Vote Count</H2>
        <p>Before calling for introduction of your draft resolution, do a private head count. Go through every delegation in the room and estimate their vote: In Favour, Against, Abstain, or Unknown. If you cannot reach majority among your known supporters, do not introduce. Spend more time persuading the Unknowns first. A failed vote on your resolution is diplomatically damaging and hard to recover from.</p>
      </ArticleLayout>
    </>
  );
}
