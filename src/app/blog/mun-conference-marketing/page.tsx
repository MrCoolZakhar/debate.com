import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Marketing a MUN Conference: How to Fill Your Committees',
  description:
    'How delegations actually decide which conference to attend, and how to reach them before the other conference does.',
  path: '/blog/mun-conference-marketing',
  ogDescription: 'How to promote a MUN conference and fill every committee.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Marketing a MUN Conference: How to Fill Your Committees',
  description: 'How delegations decide which MUN conference to attend, and how to reach them first.',
  url: 'https://gavelling.com/blog/mun-conference-marketing',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-marketing' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Marketing a MUN Conference', item: 'https://gavelling.com/blog/mun-conference-marketing' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-conference-marketing"
        pitch="A public conference page, a directory listing and one application queue, so the delegations you reach can actually register."
      >
        <p>Registration has been open for three weeks and you have eleven delegates. The committees are written, the chairs are recruited, the venue is booked, and the thing standing between you and a conference is that almost nobody knows it exists. This is the most common failure mode for a new Model UN conference, and it is almost always a distribution problem rather than a quality problem. What follows is how delegations actually decide, and how to reach them in the window where the decision is made.</p>

        <H2>You are marketing to three people, not one</H2>
        <p>A single delegation registration involves at least three decisions by three different people, and the message that persuades one of them will bore the other two.</p>
        <p><strong>The faculty advisor signs the cheque and carries the risk.</strong> They want to know that the conference exists, is run by adults or by students supervised by adults, has a named secretariat, has a refund policy, is on a date that does not clash with exams, and will not embarrass them. They are reassurance-driven. Almost everything that loses you a delegation loses it here.</p>
        <p><strong>The head delegate or club president <Link href="/blog/choosing-mun-conferences">chooses between conferences</Link>.</strong> They want committees their team will enjoy, a competitive level that matches their delegates, awards that are credible, and a schedule that is worth the travel. They are comparison-driven, and they are comparing you against two or three named alternatives.</p>
        <p><strong>The delegate decides whether to sign up at all.</strong> They want photographs of a room that looks alive, committee topics that sound interesting rather than dutiful, and the sense that something will happen. They are enthusiasm-driven, and they are the reason the advisor gets asked in the first place.</p>
        <Callout>Write your materials for the advisor and your social media for the delegate. Conferences that reverse this end up with an Instagram account full of reels and an inbox full of advisors asking basic questions that the website should have answered.</Callout>

        <H2>The calendar is the whole game</H2>
        <p>Schools do not book Model UN trips when they see an advertisement. They book in two windows, and if you miss both you have lost a year rather than a month.</p>
        <p>The first window is the start of the academic year, typically the four to six weeks after term begins, when the advisor writes the year&apos;s activity plan and asks for a budget line. A conference that is invisible in that window is not on the plan, and being added to a plan later requires someone to find money that has already been allocated elsewhere.</p>
        <p>The second window is the eight to twelve weeks before your date, when advisors confirm numbers, collect parental consent and book travel. This is when you convert interest into registrations, not when you create interest.</p>
        <p>Two practical consequences. First, you should be visible with a real page, a date and a topic list at least six months before the conference, and preferably nine. Second, your outreach should be timed to arrive at the start of term, not two months before your event, however counter-intuitive that feels when you are the one panicking in March.</p>

        <H2>Your conference page: eight things an advisor checks</H2>
        <p>An advisor visiting your page for the first time is running a fast credibility test. They look for eight things, usually in under ninety seconds.</p>
        <ul className="gv-check">
          <li><strong>Dates and venue</strong>, with the city named, above the fold</li>
          <li><strong>Committee list with topics</strong>, not just committee names</li>
          <li><strong>The fee</strong>, stated as a number, including what it covers</li>
          <li><strong>Who runs it</strong>: the named secretariat, with the school or university behind them</li>
          <li><strong>Experience level</strong>: whether beginners are welcome, and whether there are beginner committees</li>
          <li><strong>The rules of procedure</strong>, or at least which circuit you follow</li>
          <li><strong>How to register</strong>, with the deadline and the <Link href="/blog/mun-conference-registration-payments">payment method</Link></li>
          <li><strong>A contact address that is answered</strong>, ideally with a name attached</li>
        </ul>
        <p>Four things make them leave. A fee that is not published. A date that is not confirmed. A contact form that produced no reply last time they used it. And a page that was clearly last updated for a previous year, which is the single most common one. If your homepage still says 2025, an advisor assumes the conference may not be running.</p>

        <H3>Respond fast, and say so</H3>
        <p>The advisor emails three conferences on the same evening. The one that replies within two days gets the delegation more often than the one with the better committees. Put a realistic response time on your contact page and then beat it. This costs nothing and is the highest-leverage marketing decision a small secretariat makes.</p>

        <H2>The outreach email that gets a reply</H2>
        <p>Cold email to schools works, but only when it is short, specific and clearly written by a person. The pattern below is worth adapting. It is about 140 words, which is the point.</p>
        <FactCard title="Outreach email template">
          <p><strong>Subject:</strong> DELMUN 2027, 14 to 15 March, for [School] delegates</p>
          <p>Dear Ms Ahmed,</p>
          <p>I am the Secretary-General of DELMUN, a two-day Model UN conference at [Venue] in [City] on 14 and 15 March 2027. We are in our third year and expect around 180 delegates from 14 schools.</p>
          <p>We have six committees this year, including a beginner-friendly UNICEF and a Security Council on maritime security. The full topic list and rules of procedure are here: [link].</p>
          <p>Delegate registration is 35 GBP per delegate and includes lunch on both days. Two schools within an hour of you are attending, and I am happy to connect you with their advisors.</p>
          <p>Would a delegation of six to twelve work for your team? Registration opens on 1 October.</p>
          <p>Best wishes, [Name], Secretary-General</p>
        </FactCard>
        <p>Note what it does: names a real person, gives a date and a price in the first hundred words, links rather than attaches, offers a reference, and asks one specific question. Note what it does not do: promise an unforgettable experience, use the word &quot;prestigious&quot;, or attach a 20-page brochure.</p>
        <p>Send these to a named advisor, never to a general school address. The Model UN advisor is usually findable from the school&apos;s activity pages, from last year&apos;s conference delegation lists, or from the club&apos;s own social account. A list of sixty named advisors, sent properly, beats a list of six hundred info@ addresses by an enormous margin.</p>

        <H2>Returning delegations are the cheapest delegates you will ever get</H2>
        <p>A school that attended last year costs you one email. A school that has never heard of you costs you a page, a campaign, three emails and a phone call. Most conferences understand this and still fail to act on it, because the moment when a returning delegation is secured is not the one they expect.</p>
        <p>It is not February. It is the twenty minutes after the closing ceremony, while the advisor is standing in your lobby waiting for a coach, and their delegates have just won something. Have a named secretariat member whose only job in that window is to find every advisor, thank them by name, and ask one question: &quot;Can I put you down as interested for next year?&quot;</p>
        <p>Follow it with an email within 48 hours, while the conference is still the best thing that happened that month, containing the next year&apos;s date if you have it and a provisional date if you do not. Retention at 50 to 70 per cent of delegations is achievable and it changes your marketing problem completely: you are then filling a third of the room rather than all of it.</p>

        <H2>Directories and listings</H2>
        <p>Advisors and head delegates looking for a conference start with a directory or a map far more often than with a search engine, because they are searching by geography and date rather than by name. A listing is not a substitute for outreach, but it is the cheapest distribution you will find, and the cost of a bad listing is that you appear and are skipped.</p>
        <p>A good listing has: the exact dates, the city, the fee, the committee count, the experience level, an accurate delegate capacity, and a working link. A bad listing has a logo, a slogan and &quot;TBC&quot;.</p>
        <p>Gavelling&apos;s directory at <Link href="/conferences/explore">/conferences/explore</Link> and its map are free to list on, and a conference page published there is a real page with its own URL rather than a row in a table. That is the honest reason to use a directory at all: it should give you a page you can send people to, not just a place you appear.</p>

        <H2>Social media, and the trap inside it</H2>
        <p>The trap is that social media feels like marketing while producing very little registration, because the people it reaches are mostly delegates who are already going to conferences and mostly not the advisor who decides. Budget it as enthusiasm work, not as acquisition, and cap the hours.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Channel</th><th>What it is genuinely good for</th><th>Realistic effort</th></tr>
            </thead>
            <tbody>
              <tr><td>Instagram</td><td>Committee announcements, chair introductions, photographs after the event, delegate excitement</td><td>Two posts a week in the campaign, one a month otherwise</td></tr>
              <tr><td>LinkedIn</td><td>Reaching advisors, teachers and university staff. The only channel where the cheque-signer actually is</td><td>One post a month, plus the secretariat sharing it</td></tr>
              <tr><td>WhatsApp and Telegram groups</td><td>Regional MUN groups where head delegates actually coordinate. High value, invitation only</td><td>Join early, contribute before promoting</td></tr>
              <tr><td>TikTok</td><td>Reach among delegates, almost no reach among advisors</td><td>Only if someone on the team enjoys it</td></tr>
              <tr><td>Email</td><td>Everything that converts</td><td>The bulk of your time</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <Callout>If your outreach spreadsheet has fewer named advisors than your Instagram has followers, your effort is in the wrong place.</Callout>

        <H2>Chairs and staff are a distribution channel</H2>
        <p>Every chair you appoint comes from a school or a university, knows a MUN circle, and has a reason to tell them. A conference that recruits chairs from eight different institutions has eight introductions it did not have before, and chairs who bring a delegation from their own school are extremely common.</p>
        <p>Open chair applications early and publicly, advertise them where MUN people look, and say in the posting that chairs are welcome to encourage their own school to attend. Gavelling runs a cross-conference job board at <Link href="/conferences/roles">/conferences/roles</Link> for exactly this, and chair applications there do not cost the applicant anything.</p>
        <p>The same applies to your own delegates. If your school runs the conference, your students telling their circuit friends is your highest-trust channel and costs nothing but a nudge.</p>

        <H2>Social proof, and how to build it in year one</H2>
        <p>In year three you have photographs, award lists and advisors who will vouch for you. In year one you have none of that, which is the actual problem <Link href="/blog/start-a-mun-conference">new conferences</Link> face. Four substitutes work.</p>
        <ul>
          <li><strong>Borrow institutional credibility.</strong> &quot;Hosted at the University of X&quot; or &quot;run by the MUN society of Y School, founded 2009&quot; answers the advisor&apos;s real question, which is whether you will still exist in March.</li>
          <li><strong>Name your <Link href="/blog/mun-secretariat-roles">secretariat</Link> with photographs and one line of experience each.</strong> Anonymity reads as risk.</li>
          <li><strong>Publish the background guides early.</strong> A good guide is the clearest possible evidence that the academic side is serious, and it is the one thing you can show before the conference exists.</li>
          <li><strong>Get one respected advisor to attend and say so.</strong> A single named school that everyone in the region recognises does more than any amount of copy.</li>
        </ul>

        <H2>Pricing as a signal, and the early-bird deadline</H2>
        <p><Link href="/blog/mun-conference-budget">Your fee</Link> is read as a quality signal in both directions. A fee far below the regional norm invites the question of what has been cut, and a fee far above it invites the question of what is included. Price near your region&apos;s band, state clearly what the fee covers, and publish it. Our guide to conference costs works through the line items behind the number.</p>
        <p>The early-bird deadline is the single most effective scheduling tool you have, because advisors respond to deadlines and not to availability. Two tiers is enough: an early rate that closes about ten weeks out, and a standard rate afterwards. Make the gap meaningful, around 15 to 20 per cent, and hold the deadline. A deadline that is quietly extended twice teaches every returning school to ignore the next one.</p>
        <p>Publish a financial aid or fee waiver route alongside the price. It costs you very little, it reaches delegates who would otherwise not come, and its absence is noticed by exactly the advisors you most want.</p>

        <H2>Measuring without an analytics budget</H2>
        <p>You do not need tracking software to know whether your marketing is working. Four numbers, updated weekly in a shared document, tell you almost everything.</p>
        <ol>
          <li><strong>Named advisors contacted</strong>, cumulative. This is the only input number, and when registrations stall it is nearly always this that stalled first.</li>
          <li><strong>Replies</strong>, as a share of contacts. Under 10 per cent means the email is wrong. Over 30 per cent means send more.</li>
          <li><strong>Delegations committed</strong> and <strong>delegates registered</strong>, plotted against the same week last year if you have one.</li>
          <li><strong>Where each delegation came from</strong>, captured with one question on the registration form: how did you hear about us? Three months of answers will surprise you and will redirect next year&apos;s effort.</li>
        </ol>
        <p>Gavelling deliberately runs no third-party analytics or tracking. It does show organisers anonymous page-view counts for their own conference page, by source (no cookies, no IP addresses stored), but it cannot follow a person from a post to an application, so the registration form question is still your source of truth. That is a reasonable trade for most conferences: the answer you want is which channel produced a delegation, and a free-text question answers it better than a pixel does.</p>

        <H2>A twelve-month marketing calendar</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Months out</th><th>What happens</th></tr>
            </thead>
            <tbody>
              <tr><td>12 to 10</td><td>Date and venue confirmed. Page live with dates, provisional committees, previous year&apos;s photographs.</td></tr>
              <tr><td>9</td><td>Committees and topics published. Chair applications open. Directory listings updated.</td></tr>
              <tr><td>8</td><td>First outreach wave, timed to the start of term. Named advisors only. Save-the-date to last year&apos;s delegations.</td></tr>
              <tr><td>7</td><td>Background guides in draft. Chair announcements as social posts. Second outreach wave to non-repliers.</td></tr>
              <tr><td>6</td><td>Registration opens. Early-bird rate live with its deadline stated everywhere.</td></tr>
              <tr><td>5 to 4</td><td>Conversion phase: phone or video calls with interested advisors. Background guides published.</td></tr>
              <tr><td>3</td><td>Early-bird closes. Chase the maybes. Publish the schedule.</td></tr>
              <tr><td>2</td><td>Standard registration. Delegate-facing content: committee previews, chair introductions.</td></tr>
              <tr><td>1</td><td>Registration closes. Logistics communication only. Stop marketing and start operating.</td></tr>
              <tr><td>0</td><td>Photograph everything. Secure returning delegations in the lobby.</td></tr>
              <tr><td>+1 week</td><td>Thank-you emails, photographs published, next year&apos;s provisional date announced.</td></tr>
            </tbody>
          </table>
        </TableWrap>

        <H2>What to do if you are already behind</H2>
        <p>If you are reading this eight weeks out with half a conference, the order of operations is fixed. Fix the page first, because every other action sends people to it. Then send fifty personal emails to named advisors within reach of your venue, mentioning the schools already attending. Then telephone the ten most likely, because a call converts at several times the rate of an email and nobody does it. Then, and only then, consider reducing your committee count so that the committees you do run are full. Six full committees is a good conference. Ten half-empty ones is not.</p>
        <p>The related reading worth having open while you do this: <Link href="/blog/mun-conference-planning">how to plan a MUN conference</Link> for the timeline the marketing sits inside, <Link href="/blog/mun-director-guide">the MUN director guide</Link> for the secretariat structure that carries it, and <Link href="/blog/mun-faculty-advisor-guide">the faculty advisor guide</Link>, which is the clearest available description of the person you are writing to.</p>
      </ArticleLayout>
    </>
  );
}
