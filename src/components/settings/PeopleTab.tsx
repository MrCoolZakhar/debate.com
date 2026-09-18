'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gavel, MessageSquareText, RefreshCw, Search, Smartphone, UserX } from 'lucide-react';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { seatKey } from '@/lib/seatClaims';
import { getSessionParticipants, kickDelegateSeat, type SessionParticipants, type ParticipantSeat } from '@/lib/sessionParticipants';
import { CircleFlag, SeatCircleFlag, flagMonogram } from '@/components/CircleFlag';
import { delegationNameLabel, useSessionDelegationNames } from '@/lib/sessionDelegationNames';
import { K, T, W, LH, Section } from './settingsKit';
import type { TabProps } from './settingsTypes';

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'forest' | 'danger';
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Resolves true on success, or a message to show in the sheet. */
  run: () => Promise<true | string>;
}

/** Wall clock for "seen N min ago", refreshed on a timer (never read during render). */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

export default function PeopleTab({ committee, t, language, isViewOnly, myChairName, onlineChairs, requestConfirm }: TabProps & {
  onlineChairs?: ReadonlySet<string>;
  requestConfirm: (req: ConfirmRequest) => void;
}) {
  const suffix = committee.dbChairJoinSuffix ?? null;
  const [data, setData] = useState<SessionParticipants | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [skew, setSkew] = useState(0);
  const [query, setQuery] = useState('');
  const now = useNow(30_000);
  // Conference rooms: who was allocated to each delegation, beside its name. Chairs only
  // (this tab is chair-only); null on a standalone session, so rows render as before.
  const delegationNames = useSessionDelegationNames(committee);

  const apply = useCallback((res: SessionParticipants | null) => {
    setLoading(false);
    if (!res) { setFailed(true); return; }
    setFailed(false);
    setData(res);
    const server = Date.parse(res.serverNow);
    if (Number.isFinite(server)) setSkew(server - Date.now());
  }, []);
  const load = useCallback(() => getSessionParticipants(committee.code, suffix).then(apply), [committee.code, suffix, apply]);

  useEffect(() => {
    let alive = true;
    const run = () => { void getSessionParticipants(committee.code, suffix).then((res) => { if (alive) apply(res); }); };
    run();
    const id = setInterval(() => { if (document.visibilityState === 'visible') run(); }, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, [committee.code, suffix, apply]);

  const ago = (iso: string) => {
    const ms = now + skew - Date.parse(iso);
    if (!Number.isFinite(ms) || ms < 60_000) return t('stg_seen_now');
    const m = Math.round(ms / 60_000);
    return t('stg_seen_min', { n: m });
  };

  const isModerator = !isViewOnly;
  const listedChairs = committee.chairNames ?? [];
  // A chair who opened the chair link without going through the join page is on the
  // presence channel but not in chair_names: show them too.
  const chairNames = [...listedChairs, ...[...(onlineChairs ?? [])].filter((n) => n && !listedChairs.includes(n))];
  if (myChairName && !chairNames.includes(myChairName)) chairNames.push(myChairName);
  const head = committee.dbHeadChair || chairNames[0] || '';

  // ── Delegations ─────────────────────────────────────────────────────────────
  const claimsBySeat = useMemo(() => {
    const m = new Map<string, ParticipantSeat[]>();
    (data?.seats ?? []).forEach((s) => { const k = seatKey(s.country); m.set(k, [...(m.get(k) ?? []), s]); });
    return m;
  }, [data]);
  const kicksBySeat = useMemo(() => {
    const m = new Map<string, string>();
    (data?.recentKicks ?? []).forEach((k) => m.set(seatKey(k.country), k.kickedAt));
    return m;
  }, [data]);

  const rows = useMemo(() => {
    const roster = [...committee.delegates].sort((a, b) => getCountryDisplayName(a.country, language).localeCompare(getCountryDisplayName(b.country, language), language, { sensitivity: 'base' }));
    return roster.map((d) => ({ d, claims: claimsBySeat.get(seatKey(d.country)) ?? [], kickedAt: kicksBySeat.get(seatKey(d.country)) ?? null }));
  }, [committee.delegates, claimsBySeat, kicksBySeat, language]);

  const joinedCount = rows.filter((r) => r.claims.length > 0).length;
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => !q
    || getCountryDisplayName(r.d.country, language).toLowerCase().includes(q)
    || r.d.country.toLowerCase().includes(q)
    || delegationNameLabel(delegationNames, r.d.country).toLowerCase().includes(q));

  const kick = (country: string) => {
    const name = getCountryDisplayName(country, language);
    requestConfirm({
      title: t('stg_kick_title', { country: name }),
      body: t('stg_kick_body', { country: name }),
      confirmLabel: t('stg_kick_confirm'),
      tone: 'danger',
      icon: UserX,
      run: async () => {
        const res = await kickDelegateSeat(committee.code, suffix, committee.id, country);
        if (!res.ok) {
          if (res.reason === 'reserved') { void load(); return t('stg_kick_reserved'); }
          return t('stg_action_failed');
        }
        setData((prev) => prev ? {
          ...prev,
          seats: prev.seats.filter((s) => seatKey(s.country) !== seatKey(country)),
          recentKicks: [{ country, kickedAt: new Date(Date.now() + skew).toISOString() }, ...prev.recentKicks],
        } : prev);
        void load();
        return true;
      },
    });
  };

  const refresh = (
    <button type="button" onClick={() => { setLoading(true); void load(); }} aria-label={t('stg_refresh')} title={t('stg_refresh')}
      className="stg-focus stg-press inline-flex items-center justify-center shrink-0"
      style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: K.ivory, color: K.forest, boxShadow: K.outSm, cursor: 'pointer' }}>
      <RefreshCw size={15} strokeWidth={2.4} className={loading ? 'animate-spin' : undefined} style={{ animationDuration: '1.2s' }} />
    </button>
  );

  return (
    <div>
      {failed && !data && (
        <div role="alert" className="flex flex-wrap items-center gap-3" style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 14, background: K.dangerTint, color: K.danger, fontSize: T.body, fontWeight: W.label }}>
          <span className="flex-1">{t('stg_people_failed')}</span>
          <button type="button" onClick={() => void load()} className="stg-focus stg-press" style={{ height: 32, padding: '0 12px', borderRadius: 9, border: 'none', background: K.danger, color: '#FFF6EE', fontSize: T.body, fontWeight: W.section, cursor: 'pointer' }}>{t('delegate_seat_retry')}</button>
        </div>
      )}

      {/* ── The dais: purely informative. A round avatar, the name beneath, and what that chair
          is doing now. No removal from here (the RPC wrappers remain in sessionParticipants). ── */}
      <ul aria-label={t('stg_people_chairs')} className="flex flex-wrap stg-rise" style={{ listStyle: 'none', margin: '2px 0 22px', padding: 0, gap: '14px 22px' }}>
        {chairNames.map((name) => {
          const isHead = name === head;
          const me = !!myChairName && name === myChairName;
          const offline = !isHead && !!onlineChairs && !onlineChairs.has(name);
          const state = isHead ? t('stg_currently_moderating') : offline ? t('stg_currently_offline') : t('stg_currently_commenting');
          return (
            <li key={name} className="flex flex-col items-center text-center" style={{ width: 104 }}>
              <span className="relative inline-flex" style={{ opacity: offline ? 0.55 : 1 }}>
                {getCountryByName(name)
                  ? <CircleFlag country={name} size={52} decorative ring={isHead ? K.gold : true} />
                  : (
                    <span aria-hidden className="inline-flex items-center justify-center" style={{
                      width: 52, height: 52, borderRadius: 999, fontSize: T.section, fontWeight: W.section,
                      background: isHead ? `radial-gradient(circle at 35% 30%, #F7EBB5, ${K.gold} 60%, ${K.deepGold})` : K.surface,
                      color: K.forest, boxShadow: isHead ? '0 6px 14px -6px rgba(182,135,31,0.9)' : K.outSm,
                    }}>{flagMonogram(name)}</span>
                  )}
                <span aria-hidden className="absolute inline-flex items-center justify-center" style={{ bottom: -2, insetInlineEnd: -2, width: 20, height: 20, borderRadius: 999, background: isHead ? K.forest : K.surface, color: isHead ? K.gold : K.forestLight, boxShadow: `0 0 0 2px ${K.page}` }}>
                  {isHead ? <Gavel size={11} strokeWidth={2.6} /> : <MessageSquareText size={11} strokeWidth={2.4} />}
                </span>
              </span>
              <span className="block w-full truncate" title={name} style={{ marginTop: 8, fontSize: T.body, fontWeight: W.section, color: K.ink, lineHeight: LH.body }}>
                {name}
              </span>
              <span className="block" style={{ fontSize: T.caption, fontWeight: W.label, color: isHead ? '#7A5812' : K.inkSoft, lineHeight: LH.body }}>
                {me ? `${t('gavel_you')} ` : ''}{state}
              </span>
            </li>
          );
        })}
        {chairNames.length === 0 && <li style={{ fontSize: T.body, color: K.inkSoft }}>{t('stg_dais_empty')}</li>}
      </ul>

      {/* ── Delegations ── */}
      <Section icon={Smartphone} title={t('stg_people_delegates')} hint={`${t('stg_people_delegates_hint')} ${t('stg_people_footnote')}`} lead delay={40}
        aside={(
          <span className="flex items-center gap-2">
            <span className="stg-num" style={{ fontSize: T.body, fontWeight: W.label, color: K.inkSoft }}>{t('stg_joined_count', { n: joinedCount, total: rows.length })}</span>
            {refresh}
          </span>
        )}>
        {rows.length > 12 && (
          <label className="flex items-center gap-2" style={{ margin: '12px 0 4px', maxWidth: 300, height: 36, padding: '0 12px', borderRadius: 12, background: K.ivory, boxShadow: K.inSm }}>
            <Search size={14} strokeWidth={2.4} aria-hidden style={{ color: K.inkSoft }} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('stg_people_search')} aria-label={t('stg_people_search')}
              className="flex-1 min-w-0" style={{ border: 'none', background: 'transparent', fontSize: T.body, fontWeight: W.label, color: K.ink, fontFamily: K.font, outline: 'none' }} />
          </label>
        )}

        {rows.length === 0 ? (
          <p style={{ margin: 0, padding: '12px 0 16px', fontSize: T.body, color: K.inkSoft }}>{t('stg_no_delegations')}</p>
        ) : (
          <ul className="grid" style={{ listStyle: 'none', margin: 0, padding: '6px 0 10px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', columnGap: 24 }}>
            {shown.map(({ d, claims, kickedAt }) => {
              const joined = claims.length > 0;
              const active = claims.some((c) => c.active);
              // Every holder is the seat's allocated account: the server refuses the kick.
              const reservedOnly = joined && claims.every((c) => c.reserved);
              const name = getCountryDisplayName(d.country, language);
              const people = delegationNameLabel(delegationNames, d.country);
              const kickLeft = kickedAt ? Math.min(10, Math.max(1, Math.ceil((600_000 - (now + skew - Date.parse(kickedAt))) / 60_000))) : 0;
              // One indicator: green = on a device and active, gold = on a device but quiet,
              // hollow = nobody holds the seat. The words are the dot's tooltip and name.
              const latest = claims.reduce<string | null>((acc, c) => (!acc || c.lastSeenAt > acc ? c.lastSeenAt : acc), null);
              const dotText = !joined ? t('stg_not_joined') : active ? t('stg_active_now') : latest ? ago(latest) : t('stg_not_joined');
              return (
                <li key={d.id} className="flex items-center gap-3" style={{ minHeight: 52, padding: '6px 2px', borderTop: `1px solid ${K.hair}` }}>
                  <SeatCircleFlag seat={d} size={34} decorative fallback="initials" />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <span role="img" aria-label={dotText} title={dotText} className="shrink-0" style={{
                        width: 9, height: 9, borderRadius: 9,
                        background: !joined ? 'transparent' : active ? '#3FA268' : K.deepGold,
                        boxShadow: !joined ? 'inset 0 0 0 1.5px rgba(28,20,16,0.30)' : active ? '0 0 0 3px rgba(63,162,104,0.18)' : 'none',
                      }} />
                      <span className="truncate" style={{ fontSize: T.body, fontWeight: W.label, color: K.ink }} title={people ? `${name} · ${people}` : name}>
                        {name}
                        {people && <span style={{ fontWeight: W.body, color: K.inkSoft }}> · {people}</span>}
                      </span>
                    </span>
                    {kickedAt && !joined && (
                      <span className="block" style={{ marginTop: 1, fontSize: T.caption, fontWeight: W.label, color: K.danger }}>{t('stg_kicked_recent', { n: kickLeft })}</span>
                    )}
                    {isModerator && reservedOnly && (
                      <span className="block truncate" title={t('stg_kick_reserved')} style={{ marginTop: 1, fontSize: T.caption, fontWeight: W.label, color: K.inkSoft }}>{t('stg_kick_reserved')}</span>
                    )}
                  </span>
                  {isModerator && joined && !reservedOnly && (
                    <button type="button" onClick={() => kick(d.country)} aria-label={t('stg_kick_aria', { country: name })} title={t('stg_kick_aria', { country: name })}
                      className="stg-focus stg-press inline-flex items-center gap-1.5 shrink-0"
                      style={{ height: 30, padding: '0 10px', borderRadius: 9, border: 'none', background: 'transparent', color: K.danger, fontSize: T.body, fontWeight: W.label, cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(155,44,34,0.25)' }}>
                      <UserX size={13} strokeWidth={2.4} aria-hidden />{t('stg_kick_short')}
                    </button>
                  )}
                </li>
              );
            })}
            {shown.length === 0 && <li style={{ padding: '10px 2px 14px', fontSize: T.body, color: K.inkSoft }}>{t('stg_no_matches')}</li>}
          </ul>
        )}
      </Section>
    </div>
  );
}
