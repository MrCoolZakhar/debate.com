'use client';
// Gavelling Crisis: the small pieces of Crisis Command (header, status strip, approvals, resources, news).

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, Landmark, Newspaper, Pause, Play, RadioTower, Users } from 'lucide-react';
import { DatePicker } from '@/components/DatePicker';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, patchCrisis, publishNews, type CrisisRef } from '@/lib/crisis/api';
import type { Cabinet, Crisis, Member, News, Resource, ResourceType } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, Eyebrow, fieldStyle, scenarioLabel, Skeleton, waitLabel } from '../../crisisKit';
import { formatAmount, groupResourcesByCabinet } from './commandData';

// ─────────── Shared bits ───────────

type LinkTone = 'ghost' | 'red' | 'green';

/** A link that looks like a crisis button (navigation is a link, not a button). */
export function LinkBtn({ href, tone = 'ghost', icon, children, newTab, style }: {
  href: string; tone?: LinkTone; icon?: ReactNode; children: ReactNode; newTab?: boolean; style?: CSSProperties;
}) {
  const bg: Record<LinkTone, string> = { ghost: CK.card, red: CK.redBtn, green: CK.greenBtn };
  const color: Record<LinkTone, string> = { ghost: CK.forest, red: '#FFF4E6', green: '#FFFFFF' };
  const ring = tone === 'ghost' ? `inset 0 0 0 1px ${CK.hair}` : CK.shadowSm;
  return (
    <Link
      href={href}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
      style={{
        borderRadius: 9, padding: '5px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'none',
        background: bg[tone], color: color[tone], boxShadow: ring, fontFamily: CK.font, ...style,
      }}
    >
      {icon}
      {children}
    </Link>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p style={{ margin: '4px 0 0', fontSize: 13, color: CK.inkSoft }}>{children}</p>;
}

const ago = (iso: string | null | undefined, now: number) => {
  const w = waitLabel(iso, now);
  return w === 'just now' ? w : `${w} ago`;
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const dayAndTime = (iso: string, now: number) => {
  const d = new Date(iso);
  const same = d.toDateString() === new Date(now).toDateString();
  return same ? hhmm(iso) : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${hhmm(iso)}`;
};

// ─────────── Header and status strip ───────────

const STRIP_BTN: CSSProperties = {
  border: 0, borderRadius: 9, padding: '5px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  background: 'rgba(255,255,255,0.12)', color: '#FFF4E6', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.24)', fontFamily: CK.font,
};

function StripCell({ icon, label, children, grow }: { icon: ReactNode; label: string; children: ReactNode; grow?: boolean }) {
  return (
    <div className="cmd-cell" style={{ padding: '9px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minWidth: 0, flex: grow ? '1 1 auto' : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,232,214,0.78)', display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label}</span>
      {children}
    </div>
  );
}

const ACCENT_FONT = "'Playfair Display', Georgia, serif";

export function CommandHeader({ crisis, cref, acronym, logoUrl, members, now, onChanged }: {
  crisis: Crisis; cref: CrisisRef; acronym: string; logoUrl: string | null; members: Member[]; now: number; onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftAt, setDraftAt] = useState('');
  const [pausing, setPausing] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'date' | 'open' | null>(null);

  const online = useMemo(() => members.filter((m) => m.last_seen_at && now - new Date(m.last_seen_at).getTime() <= 3 * 60_000).length, [members, now]);

  const words = crisis.name.trim().split(/\s+/);
  const last = words.length > 1 ? words[words.length - 1] : '';
  const lead = words.length > 1 ? words.slice(0, -1).join(' ') : crisis.name;
  const eyebrow = `${acronym.toUpperCase()} · ${crisis.kind === 'joint' ? 'JOINT CRISIS' : 'SINGLE CABINET'} · COMMAND`;

  const startEdit = () => { setDraftAt((crisis.scenario_at ?? '').slice(0, 16)); setEditing(true); };
  const saveDate = async () => {
    if (!draftAt || busy) return;
    setBusy('date');
    try {
      await patchCrisis(cref, { scenario_at: draftAt });
      setEditing(false);
      notifyOk('In-world date saved', 'crisis-command');
      onChanged();
    } catch (e) { notifyErr(crisisError(e, 'Could not save the date.'), 'crisis-command'); }
    finally { setBusy(null); }
  };

  const setOpen = async (open: boolean) => {
    if (busy) return;
    setBusy('open');
    try {
      await patchCrisis(cref, open ? { directives_open: true, directives_paused_note: null } : { directives_open: false, directives_paused_note: note.trim() || null });
      setPausing(false); setNote('');
      notifyOk(open ? 'Directives are open' : 'Directives are paused', 'crisis-command');
      onChanged();
    } catch (e) { notifyErr(crisisError(e, 'Could not change that.'), 'crisis-command'); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex items-center flex-wrap" style={{ gap: '12px 18px', marginBottom: 14 }}>
      <div className="flex items-center" style={{ gap: 12, flex: '1 1 280px', minWidth: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || '/committee-emblems/crisis.svg'} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 style={{ margin: '2px 0 0', fontSize: 21, fontWeight: 800, lineHeight: 1.15, color: CK.ink, overflowWrap: 'anywhere', textWrap: 'balance' }}>
            {lead}{last && ' '}
            {last && <em style={{ fontFamily: ACCENT_FONT, fontStyle: 'italic', fontWeight: 600, color: CK.goldMid }}>{last}</em>}
          </h1>
        </div>
      </div>

      <div
        role="group"
        aria-label="Crisis status"
        className="cmd-strip"
        style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', background: CK.redGrad, color: '#FFF4E6', borderRadius: 18, boxShadow: CK.redShadow, minWidth: 0, maxWidth: '100%' }}
      >
        <StripCell icon={<CalendarClock size={13} strokeWidth={1.5} />} label="In-world date" grow={editing}>
          {editing ? (
            <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
              <span style={{ minWidth: 210 }}>
                <DatePicker value={draftAt} onChange={setDraftAt} withTime placeholder="Pick a date and time" />
              </span>
              <button type="button" style={{ ...STRIP_BTN, background: CK.gold, color: CK.forest, boxShadow: 'none' }} onClick={saveDate} disabled={!draftAt || busy === 'date'}>Save</button>
              <button type="button" style={STRIP_BTN} onClick={() => setEditing(false)}>Cancel</button>
            </span>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
              <span>{scenarioLabel(crisis.scenario_at)}</span>
              <button type="button" style={STRIP_BTN} onClick={startEdit}>Edit</button>
            </span>
          )}
        </StripCell>

        <StripCell
          icon={<span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', background: crisis.directives_open ? '#6BCB8B' : CK.gold, boxShadow: crisis.directives_open ? '0 0 0 3px rgba(107,203,139,0.25)' : '0 0 0 3px rgba(238,217,138,0.25)' }} />}
          label="Directives"
          grow={pausing}
        >
          {pausing ? (
            <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 140))}
                placeholder="Note for delegates (optional)"
                aria-label="Note for delegates"
                autoFocus
                style={{ ...fieldStyle, width: 230, padding: '5px 9px', fontSize: 13, borderRadius: 9 }}
              />
              <button type="button" style={{ ...STRIP_BTN, background: CK.gold, color: CK.forest, boxShadow: 'none' }} onClick={() => setOpen(false)} disabled={busy === 'open'}>Pause directives</button>
              <button type="button" style={STRIP_BTN} onClick={() => { setPausing(false); setNote(''); }}>Cancel</button>
            </span>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <span>{crisis.directives_open ? 'Open' : 'Paused'}</span>
              {crisis.directives_open ? (
                <button type="button" style={{ ...STRIP_BTN, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setPausing(true)}><Pause size={12} strokeWidth={1.6} />Pause</button>
              ) : (
                <button type="button" style={{ ...STRIP_BTN, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setOpen(true)} disabled={busy === 'open'}><Play size={12} strokeWidth={1.6} />Open</button>
              )}
            </span>
          )}
        </StripCell>

        <StripCell icon={<Users size={13} strokeWidth={1.5} />} label="Online">
          <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{online} of {members.length}</span>
        </StripCell>
      </div>
      <style>{'.cmd-strip .cmd-cell + .cmd-cell { border-left: 1px solid rgba(255,255,255,0.14); }'}</style>
    </div>
  );
}

// ─────────── Needs your approval ───────────

export function ApprovalCard({ news, cabinets, members, cref, base, now, onChanged }: {
  news: News[] | null; cabinets: Cabinet[]; members: Member[]; cref: CrisisRef; base: string; now: number; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const drafts = useMemo(() => (news ?? []).filter((n) => n.status === 'draft').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [news]);
  const cabName = (id: string | null) => (id ? cabinets.find((c) => c.id === id)?.name ?? 'one room' : null);
  const authorOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? null;

  const publish = async (n: News) => {
    if (busy) return;
    setBusy(n.id);
    try {
      const r = await publishNews(cref, n.id);
      notifyOk(`Published to ${r.rooms} room${r.rooms === 1 ? '' : 's'}`, 'crisis-command');
      onChanged();
    } catch (e) { notifyErr(crisisError(e, 'Could not publish that.'), 'crisis-command'); }
    finally { setBusy(null); }
  };

  return (
    <Card>
      <CardTitle>Needs Your Approval</CardTitle>
      {news === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={44} /><Skeleton h={44} /></div>
        : drafts.length === 0 ? <EmptyLine>Nothing is waiting for you.</EmptyLine>
        : drafts.map((n, i) => {
          const aud = cabName(n.audience_cabinet_id);
          const by = authorOf(n.author_member_id);
          return (
            <div key={n.id} className="flex" style={{ gap: 10, padding: '10px 0', borderTop: i === 0 ? 0 : `1px solid ${CK.hair}`, alignItems: 'flex-start' }}>
              <span style={{ width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center', color: CK.red }}><Newspaper size={19} strokeWidth={1.5} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</b>
                <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, marginTop: 1, overflowWrap: 'anywhere' }}>
                  {by ? `Drafted by ${by}` : 'Drafted'} for {aud ? `the ${aud} room` : 'every room'} · {ago(n.created_at, now)}
                </span>
                <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
                  <Btn size="sm" onClick={() => publish(n)} disabled={busy === n.id}>Publish</Btn>
                  <LinkBtn href={`${base}/news`}>Edit</LinkBtn>
                </div>
              </div>
            </div>
          );
        })}
    </Card>
  );
}

// ─────────── Cabinet resources ───────────

export function ResourcesCard({ cabinets, types, resources, changes, loaded }: {
  cabinets: Cabinet[]; types: ResourceType[]; resources: Resource[]; changes: Map<string, number>; loaded: boolean;
}) {
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const byCab = useMemo(() => groupResourcesByCabinet(resources), [resources]);
  const withRes = cabinets.filter((c) => (byCab.get(c.id) ?? []).some((r) => typeById.get(r.type_id)?.scope === 'cabinet'));
  return (
    <Card>
      <CardTitle icon={<Landmark size={17} strokeWidth={1.5} />}>Cabinet Resources</CardTitle>
      {!loaded ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={18} w="50%" /><Skeleton h={54} /></div>
        : withRes.length === 0 ? <EmptyLine>No cabinet resources yet.</EmptyLine>
        : withRes.map((cab, i) => {
          const rows = (byCab.get(cab.id) ?? []).filter((r) => typeById.get(r.type_id)?.scope === 'cabinet')
            .sort((a, b) => (typeById.get(a.type_id)?.sort ?? 0) - (typeById.get(b.type_id)?.sort ?? 0));
          return (
            <div key={cab.id} style={{ marginTop: i === 0 ? 0 : 12 }}>
              <h3 className="flex items-center" style={{ margin: '0 0 6px', gap: 7, fontSize: 13, fontWeight: 800, color: cab.color, overflowWrap: 'anywhere' }}>
                <i aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: cab.color, display: 'inline-block', flex: 'none' }} />
                {cab.name}
              </h3>
              <div className="cmd-resgrid" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {rows.map((r) => {
                  const t = typeById.get(r.type_id);
                  const ch = changes.get(r.id);
                  return (
                    <div key={r.id} style={{ background: CK.well, borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{t?.name ?? 'Resource'}</span>
                      <b style={{ display: 'block', fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: CK.ink, overflowWrap: 'anywhere' }}>
                        {formatAmount(r.amount)}{t?.unit ? <small style={{ fontSize: 11.5, fontWeight: 600, color: CK.inkSoft }}> {t.unit}</small> : null}
                        {ch ? <small style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 700, color: ch > 0 ? CK.ok : CK.danger }}>{ch > 0 ? '+' : ''}{formatAmount(ch)}</small> : null}
                      </b>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </Card>
  );
}

// ─────────── Latest news ───────────

export function NewsCard({ news, cabinets, members, base, now }: { news: News[] | null; cabinets: Cabinet[]; members: Member[]; base: string; now: number }) {
  const latest = useMemo(
    () => (news ?? []).filter((n) => n.status === 'published' && n.published_at)
      .sort((a, b) => new Date(b.published_at as string).getTime() - new Date(a.published_at as string).getTime()).slice(0, 5),
    [news],
  );
  return (
    <Card>
      <CardTitle icon={<RadioTower size={17} strokeWidth={1.5} />} right={<LinkBtn href={`${base}/news`}>Open news</LinkBtn>}>News</CardTitle>
      {news === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={36} /><Skeleton h={36} /></div>
        : latest.length === 0 ? <EmptyLine>Nothing has been published yet.</EmptyLine>
        : latest.map((n, i) => {
          const aud = n.audience_cabinet_id ? cabinets.find((c) => c.id === n.audience_cabinet_id)?.name ?? 'One room' : 'Every room';
          const by = members.find((m) => m.id === n.published_by)?.display_name;
          return (
            <div key={n.id} className="flex" style={{ gap: 12, padding: '8px 0', borderTop: i === 0 ? 0 : `1px solid ${CK.hair}` }}>
              <span style={{ flex: 'none', minWidth: 46, fontSize: 12, fontWeight: 800, color: CK.red, fontVariantNumeric: 'tabular-nums' }}>{dayAndTime(n.published_at as string, now)}</span>
              <div style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</b>
                <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{aud}{by ? ` · published by ${by}` : ''}</span>
              </div>
            </div>
          );
        })}
    </Card>
  );
}
