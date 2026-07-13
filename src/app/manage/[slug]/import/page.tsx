'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download, Upload as UploadIcon, ArrowLeft, Check,
  AlertTriangle, Mail, Loader2, CircleCheck, CircleX,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useConfirmModal } from '@/components/ConfirmModal';
import { FlagImg } from '@/components/FlagImg';
import {
  buildImportTemplateCSV, parseImportFile, classifyImportRows, summarizeRows,
  type ClassifiedImportRow, type CommitteeLite, type ImportableRole,
} from '@/lib/applicantImport';
import { queueImportJoinInviteEmails } from '@/lib/emailEvents';

const OUTFIT = "'Outfit', sans-serif";

// ── Pool accounting (mirrors applications/page.tsx) ─────────────────────────

type Pool = 'delegate' | 'advisor';
const POOL_SPOTS_COLUMN: Record<Pool, 'spots_purchased' | 'advisor_spots_purchased'> = {
  delegate: 'spots_purchased',
  advisor: 'advisor_spots_purchased',
};
function poolForRole(role: ImportableRole): Pool | null {
  if (role === 'delegate' || role === 'head-delegate') return 'delegate';
  if (role === 'faculty-advisor') return 'advisor';
  return null;
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    delegate: 'Delegate', 'head-delegate': 'Head Delegate',
    'faculty-advisor': 'Faculty Advisor', observer: 'Observer',
  };
  return map[role] ?? role;
}

// ── Row outcome (post-execute) ──────────────────────────────────────────────

type RowOutcome = 'imported' | 'imported-no-allocation' | 'skipped';

interface ResultRow {
  row: ClassifiedImportRow;
  outcome: RowOutcome;
  note: string | null;
}

// ── Pre-amendment repair ─────────────────────────────────────────────────────
// Imports run before conference_allocations.user_id became nullable could only
// set the application's assigned_* fields — no allocation row exists for them.
// This detects and backfills those orphans; the claim trigger (which now also
// attaches conference_allocations.user_id on signup) still owns claim behavior.

interface OrphanAllocationRow {
  id: string; // application id
  assigned_committee_id: string;
  assigned_country_code: string;
  assigned_country_name: string;
}

// ── DB context for the dry-run ──────────────────────────────────────────────

interface DbContext {
  committees: CommitteeLite[];
  existingEmailRole: Set<string>;
  existingAllocations: Set<string>;
}

async function loadContext(supabase: ReturnType<typeof getAuthedClient>, conferenceId: string): Promise<DbContext> {
  const [{ data: committees }, { data: apps }, { data: allocs }] = await Promise.all([
    supabase.from('conference_committees').select('id, name, abbreviation').eq('conference_id', conferenceId),
    supabase.from('applications').select('role, invited_email, profiles(email)').eq('conference_id', conferenceId),
    supabase.from('conference_allocations').select('conference_committee_id, country_code').eq('conference_id', conferenceId),
  ]);

  const existingEmailRole = new Set<string>();
  for (const a of (apps ?? []) as unknown as { role: string; invited_email: string | null; profiles: { email: string } | null }[]) {
    const email = (a.invited_email ?? a.profiles?.email)?.toLowerCase();
    if (email) existingEmailRole.add(`${email}|${a.role}`);
  }

  const existingAllocations = new Set<string>();
  for (const al of (allocs ?? []) as { conference_committee_id: string; country_code: string }[]) {
    existingAllocations.add(`${al.conference_committee_id}|${al.country_code}`);
  }

  return { committees: (committees ?? []) as CommitteeLite[], existingEmailRole, existingAllocations };
}

// ── Row classification pill ──────────────────────────────────────────────────

const CLASS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  valid:   { bg: 'rgba(61,122,82,0.14)',  color: '#2A5A3C', border: 'rgba(61,122,82,0.4)',  label: 'VALID' },
  warning: { bg: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: 'rgba(184,132,74,0.42)', label: 'WARNING' },
  error:   { bg: 'rgba(139,32,32,0.1)',   color: '#8B2020', border: 'rgba(139,32,32,0.3)',   label: 'ERROR' },
};

function ClassPill({ cls }: { cls: string }) {
  const s = CLASS_STYLES[cls] ?? CLASS_STYLES.warning;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: OUTFIT }}
    >
      {s.label}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Phase = 'upload' | 'parsing' | 'preview' | 'importing' | 'results';

export default function ImportPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const { confirm, modal: confirmModal } = useConfirmModal();

  const [phase, setPhase] = useState<Phase>('upload');
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [classifiedRows, setClassifiedRows] = useState<ClassifiedImportRow[]>([]);
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [lastInviteQueued, setLastInviteQueued] = useState<number | null>(null);
  const [orphanRows, setOrphanRows] = useState<OrphanAllocationRow[]>([]);
  const [repairing, setRepairing] = useState(false);
  const importingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadUnclaimedCount = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { count } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('conference_id', conference.id)
      .is('user_id', null)
      .not('invited_email', 'is', null);
    setUnclaimedCount(count ?? 0);
  }, [conference?.id, session?.access_token]);

  useEffect(() => { loadUnclaimedCount(); }, [loadUnclaimedCount]);

  // Detects applications that carry an assignment but have no matching
  // conference_allocations row — the state pre-amendment imports could leave
  // behind. Re-checked after every repair run so the banner clears itself.
  const loadOrphanAllocations = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: candidates } = await supabase
      .from('applications')
      .select('id, assigned_committee_id, assigned_country_code, assigned_country_name')
      .eq('conference_id', conference.id)
      .is('user_id', null)
      .not('assigned_committee_id', 'is', null);
    const rows = (candidates ?? []) as OrphanAllocationRow[];
    if (rows.length === 0) { setOrphanRows([]); return; }
    const { data: allocs } = await supabase
      .from('conference_allocations')
      .select('application_id')
      .eq('conference_id', conference.id)
      .in('application_id', rows.map(r => r.id));
    const covered = new Set(((allocs ?? []) as { application_id: string | null }[]).map(a => a.application_id));
    setOrphanRows(rows.filter(r => !covered.has(r.id)));
  }, [conference?.id, session?.access_token]);

  useEffect(() => { loadOrphanAllocations(); }, [loadOrphanAllocations]);

  async function handleRepairAllocations() {
    if (!conference || !session || repairing || orphanRows.length === 0) return;
    const { confirmed } = await confirm({
      title: `Repair ${orphanRows.length} allocation${orphanRows.length === 1 ? '' : 's'}?`,
      body: 'These applications were assigned a committee and country before allocation rows existed. This creates the missing allocation rows now. Any that conflict with an existing allocation are downgraded back to accepted with no allocation.',
      confirmLabel: 'Repair',
    });
    if (!confirmed) return;
    setRepairing(true);
    try {
      const supabase = getAuthedClient(session.access_token);
      for (const row of orphanRows) {
        const { error } = await supabase.from('conference_allocations').insert({
          conference_id: conference.id,
          conference_committee_id: row.assigned_committee_id,
          user_id: null,
          country_code: row.assigned_country_code,
          country_name: row.assigned_country_name,
          application_id: row.id,
        });
        if (error) {
          await supabase.from('applications').update({
            status: 'accepted',
            assigned_committee_id: null,
            assigned_country_code: null,
            assigned_country_name: null,
          }).eq('id', row.id);
        }
      }
      await loadOrphanAllocations();
    } finally {
      setRepairing(false);
    }
  }

  function handleDownloadTemplate() {
    const csv = buildImportTemplateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gavelling-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    if (!conference || !session) return;
    setFileError(null);
    setFileName(file.name);
    setPhase('parsing');
    try {
      const { rows, missingHeaders } = await parseImportFile(file);
      if (missingHeaders.length > 0) {
        setFileError(`Missing required column${missingHeaders.length > 1 ? 's' : ''}: ${missingHeaders.join(', ')}.`);
        setPhase('upload');
        return;
      }
      if (rows.length === 0) {
        setFileError('No data rows found in this file.');
        setPhase('upload');
        return;
      }
      const supabase = getAuthedClient(session.access_token);
      const ctx = await loadContext(supabase, conference.id);
      const classified = classifyImportRows(rows, ctx);
      setClassifiedRows(classified);
      setPhase('preview');
    } catch {
      setFileError('Could not read that file. Make sure it\'s a valid .csv or .xlsx.');
      setPhase('upload');
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function resetToUpload() {
    setPhase('upload');
    setClassifiedRows([]);
    setResultRows([]);
    setFileError(null);
    setFileName(null);
  }

  async function executeImport() {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const importable = classifiedRows.filter(r => r.cls !== 'error');

    // 1. Get-or-create societies by normalized name.
    const uniqueNames = Array.from(new Set(
      importable.map(r => r.resolved.societyName).filter((n): n is string => !!n)
    ));
    const societyMap = new Map<string, string>(); // normalizedName -> id
    if (uniqueNames.length > 0) {
      const normalizedNames = uniqueNames.map(n => n.trim().toLowerCase());
      const { data: existingSocieties } = await supabase
        .from('societies')
        .select('id, name_normalized')
        .eq('conference_id', conference.id)
        .in('name_normalized', normalizedNames);
      for (const s of (existingSocieties ?? []) as { id: string; name_normalized: string }[]) {
        societyMap.set(s.name_normalized, s.id);
      }
      const missing = uniqueNames.filter(n => !societyMap.has(n.trim().toLowerCase()));
      if (missing.length > 0) {
        const { data: inserted } = await supabase
          .from('societies')
          .insert(missing.map(n => ({ conference_id: conference.id, name: n, name_normalized: n.trim().toLowerCase() })))
          .select('id, name_normalized');
        for (const s of (inserted ?? []) as { id: string; name_normalized: string }[]) {
          societyMap.set(s.name_normalized, s.id);
        }
      }
    }

    // 2. Insert applications.
    const insertRows = importable.map(r => ({
      conference_id: conference.id,
      invited_email: r.resolved.email,
      invited_name: r.resolved.name,
      role: r.resolved.role,
      society_id: r.resolved.societyName ? societyMap.get(r.resolved.societyName.trim().toLowerCase()) ?? null : null,
      // Derived convenience, kept in sync — society_id IS NULL is the actual
      // source of truth, never read is_independent for logic.
      is_independent: !r.resolved.societyName,
      is_head_delegate: r.resolved.role === 'head-delegate',
      status: 'accepted',
      payment_status: r.resolved.paymentStatus,
      self_paid: r.resolved.paymentStatus === 'paid',
      submitted_at: new Date().toISOString(),
    }));

    const results: ResultRow[] = classifiedRows
      .filter(r => r.cls === 'error')
      .map(r => ({ row: r, outcome: 'skipped', note: r.reasons.join(' ') }));

    if (insertRows.length === 0) {
      setResultRows(results);
      await loadUnclaimedCount();
      return;
    }

    const { error: insertError } = await supabase.from('applications').insert(insertRows);
    if (insertError) {
      for (const r of importable) {
        results.push({ row: r, outcome: 'skipped', note: `Import failed: ${insertError.message}` });
      }
      setResultRows(results.sort((a, b) => a.row.rowNumber - b.row.rowNumber));
      return;
    }

    // Re-select to map row -> real application id (email+role pair is unique per conference).
    const emails = Array.from(new Set(importable.map(r => r.resolved.email)));
    const { data: createdApps } = await supabase
      .from('applications')
      .select('id, invited_email, role')
      .eq('conference_id', conference.id)
      .in('invited_email', emails);
    const appIdByKey = new Map<string, string>();
    for (const a of (createdApps ?? []) as { id: string; invited_email: string; role: string }[]) {
      appIdByKey.set(`${a.invited_email.toLowerCase()}|${a.role}`, a.id);
    }

    // 3. Pool increments — batched per (society, pool).
    const poolIncrements = new Map<string, number>(); // `${societyId}|${column}` -> count
    for (const r of importable) {
      if (r.resolved.paymentStatus !== 'paid' || !r.resolved.societyName || !r.resolved.role) continue;
      const societyId = societyMap.get(r.resolved.societyName.trim().toLowerCase());
      const pool = poolForRole(r.resolved.role);
      if (!societyId || !pool) continue;
      const column = POOL_SPOTS_COLUMN[pool];
      const key = `${societyId}|${column}`;
      poolIncrements.set(key, (poolIncrements.get(key) ?? 0) + 1);
    }
    for (const [key, count] of poolIncrements) {
      const [societyId, column] = key.split('|') as [string, 'spots_purchased' | 'advisor_spots_purchased'];
      const { data: soc } = await supabase.from('societies').select(column).eq('id', societyId).single();
      const current = (soc as Record<string, number> | null)?.[column] ?? 0;
      await supabase.from('societies').update({ [column]: current + count }).eq('id', societyId);
    }

    // 4. Allocations for rows with a resolved committee + country.
    for (const r of importable) {
      if (!r.resolved.role) continue;
      const appId = appIdByKey.get(`${r.resolved.email}|${r.resolved.role}`);
      if (!appId) {
        results.push({ row: r, outcome: 'skipped', note: 'Could not locate the created application.' });
        continue;
      }
      if (!r.resolved.committeeId || !r.resolved.countryCode || !r.resolved.countryName) {
        results.push({ row: r, outcome: r.cls === 'warning' ? 'imported-no-allocation' : 'imported', note: r.cls === 'warning' ? r.reasons.join(' ') : null });
        continue;
      }
      const { error: allocError } = await supabase.from('conference_allocations').insert({
        conference_id: conference.id,
        conference_committee_id: r.resolved.committeeId,
        user_id: null,
        country_code: r.resolved.countryCode,
        country_name: r.resolved.countryName,
        application_id: appId,
      });
      if (allocError) {
        results.push({
          row: r,
          outcome: 'imported-no-allocation',
          note: allocError.code === '23505' ? 'Country was allocated to someone else in the meantime.' : `Allocation failed: ${allocError.message}`,
        });
        continue;
      }
      await supabase.from('applications').update({
        status: 'assigned',
        assigned_committee_id: r.resolved.committeeId,
        assigned_country_code: r.resolved.countryCode,
        assigned_country_name: r.resolved.countryName,
      }).eq('id', appId);
      results.push({ row: r, outcome: 'imported', note: null });
    }

    setResultRows(results.sort((a, b) => a.row.rowNumber - b.row.rowNumber));
    await loadUnclaimedCount();
  }

  async function handleImportClick() {
    const importableCount = classifiedRows.filter(r => r.cls !== 'error').length;
    if (importableCount === 0) return;
    const { confirmed } = await confirm({
      title: `Import ${importableCount} row${importableCount === 1 ? '' : 's'}?`,
      body: 'This creates applications immediately (status: accepted). Rows marked ERROR will be skipped.',
      confirmLabel: 'Import',
    });
    if (!confirmed) return;
    if (importingRef.current) return;
    importingRef.current = true;
    setPhase('importing');
    try {
      await executeImport();
      setPhase('results');
    } finally {
      importingRef.current = false;
    }
  }

  async function handleSendInvites() {
    if (!conference || !session || sendingInvites) return;
    const { confirmed } = await confirm({
      title: `Send ${unclaimedCount} Gavelling invite${unclaimedCount === 1 ? '' : 's'}?`,
      body: 'Each unclaimed imported applicant gets an email inviting them to create a Gavelling account. Their registration attaches automatically once they sign up with the same email.',
      confirmLabel: 'Send Invites',
    });
    if (!confirmed) return;
    setSendingInvites(true);
    try {
      const supabase = getAuthedClient(session.access_token);
      const { data: unclaimed } = await supabase
        .from('applications')
        .select('id, invited_email, invited_name')
        .eq('conference_id', conference.id)
        .is('user_id', null)
        .not('invited_email', 'is', null);
      const recipients = (unclaimed ?? [])
        .filter((a): a is { id: string; invited_email: string; invited_name: string } => !!a.invited_email)
        .map(a => ({ applicationId: a.id, invitedEmail: a.invited_email, invitedName: a.invited_name ?? '' }));
      const result = await queueImportJoinInviteEmails(supabase, conference.id, recipients);
      setLastInviteQueued(result.queued);
      await loadUnclaimedCount();
    } finally {
      setSendingInvites(false);
    }
  }

  if (!conference) return null;

  const summary = summarizeRows(classifiedRows);
  const importableCount = summary.valid + summary.warning;

  const importedCount = resultRows.filter(r => r.outcome === 'imported').length;
  const importedNoAllocCount = resultRows.filter(r => r.outcome === 'imported-no-allocation').length;
  const skippedCount = resultRows.filter(r => r.outcome === 'skipped').length;

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.12em' }}>
            {conference.acronym} / Import
          </p>
          <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Import Applicants</h1>
        </div>
        {phase === 'preview' && (
          <button
            onClick={resetToUpload}
            className="flex items-center gap-2 rounded-xl py-2 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
          >
            <ArrowLeft size={13} />
            START OVER
          </button>
        )}
      </div>

      {/* Repair banner — pre-amendment imports with no allocation row */}
      {orphanRows.length > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
          style={{ backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.25)' }}
        >
          <AlertTriangle size={15} style={{ color: '#8B2020', flexShrink: 0 }} />
          <p className="flex-1 text-sm" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
            {orphanRows.length} imported application{orphanRows.length === 1 ? '' : 's'} {orphanRows.length === 1 ? 'is' : 'are'} assigned a committee and country with no allocation row.
          </p>
          <button
            onClick={handleRepairAllocations}
            disabled={repairing}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none flex-shrink-0"
            style={{ backgroundColor: repairing ? '#DDD4C0' : '#8B2020', color: repairing ? '#9A8A78' : '#FFFFFF', fontFamily: OUTFIT, cursor: repairing ? 'not-allowed' : 'pointer' }}
          >
            {repairing ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
            REPAIR {orphanRows.length} ALLOCATION{orphanRows.length === 1 ? '' : 'S'}
          </button>
        </div>
      )}

      {/* Persistent unclaimed-invites banner */}
      {unclaimedCount > 0 && phase !== 'results' && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
          style={{ backgroundColor: 'rgba(238,217,138,0.22)', border: '1px solid rgba(182,135,31,0.35)' }}
        >
          <Mail size={15} style={{ color: '#8A6614', flexShrink: 0 }} />
          <p className="flex-1 text-sm" style={{ color: '#6B4F12', fontFamily: OUTFIT }}>
            {unclaimedCount} imported applicant{unclaimedCount === 1 ? '' : 's'} {unclaimedCount === 1 ? 'hasn\'t' : 'haven\'t'} claimed their account yet.
          </p>
          <button
            onClick={handleSendInvites}
            disabled={sendingInvites}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none flex-shrink-0"
            style={{ backgroundColor: sendingInvites ? '#DDD4C0' : '#1B3828', color: sendingInvites ? '#9A8A78' : '#EED98A', fontFamily: OUTFIT, cursor: sendingInvites ? 'not-allowed' : 'pointer' }}
          >
            {sendingInvites ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            SEND GAVELLING INVITES ({unclaimedCount})
          </button>
        </div>
      )}
      {lastInviteQueued !== null && (
        <p className="text-xs mb-4" style={{ color: '#2A5A3C', fontFamily: OUTFIT }}>
          Queued {lastInviteQueued} invite{lastInviteQueued === 1 ? '' : 's'}.
        </p>
      )}

      {/* ── UPLOAD / PARSING ─────────────────────────────────────────────── */}
      {(phase === 'upload' || phase === 'parsing') && (
        <div className="flex flex-col gap-6 max-w-3xl">
          {/* Template download */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="font-bold text-sm mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>1. Download the template</p>
                <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Fill it in and upload it below.</p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg py-2 px-4 text-xs font-bold focus:outline-none flex-shrink-0"
                style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
              >
                <Download size={13} />
                DOWNLOAD CSV
              </button>
            </div>
            <div className="pt-4" style={{ borderTop: '1px solid #F0EDE6' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#6B5F52', fontFamily: OUTFIT, letterSpacing: '0.08em' }}>COLUMNS</p>
              <div className="flex flex-col gap-1.5" style={{ fontSize: 12, color: '#4A4238', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                <p><strong>email, name</strong>:required.</p>
                <p><strong>role</strong>:one of: delegate, head delegate, faculty advisor, observer. Chairs aren&apos;t importable. Use the chair invite flow in Committees.</p>
                <p><strong>delegation</strong>:society/school name. Blank = independent.</p>
                <p><strong>payment</strong>:paid, unpaid, or waived. Defaults to unpaid.</p>
                <p><strong>committee</strong>:an existing committee&apos;s name or abbreviation.</p>
                <p><strong>country</strong>:requires a matching committee to take effect.</p>
              </div>
            </div>
          </div>

          {/* Upload dropzone */}
          <div>
            <p className="font-bold text-sm mb-3" style={{ color: '#1C1410', fontFamily: OUTFIT }}>2. Upload your file</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl cursor-pointer transition-colors"
              style={{
                padding: '48px 24px',
                border: `1.5px dashed ${dragOver ? '#1B3828' : '#DDD4C0'}`,
                backgroundColor: dragOver ? 'rgba(61,122,82,0.06)' : '#FAF8F3',
              }}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileInputChange} />
              {phase === 'parsing' ? (
                <>
                  <Loader2 size={28} className="animate-spin" style={{ color: '#1B3828' }} />
                  <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Reading {fileName}…</p>
                </>
              ) : (
                <>
                  <UploadIcon size={28} style={{ color: '#9A8A78' }} />
                  <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Drop a .csv or .xlsx file here, or click to browse</p>
                  <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Nothing is written until you confirm the import.</p>
                </>
              )}
            </div>
            {fileError && (
              <div className="flex items-center gap-2 mt-3 rounded-xl px-4 py-2.5" style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)' }}>
                <AlertTriangle size={14} style={{ color: '#8B2020', flexShrink: 0 }} />
                <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{fileError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PREVIEW (dry-run) ────────────────────────────────────────────── */}
      {phase === 'preview' && (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap gap-3 mb-5">
            <SummaryStat label="Valid" value={summary.valid} tone="valid" />
            <SummaryStat label="Warnings" value={summary.warning} tone="warning" />
            <SummaryStat label="Errors" value={summary.error} tone="error" />
          </div>

          <RowTable rows={classifiedRows} />

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleImportClick}
              disabled={importableCount === 0}
              className="inline-flex items-center gap-2 rounded-xl py-2.5 px-6 text-sm font-bold focus:outline-none"
              style={{
                backgroundColor: importableCount === 0 ? '#DDD4C0' : '#1B3828',
                color: importableCount === 0 ? '#9A8A78' : '#EED98A',
                fontFamily: OUTFIT, cursor: importableCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Check size={15} />
              Import {importableCount} row{importableCount === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}

      {/* ── IMPORTING ────────────────────────────────────────────────────── */}
      {phase === 'importing' && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: '#1B3828' }} />
          <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Importing…</p>
        </div>
      )}

      {/* ── RESULTS ──────────────────────────────────────────────────────── */}
      {phase === 'results' && (
        <>
          <div className="flex flex-wrap gap-3 mb-5">
            <SummaryStat label="Imported" value={importedCount} tone="valid" />
            <SummaryStat label="Imported, no allocation" value={importedNoAllocCount} tone="warning" />
            <SummaryStat label="Skipped" value={skippedCount} tone="error" />
          </div>

          {unclaimedCount > 0 && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
              style={{ backgroundColor: 'rgba(238,217,138,0.22)', border: '1px solid rgba(182,135,31,0.35)' }}
            >
              <Mail size={15} style={{ color: '#8A6614', flexShrink: 0 }} />
              <p className="flex-1 text-sm" style={{ color: '#6B4F12', fontFamily: OUTFIT }}>
                {unclaimedCount} of the imported applicants don&apos;t have a Gavelling account yet.
              </p>
              <button
                onClick={handleSendInvites}
                disabled={sendingInvites}
                className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none flex-shrink-0"
                style={{ backgroundColor: sendingInvites ? '#DDD4C0' : '#1B3828', color: sendingInvites ? '#9A8A78' : '#EED98A', fontFamily: OUTFIT, cursor: sendingInvites ? 'not-allowed' : 'pointer' }}
              >
                {sendingInvites ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                SEND GAVELLING INVITES ({unclaimedCount})
              </button>
            </div>
          )}

          <ResultTable rows={resultRows} />

          <button
            onClick={resetToUpload}
            className="inline-flex items-center gap-2 rounded-xl py-2.5 px-6 text-sm font-bold focus:outline-none mt-6"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
          >
            <UploadIcon size={14} />
            IMPORT ANOTHER FILE
          </button>
        </>
      )}

      {confirmModal}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'valid' | 'warning' | 'error' }) {
  const s = CLASS_STYLES[tone];
  return (
    <div className="rounded-xl px-4 py-2.5 text-center" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
      <p className="font-black text-lg" style={{ color: s.color, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ fontSize: 10, color: s.color, fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.1em' }}>{label.toUpperCase()}</p>
    </div>
  );
}

function RowTable({ rows }: { rows: ClassifiedImportRow[] }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
      <div className="overflow-x-auto" style={{ maxHeight: 520, overflowY: 'auto' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F0EDE6' }}>
              {['#', 'Status', 'Email', 'Name', 'Role', 'Delegation', 'Payment', 'Committee / Country', 'Notes'].map(h => (
                <th key={h} className="text-left px-3 py-2.5" style={{ fontSize: 10, color: '#6B5F52', fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.rowNumber} style={{ borderTop: '1px solid #F0EDE6', backgroundColor: '#FAF8F3' }}>
                <td className="px-3 py-2.5 text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>{r.rowNumber}</td>
                <td className="px-3 py-2.5"><ClassPill cls={r.cls} /></td>
                <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.raw.email || '—'}</td>
                <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.raw.name || '—'}</td>
                <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.resolved.role ? roleLabel(r.resolved.role) : (r.raw.role || '—')}</td>
                <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.resolved.societyName ?? <em style={{ color: '#9A8A78' }}>Independent</em>}</td>
                <td className="px-3 py-2.5 text-xs capitalize" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.resolved.paymentStatus}</td>
                <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  {r.resolved.committeeId && r.resolved.countryCode ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold">{r.resolved.committeeLabel}</span>
                      <FlagImg code={r.resolved.countryCode} size={13} />
                      {r.resolved.countryName}
                    </span>
                  ) : r.raw.committee ? (
                    <span style={{ color: '#9A8A78' }}>{r.raw.committee}{r.raw.country ? `, ${r.raw.country}` : ''}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2.5" style={{ maxWidth: 280 }}>
                  {r.reasons.length > 0 ? (
                    <ul className="flex flex-col gap-0.5">
                      {r.reasons.map((m, i) => (
                        <li key={i} className="text-xs" style={{ color: r.cls === 'error' ? '#8B2020' : '#9A6B2F', fontFamily: OUTFIT }}>{m}</li>
                      ))}
                    </ul>
                  ) : <span className="text-xs" style={{ color: '#9A8A78' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const OUTCOME_STYLES: Record<RowOutcome, { icon: typeof CircleCheck; color: string; label: string }> = {
  'imported': { icon: CircleCheck, color: '#2A5A3C', label: 'Imported' },
  'imported-no-allocation': { icon: AlertTriangle, color: '#9A6B2F', label: 'Imported, no allocation' },
  'skipped': { icon: CircleX, color: '#8B2020', label: 'Skipped' },
};

function ResultTable({ rows }: { rows: ResultRow[] }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
      <div className="overflow-x-auto" style={{ maxHeight: 520, overflowY: 'auto' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F0EDE6' }}>
              {['#', 'Outcome', 'Email', 'Name', 'Role', 'Note'].map(h => (
                <th key={h} className="text-left px-3 py-2.5" style={{ fontSize: 10, color: '#6B5F52', fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const s = OUTCOME_STYLES[r.outcome];
              const Icon = s.icon;
              return (
                <tr key={r.row.rowNumber} style={{ borderTop: '1px solid #F0EDE6', backgroundColor: '#FAF8F3' }}>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>{r.row.rowNumber}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: s.color, fontFamily: OUTFIT }}>
                      <Icon size={13} />
                      {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.row.raw.email || '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.row.raw.name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.row.resolved.role ? roleLabel(r.row.resolved.role) : (r.row.raw.role || '—')}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT, maxWidth: 320 }}>{r.note ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
