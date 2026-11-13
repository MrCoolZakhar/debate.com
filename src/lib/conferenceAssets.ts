// Shared conference asset upload — banners and logos both land in the public
// 'conference-assets' bucket under their own folder, mirroring the recipe in
// manage/[slug]/settings (handleBannerUpload / handleLogoUpload).
// 'seat-logos' and 'group-logos' are the per-seat crests and the seat-group
// crests of custom (parliamentary) committees, see src/lib/slotGroups.ts.
// 'committee-emblems' is a committee's own mark (23 Sep 2026: the committee
// editor used to upload it by hand, and the creation wizard needs the same
// path). All three are treated exactly like logos: small, PNG, transparency
// preserved.

import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyError } from '@/lib/friendlyError';

export type ConferenceAssetFolder = 'banners' | 'logos' | 'seat-logos' | 'group-logos' | 'committee-emblems';

export type UploadConferenceAssetResult =
  | { url: string; error?: undefined }
  | { url?: undefined; error: string };

const MAX_BYTES = 5 * 1024 * 1024;

// Display caps — banners render full-width hero art, logos render inside a
// small disc. Anything larger is downscaled before upload so pages stay light.
const CAP: Record<ConferenceAssetFolder, number> = { banners: 1600, logos: 512, 'seat-logos': 512, 'group-logos': 512, 'committee-emblems': 512 };

// Formats we should never rasterize/re-encode (vectors, animations) — upload as-is.
const PASSTHROUGH = new Set(['image/svg+xml', 'image/gif']);

// The types the 'conference-assets' bucket accepts (its allowed MIME list, 5 MB).
// Any other image the browser can decode (AVIF, BMP, TIFF, HEIC in Safari...) is
// always re-encoded to one of these; one it cannot decode is never uploaded.
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** "HEIC" from photo.heic, else from image/heic: the type named in the refusal. */
function imageTypeWord(file: File): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop() ?? '' : '';
  if (ext && /^[a-z0-9]{2,5}$/i.test(ext)) return ext.toUpperCase();
  const sub = file.type.startsWith('image/') ? file.type.slice(6) : '';
  return (sub.replace(/^x-/, '').split(/[+;]/)[0] || 'unknown').toUpperCase();
}

function unusableType(file: File): string {
  return `This image type (${imageTypeWord(file)}) can't be used here. Upload a JPG, PNG, WebP or GIF instead.`;
}

/**
 * Downscale + re-encode an image File on a canvas before upload.
 *  - Only downscales when larger than the folder's cap (never upscales).
 *  - Banners export JPEG (q0.82); logos export PNG (transparency preserved).
 * Returns a compressed File, or the original file if compression can't help
 * or fails — the upload must never be blocked by this step. A type the bucket
 * does not take (not in ACCEPTED) is always re-encoded, even when larger, and
 * answers `error` when it cannot be decoded at all (never uploaded as is).
 */
async function compressImageFile(
  file: File,
  folder: ConferenceAssetFolder,
): Promise<{ file: File; ext: string; contentType: string; error?: string }> {
  const originalExt = file.name.split('.').pop() || 'png';
  const mustConvert = !ACCEPTED.has(file.type) && !PASSTHROUGH.has(file.type);
  const fallback = mustConvert
    ? { file, ext: originalExt, contentType: file.type, error: unusableType(file) }
    : { file, ext: originalExt, contentType: file.type || 'image/png' };

  if (typeof document === 'undefined' || PASSTHROUGH.has(file.type)) return fallback;

  try {
    const cap = CAP[folder];
    // Everything but a banner is logo-shaped art: PNG out, alpha kept.
    const isLogo = folder !== 'banners';
    const outType = isLogo ? 'image/png' : 'image/jpeg';
    const outExt = isLogo ? 'png' : 'jpg';

    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    const scale = longest > cap ? cap / longest : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outType, isLogo ? undefined : 0.82),
    );
    if (!blob) return fallback;
    // No gain: keep the original, but only when the bucket takes its type.
    if (!mustConvert && blob.size >= file.size) return fallback;

    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    const compressed = new File([blob], `${base}.${outExt}`, { type: outType });
    return { file: compressed, ext: outExt, contentType: outType };
  } catch {
    return fallback; // decode/canvas failure — never block the upload
  }
}

/** Decode a File to a drawable bitmap, preferring createImageBitmap. */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decode */
    }
  }
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
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadConferenceAsset(
  supabase: SupabaseClient,
  folder: ConferenceAssetFolder,
  conferenceId: string,
  file: File,
): Promise<UploadConferenceAssetResult> {
  if (file.size > MAX_BYTES) {
    return { error: 'This image is larger than 5 MB. Upload a smaller one.' };
  }
  if (!file.type.startsWith('image/')) {
    return { error: 'Only image files are accepted.' };
  }
  // Shrink oversized art on the client before it ever leaves the browser.
  const { file: outFile, ext, contentType, error: convertError } = await compressImageFile(file, folder);
  if (convertError) return { error: convertError };
  const path = `${folder}/${conferenceId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('conference-assets')
    .upload(path, outFile, { contentType, upsert: true });
  if (error) {
    return { error: friendlyError(error, "Couldn't upload the image. Please try a different one.") };
  }
  const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
  return { url: data.publicUrl };
}
