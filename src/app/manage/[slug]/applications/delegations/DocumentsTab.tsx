'use client';

// The delegation pop-up's Documents tab: read only. Reviewing happens on the
// Documents page.
//
// Owner, 22 Oct 2026: no raw file names as the main thing. Every document the
// delegation's members handed in is one row: its type icon (PDF, Word, image,
// fileType.tsx), the person (avatar and name), what it is (Position paper, or
// the conference document's title for a copy sent back), the committee and the
// country with its round flag, and where its review stands. A press opens the
// document as a second step of this pop-up (it replaces the content, Back
// returns; never a pop-up on a pop-up): a PDF in the shared PdfViewer, an image
// fitted, a Word file as its icon and name; Open in new tab and Download on every
// one. The file name is only small text there.
//
// Reads (RLS, organisers of the conference):
//   position_papers   "Chairs read committee position papers" (organisers read
//                     every paper); private bucket `position-papers`, signed
//                     links (src/lib/positionPapers.ts)
//   document_returns  "Organizers read returned copies"; private bucket
//                     `document-returns`; titles from conference_documents
// A new tab is opened INSIDE the click, before any await, then pointed at the
// signed link (CLAUDE.md §4, the Documents page).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Download, ExternalLink } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import PdfViewer, { type PdfZoom } from '@/components/documents/PdfViewer';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr } from '@/lib/appNotify';
import { downloadPositionPaper, signedPositionPaperUrlOrNull } from '@/lib/positionPapers';
import { DOCUMENT_RETURNS_BUCKET, downloadStoredFile, formatDocSize } from '@/lib/conferenceDocuments';
import { memberName, type DelegationMemberLite } from '../delegationRows';
import type { DelegationsData, DelegationView } from './useDelegationsData';
import type { PopupStep } from './DelegationPopup';
import { FileTypeIcon, fileKindOf, fileKindWord, type FileKind } from './fileType';
import {
  BTN_CLASS, CommitteeTag, FONT, INK, INK_SOFT, OK_GREEN, OWE, PopupSection, ROW_LINE, RoundAvatar, STROKE, SkeletonRows,
  linkStyle, smallPrimaryBtn, smallSecondaryBtn,
} from './kit';

const PREVIEW_SECONDS = 10 * 60;

/** One document a member handed in, whatever table it came from. */
interface DocItem {
  key: string;
  source: 'paper' | 'return';
  /** What it is: "Position paper", or the conference document's title. */
  what: string;
  fileName: string | null;
  mime: string | null;
  size: number | null;
  /** position_papers.file_url, or the document-returns storage path. */
  ref: string | null;
  status: string;
  submittedAt: string | null;
  member: DelegationMemberLite | null;
  committee: { name: string; abbreviation: string | null; logo_url: string | null } | null;
  countryCode: string | null;
  countryName: string | null;
}

interface PaperRow {
  id: string; user_id: string; conference_committee_id: string; country_code: string | null;
  file_url: string | null; file_name: string | null; file_size_bytes: number | null; status: string; submitted_at: string | null;
}
interface ReturnRow {
  id: string; document_id: string; application_id: string; file_path: string | null; file_name: string | null;
  mime_type: string | null; file_size_bytes: number | null; status: string; submitted_at: string | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Waiting for review', color: OWE },
  approved: { label: 'Approved', color: OK_GREEN },
  accepted: { label: 'Accepted', color: OK_GREEN },
  rejected: { label: 'Sent back', color: OWE },
  sent_back: { label: 'Sent back', color: OWE },
};

function statusOf(s: string) {
  return STATUS[s] ?? { label: s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()), color: INK_SOFT };
}

/** A short signed link for this document, or null when it cannot be signed. */
async function signDoc(doc: DocItem, seconds: number): Promise<string | null> {
  if (!doc.ref) return null;
  const c = await getFreshAuthedClient();
  if (!c) return null;
  if (doc.source === 'paper') return signedPositionPaperUrlOrNull(c, doc.ref, seconds);
  try {
    const { data, error } = await c.storage.from(DOCUMENT_RETURNS_BUCKET).createSignedUrl(doc.ref, seconds);
    return error ? null : data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export default function DocumentsTab<M extends DelegationMemberLite>({ conferenceId, slug, row, data, onStep }: {
  conferenceId: string;
  slug: string;
  row: DelegationView<M>;
  data: DelegationsData<M>;
  onStep: (step: PopupStep | null) => void;
}) {
  const userIds = useMemo(() => row.members.map(m => m.user_id).filter((u): u is string => !!u), [row.members]);
  const appIds = useMemo(() => row.members.map(m => m.id), [row.members]);
  const userKey = userIds.join(',');
  const appKey = appIds.join(',');
  const [read, setRead] = useState<{ papers: PaperRow[]; returns: ReturnRow[]; titles: Map<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const uids = userKey ? userKey.split(',') : [];
      const aids = appKey ? appKey.split(',') : [];
      const c = await getFreshAuthedClient();
      if (!c || cancelled) return;
      const [pRes, rRes] = await Promise.all([
        uids.length === 0
          ? Promise.resolve({ data: [] as PaperRow[], error: null })
          : c.from('position_papers')
            .select('id, user_id, conference_committee_id, country_code, file_url, file_name, file_size_bytes, status, submitted_at')
            .eq('conference_id', conferenceId)
            .in('user_id', uids)
            .order('submitted_at', { ascending: false }),
        aids.length === 0
          ? Promise.resolve({ data: [] as ReturnRow[], error: null })
          : c.from('document_returns')
            .select('id, document_id, application_id, file_path, file_name, mime_type, file_size_bytes, status, submitted_at')
            .eq('conference_id', conferenceId)
            .in('application_id', aids)
            .order('submitted_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (pRes.error) { friendlyError(pRes.error, 'The papers could not be read.'); setFailed(true); return; }
      // Copies sent back failing to read must not hide the papers.
      const returns = rRes.error ? [] : ((rRes.data ?? []) as ReturnRow[]);
      if (rRes.error) friendlyError(rRes.error, 'The documents sent back could not be read.');
      const titles = new Map<string, string>();
      const docIds = Array.from(new Set(returns.map(r => r.document_id)));
      if (docIds.length > 0) {
        const { data: docs } = await c.from('conference_documents').select('id, title').in('id', docIds);
        for (const d of (docs ?? []) as { id: string; title: string | null }[]) if (d.title) titles.set(d.id, d.title);
      }
      if (cancelled) return;
      setFailed(false);
      setRead({ papers: (pRes.data ?? []) as PaperRow[], returns, titles });
    })();
    return () => { cancelled = true; };
  }, [conferenceId, userKey, appKey]);

  const items = useMemo<DocItem[] | null>(() => {
    if (!read) return null;
    const byUser = new Map(row.members.filter(m => m.user_id).map(m => [m.user_id as string, m] as const));
    const byApp = new Map(row.members.map(m => [m.id, m] as const));
    const committeeById = new Map((data.committees ?? []).map(c => [c.id, c] as const));
    const out: DocItem[] = [];
    for (const p of read.papers) {
      const com = committeeById.get(p.conference_committee_id) ?? null;
      const countryName = com?.committee_country_slots.find(s => s.country_code === p.country_code)?.country_name ?? p.country_code ?? null;
      out.push({
        key: `p:${p.id}`, source: 'paper', what: 'Position paper', fileName: p.file_name, mime: null, size: p.file_size_bytes,
        ref: p.file_url, status: p.status, submittedAt: p.submitted_at, member: byUser.get(p.user_id) ?? null,
        committee: com ? { name: com.name, abbreviation: com.abbreviation, logo_url: com.logo_url } : null,
        countryCode: p.country_code, countryName,
      });
    }
    for (const r of read.returns) {
      const m = byApp.get(r.application_id) ?? null;
      const com = m?.assigned_committee_id ? committeeById.get(m.assigned_committee_id) ?? null : null;
      out.push({
        key: `r:${r.id}`, source: 'return', what: read.titles.get(r.document_id) ?? 'Document', fileName: r.file_name, mime: r.mime_type,
        size: r.file_size_bytes, ref: r.file_path, status: r.status, submittedAt: r.submitted_at, member: m,
        committee: com
          ? { name: com.name, abbreviation: com.abbreviation, logo_url: com.logo_url }
          : m?.assigned_committee ? { name: m.assigned_committee.name, abbreviation: m.assigned_committee.abbreviation, logo_url: null } : null,
        countryCode: m?.assigned_country_code ?? null, countryName: m?.assigned_country_name ?? null,
      });
    }
    return out.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  }, [read, row.members, data.committees]);

  function openDoc(doc: DocItem) {
    const who = doc.member ? memberName(doc.member) : 'A member';
    onStep({ title: `${doc.what}, ${who}`, body: <DocumentPreview doc={doc} /> });
  }

  const reviewLink = <Link href={`/manage/${slug}/documents`} style={{ ...linkStyle, fontSize: 14 }}>Review on the Documents page</Link>;
  if (failed) {
    return (
      <div style={{ padding: '18px 24px 24px' }}>
        <PopupSection title="Documents"><p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>The documents could not be read just now. Close this and open it again.</p></PopupSection>
      </div>
    );
  }
  if (!items) return <div style={{ padding: '18px 24px 24px' }}><SkeletonRows rows={4} height={64} /></div>;

  return (
    <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '18px 24px 24px' }}>
      <PopupSection title="Documents" padded={false} aside={reviewLink}>
        {items.length === 0 ? (
          <p style={{ padding: '10px 20px 12px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No documents from this delegation yet.</p>
        ) : (
          <div className="flex flex-col">
            {items.map((d, i) => {
              const kind = fileKindOf(d.mime, d.fileName);
              const st = statusOf(d.status);
              const who = d.member ? memberName(d.member) : 'A member';
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => openDoc(d)}
                  aria-label={`Open ${d.what} from ${who}`}
                  className={`${BTN_CLASS} dlgDocRow flex items-center text-left w-full`}
                  style={{ gap: 14, padding: '12px 20px', border: 'none', borderTop: i === 0 ? 'none' : `1px solid ${ROW_LINE}`, background: 'transparent', cursor: 'pointer', fontFamily: FONT }}
                >
                  <FileTypeIcon kind={kind} name={d.fileName} size={32} />
                  <span className="flex items-center gap-2.5 min-w-0" style={{ flex: '1 1 0' }}>
                    {d.member && <RoundAvatar name={who} url={d.member.profiles?.avatar_url ?? null} size={34} seed={d.member.id} />}
                    <span className="flex flex-col min-w-0" style={{ gap: 2 }}>
                      <span className="[overflow-wrap:anywhere]" style={{ fontSize: 14.5, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{who}</span>
                      <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.3 }}>{d.what}</span>
                    </span>
                  </span>
                  <span className="hidden sm:flex items-center gap-2 flex-wrap min-w-0" style={{ flex: '1 1 0', fontSize: 13.5 }}>
                    {d.countryCode && <CircleFlag code={d.countryCode} country={d.countryName ?? undefined} size={20} decorative />}
                    {d.countryName && <span className="[overflow-wrap:anywhere]" style={{ color: INK }}>{d.countryName}</span>}
                    {d.committee && <CommitteeTag name={d.committee.name} abbreviation={d.committee.abbreviation} logoUrl={d.committee.logo_url} size={18} fontSize={13} />}
                    {!d.countryName && !d.committee && <span style={{ color: INK_SOFT }}>No allocation</span>}
                  </span>
                  <span className="text-right" style={{ fontSize: 13.5, fontWeight: 500, color: st.color, minWidth: 110 }}>{st.label}</span>
                  <ChevronRight size={18} strokeWidth={STROKE} aria-hidden style={{ color: INK_SOFT, flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        )}
      </PopupSection>
      <style>{`@media (hover: hover) { .dlgDocRow:hover { background: #FBF9F4 !important; } }`}</style>
    </div>
  );
}

/** The second step: the document itself, with Open in new tab and Download. */
function DocumentPreview({ doc }: { doc: DocItem }) {
  const kind: FileKind = fileKindOf(doc.mime, doc.fileName);
  const [signed, setSigned] = useState<{ key: string; url: string | null } | null>(null);
  const [zoom, setZoom] = useState<PdfZoom>('fit');
  const [imgFailed, setImgFailed] = useState(false);
  const who = doc.member ? memberName(doc.member) : 'A member';
  const st = statusOf(doc.status);

  // A short signed link for showing it here (a Word file is not drawn, so not signed).
  useEffect(() => {
    if (kind !== 'pdf' && kind !== 'image') return;
    let alive = true;
    void signDoc(doc, PREVIEW_SECONDS).then(url => { if (alive) setSigned({ key: doc.key, url }); });
    return () => { alive = false; };
  }, [doc, kind]);

  // The tab is opened inside the click, before any await, then pointed at the link.
  function openNew() {
    const tab = window.open('about:blank', '_blank');
    void signDoc(doc, PREVIEW_SECONDS).then(url => {
      if (!url) { tab?.close(); notifyErr("The file couldn't be opened. Try again in a moment.", 'applications'); return; }
      if (tab) {
        try { tab.opener = null; } catch { /* harmless */ }
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    });
  }

  async function download() {
    const c = await getFreshAuthedClient();
    let ok = false;
    if (c && doc.ref) {
      ok = doc.source === 'paper'
        ? await downloadPositionPaper(c, doc.ref, doc.fileName)
        : await downloadStoredFile(c, DOCUMENT_RETURNS_BUCKET, doc.ref, doc.fileName, 300);
    }
    if (!ok) notifyErr("The file couldn't be downloaded. Try again in a moment.", 'applications');
  }

  const current = signed && signed.key === doc.key ? signed : null;
  const drawable = (kind === 'pdf' || kind === 'image') && !(kind === 'image' && imgFailed);
  const sizeWords = [fileKindWord(kind, doc.fileName), formatDocSize(doc.size)].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col" style={{ gap: 14, fontFamily: FONT }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: '12px 20px' }}>
        <div className="flex items-center gap-3 min-w-0">
          <FileTypeIcon kind={kind} name={doc.fileName} size={36} />
          {doc.member && <RoundAvatar name={who} url={doc.member.profiles?.avatar_url ?? null} size={36} seed={doc.member.id} />}
          <span className="flex flex-col min-w-0" style={{ gap: 3 }}>
            <span className="[overflow-wrap:anywhere]" style={{ fontSize: 15, fontWeight: 600, color: INK }}>{who}</span>
            <span className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13, color: INK_SOFT }}>
              {doc.countryCode && <CircleFlag code={doc.countryCode} country={doc.countryName ?? undefined} size={16} decorative />}
              {doc.countryName && <span className="[overflow-wrap:anywhere]" style={{ color: INK }}>{doc.countryName}</span>}
              {doc.committee && <CommitteeTag name={doc.committee.name} abbreviation={doc.committee.abbreviation} logoUrl={doc.committee.logo_url} size={16} fontSize={12.5} />}
              <span style={{ color: st.color, fontWeight: 500 }}>{st.label}</span>
            </span>
          </span>
        </div>
        <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
          <button type="button" onClick={openNew} disabled={!doc.ref} className={BTN_CLASS} style={smallSecondaryBtn}>
            <ExternalLink size={15} strokeWidth={STROKE} aria-hidden /> Open in new tab
          </button>
          <button type="button" onClick={() => { void download(); }} disabled={!doc.ref} className={BTN_CLASS} style={{ ...smallPrimaryBtn, height: 36 }}>
            <Download size={15} strokeWidth={STROKE} aria-hidden /> Download
          </button>
        </div>
      </div>

      <div className="relative flex flex-col" style={{ height: 'clamp(320px, calc(100dvh - 400px), 560px)', borderRadius: 12, overflow: 'hidden', background: '#F6F3EC' }}>
        {!doc.ref ? (
          <Fallback text="This file is not available." />
        ) : !drawable ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ gap: 10, padding: 24 }}>
            <FileTypeIcon kind={kind} name={doc.fileName} size={64} />
            <p style={{ margin: 0, fontSize: 14, color: INK_SOFT }}>{kind === 'image' ? "This image couldn't be shown here." : `A ${fileKindWord(kind, doc.fileName)} file can't be shown here. Download it or open it in a new tab.`}</p>
          </div>
        ) : !current ? (
          <div className="flex-1 animate-pulse" aria-busy="true" style={{ margin: 16, borderRadius: 10, background: '#EDE7D8' }} />
        ) : !current.url ? (
          <Fallback text="This file couldn't be shown here. Try Open in new tab or Download." />
        ) : kind === 'image' ? (
          <div className="flex-1 min-h-0 flex items-center justify-center" style={{ padding: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={`${doc.what} from ${who}`} onError={() => setImgFailed(true)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <PdfViewer url={current.url} title={doc.what} fileName={doc.fileName ?? undefined} zoom={zoom} onZoomChange={setZoom} compact className="relative flex-1 min-h-0" />
        )}
      </div>

      {doc.fileName && (
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: INK_SOFT }}>{doc.fileName}{sizeWords ? ` (${sizeWords})` : ''}</span>
      )}
    </div>
  );
}

function Fallback({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center" style={{ padding: 24 }}>
      <p style={{ margin: 0, fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>{text}</p>
    </div>
  );
}
