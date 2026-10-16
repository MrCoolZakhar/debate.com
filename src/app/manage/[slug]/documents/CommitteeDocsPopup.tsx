'use client';

/**
 * One committee's documents (prompt 129, 16 Oct 2026): a pop-up on the
 * Settings pop-up shell (AwardsSheet) with two tabs.
 *
 * - Submissions: the position paper roster, moved unchanged from the old
 *   Overview tab (counts, filters, PositionPaperRoster with Approve / Reject,
 *   the message stubs). A warning says when submissions are not enabled.
 * - Settings: the study guide (upload, the guide rows with Delete, and the
 *   release date) and position papers (the submissions switch and the
 *   deadline). Every setting is one save_committee_documents call, a verified
 *   write: the committee the RPC returns is applied, a refusal keeps the old
 *   value and shows its sentence under the field. "Copy from another
 *   committee" writes all three settings in ONE call (the guide file is not
 *   copied).
 *
 * The release date alone decides when a study guide is visible: the server
 * clears is_published when a release date is saved, so there is no Publish
 * or Unpublish any more.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Copy, FileText, Upload, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { useNow } from '@/lib/useNow';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { ModalOverlay as SharedModalOverlay } from '@/components/ModalOverlay';
import { DatePicker } from '@/components/DatePicker';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { useConfirmModal } from '@/components/ConfirmModal';
import { NEU } from '@/components/neu';
import { notifyErr, clearErr } from '@/lib/appNotify';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import PositionPaperRoster, { type RosterAllocation, type RosterPaper } from '@/components/PositionPaperRoster';
import { fetchMessageStubsForPapers, type PaperMessageStub } from '@/lib/positionPapers';
import { safeStorageKey } from '@/lib/storageKey';
import { AwardsSheet } from '../settings/awardsSheet';
import { F, INK, INK_SOFT, FOREST, DANGER, TEXT_LINK, TYPE, TYPE_PX, SwitchRow } from '../settings/panelKit';

const OUTFIT = "var(--font-brand), sans-serif";

// ── Types and helpers (shared with the page) ─────────────────────────────────

export interface CommitteeDoc {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  committee_type: string;
  position_paper_deadline: string | null;
  pp_submissions_enabled: boolean;
  study_guides_publish_at: string | null;
  notification_email: string | null;
}

export interface StudyGuide {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

interface RosterAllocationRow {
  country_code: string;
  user_id: string | null;
  profiles: { display_name: string } | null;
  applications: { invited_name: string | null } | null;
}

export type DocsPane = 'submissions' | 'settings';

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isoToDatePart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoToTimePart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function shortName(c: Pick<CommitteeDoc, 'abbreviation' | 'name'>): string {
  return (c.abbreviation || c.name || '').trim();
}

export function CommitteeLogo({ c, size }: { c: CommitteeDoc; size: number }) {
  return (
    <span className="flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ width: size, height: size, borderRadius: Math.round(size / 3.6) }}>
      {c.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.logo_url} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />
      ) : (
        <MonogramMedallion text={shortName(c)} isCrisis={c.committee_type === 'crisis'} size={size} />
      )}
    </span>
  );
}

type SavePatch = Partial<Pick<CommitteeDoc, 'pp_submissions_enabled' | 'position_paper_deadline' | 'study_guides_publish_at'>>;

/** save_committee_documents: the committee the server now holds, or the sentence why not. */
export async function saveCommitteeDocuments(committeeId: string, patch: SavePatch): Promise<
  { ok: true; committee: Pick<CommitteeDoc, 'id' | 'pp_submissions_enabled' | 'position_paper_deadline' | 'study_guides_publish_at'> } | { ok: false; error: string }
> {
  const fallback = 'That could not be saved. Try again in a moment.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: fallback };
    const { data, error } = await c.rpc('save_committee_documents', { p_committee_id: committeeId, p_patch: patch });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const d = data as { ok?: boolean; committee?: CommitteeDoc; error?: string } | null;
    if (!d?.ok || !d.committee) return { ok: false, error: plainOrFallback(d?.error ?? '', fallback) };
    return { ok: true, committee: d.committee };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

// ── UploadStudyGuideModal (moved unchanged from the page) ───────────────────

function UploadStudyGuideModal({
  conferenceId, selectedCommitteeId, userId, onClose, onUploaded,
}: {
  conferenceId: string;
  selectedCommitteeId: string;
  userId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setFileError('Only PDF files are accepted.'); return; }
    if (file.size > 5 * 1024 * 1024) { setFileError('File must be under 5MB.'); return; }
    setFileError('');
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile || !title.trim() || uploading) return;
    if (!session) return;
    setUploading(true);
    setUploadError('');
    const supabase = getAuthedClient(session.access_token);
    const path = safeStorageKey(`${conferenceId}/${selectedCommitteeId}`, String(Date.now()), selectedFile.name);
    const { error: storageError } = await supabase.storage
      .from('study-guides')
      .upload(path, selectedFile, { contentType: 'application/pdf' });
    if (storageError) { setUploadError('Upload failed. Please try again.'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('study-guides').getPublicUrl(path);
    const { error: insertError } = await supabase.from('study_guides').insert({
      conference_committee_id: selectedCommitteeId,
      uploaded_by: userId,
      title: title.trim(),
      file_url: publicUrl,
      file_name: selectedFile.name,
      file_size_bytes: selectedFile.size,
      mime_type: 'application/pdf',
      is_published: false,
    });
    if (insertError) { setUploadError('Upload failed. Please try again.'); setUploading(false); return; }
    setUploading(false);
    onUploaded();
    onClose();
  }

  const disabled = !selectedFile || !title.trim() || uploading;

  return (
    <SharedModalOverlay onClose={onClose} paddingClassName="px-4">
      <div style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16, padding: 24, maxWidth: 448, width: '100%', maxHeight: '90dvh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(27,56,40,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', color: '#1C1410' }}>Upload Study Guide</h2>
          <button onClick={onClose} aria-label="Close" className="focus:outline-none inline-flex items-center justify-center" style={{ color: NEU.inkSoft, width: 40, height: 40, borderRadius: 999, background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#1C1410', fontFamily: OUTFIT, marginBottom: 6 }}>
            Title *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. UNHRC Background Guide 2026"
            style={{ width: '100%', border: '1.5px solid #DDD4C0', borderRadius: 12, padding: '0 14px', height: 48, fontSize: 16, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none', fontFamily: OUTFIT, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#1C1410', fontFamily: OUTFIT, marginBottom: 6 }}>
            File (PDF · max 5MB)
          </label>
          <input type="file" accept="application/pdf" onChange={handleFileSelect} className="hidden" ref={fileInputRef} />
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ border: '2px dashed #DDD4C0', borderRadius: 12, padding: '32px 16px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <Upload size={24} style={{ color: '#9A8A78' }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1410', fontFamily: OUTFIT, marginBottom: 4 }}>Click to select PDF</p>
              <p style={{ fontSize: 13, color: NEU.inkSoft, fontFamily: OUTFIT }}>Max 5MB</p>
            </div>
          ) : (
            <div style={{ border: '1px solid rgba(61,122,82,0.3)', borderRadius: 12, padding: '12px 16px', backgroundColor: 'rgba(61,122,82,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Check size={16} style={{ color: '#3D7A52', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedFile.name}>{selectedFile.name}</p>
                <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{formatFileSize(selectedFile.size)}</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="focus:outline-none" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0 }}>
                Change file
              </button>
            </div>
          )}
          {fileError && <p style={{ fontSize: 13, color: '#8B2020', fontFamily: OUTFIT, marginTop: 4 }}>{fileError}</p>}
        </div>

        {uploadError && <p style={{ fontSize: 13.5, color: '#8B2020', fontFamily: OUTFIT, marginBottom: 12 }}>{uploadError}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="focus:outline-none gv-lift" style={{ flex: 1, border: '1.5px solid #DDD4C0', borderRadius: 12, padding: '0', minHeight: 48, fontFamily: OUTFIT, fontWeight: 700, fontSize: 15, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={disabled}
            className="focus:outline-none gv-lift"
            style={{ flex: 1, border: 'none', borderRadius: 12, padding: '0', minHeight: 48, fontFamily: OUTFIT, fontWeight: 700, fontSize: 15, backgroundColor: disabled ? '#DDD4C0' : '#1B3828', color: disabled ? '#9A8A78' : '#EED98A', cursor: disabled ? 'default' : 'pointer' }}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </SharedModalOverlay>
  );
}

// ── DateTimeField: a DatePicker + time input committing a verified write ────
// on every change (moved from the page). onSave answers null when saved, or
// the sentence to show under the field; the old value then comes back.

function DateTimeField({ id, value, onSave, placeholder }: {
  id?: string;
  value: string | null;
  onSave: (iso: string | null) => Promise<string | null>;
  placeholder: string;
}) {
  const [datePart, setDatePart] = useState(isoToDatePart(value));
  const [timePart, setTimePart] = useState(isoToTimePart(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  // A new value from the parent (a save landed, a copy, a refresh) shows at once.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDatePart(isoToDatePart(value));
    setTimePart(isoToTimePart(value));
  }

  async function commit(nextDate: string, nextTime: string) {
    if (savingRef.current) return;
    const prevDate = datePart, prevTime = timePart;
    setDatePart(nextDate);
    setTimePart(nextTime);
    let iso: string | null = null;
    if (nextDate) {
      const [y, mo, da] = nextDate.split('-').map(Number);
      const [h, m] = (nextTime || '00:00').split(':').map(Number);
      iso = new Date(y, mo - 1, da, h, m).toISOString();
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    const err = await onSave(iso);
    savingRef.current = false;
    setSaving(false);
    if (err) {
      setDatePart(prevDate);
      setTimePart(prevTime);
      setError(err);
    }
  }

  return (
    <div id={id}>
      <div className="flex gap-2 items-center flex-wrap">
        <div style={{ flex: '1 1 180px', minWidth: 160 }}>
          <DatePicker
            value={datePart}
            onChange={iso => commit(iso, timePart || '00:00')}
            placeholder={placeholder}
            disabled={saving}
          />
        </div>
        <input
          type="time"
          aria-label="Time"
          value={timePart}
          onChange={e => commit(datePart, e.target.value)}
          disabled={saving || !datePart}
          className="focus:outline-none"
          style={{
            border: 'none', borderRadius: 12, padding: '11px 12px',
            fontFamily: OUTFIT, fontSize: 15, fontWeight: 600,
            color: datePart ? NEU.ink : NEU.muted, backgroundColor: NEU.base, boxShadow: NEU.inSm,
          }}
        />
        {datePart && (
          <button
            type="button"
            onClick={() => commit('', '')}
            disabled={saving}
            title="Clear"
            aria-label="Clear"
            className="flex-shrink-0 focus:outline-none"
            style={{ color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        )}
        {saving && <span style={{ ...TYPE.hint }}>Saving…</span>}
      </div>
      {error && <p role="alert" style={{ fontSize: 13, color: DANGER, fontFamily: OUTFIT, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

// ── Copy from another committee (the roles' CopyFromMenu, for committees) ──

interface CommitteeCopySource { id: string; c: CommitteeDoc; detail: string }

const MENU_W = 300;

function settingsLine(c: CommitteeDoc): string {
  return [
    c.study_guides_publish_at ? `Releases ${formatDate(c.study_guides_publish_at)}` : 'No release date',
    c.pp_submissions_enabled ? 'Submissions open' : 'Submissions closed',
    c.position_paper_deadline ? `Due ${formatDate(c.position_paper_deadline)}` : 'No deadline',
  ].join(' · ');
}

function CopyFromCommitteeMenu({ sources, onPick }: { sources: CommitteeCopySource[]; onPick: (c: CommitteeDoc) => void }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const empty = sources.length === 0;
  const reason = 'No other committee has settings yet';

  function showTip() {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 16);
    setTip({ top: r.top - 8, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)) });
  }
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); };
  }, [tip]);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight ?? 60 + sources.length * 62;
    const left = Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8);
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
    setPos(prev => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [sources.length]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Capture phase: Escape closes the menu and never the pop-up underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    const t = window.setTimeout(() => { place(); menuRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }); }, 20);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  function moveFocus(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    items[e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length]?.focus();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-disabled={empty || undefined}
        aria-haspopup={empty ? undefined : 'menu'}
        aria-expanded={empty ? undefined : open}
        aria-describedby={empty ? 'copy-why-committee' : undefined}
        onClick={() => { if (empty) { if (tip) setTip(null); else showTip(); return; } setOpen(o => !o); }}
        onMouseEnter={empty ? showTip : undefined}
        onMouseLeave={empty ? () => setTip(null) : undefined}
        onFocus={empty ? showTip : undefined}
        onBlur={empty ? () => setTip(null) : undefined}
        className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 rounded"
        style={{ ...TEXT_LINK, fontSize: TYPE_PX.body, opacity: empty ? 0.45 : 1, cursor: empty ? 'default' : 'pointer', textDecoration: empty ? 'none' : TEXT_LINK.textDecoration }}
      >
        <Copy size={14} strokeWidth={2.4} aria-hidden />
        Copy from another committee
        {empty && <span id="copy-why-committee" className="sr-only">{reason}</span>}
      </button>
      {empty && tip && (
        <Portal>
          <div
            role="tooltip"
            aria-hidden
            style={{
              position: 'fixed', top: tip.top, left: tip.left, transform: 'translateY(-100%)', zIndex: 9500,
              maxWidth: 260, padding: '8px 12px', borderRadius: 12, pointerEvents: 'none',
              background: FOREST, color: '#FFFFFF', fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 600, lineHeight: 1.4,
              boxShadow: '0 10px 24px -12px rgba(27,56,40,0.6)',
            }}
          >
            {reason}
          </div>
        </Portal>
      )}
      {open && (
        <Portal>
          <div
            ref={menuRef}
            role="menu"
            aria-label="Copy settings from"
            onKeyDown={moveFocus}
            style={{
              position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: 60, width: MENU_W,
              maxHeight: 'min(420px, calc(100dvh - 32px))', overflowY: 'auto',
              background: '#FFFFFF', borderRadius: 16, padding: 6,
              boxShadow: '0 1px 0 rgba(27,56,40,0.08), 0 18px 40px -14px rgba(27,56,40,0.45), inset 0 0 0 1px rgba(27,56,40,0.08)',
            }}
          >
            <p className="px-2.5 pt-1.5 pb-1" style={{ ...TYPE.hint, fontWeight: 700 }}>Copy settings from</p>
            {sources.map(s => (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onPick(s.c); }}
                className="w-full flex items-center gap-2.5 text-left rounded-xl focus:outline-none focus-visible:ring-2 hover:bg-[#FAF8F3]"
                style={{ padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: F }}
              >
                <CommitteeLogo c={s.c} size={36} />
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: TYPE_PX.body, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{shortName(s.c)}</span>
                  <span className="block" style={{ fontSize: TYPE_PX.hint, color: INK_SOFT, overflowWrap: 'anywhere' }}>{s.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </Portal>
      )}
    </>
  );
}

// ── The pop-up ───────────────────────────────────────────────────────────────

export default function CommitteeDocsPopup({
  conferenceId, conferenceSlug, committee, committees, initialPane, onClose, onCommitteeChange,
}: {
  conferenceId: string;
  conferenceSlug: string;
  committee: CommitteeDoc;
  /** Every committee of the conference, for "Copy from another committee". */
  committees: CommitteeDoc[];
  initialPane: DocsPane;
  onClose: () => void;
  /** A save landed: the committee as the server now holds it. */
  onCommitteeChange: (c: CommitteeDoc) => void;
}) {
  const { user, session } = useAuth();
  const accessToken = session?.access_token;
  const [pane, setPane] = useState<DocsPane>(initialPane);
  const [studyGuides, setStudyGuides] = useState<StudyGuide[]>([]);
  const [allocations, setAllocations] = useState<RosterAllocationRow[]>([]);
  const [papers, setPapers] = useState<RosterPaper[]>([]);
  const [messagesByPaper, setMessagesByPaper] = useState<Record<string, PaperMessageStub[]>>({});
  const [papersError, setPapersError] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [ppBusy, setPpBusy] = useState(false);
  const [ppErr, setPpErr] = useState('');
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyErr, setCopyErr] = useState('');
  const ppBusyRef = useRef(false);
  const copyBusyRef = useRef(false);
  const { confirm, modal: confirmModal } = useConfirmModal();
  // "Released on" or "Releases on": the clock ticks every minute (react-hooks/purity).
  const now = useNow();
  const committeeId = committee.id;

  const setActionError = useCallback((msg: string) => {
    if (msg) notifyErr(msg, 'documents'); else clearErr('documents');
  }, []);

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  const loadStudyGuides = useCallback(async () => {
    if (!accessToken) return;
    const supabase = getAuthedClient(accessToken);
    const { data } = await supabase
      .from('study_guides')
      .select('id, title, file_url, file_name, file_size_bytes, is_published, published_at, created_at')
      .eq('conference_committee_id', committeeId)
      .order('created_at', { ascending: false });
    setStudyGuides((data ?? []) as StudyGuide[]);
  }, [committeeId, accessToken]);

  const loadPapers = useCallback(async () => {
    if (!accessToken) return;
    const supabase = getAuthedClient(accessToken);
    const [{ data: allocData, error: allocError }, { data: paperData, error: paperError }] = await Promise.all([
      supabase
        .from('conference_allocations')
        .select('country_code, user_id, profiles (display_name), applications:application_id (invited_name)')
        .eq('conference_committee_id', committeeId),
      supabase
        .from('position_papers')
        .select('id, country_code, status, submitted_at, reviewer_seen_at')
        .eq('conference_committee_id', committeeId),
    ]);
    if (allocError || paperError) {
      console.error('[CommitteeDocsPopup] roster load failed:', allocError || paperError);
      setPapersError(true);
      setAllocations([]);
      setPapers([]);
      setMessagesByPaper({});
      return;
    }
    setPapersError(false);
    setAllocations((allocData ?? []) as unknown as RosterAllocationRow[]);
    const paperRows = (paperData ?? []) as RosterPaper[];
    setPapers(paperRows);
    setMessagesByPaper(await fetchMessageStubsForPapers(supabase, paperRows.map(p => p.id)));
  }, [committeeId, accessToken]);

  useEffect(() => {
    void Promise.resolve().then(() => { void loadStudyGuides(); void loadPapers(); });
  }, [loadStudyGuides, loadPapers]);

  // ── Actions (moved from the page) ───────────────────────────────────────

  function handleDeleteGuide(guideId: string) {
    if (!session || busyIds.has(guideId)) return;
    const previous = studyGuides;
    setStudyGuides(prev => prev.filter(g => g.id !== guideId));
    setActionError('');
    markBusy(guideId, true);
    const supabase = getAuthedClient(session.access_token);
    supabase.from('study_guides').delete().eq('id', guideId).then(({ error }) => {
      markBusy(guideId, false);
      if (error) {
        setStudyGuides(previous);
        setActionError("Couldn't delete, the guide was restored.");
      }
    });
  }

  function updatePaperStatus(paperId: string, status: string) {
    if (!user || !session || busyIds.has(paperId)) return;
    const previous = papers;
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, status } : p));
    setActionError('');
    markBusy(paperId, true);
    const supabase = getAuthedClient(session.access_token);
    supabase.from('position_papers').update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', paperId).then(({ error }) => {
      markBusy(paperId, false);
      if (error) {
        setPapers(previous);
        setActionError("Couldn't update the paper status. The change was reverted.");
      }
    });
  }

  // ── Settings: every write is save_committee_documents ────────────────────

  const apply = (c: Pick<CommitteeDoc, 'pp_submissions_enabled' | 'position_paper_deadline' | 'study_guides_publish_at'>) => {
    onCommitteeChange({
      ...committee,
      pp_submissions_enabled: c.pp_submissions_enabled,
      position_paper_deadline: c.position_paper_deadline,
      study_guides_publish_at: c.study_guides_publish_at,
    });
  };

  async function saveDate(key: 'study_guides_publish_at' | 'position_paper_deadline', iso: string | null): Promise<string | null> {
    const r = await saveCommitteeDocuments(committeeId, { [key]: iso });
    if (!r.ok) return r.error;
    apply(r.committee);
    return null;
  }

  async function toggleSubmissions(next: boolean) {
    if (ppBusyRef.current) return;
    ppBusyRef.current = true;
    setPpBusy(true);
    setPpErr('');
    const r = await saveCommitteeDocuments(committeeId, { pp_submissions_enabled: next });
    ppBusyRef.current = false;
    setPpBusy(false);
    if (!r.ok) { setPpErr(r.error); return; }
    apply(r.committee);
  }

  const copySources: CommitteeCopySource[] = committees
    .filter(c => c.id !== committeeId && (!!c.study_guides_publish_at || c.pp_submissions_enabled || !!c.position_paper_deadline))
    .map(c => ({ id: c.id, c, detail: settingsLine(c) }));

  async function copyFrom(source: CommitteeDoc) {
    if (copyBusyRef.current) return;
    const { confirmed } = await confirm({
      title: `Copy ${shortName(source)}'s Settings?`,
      body: `This replaces ${shortName(committee)}'s study guide release date, position paper submissions and deadline. The study guide file is not copied.`,
      confirmLabel: 'Copy settings',
    });
    if (!confirmed) return;
    copyBusyRef.current = true;
    setCopyBusy(true);
    setCopyErr('');
    const r = await saveCommitteeDocuments(committeeId, {
      study_guides_publish_at: source.study_guides_publish_at,
      pp_submissions_enabled: source.pp_submissions_enabled,
      position_paper_deadline: source.position_paper_deadline,
    });
    copyBusyRef.current = false;
    setCopyBusy(false);
    if (!r.ok) { setCopyErr(r.error); return; }
    apply(r.committee);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalCount = papers.length;
  const approvedCount = papers.filter(p => p.status === 'approved').length;
  const pendingCount = papers.filter(p => p.status === 'submitted').length;
  const rejectedCount = papers.filter(p => p.status === 'rejected').length;
  const rosterAllocations: RosterAllocation[] = allocations.map(a => ({
    country_code: a.country_code, user_id: a.user_id,
    display_name: a.profiles?.display_name ?? null,
    invited_name: a.applications?.invited_name ?? null,
  }));
  const releaseAt = committee.study_guides_publish_at;
  const released = !!releaseAt && new Date(releaseAt).getTime() <= now;
  const releaseLine = !releaseAt
    ? 'Delegates see it once you set a release date'
    : released ? `Released on ${formatDateTime(releaseAt)}` : `Releases on ${formatDateTime(releaseAt)}`;

  const title = (
    <span className="inline-flex items-center gap-3 min-w-0">
      <CommitteeLogo c={committee} size={40} />
      <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{shortName(committee)}</span>
    </span>
  );

  return (
    <AwardsSheet title={title} onClose={onClose} width={980}>
      <style>{POPUP_CSS}</style>
      <div className="gv-cdp-tabs" role="tablist" aria-label={`${shortName(committee)} documents`}>
        {(['submissions', 'settings'] as const).map(p => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={pane === p}
            className="gv-cdp-tab"
            data-active={pane === p || undefined}
            onClick={() => setPane(p)}
          >
            {p === 'submissions' ? 'Submissions' : 'Settings'}
          </button>
        ))}
      </div>

      {pane === 'submissions' && (
        <div className="flex flex-col" style={{ gap: 16 }}>
          {!committee.pp_submissions_enabled && (
            <p className="gv-cdp-warn" role="status">
              Position paper submission is not yet enabled. Enable them{' '}
              <button type="button" className="gv-cdp-link" onClick={() => setPane('settings')}>here</button>.
            </p>
          )}

          {/* Stats: a big number with the word beside it. */}
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'baseline' }}>
            {([
              [totalCount, 'submitted', NEU.ink],
              [approvedCount, 'approved', '#2F6644'],
              [pendingCount, 'awaiting review', '#7A5A10'],
              [rejectedCount, 'rejected', '#8B2020'],
            ] as const).map(([n, word, color]) => (
              <span key={word} style={{ fontFamily: OUTFIT, display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{n}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: NEU.inkSoft }}>{word}</span>
              </span>
            ))}
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {['ALL', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED'].map(f => {
              const filterLabel = f.charAt(0) + f.slice(1).toLowerCase();
              const isActive = filterStatus === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className="focus:outline-none gv-lift"
                  style={{
                    fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
                    padding: '0 18px', minHeight: 40, borderRadius: 9999, cursor: 'pointer',
                    border: isActive ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                    backgroundColor: isActive ? '#1B3828' : '#FFFFFF',
                    color: isActive ? '#EED98A' : NEU.ink,
                  }}
                >
                  {filterLabel}
                </button>
              );
            })}
          </div>

          <div className="gv-cdp-card">
            {papersError ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 15, color: '#8B2020', textAlign: 'center', padding: '32px 0' }}>
                Couldn&apos;t load position papers.
              </p>
            ) : (
              <PositionPaperRoster
                conferenceSlug={conferenceSlug}
                conferenceCommitteeId={committeeId}
                currentUserId={user?.id ?? ''}
                deadline={committee.position_paper_deadline}
                allocations={rosterAllocations}
                papers={papers}
                messagesByPaper={messagesByPaper}
                busyIds={busyIds}
                onApprove={id => updatePaperStatus(id, 'approved')}
                onReject={id => updatePaperStatus(id, 'rejected')}
                statusFilter={filterStatus}
              />
            )}
          </div>
        </div>
      )}

      {pane === 'settings' && (
        <div className="flex flex-col" style={{ gap: 16 }}>
          <div className="flex items-center justify-end gap-3 flex-wrap">
            {copyBusy && <span style={{ ...TYPE.hint }}>Copying…</span>}
            <CopyFromCommitteeMenu sources={copySources} onPick={src => { void copyFrom(src); }} />
          </div>
          {copyErr && <p role="alert" style={{ ...TYPE.hint, color: DANGER, margin: 0, textAlign: 'right' }}>{copyErr}</p>}

          <div className="gv-cdp-cols">
            <section className="gv-cdp-card" aria-labelledby="gv-cdp-sg">
              <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 12 }}>
                <h3 id="gv-cdp-sg" style={{ ...TYPE.card, margin: 0 }}>Study Guide</h3>
                <button type="button" className="gv-cdp-primary" onClick={() => setShowUploadModal(true)}>
                  <Upload size={15} strokeWidth={2.4} aria-hidden /> Upload study guide
                </button>
              </div>
              {studyGuides.length === 0 ? (
                <p style={{ ...TYPE.hint, margin: '4px 0 14px' }}>No study guide yet.</p>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  {studyGuides.map((guide, i) => (
                    <div
                      key={guide.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < studyGuides.length - 1 ? '1px solid #F0EDE6' : 'none' }}
                    >
                      <FileText size={20} style={{ color: NEU.forest, flexShrink: 0 }} aria-hidden />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 15, color: INK, margin: 0 }}>{guide.title}</p>
                        <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 13, color: INK_SOFT, margin: '2px 0 0' }}>
                          {guide.file_name} · {formatFileSize(guide.file_size_bytes)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGuide(guide.id)}
                        disabled={busyIds.has(guide.id)}
                        className="focus:outline-none gv-cdp-delete"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label htmlFor="gv-cdp-release" style={{ ...TYPE.label, display: 'block', marginBottom: 6 }}>Study Guide Release Date</label>
              <DateTimeField
                id="gv-cdp-release"
                value={committee.study_guides_publish_at}
                onSave={iso => saveDate('study_guides_publish_at', iso)}
                placeholder="No release date"
              />
              <p style={{ ...TYPE.hint, margin: '8px 0 0' }}>{releaseLine}</p>
            </section>

            <section className="gv-cdp-card" aria-labelledby="gv-cdp-pp">
              <h3 id="gv-cdp-pp" style={{ ...TYPE.card, margin: '0 0 12px' }}>Position Papers</h3>
              <SwitchRow
                label="Open position paper submissions"
                checked={committee.pp_submissions_enabled}
                onChange={next => { void toggleSubmissions(next); }}
                busy={ppBusy}
                disabled={ppBusy}
              />
              {ppErr && <p role="alert" style={{ ...TYPE.hint, color: DANGER, margin: '6px 0 0' }}>{ppErr}</p>}
              {committee.pp_submissions_enabled && (
                <div style={{ marginTop: 14 }}>
                  <label htmlFor="gv-cdp-deadline" style={{ ...TYPE.label, display: 'block', marginBottom: 6 }}>Position Paper Deadline</label>
                  <DateTimeField
                    id="gv-cdp-deadline"
                    value={committee.position_paper_deadline}
                    onSave={iso => saveDate('position_paper_deadline', iso)}
                    placeholder="No deadline"
                  />
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {showUploadModal && user && (
        <UploadStudyGuideModal
          conferenceId={conferenceId}
          selectedCommitteeId={committeeId}
          userId={user.id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => { void loadStudyGuides(); }}
        />
      )}
      {confirmModal}
    </AwardsSheet>
  );
}

const POPUP_CSS = `
.gv-cdp-tabs{display:flex;gap:6px;padding:4px;margin-bottom:18px;border-radius:14px;background:#FFFFFF;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.08);width:max-content;max-width:100%}
.gv-cdp-tab{min-height:40px;padding:0 18px;border:none;border-radius:10px;background:transparent;font-family:${F};font-size:15px;font-weight:700;color:${INK_SOFT};cursor:pointer}
.gv-cdp-tab[data-active]{background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF}
.gv-cdp-tab:focus{outline:none}
.gv-cdp-tab:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cdp-card{background:#FFFFFF;border-radius:18px;padding:18px 20px;box-shadow:0 1px 3px rgba(27,56,40,0.08),0 10px 24px -18px rgba(27,56,40,0.35)}
.gv-cdp-cols{display:grid;grid-template-columns:1fr;gap:16px}
@container (min-width:760px){.gv-cdp-cols{grid-template-columns:1fr 1fr;align-items:start}}
.gv-cdp-warn{margin:0;padding:12px 14px;border-radius:14px;background:rgba(238,217,138,0.28);box-shadow:inset 0 0 0 1.5px rgba(184,140,40,0.45);font-family:${F};font-size:14.5px;line-height:1.45;color:${INK}}
.gv-cdp-link{background:none;border:none;padding:0;cursor:pointer;font-family:${F};font-size:inherit;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px}
.gv-cdp-link:focus{outline:none}
.gv-cdp-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-cdp-primary{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 14px;border:none;border-radius:11px;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF;font-family:${F};font-size:14px;font-weight:700;cursor:pointer}
.gv-cdp-primary:focus{outline:none}
.gv-cdp-primary:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cdp-delete{font-family:${F};font-size:14px;font-weight:700;color:${DANGER};background:none;border:none;cursor:pointer;min-height:40px;padding:0 6px}
.gv-cdp-delete:hover{text-decoration:underline}
.gv-cdp-delete:disabled{opacity:0.5;cursor:default}
`;
