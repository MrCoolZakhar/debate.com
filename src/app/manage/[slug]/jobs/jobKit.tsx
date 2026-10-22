'use client';

// ── The Job Board's card look (CLAUDE.md §8, 22 Oct 2026) ─────────────────
//
// The same look as the assignment seat board: white cards with a soft
// forest-tinted shadow, a gold top edge on the focus card (Your Listings),
// icons in style A (Lucide, fine line in bare ink, no tile), light secondary
// buttons with at most one solid forest button per view, counts as a big
// number with the word beside it. Presentation only: the page keeps its
// sections, order and behaviour.

import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { Gavel, Landmark, Users, type LucideIcon } from 'lucide-react';
import { JOB_ROLE_LABEL, type JobRole } from '@/lib/jobBoard';
import { InfoHint } from '../settings/applicationsUi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

/** Style A: fine line, bare ink. */
export const ICON_STROKE = 1.6;

// ── Colour and imagery (owner, 22 Oct 2026: "way too few things like colours,
// and some sort of images") ──────────────────────────────────────────────
//
// Each role type has its own calm accent (chair forest, secretariat gold,
// staff a muted blue), used on its photo's ring, a thin top edge on its row
// and its type word. Photos come only from public/ (CLAUDE.md §8 rule 15),
// with a solid ink plate behind any text on them, never a white fade.

export interface RoleTheme {
  /** The accent: rings, top edges, the type word's icon. */
  accent: string;
  /** Readable text in the accent's hue on white. */
  text: string;
  /** A very light wash of the accent. */
  wash: string;
  image: string;
  icon: LucideIcon;
  plural: string;
}

export const ROLE_THEME: Record<JobRole, RoleTheme> = {
  chair: { accent: '#2C5A40', text: '#1B3828', wash: 'rgba(27,56,40,0.07)', image: '/roles/chair-card.webp', icon: Gavel, plural: 'Chairs' },
  secretariat: { accent: '#C9A13E', text: '#7E5E12', wash: 'rgba(201,161,62,0.12)', image: '/roles/secretariat.webp', icon: Landmark, plural: 'Secretariat' },
  staff: { accent: '#4F7393', text: '#35546E', wash: 'rgba(79,115,147,0.10)', image: '/onboarding/handshake-01.jpg', icon: Users, plural: 'Staff' },
};

/** Status colours: clear, never loud. */
export const STATUS_TONE = {
  open: '#2E7A4C',
  soon: '#A8650F',
  closed: '#7A7064',
  draft: '#6B5D45',
  hidden: '#9E2A12',
} as const;

/** Thin top edges on the side cards. */
export const CARD_ACCENT = {
  forest: '#2C5A40',
  blue: '#4F7393',
} as const;

/** A role's photo as a rounded thumbnail with a ring in the role's accent. */
export function RoleThumb({ role, size = 60 }: { role: JobRole; size?: number }) {
  const t = ROLE_THEME[role] ?? ROLE_THEME.chair;
  return (
    <span
      className="gv-jk-thumb"
      aria-hidden
      style={{ width: size, height: size, boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 4px ${t.accent}, 0 4px 12px rgba(27,56,40,0.16)` }}
    >
      <Image src={t.image} alt="" fill sizes={`${size * 2}px`} style={{ objectFit: 'cover' }} />
    </span>
  );
}

/**
 * The band at the top of Your Listings: one photo per role type, each with a
 * solid ink plate carrying the role word and how many of its listings are live.
 */
export function RoleBand({ live }: { live: Record<JobRole, number> }) {
  const roles: JobRole[] = ['chair', 'secretariat', 'staff'];
  return (
    <div className="gv-jk-band" aria-label="Live listings by role" role="group">
      {roles.map((r) => {
        const t = ROLE_THEME[r];
        const Icon = t.icon;
        const n = live[r] ?? 0;
        return (
          <div key={r} className="gv-jk-band-tile">
            <Image src={t.image} alt="" fill sizes="(min-width:1100px) 22vw, 33vw" style={{ objectFit: 'cover' }} />
            <span className="gv-jk-band-bar" style={{ background: t.accent }} aria-hidden />
            <div className="gv-jk-plate" style={{ borderLeftColor: t.accent }}>
              <span className="gv-jk-plate-word">
                <Icon size={14} strokeWidth={1.8} aria-hidden className="gv-jk-plate-icon" />
                {t.plural}
              </span>
              <span className="gv-jk-plate-n"><b>{n.toLocaleString('en-US')}</b> live</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** An empty state with a photo beside its words (stacked on phones). */
export function EmptyArt({ image, children }: { image: string; children: ReactNode }) {
  return (
    <div className="gv-jk-empty">
      <div className="gv-jk-empty-art" aria-hidden>
        <Image src={image} alt="" fill sizes="(min-width:700px) 260px, 100vw" style={{ objectFit: 'cover' }} />
        <div className="gv-jk-empty-roles">
          {(['chair', 'secretariat', 'staff'] as JobRole[]).map((r) => {
            const t = ROLE_THEME[r];
            const Icon = t.icon;
            return (
              <span key={r} className="gv-jk-empty-role" style={{ borderLeftColor: t.accent }}>
                <Icon size={13} strokeWidth={1.8} aria-hidden />
                {JOB_ROLE_LABEL[r]}
              </span>
            );
          })}
        </div>
      </div>
      <div className="gv-jk-empty-body">{children}</div>
    </div>
  );
}

export function BoardCard({ title, hint, icon: Icon, focus = false, accent, className, children }: {
  title: string;
  hint: string;
  icon: LucideIcon;
  /** The page's focus card: a gold top edge. */
  focus?: boolean;
  /** A thin top edge in this colour (side cards). */
  accent?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`gv-jk-card${focus ? ' gv-jk-focus' : ''}${accent && !focus ? ' gv-jk-accent' : ''}${className ? ` ${className}` : ''}`}
      style={accent && !focus ? ({ '--gv-jk-accent': accent } as CSSProperties) : undefined}
      aria-label={title}
    >
      <div className="gv-jk-head">
        <Icon size={22} strokeWidth={ICON_STROKE} aria-hidden className="gv-jk-icon" />
        <h2 className="gv-jk-title">{title}</h2>
        <InfoHint label={`About ${title}`} text={hint} size={16} />
      </div>
      {children}
    </section>
  );
}

/** A count: the big number with its word beside it, an optional style A icon first. */
export function JobCount({ n, word, icon: Icon }: { n: number; word: string; icon?: LucideIcon }) {
  return (
    <span className="gv-jk-count">
      {Icon && <Icon size={17} strokeWidth={ICON_STROKE} aria-hidden className="gv-jk-count-icon" />}
      <b>{n.toLocaleString('en-US')}</b>
      <span>{word}</span>
    </span>
  );
}

export const JOB_KIT_CSS = `
.gv-jk-card{position:relative;background:#FFFFFF;border-radius:20px;padding:20px 22px 20px;font-family:${FONT};
  box-shadow:0 1px 2px rgba(27,56,40,0.06),0 8px 24px rgba(27,56,40,0.08)}
.gv-jk-focus{box-shadow:inset 0 1px 0 #F8EBBE,inset 0 4px 0 #DFC164,inset 0 0 0 1px rgba(182,135,31,0.20),0 1px 2px rgba(27,56,40,0.08),0 12px 28px -10px rgba(27,56,40,0.26);padding-top:24px}
.gv-jk-accent{padding-top:23px;box-shadow:inset 0 3px 0 var(--gv-jk-accent),0 1px 2px rgba(27,56,40,0.06),0 8px 24px rgba(27,56,40,0.08)}
.gv-jk-head{display:flex;align-items:center;gap:10px;margin:0 0 14px}
.gv-jk-icon{flex-shrink:0;color:${INK}}
.gv-jk-title{margin:0;font-size:18px;font-weight:800;letter-spacing:-0.01em;line-height:1.25;color:${INK}}
.gv-jk-count{display:inline-flex;align-items:baseline;gap:6px;font-family:${FONT}}
.gv-jk-count b{font-size:24px;font-weight:700;line-height:1;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums}
.gv-jk-count span{font-size:13.5px;color:${INK_SOFT}}
.gv-jk-count-icon{align-self:center;color:${INK_SOFT}}
/* Role photos */
.gv-jk-thumb{position:relative;flex-shrink:0;display:block;overflow:hidden;border-radius:16px;background:#EDE7D8}
.gv-jk-band{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 18px}
.gv-jk-band-tile{position:relative;overflow:hidden;border-radius:14px;height:clamp(104px,9vw,140px);background:#EDE7D8}
.gv-jk-band-tile img{z-index:0}
.gv-jk-band-bar{position:absolute;left:0;right:0;bottom:0;height:4px;z-index:1}
.gv-jk-plate{position:absolute;left:8px;bottom:10px;z-index:1;max-width:calc(100% - 16px);display:flex;flex-direction:column;gap:1px;padding:6px 10px 6px 9px;border-radius:10px;border-left:3px solid;background:rgba(28,20,16,0.86);color:#FFFFFF;font-family:${FONT}}
.gv-jk-plate-word{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.gv-jk-plate-icon{flex-shrink:0}
.gv-jk-plate-n{font-size:12px;color:rgba(255,255,255,0.78)}
.gv-jk-plate-n b{font-size:15px;font-weight:800;color:#FFFFFF;font-variant-numeric:tabular-nums;margin-right:2px}
@media (max-width:600px){.gv-jk-band{gap:6px}.gv-jk-plate{left:6px;bottom:7px;max-width:calc(100% - 12px);padding:5px 7px}.gv-jk-plate-word{font-size:11.5px}.gv-jk-plate-icon{display:none}}
/* Illustrated empty state */
.gv-jk-empty{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:center;padding:6px 0 4px}
@media (min-width:700px){.gv-jk-empty{grid-template-columns:260px minmax(0,1fr);gap:26px}}
.gv-jk-empty-art{position:relative;overflow:hidden;border-radius:16px;height:180px;background:#EDE7D8;box-shadow:0 4px 16px rgba(27,56,40,0.14)}
@media (min-width:700px){.gv-jk-empty-art{height:210px}}
.gv-jk-empty-art img{z-index:0}
.gv-jk-empty-roles{position:absolute;left:10px;bottom:10px;z-index:1;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100% - 20px)}
.gv-jk-empty-role{display:inline-flex;align-items:center;gap:5px;padding:4px 9px 4px 7px;border-radius:8px;border-left:3px solid;background:rgba(28,20,16,0.86);color:#FFFFFF;font-family:${FONT};font-size:12px;font-weight:700}
.gv-jk-empty-body{min-width:0}
/* Light secondary buttons, as on the seat board (SOFT_BTN_CLASS); the one solid forest button stays gv-st-forest. */
.gv-jb .gv-st-outline{background:#FFFFFF;color:${FOREST};font-weight:600;border:1px solid rgba(27,56,40,0.20);box-shadow:0 1px 2px rgba(27,56,40,0.07);transition:background-color 150ms cubic-bezier(0.22,1,0.36,1),border-color 150ms cubic-bezier(0.22,1,0.36,1),box-shadow 150ms cubic-bezier(0.22,1,0.36,1),transform 150ms cubic-bezier(0.22,1,0.36,1)}
.gv-jb .gv-st-outline:hover:not(:disabled){background:#F4F0E6;border-color:rgba(27,56,40,0.45);box-shadow:0 2px 8px rgba(27,56,40,0.12)}
.gv-jb .gv-st-outline:active:not(:disabled){transform:scale(0.96)}
`;
