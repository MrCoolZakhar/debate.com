'use client';

// "Add a person" (owner, 21 Oct 2026): the second step of the delegation
// pop-up's People tab, drawn in place of the tab with the pop-up's back button.
// Lists the conference's INDIVIDUAL applicants (delegate or head-delegate
// applications with no delegation, not turned down or withdrawn) with a search,
// their avatar, name and, when they have one, the country and committee of their
// allocation. Picking one asks in place "Add NAME to DELEGATION?" and calls
// organiser_add_to_delegation (Christian's; the money moves with the person).
// Only reachable while ORGANISER_ADD_TO_DELEGATION_DB (v2.ts) is on.

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { memberName } from '../delegationRows';
import { organiserAddToDelegation } from './v2';
import {
  BTN_CLASS, CommitteeTag, FONT, HAIRLINE, INK, INK_SOFT, ROW_LINE, RoundAvatar, SkeletonRows, smallPrimaryBtn, smallSecondaryBtn,
} from './kit';

interface Individual {
  id: string;
  user_id: string | null;
  invited_name: string | null;
  invited_email: string | null;
  role: string;
  status: string;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  assigned_committee: { name: string; abbreviation: string | null; logo_url: string | null } | null;
  profiles: { display_name: string; email: string; avatar_url: string | null } | null;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export default function AddPersonStep({ conferenceId, societyId, delegationName, trackWrite, onAdded }: {
  conferenceId: string;
  societyId: string;
  delegationName: string;
  /** The live re-read stands down while the write runs. */
  trackWrite: <T>(work: () => Promise<T>) => Promise<T>;
  /** The person joined: the pop-up goes back to People and re-reads. */
  onAdded: () => void;
}) {
  const [people, setPeople] = useState<Individual[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const c = await getFreshAuthedClient();
      if (cancelled) return;
      if (!c) { setFailed(true); return; }
      const out: Individual[] = [];
      for (let from = 0; from < 20_000; from += 1000) {
        const { data, error } = await c.from('applications')
          .select(`
            id, user_id, invited_name, invited_email, role, status,
            assigned_country_code, assigned_country_name,
            assigned_committee:conference_committees!assigned_committee_id (name, abbreviation, logo_url),
            profiles (display_name, email, avatar_url)
          `)
          .eq('conference_id', conferenceId)
          .is('society_id', null)
          .in('role', ['delegate', 'head-delegate'])
          .not('status', 'in', '(rejected,withdrawn)')
          .order('id', { ascending: true })
          .range(from, from + 999);
        if (cancelled) return;
        if (error) {
          friendlyError(error, 'The applicants could not be loaded.');
          setFailed(true);
          return;
        }
        const rows = (data ?? []) as unknown as Individual[];
        out.push(...rows);
        if (rows.length < 1000) break;
      }
      setFailed(false);
      setPeople(out.sort((a, b) => collator.compare(memberName(a), memberName(b))));
    })();
    return () => { cancelled = true; };
  }, [conferenceId, attempt]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!people) return [];
    if (!q) return people;
    return people.filter(p => [memberName(p), p.profiles?.email ?? '', p.invited_email ?? '', p.assigned_country_name ?? '']
      .join(' ').toLowerCase().includes(q));
  }, [people, query]);

  async function add(p: Individual) {
    if (busy) return;
    setBusy(true);
    const r = await trackWrite(() => organiserAddToDelegation(p.id, societyId));
    setBusy(false);
    if (!r.ok) { notifyErr(r.error, 'applications'); return; }
    notifyOk(`${memberName(p)} joined ${delegationName}.`, 'applications');
    onAdded();
  }

  return (
    <div className="flex flex-col" style={{ gap: 14 }}>
      <label className="flex items-center gap-2" style={{ height: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${HAIRLINE}`, background: '#FFFFFF', maxWidth: 520 }}>
        <Search size={18} strokeWidth={1.5} color={INK_SOFT} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, email or country"
          aria-label="Search individual applicants"
          className="flex-1 min-w-0 focus:outline-none"
          style={{ border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14, color: INK }}
        />
      </label>

      {failed ? (
        <div>
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK }}>The applicants could not be loaded.</p>
          <button type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1); }} className={BTN_CLASS}
            style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#1B3828', textDecoration: 'underline' }}>
            Try again
          </button>
        </div>
      ) : people === null ? (
        <SkeletonRows rows={5} height={56} />
      ) : people.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>Nobody has applied on their own yet.</p>
      ) : shown.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>Nobody matches that search.</p>
      ) : (
        <div className="flex flex-col">
          {shown.map(p => {
            const name = memberName(p);
            const email = p.profiles?.email || p.invited_email || '';
            const picked = pickedId === p.id;
            return (
              <div key={p.id} style={{ borderTop: `1px solid ${ROW_LINE}`, background: picked ? '#FAF7F0' : 'transparent' }}>
                <button
                  type="button"
                  onClick={() => setPickedId(picked ? null : p.id)}
                  aria-expanded={picked}
                  className={`${BTN_CLASS} w-full grid items-center text-left hover:bg-[rgba(27,56,40,0.025)]`}
                  style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 120px', gap: 16, padding: '12px 8px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <RoundAvatar name={name} url={p.profiles?.avatar_url ?? null} size={44} seed={p.id} />
                    <span className="flex flex-col min-w-0" style={{ gap: 1 }}>
                      <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{name}</span>
                      {email && email !== name && (
                        <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT }}>{email}</span>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-col min-w-0" style={{ gap: 3 }}>
                    {p.assigned_country_name || p.assigned_country_code ? (
                      <>
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <CircleFlag code={p.assigned_country_code} label={p.assigned_country_name ?? undefined} size={22} decorative />
                          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK }}>{p.assigned_country_name ?? p.assigned_country_code}</span>
                        </span>
                        {p.assigned_committee && (
                          <CommitteeTag name={p.assigned_committee.name} abbreviation={p.assigned_committee.abbreviation} logoUrl={p.assigned_committee.logo_url} size={16} fontSize={12.5} />
                        )}
                      </>
                    ) : (
                      <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>No allocation yet</span>
                    )}
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{p.role === 'head-delegate' ? 'Head delegate' : 'Delegate'}</span>
                </button>
                {picked && (
                  <div className="flex items-center justify-between gap-4 flex-wrap"
                    style={{ margin: '0 8px 12px 64px', padding: '14px 16px', borderRadius: 12, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 6px 18px rgba(27,56,40,0.08)' }}>
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: 1.45, color: INK }}>
                      Add {name} to {delegationName}?
                    </span>
                    <div className="flex gap-2 flex-shrink-0">
                      <button type="button" onClick={() => setPickedId(null)} disabled={busy} className={BTN_CLASS} style={smallSecondaryBtn}>Cancel</button>
                      <button type="button" onClick={() => { void add(p); }} disabled={busy} className={BTN_CLASS}
                        style={{ ...smallPrimaryBtn, height: 36, opacity: busy ? 0.7 : 1 }}>
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
