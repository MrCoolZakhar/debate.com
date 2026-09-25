import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, ChairScript } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Chair Script: Exact Phrases for Every Situation',
  description:
    'A complete MUN chair script with exact phrases for opening, roll call, GSL, caucuses, voting, and closing. Copy-paste language for every committee situation.',
  path: '/blog/mun-chair-script',
  ogDescription:
    'The complete MUN chair script with language for every committee moment.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Chair Script: Exact Phrases for Every Situation',
  description: 'Complete MUN chair script with phrases for every committee situation.',
  url: 'https://gavelling.com/blog/mun-chair-script',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-chair-script' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Chair Script', item: 'https://gavelling.com/blog/mun-chair-script' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-chair-script"
        pitch="Gavelling automates the logistics so you can focus on the chair role, not the paperwork."
      >

        <p>New chairs often know what needs to happen next but freeze when they have to say it out loud to a room of fifty delegates. This guide provides word-for-word chair language for every standard committee moment, from the first gavel strike to final adjournment. Adapt these to your conference&apos;s specific rules, but use them as a starting point. Our guide to the <Link href="/blog/una-usa-rules-of-procedure">UNA-USA rules of procedure</Link> is a useful reference. If this is your first time on the dais, read <Link href="/blog/how-to-chair-first-mun">how to chair your first MUN</Link> too.</p>

        <H2>Opening the Session</H2>
        <ChairScript>&quot;The chair will call this session of the [Committee Name] to order. Welcome, delegates, to [Conference Name]. The topic before this committee is [Topic]. Before we begin, the chair will call roll. When your delegation is called, please respond &apos;Present&apos; or &apos;Present and Voting&apos;.&quot;</ChairScript>

        <H2>Roll Call</H2>
        <ChairScript>&quot;[Country name]... [pause for response]. [Country name]... [pause].&quot;</ChairScript>
        <p>If a delegation does not respond: &quot;The delegation of [Country] will be marked absent.&quot;</p>
        <p>After completing the roll:</p>
        <ChairScript>&quot;The chair notes that [X] delegations are present, constituting a quorum / not constituting a quorum. [If quorum] The committee will proceed to formal debate.&quot;</ChairScript>

        <H2>Opening the General Speakers List</H2>
        <ChairScript>&quot;The chair will now open the General Speakers List. Delegates wishing to be added to the list, please raise your placard. The default speaker time is [X] seconds. Delegates are reminded that they may yield remaining time to another delegate, to questions, or to the chair.&quot;</ChairScript>

        <H2>Calling a Speaker</H2>
        <ChairScript>&quot;The chair recognises the delegate of [Country]. You have [X] seconds. You may begin.&quot;</ChairScript>
        <p>When time expires:</p>
        <ChairScript>&quot;The delegate&apos;s time has expired. Thank you. The chair recognises the delegate of [next country].&quot;</ChairScript>

        <H2>Handling a Yield</H2>
        <p>Yield to another delegate:</p>
        <ChairScript>&quot;The delegate of [Country A] yields their remaining time to the delegate of [Country B]. The chair recognises the delegate of [Country B] with [X] seconds remaining. You may begin.&quot;</ChairScript>
        <p>Yield to questions:</p>
        <ChairScript>&quot;The delegate yields their remaining time to questions. Are there any points of information? The chair recognises the delegate of [Country].&quot;</ChairScript>

        <H2>Entertaining a Motion</H2>
        <ChairScript>&quot;The chair recognises the delegate of [Country] on a motion.&quot;</ChairScript>
        <p>After the motion is stated:</p>
        <ChairScript>&quot;The delegate of [Country] moves for a [type of motion]. Is there a second? [pause] The motion is seconded. The committee will now vote on this motion. All those in favour, please raise your placards... all those against... the motion [passes/fails] with [X] in favour and [Y] against.&quot;</ChairScript>

        <H2>Opening a Moderated Caucus</H2>
        <ChairScript>&quot;The committee will now enter a moderated caucus of [X] minutes, with [Y] seconds per speaker, on the topic of [topic]. Delegates wishing to speak during this caucus, please raise your placards now.&quot;</ChairScript>
        <p>Closing the caucus:</p>
        <ChairScript>&quot;The moderated caucus has concluded. The committee returns to the General Speakers List. The next speaker is the delegate of [Country].&quot;</ChairScript>

        <H2>Opening an Unmoderated Caucus</H2>
        <ChairScript>&quot;The motion passes. The committee will now take an unmoderated caucus of [X] minutes. Delegates are free to leave their seats. The committee will reconvene at [time]. Two minutes remaining. Delegates, please return to your seats.&quot;</ChairScript>

        <H2>Voting on a Resolution</H2>
        <ChairScript>&quot;The committee will now proceed to vote on Draft Resolution [number]. All those in favour, please raise your placards... all those against... abstentions... The resolution [passes/fails] with [X] in favour, [Y] against, and [Z] abstentions.&quot;</ChairScript>
        <p>For a roll-call vote:</p>
        <ChairScript>&quot;A roll-call vote has been requested. When your country is called, please state &apos;In Favour&apos;, &apos;Against&apos; or &apos;Abstain&apos;. [Country name]...&quot;</ChairScript>

        <H2>Ruling on a Point of Order</H2>
        <p>Our guide to <Link href="/blog/mun-points-explained">MUN points explained</Link> covers each type of point.</p>
        <ChairScript>&quot;The chair rules this point of order [well-taken / not well-taken]. [If well-taken:] The chair will [corrective action]. [If not well-taken:] The committee will continue.&quot;</ChairScript>

        <H2>Closing the Session</H2>
        <ChairScript>&quot;Delegates, the committee session is drawing to a close. [If time remains:] The committee will take up [X] more speakers before suspending. [At end:] The chair thanks all delegates for their contributions to today&apos;s session. This session of [Committee Name] is hereby suspended. [gavel]&quot;</ChairScript>

        <Callout>The most important script rule: when in doubt, slow down. A pause of two seconds feels much longer from the dais than it looks to the room. Take your time, breathe, and deliver each announcement clearly.</Callout>

        <p>For the moments no script covers, see our guides to <Link href="/blog/mun-controlling-the-floor">controlling the floor</Link> and <Link href="/blog/mun-difficult-delegates">handling difficult delegates</Link>.</p>
      </ArticleLayout>
    </>
  );
}
