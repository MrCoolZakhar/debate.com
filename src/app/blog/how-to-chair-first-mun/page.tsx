import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3 } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Chair Your First MUN Committee: A Practical Guide for New Chairs',
  description:
    'Nervous about chairing your first Model UN committee? This step-by-step guide covers everything from preparation to running roll call, managing debate, and closing the session.',
  path: '/blog/how-to-chair-first-mun',
  ogDescription:
    'A practical, encouraging guide for first-time MUN chairs.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Chair Your First MUN Committee: A Practical Guide for New Chairs',
  description: 'A step-by-step guide for first-time MUN chairs covering preparation, opening, debate management, and closing.',
  url: 'https://gavelling.com/blog/how-to-chair-first-mun',
  datePublished: '2026-06-01',
  dateModified: '2026-06-01',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/how-to-chair-first-mun' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'How to Chair Your First MUN', item: 'https://gavelling.com/blog/how-to-chair-first-mun' },
  ],
};

export default function Article5() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="how-to-chair-first-mun"
        title="How to Chair Your First MUN Committee: A Practical Guide for New Chairs"
        pitch="Gavelling was built by chairs, for chairs. It handles the logistics so you can focus on the debate. Set up your first committee free at gavelling.com →"
      >

        <p>
          Every experienced MUN chair remembers the first time they sat behind the dais. The nerves. The weight of the gavel. The realisation that seventy people are about to look to you for direction.
        </p>
        <p>
          Here is the truth: you do not need to be perfect. Delegates do not expect perfection. They expect fairness, composure, and forward momentum. This guide will give you everything you need to deliver all three. If you have not been appointed yet, start with <Link href="/blog/how-to-become-a-mun-chair" style={{ color: '#1B3828', fontWeight: 600 }}>how to become a MUN chair</Link>.
        </p>

        <H2>1. You Don&apos;t Need to Know Everything</H2>
        <p>
          The most common mistake first-time chairs make is trying to memorise every edge case in the rules of procedure before their first session. That leads to either paralysis or overconfidence, and neither is useful.
        </p>
        <p>
          What you do need:
        </p>
        <ul>
          <li>A solid understanding of the most common motions and their voting thresholds</li>
          <li>A clear mental model of the session flow: roll call → agenda setting → GSL → caucuses → voting</li>
          <li>The confidence to say: <em>&quot;The chair will take a brief recess to consult the rules of procedure&quot;</em> when something unexpected arises</li>
        </ul>
        <p>
          Print your rules of procedure and keep them in front of you. No one expects you to have them memorised. Using them shows competence, not weakness.
        </p>
        <p>
          See also: <Link href="/blog/mun-motions-explained" style={{ color: '#1B3828', fontWeight: 600 }}>MUN Motions Explained</Link>, a complete reference to keep open during your session. For the delegates who test you, read our guide to <Link href="/blog/mun-difficult-delegates" style={{ color: '#1B3828', fontWeight: 600 }}>handling difficult delegates</Link>.
        </p>

        <H2>2. Preparation Checklist (Before the Conference)</H2>
        <p>
          Good preparation is the foundation of a confident performance. In the week before your session:
        </p>
        <ul className="gv-check">
          {[
            'Read the study guide for your committee topic at least twice. Know the fault lines: which blocs are likely to emerge, which delegations will be most vocal.',
            'Memorise the 5 most common motion types and their thresholds. You will use these constantly.',
            'Prepare your delegate roster. Know which country each delegate represents and roughly how many you have.',
            'Brief your co-chair on roles: who manages the GSL and speaker timing, who manages motion intake, who handles chat and document requests.',
            'Set up your Gavelling session in advance. Pre-load your delegate list, set your default speaking time, and configure your quorum threshold. Share the session code with your co-chair to test it. This takes 5 minutes and saves 10 minutes of fumbling on the day.',
            'Prepare an opening statement (2–3 minutes). It sets the tone.',
          ].map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p>
          If you are writing the study guide yourself, our guide to <Link href="/blog/mun-background-guide-writing" style={{ color: '#1B3828', fontWeight: 600 }}>writing a MUN background guide</Link> covers it.
        </p>

        <H2>3. Day-Of Setup (30 Minutes Before)</H2>
        <ul>
          <li><strong>Arrange the room.</strong> Placards at each seat. Name plates if available. Enough space for delegates to raise their placards clearly.</li>
          <li><strong>Open Gavelling and confirm your delegate list.</strong> Mark any last-minute additions or withdrawals.</li>
          <li><strong>Send the session code to delegates.</strong> Most conferences do this in a WhatsApp group or by posting a code on the board. Gavelling&apos;s 6-character code is designed to be easy to share and enter on any device.</li>
          <li><strong>Confirm your co-chair is set up and knows their role.</strong> Run a quick verbal briefing. Three sentences is enough.</li>
          <li><strong>Test your gavel.</strong> This sounds trivial. It is not. A gavel that slips or a surface that absorbs the sound undermines your authority immediately.</li>
        </ul>

        <H2>4. Opening the Session</H2>
        <p>
          Call the room to order firmly. Wait for silence; do not speak over noise. The gavel is your tool; use it.
        </p>
        <div className="gv-script">
          <p>
            &quot;The [committee name] will come to order. I am [your name], your chair for this session, and this is [co-chair name], your co-chair. We will begin with roll call. When your delegation is called, please respond with Present, Present and Voting, or remain silent if absent.&quot;
          </p>
        </div>
        <H3>Roll call</H3>
        <p>
          Call each delegation alphabetically. Note their status. At the end, announce quorum: <em>&quot;Quorum is established. X delegations are present, exceeding the required Y.&quot;</em> Or: <em>&quot;Quorum has not been met. The chair will take a 5-minute recess.&quot;</em>
        </p>
        <H3>Setting the agenda</H3>
        <p>
          If your committee has a single topic, announce it and move directly to opening the GSL. If there are multiple topics, entertain motions to set the agenda, hold the vote, and announce the result.
        </p>

        <H2>5. Managing Debate: The First Hour</H2>
        <p>
          The first hour sets the tone for the entire conference. Move quickly, be consistent, and project calm authority even if you feel anything but. Our guide to <Link href="/blog/mun-controlling-the-floor" style={{ color: '#1B3828', fontWeight: 600 }}>controlling the floor</Link> goes deeper.
        </p>
        <H3>Opening the GSL</H3>
        <p>
          <em>&quot;The chair will now open the General Speakers List. Delegations wishing to be added, please raise your placard.&quot;</em>
        </p>
        <p>
          Note additions as quickly as possible. Call the first speaker. Start the timer. You are underway.
        </p>
        <H3>Recognising delegates</H3>
        <p>
          Always use the formal recognition: <em>&quot;The chair recognises the delegation of [country].&quot;</em> Never use first names. Never say &quot;you&quot;; it is always &quot;the delegation.&quot; This formal language is not affectation. It creates the psychological structure that keeps delegates in procedural mode.
        </p>
        <H3>Handling the first caucus motions</H3>
        <p>
          Expect a moderated caucus motion within the first 20–30 minutes. Process it efficiently: note the parameters, confirm the second, call the vote, announce the result, begin immediately. Do not fill dead air with commentary.
        </p>
        <H3>Keeping energy up</H3>
        <p>
          Energy is your product. A slow committee drags; a lively one generates good debate. Move between speakers quickly. If the GSL is thin, consider prompting delegates to add themselves. If an unmod is running long with low productivity, call time early.
        </p>

        <H2>6. When Things Go Wrong</H2>
        <p>
          Things will go wrong. Here is how to handle the most common situations:
        </p>
        <H3>A delegate challenges your ruling</H3>
        <p>
          This happens. Stay calm. The standard response is: <em>&quot;The chair&apos;s ruling stands. The committee will proceed.&quot;</em> If the delegate raises a formal Point of Order to appeal the ruling, acknowledge it and, if your rules allow, put the ruling to a committee vote. Do not become defensive or justify yourself at length; that signals uncertainty.
        </p>
        <H3>Quorum drops mid-session</H3>
        <p>
          If delegates leave and quorum is no longer met, you cannot continue formal procedure. Call a brief recess, contact absent delegates, and resume when quorum is restored. Gavelling tracks quorum automatically, so you will know the moment it drops.
        </p>
        <H3>A delegate is out of order</H3>
        <p>
          Interrupt immediately, firmly, and without elaboration: <em>&quot;The delegation is out of order. Please confine your remarks to the topic at hand.&quot;</em> If the behaviour continues: <em>&quot;The chair asks the delegation to yield the floor.&quot;</em> Do not let it continue. The room is watching how you respond.
        </p>
        <H3>You don&apos;t know the answer to a procedural question</H3>
        <p>
          Say so honestly: <em>&quot;The chair will consult the rules of procedure.&quot;</em> Take 30 seconds, find the answer, rule clearly. This is far better than guessing and being wrong.
        </p>

        <H2>7. Closing the Session</H2>
        <p>
          When time is running short, give the committee a 5-minute warning so delegates can raise any final motions or questions. A motion to adjourn is standard, or the chair may close the session directly if the rules permit.
        </p>
        <div className="gv-script">
          <p>
            &quot;The motion to adjourn passes. The [committee name] is hereby adjourned. The chair thanks all delegations for their contributions to today&apos;s debate. The committee made meaningful progress on [topic]. We look forward to continuing in the next session.&quot;
          </p>
        </div>
        <p>
          Strike the gavel once, firmly. The session is closed.
        </p>

        <H2>8. After the Session</H2>
        <ul>
          <li><strong>Debrief with your co-chair.</strong> What went well? What would you do differently? This 10-minute conversation is how you improve.</li>
          <li><strong>Review delegate feedback.</strong> Ask delegates for a few lines of feedback at the end, on paper or a short form. Reading it, even the harsh comments, speeds up your development more than anything else.</li>
          <li><strong>Prepare for awards.</strong> If your conference gives awards, see our <Link href="/blog/mun-judging-rubric" style={{ color: '#1B3828', fontWeight: 600 }}>MUN judging rubric</Link>.</li>
          <li><strong>Archive your notes.</strong> Before you close the laptop, download the session record from the End View or the scoreboard: one spreadsheet with the history, scores, speeches, attendance and documents. A standalone room is deleted about an hour after it ends. The record is useful for writing committee reports and for your own review.</li>
        </ul>

        <div className="gv-callout gv-callout-plain">
          <p>
            The best chairs are not the ones who never make mistakes. They are the ones who recover from mistakes gracefully, keep the committee moving, and make every delegate feel heard.
          </p>
        </div>
      </ArticleLayout>
    </>
  );
}
