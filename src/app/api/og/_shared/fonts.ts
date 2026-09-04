/**
 * Typefaces for the generated share cards.
 *
 * THE ONE THING TO UNDERSTAND: `ImageResponse` cannot load a webfont.
 *
 * It renders through satori, which has no browser, no network fetch for CSS and
 * no `@font-face` resolution. A `<link rel="stylesheet" href="fonts.googleapis…">`
 * or a `font-family: Outfit` with no `fonts` array does not fail loudly — it
 * silently falls back to the single bundled Geist face, and the card ships in
 * the wrong typeface. Fonts must be handed to `ImageResponse` as raw bytes.
 *
 * So the four Outfit weights the card uses live in this folder as TTFs and are
 * read off disk once, at module scope, into the module cache. A cold lambda
 * pays ~190KB of disk read; every subsequent render pays nothing.
 *
 * WHY THE PATH IS RESOLVED THREE WAYS
 *
 * Reading a non-JS file from a serverless bundle is the fragile part, and the
 * two mechanisms that can put the file there disagree about where it lands:
 *
 *  1. `join(process.cwd(), '<literal>')` — Next's file tracer statically
 *     recognises this exact shape and copies the named file into the function
 *     bundle. This is the primary path and the reason each filename below is
 *     written out as a whole literal string rather than composed in a loop.
 *  2. `new URL('./file.ttf', import.meta.url)` — the bundler-native form. When
 *     the bundler emits the TTF as an asset it sits next to the chunk, which
 *     the cwd path would miss.
 *  3. Neither — in which case we fall back to the Geist face that ships inside
 *     `next/og` itself. The card is then off-brand, but it still renders. A
 *     link preview in the wrong font beats a 500 and no preview at all.
 *
 * If (1) and (2) ever both fail in production, the fix is one line in
 * `next.config.ts`:
 *
 *     outputFileTracingIncludes: { '/api/og/**': ['./src/app/api/og/_shared/*.ttf'] }
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Brand family name. Referenced by `fontFamily` in the card styles. */
export const FONT_FAMILY = 'Outfit';

/** What `ImageResponse` wants: name + bytes + weight + style. */
export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700 | 800;
  style: 'normal';
}

/** Read the first candidate path that exists. `null` when none do. */
function readFirst(candidates: Array<string | null>): Buffer | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return readFileSync(candidate);
    } catch {
      // Next candidate.
    }
  }
  return null;
}

/** `new URL(…, import.meta.url)` as a filesystem path, when it is one.
 *  Bundlers sometimes rewrite this to a non-`file:` URL, hence the guard. */
function nextToThisModule(url: URL): string | null {
  try {
    return url.protocol === 'file:' ? fileURLToPath(url) : null;
  } catch {
    return null;
  }
}

// Both resolution strategies, per weight. The `join(process.cwd(), …)` argument
// is a single literal on purpose — see (1) above; splitting it into variables
// defeats the tracer and the font silently disappears in production only.
const OUTFIT_REGULAR = readFirst([
  join(process.cwd(), 'src/app/api/og/_shared/Outfit-Regular.ttf'),
  nextToThisModule(new URL('./Outfit-Regular.ttf', import.meta.url)),
]);
const OUTFIT_MEDIUM = readFirst([
  join(process.cwd(), 'src/app/api/og/_shared/Outfit-Medium.ttf'),
  nextToThisModule(new URL('./Outfit-Medium.ttf', import.meta.url)),
]);
const OUTFIT_BOLD = readFirst([
  join(process.cwd(), 'src/app/api/og/_shared/Outfit-Bold.ttf'),
  nextToThisModule(new URL('./Outfit-Bold.ttf', import.meta.url)),
]);
const OUTFIT_EXTRABOLD = readFirst([
  join(process.cwd(), 'src/app/api/og/_shared/Outfit-ExtraBold.ttf'),
  nextToThisModule(new URL('./Outfit-ExtraBold.ttf', import.meta.url)),
]);

/** Last resort (3): the Geist face bundled inside `next/og`. */
const GEIST_FALLBACK = readFirst([
  join(process.cwd(), 'node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf'),
]);

/** Node Buffer → the ArrayBuffer slice satori expects.
 *  `buffer.buffer` alone is wrong: Node pools small allocations, so it is
 *  usually a much larger shared block and satori would parse neighbouring
 *  garbage as font data. */
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function face(buf: Buffer | null, weight: LoadedFont['weight']): LoadedFont | null {
  const bytes = buf ?? GEIST_FALLBACK;
  if (!bytes) return null;
  return { name: FONT_FAMILY, data: toArrayBuffer(bytes), weight, style: 'normal' };
}

/** The font set for `ImageResponse`. Empty only if even Geist is unreachable,
 *  in which case satori falls back to its own internal metrics. */
export const CARD_FONTS: LoadedFont[] = [
  face(OUTFIT_REGULAR, 400),
  face(OUTFIT_MEDIUM, 500),
  face(OUTFIT_BOLD, 700),
  face(OUTFIT_EXTRABOLD, 800),
].filter((f): f is LoadedFont => f !== null);

/** True when every weight is the real Outfit file. Surfaced in the route's
 *  `X-Og-Fonts` response header so a wrong-font regression is diagnosable from
 *  `curl -I` instead of by eye. */
export const FONTS_ARE_OUTFIT =
  !!OUTFIT_REGULAR && !!OUTFIT_MEDIUM && !!OUTFIT_BOLD && !!OUTFIT_EXTRABOLD;
