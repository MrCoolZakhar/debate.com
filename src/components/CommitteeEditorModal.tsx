'use client';

// Shared committee editor modal, extracted from manage/[slug]/committees/page.tsx
// so the organiser committees tab and the public conference page can share it.
// Exposes: CommitteeEditorModal (create + edit, with built-in type picker for the
// create flow), MonogramMedallion (fallback emblem), ModalOverlay (house modal
// backdrop) and mintConferenceSession (session minting for conference committees).

import { useState, useEffect, useCallback } from 'react';
import { X, Globe, Users, Landmark, Scale, Zap, UserPlus, Mail, User } from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuButton, type NeuGradient } from '@/components/neu';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getCountryByName } from '@/lib/countries';
import {
  ConferenceRosterPicker,
  ConferenceCommitteeNameInput,
  entry,
  type RosterEntry,
} from '@/components/ConferenceRosterPicker';
import { matchPresetEmblem } from '@/lib/presetNames';
import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import { LogoDisc } from '@/components/LogoDisc';
import { LogoCropModal } from '@/components/LogoCropModal';
import Portal from '@/components/Portal';
import Loader from '@/components/Loader';
import { sendChairInvite, findChairInviteRoleConflict } from '@/lib/chairInvites';
import { queueEventEmail } from '@/lib/emailEvents';

// ── Design constants ──────────────────────────────────────────────────────────

// Same recipe as the public conference detail page committee cards.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #DDD4C0',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#1C1410',
  backgroundColor: '#FAF8F3',
  outline: 'none',
  fontFamily: "'Outfit', sans-serif",
};

// Topics are capped at 120 characters. The cap applies per topic entry, not to
// the topics array as a whole. It is enforced in the app only — a large share
// of the topic entries already in the database are longer than this, so a CHECK
// constraint would reject those rows on their next write. Legacy topics are
// grandfathered via baselineTopics below.
//
// 120, not 60: a perfectly ordinary MUN topic runs past 60 without trying
// ("Addressing the Rise of Non-State Actors and Transnational Organized Crime"
// is 73), so the tighter cap fired on normal titles rather than on the runaway
// ones it exists to catch — the longest in the database is over a thousand
// characters.
const TOPIC_MAX_LENGTH = 120;
// Point at which the remaining-characters hint appears, so the limit is visible
// before it is hit rather than only after.
const TOPIC_HINT_AT = 95;

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#6E5F4E',
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: '0.01em',
  marginBottom: 4,
};

// ── Types ─────────────────────────────────────────────────────────────────────

// Committee type governs rostering: GA + Specialised roster by country slots;
// Crisis rosters free-text character names. Only Crisis takes the character
// path, every non-crisis type falls through to countries.
export type CommitteeType = 'general-assembly' | 'specialised' | 'crisis';

export interface EditableCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  session_id: string | null;
  logo_url: string | null;
}

// ── Fallback emblem, gradient monogram disc with grain, matching the public card

export function MonogramMedallion({ text, isCrisis, size }: { text: string; isCrisis: boolean; size: number }) {
  const monogram = text.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || '—';
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '9999px',
        background: isCrisis
          ? 'linear-gradient(135deg, #3C1414 0%, #6E1E1E 100%)'
          : 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)',
        boxShadow: '0 10px 24px rgba(27,56,40,0.26)',
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.12 }} />
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: monogram.length > 4 ? Math.round(size * 0.135) : Math.round(size * 0.167), fontWeight: 700, color: '#EED98A', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
        {monogram}
      </span>
    </div>
  );
}

// ── Shared modal overlay ──────────────────────────────────────────────────────
// Moved to @/components/ModalOverlay (background scroll lock + Escape + ARIA
// live there now, shared by every dialog in the app). Re-exported so the many
// existing `import { ModalOverlay } from '@/components/CommitteeEditorModal'`
// call sites keep working.

import { ModalOverlay } from '@/components/ModalOverlay';
export { ModalOverlay };

// ── Session minting ───────────────────────────────────────────────────────────

// Mint a real, joinable session for a conference committee and link it back.
// committees/current_speaker carry a public read/write RLS policy, so the authed
// organizer client can write them directly. Generates a unique 6-char code,
// retrying on a code-uniqueness collision. Returns the code, or null on failure.
export async function mintConferenceSession(
  supabase: ReturnType<typeof getAuthedClient>,
  confCommitteeId: string,
  name: string,
  topic: string,
  countries: string[],
  // Names (countries or characters) flagged as observers. Mirrors the standalone
  // session flow: delegates.is_observer carries the flag on the live session, so
  // the chair/roll-call/voting views treat these rows as observers identically.
  observers: string[] = [],
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const chairJoinSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const { data: sessionRow, error: sErr } = await supabase
      .from('committees')
      .insert({
        code,
        name,
        topic: topic || 'TBD',
        chair_names: [],
        phase: 'pre-session',
        speaker_time_limit: 90,
        settings: { chairJoinSuffix, separateChairCode: true },
        session_origin: 'conference',
      })
      .select('id')
      .single();
    if (sErr) {
      if (sErr.code === '23505') continue; // code collision, try a new code
      console.error('Error minting conference session:', sErr);
      return null;
    }
    await supabase.from('current_speaker').insert({
      committee_id: sessionRow.id,
      delegate_id: null,
      country: null,
      time_remaining: 90,
    });
    if (countries.length > 0) {
      const observerSet = new Set(observers.map((o) => o.toLowerCase()));
      await supabase.from('delegates').insert(
        countries.map((country) => ({ committee_id: sessionRow.id, country, status: 'absent', is_observer: observerSet.has(country.toLowerCase()) }))
      );
    }
    await supabase
      .from('conference_committees')
      .update({ session_id: sessionRow.id, session_code: code })
      .eq('id', confCommitteeId);
    return code;
  }
  return null;
}

// ── ChairsDock (side popover, docked outside the main editor modal) ───────────
// A small distinct panel showing the committee's seated chairs (avatars), plus
// entry points to add an accepted applicant or invite a chair by email. Reuses
// the existing chair flow: the create_chair_invite RPC via sendChairInvite, and
// the chair_user_ids append the committees page assigns with.

interface DisplayChair { name: string; avatar_url: string | null }
interface ChairApplicant {
  id: string;
  user_id: string;
  assigned_committee_id: string | null;
  profiles: { display_name: string; email: string; avatar_url: string | null } | null;
}

function ChairsDock({ conferenceId, committeeId, committeeName }: {
  conferenceId: string;
  committeeId: string;
  committeeName: string;
}) {
  const { session } = useAuth();
  const [chairs, setChairs] = useState<DisplayChair[] | null>(null);
  const [chairIds, setChairIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [applicants, setApplicants] = useState<ChairApplicant[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  // Two-roles warning, rendered inline below (neumorphic dialog) rather
  // than through the shared (flat) ConfirmModal.
  const [roleConflict, setRoleConflict] = useState<{ displayName: string; role: string; email: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('display_chairs, chair_user_ids')
      .eq('id', committeeId)
      .single();
    setChairs(((data?.display_chairs as DisplayChair[] | null) ?? []));
    setChairIds(((data?.chair_user_ids as string[] | null) ?? []));
  }, [session, committeeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!expanded || !session || applicants !== null) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('applications')
        .select('id, user_id, assigned_committee_id, profiles (display_name, email, avatar_url)')
        .eq('conference_id', conferenceId)
        .eq('role', 'chair')
        .in('status', ['accepted', 'assigned']);
      if (!cancelled) setApplicants((data ?? []) as unknown as ChairApplicant[]);
    })();
    return () => { cancelled = true; };
  }, [expanded, session, applicants, conferenceId]);

  async function doSend(em: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const res = await sendChairInvite(supabase, { conferenceId, committeeId, committeeName, email: em });
    if (!res.ok) { setErr(res.error ?? 'Could not invite that chair.'); return; }
    setNote(`Invited ${res.invitedName ?? em}.`);
    setEmail('');
    load();
  }

  async function invite() {
    const em = email.trim();
    if (!em || !session) return;
    setBusy(true); setErr(''); setNote('');
    const supabase = getAuthedClient(session.access_token);

    // Two-roles warning: this email already holds an active application in
    // another role, confirm before giving them a second one.
    const conflict = await findChairInviteRoleConflict(supabase, conferenceId, em);
    if (conflict) {
      setBusy(false);
      setRoleConflict({ ...conflict, email: em });
      return;
    }

    await doSend(em);
    setBusy(false);
  }

  async function handleProceedRoleConflict() {
    if (!roleConflict || confirmBusy) return;
    setConfirmBusy(true);
    await doSend(roleConflict.email);
    setConfirmBusy(false);
    setRoleConflict(null);
  }

  async function assign(app: ChairApplicant) {
    if (!session || chairIds.includes(app.user_id)) return;
    setBusy(true); setErr(''); setNote('');
    const supabase = getAuthedClient(session.access_token);
    const nextIds = Array.from(new Set([...chairIds, app.user_id]));
    const { error } = await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committeeId);
    if (error) { setBusy(false); setErr('Could not seat that chair.'); return; }
    await supabase.from('applications').update({ status: 'assigned', assigned_committee_id: committeeId, decided_by: session.user.id, decided_at: new Date().toISOString() }).eq('id', app.id);
    // The guard at the top of this function already ensures app.user_id
    // wasn't already seated, so every call here is a genuinely new chair.
    queueEventEmail(supabase, conferenceId, 'chair_assigned', [app.id]);
    setChairIds(nextIds);
    setApplicants((prev) => prev ? prev.filter((a) => a.id !== app.id) : prev);
    setBusy(false);
    setNote(`Seated ${app.profiles?.display_name ?? 'chair'}.`);
    load();
  }

  const visibleApplicants = (applicants ?? []).filter((a) => !chairIds.includes(a.user_id));

  return (
    <div
      className="rounded-2xl flex flex-col"
      style={{ width: 236, flexShrink: 0, backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 32px rgba(27,56,40,0.16)' }}
    >
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #EDE7D8' }}>
        <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#B6871F' }}>THE DAIS</p>
        <p className="font-bold text-[13.5px] mt-0.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Chairs</p>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2">
        {chairs === null ? (
          <div className="flex justify-center py-4"><div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} /></div>
        ) : chairs.length === 0 ? (
          <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.45 }}>No chairs seated yet.</p>
        ) : (
          chairs.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {c.avatar_url ? (
                <img src={c.avatar_url} alt={c.name} style={{ width: 28, height: 28, borderRadius: '9999px', objectFit: 'cover', backgroundColor: '#EDE7D8', flexShrink: 0 }} />
              ) : (
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: '9999px', backgroundColor: '#1B3828', color: '#EED98A', fontSize: 11, fontWeight: 700, fontFamily: OUTFIT }}>{c.name.charAt(0)}</span>
              )}
              <span className="text-[12.5px] truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{c.name}</span>
            </div>
          ))
        )}
      </div>

      <div className="px-4 pb-4 mt-auto">
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold text-[11px] focus:outline-none"
            style={{ border: '1.5px solid #1B3828', color: '#1B3828', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer', transition: `background-color 200ms ${EASE}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <UserPlus size={13} /> ADD CHAIR
          </button>
        ) : (
          <div className="flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid #EDE7D8' }}>
            {/* Invite by email */}
            <div>
              <p style={{ margin: '0 0 6px 0', fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>INVITE BY EMAIL</p>
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); invite(); } }}
                  placeholder="chair@example.com"
                  style={{ flex: 1, minWidth: 0, border: '1px solid #DDD4C0', borderRadius: 8, padding: '6px 9px', fontSize: 12, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none', fontFamily: OUTFIT }}
                />
                <button
                  onClick={invite}
                  disabled={busy || !email.trim()}
                  className="rounded-lg px-2.5 flex items-center justify-center focus:outline-none flex-shrink-0"
                  style={{ backgroundColor: busy || !email.trim() ? '#DDD4C0' : '#1B3828', color: busy || !email.trim() ? '#9A8A78' : '#EED98A', cursor: 'pointer' }}
                  title="Send invite"
                >
                  <Mail size={13} />
                </button>
              </div>
            </div>
            {/* Accepted applicants to seat */}
            <div>
              <p style={{ margin: '0 0 6px 0', fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>ACCEPTED APPLICANTS</p>
              {applicants === null ? (
                <div className="flex justify-center py-3"><div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} /></div>
              ) : visibleApplicants.length === 0 ? (
                <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>None available.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {visibleApplicants.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => assign(app)}
                      disabled={busy}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left focus:outline-none"
                      style={{ border: '1px solid #EDE7D8', backgroundColor: 'rgba(237,231,216,0.3)', cursor: 'pointer' }}
                      title={`Seat ${app.profiles?.display_name ?? 'chair'}`}
                    >
                      {app.profiles?.avatar_url ? (
                        <img src={app.profiles.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '9999px', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: '9999px', backgroundColor: '#1B3828', color: '#EED98A', fontSize: 10, fontWeight: 700, fontFamily: OUTFIT }}>{(app.profiles?.display_name ?? '?').charAt(0)}</span>
                      )}
                      <span className="text-[11.5px] truncate flex-1 min-w-0" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{app.profiles?.display_name ?? 'Unknown'}</span>
                      <UserPlus size={12} style={{ color: '#1B3828', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {note && <p className="text-[10.5px] mt-2" style={{ color: '#2A5A3C', fontFamily: OUTFIT }}>{note}</p>}
        {err && <p className="text-[10.5px] mt-2" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{err}</p>}
      </div>
      {roleConflict && (
        <ModalOverlay onClose={() => { if (!confirmBusy) setRoleConflict(null); }}>
          <div
            className="p-6"
            style={{
              width: 'min(92vw, 420px)',
              backgroundColor: NEU.surface,
              borderRadius: 24,
              boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)`,
            }}
          >
            <p className="text-base mb-2" style={{ color: NEU.ink, fontWeight: 800, fontFamily: OUTFIT }}>
              This person already holds a role
            </p>
            <p className="text-sm mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
              {roleConflict.displayName} already has an active {roleConflict.role.replace(/-/g, ' ')} application at this conference. Accepting this chair invite will give them two roles.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRoleConflict(null)}
                disabled={confirmBusy}
                className="flex-1 rounded-full py-2.5 font-bold text-sm focus:outline-none"
                style={{
                  border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm,
                  fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: confirmBusy ? 'default' : 'pointer',
                }}
              >
                CANCEL
              </button>
              <NeuButton onClick={handleProceedRoleConflict} disabled={confirmBusy} style={{ flex: 1 }}>
                {confirmBusy ? 'PROCEEDING...' : 'PROCEED'}
              </NeuButton>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ── CommitteeEditor (create + edit) ───────────────────────────────────────────

function CommitteeEditor({ conferenceId, committeeType, existing, initialRoster, initialDelegationSize = 1, onClose, onSaved }: {
  conferenceId: string;
  committeeType: CommitteeType;
  existing?: EditableCommittee | null;
  initialRoster?: RosterEntry[];
  initialDelegationSize?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!existing;
  const isCrisis = (existing ? existing.committee_type : committeeType) === 'crisis';
  const [name, setName] = useState(existing?.name ?? '');
  const [abbreviation, setAbbreviation] = useState(existing?.abbreviation ?? '');
  const [topics, setTopics] = useState<string[]>(existing?.topics ?? []);
  const [topicInput, setTopicInput] = useState('');
  // The topics this committee was opened with. Every entry here is grandfathered:
  // it predates the 60-character cap, so it stays on the committee untruncated and
  // never blocks a save. Without this snapshot an organiser editing an old
  // committee's notification email could not save it because of a topic they did
  // not touch. Frozen at mount, exactly like baselineRoster below.
  const [baselineTopics] = useState<string[]>(existing?.topics ?? []);
  const [topicError, setTopicError] = useState('');
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 'intermediate');
  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster ?? []);
  const [baselineRoster] = useState<RosterEntry[]>(initialRoster ?? []);
  // Committee-level toggle: off = every country/character seats one delegate
  // (delegation_size 1, today's behavior), on = every slot seats two. No
  // per-country control — this single toggle drives every slot's size.
  const [doubleDelegation, setDoubleDelegation] = useState<boolean>(initialDelegationSize === 2);
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number | null>(null);
  // Turning double delegation OFF is destructive when second seats are
  // occupied — count of affected delegates, shown in the danger confirm modal.
  const [pendingDoubleOffCount, setPendingDoubleOffCount] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(existing?.logo_url ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  // Once the organiser uploads, clears, or picks an emblem, we stop auto-filling
  // the default from the name. An existing committee that already has an emblem
  // counts as manually set.
  const [emblemManuallySet, setEmblemManuallySet] = useState<boolean>(!!existing?.logo_url);
  // The picked file, held while the organiser frames it in LogoCropModal — the
  // same drag-to-fit step the conference logo upload uses. Nothing is uploaded
  // until they save the crop.
  const [emblemCropFile, setEmblemCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // A selected preset can force the roster path (ICC/ICJ/Crisis/HoC/Senate/Press
  // roster free-text seats even under a non-crisis type). Null → fall back to the
  // committee_type default. Cleared to 'country'/'character' on preset select.
  const [presetRosterMode, setPresetRosterMode] = useState<'country' | 'character' | null>(null);
  const rosterMode: 'country' | 'character' = presetRosterMode ?? (isCrisis ? 'character' : 'country');
  const isCharacterRoster = rosterMode === 'character';

  // Auto-assign a preset emblem as the default when the committee's name /
  // abbreviation matches a known body (UNSC, DISEC, WHO, …) and the organiser
  // has not set their own. Never overrides a manual choice.
  useEffect(() => {
    if (emblemManuallySet) return;
    setLogoUrl(matchPresetEmblem(name, abbreviation));
  }, [name, abbreviation, emblemManuallySet]);

  // Mirrors the conference logo upload in manage/[slug]/settings, same bucket, own
  // folder — including the LogoCropModal step in front of it, so a committee emblem
  // is framed exactly the way a conference logo is. What arrives here is therefore
  // always the crop tool's flattened 512×512 transparent PNG.
  async function handleEmblemUpload(file: File) {
    if (!session) return;
    if (file.size > 5 * 1024 * 1024) { setError('Emblem must be under 5MB.'); return; }
    setLogoUploading(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    const ext = file.name.split('.').pop();
    const path = 'committee-emblems/' + conferenceId + '-' + Date.now() + '.' + ext;
    const { error: upErr } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) { setError('Upload failed: ' + upErr.message); setLogoUploading(false); return; }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    setLogoUrl(urlData.publicUrl);
    setEmblemManuallySet(true);
    setLogoUploading(false);
  }

  function addTopic() {
    const t = topicInput.trim();
    if (!t || topics.length >= 3) return;
    if (topics.includes(t)) { setTopicError('That topic is already on the list.'); return; }
    // Over-length is not reported here: the live counter below the input has
    // been showing the actionable message since the 61st character.
    if (t.length > TOPIC_MAX_LENGTH) return;
    setTopics([...topics, t]);
    setTopicInput('');
    setTopicError('');
  }

  const topicLength = topicInput.trim().length;
  const topicOverBy = topicLength - TOPIC_MAX_LENGTH;
  // Only topics added or re-added during this edit are held to the cap. A topic
  // carried over untouched from the database is exempt, however long it is.
  const overLimitNewTopics = topics.filter((t) => t.length > TOPIC_MAX_LENGTH && !baselineTopics.includes(t));

  async function doCreate(supabase: ReturnType<typeof getAuthedClient>): Promise<boolean> {
    const delegationSize = doubleDelegation ? 2 : 1;
    const { data: created, error: err } = await supabase.from('conference_committees').insert({
      conference_id: conferenceId,
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      committee_type: committeeType,
      total_slots: roster.length,
      notification_email: null,
      logo_url: logoUrl,
      delegation_size: delegationSize,
    }).select('id').single();
    if (err || !created) { setError(err?.message ?? 'Failed to create committee.'); return false; }
    await supabase.from('committee_country_slots').insert(
      roster.map((r) => ({
        conference_committee_id: created.id,
        country_code: getCountryByName(r.name)?.code ?? r.name,
        country_name: r.name,
        delegation_size: delegationSize,
        importance: r.importance,
        is_observer: !!r.isObserver,
      }))
    );
    await mintConferenceSession(
      supabase, created.id, name.trim(), topics[0] ?? '',
      roster.map((r) => r.name),
      roster.filter((r) => r.isObserver).map((r) => r.name),
    );
    return true;
  }

  async function doEdit(supabase: ReturnType<typeof getAuthedClient>, forceRemoval: boolean, forceDoubleOff = false): Promise<'ok' | 'needs_confirm_removal' | 'needs_confirm_double_off' | 'fail'> {
    const ex = existing!;
    const baseNames = baselineRoster.map(r => r.name);
    const nextNames = roster.map(r => r.name);
    const baseTier = new Map(baselineRoster.map(r => [r.name, r.importance]));
    const baseObs = new Map(baselineRoster.map(r => [r.name, !!r.isObserver]));
    const added = roster.filter(r => !baseNames.includes(r.name));
    const removed = baseNames.filter(c => !nextNames.includes(c));
    // Rows kept across the edit whose importance tier the organiser changed.
    const retiered = roster.filter(r => baseTier.has(r.name) && baseTier.get(r.name) !== r.importance);
    // Rows kept across the edit whose observer flag the organiser toggled.
    const reobserved = roster.filter(r => baseObs.has(r.name) && baseObs.get(r.name) !== !!r.isObserver);
    const turnedDoubleOn = initialDelegationSize === 1 && doubleDelegation;
    const turnedDoubleOff = initialDelegationSize === 2 && !doubleDelegation;

    if (removed.length > 0 && !forceRemoval) {
      const { data: allocs } = await supabase
        .from('conference_allocations')
        .select('id')
        .eq('conference_committee_id', ex.id)
        .in('country_name', removed);
      if ((allocs?.length ?? 0) > 0) {
        setPendingRemovalCount(allocs!.length);
        return 'needs_confirm_removal';
      }
    }

    // Turning double delegation OFF is destructive when second seats are
    // occupied — count and gate BEFORE any write, exactly like the removal
    // check above. Turning it ON only opens second seats, always safe.
    if (turnedDoubleOff && !forceDoubleOff) {
      const { data: seat2 } = await supabase
        .from('conference_allocations')
        .select('id')
        .eq('conference_committee_id', ex.id)
        .eq('seat', 2);
      if ((seat2?.length ?? 0) > 0) {
        setPendingDoubleOffCount(seat2!.length);
        return 'needs_confirm_double_off';
      }
    }

    if (removed.length > 0) {
      await supabase.from('conference_allocations').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
      await supabase.from('committee_country_slots').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
      if (ex.session_id) {
        await supabase.from('delegates').delete().eq('committee_id', ex.session_id).in('country', removed);
      }
    }
    if (added.length > 0) {
      // Newly added countries always insert at the committee's current size.
      await supabase.from('committee_country_slots').insert(
        added.map((r) => ({
          conference_committee_id: ex.id,
          country_code: getCountryByName(r.name)?.code ?? r.name,
          country_name: r.name,
          delegation_size: doubleDelegation ? 2 : 1,
          importance: r.importance,
          is_observer: !!r.isObserver,
        }))
      );
      if (ex.session_id) {
        await supabase.from('delegates').insert(
          added.map((r) => ({ committee_id: ex.session_id, country: r.name, status: 'absent', is_observer: !!r.isObserver }))
        );
      }
    }
    // Persist tier-only changes on existing slots (the allocator reads this column).
    for (const r of retiered) {
      await supabase.from('committee_country_slots')
        .update({ importance: r.importance })
        .eq('conference_committee_id', ex.id)
        .eq('country_name', r.name);
    }
    // Persist observer-flag changes on kept rows, on both the slot (edit-prefill
    // home) and the live session delegate (so the session treats it identically).
    for (const r of reobserved) {
      await supabase.from('committee_country_slots')
        .update({ is_observer: !!r.isObserver })
        .eq('conference_committee_id', ex.id)
        .eq('country_name', r.name);
      if (ex.session_id) {
        await supabase.from('delegates')
          .update({ is_observer: !!r.isObserver })
          .eq('committee_id', ex.session_id)
          .eq('country', r.name);
      }
    }

    // Double delegation direction change, verified writes throughout.
    if (turnedDoubleOn) {
      const { data: cUpd, error: cErr } = await supabase.from('conference_committees')
        .update({ delegation_size: 2 })
        .eq('id', ex.id)
        .select('id');
      if (cErr || !cUpd || cUpd.length !== 1) {
        setDoubleDelegation(false);
        setError('Could not enable double delegation. Please try again.');
        return 'fail';
      }
      const { data: sUpd, error: sErr } = await supabase.from('committee_country_slots')
        .update({ delegation_size: 2 })
        .eq('conference_committee_id', ex.id)
        .select('id');
      if (sErr || !sUpd || sUpd.length !== nextNames.length) {
        setError('Double delegation was enabled, but some slots may not have updated. Please refresh and try again.');
        return 'fail';
      }
    } else if (turnedDoubleOff) {
      const { data: seat2Rows, error: fetchErr } = await supabase
        .from('conference_allocations')
        .select('id, application_id')
        .eq('conference_committee_id', ex.id)
        .eq('seat', 2);
      if (fetchErr) {
        setDoubleDelegation(true);
        setError('Could not turn off double delegation. Please try again.');
        return 'fail';
      }
      // Revert any linked application from 'assigned' back to 'accepted' before
      // the seat is removed, so it returns to the allocation pool.
      const appIds = (seat2Rows ?? []).map(r => r.application_id).filter((id): id is string => !!id);
      if (appIds.length > 0) {
        const { error: appErr } = await supabase.from('applications')
          .update({ status: 'accepted', assigned_committee_id: null, assigned_country_code: null, assigned_country_name: null, decided_by: session?.user.id ?? null, decided_at: new Date().toISOString() })
          .in('id', appIds)
          .eq('status', 'assigned');
        if (appErr) {
          setDoubleDelegation(true);
          setError('Could not revert affected applications. Please try again.');
          return 'fail';
        }
      }
      const { error: delErr } = await supabase.from('conference_allocations')
        .delete()
        .eq('conference_committee_id', ex.id)
        .eq('seat', 2)
        .select('id');
      if (delErr) {
        setDoubleDelegation(true);
        setError('Could not remove second-seat allocations. Please try again.');
        return 'fail';
      }
      const { data: cUpd, error: cErr } = await supabase.from('conference_committees')
        .update({ delegation_size: 1 })
        .eq('id', ex.id)
        .select('id');
      if (cErr || !cUpd || cUpd.length !== 1) {
        setDoubleDelegation(true);
        setError('Could not turn off double delegation. Please try again.');
        return 'fail';
      }
      const { data: sUpd, error: sErr } = await supabase.from('committee_country_slots')
        .update({ delegation_size: 1 })
        .eq('conference_committee_id', ex.id)
        .select('id');
      if (sErr || !sUpd || sUpd.length !== nextNames.length) {
        setError('Double delegation was turned off, but some slots may not have updated. Please refresh and try again.');
        return 'fail';
      }
    }

    await supabase.from('conference_committees').update({
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      total_slots: roster.length,
      logo_url: logoUrl,
    }).eq('id', ex.id);
    if (ex.session_id) {
      await supabase.from('committees').update({ name: name.trim(), topic: topics[0] ?? 'TBD' }).eq('id', ex.session_id);
    }
    return 'ok';
  }

  async function handleSave(forceRemoval = false, forceDoubleOff = false) {
    if (!name.trim()) { setError('Committee name is required.'); return; }
    if (roster.length === 0) { setError(isCharacterRoster ? 'Add at least one character.' : 'Add at least one country.'); return; }
    // Keyed off which topics changed, never off length alone — a committee whose
    // saved topic already exceeds the cap must still save fine.
    if (overLimitNewTopics.length > 0) {
      setError(`Topics are limited to ${TOPIC_MAX_LENGTH} characters. Shorten or remove "${overLimitNewTopics[0].slice(0, 40)}…".`);
      return;
    }
    if (!session) return;
    setSaving(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    if (isEdit) {
      const res = await doEdit(supabase, forceRemoval, forceDoubleOff);
      setSaving(false);
      if (res === 'needs_confirm_removal' || res === 'needs_confirm_double_off') return;
      if (res !== 'ok') return;
    } else {
      const ok = await doCreate(supabase);
      setSaving(false);
      if (!ok) return;
    }
    onSaved();
    onClose();
  }

  return (
    <>
    <ModalOverlay onClose={onClose}>
      <div className="flex items-start gap-3">
      <div className="rounded-2xl p-6" style={{ width: 'min(920px, calc(100vw - 32px))', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-bold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{isEdit ? 'Edit committee' : 'New committee'}</p>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-5">
          {/* Top row — name + difficulty on the left, live emblem preview on the right. */}
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <div>
                <label style={labelStyle}>Committee Name *</label>
                {!isCrisis ? (
                  <ConferenceCommitteeNameInput
                    value={name}
                    onChange={setName}
                    onPresetSelect={(p) => {
                      // Store the CANONICAL FULL NAME, always — the acronym goes
                      // in its own column and the display layer collapses the two
                      // (committeeDisplayName). This used to store the collapsed
                      // label as the name, which is why production has rows whose
                      // name and abbreviation are both literally "DISEC": the full
                      // name was thrown away at creation and no surface could ever
                      // show it beneath the acronym again.
                      setName(p.name);
                      setAbbreviation(p.acronym);
                      setPresetRosterMode(p.rosterMode ?? 'country');
                      if (!isEdit) setRoster(p.members.map((m) => entry(m)));
                    }}
                  />
                ) : (
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Cuban Missile Crisis, 1962" style={inputStyle} />
                )}
              </div>
              <div>
                <label style={labelStyle}>Difficulty</label>
                {/* Same MUN-level insignia the applications/account pages use to rank
                    delegates (beginner chevron → crowned-star expert), for consistency. */}
                <div className="flex gap-2">
                  {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((lvl) => {
                    const active = difficulty === lvl;
                    const accent = LEVEL_ACCENT[lvl] ?? '#9A8A78';
                    const lbl = lvl.charAt(0).toUpperCase() + lvl.slice(1);
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDifficulty(lvl)}
                        className="flex-1 flex flex-col items-center gap-1.5 rounded-xl py-2.5 focus:outline-none"
                        style={{
                          border: active ? `1.5px solid ${accent}` : '1px solid #DDD4C0',
                          backgroundColor: active ? `${accent}14` : '#FAF8F3',
                          cursor: 'pointer', transition: `all 180ms ${EASE}`,
                        }}
                      >
                        <span
                          className="flex items-center justify-center"
                          style={{ width: 30, height: 30, borderRadius: '9999px', background: `linear-gradient(150deg, ${accent}22, ${accent}12)`, border: `1px solid ${accent}55` }}
                        >
                          <LevelInsignia level={lvl} size={18} />
                        </span>
                        <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: active ? accent : '#6E5F4E', letterSpacing: '0.01em' }}>{lbl}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Emblem — auto-derived from the committee NAME (matchPresetEmblem), with
                an upload override. No manual preset swatches. */}
            <div className="flex flex-col items-center gap-2.5" style={{ width: 148, flexShrink: 0 }}>
              <label style={{ ...labelStyle, alignSelf: 'flex-start' }}>Emblem</label>
              {logoUploading ? (
                <div className="flex items-center justify-center" style={{ width: 96, height: 96 }}>
                  <Loader size={48} />
                </div>
              ) : logoUrl ? (
                <LogoDisc src={logoUrl} alt="Committee emblem" size={96} fallbackText={(abbreviation || name).replace(/[^A-Za-z0-9]/g, '').slice(0, 3)} />
              ) : (
                <MonogramMedallion text={abbreviation || name} isCrisis={isCrisis} size={96} />
              )}
              <div className="flex flex-col gap-1.5 w-full">
                <button
                  onClick={() => { if (!logoUploading) document.getElementById('committee-emblem-upload')?.click(); }}
                  className="w-full rounded-lg py-1.5 font-bold text-[10.5px] focus:outline-none"
                  style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.07em', cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                >
                  {logoUploading ? 'UPLOADING…' : logoUrl ? 'REPLACE ART' : 'UPLOAD ART'}
                </button>
                {emblemManuallySet && !logoUploading && (
                  <button
                    onClick={() => setEmblemManuallySet(false)}
                    title="Re-derive the emblem from the committee name"
                    className="w-full rounded-lg py-1.5 font-bold text-[10.5px] focus:outline-none"
                    style={{ border: '1.5px solid #DDD4C0', color: '#6E5F4E', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.07em', cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    RESET TO AUTO
                  </button>
                )}
              </div>
              <p className="text-[10.5px] text-center" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.4 }}>
                Auto-set from the name. Square transparent PNG works best, max 5MB.
              </p>
              <input
                id="committee-emblem-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) { setError('Emblem must be under 5MB.'); return; }
                  setError('');
                  setEmblemCropFile(f);
                }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Topics (optional, up to 3)</label>
            <div className="flex gap-2">
              {/* Deliberately no maxLength: swallowing the 61st keystroke reads as a
                  broken keyboard. Let them type past the cap and say so instead. */}
              <input value={topicInput} onChange={e => { setTopicInput(e.target.value); if (topicError) setTopicError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }} placeholder="Type a topic..." aria-invalid={topicOverBy > 0} style={{ ...inputStyle, flex: 1, borderColor: topicOverBy > 0 ? '#8B2020' : '#DDD4C0' }} disabled={topics.length >= 3} />
              <button onClick={addTopic} disabled={topics.length >= 3} className="rounded-xl px-4 font-bold text-sm focus:outline-none" style={{ backgroundColor: topics.length >= 3 ? '#DDD4C0' : '#1B3828', color: topics.length >= 3 ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}>Add topic</button>
            </div>
            {/* One message line: a hard error wins, then the over-limit count,
                then the approaching-the-limit countdown. Both colours clear 4.5:1
                on #FAF8F3 — the muted #9A8A78 is not used here because this text
                carries meaning. */}
            {topicError ? (
              <p role="alert" className="text-xs mt-1.5" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{topicError}</p>
            ) : topicOverBy > 0 ? (
              <p role="alert" className="text-xs mt-1.5" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                {topicOverBy} character{topicOverBy === 1 ? '' : 's'} over the {TOPIC_MAX_LENGTH}-character limit — shorten it to add this topic.
              </p>
            ) : topicLength >= TOPIC_HINT_AT ? (
              <p className="text-xs mt-1.5" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
                {TOPIC_MAX_LENGTH - topicLength} character{TOPIC_MAX_LENGTH - topicLength === 1 ? '' : 's'} left.
              </p>
            ) : null}
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {topics.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: '#EDE7D8', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    {t}
                    <button onClick={() => setTopics(topics.filter((_, j) => j !== i))} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid #EDE7D8' }}>
          <div className="flex items-center mb-3">
            <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              {isCharacterRoster ? <Users size={15} style={{ color: '#B6871F' }} /> : <Globe size={15} style={{ color: '#B6871F' }} />}
              {isCharacterRoster ? 'Committee Characters' : 'Committee Countries'}
            </p>
          </div>
          {/* Delegation size — chosen BEFORE picking the roster so the organiser
              knows whether each seat holds one or two delegates. Two person-glyph
              cards (single User vs paired Users) drive the same doubleDelegation
              boolean the save flow reads; turning it off when second seats are
              filled is still gated by the destructive confirm in doEdit. */}
          <div className="mb-4">
            <label style={labelStyle}>Delegation size</label>
            <div className="flex gap-2.5">
              {([
                { val: false, Icon: User, title: 'Single delegate', desc: `One delegate per ${isCharacterRoster ? 'character' : 'country'}.` },
                { val: true, Icon: Users, title: 'Double delegation', desc: `Two delegates share each ${isCharacterRoster ? 'character' : 'country'}.` },
              ] as const).map(({ val, Icon, title, desc }) => {
                const active = doubleDelegation === val;
                const accent = '#1B3828';
                return (
                  <button
                    key={title}
                    type="button"
                    onClick={() => setDoubleDelegation(val)}
                    aria-pressed={active}
                    className="flex-1 flex items-center gap-3 rounded-xl px-3.5 py-3 text-left focus:outline-none"
                    style={{
                      border: active ? `1.5px solid ${accent}` : '1px solid #DDD4C0',
                      backgroundColor: active ? 'rgba(27,56,40,0.06)' : '#FAF8F3',
                      cursor: 'pointer', transition: `all 180ms ${EASE}`,
                    }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 42, height: 42, borderRadius: 13,
                        background: active ? 'linear-gradient(135deg, #16301F, #2A5A3C)' : '#EFE9DB',
                        border: active ? '1px solid rgba(27,56,40,0.3)' : '1px solid #E1D9C6',
                        boxShadow: active ? '0 4px 10px rgba(27,56,40,0.22)' : undefined,
                      }}
                    >
                      <Icon size={20} strokeWidth={2} style={{ color: active ? '#EED98A' : '#9A8A78' }} />
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: active ? accent : '#1C1410', letterSpacing: '0.01em' }}>{title}</span>
                      <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 500, color: '#9A8A78', lineHeight: 1.35, marginTop: 2 }}>{desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <ConferenceRosterPicker mode={isCharacterRoster ? 'character' : 'country'} value={roster} onChange={setRoster} />
        </div>
        {error && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
          <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: saving ? '#DDD4C0' : '#1B3828', color: saving ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif" }}>{saving ? 'SAVING...' : (isEdit ? 'SAVE CHANGES' : 'ADD COMMITTEE')}</button>
        </div>
      </div>
      {/* Chairs — a distinct side element docked outside the main modal. Only in
          edit mode (a real committee id is needed to seat/invite chairs). */}
      {isEdit && existing && (
        <ChairsDock conferenceId={conferenceId} committeeId={existing.id} committeeName={name.trim() || existing.name} />
      )}
      </div>
    </ModalOverlay>
    {pendingRemovalCount !== null && (
      <ModalOverlay onClose={() => setPendingRemovalCount(null)}>
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380 }}>
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
            {pendingRemovalCount} of the {isCharacterRoster ? 'characters' : 'countries'} you removed {pendingRemovalCount === 1 ? 'has' : 'have'} an allocated delegate. Removing {pendingRemovalCount === 1 ? 'it' : 'them'} will return {pendingRemovalCount === 1 ? 'that delegate' : 'those delegates'} to the allocation pool. Proceed?
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPendingRemovalCount(null)} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
            <button onClick={() => { setPendingRemovalCount(null); handleSave(true); }} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>PROCEED</button>
          </div>
        </div>
      </ModalOverlay>
    )}
    {pendingDoubleOffCount !== null && (
      <ModalOverlay onClose={() => { setPendingDoubleOffCount(null); setDoubleDelegation(true); }}>
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380 }}>
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
            This action will affect the allocations of {pendingDoubleOffCount} delegates. It is irreversible. Are you sure you wish to continue?
          </p>
          <div className="flex gap-3">
            <button onClick={() => { setPendingDoubleOffCount(null); setDoubleDelegation(true); }} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
            <button onClick={() => { setPendingDoubleOffCount(null); handleSave(true, true); }} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>PROCEED</button>
          </div>
        </div>
      </ModalOverlay>
    )}
    {/* Drag-to-fit crop step, flattens the chosen framing into a square
        transparent PNG, then hands off to the existing upload path — the same
        two-step the conference logo uses. Portal'd for the same reason
        ModalOverlay is: the crop tool is `position: fixed`, and the manage
        layout's content wrapper is a stacking context that would trap it under
        the header. It mounts after the editor's own portal, so at equal z-index
        it paints above the editor rather than behind it. */}
    {emblemCropFile && (
      <Portal>
        <LogoCropModal
          file={emblemCropFile}
          onCancel={() => setEmblemCropFile(null)}
          onSave={(blob) => {
            setEmblemCropFile(null);
            handleEmblemUpload(new File([blob], 'emblem.png', { type: 'image/png' }));
          }}
        />
      </Portal>
    )}
    </>
  );
}

// ── Committee-type picker card (neumorphic) ───────────────────────────────────
// One extruded ivory card per type. Selected = forest ring + gold-tinted seat +
// gradient icon disc lit; unselected = calm surface + soft-tinted icon seat.
// Hover lifts the card. Used only in the create flow's three-up type chooser.

const TYPE_OPTIONS: {
  type: CommitteeType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  gradient: NeuGradient;
}[] = [
  { type: 'general-assembly', label: 'General Assembly', desc: 'Large committees, country delegates, formal debate.', icon: Landmark, gradient: NEU_GRADIENTS.forest },
  { type: 'specialised', label: 'Specialised', desc: 'Mid-size expert bodies (ECOSOC, HRC, legal).', icon: Scale, gradient: NEU_GRADIENTS.sage },
  { type: 'crisis', label: 'Crisis', desc: 'Fast-paced, character roles, live crises.', icon: Zap, gradient: NEU_GRADIENTS.amber },
];

function TypeCard({ opt, onSelect }: { opt: (typeof TYPE_OPTIONS)[number]; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  const { label, desc, icon: Icon, gradient } = opt;
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3.5 text-left focus:outline-none w-full"
      style={{
        padding: '14px 16px',
        borderRadius: 18,
        border: `1.5px solid ${hovered ? NEU.forest : 'transparent'}`,
        backgroundColor: NEU.surface,
        boxShadow: hovered ? NEU.outHover : NEU.out,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}, border-color 200ms ${EASE}`,
        cursor: 'pointer',
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 44, height: 44, borderRadius: 14,
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          boxShadow: `0 4px 10px ${gradient[0]}44, ${NEU.outSm}`,
        }}
      >
        <Icon size={21} strokeWidth={2.2} style={{ color: '#FFFFFF' }} />
      </span>
      <span className="flex flex-col min-w-0">
        <span style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: NEU.ink, letterSpacing: '0.01em' }}>{label}</span>
        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 500, color: NEU.muted, lineHeight: 1.35, marginTop: 2 }}>{desc}</span>
      </span>
    </button>
  );
}

// ── CommitteeEditorModal, public API ─────────────────────────────────────────
// committee = null → create flow (opens with the GA / Specialised / Crisis
// type picker); committee set → edit flow (self-loads the committee's slots).

export function CommitteeEditorModal({ conference, committee, onSaved, onClose }: {
  conference: { id: string };
  committee: EditableCommittee | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!committee;
  const [pendingType, setPendingType] = useState<CommitteeType | null>(
    committee ? (committee.committee_type as CommitteeType) : null
  );
  // Edit flow: null until the committee's current slots are fetched.
  const [initialRoster, setInitialRoster] = useState<RosterEntry[] | null>(committee ? null : []);
  // Edit flow: null until the committee's current delegation_size is fetched.
  const [initialDelegationSize, setInitialDelegationSize] = useState<number | null>(committee ? null : 1);

  useEffect(() => {
    if (!committee || !session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const [{ data: slots }, { data: committeeRow }] = await Promise.all([
        supabase
          .from('committee_country_slots')
          .select('country_name, importance, is_observer')
          .eq('conference_committee_id', committee.id),
        supabase
          .from('conference_committees')
          .select('delegation_size')
          .eq('id', committee.id)
          .single(),
      ]);
      if (!cancelled) {
        setInitialRoster(
          (slots ?? []).map((r: { country_name: string; importance: string | null; is_observer: boolean | null }) => ({
            name: r.country_name,
            importance: (r.importance as RosterEntry['importance']) ?? 'standard',
            isObserver: r.is_observer ?? false,
          }))
        );
        setInitialDelegationSize((committeeRow?.delegation_size as number | null) ?? 1);
      }
    })();
    return () => { cancelled = true; };
  }, [committee, session]);

  // Create flow, choose committee type first (GA / Specialised / Crisis).
  if (!isEdit && !pendingType) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-7 flex flex-col gap-5" style={{ backgroundColor: NEU.base, border: '1px solid #DDD4C0', width: 400 }}>
          <div className="flex items-center justify-between">
            <p className="text-base font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>Choose committee type</p>
            <button onClick={onClose} className="focus:outline-none" style={{ color: NEU.muted }}><X size={18} /></button>
          </div>
          <div className="flex flex-col gap-3.5 w-full">
            {TYPE_OPTIONS.map((opt) => (
              <TypeCard key={opt.type} opt={opt} onSelect={() => setPendingType(opt.type)} />
            ))}
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // Edit flow, brief spinner while the current slots load.
  if (isEdit && (initialRoster === null || initialDelegationSize === null)) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-10 flex items-center justify-center" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 200 }}>
          <Loader size={48} />
        </div>
      </ModalOverlay>
    );
  }

  return (
    <CommitteeEditor
      conferenceId={conference.id}
      committeeType={pendingType ?? 'general-assembly'}
      existing={committee}
      initialRoster={initialRoster ?? []}
      initialDelegationSize={initialDelegationSize ?? 1}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
