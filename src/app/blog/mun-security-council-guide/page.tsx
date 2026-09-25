import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Security Council Guide: Veto, P5, and How UNSC Works',
  description:
    'Everything you need to know about simulating the UN Security Council in MUN: veto power, P5 dynamics, procedure differences, and how to chair or delegate UNSC.',
  path: '/blog/mun-security-council-guide',
  ogDescription:
    'Master the UN Security Council simulation in Model UN.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Security Council Guide: Veto, P5, and How UNSC Works',
  description: 'Complete guide to the MUN Security Council simulation.',
  url: 'https://gavelling.com/blog/mun-security-council-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-security-council-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Security Council Guide', item: 'https://gavelling.com/blog/mun-security-council-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-security-council-guide"
        pitch="Gavelling supports veto mode for Security Council simulations: one P5 Against defeats the resolution automatically."
      >

        <p>The UN Security Council simulation is the most coveted placement at many Model UN conferences. It is small (fifteen delegates), intensely political, and operates under completely different dynamics to <Link href="/blog/mun-committee-types">General Assembly committees</Link>. If you have been assigned a UNSC role, or if you are chairing one, this guide will tell you exactly what you are walking into.</p>

        <H2>UNSC Composition</H2>
        <p>The real Security Council has fifteen members: five permanent members (P5) and ten non-permanent members elected for two-year terms. MUN simulations replicate this structure, sometimes with a fixed list of assigned nations, sometimes allowing the conference to choose which ten non-permanent members to include.</p>
        <p>The P5 are: the United States, United Kingdom, France, Russia, and China. Each holds permanent veto power over substantive resolutions. Our <Link href="/blog/mun-country-profiles">MUN country profiles</Link> are a quick way to read up on your seat.</p>

        <PhotoFigure id="un-security-council-nameplates" caption="Nameplates on the real Security Council table." />


        <H2>The Veto: How It Actually Works</H2>
        <p>A Security Council resolution passes only if it receives nine or more affirmative votes AND no P5 member votes Against. A single P5 member voting Against defeats the resolution, regardless of whether the other fourteen members vote in favour. This is the veto. Our guide to <Link href="/blog/mun-voting-procedures">MUN voting procedures</Link> covers how votes are run.</p>
        <Callout>Crucially: a P5 abstention is NOT a veto. A P5 member can abstain and the resolution still passes (if nine votes are reached). This matters enormously for Security Council diplomacy.</Callout>
        <p>In MUN simulations, the veto creates completely different bloc dynamics. No resolution can pass without at least tacit P5 acceptance. Non-permanent members must spend significant effort persuading P5 delegates to support or at minimum abstain.</p>

        <H2>Procedural Differences from GA Committees</H2>
        <p>UNSC simulations typically operate with far less formal procedure than GA committees. Expect:</p>
        <ul>
          <li><strong>No formal speakers list in many simulations.</strong> Chairs often run debate more conversationally, recognising delegates to speak without a formal queue.</li>
          <li><strong>More unmoderated caucus time.</strong> With only fifteen delegates, the whole committee can effectively negotiate in the room.</li>
          <li><strong>Faster document cycles.</strong> Working papers emerge and merge much faster in a fifteen-person room than in a hundred-person GA.</li>
          <li><strong>Consultations of the whole.</strong> Many UNSC simulations use &quot;consultations of the whole&quot;: a semi-informal full-committee discussion without a strict speakers list.</li>
        </ul>

        <H2>P5 Strategy</H2>
        <p>If you hold a P5 seat, you are the most powerful delegate in the room. Use it wisely:</p>
        <ul>
          <li><strong>Your veto threat is leverage.</strong> You rarely need to actually veto; the threat alone shapes resolution language. Use it in negotiations to extract concessions.</li>
          <li><strong>P5 coordination is critical.</strong> You can block any draft alone, but you cannot pass one alone: it needs nine votes and no veto from the other four. Align with at least some P5 members early.</li>
          <li><strong>Abstentions are a diplomatic tool.</strong> Publicly abstaining rather than vetoing signals that you have reservations but are not actively blocking progress. This is a real-world diplomatic move worth simulating.</li>
        </ul>

        <H2>Non-Permanent Member Strategy</H2>
        <p>Non-permanent members cannot veto, but they are not powerless. Nine votes are needed to pass a resolution, and with only five P5 members, at least four non-permanent votes are always required. This gives swing states real leverage, especially if two or more P5 members are already committed and you can deny the ninth vote.</p>

        <H2>Chairing a Security Council Simulation</H2>
        <p>Chairing UNSC is more like moderating a high-stakes negotiation than running a formal debate. Your key responsibilities:</p>
        <ul>
          <li><strong>Read the room constantly.</strong> With fifteen delegates, you can see every reaction, every side conversation. Use this to gauge when to push towards a vote or open another unmod.</li>
          <li><strong>Manage P5 personalities carefully.</strong> P5 delegates tend to dominate. Ensure non-permanent members have genuine speaking opportunities. Our guide to <Link href="/blog/mun-difficult-delegates">handling difficult delegates</Link> can help.</li>
          <li><strong>Know the veto maths.</strong> Before calling a vote, mentally count: do the sponsors have nine votes? Is any P5 threatening a veto? Calling a doomed vote wastes the committee&apos;s time.</li>
        </ul>

        <H2>Common Topics for UNSC Simulations</H2>
        <p>UNSC simulations typically address: ongoing armed conflicts (Syria, Sudan, Ukraine), nuclear non-proliferation, terrorism, sanctions regimes, and peacekeeping operations. The most interesting topics are those where the P5 have genuinely divergent interests. These create authentic diplomatic tension.</p>
      </ArticleLayout>
    </>
  );
}
