'use client';

// ─────────────────────────────────────────────────────────────────────────────
// portalUi.tsx: the delegation portal's visual kit.
//
// Flat ivory panels on hairline borders and tinted backdrops (no white halo
// shadows), plain-typography counts (no count pills), statuses as a Lucide icon
// plus a plain word, round flags through CircleFlag. Mobile first: every row
// wraps, nothing has a fixed width wider than a phone.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import {
  Armchair, BadgeCheck, CircleCheck, Clock, Crown, GraduationCap, MoreHorizontal, User, XCircle,
  CircleDollarSign, HandCoins, CircleDashed, CircleSlash, type LucideProps,
} from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { LogoDisc } from '@/components/LogoDisc';
import {
  committeeDisplay, committeeMonogram, roleWord,
  type InvoiceState, type PortalCommittee, type PortalMember,
} from './portalModel';

export const DANGER = '#8B2020';
export const WARN = '#8A5A1E';

type Icon = ComponentType<LucideProps>;

// ── Panels ───────────────────────────────────────────────────────────────────

export function Panel({ children, style, tone = 'surface', id }: {
  children: ReactNode; style?: CSSProperties; tone?: 'surface' | 'wash' | 'gold'; id?: string;
}) {
  const bg = tone === 'wash' ? NEU.wash : tone === 'gold' ? NEU.goldWash : NEU.surface;
  return (
    <section
      id={id}
      style={{ backgroundColor: bg, border: NEU.hairline, borderRadius: 18, padding: '18px 18px', ...style }}
    >
      {children}
    </section>
  );
}

export function PanelTitle({ icon: I, title, aside, sub }: { icon?: Icon; title: string; aside?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 mb-3.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {I && <I size={18} strokeWidth={2.2} style={{ color: NEU.forest, flexShrink: 0 }} aria-hidden />}
        <div className="min-w-0">
          <h2 style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 800, color: NEU.ink, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{title}</h2>
          {sub && <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{sub}</p>}
        </div>
      </div>
      {aside && <div className="flex-shrink-0">{aside}</div>}
    </div>
  );
}

/** A count in plain typography: a big tabular numeral over a small word. */
export function BigNumber({ value, label, tone, note }: { value: ReactNode; label: string; tone?: 'ink' | 'danger' | 'forest' | 'soft'; note?: ReactNode }) {
  const color = tone === 'danger' ? DANGER : tone === 'forest' ? NEU.forest : tone === 'soft' ? NEU.inkSoft : NEU.ink;
  return (
    <div className="min-w-0">
      <p style={{ fontFamily: OUTFIT, fontSize: 28, fontWeight: 800, lineHeight: 1.05, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {value}
      </p>
      <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: NEU.inkSoft, marginTop: 4 }}>{label}</p>
      {note && <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 2 }}>{note}</p>}
    </div>
  );
}

export function Divider() {
  return <div style={{ borderTop: NEU.hairline, margin: '14px 0' }} />;
}

// ── Marks: icon + plain word ────────────────────────────────────────────────

function Mark({ icon: I, text, color, title }: { icon: Icon; text: string; color: string; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0" title={title} style={{ color, fontFamily: OUTFIT, fontSize: 13, fontWeight: 600 }}>
      <I size={15} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
      <span className="truncate">{text}</span>
    </span>
  );
}

export function RoleMark({ member }: { member: Pick<PortalMember, 'role' | 'is_head_delegate'> }) {
  const head = member.role === 'head-delegate' || member.is_head_delegate;
  if (head) return <Mark icon={Crown} text="Head delegate" color={NEU.deepGold} />;
  if (member.role === 'faculty-advisor') return <Mark icon={GraduationCap} text="Faculty advisor" color={NEU.forest} />;
  return <Mark icon={User} text={roleWord(member.role)} color={NEU.inkSoft} />;
}

export function StatusMark({ status, registered = true }: { status: string; registered?: boolean }) {
  if (!registered && (status === 'accepted' || status === 'submitted')) {
    return <Mark icon={CircleDashed} text="No account yet" color={WARN} title="Imported or invited by the organiser. They have not created their account yet." />;
  }
  switch (status) {
    case 'submitted': return <Mark icon={Clock} text="Waiting for review" color={WARN} />;
    case 'accepted': return <Mark icon={CircleCheck} text="Accepted" color={NEU.forest} />;
    case 'assigned': return <Mark icon={Armchair} text="Seated" color={NEU.forest} />;
    case 'checked-in': return <Mark icon={BadgeCheck} text="Checked in" color={NEU.forest} />;
    case 'rejected': return <Mark icon={XCircle} text="Not accepted" color={DANGER} />;
    default: return <Mark icon={CircleDashed} text={status} color={NEU.inkSoft} />;
  }
}

export function InvoiceMark({ state }: { state: InvoiceState }) {
  switch (state) {
    case 'paid': return <Mark icon={CircleCheck} text="Paid" color={NEU.forest} />;
    case 'part': return <Mark icon={CircleDollarSign} text="Part paid" color={WARN} />;
    case 'covered': return <Mark icon={HandCoins} text="Covered by delegation" color={NEU.forest} />;
    case 'waived': return <Mark icon={CircleSlash} text="Waived" color={NEU.inkSoft} />;
    default: return <Mark icon={Clock} text="Unpaid" color={DANGER} />;
  }
}

/** Committee acronym + round flag + country, or "No seat yet". */
export function SeatMark({ committee, countryName, countryCode, size = 22 }: {
  committee: PortalCommittee | null | undefined; countryName: string | null; countryCode?: string | null; size?: number;
}) {
  if (!countryName) {
    return <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>No seat yet</span>;
  }
  const { primary } = committeeDisplay(committee);
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <CircleFlag code={countryCode} country={countryName} size={size} decorative />
      <span className="min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink }}>
        <span style={{ fontWeight: 700 }}>{countryName}</span>
        {committee && <span style={{ color: NEU.inkSoft }}> · {primary}</span>}
      </span>
    </span>
  );
}

export function CommitteeHeading({ committee, aside }: { committee: PortalCommittee | null; aside?: ReactNode }) {
  const { primary, secondary } = committeeDisplay(committee);
  return (
    <div className="flex items-center gap-3 min-w-0">
      <LogoDisc src={committee?.logo_url} size={40} fallbackText={committeeMonogram(committee)} alt={primary} style={{ boxShadow: 'none', border: NEU.hairline }} />
      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 800, color: NEU.ink, letterSpacing: '-0.01em' }}>{primary}</p>
        {secondary && <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 1 }}>{secondary}</p>}
      </div>
      {aside}
    </div>
  );
}

// ── Avatar ──────────────────────────────────────────────────────────────────

export function PersonAvatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  const initial = (name?.trim()?.charAt(0) ?? '?').toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" aria-hidden className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size, border: NEU.hairline }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, fontWeight: 700, fontSize: Math.round(size * 0.42), lineHeight: 1 }}
    >
      {initial}
    </span>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

export function PrimaryButton({ children, onClick, disabled, icon: I, href, style }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; icon?: Icon; href?: string; style?: CSSProperties;
}) {
  const s: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
    backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700,
    border: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, textDecoration: 'none',
    whiteSpace: 'nowrap', ...style,
  };
  if (href) return <a href={href} className="focus:outline-none focus-visible:ring-2" style={s}>{I && <I size={16} strokeWidth={2.3} aria-hidden />}{children}</a>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="focus:outline-none focus-visible:ring-2" style={s}>
      {I && <I size={16} strokeWidth={2.3} aria-hidden />}{children}
    </button>
  );
}

export function QuietButton({ children, onClick, disabled, icon: I, title, danger, style, ariaLabel }: {
  children?: ReactNode; onClick?: () => void; disabled?: boolean; icon?: Icon; title?: string; danger?: boolean; style?: CSSProperties; ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className="focus:outline-none focus-visible:ring-2"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: children ? '8px 12px' : 0,
        width: children ? undefined : 34, height: children ? undefined : 34,
        borderRadius: 10, backgroundColor: NEU.surface, border: NEU.hairline,
        color: danger ? DANGER : NEU.forest, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', ...style,
      }}
    >
      {I && <I size={15} strokeWidth={2.3} aria-hidden />}{children}
    </button>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export interface TabDef<K extends string> { key: K; label: string; icon: Icon }

export function TabBar<K extends string>({ tabs, active, onChange }: { tabs: TabDef<K>[]; active: K; onChange: (k: K) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) { e.preventDefault(); onChange(tabs[next].key); refs.current[next]?.focus(); }
  };
  return (
    <div
      role="tablist"
      aria-label="Delegation portal sections"
      className="flex gap-1 overflow-x-auto"
      style={{ borderBottom: NEU.hairline, scrollbarWidth: 'none' }}
    >
      {tabs.map((t, i) => {
        const on = t.key === active;
        const I = t.icon;
        return (
          <button
            key={t.key}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`dp-tab-${t.key}`}
            aria-selected={on}
            aria-controls={`dp-panel-${t.key}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKey(e, i)}
            className="focus:outline-none focus-visible:ring-2 inline-flex items-center gap-2 flex-shrink-0"
            style={{
              padding: '12px 14px 11px', marginBottom: -1, border: 'none', background: 'transparent', cursor: 'pointer',
              borderBottom: on ? `2.5px solid ${NEU.forest}` : '2.5px solid transparent',
              color: on ? NEU.ink : NEU.inkSoft, fontFamily: OUTFIT, fontSize: 14, fontWeight: on ? 800 : 600,
            }}
          >
            <I size={16} strokeWidth={2.2} aria-hidden style={{ color: on ? NEU.forest : 'currentColor' }} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── A row's action menu (portaled, edge-flipped) ────────────────────────────

export interface MenuAction {
  key: string;
  label: string;
  icon: Icon;
  onSelect: () => void;
  disabled?: boolean;
  /** Why it is disabled, said under the label. */
  note?: string;
  danger?: boolean;
}

export function RowMenu({ actions, label }: { actions: MenuAction[]; label: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const W = 288;

  const place = useCallback(() => {
    const b = btn.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const h = menu.current?.offsetHeight ?? 60 + actions.length * 56;
    const below = window.innerHeight - r.bottom;
    const flip = below < h + 12 && r.top > below;
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    setPos({ top: flip ? Math.max(8, r.top - h - 6) : r.bottom + 6, left });
  }, [actions.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btn.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const raf = requestAnimationFrame(place);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      cancelAnimationFrame(raf);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { if (!open) place(); setOpen((o) => !o); }}
        className="focus:outline-none focus-visible:ring-2 inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 36, height: 36, borderRadius: 10, border: NEU.hairline, backgroundColor: NEU.surface, color: NEU.forest, cursor: 'pointer' }}
      >
        <MoreHorizontal size={18} strokeWidth={2.3} aria-hidden />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={menu}
            role="menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: W, zIndex: 9999, backgroundColor: NEU.surface, border: NEU.hairline, borderRadius: 14, padding: 6, boxShadow: '0 12px 28px -12px rgba(27,56,40,0.28)' }}
          >
            {actions.map((a) => {
              const I = a.icon;
              return (
                <button
                  key={a.key}
                  role="menuitem"
                  type="button"
                  disabled={a.disabled}
                  onClick={() => { setOpen(false); a.onSelect(); }}
                  className="w-full text-left flex items-start gap-2.5 focus:outline-none focus-visible:ring-2"
                  style={{ padding: '9px 10px', borderRadius: 10, border: 'none', background: 'transparent', cursor: a.disabled ? 'default' : 'pointer', opacity: a.disabled ? 0.55 : 1 }}
                  onMouseEnter={(e) => { if (!a.disabled) e.currentTarget.style.backgroundColor = NEU.wash; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <I size={17} strokeWidth={2.2} aria-hidden style={{ color: a.danger ? DANGER : NEU.forest, marginTop: 1, flexShrink: 0 }} />
                  <span className="min-w-0">
                    <span className="block" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: a.danger ? DANGER : NEU.ink }}>{a.label}</span>
                    {a.note && <span className="block" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 2, lineHeight: 1.4 }}>{a.note}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </>
  );
}

/** A short notice line (success or error), with an icon. */
export function Notice({ tone, children, onClose }: { tone: 'ok' | 'error'; children: ReactNode; onClose?: () => void }) {
  const color = tone === 'ok' ? NEU.forest : DANGER;
  const I = tone === 'ok' ? CircleCheck : XCircle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="flex items-start gap-2.5" style={{ padding: '11px 14px', borderRadius: 12, backgroundColor: tone === 'ok' ? NEU.wash : 'rgba(139,32,32,0.06)', border: `1px solid ${tone === 'ok' ? 'rgba(27,56,40,0.14)' : 'rgba(139,32,32,0.18)'}` }}>
      <I size={17} strokeWidth={2.2} aria-hidden style={{ color, flexShrink: 0, marginTop: 1 }} />
      <p className="flex-1" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink, lineHeight: 1.45 }}>{children}</p>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="focus:outline-none focus-visible:ring-2" style={{ border: 'none', background: 'transparent', color: NEU.inkSoft, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}
