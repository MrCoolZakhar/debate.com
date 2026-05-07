import type { Metadata } from 'next';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    "Get in touch with the Gavelling team. Questions, partnerships, or feedback — we'd love to hear from you.",
  alternates: { canonical: 'https://gavelling.com/contact' },
  openGraph: { url: 'https://gavelling.com/contact' },
};

export default function ContactPage() {
  return <ContactClient />;
}
