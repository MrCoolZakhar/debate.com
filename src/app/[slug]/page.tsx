import { notFound, redirect } from 'next/navigation';
import { resolveConferenceVanity } from '@/lib/vanity';

/**
 * VANITY CONFERENCE REDIRECT — `/worldmun` → `/conferences/harvard-worldmun-2027-2h45a`
 *
 * ⚠️  This is a ROOT-LEVEL dynamic segment: it matches any single-segment path
 *     that no static route already claims. Static routes win over dynamic ones in
 *     Next.js, so `src/app/about/`, `/blog`, `/sessions` etc. are NOT shadowed —
 *     but when you add a new top-level route, also add its name to RESERVED_RAW in
 *     `src/lib/vanity.ts` so unmatched requests to it never reach the database.
 *
 * Everything that is not an unambiguous, public conference acronym 404s here, with
 * no redirect and no loop: `resolveConferenceVanity` returns null and we call
 * `notFound()`. It never redirects to itself, and the only redirect target is the
 * `/conferences/<slug>` route, which is a different, static-prefixed path.
 *
 * A REDIRECT is used rather than rendering the conference here, on purpose:
 * rendering would create a second URL serving identical content (a duplicate-
 * content twin), and would need its own canonical tag kept in sync. Redirecting
 * means only `/conferences/<slug>` is ever indexable, which is also where the
 * existing per-conference OG tags, Event JSON-LD and canonical live.
 *
 * 307 (temporary) rather than 308 (permanent) is deliberate: the mapping is
 * derived from mutable DB data (an organiser can edit their acronym, a second
 * conference can appear and make it ambiguous). A 308 is cached hard by browsers
 * and would outlive the mapping that justified it.
 */

// The acronym→slug index is DB-derived, so this must not be prerendered to a
// build-time snapshot.
export const dynamic = 'force-dynamic';

export default async function VanityConferencePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const target = await resolveConferenceVanity(slug);
  if (!target) notFound();

  // Carry the query string through, so campaign tags (?utm_source=…) and any
  // deep-link params survive the hop.
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) value.forEach(v => qs.append(key, v));
    else if (value !== undefined) qs.append(key, value);
  }
  const query = qs.toString();

  redirect(`/conferences/${target}${query ? `?${query}` : ''}`);
}
