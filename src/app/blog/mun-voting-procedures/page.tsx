import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Voting Procedures Explained — In Favour, Against, Abstain',
  description: 'A complete guide to Model UN voting procedures: simple majority, supermajority, roll call votes, placard votes, abstentions, and voting on resolutions.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-voting-procedures' },
  openGraph: {
    title: 'MUN Voting Procedures Explained — In Favour, Against, Abstain',
    description: 'Everything you need to know about voting in Model UN committees.',
    url: 'https://gavelling.com/blog/mun-voting-procedures',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Voting Procedures Explained — In Favour, Against, Abstain',
  description: 'Complete guide to MUN voting procedures.',
  url: 'https://gavelling.com/blog/mun-voting-procedures',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-voting-procedures' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Voting Procedures', item: 'https://gavelling.com/blog/mun-voting-procedures' },
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
  callout: { backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', borderLeft: '4px solid #1B3828', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' },
  calloutText: { fontSize: '15px', color: '#1B3828', fontStyle: 'italic', margin: 0 },
  cta: { marginTop: '48px', padding: '28px 32px', backgroundColor: '#1B3828', borderRadius: '16px', textAlign: 'center' as const },
  ctaText: { fontSize: '16px', color: '#EDE7D8', marginBottom: '12px' },
  ctaLink: { display: 'inline-block', fontSize: '15px', fontWeight: 800, color: '#EED98A', textDecoration: 'none' },
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div style={s.page}>
        <div style={s.wrap}>
          <Link href="/blog" style={s.back}>← MUN Resources</Link>
          <h1 style={s.h1}>MUN Voting Procedures Explained — In Favour, Against, Abstain</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 10 min read</p>
          <article style={s.article}>

            <p style={s.p}>Voting is the moment everything in a Model UN committee builds toward. Hours of debate, bloc-building, and resolution drafting all come down to a few minutes at the voting rostrum. Understanding exactly how MUN voting works — what counts, what does not, and what your options are — is essential for both delegates and chairs.</p>

            <h2 style={s.h2}>Types of Votes in MUN</h2>
            <p style={s.p}>Most MUN committees use two main voting mechanisms: placard votes (show of placards) for procedural motions, and roll call votes for substantive matters like resolutions. Some conferences use electronic voting systems or a standing vote for certain matters. Regardless of format, the principle is the same: each present-and-voting delegation casts one vote.</p>

            <h3 style={s.h3}>Placard Vote</h3>
            <p style={s.p}>The simplest form. The chair asks delegates to raise their placards in favour, against, and those abstaining. The chair (or a counter) tallies the results. Used primarily for procedural motions: caucus proposals, adjournment of the speakers list, suspension of debate.</p>

            <h3 style={s.h3}>Roll Call Vote</h3>
            <p style={s.p}>Used for resolutions and other substantive matters. Each delegation is called in alphabetical order and votes aloud: "In Favour," "Against," or "Abstain." Delegates may also pass (defer) and vote at the end. Roll call votes create a permanent record of each country's position — which is why they matter diplomatically and for awards consideration.</p>

            <h2 style={s.h2}>Understanding the Threshold</h2>
            <p style={s.p}>Whether a resolution passes depends on the voting threshold set by your rules of procedure:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Simple majority (50% + 1):</strong> The most common threshold for General Assembly-style committees. More In Favour votes than Against votes, among those present and voting (abstentions do not count).</li>
              <li style={s.li}><strong>Supermajority (two-thirds):</strong> Required for important questions in the GA, and often used for Security Council simulations. Two-thirds of present-and-voting delegations must vote In Favour.</li>
              <li style={s.li}><strong>Consensus:</strong> No delegation votes Against. Abstentions are permitted. Common in specialised agencies and some advanced conferences.</li>
            </ul>
            <div style={s.callout}><p style={s.calloutText}>Key rule: abstentions are not counted as votes for or against when calculating majority. A resolution with 10 In Favour, 8 Against, and 15 Abstain passes under simple majority rules.</p></div>

            <h2 style={s.h2}>Present vs. Present and Voting</h2>
            <p style={s.p}>During roll call at the start of a session, delegates can mark themselves as "Present" or "Present and Voting." The distinction matters for voting:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Present:</strong> The delegate may abstain on substantive votes.</li>
              <li style={s.li}><strong>Present and Voting:</strong> The delegate must vote In Favour or Against on substantive matters — they cannot abstain. This is a stronger diplomatic signal used by states that want to show they are fully engaged.</li>
            </ul>

            <h2 style={s.h2}>Rights of Explanation</h2>
            <p style={s.p}>Before voting begins on a resolution, delegates may request the right to explain their vote. This is a brief statement (typically thirty to sixty seconds) delivered before the delegate casts their vote. It is used to signal nuance: "Brazil votes In Favour but wishes to note its reservations regarding operative clause 4."</p>
            <p style={s.p}>Rights of explanation come after all general debate has closed. The chair calls for them before opening the voting procedure.</p>

            <h2 style={s.h2}>Voting on Amendments</h2>
            <p style={s.p}>If amendments have been submitted to a draft resolution, they are voted on first — in reverse order of submission (most recently submitted first). If an amendment passes, the resolution text is updated before the final vote. If the amendment fails, the original text stands.</p>
            <p style={s.p}>Friendly amendments (agreed to by the main sponsor) do not require a separate vote — they are incorporated into the draft before voting begins.</p>

            <h2 style={s.h2}>Security Council Veto</h2>
            <p style={s.p}>Security Council simulations follow different rules. The P5 (US, UK, France, Russia, China) hold veto power — any single P5 member voting Against defeats a resolution, regardless of the total vote count. Abstentions by P5 members do not constitute a veto. This creates fundamentally different bloc dynamics compared to GA committees.</p>

            <h2 style={s.h2}>Chair's Role During Voting</h2>
            <p style={s.p}>The chair must announce the voting procedure clearly before it begins, manage any rights of explanation, call the roll in order, announce the final tally, and declare the result. The declaration is formal:</p>
            <p style={s.p}>"With X votes in favour, Y against, and Z abstentions, Resolution [number] is adopted / fails to pass."</p>
            <p style={s.p}>Software like Gavelling handles roll call voting with an interactive per-delegate voting interface, tallies the result automatically, and supports custom thresholds — including veto mode for Security Council simulations.</p>

            <RelatedGuides currentSlug="mun-voting-procedures" />
            <div style={s.cta}>
              <p style={s.ctaText}>Run roll call votes and track results with Gavelling's built-in voting screen.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
