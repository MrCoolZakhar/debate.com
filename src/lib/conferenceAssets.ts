// Shared conference asset upload — banners and logos both land in the public
// 'conference-assets' bucket under their own folder, mirroring the recipe in
// manage/[slug]/settings (handleBannerUpload / handleLogoUpload).

import type { SupabaseClient } from '@supabase/supabase-js';

export type ConferenceAssetFolder = 'banners' | 'logos';

export type UploadConferenceAssetResult =
  | { url: string; error?: undefined }
  | { url?: undefined; error: string };

const MAX_BYTES = 5 * 1024 * 1024;

// Display caps — banners render full-width hero art, logos render inside a
// small disc. Anything larger is downscaled before upload so pages stay light.
const CAP: Record<ConferenceAssetFolder, number> = { banners: 1600, logos: 512 };

// Formats we should never rasterize/re-encode (vectors, animations) — upload as-is.
const PASSTHROUGH = new Set(['image/svg+xml', 'image/gif']);

/**
 * Downscale + re-encode an image File on a canvas before upload.
 *  - Only downscales when larger than the folder's cap (never upscales).
 *  - Banners export JPEG (q0.82); logos export PNG (transparency preserved).
 * Returns a compressed File, or the original file if compression can't help
 * or fails — the upload must never be blocked by this step.
 */
async function compressImageFile(
  file: File,
  folder: ConferenceAssetFolder,
): Promise<{ file: File; ext: string; contentType: string }> {
  const originalExt = file.name.split('.').pop() || 'png';
  const fallback = { file, ext: originalExt, contentType: file.type || 'image/png' };

  if (typeof document === 'undefined' || PASSTHROUGH.has(file.type)) return fallback;

  try {
    const cap = CAP[folder];
    const isLogo = folder === 'logos';
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
    if (!blob || blob.size >= file.size) return fallback; // no gain — keep original

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
    return { error: 'Image must be under 5MB.' };
  }
  if (!file.type.startsWith('image/')) {
    return { error: 'Only image files are accepted.' };
  }
  // Shrink oversized art on the client before it ever leaves the browser.
  const { file: outFile, ext, contentType } = await compressImageFile(file, folder);
  const path = `${folder}/${conferenceId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('conference-assets')
    .upload(path, outFile, { contentType, upsert: true });
  if (error) {
    return { error: 'Upload failed: ' + error.message };
  }
  const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
  return { url: data.publicUrl };
}
