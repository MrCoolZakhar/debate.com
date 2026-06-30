import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Chair Script — Exact Phrases for Every Situation',
  description: 'A complete MUN chair script with exact phrases for opening, roll call, GSL, caucuses, voting, and closing. Copy-paste language for every committee situation.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-chair-script' },
  openGraph: {
    title: 'MUN Chair Script — Exact Phrases for Every Situation',
    description: 'The complete MUN chair script with language for every committee moment.',
    url: 'https://gavelling.com/blog/mun-chair-script',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Chair Script — Exact Phrases for Every Situation',
  description: 'Complete MUN chair script with phrases for every committee situation.',
  url: 'https://gavelling.com/blog/mun-chair-script',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-chair-script' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Chair Script', item: 'https://gavelling.com/blog/mun-chair-script' },
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
  script: { backgroundColor: '#1B3828', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' },
  scriptText: { fontSize: '14px', color: '#EDE7D8', fontStyle: 'italic', margin: 0, lineHeight: 1.7 },
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
          <h1 style={s.h1}>MUN Chair Script — Exact Phrases for Every Situation</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 11 min read</p>
          <article style={s.article}>

            <p style={s.p}>New chairs often know what needs to happen next but freeze when they have to say it out loud to a room of fifty delegates. This guide provides word-for-word chair language for every standard committee moment — from the first gavel strike to final adjournment. Adapt these to your conference's specific rules, but use them as a starting point.</p>

            <h2 style={s.h2}>Opening the Session</h2>
            <div style={s.script}><p style={s.scriptText}>"The chair will call this session of the [Committee Name] to order. Welcome, delegates, to [Conference Name]. The topic before this committee is [Topic]. Before we begin, the chair will call roll. When your delegation is called, please respond 'Present' or 'Present and Voting.'"</p></div>

            <h2 style={s.h2}>Roll Call</h2>
            <div style={s.script}><p style={s.scriptText}>"[Country name]... [pause for response]. [Country name]... [pause]."</p></div>
            <p style={s.p}>If a delegation does not respond: "The delegation of [Country] will be marked absent."</p>
            <p style={s.p}>After completing the roll:</p>
            <div style={s.script}><p style={s.scriptText}>"The chair notes that [X] delegations are present, constituting a quorum / not constituting a quorum. [If quorum] The committee will proceed to formal debate."</p></div>

            <h2 style={s.h2}>Opening the General Speakers List</h2>
            <div style={s.script}><p style={s.scriptText}>"The chair will now open the General Speakers List. Delegates wishing to be added to the list, please raise your placard. The default speaker time is [X] seconds. Delegates are reminded that they may yield remaining time to another delegate, to questions, or to the chair."</p></div>

            <h2 style={s.h2}>Calling a Speaker</h2>
            <div style={s.script}><p style={s.scriptText}>"The chair recognises the delegate of [Country]. You have [X] seconds. You may begin."</p></div>
            <p style={s.p}>When time expires:</p>
            <div style={s.script}><p style={s.scriptText}>"The delegate's time has expired. Thank you. The chair recognises the delegate of [next country]."</p></div>

            <h2 style={s.h2}>Handling a Yield</h2>
            <p style={s.p}>Yield to another delegate:</p>
            <div style={s.script}><p style={s.scriptText}>"The delegate of [Country A] yields their remaining time to the delegate of [Country B]. The chair recognises the delegate of [Country B] with [X] seconds remaining. You may begin."</p></div>
            <p style={s.p}>Yield to questions:</p>
            <div style={s.script}><p style={s.scriptText}>"The delegate yields their remaining time to questions. Are there any points of information? The chair recognises the delegate of [Country]."</p></div>

            <h2 style={s.h2}>Entertaining a Motion</h2>
            <div style={s.script}><p style={s.scriptText}>"The chair recognises the delegate of [Country] on a motion."</p></div>
            <p style={s.p}>After the motion is stated:</p>
            <div style={s.script}><p style={s.scriptText}>"The delegate of [Country] moves for a [type of motion]. Is there a second? [pause] The motion is seconded. The committee will now vote on this motion. All those in favour, please raise your placards... all those against... the motion [passes/fails] with [X] in favour and [Y] against."</p></div>

            <h2 style={s.h2}>Opening a Moderated Caucus</h2>
            <div style={s.script}><p style={s.scriptText}>"The committee will now enter a moderated caucus of [X] minutes, with [Y] seconds per speaker, on the topic of [topic]. Delegates wishing to speak during this caucus, please raise your placards now."</p></div>
            <p style={s.p}>Closing the caucus:</p>
            <div style={s.script}><p style={s.scriptText}>"The moderated caucus has concluded. The committee returns to the General Speakers List. The next speaker is the delegate of [Country]."</p></div>

            <h2 style={s.h2}>Opening an Unmoderated Caucus</h2>
            <div style={s.script}><p style={s.scriptText}>"The motion passes. The committee will now take an unmoderated caucus of [X] minutes. Delegates are free to leave their seats. The committee will reconvene at [time]. Two minutes remaining — delegates, please return to your seats."</p></div>

            <h2 style={s.h2}>Voting on a Resolution</h2>
            <div style={s.script}><p style={s.scriptText}>"The committee will now proceed to vote on Draft Resolution [number]. All those in favour, please raise your placards... all those against... abstentions... The resolution [passes/fails] with [X] in favour, [Y] against, and [Z] abstentions."</p></div>
            <p style={s.p}>For a roll call vote:</p>
            <div style={s.script}><p style={s.scriptText}>"A roll call vote has been requested. When your country is called, please state 'In Favour,' 'Against,' or 'Abstain.' [Country name]..."</p></div>

            <h2 style={s.h2}>Ruling on a Point of Order</h2>
            <div style={s.script}><p style={s.scriptText}>"The chair rules this point of order [well-taken / not well-taken]. [If well-taken:] The chair will [corrective action]. [If not well-taken:] The committee will continue."</p></div>

            <h2 style={s.h2}>Closing the Session</h2>
            <div style={s.script}><p style={s.scriptText}>"Delegates, the committee session is drawing to a close. [If time remains:] The committee will take up [X] more speakers before suspending. [At end:] The chair thanks all delegates for their contributions to today's session. This session of [Committee Name] is hereby suspended. [gavel]"</p></div>

            <div style={s.callout}><p style={s.calloutText}>The most important script rule: when in doubt, slow down. A pause of two seconds feels much longer from the dais than it looks to the room. Take your time, breathe, and deliver each announcement clearly.</p></div>

            <RelatedGuides currentSlug="mun-chair-script" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling automates the logistics so you can focus on the chair role, not the paperwork.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
