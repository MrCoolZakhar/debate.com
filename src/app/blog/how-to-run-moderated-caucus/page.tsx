import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'How to Run a Moderated Caucus in MUN: Chair Guide',
  description: 'A complete chair guide to running a moderated caucus in Model UN: how to open, manage speaker time, keep order, and close the caucus smoothly.',
  alternates: { canonical: 'https://gavelling.com/blog/how-to-run-moderated-caucus' },
  openGraph: {
    title: 'How to Run a Moderated Caucus in MUN: Chair Guide',
    description: 'Everything a chair needs to know to run a moderated caucus confidently.',
    url: 'https://gavelling.com/blog/how-to-run-moderated-caucus',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Run a Moderated Caucus in MUN: Chair Guide',
  description: 'A complete chair guide to running a moderated caucus in Model UN.',
  url: 'https://gavelling.com/blog/how-to-run-moderated-caucus',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/how-to-run-moderated-caucus' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'How to Run a Moderated Caucus', item: 'https://gavelling.com/blog/how-to-run-moderated-caucus' },
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
  script: { backgroundColor: '#1B3828', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' },
  scriptText: { fontSize: '14px', color: '#EDE7D8', fontStyle: 'italic', margin: 0, lineHeight: 1.7 },
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
          <h1 style={s.h1}>How to Run a Moderated Caucus in MUN: Chair Guide</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 9 min read</p>
          <article style={s.article}>

            <p style={s.p}>The moderated caucus is the engine room of any Model UN committee. It is where delegates stop raising placards and start making substantive arguments. For chairs, it is also the moment when control can slip away fast: speakers overrun, the purpose drifts, and the clock becomes your enemy. This guide walks you through every stage of a moderated caucus so you can run it with confidence every time.</p>

            <h2 style={s.h2}>What Is a Moderated Caucus?</h2>
            <p style={s.p}>A moderated caucus is a structured debate period proposed by a delegate and approved by the committee through a simple majority vote. It differs from the General Speakers List (GSL) in three key ways: it has a fixed total time, a fixed per-speaker time, and a specific topic or purpose. When the caucus ends, the committee returns to the GSL exactly where it left off.</p>
            <p style={s.p}>Common purposes include: "to discuss the humanitarian crisis in the conflict zone," "to debate funding mechanisms for the proposed resolution," or simply "to continue general debate." The purpose helps the chair keep speakers on topic.</p>

            <h2 style={s.h2}>Step 1: Accepting the Motion</h2>
            <p style={s.p}>A delegate raises a placard and proposes: "I move for a moderated caucus of [total time] with [per-speaker time] per speaker on the topic of [purpose]." You need at least one second. Then you put it to a vote.</p>
            <div style={s.callout}><p style={s.calloutText}>Rule of thumb: a moderated caucus does not need a second at many conferences. Check your rules of procedure. At NMUN and most large conferences, you simply need a majority to pass.</p></div>
            <p style={s.p}>Once it passes, announce the caucus clearly:</p>
            <div style={s.script}><p style={s.scriptText}>"The motion passes. The committee will now enter a moderated caucus of fifteen minutes, with ninety seconds per speaker, on the topic of climate finance mechanisms. I will now open the speakers list for this caucus."</p></div>

            <h2 style={s.h2}>Step 2: Building the Caucus Speakers List</h2>
            <p style={s.p}>Ask delegates to raise their placards if they wish to speak during the caucus. Call on them in the order they raised, recording each name. In a large committee this happens fast, so have your co-chair or director assistant capture names while you manage the room. Software like Gavelling handles this automatically, letting co-chairs add speakers to the caucus queue without interrupting the chair.</p>
            <p style={s.p}>You do not need to fill every available speaking slot before starting. Call the first speaker as soon as you have a few names, and continue accepting additions from the floor as the caucus runs.</p>

            <h2 style={s.h2}>Step 3: Running the Caucus</h2>
            <p style={s.p}>Call each speaker by country name: "The chair recognises the delegate of Germany." Start the per-speaker timer the moment they begin. When time expires, interrupt firmly but politely:</p>
            <div style={s.script}><p style={s.scriptText}>"The delegate's time has expired. Thank you. The chair recognises the delegate of Brazil."</p></div>
            <p style={s.p}>Do not let speakers run over. It is unfair to delegates who respected the limit and it erodes your authority in every subsequent session. A firm gavel tap and a calm voice are all you need.</p>

            <h3 style={s.h3}>Handling Yields</h3>
            <p style={s.p}>In a moderated caucus, most rules of procedure do not permit yielding time to other delegates. If your conference rules allow it, a delegate may yield remaining time to another delegate or to the chair. If it is not permitted, state so briefly when a delegate attempts to yield.</p>

            <h3 style={s.h3}>Keeping Speakers on Topic</h3>
            <p style={s.p}>If a delegate strays far from the caucus topic, it is appropriate to note: "The chair reminds the delegate that this caucus is on the topic of [purpose] and asks the delegate to direct their remarks accordingly." Do this sparingly (it can feel heavy-handed), but use it when a speaker is clearly wasting the committee's time.</p>

            <h2 style={s.h2}>Step 4: Managing the Clock</h2>
            <p style={s.p}>Track both the per-speaker timer and the total caucus time simultaneously. When the total time is almost exhausted, give the committee a heads-up: "The committee has approximately two minutes remaining in this moderated caucus." This allows delegates to wrap arguments and prevents abrupt endings mid-speech.</p>
            <p style={s.p}>If the caucus time expires mid-speech, you have two options: end it immediately and revert to the GSL, or (if your rules allow) ask whether the committee wishes to extend the caucus by a short additional period. Technically any extension requires a new motion, but many chairs handle short overruns graciously.</p>

            <h2 style={s.h2}>Step 5: Closing the Caucus</h2>
            <p style={s.p}>When time expires or the speakers list is exhausted, close formally:</p>
            <div style={s.script}><p style={s.scriptText}>"The moderated caucus has concluded. The committee returns to the General Speakers List. The next speaker is the delegate of Canada."</p></div>
            <p style={s.p}>This transition matters. Announcing the return to the GSL immediately signals that debate continues. There is no gap for the room to lose energy.</p>

            <h2 style={s.h2}>Common Mistakes Chairs Make</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Not starting the timer on time.</strong> Every second of delay compounds across fifteen or twenty speakers.</li>
              <li style={s.li}><strong>Letting the purpose go unannounced.</strong> Delegates need to know the topic to stay relevant.</li>
              <li style={s.li}><strong>Forgetting to return to the GSL.</strong> The committee can drift into another motion without the chair explicitly closing the caucus.</li>
              <li style={s.li}><strong>Allowing too many caucuses in a row.</strong> Back-to-back moderated caucuses with no GSL speeches drain the room. Encourage a GSL speaker between caucuses when possible.</li>
            </ul>

            <h2 style={s.h2}>Using Software to Run Moderated Caucuses</h2>
            <p style={s.p}>Manual timers and paper lists work, but they introduce errors, especially when you have multiple co-chairs, large committees, or tight per-speaker times. Gavelling automates the caucus queue, tracks total and per-speaker time simultaneously, and keeps the General Speakers List intact so you can return to it instantly when the caucus ends. It runs on any device and does not require installation.</p>

            <RelatedGuides currentSlug="how-to-run-moderated-caucus" />
            <div style={s.cta}>
              <p style={s.ctaText}>Run your next moderated caucus without the paper chaos.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
