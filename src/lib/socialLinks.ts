// Normalizes user-entered social/website values into safe absolute URLs.
// Organisers paste things like "instagram.com/mymun", "@mymun", or
// "www.site.org" — stored raw, these render as broken relative links. This
// ensures every stored/rendered social link is an absolute https:// URL (or
// null when empty), so the public page's links always work.

const PLATFORM_BASE: Record<string, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  tiktok: 'https://tiktok.com/@',
  whatsapp: 'https://wa.me/',
};

/**
 * @param raw    the value the organiser typed
 * @param platform optional platform key — lets a bare "@handle" or "handle"
 *                 become a full profile URL for that platform
 */
export function normalizeSocialUrl(raw: string | null | undefined, platform?: string): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (!v) return null;

  // Already absolute — trust it.
  if (/^https?:\/\//i.test(v)) return v;

  // Bare "@handle" or a plain handle for a known platform → build the profile URL.
  if (platform && PLATFORM_BASE[platform] && !v.includes('.') && !v.includes('/')) {
    const handle = v.replace(/^@+/, '');
    if (handle) return PLATFORM_BASE[platform] + (platform === 'tiktok' ? handle : handle);
  }

  // Looks like a domain/path — just add the protocol.
  return 'https://' + v.replace(/^\/+/, '');
}
