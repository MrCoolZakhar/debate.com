'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gavel, MessageSquareText, RefreshCw, Search, Smartphone, UserRound, UserX, Users, Landmark, MonitorSmartphone, CircleUserRound } from 'lucide-react';
import { getCountryDisplayName } from '@/lib/countries';
import { seatKey } from '@/lib/seatClaims';
import { getSessionParticipants, kickDelegateSeat, removeSessionChair, releaseChairDeviceClaim, type SessionParticipants, type ParticipantSeat } from '@/lib/sessionParticipants';
import { SeatCircleFlag, flagMonogram } from '@/components/CircleFlag';
import { K, Section } from './settingsKit';
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

type Filter = 'all' | 'joined' | 'missing';

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
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const now = useNow(30_000);

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
  // presence channel but not in chair_names: show them too, without a remove button.
  const chairNames = [...listedChairs, ...[...(onlineChairs ?? [])].filter((n) => n && !listedChairs.includes(n))];
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

  const live = rows.filter((r) => r.claims.some((c) => c.active)).length;
  const idle = rows.filter((r) => r.claims.length > 0 && !r.claims.some((c) => c.active)).length;
  const missing = rows.length - live - idle;
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (filter === 'joined' && r.claims.length === 0) return false;
    if (filter === 'missing' && r.claims.length > 0) return false;
    if (q && !getCountryDisplayName(r.d.country, language).toLowerCase().includes(q) && !r.d.country.toLowerCase().includes(q)) return false;
    return true;
  });

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

  const removeChair = (name: string) => {
    requestConfirm({
      title: t('stg_chair_remove_title', { name }),
      body: t('stg_chair_remove_body', { name }),
      confirmLabel: t('stg_chair_remove_confirm'),
      tone: 'danger',
      icon: UserX,
      run: async () => {
        const res = await removeSessionChair(committee.code, suffix, name);
        if (!res.ok) {
          if (res.reason === 'not_found') { void load(); return t('stg_chair_remove_not_found'); }
          return res.reason === 'moderator' ? t('stg_chair_remove_moderator') : t('stg_action_failed');
        }
        void load();
        return true;
      },
    });
  };

  const forgetDevice = (key: string, label: string) => {
    requestConfirm({
      title: t('stg_device_forget_title'),
      body: t('stg_device_forget_body', { name: label }),
      confirmLabel: t('stg_device_forget_confirm'),
      icon: MonitorSmartphone,
      run: async () => {
        const ok = await releaseChairDeviceClaim(committee.code, suffix, key);
        if (!ok) return t('stg_action_failed');
        void load();
        return true;
      },
    });
  };

  const pill = (active: boolean, text: string) => (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 700, color: active ? K.forestLight : K.muted }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 7, background: active ? '#3FA268' : '#C9BDA9', boxShadow: active ? '0 0 0 3px rgba(63,162,104,0.18)' : 'none' }} />
      {text}
    </span>
  );

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
        <div role="alert" className="flex flex-wrap items-center gap-3" style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 14, background: K.dangerTint, color: K.danger, fontSize: 13, fontWeight: 700 }}>
          <span className="flex-1">{t('stg_people_failed')}</span>
          <button type="button" onClick={() => void load()} className="stg-focus stg-press" style={{ height: 32, padding: '0 12px', borderRadius: 9, border: 'none', background: K.danger, color: '#FFF6EE', fontWeight: 800, cursor: 'pointer' }}>{t('delegate_seat_retry')}</button>
        </div>
      )}

      {/* ── Chairs ── */}
      <Section icon={Gavel} title={t('stg_people_chairs')} hint={t('stg_people_chairs_hint')} lead aside={refresh}>
        <ul className="grid gap-2" style={{ listStyle: 'none', margin: 0, padding: '10px 0', gridTemplateColumns: 'repeat(auto-fill, minmax(226px, 1fr))' }}>
          {chairNames.map((name) => {
            const isHead = name === head;
            const me = !!myChairName && name === myChairName;
            const online = onlineChairs?.has(name);
            return (
              <li key={name} className="flex items-center gap-2.5" style={{ padding: 8, borderRadius: 14, background: isHead ? `linear-gradient(150deg, ${K.forest}, #24492F)` : K.surface, boxShadow: isHead ? '0 12px 24px -16px rgba(27,56,40,0.9)' : K.outSm }}>
                <span aria-hidden className="relative inline-flex items-center justify-center shrink-0" style={{ width: 38, height: 38, borderRadius: 999, fontSize: 13.5, fontWeight: 900, background: isHead ? `radial-gradient(circle at 35% 30%, #F7EBB5, ${K.gold} 60%, ${K.deepGold})` : K.ivory, color: K.forest, boxShadow: isHead ? 'none' : K.inSm }}>
                  {flagMonogram(name)}
                  {onlineChairs && (
                    <span style={{ position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 11, height: 11, borderRadius: 11, background: online ? '#3FA268' : '#C9BDA9', boxShadow: `0 0 0 2px ${isHead ? K.forest : K.surface}` }} />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 800, color: isHead ? '#F3EAD0' : K.ink }}>
                    {name}{me && <span style={{ marginInlineStart: 6, fontSize: 12, fontWeight: 700, color: isHead ? K.gold : K.forestLight }}>{t('gavel_you')}</span>}
                  </span>
                  <span className="inline-flex items-center gap-1.5" style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: isHead ? K.gold : K.inkSoft }}>
                    {isHead ? <Gavel size={12} strokeWidth={2.6} aria-hidden /> : <MessageSquareText size={12} strokeWidth={2.4} aria-hidden />}
                    {isHead ? t('stg_role_moderator') : t('stg_role_commenter')}
                    {onlineChairs && <span style={{ fontWeight: 600, opacity: 0.75 }}>· {online ? t('stg_online') : t('stg_offline')}</span>}
                  </span>
                </span>
                {isModerator && !isHead && !me && listedChairs.includes(name) && (
                  <button type="button" onClick={() => removeChair(name)} aria-label={t('stg_chair_remove_aria', { name })} title={t('stg_chair_remove_aria', { name })}
                    className="stg-focus stg-press inline-flex items-center justify-center shrink-0"
                    style={{ width: 36, height: 36, borderRadius: 11, border: 'none', background: 'transparent', color: K.danger, cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(155,44,34,0.22)' }}>
                    <UserX size={16} strokeWidth={2.3} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {data?.isConference && data.conferenceChairs.length > 0 && (
          <div style={{ borderTop: `1px solid ${K.hair}`, padding: '10px 0' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 10, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.inkSoft }}>
              <Landmark size={13} strokeWidth={2.4} aria-hidden />{t('stg_conference_chairs')}
            </div>
            <div className="flex flex-wrap gap-2">
              {data.conferenceChairs.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-2" style={{ height: 36, padding: '0 12px 0 5px', borderRadius: 999, background: K.surface, boxShadow: K.outSm }}>
                  <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 26, background: K.ivory, color: K.forest, fontSize: 10.5, fontWeight: 900 }}>{flagMonogram(c.name ?? '?')}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: K.ink }}>{c.name ?? t('stg_unnamed_account')}</span>
                  {pill(c.joined, c.joined ? t('stg_joined_here') : t('stg_not_joined'))}
                </span>
              ))}
            </div>
          </div>
        )}

        {data && data.chairDevices.length > 0 && (
          <div style={{ borderTop: `1px solid ${K.hair}`, padding: '10px 0' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 4, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.inkSoft }}>
              <MonitorSmartphone size={13} strokeWidth={2.4} aria-hidden />{t('stg_chair_devices')}
            </div>
            <p className="stg-body" style={{ margin: '0 0 10px', fontSize: 12, color: K.muted }}>{t('stg_chair_devices_hint')}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="flex flex-col gap-1">
              {data.chairDevices.map((c) => {
                const label = c.name ?? t('stg_signed_in_chair');
                return (
                  <li key={c.key} className="flex items-center gap-3" style={{ padding: '6px 0' }}>
                    <CircleUserRound size={20} strokeWidth={2} aria-hidden style={{ color: K.forestLight }} />
                    <span className="flex-1 min-w-0 truncate" style={{ fontSize: 13.5, fontWeight: 700, color: K.ink }}>{label}</span>
                    {pill(c.active, c.active ? t('stg_active_now') : ago(c.lastSeenAt))}
                    {isModerator && (
                      <button type="button" onClick={() => forgetDevice(c.key, label)} className="stg-focus stg-press"
                        style={{ height: 30, padding: '0 10px', borderRadius: 9, border: 'none', background: 'transparent', color: K.inkSoft, fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.14)' }}>
                        {t('stg_device_forget_confirm')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Section>

      {/* ── Delegations ── */}
      <Section icon={Smartphone} title={t('stg_people_delegates')} hint={t('stg_people_delegates_hint')} lead delay={40}>
        {/* Who is in, as one segmented bar. */}
        <div style={{ padding: '12px 0 4px' }}>
          <div className="flex items-end justify-between gap-3 flex-wrap" style={{ marginBottom: 10 }}>
            <div className="stg-num" style={{ fontSize: 30, fontWeight: 900, color: K.ink, lineHeight: 1 }}>
              {live + idle}<span style={{ fontSize: 15, fontWeight: 700, color: K.muted }}> / {rows.length}</span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 12.5, fontWeight: 700, color: K.inkSoft }}>{t('stg_on_devices')}</span>
            </div>
            <div className="flex flex-wrap gap-3" style={{ fontSize: 12, fontWeight: 700, color: K.inkSoft }}>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: K.forest }} />{t('stg_legend_live', { n: live })}</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: K.deepGold }} />{t('stg_legend_idle', { n: idle })}</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(28,20,16,0.14)' }} />{t('stg_legend_missing', { n: missing })}</span>
            </div>
          </div>
          <div role="img" aria-label={t('stg_bar_aria', { live, idle, missing })} className="flex overflow-hidden" style={{ height: 14, borderRadius: 999, background: 'rgba(28,20,16,0.08)', boxShadow: K.inSm, gap: 2 }}>
            {live > 0 && <span style={{ flexGrow: live, background: `linear-gradient(90deg, ${K.forest}, ${K.forestLight})`, borderRadius: 999, transitionProperty: 'flex-grow', transitionDuration: '300ms' }} />}
            {idle > 0 && <span style={{ flexGrow: idle, background: K.deepGold, borderRadius: 999 }} />}
            {missing > 0 && <span style={{ flexGrow: missing }} />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" style={{ padding: '9px 0' }}>
          <div role="radiogroup" aria-label={t('stg_people_filter')} className="inline-flex" style={{ padding: 3, borderRadius: 12, background: K.ivory, boxShadow: K.inSm }}>
            {([['all', t('stg_filter_all', { n: rows.length })], ['joined', t('stg_filter_joined', { n: live + idle })], ['missing', t('stg_filter_missing', { n: missing })]] as [Filter, string][]).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={filter === id} onClick={() => setFilter(id)} className="stg-focus stg-press stg-num"
                style={{ height: 30, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, background: filter === id ? K.surface : 'transparent', color: filter === id ? K.forest : K.inkSoft, boxShadow: filter === id ? K.outSm : 'none' }}>
                {label}
              </button>
            ))}
          </div>
          {rows.length > 8 && (
            <label className="inline-flex items-center gap-2 flex-1" style={{ minWidth: 180, maxWidth: 280, height: 36, padding: '0 12px', borderRadius: 12, background: K.surface, boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.12)' }}>
              <Search size={14} strokeWidth={2.4} aria-hidden style={{ color: K.muted }} />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('stg_people_search')} aria-label={t('stg_people_search')}
                className="flex-1 min-w-0" style={{ border: 'none', background: 'transparent', fontSize: 13.5, fontWeight: 600, color: K.ink, fontFamily: K.font, outline: 'none' }} />
            </label>
          )}
        </div>

        {rows.length === 0 ? (
          <p style={{ margin: 0, padding: '8px 0 18px', fontSize: 13, color: K.muted }}>{t('stg_no_delegations')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 10px' }}>
            {shown.map(({ d, claims, kickedAt }, i) => {
              const joined = claims.length > 0;
              const active = claims.some((c) => c.active);
              const latest = claims.reduce<string | null>((acc, c) => (!acc || c.lastSeenAt > acc ? c.lastSeenAt : acc), null);
              const accounts = claims.filter((c) => c.kind === 'account').length;
              // Every holder is the seat's allocated account: the server refuses the kick.
              const reservedOnly = joined && claims.every((c) => c.reserved);
              const name = getCountryDisplayName(d.country, language);
              const kickLeft = kickedAt ? Math.min(10, Math.max(1, Math.ceil((600_000 - (now + skew - Date.parse(kickedAt))) / 60_000))) : 0;
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3" style={{ padding: '10px 4px', borderTop: i === 0 ? 'none' : `1px solid ${K.hair}` }}>
                  <span className="relative inline-flex shrink-0" style={{ opacity: joined ? 1 : 0.55 }}>
                    <SeatCircleFlag seat={d} size={38} decorative fallback="initials" />
                    {joined && <span aria-hidden style={{ position: 'absolute', bottom: -1, insetInlineEnd: -1, width: 12, height: 12, borderRadius: 12, background: active ? '#3FA268' : K.deepGold, boxShadow: `0 0 0 2px ${K.surface}` }} />}
                  </span>
                  <span className="flex-1 min-w-0" style={{ minWidth: 160 }}>
                    <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 800, color: joined ? K.ink : K.inkSoft }}>{name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: K.inkSoft }}>
                      {joined ? (
                        <>
                          <span className="inline-flex items-center gap-1">
                            {accounts > 0 ? <UserRound size={12} strokeWidth={2.4} aria-hidden /> : <Smartphone size={12} strokeWidth={2.4} aria-hidden />}
                            {claims.length > 1 ? t('stg_devices_count', { n: claims.length }) : accounts > 0 ? t('stg_kind_account') : t('stg_kind_device')}
                          </span>
                          <span aria-hidden>·</span>
                          <span>{active ? t('stg_active_now') : latest ? ago(latest) : ''}</span>
                        </>
                      ) : kickedAt ? (
                        <span style={{ color: K.danger, fontWeight: 700 }}>{t('stg_kicked_recent', { n: kickLeft })}</span>
                      ) : (
                        <span>{t('stg_not_joined')}</span>
                      )}
                      <span aria-hidden>·</span>
                      <span style={{ color: d.status === 'absent' ? K.muted : K.forestLight, fontWeight: 700 }}>
                        {d.status === 'absent' ? t('rollcall_absent') : d.status === 'present-voting' ? t('stg_status_pv') : t('stg_status_present')}
                      </span>
                    </span>
                  </span>
                  {isModerator && reservedOnly && (
                    <span className="shrink-0" style={{ maxWidth: 220, fontSize: 12, fontWeight: 700, color: K.inkSoft, lineHeight: 1.35 }}>
                      {t('stg_kick_reserved')}
                    </span>
                  )}
                  {isModerator && joined && !reservedOnly && (
                    <button type="button" onClick={() => kick(d.country)} aria-label={t('stg_kick_aria', { country: name })}
                      className="stg-focus stg-press inline-flex items-center gap-1.5 shrink-0"
                      style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 'none', background: 'transparent', color: K.danger, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(155,44,34,0.25)' }}>
                      <UserX size={14} strokeWidth={2.4} aria-hidden />{t('stg_kick_short')}
                    </button>
                  )}
                </li>
              );
            })}
            {shown.length === 0 && <li style={{ padding: '8px 4px 14px', fontSize: 13, color: K.muted }}>{t('stg_no_matches')}</li>}
          </ul>
        )}
      </Section>

      <p className="stg-body inline-flex items-start gap-2" style={{ margin: '0 4px 8px', fontSize: 12, lineHeight: 1.5, color: K.muted }}>
        <Users size={13} strokeWidth={2.4} aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />
        {t('stg_people_footnote')}
      </p>
    </div>
  );
}
