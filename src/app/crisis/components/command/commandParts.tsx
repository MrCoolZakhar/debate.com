'use client';
// Gavelling Crisis: the small pieces of Crisis Command (header, status strip, approvals, resources, news).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, ClipboardCheck, Landmark, Newspaper, Pause, Pencil, Play, RadioTower, Users } from 'lucide-react';
import Portal from '@/components/Portal';
import { DatePicker } from '@/components/DatePicker';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, patchCrisis, publishNews, type CrisisRef } from '@/lib/crisis/api';
import type { Cabinet, Crisis, Member, News, Resource, ResourceType } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, cabinetTint, Eyebrow, fieldStyle, resourceIcon, scenarioLabel, Skeleton, waitLabel } from '../../crisisKit';
import { formatAmount, groupResourcesByCabinet } from './commandData';
import { TryAsButton } from './TryAsPanel';

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

// ─────────── Header and status strip ───────────
// One compact row. Editing the date or pausing directives opens a small pop-over, so the strip
// never changes shape while it is edited.

const STRIP_BTN: CSSProperties = {
  border: 0, borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  background: 'rgba(255,255,255,0.12)', color: '#FFF4E6', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.24)', fontFamily: CK.font,
  display: 'inline-flex', alignItems: 'center', gap: 4,
};

function StripCell({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="cmd-cell" style={{ padding: '6px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,232,214,0.78)', display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label}</span>
      {children}
    </div>
  );
}

const ACCENT_FONT = "'Playfair Display', Georgia, serif";

/** A small floating panel under a button, through Portal at fixed coordinates. Escape and a click outside close it. */
function Popover({ anchor, onClose, width = 320, label, children }: { anchor: DOMRect; onClose: () => void; width?: number; label: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[data-gsel-popover]')) closeRef.current(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || box.current?.contains(t)) return;
      // The date picker's calendar and the dropdowns inside it portal their own panels.
      if (t.closest?.('[data-gsel-popover], [style*="z-index: 9999"]')) return;
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const w = Math.min(width, vw - 16);
  const left = Math.max(8, Math.min(anchor.left, vw - w - 8));
  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label={label}
        style={{
          position: 'fixed', left, top: anchor.bottom + 8, width: w, zIndex: 300, background: CK.card, borderRadius: 16, padding: 14, fontFamily: CK.font, color: CK.ink,
          boxShadow: '0 18px 44px rgba(58,14,15,0.28), 0 0 0 1px rgba(110,30,30,0.1)',
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

export function CommandHeader({ crisis, cref, acronym, logoUrl, members, now, onChanged }: {
  crisis: Crisis; cref: CrisisRef; acronym: string; logoUrl: string | null; members: Member[]; now: number; onChanged: () => void;
}) {
  const [pop, setPop] = useState<{ kind: 'date' | 'pause'; rect: DOMRect } | null>(null);
  const [draftAt, setDraftAt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'date' | 'open' | null>(null);

  const online = useMemo(() => members.filter((m) => m.last_seen_at && now - new Date(m.last_seen_at).getTime() <= 3 * 60_000).length, [members, now]);

  const words = crisis.name.trim().split(/\s+/);
  const last = words.length > 1 ? words[words.length - 1] : '';
  const lead = words.length > 1 ? words.slice(0, -1).join(' ') : crisis.name;
  const eyebrow = `${acronym.toUpperCase()} · ${crisis.kind === 'joint' ? 'JOINT CRISIS' : 'SINGLE CABINET'} · COMMAND`;

  const openDate = (el: HTMLElement) => { setDraftAt((crisis.scenario_at ?? '').slice(0, 16)); setPop({ kind: 'date', rect: el.getBoundingClientRect() }); };
  const openPause = (el: HTMLElement) => { setNote(''); setPop({ kind: 'pause', rect: el.getBoundingClientRect() }); };

  const saveDate = async () => {
    if (!draftAt || busy) return;
    setBusy('date');
    try {
      await patchCrisis(cref, { scenario_at: draftAt });
      setPop(null);
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
      setPop(null); setNote('');
      notifyOk(open ? 'Directives are open' : 'Directives are paused', 'crisis-command');
      onChanged();
    } catch (e) { notifyErr(crisisError(e, 'Could not change that.'), 'crisis-command'); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex items-center flex-wrap" style={{ gap: '6px 18px', marginBottom: 10, minHeight: 48 }}>
      <div className="flex items-center" style={{ gap: 10, flex: '1 1 260px', minWidth: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || '/committee-emblems/crisis.svg'} alt="" width={34} height={34} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <Eyebrow style={{ fontSize: 9.5 }}>{eyebrow}</Eyebrow>
          <h1 style={{ margin: '1px 0 0', fontSize: 19, fontWeight: 800, lineHeight: 1.15, color: CK.ink, overflowWrap: 'anywhere', textWrap: 'balance' }}>
            {lead}{last && ' '}
            {last && <em style={{ fontFamily: ACCENT_FONT, fontStyle: 'italic', fontWeight: 600, color: CK.goldMid }}>{last}</em>}
          </h1>
        </div>
      </div>

      <div
        role="group"
        aria-label="Crisis status"
        className="cmd-strip"
        style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', background: CK.redGrad, color: '#FFF4E6', borderRadius: 16, boxShadow: CK.redShadow, minWidth: 0, maxWidth: '100%' }}
      >
        <StripCell icon={<CalendarClock size={13} strokeWidth={1.5} />} label="In-world date">
          <span style={{ fontSize: 14.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            <span>{scenarioLabel(crisis.scenario_at)}</span>
            <button type="button" style={STRIP_BTN} aria-haspopup="dialog" aria-expanded={pop?.kind === 'date'} onClick={(e) => (pop?.kind === 'date' ? setPop(null) : openDate(e.currentTarget))}>
              <Pencil size={11} strokeWidth={1.6} aria-hidden />Edit
            </button>
          </span>
        </StripCell>

        <StripCell
          icon={<span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', background: crisis.directives_open ? '#6BCB8B' : CK.gold, boxShadow: crisis.directives_open ? '0 0 0 3px rgba(107,203,139,0.25)' : '0 0 0 3px rgba(238,217,138,0.25)' }} />}
          label="Directives"
        >
          <span style={{ fontSize: 14.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span>{crisis.directives_open ? 'Open' : 'Paused'}</span>
            {crisis.directives_open ? (
              <button type="button" style={STRIP_BTN} aria-haspopup="dialog" aria-expanded={pop?.kind === 'pause'} onClick={(e) => (pop?.kind === 'pause' ? setPop(null) : openPause(e.currentTarget))}><Pause size={11} strokeWidth={1.6} aria-hidden />Pause</button>
            ) : (
              <button type="button" style={STRIP_BTN} onClick={() => setOpen(true)} disabled={busy === 'open'}><Play size={11} strokeWidth={1.6} aria-hidden />Open</button>
            )}
          </span>
        </StripCell>

        <StripCell icon={<Users size={13} strokeWidth={1.5} />} label="Online">
          <span style={{ fontSize: 14.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{online} of {members.length}</span>
        </StripCell>
      </div>
      <TryAsButton cref={cref} />
      <style>{'.cmd-strip .cmd-cell + .cmd-cell { border-left: 1px solid rgba(255,255,255,0.14); }'}</style>

      {pop?.kind === 'date' && (
        <Popover anchor={pop.rect} onClose={() => setPop(null)} width={340} label="Set the in-world date">
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>In-world date and time</p>
          <DatePicker value={draftAt} onChange={setDraftAt} withTime placeholder="Pick a date and time" />
          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <Btn size="sm" onClick={saveDate} disabled={!draftAt || busy === 'date'}>Save</Btn>
            <Btn size="sm" tone="ghost" onClick={() => setPop(null)}>Cancel</Btn>
          </div>
        </Popover>
      )}
      {pop?.kind === 'pause' && (
        <Popover anchor={pop.rect} onClose={() => setPop(null)} width={340} label="Pause directives">
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>Pause directives</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 140))}
            placeholder="Note for delegates (optional)"
            aria-label="Note for delegates"
            autoFocus
            style={{ ...fieldStyle, padding: '7px 10px', fontSize: 13.5, borderRadius: 10 }}
          />
          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <Btn size="sm" tone="red" onClick={() => setOpen(false)} disabled={busy === 'open'}>Pause directives</Btn>
            <Btn size="sm" tone="ghost" onClick={() => setPop(null)}>Cancel</Btn>
          </div>
        </Popover>
      )}
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
    <Card className="cmd-card">
      <CardTitle icon={<ClipboardCheck size={17} strokeWidth={1.5} />}>Needs Your Approval</CardTitle>
      {news === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={36} /></div>
        : drafts.length === 0 ? <EmptyLine>Nothing is waiting for you.</EmptyLine>
        : drafts.map((n, i) => {
          const aud = cabName(n.audience_cabinet_id);
          const by = authorOf(n.author_member_id);
          return (
            <div key={n.id} className="flex items-center" style={{ gap: 10, padding: '7px 0', borderTop: i === 0 ? 0 : `1px solid ${CK.hair}` }}>
              <span aria-hidden style={{ width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center', color: CK.red, background: cabinetTint(CK.red, 0.1), borderRadius: 10 }}><Newspaper size={17} strokeWidth={1.5} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</b>
                <span style={{ display: 'block', fontSize: 11.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                  {by ? `${by}` : 'Draft'} · {aud ? `${aud} room` : 'every room'} · {ago(n.created_at, now)}
                </span>
              </div>
              <div className="flex" style={{ gap: 6, flex: 'none' }}>
                <Btn size="sm" onClick={() => publish(n)} disabled={busy === n.id}>Publish</Btn>
                <LinkBtn href={`${base}/news`}>Edit</LinkBtn>
              </div>
            </div>
          );
        })}
    </Card>
  );
}

// ─────────── Cabinet resources ───────────

const PER_CABINET = 4;

export function ResourcesCard({ cabinets, types, resources, changes, loaded, base }: {
  cabinets: Cabinet[]; types: ResourceType[]; resources: Resource[]; changes: Map<string, number>; loaded: boolean; base: string;
}) {
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const byCab = useMemo(() => groupResourcesByCabinet(resources), [resources]);
  const withRes = cabinets.filter((c) => (byCab.get(c.id) ?? []).some((r) => typeById.get(r.type_id)?.scope === 'cabinet'));
  return (
    <Card className="cmd-card" style={{ padding: '10px 14px' }}>
      <CardTitle icon={<Landmark size={17} strokeWidth={1.5} />} right={<LinkBtn href={`${base}/resources`}>See all</LinkBtn>}>Cabinet Resources</CardTitle>
      {!loaded ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={18} w="50%" /><Skeleton h={40} /></div>
        : withRes.length === 0 ? <EmptyLine>No cabinet resources yet.</EmptyLine>
        : (
          <div style={{ display: 'grid', gap: '8px 16px', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            {withRes.map((cab) => {
              const rows = (byCab.get(cab.id) ?? []).filter((r) => typeById.get(r.type_id)?.scope === 'cabinet')
                .sort((a, b) => (typeById.get(a.type_id)?.sort ?? 0) - (typeById.get(b.type_id)?.sort ?? 0));
              const shown = rows.slice(0, PER_CABINET);
              return (
                <div key={cab.id} style={{ minWidth: 0 }}>
                  <h3 className="flex items-center" style={{ margin: '0 0 4px', gap: 7, fontSize: 12.5, fontWeight: 800, color: cab.color, overflowWrap: 'anywhere' }}>
                    <i aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: cab.color, display: 'inline-block', flex: 'none' }} />
                    {cab.name}
                    {rows.length > shown.length && <Link href={`${base}/resources`} style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: CK.forest, textDecoration: 'underline', whiteSpace: 'nowrap' }}>See all {rows.length}</Link>}
                  </h3>
                  <div style={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                    {shown.map((r) => {
                      const t = typeById.get(r.type_id);
                      const ch = changes.get(r.id);
                      return (
                        <div key={r.id} className="flex items-center" style={{ background: CK.well, borderRadius: 10, padding: '5px 8px', minWidth: 0, gap: 6 }}>
                          <span aria-hidden style={{ color: cab.color, lineHeight: 0, flex: 'none' }}>{resourceIcon(t?.name ?? '', 15)}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere', lineHeight: 1.2 }}>{t?.name ?? 'Resource'}</span>
                          <b style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: CK.ink, whiteSpace: 'nowrap' }}>
                            {formatAmount(r.amount)}
                            {ch ? <small style={{ marginLeft: 4, fontSize: 11, fontWeight: 700, color: ch > 0 ? CK.ok : CK.danger }}>{ch > 0 ? '+' : ''}{formatAmount(ch)}</small> : null}
                          </b>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </Card>
  );
}

// ─────────── Latest news ───────────

export function NewsCard({ news, cabinets, members, base, now }: { news: News[] | null; cabinets: Cabinet[]; members: Member[]; base: string; now: number }) {
  const latest = useMemo(
    () => (news ?? []).filter((n) => n.status === 'published' && n.published_at)
      .sort((a, b) => new Date(b.published_at as string).getTime() - new Date(a.published_at as string).getTime()).slice(0, 4),
    [news],
  );
  return (
    <Card className="cmd-card">
      <CardTitle icon={<RadioTower size={17} strokeWidth={1.5} />} right={<LinkBtn href={`${base}/news`}>Open news</LinkBtn>}>News</CardTitle>
      {news === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={30} /><Skeleton h={30} /></div>
        : latest.length === 0 ? <EmptyLine>Nothing has been published yet.</EmptyLine>
        : latest.map((n, i) => {
          const aud = n.audience_cabinet_id ? cabinets.find((c) => c.id === n.audience_cabinet_id)?.name ?? 'One room' : 'Every room';
          const by = members.find((m) => m.id === n.published_by)?.display_name;
          return (
            <div key={n.id} className="flex" style={{ gap: 10, padding: '4px 0', borderTop: i === 0 ? 0 : `1px solid ${CK.hair}` }}>
              <span title={new Date(n.published_at as string).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} style={{ flex: 'none', minWidth: 62, fontSize: 11.5, fontWeight: 800, color: CK.red }}>{ago(n.published_at, now)}</span>
              <div style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</b>
                <span style={{ display: 'block', fontSize: 11.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{aud}{by ? ` · ${by}` : ''}</span>
              </div>
            </div>
          );
        })}
    </Card>
  );
}
