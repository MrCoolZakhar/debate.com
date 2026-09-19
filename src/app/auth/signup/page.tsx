import { redirect } from 'next/navigation';

// "Log in or sign up" is a pop-up now (src/components/auth/AuthModal.tsx), so
// this route is only a door for deep links: emails, redirect guards, old
// bookmarks and the OAuth error path. It sends the visitor to the homepage with
// the modal open, carrying next / email / apply / verified / error across.
// The previous full-page signup form is in git history before 18 Sep 2026.

export const dynamic = 'force-dynamic';

type Search = Record<string, string | string[] | undefined>;

export default async function AuthRedirect({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const out = new URLSearchParams();
  out.set('auth', 'signup');
  for (const key of ['next', 'email', 'apply', 'verified', 'error'] as const) {
    const v = sp[key];
    const value = Array.isArray(v) ? v[0] : v;
    if (!value) continue;
    // Same-origin relative paths only (open-redirect guard, as before).
    if (key === 'next' && (!value.startsWith('/') || value.startsWith('//'))) continue;
    out.set(key, value);
  }
  redirect(`/?${out.toString()}`);
}
