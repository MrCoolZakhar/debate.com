'use client';

import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import Portal from '@/components/Portal';
import GrowDialog from '@/components/GrowDialog';
import { portalFrame } from '@/components/chat/chatTokens';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  Ban, BadgeCheck, Check, CircleDot, FileText, Minus, Plus, Presentation, Timer, Vote, X, type LucideIcon,
} from 'lucide-react';
import PdfViewer, { PdfThumb, PDF_ZOOM_STEPS, stepPdfZoom, type PdfZoom } from '@/components/documents/PdfViewer';
import StageTimerDevice from '@/components/documents/StageTimerDevice';
import StageSwitcher from '@/components/documents/StageSwitcher';
import ProceedingsSetup from '@/components/documents/ProceedingsSetup';
import { Committee, CommitteeDocument, DocIntroState, DocumentType, DocumentStatus } from '@/lib/types';
import { requireDocApproval as readRequireDocApproval, updateDocumentFlow, deleteDocumentChecked } from '@/lib/documentFlow';
import { sponsorLabel } from '@/lib/committeeFlags';
import { docName, docCount, docLimit, docLimitReached } from '@/lib/docNames';
import { TranslationKey } from '@/lib/translations';
import { getCountryDisplayName, matchesCountryQuery, startsWithCountryQuery } from '@/lib/countries';
import { SeatFlag } from '@/components/SeatFlag';
import { supabase } from '@/lib/supabase';
import { safeStorageKey } from '@/lib/storageKey';
import { UnknownSeatIcon } from '@/components/UnknownSeatIcon';
import {
  addDocument as addDocumentInDB,
  updateDocumentApproval as updateDocumentApprovalInDB,
} from '@/lib/committeeService';

type DocTab = 'working-paper' | 'draft-resolution';
// Flow stages for the fullscreen presentation experience
type PresentationStage = 'setup' | 'reading' | 'presentation' | 'qa' | null;
type TimedStage = DocIntroState['stage'];
const STAGE_ORDER: TimedStage[] = ['reading', 'presentation', 'qa'];

/** One pill vocabulary for a paper's lifecycle and its approval. Same shape for every state
 *  (icon + label, tinted fill, hairline ring drawn as an inset shadow, never a border); the
 *  colour moves from neutral ink to forest to gold as the paper advances, and only the two
 *  verdicts are strong. Every text colour is AA (>= 4.5:1) on its own fill over the card. */
type PillTone = { bg: string; fg: string; ring: string; Icon: LucideIcon };
const STATUS_PILL: Record<DocumentStatus, PillTone> = {
  submitted:  { bg: 'rgba(28,20,16,0.06)',   fg: '#4A3F35', ring: 'rgba(28,20,16,0.10)',   Icon: FileText },
  'on-floor': { bg: 'rgba(27,56,40,0.08)',   fg: '#1B3828', ring: 'rgba(27,56,40,0.18)',   Icon: CircleDot },
  introduced: { bg: 'rgba(238,217,138,0.60)', fg: '#5C4410', ring: 'rgba(160,120,30,0.30)', Icon: Presentation },
  passed:     { bg: '#1B3828',               fg: '#EED98A', ring: 'rgba(27,56,40,0.00)',   Icon: Check },
  failed:     { bg: 'rgba(139,32,32,0.10)',  fg: '#7A1C1C', ring: 'rgba(139,32,32,0.22)',  Icon: X },
};
const APPROVAL_PILL: Record<'approved' | 'rejected', PillTone> = {
  approved: { bg: 'transparent', fg: '#1B3828', ring: 'rgba(27,56,40,0.30)',  Icon: BadgeCheck },
  rejected: { bg: 'transparent', fg: '#7A1C1C', ring: 'rgba(139,32,32,0.30)', Icon: Ban },
};

function Pill({ tone, label }: { tone: PillTone; label: string }) {
  const { Icon } = tone;
  return (
    <span
      className="inline-flex items-center gap-1 h-[22px] ps-1.5 pe-2 rounded-full text-[11.5px] font-semibold leading-none whitespace-nowrap select-none"
      style={{ backgroundColor: tone.bg, color: tone.fg, boxShadow: `inset 0 0 0 1px ${tone.ring}`, fontFamily: "'Outfit', sans-serif" }}
    >
      <Icon size={12} strokeWidth={2.4} aria-hidden className="shrink-0" />
      {label}
    </span>
  );
}

const STATUS_NEXT: Partial<Record<DocumentStatus, DocumentStatus>> = {
  submitted: 'introduced', 'on-floor': 'introduced',
};

function getStatusLabel(status: DocumentStatus, t: (key: TranslationKey) => string): string {
  const map: Record<DocumentStatus, string> = {
    submitted:   t('documents_status_submitted'),
    'on-floor':  t('documents_status_on_floor'),
    introduced:  t('documents_status_introduced'),
    passed:      t('documents_status_passed'),
    failed:      t('documents_status_failed'),
  };
  return map[status] ?? status;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const t = useT();
  return <Pill tone={STATUS_PILL[status] ?? STATUS_PILL.submitted} label={getStatusLabel(status, t)} />;
}

function CountryChip({ country, onRemove }: { country: string; onRemove: () => void }) {
  const { language } = useLanguage();
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DDD4C0] border border-[#DDD4C0] rounded-full text-xs text-[#1C1410]">
      <SeatFlag country={country} size={16} className="object-contain inline-block me-1" fallback={<UnknownSeatIcon size={16} className="me-1" />} />{getCountryDisplayName(country, language)}
      <button onClick={onRemove} className="text-[#9A8A78] hover:text-red-500 ms-0.5 leading-none">✕</button>
    </span>
  );
}

const SPONSOR_LIST_MAX_H = 144;

function SponsorSelect({ candidates, selected, onChange, committee }: {
  candidates: string[]; selected: string[]; onChange: (v: string[]) => void; committee: Committee;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flipped: boolean } | null>(null);
  const available = !query.trim()
    ? candidates.filter((c) => !selected.includes(c))
    : candidates
        .filter((c) => !selected.includes(c) && startsWithCountryQuery(c, query.trim(), language))
        .concat(candidates.filter((c) => !selected.includes(c) && !startsWithCountryQuery(c, query.trim(), language) && matchesCountryQuery(c, query.trim(), language)));
  const add = (country: string) => { onChange([...selected, country]); setQuery(''); setOpen(false); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); if (query.trim() && available.length > 0) add(available[0]); }
    if (e.key === 'Escape') { setOpen(false); }
  };

  // The modal body is `overflow-y-auto` inside a card with `overflow-hidden`, so an in-flow
  // absolute dropdown gets clipped. Render it through a Portal at fixed coordinates measured
  // from the field, repositioned on scroll (capture) + resize, flipped upward and clamped near
  // the edges. Coordinates run through portalFrame() because Portal mounts into the
  // transformed `#fit-root`, whose local units are not viewport pixels.
  const listOpen = open && !!query && available.length > 0;
  const place = useCallback(() => {
    const w = wrapRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    const f = portalFrame();
    const M = 8;
    const left0 = f.toLocalX(r.left);
    const top0 = f.toLocalY(r.top);
    const bottom0 = f.toLocalY(r.bottom);
    const width = Math.min(f.toLocalX(r.right) - left0, Math.max(0, f.maxX - f.minX - 2 * M));
    const maxLeft = Math.max(f.minX + M, f.maxX - width - M);
    const left = Math.min(Math.max(f.minX + M, left0), maxLeft);
    const spaceBelow = f.maxY - bottom0;
    const flipped = spaceBelow < SPONSOR_LIST_MAX_H + 16 && top0 - f.minY > spaceBelow;
    setPos({ top: flipped ? top0 - 4 : bottom0 + 4, left, width, flipped });
  }, []);

  useEffect(() => {
    if (!listOpen) return;
    place();
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // Outside click closes, but clicks inside the portaled list must not count.
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('mousedown', onDown);
    };
  }, [listOpen, place]);

  return (
    <div>
      <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{sponsorLabel(committee, t('documents_sponsors_label'))}</label>
      <div className="relative" ref={wrapRef}>
        <input type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('documents_sponsor_placeholder')}
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] placeholder-[#9A8A78] text-sm focus:outline-none focus:border-[#1B3828] transition-colors" />
        {listOpen && pos && (
          <Portal>
            <div
              ref={listRef}
              className="fixed bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-[65] overflow-y-auto shadow-lg"
              style={{
                top: pos.top, left: pos.left, width: pos.width, maxHeight: SPONSOR_LIST_MAX_H,
                transform: pos.flipped ? 'translateY(-100%)' : undefined,
                boxShadow: '0 12px 32px rgba(28,20,16,0.22), 0 2px 6px rgba(28,20,16,0.10)',
              }}
            >
              {available.slice(0, 6).map((c, i) => {
                return (
                  <button key={c} onMouseDown={(e) => { e.preventDefault(); add(c); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-start transition-colors ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                    <SeatFlag country={c} size={20} className="object-contain inline-block" fallback={<UnknownSeatIcon size={20} />} />
                    <span className="text-sm">{getCountryDisplayName(c, language)}</span>
                  </button>
                );
              })}
            </div>
          </Portal>
        )}
      </div>
      {/* Selected sponsors, flags only, below input */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map((c) => {
            return (
              <button key={c} onClick={() => onChange(selected.filter((s) => s !== c))}
                title={`Remove ${c}`}
                className="relative group focus:outline-none">
                <SeatFlag
                  country={c}
                  className="rounded"
                  style={{ width: 40, height: 28, objectFit: 'cover', border: '1.5px solid rgba(28,20,16,0.15)' }}
                  fallback={<UnknownSeatIcon size={28} />}
                />
                <span className="absolute inset-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-white"
                  style={{ backgroundColor: 'rgba(139,32,32,0.7)' }}>✕</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// PREVIEW only. The saved code is assigned by the documents_assign_doc_code trigger under a
// per-committee lock (V-6), so two simultaneous submissions can never share a code.
function autoDocCode(type: DocumentType, existingDocs: CommitteeDocument[]): string {
  const prefix = type === 'working-paper' ? 'WP' : 'DR';
  const sep = type === 'working-paper' ? '.' : '/';
  return `${prefix} 1${sep}${existingDocs.filter((d) => d.type === type).length + 1}`;
}


// ── The introduction screen ───────────────────────────────────────────────────
// Document-first (16 Sep 2026). The paper fills the screen and is mounted ONCE for the whole
// introduction; the stage clock and its controls are a floating panel the chair drags and
// resizes over it. Moving between Reading, Presentation and Q&A now only re-labels that panel,
// so the viewer keeps its zoom AND its scroll position: before, the viewer lived inside a
// component keyed on the stage (remount, so a PDF reloaded to page 1) and the split ratio was
// stage-local state that snapped back to 50% on every change.

/** Zoom is the chair's, not the stage's: it lives above the stage and is remembered per device.
 *  'fit' (fit width) is the default for a PDF; a text paper reads 'fit' as 100%. */
const ZOOM_KEY = 'gavelling-intro-zoom';
function readZoom(): PdfZoom {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    if (!raw || raw === 'fit') return 'fit';
    const n = Number(raw);
    return (PDF_ZOOM_STEPS as readonly number[]).includes(n) ? n : 'fit';
  } catch { return 'fit'; }
}
function writeZoom(z: PdfZoom) {
  try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* storage blocked */ }
}

/** The paper, filling the introduction screen. Mounted once per introduction: nothing here is
 *  keyed on the stage, so a stage change never touches the viewer or its scroll position. A PDF
 *  is drawn by pdf.js (`PdfViewer`, its own toolbar); a text paper is a page card. */
function IntroDocument({ doc, zoom, onZoomChange }: { doc: CommitteeDocument; zoom: PdfZoom; onZoomChange: (z: PdfZoom) => void }) {
  const t = useT();
  const z = zoom === 'fit' ? 1 : zoom;
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#E4DCCA]">
      {doc.fileUrl ? (
        <PdfViewer url={doc.fileUrl} title={doc.title} fileName={doc.fileName} zoom={zoom} onZoomChange={onZoomChange} className="absolute inset-0" />
      ) : doc.content ? (
        <div className="absolute inset-0 overflow-auto px-6 py-8">
          <div className="mx-auto bg-[#FFFDF8] rounded-[3px] px-8 py-8"
            style={{ maxWidth: 820 * z, boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(27,56,40,0.10), 0 10px 28px rgba(27,56,40,0.14)' }}>
            <p className="text-xs font-bold mb-3 tabular-nums" style={{ color: '#1B3828', fontSize: 12 * z }}>{doc.docCode}</p>
            <h2 className="font-black mb-5" style={{ color: '#1C1410', fontSize: 20 * z, textWrap: 'balance' }}>{doc.title}</h2>
            <pre className="whitespace-pre-wrap font-sans leading-relaxed" style={{ color: '#1C1410', fontSize: 15 * z, textWrap: 'pretty' }}>{doc.content}</pre>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <p className="max-w-sm text-center text-sm" style={{ color: '#6A5A4A', textWrap: 'pretty' }}>{t('documents_no_content')}</p>
        </div>
      )}
    </div>
  );
}

// ── Submit Form ───────────────────────────────────────────────────────────────
function SubmitForm({ committee, type, onDone, onDocumentAdded }: {
  committee: Committee; type: DocumentType; onDone: () => void;
  onDocumentAdded: (doc: CommitteeDocument) => void;
}) {
  const t = useT();
  // Limits come from the committee row (dbSettings), not the localStorage settings
  // store — see docLimitReached. Same helper backs the delegate submit path, which
  // previously enforced nothing at all.
  const existingCount = docCount(committee, type);
  const limit = docLimit(committee, type);
  const limitReached = docLimitReached(committee, type);

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const [title, setTitle] = useState('');
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  /* See the delegate page: a failed attachment was console-only and looked
     like nothing had happened at all. */
  const [uploadError, setUploadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docCode = autoDocCode(type, committee.documents ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isDuplicate = (committee.documents ?? []).some(
    (d) => d.title.trim().toLowerCase() === title.trim().toLowerCase()
  );

  const canSubmit = !limitReached && !isSubmitting && !isUploading && !isDuplicate && !!title.trim();

  const uploadFile = async (file: File) => {
    setFileName(file.name);
    setIsUploading(true);
    try {
      const path = safeStorageKey(committee.id, String(Date.now()), file.name);
      // NO upsert — see the matching note on the delegate page. The bucket grants
      // anon INSERT but not UPDATE, so `upsert: true` was refused with a 403 that
      // never surfaced. Date.now() in the path makes upsert pointless anyway.
      const { error } = await supabase.storage.from('session-documents').upload(path, file);
      if (error) {
        console.error('Storage upload error:', error);
        setFileName(null);
        setUploadError(true);
        return;
      }
      setUploadError(false);
      const { data } = supabase.storage.from('session-documents').getPublicUrl(path);
      setFileUrl(data.publicUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadFile(f);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    await uploadFile(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const newDoc: Omit<CommitteeDocument, 'id' | 'submittedAt'> = {
        type, docCode, title: title.trim(), sponsors, content: content.trim(), status: 'submitted',
        ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
      };
      const saved = await addDocumentInDB(committee.id, newDoc, committee.code, committee.dbChairJoinSuffix ?? undefined);
      // V-6: a failed insert used to close the form as if it had worked. Keep what the chair
      // typed and say it was not saved.
      if (!saved) { setSubmitFailed(true); return; }
      setSubmitFailed(false);
      onDocumentAdded(saved);
      onDone();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 px-7 pb-7">
      <div className="flex flex-col items-center gap-1 relative">
        <button onClick={onDone} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm transition-colors focus:outline-none" style={{ color: '#9A8A78' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}>{t('documents_back')}</button>
        <h2 className="text-xl font-black text-center uppercase tracking-wide" style={{ color: '#1B3828' }}>
          {t('documents_submit_doc_heading', {
            doc: docName(committee, type, 'singular',
              type === 'working-paper' ? t('documents_working_paper_type') : t('documents_draft_resolution_type')).toUpperCase(),
          })}
        </h2>
      </div>
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl px-4 py-2.5">
        <span className="text-xs text-[#9A8A78] font-mono">{t('documents_doc_code_label')}</span>
        <span className="ms-3 text-sm font-bold text-[#1C1410] font-mono">{docCode}</span>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{t('documents_title_label')} <span className="text-red-500">*</span></label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'working-paper' ? t('documents_title_placeholder_wp') : t('documents_title_placeholder_dr')}
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
      </div>
      <SponsorSelect candidates={presentCountries} selected={sponsors} onChange={setSponsors} committee={committee} />
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{t('documents_google_docs_label')} <span className="text-[#9A8A78] font-normal">({t('documents_google_docs_optional')})</span></label>
        <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="https://docs.google.com/..."
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors text-sm" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">
          {t('documents_attachment_label')} <span className="text-[#9A8A78] font-normal">(optional)</span>
        </label>
        {fileName ? (
          <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3">
            <span className="text-sm text-[#1C1410] flex-1 truncate flex items-center gap-2">
              {isUploading
                ? <><div className="w-3.5 h-3.5 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin shrink-0" /> Uploading…</>
                : <>📎 {fileName}</>
              }
            </span>
            <button onClick={() => { setFileName(null); setFileUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm">✕</button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`w-full border border-dashed rounded-xl px-4 py-5 text-sm transition-colors text-center cursor-pointer select-none ${
              isDragging
                ? 'border-[#1B3828] bg-[#1B3828]/10 text-[#1B3828]'
                : 'bg-[#FAF8F3] border-[#DDD4C0] hover:border-[#1B3828] text-[#9A8A78] hover:text-[#6A5A4A]'
            }`}
          >
            <span className="block text-xl mb-1">📎</span>
            {isDragging ? 'Drop PDF here' : 'Click to upload or drag & drop a PDF'}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
        {uploadError && (
          <p className="text-xs mt-1.5" style={{ color: '#8B2020' }}>
            {t('delegate_doc_upload_failed')}
          </p>
        )}
      </div>
      {limitReached && (
        <p className="text-xs text-red-400 text-center">
          {t('documents_limit_exceeded').replace('{current}', String(existingCount)).replace('{limit}', String(limit)).replace('{type}', docName(committee, type, 'plural', type === 'working-paper' ? t('documents_type_wp') : t('documents_type_dr')))}
        </p>
      )}
      {submitFailed && (
        <p role="alert" className="text-xs text-center" style={{ color: '#8B2020' }}>{t('documents_submit_failed')}</p>
      )}
      {isSubmitting ? (
        <button disabled className="w-full bg-[#9A8A78] text-white py-3.5 rounded-xl font-bold cursor-not-allowed gv-lift">
          Uploading…
        </button>
      ) : (
        <button onClick={handleSubmit} disabled={!canSubmit}
          className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-3.5 rounded-xl font-bold transition-colors gv-lift">
          {limitReached
            ? t('documents_limit_reached').replace('{current}', String(existingCount)).replace('{limit}', String(limit))
            : isDuplicate
              ? 'A document with this title already exists'
              : t('documents_submit_document')}
        </button>
      )}
    </div>
  );
}

// ── Doc Card ──────────────────────────────────────────────────────────────────
function DocCard({ doc, committee, onRemove, onStartPresentation, requireApproval, onApprovalChange, isViewOnly }: {
  doc: CommitteeDocument; committee: Committee;
  onRemove: (docId: string) => void;
  onStartPresentation: (doc: CommitteeDocument) => void;
  requireApproval: boolean;
  onApprovalChange: (docId: string, approval: 'approved' | 'rejected') => void;
  /** D-10: a Commenter sees the card but gets no approve / reject / introduce / delete.
   *  UI gate only (RULE 15), like every other isViewOnly. */
  isViewOnly: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfZoom, setPdfZoom] = useState<PdfZoom>('fit');
  const nextStatus = STATUS_NEXT[doc.status];
  // Approval gate: while the setting is on and this doc isn't approved yet, offer Approve/Reject
  // (also lets a chair reverse a rejection) and hold back Introduce until approved. Once the doc has
  // been introduced/passed/failed the gate is moot.
  // An introduced working paper can be re-introduced (below), so the gate applies to it too,
  // and Approve/Reject stays offered there: otherwise a paper introduced before the setting was
  // switched on, or rejected from another device, would have no way forward.
  const canDecide = requireApproval && doc.approval !== 'approved'
    && (doc.status === 'submitted' || doc.status === 'on-floor' || (doc.status === 'introduced' && doc.type === 'working-paper'));
  const approvalBlocksIntroduce = requireApproval && doc.approval !== 'approved';

  return (
    <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl overflow-hidden">
      <div className="flex items-stretch">

        {/* Left strip, doc thumbnail with padding from border */}
        <div className="flex flex-col items-center justify-between shrink-0 p-2"
          style={{ backgroundColor: 'rgba(27,56,40,0.10)', width: '88px' }}>

          {/* Thumbnail, PDF preview or fallback emoji */}
          <div className="w-full rounded-lg overflow-hidden flex-1 flex items-center justify-center"
            style={{ maxHeight: '120px', minHeight: '80px' }}>
            {doc.fileUrl ? (
              <PdfThumb url={doc.fileUrl} width={72} height={110}
                fallback={<FileText size={34} strokeWidth={1.8} aria-hidden style={{ color: '#1B3828', opacity: 0.6 }} />} />
            ) : (
              <span style={{ fontSize: '5.5rem', lineHeight: 1, userSelect: 'none' }}>📋</span>
            )}
          </div>

          {/* Doc code below the thumbnail */}
          <span className="mt-1.5 text-center font-black"
            style={{ fontSize: '11px', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.03em' }}>
            {doc.docCode}
          </span>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 p-4 space-y-2.5">

          {/* Title row + delete */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-black text-[#1C1410] leading-snug">{doc.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={doc.status} />
                {doc.approval === 'approved' && <Pill tone={APPROVAL_PILL.approved} label={t('documents_status_approved')} />}
                {doc.approval === 'rejected' && <Pill tone={APPROVAL_PILL.rejected} label={t('documents_status_rejected')} />}
              </div>
            </div>
            {!isViewOnly && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)}
                className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm shrink-0 focus:outline-none mt-0.5"
                title={t('documents_delete_yes')}>✕</button>
            )}
          </div>

          {/* Delete asks first: it was a single click with no way back. */}
          {!isViewOnly && confirmDelete && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.3)' }}>
              <span className="text-sm font-semibold flex-1 min-w-0" style={{ color: '#8B2020' }}>{t('documents_delete_confirm')}</span>
              <button onClick={() => { setConfirmDelete(false); onRemove(doc.id); }}
                className="px-3 py-1 rounded-lg text-xs font-bold focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FAF8F3' }}>
                {t('documents_delete_yes')}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 rounded-lg text-xs font-bold border focus:outline-none" style={{ borderColor: '#DDD4C0', color: '#6A5A4A' }}>
                {t('documents_delete_no')}
              </button>
            </div>
          )}

          {/* Sponsors with flags */}
          {doc.sponsors.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[#6A5A4A] shrink-0">{sponsorLabel(committee, t('documents_sponsors_label_card'))}:</span>
              {doc.sponsors.map((s) => {
                return (
                  <span key={s} className="inline-flex items-center gap-1">
                    <SeatFlag
                      country={s}
                      className="rounded-sm"
                      style={{ width: 24, height: 16, objectFit: 'cover', border: '1px solid rgba(28,20,16,0.12)' }}
                      fallback={null}
                    />
                    <span className="text-xs text-[#6A5A4A]">{getCountryDisplayName(s, language)}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* PDF toggle */}
          {doc.fileUrl && doc.fileName && (
            <div className="text-xs space-y-2">
              <button onClick={() => setShowPdf((v) => !v)}
                className="transition-colors focus:outline-none" style={{ color: '#1B3828' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}>
                📎 {doc.fileName} {showPdf ? '▲' : '▼'}
              </button>
              {showPdf && (
                <PdfViewer url={doc.fileUrl} title={doc.fileName} fileName={doc.fileName}
                  zoom={pdfZoom} onZoomChange={setPdfZoom} compact
                  className="relative w-full h-[480px] rounded-xl overflow-hidden" />
              )}
            </div>
          )}

          {/* Content toggle */}
          {doc.content && (
            <div>
              <button onClick={() => setExpanded((v) => !v)}
                className="text-xs text-[#1B3828] hover:text-[#6A5A4A] transition-colors">
                {expanded ? '▲ Hide content' : '▼ Show content'}
              </button>
              {expanded && (
                <pre className="mt-2 text-xs text-[#1C1410] bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                  {doc.content}
                </pre>
              )}
            </div>
          )}

          {/* Chair approval gate, approve/reject before the doc can be introduced */}
          {canDecide && !isViewOnly && (
            <div className="flex gap-2">
              <button onClick={() => onApprovalChange(doc.id, 'approved')}
                className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none gv-lift">
                {t('documents_approve')}
              </button>
              <button onClick={() => onApprovalChange(doc.id, 'rejected')}
                className="flex-1 py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none gv-lift"
                style={{ backgroundColor: '#8B2020', color: '#EDE7D8' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#7A1C1C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}>
                {t('documents_reject')}
              </button>
            </div>
          )}

          {/* Introduce, withheld until approved when approval is required. A working paper
              whose introduction was closed before Q&A finished is still "introduced" and
              offers Introduce again (setup prefilled with its saved times), so it can always
              reach its automatic pass. An introduced draft resolution goes to the voting page. */}
          {!isViewOnly && !approvalBlocksIntroduce && (nextStatus === 'introduced' || (doc.status === 'introduced' && doc.type === 'working-paper')) && (
            <button onClick={() => onStartPresentation(doc)}
              className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none gv-lift">
              {`${t('documents_introduce')} →`}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
/** The chair page's top bar (h-11). The introduction screens start BELOW it, so its Gavel,
 *  session code, Chat, Scoreboard and Settings stay on screen and work exactly as on the floor
 *  (17 Sep 2026). The chair page lifts that bar above the introduction while one is open. */
const CHAIR_TOP_BAR_H = 44;

export default function DocumentsModal({ committee, onClose, onCommitteeUpdate, isViewOnly = false, chairName = '', onIntroChange }: {
  committee: Committee; onClose: () => void;
  /** Told when the full-screen introduction (setup or a timed stage) opens and closes, so the
   *  chair page can keep its top bar above it. Called with false on unmount. */
  onIntroChange?: (active: boolean) => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
  isViewOnly?: boolean;
  // The acting chair's name, so "Go to voting" can hand it on to /voting/[code] and the
  // voting page's "Back to Session" can hand it back. A chair's identity is ONLY the
  // ?chairName= query param, so any navigation that drops it loses the gavel comparison
  // and the chat sender name. Passed already-resolved by the chair page (it falls back to
  // the rejoin blob when the URL is bare), which is the only surface rendering this modal.
  chairName?: string;
}) {
  const t = useT();
  const router = useRouter();
  // D-10: read from the committee row, so another chair's toggle applies on this device.
  const requireDocApproval = readRequireDocApproval(committee);
  const [tab, setTab] = useState<DocTab>('working-paper');
  const [showForm, setShowForm] = useState(false);

  // Fullscreen presentation state. The doc itself is re-read from the committee by id so a
  // realtime refresh (title, sponsors) is reflected; `activeDocSnap` is the fallback.
  const [activeDocSnap, setActiveDocSnap] = useState<CommitteeDocument | null>(null);
  const activeDoc = activeDocSnap
    ? ((committee.documents ?? []).find((d) => d.id === activeDocSnap.id) ?? activeDocSnap)
    : null;
  const [stage, setStage] = useState<PresentationStage>(null);
  const [timings, setTimings] = useState({ reading: 0, presentation: 0, qa: 0 });
  const [clock, setClock] = useState<{ base: number; startedAt: string | null }>({ base: 0, startedAt: null });
  /** Both belong to the introduction, not to a stage, so moving between Reading, Presentation
   *  and Q&A leaves the paper exactly as the chair set it. Zoom is remembered per device. */
  const [zoom, setZoomState] = useState<PdfZoom>(() => (typeof window === 'undefined' ? 'fit' : readZoom()));
  const setZoom = useCallback((z: PdfZoom) => { setZoomState(z); writeZoom(z); }, []);
  const [timerOpen, setTimerOpen] = useState(true);
  /** Stages this introduction has finished (Next / Continue out of them), for the switcher's
   *  check marks. Local to this screen, like the stage itself. */
  const [doneStages, setDoneStages] = useState<TimedStage[]>([]);
  const introActive = !!(activeDocSnap && stage);
  const onIntroChangeRef = useRef(onIntroChange);
  useEffect(() => { onIntroChangeRef.current = onIntroChange; }, [onIntroChange]);
  useEffect(() => { onIntroChangeRef.current?.(introActive); }, [introActive]);
  useEffect(() => () => onIntroChangeRef.current?.(false), []);
  const [flowError, setFlowError] = useState(false);
  /** Write order for this modal, and the failures still standing (doc id -> seq of the
   *  failed write). A success clears ONLY failures of the same document issued before it:
   *  a later success on another paper (or an older write landing late) used to hide the
   *  banner while the failed change was still unsaved. */
  const flowSeqRef = useRef(0);
  const flowFailuresRef = useRef<Map<string, number>>(new Map());
  const settleFlow = (docId: string, seq: number, ok: boolean) => {
    const failures = flowFailuresRef.current;
    if (ok) {
      const failedAt = failures.get(docId);
      if (failedAt !== undefined && failedAt < seq) failures.delete(docId);
    } else {
      failures.set(docId, Math.max(failures.get(docId) ?? 0, seq));
    }
    setFlowError(failures.size > 0);
  };

  const update = (updater: (c: Committee) => Committee) => onCommitteeUpdate?.(updater);
  const suffix = committee.dbChairJoinSuffix ?? undefined;
  const docs = (committee.documents ?? []).filter((d) => d.type === tab);
  // Chair-renameable labels for the active tab's document type.
  const tabSingularName = docName(committee, tab, 'singular',
    tab === 'working-paper' ? t('documents_working_paper') : t('documents_draft_resolution'));
  const tabPluralName = docName(committee, tab, 'plural',
    tab === 'working-paper' ? t('documents_working_papers_tab') : t('documents_draft_resolutions_tab'));

  const patchDocLocal = (docId: string, patch: Partial<CommitteeDocument>) =>
    update((c) => ({ ...c, documents: (c.documents ?? []).map((d) => d.id === docId ? { ...d, ...patch } : d) }));

  /** Optimistic first, then one checked write (RULE 5). A failure is shown, not swallowed. */
  const writeFlow = (docId: string, patch: Parameters<typeof updateDocumentFlow>[1]) => {
    const local: Partial<CommitteeDocument> = {};
    if (patch.status !== undefined) local.status = patch.status;
    if (patch.introState !== undefined) local.introState = patch.introState;
    if (patch.readingMinutes !== undefined) local.readingMinutes = patch.readingMinutes;
    if (patch.presentationMinutes !== undefined) local.presentationMinutes = patch.presentationMinutes;
    if (patch.qaMinutes !== undefined) local.qaMinutes = patch.qaMinutes;
    patchDocLocal(docId, local);
    const seq = ++flowSeqRef.current;
    void updateDocumentFlow(docId, patch, committee.code, suffix).then((ok) => settleFlow(docId, seq, ok));
  };

  const handleDocumentAdded = (doc: CommitteeDocument) => {
    update((c) => ({ ...c, documents: [...(c.documents ?? []), doc] }));
  };

  const handleApprovalChange = (docId: string, approval: 'approved' | 'rejected') => {
    patchDocLocal(docId, { approval });
    updateDocumentApprovalInDB(docId, approval, committee.code, suffix);
  };

  const handleRemove = (docId: string) => {
    const removed = (committee.documents ?? []).find((d) => d.id === docId);
    update((c) => ({ ...c, documents: (c.documents ?? []).filter((d) => d.id !== docId) }));
    const seq = ++flowSeqRef.current;
    void deleteDocumentChecked(docId, committee.code, suffix).then((ok) => {
      if (ok) { settleFlow(docId, seq, true); return; }
      if (!removed) return;
      // Put it back rather than pretend it is gone.
      update((c) => (c.documents ?? []).some((d) => d.id === docId) ? c : { ...c, documents: [...(c.documents ?? []), removed] });
      settleFlow(docId, seq, false);
    });
  };

  const closeFlow = () => { setStage(null); setActiveDocSnap(null); };

  const goToVoting = () =>
    router.push(`/voting/${committee.code}${chairName ? `?chairName=${encodeURIComponent(chairName)}` : ''}`);

  const handleStartPresentation = (doc: CommitteeDocument) => {
    setActiveDocSnap(doc);
    setStage('setup');
    setTimerOpen(true);
    setDoneStages([]);
  };

  const stageMinutes = (s: TimedStage, tm = timings) => tm[s];

  /** Enter a timed stage with a fresh, paused clock. The stage lives only on this screen:
   *  there is no Resume from the card any more, so it is not persisted. */
  const enterStage = (s: TimedStage, tm = timings) => {
    setClock({ base: stageMinutes(s, tm) * 60, startedAt: null });
    setStage(s);
  };

  const finishIntroduction = (doc: CommitteeDocument) => {
    // WP auto-passes. A DR stays introduced; the chair takes it to the voting page.
    writeFlow(doc.id, doc.type === 'working-paper' ? { status: 'passed', introState: null } : { introState: null });
    closeFlow();
  };

  const handleTimingConfirmed = (readingMins: number, presentationMins: number, qaMins: number) => {
    if (!activeDoc) return;
    const tm = { reading: readingMins, presentation: presentationMins, qa: qaMins };
    setTimings(tm);
    setDoneStages([]);
    const first = STAGE_ORDER.find((s) => tm[s] > 0);
    // One write: timings and status together. `introState: null` also clears a stage left by
    // the retired Resume flow, so no row keeps a stale introduction.
    writeFlow(activeDoc.id, {
      readingMinutes: readingMins, presentationMinutes: presentationMins, qaMinutes: qaMins,
      status: first || activeDoc.type !== 'working-paper' ? 'introduced' : 'passed',
      introState: null,
    });
    if (first) { setClock({ base: tm[first] * 60, startedAt: null }); setStage(first); }
    else closeFlow();
  };

  const advanceFromStage = (from: TimedStage) => {
    if (!activeDoc) return;
    setDoneStages((d) => (d.includes(from) ? d : [...d, from]));
    const after = STAGE_ORDER.slice(STAGE_ORDER.indexOf(from) + 1).find((s) => timings[s] > 0);
    if (after) enterStage(after);
    else finishIntroduction(activeDoc);
  };

  /** Back skips stages with a 0-minute timer (they used to render a blank screen) and
   *  lands on setup when there is nothing earlier. */
  const backFromStage = (from: TimedStage) => {
    if (!activeDoc) return;
    const before = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(from)).reverse().find((s) => timings[s] > 0);
    if (before) enterStage(before);
    else setStage('setup');
  };

  const handleClockChange = (next: { base: number; startedAt: string | null }) => {
    if (!activeDoc || !stage || stage === 'setup') return;
    setClock(next);
  };

  const handleSkipToVote = () => {
    if (!activeDoc) return;
    writeFlow(activeDoc.id, activeDoc.type === 'working-paper'
      ? { status: 'passed', introState: null }
      : { status: 'introduced', introState: null });
    closeFlow();
  };

  /** Jump straight to a stage from the switcher: a fresh paused clock, like Next and Back. */
  const jumpToStage = (s: TimedStage) => {
    if (!activeDoc || timings[s] <= 0 || s === stage) return;
    enterStage(s);
  };

  const flowErrorBanner = flowError ? (
    <p role="alert" className="text-xs text-center px-6 py-2" style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)' }}>
      {t('documents_intro_save_failed')}
    </p>
  ) : null;

  /** Both introduction screens share this frame: z 45, BELOW every dialog (z 50 and up) so
   *  Chat, Scoreboard and Settings open over it, and starting under the chair page's top bar,
   *  which the page lifts to z 46 while an introduction is open. The strip under that bar is
   *  painted in the bar's own ivory, so the bar reads full width over the hidden sidebar. */
  const introFrame = (ground: string, children: React.ReactNode) => (
    <Portal>
      <div className="fixed inset-0 z-[45] flex flex-col" style={{ backgroundColor: ground }} data-doc-intro>
        <div aria-hidden className="shrink-0 bg-[#FAF8F3]" style={{ height: CHAIR_TOP_BAR_H, boxShadow: '0 1px 0 rgba(28,20,16,0.07)' }} />
        {children}
      </div>
    </Portal>
  );

  const switchLabel = (s: TimedStage) =>
    s === 'reading' ? t('documents_switch_reading') : s === 'presentation' ? t('documents_switch_presentation') : t('documents_switch_qa');

  // Fullscreen stages. The paper is the page; the clock floats over it (16 Sep 2026).
  if (activeDoc && stage && stage !== 'setup') {
    const stageLabel = stage === 'reading' ? t('documents_stage_reading') : stage === 'presentation' ? t('documents_stage_presentation') : t('documents_stage_qa');
    return introFrame('#EDE7D8', (<>
        <div className="grid items-center gap-3 px-4 h-14 shrink-0 bg-[#F6F1E6]"
          style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', boxShadow: '0 1px 0 rgba(28,20,16,0.08)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 h-6 px-2 rounded-md flex items-center text-[12px] font-semibold tabular-nums"
              style={{ color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.08)', fontFamily: "'Outfit', sans-serif" }}>{activeDoc.docCode}</span>
            <span className="text-sm font-semibold truncate min-w-0" style={{ color: '#1C1410' }} title={activeDoc.title}>{activeDoc.title}</span>
          </div>
          <StageSwitcher
            current={stage}
            onSelect={(k) => jumpToStage(k as TimedStage)}
            onTimings={() => setStage('setup')}
            stages={STAGE_ORDER.map((s) => ({ key: s, label: switchLabel(s), minutes: timings[s], done: doneStages.includes(s) }))}
          />
          {/* Zoom belongs to the chair, not to the stage: it survives every stage change. A PDF
              carries its own toolbar (PdfViewer); these controls serve a text paper only. */}
          <div className="flex items-center justify-end gap-1 min-w-0">
            {!activeDoc.fileUrl && activeDoc.content && (<>
            <button type="button" onClick={() => setZoom(stepPdfZoom(zoom === 'fit' ? 1 : zoom, -1))}
              disabled={zoom !== 'fit' && zoom <= PDF_ZOOM_STEPS[0]}
              aria-label={t('documents_zoom_out')} title={t('documents_zoom_out')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6A5A4A] hover:text-[#1B3828] hover:bg-[#1B3828]/[0.07] disabled:opacity-35 disabled:hover:bg-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
              <Minus size={16} strokeWidth={2.6} aria-hidden />
            </button>
            <button type="button" onClick={() => setZoom(1)}
              aria-label={t('documents_zoom_reset')} title={t('documents_zoom_reset')}
              className="min-w-[52px] h-9 px-2 rounded-lg text-xs font-bold tabular-nums text-[#6A5A4A] hover:text-[#1B3828] hover:bg-[#1B3828]/[0.07] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
              {Math.round((zoom === 'fit' ? 1 : zoom) * 100)}%
            </button>
            <button type="button" onClick={() => setZoom(stepPdfZoom(zoom === 'fit' ? 1 : zoom, 1))}
              disabled={zoom !== 'fit' && zoom >= PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1]}
              aria-label={t('documents_zoom_in')} title={t('documents_zoom_in')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6A5A4A] hover:text-[#1B3828] hover:bg-[#1B3828]/[0.07] disabled:opacity-35 disabled:hover:bg-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
              <Plus size={16} strokeWidth={2.6} aria-hidden />
            </button>
            </>)}
            {!timerOpen && (
              <button type="button" onClick={() => setTimerOpen(true)}
                aria-label={t('documents_timer_show')} title={t('documents_timer_show')}
                className="ms-1 h-9 ps-2.5 pe-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold bg-[#1B3828] hover:bg-[#244A36] text-[#FAF8F3] transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40">
                <Timer size={15} strokeWidth={2.4} aria-hidden />
                {t('documents_timer_show')}
              </button>
            )}
            {/* Closing leaves the paper introduced. A working paper's card offers Introduce
                again; a draft resolution goes to the voting page. */}
            <button onClick={() => { closeFlow(); onClose(); }} aria-label={t('sb_close')} title={t('sb_close')}
              className="ms-1 w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-[#6A5A4A] hover:text-[#1C1410] hover:bg-[#1B3828]/[0.07] transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
              <X size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        </div>
        {flowErrorBanner}
        <div className="flex-1 min-h-0 relative">
          {/* Mounted once for the whole introduction: a stage change never remounts it, so the
              zoom and the scroll position stay exactly where the chair left them. */}
          <IntroDocument doc={activeDoc} zoom={zoom} onZoomChange={setZoom} />
          {/* A stage with a 0-minute timer renders as already complete (Continue), never blank. */}
          {timerOpen && (
            <StageTimerDevice label={stageLabel}
              totalSeconds={timings[stage] * 60}
              sponsors={activeDoc.sponsors}
              sponsorsWord={sponsorLabel(committee, t('documents_sponsors_label_card'))}
              clock={clock} onClockChange={handleClockChange}
              onComplete={() => advanceFromStage(stage)}
              onBack={() => backFromStage(stage)}
              onHide={() => setTimerOpen(false)} />
          )}
        </div>
    </>));
  }

  // Timing setup screen: the order of proceedings (17 Sep 2026).
  if (activeDoc && stage === 'setup') {
    return introFrame('#F6F1E9', (<>
        <div className="flex items-center justify-between gap-3 px-5 h-12 shrink-0" style={{ boxShadow: '0 1px 0 rgba(28,20,16,0.08)' }}>
          <span className="text-[13px] font-semibold uppercase" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.14em' }}>{t('documents_introduce')}</span>
          <button onClick={closeFlow} aria-label={t('sb_close')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6A5A4A] hover:text-[#1C1410] hover:bg-[#1B3828]/[0.07] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
            <X size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
        {flowErrorBanner}
        <ProceedingsSetup doc={activeDoc} committee={committee} onStart={handleTimingConfirmed} onSkip={handleSkipToVote} />
    </>));
  }

  return (
    // Grows out of the Documents tab, rendered from the documents already on the committee:
    // nothing waits on the network, so a slow connection cannot delay the opening.
    <GrowDialog
      originSelector='[data-tutorial="tab-documents"]'
      onClose={onClose}
      ariaLabel={t('documents_title')}
      panelClassName="bg-[#EDE7D8] border border-[#DDD4C0] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92%] flex flex-col"
    >
      {(requestClose) => (<>
        <div className="flex items-center justify-between px-7 pt-6 pb-4 shrink-0 border-b border-[#DDD4C0]">
          <h2 className="text-2xl font-black text-[#1C1410]">{t('documents_title')}</h2>
          <button onClick={requestClose} aria-label={t('sb_close')} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl leading-none focus:outline-none">✕</button>
        </div>

        {!showForm && (
          <div className="flex gap-2 px-7 pt-4 shrink-0">
            {(['working-paper', 'draft-resolution'] as const).map((tabItem) => {
              const count = (committee.documents ?? []).filter((d) => d.type === tabItem && (d.status === 'submitted' || d.status === 'on-floor')).length;
              return (
                <button key={tabItem} onClick={() => setTab(tabItem)}
                  className={`gv-lift flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors relative ${tab === tabItem ? 'bg-[#1B3828] text-white' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'}`}>
                  {docName(committee, tabItem, 'plural', tabItem === 'working-paper' ? t('documents_working_papers_tab') : t('documents_draft_resolutions_tab'))}
                  {count > 0 && (
                    <span className={`ms-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${tab === tabItem ? 'bg-white/30 text-white' : 'bg-[#1B3828] text-white'}`}>{count}</span>
                  )}
                </button>
              );
            })}
            {/* Straight to the voting page, which picks the draft resolution and runs the roll
                call. Carries ?chairName= like Go to voting. Moderator only (UI gate, RULE 15). */}
            {!isViewOnly && (
              <button
                type="button"
                onClick={goToVoting}
                title={t('documents_vote_title')}
                aria-label={t('documents_vote_title')}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl font-bold text-sm bg-[#EED98A] hover:bg-[#E6CD6E] text-[#1B3828] transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                <Vote size={15} strokeWidth={2.2} aria-hidden />
                {t('documents_vote_btn')}
              </button>
            )}
          </div>
        )}

        <div className="overflow-y-auto flex-1 min-h-0 pt-4">
          {showForm ? (
            <SubmitForm committee={committee} type={tab} onDone={() => setShowForm(false)} onDocumentAdded={handleDocumentAdded} />
          ) : (
            <div className="px-7 pb-7 space-y-3">
              {flowErrorBanner}
              {/* The full-width GO TO VOTING banner is gone (16 Sep 2026). The small Vote
                  button beside the tabs is the one way to the voting page from here. */}
              {docs.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-2xl font-black mb-1" style={{ color: '#1B3828' }}>{t('documents_empty_doc', { doc: tabPluralName })}</p>
                  <p className="text-sm mt-1" style={{ color: '#9A8A78' }}>{t('documents_empty_sub')}</p>
                </div>
              ) : (
                docs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} committee={committee}
                    onRemove={handleRemove}
                    onStartPresentation={handleStartPresentation}
                    requireApproval={requireDocApproval} onApprovalChange={handleApprovalChange}
                    isViewOnly={isViewOnly} />
                ))
              )}
              {!isViewOnly && (
                <button onClick={() => setShowForm(true)}
                  className="w-full bg-[#EDE7D8] hover:bg-[#DDD4C0] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1C1410] py-3.5 rounded-2xl font-bold transition-all mt-2 text-center focus:outline-none gv-lift" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  + {t('documents_submit_new_doc', { doc: tabSingularName })}
                </button>
              )}
            </div>
          )}
        </div>
      </>)}
    </GrowDialog>
  );
}