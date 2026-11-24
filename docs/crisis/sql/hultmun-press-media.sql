-- Gavelling Crisis, HultMUN feedback (23 Nov 2026): crisis updates (news) can carry audio, video and more kinds of file.
-- APPLIED 23 Nov 2026 (Peter approved).
--
-- The crisis-media bucket (docs/crisis/sql/006) allowed only images, PDF, Word, PowerPoint, Excel and text, up to 20 MB.
-- This lets it also take audio (mp3, m4a, wav, ogg, aac), video (mp4, webm, mov), csv, rtf, zip and the older Office formats,
-- and raises the size limit to 50 MB for the recordings. The client (src/lib/crisis/mediaTypes.ts) keeps documents and images
-- at 20 MB and only audio and video up to 50 MB. The list below must stay identical to ALL_FILE_TYPES in that file.
-- Still no html, svg or script types: the bucket is public and serves files from our own storage origin.
--
-- Also check Supabase dashboard > Storage > Settings: the project-wide "Upload file size limit" must be at least 50 MB,
-- or a bigger file is refused there whatever the bucket says (the player then shows "Could not upload the file").

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif',
      'audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/aac','audio/webm',
      'video/mp4','video/webm','video/quicktime',
      'application/pdf','text/plain','text/csv','application/rtf','application/zip',
      'application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'crisis-media';

-- No table changes: crisis_news already has attachment_url and attachment_name (part 6). The player is chosen from the file's extension.
