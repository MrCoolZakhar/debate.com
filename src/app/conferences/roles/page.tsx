import type { Metadata } from 'next';
import { OG_BASE } from '@/lib/seo';
import ConferencesRolesClient from './ConferencesRolesClient';

export const metadata: Metadata = {
  title: 'MUN Chair & Staff Roles',
  description:
    'Open chairing, secretariat, and staff positions across Model UN conferences worldwide. Find your next MUN role and apply directly on Gavelling.',
  alternates: { canonical: 'https://gavelling.com/conferences/roles' },
  openGraph: {
    ...OG_BASE,
    title: 'MUN Chair & Staff Roles',
    description:
      'Open chairing, secretariat, and staff positions across Model UN conferences worldwide.',
    url: 'https://gavelling.com/conferences/roles',
    siteName: 'Gavelling',
    type: 'website',
  },
};

export default function ConferencesRolesPage() {
  return <ConferencesRolesClient />;
}
