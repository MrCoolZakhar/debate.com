/**
 * GET /api/og/icon/[slug]/[v]  →  a conference's square link icon (PNG).
 *
 * `[v]` is `<iconVersion>-<size>.png` (src/lib/conferenceIcon.ts): the size
 * (180 or 512) is read from it, the token is pure cache identity, exactly like
 * the share card's. Linktree, iMessage and a phone's home screen use this as
 * the link's picture; the 1200x630 share card stays what WhatsApp shows.
 *
 * Drawing: the banner covers the square (the conference's theme colour when it
 * has none, a preset banner fetched from our own site), the logo sits on a
 * white disc in the middle, never clipped (the inscribed square of the disc).
 * No logo: the acronym on the disc, the one piece of text allowed.
 *
 * Same rules as the share card: Node runtime (sharp), Inter from static TTFs,
 * organiser images through `remoteImage.ts` (our storage only; a Gavelling
 * listing's third-party image only through `fetchListingImage`), all of them
 * inside ONE 2.5 s budget, and anything drawn without an image it should have
 * had is served degraded with a 5-minute cache.
 */
/* eslint-disable @next/next/no-img-element -- satori input, never mounted in a browser (see card.tsx). */
import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';
import { iconSizeFromSegment, themeMain } from '@/lib/conferenceIcon';
import { versionToken } from '@/lib/ogVersion';
import { CARD_FONTS, FONT_FAMILY } from '../../../_shared/fonts';
import { FOREST, FOREST_DEEP, MARK_DATA_URI } from '../../../_shared/card';
import { bannerFetchUrl, loadBannerDataUri, loadLogo } from '../../../_shared/remoteImage';
import { mix } from '@/lib/theme';

export const runtime = 'nodejs';

interface IconRow {
  full_name: string | null;
  acronym: string | null;
  banner_url: string | null;
  logo_url: string | null;
  theme: unknown;
  listed_by: string | null;
}

const COLUMNS = 'full_name, acronym, banner_url, logo_url, theme, listed_by';

/** `undefined` = the database could not be asked. Follows renamed slugs like the card does. */
async function loadConference(slug: string): Promise<IconRow | null | undefined> {
  try {
    const { data, error } = await supabase.from('conferences').select(COLUMNS).eq('slug', slug).maybeSingle();
    if (error) return undefined;
    if (data) return data as IconRow;
    const { data: alias, error: aliasError } = await supabase
      .from('conference_slug_aliases')
      .select(`conferences(${COLUMNS})`)
      .eq('slug', slug)
      .maybeSingle();
    if (aliasError) return undefined;
    return (alias as { conferences?: IconRow | null } | null)?.conferences ?? null;
  } catch {
    return undefined;
  }
}

const ASSET_BUDGET_MS = 2500;

function withinBudget<T>(p: Promise<T | null>, onLate: () => void): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      onLate();
      resolve(null);
    }, ASSET_BUDGET_MS);
  });
  return Promise.race([p.catch(() => null), late]).finally(() => clearTimeout(timer));
}

/** One short label for the disc when there is no logo: the acronym, else initials. */
function discLabel(conf: IconRow): string | null {
  const acronym = (conf.acronym ?? '').trim().replace(/\s*'?(19|20)?\d{2}$/, '').trim();
  if (acronym && acronym.length <= 7) return acronym.toUpperCase();
  const stop = new Set(['of', 'the', 'and', 'for', 'de', 'la', 'el', '&']);
  const initials = (conf.full_name ?? '')
    .split(/\s+/)
    .filter((w) => w && !stop.has(w.toLowerCase()) && /^[\p{L}]/u.test(w))
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 4);
  return initials || null;
}

function labelFontSize(label: string, disc: number): number {
  const n = label.length;
  const ratio = n <= 2 ? 0.46 : n <= 3 ? 0.38 : n <= 4 ? 0.3 : n <= 5 ? 0.25 : n <= 6 ? 0.21 : 0.18;
  return Math.round(disc * ratio);
}

/** Satori's PNG → a compressed, opaque PNG through sharp (raw PNG if sharp is missing). */
async function encodeIcon(png: ArrayBuffer): Promise<Buffer> {
  const raw = Buffer.from(png);
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(raw).flatten({ background: FOREST }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  } catch {
    return raw;
  }
}

function IconArt({
  size,
  backdrop,
  main,
  logo,
  label,
}: {
  size: number;
  backdrop: string | null;
  main: string;
  logo: { dataUri: string; plate: 'ivory' | 'forest' } | null;
  label: string | null;
}) {
  const disc = Math.round(size * 0.64);
  // The inscribed square of the disc, a little inside it, so square logo art
  // is never clipped by the circle.
  const logoBox = Math.round(disc * 0.78);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        backgroundColor: main,
        // Satori throws on an undefined style value, so the key is left out entirely.
        ...(backdrop ? {} : { backgroundImage: `linear-gradient(145deg, ${mix(main, '#FFFFFF', 0.12)} 0%, ${main} 55%, ${mix(main, '#000000', 0.28)} 100%)` }),
        fontFamily: FONT_FAMILY,
      }}
    >
      {backdrop ? (
        <img src={backdrop} width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }} alt="" />
      ) : null}
      {backdrop ? (
        // A light veil so the disc stands off a busy photo.
        <div style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, backgroundColor: 'rgba(8,16,12,0.14)' }} />
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: disc,
          height: disc,
          borderRadius: 9999,
          // Always a plain white disc, no ring (owner, 23 Oct 2026): a logo on a white
          // square blends into it. A light shadow lifts it off the banner.
          backgroundColor: '#FFFFFF',
          boxShadow: `0 ${Math.round(size * 0.012)}px ${Math.round(size * 0.04)}px rgba(6,16,11,0.18)`,
        }}
      >
        {logo ? (
          <img src={logo.dataUri} width={logoBox} height={logoBox} style={{ objectFit: 'contain' }} alt="" />
        ) : label ? (
          <div
            style={{
              display: 'flex',
              color: main,
              fontSize: labelFontSize(label, disc),
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1,
            }}
          >
            {label}
          </div>
        ) : MARK_DATA_URI ? (
          <img src={MARK_DATA_URI} width={logoBox} height={logoBox} style={{ objectFit: 'contain' }} alt="" />
        ) : null}
      </div>
    </div>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; v: string }> },
): Promise<Response> {
  const { slug, v } = await params;
  const size = iconSizeFromSegment(v);
  const token = versionToken(v);

  const conf = await loadConference(slug);
  let degraded = !conf;
  const markLate = () => {
    degraded = true;
  };

  const isListing = conf?.listed_by === 'gavelling';
  const main = themeMain(conf?.theme) ?? FOREST;
  const disc = Math.round(size * 0.64);
  const banner = bannerFetchUrl(conf?.banner_url ?? null);
  const [backdrop, logo] = conf
    ? await Promise.all([
        banner ? withinBudget(loadBannerDataUri(banner, size, size, isListing), markLate) : Promise.resolve(null),
        conf.logo_url ? withinBudget(loadLogo(conf.logo_url, Math.round(disc * 0.78), isListing), markLate) : Promise.resolve(null),
      ])
    : [null, null];
  // An image the row has but we could not draw: short cache, drawn again soon.
  if (conf?.banner_url && !backdrop) degraded = true;
  if (conf?.logo_url && !logo) degraded = true;

  const image = new ImageResponse(
    <IconArt
      size={size}
      backdrop={backdrop}
      main={conf ? main : FOREST_DEEP}
      logo={logo}
      label={conf && !logo ? discLabel(conf) : null}
    />,
    { width: size, height: size, fonts: CARD_FONTS },
  );
  const body = await encodeIcon(await image.arrayBuffer());

  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(body.byteLength),
      'Cache-Control': degraded ? 'public, max-age=300, s-maxage=300' : 'public, max-age=31536000, immutable',
      ...(degraded ? { 'X-Og-Degraded': '1' } : {}),
      'X-Og-Version': token,
    },
  });
}
