/**
 * Turning an organiser's upload into something a share card can actually draw.
 *
 * WHY NOT JUST HAND SATORI THE URL
 *
 * `ImageResponse` will fetch a remote `<img src>` for you, and doing that here
 * would reproduce both halves of the bug this whole route exists to fix:
 *
 *  • **Format.** Satori decodes PNG, JPEG and GIF. It does NOT decode WebP —
 *    and a large share of the conference banners in storage are `.webp`
 *    (Harvard WorldMUN and Model NATO Germany, to name two). Handed straight
 *    to satori those render as nothing at all, which is one of the ways a card
 *    comes back with no image.
 *  • **Weight.** 12 of the 37 public conference banners are over 300KB and the
 *    worst is 4.7MB. Compositing a 4.7MB source into the card blows the render
 *    budget and lands us well over WhatsApp's practical thumbnail ceiling,
 *    which is the *other* way a card comes back with no image.
 *
 * So every remote asset goes through sharp first: decoded from whatever the
 * organiser uploaded, resized to the size it is actually drawn at, re-encoded,
 * and inlined as a data URI. Satori then only ever sees a small JPEG or PNG it
 * is guaranteed to understand.
 *
 * SHARP IS OPTIONAL AT RUNTIME, DELIBERATELY
 *
 * `sharp` is currently a devDependency. Vercel installs devDependencies at
 * build time and Next's tracer pulls the native binary into the function, so
 * this works today — but a dependency-pruning change could take it away
 * without touching this file. Every entry point below therefore degrades to
 * "no image" rather than throwing: a card with no banner is a good card on a
 * flat forest field, and a card that 500s is a bare URL in someone's group
 * chat. Promoting sharp to a real `dependency` is the right hardening step.
 */

/** Never spend more than this on one organiser asset. Two of them plus the
 *  render still has to finish inside a serverless invocation. */
const FETCH_TIMEOUT_MS = 6000;

/** Refuse absurd uploads outright. The largest real banner is 4.7MB; this is
 *  a guard against a pathological file, not against normal ones. */
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;

/** Only ever fetch conference assets from our own Supabase storage bucket.
 *  `banner_url` / `logo_url` are organiser-controlled text columns, and this
 *  route is a fetch performed by our server: without this check a crafted row
 *  turns the card renderer into an SSRF proxy that will fetch an arbitrary URL
 *  (including internal addresses) on request. Storage URLs are the only thing
 *  the uploader ever writes, so the restriction costs nothing. */
const ALLOWED_ASSET_HOSTS = new Set(['luruhkwrgisytejswlas.supabase.co']);

function isAllowedAssetUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && ALLOWED_ASSET_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Load `sharp` without making it a hard requirement. Resolved once. */
type SharpModule = typeof import('sharp');
let sharpPromise: Promise<SharpModule | null> | null = null;
function loadSharp(): Promise<SharpModule | null> {
  if (!sharpPromise) {
    sharpPromise = import('sharp')
      .then((m) => (m.default ?? m) as SharpModule)
      .catch(() => null);
  }
  return sharpPromise;
}

/** Fetch raw bytes, with a timeout and a size ceiling. `null` on any problem —
 *  a missing banner is a design case here, not an error. */
async function fetchBytes(url: string): Promise<Buffer | null> {
  if (!isAllowedAssetUrl(url)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) return null;

    // Trust the header when it is present and obviously too big, so we can bail
    // before streaming 16MB we are going to throw away.
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_SOURCE_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > MAX_SOURCE_BYTES || buf.byteLength === 0 ? null : buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The banner, normalised into the exact rectangle it fills behind the scrim.
 *
 * Encoded as JPEG rather than PNG: it is a photograph, it is about to be
 * covered by a heavy gradient, and JPEG is roughly an order of magnitude
 * smaller. Quality 68 is deliberately low — under the scrim it is invisible,
 * and this single choice is most of what keeps the finished card under 200KB.
 */
export async function loadBannerDataUri(
  url: string | null | undefined,
  width: number,
  height: number,
): Promise<string | null> {
  if (!url) return null;
  const sharp = await loadSharp();
  if (!sharp) return null;

  const bytes = await fetchBytes(url);
  if (!bytes) return null;

  try {
    const out = await sharp(bytes)
      // `withoutEnlargement: false` on purpose: a small banner should still
      // fill the card rather than sit in a letterbox.
      .resize(width, height, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 68, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch {
    return null;
  }
}

/** A logo, plus the plate colour it needs to stay visible against. */
export interface LoadedLogo {
  dataUri: string;
  /** `'ivory'` for the usual dark/colourful mark; `'forest'` when the logo is
   *  itself near-white and would vanish on ivory. */
  plate: 'ivory' | 'forest';
}

/**
 * The logo, kept transparent and sized to the chip.
 *
 * PNG, not JPEG, and never flattened: a huge number of these are white or
 * light artwork on a transparent background, and flattening onto the ivory
 * plate is precisely how such a logo disappears. Instead we measure it and
 * move the plate.
 *
 * The measurement is alpha-weighted mean luminance over a 24x24 thumbnail —
 * i.e. "how light are the pixels that are actually painted", ignoring the
 * transparent surround. A fully transparent or unreadable file returns `null`
 * and the card simply omits the chip.
 */
export async function loadLogo(
  url: string | null | undefined,
  box: number,
): Promise<LoadedLogo | null> {
  if (!url) return null;
  const sharp = await loadSharp();
  if (!sharp) return null;

  const bytes = await fetchBytes(url);
  if (!bytes) return null;

  try {
    const normalised = sharp(bytes)
      // `contain` + transparent background: aspect ratio is preserved, so a
      // wide lockup stays a wide lockup instead of being squashed into a
      // square. Stretching the logo is the specific ugliness we are avoiding.
      .resize(box, box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 });

    const [png, probe] = await Promise.all([
      normalised.clone().toBuffer(),
      sharp(bytes)
        .resize(24, 24, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .ensureAlpha()
        .raw()
        .toBuffer(),
    ]);

    return { dataUri: `data:image/png;base64,${png.toString('base64')}`, plate: plateFor(probe) };
  } catch {
    return null;
  }
}

/** Alpha-weighted mean luminance of an RGBA raw buffer → which plate to use. */
function plateFor(rgba: Buffer): 'ivory' | 'forest' {
  let weighted = 0;
  let alpha = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3] / 255;
    if (a === 0) continue;
    // Rec. 601 luma — close enough for "is this artwork light or dark", and
    // cheaper than a colour-space conversion.
    const luma = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    weighted += luma * a;
    alpha += a;
  }
  // Nothing opaque enough to judge: assume the common case.
  if (alpha < 0.5) return 'ivory';
  // 200/255 is high on purpose. Only genuinely near-white artwork gets the dark
  // plate; a mid-tone logo reads fine on ivory and the ivory chip is the
  // house style.
  return weighted / alpha > 200 ? 'forest' : 'ivory';
}

/**
 * Re-encode the finished card as JPEG.
 *
 * `ImageResponse` can only emit PNG (satori → resvg), and a 1200x630 PNG
 * carrying a photographic banner lands somewhere between 800KB and 1.5MB —
 * far past the ~300KB where scrapers start dropping the image, which is the
 * failure mode we are here to fix. The same pixels as a q82 JPEG are typically
 * 100–180KB.
 *
 * Returns the PNG untouched if sharp is unavailable, so the route still
 * answers; the caller reads the returned `contentType` rather than assuming.
 */
export async function encodeCard(
  png: ArrayBuffer,
): Promise<{ body: Buffer; contentType: 'image/jpeg' | 'image/png' }> {
  const raw = Buffer.from(png);
  const sharp = await loadSharp();
  if (!sharp) return { body: raw, contentType: 'image/png' };

  try {
    const jpeg = await sharp(raw)
      // The card is fully opaque by construction, but flattening is free
      // insurance: a stray alpha channel would otherwise composite against
      // black and darken the whole card.
      .flatten({ background: '#1B3828' })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toBuffer();
    return { body: jpeg, contentType: 'image/jpeg' };
  } catch {
    return { body: raw, contentType: 'image/png' };
  }
}
