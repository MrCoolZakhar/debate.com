'use client';
// Gavelling Crisis: an image attached to a directive or a clarification. There is no column for it, so the picture
// travels in the text as a last line `[image](https://.../crisis-media/<crisis id>/directives/<file>)`. This file is
// the one place that writes and reads that marker: `withAttached` adds it, `splitAttached` takes it off again,
// `plainText` is the text without it (previews, word counts), and `DirectiveBody` draws the text with the picture
// beneath it as a thumbnail that opens full size. Only pictures in our own crisis-media bucket are ever drawn.

import type { CSSProperties } from 'react';
import { ZoomableImage } from '../news/ImageLightbox';

const MARKER = /(?:\r?\n){0,2}\[image\]\((https:\/\/[^\s()]+)\)\s*$/;
const TRUSTED = '/storage/v1/object/public/crisis-media/';

export const trustedImage = (url: string): boolean => {
  try { const u = new URL(url); return u.protocol === 'https:' && u.pathname.includes(TRUSTED); } catch { return false; }
};

/** The text with a picture added as its last line. */
export function withAttached(text: string, url: string | null | undefined): string {
  const t = text.trim();
  return url ? `${t}\n\n[image](${url})` : t;
}

/** The text and the picture it carries (null when none, or when the address is not one of ours). */
export function splitAttached(body: string): { text: string; image: string | null } {
  const m = MARKER.exec(body);
  if (!m || !trustedImage(m[1])) return { text: body, image: null };
  return { text: body.slice(0, m.index).replace(/\s+$/, ''), image: m[1] };
}

/** The text alone, for previews and word counts. */
export const plainText = (body: string): string => splitAttached(body).text;

/** A directive's text with its picture, if any, beneath it. */
export function DirectiveBody({ body, style, thumb = 220, asSpan }: { body: string; style?: CSSProperties; thumb?: number; asSpan?: boolean }) {
  const { text, image } = splitAttached(body);
  return (
    <>
      {text && <p style={style}>{text}</p>}
      {image && <ZoomableImage src={image} alt="Attached image" asSpan={asSpan} style={{ width: `min(100%, ${thumb}px)`, height: Math.round(thumb * 0.68), borderRadius: 14, marginTop: text ? 10 : 0, boxShadow: '0 0 0 1px rgba(110,30,30,0.14)' }} />}
    </>
  );
}
