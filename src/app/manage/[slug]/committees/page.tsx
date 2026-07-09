'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Copy, Check, Building2, CalendarClock, Trash2, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import {
  CommitteeEditorModal,
  MonogramMedallion,
  ModalOverlay,
  mintConferenceSession,
} from '@/components/CommitteeEditorModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DisplayChair {
  name: string;
  avatar_url: string | null;
}

interface CommitteeRow {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  total_slots: number;
  session_code: string | null;
  session_id: string | null;
  pp_submissions_enabled: boolean;
  position_paper_deadline: string | null;
  notification_email: string | null;
  logo_url: string | null;
  chair_user_ids: string[] | null;
  display_chairs: DisplayChair[] | null;
}

interface Committee extends CommitteeRow {
  slotCount: number;
}

// Accepted chair applicant (AddChairModal list) — same shape the assignment page reads.
interface ChairApplicant {
  id: string;
  user_id: string;
  status: string;
  assigned_committee_id: string | null;
  profiles: { id: string; display_name: string; email: string; avatar_url: string | null } | null;
}

// ── Design constants ──────────────────────────────────────────────────────────

const DIFFICULTY_STYLES: Record<string, { backgroundColor: string; color: string }> = {
  beginner:     { backgroundColor: 'rgba(61,122,82,0.13)',   color: '#2A5A3C' },
  intermediate: { backgroundColor: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  advanced:     { backgroundColor: 'rgba(184,132,74,0.16)',  color: '#B8844A' },
  expert:       { backgroundColor: 'rgba(139,32,32,0.1)',    color: '#8B2020' },
};

const DIFF_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };

const ROMAN = ['I', 'II', 'III'];

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

function SortButton({ label, dir, onClick }: { label: string; dir: 'asc' | 'desc' | null; onClick: () => void }) {
  const active = dir !== null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10.5px] font-bold transition-all focus:outline-none"
      style={{
        backgroundColor: active ? '#1B3828' : 'rgba(237,231,216,0.5)',
        color: active ? '#EED98A' : '#6B5F52',
        border: active ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.09em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
      {dir === 'asc' ? (
        <ArrowDown size={12} strokeWidth={2.4} />
      ) : dir === 'desc' ? (
        <ArrowUp size={12} strokeWidth={2.4} />
      ) : (
        <ArrowUpDown size={12} strokeWidth={2} style={{ opacity: 0.5 }} />
      )}
    </button>
  );
}

// ── AddChairModal — assign an accepted chair applicant, or invite by email ────

function AddChairModal({ conferenceId, committee, committees, onClose, onDone }: {
  conferenceId: string;
  committee: Committee;
  committees: Committee[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { session } = useAuth();
  const [applicants, setApplicants] = useState<ChairApplicant[] | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('applications')
        .select('id, user_id, status, assigned_committee_id, profiles (id, display_name, email, avatar_url)')
        .eq('conference_id', conferenceId)
        .eq('role', 'chair')
        .in('status', ['accepted', 'assigned']);
      if (!cancelled) setApplicants((data ?? []) as unknown as ChairApplicant[]);
    })();
    return () => { cancelled = true; };
  }, [session, conferenceId]);

  const currentIds = new Set(committee.chair_user_ids ?? []);
  const visible = (applicants ?? [])
    .filter(a => !currentIds.has(a.user_id))
    .sort((a, b) => {
      const ua = a.assigned_committee_id ? 1 : 0;
      const ub = b.assigned_committee_id ? 1 : 0;
      if (ua !== ub) return ua - ub; // unassigned first
      return (a.profiles?.display_name ?? '').localeCompare(b.profiles?.display_name ?? '');
    });

  // Same semantics as assignment/page.tsx handleAssignChair — dedup-append to
  // chair_user_ids; the DB trigger recomputes display_chairs.
  async function handleAssign(app: ChairApplicant) {
    if (!session) return;
    setAssigningId(app.id); setError('');
    const supabase = getAuthedClient(session.access_token);
    const nextIds = Array.from(new Set([...(committee.chair_user_ids ?? []), app.user_id]));
    await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committee.id);
    await supabase.from('applications').update({ status: 'assigned', assigned_committee_id: committee.id }).eq('id', app.id);
    setAssigningId(null);
    onDone();
  }

  async function handleInvite() {
    const em = email.trim();
    if (!em || !session) return;
    setInviting(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    const { error: rpcErr } = await supabase.rpc('invite_chair_by_email', {
      p_conference_id: conferenceId,
      p_committee_id: committee.id,
      p_email: em,
    });
    setInviting(false);
    if (rpcErr) {
      setError(/no gavelling account/i.test(rpcErr.message)
        ? `No Gavelling account found for ${em}. They need to sign up first.`
        : (rpcErr.message || 'Could not invite that chair.'));
      return;
    }
    onDone();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 460, maxWidth: 'calc(100vw - 32px)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: '#B6871F' }}>
              ADD CHAIR
            </p>
            <p className="font-bold text-[15px] mt-0.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              {committee.name}
            </p>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>

        {/* Accepted chair applicants */}
        <p style={{ margin: '0 0 8px 0', fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>
          ACCEPTED CHAIR APPLICANTS
        </p>
        {applicants === null ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-xs py-3 text-center rounded-xl" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", border: '1px dashed #DDD4C0', backgroundColor: 'rgba(237,231,216,0.3)' }}>
            No accepted chair applicants available.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visible.map(app => {
              const name = app.profiles?.display_name ?? 'Unknown';
              const assignedTo = app.assigned_committee_id
                ? committees.find(cc => cc.id === app.assigned_committee_id)
                : null;
              return (
                <div key={app.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ border: '1px solid #EDE7D8', backgroundColor: 'rgba(237,231,216,0.3)' }}>
                  {app.profiles?.avatar_url ? (
                    <img
                      src={app.profiles.avatar_url}
                      alt={name}
                      style={{ width: 30, height: 30, borderRadius: '9999px', objectFit: 'cover', backgroundColor: '#EDE7D8', flexShrink: 0 }}
                    />
                  ) : (
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 30, height: 30, borderRadius: '9999px', backgroundColor: '#1B3828', color: '#EED98A', fontSize: 12, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}
                    >
                      {name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{name}</p>
                    <p className="text-[11px] truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{app.profiles?.email ?? ''}</p>
                  </div>
                  {app.assigned_committee_id && (
                    <span
                      className="px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'Outfit', sans-serif", backgroundColor: 'rgba(238,217,138,0.35)', color: '#8A6614', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {assignedTo ? `ON ${(assignedTo.abbreviation ?? assignedTo.name).toUpperCase()}` : 'ASSIGNED'}
                    </span>
                  )}
                  <button
                    onClick={() => handleAssign(app)}
                    disabled={assigningId !== null}
                    className="rounded-lg py-1.5 px-3 font-bold text-[10.5px] focus:outline-none flex-shrink-0"
                    style={{
                      backgroundColor: assigningId === app.id ? '#DDD4C0' : '#1B3828',
                      color: assigningId === app.id ? '#9A8A78' : '#EED98A',
                      fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', cursor: 'pointer',
                      transition: `background-color 250ms ${EASE}`,
                    }}
                    onMouseEnter={e => { if (assigningId === null) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={e => { if (assigningId === null) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  >
                    {assigningId === app.id ? 'ASSIGNING…' : 'ASSIGN'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Invite by email */}
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid #EDE7D8' }}>
          <p style={{ margin: '0 0 8px 0', fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>
            INVITE BY EMAIL
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
              placeholder="chair@example.com"
              style={{
                flex: 1, border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 12px',
                fontSize: 13, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none',
                fontFamily: "'Outfit', sans-serif",
              }}
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              className="rounded-lg px-4 font-bold text-[11px] focus:outline-none"
              style={{
                backgroundColor: inviting || !email.trim() ? '#DDD4C0' : '#1B3828',
                color: inviting || !email.trim() ? '#9A8A78' : '#EED98A',
                fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', cursor: 'pointer',
                transition: `background-color 250ms ${EASE}`, whiteSpace: 'nowrap',
              }}
            >
              {inviting ? 'INVITING…' : 'INVITE'}
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.45 }}>
            They must already have a Gavelling account. Invited chairs are added straight to this dais.
          </p>
          {error && <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── CommitteesPage ────────────────────────────────────────────────────────────

export default function CommitteesPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Committee | null>(null);
  const [addChairTarget, setAddChairTarget] = useState<Committee | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommitteeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<'' | 'difficulty' | 'name' | 'type'>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const loadCommittees = useCallback(async () => {
    if (!conference) return;
    setLoading(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots, session_code, session_id, position_paper_deadline, notification_email, pp_submissions_enabled, logo_url, chair_user_ids, display_chairs')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });

    const rows = (data ?? []) as CommitteeRow[];

    const slotCounts = await Promise.all(
      rows.map(async c => {
        const { count } = await supabase
          .from('committee_country_slots')
          .select('*', { count: 'exact', head: true })
          .eq('conference_committee_id', c.id);
        return count ?? 0;
      })
    );

    setCommittees(rows.map((c, i) => ({ ...c, slotCount: slotCounts[i] })));
    setLoading(false);
  }, [conference]);

  useEffect(() => { loadCommittees(); }, [loadCommittees]);

  async function generateSessionCode(committee: CommitteeRow) {
    if (!session) return;
    if (committee.session_id) return; // already linked to a real session
    const supabase = getAuthedClient(session.access_token);
    await mintConferenceSession(supabase, committee.id, committee.name, (committee.topics ?? [])[0] ?? '', []);
    await loadCommittees();
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function handleDeleteCommittee(c: CommitteeRow) {
    if (!session) return;
    setDeleting(true);
    const supabase = getAuthedClient(session.access_token);
    // Delete the linked session first — cascades all session children (delegates, speakers_list, current_speaker, motions, documents, messages, feedback).
    if (c.session_id) {
      await supabase.from('committees').delete().eq('id', c.session_id);
    }
    // Delete the conference committee — cascades slots, allocations, awards, position_papers, study_guides, application_preferences; sets applications/job_postings to null (preserved).
    await supabase.from('conference_committees').delete().eq('id', c.id);
    setDeleting(false);
    setDeleteTarget(null);
    loadCommittees();
  }

  // Same semantics as assignment/page.tsx handleRemoveChair — filter the id out of
  // chair_user_ids and revert the chair's application to accepted. display_chairs
  // is recomputed by the DB trigger; never written client-side. The avatar→user_id
  // mapping relies on the trigger keeping display_chairs index-aligned with
  // chair_user_ids; on a mismatch (hand-seeded demo dais) fall back to profiles.
  async function handleRemoveChair(c: Committee, index: number, name: string) {
    if (!session || !conference) return;
    if (!window.confirm(`Remove ${name} from the ${c.abbreviation || c.name} dais?`)) return;
    const supabase = getAuthedClient(session.access_token);
    const ids = c.chair_user_ids ?? [];
    const dc = c.display_chairs ?? [];
    let userId: string | null = null;
    if (ids.length === dc.length) {
      userId = ids[index] ?? null;
    } else if (ids.length > 0) {
      const { data } = await supabase.from('profiles').select('id, display_name').in('id', ids);
      userId = ((data ?? []) as { id: string; display_name: string }[]).find(p => p.display_name === name)?.id ?? null;
    }
    if (!userId) {
      window.alert('This dais entry is not linked to a Gavelling account, so it cannot be removed here.');
      return;
    }
    const nextIds = ids.filter(id => id !== userId);
    await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', c.id);
    await supabase.from('applications')
      .update({ status: 'accepted', assigned_committee_id: null })
      .eq('conference_id', conference.id)
      .eq('user_id', userId)
      .eq('role', 'chair');
    await loadCommittees();
  }

  if (!conference) return null;

  let sortedCommittees = committees;
  if (sortKey) {
    sortedCommittees = [...committees].sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      let va = 0, vb = 0;
      if (sortKey === 'difficulty') {
        va = DIFF_ORDER[(a.difficulty ?? '').toLowerCase()] ?? 99;
        vb = DIFF_ORDER[(b.difficulty ?? '').toLowerCase()] ?? 99;
      } else {
        va = a.committee_type === 'crisis' ? 1 : 0;
        vb = b.committee_type === 'crisis' ? 1 : 0;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }
  const cycleSort = (key: 'difficulty' | 'name' | 'type') => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') { setSortDir('desc'); }
    else { setSortKey(''); setSortDir('asc'); }
  };

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
            {conference.acronym} / Committees
          </p>
          <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Committees
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          <Plus size={15} />
          ADD COMMITTEE
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && committees.length === 0 && (
        <div
          className="flex flex-col items-center text-center py-16 px-6 rounded-2xl"
          style={{
            border: '1.5px dashed #C8BEA8',
            backgroundColor: 'rgba(250,248,243,0.6)',
          }}
        >
          <span
            className="flex items-center justify-center mb-4"
            style={{
              width: 56, height: 56, borderRadius: '9999px',
              background: 'linear-gradient(150deg, rgba(27,56,40,0.12), rgba(27,56,40,0.05))',
              border: '1.5px solid rgba(27,56,40,0.18)',
            }}
          >
            <Building2 size={24} style={{ color: '#1B3828' }} />
          </span>
          <p className="font-bold text-lg mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>No committees yet</p>
          <p className="text-sm mb-5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", maxWidth: 320 }}>
            Committees are where delegates debate. Add your first one to give applicants somewhere to be assigned.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            <Plus size={15} />
            ADD YOUR FIRST COMMITTEE
          </button>
        </div>
      )}

      {!loading && committees.length > 0 && (
        <>
          {/* Sort bar — glass pill, same recipe as the public conference page */}
          {committees.length > 1 && (
            <div className="mb-5">
              <div
                className="inline-flex flex-wrap items-center gap-1.5 rounded-full px-2 py-1.5"
                style={{
                  backgroundColor: 'rgba(250,248,243,0.72)',
                  backdropFilter: 'blur(16px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                  border: '1px solid rgba(221,212,192,0.85)',
                  boxShadow: '0 6px 20px rgba(27,56,40,0.07)',
                }}
              >
                <SortButton label="DIFFICULTY" dir={sortKey === 'difficulty' ? sortDir : null} onClick={() => cycleSort('difficulty')} />
                <SortButton label="NAME" dir={sortKey === 'name' ? sortDir : null} onClick={() => cycleSort('name')} />
                <SortButton label="GA / CRISIS" dir={sortKey === 'type' ? sortDir : null} onClick={() => cycleSort('type')} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {sortedCommittees.map(c => {
              const diff = (c.difficulty ?? '').toLowerCase();
              const diffStyle = DIFFICULTY_STYLES[diff] ?? DIFFICULTY_STYLES.intermediate;
              const diffLabel = diff ? diff.charAt(0).toUpperCase() + diff.slice(1) : '';
              const isCrisis = c.committee_type === 'crisis';
              const topics = c.topics ?? [];
              const seats = c.slotCount || c.total_slots;
              const copied = copiedCode === c.session_code && !!c.session_code;
              const dais = c.display_chairs ?? [];
              return (
                <article
                  key={c.id}
                  className="flex flex-col rounded-[24px]"
                  style={{
                    backgroundColor: 'rgba(250,248,243,0.82)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(221,212,192,0.95)',
                    boxShadow: '0 10px 30px rgba(27,56,40,0.08)',
                    transition: `transform 350ms ${EASE}, box-shadow 350ms ${EASE}`,
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 16px 40px rgba(27,56,40,0.13)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 10px 30px rgba(27,56,40,0.08)'; }}
                >
                  <div className="flex flex-col items-center px-5 pt-7 flex-1">
                    {/* Emblem — uploaded art or monogram medallion */}
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt={c.abbreviation ?? c.name}
                        style={{
                          width: '104px', height: '104px', objectFit: 'contain', flexShrink: 0,
                          filter: 'drop-shadow(0 10px 18px rgba(27,56,40,0.28))',
                        }}
                      />
                    ) : (
                      <MonogramMedallion text={c.abbreviation || c.name} isCrisis={isCrisis} size={96} />
                    )}

                    {/* Abbreviation eyebrow (when art carries the emblem, the monogram moves up here) */}
                    {c.abbreviation && (
                      <p style={{ margin: '16px 0 0 0', fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', color: '#B6871F', fontVariantNumeric: 'tabular-nums' }}>
                        {c.abbreviation.toUpperCase()}
                      </p>
                    )}

                    {/* Name */}
                    <h3
                      className="text-center font-bold text-[15.5px] leading-snug"
                      style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: c.abbreviation ? '4px 0 0 0' : '18px 0 0 0', minHeight: '2.6em' }}
                    >
                      {c.name}
                    </h3>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {diffLabel && (
                        <span
                          className="px-2.5 py-0.5 rounded-full"
                          style={{ ...diffStyle, fontSize: '10px', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}
                        >
                          {diffLabel}
                        </span>
                      )}
                      <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
                      <span className="text-[12px] font-semibold" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                        {seats} {isCrisis ? (seats === 1 ? 'role' : 'roles') : (seats === 1 ? 'seat' : 'seats')}
                      </span>
                      {isCrisis && (
                        <>
                          <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
                          <span className="text-[10px] font-bold" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em' }}>
                            CRISIS
                          </span>
                        </>
                      )}
                    </div>

                    {/* Topics — roman numerals */}
                    {topics.length > 0 && (
                      <div className="w-full mt-5 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                        {topics.map((topic, ti) => (
                          <div key={topic} className="flex items-start gap-2.5 py-1">
                            <span
                              className="flex-shrink-0 text-right"
                              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11px', color: '#B6871F', width: '18px', lineHeight: '19px' }}
                            >
                              {ROMAN[ti] ?? String(ti + 1)}.
                            </span>
                            <span className="text-[12.5px] font-medium" style={{ color: '#2E2820', fontFamily: "'Outfit', sans-serif", lineHeight: 1.55 }}>
                              {topic}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dais + session code ticket + PP deadline — pinned to the card bottom */}
                    <div className="w-full mt-auto">
                      {/* Dais — the committee's chairs, editable in place */}
                      <div className="w-full mt-5 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                        <p className="text-center" style={{ margin: '0 0 10px 0', fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: '#B6871F' }}>
                          DAIS
                        </p>
                        <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-3">
                          {dais.map((ch, chIdx) => (
                            <div key={`${ch.name}-${chIdx}`} className="group relative flex flex-col items-center text-center" style={{ width: 84 }}>
                              <div className="relative">
                                {ch.avatar_url ? (
                                  <img
                                    src={ch.avatar_url}
                                    alt={ch.name}
                                    style={{
                                      width: '52px', height: '52px', borderRadius: '9999px', objectFit: 'cover',
                                      boxShadow: '0 4px 12px rgba(27,56,40,0.22)',
                                      backgroundColor: '#EDE7D8',
                                    }}
                                  />
                                ) : (
                                  <span
                                    className="flex items-center justify-center"
                                    style={{
                                      width: '52px', height: '52px', borderRadius: '9999px',
                                      backgroundColor: '#1B3828', color: '#EED98A',
                                      fontSize: '17px', fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                                    }}
                                  >
                                    {ch.name.charAt(0)}
                                  </span>
                                )}
                                <button
                                  onClick={() => handleRemoveChair(c, chIdx, ch.name)}
                                  title={`Remove ${ch.name} from the dais`}
                                  className="absolute opacity-0 group-hover:opacity-100 flex items-center justify-center focus:outline-none"
                                  style={{
                                    top: -4, right: -4, width: 18, height: 18, borderRadius: '9999px',
                                    backgroundColor: '#FAF8F3', border: '1px solid rgba(139,32,32,0.45)', color: '#8B2020',
                                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(27,56,40,0.18)',
                                    transition: `opacity 200ms ${EASE}`,
                                  }}
                                >
                                  <X size={10} strokeWidth={2.6} />
                                </button>
                              </div>
                              <span className="text-[11.5px] font-semibold mt-2 leading-tight" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                {ch.name}
                              </span>
                            </div>
                          ))}
                          <button
                            onClick={() => setAddChairTarget(c)}
                            className="flex flex-col items-center text-center focus:outline-none"
                            style={{ width: 84, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <span
                              className="flex items-center justify-center"
                              style={{
                                width: '52px', height: '52px', borderRadius: '9999px',
                                border: '1.5px dashed rgba(27,56,40,0.4)',
                                color: '#1B3828',
                                backgroundColor: 'rgba(27,56,40,0.04)',
                                transition: `background-color 250ms ${EASE}, color 250ms ${EASE}, border-color 250ms ${EASE}`,
                              }}
                              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderStyle = 'solid'; }}
                              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.color = '#1B3828'; el.style.borderStyle = 'dashed'; }}
                            >
                              <Plus size={20} strokeWidth={2.2} />
                            </span>
                            <span className="text-[10px] font-bold mt-2" style={{ color: '#B6871F', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em' }}>
                              ADD CHAIR
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="w-full mt-5 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                        {c.session_code ? (
                          <button
                            onClick={() => handleCopyCode(c.session_code!)}
                            title="Copy session code"
                            className="w-full flex items-stretch overflow-hidden rounded-xl focus:outline-none"
                            style={{
                              border: copied ? '1px solid rgba(61,122,82,0.45)' : '1px solid rgba(27,56,40,0.22)',
                              backgroundColor: copied ? 'rgba(61,122,82,0.10)' : 'rgba(27,56,40,0.045)',
                              cursor: 'pointer',
                              transition: `background-color 300ms ${EASE}, border-color 300ms ${EASE}`,
                            }}
                          >
                            <span className="flex items-center justify-center py-2.5 px-3" style={{ width: '45%' }}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: '#6B5F52' }}>
                                SESSION CODE
                              </span>
                            </span>
                            {/* Ticket perforation seam */}
                            <span aria-hidden style={{ borderLeft: '1px dashed rgba(27,56,40,0.35)', margin: '5px 0' }} />
                            <span className="flex-1 flex items-center justify-center gap-1.5 py-2.5">
                              {copied ? (
                                <>
                                  <Check size={12} style={{ color: '#3D7A52' }} />
                                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#3D7A52' }}>COPIED</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.14em', color: '#1B3828', fontVariantNumeric: 'tabular-nums' }}>
                                    {c.session_code}
                                  </span>
                                  <Copy size={11} style={{ color: 'rgba(27,56,40,0.55)' }} />
                                </>
                              )}
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => generateSessionCode(c)}
                            className="w-full rounded-xl py-2.5 text-[11px] font-bold focus:outline-none"
                            style={{
                              border: '1.5px dashed rgba(27,56,40,0.35)', color: '#1B3828', backgroundColor: 'transparent',
                              fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em', cursor: 'pointer',
                              transition: `background-color 300ms ${EASE}, color 300ms ${EASE}, border-color 300ms ${EASE}`,
                            }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderStyle = 'solid'; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#1B3828'; el.style.borderStyle = 'dashed'; }}
                          >
                            GENERATE SESSION CODE
                          </button>
                        )}

                        {c.position_paper_deadline && (
                          <div className="flex items-center justify-center gap-1.5 mt-3">
                            <CalendarClock size={11} style={{ color: '#B6871F', flexShrink: 0 }} />
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 600, color: '#6B5F52', fontVariantNumeric: 'tabular-nums' }}>
                              Position papers due {new Date(c.position_paper_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 pb-5 pt-4 flex gap-2">
                    <button
                      onClick={() => setEditTarget(c)}
                      className="flex-1 rounded-xl py-2.5 text-[11px] font-bold focus:outline-none"
                      style={{
                        backgroundColor: 'transparent', color: '#1B3828',
                        border: '1.5px solid rgba(27,56,40,0.35)',
                        fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em', cursor: 'pointer',
                        transition: `background-color 300ms ${EASE}, color 300ms ${EASE}`,
                      }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#1B3828'; }}
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      title="Delete committee"
                      className="flex items-center justify-center rounded-xl px-3.5 focus:outline-none"
                      style={{
                        border: '1.5px solid rgba(139,32,32,0.32)', color: '#8B2020', backgroundColor: 'transparent',
                        cursor: 'pointer',
                        transition: `background-color 300ms ${EASE}, color 300ms ${EASE}`,
                      }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#8B2020'; el.style.color = '#FFFFFF'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#8B2020'; }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {showAdd && (
        <CommitteeEditorModal
          conference={conference}
          committee={null}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadCommittees(); }}
        />
      )}
      {editTarget && (
        <CommitteeEditorModal
          conference={conference}
          committee={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadCommittees(); }}
        />
      )}
      {addChairTarget && (
        <AddChairModal
          conferenceId={conference.id}
          committee={addChairTarget}
          committees={committees}
          onClose={() => setAddChairTarget(null)}
          onDone={() => { setAddChairTarget(null); loadCommittees(); }}
        />
      )}
      {deleteTarget && (
        <ModalOverlay onClose={() => { if (!deleting) setDeleteTarget(null); }}>
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 400 }}>
            <p className="text-sm font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Delete &ldquo;{deleteTarget.name}&rdquo;?</p>
            <p className="text-xs" style={{ color: '#6B5D4F', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
              This permanently removes the committee and its live session — including all delegates, documents, messages, country slots, and allocations. Applicants are kept but returned to unassigned. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
              <button onClick={() => handleDeleteCommittee(deleteTarget)} disabled={deleting} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: deleting ? '#DDD4C0' : '#8B2020', color: deleting ? '#9A8A78' : '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>{deleting ? 'DELETING...' : 'DELETE'}</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
