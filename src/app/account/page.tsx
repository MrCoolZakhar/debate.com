import { redirect } from 'next/navigation';

// /account has no page of its own, Profile is the landing tab.
// Server-side redirect keeps /account and any old links working.
export default function AccountPage() {
  redirect('/account/profile');
}
