import { redirect } from 'next/navigation';

// Gavelling Points moved into the Gavelling Unlimited tab (points/rewards
// aren't launched yet); this route now just forwards visitors there.
export default function PointsPage() {
  redirect('/account/unlimited');
}
