'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ChairRoleChoice: the "Moderator or Commenter?" question, asked FIRST whenever a
// chair enters a room (26 Sep 2026, owner). Two surfaces use it:
//   • /join, chair tab: before the name and the chair code;
//   • the "Your room is live" pop-up (LiveRoomsDialog) for a conference chair,
//     before `enter_live_chair_room` walks them in.
//
// Presentational only. It decides nothing about the gavel: the caller maps
// 'head' / 'co' onto exactly what the join page always did ('head' =
// updateCommitteeHeadChairInDB with this device, 'co' = nothing), so the
// persisted identifiers (`settings.headChair`, chairRole 'head' | 'co') are
// untouched (AGENTS.md, CHAIR ROLES & THE GAVEL).
//
// The rule it states: exactly one Moderator, any number of Commenters. Picking
// Moderator while another chair holds the gavel AND has the chair page open
// (the `chair-presence-<committee id>` channel) asks first, through
// ModeratorTakeoverDialog.
//
// The previews are small mocks in the site palette: the Moderator card shows the
// real laptop render from /sessions (`/sessions/hero-laptop.webp`); the Commenter
// card is a CSS drawing of the comment dock until the owner supplies a real
// screenshot of it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, type ReactNode } from 'react';
import { Check, Gavel, MessageSquareText, TriangleAlert, Users, UserRound } from 'lucide-react';
import Portal from '@/components/Portal';
import { useT } from '@/contexts/LanguageContext';

export type ChairRoleKey = 'head' | 'co';

const FONT = 'var(--font-brand), sans-serif';
const K = {
  forest: '#1B3828',
  forestLift: '#2A5A3C',
  ink: '#1C1410',
  inkSoft: '#544B3E',
  ivory: '#F4EFE3',
  gold: '#EED98A',
  goldDeep: '#8A6414',
  line: 'rgba(27,56,40,0.10)',
} as const;

/**
 * The name of a Moderator who is live right now, or null. Live = the gavel is held
 * (`settings.headChair`, surfaced as `dbHeadChair` / `headChair`) by a chair other
 * than `myName`, and that chair is on the presence channel. Advisory: the gavel is
 * claim-at-will and the chair page settles who holds it.
 */
export function liveModeratorName(headChair: string | null | undefined, presence: Iterable<string>, myName?: string | null): string | null {
  const head = (headChair ?? '').trim();
  if (!head) return null;
  if (myName && myName.trim() === head) return null;
  for (const n of presence) if (n.trim() === head) return head;
  return null;
}

// ── Previews ─────────────────────────────────────────────────────────────────

function ModeratorPreview() {
  return (
    <div
      aria-hidden
      className="relative flex items-center justify-center overflow-hidden"
      style={{ height: 112, borderRadius: 14, backgroundColor: K.ivory, boxShadow: `inset 0 0 0 1px ${K.line}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sessions/hero-laptop.webp" alt="" width={1000} height={610} loading="lazy" decoding="async"
        style={{ width: '94%', height: '100%', objectFit: 'contain', objectPosition: 'center 60%' }} />
    </div>
  );
}

/** The Commenter's comment dock, drawn: a speaker on the floor and notes under it. */
function CommenterPreview() {
  const bar = (w: string, o = 0.16) => <span className="block rounded-full" style={{ height: 5, width: w, backgroundColor: `rgba(27,56,40,${o})` }} />;
  return (
    <div
      aria-hidden
      className="flex flex-col gap-1.5 overflow-hidden px-3 py-2.5"
      style={{ height: 112, borderRadius: 14, backgroundColor: K.ivory, boxShadow: `inset 0 0 0 1px ${K.line}` }}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full" style={{ width: 22, height: 22, background: 'conic-gradient(#2F6A9A 0 33%, #F4EFE3 0 66%, #B8423A 0)', boxShadow: '0 0 0 2px #fff' }} />
        <span className="flex flex-col gap-1">{bar('54px', 0.55)}{bar('34px')}</span>
        <span className="ms-auto flex gap-1">
          {['#3D7A52', '#C9A33A', '#8B2020'].map((c) => (
            <span key={c} className="rounded-full" style={{ width: 12, height: 12, backgroundColor: c, opacity: 0.55, boxShadow: '0 0 0 1.5px #fff' }} />
          ))}
        </span>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-1 rounded-lg px-2 py-1.5" style={{ backgroundColor: '#FFFFFF', boxShadow: `0 1px 2px rgba(27,56,40,0.08), inset 0 0 0 1px ${K.line}` }}>
          <span className="flex items-center gap-1.5">
            <span className="rounded-full" style={{ width: 9, height: 9, backgroundColor: i ? '#C9A33A' : '#2F6A9A', opacity: 0.7 }} />
            {bar(i ? '40px' : '48px', 0.4)}
          </span>
          {bar(i ? '70%' : '86%')}
          {i === 0 && <span className="flex items-center gap-0.5">{bar('52%')}<span style={{ width: 1.5, height: 9, backgroundColor: K.forest }} /></span>}
        </div>
      ))}
    </div>
  );
}

// ── The cards ────────────────────────────────────────────────────────────────

function RoleCard({ role, active, onPick, title, desc, rule, ruleIcon, extra, preview }: {
  role: ChairRoleKey;
  active: boolean;
  onPick: (r: ChairRoleKey) => void;
  title: string;
  desc: string;
  rule: string;
  ruleIcon: ReactNode;
  extra?: string | null;
  preview: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onPick(role)}
      data-chair-role={role}
      className="group relative flex w-full flex-col gap-2.5 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 active:scale-[0.98]"
      style={{
        cursor: 'pointer', padding: 10, borderRadius: 20, backgroundColor: '#FFFFFF',
        boxShadow: active
          ? `inset 0 0 0 2px ${K.forest}, 0 10px 26px rgba(27,56,40,0.16)`
          : `inset 0 0 0 1px ${K.line}, 0 1px 2px rgba(27,56,40,0.05), 0 8px 20px rgba(27,56,40,0.07)`,
        transitionProperty: 'box-shadow, transform', transitionDuration: '160ms',
      }}
    >
      {preview}
      {active && (
        <span aria-hidden className="absolute flex items-center justify-center rounded-full" style={{ top: 16, insetInlineEnd: 16, width: 26, height: 26, backgroundColor: K.forest, color: '#fff', boxShadow: '0 0 0 3px #fff' }}>
          <Check size={15} strokeWidth={3} />
        </span>
      )}
      <div className="px-1.5 pb-1">
        <p className="flex items-center gap-2" style={{ fontFamily: FONT, fontSize: 19, fontWeight: 800, color: K.ink, letterSpacing: '-0.015em', lineHeight: 1.15 }}>
          <span className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: 'rgba(27,56,40,0.08)', color: K.forest }}>
            {role === 'head' ? <Gavel size={15} strokeWidth={2.4} fill="rgba(238,217,138,0.9)" /> : <MessageSquareText size={15} strokeWidth={2.4} fill="rgba(238,217,138,0.9)" />}
          </span>
          {title}
        </p>
        <p className="mt-1.5" style={{ fontFamily: FONT, fontSize: 13, lineHeight: 1.45, color: K.inkSoft, textWrap: 'pretty' }}>{desc}</p>
        <p className="mt-2 flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: K.forest }}>
          {ruleIcon}{rule}
        </p>
        {extra && <p className="mt-1.5" style={{ fontFamily: FONT, fontSize: 12, lineHeight: 1.4, color: K.goldDeep, fontWeight: 600, textWrap: 'pretty' }}>{extra}</p>}
      </div>
    </button>
  );
}

export function ChairRoleCards({ value, onPick, gavelFree, heading = true }: {
  value: ChairRoleKey | null;
  onPick: (r: ChairRoleKey) => void;
  /** Nobody holds the gavel yet: a Commenter starts with it (a room always has one Moderator). */
  gavelFree?: boolean;
  heading?: boolean;
}) {
  const t = useT();
  return (
    <div>
      {heading && (
        <p id="chair-role-heading" style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: K.ink, letterSpacing: '-0.01em', marginBottom: 10 }}>
          {t('chair_role_question')}
        </p>
      )}
      <div
        role="radiogroup"
        aria-labelledby={heading ? 'chair-role-heading' : undefined}
        aria-label={heading ? undefined : t('chair_role_question')}
        className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2"
        onKeyDown={(e) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
          e.preventDefault();
          const next: ChairRoleKey = value === 'head' ? 'co' : 'head';
          onPick(next);
          (e.currentTarget.querySelector(`[data-chair-role="${next}"]`) as HTMLElement | null)?.focus();
        }}
      >
        <RoleCard
          role="head"
          active={value === 'head'}
          onPick={onPick}
          title={t('join_chair_role_head')}
          desc={t('chair_role_mod_desc')}
          rule={t('chair_role_mod_rule')}
          ruleIcon={<UserRound size={13} strokeWidth={2.6} />}
          preview={<ModeratorPreview />}
        />
        <RoleCard
          role="co"
          active={value === 'co'}
          onPick={onPick}
          title={t('join_chair_role_co')}
          desc={t('chair_role_com_desc')}
          rule={t('chair_role_com_rule')}
          ruleIcon={<Users size={13} strokeWidth={2.6} />}
          extra={gavelFree ? t('chair_role_com_first') : null}
          preview={<CommenterPreview />}
        />
      </div>
    </div>
  );
}

/** The chosen role, folded to one line once the next step is on screen. */
export function ChairRoleSummary({ value, onChange }: { value: ChairRoleKey; onChange: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5" style={{ backgroundColor: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${K.line}` }}>
      <span className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: 'rgba(27,56,40,0.08)', color: K.forest }}>
        {value === 'head' ? <Gavel size={16} strokeWidth={2.4} fill="rgba(238,217,138,0.9)" /> : <MessageSquareText size={16} strokeWidth={2.4} fill="rgba(238,217,138,0.9)" />}
      </span>
      <p className="min-w-0 flex-1" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: K.ink }}>
        {value === 'head' ? t('join_chair_role_head') : t('join_chair_role_co')}
      </p>
      <button
        type="button"
        onClick={onChange}
        className="rounded-lg px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
        style={{ minHeight: 44, fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: K.forest, textDecoration: 'underline', textUnderlineOffset: 4, cursor: 'pointer' }}
      >
        {t('chair_role_change')}
      </button>
    </div>
  );
}

/** "{name} is moderating now. If you continue, you take control of the room." */
export function ModeratorTakeoverDialog({ name, onConfirm, onCancel, rootAttrs }: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra attributes on the root layer (the live-rooms gate marks its own layers). */
  rootAttrs?: Record<string, string>;
}) {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelFn = useRef(onCancel);
  useEffect(() => { cancelFn.current = onCancel; }, [onCancel]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => cancelRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelFn.current(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      e.stopPropagation();
      const f = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button'));
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!panelRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    // Capture, so the pop-up underneath (the live-rooms dialog) never sees this Escape.
    window.addEventListener('keydown', onKey, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
  }, []);
  return (
    <Portal>
      <div {...rootAttrs} className="fixed inset-0 flex items-end justify-center p-0 min-[520px]:items-center min-[520px]:p-4" style={{ zIndex: 1300, fontFamily: FONT }}>
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16,30,22,0.46)' }} onClick={onCancel} aria-hidden />
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="gv-takeover-title"
          aria-describedby="gv-takeover-body"
          className="relative w-full max-w-[420px] rounded-t-[26px] min-[520px]:rounded-[24px]"
          style={{ backgroundColor: '#FFFFFF', padding: '24px 22px calc(20px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 30px 80px rgba(16,30,22,0.35)' }}
        >
          <span className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: 'rgba(238,217,138,0.45)', color: K.goldDeep }}>
            <TriangleAlert size={21} strokeWidth={2.4} />
          </span>
          <h2 id="gv-takeover-title" className="mt-3" style={{ fontSize: 21, fontWeight: 800, color: K.ink, letterSpacing: '-0.015em', lineHeight: 1.2 }}>
            {t('chair_role_take_title')}
          </h2>
          <p id="gv-takeover-body" className="mt-1.5" style={{ fontSize: 14.5, lineHeight: 1.5, color: K.inkSoft, textWrap: 'pretty', overflowWrap: 'anywhere' }}>
            {t('chair_role_take_body', { name })}
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2.5 min-[380px]:flex-row">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 active:scale-[0.98]"
              style={{ minHeight: 48, fontSize: 15, fontWeight: 700, color: K.ink, boxShadow: `inset 0 0 0 1.5px ${K.ink}`, cursor: 'pointer' }}
            >
              {t('chair_role_take_cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 active:scale-[0.98]"
              style={{ minHeight: 48, fontSize: 15, fontWeight: 700, color: '#FFFFFF', background: `linear-gradient(90deg, ${K.forest} 0%, ${K.forestLift} 100%)`, cursor: 'pointer' }}
            >
              {t('chair_role_take_confirm')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
