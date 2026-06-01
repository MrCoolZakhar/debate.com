import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'General Speakers List (GSL) in MUN — Complete Guide for Chairs and Delegates',
  description:
    'What is the General Speakers List in Model UN? How does it work, how do delegates add themselves, how do chairs manage it, and what are the rules? Full guide with tips.',
  alternates: { canonical: 'https://gavelling.com/blog/general-speakers-list-guide' },
  openGraph: {
    title: 'General Speakers List (GSL) in MUN — Complete Guide for Chairs and Delegates',
    description: 'Everything you need to know about the GSL: how it works, yielding, points, and chair tips.',
    url: 'https://gavelling.com/blog/general-speakers-list-guide',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'General Speakers List (GSL) in MUN — Complete Guide for Chairs and Delegates',
  description: 'What is the General Speakers List in Model UN? How does it work, how do chairs manage it?',
  url: 'https://gavelling.com/blog/general-speakers-list-guide',
  datePublished: '2026-06-01',
  dateModified: '2026-06-01',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/general-speakers-list-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'General Speakers List Guide', item: 'https://gavelling.com/blog/general-speakers-list-guide' },
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
  callout: { backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' },
  calloutText: { fontSize: '15px', color: '#1B3828', fontWeight: 600, margin: 0 },
  cta: { marginTop: '48px', padding: '28px 32px', backgroundColor: '#1B3828', borderRadius: '16px', textAlign: 'center' as const },
  ctaText: { fontSize: '16px', color: '#EDE7D8', marginBottom: '12px' },
  ctaLink: { display: 'inline-block', fontSize: '15px', fontWeight: 800, color: '#EED98A', textDecoration: 'none' },
};

export default function Article3() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div style={s.page}>
        <div style={s.wrap}>
          <a href="/blog" style={s.back}>← MUN Resources</a>
          <h1 style={s.h1}>General Speakers List (GSL) in MUN — Complete Guide for Chairs and Delegates</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 9 min read</p>
          <article style={s.article}>

            <p style={s.p}>
              The General Speakers List is the backbone of Model UN debate. Whether you are a first-time delegate trying to understand why the chair keeps adding names to a list, or a chair looking to manage it more effectively, this guide covers everything you need to know.
            </p>

            <div style={s.callout}>
              <p style={s.calloutText}>GSL stands for General Speakers List — the primary, ongoing queue of delegates who wish to address the committee. It is distinct from caucus speaker lists, which are temporary.</p>
            </div>

            <h2 style={s.h2}>1. What Is the General Speakers List?</h2>
            <p style={s.p}>
              The GSL is MUN&apos;s primary debate mechanism — the &quot;floor&quot; of the committee. Once the agenda is set, the chair opens the GSL and delegates who wish to speak on the topic add their names. The list is maintained in order, and delegates speak one at a time when their turn arrives, subject to a per-speaker time limit set by the committee.
            </p>
            <p style={s.p}>
              The critical property of the GSL is its permanence: unlike caucus speaker queues, which are wiped when a caucus ends, the GSL survives throughout the entire session. A delegate who signed up at the beginning of day one might still be on the list at the end of day two. This continuity gives the GSL its role as the committee&apos;s primary formal debate channel.
            </p>

            <h2 style={s.h2}>2. How the GSL Works — Step by Step</h2>
            <h3 style={s.h3}>Opening the list</h3>
            <p style={s.p}>
              After the agenda is set, the chair declares the GSL open and asks delegates who wish to speak to raise their placards. The chair (or co-chair) notes each delegation in the order their placard was raised and adds them to the list. In practice, this happens quickly — most delegates raise immediately, so the chair moves through the room efficiently.
            </p>
            <h3 style={s.h3}>Adding to the list</h3>
            <p style={s.p}>
              The list stays open throughout the session. At any point between speakers, delegates may raise their placard to be added. In most rules of procedure, a delegate can only appear on the GSL once at a time — they cannot queue twice.
            </p>
            <p style={s.p}>
              In Gavelling, delegates can request to speak directly from their device. The chair sees the request and approves with one tap — eliminating the placard-watching overhead for the chair and making it easier for delegates in large rooms to register.
            </p>
            <h3 style={s.h3}>Speaking</h3>
            <p style={s.p}>
              When a delegate&apos;s name reaches the top of the list, the chair recognises them: <em>&quot;The chair recognises the delegation of France.&quot;</em> The speaker&apos;s timer begins. They have the full speaking time — typically 60–90 seconds — to address the committee. The chair enforces the time limit strictly and gives a warning (usually a knock) when a few seconds remain.
            </p>
            <h3 style={s.h3}>After speaking</h3>
            <p style={s.p}>
              When the delegate finishes, they yield their remaining time (see below) and the chair calls the next speaker. The current speaker is removed from the list and cannot re-add themselves until it is their turn again — though most rules of procedure allow re-adding after speaking.
            </p>

            <h2 style={s.h2}>3. Yielding Remaining Time</h2>
            <p style={s.p}>
              When a delegate finishes speaking before their time expires, they must yield the remaining time. There are three options:
            </p>
            <ul style={s.ul}>
              <li style={s.li}>
                <strong>Yield to the chair</strong> — the simplest and most common option. The remaining time is lost; the chair immediately calls the next speaker.
              </li>
              <li style={s.li}>
                <strong>Yield to another delegate</strong> — the named delegation speaks for whatever time remains. This is a useful tactical tool — yielding to an ally gives them floor time without them needing to wait for their position in the queue.
              </li>
              <li style={s.li}>
                <strong>Yield to points/questions</strong> — the floor is briefly opened for points of information from other delegates. The original speaker must answer within the remaining time. Not all rules of procedure allow this.
              </li>
            </ul>
            <p style={s.p}>
              Chairs should ask &quot;To whom do you yield your remaining time?&quot; as soon as the delegate sits. A fast yield transition is the mark of an experienced committee.
            </p>

            <h2 style={s.h2}>4. Points During the GSL</h2>
            <p style={s.p}>
              While the GSL is running, delegates may raise procedural Points that interrupt normal order:
            </p>
            <h3 style={s.h3}>Point of Information</h3>
            <p style={s.p}>
              A question directed at the current speaker. Only raised during the speaker&apos;s time (usually via a yield to questions). The chair decides whether to entertain the point.
            </p>
            <h3 style={s.h3}>Point of Order</h3>
            <p style={s.p}>
              A challenge to the chair&apos;s procedural ruling or a note that procedure is not being followed correctly. Not a question — it is a formal challenge. The chair must address it immediately. Point of Order always takes precedence over the floor.
            </p>
            <h3 style={s.h3}>Right of Reply</h3>
            <p style={s.p}>
              When a delegate&apos;s nation has been directly and personally attacked in a speech, they may request a Right of Reply. If granted by the chair, they are inserted at the top of the GSL with a shorter time limit (usually 30 seconds) specifically to respond to the attack. Right of Reply cannot be used for general disagreement — only for personal or national insults.
            </p>

            <h2 style={s.h2}>5. How Chairs Should Manage the GSL</h2>
            <p style={s.p}>
              The quality of GSL management directly affects the energy and flow of a committee session. Dead time — the pause between one speaker finishing and the next being called — is the enemy. Here is how experienced chairs minimise it:
            </p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Keep the list visible.</strong> Delegates who cannot see their position ask constantly. Display the queue on a screen or use a tool like Gavelling that shows delegates their queue position on their own device.</li>
              <li style={s.li}><strong>Pre-call the next speaker.</strong> While the current speaker is finishing, quietly note who is next and be ready to call them the instant the timer ends.</li>
              <li style={s.li}><strong>Enforce time strictly.</strong> Inconsistent enforcement erodes your authority. Use the gavel at time — every time.</li>
              <li style={s.li}><strong>Add to the list continuously.</strong> During speakers, glance around the room for raised placards and note them without interrupting the speaker.</li>
            </ul>
            <p style={s.p}>
              <strong>Gavelling</strong> automates the hardest parts of GSL management: the timer runs automatically, the queue is visible to all delegates in real time, and speaker advancement is a single button tap. Chairs who use it report significantly shorter inter-speaker gaps and fewer procedural interruptions.
            </p>

            <h2 style={s.h2}>6. GSL vs Caucuses — When to Use Each</h2>
            <p style={s.p}>
              The GSL provides formal, structured debate where every delegate gets equal floor time. Caucuses (moderated or unmoderated) are tools for shifting the committee into a different mode:
            </p>
            <ul style={s.ul}>
              <li style={s.li}><strong>GSL</strong> — best for formal position statements, broad debate, or when you want to hear from a wide range of delegations.</li>
              <li style={s.li}><strong>Moderated Caucus</strong> — best for focused debate on a specific sub-topic with a controlled number of speakers and a clear time limit.</li>
              <li style={s.li}><strong>Unmoderated Caucus</strong> — best for informal negotiation, bloc-building, and working paper drafting.</li>
            </ul>
            <p style={s.p}>
              A healthy committee session alternates between GSL debate and caucuses. Too much GSL without caucuses can feel rigid; too many caucuses without GSL debate loses the formal record.
            </p>
            <p style={s.p}>
              See also: <a href="/blog/mun-motions-explained" style={{ color: '#1B3828', fontWeight: 600 }}>MUN Motions Explained</a> for how caucus motions are proposed and voted on.
            </p>

            <h2 style={s.h2}>7. Common Chair Mistakes with the GSL</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Forgetting to re-open the list after a caucus.</strong> The GSL pauses during caucuses. Remember to explicitly announce it is open again when the caucus ends.</li>
              <li style={s.li}><strong>Allowing re-adds during a speaker&apos;s turn.</strong> Only add delegates to the list between speakers to avoid confusion.</li>
              <li style={s.li}><strong>Wiping the GSL when entering a caucus.</strong> The GSL survives all caucuses. Never clear it when accepting a caucus motion.</li>
              <li style={s.li}><strong>Forgetting to call the next speaker promptly.</strong> Every second of dead air drains committee energy.</li>
            </ul>

            <div style={s.cta}>
              <p style={s.ctaText}>
                Gavelling manages the GSL automatically — queue, timer, and speaker advancement — so you can focus on the debate.
              </p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try it free at gavelling.com →</a>
            </div>

          </article>
        </div>
      </div>
    </>
  );
}
