// /manage/[slug]/financial-aid moved inside Financials on 9 Oct 2026 (owner:
// financial aid is a tab of Financials, not a rail entry). This route stays so
// old bookmarks, email links and the activity feed land on the new page; the
// query string is carried over. The page itself is ../financials/aid.

import { redirect } from 'next/navigation';

export default async function FinancialAidRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach(x => qs.append(k, x));
    else if (v !== undefined) qs.append(k, v);
  }
  const q = qs.toString();
  redirect(`/manage/${slug}/financials/aid${q ? `?${q}` : ''}`);
}
