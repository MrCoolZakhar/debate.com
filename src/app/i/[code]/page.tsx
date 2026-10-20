// The short delegation invite link: /i/<code> (owner, 20 Oct 2026: "should
// always be there", short and not ugly). The code (e.g.
// westbrook-academy-k7q3mx) comes from delegation_invite_short_code on the
// leader card; here resolve_delegation_short_invite(p_code) turns it into the
// delegation's full invite token with the anon client, and the visitor is sent
// on (308) to /invites/delegation/<token>, which decides everything else.
// An unknown code renders a plain "not valid" page.
//
// Noindex by header (NOINDEX_ROUTES in next.config.ts) and by metadata. It
// stays crawlable: rendering it has no side effect (CLAUDE.md §3), so it is
// never added to robots.ts.

import type { Metadata } from 'next';
import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { pageMetadata } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import SiteNav from '@/components/SiteNav';

export const dynamic = 'force-dynamic';

const CODE_RE = /^[a-z0-9][a-z0-9-]{2,119}$/;

/** The full invite token, null for an unknown code, 'error' when the read failed. */
async function resolve(raw: string): Promise<string | null | 'error'> {
  let code: string;
  try { code = decodeURIComponent(raw).trim().toLowerCase(); } catch { return null; }
  if (!CODE_RE.test(code)) return null;
  try {
    const { data, error } = await supabase.rpc('resolve_delegation_short_invite', { p_code: code });
    if (error) return 'error';
    return typeof data === 'string' && data.trim() && data.length <= 300 ? data.trim() : null;
  } catch {
    return 'error';
  }
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return pageMetadata({
    title: 'Delegation Invite',
    description: 'An invitation to join a delegation on Gavelling.',
    path: `/i/${encodeURIComponent(code)}`,
    robots: { index: false, follow: false },
  });
}

export default async function ShortInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const token = await resolve(code);
  if (token && token !== 'error') permanentRedirect(`/invites/delegation/${encodeURIComponent(token)}`);

  const failed = token === 'error';
  return (
    <div style={{ minHeight: '100vh', background: '#EDE7D8' }}>
      <SiteNav />
      <main className="px-4 pt-32 pb-20 flex justify-center">
        <div
          className="w-full max-w-[520px] rounded-[20px] p-7 md:p-9"
          style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.08), 0 6px 16px rgba(27,56,40,0.08), 0 18px 44px rgba(27,56,40,0.12)' }}
        >
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 24, fontWeight: 700, color: '#1C1410', margin: 0, lineHeight: 1.25 }}>
            {failed ? 'This Invite Link Could Not Be Opened' : 'This Invite Link Is Not Valid'}
          </h1>
          <p style={{ fontFamily: 'var(--font-brand)', fontSize: 15, color: '#5A4A3C', margin: '10px 0 0 0', lineHeight: 1.55 }}>
            {failed
              ? 'Something went wrong on our side. Try the link again in a moment.'
              : 'Ask your head delegate or faculty advisor to send you the link again.'}
          </p>
          <Link
            href="/conferences/explore"
            className="inline-flex items-center justify-center mt-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EED98A]"
            style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, background: 'linear-gradient(90deg, #1B3828 0%, #2A5A3E 100%)', color: '#FFFFFF', fontFamily: 'var(--font-brand)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
          >
            Explore conferences
          </Link>
        </div>
      </main>
    </div>
  );
}
