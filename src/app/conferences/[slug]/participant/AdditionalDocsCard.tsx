'use client';

// Additional Documents (owner, 22 Oct 2026): the conference documents the
// organisers uploaded for participants (Rules of Procedure, logistics, the
// schedule and the rest), drawn as the THIRD part of a delegate's Documents
// section, beside the position paper and the study guide. The list is the one
// ParticipantView already reads (my_conference_documents when Document Uploads
// is on, else the classic conference_documents read filtered by role), so
// nothing is read here. Documents the organisers want sent back stay in the
// full card below the section (ConferenceDocsExtra), where sending happens.
//
// Each row: a fine-line file-type icon with its type word beneath (PDF, Word,
// Image, Link), the title wrapping, never cut, the file name small beneath,
// and Open. A file opens through a signed URL made INSIDE the click (the tab
// opens first, openConferenceDoc); a link opens as it is.

import { ExternalLink, File, FileImage, FileText, FileType2, Link2, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { notifyErr } from '@/lib/appNotify';
import { formatDocSize, linkHost, openConferenceDoc, type ConferenceDoc } from '@/lib/conferenceDocuments';
import { SectionCard, OUTFIT } from './shared';
import { CardHeading, INK_SOFT } from './dashboardKit';

const INK = '#1C1410';

/** The fields both document reads share. */
export interface AdditionalDoc {
  id: string;
  title: string;
  description?: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type?: string | null;
  url: string | null;
}

type DocType = { Icon: LucideIcon; word: string; color: string };

/** The file's type from its mime type, else its file name; a link is a link. */
function docType(d: AdditionalDoc): DocType {
  if (d.url && !d.file_path) return { Icon: Link2, word: 'Link', color: INK_SOFT };
  const mime = (d.mime_type ?? '').toLowerCase();
  const name = (d.file_name ?? d.file_path ?? '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return { Icon: FileText, word: 'PDF', color: '#B42318' };
  if (mime.includes('word') || /\.docx?$/.test(name)) return { Icon: FileType2, word: 'Word', color: '#2B579A' };
  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(name)) return { Icon: FileImage, word: 'Image', color: '#1F6B45' };
  return { Icon: File, word: 'File', color: INK_SOFT };
}

export default function AdditionalDocsCard({ docs }: { docs: AdditionalDoc[] }) {
  const { session } = useAuth();

  // The tab opens inside the click, then gets the signed URL.
  function open(d: AdditionalDoc) {
    if (!session) { notifyErr('Your session has expired. Please sign in again.', 'additional-docs'); return; }
    void openConferenceDoc(getAuthedClient(session.access_token), d as unknown as ConferenceDoc).then(ok => {
      if (!ok) notifyErr("This file can't be opened right now", 'additional-docs');
    });
  }

  return (
    <SectionCard>
      <CardHeading title="Additional Documents" />
      <div className="flex flex-col gap-2">
        {docs.map(d => {
          const t = docType(d);
          const sub = d.file_path
            ? [d.file_name, formatDocSize(d.file_size_bytes)].filter(Boolean).join(' · ')
            : d.url ? linkHost(d.url) : '';
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => open(d)}
              aria-label={`Open ${d.title}`}
              className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--gv-main) 5%, transparent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
            >
              {/* The file's type: a fine-line icon in ink, its word beneath. */}
              <span className="flex flex-col items-center flex-shrink-0" style={{ width: 40, gap: 2 }}>
                <t.Icon size={24} strokeWidth={1.5} aria-hidden style={{ color: INK }} />
                <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: t.color, lineHeight: 1 }}>{t.word}</span>
              </span>
              <div className="flex-1 min-w-0">
                <p style={{ color: INK, fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere', margin: 0 }}>{d.title}</p>
                {sub && (
                  <p style={{ color: INK_SOFT, fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.45, margin: '3px 0 0', overflowWrap: 'anywhere' }}>{sub}</p>
                )}
              </div>
              <span
                aria-hidden
                className="inline-flex items-center justify-center gap-1.5 flex-shrink-0"
                style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, background: 'var(--gv-main)', color: 'var(--gv-on-main)', fontFamily: OUTFIT, fontSize: 14, fontWeight: 600 }}
              >
                <ExternalLink size={15} strokeWidth={1.5} />
                Open
              </span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
