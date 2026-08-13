import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import ConferencesRolesClient from './ConferencesRolesClient';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Chair & Staff Roles',
  description:
    'Open chairing, secretariat, and staff positions across Model UN conferences worldwide. Find your next MUN role and apply directly on Gavelling.',
  path: '/conferences/roles',
  ogDescription:
    'Open chairing, secretariat, and staff positions across Model UN conferences worldwide.',
});

export default function ConferencesRolesPage() {
  return <ConferencesRolesClient />;
}
