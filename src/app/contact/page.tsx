import type { Metadata } from 'next';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact Gavelling',
  description: 'Get in touch with the Gavelling team for partnership enquiries, feedback, or support.',
  alternates: { canonical: 'https://gavelling.com/contact' },
  openGraph: {
    title: 'Contact Gavelling',
    description: 'Get in touch with the Gavelling team.',
    url: 'https://gavelling.com/contact',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
