'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Upload, X, Check } from 'lucide-react';
import Link from 'next/link';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getFlagUrl } from '@/lib/countries';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CommitteeTab {
  id: string;
  name: string;
  abbreviation: string | null;
  position_paper_deadline: string | null;
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

interface PositionPaper {
  id: string;
  country_code: string;
  country_name: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  status: string;
  chair_feedback: string | null;
  reviewed_at: string | null;
  notify_on_feedback: boolean;
  submitted_at: string;
  profiles: { display_name: string; email: string } | null;
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

// ── Modal overlay ──────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ── Paper status badge ─────────────────────────────────────────────────────────

function PaperStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    submitted: { bg: 'rgba(238,217,138,0.2)',  color: '#B8844A' },
    reviewed:  { bg: 'rgba(154,138,120,0.15)', color: '#9A8A78' },
    approved:  { bg: 'rgba(61,122,82,0.12)',   color: '#3D7A52' },
    rejected:  { bg: 'rgba(139,32,32,0.1)',    color: '#8B2020' },
  };
  const s = map[status.toLowerCase()] ?? map.submitted;
  return (
    <span style={{
      backgroundColor: s.bg, color: s.color,
      fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700,
      padding: '2px 8px', borderRadius: 9999, letterSpacing: '0.08em',
    }}>
      {status.toUpperCase()}
    </span>
  );
}

// ── UploadStudyGuideModal ──────────────────────────────────────────────────────

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
    if (!selectedFile || !title.trim()) return;
    setUploading(true);
    setUploadError('');
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const path = `${conferenceId}/${selectedCommitteeId}/${Date.now()}_${selectedFile.name}`;
    const { error: storageError } = await supabase.storage
      .from('study-guides')
      .upload(path, selectedFile, { contentType: 'application/pdf' });
    if (storageError) { setUploadError('Upload failed. Please try again.'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('study-guides').getPublicUrl(path);
    await supabase.from('study_guides').insert({
      conference_committee_id: selectedCommitteeId,
      uploaded_by: userId,
      title: title.trim(),
      file_url: publicUrl,
      file_name: selectedFile.name,
      file_size_bytes: selectedFile.size,
      mime_type: 'application/pdf',
      is_published: false,
    });
    setUploading(false);
    onUploaded();
    onClose();
  }

  const disabled = !selectedFile || !title.trim() || uploading;

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 16, padding: 24, maxWidth: 448, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: '#1C1410' }}>Upload Study Guide</h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9A8A78', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Title *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. UNHRC Background Guide 2026"
            style={{ width: '100%', border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none', fontFamily: "'Outfit', sans-serif", boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9A8A78', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
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
              <p style={{ fontSize: 13, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", marginBottom: 4 }}>Click to select PDF</p>
              <p style={{ fontSize: 11, color: '#C8BFB0', fontFamily: "'Outfit', sans-serif" }}>Max 5MB</p>
            </div>
          ) : (
            <div style={{ border: '1px solid rgba(61,122,82,0.3)', borderRadius: 12, padding: '12px 16px', backgroundColor: 'rgba(61,122,82,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Check size={16} style={{ color: '#3D7A52', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</p>
                <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>{formatFileSize(selectedFile.size)}</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="focus:outline-none" style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0 }}>
                Change file
              </button>
            </div>
          )}
          {fileError && <p style={{ fontSize: 11, color: '#8B2020', fontFamily: "'Outfit', sans-serif", marginTop: 4 }}>{fileError}</p>}
        </div>

        {uploadError && <p style={{ fontSize: 12, color: '#8B2020', fontFamily: "'Outfit', sans-serif", marginBottom: 12 }}>{uploadError}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="focus:outline-none" style={{ flex: 1, border: '1.5px solid #DDD4C0', borderRadius: 12, padding: '10px 0', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}>
            CANCEL
          </button>
          <button
            onClick={handleUpload}
            disabled={disabled}
            className="focus:outline-none"
            style={{ flex: 1, border: 'none', borderRadius: 12, padding: '10px 0', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, backgroundColor: disabled ? '#DDD4C0' : '#1B3828', color: disabled ? '#9A8A78' : '#EED98A', cursor: disabled ? 'default' : 'pointer' }}
          >
            {uploading ? 'UPLOADING...' : 'UPLOAD'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── SetDeadlineModal ───────────────────────────────────────────────────────────

function SetDeadlineModal({
  selectedCommitteeId, currentDeadline, onClose, onSaved,
}: {
  selectedCommitteeId: string;
  currentDeadline: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const [value, setValue] = useState(currentDeadline ? currentDeadline.slice(0, 16) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('conference_committees').update({ position_paper_deadline: value || null }).eq('id', selectedCommitteeId);
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: '#1C1410' }}>Set Submission Deadline</h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9A8A78', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          Deadline
        </label>
        <input
          type="datetime-local"
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{ width: '100%', border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none', fontFamily: "'Outfit', sans-serif", marginBottom: 16, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="focus:outline-none" style={{ flex: 1, border: '1.5px solid #DDD4C0', borderRadius: 12, padding: '10px 0', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}>
            CANCEL
          </button>
          <button onClick={handleSave} disabled={saving} className="focus:outline-none" style={{ flex: 1, border: 'none', borderRadius: 12, padding: '10px 0', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, backgroundColor: saving ? '#DDD4C0' : '#1B3828', color: saving ? '#9A8A78' : '#EED98A', cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── DocumentsPage ──────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { conference } = useManage();
  const { user, session } = useAuth();

  const [committees, setCommittees] = useState<CommitteeTab[]>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string | null>(null);
  const [studyGuides, setStudyGuides] = useState<StudyGuide[]>([]);
  const [positionPapers, setPositionPapers] = useState<PositionPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [feedbackEditing, setFeedbackEditing] = useState<Record<string, boolean>>({});
  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const didSetInitialTab = useRef(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadCommittees = useCallback(async () => {
    if (!conference) return [];
    if (!session) return [];
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation, position_paper_deadline, notification_email')
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

  const loadStudyGuides = useCallback(async () => {
    if (!selectedCommitteeId) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('study_guides')
      .select('id, title, file_url, file_name, file_size_bytes, is_published, published_at, created_at')
      .eq('conference_committee_id', selectedCommitteeId)
      .order('created_at', { ascending: false });
    setStudyGuides((data ?? []) as StudyGuide[]);
  }, [selectedCommitteeId]);

  const loadPositionPapers = useCallback(async () => {
    if (!selectedCommitteeId) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('position_papers')
      .select(`
        id, country_code, country_name, file_url, file_name, file_size_bytes,
        status, chair_feedback, reviewed_at, notify_on_feedback, submitted_at,
        profiles (display_name, email)
      `)
      .eq('conference_committee_id', selectedCommitteeId)
      .order('submitted_at', { ascending: false });
    setPositionPapers((data ?? []) as unknown as PositionPaper[]);
  }, [selectedCommitteeId]);

  useEffect(() => {
    loadStudyGuides();
    loadPositionPapers();
    setFilterStatus('ALL');
    setFeedbackEditing({});
    setFeedbackTexts({});
  }, [loadStudyGuides, loadPositionPapers]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handlePublishGuide(guideId: string, publish: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('study_guides').update({
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    }).eq('id', guideId);
    await loadStudyGuides();
  }

  async function handleDeleteGuide(guideId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('study_guides').delete().eq('id', guideId);
    await loadStudyGuides();
  }

  async function updatePaperStatus(paperId: string, status: string) {
    if (!user) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('position_papers').update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', paperId);
    await loadPositionPapers();
  }

  async function saveFeedback(paperId: string) {
    if (!user) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('position_papers').update({
      chair_feedback: feedbackTexts[paperId] ?? '',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', paperId);
    setFeedbackEditing(prev => ({ ...prev, [paperId]: false }));
    await loadPositionPapers();
  }

  function toggleFeedbackEditor(paperId: string, existingFeedback: string | null) {
    if (!feedbackEditing[paperId]) {
      setFeedbackTexts(prev => ({ ...prev, [paperId]: existingFeedback ?? '' }));
    }
    setFeedbackEditing(prev => ({ ...prev, [paperId]: !prev[paperId] }));
  }

  if (!conference) return null;

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selectedCommittee = committees.find(c => c.id === selectedCommitteeId) ?? null;
  const totalCount = positionPapers.length;
  const approvedCount = positionPapers.filter(p => p.status === 'approved').length;
  const pendingCount = positionPapers.filter(p => p.status === 'submitted').length;
  const rejectedCount = positionPapers.filter(p => p.status === 'rejected').length;
  const filteredPapers = filterStatus === 'ALL'
    ? positionPapers
    : positionPapers.filter(p => p.status.toUpperCase() === filterStatus);

  const ghostBtn: React.CSSProperties = {
    border: '1px solid #DDD4C0', borderRadius: 8, padding: '6px 12px',
    fontSize: 11, fontFamily: "'Outfit', sans-serif", fontWeight: 700,
    color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer',
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9A8A78', letterSpacing: '0.12em', marginBottom: 4 }}>
        {conference.acronym} / Documents
      </p>
      <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 24, color: '#1C1410', marginBottom: 24 }}>
        Documents
      </h1>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && committees.length === 0 && (
        <div style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 16, padding: 40, textAlign: 'center' }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: '#1C1410', marginBottom: 6 }}>No committees yet</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: '#9A8A78', marginBottom: 20 }}>Add committees before managing documents.</p>
          <Link
            href={`/manage/${conference.slug}/committees`}
            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: '#EED98A', backgroundColor: '#1B3828', borderRadius: 10, padding: '8px 20px', textDecoration: 'none', display: 'inline-block' }}
          >
            ADD COMMITTEES →
          </Link>
        </div>
      )}

      {!loading && committees.length > 0 && (
        <>
          {/* Committee tabs */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 24 }}>
            {committees.map(c => {
              const isActive = c.id === selectedCommitteeId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCommitteeId(c.id)}
                  className="focus:outline-none flex-shrink-0"
                  style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600,
                    padding: '8px 16px', borderRadius: 9999, whiteSpace: 'nowrap', cursor: 'pointer',
                    border: isActive ? '1px solid #1B3828' : '1px solid #DDD4C0',
                    backgroundColor: isActive ? '#1B3828' : 'transparent',
                    color: isActive ? '#EED98A' : '#9A8A78',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  {c.abbreviation ?? c.name}
                </button>
              );
            })}
          </div>

          {/* ── Section A: Study Guides ─────────────────────────────────────────── */}
          <div style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: '#1C1410' }}>Study Guides</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="focus:outline-none"
                style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 12, color: '#EED98A', backgroundColor: '#1B3828', border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}
              >
                UPLOAD STUDY GUIDE
              </button>
            </div>

            {studyGuides.length === 0 ? (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: '#9A8A78', textAlign: 'center', padding: '32px 0' }}>No study guides yet.</p>
            ) : (
              <div>
                {studyGuides.map((guide, i) => (
                  <div
                    key={guide.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                      borderBottom: i < studyGuides.length - 1 ? '1px solid #F0EDE6' : 'none',
                    }}
                  >
                    <FileText size={18} style={{ color: '#9A8A78', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13, color: '#1C1410' }}>{guide.title}</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9A8A78', marginTop: 2 }}>
                        {guide.file_name} · {formatFileSize(guide.file_size_bytes)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {guide.is_published ? (
                        <>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', letterSpacing: '0.08em' }}>
                            PUBLISHED
                          </span>
                          {guide.published_at && (
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: '#9A8A78' }}>
                              {formatDate(guide.published_at)}
                            </span>
                          )}
                          <button
                            onClick={() => handlePublishGuide(guide.id, false)}
                            className="focus:outline-none"
                            style={ghostBtn}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            UNPUBLISH
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, backgroundColor: 'rgba(238,217,138,0.15)', color: '#B8844A', letterSpacing: '0.08em' }}>
                            DRAFT
                          </span>
                          <button
                            onClick={() => handlePublishGuide(guide.id, true)}
                            className="focus:outline-none"
                            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, color: '#EED98A', backgroundColor: '#1B3828', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
                          >
                            PUBLISH
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteGuide(guide.id)}
                        className="focus:outline-none"
                        style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section B: Position Papers ──────────────────────────────────────── */}
          <div style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 16, padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: '#1C1410' }}>Position Papers</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9A8A78' }}>
                  {selectedCommittee?.position_paper_deadline
                    ? `Due ${formatDate(selectedCommittee.position_paper_deadline)}`
                    : 'No deadline set'}
                </span>
                <button
                  onClick={() => setShowDeadlineModal(true)}
                  className="focus:outline-none"
                  style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, color: '#1C1410', backgroundColor: 'transparent', border: '1px solid #DDD4C0', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  SET DEADLINE
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9A8A78' }}>{totalCount} submitted</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#3D7A52' }}>{approvedCount} approved</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#B8844A' }}>{pendingCount} awaiting review</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#8B2020' }}>{rejectedCount} rejected</span>
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
                      fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
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

            {/* Papers */}
            {filteredPapers.length === 0 ? (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: '#9A8A78', textAlign: 'center', padding: '32px 0' }}>
                No position papers submitted yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredPapers.map(paper => (
                  <div key={paper.id} style={{ backgroundColor: 'rgba(27,56,40,0.02)', border: '1px solid #DDD4C0', borderRadius: 12, padding: 16 }}>
                    {/* Row 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <img src={getFlagUrl(paper.country_code)} style={{ width: 24, height: 17, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} alt={paper.country_name} />
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13, color: '#1C1410' }}>{paper.country_name}</span>
                      {paper.profiles?.display_name && (
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: '#9A8A78' }}>{paper.profiles.display_name}</span>
                      )}
                      <span style={{ marginLeft: 'auto' }}><PaperStatusBadge status={paper.status} /></span>
                    </div>

                    {/* Row 2 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9A8A78' }}>{paper.file_name}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9A8A78' }}>{formatFileSize(paper.file_size_bytes)}</span>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: '#9A8A78' }}>Submitted {formatDate(paper.submitted_at)}</span>
                      <a
                        href={paper.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: '#1B3828', textDecoration: 'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                      >
                        Download
                      </a>
                    </div>

                    {/* Row 3: actions */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0EDE6' }}>
                      {/* Status buttons */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {paper.status !== 'approved' && (
                          <button
                            onClick={() => updatePaperStatus(paper.id, 'approved')}
                            className="focus:outline-none"
                            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, color: '#3D7A52', backgroundColor: 'rgba(61,122,82,0.12)', border: '1px solid rgba(61,122,82,0.3)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
                          >
                            APPROVE
                          </button>
                        )}
                        {paper.status !== 'rejected' && (
                          <button
                            onClick={() => updatePaperStatus(paper.id, 'rejected')}
                            className="focus:outline-none"
                            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
                          >
                            REJECT
                          </button>
                        )}
                        {paper.status === 'submitted' && (
                          <button
                            onClick={() => updatePaperStatus(paper.id, 'reviewed')}
                            className="focus:outline-none"
                            style={ghostBtn}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            MARK REVIEWED
                          </button>
                        )}
                      </div>

                      {/* Feedback */}
                      <div>
                        {paper.chair_feedback && !feedbackEditing[paper.id] && (
                          <div style={{ backgroundColor: 'rgba(27,56,40,0.04)', borderLeft: '3px solid #DDD4C0', padding: '8px 12px', borderRadius: '0 6px 6px 0', marginBottom: 6 }}>
                            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: '#1C1410', fontStyle: 'italic' }}>{paper.chair_feedback}</p>
                          </div>
                        )}
                        {feedbackEditing[paper.id] ? (
                          <div>
                            <textarea
                              rows={3}
                              value={feedbackTexts[paper.id] ?? ''}
                              onChange={e => setFeedbackTexts(prev => ({ ...prev, [paper.id]: e.target.value }))}
                              placeholder="Write feedback for this delegate..."
                              style={{ width: '100%', border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none', fontFamily: "'Outfit', sans-serif", resize: 'vertical', boxSizing: 'border-box', marginBottom: 6 }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => saveFeedback(paper.id)}
                                className="focus:outline-none"
                                style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, color: '#EED98A', backgroundColor: '#1B3828', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
                              >
                                SAVE FEEDBACK
                              </button>
                              <button
                                onClick={() => setFeedbackEditing(prev => ({ ...prev, [paper.id]: false }))}
                                className="focus:outline-none"
                                style={ghostBtn}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                              >
                                CANCEL
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleFeedbackEditor(paper.id, paper.chair_feedback)}
                            className="focus:outline-none"
                            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: '#1B3828', background: 'none', border: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                          >
                            {paper.chair_feedback ? 'EDIT FEEDBACK' : 'ADD FEEDBACK'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
      {showDeadlineModal && selectedCommitteeId && selectedCommittee && (
        <SetDeadlineModal
          selectedCommitteeId={selectedCommitteeId}
          currentDeadline={selectedCommittee.position_paper_deadline}
          onClose={() => setShowDeadlineModal(false)}
          onSaved={loadCommittees}
        />
      )}
    </div>
  );
}
