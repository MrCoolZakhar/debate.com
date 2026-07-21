'use client';

// Chair participant view. A chair may hold the dais on more than one
// committee, so this fetches every conference_committees row where
// chair_user_ids contains them (safe under "Associated users read their
// committee" RLS, row-level, so session_code etc. only comes back for
// committees they actually chair) and stacks a full block per committee.

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, ExternalLink, FileText, Mail, Radio } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { FlagImg } from '@/components/FlagImg';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { queueParticipantEventEmail } from '@/lib/emailEvents';
import { getSiteUrl } from '@/lib/emailBlocks';
import StudyGuideCard from './StudyGuideCard';
import { SectionCard, OUTFIT, capitalize, effectiveReleaseTime } from './shared';

const DIFFICULTY_STYLES: Record<string, { bg: string; color: string }> = {
  beginner: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  intermediate: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  advanced: { bg: 'rgba(184,132,74,0.16)', color: '#B8844A' },
  expert: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};
const ROMAN = ['I', 'II', 'III'];

const PP_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  submitted: { bg: 'rgba(238,217,138,0.2)', color: '#B8844A' },
  reviewed: { bg: 'rgba(154,138,120,0.15)', color: '#9A8A78' },
  approved: { bg: 'rgba(61,122,82,0.12)', color: '#3D7A52' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};
const NOT_SUBMITTED_STYLE = { bg: 'rgba(154,138,120,0.14)', color: '#6B5F52' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

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
}

interface RosterMember {
  id: string;
  user_id: string;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  profiles: { display_name: string; avatar_url: string | null; email: string } | null;
}

interface PositionPaperRow {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  status: string;
  chair_feedback: string | null;
  submitted_at: string;
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

// ── Roster row (item 3), expandable, feedback authoring ───────────────────

function RosterRow({ member, paper, conferenceId, onFeedbackSaved }: {
  member: RosterMember;
  paper: PositionPaperRow | null;
  conferenceId: string;
  onFeedbackSaved: (paperId: string, feedback: string) => void;
}) {
  const { session } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [feedbackText, setFeedbackText] = useState(paper?.chair_feedback ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const name = member.profiles?.display_name ?? 'Unknown';
  const statusStyle = paper ? (PP_STATUS_STYLES[paper.status] ?? PP_STATUS_STYLES.submitted) : NOT_SUBMITTED_STYLE;
  const statusLabel = paper ? paper.status.toUpperCase() : 'NOT SUBMITTED';

  async function handleSaveFeedback() {
    if (!paper || !session || saving) return;
    setSaving(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const trimmed = feedbackText.trim();
    const { error: updateErr } = await supabase.from('position_papers').update({ chair_feedback: trimmed || null }).eq('id', paper.id);
    if (updateErr) {
      setError(updateErr.message || 'Could not save feedback.');
      setSaving(false);
      return;
    }
    // Queued through the participant-events route (server-side, service
    // role) rather than queueEventEmail directly — email_outbox is
    // organizer-only under RLS, a chair session can't insert rows itself.
    await queueParticipantEventEmail(session.access_token, conferenceId, 'position_paper_feedback', [member.id]);
    setSaving(false);
    setSaved(true);
    onFeedbackSaved(paper.id, trimmed);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(221,212,192,0.7)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left focus:outline-none"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {member.profiles?.avatar_url ? (
          <img src={member.profiles.avatar_url} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32 }} />
        ) : (
          <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 32, height: 32, backgroundColor: '#1B3828', color: '#EED98A', fontSize: 13, fontWeight: 700, fontFamily: OUTFIT }}>
            {name.charAt(0)}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>{name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {member.assigned_country_code && <FlagImg code={member.assigned_country_code} size={14} />}
            <span className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{member.assigned_country_name ?? 'Unassigned'}</span>
          </div>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full flex-shrink-0"
          style={{ ...statusStyle, fontSize: '9px', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.06em' }}
        >
          {statusLabel}
        </span>
        {expanded ? <ChevronUp size={15} style={{ color: '#9A8A78', flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: '#9A8A78', flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(221,212,192,0.5)' }}>
          {member.profiles?.email && (
            <a
              href={`mailto:${member.profiles.email}`}
              className="flex items-center gap-1.5 mt-3 text-xs focus:outline-none"
              style={{ color: '#9A8A78', fontFamily: OUTFIT, textDecoration: 'none' }}
            >
              <Mail size={12} /> {member.profiles.email}
            </a>
          )}

          {!paper ? (
            <p className="text-sm mt-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              No position paper submitted yet.
            </p>
          ) : (
            <>
              <a
                href={paper.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mt-3 transition-colors"
                style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)', textDecoration: 'none' }}
              >
                <FileText size={14} style={{ color: '#1B3828', flexShrink: 0 }} />
                <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{paper.file_name}</span>
                <ExternalLink size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
              </a>
              <p className="text-[11px] mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Submitted {fmtDate(paper.submitted_at)}</p>

              <div className="mt-4">
                <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: '#6E5F4E', fontFamily: OUTFIT }}>
                  WRITE FEEDBACK
                </label>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  rows={3}
                  placeholder="Notes for this delegate..."
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none"
                  style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleSaveFeedback}
                    disabled={saving}
                    className="rounded-lg px-4 py-2 text-xs font-bold focus:outline-none"
                    style={{
                      backgroundColor: saving ? '#DDD4C0' : '#1B3828', color: saving ? '#9A8A78' : '#EED98A',
                      border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em', cursor: saving ? 'default' : 'pointer',
                    }}
                  >
                    {saving ? 'SAVING...' : 'SAVE'}
                  </button>
                  {saved && <span style={{ fontSize: 11, fontWeight: 700, color: '#3D7A52', fontFamily: OUTFIT }}>Saved ✓</span>}
                  {error && <span style={{ fontSize: 11, color: '#8B2020', fontFamily: OUTFIT }}>{error}</span>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── One committee's full block ──────────────────────────────────────────────

function ChairCommitteeBlock({ conferenceId, committee, chairDisplayName, conferenceStartDate }: {
  conferenceId: string;
  committee: ChairCommittee;
  chairDisplayName: string;
  conferenceStartDate: string | null;
}) {
  const { session } = useAuth();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [papers, setPapers] = useState<PositionPaperRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [{ data: rosterData }, { data: paperData }] = await Promise.all([
      supabase
        .from('applications')
        .select('id, user_id, assigned_country_code, assigned_country_name, profiles (display_name, avatar_url, email)')
        .eq('assigned_committee_id', committee.id)
        .in('status', ['accepted', 'assigned']),
      supabase
        .from('position_papers')
        .select('id, user_id, file_url, file_name, status, chair_feedback, submitted_at')
        .eq('conference_committee_id', committee.id),
    ]);
    setRoster(((rosterData ?? []) as unknown as RosterMember[]).sort((a, b) => (a.profiles?.display_name ?? '').localeCompare(b.profiles?.display_name ?? '')));
    setPapers((paperData ?? []) as PositionPaperRow[]);
    setLoading(false);
  }, [session, committee.id]);

  useEffect(() => { load(); }, [load]);

  function handleFeedbackSaved(paperId: string, feedback: string) {
    setPapers(prev => prev.map(p => (p.id === paperId ? { ...p, chair_feedback: feedback || null } : p)));
  }

  const paperByUser = new Map(papers.map(p => [p.user_id, p]));

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
        ) : roster.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No delegates allocated to this committee yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {roster.map(m => (
              <RosterRow key={m.id} member={m} paper={paperByUser.get(m.user_id) ?? null} conferenceId={conferenceId} onFeedbackSaved={handleFeedbackSaved} />
            ))}
          </div>
        )}
      </SectionCard>

      <StudyGuideCard committeeId={committee.id} />
    </div>
  );
}

// ── ChairParticipant ─────────────────────────────────────────────────────────

export default function ChairParticipant({ conferenceId }: { conferenceId: string }) {
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
        .select('id, name, abbreviation, topics, difficulty, committee_type, logo_url, session_code, released_to_chairs_at')
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
        <ChairCommitteeBlock key={c.id} conferenceId={conferenceId} committee={c} chairDisplayName={profile?.display_name ?? 'Chair'} conferenceStartDate={conferenceStartDate} />
      ))}
    </div>
  );
}
