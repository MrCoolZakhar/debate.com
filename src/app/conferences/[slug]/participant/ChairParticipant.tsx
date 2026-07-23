'use client';

// Chair participant view. A chair may hold the dais on more than one
// committee, so this fetches every conference_committees row where
// chair_user_ids contains them (safe under "Associated users read their
// committee" RLS, row-level, so session_code etc. only comes back for
// committees they actually chair) and stacks a full block per committee.

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Radio } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { getSiteUrl } from '@/lib/emailBlocks';
import PositionPaperRoster, { type RosterAllocation, type RosterPaper } from '@/components/PositionPaperRoster';
import { fetchMessageStubsForPapers, type PaperMessageStub } from '@/lib/positionPapers';
import StudyGuideCard from './StudyGuideCard';
import { SectionCard, OUTFIT, capitalize, effectiveReleaseTime } from './shared';

const DIFFICULTY_STYLES: Record<string, { bg: string; color: string }> = {
  beginner: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  intermediate: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  advanced: { bg: 'rgba(184,132,74,0.16)', color: '#B8844A' },
  expert: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};
const ROMAN = ['I', 'II', 'III'];

interface ChairCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  logo_url: string | null;
  session_code: string | null;
  released_to_chairs_at: string | null;
  position_paper_deadline: string | null;
}

interface RosterAllocationRow {
  country_code: string;
  user_id: string | null;
  profiles: { display_name: string } | null;
  applications: { invited_name: string | null } | null;
}

// ── Committee header card (item 1), mirrors the public committee card ─────

function CommitteeHeaderCard({ committee }: { committee: ChairCommittee }) {
  const diff = committee.difficulty?.toLowerCase() ?? '';
  const diffStyle = DIFFICULTY_STYLES[diff] ?? DIFFICULTY_STYLES.intermediate;
  const isCrisis = committee.committee_type === 'crisis';
  const topics = committee.topics ?? [];

  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center">
        {committee.logo_url ? (
          <img
            src={committee.logo_url}
            alt={committee.abbreviation ?? committee.name}
            style={{ width: '96px', height: '96px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 10px 18px rgba(27,56,40,0.28))' }}
          />
        ) : (
          <MonogramMedallion text={committee.abbreviation || committee.name} isCrisis={isCrisis} size={88} />
        )}
        <h3 className="font-bold text-[17px] leading-snug mt-4" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {committee.name}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          {committee.difficulty && (
            <span className="px-2.5 py-0.5 rounded-full" style={{ ...diffStyle, fontSize: '10px', fontFamily: OUTFIT, letterSpacing: '0.06em', fontWeight: 700 }}>
              {capitalize(diff)}
            </span>
          )}
          {isCrisis && (
            <>
              <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
              <span className="text-[10px] font-bold" style={{ color: '#8B2020', fontFamily: OUTFIT, letterSpacing: '0.12em' }}>CRISIS</span>
            </>
          )}
        </div>
        {topics.length > 0 && (
          <div className="w-full mt-5 pt-4 text-left" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
            {topics.map((topic, ti) => (
              <div key={topic} className="flex items-start gap-2.5 py-1">
                <span className="flex-shrink-0 text-right" style={{ fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11px', color: '#B6871F', width: '18px', lineHeight: '19px' }}>
                  {ROMAN[ti] ?? String(ti + 1)}.
                </span>
                <span className="text-[12.5px] font-medium" style={{ color: '#2E2820', fontFamily: OUTFIT, lineHeight: 1.55 }}>{topic}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── Session card (item 2) ───────────────────────────────────────────────────

function SessionCard({ committee, chairDisplayName, conferenceStartDate }: {
  committee: ChairCommittee;
  chairDisplayName: string;
  conferenceStartDate: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!committee.session_code) return;
    navigator.clipboard.writeText(committee.session_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // "Released" now means the timestamp is non-null and in the past, OR it's
  // null and the conference's start_date has arrived (the default release
  // moment) — not just "a stamp exists at all", since a future stamp is a
  // schedule, not a release yet.
  const releaseMs = effectiveReleaseTime(committee.released_to_chairs_at, conferenceStartDate);
  const released = releaseMs !== null && releaseMs <= Date.now();

  return (
    <SectionCard>
      <p className="mb-3" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
        SESSION
      </p>
      {!released ? (
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Your committee&apos;s session will be shared by the organizing team.
        </p>
      ) : !committee.session_code ? (
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Your session hasn&apos;t been created yet. Check back soon.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleCopy}
            title="Copy session code"
            className="w-full flex items-stretch overflow-hidden rounded-xl focus:outline-none"
            style={{
              border: copied ? '1px solid rgba(61,122,82,0.45)' : '1px solid rgba(27,56,40,0.22)',
              backgroundColor: copied ? 'rgba(61,122,82,0.10)' : 'rgba(27,56,40,0.045)',
              cursor: 'pointer',
            }}
          >
            <span className="flex items-center justify-center py-2.5 px-3" style={{ width: '45%' }}>
              <span style={{ fontFamily: OUTFIT, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: '#6B5F52' }}>SESSION CODE</span>
            </span>
            <span aria-hidden style={{ borderLeft: '1px dashed rgba(27,56,40,0.35)', margin: '5px 0' }} />
            <span className="flex-1 flex items-center justify-center gap-1.5 py-2.5">
              {copied ? (
                <>
                  <Check size={12} style={{ color: '#3D7A52' }} />
                  <span style={{ fontFamily: OUTFIT, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#3D7A52' }}>COPIED</span>
                </>
              ) : (
                <>
                  <span style={{ fontFamily: OUTFIT, fontSize: '13px', fontWeight: 700, letterSpacing: '0.14em', color: '#1B3828', fontVariantNumeric: 'tabular-nums' }}>{committee.session_code}</span>
                  <Copy size={11} style={{ color: 'rgba(27,56,40,0.55)' }} />
                </>
              )}
            </span>
          </button>
          <a
            href={`${getSiteUrl()}/chair/${committee.session_code}?chairName=${encodeURIComponent(chairDisplayName)}`}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.06em', textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            <Radio size={14} /> JOIN SESSION
          </a>
        </div>
      )}
    </SectionCard>
  );
}

// ── One committee's full block ──────────────────────────────────────────────

function ChairCommitteeBlock({ conferenceSlug, committee, chairDisplayName, conferenceStartDate }: {
  conferenceSlug: string;
  committee: ChairCommittee;
  chairDisplayName: string;
  conferenceStartDate: string | null;
}) {
  const { user, session } = useAuth();
  const [allocations, setAllocations] = useState<RosterAllocationRow[]>([]);
  const [papers, setPapers] = useState<RosterPaper[]>([]);
  const [messagesByPaper, setMessagesByPaper] = useState<Record<string, PaperMessageStub[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [{ data: allocData }, { data: paperData }] = await Promise.all([
      supabase
        .from('conference_allocations')
        .select('country_code, user_id, profiles (display_name), applications:application_id (invited_name)')
        .eq('conference_committee_id', committee.id),
      supabase
        .from('position_papers')
        .select('id, country_code, status, submitted_at, reviewer_seen_at')
        .eq('conference_committee_id', committee.id),
    ]);
    setAllocations((allocData ?? []) as unknown as RosterAllocationRow[]);
    const paperRows = (paperData ?? []) as RosterPaper[];
    setPapers(paperRows);
    setMessagesByPaper(await fetchMessageStubsForPapers(supabase, paperRows.map(p => p.id)));
    setLoading(false);
  }, [session, committee.id]);

  useEffect(() => { load(); }, [load]);

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  function updateStatus(paperId: string, status: string) {
    if (!user || !session || busyIds.has(paperId)) return;
    const previous = papers;
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, status } : p));
    setActionError('');
    markBusy(paperId, true);
    const supabase = getAuthedClient(session.access_token);
    supabase.from('position_papers').update({
      status, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    }).eq('id', paperId).then(({ error }) => {
      markBusy(paperId, false);
      if (error) {
        setPapers(previous);
        setActionError("Couldn't update the paper status. The change was reverted.");
      }
    });
  }

  const rosterAllocations: RosterAllocation[] = allocations.map(a => ({
    country_code: a.country_code, user_id: a.user_id,
    display_name: a.profiles?.display_name ?? null,
    invited_name: a.applications?.invited_name ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <CommitteeHeaderCard committee={committee} />
      <SessionCard committee={committee} chairDisplayName={chairDisplayName} conferenceStartDate={conferenceStartDate} />

      <SectionCard>
        <p className="mb-4" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 16px 0' }}>
          DELEGATE ROSTER
        </p>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <PositionPaperRoster
            conferenceSlug={conferenceSlug}
            currentUserId={user?.id ?? ''}
            deadline={committee.position_paper_deadline}
            allocations={rosterAllocations}
            papers={papers}
            messagesByPaper={messagesByPaper}
            busyIds={busyIds}
            onApprove={id => updateStatus(id, 'approved')}
            onReject={id => updateStatus(id, 'rejected')}
          />
        )}
        {actionError && (
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020', marginTop: 10 }}>{actionError}</p>
        )}
      </SectionCard>

      <StudyGuideCard committeeId={committee.id} />
    </div>
  );
}

// ── ChairParticipant ─────────────────────────────────────────────────────────

export default function ChairParticipant({ conferenceId, conferenceSlug }: { conferenceId: string; conferenceSlug: string }) {
  const { user, session, profile } = useAuth();
  const [committees, setCommittees] = useState<ChairCommittee[]>([]);
  const [conferenceStartDate, setConferenceStartDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [{ data }, { data: confData }] = await Promise.all([
      supabase
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, committee_type, logo_url, session_code, released_to_chairs_at, position_paper_deadline')
        .eq('conference_id', conferenceId)
        .contains('chair_user_ids', [user.id])
        .order('name', { ascending: true }),
      supabase
        .from('conferences')
        .select('start_date')
        .eq('id', conferenceId)
        .maybeSingle(),
    ]);
    setCommittees((data ?? []) as ChairCommittee[]);
    setConferenceStartDate((confData as { start_date?: string | null } | null)?.start_date ?? null);
    setLoading(false);
  }, [user, session, conferenceId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SectionCard>
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      </SectionCard>
    );
  }

  if (committees.length === 0) {
    return (
      <SectionCard>
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          You haven&apos;t been assigned a committee yet.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {committees.map(c => (
        <ChairCommitteeBlock key={c.id} conferenceSlug={conferenceSlug} committee={c} chairDisplayName={profile?.display_name ?? 'Chair'} conferenceStartDate={conferenceStartDate} />
      ))}
    </div>
  );
}
