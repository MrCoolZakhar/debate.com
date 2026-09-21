import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'THIMUN Rules of Procedure: The Complete Guide',
  description:
    'How debate actually runs under THIMUN procedure, and exactly what changes if you learned Model UN on the North American circuit',
  path: '/blog/thimun-rules-of-procedure',
  ogDescription: 'How THIMUN procedure works, and what changes if you learned MUN in North America.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'THIMUN Rules of Procedure: The Complete Guide',
  description: 'How THIMUN procedure works, and what changes if you learned MUN in North America.',
  url: 'https://gavelling.com/blog/thimun-rules-of-procedure',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/thimun-rules-of-procedure' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'THIMUN Rules of Procedure', item: 'https://gavelling.com/blog/thimun-rules-of-procedure' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="thimun-rules-of-procedure"
        pitch="Running a resolution-centred committee? Gavelling handles the speakers, the clock and the documents in one place."
      >
        <p>
          THIMUN procedure is not a dialect of the North American ruleset. It is a different model of what a committee session is for, and our <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> sets it beside the others. The North American circuit debates a topic and produces resolutions from it. THIMUN builds resolutions first and then debates them, one at a time, to the end. Everything else follows from that. This guide covers how the day runs, and the conversion table at the end maps every term you already know onto what it is called here.
        </p>
        <p className="gv-note">
          The THIMUN Foundation publishes rules of procedure for its own conferences, and THIMUN-affiliated conferences adapt them. Where this guide says &quot;usually&quot;, it is because affiliates differ. Your conference handbook is the authority for your conference, without exception.
        </p>

        <H2>What THIMUN procedure is, and where you will meet it</H2>
        <p>
          The THIMUN Foundation, based in The Hague, has run its annual conference since 1968 and affiliates conferences around the world, concentrated in Europe, the Middle East and Asia but present on every continent. Affiliated conferences run a recognisably common ruleset, and a delegate trained at one can walk into another.
        </p>
        <p>
          The structural claim behind it is that a resolution written under time pressure by whoever shouted loudest in an unmoderated caucus is not a good document, so the drafting gets its own protected time, a quality gate, and then the whole session focuses on debating and amending the results. Whether you find that better or slower is a matter of taste. It is certainly different.
        </p>

        <H2>The structural difference: no caucus motions</H2>
        <p>
          The single thing to understand before anything else. There is no motion for a moderated caucus and no motion for an unmoderated caucus in THIMUN procedure.
        </p>
        <p>
          Formal debate runs through speakers recognised by the chair, with points of information from the floor and yields between delegates. The room does not switch between modes all day. A North American delegate&apos;s instinct, which is to solve any problem by moving for a caucus on it, has nowhere to go here, and that is the adjustment that takes longest.
        </p>
        <p>
          The informal negotiation has not vanished. It has been moved to its own scheduled block at the start, called lobbying, and it is longer than any unmoderated caucus you have had.
        </p>

        <H2>Lobbying and merging</H2>
        <p>
          The first working period, often a full morning or an entire first day, is lobbying. The room breaks up. Delegates circulate with draft clauses, find people with compatible positions, and merge into resolutions. Nobody is speaking from a lectern. This is the part of the conference where the outcome is actually decided.
        </p>
        <p>
          A resolution emerges from lobbying with a <strong>main submitter</strong>, the delegation that owns it and will defend it, and a list of <strong>co-submitters</strong>, whose support is required for it to be considered at all. The number required is set by the conference, and it is a real threshold: a resolution nobody would co-submit does not reach the floor.
        </p>
        <p>
          The merged resolutions then go to an <strong>approval panel</strong>, staffed by student officers or the secretariat, which checks format, clause construction and whether the resolution is within the committee&apos;s mandate. Approved resolutions are the agenda for the rest of the conference. This gate does not exist on the North American circuit and it changes the incentives sharply: there is a direct penalty for sloppy formatting, which is that your resolution is sent back while the clock runs.
        </p>

        <Callout>
          Lobbying rewards the delegate who arrives with written clauses. If you come with an opinion and no text, you will spend the morning signing other people&apos;s work. If you come with four operative clauses already drafted, other delegations will merge into you.
        </Callout>

        <p>
          What to have in hand when lobbying starts: four to six operative clauses typed out, your country&apos;s red lines written down, and a clear sense of which two delegations you most need. The <Link href="/blog/mun-clause-phrases">phrase list</Link> is worth having open, because clause construction is exactly what the approval panel checks. A <Link href="/blog/mun-resolution-example">full sample resolution</Link> shows the finished format.
        </p>

        <H2>Resolution-centred debate</H2>
        <p>
          Once formal session begins, the committee takes one resolution at a time, to a vote, before moving to the next. The typical sequence:
        </p>
        <ul>
          <li>The chair calls the resolution and invites the main submitter to the floor.</li>
          <li>The operative clauses are read out, usually by the main submitter, sometimes by the chair or a clerk.</li>
          <li>The main submitter speaks in favour and may be open to points of information.</li>
          <li>The chair sets debate time: a fixed period of time in favour and a fixed period against, for example ten minutes each.</li>
          <li>Speakers alternate, recognised by the chair. Amendments are taken during this period.</li>
          <li>When debate time is exhausted or a delegate successfully moves to close debate, the committee votes on the resolution as amended.</li>
        </ul>
        <p>
          Delegates may move to extend debate time, and chairs frequently do so on a resolution that is generating substance. The lever North American delegates reach for, a motion for a moderated caucus on a sub-topic, is replaced by this one: if the debate is good, extend it.
        </p>

        <ChairScript>
          &quot;The chair recognises the delegate of Kenya as main submitter. The house will hear the operative clauses. Thereafter debate time will be set at ten minutes in favour and ten minutes against. Is the delegate open to any points of information?&quot;
        </ChairScript>

        <H2>Amendments are the centre of gravity</H2>
        <p>
          On the North American circuit a delegate who dislikes a draft writes a competing one. Here, they amend it, because there is only one resolution on the floor and it is going to a vote. Amendments are therefore where most of the session&apos;s real argument happens.
        </p>
        <FactCard title="How an amendment works">
          Submitted in writing to the chair during debate on the resolution, in the required form: add, strike, or amend a numbered operative clause. The chair decides when to take it. The submitter speaks in favour, debate time is set for and against the amendment, and the house votes. A passed amendment changes the resolution immediately and debate on the resolution resumes.
        </FactCard>
        <p>
          <strong>Amendments to the second degree</strong> are amendments to an amendment currently on the floor, and they are normal here rather than exotic. They are debated and voted before the amendment they modify, and only then does the house return to the amendment itself. Used well, a second degree amendment rescues a good amendment that went one clause too far. Used badly, it is how a committee loses forty minutes.
        </p>
        <p>
          Preambulatory clauses are generally not amendable. That is worth knowing in both directions: it protects your preamble, and it means a preambulatory clause you dislike cannot be removed, only outvoted with the whole resolution. The general mechanics of friendly and unfriendly amendments are covered in our <Link href="/blog/mun-amendment-guide">amendments guide</Link>; the THIMUN difference is that the friendly category matters much less, because the chair takes amendments to the floor rather than the sponsors accepting them privately.
        </p>

        <H2>Points of information</H2>
        <p>
          This is the mechanic North American delegates find hardest, and it is the engine of THIMUN debate.
        </p>
        <p>
          After a speech, or during it if the speaker is open to them, delegates raise their placards to put a question directly to the speaker. The chair recognises them one at a time. The speaker answers from the floor, in the third person, immediately.
        </p>
        <ul>
          <li><strong>Being open to points is a choice with consequences.</strong> A delegate who declines all points looks unable to defend the speech. A delegate open to any and all points in a hostile room can lose three minutes badly.</li>
          <li><strong>A follow-up</strong> is a second question to the same speaker and is granted at the chair&apos;s discretion. Ask for it explicitly and expect a no when the queue is long.</li>
          <li><strong>Questions must be questions.</strong> &quot;Does the delegate not agree that their proposal is unfunded?&quot; is legitimate. A thirty second statement ending in &quot;what does the delegate think?&quot; will be cut off by a good chair.</li>
          <li><strong>Answer in one or two sentences.</strong> The temptation is to make another speech. Resist it: the crisp answer is what wins the exchange, and the rambling answer invites three more questions.</li>
        </ul>
        <p>
          If you have never done this, practise it rather than reading about it. It is a live skill, like a viva, and it is the single largest difference in what a good delegate looks like on the two circuits.
        </p>

        <H2>Speaking mechanics and yields</H2>
        <p>
          Speakers are recognised by the chair from placards rather than placed on a standing general speakers list the way the <Link href="/blog/general-speakers-list-guide">GSL</Link> works elsewhere. The chair balances time for and against, and has considerable discretion over who is recognised and how often. A delegate who has already spoken twice on a resolution will usually wait.
        </p>
        <p>
          A speaker may <strong>yield the floor to another delegate</strong>, who then continues with the remaining time. That is the common yield. Yielding to the chair, which on the North American circuit is the polite way to end early, is less standard here: a speaker who has finished simply says so.
        </p>

        <H3>The points you can raise</H3>
        <ul>
          <li><strong>Point of personal privilege.</strong> About your ability to participate. The only point that may interrupt a speaker, and only for audibility.</li>
          <li><strong>Point of order.</strong> A claim that procedure has been broken. Not a debating device, and see our <Link href="/blog/mun-points-of-order">points of order guide</Link> for what genuinely qualifies.</li>
          <li><strong>Point of parliamentary inquiry.</strong> A question to the chair about the rules. May not interrupt a speaker.</li>
          <li><strong>Point of information to the speaker.</strong> The question mechanic above.</li>
          <li><strong>Point of information to the chair.</strong> A factual question to the dais, used sparingly. Our guide to <Link href="/blog/mun-points-explained">MUN points explained</Link> covers each point in general terms.</li>
        </ul>

        <H2>Voting</H2>
        <p>
          Procedural votes, on debate time and on closing debate, take no abstentions: every delegation present votes. Substantive votes, on amendments and resolutions, permit abstention.
        </p>
        <p>
          Most votes are by placard and the chair or the clerk counts. Simple majority of those voting is the usual threshold for amendments and for resolutions in General Assembly committees, and abstentions are normally excluded from the calculation. Security Council simulations follow Council rules, including the veto, which our <Link href="/blog/mun-security-council-guide">Security Council guide</Link> covers.
        </p>
        <p>
          One motion worth knowing: a <strong>motion to divide the house</strong>, which forces a re-vote in which abstention is not permitted. Delegates use it when a resolution has failed or nearly failed on a large abstention block, to force the undecided to take a side. It is a real tactic and it is decided at the chair&apos;s discretion. Our general <Link href="/blog/mun-voting-procedures">voting procedures guide</Link> covers thresholds and counting in more detail.
        </p>

        <H2>No awards, and what that changes</H2>
        <p>
          The THIMUN Foundation&apos;s own conferences do not give individual delegate awards. Many affiliated conferences do, so check your handbook rather than assuming either way.
        </p>
        <p>
          Where awards are genuinely absent, the room behaves differently, and delegates who have only ever competed notice it within an hour. Nobody is speaking to be counted speaking. Delegations merge earlier and more willingly, because there is no reason to protect authorship. Points of information are sharper and less performative. The delegates who dominate are the ones whose resolutions pass, which is a much better proxy for the thing the activity claims to teach.
        </p>
        <p>
          It also means a delegate arriving from an awards circuit can misread the room badly: the behaviour that gets you a Best Delegate gavel elsewhere, which is high visibility and frequent intervention, reads here as someone who has not understood what is going on. The delegate-side view of how awards distort behaviour is in our <Link href="/blog/mun-awards-guide">awards guide</Link>.
        </p>

        <H2>The conversion table</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>North American circuit</th>
                <th>THIMUN equivalent</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Unmoderated caucus', 'Lobbying', 'A scheduled block at the start, not a fifteen minute break'],
                ['Moderated caucus', 'No equivalent', 'Extend debate time on the resolution instead'],
                ['General speakers list', 'Recognition by the chair', 'No standing queue; the chair balances for and against'],
                ['Working paper', 'Draft resolution before approval', 'The approval panel is the gate'],
                ['Sponsor', 'Main submitter', 'One per resolution, and they defend it from the floor'],
                ['Signatory', 'Co-submitter', 'Co-submission carries more weight than signing does'],
                ['Yield to questions', 'Points of information', 'Central here, optional there'],
                ['Friendly amendment', 'Largely no equivalent', 'Amendments go to the floor and are voted'],
                ['Amendment to an amendment', 'Amendment to the second degree', 'Routine rather than exotic'],
                ['Motion to close debate', 'Motion to move to the previous question', 'Same effect, different name at many affiliates'],
                ['Roll call vote', 'Motion to divide the house', 'Not the same thing: dividing removes abstention'],
                ['Setting the agenda', 'Usually pre-set', 'Resolution order is decided by the chair or the panel'],
                ['Chair', 'Chair, President or Student Officer', 'General Assembly plenary has a President'],
                ['Best Delegate', 'Often nothing', 'THIMUN itself gives no individual awards'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td><strong>{r[1]}</strong></td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        <H2>If you are crossing over</H2>
        <H3>Coming from North America to THIMUN</H3>
        <ul className="gv-check">
          <li>Arrive at lobbying with written clauses. This is the whole ball game and you will otherwise spend it reacting.</li>
          <li>Practise answering points of information out loud before you go. One or two sentences, third person, no speech.</li>
          <li>Stop reaching for a caucus motion. The lever is debate time and amendments.</li>
          <li>Read the clause formatting rules in your handbook properly, because the approval panel enforces them.</li>
          <li>Recalibrate: fewer, better interventions. Frequency is not the metric here.</li>
        </ul>
        <H3>Coming from THIMUN to North America</H3>
        <ul className="gv-check">
          <li>Learn the motions, in precedence order. Six of them cover almost everything: our <Link href="/blog/mun-motions-explained">motions guide</Link> is the list.</li>
          <li>Get on the speakers list early. It is a standing queue and it does not come back to you.</li>
          <li>Use unmoderated caucuses aggressively. They are short, and the first two minutes decide who is in which group.</li>
          <li>Expect competing resolutions rather than one document, and expect to merge late and under pressure.</li>
          <li>Expect awards, and expect the room&apos;s behaviour to be shaped by them.</li>
        </ul>

        <p>
          For the rules both circuits share, our <Link href="/blog/mun-rules-of-procedure">rules of procedure reference</Link> is the common core, and the <Link href="/blog/una-usa-rules-of-procedure">UNA-USA guide</Link> is the other half of this pair. If you are training a delegation on an unfamiliar ruleset, the cheapest way to do it is to run the procedure once rather than explain it twice: you can open a free committee at <Link href="/create">/create</Link> and put your team through a full resolution and vote in under an hour.
        </p>
      </ArticleLayout>
    </>
  );
}
