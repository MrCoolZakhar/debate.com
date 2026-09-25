import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Putting Model UN on Your CV and University Application',
  description:
    'How to write four years of Model UN into three lines that a reader who was not there will believe.',
  path: '/blog/mun-on-your-cv',
  ogDescription: 'How to write Model UN on a CV so a reader who was not there believes it.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Putting Model UN on Your CV and University Application',
  description: 'How to describe Model UN experience on a CV, personal statement and in interviews.',
  url: 'https://gavelling.com/blog/mun-on-your-cv',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-on-your-cv' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Model UN on Your CV', item: 'https://gavelling.com/blog/mun-on-your-cv' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-on-your-cv"
        pitch="A public MUN CV a reader can open: conferences, roles and awards on one page with a link you can put on an application."
      >
        <p>Four years of Model UN, six conferences, two awards, a term as head delegate, and it currently occupies one line of your CV that reads &quot;Model United Nations (2022 to 2026)&quot;. That line tells a reader nothing except that you turned up. This guide is about the opposite problem: how to compress real experience into three or four lines that someone who has never heard of your circuit will read and believe.</p>

        <H2>The failure mode: a list of conferences</H2>
        <p>Almost every MUN entry on a student CV is a list. Attended HMUN, LIMUN, a school conference and two regional ones. It fails for a specific reason, which is that a list of events is a record of attendance, and attendance is not an achievement. The reader has no way to tell whether you were central to any of it.</p>
        <p>It fails harder when the names carry meaning only inside the circuit. An admissions officer who has read six hundred applications this month knows what &quot;debating society&quot; is. They do not know that a particular four-letter acronym is competitive, and they will not look it up.</p>
        <p>The third failure is volume. Seven conferences listed individually consume eight lines of a two-page CV for the same informational content as one line saying &quot;seven conferences&quot;. Space on a CV is the scarcest thing you have, and MUN is not the most important section on it.</p>
        <Callout>Test every line by asking whether a reader who knows nothing about MUN could say what you did and how hard it was. If they could not, the line is doing no work.</Callout>

        <H2>What a reader actually credits</H2>
        <p>Four things, in this order.</p>
        <p><strong>Role.</strong> Delegate, head delegate, chair, secretariat, founder. A reader distinguishes sharply between participating in something and running it, and the jump from delegate to chair is the largest single credibility step available to you. Our guide on <Link href="/blog/how-to-become-a-mun-chair">how to become a MUN chair</Link> covers getting picked.</p>
        <p><strong>Scale.</strong> Numbers. How many delegates, how many schools, how many people you were responsible for, how much money moved. Scale is what turns an activity into a responsibility.</p>
        <p><strong>Outcome.</strong> What resulted. A resolution passed, a club that grew, a conference that happened, an award, a team that qualified. Something that would not have occurred without you.</p>
        <p><strong>Evidence.</strong> Whether any of this can be checked. This is the quiet one and it is dealt with at the end of this guide.</p>

        <H2>The three-line shape</H2>
        <p>For a strong MUN record, three or four lines is the right length and the structure is consistent: what you did, how big it was, what resulted.</p>
        <FactCard title="Model United Nations, 2022 to 2026">
          <p>Head Delegate, [School] (2025 to 2026). Led a team of 24 across six conferences, ran weekly training, and managed a budget of 3,800 raised through grants and sponsorship.</p>
          <p>Chair, General Assembly Third Committee, [Conference] 2025. Chaired a committee of 42 delegates over two days, including procedural rulings and award recommendations.</p>
          <p>Delegate at nine conferences including [one recognisable name]. Best Delegate (2025), Outstanding Delegate (2024), and two Honourable Mentions.</p>
        </FactCard>
        <p>Note what happened. The conference list collapsed into a single number, one recognisable name and an award line. The space that bought was spent on the two roles that actually demonstrate something. And every line contains a number.</p>

        <H2>Six entries, before and after</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Before</th><th>After</th></tr></thead>
            <tbody>
              <tr>
                <td>Member of Model UN Society, 2023 to 2026</td>
                <td>Model UN delegate, five conferences, 2023 to 2026. Researched and represented assigned states in committees of 30 to 60, writing a position paper and negotiating a joint resolution at each.</td>
              </tr>
              <tr>
                <td>Won Best Delegate at [Conference] 2025</td>
                <td>Best Delegate, [Conference] 2025, awarded to one of 48 delegates in committee for negotiation and drafting across a two-day simulation.</td>
              </tr>
              <tr>
                <td>Chaired a committee</td>
                <td>Chair, UN Human Rights Council, [Conference] 2025. Ran two days of formal debate for 38 delegates, wrote the 18-page briefing document circulated in advance, and trained two co-chairs.</td>
              </tr>
              <tr>
                <td>Helped organise our school conference</td>
                <td>Director-General, [Conference] 2026. Ran operations for a two-day conference of 210 delegates from 16 schools: venue, scheduling, a team of 22 volunteers and the day-of command centre.</td>
              </tr>
              <tr>
                <td>Treasurer of MUN club</td>
                <td>Treasurer, Model UN Society. Raised 4,200 across a season through grants, local sponsorship and alumni giving, and introduced a fee waiver that took the club from 14 to 31 members.</td>
              </tr>
              <tr>
                <td>Started a MUN club at my school</td>
                <td>Founder, [School] Model UN Society (2024). Built the club from four students to 29 in two years, wrote a ten-week training programme, and took the first delegation to an external conference in 2025.</td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Every rewrite does the same three things: it names the role, it adds a number, and it says what came of it. None of them inflates anything, which matters, because a CV line that cannot survive a follow-up question in an interview is worse than no line at all.</p>

        <H2>Awards, translated</H2>
        <p>Outside the circuit, &quot;Best Delegate&quot; means nothing on its own. It sounds like a participation certificate. Inside the circuit it can be the top one of fifty people after two days of continuous assessment. Your job is to move it from the first reading to the second in about twelve words.</p>
        <ul>
          <li><strong>Say the denominator.</strong> &quot;Best Delegate, awarded to one of 48 in committee&quot; is instantly legible.</li>
          <li><strong>Say the scale of the conference</strong> if it is impressive: 700 delegates from 40 schools.</li>
          <li><strong>Say what it was for</strong>, briefly. Research, negotiation and the passed resolution, not &quot;excellence&quot;.</li>
          <li><strong>Group the minor ones.</strong> &quot;Four committee awards across six conferences&quot; reads better than four separate lines.</li>
          <li><strong>Do not rename them.</strong> Writing &quot;first place&quot; when the award was Honourable Mention is a lie that an interviewer who did MUN will catch instantly.</li>
        </ul>
        <p>If you want to understand what the award actually measured so that you can describe it honestly, <Link href="/blog/mun-awards-guide">our guide to how Best Delegate is chosen</Link> is the version chairs work from, and <Link href="/blog/mun-award-categories">MUN award categories</Link> explains what each award means.</p>

        <H2>The entries that carry real weight</H2>
        <p>Delegate experience is good. These three are better, and if you have any of them they should lead your section.</p>
        <H3>Chairing</H3>
        <p>Chairing is a management job performed in public. You controlled a room of thirty to sixty people for two days, made rulings that were contested, kept to a schedule, and assessed performance. Describe it in those terms and it is one of the strongest entries a sixth-form CV can carry. Mention the briefing document if you wrote one, because writing a researched 15-page document for an audience of 40 is independently impressive.</p>
        <H3>Secretariat and organising</H3>
        <p>Running a conference is an operations and budget role with real money and real liability. A Director-General who ran a 200-delegate event coordinated a venue, a volunteer team, a schedule and a budget, and did it while at school. State the delegate count, the school count, the team size and the budget. Any two of those four are enough.</p>
        <H3>Founding something</H3>
        <p>Founder outranks almost everything else, because it is the one entry that is unambiguously self-started. Give the before and after numbers and the years, because the growth is the story.</p>
        <p>If you are aiming at any of these next year rather than describing them now, <Link href="/blog/mun-director-guide">the director guide</Link>, <Link href="/blog/how-to-chair-first-mun">the first-time chair guide</Link> and <Link href="/blog/mun-head-delegate-guide">the head delegate guide</Link> are the practical routes in.</p>

        <H2>Where MUN goes, and when to cut it</H2>
        <p>On a school or university application, MUN belongs under activities, leadership or extracurriculars, and it should be the first item there if it is your strongest. On a CV for a first job or internship, it sits under activities below education and any work experience, and it shrinks as real work accumulates.</p>
        <p>Cut it down when you have graduated and have two years of professional experience, or when the role was purely attendance and the space is needed. Keep it longer than you expect if you chaired, founded or ran something, because those entries remain evidence of initiative for years.</p>
        <p>For applications to politics, law, international relations, development or journalism, MUN is directly relevant and should be expanded rather than trimmed. For a software engineering internship, it is one line about communication and leadership, and that is the correct weight.</p>
        <Callout>Never pad the section with conferences you attended but did not do much at. Three strong lines beat eight weak ones, and the weak ones dilute the strong ones by association.</Callout>

        <H2>The personal statement: one committee, not a list</H2>
        <p>A personal statement is not a CV and the rules invert. Here, specificity beats scale, and one story beats four years of summary.</p>
        <p>The pattern that works: choose a single committee, describe the moment where something was genuinely difficult, say what you did, and say what you learned that changed how you work. The difficulty should be real: your bloc collapsing on day two, being assigned a country whose position you found indefensible and having to argue it anyway, a resolution you had built failing by two votes, a room that would not listen to you for the first day.</p>
        <p>That last category is the most useful, because representing a position you personally reject is a genuinely interesting intellectual experience and admissions readers recognise it as one. It is also the part of MUN that is hardest to fake, which is exactly why it reads as true.</p>
        <p>What to avoid: describing the procedure. Nobody outside MUN knows or cares what a moderated caucus is, and explaining it consumes a third of your word count. Say &quot;in the forty minutes of negotiation before the vote&quot; and move on.</p>

        <H2>Interviews: the two questions</H2>
        <p>If MUN is on your application, expect two questions.</p>
        <p><strong>&quot;Tell me about Model UN.&quot;</strong> The trap is jargon. A thirty-second answer with no acronyms: &quot;Each student represents a country in a simulated UN committee. You research its actual foreign policy, argue its position whether or not you agree with it, negotiate with other delegations, and try to get a written resolution passed. I have done nine, and chaired two.&quot; Then stop, and let them ask.</p>
        <p><strong>&quot;What did you learn from it?&quot;</strong> The trap is the generic answer about confidence and public speaking, which every candidate gives. Better answers are specific and slightly uncomfortable: what it is like to make the strongest possible case for a position you find wrong, how to tell within five minutes whether a negotiation is going to work, what it costs to hold a room to a rule that a popular delegate is breaking. Those are real, they are yours, and no other candidate will say them.</p>
        <p>Have one concrete example ready for each. An interviewer who asks a follow-up is interested, and the follow-up is where the entry either holds up or dissolves.</p>

        <H2>Verifiability, which is the quiet problem</H2>
        <p>Everything discussed so far is self-reported. Your CV says you won Best Delegate at a conference of 48, and a reader has no way to check that. Most of the time nobody checks, which is precisely why the claims carry less weight than they should: a reader discounts the whole category because they know it is unverified.</p>
        <p>The forms of evidence that exist, in ascending order of usefulness:</p>
        <ul>
          <li><strong>A certificate.</strong> Common, easily produced by anyone with a word processor, and rarely asked for.</li>
          <li><strong>A named reference.</strong> Your faculty advisor or a Secretary-General who will confirm what you did. Strong, and worth arranging while you are still in contact with them.</li>
          <li><strong>A published record.</strong> The conference&apos;s own award list or delegation list, on its website, with your name on it. This is the best traditional evidence and it is also fragile: student-run conference websites disappear.</li>
          <li><strong>A record issued by the conference to a profile a reader can open.</strong> A single link, listing what you did, marked as issued by the conference rather than typed by you.</li>
        </ul>
        <p>That last one is what the MUN CV on <Link href="/">Gavelling</Link> is for. Every profile resolves to a public page you can put on an application, listing conferences, roles and awards, and a reader can tell the entries apart: ones you added yourself, ones recorded automatically after you attended a conference run on Gavelling (shown as a Gavelling record), and, once awards launch, awards published by the conference itself, which carry a verified mark. The distinction is the point. A self-reported entry is a claim and a conference-issued one is a record, and a reader can see which is which on the page.</p>
        <p>Two honest caveats. Verified entries will only exist where the conference itself runs on the platform and has published its awards, so most of an older delegate&apos;s history will remain self-reported, and that is fine: an unverified entry is not a suspect one, just an unconfirmed one. And the awards side of the organiser tools is still being built, so if you are a delegate wondering why your conference has not issued anything, that is why.</p>
        <p>What you can do now, regardless of the tool: keep your own record while it is fresh. Conference name, dates, committee, country, delegate count, award, chair&apos;s name. Write it down the week it happens. Four years later, when you are compressing all of it into three lines for an application, the reason most students write &quot;attended several conferences&quot; is that they genuinely cannot remember which ones.</p>

        <H2>Is it worth the space at all?</H2>
        <p>Yes, if you did something. Model UN is one of a small number of school activities that produce genuine evidence of research, public argument, negotiation and, at the organising end, project management with a budget. Admissions readers and early-career recruiters know this, and the reason the category is discounted is not the activity but the writing. The longer answer is in <Link href="/blog/is-mun-worth-it">is Model UN worth it</Link>.</p>
        <p>So the actual advice compresses to five things. Lead with role, not attendance. Put a number in every line. Say what resulted. Translate the awards for someone outside the circuit. And keep evidence, because the difference between a claim and a record is the whole reason this section is read sceptically in the first place.</p>
      </ArticleLayout>
    </>
  );
}
