import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Bloc Building: How to Form and Lead a Coalition',
  description: 'A practical guide to building blocs in Model UN: how to find allies, draft collaboratively, handle defections, and lead a coalition to a successful resolution.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-bloc-building' },
  openGraph: {
    title: 'MUN Bloc Building: How to Form and Lead a Coalition',
    description: 'Master coalition building in Model UN committees.',
    url: 'https://gavelling.com/blog/mun-bloc-building',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Bloc Building: How to Form and Lead a Coalition',
  description: 'Guide to bloc building in MUN.',
  url: 'https://gavelling.com/blog/mun-bloc-building',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-bloc-building' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Bloc Building', item: 'https://gavelling.com/blog/mun-bloc-building' },
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
          <h1 style={s.h1}>MUN Bloc Building: How to Form and Lead a Coalition</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 9 min read</p>
          <article style={s.article}>
            <p style={s.p}>In Model UN, no resolution passes alone. Every passed resolution is the product of a coalition: delegates who found enough common ground to put their names on the same document and get it across the majority line. Bloc building is the skill that determines whether your ideas become committee output or stay in your notes. This is how to do it.</p>

            <h2 style={s.h2}>Identify Your Natural Allies Before Committee Begins</h2>
            <p style={s.p}>Research the country list for your committee before the conference starts. Which countries typically vote together on your topic? Regional blocs (African Group, G77, EU, ASEAN) tend to vote in patterns that are well-documented in UN voting records. This research gives you your first target list before you have said a word in committee.</p>
            <p style={s.p}>Look up the last two or three UN resolutions on your topic and find which countries voted together. These are your likely natural allies.</p>

            <h2 style={s.h2}>Make Your Opening Speech a Recruitment Tool</h2>
            <p style={s.p}>Most delegates treat the opening speech as a statement. Strong delegates treat it as an invitation. End your speech with explicit coalition language: "Denmark invites delegations that support a binding climate finance mechanism to collaborate on a working paper." You have just given potential allies a clear signal and a reason to find you during the first unmod.</p>

            <h2 style={s.h2}>First Unmoderated Caucus: Move Fast</h2>
            <p style={s.p}>The first unmoderated caucus is where blocs form. Move immediately. Do not wait for people to come to you. Walk to your target allies, introduce yourself, and ask one question: "What is [Country]'s priority on this topic?" Listen more than you speak. The delegate who listens in the first unmod learns more than the one who talks.</p>
            <ul style={s.ul}>
              <li style={s.li}>Approach three to five delegates in the first five minutes</li>
              <li style={s.li}>Find the one or two who are most aligned and invite them to a small working group</li>
              <li style={s.li}>Start a shared document before the unmod ends, even if it only has a title and three bullet points</li>
            </ul>

            <h2 style={s.h2}>Giving Up Something to Gain More</h2>
            <p style={s.p}>No bloc forms without compromise. The delegate who insists on their exact language in every clause will end up with a small bloc and a failed resolution. Identify your non-negotiables (the two or three clauses you will not alter) and be flexible on everything else. Offering to adopt another delegate's preferred operative clause in exchange for their sponsorship is a trade worth making almost every time.</p>
            <div style={s.callout}><p style={s.calloutText}>A resolution with eight sponsors and broad support that passes beats a resolution with three sponsors and perfect language that fails. Always optimise for majority, not perfection.</p></div>

            <h2 style={s.h2}>Bringing in Swing Delegates</h2>
            <p style={s.p}>Every committee has swing delegates: delegations whose country position is genuinely ambiguous, or who have not committed publicly. These are your best targets for expanding a coalition. Approach them with a specific offer: "If we add a clause on [their priority], would you be willing to sponsor?" This is more effective than a general ask to join your bloc.</p>

            <h2 style={s.h2}>Handling Competing Working Papers</h2>
            <p style={s.p}>When two strong blocs emerge with competing working papers, you face a choice: compete or merge. Competing is only viable if you are confident your bloc can deliver the necessary majority without the other group's votes. If you cannot, merger negotiations are always worth attempting.</p>
            <p style={s.p}>In merger talks: identify the three clauses each side cares most about and try to preserve all six in the merged document. Accept that some language will be weakened. Agree on primary sponsor order upfront.</p>

            <h2 style={s.h2}>Keeping Your Bloc Together</h2>
            <p style={s.p}>Blocs fracture under pressure, especially when the other side makes targeted concessions to specific members. Keep your coalition informed: update them after every unmod, share the latest document version immediately, and be transparent about negotiations with opposing blocs. Defections happen when delegates feel uninformed or undervalued.</p>
            <p style={s.p}>Give your bloc members specific roles: one drafts preambulatory language, one manages the signatory list, one handles liaison with the opposing bloc. When people have ownership of a piece of the work, they stay invested.</p>

            <h2 style={s.h2}>The Vote Count</h2>
            <p style={s.p}>Before calling for introduction of your draft resolution, do a private head count. Go through every delegation in the room and estimate their vote: In Favour, Against, Abstain, or Unknown. If you cannot reach majority among your known supporters, do not introduce. Spend more time persuading the Unknowns first. A failed vote on your resolution is diplomatically damaging and hard to recover from.</p>

            <RelatedGuides currentSlug="mun-bloc-building" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling gives delegates real-time visibility into who is on the GSL, making it easier to spot allies and time your approaches.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
