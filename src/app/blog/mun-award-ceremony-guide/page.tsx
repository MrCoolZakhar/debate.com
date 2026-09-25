import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Closing Ceremony: How to Run Awards Without a Controversy',
  description:
    'Award policy set before the conference, slates collected from chairs, ratification, delegation tallies, and a run of show that takes 45 minutes',
  path: '/blog/mun-award-ceremony-guide',
  ogDescription: 'How to collect, ratify and announce MUN awards without a two-hour ceremony.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Closing Ceremony: How to Run Awards Without a Controversy',
  description: 'How to collect, ratify and announce MUN awards without a controversy or a two-hour ceremony.',
  url: 'https://gavelling.com/blog/mun-award-ceremony-guide',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-award-ceremony-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Closing Ceremony', item: 'https://gavelling.com/blog/mun-award-ceremony-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-award-ceremony-guide"
        pitch="Gavelling keeps the record your award decisions rest on: every speech, its length and your private chair notes, from every committee, free."
      >
        <p>Almost every complaint a secretariat receives about awards arrives in the last ninety minutes of the conference, and almost none of them are really about the last ninety minutes. They are about a policy that was never written down, a quota a chair invented on the morning of the final session, or a delegation tally nobody could explain. The ceremony is where the decisions become visible. The work that makes it uncontroversial happens weeks earlier.</p>

        <H2>Decide the award policy before you need it</H2>
        <p>Write the policy when you write the rules of procedure, not on the last morning. A usable policy fits on one page and answers six questions.</p>
        <ul>
          <li>Which categories exist, and are they the same in every committee?</li>
          <li>How many of each are given per committee, and is that a maximum or a fixed number?</li>
          <li>Does a position paper award exist, who judges it, and against what? A <Link href="/blog/mun-judging-rubric">judging rubric</Link> helps here.</li>
          <li>Are there delegation awards, and exactly how are they calculated?</li>
          <li>Who ratifies a committee slate, and what can they change?</li>
          <li>What happens when two chairs on one dais disagree?</li>
        </ul>
        <p>Publish it to chairs when you appoint them and to faculty advisors when registration opens. An advisor who knows in advance that your conference gives no Honourable Mentions in crisis committees will not send you an email about it on Sunday afternoon.</p>
        <Callout>The single most effective sentence in an award policy is the one that says what the awards are NOT for. &quot;Awards recognise performance in committee, not the size of a delegation, not the difficulty of a country allocation, and not attendance.&quot; It settles three arguments before they start.</Callout>

        <H2>Categories and quotas per committee</H2>
        <p>The conventional ladder is Best Delegate, Outstanding Delegate, Honourable Mention and Verbal Commendation, usually with Best Position Paper alongside. Our guide to <Link href="/blog/mun-award-categories">MUN award categories</Link> explains each one. What varies, and what you must fix, is how many of each a committee of a given size may give.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Committee size</th><th>Best</th><th>Outstanding</th><th>Honourable Mention</th><th>Verbal Commendation</th></tr>
            </thead>
            <tbody>
              <tr><td>Under 20 delegations</td><td>1</td><td>1</td><td>1 to 2</td><td>Up to 2</td></tr>
              <tr><td>20 to 34</td><td>1</td><td>1 to 2</td><td>2 to 3</td><td>Up to 3</td></tr>
              <tr><td>35 to 50</td><td>1</td><td>2</td><td>3 to 4</td><td>Up to 4</td></tr>
              <tr><td>Over 50</td><td>1</td><td>2 to 3</td><td>4 to 5</td><td>Up to 5</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">These are the bands most school and university conferences settle on. Pick one row per committee size and put it in the policy: the point is that every chair reads the same number.</p>
        <p>Two decisions matter more than the exact figures. First, whether a quota is a ceiling or a requirement. A ceiling lets a chair give fewer awards in a committee that genuinely had fewer strong delegates, which is honest but produces awkward comparisons between rooms. A requirement produces consistency and occasionally an award nobody earned. Most conferences use a ceiling for Verbal Commendation and a requirement for the top three. Second, whether double delegations count as one recipient. Decide it once. A double delegation that wins Best Delegate and receives one certificate between two students is a memorable way to spoil an afternoon.</p>

        <H2>Collecting slates from chairs</H2>
        <p>Set the deadline before the ceremony, not at it. A slate that arrives while the hall is filling cannot be checked, and an unchecked slate is how the same school ends up with Best Delegate in six committees.</p>
        <FactCard title="A workable slate deadline">
          Chairs submit no later than 60 minutes before the ceremony begins, from the room, on the form you gave them. Session ends 90 minutes before the ceremony. The 30 minutes in between is the only time a secretariat has to read fourteen slates.
        </FactCard>
        <p>Ask for exactly four fields per recipient and nothing else: the award, the delegation, the delegate name as they want it read aloud, and one line of evidence. The evidence line is the part that does the work. It gives you something to say when a faculty advisor asks why, it forces a chair to think past their favourite speaker, and it takes fifteen seconds to write.</p>
        <p>Good evidence lines are specific: &quot;wrote and defended operative clauses 4 to 7 of the passed resolution, and brokered the merger of the two working papers on day two&quot;. Bad ones are adjectives: &quot;excellent throughout&quot;. Tell chairs that in the briefing and show them one of each.</p>
        <p>Ask the dais to bring the record with them, not their memory. A committee that ran on paper has a speakers list and a sheet of notes. A committee that ran on software has the speaking log already. Our own <Link href="/blog/mun-awards-guide">guide to how Best Delegate is chosen</Link> covers the delegate side of the same question, and it is worth sending to chairs too: they judge better when they know what delegates have been told.</p>

        <H2>Ratification: what the secretariat actually checks</H2>
        <p>Ratification is not a second judging round. You were not in the room. You are checking four things, and you should be able to do all four for a committee in about two minutes.</p>
        <ul className="gv-check">
          <li><strong>Quota compliance.</strong> The slate matches the policy for that committee size.</li>
          <li><strong>Conflicts of interest.</strong> No chair has awarded their own school, their own club, or a delegate they coached. Ask chairs to declare conflicts when they are appointed, and keep the list.</li>
          <li><strong>Concentration across the conference.</strong> Not fairness within a committee, which is the chair&apos;s call, but a pattern across all of them.</li>
          <li><strong>Names and spellings.</strong> Against the registration list, not against the chair&apos;s handwriting.</li>
        </ul>
        <p>There are only two good reasons to send a slate back. The first is a policy breach: too many awards, a missing category, an undeclared conflict. The second is an evidence line that does not support the award it is attached to, which in practice means a chair who has awarded on impression alone and will usually correct it themselves once asked. Send it back with the specific problem named and a deadline in minutes. Never send a slate back because you would have chosen differently.</p>
        <Callout>If you find yourself reordering a chair&apos;s top two, stop. You are overturning the judgement of the only person who watched all sixteen hours of that committee, on the strength of a corridor impression. Either the chair is competent, in which case ratify, or they should not have been appointed.</Callout>

        <H2>Delegation awards, and publishing the formula first</H2>
        <p>Delegation awards cause more disputes than individual ones because the arithmetic is invisible. Fix that by publishing the formula in the same document as the policy, before anyone competes for it.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Award</th><th>Points</th></tr></thead>
            <tbody>
              <tr><td>Best Delegate</td><td>5</td></tr>
              <tr><td>Outstanding Delegate</td><td>3</td></tr>
              <tr><td>Honourable Mention</td><td>2</td></tr>
              <tr><td>Verbal Commendation</td><td>1</td></tr>
              <tr><td>Best Position Paper</td><td>1</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Then state the two rules that decide what the table actually rewards. Rule one: is the total raw, or divided by the number of delegates the school sent? Raw totals reward large delegations, which is defensible if you say so. An average rewards small ones and produces a winner with three students and two awards. Many conferences split the difference with a minimum delegation size to be eligible for the top delegation award, and a separate award for small delegations. Rule two: ties. Decide the tiebreak in advance, usually the greater number of Best Delegate awards, then Outstanding, then a shared award.</p>
        <p>Keep the tally on one sheet as the slates are ratified, not at the end. Fourteen slates entered as they arrive takes no extra time. Fourteen slates entered at once, while the hall waits, is where the arithmetic error happens.</p>

        <H2>Certificates without a crisis</H2>
        <p>Four hundred certificates is a printing problem, not a design problem. Solve it in this order.</p>
        <ol>
          <li><strong>Print participation certificates in advance</strong>, unnamed or mail-merged from the registration list, and distribute them through faculty advisors during the last session. They do not belong on stage.</li>
          <li><strong>Print award certificates blank</strong>, with the category preprinted if your design allows it, and fill names by hand on good paper with a real pen. Handwriting a name looks deliberate. A misspelled laser print looks careless.</li>
          <li><strong>Hold back ten blanks per category.</strong> You will need them.</li>
          <li><strong>Check spellings against registration</strong>, never against the slate form, and never against what a chair heard someone called all weekend.</li>
        </ol>
        <p>If you are mail-merging, merge from the same registration export you used for badges, so a name is wrong in both places or right in both places. Two different spellings of one delegate&apos;s name across a badge and a certificate is the version of this mistake people photograph.</p>

        <H2>A run of show that takes 45 minutes</H2>
        <p>Ceremonies run long for three reasons: speeches that were not timed, an announcement order nobody rehearsed, and photographs taken one recipient at a time. All three are fixable. The ceremony is one part of <Link href="/blog/mun-conference-day-operations">conference day operations</Link>, and it runs on the same discipline.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Minutes</th><th>What happens</th><th>Who</th></tr></thead>
            <tbody>
              <tr><td>0 to 5</td><td>Doors, music, delegations seated by school</td><td>Logistics team</td></tr>
              <tr><td>5 to 9</td><td>Secretary-General&apos;s closing remarks, timed and written out</td><td>SG</td></tr>
              <tr><td>9 to 12</td><td>Thanks: staff, venue, volunteers. One slide, no speeches</td><td>SG</td></tr>
              <tr><td>12 to 38</td><td>Committee awards, one committee at a time</td><td>Dais of each committee</td></tr>
              <tr><td>38 to 42</td><td>Best Position Paper and any conference-wide awards</td><td>Academics lead</td></tr>
              <tr><td>42 to 45</td><td>Delegation awards, then close</td><td>SG</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Twenty-six minutes for fourteen committees is under two minutes each, which is enough for four to six names if, and only if, the chair reads and does not speak. Give every dais the same script and mean it.</p>
        <ChairScript>&quot;In the World Health Organization. Verbal Commendation: the delegate of Peru. Honourable Mention: the delegates of Norway and Indonesia. Outstanding Delegate: the delegate of Japan. And Best Delegate: the delegate of Brazil.&quot;</ChairScript>
        <p>No preamble about how hard this committee was to judge. No thanking the delegates from the stage. If a dais wants to say something to their room, they say it in the room, at the end of the last session, where it means more anyway.</p>

        <H2>Announcement order, and the small things that make it an occasion</H2>
        <p>Announce upward within a committee, from Verbal Commendation to Best Delegate. Announce committees in a fixed order that you publish on the screen, so a delegation knows roughly when to pay attention and nobody spends forty minutes at maximum alertness.</p>
        <p>Read the delegation before the name: &quot;the delegate of Brazil, Amara Okoye&quot;. In committee they were a country, and that is the thing they will remember being. Have recipients come forward as a group per committee rather than one at a time, receive the certificate, then stand together for one photograph. A photographer taking fourteen group shots finishes in the run time. A photographer taking a hundred and twenty individual shots does not.</p>
        <p>Pronounce the names. Ask chairs to write a phonetic spelling on the slate form for any name they are unsure of, and have whoever reads it practise before the doors open. It takes five minutes and it is the difference between recognition and embarrassment.</p>

        <H2>When an award is disputed</H2>
        <p>It will happen at least once, usually from a faculty advisor, usually within ten minutes of the ceremony ending, and usually in the corridor. Decide the handling in advance so whoever is standing there does not improvise.</p>
        <ul>
          <li><strong>Never relitigate on the spot, and never in public.</strong> Take the name, the committee and the complaint.</li>
          <li><strong>One named person handles all of them.</strong> Usually the academics lead, not the SG, who is still on stage duty.</li>
          <li><strong>Say what the process was, not what the judgement was.</strong> &quot;The dais submitted a slate with written evidence, the secretariat checked it against the published policy and for conflicts of interest, and the dais decision stands.&quot;</li>
          <li><strong>Offer feedback instead of review.</strong> Most advisors are asking for feedback for their delegate and phrasing it as a dispute. Offer a written note from the dais within a week and the temperature drops immediately.</li>
          <li><strong>Reverse only for a factual error.</strong> A miscounted quota, a wrong name, an undeclared conflict. Never because the complaint was loud.</li>
        </ul>
        <p>The one thing that ends a dispute faster than anything else is evidence you can quote back. That is the real reason to insist on evidence lines: not bureaucracy, but the ability to say what a delegate actually did.</p>

        <H2>After the ceremony</H2>
        <p>Publish the full results within twenty-four hours, on the conference page, with committee, category and delegation. Advisors need it for their school newsletters, delegates need it for their applications, and a result that exists only in a photograph of a certificate stops existing the moment the certificate is lost.</p>
        <p>Send each delegate their own record: which committee, which country, which award if any, and the dais feedback if you promised it. A delegate can cite a published result years later when they are writing a personal statement, or listing <Link href="/blog/mun-on-your-cv">MUN on their CV</Link>. A paper certificate in a box under a bed cannot be cited by anybody, which is why the conferences that publish properly get mentioned by name in applications and the ones that do not, do not. Our <Link href="/blog/mun-director-guide">director&apos;s guide</Link> covers the rest of the post-conference wrap-up, and the <Link href="/blog/mun-conference-planning">conference planning guide</Link> places the award policy in the wider timeline.</p>
        <p>Finally, debrief the chairs while it is fresh. Ask two questions: did the quota fit your committee, and was the slate form quick to fill in? Both answers change next year&apos;s policy, and both are forgotten within a fortnight.</p>
        <p>If you want somewhere to practise the record-keeping side of this before your own conference, you can open a <Link href="/create/sessions">free practice session</Link> and run a mock committee with the speaking log and chair notes turned on, then try writing a slate from it. Most chairs find the evidence lines much easier to write the second time.</p>
      </ArticleLayout>
    </>
  );
}
