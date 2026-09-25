import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Write a MUN Crisis Directive: Three Kinds, Four Worked Examples',
  description:
    'What a directive is, the difference between public, private and press, and full annotated examples with the backroom response each one earns',
  path: '/blog/mun-crisis-directive-guide',
  ogDescription: 'The three kinds of crisis directive, with full worked examples and the backroom response each earns.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Write a MUN Crisis Directive: Three Kinds, Four Worked Examples',
  description: 'The three kinds of crisis directive, with full worked examples and the backroom response each earns.',
  url: 'https://gavelling.com/blog/mun-crisis-directive-guide',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-crisis-directive-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Crisis Directives', item: 'https://gavelling.com/blog/mun-crisis-directive-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-crisis-directive-guide"
        pitch="Gavelling keeps a crisis room on procedure: timers, speakers and motions on one dais screen so the staff can think about the arc instead of the clock."
      >
        <p>A directive is the only thing you actually control in a crisis committee. Your speech persuades the room, but your directive is the instruction the backroom reads, rules on and turns into the next update. Most delegates write two or three bad directives before anyone tells them why they are bad, which wastes the first third of the conference. This guide covers the three kinds, the test that decides whether a directive is inside your powers, and four full examples with the response each one would get.</p>

        <H2>What a directive is, and why it replaces a resolution</H2>
        <p>In a standard committee the output is a resolution: long, negotiated over two days, voted once. A crisis committee moves too fast for that. Instead, the room and the individuals in it issue directives: short written instructions that take effect the moment the crisis staff accept them.</p>
        <p>That changes the unit of work. A resolution is a document. A directive is an <em>action</em>, and it is judged the way an action is judged: could this person order it, would it plausibly work, and what happens next. A directive with beautiful preambulatory language and no verb is worth nothing. A directive of four lines that moves two battalions and tells one newspaper why is worth a great deal.</p>
        <p>If you are new to the format itself, read our <Link href="/blog/mun-crisis-committee-guide">crisis committee guide</Link> first. It covers the frontroom and backroom split, crisis updates and how the arc of a weekend is built. This guide assumes you already know the room and need the paperwork. For how crisis sits beside other formats, see <Link href="/blog/mun-committee-types">MUN committee types</Link>.</p>

        <H2>Public directives: what the committee can do together</H2>
        <p>A public directive, sometimes called a committee directive, is the room acting as a body. It is debated, sponsored and voted, usually by simple majority, and it commands the resources the committee collectively controls.</p>
        <FactCard title="Public directive: the shape">
          A title. A sponsor list. Then numbered operative clauses, each one an order with an actor, an action and a limit. No preambulatory clauses in most rooms. Half a page is normal. A page is long.
        </FactCard>
        <p>The single most common failure in a public directive is scope. A cabinet of a state can order that state&rsquo;s army, treasury and ministries. It cannot order another country&rsquo;s army, and it cannot order an outcome. &ldquo;Resolves to end the insurgency&rdquo; is not an order, it is a wish. &ldquo;Orders the 3rd Division to secure the two bridges north of the capital and hold them for seventy-two hours&rdquo; is an order, because a general could receive it and obey it.</p>

        <H3>Worked example: a public directive</H3>
        <FactCard title="DIRECTIVE 4.1: SECURING THE NORTHERN CORRIDOR">
          <p>Sponsors: Minister of Defence, Minister of the Interior, Chief of the General Staff</p>
          <ol>
            <li>Orders the 3rd Mechanised Division to establish and hold checkpoints on the two road bridges north of the capital, with rules of engagement limited to defensive fire;</li>
            <li>Instructs the Ministry of the Interior to move two thousand tonnes of stored grain from the eastern depot to the northern district by rail within five days, escorted by police rather than army units;</li>
            <li>Authorises the Minister of Finance to release up to two per cent of the contingency reserve to pay for the movement in clause 2, with a written account to this cabinet within seven days;</li>
            <li>Requests that the Foreign Minister inform the neighbouring government of the checkpoint positions in advance, in writing, to avoid a border incident.</li>
          </ol>
        </FactCard>
        <p><strong>Why this works.</strong> Every clause has a named actor and a limit: which division, which bridges, how long, how much money, in what form. Clause 4 anticipates the obvious backfire, a border incident, and spends one sentence preventing it. Clause 3 creates a reporting obligation, which gives the committee a reason to meet again about this and gives you a thread to pull in three hours.</p>
        <p><strong>What the backroom does with it.</strong> Accepts it, probably in full, and returns an update that adds friction rather than refusal: the rail line is cut in one place, or the neighbouring government answers the letter with a demand. A directive written this tightly almost never fails outright, because there is nothing implausible to fail.</p>

        <H2>Private directives: what you can do alone</H2>
        <p>A private or personal directive is you acting with your own portfolio powers, sent straight to the backroom and not debated. Nobody else in the room sees it unless the consequences become public. This is where a crisis committee is actually won and lost.</p>
        <p>The whole question is what your character can genuinely order. Here is the test to apply before you write a single line.</p>
        <Callout>The portfolio test: name the specific human being who receives this instruction, and state why they would obey you rather than someone else. If you cannot name them, you do not have the power. If they would obey the Minister of Defence rather than you, ask the Minister of Defence instead.</Callout>
        <p>Applied honestly, that test kills most of the bad private directives people send. A newspaper owner cannot move soldiers, but can move a story, a reporter and a proprietor&rsquo;s private line to a minister. A general cannot pass a budget, but can quietly move a regiment and report it afterwards. A foreign minister cannot arrest anyone, but can grant a visa, recall an ambassador or leak a cable.</p>

        <H3>Worked example: a good private directive</H3>
        <FactCard title="PRIVATE DIRECTIVE, Minister of the Interior, sent 14:20">
          <p>To: Director of the Northern Gendarmerie, personally, by secure line.</p>
          <p>1. Move forty officers from the capital reserve to the northern district tonight, in plain vehicles, quartered in the police barracks rather than the army base. They are to take no public action.</p>
          <p>2. Identify, within forty-eight hours, which of the three district commissioners has been passing meeting minutes to the opposition newspaper. Report to me in person and to nobody else.</p>
          <p>3. Prepare, but do not execute, warrants for the two men named in my earlier note. I will decide after the cabinet meets on Sunday.</p>
        </FactCard>
        <p><strong>Why this works.</strong> It names the recipient and the channel. Every clause is an action, not a result. Clause 2 asks a question the backroom can answer with a real name, which gives them something interesting to write. Clause 3 prepares an option without spending it, which means you can act instantly later while everyone else is still writing.</p>
        <p><strong>What the backroom does with it.</strong> Executes clauses 1 and 3, and answers 2 with a name and a complication, because a staffer given a good question will always invent an interesting answer. You now know something nobody else in the room knows, which is the actual currency of crisis.</p>

        <H3>Worked example: a private directive that fails</H3>
        <FactCard title="PRIVATE DIRECTIVE, Minister of Culture, sent 14:20">
          <p>I use my connections to gain control of the army in the north and remove the general. I also secretly build a network of loyal agents across the country who report to me and begin planning to take power at the right moment.</p>
        </FactCard>
        <p><strong>Why this fails.</strong> Three separate reasons, and each on its own is enough. It exceeds the portfolio: a culture minister does not command the army and the backroom will not hand it over. It asks for a state rather than an action: &ldquo;build a network&rdquo; has no first step, no cost and no timeline, so there is nothing to execute. And it announces an ambition, which gives the staff a free target: the safest way for them to keep the story alive is to have someone discover it.</p>
        <p><strong>What the backroom does with it.</strong> Rejects most of it and probably punishes the rest. This is the single most common directive written by delegates in their first crisis room, and it is why they spend Saturday afternoon under investigation.</p>

        <H2>Press releases and communiqués</H2>
        <p>The third form is a public statement: a press release, a communiqué, a speech to be broadcast, a letter to another government that you expect to be read publicly. Conferences treat these as directives because they change the world, and they change it in the one dimension the others cannot reach: what people believe.</p>
        <p>They are badly underused. A committee that has just done something unpopular and says nothing hands the story to whoever speaks first. A press release that frames an action before the opposition does is often worth more than the action.</p>
        <p>Keep them short and in voice. A government communiqué does not read like a delegate: it states a fact, gives a reason, and makes one commitment. If your conference runs a <Link href="/blog/mun-press-corps-guide">press corps</Link>, expect them to quote it back to you badly, which is realistic.</p>

        <H2>The most useful directive nobody writes: the information request</H2>
        <p>You are allowed to ask. A private directive that asks a precise question is cheap, fast and almost always answered, because answering it gives the backroom a chance to develop the story.</p>
        <p>The rule is that it must be something your character could plausibly find out and could not simply infer. &ldquo;Who is behind the attack?&rdquo; is a guess disguised as a question, and you will get a vague answer. &ldquo;Which units were on leave in the northern district on the night of the attack, and who signed the leave orders?&rdquo; is a question a minister could have answered by an official in a day, and the answer will contain a name.</p>
        <p>Send two or three of these in the first hour. While everyone else is drafting speeches, you will be the only person in the room who knows anything specific.</p>

        <H2>Specific, active, short: the same directive rewritten twice</H2>
        <p>Most improvement in directive writing is subtraction. Here is one instruction at three levels.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Version</th><th>Text</th><th>Verdict</th></tr></thead>
            <tbody>
              <tr>
                <td>Weak</td>
                <td>Improves the security situation in the north and addresses the humanitarian needs of the population.</td>
                <td>No actor, no action, no limit. Nothing to execute.</td>
              </tr>
              <tr>
                <td>Better</td>
                <td>Sends army units and food aid to the northern district as soon as possible.</td>
                <td>Has actions but no numbers or timing. The staff will decide the details, and they will not decide them in your favour.</td>
              </tr>
              <tr>
                <td>Strong</td>
                <td>Orders the 3rd Division to hold the two northern road bridges with defensive rules of engagement, and moves two thousand tonnes of grain by rail within five days under police escort.</td>
                <td>Actor, action, quantity, route, timing and a constraint. Executable as written.</td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Three questions to run over any directive before you send it: who receives this, what exactly do they do on Monday morning, and what is the first thing that could go wrong. If you cannot answer all three in one sentence each, the directive is not finished.</p>

        <H2>How crisis staff decide what happens</H2>
        <p>Backroom staff are not scoring you. They are keeping a story moving for twenty hours with limited people, and they resolve directives against roughly four questions. Our <Link href="/blog/mun-crisis-backroom-guide">crisis backroom guide</Link> shows that side of the table.</p>
        <ul>
          <li><strong>Could this character order this?</strong> Outside the portfolio, it fails, sometimes loudly.</li>
          <li><strong>Is it physically plausible in the time given?</strong> Armies move slowly, money moves slowly, rumours move fast.</li>
          <li><strong>Does it create something to write about?</strong> A directive that opens a thread beats a directive that closes one, every time. This is the part delegates never account for.</li>
          <li><strong>Does it conflict with something already in motion?</strong> Including something another delegate sent privately ten minutes earlier, which is how most surprises happen.</li>
        </ul>
        <p>Outcomes are rarely binary. Expect partial success with a complication attached, which is the staff&rsquo;s way of saying yes while keeping the room alive.</p>

        <H2>Sequencing: build an arc, do not fire one-offs</H2>
        <p>A delegate who sends eight unconnected directives gets eight small results. A delegate who sends eight connected directives gets a position. Think in three stages.</p>
        <ul>
          <li><strong>Hours one and two, set up.</strong> Two information requests, one quiet movement of a resource you will need later, one relationship established with a person outside the room.</li>
          <li><strong>The middle, build.</strong> Convert what you learned into something concrete: money moved, a person recruited, a story planted, a unit in the right place. Keep the committee looking at a public directive you sponsored while you do it.</li>
          <li><strong>The end, spend.</strong> Use it once, publicly and decisively, in a way the room can see. Crisis rewards visible consequences, and a plan nobody ever noticed is a plan that earns you nothing.</li>
        </ul>
        <p>Keep a one-page log of every directive you send and the answer you get. In hour nine you will not remember what you asked in hour two, and the delegate who remembers is the delegate who wins the argument.</p>

        <H2>The failures worth naming</H2>
        <ul>
          <li><strong>Exceeding the portfolio.</strong> The commonest, and the one the test above prevents.</li>
          <li><strong>Vagueness.</strong> No actor, no quantity, no clock.</li>
          <li><strong>Asking for what you could infer.</strong> It wastes a directive and marks you as unprepared.</li>
          <li><strong>The coup that announces itself.</strong> Writing down that you intend to seize power is an invitation.</li>
          <li><strong>The single grand plan.</strong> One elaborate directive in hour four, when three small ones in hour one would have built the ground for it.</li>
          <li><strong>Ignoring the public room.</strong> Private directives win resources. Public work wins the chair&rsquo;s attention, and the chair is the person writing your committee&rsquo;s record.</li>
          <li><strong>Handwriting that cannot be read.</strong> Genuinely a problem in paper rooms. Print your name and time on every note.</li>
        </ul>
        <p>Crisis directives reward preparation that is narrow rather than broad: know your character&rsquo;s actual authority, the three people they can call, and the two resources they control. That is a better use of your last evening than reading another twenty pages of background. If you are chairing rather than delegating, read <Link href="/blog/how-to-run-crisis-committee">how to run a crisis committee</Link>. The same detail is what makes a room easy to run, and <Link href="/blog/how-to-chair-first-mun">a first-time chair</Link> should spend their preparation on portfolio powers for the same reason. When the directives are flowing, the dais still has to hold the floor, keep time and log what happened, which is what <Link href="/create/sessions">a free Gavelling session</Link> is for.</p>
      </ArticleLayout>
    </>
  );
}
