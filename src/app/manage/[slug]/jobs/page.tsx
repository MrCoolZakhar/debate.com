// The Job Board moved into Team (owner, 14 Nov 2026): /manage/<slug>/jobs is
// redirected to /manage/<slug>/team?tab=jobs in next.config.ts. This page is
// only the fallback if that redirect is ever skipped.

import { redirect } from 'next/navigation';

export default async function JobsMovedPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'tab') continue;
    for (const one of Array.isArray(v) ? v : v !== undefined ? [v] : []) q.append(k, one);
  }
  const rest = q.toString();
  redirect(`/manage/${encodeURIComponent(slug)}/team?tab=jobs${rest ? `&${rest}` : ''}`);
}
