import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';

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

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#EDE7D8', padding: '48px 24px 80px' },
  wrap: { maxWidth: '720px', margin: '0 auto' },
  back: { fontSize: '13px', color: '#6A5A4A', textDecoration: 'none', display: 'inline-block', marginBottom: '32px' },
  h1: { fontSize: '36px', fontWeight: 900, color: '#1B3828', lineHeight: 1.15, marginBottom: '12px' },
  meta: { fontSize: '13px', color: '#9A8A78', marginBottom: '40px' },
  article: { backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: '20px', padding: '40px 40px 48px' },
  h2: { fontSize: '22px', fontWeight: 800, color: '#1B3828', marginTop: '40px', marginBottom: '12px' },
  h3: { fontSize: '17px', fontWeight: 700, color: '#1B3828', marginTop: '24px', marginBottom: '8px' },
  p: { fontSize: '16px', color: '#1C1410', lineHeight: 1.75, marginBottom: '16px' },
  ul: { paddingLeft: '20px', marginBottom: '16px' },
  li: { fontSize: '16px', color: '#1C1410', lineHeight: 1.75, marginBottom: '6px' },
  checklist: { listStyle: 'none', padding: 0, marginBottom: '16px' },
  checkItem: { fontSize: '16px', color: '#1C1410', lineHeight: 1.75, marginBottom: '8px', paddingLeft: '28px', position: 'relative' as const },
  callout: { backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', borderLeft: '4px solid #1B3828', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' },
  calloutText: { fontSize: '15px', color: '#1B3828', fontStyle: 'italic', margin: 0 },
  script: { backgroundColor: '#1B3828', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' },
  scriptText: { fontSize: '14px', color: '#EDE7D8', fontStyle: 'italic', margin: 0, lineHeight: 1.7 },
  cta: { marginTop: '48px', padding: '28px 32px', backgroundColor: '#1B3828', borderRadius: '16px', textAlign: 'center' as const },
  ctaText: { fontSize: '16px', color: '#EDE7D8', marginBottom: '12px' },
  ctaLink: { display: 'inline-block', fontSize: '15px', fontWeight: 800, color: '#EED98A', textDecoration: 'none' },
};

export default function Article5() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div style={s.page}>
        <div style={s.wrap}>
          <Link href="/blog" style={s.back}>← MUN Resources</Link>
          <h1 style={s.h1}>How to Chair Your First MUN Committee: A Practical Guide for New Chairs</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 11 min read</p>
          <article style={s.article}>

            <p style={s.p}>
              Every experienced MUN chair remembers the first time they sat behind the dais. The nerves. The weight of the gavel. The realisation that seventy people are about to look to you for direction.
            </p>
            <p style={s.p}>
              Here is the truth: you do not need to be perfect. Delegates do not expect perfection. They expect fairness, composure, and forward momentum. This guide will give you everything you need to deliver all three.
            </p>

            <h2 style={s.h2}>1. You Don&apos;t Need to Know Everything</h2>
            <p style={s.p}>
              The most common mistake first-time chairs make is trying to memorise every edge case in the rules of procedure before their first session. That leads to either paralysis or over-confidence, and neither is useful.
            </p>
            <p style={s.p}>
              What you do need:
            </p>
            <ul style={s.ul}>
              <li style={s.li}>A solid understanding of the most common motions and their voting thresholds</li>
              <li style={s.li}>A clear mental model of the session flow: roll call → agenda setting → GSL → caucuses → voting</li>
              <li style={s.li}>The confidence to say: <em>&quot;The chair will take a brief recess to consult the rules of procedure&quot;</em> when something unexpected arises</li>
            </ul>
            <p style={s.p}>
              Print your rules of procedure and keep them in front of you. No one expects you to have them memorised. Using them shows competence, not weakness.
            </p>
            <p style={s.p}>
              See also: <Link href="/blog/mun-motions-explained" style={{ color: '#1B3828', fontWeight: 600 }}>MUN Motions Explained</Link>, a complete reference to keep open during your session.
            </p>

            <h2 style={s.h2}>2. Preparation Checklist (Before the Conference)</h2>
            <p style={s.p}>
              Good preparation is the foundation of a confident performance. In the week before your session:
            </p>
            <ul style={s.checklist}>
              {[
                'Read the study guide for your committee topic at least twice. Know the fault lines: which blocs are likely to emerge, which delegations will be most vocal.',
                'Memorise the 5 most common motion types and their thresholds. You will use these constantly.',
                'Prepare your delegate roster. Know which country each delegate represents and roughly how many you have.',
                'Brief your co-chair on roles: who manages the GSL and speaker timing, who manages motion intake, who handles chat and document requests.',
                'Set up your Gavelling session in advance. Pre-load your delegate list, set your default speaking time, and configure your quorum threshold. Share the session code with your co-chair to test it. This takes 5 minutes and saves 10 minutes of fumbling on the day.',
                'Prepare an opening statement (2–3 minutes). It sets the tone.',
              ].map((item, i) => (
                <li key={i} style={{ ...s.checkItem, paddingLeft: '28px' }}>
                  <span style={{ position: 'absolute' as const, left: 0, color: '#1B3828', fontWeight: 700 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <h2 style={s.h2}>3. Day-Of Setup (30 Minutes Before)</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Arrange the room.</strong> Placards at each seat. Name plates if available. Enough space for delegates to raise their placards clearly.</li>
              <li style={s.li}><strong>Open Gavelling and confirm your delegate list.</strong> Mark any last-minute additions or withdrawals.</li>
              <li style={s.li}><strong>Send the session code to delegates.</strong> Most conferences do this in a WhatsApp group or by posting a code on the board. Gavelling&apos;s 6-character code is designed to be easy to share and enter on any device.</li>
              <li style={s.li}><strong>Confirm your co-chair is set up and knows their role.</strong> Run a quick verbal briefing. Three sentences is enough.</li>
              <li style={s.li}><strong>Test your gavel.</strong> This sounds trivial. It is not. A gavel that slips or a surface that absorbs the sound undermines your authority immediately.</li>
            </ul>

            <h2 style={s.h2}>4. Opening the Session</h2>
            <p style={s.p}>
              Call the room to order firmly. Wait for silence; do not speak over noise. The gavel is your tool; use it.
            </p>
            <div style={s.script}>
              <p style={s.scriptText}>
                &quot;The [committee name] will come to order. I am [your name], your chair for this session, and this is [co-chair name], your co-chair. We will begin with roll call. When your delegation is called, please respond with Present, Present and Voting, or remain silent if absent.&quot;
              </p>
            </div>
            <h3 style={s.h3}>Roll call</h3>
            <p style={s.p}>
              Call each delegation alphabetically. Note their status. At the end, announce quorum: <em>&quot;Quorum is established. X delegations are present, exceeding the required Y.&quot;</em> Or: <em>&quot;Quorum has not been met. The chair will take a 5-minute recess.&quot;</em>
            </p>
            <h3 style={s.h3}>Setting the agenda</h3>
            <p style={s.p}>
              If your committee has a single topic, announce it and move directly to opening the GSL. If there are multiple topics, entertain motions to set the agenda, hold the vote, and announce the result.
            </p>

            <h2 style={s.h2}>5. Managing Debate: The First Hour</h2>
            <p style={s.p}>
              The first hour sets the tone for the entire conference. Move quickly, be consistent, and project calm authority even if you feel anything but.
            </p>
            <h3 style={s.h3}>Opening the GSL</h3>
            <p style={s.p}>
              <em>&quot;The chair will now open the General Speakers List. Delegations wishing to be added, please raise your placard.&quot;</em>
            </p>
            <p style={s.p}>
              Note additions as quickly as possible. Call the first speaker. Start the timer. You are underway.
            </p>
            <h3 style={s.h3}>Recognising delegates</h3>
            <p style={s.p}>
              Always use the formal recognition: <em>&quot;The chair recognises the delegation of [country].&quot;</em> Never use first names. Never say &quot;you&quot;; it is always &quot;the delegation.&quot; This formal language is not affectation. It creates the psychological structure that keeps delegates in procedural mode.
            </p>
            <h3 style={s.h3}>Handling the first caucus motions</h3>
            <p style={s.p}>
              Expect a moderated caucus motion within the first 20–30 minutes. Process it efficiently: note the parameters, confirm the second, call the vote, announce the result, begin immediately. Do not fill dead air with commentary.
            </p>
            <h3 style={s.h3}>Keeping energy up</h3>
            <p style={s.p}>
              Energy is your product. A slow committee drags; a lively one generates good debate. Move between speakers quickly. If the GSL is thin, consider prompting delegates to add themselves. If an unmod is running long with low productivity, call time early.
            </p>

            <h2 style={s.h2}>6. When Things Go Wrong</h2>
            <p style={s.p}>
              Things will go wrong. Here is how to handle the most common situations:
            </p>
            <h3 style={s.h3}>A delegate challenges your ruling</h3>
            <p style={s.p}>
              This happens. Stay calm. The standard response is: <em>&quot;The chair&apos;s ruling stands. The committee will proceed.&quot;</em> If the delegate raises a formal Point of Order to appeal the ruling, acknowledge it and, if your rules allow, put the ruling to a committee vote. Do not become defensive or justify yourself at length; that signals uncertainty.
            </p>
            <h3 style={s.h3}>Quorum drops mid-session</h3>
            <p style={s.p}>
              If delegates leave and quorum is no longer met, you cannot continue formal procedure. Call a brief recess, contact absent delegates, and resume when quorum is restored. Gavelling tracks quorum automatically, so you will know the moment it drops.
            </p>
            <h3 style={s.h3}>A delegate is out of order</h3>
            <p style={s.p}>
              Interrupt immediately, firmly, and without elaboration: <em>&quot;The delegation is out of order. Please confine your remarks to the topic at hand.&quot;</em> If the behaviour continues: <em>&quot;The chair asks the delegation to yield the floor.&quot;</em> Do not let it continue. The room is watching how you respond.
            </p>
            <h3 style={s.h3}>You don&apos;t know the answer to a procedural question</h3>
            <p style={s.p}>
              Say so honestly: <em>&quot;The chair will consult the rules of procedure.&quot;</em> Take 30 seconds, find the answer, rule clearly. This is far better than guessing and being wrong.
            </p>

            <h2 style={s.h2}>7. Closing the Session</h2>
            <p style={s.p}>
              When time is running short, give the committee a 5-minute warning so delegates can raise any final motions or questions. A motion to adjourn is standard, or the chair may close the session directly if the rules permit.
            </p>
            <div style={s.script}>
              <p style={s.scriptText}>
                &quot;The motion to adjourn passes. The [committee name] is hereby adjourned. The chair thanks all delegations for their contributions to today&apos;s debate. The committee made meaningful progress on [topic]. We look forward to continuing in the next session.&quot;
              </p>
            </div>
            <p style={s.p}>
              Strike the gavel once, firmly. The session is closed.
            </p>

            <h2 style={s.h2}>8. After the Session</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Debrief with your co-chair.</strong> What went well? What would you do differently? This 10-minute conversation is how you improve.</li>
              <li style={s.li}><strong>Review delegate feedback.</strong> Gavelling collects optional delegate feedback at session end. Reading it, even the harsh comments, accelerates your development faster than anything else.</li>
              <li style={s.li}><strong>Archive your notes.</strong> Gavelling stores the session record automatically: speaker history, motions, votes, chat. This is useful for writing committee reports and for your own review.</li>
            </ul>

            <div style={s.callout}>
              <p style={s.calloutText}>
                The best chairs are not the ones who never make mistakes. They are the ones who recover from mistakes gracefully, keep the committee moving, and make every delegate feel heard.
              </p>
            </div>

            <RelatedGuides currentSlug="how-to-chair-first-mun" />
            <div style={s.cta}>
              <p style={s.ctaText}>
                Gavelling was built by chairs, for chairs. It handles the logistics so you can focus on the debate. Set up your first committee free at gavelling.com →
              </p>
              <a href="https://gavelling.com" style={s.ctaLink}>Start free at gavelling.com →</a>
            </div>

          </article>
        </div>
      </div>
    </>
  );
}
