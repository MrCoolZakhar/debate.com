// Shared conference asset upload — banners and logos both land in the public
// 'conference-assets' bucket under their own folder, mirroring the recipe in
// manage/[slug]/settings (handleBannerUpload / handleLogoUpload).
// 'seat-logos' and 'group-logos' are the per-seat crests and the seat-group
// crests of custom (parliamentary) committees, see src/lib/slotGroups.ts.
// 'committee-emblems' is a committee's own mark (23 Sep 2026: the committee
// editor used to upload it by hand, and the creation wizard needs the same
// path). All three are treated exactly like logos: small, transparency
// preserved. Every upload is shrunk to WebP first (src/lib/shrinkImage.ts) and
// cached for a year: the file name is unique per upload.

import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyError } from '@/lib/friendlyError';
import { MAX_SIDE, ONE_YEAR_CACHE, shrinkImage } from '@/lib/shrinkImage';

export type ConferenceAssetFolder = 'banners' | 'logos' | 'seat-logos' | 'group-logos' | 'committee-emblems';

export type UploadConferenceAssetResult =
  | { url: string; error?: undefined }
  | { url?: undefined; error: string };

const MAX_BYTES = 5 * 1024 * 1024;

// Display caps (src/lib/shrinkImage.ts, owner 19 Nov 2026): banners render
// full-width hero art, everything else inside a small disc.
const CAP: Record<ConferenceAssetFolder, number> = {
  banners: MAX_SIDE.banner, logos: MAX_SIDE.logo, 'seat-logos': MAX_SIDE.logo,
  'group-logos': MAX_SIDE.logo, 'committee-emblems': MAX_SIDE.logo,
};

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
 * Shrink an image File before upload through shrinkImage (WebP, longer side
 * at most the folder's cap, never enlarged; the original when that is not
 * smaller). A type the bucket does not take (not in ACCEPTED) is always
 * re-encoded, even when larger, and answers `error` when it cannot be decoded
 * at all (never uploaded as is). GIF and SVG go up untouched.
 */
async function compressImageFile(
  file: File,
  folder: ConferenceAssetFolder,
): Promise<{ file: Blob; ext: string; contentType: string; error?: string }> {
  const mustConvert = !ACCEPTED.has(file.type) && !PASSTHROUGH.has(file.type);
  const shrunk = await shrinkImage(file, { maxSide: CAP[folder], always: mustConvert });
  if (mustConvert && !ACCEPTED.has(shrunk.contentType)) {
    return { file, ext: shrunk.ext, contentType: file.type, error: unusableType(file) };
  }
  return { file: shrunk.blob, ext: shrunk.ext, contentType: shrunk.contentType };
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
    .upload(path, outFile, { contentType, upsert: true, cacheControl: ONE_YEAR_CACHE });
  if (error) {
    return { error: friendlyError(error, "Couldn't upload the image. Please try a different one.") };
  }
  const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
  return { url: data.publicUrl };
}
