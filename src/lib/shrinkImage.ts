// One shrink step before every image upload to the public conference-assets
// bucket (owner, 19 Nov 2026). Supabase's cached egress reached 219.5 of 250 GB:
// conference logos were 768 px PNGs of about 260 KB drawn at 40 to 120 px.
// Every upload now scales the longer side down to `maxSide` (never up) and is
// encoded as WebP at 0.86; where the browser cannot encode WebP (Safari answers
// a PNG), PNG when the image has a transparent pixel, else JPEG at 0.86. A
// result that is not smaller than the input is dropped and the input kept.
// Never throws: an image that cannot be decoded comes back unchanged, and the
// caller's own checks still apply.
//
// Animated or vector art (GIF, SVG) is returned as is: a canvas would keep only
// the first frame of a GIF and rasterise an SVG.
//
// Sizes (MAX_SIDE): logos, emblems, crests, avatars 512; banners 2000; email
// images 1200; photos 1600. Never link /storage/v1/render/image/: each origin
// image is a paid transformation.

export const MAX_SIDE = {
  logo: 512,
  avatar: 512,
  banner: 2000,
  email: 1200,
  photo: 1600,
} as const;

export type ShrinkResult = { blob: Blob; ext: string; contentType: string };

export type ShrinkOptions = {
  maxSide: number;
  /** Centre-crop to a square before scaling. */
  square?: boolean;
  /** 'legacy' never encodes WebP (email images: Outlook on Windows cannot show WebP). */
  format?: 'webp' | 'legacy';
  /** Re-encode even when the result is not smaller (a type the bucket does not take). */
  always?: boolean;
};

const QUALITY = 0.86;
const PASSTHROUGH = new Set(['image/gif', 'image/svg+xml']);
const EXT: Record<string, string> = {
  'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/heic': 'heic',
};

function extOf(file: Blob): string {
  if (EXT[file.type]) return EXT[file.type];
  const name = (file as File).name ?? '';
  const fromName = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return fromName || 'png';
}

function unchanged(file: Blob): ShrinkResult {
  return { blob: file, ext: extOf(file), contentType: file.type || 'image/png' };
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall back to <img> */ }
  }
  if (typeof Image === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try { canvas.toBlob(resolve, type, quality); } catch { resolve(null); }
  });
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    return false;
  } catch {
    return true; // cannot read: keep alpha to be safe
  }
}

export async function shrinkImage(file: Blob, opts: ShrinkOptions): Promise<ShrinkResult> {
  if (typeof document === 'undefined' || PASSTHROUGH.has(file.type)) return unchanged(file);
  try {
    const source = await decode(file);
    if (!source) return unchanged(file);
    const srcW = source.width;
    const srcH = source.height;
    if (!srcW || !srcH) return unchanged(file);

    // Source rectangle: the whole image, or its centred square.
    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (opts.square && srcW !== srcH) {
      const side = Math.min(srcW, srcH);
      sx = Math.floor((srcW - side) / 2);
      sy = Math.floor((srcH - side) / 2);
      sw = side;
      sh = side;
    }
    const longest = Math.max(sw, sh);
    const scale = longest > opts.maxSide ? opts.maxSide / longest : 1;
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return unchanged(file);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
    if ('close' in source && typeof source.close === 'function') source.close();

    let out: Blob | null = null;
    if (opts.format !== 'legacy') {
      const webp = await toBlob(canvas, 'image/webp', QUALITY);
      if (webp && webp.type === 'image/webp') out = webp;
    }
    if (!out) {
      out = hasTransparency(ctx, w, h)
        ? await toBlob(canvas, 'image/png')
        : await toBlob(canvas, 'image/jpeg', QUALITY);
    }
    if (!out || !out.type) return unchanged(file);
    if (!opts.always && out.size >= file.size) return unchanged(file);
    return { blob: out, ext: EXT[out.type] ?? 'png', contentType: out.type };
  } catch {
    return unchanged(file);
  }
}

/** One year: every upload has a unique file name, so the bytes never change. */
export const ONE_YEAR_CACHE = '31536000';
