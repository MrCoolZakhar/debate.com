import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Glossary: Every Term, Explained Plainly',
  description:
    'Every word you will hear in a committee room, defined in one sentence, with what it means in practice and the terms people get wrong',
  path: '/blog/mun-glossary',
  ogDescription: 'Every Model UN term, defined in one sentence, with what it means in practice.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Glossary: Every Term, Explained Plainly',
  description: 'Every Model UN term, defined in one sentence, with what it means in practice.',
  url: 'https://gavelling.com/blog/mun-glossary',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-glossary' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Glossary', item: 'https://gavelling.com/blog/mun-glossary' },
  ],
};

/** term, one-sentence definition, what it means in practice */
type Row = [string, string, string];

function Terms({ rows }: { rows: Row[] }) {
  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th>Term</th>
            <th>Definition</th>
            <th>In practice</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><strong>{r[0]}</strong></td>
              <td>{r[1]}</td>
              <td>{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-glossary"
        pitch="Learn the words by using them: open a free committee, run a speakers list and raise a motion in ten minutes."
      >
        <p>
          Model UN runs on jargon, and most of it is never explained out loud because everyone in the room assumes everyone else already knows. This is every term you are likely to hear, grouped by where you will hear it. Each entry gets one sentence of definition and one line of what it actually means when you are sitting there. Terms that differ by circuit are marked. For the kinds of committee these terms turn up in, see <Link href="/blog/mun-committee-types">MUN committee types</Link>.
        </p>

        <H2>Procedure and debate</H2>
        <Terms
          rows={[
            ['Quorum', 'The minimum number of delegates required for the committee to do business.', 'Usually one quarter to open debate and one third to vote. The chair checks it after roll call.'],
            ['Roll call', 'The chair reads every country to record attendance.', 'You answer "present" or "present and voting". Choose deliberately.'],
            ['Present', 'Attending, and free to abstain on substantive votes.', 'The default answer, and almost always the right one.'],
            ['Present and voting', 'Attending, and giving up the right to abstain.', 'You must vote yes or no on every resolution. Do not say it by accident.'],
            ['Setting the agenda', 'The opening vote on which of two topics is debated first.', 'Looks trivial, decides your whole conference if you only researched one topic.'],
            ['GSL', 'General Speakers List: the standing queue of speeches on the topic as a whole.', 'The default state of the room. Everything else is an interruption of it.'],
            ['Moderated caucus', 'A short structured debate on one narrow sub-topic with its own speaker queue.', 'Needs a topic, a total time and a per-speaker time when you propose it.'],
            ['Unmoderated caucus', 'Formal rules suspended for a set period so delegates can talk freely.', 'Where the blocs and the drafts are actually built. Often shortened to "unmod".'],
            ['Suspension of the meeting', 'A temporary pause, for lunch or the end of a day.', 'Not the same as adjournment. Debate resumes where it stopped.'],
            ['Adjournment', 'The formal close of the committee session.', 'At the end of a conference this is final.'],
            ['Motion', 'A formal proposal to change what the committee is doing.', 'Always procedural. Raise your placard, wait to be recognised, state it in full.'],
            ['Second', 'Another delegate signalling that a motion is worth voting on.', 'Not agreement. Seconding a motion you intend to vote against is normal.'],
            ['Precedence', 'The order in which competing motions are voted on.', 'Most disruptive first. The chair decides, and a good chair says the order aloud.'],
            ['Placard', 'The card with your country name on it, raised to be recognised.', 'Raise it fully and hold it. Waving it is how you get ignored.'],
            ['Decorum', 'The standard of behaviour expected in formal session.', 'What the chair is asking for when the gavel comes down twice.'],
            ['Dais', 'The front table where the chairs sit, and the chairs collectively.', '"Send it to the dais" means give it to the chairs.'],
            ['Yield', 'Giving the remainder of your speaking time to someone or something.', 'Three kinds: to another delegate, to questions, or to the chair. UNA-USA circuit mainly.'],
            ['Right of reply', 'A short rebuttal granted when a delegation has been attacked or misrepresented.', 'Not for disagreements. See the full guide linked below.'],
            ['Tour de table', 'A round in which every delegation speaks in turn.', 'Common in European and simulation style committees. Slow but fair.'],
            ['Lobbying', 'The THIMUN name for the drafting period before formal debate.', 'A whole session, sometimes a whole day, not a fifteen minute break.'],
          ]}
        />
        <p>
          The deep guides: <Link href="/blog/mun-motions-explained">motions</Link>, <Link href="/blog/general-speakers-list-guide">the general speakers list</Link>, <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus</Link>, <Link href="/blog/tour-de-table-mun">tour de table</Link> and <Link href="/blog/mun-right-of-reply">right of reply</Link>.
        </p>

        <H2>Points</H2>
        <p>
          A point is a request or a query addressed to the chair. Motions change what the committee does; points do not. Our guide to <Link href="/blog/mun-points-explained">points in MUN</Link> covers all four kinds.
        </p>
        <Terms
          rows={[
            ['Point of order', 'A claim that the chair or a delegate has broken the rules.', 'May interrupt a speaker. Use it for a real procedural error, never to score a point.'],
            ['Point of parliamentary inquiry', 'A question about the rules or what is currently in order.', 'May not interrupt a speaker. The honest beginner question, and chairs like it.'],
            ['Point of personal privilege', 'A request about your ability to participate: audibility, temperature, leaving the room.', 'The only point that may interrupt a speaker for audibility. Not a debating device.'],
            ['Point of information', 'A question put to the delegate who just spoke.', 'On the THIMUN circuit this is the engine of debate, not an afterthought.'],
            ['Follow up', "A second question to the same speaker, at the chair's discretion.", 'Ask for it explicitly. The answer is often no when the queue is long.'],
          ]}
        />
        <p>
          See <Link href="/blog/mun-points-of-order">points of order in detail</Link> for when each one is genuinely in order.
        </p>

        <H2>Documents</H2>
        <Terms
          rows={[
            ['Position paper', "A one or two page statement of your country's stance, submitted before the conference.", 'At many conferences this is an award eligibility requirement. Check the deadline.'],
            ['Working paper', 'An unofficial draft circulated during committee.', 'Not binding, not formatted strictly, and the fastest way to become a sponsor.'],
            ['Draft resolution', 'A working paper the chair has accepted for formal debate.', 'Numbered, formatted, and amendable. Often abbreviated DR.'],
            ['Resolution', 'A draft resolution that has passed.', 'Only after the vote. Calling your draft "the resolution" early is a beginner tell.'],
            ['Preambulatory clause', 'An opening clause describing the situation, ending in a comma.', 'Describes. Never acts. Cannot be amended at most conferences.'],
            ['Operative clause', 'A numbered clause stating an action, ending in a semicolon.', 'This is the part that does something, and the only part worth fighting over.'],
            ['Sponsor', 'A delegation that wrote the paper and supports it.', 'Your name is on it. Sponsors normally cannot vote against their own paper.'],
            ['Signatory', 'A delegation that wants the paper debated, without endorsing it.', 'The most misunderstood term in MUN. Signing costs you nothing.'],
            ['Amendment', 'A proposed change to an operative clause of a draft resolution.', 'Friendly if all sponsors agree, unfriendly if not. Unfriendly ones get voted on.'],
            ['Amendment to the second degree', 'An amendment to an amendment.', 'THIMUN circuit mainly. Powerful, and the fastest way to lose the room if overused.'],
            ['Directive', 'A crisis committee instruction, public or private, replacing the resolution.', 'Short, specific and actionable. Vagueness gets you nothing back.'],
            ['Communiqué', 'A public statement issued by a crisis body.', 'Used for signalling to other committees or to the press.'],
            ['Background guide', 'The chair-written document explaining the committee and topic.', 'Also called a study guide. Read the questions a resolution must answer first.'],
          ]}
        />
        <p>
          The deep guides: <Link href="/blog/mun-working-paper-guide">working papers</Link>, <Link href="/blog/mun-resolution-writing">resolution writing</Link>, <Link href="/blog/mun-amendment-guide">amendments</Link> and the full <Link href="/blog/mun-clause-phrases">list of preambulatory and operative phrases</Link>.
        </p>

        <H2>People and roles</H2>
        <Terms
          rows={[
            ['Delegate', 'A participant representing a country or a character.', 'You. Referred to in the third person: "the delegate of Peru".'],
            ['Delegation', 'All the delegates from one school, or all the seats of one country.', 'Two meanings. Context decides which.'],
            ['Double delegation', 'Two delegates sharing one country seat.', 'One placard, one vote, two speeches to coordinate. Split the work early.'],
            ['Chair', 'The person running the committee from the dais.', 'Also president, moderator or director depending on the conference.'],
            ['Vice chair', 'The second chair, usually handling the speakers list and documents.', 'Often the person who actually decides whether your paper is formatted correctly.'],
            ['Rapporteur', 'The dais member keeping the record and the roll.', 'Sometimes the same person as the vice chair.'],
            ['Crisis director', 'The person running the back room of a crisis committee.', 'Decides what your directive achieves.'],
            ['Secretary General', 'The student leading the conference.', 'Abbreviated SG. Opens and closes the conference.'],
            ['USG', 'Under Secretary General: a secretariat member owning one portfolio.', 'USG Academics, USG Delegate Affairs, USG Logistics, and so on.'],
            ['Secretariat', 'The organising team collectively.', 'The people to email when something has gone wrong.'],
            ['Faculty advisor', 'The teacher accompanying a school delegation.', 'Does not debate. Can raise welfare and safeguarding issues with the secretariat.'],
            ['Head delegate', 'The student leading a school or university delegation.', 'Usually handles logistics, preparation and the awards conversation afterwards.'],
            ['Observer', 'A delegation that may speak but not vote.', 'The Holy See and the State of Palestine at the UN; press and NGOs at many conferences.'],
            ['Press corps', 'Delegates covering the conference as journalists.', 'Also called the International Press. A real committee, with its own deadlines.'],
          ]}
        />
        <p>
          If you want to write rather than debate, read the <Link href="/blog/mun-press-corps-guide">press corps guide</Link>. If any of these appeal as a next step, the <Link href="/conferences/roles">chair and staff job board</Link> lists open positions across conferences.
        </p>

        <H2>Voting</H2>
        <Terms
          rows={[
            ['Procedural vote', 'A vote on how the committee operates.', 'No abstentions. Every delegate present must vote.'],
            ['Substantive vote', 'A vote on a resolution or an amendment.', 'Abstentions allowed, unless you answered present and voting.'],
            ['Simple majority', 'More than half of those voting.', 'The default threshold for most motions and most GA resolutions.'],
            ['Two thirds majority', 'Two thirds of those voting.', 'Common for closing debate, and for resolutions at some conferences.'],
            ['Abstain', 'Declining to vote yes or no on a substantive question.', 'Not a no. At most conferences abstentions are excluded from the denominator.'],
            ['Pass', 'Declining to vote when your name is called in a roll call vote.', 'You are asked again at the end of the roll, and must then vote yes or no.'],
            ['Roll call vote', 'Voting country by country, in order, aloud.', 'Slow and public. The record everyone remembers.'],
            ['Placard vote', 'Voting by raising placards, counted by the dais.', 'The fast default for procedural votes.'],
            ['Voting with rights', 'Voting yes or no and requesting time to explain afterwards.', 'You speak after the vote closes, briefly, on why you broke with expectation.'],
            ['Division of the question', 'A motion to vote on parts of a resolution separately.', 'Rare, powerful, and usually a sign a bloc has fractured.'],
            ['Veto', 'A vote against by a permanent member of the Security Council, which defeats the draft.', 'Only in UNSC simulations. An abstention is not a veto.'],
            ['P5', 'The five permanent members: China, France, Russia, the United Kingdom, the United States.', 'Their agreement is the only route to a passed UNSC resolution.'],
          ]}
        />
        <p>
          See <Link href="/blog/mun-voting-procedures">voting procedures</Link> and the <Link href="/blog/mun-security-council-guide">Security Council guide</Link>.
        </p>

        <H2>Crisis</H2>
        <Terms
          rows={[
            ['Crisis committee', 'A small committee responding to a developing scenario in real time.', 'Usually 10 to 25 seats, individual characters rather than countries.'],
            ['Frontroom', 'The committee room itself.', 'Where debate and public directives happen.'],
            ['Backroom', 'The staff room where the crisis is run.', 'Reads your private directives and decides what the world does next.'],
            ['Crisis update', 'A new development announced to the committee.', 'Often a direct response to something a delegate did. Listen for your own name.'],
            ['Public directive', 'A committee-wide action, passed by vote.', 'The crisis equivalent of a resolution, but shorter and faster.'],
            ['Private directive', "An individual action using your character's own powers.", 'Also called a personal directive. Stay inside your portfolio or it fails.'],
            ['Portfolio powers', 'What your assigned character can actually do.', 'A finance minister cannot order an airstrike. Check before you write.'],
            ['Joint crisis committee', 'Two or more crisis committees affecting each other.', 'Abbreviated JCC. Your enemy is another room of real delegates.'],
            ['Arc', 'A sequence of related directives building toward a goal.', 'The difference between a memorable crisis delegate and a noisy one.'],
          ]}
        />
        <p>
          Full detail in the <Link href="/blog/mun-crisis-committee-guide">crisis committee guide</Link>.
        </p>

        <H2>Conference administration</H2>
        <Terms
          rows={[
            ['Allocation', 'The country or character you are assigned.', 'Sometimes chosen by preference, sometimes assigned on experience.'],
            ['Delegation fee', 'A per school or per society charge, separate from per delegate fees.', 'Read what it includes before you compare two conferences.'],
            ['Early bird', 'A reduced fee for registering before a cut-off.', 'Usually 10 to 20 percent off, and a real cash flow tool for organisers.'],
            ['Opening ceremony', 'The formal start of the conference.', 'Keynote, SG speech, and the only time every delegate is in one room.'],
            ['Closing ceremony', 'The formal end, where awards are announced.', 'Bring your placard. Some conferences make you collect awards in person.'],
            ['Best Delegate', 'The top award in a committee.', 'Usually one per committee, sometimes with Outstanding Delegate below it.'],
            ['Honourable Mention', 'A lower committee award.', 'Number given varies widely. Some conferences give none at all.'],
            ['Diplomacy award', 'An award decided by the delegates, not the dais.', 'Also called Peer Award or Best Diplomat depending on the conference.'],
            ['Position paper award', 'An award for the best pre-conference paper.', 'Judged before the conference starts, so the deadline genuinely matters.'],
          ]}
        />
        <p>
          How the decision is made, from the delegate&apos;s side, is in the <Link href="/blog/mun-awards-guide">awards guide</Link>.
        </p>

        <H2>The terms that differ by circuit</H2>
        <p>
          These are the words that mean different things depending on where the conference sits. Getting them wrong is the clearest sign you have not read the handbook. The <Link href="/blog/mun-procedure-styles-compared">procedure styles comparison</Link> sets the circuits side by side.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Term</th>
                <th>North American circuit</th>
                <th>THIMUN circuit</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Drafting period', 'Unmoderated caucus, 10 to 20 minutes at a time', 'Lobbying, often a full session on day one'],
                ['Questions to a speaker', "Yield to questions, at the speaker's choice", 'Points of information, central and expected'],
                ['Debate structure', 'GSL plus caucus motions on sub-topics', 'Time for and against a named resolution'],
                ['Amendments', 'Friendly and unfriendly, voted in order', 'Amendments and amendments to the second degree'],
                ['Chair title', 'Chair, moderator or director', 'President, chair or deputy'],
                ['Awards', 'Best Delegate, Outstanding, Honourable Mention', 'THIMUN itself gives no individual awards'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td><strong>{r[0]}</strong></td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        <H2>The five terms beginners consistently get wrong</H2>

        <H3>Signatory is not sponsor</H3>
        <p>
          A sponsor wrote the paper and supports it. A signatory only wants it debated. You can sign a draft resolution you intend to vote against, and experienced delegates do it routinely to get a paper onto the floor so it can be amended. Signing is a procedural favour, not a political commitment.
        </p>

        <H3>A motion is not a point</H3>
        <p>
          A motion proposes that the committee do something and is voted on. A point asks the chair for something and is ruled on. &quot;Motion for a point of information&quot; is not a thing, and saying it is the fastest way to be identified as new.
        </p>

        <H3>A working paper is not a draft resolution</H3>
        <p>
          A working paper is an unofficial draft with no formatting requirements and no standing. It becomes a draft resolution only when it has the required signatories and the dais accepts it. Until then it cannot be introduced, amended or voted on.
        </p>

        <H3>Abstain is not the same as pass</H3>
        <p>
          Abstaining is a recorded decision not to take a side on a substantive question, and it is usually excluded from the majority calculation. Passing, in a roll call vote, is deferring your answer: you are called again at the end of the roll and must then vote yes or no. You cannot pass twice, and you cannot pass and then abstain.
        </p>

        <H3>Moderated is not unmoderated</H3>
        <p>
          A moderated caucus has a chair, a queue and a clock. An unmoderated caucus has none of them. Delegates who propose &quot;a moderated caucus to write the resolution&quot; have asked for the opposite of what they want.
        </p>

        <Callout>
          If a term in the conference handbook contradicts anything here, the handbook wins. Every conference modifies its rules, and the ones that matter most are usually modified quietly in an appendix.
        </Callout>

        <H2>Where to go next</H2>
        <p>
          If you are new, read <Link href="/blog/what-is-model-un">what Model UN actually is</Link> first and come back here when a word stops you. If you know the activity and want the rules properly, the <Link href="/blog/mun-rules-of-procedure">rules of procedure reference</Link> is the next page. If you are about to attend, the <Link href="/blog/mun-conference-preparation">preparation checklist</Link> turns all of this into a schedule.
        </p>
        <p>
          The fastest way to make the vocabulary stick is to use it. Open a free committee at <Link href="/create/sessions">/create</Link>, invite five people, and spend an hour raising motions badly. You will remember the difference between a point and a motion permanently after the first time a chair rules you out of order.
        </p>
      </ArticleLayout>
    </>
  );
}
