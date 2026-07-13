import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'Gavelling: Modern MUN Committee Software',
  description:
    'Gavelling gives chairs and directors everything they need to run professional, efficient Model UN sessions. Roll call, speakers, motions, voting, all in one place.',
  alternates: { canonical: 'https://gavelling.com' },
  openGraph: { url: 'https://gavelling.com' },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Gavelling',
  url: 'https://gavelling.com',
  logo: {
    '@type': 'ImageObject',
    url: 'https://gavelling.com/GavellingLogo.png',
    width: 400,
    height: 100,
  },
  sameAs: [
    'https://www.instagram.com/wearegavelling/',
    'https://twitter.com/wearegavelling',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'wearegavelling@gmail.com',
    contactType: 'customer support',
  },
  description:
    'Gavelling builds modern software for the global Model UN community: session management tools for chairs and a full conference management platform.',
};

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Gavelling',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires JavaScript',
  url: 'https://gavelling.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free to use',
  },
  featureList: [
    'Roll call management with quorum tracking',
    'General Speakers List (GSL) with timer',
    'Moderated Caucus timer and topic management',
    'Unmoderated Caucus timer',
    'Motion voting with simple and supermajority support',
    'Live delegate-to-chair chat',
    'Resolution document viewer',
    'Session archive',
    'Multi-device support, no download required',
    'Faculty Advisor view',
  ],
  audience: {
    '@type': 'EducationalAudience',
    educationalRole: 'student',
  },
  author: {
    '@type': 'Organization',
    name: 'Gavelling',
    url: 'https://gavelling.com',
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Gavelling',
  url: 'https://gavelling.com',
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Gavelling free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Gavelling is currently free to use for all committees and sessions.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is a General Speakers List (GSL) in Model UN?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The General Speakers List (GSL) is the primary debate mechanism in Model UN. Delegates add their names to the list and speak in order, with a time limit set by the chair. Gavelling automates the GSL with a live digital timer and queue management.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do delegates join a Gavelling session?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The chair creates a session and receives a unique session code. Delegates open gavelling.com on any device (phone, tablet, or laptop) and enter the code to join instantly. No download or account required.',
      },
    },
    {
      '@type': 'Question',
      name: 'What MUN committees does Gavelling support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Gavelling supports all standard UN committee types including the Security Council (with veto logic), General Assembly, ECOSOC, SOCHUM, Human Rights Council, and custom committees. Crisis committee support is coming soon.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Gavelling support voting procedures?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Yes. Gavelling handles all standard MUN voting procedures: simple majority, two-thirds majority, and veto-power voting for Security Council permanent members. The voting module tracks each delegate's vote in real time.",
      },
    },
    {
      '@type': 'Question',
      name: 'What is Gavelling Conferences?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Gavelling Conferences is a separate product launching July 2026 that handles end-to-end MUN conference management: delegate applications, smart country allocations, study guide distribution, position paper review, financial tracking, and a public conference discovery layer.',
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HomeClient />
    </>
  );
}
