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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, FileText, Upload, X } from 'lucide-react';
import { useNow } from '@/lib/useNow';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { DatePicker } from '@/components/DatePicker';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { NEU } from '@/components/neu';
import { notifyErr, notifyOk, clearErr } from '@/lib/appNotify';
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

/** "26 Sep 2026": day, short month, year, the site's one date format
 *  (prompt 139: every date on the Documents page carries its year). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
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

// ── The study guide upload (prompt 131: drawn IN the Settings pane, never a
// pop-up on the pop-up; the upload itself is unchanged) ─────────────────────

function UploadStudyGuideForm({
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
  }

  const disabled = !selectedFile || !title.trim() || uploading;

  return (
    <section className="gv-cdp-card" aria-labelledby="gv-cdp-up" style={{ maxWidth: 520, width: '100%', margin: '0 auto' }}>
      <div>
        <h3 id="gv-cdp-up" style={{ ...TYPE.card, margin: '0 0 16px' }}>Upload Study Guide</h3>

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
          <button type="button" onClick={onClose} disabled={uploading} className="focus:outline-none gv-lift" style={{ flex: 1, border: '1.5px solid #DDD4C0', borderRadius: 12, padding: '0', minHeight: 48, fontFamily: OUTFIT, fontWeight: 700, fontSize: 15, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}>
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
    </section>
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
            futureOnly
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

// ── Copy Settings From (prompt 139): a view in the same pop-up ─────────────

/** Every setting of a committee, written out in full for the copy view. A
 *  committee's due date only while its papers are open. */
function copyCardLines(c: CommitteeDoc, guideTitle: string | null, now: number): string[] {
  const at = c.study_guides_publish_at;
  return [
    guideTitle ? `Study guide: ${guideTitle}` : 'No study guide',
    !at ? 'No release date' : new Date(at).getTime() <= now ? `Released ${formatDate(at)}` : `Releases ${formatDate(at)}`,
    c.pp_submissions_enabled ? 'Position papers open' : 'Position papers closed',
    ...(c.pp_submissions_enabled && c.position_paper_deadline ? [`Due ${formatDate(c.position_paper_deadline)}`] : []),
  ];
}

// ── The pop-up ───────────────────────────────────────────────────────────────

export default function CommitteeDocsPopup({
  conferenceId, conferenceSlug, committee, committees, guideTitles, initialPane, onClose, onCommitteeChange,
}: {
  conferenceId: string;
  conferenceSlug: string;
  committee: CommitteeDoc;
  /** Every committee of the conference, for "Copy from another committee". */
  committees: CommitteeDoc[];
  /** Committees that have a study guide (the copy menu says "No study guide" otherwise). */
  /** Committee id → its study guide's title (the copy view writes it out). */
  guideTitles: Map<string, string>;
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
  // The Settings tab's copy view (prompt 139): open, and the card picked.
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyPick, setCopyPick] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [ppBusy, setPpBusy] = useState(false);
  const [ppErr, setPpErr] = useState('');
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyErr, setCopyErr] = useState('');
  const ppBusyRef = useRef(false);
  const copyBusyRef = useRef(false);
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
        .select('id, country_code, status, submitted_at, reviewer_seen_at, file_url, file_name')
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

  const copySources = committees.filter(c => c.id !== committeeId);

  /** "Copy settings" in the copy view: the same one call as before. */
  async function copyFrom(source: CommitteeDoc) {
    if (copyBusyRef.current) return;
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
    setCopyOpen(false);
    setCopyPick(null);
    notifyOk(`Settings copied from ${shortName(source)}`, 'committee-docs');
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
    // The upload form is small: the pop-up shrinks to it (prompt 139).
    <AwardsSheet title={title} onClose={onClose} width={pane === 'settings' && showUploadModal && user ? 600 : 980}>
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
                deadline={committee.pp_submissions_enabled ? committee.position_paper_deadline : null}
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

      {pane === 'settings' && showUploadModal && user && (
        <UploadStudyGuideForm
          conferenceId={conferenceId}
          selectedCommitteeId={committeeId}
          userId={user.id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => { setShowUploadModal(false); void loadStudyGuides(); }}
        />
      )}

      {pane === 'settings' && !(showUploadModal && user) && copyOpen && (
        <section className="gv-cdp-copy" aria-labelledby="gv-cdp-copy-h">
          <h3 id="gv-cdp-copy-h" style={{ ...TYPE.card, margin: 0 }}>Copy Settings From</h3>
          <p style={{ ...TYPE.hint, margin: '4px 0 0' }}>
            This replaces {shortName(committee)}&apos;s study guide release date, position paper submissions and deadline. The study guide file is not copied.
          </p>
          <div className="gv-cdp-copy-list" role="radiogroup" aria-label="Committee to copy from">
            {copySources.map(c => {
              const on = copyPick === c.id;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={on} className="gv-cdp-copy-card" data-on={on || undefined}
                  onClick={() => setCopyPick(c.id)}>
                  {on && <span className="gv-cdp-copy-tick" aria-hidden><Check size={14} strokeWidth={3} /></span>}
                  <span className="flex items-start gap-3 min-w-0">
                    <CommitteeLogo c={c} size={36} />
                    <span className="min-w-0">
                      <span className="block" style={{ fontSize: TYPE_PX.body, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>{shortName(c)}</span>
                      {c.abbreviation && c.abbreviation !== c.name && (
                        <span className="block" style={{ fontSize: TYPE_PX.hint, color: INK_SOFT }}>{c.name}</span>
                      )}
                    </span>
                  </span>
                  <ul className="gv-cdp-copy-lines">
                    {copyCardLines(c, guideTitles.get(c.id) ?? null, now).map(l => <li key={l}>{l}</li>)}
                  </ul>
                </button>
              );
            })}
          </div>
          {copyErr && <p role="alert" style={{ ...TYPE.hint, color: DANGER, margin: 0 }}>{copyErr}</p>}
          <div className="gv-cdp-copy-foot">
            <button type="button" className="gv-cdp-secondary" disabled={copyBusy} onClick={() => { setCopyOpen(false); setCopyPick(null); setCopyErr(''); }}>Back</button>
            <button type="button" className="gv-cdp-primary" disabled={copyBusy || !copyPick}
              onClick={() => { const src = copySources.find(c => c.id === copyPick); if (src) void copyFrom(src); }}>
              {copyBusy ? 'Copying…' : 'Copy settings'}
            </button>
          </div>
        </section>
      )}

      {pane === 'settings' && !(showUploadModal && user) && !copyOpen && (
        <div className="flex flex-col" style={{ gap: 16 }}>
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <button type="button" className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 rounded"
              disabled={copySources.length === 0}
              title={copySources.length === 0 ? 'No other committee yet' : undefined}
              onClick={() => { setCopyErr(''); setCopyPick(null); setCopyOpen(true); }}
              style={{ ...TEXT_LINK, fontSize: TYPE_PX.body, opacity: copySources.length === 0 ? 0.45 : 1, cursor: copySources.length === 0 ? 'default' : 'pointer' }}>
              <Copy size={14} strokeWidth={2.4} aria-hidden />
              Copy from another committee
            </button>
          </div>

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
.gv-cdp-ask{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border-radius:14px;background:rgba(238,217,138,0.30);font-family:${F};font-size:14px;line-height:1.45;color:${INK}}
.gv-cdp-secondary{display:inline-flex;align-items:center;min-height:38px;padding:0 14px;border:none;border-radius:11px;background:#FFFFFF;box-shadow:inset 0 0 0 1.5px rgba(28,20,16,0.55);color:${INK};font-family:${F};font-size:14px;font-weight:700;cursor:pointer}
.gv-cdp-copy{display:flex;flex-direction:column;gap:12px;min-height:0}
.gv-cdp-copy-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;max-height:min(52vh,520px);overflow-y:auto;padding:4px}
.gv-cdp-copy-card{position:relative;display:flex;flex-direction:column;gap:8px;text-align:left;padding:14px;border:none;border-radius:16px;background:#FFFFFF;cursor:pointer;font-family:${F};
  box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.12),0 10px 22px -20px rgba(27,56,40,0.5)}
.gv-cdp-copy-card[data-on]{box-shadow:inset 0 0 0 2px ${FOREST},0 10px 22px -18px rgba(27,56,40,0.6)}
.gv-cdp-copy-card:focus{outline:none}
.gv-cdp-copy-card:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cdp-copy-tick{position:absolute;top:10px;right:10px;width:24px;height:24px;border-radius:999px;background:${FOREST};color:#FFFFFF;display:inline-flex;align-items:center;justify-content:center}
.gv-cdp-copy-lines{list-style:none;margin:0;padding:0 0 0 48px;display:flex;flex-direction:column;gap:2px;font-size:13px;line-height:1.35;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-cdp-copy-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.gv-cdp-primary{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 14px;border:none;border-radius:11px;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF;font-family:${F};font-size:14px;font-weight:700;cursor:pointer}
.gv-cdp-primary:focus{outline:none}
.gv-cdp-primary:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cdp-delete{font-family:${F};font-size:14px;font-weight:700;color:${DANGER};background:none;border:none;cursor:pointer;min-height:40px;padding:0 6px}
.gv-cdp-delete:hover{text-decoration:underline}
.gv-cdp-delete:disabled{opacity:0.5;cursor:default}
`;
