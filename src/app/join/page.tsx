'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /join — enter a session code, pick a role, take a seat.
//
// Redesigned 16 Sep 2026. The LOGIC below is the page as it was (lookup and its
// retry, conference detection, per-seat gating, chair code, open dais, advisor,
// ended / suspended, the idle notice). What changed is the shell:
//   • no FitToScreen. It scaled the WHOLE page to the window height and re-scaled
//     whenever content appeared, which is the "it always changes sizes" the owner
//     reported. /join is now an ordinary scrolling page, phone layout first;
//   • one card with fixed slots (code, message rail, a reserved stage, the action),
//     so moving from the code step to the role step to the seat step never moves
//     the code field or the button;
//   • a flag-led seat list (JoinSeatPicker) instead of a native <select>;
//   • a visible Sign in, through the auth pop-up (openAuth), with the
//     code and the role carried back;
//   • a chair code typed or linked as CODE-1234 (the homepage routes those here
//     with &mode=chair) looks up CODE and fills the chair code in. It used to look
//     up "CODE-1234" and find nothing.
// Visual kit: ./joinUi.tsx. Seat list: ./JoinSeatPicker.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { openAuth } from '@/lib/authModal';
import { useState, useEffect, useRef, Suspense, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle, ArrowRight, BadgeCheck, CheckCircle2, Eye, Gavel, Globe2, KeyRound,
  Loader2, Lock, LogIn, Mail, MessageSquareText, Plus, RotateCw, UserRound, Users,
} from 'lucide-react';
import { getCommitteeRosterByCode, addChairName, updateCommitteeHeadChairInDB } from '@/lib/committeeService';
import { getGavelDeviceId } from '@/lib/gavelDevice';
import { chairActiveElsewhere } from '@/lib/chairDeviceClaims';
import { Committee } from '@/lib/types';
import { useSettingsStore } from '@/lib/settingsStore';
import { useAuth } from '@/components/AuthProvider';
import ProfileAvatarMenu from '@/components/ProfileAvatar';
import { verifyConferenceAccess, type ConferenceAccess } from '@/lib/conferenceAccess';
import { getSessionJoinRules, getSeatAvailability, peekSeatToken, seatKey, type SeatAvailability } from '@/lib/seatClaims';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import SessionLanguageMenu from '@/components/SessionLanguageMenu';
import { getCountryDisplayName } from '@/lib/countries';
import { supabase, supabase as anonSupabase } from '@/lib/supabase';
import { PRESET_LOGOS, deriveCommitteeAcronym, committeeDisplayName, matchPresetEmblem } from '@/lib/presetNames';
import { CircleFlag } from '@/components/CircleFlag';
import { DEFAULT_EMBLEM } from '@/components/CommitteeIdentityBadge';
import {
  BrandPanel, type BrandRoom, C, Chip, Eyebrow, FieldLabel, GhostAction, JoinCard, MessageRail, OUTFIT,
  PageBackdrop, PrimaryAction, RoleTile,
} from './joinUi';
import JoinSeatPicker, { type JoinSeatRow } from './JoinSeatPicker';
import { getReservedSeatHint, setClaimMarker, takeClaimMarker, type ReservedSeatHint } from './reservedSeatHint';
import { getAuthedClient } from '@/lib/supabase-auth';

type JoinMode = 'delegate' | 'chair' | 'advisor';

interface ConferenceCommittee {
  id: string;
  name: string;
  session_code: string;
  conference_id: string;
  logo_url: string | null;
  abbreviation: string | null;
  conferences: {
    full_name: string;
    acronym: string;
    slug: string;
    start_date: string;
    end_date: string;
    logo_url: string | null;
  } | null;
}

/**
 * "ABC123-4821" is the full chair code (session code + 4-digit suffix). The session
 * lookup needs the part before the dash; the digits are the chair code. Only a dash
 * followed by digits (0 to 4, so it also works while typing) is split off.
 */
function splitChairCode(raw: string): { base: string; suffix: string | null } {
  const m = raw.match(/^(.+?)-(\d{0,4})$/);
  if (!m) return { base: raw, suffix: null };
  return { base: m[1], suffix: m[2].length === 4 ? m[2] : null };
}

/** The translated button labels still carry an arrow glyph; the button draws an icon. */
const noArrow = (s: string) => s.replace(/[→←]/g, '').trim();

function JoinPageInner() {
  const t = useT();
  const { language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getSettings } = useSettingsStore();
  const { user, session, profile, loading: authLoading } = useAuth();
  const initialMode = (searchParams.get('mode') as JoinMode) ?? 'delegate';
  const [mode, setMode] = useState<JoinMode>(initialMode);
  const [code, setCode] = useState((searchParams.get('code') ?? '').toUpperCase());
  const lookupCode = splitChairCode(code.trim()).base;
  // Set when the delegate page signed this device out after an hour idle.
  const idleCountry = (searchParams.get('idle') ?? '').trim().slice(0, 80);
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [lookupFailed, setLookupFailed] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [foundCommittee, setFoundCommittee] = useState<Committee | null>(null);
  // Chair name selection — after committee found in chair mode
  const [chairName, setChairName] = useState('');
  const [chairNameMode, setChairNameMode] = useState<'select' | 'new'>('select');
  // Moderator (holds the gavel) vs Commenter (view-only, writes feedback). Defaults to
  // Commenter so joining never steals the gavel by accident; unset head falls back to the
  // creator (chairNames[0]). The stored values stay 'head' | 'co' — settings.headChair is
  // a persisted key and must not be renamed.
  const [chairRole, setChairRole] = useState<'head' | 'co'>('co');
  const [newChairName, setNewChairName] = useState('');
  const [chairPassword, setChairPassword] = useState('');
  const [chairCodePrefilled, setChairCodePrefilled] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [activeChairNames, setActiveChairNames] = useState<Set<string>>(new Set());
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [isConferenceSession, setIsConferenceSession] = useState(false);
  const [conferenceCommittee, setConferenceCommittee] = useState<ConferenceCommittee | null>(null);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationError, setAllocationError] = useState('');
  const [allocatedCountry, setAllocatedCountry] = useState<{ code: string; name: string } | null>(null);
  // True while we determine whether a found committee is a conference-linked session.
  // Suppresses the standalone role cards so they don't flash before the conference check resolves.
  const [checkingConference, setCheckingConference] = useState(false);
  // Per-SEAT gating (src/lib/seatClaims.ts). `reservedCountries` are the seats this
  // conference allocated or invited someone to: those still need a signed-in, allocated
  // account. Every other seat is open to anyone holding the code, and `chairsOpen` says
  // the dais has no assigned or invited chair, so the chair code alone admits a chair.
  // A standalone session has nothing reserved and an open dais.
  const [chairsOpen, setChairsOpen] = useState(false);
  const [reservedCountries, setReservedCountries] = useState<string[]>([]);
  // Which seats are full, and which one this device or account already holds.
  const [seatAvail, setSeatAvail] = useState<SeatAvailability>({});
  // The role the conference records give this signed-in user here, if any.
  const [verifiedKind, setVerifiedKind] = useState<ConferenceAccess['kind'] | null>(null);
  // A signed-out visitor pointing at a RESERVED seat: who the seat is held for (masked),
  // so an invited delegate who never made an account can sign up right here.
  const [reservedPick, setReservedPick] = useState('');
  const [reservedHint, setReservedHint] = useState<{ country: string; hints: ReservedSeatHint[] | null } | null>(null);
  // The seat the visitor pointed at before signing in (?seat=), to recommend on return.
  const returnSeat = (searchParams.get('seat') ?? '').trim().slice(0, 120);
  // The phone's sticky Join bar sits above the on-screen keyboard (visual viewport).
  const joinBarRef = useRef<HTMLDivElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, if code was pre-filled from URL, trigger lookup immediately
  useEffect(() => {
    const initial = (searchParams.get('code') ?? '').toUpperCase();
    const { base, suffix } = splitChairCode(initial.trim());
    if (base.length >= 4) {
      doLookup(base, suffix ? 'chair' : initialMode, suffix);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConferenceSession) {
      setAllocatedCountry(null);
      setAllocationError('');
      setVerifiedKind(null);
      return;
    }

    // Not logged in — show sign-in prompt
    if (!user || !session) {
      setAllocatedCountry(null);
      setAllocationError('__signin__');
      setVerifiedKind(null);
      return;
    }

    async function checkAllocation() {
      setAllocationLoading(true);
      setAllocationError('');

      // Resolve access via the shared authed helper. It reads conference_committees and the
      // user's allocation on the authed client, so it works for PRIVATE conferences too (via the
      // "associated users read their committee" policy), not just public ones.
      let access = await verifyConferenceAccess(lookupCode.toUpperCase(), session!.access_token, user!.id);
      // Back from "This is me" on a reserved seat with an EXISTING account: link any
      // invitation addressed to this account's email (a new account was already linked
      // by the profiles trigger), then ask again. Once per press, never on a plain visit.
      if (access.kind !== 'delegate' && access.kind !== 'chair' && access.kind !== 'advisor' && access.kind !== 'organizer'
          && takeClaimMarker(lookupCode)) {
        try {
          const { data } = await getAuthedClient(session!.access_token).rpc('claim_my_imported_applications');
          if ((data as { claimed?: number } | null)?.claimed) {
            access = await verifyConferenceAccess(lookupCode.toUpperCase(), session!.access_token, user!.id);
          }
        } catch { /* the not-linked card below says what to do */ }
      }
      setVerifiedKind(access.kind === 'delegate' || access.kind === 'chair' || access.kind === 'advisor' || access.kind === 'organizer' ? access.kind : null);

      // Conference sessions: role is authoritative (allocation / chair record) and the
      // manual role selector is hidden, so derive mode from the verified access.
      if (access.kind === 'delegate') {
        if (mode !== 'delegate') setMode('delegate');
        setAllocatedCountry({ code: access.country.code, name: access.country.name });
        setAllocationError('');
      } else if (access.kind === 'chair') {
        if (mode !== 'chair') setMode('chair');
        setAllocatedCountry(null);
        setAllocationError('');
      } else if (access.kind === 'advisor' || access.kind === 'organizer') {
        if (mode !== 'advisor') setMode('advisor');
        setAllocatedCountry(null);
        setAllocationError('');
      } else {
        // denied / not associated (an unanswerable check reads as denied, as before)
        setAllocatedCountry(null);
        setAllocationError('__not_associated__');
      }
      setAllocationLoading(false);
    }

    checkAllocation();
    // Not keyed on `mode`: this effect only ever SETS the mode from the verified role, and
    // re-verifying on every role-card tap flickered the open-seat picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConferenceSession, lookupCode, user?.id]);

  // Seat availability: greys out seats someone already holds and recognises the one this
  // device or account holds. Re-read when the account changes, so "Your seat" follows a
  // sign-in. Advisory only: /delegate claims the seat and is the authority for races.
  useEffect(() => {
    const c = foundCommittee?.code;
    if (!c) { setSeatAvail({}); return; }
    let cancelled = false;
    getSeatAvailability(c, { token: peekSeatToken(c), accessToken: session?.access_token ?? null })
      .then((a) => { if (!cancelled && a) setSeatAvail(a); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundCommittee?.code, user?.id]);

  // Subscribe to chair presence channel to detect if a chair is already active
  useEffect(() => {
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
      setActiveChairNames(new Set());
    }
    if (!foundCommittee || mode !== 'chair') return;

    const channel = supabase.channel(`chair-presence-${foundCommittee.id}`);
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ joinedAt: number }>();
        setActiveChairNames(new Set(Object.keys(state)));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundCommittee?.id, mode]);

  // One device per signed-in account on the chair page (src/lib/chairDeviceClaims.ts). Not a
  // block, newest wins; this only warns that joining here moves the account off the device
  // it is chairing from. Read-only RPC, answers for the caller only.
  const [chairElsewhere, setChairElsewhere] = useState(false);
  useEffect(() => {
    const token = session?.access_token;
    if (!foundCommittee || mode !== 'chair' || !token || foundCommittee.endedAt) { setChairElsewhere(false); return; }
    let cancelled = false;
    chairActiveElsewhere(foundCommittee.code, token).then((v) => { if (!cancelled) setChairElsewhere(v); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundCommittee?.code, foundCommittee?.endedAt, mode, user?.id]);

  function doLookup(upper: string, currentMode: JoinMode = mode, suffix: string | null = null) {
    setLookingUp(true);
    setError('');
    setLookupFailed(false);
    setFoundCommittee(null);
    setChairName('');
    setChairNameMode('select');
    setNewChairName('');
    setChairPassword(suffix ?? '');
    setChairCodePrefilled(!!suffix);
    setPasswordError('');
    setActiveChairNames(new Set());
    if (suffix && currentMode !== 'chair') setMode('chair');

    async function checkConferenceSession(found: Committee) {
      setCheckingConference(true);
      // session_join_rules is anon-callable and privacy-agnostic, so PRIVATE conferences are
      // handled too. If it cannot be read, fail CLOSED: treat a conference session as every
      // seat reserved and the dais gated, which is exactly the old behaviour.
      const rules = await getSessionJoinRules(upper);
      const isConf = rules ? rules.isConference : found.sessionOrigin === 'conference';
      setChairsOpen(rules ? rules.chairsOpen : !isConf);
      setReservedCountries(rules ? rules.reservedCountries : (isConf ? found.delegates.map((d) => d.country) : []));
      if (isConf) {
        setIsConferenceSession(true);
        // Best-effort display info: resolves for public conferences; null for private (the gate
        // shows generic copy, and verification still runs via the authed helper below).
        const { data: confCommittee } = await anonSupabase
          .from('conference_committees')
          .select(`
            id, name, session_code, conference_id, logo_url, abbreviation,
            conferences (full_name, acronym, slug, start_date, end_date, logo_url)
          `)
          .eq('session_code', upper)
          .maybeSingle();
        setConferenceCommittee(confCommittee ? (confCommittee as unknown as ConferenceCommittee) : null);
      } else {
        setConferenceCommittee(null);
        setIsConferenceSession(false);
      }
      setCheckingConference(false);
    }

    // J-1: a light lookup (the committee row plus the roster, one round trip), not the full
    // committee with every list, document and message. The legacy `mun-committees`
    // localStorage store is no longer consulted: nothing live writes it any more, so a hit
    // there could only ever be an old roster or an old chair code.
    getCommitteeRosterByCode(upper).then(async (remote) => {
      if (remote) {
        setFoundCommittee(remote);
        await checkConferenceSession(remote);
      } else {
        setFoundCommittee(null);
        setConferenceCommittee(null);
        setIsConferenceSession(false);
        // undefined = the read failed (network), null = no such committee.
        setLookupFailed(remote === undefined);
        setError(remote === undefined ? t('join_lookup_failed') : t('join_not_found'));
      }
      setLookingUp(false);
    });
  }

  const handleCodeChange = (val: string) => {
    // Allow up to 20 chars for custom codes
    const upper = val.toUpperCase().slice(0, 20);
    const prevBase = splitChairCode(code.trim()).base;
    const { base, suffix } = splitChairCode(upper.trim());
    setCode(upper);

    // Typing the chair-code digits after the dash only fills the chair code in: the
    // committee is the same one, so nothing is looked up again or cleared.
    if (base === prevBase && foundCommittee && base.length >= 4) {
      if (suffix) {
        if (mode !== 'chair') resetMode('chair');
        setChairPassword(suffix);
        setChairCodePrefilled(true);
        setPasswordError('');
      }
      return;
    }

    setError('');
    setLookupFailed(false);
    setFoundCommittee(null);
    setLookingUp(false);
    setIsConferenceSession(false);
    setConferenceCommittee(null);
    setAllocatedCountry(null);
    setAllocationError('');
    setCheckingConference(false);
    setChairsOpen(false);
    setReservedCountries([]);
    setSeatAvail({});
    setVerifiedKind(null);
    setReservedPick('');
    setReservedHint(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (base.length >= 4) {
      setLookingUp(true);
      debounceRef.current = setTimeout(() => doLookup(base, mode, suffix), 350);
    }
  };

  // ── Per-seat gating ─────────────────────────────────────────────────────────
  const reservedSet = new Set(reservedCountries.map(seatKey));
  const isReservedSeat = (c: string) => isConferenceSession && reservedSet.has(seatKey(c));
  // An ended session is read-only, so a full seat never stops anyone looking at it.
  const seatsEnforced = !foundCommittee?.endedAt;
  const seatState = (c: string) => seatAvail[seatKey(c)];
  // A chair removed THIS device from the seat less than 10 minutes ago, so
  // claim_delegate_seat will answer `kicked`. Offering the seat here only sent them to the
  // stop screen on /delegate, so the picker says so instead (migration
  // `seat_availability_reports_chair_removal`).
  const seatRemoved = (c: string) => seatsEnforced && seatState(c)?.removed === true;
  const seatBlocked = (c: string) => {
    if (isReservedSeat(c)) return true;
    if (seatRemoved(c)) return true;
    const st = seatState(c);
    return seatsEnforced && !!st && st.full && !st.mine;
  };
  const openSeatCount = foundCommittee ? foundCommittee.delegates.filter((d) => !isReservedSeat(d.country)).length : 0;
  const hasVerifiedRole = verifiedKind === 'delegate' || verifiedKind === 'chair' || verifiedKind === 'advisor' || verifiedKind === 'organizer';
  // The OPEN PATH: a conference code, no role for this person in the conference records
  // (or nobody signed in), and something here that needs no role. It is the standalone
  // flow limited to open seats, plus the chair code when the dais is open. A signed-in
  // user with no allocation gets this instead of the "not linked to your account" dead
  // end; an allocated user never takes it and still goes straight to their locked seat.
  const openPath = isConferenceSession && !checkingConference && !authLoading && !allocationLoading
    && !hasVerifiedRole && (openSeatCount > 0 || chairsOpen);
  // Signed out on a conference code with reserved seats: the visitor may point at a
  // reserved seat to see who it is held for (masked) and sign up / sign in as them.
  const canPointReserved = isConferenceSession && !checkingConference && !authLoading && !user && reservedCountries.length > 0;

  // The open path offers only the roles that are actually open, so snap the mode onto one
  // of them. The advisor view stays with the conference's own advisors and organisers.
  useEffect(() => {
    if (!openPath) return;
    if (mode === 'advisor' || (mode === 'delegate' && openSeatCount === 0 && !canPointReserved) || (mode === 'chair' && !chairsOpen)) {
      setMode(openSeatCount > 0 || canPointReserved ? 'delegate' : 'chair');
      setCountry('');
    }
  }, [openPath, mode, openSeatCount, chairsOpen, canPointReserved]);

  // Sign in is a pop-up (src/lib/authModal.ts): the join page stays put, and
  // the signed-in session lands here through AuthProvider.
  const goSignIn = () => openAuth({ next: lookupCode ? '/join?code=' + lookupCode + '&mode=' + mode : '/join' });

  // ── Reserved seats, signed out: who the seat is held for ────────────────────
  useEffect(() => {
    if (!reservedPick || !foundCommittee) return;
    let cancelled = false;
    setReservedHint(null);
    getReservedSeatHint(foundCommittee.code, reservedPick).then((hints) => {
      if (!cancelled) setReservedHint({ country: reservedPick, hints });
    });
    return () => { cancelled = true; };
  }, [reservedPick, foundCommittee]);
  useEffect(() => { if (user) { setReservedPick(''); setReservedHint(null); } }, [user]);
  const claimReservedSeat = (hasAccount: boolean) => {
    if (!lookupCode) return;
    setClaimMarker(lookupCode);
    openAuth({
      step: hasAccount ? 'signin' : 'signup',
      next: '/join?code=' + lookupCode + '&mode=delegate&seat=' + encodeURIComponent(reservedPick),
    });
  };

  // Phones: keep the sticky Join bar above the on-screen keyboard. Written to the
  // node (never state), only when the covered height changes.
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const node = joinBarRef.current;
    if (!vv || !node) return;
    let last = -1;
    let raf = 0;
    const place = () => {
      raf = 0;
      const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      if (covered === last) return;
      last = covered;
      node.style.setProperty('--join-kb', covered + 'px');
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    return () => {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const handleJoin = async () => {
    // ── Conference-linked session fork ──
    // Only for people the conference records know, or when nothing here is open to them.
    // Everyone else on a conference code takes the open path: the anonymous flow below.
    if (isConferenceSession && !openPath) {
      if (!user) {
        goSignIn();
        return;
      }
      if (allocationLoading) return;
      // Conference chair: no country allocation — route to the chair view using their profile name.
      if (mode === 'chair') {
        const chairDisplayName = (profile?.display_name ?? user.email ?? 'Chair').trim();
        addChairName(foundCommittee!.id, chairDisplayName, foundCommittee!.code, foundCommittee!.dbChairJoinSuffix ?? undefined);
        const goChair = () => router.push(`/chair/${foundCommittee!.code}?chairName=${encodeURIComponent(chairDisplayName)}`);
        // Claim-at-will Moderator works for conference sessions too; no password required —
        // access was already verified against the conference chair/organizer records.
        if (chairRole === 'head') {
          updateCommitteeHeadChairInDB(foundCommittee!.id, chairDisplayName, foundCommittee!.code, foundCommittee!.dbChairJoinSuffix ?? undefined, getGavelDeviceId(foundCommittee!.code)).finally(goChair);
        } else {
          goChair();
        }
        return;
      }
      // Conference advisor / observer / organizer: conference-wide advisor view.
      if (mode === 'advisor') {
        router.push(`/advisor/${foundCommittee!.code}`);
        return;
      }
      if (!allocatedCountry) {
        setError(t('join_not_linked'));
        return;
      }
      const encoded = encodeURIComponent(allocatedCountry.name);
      router.push(`/delegate/${foundCommittee!.code}?country=${encoded}&locked=1`);
      return;
    }

    // ── Existing anonymous flow continues unchanged below ──
    if (!foundCommittee) { setError(t('join_not_found')); return; }
    if (mode === 'chair') {
      const name = chairNameMode === 'new' ? newChairName.trim() : chairName;
      if (!name) { setError(t('join_select_name')); return; }
      const expectedPassword = foundCommittee.dbChairJoinSuffix ?? getSettings(foundCommittee.code).chairJoinSuffix;
      if (expectedPassword && chairPassword !== expectedPassword) {
        setPasswordError(t('join_incorrect_code'));
        return;
      }
      addChairName(foundCommittee.id, name, foundCommittee.code, foundCommittee.dbChairJoinSuffix ?? undefined);
      const go = () => router.push(`/chair/${foundCommittee.code}?chairName=${encodeURIComponent(name)}`);
      // Claim-at-will: joining as Moderator takes the gavel; a Commenter joins view-only.
      if (chairRole === 'head') {
        updateCommitteeHeadChairInDB(foundCommittee.id, name, foundCommittee.code, foundCommittee.dbChairJoinSuffix ?? undefined, getGavelDeviceId(foundCommittee.code)).finally(go);
      } else {
        go();
      }
      return;
    }
    if (mode === 'advisor') {
      // A standalone room: the advisor follows it on their board, which can hold many
      // rooms (/advisor, add flow prefilled). The single-room view stays one tap away there.
      router.push(`/advisor?add=${encodeURIComponent(foundCommittee.code)}`);
      return;
    }
    // delegate
    if (!country) return;
    if (isReservedSeat(country)) { setError(t('join_seat_reserved_note')); return; }
    if (seatRemoved(country)) { setError(t('join_seat_removed_note', { n: seatState(country)?.removedMinutes ?? 10 })); return; }
    // Re-read just before routing, so a seat taken a moment ago is caught here rather than
    // on the delegate page (which still re-checks: its claim is the authority).
    if (seatsEnforced) {
      const fresh = await getSeatAvailability(foundCommittee.code, { token: peekSeatToken(foundCommittee.code), accessToken: session?.access_token ?? null });
      if (fresh) {
        setSeatAvail(fresh);
        const st = fresh[seatKey(country)];
        if (st?.removed) { setError(t('join_seat_removed_note', { n: st.removedMinutes || 10 })); return; }
        if (st && st.full && !st.mine) { setError(t('join_seat_now_taken')); return; }
      }
    }
    const encoded = encodeURIComponent(country);
    router.push(`/delegate/${foundCommittee.code}?country=${encoded}`);
  };

  function resetMode(m: JoinMode) {
    setMode(m);
    setError('');
    setCountry('');
    setChairName('');
    setChairNameMode('select');
    setNewChairName('');
    // A chair code that came in with the link survives a role switch and back.
    if (!chairCodePrefilled) setChairPassword('');
    setPasswordError('');
    setActiveChairNames(new Set());
  }

  const selectedChairName = chairNameMode === 'new' ? newChairName.trim() : chairName;
  const chairAlreadyActive = !!selectedChairName && activeChairNames.has(selectedChairName);
  const requiresChairCode = !!foundCommittee && !!(foundCommittee.dbChairJoinSuffix ?? getSettings(foundCommittee.code).chairJoinSuffix);

  const joinDisabled = isConferenceSession && !openPath
    ? (!foundCommittee || !user || allocationLoading || allocationError !== '' ||
       (mode === 'delegate' && !allocatedCountry))
    : (
      mode === 'delegate'
        ? (!foundCommittee || !country || seatBlocked(country))
        : mode === 'chair'
        ? (!foundCommittee ||
            (chairNameMode === 'select' ? !chairName : !newChairName.trim()) ||
            (requiresChairCode && !chairPassword) ||
            chairAlreadyActive)
        : !foundCommittee
    );

  const joinLabel = isConferenceSession && !openPath
    ? (allocatedCountry
        ? (returnSeat ? t('join_take_your_seat') : t('join_btn_as', { country: getCountryDisplayName(allocatedCountry.name, language) }))
        : noArrow(t('join_btn_delegate')))
    : mode === 'delegate'
    ? noArrow(foundCommittee?.endedAt ? t('join_btn_delegate_ended') : t('join_btn_delegate'))
    : mode === 'chair' ? noArrow(t('join_btn_chair')) : t('join_advisor_follow_btn');

  const showRoleFlow = !!foundCommittee && (!isConferenceSession || openPath) && !checkingConference;
  const signedInName = (profile?.display_name || user?.email || '').trim();

  // ── The room, for the brand panel ──────────────────────────────────────────
  // Everything here comes from the lookup that already ran (the roster read and the
  // conference_committees row); the panel costs no extra request. A snapshot, taken
  // when the code resolved.
  const conf = conferenceCommittee?.conferences ?? null;
  const brandRoom: BrandRoom | null = (() => {
    if (!foundCommittee || checkingConference) return null;
    const c = foundCommittee;
    const acronym = conferenceCommittee?.abbreviation || deriveCommitteeAcronym(c.name) || c.name;
    // committeeDisplayName would collapse a long name to the acronym; here the
    // acronym is already the headline, so the spelled line is the full name.
    const spelled = c.name.trim();
    const confAcr = conf ? conferenceAcronymLabel(conf) : '';
    // The acronym label already carries the edition year ("LIMUN 2027"), so a year the
    // organiser typed into the full name is not said twice.
    const confYear = confAcr.match(/\b(\d{4})\b/)?.[1];
    const confFull = (conf?.full_name ?? '').trim().replace(confYear ? new RegExp(`\\s*${confYear}\\s*$`) : /$^/, '');
    const here = c.delegates.filter((d) => d.status !== 'absent');
    const state: BrandRoom['state'] = c.endedAt
      ? { label: t('join_room_ended'), tone: 'ended' }
      : c.suspendedAt || c.phase === 'adjourned'
      ? { label: t('join_room_suspended'), tone: 'paused' }
      : c.phase === 'pre-session'
      ? (here.length > 0 ? { label: t('join_room_roll_call'), tone: 'waiting' } : { label: t('join_room_not_started'), tone: 'waiting' })
      : c.phase === 'voting'
      ? { label: t('join_room_voting'), tone: 'live' }
      : { label: t('join_room_in_session'), tone: 'live' };
    const chairs = (c.chairNames ?? []).map((n) => n.trim()).filter(Boolean);
    let chairList = chairs.join(', ');
    try { chairList = new Intl.ListFormat(language, { type: 'conjunction' }).format(chairs); } catch { /* keep the comma list */ }
    const topic = (c.topic ?? '').trim();
    return {
      acronym,
      spelled: spelled && spelled.toLowerCase() !== acronym.toLowerCase() ? spelled : null,
      topic: topic && topic.toUpperCase() !== 'TBD' ? topic : null,
      emblemUrl: conferenceCommittee?.logo_url
        || matchPresetEmblem(c.name, conferenceCommittee?.abbreviation)
        || PRESET_LOGOS[c.name]
        || conf?.logo_url
        || DEFAULT_EMBLEM,
      conference: isConferenceSession && conf
        ? { label: [confAcr, confFull].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · '), logoUrl: conf.logo_url ?? null }
        : null,
      state,
      present: {
        count: here.length,
        ofLabel: t('join_room_present', { total: c.delegates.length }),
        seats: here.map((d) => ({ country: d.country, logoUrl: d.logoUrl ?? null })),
      },
      dais: chairs.length > 0 ? { label: t('join_room_dais'), names: chairList } : null,
    };
  })();

  // ── Code field status ───────────────────────────────────────────────────────
  const codeStatus: 'idle' | 'busy' | 'found' | 'error' =
    lookingUp ? 'busy' : error && !foundCommittee ? 'error' : foundCommittee ? 'found' : 'idle';

  const signInFooter = user ? (
    <div className="flex items-center gap-2.5" style={{ opacity: 0.82 }}>
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" className="h-6 w-6 flex-shrink-0 rounded-full object-cover" />
      ) : (
        <span aria-hidden className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: C.forestLift, color: C.gold, fontFamily: OUTFIT, fontSize: 10, fontWeight: 800 }}>
          {(signedInName[0] ?? '?').toUpperCase()}
        </span>
      )}
      <span className="min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: 'rgba(237,231,216,0.86)' }}>
        {t('join_signed_in_as', { name: signedInName })}
      </span>
    </div>
  ) : (
    <div className="pt-5" style={{ borderTop: '1px solid rgba(238,217,138,0.16)' }}>
      <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: C.page }}>{t('join_signin_prompt')}</p>
      {/* Narrow on purpose: the phone mockup takes the panel's bottom inline-end corner. */}
      <p className="mt-1 max-w-[230px]" style={{ fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.5, color: 'rgba(237,231,216,0.74)', textWrap: 'pretty' }}>{t('join_signin_why')}</p>
      <div className="mt-3">
        <GhostAction tone="gold" onClick={goSignIn} icon={<LogIn size={15} strokeWidth={2.4} />}>{t('join_signin_cta')}</GhostAction>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen w-full" style={{ backgroundColor: C.page, WebkitFontSmoothing: 'antialiased' }}>
      <PageBackdrop />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="relative z-20 mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/sessions" className="flex flex-shrink-0 items-center focus:outline-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/GavellingLogo.png" alt="Gavelling" className="h-auto w-[118px] object-contain sm:w-[140px]" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <SessionLanguageMenu />
          <Link
            href="/create"
            aria-label={t('join_nav_create')}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 focus:outline-none active:scale-[0.96]"
            style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: C.forest, transitionProperty: 'transform, background-color', transitionDuration: '150ms' }}
          >
            <Plus size={16} strokeWidth={2.6} />
            <span className="hidden sm:inline">{t('join_nav_create')}</span>
          </Link>
          {user ? (
            <ProfileAvatarMenu size={52} />
          ) : (
            <button
              type="button"
              onClick={goSignIn}
              disabled={authLoading}
              className="gv-lift inline-flex h-10 items-center gap-2 rounded-xl px-3.5 focus:outline-none active:scale-[0.96]"
              style={{ backgroundColor: C.forest, color: C.gold, fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', opacity: authLoading ? 0 : 1, transitionProperty: 'opacity, transform, box-shadow' }}
            >
              <LogIn size={15} strokeWidth={2.6} />
              {t('join_signin_cta')}
            </button>
          )}
        </div>
      </nav>

      <main className="relative z-10 mx-auto w-full max-w-[1120px] px-4 pb-16 pt-1 sm:px-6 sm:pt-3">
        {/* Idle logout notice: /delegate/[code] sends a delegate here with ?idle=<country>
            after an hour without activity (src/lib/delegateIdle.ts). */}
        {idleCountry && (
          <div
            role="status"
            className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: 'rgba(238,217,138,0.50)', boxShadow: 'inset 0 0 0 1px rgba(182,135,31,0.32)' }}
          >
            <CircleFlag country={idleCountry} size={28} decorative />
            <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: C.forest, textWrap: 'pretty' }}>
              {t('join_idle_signed_out', { country: getCountryDisplayName(idleCountry, language) })}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-8">
          <div className="lg:sticky lg:top-6">
            <BrandPanel
              title={t('join_hero_title')}
              accent={t('join_hero_accent')}
              sub={t('join_hero_sub')}
              room={brandRoom}
              footer={signInFooter}
            />
          </div>

          <JoinCard>
            <style>{JOIN_BAR_CSS}</style>
            {/* ── 1. The code ─────────────────────────────────────────────── */}
            <FieldLabel htmlFor="join-code">{t('join_code_label')}</FieldLabel>
            <div className="relative">
              <input
                id="join-code"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && foundCommittee && !joinDisabled) handleJoin(); }}
                placeholder={t('join_code_placeholder')}
                maxLength={20}
                autoFocus={!searchParams.get('code')}
                className="w-full text-center uppercase focus:outline-none placeholder:text-[0.62em] placeholder:font-semibold placeholder:tracking-[0.08em] sm:placeholder:text-[0.74em] placeholder:text-[#B3A791]"
                style={{
                  height: 66, borderRadius: 20, paddingInline: 44,
                  backgroundColor: '#FFFDF8',
                  boxShadow: codeStatus === 'error'
                    ? `inset 0 0 0 2px rgba(139,32,32,0.55)`
                    : codeStatus === 'found' ? `inset 0 0 0 2px ${C.moss}` : 'inset 0 0 0 1.5px rgba(27,56,40,0.16), inset 0 2px 4px rgba(27,56,40,0.05)',
                  fontFamily: OUTFIT, fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 800,
                  letterSpacing: '0.2em', color: C.ink, fontVariantNumeric: 'tabular-nums',
                  transitionProperty: 'box-shadow', transitionDuration: '160ms',
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 flex items-center"
                style={{ insetInlineEnd: 18 }}
              >
                {codeStatus === 'busy' && <Loader2 size={22} className="animate-spin" color={C.forest} />}
                {codeStatus === 'found' && <CheckCircle2 size={22} strokeWidth={2.4} color={C.moss} />}
                {codeStatus === 'error' && <AlertCircle size={22} strokeWidth={2.4} color={C.danger} />}
              </span>
            </div>

            {/* ── 2. The message rail: always the same height ─────────────── */}
            <div className="mt-2">
              {error ? (
                <MessageRail
                  tone="error"
                  icon={<AlertCircle size={15} strokeWidth={2.4} />}
                  action={lookupFailed && lookupCode.length >= 4 ? (
                    <button
                      type="button"
                      onClick={() => doLookup(lookupCode.toUpperCase(), mode, splitChairCode(code.trim()).suffix)}
                      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 focus:outline-none active:scale-[0.96]"
                      style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: C.danger, backgroundColor: 'rgba(139,32,32,0.08)' }}
                    >
                      <RotateCw size={13} strokeWidth={2.6} />
                      {t('join_retry')}
                    </button>
                  ) : undefined}
                >
                  {error}
                </MessageRail>
              ) : lookingUp || checkingConference ? (
                <MessageRail tone="busy" icon={<Loader2 size={15} className="animate-spin" />}>{t('join_checking')}</MessageRail>
              ) : foundCommittee ? (
                <MessageRail tone="good" icon={<CheckCircle2 size={15} strokeWidth={2.4} />}>
                  {foundCommittee.endedAt ? t('join_session_ended') : foundCommittee.suspendedAt && mode === 'delegate' ? t('join_adjourned') : t('join_found')}
                </MessageRail>
              ) : (
                <MessageRail tone="hint" icon={<KeyRound size={15} strokeWidth={2.2} />}>{t('join_code_hint')}</MessageRail>
              )}
            </div>

            {/* ── 3. The stage: reserved height, so steps swap in place ──────── */}
            {/* Reserved from lg only: on a phone the stage grows with its step and the
                Join action is a sticky bar at the bottom of the screen instead (#36). */}
            <div className="mt-4 lg:min-h-[656px]">
              {!foundCommittee ? (
                <EmptyStage busy={lookingUp} title={t('join_stage_empty_title')} body={t('join_stage_empty_body')} />
              ) : (
                <div className="space-y-4">
                  <CommitteeCard
                    committee={foundCommittee}
                    conferenceCommittee={conferenceCommittee}
                    delegatesLabel={`${foundCommittee.delegates.length} ${t('join_delegates_registered')}`}
                    endedLabel={t('join_session_ended')}
                    adjournedLabel={mode === 'delegate' ? t('join_adjourned') : null}
                    conferenceLabel={isConferenceSession ? t('join_conf_eyebrow') : null}
                  />

                  {checkingConference && <BusyBlock />}

                  {/* Conference session, verified path: allocation and account states */}
                  {isConferenceSession && !checkingConference && (
                    <>
                      {authLoading ? (
                        <BusyBlock />
                      ) : allocationLoading ? (
                        <MessageRail tone="busy" icon={<Loader2 size={15} className="animate-spin" />}>{t('join_conf_verifying')}</MessageRail>
                      ) : allocatedCountry ? (
                        <div className="flex items-center gap-3.5 rounded-2xl p-4" style={{ backgroundColor: 'rgba(61,122,82,0.10)', boxShadow: 'inset 0 0 0 1px rgba(61,122,82,0.28)' }}>
                          <CircleFlag code={allocatedCountry.code} country={allocatedCountry.name} size={48} decorative />
                          <div className="min-w-0">
                            <Chip tone="green" icon={<BadgeCheck size={12} strokeWidth={2.6} />}>{returnSeat ? t('join_recommended') : t('join_conf_verified')}</Chip>
                            <p className="mt-1.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em' }}>
                              {getCountryDisplayName(allocatedCountry.name, language)}
                            </p>
                            {conferenceCommittee?.name && (
                              <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: C.forest }}>
                                {conferenceCommittee.name}
                              </p>
                            )}
                            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft }}>
                              {t('join_conf_locked', { country: getCountryDisplayName(allocatedCountry.name, language) })}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {/* Signed out on a committee with reserved seats: say so first, then let
                          the visitor point at their country to see who it is held for. Sign in stays
                          on it: invited chairs, advisors and organisers need it here too. */}
                      {canPointReserved && (
                        <NoticeCard
                          tone="forest"
                          icon={<Lock size={18} strokeWidth={2.4} />}
                          title={t('join_conf_reserved_title')}
                          body={t('join_conf_reserved_body')}
                          action={<GhostAction onClick={goSignIn} icon={<LogIn size={15} strokeWidth={2.4} />}>{t('join_signin_cta')}</GhostAction>}
                        />
                      )}

                      {allocationError === '__signin__' && (!openPath || openSeatCount === 0) && !canPointReserved && (
                        <NoticeCard
                          tone="forest"
                          icon={<LogIn size={18} strokeWidth={2.4} />}
                          title={t('join_conf_signin_title')}
                          body={t('join_conf_signin_body')}
                          action={<GhostAction onClick={goSignIn} icon={<LogIn size={15} strokeWidth={2.4} />}>{t('join_signin_cta')}</GhostAction>}
                        />
                      )}

                      {/* Not linked: the likeliest cause is the most fixable one, a different
                          account from the one the seat was given to, so name the account. */}
                      {!openPath && allocationError === '__not_associated__' && (
                        <NoticeCard
                          tone="danger"
                          icon={<AlertCircle size={18} strokeWidth={2.4} />}
                          title={t('join_conf_not_linked_title')}
                          body={t('join_conf_not_linked_body')}
                          meta={user?.email ? t('join_signed_in_as', { name: user.email }) : undefined}
                          action={<GhostAction onClick={goSignIn} icon={<LogIn size={15} strokeWidth={2.4} />}>{user ? t('join_conf_signin_other') : t('join_signin_cta')}</GhostAction>}
                          foot={t('join_conf_stuck')}
                        />
                      )}

                      {mode === 'chair' && !openPath && hasVerifiedRole && (
                        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(27,56,40,0.06)', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.12)' }}>
                          <Gavel size={18} strokeWidth={2.2} color={C.forest} />
                          <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: C.forest }}>
                            {t('join_chair_joining_as', { name: profile?.display_name ?? user?.email ?? '' })}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Role tiles: standalone, or the open path of a conference code */}
                  {showRoleFlow && (() => {
                    const allCards: { key: JoinMode; label: string; desc: string; icon: ReactNode }[] = [
                      { key: 'delegate', label: t('join_role_delegate'), desc: t('join_role_delegate_desc'), icon: <Globe2 size={17} strokeWidth={2.3} /> },
                      { key: 'chair', label: t('join_role_chair'), desc: t('join_role_chair_desc'), icon: <Gavel size={17} strokeWidth={2.3} /> },
                      { key: 'advisor', label: t('join_role_advisor'), desc: t('join_role_advisor_desc'), icon: <Eye size={17} strokeWidth={2.3} /> },
                    ];
                    // Open path: only what needs no conference role. Delegate when an open seat
                    // exists, chair when the dais is open. The advisor view is not offered.
                    const roleCards = openPath
                      ? allCards.filter((c) => (c.key === 'delegate' && (openSeatCount > 0 || canPointReserved)) || (c.key === 'chair' && chairsOpen))
                      : allCards;
                    const cols = roleCards.length >= 3 ? 'grid-cols-3' : roleCards.length === 2 ? 'grid-cols-2' : 'grid-cols-1';
                    return (
                      <div>
                        <FieldLabel>{t('join_chair_role_label')}</FieldLabel>
                        <div className={`grid ${cols} gap-2 sm:gap-2.5`}>
                          {roleCards.map(({ key, label, desc, icon }) => (
                            <RoleTile key={key} icon={icon} label={label} desc={desc} active={mode === key} onClick={() => resetMode(key)} />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Delegate: the flag-led seat list */}
                  {((showRoleFlow && mode === 'delegate') || (canPointReserved && !openPath)) && (() => {
                    const seats: JoinSeatRow[] = foundCommittee.delegates.map((d) => {
                      const st = seatState(d.country);
                      const reserved = isReservedSeat(d.country);
                      const removed = !reserved && seatRemoved(d.country);
                      const taken = !reserved && !removed && seatsEnforced && !!st && st.full && !st.mine;
                      return {
                        country: d.country,
                        logoUrl: d.logoUrl ?? null,
                        isObserver: d.isObserver,
                        state: reserved ? 'reserved' : removed ? 'removed' : taken ? 'taken' : st?.mine ? 'mine' : 'open',
                      };
                    });
                    const openCount = seats.filter((s) => s.state === 'open' || s.state === 'mine').length;
                    const anyTaken = seats.some((s) => s.state === 'taken');
                    const removedSeat = seats.find((s) => s.state === 'removed');
                    const anyReserved = isConferenceSession && reservedSet.size > 0;
                    const pointing = canPointReserved && !!reservedPick;
                    const note = (anyTaken || removedSeat || (anyReserved && !user)) ? (
                      <div className="space-y-2">
                        {removedSeat && <p>{t('join_seat_removed_note', { n: seatState(removedSeat.country)?.removedMinutes ?? 10 })}</p>}
                        {anyTaken && <p>{t('join_seat_taken_note')}</p>}
                        {pointing && (
                          <ReservedHintPanel
                            country={getCountryDisplayName(reservedPick, language)}
                            hint={reservedHint && reservedHint.country === reservedPick ? reservedHint.hints : undefined}
                            t={t}
                            onClaim={claimReservedSeat}
                          />
                        )}
                        {anyReserved && !user && !canPointReserved && (
                          <div className="flex flex-wrap items-center gap-2.5">
                            <p className="min-w-0 flex-1">{t('join_seat_reserved_note')}</p>
                            <GhostAction onClick={goSignIn} icon={<Lock size={14} strokeWidth={2.4} />}>{t('join_signin_cta')}</GhostAction>
                          </div>
                        )}
                      </div>
                    ) : undefined;
                    return (
                      <div>
                        <FieldLabel>{t('join_country_label')}</FieldLabel>
                        <JoinSeatPicker
                          seats={seats}
                          value={country}
                          onChange={(c) => { setCountry(c); setError(''); setReservedPick(''); }}
                          onReservedPick={canPointReserved ? (c) => { setReservedPick(c); setCountry(''); setError(''); } : undefined}
                          reservedPicked={reservedPick}
                          language={language}
                          labels={{
                            search: t('join_seat_search'),
                            taken: t('join_seat_taken'),
                            reserved: t('join_seat_reserved'),
                            removed: t('join_seat_removed'),
                            yours: t('join_seat_yours'),
                            observer: t('join_observer'),
                            empty: t('join_seat_none'),
                            clear: t('join_seat_clear'),
                            rosterEmpty: t('join_roster_empty'),
                            counter: t('join_seats_open', { open: String(openCount), total: String(seats.length) }),
                          }}
                          blockedNote={note}
                        />
                      </div>
                    );
                  })()}

                  {/* Chair */}
                  {foundCommittee && mode === 'chair' && chairElsewhere && (
                    <div role="status" className="flex items-start gap-2.5 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(238,217,138,0.38)', boxShadow: 'inset 0 0 0 1px rgba(182,135,31,0.32)' }}>
                      <Users size={16} strokeWidth={2.4} color={C.forest} className="mt-0.5 flex-shrink-0" />
                      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: C.forest, textWrap: 'pretty' }}>{t('join_chair_active_elsewhere')}</p>
                    </div>
                  )}

                  {showRoleFlow && mode === 'chair' && (
                    <div>
                      <FieldLabel>{t('join_chair_label')}</FieldLabel>
                      {foundCommittee.chairNames.length > 0 && (
                        <div className="mb-2.5 flex flex-wrap gap-2">
                          {foundCommittee.chairNames.map((n) => {
                            const on = chairNameMode === 'select' && chairName === n;
                            const live = activeChairNames.has(n);
                            return (
                              <button
                                key={n}
                                type="button"
                                aria-pressed={on}
                                onClick={() => { setChairNameMode('select'); setChairName(n); }}
                                className="inline-flex items-center gap-2 rounded-xl px-3.5 focus:outline-none active:scale-[0.96]"
                                style={{
                                  minHeight: 42,
                                  backgroundColor: on ? C.forest : 'rgba(27,56,40,0.05)',
                                  boxShadow: on ? `inset 0 0 0 1.5px ${C.gold}` : 'inset 0 0 0 1px rgba(27,56,40,0.12)',
                                  color: on ? C.page : C.ink, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
                                  transitionProperty: 'background-color, box-shadow, transform', transitionDuration: '150ms',
                                }}
                              >
                                <UserRound size={15} strokeWidth={2.4} color={on ? C.gold : C.forest} />
                                {n}
                                {live && <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: '#3FA36B' }} />}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            aria-pressed={chairNameMode === 'new'}
                            onClick={() => { setChairNameMode('new'); setChairName(''); }}
                            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 focus:outline-none active:scale-[0.96]"
                            style={{
                              minHeight: 42,
                              backgroundColor: chairNameMode === 'new' ? 'rgba(238,217,138,0.45)' : 'transparent',
                              boxShadow: chairNameMode === 'new' ? 'inset 0 0 0 1.5px rgba(182,135,31,0.5)' : 'inset 0 0 0 1px rgba(27,56,40,0.18)',
                              color: C.forest, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700,
                              transitionProperty: 'background-color, box-shadow, transform', transitionDuration: '150ms',
                            }}
                          >
                            <Plus size={15} strokeWidth={2.6} />
                            {t('join_new_name').replace(/^\+\s*/, '')}
                          </button>
                        </div>
                      )}
                      {(chairNameMode === 'new' || foundCommittee.chairNames.length === 0) && (
                        <TextInput
                          value={newChairName}
                          onChange={setNewChairName}
                          placeholder={t('join_name_placeholder')}
                          autoFocus={chairNameMode === 'new' && foundCommittee.chairNames.length > 0}
                          icon={<UserRound size={16} strokeWidth={2.3} />}
                        />
                      )}
                    </div>
                  )}

                  {foundCommittee && mode === 'chair' && (!isConferenceSession || openPath || hasVerifiedRole) && (
                    <div>
                      <FieldLabel>{t('join_chair_role_head')} / {t('join_chair_role_co')}</FieldLabel>
                      <div className="grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ backgroundColor: 'rgba(27,56,40,0.06)' }}>
                        {(['head', 'co'] as const).map((r) => {
                          const on = chairRole === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setChairRole(r)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl focus:outline-none active:scale-[0.96]"
                              style={{
                                height: 44,
                                backgroundColor: on ? C.forest : 'transparent',
                                color: on ? C.gold : C.inkSoft,
                                boxShadow: on ? '0 2px 8px rgba(27,56,40,0.22)' : 'none',
                                fontFamily: OUTFIT, fontSize: 14, fontWeight: 800,
                                transitionProperty: 'background-color, color, box-shadow, transform', transitionDuration: '160ms',
                              }}
                            >
                              {r === 'head' ? <Gavel size={16} strokeWidth={2.4} /> : <MessageSquareText size={16} strokeWidth={2.4} />}
                              {r === 'head' ? t('join_chair_role_head') : t('join_chair_role_co')}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 12, lineHeight: 1.5, color: C.inkSoft, textWrap: 'pretty', minHeight: 36 }}>
                        {chairRole === 'head' ? t('join_chair_role_head_note') : t('join_chair_role_co_note')}
                      </p>
                    </div>
                  )}

                  {foundCommittee && mode === 'chair' && chairAlreadyActive && (
                    <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(139,32,32,0.07)', boxShadow: 'inset 0 0 0 1px rgba(139,32,32,0.2)' }}>
                      <Lock size={15} strokeWidth={2.4} color={C.danger} className="mt-0.5 flex-shrink-0" />
                      <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: C.danger }}>{t('join_chair_name_active')}</p>
                    </div>
                  )}

                  {showRoleFlow && mode === 'chair' && requiresChairCode && (
                    <div>
                      <FieldLabel htmlFor="join-chair-code">{t('join_chair_code_label')}</FieldLabel>
                      <TextInput
                        id="join-chair-code"
                        type="password"
                        inputMode="numeric"
                        value={chairPassword}
                        onChange={(v) => { setChairPassword(v); setPasswordError(''); setChairCodePrefilled(false); }}
                        onEnter={() => { if (!joinDisabled) handleJoin(); }}
                        placeholder={t('join_chair_code_placeholder')}
                        invalid={!!passwordError}
                        icon={<KeyRound size={16} strokeWidth={2.3} />}
                        mono
                      />
                      {passwordError ? (
                        <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: C.danger }}>{passwordError}</p>
                      ) : chairCodePrefilled && chairPassword ? (
                        <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.moss, fontWeight: 600 }}>{t('join_chair_code_prefilled')}</p>
                      ) : null}
                    </div>
                  )}

                  {/* Advisor */}
                  {foundCommittee && mode === 'advisor' && (showRoleFlow || (isConferenceSession && hasVerifiedRole)) && (
                    <div className="flex items-start gap-3.5 rounded-2xl p-4" style={{ backgroundColor: 'rgba(27,56,40,0.05)', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.10)' }}>
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: C.forest, color: C.gold }}>
                        <Eye size={20} strokeWidth={2.2} />
                      </span>
                      <div>
                        <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: C.ink }}>{t('join_role_advisor_desc')}</p>
                        <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.5, color: C.inkSoft, textWrap: 'pretty' }}>{t('join_advisor_note')}</p>
                      </div>
                    </div>
                  )}

                  {/* Conference code, no conference role here: anyone may still follow the room,
                      read only, on their advisor board (owner, 24 Sep 2026). Verified advisors and
                      organisers never see this; they keep the detailed /advisor/CODE view. */}
                  {foundCommittee && isConferenceSession && !checkingConference && !authLoading && !hasVerifiedRole && (
                    <Link
                      href={`/advisor?add=${encodeURIComponent(foundCommittee.code)}`}
                      className="group flex items-center gap-3 rounded-2xl px-3.5 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.99]"
                      style={{ backgroundColor: 'rgba(27,56,40,0.04)', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.10)', transitionProperty: 'background-color, transform', transitionDuration: '160ms' }}
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: C.forest }}>
                        <Eye size={17} strokeWidth={2.3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, color: C.ink }}>{t('join_advisor_follow_title')}</span>
                        <span className="block" style={{ fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.4, color: C.inkSoft, textWrap: 'pretty' }}>{t('join_advisor_follow_body')}</span>
                      </span>
                      <ArrowRight size={16} strokeWidth={2.4} color={C.forest} className="shrink-0 rtl:-scale-x-100" aria-hidden />
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* ── 4. The action ───────────────────────────────────────────── */}
            {/* A sticky bar at the bottom of the screen, above the safe area and (through
                --join-kb, the visual viewport) above the on-screen keyboard. */}
            <div ref={joinBarRef} className="join-action-bar mt-5">
              <PrimaryAction
                onClick={handleJoin}
                disabled={joinDisabled}
                icon={<ArrowRight size={18} strokeWidth={2.6} className="rtl:-scale-x-100" />}
              >
                <span className="truncate">{joinLabel}</span>
              </PrimaryAction>
            </div>

            {/* ── 5. Sign in (phone and tablet; the brand panel carries it on desktop) */}
            {!authLoading && !user && (
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 lg:hidden" style={{ backgroundColor: 'rgba(27,56,40,0.05)' }}>
                <div className="min-w-0 flex-1" style={{ minWidth: 180 }}>
                  <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: C.ink }}>{t('join_signin_prompt')}</p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 12, lineHeight: 1.45, color: C.inkSoft, textWrap: 'pretty' }}>{t('join_signin_why')}</p>
                </div>
                <GhostAction onClick={goSignIn} icon={<LogIn size={15} strokeWidth={2.4} />}>{t('join_signin_cta')}</GhostAction>
              </div>
            )}

            <p className="mt-5 text-center" style={{ fontFamily: OUTFIT, fontSize: 13, color: C.inkSoft }}>
              {t('join_chair_prompt')}{' '}
              <Link href="/create" className="font-bold underline-offset-4 hover:underline focus:outline-none" style={{ color: C.forest }}>
                {t('join_create_instead')}
              </Link>
            </p>
          </JoinCard>
        </div>
      </main>
    </div>
  );
}

// ── Page pieces ──────────────────────────────────────────────────────────────

// The Join action is a sticky bar at the bottom of the screen, above the home indicator
// (safe area) and above the on-screen keyboard (--join-kb, written from the visual
// viewport). It sits in place once the card's end scrolls into view, so it never
// covers the rows under it. At 1280x800 the reserved stage alone already pushed the
// button below the fold, so desktop gets the same bar.
const JOIN_BAR_CSS = `
.join-action-bar {
  position: sticky;
  bottom: var(--join-kb, 0px);
  z-index: 20;
  margin-inline: -20px;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(to bottom, rgba(250,248,243,0.88), #FAF8F3 34%);
  box-shadow: 0 -10px 20px -14px rgba(27,56,40,0.30);
}
@media (min-width: 640px) {
  .join-action-bar { margin-inline: -28px; padding-inline: 28px; }
}
`;

/** A reserved seat a signed-out visitor pointed at: who it is held for, masked, and a
 *  way to sign up or sign in with that address. */
function ReservedHintPanel({ country, hint, t, onClaim }: {
  country: string;
  /** undefined = loading, null = the read failed. */
  hint: ReservedSeatHint[] | null | undefined;
  t: ReturnType<typeof useT>;
  onClaim: (hasAccount: boolean) => void;
}) {
  const hasAccount = !!hint && hint.length > 0 && hint.every((h) => h.hasAccount);
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl p-3.5"
      style={{ backgroundColor: 'rgba(238,217,138,0.30)', boxShadow: 'inset 0 0 0 1px rgba(182,135,31,0.34)' }}
    >
      <div className="flex items-start gap-3">
        <CircleFlag country={country} size={34} decorative />
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: C.ink }}>{country}</p>
          {hint === undefined ? (
            <p className="mt-1 inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft }}>
              <Loader2 size={13} className="animate-spin" /> {t('join_reserved_loading')}
            </p>
          ) : hint === null ? (
            <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.danger, textWrap: 'pretty' }}>{t('join_reserved_failed')}</p>
          ) : (
            <>
              <ul className="mt-1.5 space-y-1">
                {(hint.length ? hint : [{ seat: null, email: null, initial: null, hasAccount: false }]).map((h, i) => (
                  <li key={i} className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: C.forest, color: C.gold, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800 }}
                    >
                      {h.initial ?? <Mail size={12} strokeWidth={2.6} />}
                    </span>
                    <span className="min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: C.forest }}>
                      {h.email ? t('join_reserved_held_for', { email: h.email }) : t('join_reserved_held_unknown')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.5, color: C.inkSoft, textWrap: 'pretty' }}>
                {hasAccount ? t('join_reserved_hint_existing') : t('join_reserved_hint_new')}
              </p>
              <div className="mt-2.5">
                <GhostAction onClick={() => onClaim(hasAccount)} icon={<LogIn size={15} strokeWidth={2.4} />}>{t('join_reserved_this_is_me')}</GhostAction>
              </div>
              <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.5, color: C.inkSoft }}>{t('join_reserved_not_me')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Before a code: a warm placeholder that fills the stage, so the card is already its final size. */
function EmptyStage({ busy, title, body }: { busy: boolean; title: string; body: string }) {
  const flags = ['BR', 'FR', 'KE', 'JP', 'IN', 'MX'];
  return (
    <div
      className="flex h-full min-h-[inherit] flex-col items-center justify-center rounded-3xl px-6 text-center"
      style={{
        minHeight: 'inherit',
        backgroundColor: 'rgba(240,235,221,0.6)',
        backgroundImage: 'radial-gradient(circle at 50% 38%, rgba(238,217,138,0.28) 0%, rgba(238,217,138,0) 55%)',
        boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.08)',
        opacity: busy ? 0.7 : 1,
        transitionProperty: 'opacity', transitionDuration: '200ms',
      }}
    >
      <div className="mb-5 flex items-center" aria-hidden>
        {flags.map((f, i) => (
          <CircleFlag
            key={f}
            code={f}
            size={i === 2 || i === 3 ? 52 : 40}
            decorative
            loading="eager"
            style={{
              marginInlineStart: i === 0 ? 0 : -12,
              boxShadow: '0 0 0 3px #F4EFE3, 0 6px 14px rgba(27,56,40,0.16)',
              zIndex: i === 2 || i === 3 ? 2 : 1,
            }}
          />
        ))}
      </div>
      <p style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, color: C.forest, letterSpacing: '-0.015em', textWrap: 'balance' }}>{title}</p>
      <p className="mt-1.5 max-w-[320px]" style={{ fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.55, color: C.inkSoft, textWrap: 'pretty' }}>{body}</p>
    </div>
  );
}

function BusyBlock() {
  return (
    <div className="flex items-center justify-center rounded-2xl" style={{ height: 88, backgroundColor: 'rgba(27,56,40,0.04)' }}>
      <Loader2 size={22} className="animate-spin" color={C.forest} />
    </div>
  );
}

/** The committee this code opens: emblem, acronym, the spelled name beneath, topic, roster count. */
function CommitteeCard({ committee, conferenceCommittee, delegatesLabel, endedLabel, adjournedLabel, conferenceLabel }: {
  committee: Committee;
  conferenceCommittee: ConferenceCommittee | null;
  delegatesLabel: string;
  endedLabel: string;
  adjournedLabel: string | null;
  conferenceLabel: string | null;
}) {
  const acronym = conferenceCommittee?.abbreviation || deriveCommitteeAcronym(committee.name) || committee.name;
  const spelled = committeeDisplayName(committee.name, acronym);
  const showSpelled = spelled.toLowerCase() !== acronym.toLowerCase();
  const emblem = conferenceCommittee?.logo_url
    || conferenceCommittee?.conferences?.logo_url
    || matchPresetEmblem(committee.name, conferenceCommittee?.abbreviation)
    || PRESET_LOGOS[committee.name]
    || null;
  const [failed, setFailed] = useState<string | null>(null);
  const src = emblem && failed !== emblem ? emblem : null;

  return (
    <div
      className="flex items-center gap-3.5 rounded-2xl p-3.5"
      style={{ backgroundColor: '#FFFDF8', boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 8px 22px rgba(27,56,40,0.08), inset 0 0 0 1px rgba(27,56,40,0.07)' }}
    >
      <span
        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ width: 56, height: 56, backgroundColor: src ? '#FFFFFF' : C.forest, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" onError={() => setFailed(src)} style={{ width: 38, height: 38, objectFit: 'contain' }} />
        ) : (
          <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, color: C.gold, letterSpacing: '0.04em' }}>{acronym.slice(0, 4).toUpperCase()}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {conferenceLabel && <Eyebrow tone="forest" style={{ marginBottom: 2, fontSize: 9.5 }}>{conferenceLabel}</Eyebrow>}
        <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: '-0.015em', lineHeight: 1.2 }}>{acronym}</p>
        {showSpelled && <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft }}>{spelled}</p>}
        {committee.topic && <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{committee.topic}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip tone="neutral" icon={<Users size={11} strokeWidth={2.6} />}><span style={{ fontVariantNumeric: 'tabular-nums' }}>{delegatesLabel}</span></Chip>
          {committee.endedAt && <Chip tone="gold">{endedLabel}</Chip>}
          {!committee.endedAt && committee.suspendedAt && adjournedLabel && <Chip tone="gold">{adjournedLabel}</Chip>}
        </div>
      </div>
    </div>
  );
}

function NoticeCard({ tone, icon, title, body, meta, action, foot }: {
  tone: 'forest' | 'danger';
  icon: ReactNode;
  title: string;
  body: string;
  meta?: string;
  action?: ReactNode;
  foot?: string;
}) {
  const danger = tone === 'danger';
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: danger ? 'rgba(139,32,32,0.05)' : 'rgba(27,56,40,0.05)',
        boxShadow: `inset 0 0 0 1px ${danger ? 'rgba(139,32,32,0.18)' : 'rgba(27,56,40,0.12)'}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-shrink-0" style={{ color: danger ? C.danger : C.forest }}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: danger ? C.danger : C.ink }}>{title}</p>
          <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.55, color: C.inkSoft, textWrap: 'pretty' }}>{body}</p>
          {meta && <p className="mt-2 truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: C.inkSoft }}>{meta}</p>}
          {action && <div className="mt-3">{action}</div>}
          {foot && <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 12, lineHeight: 1.5, color: C.muted }}>{foot}</p>}
        </div>
      </div>
    </div>
  );
}

function TextInput({ id, value, onChange, onEnter, placeholder, autoFocus, icon, type = 'text', inputMode, invalid, mono }: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  icon?: ReactNode;
  type?: 'text' | 'password';
  inputMode?: 'text' | 'numeric';
  invalid?: boolean;
  mono?: boolean;
}) {
  const rest = invalid ? 'inset 0 0 0 2px rgba(139,32,32,0.55)' : 'inset 0 0 0 1.5px rgba(27,56,40,0.14)';
  return (
    <div className="relative">
      {icon && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 flex items-center" style={{ insetInlineStart: 14, color: C.muted }}>{icon}</span>
      )}
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        placeholder={placeholder}
        className="w-full focus:outline-none"
        style={{
          height: 50, borderRadius: 16, paddingInlineStart: icon ? 42 : 16, paddingInlineEnd: 16,
          backgroundColor: '#FFFDF8', boxShadow: rest,
          fontFamily: OUTFIT, fontSize: 16, fontWeight: mono ? 700 : 500, color: C.ink,
          letterSpacing: mono ? '0.18em' : 'normal', fontVariantNumeric: 'tabular-nums',
          transitionProperty: 'box-shadow', transitionDuration: '150ms',
        }}
        onFocus={(e) => { if (!invalid) e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${C.forest}`; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = rest; }}
      />
    </div>
  );
}

export default function JoinPage() {
  return (
    // The fallback is all the RAW HTML this page has (useSearchParams keeps the
    // form client-side), so it carries the page's h1 and a real sentence for
    // crawlers (npm run check:indexability: an h1 and 250+ characters).
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ backgroundColor: C.page }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gavel-mark.png" alt="" className="h-16 w-16 animate-pulse object-contain" />
        <h1 style={{ fontFamily: OUTFIT, fontSize: 22, fontWeight: 800, color: C.ink, margin: 0 }}>Join a MUN session</h1>
        <p style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.55, color: C.inkSoft, maxWidth: '34em', margin: 0 }}>
          Enter the session code your chair shares to join a Model UN committee on Gavelling. Delegates pick
          their seat and follow the speakers list, raise motions, submit papers and vote from their own phone.
          Chairs use the chair code to run the room, and faculty advisors can follow their students.
        </p>
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  );
}
