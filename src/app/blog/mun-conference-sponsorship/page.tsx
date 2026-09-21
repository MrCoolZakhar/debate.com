import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Conference Sponsorship: Finding and Keeping Sponsors',
  description:
    'What sponsors are actually buying, what to offer at each tier, and the proposal that gets a meeting.',
  path: '/blog/mun-conference-sponsorship',
  ogDescription: 'What MUN sponsors buy, what to offer, and the proposal that gets a meeting.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Conference Sponsorship: Finding and Keeping Sponsors',
  description: 'What sponsors buy, the tier structure, the proposal, and how to keep them.',
  url: 'https://gavelling.com/blog/mun-conference-sponsorship',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-sponsorship' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Conference Sponsorship', item: 'https://gavelling.com/blog/mun-conference-sponsorship' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-conference-sponsorship"
        pitch="Gavelling charges the organiser nothing, so sponsorship goes into the conference rather than into the software line."
      >
        <p>This guide is about raising money <strong>for a conference you are hosting</strong>. If you are a school team trying to pay the fees to attend somebody else&apos;s conference, that is a different job with different funders, and it is covered in <Link href="/blog/mun-team-fundraising">our guide to MUN team fundraising</Link>. Sponsorship is the line in a <Link href="/blog/mun-conference-budget">conference budget</Link> that most secretariats assume will appear and most never seriously pursue, which is a shame, because the money is genuinely available and the number of competing requests is small.</p>

        <H2>What a sponsor is actually buying</H2>
        <p>Not your cause. Sponsors are not charities, and the fastest way to lose a meeting is to open by asking a business to support education. What they are buying is access to a specific, unusually attractive audience: several hundred academically engaged 15 to 22 year olds, in one building, for two days, with their parents one conversation away, and a mailing list that will still exist next year.</p>
        <p>Say it in those terms, because it is true and because it is the sentence that makes a marketing manager pay attention. Then be precise about the audience, because precision is what separates a proposal from a leaflet:</p>
        <ul>
          <li>How many delegates, and from how many schools or universities</li>
          <li>Their age range and their year groups</li>
          <li>Where they come from geographically</li>
          <li>How many faculty advisors and parents are in the building</li>
          <li>How many people see your materials before the event, which for most conferences is several times the number who attend</li>
        </ul>
        <Callout>If you cannot state your audience in five numbers, you are not ready to ask anyone for money. Use last year&apos;s figures and say they are last year&apos;s.</Callout>

        <H2>Who sponsors MUN conferences in practice</H2>
        <p>The list is shorter and more predictable than it looks, and it is worth working it in order of how likely each is to say yes.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Sponsor type</th><th>What they want</th><th>Typical form</th></tr></thead>
            <tbody>
              <tr><td>Universities and their admissions offices</td><td>Applicants. Your delegates are exactly their target year groups.</td><td>Cash, a stand, a speaker, sometimes the venue itself</td></tr>
              <tr><td>Tutoring, test prep and admissions consultancies</td><td>Direct access to motivated students and parents</td><td>Cash, materials in the delegate pack</td></tr>
              <tr><td>Law firms and professional services</td><td>Early-stage employer brand, plus local community work they can report</td><td>Cash, award sponsorship, a guest speaker</td></tr>
              <tr><td>Embassies and cultural institutes</td><td>Cultural diplomacy and visibility with young people</td><td>Speakers, venue, printing, small cash, occasionally a reception</td></tr>
              <tr><td>Local businesses</td><td>Goodwill and visibility among local families</td><td>Small cash, in-kind goods, catering</td></tr>
              <tr><td>NGOs and UN associations</td><td>Relevance to their mission, a platform for their topic</td><td>Speakers, materials, topic expertise, occasionally grants</td></tr>
              <tr><td>Hotels, airlines and coach companies</td><td>Volume bookings from visiting delegations</td><td>Discounted rates, which is money whether it feels like it or not</td></tr>
              <tr><td>Bookshops, stationers, printers</td><td>Local visibility at low cost</td><td>In-kind supply, which removes whole budget lines</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Your best first approach is almost always the institution you are already attached to. If you are a university society, your own university&apos;s outreach or admissions budget is the shortest path to a yes and the least awkward to ask.</p>

        <H2>Cash, in-kind and media partnerships</H2>
        <p>Secretariats chase cash and undervalue in-kind, which is usually the wrong way round.</p>
        <p><strong>Cash</strong> is flexible and easy to account for. It is also the hardest thing to get, because it comes from a budget that somebody has to defend.</p>
        <p><strong>In-kind</strong> removes a line rather than funding it. A printer who produces 400 delegate packs, a caterer who supplies lunch at cost, a venue that waives the hire fee, a hotel that blocks rooms at a rate your delegations can afford. Each of these is worth more to your budget than the equivalent cash, because it comes without the administration and often without the tax and receipting questions. It is also frequently easier to say yes to: a marketing budget needs approval, spare capacity does not.</p>
        <p><strong>Media partnership</strong> means a local paper, a student publication, or an education site promotes the conference in exchange for a credit and access. No money changes hands and it directly reduces the marketing problem described in <Link href="/blog/mun-conference-marketing">our guide to filling your committees</Link>.</p>
        <p>Value the in-kind in your accounts anyway, at what you would otherwise have paid. It is the only way to know whether the partnership is worth renewing, and it is the number you put in next year&apos;s proposal.</p>

        <H2>The tier structure</H2>
        <p>Three tiers. Not five, which nobody reads, and not one, which gives a sponsor nothing to choose between. Set the prices against your own budget: the top tier should cover a meaningful chunk of a real line, and the bottom tier should be small enough for a local business to approve without a meeting.</p>
        <TableWrap>
          <table>
            <thead><tr><th></th><th>Supporting</th><th>Partner</th><th>Principal</th></tr></thead>
            <tbody>
              <tr><td>Rough share of one budget line</td><td>A small line, such as printing</td><td>A medium line, such as catering for a day</td><td>A large line, or the venue</td></tr>
              <tr><td>Logo on website</td><td>Yes</td><td>Yes, larger</td><td>Yes, top position</td></tr>
              <tr><td>Logo on delegate materials</td><td>Programme only</td><td>Programme and badges</td><td>Everything, including backdrop</td></tr>
              <tr><td>Social media</td><td>One mention</td><td>Three posts</td><td>Announcement post plus coverage</td></tr>
              <tr><td>Stand or table</td><td>No</td><td>Yes, one day</td><td>Yes, both days, prime position</td></tr>
              <tr><td>Speaking</td><td>No</td><td>No</td><td>Three minutes at the opening ceremony</td></tr>
              <tr><td>Named award</td><td>No</td><td>One committee</td><td>A conference-wide award</td></tr>
              <tr><td>Materials in delegate pack</td><td>No</td><td>One item</td><td>One item, plus a branded item</td></tr>
              <tr><td>Post-conference report</td><td>Yes</td><td>Yes</td><td>Yes, with photographs</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two cautions on that table. First, be careful with named awards: a sponsor-named award is normal and harmless, but a sponsor who expects influence over who wins is not, and the line has to be stated in writing before the money arrives. Second, speaking slots at the opening ceremony are the most requested and most damaging benefit. Three minutes is three minutes. A sponsor who runs to twelve has taken committee time from 400 delegates, and it will be remembered as your fault, not theirs. Brief them, give them a card with the time on it, and have someone stand up when it expires.</p>

        <H2>The proposal: eight slides, and what each must contain</H2>
        <p>Send a short deck, as a PDF, attached, with the key numbers also in the body of the email so it can be read without opening anything.</p>
        <FactCard title="The eight slides">
          <p><strong>1. The conference.</strong> Name, dates, venue, city, which year it is. One photograph.</p>
          <p><strong>2. The audience.</strong> The five numbers. This is the slide they will screenshot.</p>
          <p><strong>3. What it is.</strong> Two sentences on Model UN for someone who has never heard of it. Assume they have not.</p>
          <p><strong>4. Who runs it.</strong> Named secretariat, the institution behind you, and the years you have been running.</p>
          <p><strong>5. Reach before the day.</strong> Website, mailing list, social following, partner schools. The pre-event reach is usually your strongest number.</p>
          <p><strong>6. The tiers.</strong> The table above, with prices.</p>
          <p><strong>7. Bespoke options.</strong> One slide inviting them to propose something else, because the best partnerships are the ones they design.</p>
          <p><strong>8. Contact and deadline.</strong> A named person, a direct email, a phone number, and the date by which materials must be with you to be printed.</p>
        </FactCard>
        <p>Keep the deck under 2 MB. Do not use a template that looks like a startup pitch. And put a real deadline on slide eight, because the print deadline is genuine and it is the only urgency you honestly have.</p>

        <H2>The cold approach, and the timing inside their year</H2>
        <p>Three things determine whether a cold approach works: who it is addressed to, when it arrives, and how short it is.</p>
        <p><strong>Who.</strong> Never info@. For a business, the marketing manager or the community or CSR lead. For a university, the outreach, widening participation or schools liaison team, who are far more receptive than admissions. For a law firm, the graduate recruitment or early careers manager. For an embassy, the cultural or public diplomacy attaché. Find the name on LinkedIn or the website, and address it to them.</p>
        <p><strong>When.</strong> Budgets are set annually and spent unevenly. Approach three to six months before your conference, and, if you can find out, in the first half of their financial year, when budget still exists. Approaching in the last two months of a financial year sometimes works for the opposite reason, which is underspend, but you cannot rely on it.</p>
        <p><strong>How short.</strong> Under 150 words, with the ask in it.</p>
        <FactCard title="The cold email">
          <p><strong>Subject:</strong> Sponsoring DELMUN 2027, 180 students, 14 to 15 March</p>
          <p>Dear Ms Okonjo,</p>
          <p>I am the Secretary-General of DELMUN, a Model UN conference held at [Venue] in [City]. In March we expect around 180 students aged 14 to 18 from 14 schools across [region], plus their teachers, for two days.</p>
          <p>We are looking for three partners this year. Support ranges from 250 to 1,500, and includes your brand on delegate materials, a stand on both days, and a named award. The one-page detail is attached.</p>
          <p>Would you have fifteen minutes in the next fortnight for a call? Materials need to be with us by 20 January to be printed.</p>
          <p>Best wishes, [Name], Secretary-General, DELMUN</p>
        </FactCard>
        <p>Follow up once, after eight working days, in the same thread, with two sentences. Then stop. A third chase converts almost nothing and costs you the relationship next year.</p>

        <H2>Embassies and cultural institutes are a different process</H2>
        <p>They are worth pursuing, and they operate on a different clock and a different logic. Expect a lead time of three to six months, sometimes more. Expect the answer to come through a cultural attaché rather than a marketing team. Expect the currency to be a speaker, a venue for a reception, printed materials, or a small cultural grant rather than a cheque.</p>
        <p>What helps: a committee topic genuinely relevant to their country, an invitation to speak rather than only an ask for money, formal letterhead, and patience. Write to the embassy&apos;s cultural section by post or formal email, address it correctly, and give the date well in advance. What does not help: a generic deck, a short deadline, and any suggestion that the country is being simulated in a way they might find objectionable. If your Security Council topic is about their border, do not ask them to sponsor it.</p>

        <H2>Delivering what you sold</H2>
        <p>This is where most student-run conferences lose the renewal, and it is entirely avoidable. Sponsorship benefits are promised in October by one person and delivered in March by a team who never read the agreement.</p>
        <ul className="gv-check">
          <li>Write every commitment into a one-page agreement, signed by both sides. Not a contract, a list.</li>
          <li>Give one named secretariat member the job of delivering sponsor benefits, and nothing else that day.</li>
          <li>Put every deliverable in the run of show with a time, including the stand setup and the three-minute speech. Our <Link href="/blog/mun-conference-day-operations">conference day operations guide</Link> covers how that schedule is built.</li>
          <li>Photograph the evidence as it happens: the logo on the backdrop, the stand with students at it, the award being presented. Nobody can go back for these.</li>
        </ul>

        <H2>The post-conference report, which is the actual product</H2>
        <p>Send it within two weeks, as a two-page PDF. It is the single highest-value document in this entire guide, because it is what makes the second year possible, and almost nobody sends one.</p>
        <p>What goes in it: final delegate and school numbers, the audience description confirmed against reality, each promised benefit ticked off with a photograph, the reach figures from your social and website, one or two quotes from delegates or advisors, and a thank you signed by a named person. Then a single closing line naming next year&apos;s dates and asking whether they would like the same package again.</p>
        <Callout>A sponsor who receives an honest report will renew at a far higher rate than a sponsor who receives nothing, even when the conference itself went imperfectly. Reporting a smaller number than you forecast, and saying so, costs you much less than silence.</Callout>

        <H2>Renewal is worth more than any new sponsor</H2>
        <p>Every hour spent on a renewal is worth several spent on a cold approach. The renewal conversation is short, the negotiation is about the tier rather than the concept, and the sponsor already has a budget line with your name in it. Two mechanics make it happen: send the report, and then contact them at the start of the next academic year, before your competitors and before their budget is allocated.</p>
        <p>Handover matters here more than anywhere else in the <Link href="/blog/mun-secretariat-roles">secretariat</Link>. Sponsorship relationships live in one student&apos;s inbox and leave with them when they graduate. Keep a shared sponsor file with the contact name, what was agreed, what was delivered, what was invoiced, and what they said afterwards, so next year&apos;s USG for partnerships inherits a relationship rather than a rumour.</p>

        <H2>What to refuse, and the conversation to have first</H2>
        <p>Decide your exclusions before anyone offers you money, and get your school or university to agree them in writing. It is a short, easy conversation in September and a very difficult one in February when a cheque is on the table.</p>
        <p>The usual exclusions: gambling, tobacco and vaping, alcohol at an event with minors, weapons and defence, and anything that requires you to endorse a political position. Two more that catch conferences out: a sponsor that wants delegate contact details, which you almost certainly cannot give under your data protection obligations, and a sponsor whose interests are directly implicated in a committee topic, which compromises the academic side even if nothing improper happens.</p>
        <p>Write the exclusions into your sponsorship page. It is also a signal to the sponsors you do want, because it tells them what company they will be keeping.</p>

        <H2>Where sponsorship sits in the budget</H2>
        <p>Treat sponsorship as the money that makes a conference better, not the money that makes it viable. A conference whose break-even depends on sponsors that have not yet signed is a conference that will cut its catering in February. Build the budget so that delegate fees cover the essential lines, and let sponsorship fund the things that are genuinely optional: better materials, a bursary fund, a guest speaker, a reduced fee for local schools. If this is your first year, our guide to <Link href="/blog/start-a-mun-conference">starting a MUN conference</Link> sets out the costs to plan for first.</p>
        <p>One line you should not need to fund at all is the software. Gavelling charges the organiser nothing, and payments run through the organiser&apos;s own Stripe Connect account, so the conference is the merchant of record for its own fees. Where that changes the sponsorship picture is simple: it is one fewer line that has to be sold to somebody. <Link href="/blog/mun-director-guide">The director guide</Link> and <Link href="/blog/mun-conference-planning">the planning guide</Link> cover the rest of the budget this sits inside.</p>
      </ArticleLayout>
    </>
  );
}
