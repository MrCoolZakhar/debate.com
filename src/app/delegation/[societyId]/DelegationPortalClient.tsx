'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DELEGATION PORTAL — /delegation/[societyId]
//
// A dedicated surface for a delegation's leader (head delegate OR faculty
// advisor) to distribute the block seats the organiser allocated to their
// delegation among their own delegates. It mirrors the organiser-side
// neumorphism (see components/neu.tsx + the applications / assignment pages)
// but is intentionally scoped: a leader can ONLY assign/unassign the seats
// their delegation already owns, never allocate new ones.
//
// Data contract (all reads gated by RLS to the leader's own society):
//  - societies                → the delegation (name, conference_id)
//  - conference_allocations   → the block seats (society_id = this society)
//  - applications             → the delegation's members (society_id + role)
//
// Seat writes go exclusively through the `delegation_assign_seat` RPC, which
// re-validates leadership server-side, sets the allocation's user_id +
// application_id, and mirrors the assignment onto the member's application.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Users, User, Check, ChevronDown, ChevronLeft, UserPlus, X, ArrowLeft, Layers, Flag, Link2,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { NEU, NEU_GRADIENTS, EASE, OUTFIT, NeuCard, NeuIconDisc } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import { MemberAvatar } from '@/app/manage/[slug]/assignment/delegationShared';
import Portal from '@/components/Portal';
import { getCountryByName, UN_COUNTRIES } from '@/lib/countries';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// ── Types ────────────────────────────────────────────────────────────────────

interface CommitteeLite {
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
}

interface Seat {
  id: string;
  conference_committee_id: string;
  country_code: string;
  country_name: string;
  user_id: string | null;
  application_id: string | null;
  conference_committees: CommitteeLite | null;
}

interface Member {
  id: string;            // application id
  user_id: string;
  role: string;
  is_head_delegate: boolean;
  profiles: { display_name: string; avatar_url: string | null } | null;
  invited_name: string | null;
}

interface SocietyInfo {
  id: string;
  name: string;
  conferenceId: string;
  conferenceName: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Real ISO 3166-1 alpha-2 codes, so a committee "country" that is actually a
// crisis/JCC character name never renders a broken flag image.
const REAL_COUNTRY_CODES = new Set(UN_COUNTRIES.map((c) => c.code));

function resolveRealCountryCode(name: string | null | undefined, code?: string | null): string | null {
  if (code && REAL_COUNTRY_CODES.has(code.toUpperCase())) return code.toUpperCase();
  if (name) {
    const c = getCountryByName(name);
    if (c) return c.code;
  }
  return null;
}

/** Country as a flag (real countries) or a user glyph on a soft disc (crisis /
 *  character committees whose country_code is a non-ISO character name). */
function CountryFlag({ name, code, size = 18 }: { name: string | null | undefined; code?: string | null; size?: number }) {
  const resolved = resolveRealCountryCode(name, code);
  if (resolved) {
    return (
      <span title={name ?? resolved} className="inline-flex items-center" style={{ lineHeight: 0 }}>
        <FlagImg code={resolved} size={size} />
      </span>
    );
  }
  return (
    <span
      title={name ?? undefined}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: 9999, background: 'linear-gradient(150deg, rgba(27,56,40,0.14), rgba(27,56,40,0.07))', border: '1px solid rgba(27,56,40,0.18)' }}
    >
      <User size={Math.round(size * 0.62)} strokeWidth={2.4} style={{ color: NEU.forest }} />
    </span>
  );
}

/** Long committee name → acronym primary + full name beneath; short names stay
 *  as-is (matches the applications page's committeeDisplay). */
function committeeDisplay(c: CommitteeLite | null): { primary: string; secondary: string | null } {
  if (!c) return { primary: 'Committee', secondary: null };
  const hasAbbr = !!c.abbreviation && c.abbreviation.toUpperCase() !== c.name.toUpperCase();
  const isLong = c.name.length > 16 || c.name.trim().split(/\s+/).length >= 3;
  if (hasAbbr && isLong) return { primary: c.abbreviation!, secondary: c.name };
  return { primary: c.name, secondary: null };
}

function committeeAbbr(c: CommitteeLite | null): string {
  if (!c) return '—';
  if (c.abbreviation) return c.abbreviation;
  const mono = c.name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  return mono || c.name.slice(0, 4).toUpperCase();
}

function memberName(m: Member): string {
  return m.profiles?.display_name ?? m.invited_name ?? 'Unknown';
}

// ── Seat assignment picker (portaled + edge-flipped, per project popover rule) ─
// Mirrors the applications PaymentMenu / QuickAllocate portal pattern: rendered
// through a Portal at fixed viewport coordinates computed from the trigger, so
// a clipping/scrolling ancestor can never cut it off; clamped horizontally and
// flipped upward when there isn't room below.

function AssignPicker({
  members, seatedByUserId, currentUserId, busy, onAssign,
}: {
  members: Member[];
  /** user_id → seat label for members already holding a seat (informational). */
  seatedByUserId: Map<string, string>;
  /** The member currently in this seat (highlighted / lets you keep them). */
  currentUserId: string | null;
  busy: boolean;
  onAssign: (member: Member) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const MENU_W = 288;
  const MENU_H = 360;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < MENU_H + 16 && r.top > spaceBelow;
    let left = r.right - MENU_W; // right-align to the trigger
    if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8;
    left = Math.max(8, left);
    const top = flip ? Math.max(8, r.top - MENU_H - 6) : r.bottom + 6;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    setQuery('');
    place();
    setOpen(true);
  };

  const q = query.trim().toLowerCase();
  const listed = members.filter((m) => !q || memberName(m).toLowerCase().includes(q));

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={busy}
        className="inline-flex items-center gap-1.5 focus:outline-none"
        style={{
          padding: '7px 13px', borderRadius: 999,
          fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em',
          color: currentUserId ? NEU.ink : '#FFFFFF',
          background: currentUserId ? NEU.surface : `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
          boxShadow: currentUserId ? NEU.outSm : `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}`,
          border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.55 : 1,
        }}
      >
        {currentUserId
          ? <ChevronDown size={13} strokeWidth={2.6} style={{ color: NEU.deepGold, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
          : <UserPlus size={13} strokeWidth={2.6} style={{ color: NEU.gold }} />}
        {currentUserId ? 'CHANGE' : 'ASSIGN'}
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: MENU_W, maxHeight: MENU_H, display: 'flex', flexDirection: 'column', backgroundColor: NEU.surface, borderRadius: 16, boxShadow: NEU.out, padding: 10, animation: `dpFadeIn 160ms ${EASE}` }}
          >
            <style>{`@keyframes dpFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div className="flex items-center gap-2 mb-2.5 px-0.5">
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Users} size={24} />
              <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.ink }}>
                Assign this seat
              </p>
            </div>

            {members.length > 6 && (
              <div className="flex items-center gap-2 mb-2" style={{ padding: '6px 10px', borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                <User size={13} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search delegates..."
                  className="flex-1 outline-none"
                  style={{ backgroundColor: 'transparent', color: NEU.ink, fontFamily: OUTFIT, fontSize: 12 }}
                />
              </div>
            )}

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {listed.length === 0 ? (
                <p className="text-center py-5" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted }}>
                  {members.length === 0 ? 'No delegates in your delegation yet.' : 'No delegates match.'}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {listed.map((m) => {
                    const isCurrent = m.user_id === currentUserId;
                    const seatedElsewhere = seatedByUserId.get(m.user_id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => { onAssign(m); setOpen(false); }}
                        className="inline-flex items-center gap-2.5 w-full focus:outline-none text-left"
                        style={{ padding: '7px 8px', borderRadius: 11, background: isCurrent ? 'rgba(27,56,40,0.06)' : 'transparent', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = isCurrent ? 'rgba(27,56,40,0.06)' : 'transparent'; }}
                      >
                        <MemberAvatar name={memberName(m)} url={m.profiles?.avatar_url ?? null} size={30} />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>{memberName(m)}</span>
                          <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: seatedElsewhere && !isCurrent ? NEU.amber : NEU.muted }}>
                            {m.is_head_delegate ? 'Head delegate' : 'Delegate'}
                            {seatedElsewhere && !isCurrent ? ` · seated in ${seatedElsewhere}` : ''}
                          </span>
                        </span>
                        {isCurrent && <Check size={14} strokeWidth={2.8} style={{ color: NEU.green, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

// ── Seat row ─────────────────────────────────────────────────────────────────

function SeatRow({
  seat, assigned, members, seatedByUserId, busy, onAssign, onUnassign,
}: {
  seat: Seat;
  assigned: Member | null;
  members: Member[];
  seatedByUserId: Map<string, string>;
  busy: boolean;
  onAssign: (member: Member) => void;
  onUnassign: () => void;
}) {
  const { primary, secondary } = committeeDisplay(seat.conference_committees);
  return (
    <NeuCard style={{ padding: '13px 15px' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Committee */}
        <div className="flex items-center gap-2.5 min-w-0" style={{ flex: '1 1 190px' }}>
          <LogoDisc src={seat.conference_committees?.logo_url} size={40} fallbackText={committeeAbbr(seat.conference_committees)} alt={primary} />
          <div className="min-w-0">
            <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: NEU.ink, letterSpacing: '-0.01em' }}>{primary}</p>
            {secondary && (
              <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, marginTop: 1 }}>{secondary}</p>
            )}
          </div>
        </div>

        {/* Country */}
        <div className="flex items-center gap-2 min-w-0" style={{ flex: '1 1 150px' }}>
          <CountryFlag name={seat.country_name} code={seat.country_code} size={20} />
          <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>{seat.country_name}</span>
        </div>

        {/* Assignment + control */}
        <div className="flex items-center gap-2.5 min-w-0 ml-auto">
          {assigned ? (
            <span
              className="inline-flex items-center gap-2 min-w-0"
              style={{ padding: '4px 12px 4px 5px', borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, maxWidth: 220 }}
            >
              <MemberAvatar name={memberName(assigned)} url={assigned.profiles?.avatar_url ?? null} size={24} />
              <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink }}>{memberName(assigned)}</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5"
              style={{ padding: '6px 12px', borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: NEU.muted }}
            >
              UNASSIGNED
            </span>
          )}

          <AssignPicker
            members={members}
            seatedByUserId={seatedByUserId}
            currentUserId={assigned?.user_id ?? null}
            busy={busy}
            onAssign={onAssign}
          />

          {assigned && (
            <button
              onClick={onUnassign}
              disabled={busy}
              title="Unassign this seat"
              aria-label="Unassign this seat"
              className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none"
              style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.55 : 1, color: '#8B2020' }}
            >
              <X size={15} strokeWidth={2.6} />
            </button>
          )}
        </div>
      </div>
    </NeuCard>
  );
}

// ── Small stat chip for the roster summary ───────────────────────────────────

function SummaryStat({ icon: Icon, value, label, gradient }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  value: number; label: string; gradient: readonly [string, string];
}) {
  return (
    <div className="flex items-center gap-2.5" style={{ padding: '10px 15px', borderRadius: 16, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}>
      <NeuIconDisc gradient={gradient as [string, string]} icon={Icon} size={32} />
      <div>
        <p style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, lineHeight: 1, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, marginTop: 2 }}>{label}</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DelegationPortalClient() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, loading: authLoading } = useAuth();

  const societyId = (Array.isArray(params.societyId) ? params.societyId[0] : params.societyId) ?? '';

  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [society, setSociety] = useState<SocietyInfo | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadSeq = useRef(0);

  // ── Delegation invite link ──────────────────────────────────────────────────
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  const inviteUrl = inviteToken
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://gavelling.com'}/invites/delegation/${inviteToken}`
    : '';

  // Idempotent server-side: returns a stable token per (society, conference),
  // so generating again always yields the same shareable link.
  const generateInvite = useCallback(async () => {
    if (!session || !society || inviteBusy) return;
    setInviteBusy(true);
    setInviteError('');
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('create_delegation_invite', {
      p_society_id: society.id,
      p_conference_id: society.conferenceId,
    });
    setInviteBusy(false);
    const result = data as { ok: boolean; error?: string; token?: string } | null;
    if (error || !result?.ok || !result.token) {
      setInviteError(result?.error ?? error?.message ?? 'Could not create an invite link.');
      return;
    }
    setInviteToken(result.token);
  }, [session, society, inviteBusy]);

  const copyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // Clipboard API unavailable (http / permissions) — fall back silently.
      const ta = document.createElement('textarea');
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteUrl]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  // ── Load (also used for the silent post-write refetch) ──────────────────────
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user || !session || !societyId) return;
    const seq = ++loadSeq.current;
    if (!opts?.silent) setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const [leaderRes, socRes, allocRes, memberRes] = await Promise.all([
      // Leadership gate: an application in this society, this user, leader role.
      supabase
        .from('applications')
        .select('id')
        .eq('society_id', societyId)
        .eq('user_id', user.id)
        .in('role', ['head-delegate', 'faculty-advisor'])
        .limit(1),
      supabase
        .from('societies')
        .select('id, name, conference_id, conferences (full_name, acronym)')
        .eq('id', societyId)
        .maybeSingle(),
      supabase
        .from('conference_allocations')
        .select('id, conference_committee_id, country_code, country_name, user_id, application_id, conference_committees (name, abbreviation, logo_url)')
        .eq('society_id', societyId),
      supabase
        .from('applications')
        .select('id, user_id, role, is_head_delegate, invited_name, profiles (display_name, avatar_url)')
        .eq('society_id', societyId)
        .in('role', ['delegate', 'head-delegate']),
    ]);

    if (seq !== loadSeq.current) return; // a newer load superseded this one

    const leader = ((leaderRes.data as { id: string }[] | null) ?? []).length > 0;
    setIsLeader(leader);

    const socRow = socRes.data as { id: string; name: string; conference_id: string; conferences: { full_name: string; acronym: string } | { full_name: string; acronym: string }[] | null } | null;
    if (socRow) {
      const conf = Array.isArray(socRow.conferences) ? socRow.conferences[0] : socRow.conferences;
      setSociety({ id: socRow.id, name: socRow.name, conferenceId: socRow.conference_id, conferenceName: conf?.full_name ?? conf?.acronym ?? '' });
    }

    const rawSeats = ((allocRes.data as unknown as (Omit<Seat, 'conference_committees'> & { conference_committees: CommitteeLite | CommitteeLite[] | null })[] | null) ?? []).map((s) => ({
      ...s,
      conference_committees: Array.isArray(s.conference_committees) ? s.conference_committees[0] ?? null : s.conference_committees,
    })) as Seat[];
    // Stable sort: committee name, then country.
    rawSeats.sort((a, b) => {
      const ca = a.conference_committees?.name ?? '';
      const cb = b.conference_committees?.name ?? '';
      return ca.localeCompare(cb) || a.country_name.localeCompare(b.country_name);
    });
    setSeats(rawSeats);

    const rawMembers = ((memberRes.data as unknown as (Omit<Member, 'profiles'> & { profiles: Member['profiles'] | Member['profiles'][] })[] | null) ?? []).map((m) => ({
      ...m,
      profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
    })) as Member[];
    rawMembers.sort((a, b) => Number(b.is_head_delegate) - Number(a.is_head_delegate) || memberName(a).localeCompare(memberName(b)));
    setMembers(rawMembers);

    if (!opts?.silent) setLoading(false);
  }, [user, session, societyId]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, load]);

  // ── Seat assignment (optimistic + rollback + silent refetch) ────────────────
  const assignSeat = useCallback(async (seat: Seat, member: Member | null) => {
    if (!session || busyId) return;
    const supabase = getAuthedClient(session.access_token);
    const prev = seats;
    setBusyId(seat.id);
    // Optimistic: reflect the new occupant immediately.
    setSeats((cur) => cur.map((s) => (s.id === seat.id ? { ...s, user_id: member?.user_id ?? null, application_id: member?.id ?? null } : s)));

    const { data, error } = await supabase.rpc('delegation_assign_seat', {
      p_allocation_id: seat.id,
      p_user_id: member?.user_id ?? null,
    });
    const result = data as { ok: boolean; error?: string } | null;

    if (error || !result?.ok) {
      setSeats(prev); // rollback
      setBusyId(null);
      return;
    }
    // Reconcile with server truth (the RPC also mirrors onto applications).
    await load({ silent: true });
    setBusyId(null);
  }, [session, busyId, seats, load]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const memberByUserId = new Map(members.map((m) => [m.user_id, m]));
  const memberByAppId = new Map(members.map((m) => [m.id, m]));

  const assignedFor = (seat: Seat): Member | null => {
    if (seat.application_id && memberByAppId.has(seat.application_id)) return memberByAppId.get(seat.application_id)!;
    if (seat.user_id && memberByUserId.has(seat.user_id)) return memberByUserId.get(seat.user_id)!;
    return null;
  };

  // user_id → the seat label a member already holds (informational in the picker).
  const seatedByUserId = new Map<string, string>();
  for (const s of seats) {
    const m = assignedFor(s);
    if (m) {
      const { primary } = committeeDisplay(s.conference_committees);
      seatedByUserId.set(m.user_id, `${primary} · ${s.country_name}`);
    }
  }

  const assignedCount = seats.filter((s) => assignedFor(s) !== null).length;

  // ── Shell ────────────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />
      <SiteNav hideLanguage />
      <div className="relative z-10 flex-1 px-6 py-10" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {children}
      </div>
    </div>
  );

  if (authLoading || !user || loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24">
          <Loader size={72} label="Loading delegation portal" />
        </div>
      </Shell>
    );
  }

  // ── Not a leader (or society not readable) ──────────────────────────────────
  if (!isLeader) {
    return (
      <Shell>
        <div className="text-center px-6 py-16" style={{ borderRadius: 24, backgroundColor: NEU.base, boxShadow: NEU.in }}>
          <div className="flex justify-center mb-5">
            <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={Users} size={56} />
          </div>
          <p className="text-lg font-bold mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>You do not manage this delegation</p>
          <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            Only a delegation&apos;s head delegate or faculty advisor can distribute its seats.
          </p>
          <Link
            href="/my-conferences"
            className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{ padding: '10px 18px', borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em', textDecoration: 'none' }}
          >
            <ArrowLeft size={14} strokeWidth={2.6} /> Back to My Conferences
          </Link>
        </div>
      </Shell>
    );
  }

  // ── Portal ──────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Back link */}
      <Link
        href="/my-conferences"
        className="inline-flex items-center gap-1.5 mb-5 focus:outline-none"
        style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', textDecoration: 'none' }}
      >
        <ArrowLeft size={14} strokeWidth={2.5} /> My Conferences
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3.5 mb-6">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Users} size={52} />
        <div className="min-w-0">
          {society?.conferenceName && (
            <p className="truncate" style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, letterSpacing: '0.01em' }}>
              {society.conferenceName}
            </p>
          )}
          <h1 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 26, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
            {society?.name ?? 'Delegation'}
          </h1>
          <p className="text-sm mt-1" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            Distribute your delegation&apos;s block seats among your delegates.
          </p>
        </div>
      </div>

      {/* Roster summary */}
      <div className="flex flex-wrap gap-2.5 mb-7">
        <SummaryStat icon={Users} value={members.length} label={members.length === 1 ? 'Delegate' : 'Delegates'} gradient={NEU_GRADIENTS.forest} />
        <SummaryStat icon={Flag} value={seats.length} label={seats.length === 1 ? 'Seat' : 'Seats'} gradient={NEU_GRADIENTS.gold} />
        <SummaryStat icon={Layers} value={assignedCount} label="Assigned" gradient={NEU_GRADIENTS.green} />
      </div>

      {/* Invite delegates */}
      <NeuCard style={{ padding: '18px 20px', marginBottom: 28 }}>
        <div className="flex items-start gap-3">
          <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={UserPlus} size={40} />
          <div className="min-w-0 flex-1">
            <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.01em' }}>
              Invite your delegates
            </p>
            <p className="text-sm mt-0.5 mb-3.5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.5 }}>
              Share one link. Anyone who opens it applies to
              {society?.conferenceName ? <> <strong style={{ color: NEU.ink }}>{society.conferenceName}</strong></> : ' this conference'}
              {' '}and joins <strong style={{ color: NEU.ink }}>{society?.name ?? 'your delegation'}</strong> automatically.
            </p>

            {inviteToken ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2" style={{ padding: '9px 13px', borderRadius: 12, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                  <Link2 size={14} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
                  <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: NEU.ink }}>
                    {inviteUrl}
                  </p>
                </div>
                <button
                  onClick={copyInvite}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 focus:outline-none"
                  style={{
                    padding: '9px 16px', borderRadius: 12,
                    fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em',
                    color: NEU.gold,
                    background: copied ? `linear-gradient(135deg, ${NEU_GRADIENTS.green[0]}, ${NEU_GRADIENTS.green[1]})` : `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
                    boxShadow: NEU.outSm, border: 'none', cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={13} strokeWidth={2.8} /> : <Link2 size={13} strokeWidth={2.6} />}
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
            ) : (
              <button
                onClick={generateInvite}
                disabled={inviteBusy || !society}
                className="inline-flex items-center gap-2 focus:outline-none"
                style={{
                  padding: '9px 18px', borderRadius: 999,
                  fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
                  color: NEU.gold,
                  background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
                  boxShadow: `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}`,
                  border: 'none', cursor: inviteBusy || !society ? 'default' : 'pointer', opacity: inviteBusy || !society ? 0.55 : 1,
                }}
              >
                <UserPlus size={14} strokeWidth={2.6} />
                {inviteBusy ? 'GENERATING…' : 'CREATE INVITE LINK'}
              </button>
            )}

            {inviteError && (
              <p className="text-xs mt-2.5" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                {inviteError}
              </p>
            )}
          </div>
        </div>
      </NeuCard>

      {/* Seats */}
      {seats.length === 0 ? (
        <div className="text-center px-6 py-16" style={{ borderRadius: 24, backgroundColor: NEU.base, boxShadow: NEU.in }}>
          <div className="flex justify-center mb-5">
            <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Flag} size={56} />
          </div>
          <p className="text-lg font-bold mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>No seats allocated yet</p>
          <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            Your organiser has not allocated seats to your delegation yet. They&apos;ll appear here once they do.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {seats.map((seat) => (
            <SeatRow
              key={seat.id}
              seat={seat}
              assigned={assignedFor(seat)}
              members={members}
              seatedByUserId={seatedByUserId}
              busy={busyId === seat.id}
              onAssign={(m) => assignSeat(seat, m)}
              onUnassign={() => assignSeat(seat, null)}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}
