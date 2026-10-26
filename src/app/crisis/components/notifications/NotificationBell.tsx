'use client';
// Gavelling Crisis: the notification bell in the top bar. The database writes one row per person
// (docs/crisis/sql/011); this lists them, marks them read and shows a short live pop-up for a new one.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, Swords, Ship, Eye, Flag, CheckCircle2, XCircle, HelpCircle, ScrollText, MessageCircle, Newspaper,
  CalendarClock, Skull, UserX, User, X,
} from 'lucide-react';
import Portal from '@/components/Portal';
import type { CrisisNotification } from '@/lib/crisis/types';
import { crisisError, listNotifications, markNotificationsRead } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CK } from '../../crisisKit';

const POPUP_MS = 6000;
const MAX_POPUPS = 3;

function kindIcon(n: CrisisNotification): { icon: ReactNode; color: string } {
  const p = { size: 18, strokeWidth: 1.5 };
  const t = n.title.toLowerCase();
  switch (n.kind) {
    case 'unit': return /ship|fleet|navy|naval|sail|flotilla/.test(t) ? { icon: <Ship {...p} />, color: CK.red } : { icon: <Swords {...p} />, color: CK.red };
    case 'reveal': return { icon: <Eye {...p} />, color: CK.forest2 };
    case 'territory': return { icon: <Flag {...p} />, color: CK.goldDeep };
    case 'directive_answer':
      if (t.includes('approved')) return { icon: <CheckCircle2 {...p} />, color: CK.ok };
      if (t.includes('partly')) return { icon: <CheckCircle2 {...p} />, color: CK.goldMid };
      if (t.includes('denied')) return { icon: <XCircle {...p} />, color: CK.danger };
      if (t.includes('more detail')) return { icon: <HelpCircle {...p} />, color: '#2F6690' };
      return { icon: <ScrollText {...p} />, color: CK.inkSoft };
    case 'directive_new': return { icon: <ScrollText {...p} />, color: CK.red };
    case 'directive_note': return { icon: <MessageCircle {...p} />, color: '#2F6690' };
    case 'news': return { icon: <Newspaper {...p} />, color: CK.red2 };
    case 'meeting': return { icon: <CalendarClock {...p} />, color: CK.forest2 };
    case 'status':
      if (/dead|died|killed|assassinat/.test(t)) return { icon: <Skull {...p} />, color: CK.danger };
      if (/arrest|captur|detain|imprison/.test(t)) return { icon: <UserX {...p} />, color: CK.warn };
      return { icon: <User {...p} />, color: CK.inkSoft };
    default: return { icon: <Bell {...p} />, color: CK.inkSoft };
  }
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

const firstLine = (s: string | null) => (s ?? '').split('\n').find((l) => l.trim())?.trim() ?? '';

function IconDisc({ n }: { n: CrisisNotification }) {
  const { icon, color } = kindIcon(n);
  return <span className="flex-shrink-0 grid place-items-center" style={{ width: 34, height: 34, borderRadius: '50%', background: `${color}1f`, color }}>{icon}</span>;
}

export default function NotificationBell() {
  const v = useCrisis();
  const router = useRouter();
  const base = crisisBase(v.ref);
  const [items, setItems] = useState<CrisisNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [popups, setPopups] = useState<CrisisNotification[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listNotifications(v.ref);
      setError(null);
      setItems(rows);
      if (seen.current === null) { seen.current = new Set(rows.map((r) => r.id)); return; }
      const fresh = rows.filter((r) => !seen.current!.has(r.id));
      fresh.forEach((r) => seen.current!.add(r.id));
      const unreadFresh = fresh.filter((r) => !r.read_at);
      if (unreadFresh.length) setPopups((p) => [...unreadFresh, ...p].slice(0, MAX_POPUPS));
    } catch (e) { setError(crisisError(e, 'Could not load notifications.')); }
  }, [v.ref]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useCrisisLive(v.ref.id, ['crisis_notifications'], () => { void load(); });

  // Pop-ups leave on their own.
  useEffect(() => {
    if (!popups.length) return;
    const t = setTimeout(() => setPopups((p) => p.slice(0, -1)), POPUP_MS);
    return () => clearTimeout(t);
  }, [popups]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const unread = (items ?? []).filter((n) => !n.read_at).length;

  const markLocal = (ids: string[] | null) => {
    const stamp = new Date().toISOString();
    setItems((cur) => cur && cur.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: stamp } : n)));
  };
  const markAll = async () => {
    markLocal(null);
    try { await markNotificationsRead(v.ref); } catch (e) { setError(crisisError(e, 'Could not mark them read.')); void load(); }
  };
  const go = async (n: CrisisNotification) => {
    setOpen(false);
    setPopups((p) => p.filter((x) => x.id !== n.id));
    if (!n.read_at) {
      markLocal([n.id]);
      void markNotificationsRead(v.ref, [n.id]).catch(() => void load());
    }
    const link = (n.link ?? '').trim().replace(/^\/+/, '');
    const to = link === '' ? base : link.startsWith('?') ? `${base}${link}` : `${base}/${link}`;
    router.push(to);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setNow(Date.now()); setOpen((o) => !o); }}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424]"
        style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: open ? CK.well : 'transparent', color: CK.ink, cursor: 'pointer' }}
      >
        <Bell size={20} strokeWidth={1.5} />
        {unread > 0 && (
          <span aria-hidden style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#D63030', color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: '18px', textAlign: 'center', boxShadow: '0 0 0 2px #EFE3DA', boxSizing: 'border-box' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && pos && (
        <Portal>
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 70, width: 'min(380px, calc(100vw - 16px))', maxHeight: 'min(70vh, 560px)', display: 'flex', flexDirection: 'column', background: CK.card, borderRadius: 20, boxShadow: CK.shadow, fontFamily: CK.font, overflow: 'hidden' }}
          >
            <div className="flex items-center justify-between" style={{ padding: '14px 16px 10px', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: CK.ink }}>Notifications</h2>
              <button type="button" onClick={markAll} disabled={unread === 0} className="focus:outline-none focus-visible:underline" style={{ border: 'none', background: 'none', padding: 0, fontSize: 13, fontWeight: 700, textDecoration: 'underline', color: unread ? CK.red : CK.muted, cursor: unread ? 'pointer' : 'default' }}>
                Mark all read
              </button>
            </div>
            <div style={{ overflowY: 'auto', borderTop: `1px solid ${CK.hair}` }}>
              {items === null ? (
                <p style={{ margin: 0, padding: 16, fontSize: 14, color: CK.muted }}>{error ?? 'Loading'}</p>
              ) : items.length === 0 ? (
                <p style={{ margin: 0, padding: 16, fontSize: 14, color: CK.inkSoft }}>Nothing yet. News about your crisis will appear here.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void go(n)}
                    className="flex w-full text-left focus:outline-none focus-visible:bg-[rgba(142,36,36,0.1)]"
                    style={{ gap: 12, padding: '12px 16px', border: 'none', borderBottom: `1px solid ${CK.hair}`, background: n.read_at ? 'transparent' : 'rgba(142,36,36,0.07)', cursor: 'pointer', font: 'inherit' }}
                  >
                    <IconDisc n={n} />
                    <span className="min-w-0 flex-1">
                      <b style={{ display: 'block', fontSize: 14, fontWeight: n.read_at ? 600 : 800, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</b>
                      {firstLine(n.body) && (
                        <span title={n.body ?? undefined} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{firstLine(n.body)}</span>
                      )}
                      <span style={{ display: 'block', marginTop: 2, fontSize: 12, fontWeight: 600, color: CK.muted }}>{ago(n.created_at, now)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Portal>
      )}

      {popups.length > 0 && (
        <Portal>
          <div aria-live="polite" style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 64px)', right: 12, zIndex: 65, width: 'min(340px, calc(100vw - 24px))', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: CK.font }}>
            {popups.map((n) => (
              <div key={n.id} className="flex items-start" style={{ gap: 10, padding: '10px 10px 10px 12px', background: CK.card, borderRadius: 16, boxShadow: CK.shadow, animation: 'crisisBellIn 260ms cubic-bezier(0.22,1,0.36,1)' }}>
                <button type="button" onClick={() => void go(n)} className="flex flex-1 min-w-0 text-left focus:outline-none" style={{ gap: 10, border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>
                  <IconDisc n={n} />
                  <span className="min-w-0 flex-1">
                    <b style={{ display: 'block', fontSize: 14, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</b>
                    {firstLine(n.body) && <span title={n.body ?? undefined} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{firstLine(n.body)}</span>}
                  </span>
                </button>
                <button type="button" aria-label="Dismiss" onClick={() => setPopups((p) => p.filter((x) => x.id !== n.id))} className="focus:outline-none" style={{ border: 'none', background: 'none', padding: 2, color: CK.muted, cursor: 'pointer', lineHeight: 0 }}>
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
            <style>{'@keyframes crisisBellIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }'}</style>
          </div>
        </Portal>
      )}
    </>
  );
}
