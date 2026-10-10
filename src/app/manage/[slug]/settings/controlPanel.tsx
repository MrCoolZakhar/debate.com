'use client';

/**
 * Settings front page (Oct 2026, second pass after the owner's review: "i
 * don't [think] the 'everything else' seems important enough ... if someone
 * is looking for something it's hard to find").
 *
 *   - "{ACRONYM} is live" (or "is not public yet"), one plain line under it.
 *   - Who Can Apply: one row per role with its price, window, number applied,
 *     Edit (opens the role's pop-up form, roleSetup.tsx) and its own switch.
 *     Only Head delegates and Delegates are listed until another role is set
 *     up (panelKit.roleIsSetUp); "Add a role" lists the rest and asks whether
 *     to start from scratch or copy a role that is already set up.
 *   - Your Conference: Your page, Your team, Delegations, Privacy (with the
 *     Public on Explore switch) and Payments, each a row with its state in
 *     one line and one button. These replace the three status tiles and the
 *     "Everything else" side column: the tiles' switch lives on the Privacy
 *     row, their payment state on the Payments row, and the "Taking
 *     applications" reading sits in the Who Can Apply heading.
 *
 * Presentation only. Every write is the settings page's own handler, passed
 * in; every rule it checks first mirrors a database rule (the TBD CHECK, the
 * payment gates) so a switch never fails where it could have explained why.
 */

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircle2, Clock, MinusCircle, ChevronRight, Plus, X, ArrowLeft, Copy, FilePlus2,
  Building2, Users2, UsersRound, ShieldCheck, CreditCard, type LucideIcon,
} from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { conferencePaymentsReady, paymentGateBlocks } from '@/lib/payments';
import type { Conference } from '@/app/manage/[slug]/layout';
import { ROLE_ORDER, ROLE_EMOJI } from './applicationsUi';
import {
  F, INK, INK_SOFT, FOREST, AMBER, CARD, TEXT_LINK, HAIRLINE, SECOND_BTN,
  Switch, windowState, shortDate, rolePriceText, rolePlural, roleHasPrice, roleIsFree,
  roleIsSetUp, ALWAYS_LISTED_ROLES, type RoleSetupConfig,
} from './panelKit';

export type PanelSection = 'conference' | 'organizers' | 'delegations' | 'privacy';

/** One line per role for the Add a role picker. */
const ROLE_LINE: Record<string, string> = {
  'head-delegate': 'Leads a school or society delegation',
  delegate: 'Represents a country in a committee',
  'faculty-advisor': 'The teacher who travels with a school',
  observer: 'Attends without a seat, like press or guests',
  chair: 'Runs a committee for you',
  secretariat: 'Your team. Accepting makes them an organiser',
  staff: 'Volunteers and helpers on the day',
};

const CSS = `
.gvc-root { container-type: inline-size; }
.gvc-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "name switch" "detail detail" "count edit"; column-gap: 12px; row-gap: 6px; align-items: center; padding: 14px 0; border-top: 1px solid ${HAIRLINE}; }
.gvc-row-name { grid-area: name; } .gvc-row-detail { grid-area: detail; } .gvc-row-count { grid-area: count; }
.gvc-row-edit { grid-area: edit; justify-self: end; } .gvc-row-switch { grid-area: switch; justify-self: end; }
@container (min-width: 640px) {
  .gvc-row { grid-template-columns: minmax(150px, 1.1fr) minmax(0, 1.6fr) 104px auto auto; grid-template-areas: "name detail count edit switch"; column-gap: 16px; padding: 12px 0; }
}
.gvc-sec { display: grid; grid-template-columns: 40px minmax(0, 1fr); grid-template-areas: "icon text" "icon act"; column-gap: 12px; row-gap: 8px; align-items: center; padding: 14px 0; border-top: 1px solid ${HAIRLINE}; }
.gvc-sec-icon { grid-area: icon; align-self: start; } .gvc-sec-text { grid-area: text; } .gvc-sec-act { grid-area: act; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
@container (min-width: 640px) {
  .gvc-sec { grid-template-columns: 40px minmax(0, 1fr) auto; grid-template-areas: "icon text act"; column-gap: 16px; }
  .gvc-sec-icon { align-self: center; } .gvc-sec-act { justify-content: flex-end; flex-wrap: nowrap; }
}
.gvc-pick { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 560px) { .gvc-pick { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function placeOf(c: Conference): string {
  if (c.format === 'online') return 'Online';
  return [c.city, c.country].map(s => (s ?? '').trim()).filter(Boolean).join(', ');
}

function paymentSentence(c: Conference): string {
  if (!conferencePaymentsReady(c)) return 'Not set up. Even a free conference needs one';
  if (c.platform_collects || c.payment_method === 'stripe') return 'Card payments';
  const note = (c.external_payment_note ?? '').trim().toLowerCase();
  if (!c.external_payment_url && note.startsWith('this conference is free')) return 'It is free';
  if (c.manual_kind === 'qr') return 'QR code';
  if (c.manual_kind === 'bank') return 'Bank transfer';
  return 'Payment link';
}

function rowDetail(cfg: RoleSetupConfig, now: number): string {
  const st = windowState(cfg, now);
  if (st === 'off') return 'Not taking applications';
  if (st === 'scheduled') return `opens ${shortDate(cfg.applications_open_at, now)}`;
  if (st === 'closed') return `closed ${shortDate(cfg.applications_close_at, now)}`;
  return cfg.applications_close_at ? `open until ${shortDate(cfg.applications_close_at, now)}` : 'open, no closing date';
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function IconDisc({ emoji, icon, size = 40 }: { emoji: string; icon: LucideIcon; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #F3EEDD 70%)', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 2px 6px rgba(27,56,40,0.08)' }}
    >
      <Emoji3D name={emoji} size={Math.round(size * 0.55)} fallback={icon} fallbackColor={FOREST} />
    </span>
  );
}

function SectionRow({ emoji, icon, title, state, stateId, control, button }: {
  emoji: string; icon: LucideIcon; title: string; state: React.ReactNode; stateId?: string;
  control?: React.ReactNode; button: React.ReactNode;
}) {
  return (
    <div className="gvc-sec">
      <span className="gvc-sec-icon"><IconDisc emoji={emoji} icon={icon} /></span>
      <div className="gvc-sec-text min-w-0">
        <h3 style={{ fontFamily: F, fontSize: 16.5, fontWeight: 700, color: INK, lineHeight: 1.3 }}>{title}</h3>
        <p id={stateId} style={{ fontFamily: F, fontSize: 14, color: INK_SOFT, lineHeight: 1.45, marginTop: 1, overflowWrap: 'anywhere' }}>{state}</p>
      </div>
      <div className="gvc-sec-act">
        {control}
        {button}
      </div>
    </div>
  );
}

const ROW_BTN: React.CSSProperties = { ...SECOND_BTN, padding: '8px 14px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 };

function RowButton({ label, aria, onClick, href }: { label: string; aria?: string; onClick?: () => void; href?: string }) {
  const inner = <>{label}<ChevronRight size={16} strokeWidth={2.4} aria-hidden /></>;
  const cls = 'focus:outline-none focus-visible:ring-2 active:scale-[0.98] transition-transform';
  return href
    ? <Link href={href} aria-label={aria} className={cls} style={ROW_BTN}>{inner}</Link>
    : <button type="button" aria-label={aria} onClick={onClick} className={cls} style={ROW_BTN}>{inner}</button>;
}

// ── Add a role ───────────────────────────────────────────────────────────────

function AddRole({ hidden, setUp, onAdd }: {
  /** Roles not listed yet, in ROLE_ORDER. */
  hidden: RoleSetupConfig[];
  /** Roles already listed, offered as a template. */
  setUp: RoleSetupConfig[];
  onAdd: (role: string, copyFrom: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => boxRef.current?.querySelector<HTMLElement>('[data-first-choice]')?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, picked]);

  if (hidden.length === 0) return null;

  function close() { setOpen(false); setPicked(null); }

  if (!open) {
    return (
      <div className="pt-3 pb-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 active:scale-[0.98] transition-transform" style={SECOND_BTN}>
          <Plus size={16} strokeWidth={2.6} aria-hidden />
          Add a role
        </button>
      </div>
    );
  }

  const target = picked ? hidden.find(r => r.role === picked) : null;
  const templates = target ? setUp.filter(s => s.role !== target.role) : [];

  return (
    <div
      ref={boxRef}
      className="mt-1 mb-3 rounded-2xl p-4"
      style={{ backgroundColor: '#FBF8F1', border: '1px solid #EFE9DC' }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: INK }}>
          {target ? `Set Up ${rolePlural(target.role)}` : 'Which Role?'}
        </p>
        <button type="button" onClick={close} aria-label="Cancel adding a role" className="flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 rounded-full" style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', color: INK }}>
          <X size={18} strokeWidth={2.4} />
        </button>
      </div>

      {!target ? (
        <div className="gvc-pick">
          {hidden.map((r, i) => (
            <button
              key={r.role}
              type="button"
              data-first-choice={i === 0 ? '' : undefined}
              onClick={() => setPicked(r.role)}
              className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 active:scale-[0.99] transition-transform"
              style={{ ...CARD, borderRadius: 14, padding: '11px 13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(27,56,40,0.06)' }}
            >
              <IconDisc emoji={ROLE_EMOJI[r.role] ?? 'Busts in silhouette'} icon={UsersRound} size={36} />
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{rolePlural(r.role)}</span>
                <span className="block" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{ROLE_LINE[r.role]}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-first-choice=""
            onClick={() => { onAdd(target.role, null); close(); }}
            className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 active:scale-[0.99] transition-transform"
            style={{ ...CARD, borderRadius: 14, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(27,56,40,0.06)' }}
          >
            <FilePlus2 size={22} strokeWidth={2} color={FOREST} aria-hidden className="flex-shrink-0" />
            <span className="min-w-0">
              <span className="block" style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: INK }}>Start from scratch</span>
              <span className="block" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT }}>An empty form, free, switched off</span>
            </span>
          </button>
          {templates.map(s => {
            // Only what would really be copied: the questions, the prices, or both.
            const withQuestions = Array.isArray(s.custom_questions) && s.custom_questions.length > 0;
            const withPrice = roleHasPrice(target.role) && roleHasPrice(s.role) && !roleIsFree(s);
            if (!withQuestions && !withPrice) return null;
            return (
              <button
                key={s.role}
                type="button"
                onClick={() => { onAdd(target.role, s.role); close(); }}
                className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 active:scale-[0.99] transition-transform"
                style={{ ...CARD, borderRadius: 14, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(27,56,40,0.06)' }}
              >
                <Copy size={20} strokeWidth={2.2} color={FOREST} aria-hidden className="flex-shrink-0" />
                <span className="min-w-0">
                  <span className="block" style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: INK, overflowWrap: 'anywhere' }}>Copy from {rolePlural(s.role)}</span>
                  <span className="block" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT }}>{withQuestions && withPrice ? 'Copies the questions and the prices' : withQuestions ? 'Copies the questions' : 'Copies the prices'}</span>
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1.5 self-start mt-1 focus:outline-none focus-visible:ring-2 rounded" style={{ ...TEXT_LINK, fontSize: 14 }}>
            <ArrowLeft size={14} strokeWidth={2.5} aria-hidden />
            Pick another role
          </button>
        </div>
      )}
    </div>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────

export function SettingsControlPanel({
  conference: c, roles, counts, now, organizerCount, pendingInviteCount, extraRoles, focusRoles,
  publicSaving, onPublicToggle, onRoleToggle, onEditRole, onAddRole, onOpen,
}: {
  conference: Conference;
  roles: RoleSetupConfig[];
  /** Live applications per role (submitted or further); null while loading. */
  counts: Record<string, number> | null;
  now: number;
  organizerCount: number;
  pendingInviteCount: number;
  /** Roles the organiser added on this browser (or has open right now): listed even before they are set up. */
  extraRoles: readonly string[];
  /** ?tab=applications with no role: bring Who Can Apply into view. */
  focusRoles: boolean;
  publicSaving: boolean;
  onPublicToggle: (next: boolean) => void;
  onRoleToggle: (role: string, next: boolean) => void;
  onEditRole: (role: string, step?: string) => void;
  onAddRole: (role: string, copyFrom: string | null) => void;
  onOpen: (section: PanelSection) => void;
}) {
  const ids = useId();
  const name = c.acronym || c.full_name;
  const gate = paymentGateBlocks(c);
  const noDates = c.dates_tbd || !c.start_date;
  const paymentsReady = conferencePaymentsReady(c);
  const ordered = ROLE_ORDER.map(r => roles.find(x => x.role === r)).filter((x): x is RoleSetupConfig => !!x);
  const listed = ordered.filter(r => ALWAYS_LISTED_ROLES.includes(r.role) || extraRoles.includes(r.role) || roleIsSetUp(r, counts?.[r.role]));
  const hidden = ordered.filter(r => !listed.includes(r));

  // Public on Explore. Only private -> public is ever refused (the TBD CHECK
  // and the publish payment gate); taking it private is always allowed.
  const publicBlock = c.is_public ? null : noDates ? 'dates' : gate ? 'payments' : null;

  // Taking applications: a reading of the roles, shown in the heading.
  const open = ordered.filter(r => windowState(r, now) === 'open');
  const scheduled = ordered.filter(r => windowState(r, now) === 'scheduled');
  const firstClose = open.map(r => r.applications_close_at).filter((x): x is string => !!x).sort()[0];
  const firstOpen = scheduled.map(r => r.applications_open_at).filter((x): x is string => !!x).sort()[0];
  const appsMark = open.length > 0
    ? { icon: CheckCircle2, word: firstClose ? `Open until ${shortDate(firstClose, now)}` : 'Open', color: FOREST }
    : scheduled.length > 0 ? { icon: Clock, word: `Opens ${shortDate(firstOpen, now)}`, color: AMBER }
    : { icon: MinusCircle, word: 'Nobody can apply yet', color: INK_SOFT };

  const subline = c.is_public
    ? 'Anyone can find your page on Explore.'
    : noDates ? 'Add your dates, then make it public under Privacy.'
    : gate ? 'Set up payments, then make it public under Privacy.'
    : 'Switch on Public on Explore under Privacy when you are ready.';

  // One line of state per section.
  const missing: string[] = [];
  if (noDates) missing.push('dates');
  if (c.format !== 'online' && !placeOf(c)) missing.push('city');
  if (!c.logo_url) missing.push('logo');
  if (!(c.description ?? '').trim()) missing.push('description');
  const pageState = missing.length > 0
    ? `Add your ${missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}` : missing[0]}`
    : [shortDate(c.start_date, now), placeOf(c)].filter(Boolean).join(' · ');
  const others = Math.max(0, organizerCount - 1);
  const teamState = (organizerCount <= 1 ? 'Just you' : `You and ${others} ${others === 1 ? 'other' : 'others'}`)
    + (pendingInviteCount > 0 ? ` · ${pendingInviteCount} ${pendingInviteCount === 1 ? 'invite' : 'invites'} waiting` : '');
  const delegationState = c.allow_delegation_import ? 'Leaders can import their delegates' : 'Each delegate applies on their own';

  const rolesRef = useRef<HTMLElement | null>(null);
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (!focusRoles || focusedOnce.current || ordered.length === 0) return;
    focusedOnce.current = true;
    const el = rolesRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }, [focusRoles, ordered.length]);

  const card: React.CSSProperties = { ...CARD, padding: '20px clamp(16px, 2.6vw, 26px) 10px' };
  const h2: React.CSSProperties = { fontFamily: F, fontSize: 21, fontWeight: 700, color: INK, lineHeight: 1.25 };

  return (
    <div className="gvc-root">
      <style>{CSS}</style>
      <header className="mb-6">
        <p style={{ fontFamily: F, fontSize: 12.5, fontWeight: 600, color: INK_SOFT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Settings</p>
        <h1 className="mt-1.5" style={{ fontFamily: F, fontSize: 'clamp(28px, 3.4vw, 40px)', fontWeight: 800, color: INK, lineHeight: 1.08, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>
          {c.is_public ? <>{name} is <GoldWord>live</GoldWord></> : <>{name} is not public <GoldWord>yet</GoldWord></>}
        </h1>
        <p className="mt-2" style={{ fontFamily: F, fontSize: 15.5, color: '#3A2E24', lineHeight: 1.5 }}>
          {subline}{' '}
          <a href={`/conferences/${c.slug}?preview=1`} target="_blank" rel="noopener noreferrer" style={{ ...TEXT_LINK, fontSize: 15.5 }}>Open your page</a>
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {/* ── Who can apply ── */}
        <section
          ref={rolesRef}
          tabIndex={-1}
          aria-labelledby={`${ids}-roles-h`}
          className="min-w-0 focus:outline-none"
          style={{ ...card, scrollMarginTop: 24 }}
        >
          <div className="flex items-baseline justify-between gap-x-4 gap-y-1 flex-wrap pb-2">
            <h2 id={`${ids}-roles-h`} style={h2}>Who Can Apply</h2>
            <span className="inline-flex items-center gap-1.5" style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: appsMark.color }}>
              <appsMark.icon size={16} strokeWidth={2.4} aria-hidden />
              {appsMark.word}
            </span>
          </div>

          {gate && (
            <p className="mb-3" style={{ fontFamily: F, fontSize: 14, color: '#6B4F12', lineHeight: 1.5 }}>
              Set up payments before you switch a role on. Even a free conference needs one. You can still set every role up now.{' '}
              <Link href={`/manage/${c.slug}/financials?open=payment`} style={{ ...TEXT_LINK, fontSize: 14 }}>Set up payments</Link>
            </p>
          )}

          {ordered.length === 0 ? (
            <div aria-busy="true" className="flex flex-col gap-3 py-3">
              {[0, 1].map(i => <span key={i} className="block rounded-lg animate-pulse" style={{ height: 22, backgroundColor: '#F1ECE0' }} />)}
            </div>
          ) : listed.map(cfg => {
            const st = windowState(cfg, now);
            const blocked = gate && !cfg.is_enabled;
            const plural = rolePlural(cfg.role);
            const count = counts?.[cfg.role];
            return (
              <div key={cfg.role} className="gvc-row">
                <span className="gvc-row-name flex items-center gap-2.5 min-w-0">
                  <Emoji3D name={ROLE_EMOJI[cfg.role] ?? 'Busts in silhouette'} size={24} fallback={UsersRound} fallbackColor={FOREST} />
                  <span style={{ fontFamily: F, fontSize: 16, fontWeight: 600, color: st === 'off' ? INK_SOFT : INK, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{plural}</span>
                </span>
                <span className="gvc-row-detail min-w-0" style={{ fontFamily: F, fontSize: 14, color: INK_SOFT, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                  {st === 'off' ? rowDetail(cfg, now) : `${rolePriceText(cfg, c.fee_currency, now)} · ${rowDetail(cfg, now)}`}
                </span>
                <span className="gvc-row-count" style={{ fontFamily: F, fontSize: 14, color: '#3A2E24', whiteSpace: 'nowrap' }}>
                  {count === undefined ? '' : <><b style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: INK }}>{count}</b> applied</>}
                </span>
                <span className="gvc-row-edit">
                  <RowButton label="Edit" aria={`Edit ${plural}`} onClick={() => onEditRole(cfg.role)} />
                </span>
                <span className="gvc-row-switch" title={blocked ? 'Set up payments before you switch a role on' : undefined}>
                  <Switch
                    label={`${plural} taking applications`}
                    checked={cfg.is_enabled}
                    disabled={blocked}
                    onChange={(next) => onRoleToggle(cfg.role, next)}
                  />
                </span>
              </div>
            );
          })}

          {ordered.length > 0 && <AddRole hidden={hidden} setUp={listed} onAdd={onAddRole} />}
        </section>

        {/* ── Your conference: first-class sections, not a side column ── */}
        <section aria-labelledby={`${ids}-conf-h`} className="min-w-0" style={card}>
          <h2 id={`${ids}-conf-h`} className="pb-2" style={h2}>Your <GoldWord>Conference</GoldWord></h2>

          <SectionRow
            emoji="Classical building" icon={Building2} title="Your page" state={pageState}
            button={<RowButton label="Edit page" onClick={() => onOpen('conference')} />}
          />
          <SectionRow
            emoji="Busts in silhouette" icon={Users2} title="Your team" state={teamState}
            button={<RowButton label="Manage team" onClick={() => onOpen('organizers')} />}
          />
          <SectionRow
            emoji="School" icon={UsersRound} title="Delegations" state={delegationState}
            button={<RowButton label="Open" aria="Open delegation settings" onClick={() => onOpen('delegations')} />}
          />
          <SectionRow
            emoji="Locked" icon={ShieldCheck} title="Privacy" stateId={`${ids}-pub`}
            state={c.is_public ? 'Public on Explore. Anyone can find your page'
              : publicBlock === 'dates' ? <>Private. Add your dates before it can go public. <Link href={`/manage/${c.slug}/settings?tab=conference&focus=dates`} style={{ ...TEXT_LINK, fontSize: 14 }}>Add dates</Link></>
              : publicBlock === 'payments' ? <>Private. Set up payments before it can go public.</>
              : 'Private. Only people with the link can open it'}
            control={
              <Switch
                label="Public on Explore"
                checked={c.is_public}
                busy={publicSaving}
                disabled={!!publicBlock}
                describedBy={`${ids}-pub`}
                onChange={onPublicToggle}
              />
            }
            button={<RowButton label="Options" aria="Open privacy settings" onClick={() => onOpen('privacy')} />}
          />
          <SectionRow
            emoji="Credit card" icon={CreditCard} title="Payments"
            state={paymentsReady
              ? <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={15} strokeWidth={2.4} color={FOREST} aria-hidden />{paymentSentence(c)}</span>
              : <span style={{ color: AMBER, fontWeight: 600 }}>{paymentSentence(c)}</span>}
            button={<RowButton label={paymentsReady ? 'Change' : 'Set up payments'} aria={paymentsReady ? 'Change payments' : undefined} href={`/manage/${c.slug}/financials?open=payment`} />}
          />
        </section>
      </div>
    </div>
  );
}
