import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { authorJsonLd } from '@/components/blog/authors';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Safeguarding at MUN Conferences: A Policy Guide for Organisers',
  description:
    'The safeguarding policy a student-run Model UN conference needs, and the situations it has to cover.',
  path: '/blog/mun-safeguarding',
  ogDescription: 'The safeguarding policy a student-run MUN conference needs.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Safeguarding at MUN Conferences: A Policy Guide for Organisers',
  description: 'What a Model UN conference safeguarding policy must contain and cover.',
  url: 'https://gavelling.com/blog/mun-safeguarding',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: authorJsonLd('peter'),
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-safeguarding' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Safeguarding at MUN Conferences', item: 'https://gavelling.com/blog/mun-safeguarding' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-safeguarding"
        pitch="Committee rooms, rosters and records in one place, so the secretariat can see who is where without walking the building."
      >
        <p>This guide is written for the student <Link href="/blog/mun-secretariat-roles">secretariats</Link> and staff who run Model UN conferences attended by under-18s. It is a starting point for a conversation with your school, university or legal adviser, and nothing more than that.</p>
        <Callout>This is not legal advice. Safeguarding and child protection law differs in every jurisdiction, and your school or university will already have a policy that takes precedence over anything here. Use this to work out what questions to ask, then adopt or adapt your institution&apos;s policy with its safeguarding lead. Do not publish a policy based only on this page and describe it as compliant.</Callout>

        <H2>Why a student-run conference needs a written policy</H2>
        <p>Because hundreds of minors will be in a building for two days, often away from home, supervised in part by people who are themselves 17 to 22 years old, and something will eventually happen. Not necessarily something serious: a student in distress, an allegation between delegates, a photograph posted without consent, a delegate who does not get on the coach. In every one of those situations the difference between a manageable incident and a catastrophe is whether somebody knew in advance what to do.</p>
        <p>There is also a plainer institutional reason. If your conference is hosted by a school or a university, that institution carries the legal duty and will have requirements you must meet. If it is run independently, the liability question is genuinely unclear and varies by country, which is reason enough to attach your conference to an institution that has a policy, insurance and a named safeguarding lead.</p>
        <p>A published policy is also a marketing asset. A faculty advisor deciding whether to bring twelve students is assessing risk, and a safeguarding statement answers the question they are too polite to ask.</p>

        <H2>The policy&apos;s minimum contents</H2>
        <p>A usable conference policy is four to eight pages. Anything longer will not be read by the people who need it.</p>
        <FactCard title="What the document must contain">
          <p><strong>Scope.</strong> Who it covers, where it applies, and for which hours. State explicitly whether it applies to the social, to accommodation and to travel arranged by the conference.</p>
          <p><strong>A named safeguarding lead</strong>, with a photograph, a role, a phone number and a deputy. If the lead is a student, name the supervising adult above them.</p>
          <p><strong>Definitions</strong> of abuse, harassment, bullying and discrimination, taken from your institution&apos;s policy rather than written fresh.</p>
          <p><strong>The reporting route</strong>: who a concern goes to, in what order, within what time, and what happens next. One route, not three.</p>
          <p><strong>Record keeping</strong>: what is written down, by whom, where it is stored, who can see it, and how long it is kept.</p>
          <p><strong>A code of conduct</strong> for delegates, chairs and staff, with the consequences stated.</p>
          <p><strong>Staff and chair expectations</strong>: the behaviour required of anyone over 18 in a room with minors.</p>
          <p><strong>Escalation to external authorities</strong>: when the conference stops handling something itself.</p>
        </FactCard>
        <p>Publish it on the conference website before registration opens, and send it to every faculty advisor with their confirmation.</p>

        <H2>Checks on staff and chairs</H2>
        <p>Requirements vary enormously by country, so the correct action is to ask your host institution rather than to copy a rule from elsewhere. The question to put to them is precise: &quot;We will have people aged 18 and over in unsupervised contact with under-18s on our premises. What checks does the institution require, and will it process them for us?&quot;</p>
        <p>In many jurisdictions a formal criminal record check is required for regulated activity involving children, and in many others it is not available to a volunteer organisation at all. Where checks are not possible, the mitigations that institutions usually accept are structural rather than investigative:</p>
        <ul>
          <li><strong>No adult is alone with a single minor.</strong> Two-adult rule, or a door left open in a visible room.</li>
          <li><strong>Every chair and staff member is identifiable</strong>, with a badge, a photograph on the staff list, and a name every delegate can report.</li>
          <li><strong>A written declaration and a signed code of conduct</strong> from every person over 18, collected before the conference.</li>
          <li><strong>Named references</strong> for chairs recruited from outside your own institution.</li>
          <li><strong>A briefing</strong> that covers conduct explicitly, not only procedure.</li>
        </ul>
        <p>If you recruit chairs publicly, and most conferences now do through cross-conference job boards including Gavelling&apos;s at <Link href="/conferences/roles">/conferences/roles</Link>, then you are appointing people you have never met. Treat that exactly as your institution would treat any volunteer appointment: an application, a reference, a declaration, and a briefing.</p>

        <H2>Supervision, and the gap where incidents happen</H2>
        <p>A delegate at your conference is supervised by their own faculty advisor, who retains responsibility for them, and is also in your building under your arrangements. Both of those are true, and the gap between them is where almost every incident occurs.</p>
        <p>The gap is at specific moments: between the coach arriving and registration opening, during breaks and lunch, in the corridor while committees are in session, during the social, and after the conference ends but before transport departs. Write down who is responsible in each of those windows and tell the advisors, because an advisor who believes you are supervising the social while you believe they are is the precondition for the worst version of every story in this guide.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Moment</th><th>Who is responsible</th><th>What you must provide</th></tr></thead>
            <tbody>
              <tr><td>Arrival and registration</td><td>Faculty advisor</td><td>A clear meeting point and staff at the door</td></tr>
              <tr><td>Committee sessions</td><td>The conference, through the dais and corridor staff</td><td>An adult reachable from every room, and a route out for a delegate who needs one</td></tr>
              <tr><td>Breaks and lunch</td><td>Shared</td><td>Staffed circulation areas and a rule about leaving the building</td></tr>
              <tr><td>Social or evening event</td><td>Stated explicitly in advance</td><td>Named supervising adults, a ratio, and an end time</td></tr>
              <tr><td>Accommodation</td><td>Faculty advisor, unless the conference arranged it</td><td>Rules in writing if the conference is involved at all</td></tr>
              <tr><td>Departure</td><td>Faculty advisor</td><td>A supervised waiting area and a staff member until the last coach leaves</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>State a supervision ratio for anything the conference itself runs. Your institution will have one. Where it does not, ratios in the region of one adult to ten or fifteen students for an indoor supervised event, and tighter for evening events, are what most schools expect, but take the number from your own institution rather than from this page.</p>

        <H2>Socials, evening events and accommodation</H2>
        <p>This is where the risk concentrates, and it is the part most likely to be organised by whoever volunteers.</p>
        <p>The decisions to make in writing, months in advance: whether there is alcohol anywhere on the premises, which for an event with minors present should be no. Whether delegates may leave and return. Who is on the door, and whether a badge is required. What the end time is and how delegates get back. Who the named adults are and how many. What happens if a delegate is unwell or intoxicated on arrival. And whether the event is supervised by the conference, by visiting advisors, or by both, which must be told to advisors before they agree to bring students.</p>
        <p>On accommodation: if the conference books or recommends it, you have taken on a share of the responsibility, so either arrange it properly with room rules and a named adult on each floor, or arrange nothing and say clearly that accommodation is each school&apos;s own responsibility. Doing neither, and simply naming a hotel with a code, is the worst of the options.</p>
        <Callout>For mixed-age conferences that include university students and school students, decide and publish whether the social is open to under-18s at all. Many conferences run two events. That is not excessive caution, it is the simplest way to remove the largest single risk of the weekend.</Callout>

        <H2>Committee content, distress and the right to step out</H2>
        <p>Model UN topics include genocide, sexual violence in conflict, child soldiers, famine and refugee crises. Those are legitimate topics and they are why the activity is valuable. They are also, for some delegates, not abstract.</p>
        <p>What responsible conferences do:</p>
        <ul>
          <li><strong>Flag heavy topics in the background guide</strong>, in a short note at the front, so a delegate knows before they are assigned.</li>
          <li><strong>Brief chairs on how to handle graphic material</strong>: describe consequences, not atrocities, and stop a delegate who is performing suffering for effect (see <Link href="/blog/mun-difficult-delegates">handling difficult delegates</Link>).</li>
          <li><strong>Tell every delegate, in the opening ceremony, that they may leave the room at any time</strong> without explaining why, and where to go. Name the <Link href="/blog/mun-accessibility">quiet room</Link> and the person in it.</li>
          <li><strong>Brief chairs to notice.</strong> A delegate who leaves and does not return within a few minutes should be followed up, gently, by a staff member rather than ignored.</li>
          <li><strong>Draw a line on simulation.</strong> Crisis committees that simulate violence in detail, or that assign a delegate to represent an individual perpetrator, need a decision made by the secretariat in advance rather than by a crisis director at 15:00. Our <Link href="/blog/mun-crisis-committee-guide">crisis committee guide</Link> covers how those rooms are built.</li>
        </ul>

        <H2>Harassment and discrimination</H2>
        <p>Your policy needs a route for a delegate to report something that another delegate, or a chair, did to them. It must be a route that does not require them to tell their own faculty advisor first, because sometimes the person they need to avoid is on their own delegation.</p>
        <p>What that looks like in practice: a named person and a way to reach them that is not a public desk. A phone number and an email printed on the back of every badge is the simplest version and it costs nothing. Two people available, so that a delegate has a choice.</p>
        <p>Then a defined response: the report is recorded in writing the same day, the safeguarding lead decides on immediate measures, the faculty advisors of both parties are informed unless doing so would put the reporting delegate at risk, and the decision on removal sits with the safeguarding lead and the supervising adult, never with a chair and never with a committee.</p>
        <p>Removing someone from a conference is a serious step with consequences for a minor who may then be unsupervised in an unfamiliar city. It must involve their faculty advisor, their school and, where relevant, their parents, and it must never be done by walking someone out of the building alone. Write that sentence into your policy.</p>

        <H2>Photography and consent</H2>
        <p>You will take hundreds of photographs of minors and publish some of them. Three things make this manageable.</p>
        <ul className="gv-check">
          <li><strong>Collect consent through the school</strong>, at registration, with a simple yes or no per delegate. Schools already hold media consent and are the right route.</li>
          <li><strong>Make non-consent visible</strong> without singling anyone out. A different lanyard colour is the standard approach and it works.</li>
          <li><strong>Brief your photographers</strong>: no close-ups of individuals who have not consented, no names with faces on social media, and no photographs in accommodation or at the social without an explicit decision.</li>
        </ul>
        <p>Also state what delegates may post. Most conferences ask delegates not to post photographs of other delegates without asking, which is unenforceable but does shift behaviour, and to remove anything on request without argument.</p>

        <H2>Incident response on the day</H2>
        <p>Write this as a single card, print it, and put it in every committee room box and on every staff badge.</p>
        <FactCard title="If something happens">
          <p>1. Make the person safe. Medical emergency first, always.</p>
          <p>2. Tell the safeguarding lead. By phone, now, not in a group chat and not at the next break.</p>
          <p>3. Do not investigate. Do not question the delegate beyond what they volunteer. Do not promise confidentiality.</p>
          <p>4. Write it down: what you saw or were told, in their words where possible, with the time and date, and sign it. Same day.</p>
          <p>5. The safeguarding lead decides who else is told: the faculty advisor, the school, the parents, the institution, the emergency services.</p>
          <p>6. Record the decision and who made it.</p>
        </FactCard>
        <p>Point 3 is the one students get wrong, because the instinct is to help by finding out more. A well-meant informal investigation can compromise a real one. The person who receives a disclosure records it and passes it on.</p>
        <p>Keep one incident log in the command centre for the whole conference, including the small things: a lost delegate, a minor injury, a complaint about a chair. It is the record that lets you answer questions afterwards and the input for next year&apos;s policy. <Link href="/blog/mun-conference-day-operations">Our conference day operations guide</Link> covers how the command centre itself is run.</p>

        <H2>Data protection</H2>
        <p>Registration gives you names, ages, schools, emergency contacts, dietary requirements and medical information for several hundred minors. That is a sensitive dataset and it is subject to real law in most jurisdictions.</p>
        <p>The practical rules: collect only what you need. Say at the point of collection what it is for and how long you keep it. Keep it in as few places as possible, not in six personal accounts. Restrict medical and dietary information to the people who act on it. Never put it in a shared spreadsheet linked from a public page, which happens more often than anyone admits. And delete it on a stated schedule after the conference.</p>
        <p>The same applies to your tools. Whatever holds your applications and rosters, know where the data sits, who can see it, and what happens to it afterwards. Gavelling keeps applications in one queue with per-section permissions for the organising team, and runs no analytics or tracking of any kind, so there is no third party building a profile of your delegates. Ask the same question of anything else you use.</p>

        <H2>Visiting faculty advisors</H2>
        <p>Advisors retain responsibility for their own students (our <Link href="/blog/mun-chaperone-guide">MUN chaperone guide</Link> is written for them), and the most common failure is that neither side says so out loud. Send every advisor, with their registration confirmation, a short note that states: your safeguarding policy, the name and number of your safeguarding lead, which windows of the day you supervise and which are theirs, what you expect of them (being contactable, being on site or naming a deputy), and what you will do if one of their delegates is involved in an incident.</p>
        <p>Ask them for a named contact and a mobile number that is answered, and collect it at registration rather than in an email in October. <Link href="/blog/mun-faculty-advisor-guide">The faculty advisor guide</Link> describes the same relationship from their side.</p>

        <H2>Online and hybrid conferences</H2>
        <p>Online conferences have a smaller physical risk and a different one in its place.</p>
        <ul>
          <li><strong>Adults and minors in video calls.</strong> Apply the same two-adult principle: no one-to-one video contact between a chair and a delegate, and no private direct messages between staff and delegates outside the conference platform.</li>
          <li><strong>Recording.</strong> Decide whether sessions are recorded, say so before they start, and store recordings under the same rules as any other data.</li>
          <li><strong>Backchannels.</strong> Delegates will create group chats you do not control. State that the code of conduct applies to conference-related communication, and give delegates a route to report what happens in them.</li>
          <li><strong>Screen sharing.</strong> Chairs need to know how to stop a shared screen instantly and who to call.</li>
          <li><strong>Verify who is in the room.</strong> Named accounts, a roster, and a chair who removes unidentified participants. <Link href="/blog/mun-online-committees">Our online committees guide</Link> covers the mechanics.</li>
        </ul>

        <H2>The one-page version to adopt this week</H2>
        <p>If your conference is in eight weeks and you have nothing, do these six things in order. They are not a policy, but they close most of the gap.</p>
        <ol>
          <li>Ask your host institution for its safeguarding policy and its named lead, and adopt them.</li>
          <li>Name a safeguarding lead and a deputy for the conference, with photographs and a phone number, and print it on every badge.</li>
          <li>Write and publish a one-page code of conduct, and require every delegate, chair and staff member to accept it at registration.</li>
          <li>Decide and publish who supervises the social, the breaks and departure.</li>
          <li>Print the incident response card and put it in every room.</li>
          <li>Brief every chair and staff member for fifteen minutes on conduct, reporting and the quiet room, and take a register of who attended.</li>
        </ol>
        <p>Then, after the conference, review the incident log with your institution&apos;s safeguarding lead and write the real policy while the examples are fresh. A policy written from your own incidents will be better than any template, including this one.</p>
      </ArticleLayout>
    </>
  );
}
