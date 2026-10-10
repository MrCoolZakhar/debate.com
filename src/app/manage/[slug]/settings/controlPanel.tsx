'use client';

/**
 * Settings front page, "Control panel" (Oct 2026, owner picked option B of
 * three mockups). It replaces the five-question home (settingsHome.tsx).
 *
 *   - "{ACRONYM} is live" (or "is not public yet"), one plain line under it.
 *   - Three status tiles: Public on Explore (a real switch on the existing
 *     privacy write and its rules), Taking applications (a reading of the
 *     roles, not a master switch: the data model has none), Payments.
 *   - Who can apply: one row per role config with its price, window, number
 *     applied, Edit and the role's own on/off switch.
 *   - Everything else: link cards to the other sections.
 *
 * Presentation only. Every write is the settings page's own handler, passed
 * in; every rule it checks first mirrors a database rule (the TBD CHECK, the
 * payment gates) so a switch never fails where it could have explained why.
 */

import Link from 'next/link';
import { useId } from 'react';
import {
  Globe, ClipboardList, CreditCard, CheckCircle2, Clock, MinusCircle, CircleDot, ChevronRight,
  Building2, Users2, UsersRound, FileText, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { conferencePaymentsReady, paymentGateBlocks } from '@/lib/payments';
import type { Conference } from '@/app/manage/[slug]/layout';
import { ROLE_ORDER, ROLE_EMOJI } from './applicationsUi';
import {
  F, INK, INK_SOFT, FOREST, GOLD, AMBER, CARD, TEXT_LINK, HAIRLINE,
  Switch, windowState, shortDate, rolePriceText, rolePlural, type RoleSetupConfig,
} from './panelKit';

export type PanelSection = 'conference' | 'organizers' | 'delegations' | 'privacy';

const CSS = `
.gvc-root { container-type: inline-size; }
.gvc-tiles { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 600px) { .gvc-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
@container (min-width: 900px) { .gvc-tiles { gap: 16px; } }
.gvc-body { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 960px) { .gvc-body { grid-template-columns: minmax(0, 1fr) 300px; } }
.gvc-roles { container-type: inline-size; }
.gvc-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "name switch" "detail detail" "count edit"; column-gap: 12px; row-gap: 6px; align-items: center; padding: 14px 0; border-top: 1px solid ${HAIRLINE}; }
.gvc-row-name { grid-area: name; } .gvc-row-detail { grid-area: detail; } .gvc-row-count { grid-area: count; }
.gvc-row-edit { grid-area: edit; justify-self: end; } .gvc-row-switch { grid-area: switch; justify-self: end; }
@container (min-width: 600px) {
  .gvc-row { grid-template-columns: minmax(150px, 1.1fr) minmax(0, 1.6fr) 104px 44px auto; grid-template-areas: "name detail count edit switch"; column-gap: 14px; padding: 12px 0; }
}
.gvc-more { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 560px) and (max-width: 959px) { .gvc-more { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function placeOf(c: Conference): string {
  if (c.format === 'online') return 'Online';
  return [c.city, c.country].map(s => (s ?? '').trim()).filter(Boolean).join(', ');
}

function paymentSentence(c: Conference): string {
  if (!conferencePaymentsReady(c)) return 'Not set up';
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

function TileIcon({ icon: Icon }: { icon: LucideIcon }) {
  // Duotone: a forest line over a gold fill (taste board two, "like a lot").
  return <Icon size={34} strokeWidth={1.7} color={FOREST} fill={GOLD} aria-hidden />;
}

function StateMark({ icon: Icon, word, color }: { icon: LucideIcon; word: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 flex-shrink-0" style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color }}>
      <Icon size={17} strokeWidth={2.4} aria-hidden />
      {word}
    </span>
  );
}

function Tile({ icon, control, title, children }: { icon: LucideIcon; control: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...CARD, padding: '20px 22px' }} className="flex flex-col gap-3.5 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <TileIcon icon={icon} />
        {control}
      </div>
      <div className="min-w-0">
        <h2 style={{ fontFamily: F, fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{title}</h2>
        <div style={{ fontFamily: F, fontSize: 14, color: INK_SOFT, marginTop: 3, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{children}</div>
      </div>
    </section>
  );
}

function MoreCard({ icon, emoji, title, state, href, onClick }: {
  icon: LucideIcon; emoji: string; title: string; state: string; href?: string; onClick?: () => void;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #F3EEDD 70%)', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 2px 6px rgba(27,56,40,0.08)' }}
      >
        <Emoji3D name={emoji} size={22} fallback={icon} fallbackColor={FOREST} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block" style={{ fontFamily: F, fontSize: 15.5, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{title}</span>
        <span className="block" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{state}</span>
      </span>
      <ChevronRight size={18} strokeWidth={2.4} color={FOREST} aria-hidden className="flex-shrink-0" />
    </>
  );
  const style: React.CSSProperties = {
    ...CARD, borderRadius: 16, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 4px 14px rgba(27,56,40,0.07)', textDecoration: 'none', width: '100%', cursor: 'pointer',
  };
  const cls = 'focus:outline-none focus-visible:ring-2 transition-transform active:scale-[0.99]';
  return href
    ? <Link href={href} className={cls} style={style}>{inner}</Link>
    : <button type="button" onClick={onClick} className={cls} style={style}>{inner}</button>;
}

// ── The page ─────────────────────────────────────────────────────────────────

export function SettingsControlPanel({
  conference: c, roles, counts, now, organizerCount, pendingInviteCount,
  publicSaving, onPublicToggle, onRoleToggle, onEditRole, onOpen,
}: {
  conference: Conference;
  roles: RoleSetupConfig[];
  /** Live applications per role (submitted or further); null while loading. */
  counts: Record<string, number> | null;
  now: number;
  organizerCount: number;
  pendingInviteCount: number;
  publicSaving: boolean;
  onPublicToggle: (next: boolean) => void;
  onRoleToggle: (role: string, next: boolean) => void;
  onEditRole: (role: string, step?: string) => void;
  onOpen: (section: PanelSection) => void;
}) {
  const ids = useId();
  const name = c.acronym || c.full_name;
  const gate = paymentGateBlocks(c);
  const noDates = c.dates_tbd || !c.start_date;
  const paymentsReady = conferencePaymentsReady(c);
  const ordered = ROLE_ORDER.map(r => roles.find(x => x.role === r)).filter((x): x is RoleSetupConfig => !!x);

  // Public on Explore. Only private -> public is ever refused (the TBD CHECK
  // and the publish payment gate); taking it private is always allowed.
  const publicBlock = c.is_public ? null : noDates ? 'dates' : gate ? 'payments' : null;

  // Taking applications: a reading of the roles.
  const open = ordered.filter(r => windowState(r, now) === 'open');
  const scheduled = ordered.filter(r => windowState(r, now) === 'scheduled');
  const firstClose = open.map(r => r.applications_close_at).filter((x): x is string => !!x).sort()[0];
  const firstOpen = scheduled.map(r => r.applications_open_at).filter((x): x is string => !!x).sort()[0];
  const appsMark = open.length > 0
    ? { icon: CheckCircle2, word: 'Open', color: FOREST }
    : scheduled.length > 0 ? { icon: Clock, word: 'Soon', color: AMBER } : { icon: MinusCircle, word: 'Closed', color: INK_SOFT };
  const appsLine = open.length > 0
    ? (firstClose ? `Open until ${shortDate(firstClose, now)}` : 'Open, no closing date')
    : scheduled.length > 0 ? `Opens ${shortDate(firstOpen, now)}`
    : gate ? 'Closed until payments are set up' : 'No role is taking applications';

  const subline = c.is_public
    ? 'Everything you might switch during the season, on one screen.'
    : noDates ? 'Add your dates, then switch on Public on Explore.'
    : gate ? 'Set up payments, then switch on Public on Explore.'
    : 'Switch on Public on Explore when you are ready for people to find it.';

  // Everything else, one line of current state each.
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
  const delegationState = c.allow_delegation_import ? 'Leaders can import delegates' : 'Each delegate applies on their own';
  const formRole = ordered.find(r => r.is_enabled)?.role ?? 'delegate';

  function scrollToRoles() {
    const el = document.getElementById(`${ids}-roles`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }

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

      <div className="gvc-tiles mb-5">
        <Tile
          icon={Globe}
          title="Public on Explore"
          control={
            <Switch
              size="lg"
              label="Public on Explore"
              checked={c.is_public}
              busy={publicSaving}
              disabled={!!publicBlock}
              describedBy={`${ids}-pub`}
              onChange={onPublicToggle}
            />
          }
        >
          <span id={`${ids}-pub`}>
            {c.is_public ? 'Anyone can find your page'
              : publicBlock === 'dates' ? <>Add your dates first. <Link href={`/manage/${c.slug}/settings?tab=conference&focus=dates`} style={TEXT_LINK}>Add dates</Link></>
              : publicBlock === 'payments' ? <>Set up payments first. <Link href={`/manage/${c.slug}/financials?open=payment`} style={TEXT_LINK}>Set up</Link></>
              : 'Only people with the link can open it'}
          </span>
        </Tile>

        <Tile
          icon={ClipboardList}
          title="Taking applications"
          control={<StateMark icon={appsMark.icon} word={appsMark.word} color={appsMark.color} />}
        >
          {appsLine}
          {' · '}
          <button type="button" onClick={scrollToRoles} style={{ ...TEXT_LINK, fontSize: 14 }}>See roles</button>
        </Tile>

        <Tile
          icon={CreditCard}
          title="Payments"
          control={paymentsReady
            ? <StateMark icon={CheckCircle2} word="Ready" color={FOREST} />
            : <StateMark icon={CircleDot} word="Not set up" color={AMBER} />}
        >
          {paymentsReady ? paymentSentence(c) : 'Even a free conference needs one'}
          {' · '}
          <Link href={`/manage/${c.slug}/financials?open=payment`} style={{ ...TEXT_LINK, fontSize: 14 }}>{paymentsReady ? 'Change' : 'Set up'}</Link>
        </Tile>
      </div>

      <div className="gvc-body">
        <section
          id={`${ids}-roles`}
          tabIndex={-1}
          aria-labelledby={`${ids}-roles-h`}
          className="gvc-roles min-w-0 focus:outline-none"
          style={{ ...CARD, padding: '20px clamp(16px, 2.4vw, 24px) 10px', scrollMarginTop: 24 }}
        >
          <div className="flex items-baseline justify-between gap-3 flex-wrap pb-2">
            <h2 id={`${ids}-roles-h`} style={{ fontFamily: F, fontSize: 20, fontWeight: 700, color: INK }}>Who Can Apply</h2>
            <span style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT }}>Switch a role on to open it</span>
          </div>

          {gate && (
            <p className="mb-3" style={{ fontFamily: F, fontSize: 14, color: '#6B4F12', lineHeight: 1.5 }}>
              Set up payments before you open a role. Even a free conference needs a way to pay on file.{' '}
              <Link href={`/manage/${c.slug}/financials?open=payment`} style={{ ...TEXT_LINK, fontSize: 14 }}>Set up payments</Link>
            </p>
          )}

          {ordered.length === 0 ? (
            <div aria-busy="true" className="flex flex-col gap-3 py-3">
              {[0, 1, 2, 3].map(i => <span key={i} className="block rounded-lg animate-pulse" style={{ height: 22, backgroundColor: '#F1ECE0' }} />)}
            </div>
          ) : ordered.map(cfg => {
            const st = windowState(cfg, now);
            const blocked = gate && !cfg.is_enabled;
            const plural = rolePlural(cfg.role);
            const count = counts?.[cfg.role];
            return (
              <div key={cfg.role} className="gvc-row">
                <span className="gvc-row-name flex items-center gap-2.5 min-w-0">
                  <Emoji3D name={ROLE_EMOJI[cfg.role] ?? 'Busts in silhouette'} size={22} fallback={UsersRound} fallbackColor={FOREST} />
                  <span style={{ fontFamily: F, fontSize: 16, fontWeight: 600, color: st === 'off' ? INK_SOFT : INK, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{plural}</span>
                </span>
                <span className="gvc-row-detail min-w-0" style={{ fontFamily: F, fontSize: 14, color: INK_SOFT, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                  {st === 'off' ? rowDetail(cfg, now) : `${rolePriceText(cfg, c.fee_currency, now)} · ${rowDetail(cfg, now)}`}
                </span>
                <span className="gvc-row-count" style={{ fontFamily: F, fontSize: 14, color: '#3A2E24', whiteSpace: 'nowrap' }}>
                  {count === undefined ? '' : <><b style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: INK }}>{count}</b> applied</>}
                </span>
                <span className="gvc-row-edit">
                  <button type="button" onClick={() => onEditRole(cfg.role)} aria-label={`Edit ${plural}`} style={{ ...TEXT_LINK, fontSize: 14.5 }}>Edit</button>
                </span>
                <span className="gvc-row-switch" title={blocked ? 'Set up payments before you open a role' : undefined}>
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
        </section>

        <section aria-labelledby={`${ids}-more`} className="min-w-0 flex flex-col gap-2.5">
          <h2 id={`${ids}-more`} style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: INK_SOFT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Everything else</h2>
          <div className="gvc-more">
            <MoreCard icon={Building2} emoji="Classical building" title="Your page" state={pageState} onClick={() => onOpen('conference')} />
            <MoreCard icon={Users2} emoji="Busts in silhouette" title="Your team" state={teamState} onClick={() => onOpen('organizers')} />
            <MoreCard icon={UsersRound} emoji="School" title="Delegations" state={delegationState} onClick={() => onOpen('delegations')} />
            <MoreCard icon={FileText} emoji="Memo" title="Application form" state="The questions each role answers" onClick={() => onEditRole(formRole, 'form')} />
            <MoreCard icon={ShieldCheck} emoji="Locked" title="Privacy" state="Past editions and deleting the conference" onClick={() => onOpen('privacy')} />
          </div>
        </section>
      </div>
    </div>
  );
}
