// Shared conference asset upload — banners and logos both land in the public
// 'conference-assets' bucket under their own folder, mirroring the recipe in
// manage/[slug]/settings (handleBannerUpload / handleLogoUpload).

import type { SupabaseClient } from '@supabase/supabase-js';

export type ConferenceAssetFolder = 'banners' | 'logos';

export type UploadConferenceAssetResult =
  | { url: string; error?: undefined }
  | { url?: undefined; error: string };

const MAX_BYTES = 5 * 1024 * 1024;

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
  const ext = file.name.split('.').pop() || 'png';
  const path = `${folder}/${conferenceId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('conference-assets')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    return { error: 'Upload failed: ' + error.message };
  }
  const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
  return { url: data.publicUrl };
}
