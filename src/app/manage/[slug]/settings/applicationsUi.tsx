'use client';

/**
 * The Applications settings surface, factored out of the 5k-line settings page.
 *
 * Everything here is presentation: the page still owns every piece of state and
 * every write. Components live at module scope on purpose — one declared inside
 * the page would be a brand-new component type on every render, remounting the
 * question builder and losing its editing state (the same trap StepHeader
 * documents).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check, ChevronDown, Info, X, ArrowRight, ArrowLeft, Copy, Sparkles,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { NEU, Emoji3D } from '@/components/neu';

const OUTFIT = "'Outfit', sans-serif";

// ── Roles ──────────────────────────────────────────────────────────────────
// Order is deliberate and matches how a conference is actually staffed: the
// delegations come first (head delegates bring the delegates), then the adults
// who travel with them, then the people watching, then the team you recruit
// separately. Chair is last because chair applications run on their own
// timeline and are never the first thing an organiser sets up.

export const ROLE_ORDER = ['head-delegate', 'delegate', 'faculty-advisor', 'observer', 'chair'] as const;
export type RoleKey = (typeof ROLE_ORDER)[number];

/** Fluent 3D emoji per role. Every one of these asset paths is verified to
 *  exist; Emoji3D falls back to a lucide glyph if the CDN is unreachable. */
export const ROLE_EMOJI: Record<string, string> = {
  'head-delegate': 'Crown',
  'delegate': 'Bust in silhouette',
  'faculty-advisor': 'Graduation cap',
  'observer': 'Eyes',
  'chair': 'Hammer',
};

export const ROLE_BLURB: Record<string, string> = {
  'head-delegate':
    'The student who leads a delegation. They register their school or society, invite their own delegates, hold the delegation’s allocations, and are usually the person you invoice. Open this first, because a head delegate with nowhere to apply cannot bring anyone with them.',
  'delegate':
    'The individual applying to represent a country in a committee. This is the role most of your applicants use, and the one whose form, fee and preference questions do the most work.',
  'faculty-advisor':
    'The teacher or staff member accompanying a school delegation. They do not debate; they supervise, and they normally need a different fee and a much shorter form than the students they travel with.',
  'observer':
    'Someone attending without a seat in a committee: press, a visiting academic, a guest from a partner conference. They see the schedule and the venue, but never appear in an allocation.',
  'chair':
    'The people you recruit to run committees. Chair applications usually open on their own timeline, close earlier than delegate applications, and ask completely different questions, which is why the role has its own everything.',
};

export function roleLabel(role: string): string {
  return role.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export type RoleStatus = 'OPEN' | 'SCHEDULED' | 'CLOSED' | 'OFF';

export const STATUS_STYLE: Record<RoleStatus, { fg: string; bg: string; dot: string }> = {
  OPEN:      { fg: '#EED98A', bg: '#1B3828',                dot: '#3D7A52' },
  SCHEDULED: { fg: '#6B4F12', bg: 'rgba(238,217,138,0.35)', dot: '#B6871F' },
  CLOSED:    { fg: '#8B2020', bg: 'rgba(139,32,32,0.08)',   dot: '#8B2020' },
  OFF:       { fg: '#9A8A78', bg: 'rgba(154,138,120,0.12)', dot: '#9A8A78' },
};

// ── InfoHint ───────────────────────────────────────────────────────────────

/**
 * Hover-revealed explainer. AGENTS.md UI RULE: informational "i" affordances
 * open on HOVER, never on click — click-to-toggle is reserved for menus and
 * actions. Focus reveals it too, so it is keyboard reachable.
 *
 * Portaled at fixed viewport coordinates measured from the trigger and
 * edge-flipped, per the anti-clipping rule: this sits inside a scrollable panel
 * and would otherwise be cut off by an ancestor's overflow.
 */
export function InfoHint({ label, text, size = 16 }: { label: string; text: string; size?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 20);
    const left = Math.max(10, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 10));
    // Rough height for a three-line paragraph; flip above when tight below.
    const below = window.innerHeight - r.bottom;
    const top = below < 150 ? Math.max(10, r.top - 142) : r.bottom + 8;
    setPos({ top, left, width });
  }, []);

  useEffect(() => {
    if (!pos) return;
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [pos, place]);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="img"
        aria-label={label}
        title={text}
        onMouseEnter={() => place()}
        onMouseLeave={() => setPos(null)}
        onFocus={() => place()}
        onBlur={() => setPos(null)}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); } }}
        className="inline-flex items-center justify-center rounded-full flex-shrink-0 align-middle"
        style={{
          width: size, height: size, backgroundColor: NEU.surface, boxShadow: NEU.inSm,
          color: NEU.inkSoft, cursor: 'help',
        }}
      >
        <Info size={size * 0.62} strokeWidth={2.8} />
      </span>
      {pos && (
        <Portal>
          <div
            role="tooltip"
            className="fixed z-50"
            style={{
              top: pos.top, left: pos.left, width: pos.width,
              padding: '12px 14px', borderRadius: 14,
              backgroundColor: NEU.surface, boxShadow: NEU.out,
              fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 500, lineHeight: 1.55,
              color: NEU.inkSoft, pointerEvents: 'none',
            }}
          >
            {text}
          </div>
        </Portal>
      )}
    </>
  );
}
// ── Step disc ──────────────────────────────────────────────────────────────

/**
 * The numbered disc on a step header. Extruded neumorphic while the step is
 * outstanding — it should read as a physical button waiting to be pressed —
 * and pressed-in forest once it is done, so a finished step visibly sinks into
 * the card instead of just changing colour.
 */
export function StepDisc({ n, complete, size = 34 }: { n: number; complete: boolean; size?: number }) {
  return (
    <span
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '999px',
        background: complete
          ? 'linear-gradient(145deg, #16301F, #2E6040)'
          : `linear-gradient(145deg, #F6F2E7, ${NEU.base})`,
        boxShadow: complete
          ? 'inset 2px 2px 5px rgba(0,0,0,0.35), inset -2px -2px 5px rgba(255,255,255,0.12), 0 2px 6px rgba(27,56,40,0.22)'
          : NEU.outSm,
        color: complete ? NEU.gold : NEU.ink,
        fontFamily: OUTFIT, fontSize: size * 0.4, fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        transition: 'box-shadow 240ms cubic-bezier(0.22,1,0.36,1), background 240ms',
      }}
    >
      {complete ? <Check size={size * 0.44} strokeWidth={3.2} style={{ color: NEU.gold }} /> : n}
    </span>
  );
}
// ── Role bookmarks ─────────────────────────────────────────────────────────

/**
 * Bookmark tabs across the top of the panel: a 3D role emoji above the role
 * name, the active one raised and joined to the content below it by a flat
 * bottom edge. The status dot answers the only question that matters at a
 * glance — is this role taking applications right now.
 */
export function RoleBookmarks({ roles, active, statusOf, onPick }: {
  roles: readonly string[];
  active: string;
  statusOf: (role: string) => RoleStatus;
  onPick: (role: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Application roles"
      className="grid items-end"
      style={{ gridTemplateColumns: `repeat(${roles.length}, minmax(0, 1fr))`, gap: 6, paddingTop: 4 }}
    >
      {roles.map(role => {
        const on = role === active;
        const st = statusOf(role);
        // Open versus everything else, said by the whole tab rather than by a
        // 6px dot: a closed role is dimmed and its name goes muted. Selection
        // sits on top of that, so a dimmed role you are editing still reads as
        // the one you are editing.
        const open = st === 'OPEN';
        const rest = open ? 1 : 0.55;
        return (
          <button
            key={role}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onPick(role)}
            title={ROLE_BLURB[role]}
            className="flex flex-col items-center w-full min-w-0 focus:outline-none"
            style={{
              padding: on ? '11px 12px 14px' : '9px 12px 11px',
              // Bookmark: rounded at the top, square at the bottom, so the
              // active tab reads as part of the panel it opens.
              borderRadius: '16px 16px 4px 4px',
              background: on
                ? 'linear-gradient(160deg, #F6F2E7, #E7E0CE)'
                : 'transparent',
              boxShadow: on
                ? '-4px -4px 10px rgba(255,255,255,0.9), 5px 4px 14px rgba(27,56,40,0.16)'
                : 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: on ? 1 : rest,
              transform: on ? 'translateY(0)' : 'translateY(3px)',
              transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms, opacity 180ms',
            }}
            onMouseEnter={(e) => { if (!on) { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; } }}
            onMouseLeave={(e) => { if (!on) { (e.currentTarget as HTMLElement).style.opacity = String(rest); (e.currentTarget as HTMLElement).style.transform = 'translateY(3px)'; } }}
          >
            {/* Icon above the name, seated on its own disc so the emoji has
                somewhere to cast a shadow. */}
            <span
              className="flex items-center justify-center"
              style={{
                width: 38, height: 38, borderRadius: '999px', marginBottom: 7,
                background: on ? 'linear-gradient(145deg, #FFFDF9, #E4DCCB)' : 'transparent',
                boxShadow: on ? NEU.outSm : 'none',
                transition: 'box-shadow 220ms',
              }}
            >
              <Emoji3D name={ROLE_EMOJI[role] ?? 'Bust in silhouette'} size={on ? 24 : 21} />
            </span>
            <span
              className="flex items-center"
              style={{ gap: 5, fontFamily: OUTFIT, fontSize: 11, fontWeight: on ? 800 : 700, letterSpacing: '0.04em', color: on ? NEU.ink : open ? NEU.forest : NEU.muted, minWidth: 0 }}
            >
              <span
                suppressHydrationWarning
                aria-hidden
                style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0, backgroundColor: STATUS_STYLE[st].dot, opacity: open ? 1 : 0.6 }}
              />
              <span className="truncate">{roleLabel(role)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────

/** Centred sheet used by every pop-up on this surface. */
export function SettingsModal({ open, onClose, title, sub, icon, width = 520, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  /** Fluent emoji name for the header disc. */
  icon?: string;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 10000, backgroundColor: 'rgba(20,36,27,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className="w-full overflow-y-auto"
          style={{
            maxWidth: width, maxHeight: '86vh',
            backgroundColor: '#FAF8F3', borderRadius: 22,
            border: '1.5px solid #D8CDB6',
            boxShadow: '0 30px 80px rgba(27,56,40,0.28)',
          }}
        >
          <div className="flex items-start gap-3 px-6 pt-6 pb-4">
            {icon && (
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(145deg, #F6F2E7, ${NEU.base})`, boxShadow: NEU.outSm }}
              >
                <Emoji3D name={icon} size={24} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 18, color: NEU.ink, margin: 0, lineHeight: 1.2 }}>{title}</h3>
              {sub && <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, margin: '5px 0 0', lineHeight: 1.5 }}>{sub}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center flex-shrink-0 rounded-full focus:outline-none"
              style={{ width: 30, height: 30, background: 'transparent', border: 'none', color: NEU.muted, cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <X size={17} strokeWidth={2.4} />
            </button>
          </div>
          <div className="px-6 pb-5">{children}</div>
          {footer && (
            <div className="px-6 py-4 flex items-center justify-end gap-2.5" style={{ borderTop: '1.5px solid rgba(216,205,182,0.8)' }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

export function ModalButton({ children, onClick, tone = 'ghost', disabled, icon: Icon }: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'ghost' | 'forest';
  disabled?: boolean;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  const forest = tone === 'forest';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl focus:outline-none"
      style={{
        padding: '10px 18px',
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.07em',
        backgroundColor: forest ? '#1B3828' : 'transparent',
        color: forest ? NEU.gold : NEU.inkSoft,
        border: forest ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background-color 150ms',
      }}
      onMouseEnter={(e) => { if (!disabled && !forest) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; if (!disabled && forest) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = forest ? '#1B3828' : 'transparent'; }}
    >
      {Icon && <Icon size={14} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

// ── "Also apply this to…" role picker ──────────────────────────────────────

/**
 * Offered after a fee phase is saved, and again whenever another is added: a
 * phase that exists for delegates almost always exists for head delegates and
 * advisors too, and re-typing the same two dates five times is the single most
 * tedious thing about setting a conference up.
 */
export function CopyToRolesModal(props: {
  open: boolean;
  onClose: () => void;
  onConfirm: (roles: string[]) => void;
  title: string;
  sub: string;
  /** Every role except the one the change was made on. */
  roles: string[];
  busy?: boolean;
}) {
  // Keyed on `open` so each opening is a fresh mount: reopening the sheet must
  // never remember last time's ticks, and remounting says that without a
  // setState-in-effect.
  return props.open ? <CopyToRolesSheet key="open" {...props} /> : null;
}

function CopyToRolesSheet({
  open, onClose, onConfirm, title, sub, roles, busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (roles: string[]) => void;
  title: string;
  sub: string;
  /** Every role except the one the change was made on. */
  roles: string[];
  busy?: boolean;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (r: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(r)) next.delete(r); else next.add(r);
    return next;
  });

  return (
    <SettingsModal
      open={open}
      onClose={onClose}
      title={title}
      sub={sub}
      icon="Card index dividers"
      footer={
        <>
          <ModalButton onClick={onClose}>NOT NOW</ModalButton>
          <ModalButton
            tone="forest"
            icon={Copy}
            disabled={picked.size === 0 || busy}
            onClick={() => onConfirm([...picked])}
          >
            {busy
              ? 'COPYING…'
              : picked.size === 0
                ? 'COPY'
                : `COPY TO ${picked.size} ${picked.size === 1 ? 'ROLE' : 'ROLES'}`}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col" style={{ gap: 8 }}>
        {roles.map(r => {
          const on = picked.has(r);
          return (
            <button
              key={r}
              type="button"
              onClick={() => toggle(r)}
              className="w-full flex items-center text-left focus:outline-none"
              style={{
                gap: 12, padding: '11px 14px', borderRadius: 14,
                backgroundColor: on ? 'rgba(27,56,40,0.07)' : 'transparent',
                border: on ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                cursor: 'pointer',
              }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: on ? '#1B3828' : 'transparent', border: on ? 'none' : '1.5px solid #CFC6B4' }}
              >
                {on && <Check size={13} strokeWidth={3.2} style={{ color: NEU.gold }} />}
              </span>
              <Emoji3D name={ROLE_EMOJI[r] ?? 'Bust in silhouette'} size={22} />
              <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink }}>{roleLabel(r)}</span>
            </button>
          );
        })}
      </div>
    </SettingsModal>
  );
}

// ── First-run guided setup ─────────────────────────────────────────────────

export interface SetupSlide {
  key: string;
  title: string;
  /** One paragraph, plain language. Shown beside the image. */
  body: string;
  image: string;
  emoji: string;
}

/** What a role's three steps actually decide, said once, with a picture. */
export const SETUP_SLIDES: SetupSlide[] = [
  {
    key: 'window',
    title: 'When the doors open',
    body:
      'Every role has its own window. Pick the day and the hour applications open, the day and hour they close, and how many people you will take. Nothing is public before the opening time, and the moment it passes the application link starts working on its own, so you do not have to be at a keyboard.',
    image: '/onboarding/hall-01.jpg',
    emoji: 'Spiral calendar',
  },
  {
    key: 'money',
    title: 'What it costs, and when',
    body:
      'Set one price, then add phases if the price moves: an early-bird window, a standard window, a late window. Whichever phase covers today is the price an applicant sees. Choose whether they pay as soon as they apply, only once you accept them, or whenever they like.',
    image: '/onboarding/handshake-01.jpg',
    emoji: 'Money bag',
  },
  {
    key: 'form',
    title: 'What you ask them',
    body:
      'Build the form this role fills in. Short answers, long answers, choices, uploads, and for delegates the committee and country preferences your allocation runs on. Different roles ask different things, which is exactly why each one has its own form.',
    image: '/onboarding/classroom-01.jpg',
    emoji: 'Memo',
  },
];

/**
 * Shown the first time a role is opened for setup: three slides that say what
 * the three steps decide, with a picture on each, before dropping the organiser
 * into step one. Skippable, and never shown again for that role once dismissed.
 */
export function SetupIntro({ role, slides = SETUP_SLIDES, onDone }: {
  role: string;
  slides?: SetupSlide[];
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const last = i === slides.length - 1;

  return (
    <div
      style={{
        backgroundColor: '#FFFDF9', border: '1.5px solid #D8CDB6', borderRadius: 20,
        overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 2px rgba(27,56,40,0.04)',
      }}
    >
      {/* Picture band. Forest scrim so the eyebrow reads on any photo. */}
      <div style={{ position: 'relative', height: 168, backgroundColor: '#14241B' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={slide.image}
          src={slide.image}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.62 }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,36,27,0.55) 0%, rgba(20,36,27,0.2) 45%, rgba(20,36,27,0.8) 100%)' }} />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-5 pb-4">
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(250,248,243,0.92)', boxShadow: '0 6px 18px rgba(0,0,0,0.3)' }}
          >
            <Emoji3D name={slide.emoji} size={26} />
          </span>
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: 'rgba(238,217,138,0.9)', margin: '0 0 3px' }}>
              SETTING UP {roleLabel(role).toUpperCase()} · STEP {i + 1} OF {slides.length}
            </p>
            <h3 style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, color: '#FFFDF9', margin: 0, lineHeight: 1.15 }}>
              {slide.title}
            </h3>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <p style={{ fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.65, color: NEU.inkSoft, margin: 0 }}>
          {slide.body}
        </p>

        <div className="flex items-center mt-4" style={{ gap: 10 }}>
          {/* Progress dots */}
          <div className="flex items-center" style={{ gap: 6 }}>
            {slides.map((s, n) => (
              <span
                key={s.key}
                aria-hidden
                style={{
                  width: n === i ? 18 : 7, height: 7, borderRadius: 999,
                  backgroundColor: n === i ? '#1B3828' : 'rgba(154,138,120,0.4)',
                  transition: 'width 240ms cubic-bezier(0.22,1,0.36,1), background-color 240ms',
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onDone}
            className="ml-auto focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.ink; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
          >
            Skip, I know this
          </button>

          {i > 0 && (
            <ModalButton onClick={() => setI(i - 1)} icon={ArrowLeft}>BACK</ModalButton>
          )}
          <ModalButton
            tone="forest"
            icon={last ? Sparkles : ArrowRight}
            onClick={() => (last ? onDone() : setI(i + 1))}
          >
            {last ? "LET'S SET IT UP" : 'NEXT'}
          </ModalButton>
        </div>
      </div>
    </div>
  );
}

// ── Segmented choice ───────────────────────────────────────────────────────

/**
 * The forest-filled segmented control this surface uses for every either/or.
 * `mixed` renders the "roles disagree" state the General page needs: nothing is
 * selected, and the control says so rather than lying about one of the options.
 */
export function Segmented<T extends string | boolean>({
  options, value, onChange, mixed = false, disabled = false, columns,
}: {
  options: { value: T; label: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
  mixed?: boolean;
  disabled?: boolean;
  /** Force a grid instead of an even row (long labels wrap badly in a row). */
  columns?: number;
}) {
  return (
    <div
      className={columns ? 'grid' : 'flex'}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 } : { gap: 8 }}
    >
      {options.map(opt => {
        const active = !mixed && value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`${columns ? '' : 'flex-1'} rounded-xl focus:outline-none`}
            style={{
              padding: '10px 12px',
              backgroundColor: active ? '#1B3828' : 'transparent',
              color: active ? NEU.gold : NEU.ink,
              border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
              boxShadow: active ? '0 4px 12px rgba(27,56,40,0.2)' : 'none',
              fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.05em',
              opacity: disabled ? 0.55 : 1,
              cursor: disabled ? 'wait' : 'pointer',
              transition: 'background-color 150ms, box-shadow 200ms',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** The caption under a Segmented: the chosen option's explanation, or the
 *  "these roles disagree" line when there is no single answer. */
export function SegmentedNote({ mixed, text }: { mixed: boolean; text?: string }) {
  if (mixed) {
    return (
      <p className="text-xs mt-1.5 inline-flex items-center gap-1.5" style={{ color: '#8A6614', fontFamily: OUTFIT }}>
        <ChevronDown size={12} strokeWidth={2.6} style={{ transform: 'rotate(-90deg)' }} />
        Your roles do not all agree on this. Choosing an option here sets it for every role at once.
      </p>
    );
  }
  return text ? <p className="text-xs mt-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{text}</p> : null;
}
