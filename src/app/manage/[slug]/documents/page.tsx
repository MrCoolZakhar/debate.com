'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Upload, X, Check, LayoutGrid, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import Portal from '@/components/Portal';
import { DatePicker } from '@/components/DatePicker';
import { PillToggle } from '@/app/account/accountUi';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { useConfirmModal } from '@/components/ConfirmModal';
import { NEU, EASE, NeuPill } from '@/components/neu';
import PositionPaperRoster, { type RosterAllocation, type RosterPaper } from '@/components/PositionPaperRoster';
import { fetchMessageStubsForPapers, type PaperMessageStub } from '@/lib/positionPapers';

const OUTFIT = "'Outfit', sans-serif";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CommitteeTab {
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

interface StudyGuide {
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function isoToDatePart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function isoToTimePart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Shared card language, thick 1.5px border + layered warm shadow (rulebook F6).
const CARD_SHADOW = '0 2px 8px rgba(27,56,40,0.05), 0 12px 32px rgba(27,56,40,0.06)';

// ── Modal overlay ──────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Portal'd so the dim backdrop escapes the manage layout's `relative z-10`
  // content wrapper and covers the header/sidebar too.
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      >
        <div onClick={e => e.stopPropagation()}>{children}</div>
      </div>
    </Portal>
  );
}

// ── UploadStudyGuideModal (unchanged) ───────────────────────────────────────────

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
    const path = `${conferenceId}/${selectedCommitteeId}/${Date.now()}_${selectedFile.name}`;
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
    <ModalOverlay onClose={onClose}>
      <div style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16, padding: 24, maxWidth: 448, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(27,56,40,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 16, color: '#1C1410' }}>Upload Study Guide</h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6E5F4E', fontFamily: OUTFIT, letterSpacing: '0.02em', marginBottom: 6 }}>
            Title *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. UNHRC Background Guide 2026"
            style={{ width: '100%', border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none', fontFamily: OUTFIT, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6E5F4E', fontFamily: OUTFIT, letterSpacing: '0.02em', marginBottom: 6 }}>
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
              <p style={{ fontSize: 13, color: '#9A8A78', fontFamily: OUTFIT, marginBottom: 4 }}>Click to select PDF</p>
              <p style={{ fontSize: 11, color: '#C8BFB0', fontFamily: OUTFIT }}>Max 5MB</p>
            </div>
          ) : (
            <div style={{ border: '1px solid rgba(61,122,82,0.3)', borderRadius: 12, padding: '12px 16px', backgroundColor: 'rgba(61,122,82,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Check size={16} style={{ color: '#3D7A52', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</p>
                <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{formatFileSize(selectedFile.size)}</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="focus:outline-none" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0 }}>
                Change file
              </button>
            </div>
          )}
          {fileError && <p style={{ fontSize: 11, color: '#8B2020', fontFamily: OUTFIT, marginTop: 4 }}>{fileError}</p>}
        </div>

        {uploadError && <p style={{ fontSize: 12, color: '#8B2020', fontFamily: OUTFIT, marginBottom: 12 }}>{uploadError}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="focus:outline-none" style={{ flex: 1, border: '1.5px solid #DDD4C0', borderRadius: 12, padding: '10px 0', fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}>
            CANCEL
          </button>
          <button
            onClick={handleUpload}
            disabled={disabled}
            className="focus:outline-none"
            style={{ flex: 1, border: 'none', borderRadius: 12, padding: '10px 0', fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, backgroundColor: disabled ? '#DDD4C0' : '#1B3828', color: disabled ? '#9A8A78' : '#EED98A', cursor: disabled ? 'default' : 'pointer' }}
          >
            {uploading ? 'UPLOADING...' : 'UPLOAD'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── DateTimeField, a DatePicker + time input committing a verified write ───────
// on every change, same recipe as the committees page's ReleaseTimePicker.

function DateTimeField({ value, onSave, placeholder }: {
  value: string | null;
  onSave: (iso: string | null) => Promise<boolean>;
  placeholder: string;
}) {
  const [datePart, setDatePart] = useState(isoToDatePart(value));
  const [timePart, setTimePart] = useState(isoToTimePart(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDatePart(isoToDatePart(value));
    setTimePart(isoToTimePart(value));
  }, [value]);

  async function commit(nextDate: string, nextTime: string) {
    const prevDate = datePart, prevTime = timePart;
    setDatePart(nextDate);
    setTimePart(nextTime);
    let iso: string | null = null;
    if (nextDate) {
      const [y, mo, da] = nextDate.split('-').map(Number);
      const [h, m] = (nextTime || '00:00').split(':').map(Number);
      iso = new Date(y, mo - 1, da, h, m).toISOString();
    }
    setSaving(true);
    setError('');
    const ok = await onSave(iso);
    setSaving(false);
    if (!ok) {
      setDatePart(prevDate);
      setTimePart(prevTime);
      setError("Couldn't save, please try again.");
    }
  }

  return (
    <div>
      <div className="flex gap-2 items-center">
        <div style={{ flex: 1, minWidth: 160 }}>
          <DatePicker
            value={datePart}
            onChange={iso => commit(iso, timePart || '00:00')}
            placeholder={placeholder}
            disabled={saving}
          />
        </div>
        <input
          type="time"
          value={timePart}
          onChange={e => commit(datePart, e.target.value)}
          disabled={saving || !datePart}
          className="focus:outline-none"
          style={{
            border: 'none', borderRadius: 12, padding: '11px 12px',
            fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600,
            color: datePart ? NEU.ink : NEU.muted, backgroundColor: NEU.base, boxShadow: NEU.inSm,
          }}
        />
        {datePart && (
          <button
            type="button"
            onClick={() => commit('', '')}
            disabled={saving}
            title="Clear"
            className="flex-shrink-0 focus:outline-none"
            style={{ color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: 11, color: '#8B2020', fontFamily: OUTFIT, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// ── Vertical committee rail ─────────────────────────────────────────────────────
// Text is the primary identifier here, a small logo or monogram is only a
// leading accent, since committees sharing the default UN logo are
// otherwise indistinguishable by icon alone. Full name available on hover.

function CommitteeRail({ committees, selectedId, onSelect }: {
  committees: CommitteeTab[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible flex-shrink-0 md:w-[220px] pb-1 md:pb-0">
      {committees.map(c => {
        const active = c.id === selectedId;
        const label = c.abbreviation || c.name;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            title={c.name}
            className="flex items-center gap-2.5 flex-shrink-0 md:w-full focus:outline-none text-left"
            style={{
              padding: '8px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
              backgroundColor: active ? NEU.base : NEU.surface,
              boxShadow: active ? `0 0 0 2px ${NEU.deepGold}, ${NEU.in}` : NEU.outSm,
              transition: `box-shadow 200ms ${EASE}`,
              minWidth: 0,
            }}
          >
            <span className="flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ width: 28, height: 28, borderRadius: 8 }}>
              {c.logo_url ? (
                <img src={c.logo_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 8 }} />
              ) : (
                <MonogramMedallion text={label} isCrisis={c.committee_type === 'crisis'} size={28} />
              )}
            </span>
            <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.ink }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// A small subheading plus one clarifying sentence, ahead of a settings
// control block so its purpose reads before its switches do.
function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13, color: '#1C1410', margin: '0 0 3px 0' }}>{title}</p>
      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#9A8A78', margin: 0, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

// ── DocumentsPage ──────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { conference } = useManage();
  const { user, session } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [committees, setCommittees] = useState<CommitteeTab[]>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string | null>(null);
  const [studyGuides, setStudyGuides] = useState<StudyGuide[]>([]);
  const [allocations, setAllocations] = useState<RosterAllocationRow[]>([]);
  const [papers, setPapers] = useState<RosterPaper[]>([]);
  const [messagesByPaper, setMessagesByPaper] = useState<Record<string, PaperMessageStub[]>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [actionError, setActionError] = useState('');
  const [papersError, setPapersError] = useState(false);
  // Ids with a write in flight, disables that row's controls (double-click guard).
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const didSetInitialTab = useRef(false);
  // Stale-response guard: bump per committee-tab switch; late responses for an
  // older tab are dropped instead of clobbering the current one.
  const paperReqSeq = useRef(0);
  const guideReqSeq = useRef(0);

  // ── Settings tab state (Position Papers + Study Guides sections) ───────────
  const [ppPerCommittee, setPpPerCommittee] = useState(false);
  const [ppGlobalDeadline, setPpGlobalDeadline] = useState<string | null>(null);
  const [sgPerCommittee, setSgPerCommittee] = useState(false);
  const [sgGlobalPublishAt, setSgGlobalPublishAt] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const { confirm, modal: confirmModal } = useConfirmModal();

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadCommittees = useCallback(async () => {
    if (!conference) return [];
    if (!session) return [];
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation, logo_url, committee_type, position_paper_deadline, pp_submissions_enabled, study_guides_publish_at, notification_email')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    const rows = (data ?? []) as CommitteeTab[];
    setCommittees(rows);
    setLoading(false);
    return rows;
  }, [conference, session?.access_token]);

  useEffect(() => {
    loadCommittees().then(rows => {
      if (rows && !didSetInitialTab.current && rows.length > 0) {
        setSelectedCommitteeId(rows[0].id);
        didSetInitialTab.current = true;
      }
    });
  }, [loadCommittees]);

  const loadConferenceSettings = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conferences')
      .select('pp_deadline_per_committee, position_paper_deadline, sg_publish_per_committee, study_guides_publish_at')
      .eq('id', conference.id)
      .maybeSingle();
    const row = data as {
      pp_deadline_per_committee: boolean | null; position_paper_deadline: string | null;
      sg_publish_per_committee: boolean | null; study_guides_publish_at: string | null;
    } | null;
    setPpPerCommittee(row?.pp_deadline_per_committee ?? false);
    setPpGlobalDeadline(row?.position_paper_deadline ?? null);
    setSgPerCommittee(row?.sg_publish_per_committee ?? false);
    setSgGlobalPublishAt(row?.study_guides_publish_at ?? null);
    setSettingsLoaded(true);
  }, [conference, session?.access_token]);

  useEffect(() => { loadConferenceSettings(); }, [loadConferenceSettings]);

  const loadStudyGuides = useCallback(async () => {
    if (!selectedCommitteeId) return;
    if (!session) return;
    const seq = ++guideReqSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('study_guides')
      .select('id, title, file_url, file_name, file_size_bytes, is_published, published_at, created_at')
      .eq('conference_committee_id', selectedCommitteeId)
      .order('created_at', { ascending: false });
    if (seq !== guideReqSeq.current) return; // stale response, a newer load superseded this one
    setStudyGuides((data ?? []) as StudyGuide[]);
  }, [selectedCommitteeId]);

  const loadPapers = useCallback(async () => {
    if (!selectedCommitteeId) return;
    if (!session) return;
    const seq = ++paperReqSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const [{ data: allocData, error: allocError }, { data: paperData, error: paperError }] = await Promise.all([
      supabase
        .from('conference_allocations')
        .select('country_code, user_id, profiles (display_name), applications:application_id (invited_name)')
        .eq('conference_committee_id', selectedCommitteeId),
      supabase
        .from('position_papers')
        .select('id, country_code, status, submitted_at, reviewer_seen_at')
        .eq('conference_committee_id', selectedCommitteeId),
    ]);
    if (seq !== paperReqSeq.current) return; // stale response
    if (allocError || paperError) {
      console.error('[DocumentsPage] roster load failed:', allocError || paperError);
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
  }, [selectedCommitteeId]);

  useEffect(() => {
    loadStudyGuides();
    loadPapers();
    setFilterStatus('ALL');
  }, [loadStudyGuides, loadPapers]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  // Optimistic-first pattern (house style, AGENTS.md Rule 5): mutate local
  // state immediately, persist in the background, roll back + surface an
  // inline error if the write fails.
  function handlePublishGuide(guideId: string, publish: boolean) {
    if (!session || busyIds.has(guideId)) return;
    const previous = studyGuides;
    const publishedAt = publish ? new Date().toISOString() : null;
    setStudyGuides(prev => prev.map(g => g.id === guideId ? { ...g, is_published: publish, published_at: publishedAt } : g));
    setActionError('');
    markBusy(guideId, true);
    const supabase = getAuthedClient(session.access_token);
    supabase.from('study_guides').update({
      is_published: publish,
      published_at: publishedAt,
    }).eq('id', guideId).then(({ error }) => {
      markBusy(guideId, false);
      if (error) {
        setStudyGuides(previous);
        setActionError("Couldn't save, the change was reverted.");
      }
    });
  }

  // A guide that's only visible because its committee's release schedule
  // already passed can't be hidden by flipping its own is_published (it was
  // never true), the schedule itself is what's showing it. Clearing the
  // schedule hides every guide in the committee relying on it, hence the
  // confirm step.
  async function handleUnscheduleGuide(guideId: string, committeeId: string) {
    if (!session || busyIds.has(guideId)) return;
    const { confirmed } = await confirm({
      title: 'Unpublish this guide?',
      body: 'This clears the scheduled release for this committee and hides its guides.',
      confirmLabel: 'Unpublish',
      danger: true,
    });
    if (!confirmed) return;
    handlePublishGuide(guideId, false);
    await savePerCommitteeSgPublishAt(committeeId, null);
  }

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

  // Per-committee pp_submissions_enabled toggle, optimistic.
  function togglePpEnabled(committeeId: string, enabled: boolean) {
    if (!session) return;
    const previous = committees;
    setCommittees(prev => prev.map(c => c.id === committeeId ? { ...c, pp_submissions_enabled: enabled } : c));
    setSettingsError('');
    const supabase = getAuthedClient(session.access_token);
    supabase.from('conference_committees').update({ pp_submissions_enabled: enabled }).eq('id', committeeId).then(({ error }) => {
      if (error) {
        setCommittees(previous);
        setSettingsError("Couldn't save that toggle. Please try again.");
      }
    });
  }

  async function togglePpPerCommittee(next: boolean) {
    if (!session || !conference) return;
    const previous = ppPerCommittee;
    setPpPerCommittee(next);
    setSettingsError('');
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.rpc('set_conference_pp_deadline', {
      p_conference_id: conference.id,
      p_per_committee: next,
      p_deadline: next ? null : ppGlobalDeadline,
    });
    if (error) {
      setPpPerCommittee(previous);
      setSettingsError("Couldn't save that setting. Please try again.");
      return;
    }
    if (!next) await loadCommittees();
  }

  async function saveGlobalPpDeadline(iso: string | null): Promise<boolean> {
    if (!session || !conference) return false;
    setPpGlobalDeadline(iso);
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.rpc('set_conference_pp_deadline', {
      p_conference_id: conference.id,
      p_per_committee: false,
      p_deadline: iso,
    });
    if (error) return false;
    await loadCommittees();
    return true;
  }

  async function savePerCommitteePpDeadline(committeeId: string, iso: string | null): Promise<boolean> {
    if (!session) return false;
    const previous = committees;
    setCommittees(prev => prev.map(c => c.id === committeeId ? { ...c, position_paper_deadline: iso } : c));
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('conference_committees').update({ position_paper_deadline: iso }).eq('id', committeeId);
    if (error) { setCommittees(previous); return false; }
    return true;
  }

  async function toggleSgPerCommittee(next: boolean) {
    if (!session || !conference) return;
    const previous = sgPerCommittee;
    setSgPerCommittee(next);
    setSettingsError('');
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.rpc('set_conference_sg_publish', {
      p_conference_id: conference.id,
      p_per_committee: next,
      p_publish_at: next ? null : sgGlobalPublishAt,
    });
    if (error) {
      setSgPerCommittee(previous);
      setSettingsError("Couldn't save that setting. Please try again.");
      return;
    }
    if (!next) await loadCommittees();
  }

  async function saveGlobalSgPublishAt(iso: string | null): Promise<boolean> {
    if (!session || !conference) return false;
    setSgGlobalPublishAt(iso);
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.rpc('set_conference_sg_publish', {
      p_conference_id: conference.id,
      p_per_committee: false,
      p_publish_at: iso,
    });
    if (error) return false;
    await loadCommittees();
    return true;
  }

  async function savePerCommitteeSgPublishAt(committeeId: string, iso: string | null): Promise<boolean> {
    if (!session) return false;
    const previous = committees;
    setCommittees(prev => prev.map(c => c.id === committeeId ? { ...c, study_guides_publish_at: iso } : c));
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('conference_committees').update({ study_guides_publish_at: iso }).eq('id', committeeId);
    if (error) { setCommittees(previous); return false; }
    return true;
  }

  if (!conference) return null;

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selectedCommittee = committees.find(c => c.id === selectedCommitteeId) ?? null;
  const totalCount = papers.length;
  const approvedCount = papers.filter(p => p.status === 'approved').length;
  const pendingCount = papers.filter(p => p.status === 'submitted').length;
  const rejectedCount = papers.filter(p => p.status === 'rejected').length;

  const rosterAllocations: RosterAllocation[] = allocations.map(a => ({
    country_code: a.country_code, user_id: a.user_id,
    display_name: a.profiles?.display_name ?? null,
    invited_name: a.applications?.invited_name ?? null,
  }));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, color: '#9A8A78', letterSpacing: '0.12em', marginBottom: 4 }}>
        {conference.acronym} / Documents
      </p>
      <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 24, color: '#1C1410', marginBottom: 24 }}>
        Documents
      </h1>

      {actionError && (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
          {actionError}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && committees.length === 0 && (
        <div style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <span className="inline-flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(150deg, rgba(27,56,40,0.1), rgba(27,56,40,0.04))', border: '1px solid rgba(27,56,40,0.18)', marginBottom: 16 }}>
            <FileText size={26} strokeWidth={1.8} style={{ color: '#1B3828' }} />
          </span>
          <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, color: '#1C1410', marginBottom: 6 }}>No committees yet</p>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78', marginBottom: 20 }}>Add committees before managing documents.</p>
          <Link
            href={`/manage/${conference.slug}/committees`}
            style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: '#EED98A', backgroundColor: '#1B3828', borderRadius: 10, padding: '8px 20px', textDecoration: 'none', display: 'inline-block' }}
          >
            ADD COMMITTEES →
          </Link>
        </div>
      )}

      {!loading && committees.length > 0 && (
        <>
          {/* Tab switcher, same neumorphic pill pattern as the committees page */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <NeuPill active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
              <LayoutGrid size={12} strokeWidth={2.5} />
              OVERVIEW
            </NeuPill>
            <NeuPill active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              <SettingsIcon size={12} strokeWidth={2.5} />
              SETTINGS
            </NeuPill>
          </div>

          {activeTab === 'overview' && (
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <CommitteeRail committees={committees} selectedId={selectedCommitteeId} onSelect={setSelectedCommitteeId} />

              <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
                {/* ── Section A: Study Guides ─────────────────────────────── */}
                <div style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16, padding: 24, boxShadow: CARD_SHADOW }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <p style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 15, color: '#1C1410' }}>Study Guides</p>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="focus:outline-none"
                      style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, color: '#EED98A', backgroundColor: '#1B3828', border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}
                    >
                      UPLOAD STUDY GUIDE
                    </button>
                  </div>

                  {studyGuides.length === 0 ? (
                    <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78', textAlign: 'center', padding: '32px 0' }}>No study guides yet.</p>
                  ) : (
                    <div>
                      {studyGuides.map((guide, i) => {
                        const releaseAt = selectedCommittee?.study_guides_publish_at ?? null;
                        const released = !guide.is_published && !!releaseAt && new Date(releaseAt).getTime() <= Date.now();
                        const scheduled = !guide.is_published && !!releaseAt && new Date(releaseAt).getTime() > Date.now();
                        return (
                        <div
                          key={guide.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                            borderBottom: i < studyGuides.length - 1 ? '1px solid #F0EDE6' : 'none',
                          }}
                        >
                          <FileText size={18} style={{ color: '#9A8A78', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 13, color: '#1C1410' }}>{guide.title}</p>
                            <p style={{ fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#9A8A78', marginTop: 2 }}>
                              {guide.file_name} · {formatFileSize(guide.file_size_bytes)}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {guide.is_published ? (
                              <>
                                <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', letterSpacing: '0.08em' }}>
                                  PUBLISHED
                                </span>
                                {guide.published_at && (
                                  <span style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78' }}>
                                    {formatDate(guide.published_at)}
                                  </span>
                                )}
                                <button
                                  onClick={() => handlePublishGuide(guide.id, false)}
                                  title={releaseAt && new Date(releaseAt).getTime() <= Date.now() ? "Won't hide it, the schedule already released it. Clear the schedule in Settings to fully unpublish." : undefined}
                                  className="focus:outline-none"
                                  style={{ border: '1px solid #DDD4C0', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontFamily: OUTFIT, fontWeight: 700, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                >
                                  UNPUBLISH
                                </button>
                              </>
                            ) : released ? (
                              <>
                                <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', letterSpacing: '0.08em' }}>
                                  RELEASED
                                </span>
                                <button
                                  onClick={() => selectedCommitteeId && handleUnscheduleGuide(guide.id, selectedCommitteeId)}
                                  className="focus:outline-none"
                                  style={{ border: '1px solid #DDD4C0', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontFamily: OUTFIT, fontWeight: 700, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                >
                                  UNPUBLISH
                                </button>
                              </>
                            ) : (
                              <>
                                <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, backgroundColor: 'rgba(238,217,138,0.15)', color: '#B8844A', letterSpacing: '0.08em' }}>
                                  DRAFT
                                </span>
                                {scheduled && (
                                  <span style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78' }}>
                                    Releases {formatDate(releaseAt!)}
                                  </span>
                                )}
                                <button
                                  onClick={() => handlePublishGuide(guide.id, true)}
                                  className="focus:outline-none"
                                  style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11, color: '#EED98A', backgroundColor: '#1B3828', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
                                >
                                  PUBLISH
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteGuide(guide.id)}
                              className="focus:outline-none"
                              style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, background: 'none', border: 'none', cursor: 'pointer' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                            >
                              DELETE
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Section B: Position Papers ──────────────────────────── */}
                <div style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderTop: '2.5px solid #1B3828', borderRadius: 16, padding: 24, boxShadow: CARD_SHADOW }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <p style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 15, color: '#1C1410' }}>Position Papers</p>
                    <span style={{ fontFamily: OUTFIT, fontWeight: 500, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#9A8A78' }}>
                      {selectedCommittee?.position_paper_deadline
                        ? `Due ${formatDate(selectedCommittee.position_paper_deadline)}`
                        : 'No deadline set'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#9A8A78' }}>{totalCount} submitted</span>
                    <span style={{ fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#3D7A52' }}>{approvedCount} approved</span>
                    <span style={{ fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#B8844A' }}>{pendingCount} awaiting review</span>
                    <span style={{ fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#8B2020' }}>{rejectedCount} rejected</span>
                  </div>

                  {/* Filter pills */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {['ALL', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED'].map(f => {
                      const isActive = filterStatus === f;
                      return (
                        <button
                          key={f}
                          onClick={() => setFilterStatus(f)}
                          className="focus:outline-none"
                          style={{
                            fontFamily: OUTFIT, fontSize: 10, fontWeight: 700,
                            padding: '5px 12px', borderRadius: 9999, cursor: 'pointer', letterSpacing: '0.06em',
                            border: isActive ? '1px solid #1B3828' : '1px solid #DDD4C0',
                            backgroundColor: isActive ? '#1B3828' : 'transparent',
                            color: isActive ? '#EED98A' : '#9A8A78',
                          }}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>

                  {papersError ? (
                    <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', textAlign: 'center', padding: '32px 0' }}>
                      Couldn&apos;t load position papers.
                    </p>
                  ) : (
                    <PositionPaperRoster
                      conferenceSlug={conference.slug}
                      currentUserId={user?.id ?? ''}
                      deadline={selectedCommittee?.position_paper_deadline ?? null}
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
            </div>
          )}

          {activeTab === 'settings' && settingsLoaded && (
            <div className="flex flex-col gap-6" style={{ maxWidth: 640 }}>
              {settingsError && (
                <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px' }}>
                  {settingsError}
                </p>
              )}

              {/* Position Papers settings */}
              <div style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16, padding: 24, boxShadow: CARD_SHADOW }}>
                <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 10, letterSpacing: '0.14em', color: '#B6871F', textTransform: 'uppercase', margin: '0 0 16px 0' }}>
                  Position Papers
                </p>

                <SectionIntro title="Submissions" description="Choose which committees delegates can submit position papers for." />
                <div className="flex flex-col gap-2.5 mb-6">
                  {committees.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                      <div className="min-w-0">
                        <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: NEU.ink, margin: 0 }}>
                          {c.abbreviation || c.name}
                        </p>
                        <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, margin: '2px 0 0 0' }}>
                          {c.pp_submissions_enabled ? 'Submissions open' : 'Submissions closed'}
                        </p>
                      </div>
                      <PillToggle value={c.pp_submissions_enabled} onChange={v => togglePpEnabled(c.id, v)} />
                    </div>
                  ))}
                </div>

                <div className="pt-4" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                  <SectionIntro title="Deadline" description="Set when position paper submissions are due, the same time for every committee or a different one for each." />
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span style={{ fontFamily: OUTFIT, fontSize: 13.5, color: '#1C1410', fontWeight: 600 }}>
                      Different Position Paper Deadline per Committee
                    </span>
                    <PillToggle value={ppPerCommittee} onChange={togglePpPerCommittee} />
                  </div>

                  {ppPerCommittee ? (
                    <div className="flex flex-col gap-2.5">
                      {committees.map(c => (
                        <div key={c.id} className="flex items-center gap-3 flex-wrap rounded-xl px-4 py-3" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                          <span className="truncate" style={{ width: 140, flexShrink: 0, fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink }}>
                            {c.abbreviation || c.name}
                          </span>
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <DateTimeField value={c.position_paper_deadline} onSave={iso => savePerCommitteePpDeadline(c.id, iso)} placeholder="No deadline" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DateTimeField value={ppGlobalDeadline} onSave={saveGlobalPpDeadline} placeholder="No deadline" />
                  )}
                </div>
              </div>

              {/* Study Guides settings */}
              <div style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16, padding: 24, boxShadow: CARD_SHADOW }}>
                <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 10, letterSpacing: '0.14em', color: '#B6871F', textTransform: 'uppercase', margin: '0 0 16px 0' }}>
                  Study Guides
                </p>

                <SectionIntro title="Release" description="Choose when study guides become visible to delegates, the same time for every committee or a different one for each." />
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span style={{ fontFamily: OUTFIT, fontSize: 13.5, color: '#1C1410', fontWeight: 600 }}>
                    Different Study Guide Release per Committee
                  </span>
                  <PillToggle value={sgPerCommittee} onChange={toggleSgPerCommittee} />
                </div>

                {sgPerCommittee ? (
                  <div className="flex flex-col gap-2.5">
                    {committees.map(c => (
                      <div key={c.id} className="flex items-center gap-3 flex-wrap rounded-xl px-4 py-3" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                        <span className="truncate" style={{ width: 140, flexShrink: 0, fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink }}>
                          {c.abbreviation || c.name}
                        </span>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <DateTimeField value={c.study_guides_publish_at} onSave={iso => savePerCommitteeSgPublishAt(c.id, iso)} placeholder="No scheduled release" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <DateTimeField value={sgGlobalPublishAt} onSave={saveGlobalSgPublishAt} placeholder="No scheduled release" />
                )}
                <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#9A8A78', marginTop: 12, lineHeight: 1.6 }}>
                  A guide becomes visible to delegates once it is manually published, or once its committee&apos;s release time passes, whichever comes first. The PUBLISH button on a guide is still there for an early, manual release. Clear a schedule here if you need to pull an already-released draft back out of sight.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showUploadModal && selectedCommitteeId && user && (
        <UploadStudyGuideModal
          conferenceId={conference.id}
          selectedCommitteeId={selectedCommitteeId}
          userId={user.id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={loadStudyGuides}
        />
      )}
      {confirmModal}
    </div>
  );
}
