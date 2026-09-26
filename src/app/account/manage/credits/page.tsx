'use client';

// The old Manage account sub-page. It renders the one Manage account page
// scrolled to its section (see ../ManageAccount.tsx for why this is not a redirect).
import ManageAccount from '../ManageAccount';

export default function Page() {
  return <ManageAccount focus="credits" />;
}
