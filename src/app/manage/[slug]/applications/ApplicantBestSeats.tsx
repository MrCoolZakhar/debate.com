'use client';

// ── Best Seats in the applicant pop-up (owner, 21 Oct 2026) ──────────────────
// For a delegate or head delegate: their three preferences in order, and
// their best three open seats scored by the SAME engine the Assignment page
// ranks by (src/lib/assignmentFit.ts, best seat in each committee, top three,
// exactly as the seat board's person view). Someone already seated sees their
// seat instead: Overview's own Allocation card when the row has it, else
// "Their Seat" here from the allocations read. Overview's own Preferences
// block is hidden while this section shows them (`prefsAbove`).
//
// Assign does not write from here. The assignment write path (pre-flight
// seat check, seat number, the application flip, the allocation email and
// the first-assign pop-up) lives inside the Assignment page component, so
// Assign opens /manage/<slug>/assignment with ?person=<application id>.
//
// Reads happen when the section first mounts (the pop-up opening on
// Overview): this person's application row, then the conference's
// committees, seats and allocations. Both are cached for the page session;
// the committees are re-read after a minute so seats taken elsewhere drop out.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { needyCommitteeIds, rankSeatsForPerson, spreadSocieties } from '@/lib/assignmentFit';
import {
  type AcceptedApp, type CommitteeData, type Suggestion,
  CommitteeLogo, CountryFlag, SuggestionReasons, committeeLabels, committeeSeatLogo, fitColor, slotLogoUrl,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import { CountryName } from '@/app/manage/[slug]/assignment/displayNames';
import { GoldMarker } from '@/app/manage/[slug]/assignment/seatBoardShared';
import type { ApplicantApp } from './ApplicantDetail/data';
import { C, OUTFIT } from './ApplicantDetail/kit';

const COMMITTEES_FRESH_MS = 60_000;

type PersonRow = AcceptedApp & { conference_id: string; status: string };

const PERSON_SELECT = `
  id, conference_id, status, role, experience_level, is_head_delegate, society_id, payment_status,
  attending, invited_email, invited_name, submitted_at, decided_at,
  profiles (id, display_name, email, nationality, date_of_birth, mun_experience_level, avatar_url),
  societies (name),
  application_preferences (
    preference_order, country_code, country_name, conference_committee_id,
    conference_committees (name, abbreviation)
  )
`;

const COMMITTEE_SELECT = `
  id, name, abbreviation, difficulty, total_slots, logo_url, groups,
  committee_country_slots (id, country_code, country_name, delegation_size, importance, logo_url, group_id),
  conference_allocations (id, user_id, country_code, country_name, application_id, society_id, seat, applications:application_id (society_id))
`;

// ── Session caches ───────────────────────────────────────────────────────────
const personCache = new Map<string, Promise<PersonRow>>();
const committeeCache = new Map<string, { at: number; promise: Promise<CommitteeData[]> }>();

function loadPerson(token: string, appId: string): Promise<PersonRow> {
  const hit = personCache.get(appId);
  if (hit) return hit;
  const p = (async () => {
    const { data, error } = await getAuthedClient(token).from('applications').select(PERSON_SELECT).eq('id', appId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('not found');
    return data as unknown as PersonRow;
  })();
  personCache.set(appId, p);
  p.catch(() => personCache.delete(appId));
  return p;
}

function loadCommittees(token: string, conferenceId: string): Promise<CommitteeData[]> {
  const hit = committeeCache.get(conferenceId);
  if (hit && Date.now() - hit.at < COMMITTEES_FRESH_MS) return hit.promise;
  const p = (async () => {
    const { data, error } = await getAuthedClient(token)
      .from('conference_committees')
      .select(COMMITTEE_SELECT)
      .eq('conference_id', conferenceId)
      .order('name', { ascending: true });
    if (error) throw error;
    // Only the columns the engine and the kit read are loaded; the rest of
    // CommitteeData / AllocationRow is display-only on the board.
    return ((data ?? []) as unknown as CommitteeData[]).map(c => ({
      ...c,
      chair_user_ids: null,
      display_chairs: null,
      committee_country_slots: c.committee_country_slots ?? [],
      conference_allocations: (c.conference_allocations ?? []).map(a => ({ ...a, allocation_sent: false, profiles: null })),
    }));
  })();
  committeeCache.set(conferenceId, { at: Date.now(), promise: p });
  p.catch(() => committeeCache.delete(conferenceId));
  return p;
}

type Loaded = { person: PersonRow; committees: CommitteeData[] };
type SeatHeld = { committee: CommitteeData; countryCode: string; countryName: string; logoUrl: string | null };

// ── Small pieces ─────────────────────────────────────────────────────────────
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: OUTFIT, fontSize: 17, fontWeight: 700, color: C.ink };
const rowCard: React.CSSProperties = { background: '#FFFFFF', borderRadius: 16, boxShadow: '0 0 0 1px rgba(27,56,40,0.10), 0 4px 12px rgba(27,56,40,0.06)' };

function Skeleton({ h, w = '100%', r = 16 }: { h: number; w?: number | string; r?: number }) {
  return <span aria-hidden className="block animate-pulse" style={{ height: h, width: w, borderRadius: r, background: '#E9E3D6' }} />;
}

function AssignLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="focus:outline-none inline-flex items-center justify-center flex-none"
      style={{
        height: 38, padding: '0 18px', borderRadius: 10, background: 'linear-gradient(180deg, #26503D, #1B3828)',
        color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, textDecoration: 'none',
        boxShadow: '0 4px 12px rgba(27,56,40,0.22)',
      }}
    >
      Assign
    </Link>
  );
}

// ── The section ──────────────────────────────────────────────────────────────
type ShownApp = Pick<ApplicantApp, 'role' | 'status' | 'assigned_committee' | 'assigned_country_name'>;

function shownState(app: ShownApp) {
  const isDelegateRole = app.role === 'delegate' || app.role === 'head-delegate';
  const closed = app.status === 'rejected' || app.status === 'withdrawn';
  // The row already says where they sit (the same test as Overview's
  // Allocation card, which then shows the seat): nothing here, no reads.
  const seatedOnRow = !!app.assigned_committee && (app.status === 'assigned' || app.status === 'checked-in' || !!app.assigned_country_name);
  return { isDelegateRole, closed, seatedOnRow, shown: isDelegateRole && !closed && !seatedOnRow };
}

/** True when this section renders (and so lists the preferences itself). */
export function bestSeatsShown(app: ShownApp): boolean {
  return shownState(app).shown;
}

export default function ApplicantBestSeats({ app, conferenceSlug, accessToken }: {
  app: ApplicantApp;
  conferenceSlug: string;
  accessToken: string | null;
}) {
  const { shown } = shownState(app);
  const wantsLoad = shown;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!wantsLoad || !accessToken) return;
    let cancelled = false;
    setError(null);
    (async () => {
      const person = await loadPerson(accessToken, app.id);
      const committees = await loadCommittees(accessToken, person.conference_id);
      if (!cancelled) setLoaded({ person, committees });
    })().catch(e => {
      if (!cancelled) setError(friendlyError(e, 'Could not load the best seats. Please try again.'));
    });
    return () => { cancelled = true; };
    // Keyed on the application, never the token (CLAUDE.md: key loads on ids).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsLoad, app.id, attempt]);

  // An allocation the server holds even if the row still reads 'accepted'.
  const heldInData = useMemo<SeatHeld | null>(() => {
    if (!loaded) return null;
    const uid = loaded.person.profiles?.id ?? app.user_id ?? null;
    for (const c of loaded.committees) {
      const a = c.conference_allocations.find(x => x.application_id === app.id || (!!uid && x.user_id === uid));
      if (a) return { committee: c, countryCode: a.country_code, countryName: a.country_name, logoUrl: committeeSeatLogo(c, a.country_code) };
    }
    return null;
  }, [loaded, app.id, app.user_id]);

  const bestThree = useMemo<Suggestion[]>(() => {
    if (!loaded || heldInData) return [];
    const spread = spreadSocieties(loaded.committees);
    const needy = needyCommitteeIds(loaded.committees);
    const best: Suggestion[] = [];
    for (const c of loaded.committees) {
      const top = rankSeatsForPerson(loaded.person, c, spread, needy)[0];
      if (top) best.push(top);
    }
    return best.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [loaded, heldInData]);

  if (!shown) return null;

  const boardHref = `/manage/${conferenceSlug}/assignment?person=${encodeURIComponent(app.id)}`;
  const canAssign = app.status === 'accepted' && (loaded?.person.attending ?? true) !== false;

  // ── A seat the server holds while the row still reads 'accepted' ──
  // (a seat already on the row is Overview's own Allocation card).
  const heldColumn = heldInData ? (() => {
    const labels = committeeLabels(heldInData.committee);
    return (
      <div className="flex flex-col gap-2.5">
        <h3 style={titleStyle}>Their Seat</h3>
        <div className="flex items-center gap-3 flex-wrap" style={{ ...rowCard, padding: '14px 16px' }}>
          <CommitteeLogo committee={heldInData.committee} size={34} alt={labels.big} />
          <span className="flex flex-col min-w-0" style={{ lineHeight: 1.2 }}>
            <span style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, color: C.ink }}>{labels.big}</span>
            {labels.full && <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft }}>{labels.full}</span>}
          </span>
          <span className="inline-flex items-center gap-2 flex-wrap" style={{ marginInlineStart: 8 }}>
            <CountryFlag code={heldInData.countryCode} w={22} h={22} alt={heldInData.countryName} logoUrl={heldInData.logoUrl} />
            <CountryName name={heldInData.countryName} code={heldInData.countryCode} style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, color: C.ink, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
          </span>
        </div>
      </div>
    );
  })() : null;

  // ── Preferences (from the row, so they draw at once) ──
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order).slice(0, 3);
  const committeeById = new Map((loaded?.committees ?? []).map(c => [c.id, c]));

  const prefColumn = (
    <div className="flex flex-col gap-2.5">
      <h3 style={titleStyle}>Preferences</h3>
      {prefs.length === 0 ? (
        <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 13, color: C.inkSoft }}>No preference given</p>
      ) : prefs.map((p, i) => {
        const c = committeeById.get(p.conference_committee_id);
        const cc = p.conference_committees;
        const logoSource = c ?? (cc ? { name: cc.name, abbreviation: cc.abbreviation, logo_url: cc.logo_url } : null);
        const labels = logoSource ? committeeLabels(logoSource) : { big: 'Committee', full: null };
        const slot = c?.committee_country_slots.find(s => s.country_code === p.country_code);
        const heldCount = c ? c.conference_allocations.filter(a => a.country_code === p.country_code).length : 0;
        const taken = !!slot && heldCount >= slot.delegation_size;
        return (
          <div key={`${p.preference_order}-${p.conference_committee_id}`} className="flex items-center gap-3" style={{ ...rowCard, padding: '11px 14px' }}>
            <GoldMarker order={i + 1} size={20} />
            {logoSource && <CommitteeLogo committee={logoSource} size={28} alt={labels.big} />}
            <span className="flex flex-col min-w-0 flex-1" style={{ lineHeight: 1.2 }}>
              <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: C.ink }}>{labels.big}</span>
              {labels.full && <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.inkSoft }}>{labels.full}</span>}
              <span className="inline-flex items-center gap-1.5 flex-wrap mt-1" style={{ fontFamily: OUTFIT, fontSize: 13 }}>
                <CountryFlag code={p.country_code} w={16} h={16} alt={p.country_name} logoUrl={c ? committeeSeatLogo(c, p.country_code) : null} />
                <CountryName name={p.country_name} code={p.country_code} style={{ fontWeight: 600, color: C.ink, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                {taken && <span style={{ color: C.inkSoft }}>is taken</span>}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );

  // ── Best three open seats ──
  const seatColumn = (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 style={titleStyle}>Best Seats</h3>
        {canAssign && (
          <Link href={boardHref} className="focus:outline-none" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: C.forest, textDecoration: 'underline' }}>
            Open in Assignment
          </Link>
        )}
      </div>
      {error ? (
        <div className="flex items-center gap-3 flex-wrap" style={{ ...rowCard, padding: '12px 14px' }}>
          <span style={{ fontFamily: OUTFIT, fontSize: 13, color: C.ink, flex: 1, minWidth: 160 }}>{error}</span>
          <button
            type="button"
            onClick={() => setAttempt(n => n + 1)}
            className="focus:outline-none"
            style={{ height: 34, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: C.ink }}
          >
            Try again
          </button>
        </div>
      ) : !loaded ? (
        <>
          <Skeleton h={74} />
          <Skeleton h={74} />
          <Skeleton h={74} />
        </>
      ) : bestThree.length === 0 ? (
        <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 13, color: C.inkSoft }}>No open seat fits them right now</p>
      ) : (
        <>
          {bestThree.map(sug => {
            const labels = committeeLabels(sug.committee);
            return (
              <div key={`${sug.committee.id}-${sug.slot.id}`} className="flex items-center gap-3.5 flex-wrap" style={{ ...rowCard, padding: '12px 14px' }}>
                <span style={{ fontFamily: OUTFIT, fontSize: 30, fontWeight: 700, color: fitColor(sug.score), fontVariantNumeric: 'tabular-nums', lineHeight: 1, minWidth: 44 }}>{sug.score}</span>
                <div className="flex-1 min-w-0" style={{ minWidth: 170 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CommitteeLogo committee={sug.committee} size={24} alt={labels.big} />
                    <span title={sug.committee.name} style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: C.ink }}>{labels.big}</span>
                    <CountryFlag code={sug.slot.country_code} w={18} h={18} alt={sug.slot.country_name} logoUrl={slotLogoUrl(sug.committee, sug.slot)} />
                    <CountryName name={sug.slot.country_name} code={sug.slot.country_code} style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <SuggestionReasons sug={sug} max={4} />
                  </div>
                </div>
                {canAssign && <AssignLink href={boardHref} />}
              </div>
            );
          })}
          {!canAssign && (
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 13, color: C.inkSoft }}>
              {app.status === 'accepted' ? 'Marked as not attending, so there is no seat to assign' : 'Accept them to assign a seat'}
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <section className="apdTwo" style={{ marginBottom: 28 }}>
      {heldColumn ?? seatColumn}
      {prefColumn}
    </section>
  );
}
