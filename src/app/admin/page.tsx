import type { Metadata } from 'next';
import AdminClient from './AdminClient';

// Staff-only. Access is enforced in the DATABASE (admin_conference_overview()
// raises 'not authorised' unless is_platform_admin()), not by this route being
// obscure — the page renders for anyone, and simply has nothing to show them.
export const metadata: Metadata = {
  title: 'Staff',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return <AdminClient />;
}
