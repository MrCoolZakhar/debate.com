import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import ContactClient from './ContactClient';

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description: 'Get in touch with the Gavelling team for partnership enquiries, feedback, or support.',
  path: '/contact',
  ogTitle: 'Contact Gavelling',
  ogDescription: 'Get in touch with the Gavelling team.',
});

export default function ContactPage() {
  return <ContactClient />;
}
