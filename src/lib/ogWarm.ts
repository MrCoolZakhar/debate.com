import { after } from 'next/server';
import { SITE_URL } from '@/lib/seo';

/**
 * Pre-render a share card so the CDN already holds it when WhatsApp asks.
 *
 * WhatsApp builds a link preview on the SENDER's phone while they type: it
 * fetches the page, then the og:image, and if the image is slow it sends the
 * message without a picture. A card that is not in Vercel's cache is a
 * serverless render (cold start, the DB, the organiser's banner and logo
 * fetched and re-encoded). So every page view that has a rendered card asks for
 * it once, AFTER the page has been sent (`after`, which Vercel keeps alive with
 * waitUntil). By the time an organiser copies the link they have usually opened
 * the page, and the card is warm.
 *
 * Production only (a preview deployment or localhost would warm gavelling.com
 * from the wrong code), at most once per URL per server instance, and never
 * allowed to throw: this is an optimisation, the page must not notice it.
 */
const warmed = new Set<string>();
const MAX_REMEMBERED = 2000;

export function warmOgImage(imageUrl: string | null | undefined): void {
  if (process.env.VERCEL_ENV !== 'production') return;
  if (!imageUrl || !imageUrl.startsWith(`${SITE_URL}/api/og/`)) return;
  if (warmed.has(imageUrl)) return;
  if (warmed.size >= MAX_REMEMBERED) warmed.clear();
  warmed.add(imageUrl);

  try {
    after(async () => {
      try {
        const res = await fetch(imageUrl, {
          headers: { 'user-agent': 'GavellingCardWarmer/1.0' },
          signal: AbortSignal.timeout(15000),
          cache: 'no-store',
        });
        // Read the body to the end: an abandoned response may never be stored.
        await res.arrayBuffer();
      } catch {
        warmed.delete(imageUrl);
      }
    });
  } catch {
    // `after` outside a request scope (a build-time prerender): nothing to do.
    warmed.delete(imageUrl);
  }
}
