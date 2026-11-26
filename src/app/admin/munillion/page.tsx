import type { Metadata } from 'next';
import MunillionAdmin from './MunillionAdmin';

// Staff-only. Every read and write is a munillion_admin_* function that answers
// reason 'not_admin' unless is_platform_admin(); this route being unlisted is
// not the gate.
export const metadata: Metadata = {
  title: 'MUNillion review',
  robots: { index: false, follow: false, nocache: true },
};

export default function MunillionAdminPage() {
  return <MunillionAdmin />;
}
