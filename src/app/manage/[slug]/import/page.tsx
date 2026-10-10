'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, AlertTriangle, Mail, Loader2, CheckCircle2, UserCheck, ArrowLeft, Pencil, X } from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { IMPORTS_PAID_LAUNCH, importsArePaid, isChargedImportRole, isImportCreditsError, readImportQuote, transferIntoConference } from './importQuote';
import { GavellingImportPopup, type ImportInvoice } from './ImportCheckout';
import { useConfirmModal, type ConfirmModalConfig, type ConfirmModalResult } from '@/components/ConfirmModal';
import { GoldWord } from '@/components/BrandHeading';
import { NEU, NEU_GRADIENTS, NeuCard, NeuIconDisc } from '@/components/neu';
import {
  buildImportTemplateCSV, parseImportFile, classifyImportRows,
  type ClassifiedImportRow, type CommitteeLite, type ImportableRole, type RosterSlot,
  type ExistingApplication, type ParsedImportRow,
} from '@/lib/applicantImport';
import { queueImportJoinInviteEmails } from '@/lib/emailEvents';
import { friendlyError } from '@/lib/friendlyError';
import {
  AMBER, BigCount, GREEN, IMPORT_CSS, ImportDropZone, ImportReview, OUTFIT, RED, roleLabel,
  type ImportFilter, type ResultRow,
} from './importView';


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


// ── Pre-amendment repair ─────────────────────────────────────────────────────
// Imports run before conference_allocations.user_id became nullable could only
// set the application's assigned_* fields, no allocation row exists for them.
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
  existingByEmailRole: Map<string, ExistingApplication>;
  existingAllocations: Set<string>;
  committeeSlots: Map<string, RosterSlot[]>;
}

async function loadContext(supabase: ReturnType<typeof getAuthedClient>, conferenceId: string): Promise<DbContext> {
  const [{ data: committees }, { data: apps }, { data: allocs }] = await Promise.all([
    supabase.from('conference_committees').select('id, name, abbreviation, delegation_size').eq('conference_id', conferenceId),
    supabase.from('applications').select('id, role, invited_email, society_id, profiles(email)').eq('conference_id', conferenceId),
    supabase.from('conference_allocations').select('application_id, conference_committee_id, country_code, country_name, seat').eq('conference_id', conferenceId),
  ]);

  const allocRows = (allocs ?? []) as {
    application_id: string | null; conference_committee_id: string; country_code: string;
    country_name: string | null; seat: number | null;
  }[];

  // Allocation by application, so a re-import knows whether this person is
  // already seated somewhere (and where) before deciding what to change.
  const allocByApp = new Map<string, (typeof allocRows)[number]>();
  for (const al of allocRows) if (al.application_id) allocByApp.set(al.application_id, al);

  const existingByEmailRole = new Map<string, ExistingApplication>();
  for (const a of (apps ?? []) as unknown as {
    id: string; role: string; invited_email: string | null; society_id: string | null; profiles: { email: string } | null;
  }[]) {
    const email = (a.invited_email ?? a.profiles?.email)?.toLowerCase();
    if (!email) continue;
    const al = allocByApp.get(a.id);
    existingByEmailRole.set(`${email}|${a.role}`, {
      id: a.id,
      committeeId: al?.conference_committee_id ?? null,
      countryCode: al?.country_code ?? null,
      countryName: al?.country_name ?? null,
      seat: al?.seat ?? null,
      hasSociety: !!a.society_id,
    });
  }

  const existingAllocations = new Set<string>();
  for (const al of allocRows) {
    existingAllocations.add(`${al.conference_committee_id}|${al.country_code}|${al.seat ?? 1}`);
  }

  // Every committee's roster, the sole source of truth for what's
  // assignable there — a country for a standard committee, or a character
  // for a crisis one (same table, same shape).
  const committeeIds = ((committees ?? []) as CommitteeLite[]).map(c => c.id);
  const committeeSlots = new Map<string, RosterSlot[]>();
  if (committeeIds.length > 0) {
    const { data: slots } = await supabase
      .from('committee_country_slots')
      .select('conference_committee_id, country_code, country_name')
      .in('conference_committee_id', committeeIds);
    for (const s of (slots ?? []) as { conference_committee_id: string; country_code: string; country_name: string }[]) {
      if (!committeeSlots.has(s.conference_committee_id)) committeeSlots.set(s.conference_committee_id, []);
      committeeSlots.get(s.conference_committee_id)!.push({ country_code: s.country_code, country_name: s.country_name });
    }
  }

  return { committees: (committees ?? []) as CommitteeLite[], existingByEmailRole, existingAllocations, committeeSlots };
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Phase = 'upload' | 'parsing' | 'preview' | 'importing' | 'results';
type Tab = 'import' | 'imported';

export default function ImportPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  /** The two stable primitives the loaders below key on. AuthProvider replaces
   *  the session OBJECT on every auth event (token refresh, tab focus), so a
   *  loader depending on `session` refetches on each of those; the token is a
   *  string and only changes when it really changes — including the first time
   *  it arrives, which is the transition an auth-guarded loader has to catch.
   *  `conference` is likewise an object a background refresh can swap for an
   *  equal-but-new one, so the id is what belongs in a dep array. The action
   *  handlers below keep using `session`/`conference`; they run on a click. */
  const accessToken = session?.access_token;
  const conferenceId = conference?.id;
  const { confirm, modal: confirmModal } = useConfirmModal();
  const searchParams = useSearchParams();

  // Deep-linkable so a finished run's "View imported delegates" and any
  // outside link (?tab=imported) land straight on the roster, not the wizard.
  const initialTab: Tab = searchParams.get('tab') === 'imported' ? 'imported' : 'import';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // ?fix=<applicationId> arrives from a failed delivery row in Communications:
  // land on the roster, scroll to that person, and open their email for editing.
  const fixApplicationId = searchParams.get('fix');

  const [phase, setPhase] = useState<Phase>('upload');
  const [acceptMode, setAcceptMode] = useState<'accepted' | 'submitted'>('accepted');
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [classifiedRows, setClassifiedRows] = useState<ClassifiedImportRow[]>([]);
  // The parsed rows and the context they were checked against, kept so an
  // inline fix re-runs the SAME classifier over the whole file (in-file
  // duplicates and seat order depend on every row).
  const [rawRows, setRawRows] = useState<ParsedImportRow[]>([]);
  const [dbContext, setDbContext] = useState<DbContext | null>(null);
  const [filter, setFilter] = useState<ImportFilter>('all');
  // The small inline "import anyway?" for files with rows to flag.
  const [confirming, setConfirming] = useState(false);
  // Kept alongside classifiedRows purely so the preview table can tell a
  // double-delegation committee's allocations apart from a single's (same
  // seat=1 value on both) without a second query.
  const [contextCommittees, setContextCommittees] = useState<CommitteeLite[]>([]);
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [lastInviteQueued, setLastInviteQueued] = useState<number | null>(null);
  const [orphanRows, setOrphanRows] = useState<OrphanAllocationRow[]>([]);
  const [repairing, setRepairing] = useState(false);
  const importingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadUnclaimedCount = useCallback(async () => {
    if (!conferenceId || !accessToken) return;
    const supabase = getAuthedClient(accessToken);
    const { count } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('conference_id', conferenceId)
      .is('user_id', null)
      .not('invited_email', 'is', null);
    setUnclaimedCount(count ?? 0);
  }, [conferenceId, accessToken]);

  useEffect(() => { loadUnclaimedCount(); }, [loadUnclaimedCount]);

  // Detects applications that carry an assignment but have no matching
  // conference_allocations row, the state pre-amendment imports could leave
  // behind. Re-checked after every repair run so the banner clears itself.
  const loadOrphanAllocations = useCallback(async () => {
    if (!conferenceId || !accessToken) return;
    const supabase = getAuthedClient(accessToken);
    const { data: candidates } = await supabase
      .from('applications')
      .select('id, assigned_committee_id, assigned_country_code, assigned_country_name')
      .eq('conference_id', conferenceId)
      .is('user_id', null)
      .not('assigned_committee_id', 'is', null);
    const rows = (candidates ?? []) as OrphanAllocationRow[];
    if (rows.length === 0) { setOrphanRows([]); return; }
    const { data: allocs } = await supabase
      .from('conference_allocations')
      .select('application_id')
      .eq('conference_id', conferenceId)
      .in('application_id', rows.map(r => r.id));
    const covered = new Set(((allocs ?? []) as { application_id: string | null }[]).map(a => a.application_id));
    setOrphanRows(rows.filter(r => !covered.has(r.id)));
  }, [conferenceId, accessToken]);

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
          seat: 1,
          assigned_by: session.user.id,
        });
        if (error) {
          await supabase.from('applications').update({
            status: 'accepted',
            assigned_committee_id: null,
            assigned_country_code: null,
            assigned_country_name: null,
            decided_by: session.user.id, decided_at: new Date().toISOString(),
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
      setRawRows(rows);
      setDbContext(ctx);
      setClassifiedRows(classified);
      setContextCommittees(ctx.committees);
      setResultRows([]);
      setImportBlocked(null);
      setLastInviteQueued(null);
      setFilter('all');
      setConfirming(false);
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

  /** An inline fix: replace one parsed row and classify the whole file again. */
  function applyRowFix(rowNumber: number, patch: Partial<ParsedImportRow>) {
    if (!dbContext) return;
    const next = rawRows.map(r => (r.rowNumber === rowNumber ? { ...r, ...patch } : r));
    setRawRows(next);
    setClassifiedRows(classifyImportRows(next, dbContext));
    setConfirming(false);
  }

  function resetToUpload() {
    setPhase('upload');
    setRawRows([]);
    setDbContext(null);
    setFilter('all');
    setConfirming(false);
    setImportBlocked(null);
    setLastInviteQueued(null);
    setClassifiedRows([]);
    setContextCommittees([]);
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

    // 2. Insert applications. Re-imported people are UPDATES, not inserts —
    // they already have a row, so they are patched further down instead.
    const toCreate = importable.filter(r => r.mode === 'create');
    // Re-imported people already have a row (patched further down) — the
    // accept-gate choice only ever applies to genuinely new applications.
    const toUpdate = importable.filter(r => r.mode === 'update');
    const insertRows = toCreate.map(r => ({
      conference_id: conference.id,
      invited_email: r.resolved.email,
      invited_name: r.resolved.name,
      role: r.resolved.role,
      society_id: r.resolved.societyName ? societyMap.get(r.resolved.societyName.trim().toLowerCase()) ?? null : null,
      // Derived convenience, kept in sync, society_id IS NULL is the actual
      // source of truth, never read is_independent for logic.
      is_independent: !r.resolved.societyName,
      is_head_delegate: r.resolved.role === 'head-delegate',
      // Imported rows land pre-accepted by default: the organiser running the
      // import is the one who made that call. "Normal flow" mode instead
      // leaves them submitted, with no decided_by/decided_at, exactly like a
      // fresh application awaiting review.
      ...(acceptMode === 'submitted'
        ? { status: 'submitted' }
        : { status: 'accepted', decided_by: session.user.id, decided_at: new Date().toISOString() }),
      payment_status: r.resolved.paymentStatus,
      self_paid: r.resolved.paymentStatus === 'paid',
      submitted_at: new Date().toISOString(),
    }));

    const results: ResultRow[] = classifiedRows
      .filter(r => r.cls === 'error')
      .map(r => ({ row: r, outcome: 'skipped', note: r.reasons.join(' ') }));

    if (insertRows.length === 0 && toUpdate.length === 0) {
      setResultRows(results);
      await loadUnclaimedCount();
      return;
    }

    if (insertRows.length > 0) {
      const { error: insertError } = await supabase.from('applications').insert(insertRows);
      if (insertError) {
        // The conference ran out of credits between the quote and the insert
        // (applications_organizer_import_charge): say so, with the way to the
        // Store, and import nothing else.
        const note = friendlyError(insertError, 'Import failed. Please try again.');
        if (isImportCreditsError(insertError)) setImportBlocked(note);
        for (const r of toCreate) {
          results.push({ row: r, outcome: 'skipped', note });
        }
        // Updates are independent of the insert, so they still run below.
        toCreate.length = 0;
      }
    }

    // Re-select to map row -> real application id (email+role pair is unique per conference).
    const emails = Array.from(new Set(toCreate.map(r => r.resolved.email)));
    const { data: createdApps } = await supabase
      .from('applications')
      .select('id, invited_email, role')
      .eq('conference_id', conference.id)
      .in('invited_email', emails);
    const appIdByKey = new Map<string, string>();
    for (const a of (createdApps ?? []) as { id: string; invited_email: string; role: string }[]) {
      appIdByKey.set(`${a.invited_email.toLowerCase()}|${a.role}`, a.id);
    }
    // Re-imported rows already know their application id from the dry run.
    for (const r of toUpdate) {
      if (r.existingId && r.resolved.role) appIdByKey.set(`${r.resolved.email}|${r.resolved.role}`, r.existingId);
    }

    // 3. Pool increments, batched per (society, pool).
    const poolIncrements = new Map<string, number>(); // `${societyId}|${column}` -> count
    for (const r of toCreate) {
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

    // 3b. Patch re-imported applications. Fill-blanks-only: a missing cell in
    // the file means "no change", never "clear it", so a partial re-import
    // cannot wipe a delegation. Payment is deliberately untouched here —
    // marking paid now settles invoices as a side effect, which a spreadsheet
    // should not be able to trigger.
    for (const r of toUpdate) {
      if (r.noop || !r.existingId) continue;
      const patch: Record<string, unknown> = {};
      if (r.resolved.name) patch.invited_name = r.resolved.name;
      if (r.resolved.societyName) {
        const societyId = societyMap.get(r.resolved.societyName.trim().toLowerCase());
        if (societyId) { patch.society_id = societyId; patch.is_independent = false; }
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from('applications').update(patch).eq('id', r.existingId);
      }
    }

    // 4. Allocations for rows with a resolved committee + country.
    for (const r of importable) {
      if (!r.resolved.role) continue;
      // Rows whose insert failed above were dropped from toCreate.
      if (r.mode === 'create' && !toCreate.includes(r)) continue;
      if (r.noop) {
        results.push({ row: r, outcome: 'unchanged', note: r.reasons.join(' ') || null });
        continue;
      }
      // "Normal flow" mode means a brand-new row must come out of the import
      // still submitted, no matter what the spreadsheet named — allocating a
      // committee/country is itself a decision, so it's skipped entirely here.
      if (acceptMode === 'submitted' && r.mode === 'create') {
        results.push({ row: r, outcome: 'imported', note: null });
        continue;
      }
      const appId = appIdByKey.get(`${r.resolved.email}|${r.resolved.role}`);
      if (!appId) {
        results.push({ row: r, outcome: 'skipped', note: 'Could not locate the created application.' });
        continue;
      }
      if (!r.resolved.committeeId || !r.resolved.countryCode || !r.resolved.countryName) {
        results.push({
          row: r,
          outcome: r.mode === 'update' ? 'updated' : r.cls === 'warning' ? 'imported-no-allocation' : 'imported',
          note: r.cls === 'warning' ? r.reasons.join(' ') : null,
        });
        continue;
      }
      const { error: allocError } = await supabase.from('conference_allocations').insert({
        conference_id: conference.id,
        conference_committee_id: r.resolved.committeeId,
        user_id: null,
        country_code: r.resolved.countryCode,
        country_name: r.resolved.countryName,
        application_id: appId,
        seat: r.resolved.seat ?? 1,
        assigned_by: session.user.id,
      });
      if (allocError) {
        results.push({
          row: r,
          outcome: 'imported-no-allocation',
          note: allocError.code === '23505' ? 'Country was allocated to someone else in the meantime.' : friendlyError(allocError, 'Allocation failed. Please try again.'),
        });
        continue;
      }
      await supabase.from('applications').update({
        status: 'assigned',
        assigned_committee_id: r.resolved.committeeId,
        assigned_country_code: r.resolved.countryCode,
        assigned_country_name: r.resolved.countryName,
        decided_by: session.user.id, decided_at: new Date().toISOString(),
      }).eq('id', appId);
      results.push({ row: r, outcome: r.mode === 'update' ? 'updated' : 'imported', note: null });
    }

    // Auto-send the personal claim invite for every NEWLY CREATED row that
    // actually landed (with or without an allocation). Updates and no-ops are
    // excluded on purpose so re-importing a roster never re-spams anyone who
    // is already in the system. A failed email queue must never make the
    // import itself look failed, hence the try/catch.
    const inviteRecipients = results
      .filter(res => res.row.mode === 'create' && (res.outcome === 'imported' || res.outcome === 'imported-no-allocation'))
      .map(res => {
        const appId = appIdByKey.get(`${res.row.resolved.email}|${res.row.resolved.role}`);
        return appId ? { applicationId: appId, invitedEmail: res.row.resolved.email, invitedName: res.row.resolved.name } : null;
      })
      .filter((r): r is { applicationId: string; invitedEmail: string; invitedName: string } => r !== null);
    if (inviteRecipients.length > 0) {
      try {
        const inviteResult = await queueImportJoinInviteEmails(supabase, conference.id, inviteRecipients);
        setLastInviteQueued(inviteResult.queued);
      } catch {
        // Import stands even if the invite queue fails; the persistent
        // unclaimed banner is the manual resend path.
      }
    }

    setResultRows(results.sort((a, b) => a.row.rowNumber - b.row.rowNumber));
    await loadUnclaimedCount();
  }

  // What the import costs: 1 conference credit per NEW delegate, head
  // delegate, faculty advisor or observer row (importQuote.ts). Read once when
  // the organiser presses Import, shown in the confirm step, and when the
  // conference is short the credits pop-up buys the difference, moves it into
  // the conference and runs the SAME import once (ref-guarded).
  const [importBlocked, setImportBlocked] = useState<string | null>(null);
  const pendingImportRef = useRef<boolean>(false);

  async function runImportOnce() {
    if (importingRef.current) return;
    importingRef.current = true;
    setImportBlocked(null);
    setPhase('importing');
    try {
      await executeImport();
      setPhase('results');
    } finally {
      importingRef.current = false;
    }
  }

  // One button, and every import is confirmed in place first (coordinator,
  // 10 Oct 2026: an import queues invite emails, so one press must never send
  // them). The first press turns the bottom bar into "This sends an invite
  // email to N people. Import now?", folding in any flagged rows (without a
  // seat, skipped, with a note); the second press runs it. With paid imports
  // launched (IMPORTS_PAID_LAUNCH) the Gavelling Import checkout follows: the
  // invoice and the one button. Credits come from Conference Credits first,
  // then the organiser's own (moved in with store_transfer_in), then a
  // purchase of exactly what is still missing.
  const [invoice, setInvoice] = useState<ImportInvoice | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);

  function handleImportClick() {
    const importableCount = classifiedRows.filter(r => r.cls !== 'error').length;
    if (importableCount === 0 || !conference || !session || importingRef.current) return;
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    void openCheckout();
  }

  async function openCheckout() {
    if (!conference || !session) return;
    const importable = classifiedRows.filter(r => r.cls !== 'error');
    // Imports are free for now (IMPORTS_PAID_LAUNCH, importQuote.ts): no
    // invoice, no credits lines, straight to the import.
    if (!IMPORTS_PAID_LAUNCH) {
      await runImportOnce();
      return;
    }
    const chargedRows = importable.filter(r => r.mode === 'create' && isChargedImportRole(r.resolved.role));
    const byRole = new Map<string, number>();
    for (const r of chargedRows) {
      const k = r.resolved.role ?? 'delegate';
      byRole.set(k, (byRole.get(k) ?? 0) + 1);
    }
    const ROLE_ORDER = ['delegate', 'head-delegate', 'faculty-advisor', 'observer'];
    const WORDS: Record<string, [string, string]> = {
      delegate: ['delegate', 'delegates'], 'head-delegate': ['head delegate', 'head delegates'],
      'faculty-advisor': ['faculty advisor', 'faculty advisors'], observer: ['observer', 'observers'],
    };
    const charged = ROLE_ORDER.filter(k => byRole.has(k)).map(k => {
      const n = byRole.get(k)!;
      return { role: (WORDS[k] ?? [k, k])[n === 1 ? 0 : 1], count: n };
    });
    const client = getAuthedClient(session.access_token);
    const [quote, store] = await Promise.all([
      chargedRows.length > 0 ? readImportQuote(client, conference.id, chargedRows.length) : Promise.resolve(null),
      client.rpc('my_store', { p_conf: conference.id }).then(({ data }) => data as { your_credits?: number } | null, () => null),
    ]);
    const total = quote ? quote.credits : chargedRows.length;
    const conf = quote ? Math.min(quote.conference_credits, total) : 0;
    const own = Math.min(Math.max(0, typeof store?.your_credits === 'number' ? store.your_credits : 0), total - conf);
    setCheckoutErr(null);
    if (!importsArePaid(quote)) {
      // The launch switch is on but the database does not charge yet: the
      // same plain path as while paused.
      setInvoice(null);
      await runImportOnce();
      return;
    }
    setInvoice({
      charged,
      updates: importable.filter(r => r.mode === 'update').length,
      rows: importable.length,
      // Not charged yet (before launch), or the quote could not be read: the
      // database's own refusal is still the backstop at insert.
      free: !quote || !quote.charged,
      total,
      fromConference: conf,
      fromOwn: own,
      toBuy: Math.max(0, total - conf - own),
      acceptMode,
    });
  }

  async function handleCheckoutPay() {
    const inv = invoice;
    if (!inv || !conference || importingRef.current || checkoutBusy) return;
    setCheckoutErr(null);
    if (inv.free || inv.total === 0) { setInvoice(null); await runImportOnce(); return; }
    if (inv.toBuy === 0) {
      setCheckoutBusy(true);
      try {
        if (inv.fromOwn > 0) {
          const client = await getFreshAuthedClient();
          if (!client) { setCheckoutErr('Your session has expired. Refresh the page, then import again.'); return; }
          const moved = await transferIntoConference(client, conference.id, inv.fromOwn);
          if (!moved.ok) { setCheckoutErr(moved.message ?? 'Your credits could not be moved into the conference. Open the Store and try again.'); return; }
        }
        setInvoice(null);
        await runImportOnce();
      } finally {
        setCheckoutBusy(false);
      }
      return;
    }
    // Short: buy exactly what is missing, then move the organiser's own part
    // plus the purchase into the conference and run the SAME import once.
    pendingImportRef.current = true;
    const move = inv.fromOwn + inv.toBuy;
    setInvoice(null);
    openCreditsPopup({
      context: 'organizer',
      preselect: inv.toBuy,
      purpose: 'import',
      onComplete: () => {
        if (!pendingImportRef.current) return;
        pendingImportRef.current = false;
        void (async () => {
          const client = await getFreshAuthedClient();
          if (!client) { setImportBlocked('Your session has expired. Refresh the page, then import again.'); setPhase('results'); return; }
          const moved = await transferIntoConference(client, conference.id, move);
          if (!moved.ok) {
            setImportBlocked(moved.message ?? 'Your credits could not be moved into the conference. Open the Store and try again.');
            setPhase('results');
            return;
          }
          await runImportOnce();
        })();
      },
    });
  }

  async function handleSendInvites() {
    if (!conference || !session || sendingInvites) return;
    const { confirmed } = await confirm({
      title: `Send ${unclaimedCount} Gavelling invite${unclaimedCount === 1 ? '' : 's'}?`,
      body: 'Each unclaimed imported applicant gets an email with their personal invitation link. Their registration attaches automatically when they claim it, whichever email address they sign up with.',
      confirmLabel: 'Send invites',
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

  const isLanding = phase === 'upload' || phase === 'parsing';
  const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

  const invitesLine = unclaimedCount > 0 ? (
    <div className="gv-imp-slim" style={{ backgroundColor: 'rgba(238,217,138,0.22)' }}>
      <Mail size={16} style={{ color: AMBER, flexShrink: 0 }} aria-hidden />
      <p style={{ flex: 1, margin: 0, color: '#5A4210', minWidth: 180 }}>
        {people(unclaimedCount)} {unclaimedCount === 1 ? "hasn't" : "haven't"} joined yet
      </p>
      <button type="button" onClick={handleSendInvites} disabled={sendingInvites} className="gv-imp-link">
        {sendingInvites ? 'Sending…' : 'Send the invite again'}
      </button>
    </div>
  ) : null;

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-9">
      <style>{IMPORT_CSS}</style>
      <div className="mx-auto" style={{ maxWidth: 960 }}>
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-6">
          <div style={{ minWidth: 0 }}>
            <h1 className="gv-imp-title">
              {activeTab === 'imported' ? 'Imported' : 'Import'} <GoldWord>People</GoldWord>
            </h1>
            <p className="gv-imp-lead">
              {activeTab === 'imported' ? 'Everyone you brought in, and who has joined' : 'From a spreadsheet. Everyone gets an invite by email'}
            </p>
          </div>
          <button type="button" className="gv-imp-link" onClick={() => setActiveTab(activeTab === 'imported' ? 'import' : 'imported')}>
            {activeTab === 'imported' ? <><ArrowLeft size={15} aria-hidden /> Back to import</> : 'See imported people'}
          </button>
        </header>

        <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileInputChange} />

        {activeTab === 'imported' ? (
          <ImportedDelegatesTab conference={conference} session={session} confirm={confirm} fixApplicationId={fixApplicationId} />
        ) : isLanding ? (
          <>
            <ImportDropZone
              parsing={phase === 'parsing'}
              fileName={fileName}
              fileError={fileError}
              onChoose={() => fileInputRef.current?.click()}
              onFile={file => { void handleFile(file); }}
              onTemplate={handleDownloadTemplate}
            />
            <div className="flex flex-col gap-3 mt-8">
              {invitesLine}
              {lastInviteQueued !== null && <p className="gv-imp-ok">Invites sent to {people(lastInviteQueued)}</p>}
              {orphanRows.length > 0 && (
                <div className="gv-imp-slim" style={{ backgroundColor: 'rgba(139,32,32,0.07)' }}>
                  <AlertTriangle size={16} style={{ color: RED, flexShrink: 0 }} aria-hidden />
                  <p style={{ flex: 1, margin: 0, color: RED, minWidth: 180 }}>
                    {orphanRows.length} imported {orphanRows.length === 1 ? 'seat needs' : 'seats need'} repairing
                  </p>
                  <button type="button" onClick={handleRepairAllocations} disabled={repairing} className="gv-imp-link" style={{ color: RED }}>
                    {repairing ? 'Repairing…' : 'Repair'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <ImportReview
            phase={phase === 'importing' ? 'importing' : phase === 'results' ? 'results' : 'preview'}
            fileName={fileName}
            rows={classifiedRows}
            committees={contextCommittees}
            results={resultRows}
            filter={filter}
            onFilter={setFilter}
            confirming={confirming}
            onCancelConfirm={() => setConfirming(false)}
            accepted={acceptMode === 'accepted'}
            onAccepted={on => setAcceptMode(on ? 'accepted' : 'submitted')}
            onImport={handleImportClick}
            onChooseFile={() => fileInputRef.current?.click()}
            onFixRow={applyRowFix}
            onReset={resetToUpload}
            importBlocked={importBlocked}
            invitesQueued={lastInviteQueued}
            applicationsHref={`/manage/${conference.slug}/applications`}
            storeHref={`/manage/${conference.slug}/store`}
            footer={invitesLine}
          />
        )}

        {confirmModal}
        {invoice && (
          <GavellingImportPopup
            invoice={invoice}
            busy={checkoutBusy}
            err={checkoutErr}
            onClose={() => { if (!checkoutBusy) setInvoice(null); }}
            onPay={() => { void handleCheckoutPay(); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Imported delegates tab ────────────────────────────────────────────────────
// A completed import lives on as applications rows with invited_email set —
// there's no import marker column, invited_email IS the signal. Unlike the
// wizard's in-memory resultRows (gone the moment you navigate away), this
// queries live so a run is never a dead end once you leave the page.

interface ImportedDelegateRow {
  id: string;
  invited_name: string | null;
  invited_email: string;
  role: string;
  status: string;
  user_id: string | null;
  /** The account's CURRENT name once the invite is claimed. */
  profiles?: { display_name: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted', assigned: 'Assigned', rejected: 'Rejected',
  'not-attending': 'Not attending', waitlisted: 'Waitlisted', submitted: 'Submitted',
};

// Same rule as applicantImport.ts's EMAIL_PATTERN and Postgres
// is_sendable_email(): a real multi-character TLD, so a truncated address is
// caught in the roster editor exactly as it is at paste time.
const SENDABLE_EMAIL = /^[^@\s,;<>]+@[^@\s,;<>]+\.[A-Za-z]{2,}$/;

function ImportedDelegatesTab({ conference, session, confirm, fixApplicationId }: {
  conference: Conference;
  session: { access_token: string } | null;
  confirm: (config: ConfirmModalConfig) => Promise<ConfirmModalResult>;
  fixApplicationId?: string | null;
}) {
  const [rows, setRows] = useState<ImportedDelegateRow[] | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentIds, setResentIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const autoFixedRef = useRef(false);

  // accessToken, not the session object: the token is a string, so this only
  // re-runs when auth first arrives or genuinely rotates, not on the churn
  // AuthProvider produces on every auth event.
  const accessToken = session?.access_token;

  const load = useCallback(async () => {
    if (!accessToken) return;
    const supabase = getAuthedClient(accessToken);
    const { data } = await supabase
      .from('applications')
      .select('id, invited_name, invited_email, role, status, user_id, profiles (display_name)')
      .eq('conference_id', conference.id)
      .not('invited_email', 'is', null)
      .order('user_id', { ascending: true, nullsFirst: true })
      .order('invited_name', { ascending: true });
    setRows((data ?? []) as unknown as ImportedDelegateRow[]);
  }, [conference.id, accessToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoFixedRef.current || !fixApplicationId || !rows) return;
    const target = rows.find(r => r.id === fixApplicationId);
    if (!target) return;
    autoFixedRef.current = true;
    if (!target.user_id) {
      setEditingId(target.id);
      setDraftEmail(target.invited_email);
    }
    requestAnimationFrame(() => {
      document.getElementById(`imported-row-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [fixApplicationId, rows]);

  async function handleSaveEmail(row: ImportedDelegateRow) {
    if (!session || savingId) return;
    const next = draftEmail.trim();
    if (next.toLowerCase() === row.invited_email.toLowerCase()) { setEditingId(null); return; }
    setSavingId(row.id);
    setRowError(null);
    try {
      const supabase = getAuthedClient(session.access_token);
      const { data, error } = await supabase.rpc('fix_imported_applicant_email', {
        p_application_id: row.id,
        p_email: next,
      });
      const result = (data ?? null) as { ok: boolean; message?: string; requeued?: number } | null;
      if (error || !result?.ok) {
        setRowError({ id: row.id, message: result?.message ?? friendlyError(error, 'Could not save that email address.') });
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function handleResend(row: ImportedDelegateRow) {
    if (!session || resendingId) return;
    const { confirmed } = await confirm({
      title: 'Resend Gavelling invite?',
      body: `Send another account invite to ${row.invited_name || row.invited_email}?`,
      confirmLabel: 'Resend',
    });
    if (!confirmed) return;
    setResendingId(row.id);
    try {
      const supabase = getAuthedClient(session.access_token);
      await queueImportJoinInviteEmails(supabase, conference.id, [{
        applicationId: row.id, invitedEmail: row.invited_email, invitedName: row.invited_name ?? '',
      }]);
      setResentIds(prev => new Set(prev).add(row.id));
    } finally {
      setResendingId(null);
    }
  }

  if (rows === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin" style={{ color: NEU.forest }} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <NeuCard style={{ padding: '48px 24px' }}>
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={UserCheck} size={48} />
          </div>
          <p className="font-black text-base mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>No imported delegates yet</p>
          <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>Applicants brought in through Import will show up here.</p>
        </div>
      </NeuCard>
    );
  }

  const unclaimed = rows.filter(r => !r.user_id).length;
  const unsendableCount = rows.filter(r => !r.user_id && !SENDABLE_EMAIL.test(r.invited_email)).length;

  return (
    <>
      <div className="gv-imp-summary">
        <BigCount n={rows.length} word="imported" color={GREEN} />
        {unclaimed > 0 && <BigCount n={unclaimed} word="not joined yet" color={AMBER} />}
      </div>
      {unsendableCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
          style={{ backgroundColor: 'rgba(139,32,32,0.10)', border: '1px solid rgba(139,32,32,0.30)' }}
        >
          <AlertTriangle size={15} style={{ color: '#8B2020', flexShrink: 0 }} />
          <p className="flex-1 text-sm" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
            {unsendableCount} imported {unsendableCount === 1 ? 'delegate has an email address that' : 'delegates have email addresses that'} cannot receive mail. Fix {unsendableCount === 1 ? 'it' : 'them'} below and their pending emails will send automatically.
          </p>
        </div>
      )}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
        <div className="overflow-x-auto" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F0EDE6' }}>
                {['Name', 'Email', 'Role', 'Status', 'Invite', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5" style={{ fontSize: 10, color: '#6B5F52', fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const claimed = !!r.user_id;
                const resent = resentIds.has(r.id);
                const editing = editingId === r.id;
                const unsendable = !claimed && !SENDABLE_EMAIL.test(r.invited_email);
                const isFixTarget = r.id === fixApplicationId;
                return (
                  <tr id={`imported-row-${r.id}`} key={r.id} style={{ borderTop: '1px solid #F0EDE6', backgroundColor: isFixTarget ? 'rgba(238,217,138,0.30)' : '#FAF8F3' }}>
                    <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{r.profiles?.display_name?.trim() || r.invited_name || 'None'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                      {claimed ? (
                        r.invited_email
                      ) : editing ? (
                        <span className="inline-flex items-center gap-1.5">
                          <input
                            type="email"
                            value={draftEmail}
                            autoFocus
                            disabled={savingId === r.id}
                            onChange={e => setDraftEmail(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); handleSaveEmail(r); }
                              else if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); setRowError(null); }
                            }}
                            className="rounded-lg px-2 py-1 text-base sm:text-xs focus:outline-none"
                            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FFFFFF', fontFamily: OUTFIT, minWidth: 180 }}
                          />
                          <button
                            onClick={() => handleSaveEmail(r)}
                            disabled={savingId === r.id}
                            aria-label="Save email"
                            className="inline-flex items-center gap-1 rounded-lg py-1 px-2 text-xs font-bold focus:outline-none"
                            style={{ border: '1px solid #DDD4C0', color: '#2A5A3C', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: savingId === r.id ? 'not-allowed' : 'pointer' }}
                          >
                            {savingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setRowError(null); }}
                            disabled={savingId === r.id}
                            aria-label="Cancel"
                            className="inline-flex items-center gap-1 rounded-lg py-1 px-2 text-xs font-bold focus:outline-none"
                            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: savingId === r.id ? 'not-allowed' : 'pointer' }}
                          >
                            <X size={11} /> Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span style={{ color: unsendable ? '#8B2020' : '#1C1410' }}>
                            {r.invited_email}
                            {unsendable && (
                              <span className="block" style={{ color: '#8B2020', fontSize: 10, marginTop: 1 }}>Cannot receive email</span>
                            )}
                          </span>
                          <button
                            onClick={() => { setEditingId(r.id); setDraftEmail(r.invited_email); setRowError(null); }}
                            aria-label="Edit email"
                            className="inline-flex items-center justify-center rounded-lg p-1 focus:outline-none"
                            style={{ border: '1px solid #DDD4C0', color: '#6B5F52', backgroundColor: 'transparent', cursor: 'pointer' }}
                          >
                            <Pencil size={11} />
                          </button>
                        </span>
                      )}
                      {rowError?.id === r.id && (
                        <p className="mt-1.5" style={{ color: '#8B2020', fontSize: 11, fontFamily: OUTFIT }}>{rowError.message}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{roleLabel(r.role)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-bold"
                        style={{ color: claimed ? '#2A5A3C' : '#9A6B2F', whiteSpace: 'nowrap' }}
                      >
                        {claimed ? <CheckCircle2 size={14} aria-hidden="true" /> : <Mail size={14} aria-hidden="true" />}
                        {claimed ? 'Claimed' : 'Unclaimed'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {!claimed && (
                        <button
                          onClick={() => handleResend(r)}
                          disabled={resendingId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-lg py-1 px-3 text-xs font-bold focus:outline-none"
                          style={{
                            border: '1px solid #DDD4C0', color: resent ? '#2A5A3C' : '#1C1410',
                            backgroundColor: 'transparent', fontFamily: OUTFIT,
                            cursor: resendingId === r.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {resendingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                          {resent ? 'Resent' : 'Resend invite'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
