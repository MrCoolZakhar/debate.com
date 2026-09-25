import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { authorJsonLd } from '@/components/blog/authors';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Chaperoning a MUN Delegation: The Trip Guide for Advisors',
  description:
    'Everything to arrange before you travel with a Model UN delegation, and the rules to set once you arrive.',
  path: '/blog/mun-chaperone-guide',
  ogDescription: 'What to arrange before a MUN trip, and the rules to set on arrival.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Chaperoning a MUN Delegation: The Trip Guide for Advisors',
  description: 'Paperwork, risk assessment, rules and daily routine for taking a MUN delegation away.',
  url: 'https://gavelling.com/blog/mun-chaperone-guide',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: authorJsonLd('peter'),
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-chaperone-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Chaperoning a MUN Delegation', item: 'https://gavelling.com/blog/mun-chaperone-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-chaperone-guide"
        pitch="Run mock committees for nothing before you travel: a free session, delegates on their phones, no accounts to make."
      >
        <p>You are about to take somewhere between six and twenty teenagers to a city they do not know, for two or three days, to do something they are nervous about, and you will be responsible for all of them at every moment. This guide is the practical version of that job: what to arrange before you go, the rules to set on arrival, the daily routine that makes it survivable, and the decisions you would rather not make in a hotel corridor at 23:40.</p>
        <Callout>This is not legal advice and it is not a substitute for your school&apos;s educational visits policy. Your school will have a process for off-site trips, with named approvers and its own forms, and that process takes precedence over everything here. Use this to make sure you have not missed anything, then do it their way.</Callout>

        <H2>Your legal position, stated plainly</H2>
        <p>Your students remain your responsibility at somebody else&apos;s conference. The conference is responsible for its own premises, its own staff and the sessions it runs. It is not in loco parentis for your delegates. That division is the single most important thing to understand, and it is the thing most commonly assumed rather than checked.</p>
        <p>What follows from it:</p>
        <ul>
          <li>You must be contactable and, in most schools&apos; policies, on site or within a short distance for the whole conference day.</li>
          <li>If the conference runs a social, find out in writing who supervises it. If the answer is unclear, assume it is you.</li>
          <li>You decide whether your delegates may leave the venue, not the conference.</li>
          <li>An incident involving your delegate will be handled by the conference&apos;s safeguarding lead and by you, together. Know their name before you arrive. <Link href="/blog/mun-safeguarding">Our safeguarding guide</Link> describes what a well-run conference should be offering you here.</li>
        </ul>

        <H2>Paperwork, in the order it has to happen</H2>
        <p>Start earlier than feels necessary. The paperwork, not the conference, is what determines whether the trip happens.</p>
        <TableWrap>
          <table>
            <thead><tr><th>When</th><th>What</th></tr></thead>
            <tbody>
              <tr><td>6 to 12 months before, international</td><td>School approval in principle. Passport expiry checked for every student. Visa requirements researched.</td></tr>
              <tr><td>4 to 6 months</td><td>Formal trip approval, risk assessment submitted, second adult confirmed, travel and accommodation booked.</td></tr>
              <tr><td>3 months</td><td>Letters to parents with full costs and dates. Consent and medical forms issued. <Link href="/blog/mun-visa-invitation-letters">Visa applications</Link> begun if needed.</td></tr>
              <tr><td>6 to 8 weeks</td><td>Consent forms returned and chased. Insurance confirmed. <Link href="/blog/mun-conference-registration-payments">Conference registration and fees</Link> paid.</td></tr>
              <tr><td>3 weeks</td><td>Parent meeting or written briefing. Trip rules agreed and signed. Rooming decided.</td></tr>
              <tr><td>1 week</td><td>Final itinerary to parents and school. Students work through the <Link href="/blog/mun-conference-preparation">conference preparation checklist</Link>. Emergency contact list printed. Medication collected and logged.</td></tr>
              <tr><td>The day before</td><td>Everything printed twice, one set for you and one for the second adult.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <H3>What the consent and information form must collect</H3>
        <FactCard title="Per student, before you travel">
          Full legal name as it appears on their passport. Date of birth. Two emergency contacts with numbers that are answered at night. Doctor&apos;s details. Medical conditions, allergies and current medication with dosages. Dietary requirements, distinguishing preference from allergy. Consent to emergency medical treatment. Consent for photography, if the conference asks for it. Any accessibility needs. Swimming and late-night permissions if relevant. Signature of a person with parental responsibility, dated.
        </FactCard>
        <p>Keep one printed copy with you, one with the second adult, and one at school with a named person who will answer the phone at 02:00. A file in your email is not a plan.</p>

        <H2>The risk assessment</H2>
        <p>Your school will require one and will have a template. What it needs to cover for a MUN trip specifically, beyond the generic transport and venue lines:</p>
        <ul className="gv-check">
          <li>Travel: the journey there, transfers, and what happens if the return is delayed overnight</li>
          <li>The venue: unfamiliar building, multiple floors, students moving between rooms unsupervised</li>
          <li>Free periods: lunch, breaks, and whether students may leave the site</li>
          <li>Accommodation: floors, room allocation, corridors, who is where</li>
          <li>The social or evening event, named as a separate activity with its own supervision</li>
          <li>Medical: existing conditions, medication administration, nearest hospital, insurance contact</li>
          <li>Missing-student procedure, with a specific time trigger and a first action</li>
          <li>Student distress from committee content, which is a real risk at MUN and is usually absent from templates</li>
          <li>Safeguarding, naming the conference&apos;s lead and yours</li>
          <li>Lone-adult risk, and the mitigation of a second adult</li>
        </ul>
        <p>Write it honestly rather than defensively. A risk assessment that lists a control you will not actually apply is worse than one that admits a risk and describes a realistic mitigation.</p>

        <H2>Ratios and the second adult</H2>
        <p>Your school sets the ratio and you should take the number from them. What is worth saying here is why the second adult is non-negotiable in practice rather than merely in policy.</p>
        <p>If one student needs to go to hospital, you go with them. Who is with the other fifteen? If a safeguarding disclosure is made to you, you need a second adult present for the conversation that follows. If a delegate is in committee until 18:00 and another needs collecting from a different floor at the same time, you cannot be in both places. And a two-day conference with an evening event is roughly a sixteen-hour working day, twice, which one person cannot do attentively.</p>
        <p>For overnight trips most schools require adults of more than one gender where students are of more than one gender, and require that adults do not share rooms with students under any circumstances. Follow your policy exactly, and if your policy is silent, follow the stricter interpretation.</p>

        <H2>Travel</H2>
        <p>The failure modes are dull and predictable, which is good news.</p>
        <ul>
          <li><strong>Passports and visas.</strong> Check expiry dates yourself, personally, against the actual documents. Do not accept a student&apos;s word. Many destinations require six months of validity beyond the return date.</li>
          <li><strong>Names.</strong> Tickets must match passports exactly. A student known as Alex who is legally Alexandra is a two-hour problem at check-in.</li>
          <li><strong>Timings.</strong> Build in more margin than you would for yourself. Fifteen teenagers move through an airport at roughly half the speed of an adult travelling alone.</li>
          <li><strong>Money.</strong> Decide who holds the group float, how much students carry, and what happens if a card fails abroad.</li>
          <li><strong>Head counts.</strong> Every time you board, alight or leave a building. Out loud, by name, against a printed list. Every time, including the ones that feel silly.</li>
          <li><strong>The delayed return.</strong> Have a written plan: who you call, where the students wait, who tells the parents, and whether the school will authorise an unplanned hotel night. Agree the authority for that spend before you leave.</li>
        </ul>
        <Callout>Give every student a card with your mobile number, the second adult&apos;s number, the hotel name and address in the local language, and the conference venue address. Phones lose charge, and a lost student with a dead phone and a card is a ten-minute problem instead of a two-hour one.</Callout>

        <H2>Accommodation and the arrival conversation</H2>
        <p>The first thirty minutes in the hotel set the tone for the whole trip, and the conversation is better had in a lobby with everyone present than improvised at midnight.</p>
        <p>Cover: room allocations and that they are not negotiable. Which rooms adults are in. That nobody enters another room after a stated time. That nobody leaves the hotel without an adult, at any hour, for any reason. Lights out and the fact that you will check. What to do if there is a fire alarm, including the assembly point. That you hold a key or card for emergencies if the hotel permits. And what happens if a rule is broken, stated once, calmly, before anything has happened.</p>
        <p>Then do a corridor check at the stated time, knock on every door, see every face, and say goodnight. It takes ten minutes and it is the single most effective supervision act of the trip.</p>

        <H2>The rules, agreed in writing before you leave</H2>
        <p>Rules invented on the trip are contested. Rules signed three weeks earlier by both student and parent are not. Keep them short enough that a fifteen-year-old will read them.</p>
        <FactCard title="A workable trip agreement">
          <p>I will stay with the group and tell a staff member before I go anywhere. I will be contactable and keep my phone charged. I will be in my own room by the stated time and will not enter other rooms after it. I will not leave the hotel or the venue without a staff member. I will not buy or consume alcohol, tobacco, vapes or drugs. I will treat delegates from other schools, conference staff and hotel staff with respect. I will attend every committee session. I understand that if I break these rules my parents will be contacted, and that in a serious case I may be sent home at my family&apos;s expense.</p>
        </FactCard>
        <p>Signed by the student and by a parent. The last sentence is the one that matters and it must be true: agree with your school in advance that you have the authority to use it, and what it would involve in practice.</p>

        <H2>Your daily schedule</H2>
        <p>Three check-ins, a debrief, and a visible presence in between.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Time</th><th>What you do</th></tr></thead>
            <tbody>
              <tr><td>Breakfast</td><td>Head count. Confirm everyone has their placard, papers, badge and lunch arrangement. Ask who is nervous.</td></tr>
              <tr><td>Morning session</td><td>Walk the corridors once. Do not sit in committees unless invited: your presence changes the room and embarrasses your delegates.</td></tr>
              <tr><td>Lunch</td><td>Head count. This is the real one, because it catches anyone who is struggling before the afternoon.</td></tr>
              <tr><td>Afternoon</td><td>Be findable. Sit in the advisors&apos; area if there is one and talk to other advisors, which is the most useful professional hour of the trip.</td></tr>
              <tr><td>End of session</td><td>Head count. Twenty-minute debrief as a group: what happened, what went well, what to do tomorrow.</td></tr>
              <tr><td>Evening</td><td>Dinner together. Social if supervised. Corridor check at the stated time.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>The evening debrief is worth protecting. It is where your first-year delegates learn the most, and where you find out that one of them has not spoken all day, which is a problem you can still fix on day two. Our guides to <Link href="/blog/mun-public-speaking-tips">speaking in committee</Link> and <Link href="/blog/mun-delegate-tips">standing out as a delegate</Link> are useful things to have read before that conversation.</p>

        <H2>Medical and welfare</H2>
        <p>Know, before you leave, what your school permits you to do. In many schools a teacher may not administer any medication, including paracetamol, without specific written consent for that named medicine. Assume nothing.</p>
        <p>What to carry: the medical forms, the insurance policy number and emergency line, a basic first-aid kit, and any student medication you are holding, logged with a signature each time it is issued. What to know: the nearest hospital and the local emergency number, which differ by country and are not something to look up during an emergency.</p>
        <p>Welfare beyond medicine is the more common issue. Homesickness, exhaustion, a delegate who has been humiliated in committee, a delegate who is not eating because the food is unfamiliar. Look for the student who has gone quiet. The single best intervention is usually to take them out of the building for twenty minutes rather than to reassure them in a corridor.</p>

        <H2>When something goes wrong away from home</H2>
        <p>Decide the order in advance, because you will not want to decide it at the time.</p>
        <ol>
          <li><strong>Safety first.</strong> Medical need, or removing someone from harm, before anything administrative.</li>
          <li><strong>Second adult.</strong> Never handle a serious incident alone if you do not have to.</li>
          <li><strong>School.</strong> Your designated contact, immediately for anything serious, even at night. This is what the out-of-hours number is for.</li>
          <li><strong>Parents.</strong> Usually via the school for anything significant, so the message is consistent and recorded.</li>
          <li><strong>Conference.</strong> Their safeguarding lead, if the incident involves their premises, their staff or another delegation.</li>
          <li><strong>Write it down.</strong> Same day, factually, with times. Sign and date it.</li>
        </ol>
        <p>On sending a student home: it is occasionally the right decision and it is never a simple one. A minor cannot travel unaccompanied without arrangement, the cost falls somewhere, and it may leave you short of an adult. Agree the mechanism with your school before you travel, so that the decision is about whether rather than about how.</p>

        <H2>Keeping parents and school in the loop</H2>
        <p>Set the expectation before you go: one short group message per day at a fixed time, and direct contact only if there is something to say. Without that, you will spend the trip answering individual messages from eleven families, and the families who do not message will worry more.</p>
        <p>Photographs are a good version of the daily message and are also a consent question. Use the consent you collected, exclude anyone who did not give it, and post to a closed group rather than publicly.</p>

        <H2>Your own workload</H2>
        <p>Two days of sixteen hours, in a strange city, permanently on call. Advisors underestimate this and then make poor decisions on day two because they have slept for five hours.</p>
        <p>Three habits help. Split the night: agree with the second adult which of you is the first call on which night, and genuinely sleep on the other one. Take a proper break during committee sessions, because your delegates are in rooms run by conference staff at that point: you need to be contactable and close by, not hovering. And eat, which sounds trivial and is the thing most often skipped.</p>
        <p>Then, before the next trip, write down the three things you would change. Trip knowledge evaporates in a fortnight and rebuilding it every year is the thing that makes advisors stop volunteering. <Link href="/blog/mun-faculty-advisor-guide">The faculty advisor guide</Link> covers the programme that these trips sit inside, and <Link href="/blog/choosing-mun-conferences">the conference selection guide</Link> covers how to choose the next one so that the travel is worth it.</p>
      </ArticleLayout>
    </>
  );
}
