/**
 * A licensed photograph on the blog, with its credit.
 *
 * Every photo comes from src/components/blog/photos.ts, which records its
 * source page and licence. The credit is always shown next to the photo:
 *
 *   • `PhotoCredit`   the linked line ("Photo: Name, CC BY-SA 4.0"), under the
 *                     article hero and under an inline figure
 *   • `PhotoFigure`   an inline figure inside the prose (lazy, with caption)
 *   • `CardPhoto`     the picture on a card. A card is ONE anchor, so its
 *                     credit is plain text on the picture; the linked credit
 *                     for every photo is listed at the foot of /blog
 *                     (`PhotoCreditsList`).
 *
 * Server components, no state. Files are self-hosted WebP at 1200 x 750.
 */

import Image from 'next/image';
import { PHOTOS, PHOTO_WIDTH, PHOTO_HEIGHT, type PhotoId, type BlogPhoto } from './photos';

function licenceLabel(p: BlogPhoto): string {
  return p.license === 'Public domain' ? 'public domain' : p.license;
}

/** "Photo: Name, CC BY-SA 4.0", the name linking to the source page and the
 *  licence to its deed. */
export function PhotoCredit({ id, tone = 'light' }: { id: PhotoId; tone?: 'light' | 'deep' }) {
  const p = PHOTOS[id];
  const colour = tone === 'deep' ? 'rgba(237,231,216,0.78)' : '#6A5A4A';
  const link = 'underline decoration-1 underline-offset-2 hover:text-[#1B3828]';
  return (
    <span className="text-[12px] leading-[1.5]" style={{ color: colour }}>
      Photo:{' '}
      <a href={p.source} className={link} style={{ color: colour }} rel="noopener" target="_blank">
        {p.author}
      </a>
      ,{' '}
      <a href={p.licenseUrl} className={link} style={{ color: colour }} rel="license noopener" target="_blank">
        {licenceLabel(p)}
      </a>
    </span>
  );
}

/** The article hero: eager, high priority, fills its 16:10 frame. */
export function HeroPhoto({ id }: { id: PhotoId }) {
  const p = PHOTOS[id];
  return (
    <Image
      src={p.src}
      alt={p.alt}
      width={PHOTO_WIDTH}
      height={PHOTO_HEIGHT}
      sizes="(min-width: 1024px) 400px, (min-width: 640px) 856px, 100vw"
      loading="eager"
      fetchPriority="high"
      className="block h-full w-full object-cover"
    />
  );
}

/** The picture on an index or "keep reading" card, with a plain-text credit. */
export function CardPhoto({ id, lead = false }: { id: PhotoId; lead?: boolean }) {
  const p = PHOTOS[id];
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Image
        src={p.src}
        alt={p.alt}
        width={PHOTO_WIDTH}
        height={PHOTO_HEIGHT}
        sizes={lead ? '(min-width: 768px) 500px, 100vw' : '(min-width: 1024px) 330px, (min-width: 640px) 50vw, 100vw'}
        loading={lead ? 'eager' : 'lazy'}
        {...(lead ? { fetchPriority: 'high' as const } : {})}
        className="gv-card-photo block h-full w-full object-cover"
      />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 truncate px-3 pb-1.5 pt-5 text-right text-[10.5px]"
        style={{ color: 'rgba(255,255,255,0.86)', background: 'linear-gradient(to top, rgba(12,24,17,0.55), transparent)' }}
      >
        Photo: {p.author}, {licenceLabel(p)}
      </span>
    </div>
  );
}

/** An inline figure inside an article's prose. Lazy, width and height set. */
export function PhotoFigure({ id, caption }: { id: PhotoId; caption?: string }) {
  const p = PHOTOS[id];
  return (
    <figure className="gv-figure">
      <Image
        src={p.src}
        alt={p.alt}
        width={PHOTO_WIDTH}
        height={PHOTO_HEIGHT}
        sizes="(min-width: 640px) 544px, 100vw"
        loading="lazy"
      />
      <figcaption>
        {caption ? <span className="gv-figure-caption">{caption} </span> : null}
        <PhotoCredit id={id} />
      </figcaption>
    </figure>
  );
}

/** Every photo the blog uses, with its linked credit: the foot of /blog. */
export function PhotoCreditsList({ ids }: { ids: PhotoId[] }) {
  return (
    <ul className="m-0 grid list-none gap-x-8 gap-y-1.5 p-0 sm:grid-cols-2">
      {ids.map((id) => (
        <li key={id} className="text-[12.5px] leading-[1.5]" style={{ color: '#55483C' }}>
          <span>{PHOTOS[id].alt}. </span>
          <PhotoCredit id={id} />
        </li>
      ))}
    </ul>
  );
}
