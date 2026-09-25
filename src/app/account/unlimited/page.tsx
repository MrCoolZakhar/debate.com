import { redirect } from 'next/navigation';

// Credits and Unlimited moved to /pricing/subscription (the purchase pop-ups)
// and /account/manage (the current plan, credits and usage, promo codes).
// This old address still receives Stripe's return URLs
// (?unlimited=success&session_id=...) and the apply flow's ?returnTo=..., so
// the query string is carried across untouched.
export default async function UnlimitedRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.append(key, value);
  }
  const query = qs.toString();
  redirect('/pricing/subscription' + (query ? '?' + query : ''));
}
