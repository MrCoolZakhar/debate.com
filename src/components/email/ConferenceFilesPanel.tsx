'use client';

// ─────────────────────────────────────────────────────────────────────────────
// FILES, the fourth section of the palette rail.
//
// WHAT THIS IS AND IS NOT. It is not an attachment tray, and it does not
// pretend to be one. The send pipeline is a text-only queue end to end:
// `email_outbox` has seventeen columns and not one of them could hold a file,
// `send-emails` posts to Resend's BATCH endpoint (which does not accept
// attachments at all), and there is no source-controlled copy of that function
// to change. So a button that said "Attach" would be a button that quietly
// did nothing, or a promise cashed by somebody else later.
//
// What organisers actually have is already hosted: every study guide, rules of
// procedure and background document the secretariat uploaded lives in the
// PUBLIC `study-guides` bucket with a stable URL. So a file goes into an email
// as a real link on a real button, one click for the reader, nothing for the
// mail server to weigh, and no 40MB message that lands in spam.
//
// WHAT IT SHOWS. `study_guides` rows for this conference, reached through
// `conference_committees` (the table is scoped per COMMITTEE, not per
// conference, `conference_id` on the row itself is NULL on most production
// rows and cannot be trusted as the key). Position papers are a different
// table in a different bucket entirely, so there is no filter to get wrong:
// a delegate submission can never appear here.
//
// UNPUBLISHED guides are shown but marked, because linking one in an email is
// how you accidentally release it early. Rows whose `file_url` is a bare
// relative path (six seed rows in production point at the wrong bucket) cannot
// produce a working link, so they are listed and disabled rather than
// silently inserted as a dead URL.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { FileText, AlertTriangle, Paperclip } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { Emoji3D, NEU, NEU_GRADIENTS, OUTFIT, EASE } from '@/components/neu';
import { SOFT, AMBER_INK, CARD_BORDER } from '@/app/manage/[slug]/live/tokens';
import type { EmailBlock } from '@/lib/emailBlocks';

const FOREST = '#1B3828';
const INK = '#1C1410';

export interface ConferenceFile {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number | null;
  url: string;
  published: boolean;
  committee: string;
  /** False when `file_url` is not an absolute http(s) URL, see the note above. */
  linkable: boolean;
}

function prettySize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function useConferenceFiles(conferenceId: string, accessToken: string | null, enabled: boolean) {
  const [files, setFiles] = useState<ConferenceFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || files !== null) return;
    let cancelled = false;
    (async () => {
      // No token means the session lapsed while the builder was open. Say so
      // once rather than leaving a skeleton spinning forever.
      if (!accessToken) {
        if (!cancelled) { setError('Your session expired, refresh the page.'); setFiles([]); }
        return;
      }
      const supabase = getAuthedClient(accessToken);
      const { data, error: err } = await supabase
        .from('study_guides')
        .select('id, title, file_name, file_size_bytes, file_url, is_published, conference_committees!inner(name, abbreviation, conference_id)')
        .eq('conference_committees.conference_id', conferenceId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (err) { setError(err.message); setFiles([]); return; }
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      setFiles(rows.map(r => {
        // PostgREST returns an embedded one-to-one as an object, but an older
        // relationship shape can come back as a single-element array. Accept
        // both rather than betting on one.
        const raw = r.conference_committees;
        const cc = (Array.isArray(raw) ? raw[0] : raw) as { name?: string; abbreviation?: string | null } | undefined;
        const url = String(r.file_url ?? '');
        return {
          id: String(r.id),
          title: String(r.title ?? 'Untitled'),
          fileName: String(r.file_name ?? ''),
          sizeBytes: (r.file_size_bytes as number | null) ?? null,
          url,
          published: r.is_published === true,
          committee: cc?.abbreviation || cc?.name || '',
          linkable: /^https?:\/\//i.test(url),
        };
      }));
    })();
    return () => { cancelled = true; };
  }, [enabled, accessToken, conferenceId, files]);

  return { files, error };
}

/** A file becomes a real button with a real URL, the one block the renderer
 *  can already produce that carries a link, so nothing new has to be taught to
 *  `emailBlocks`, `emailHtml` or the outbox. */
export function blockForFile(file: ConferenceFile): EmailBlock {
  return { type: 'button', label: file.title.slice(0, 60), destination: 'custom', url: file.url };
}

export default function ConferenceFilesPanel({
  files, error, wide, onInsert,
}: {
  files: ConferenceFile[] | null;
  error: string | null;
  wide: boolean;
  onInsert: (file: ConferenceFile) => void;
}) {
  if (error) {
    return (
      <p className="flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: AMBER_INK, lineHeight: 1.5, textWrap: 'pretty' }}>
        <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
        Couldn&apos;t load your files: {error}
      </p>
    );
  }

  if (files === null) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 54, borderRadius: 16, backgroundColor: 'rgba(27,56,40,0.05)', boxShadow: NEU.inSm }} />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Emoji3D name="Open file folder" size={30} fallback={FileText} fallbackColor={FOREST} />
        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: INK, textWrap: 'balance' }}>
          Nothing uploaded yet
        </p>
        <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
          Study guides and rules of procedure you upload under Documents show up here, ready to link.
        </p>
      </div>
    );
  }

  return (
    <div className={wide ? 'flex flex-col gap-2' : 'flex gap-2 overflow-x-auto pb-1'}>
      {files.map(f => {
        const size = prettySize(f.sizeBytes);
        const meta = [f.committee, size].filter(Boolean).join(' · ');
        return (
          <button
            key={f.id}
            type="button"
            disabled={!f.linkable}
            title={f.linkable ? `Add a button linking to ${f.fileName || f.title}` : 'This file has no working link yet, re-upload it under Documents.'}
            onClick={() => f.linkable && onInsert(f)}
            className="flex items-center gap-2.5 text-left focus:outline-none flex-shrink-0"
            style={{
              width: wide ? '100%' : 200,
              minHeight: 54,
              padding: '9px 11px',
              borderRadius: 16,
              border: CARD_BORDER,
              backgroundColor: NEU.surface,
              boxShadow: NEU.outSm,
              cursor: f.linkable ? 'pointer' : 'not-allowed',
              opacity: f.linkable ? 1 : 0.55,
              transitionProperty: 'box-shadow, transform',
              transitionDuration: '220ms',
              transitionTimingFunction: EASE,
            }}
            onMouseEnter={e => {
              if (!f.linkable) return;
              e.currentTarget.style.boxShadow = NEU.outSmHover;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = NEU.outSm;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 34, height: 34, borderRadius: 12,
                background: `linear-gradient(135deg, ${NEU_GRADIENTS.gold[0]}40, ${NEU_GRADIENTS.gold[1]}2E), ${NEU.surface}`,
                boxShadow: NEU.outSm,
              }}
            >
              <Emoji3D name="Page facing up" size={19} fallback={FileText} fallbackColor={FOREST} />
            </span>
            {/* The title gets the WHOLE line. A status badge sharing it left
                "HSC Study Guide" rendering as "H." in a 180px rail, which is
                a worse trade than putting the badge on the quieter second
                line where it still reads and costs the title nothing. */}
            <span className="min-w-0 flex-1">
              <span className="block truncate" title={f.title} style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: INK }}>
                {f.title}
              </span>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="truncate" title={meta || f.fileName} style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT }}>
                  {meta || f.fileName}
                </span>
                {!f.published && (
                  <span
                    className="flex-shrink-0"
                    title="This guide has not been released to delegates yet."
                    style={{
                      fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.06em',
                      padding: '1px 5px', borderRadius: 999,
                      backgroundColor: 'rgba(126,81,40,0.10)', color: AMBER_INK,
                      border: '1px solid rgba(126,81,40,0.28)',
                    }}
                  >
                    NOT OUT YET
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
      <p
        className={wide ? 'flex items-start gap-1.5 mt-1' : 'hidden'}
        style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}
      >
        <Paperclip size={12} style={{ flexShrink: 0, marginTop: 2 }} />
        Files travel as links, not attachments. They open in one tap and never bounce for size.
      </p>
    </div>
  );
}
