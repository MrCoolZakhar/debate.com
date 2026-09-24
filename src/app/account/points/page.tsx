import { redirect } from 'next/navigation';

// Gavelling Points was retired (prompt 48); this old route now just forwards
// visitors to Credits & Subscription, which is where this address used to lead.
export default function PointsPage() {
  redirect('/account/unlimited');
}
