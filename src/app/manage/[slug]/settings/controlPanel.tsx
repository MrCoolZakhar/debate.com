'use client';

/**
 * Settings → Applications (Oct 2026, bookmarks redesign; owner: "it's too much
 * focused on applications ... there is a few sections that apply automatically
 * to more of them, which i think should be general applications settings -
 * paying, who gets in and what do they rank").
 *
 * One section among equals now (settingsShell.tsx), ONE full-width column since
 * 13 Oct 2026 (owner: "eliminate that extra cream space we have for no
 * reason"): Who Can Apply, then Accepting and Paying under it. What They Rank
 * left this screen the same day (it moves into the delegate and head delegate
 * pop-ups as Preferences; PREF_MODE_OPTIONS and RankPreview stay exported for
 * that). There is no section heading of its own; an sr-only h2 stays.
 *
 *
 *   Who Can Apply    one row per listed role (price, window, number applied,
 *                    Edit, its own switch) and "Add a role" with copy-from.
 *                    Head delegates and Delegates are listed by default
 *                    (panelKit.listedRoles / roleIsSetUp).
 *   Accepting and Paying
 *                    accept everyone straight away (every listed role but the
 *                    secretariat, panelKit.inGeneralScope) and, when a listed
 *                    role charges anything, pay only after you accept them
 *                    (every listed role with a price; Owner Decisions: payment
 *                    settings that do not apply are hidden). Two switches side
 *                    by side, each right beside its words. "Let turned-down
 *                    people try again", "Hide their dashboard until they pay"
 *                    and the "Most you will accept" pointer were removed on
 *                    12 Oct 2026, and the per-role cap left the role pop-up
 *                    the same day.
 *
 * When the roles disagree, the control says so ("Different per role", a gold
 * edge and a switch with its thumb in the middle) and one press uses one
 * answer for every role. These are the only place the rules are set: the
 * role pop-up no longer has per-role overrides (owner, 12 Oct 2026: "remove
 * all of this from the individual apps"). A role whose stored value already
 * differs still reads "Different per role" here until one answer is pressed.
 *
 * A role leaves the list through "Remove this role" in its pop-up
 * (`removedRoles`, see panelKit.listedRoles) and comes back through Add a
 * role.
 *
 * Presentation only. Every write is the settings page's own handler.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight, Plus, X, ArrowLeft, Copy, FilePlus2,
  DoorOpen, Ban, Hand, Check, Eye,
} from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import type { Conference } from '@/app/manage/[slug]/layout';
import { ROLE_ORDER } from './applicationsUi';
import {
  F, INK, INK_SOFT, FOREST, TEXT_LINK,
  Switch, windowState, closedByDate, shortDate, rolePriceText, rolePlural, roleHasPrice, roleIsFree,
  Group, SwitchRow, SwitchGrid, TINT_GOLD_BG, TINT_GREEN_BG, EmojiDisc, RoleDisc, TYPE, TYPE_PX,
  generalAnswer, inGeneralScope, listedRoles, type GeneralField, type RoleSetupConfig,
  FixBadge,
} from './panelKit';
import { roleSetupProblems } from '@/lib/roleSetupProblems';

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

/** RankPreview's look, also mounted by the role pop-up's Preferences (13 Oct 2026). */
export const RANK_PREVIEW_CSS = `
.gvc-mini { display: flex; flex-direction: column; justify-content: center; gap: 7px; padding: 10px 12px; border-radius: 12px; background: #FFFFFF; box-shadow: 0 1px 0 rgba(27,56,40,0.06); min-height: 86px; }
.gvc-mini-row { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: ${INK}; line-height: 1.2; }
.gvc-mini-n { width: 20px; height: 20px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-size: 11.5px; font-weight: 800; background: rgba(238,217,138,0.55); color: #6B4F12; }
`;

const CSS = `
/* One full-width column (13 Oct 2026): Who Can Apply, then Accepting and Paying. */
.gvc-app { container-type: inline-size; }
.gvc-cols { display: flex; flex-direction: column; gap: 20px; }
/* Role rows: white raised cards; a role that is taking applications gets the
   green wash and a forest edge (owner, 12 Oct 2026: "slightly bigger icons and
   nicer cards"). Phone: the role and its switch, then price and window, then the
   applied count and Edit, then the two link actions folded under the main line. */
.gvc-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "name switch" "detail detail" "count edit" "links links";
  column-gap: 12px; row-gap: 6px; align-items: center; padding: 12px 16px 12px 12px; border-radius: 16px; background: #FFFFFF;
  box-shadow: 0 1px 0 rgba(27,56,40,0.08), 0 10px 24px -18px rgba(27,56,40,0.45), inset 0 0 0 1px rgba(27,56,40,0.06);
  transition: background-color 160ms ease, box-shadow 160ms ease; }
.gvc-row[data-on="true"] { background: radial-gradient(90% 140% at 0% 0%, rgba(238,217,138,0.22) 0%, rgba(238,217,138,0) 55%), linear-gradient(150deg, rgba(61,122,82,0.14), rgba(61,122,82,0.04)), #FFFFFF;
  box-shadow: inset 4px 0 0 #2A5A3C, inset 0 0 0 1px rgba(42,90,60,0.22), 0 1px 0 rgba(27,56,40,0.08), 0 12px 26px -18px rgba(27,56,40,0.55); }
.gvc-row[data-fix="true"] { box-shadow: inset 4px 0 0 #B6871F, inset 0 0 0 1px rgba(182,135,31,0.35), 0 1px 0 rgba(27,56,40,0.08), 0 10px 24px -18px rgba(27,56,40,0.45); }
.gvc-row-name { grid-area: name; } .gvc-row-detail { grid-area: detail; } .gvc-row-count { grid-area: count; }
.gvc-row-edit { grid-area: edit; justify-self: end; } .gvc-row-switch { grid-area: switch; justify-self: end; }
.gvc-row-links { grid-area: links; display: flex; flex-wrap: wrap; gap: 6px; }
.gvc-link { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border-radius: 10px; border: none; cursor: pointer;
  background: rgba(27,56,40,0.05); color: ${FOREST}; font-family: ${F}; font-size: 13.5px; font-weight: 700; text-decoration: none; white-space: nowrap;
  transition: background-color 150ms ease, transform 120ms ease; }
.gvc-link:hover { background: rgba(27,56,40,0.10); }
.gvc-link:active { transform: scale(0.97); }
.gvc-link:focus { outline: none; }
.gvc-link:focus-visible { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px ${FOREST}; }
@container (min-width: 560px) {
  .gvc-row { grid-template-columns: minmax(0, 1fr) auto auto; grid-template-areas: "name name switch" "detail count edit" "links links links"; row-gap: 4px; }
  .gvc-row-detail { padding-inline-start: 60px; } .gvc-row-links { padding-inline-start: 60px; }
  .gvc-row-count { justify-self: end; }
}
/* The full width: one line, the two links between the window and the count. */
@container (min-width: 1000px) {
  .gvc-row-detail, .gvc-row-links { padding-inline-start: 0; }
  .gvc-row { grid-template-columns: minmax(180px, 1fr) minmax(0, 1.6fr) auto 96px auto auto; grid-template-areas: "name detail links count edit switch"; column-gap: 16px; }
  .gvc-row-links { justify-content: flex-end; }
}
.gvc-pick { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 520px) { .gvc-pick { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
/* What they rank: one choice per row, a preview on the left. */
.gvc-rank { display: flex; flex-direction: column; gap: 8px; }
.gvc-rank-card { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: center; padding: 12px; border-radius: 16px; border: none; cursor: pointer; text-align: left;
  background: #FAF8F3; font-family: ${F}; box-shadow: inset 0 0 0 1.5px rgba(27,56,40,0.10); transition: box-shadow 160ms ease, background-color 160ms ease, transform 120ms ease; }
@container (min-width: 480px) { .gvc-rank-card { grid-template-columns: 240px minmax(0, 1fr); column-gap: 16px; } }
.gvc-rank-card:hover { background: #F5F0E4; }
.gvc-rank-card:active { transform: scale(0.995); }
.gvc-rank-card:focus { outline: none; }
.gvc-rank-card:focus-visible { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px ${FOREST}; }
.gvc-rank-card[aria-checked="true"] { background: linear-gradient(150deg, rgba(61,122,82,0.14), rgba(61,122,82,0.05)); box-shadow: inset 0 0 0 2px ${FOREST}, 0 10px 22px -16px rgba(27,56,40,0.6); }
${RANK_PREVIEW_CSS}
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The role's window in words, and its colour (13 Oct 2026): closed in the danger red, open in
 *  the success green, opening later muted. A role switched off BECAUSE its closing date passed
 *  (the hourly switch-off-closed-roles job) still reads "closed {date}"; one switched off by
 *  hand reads "Not taking applications". */
const TONE = { closed: '#8B2020', open: '#2A5A3C', muted: INK_SOFT } as const;
function rowDetail(cfg: RoleSetupConfig, now: number): { text: string; tone: keyof typeof TONE; price: boolean } {
  const st = windowState(cfg, now);
  if (st === 'off') {
    return closedByDate(cfg, now)
      ? { text: `closed ${shortDate(cfg.applications_close_at, now)}`, tone: 'closed', price: true }
      : { text: 'Not taking applications', tone: 'muted', price: false };
  }
  if (st === 'scheduled') return { text: `opens ${shortDate(cfg.applications_open_at, now)}`, tone: 'muted', price: true };
  if (st === 'closed') return { text: `closed ${shortDate(cfg.applications_close_at, now)}`, tone: 'closed', price: true };
  return { text: cfg.applications_close_at ? `open until ${shortDate(cfg.applications_close_at, now)}` : 'open, no closing date', tone: 'open', price: true };
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** "On for Delegates, off for Head delegates." */
function splitLine(answer: ReturnType<typeof generalAnswer>, field: GeneralField): string {
  const on = answer.roles.filter(r => (field === 'payment_timing' ? r.payment_timing === 'after_acceptance' : !!r[field as 'auto_accept']));
  const off = answer.roles.filter(r => !on.includes(r));
  return `On for ${joinWords(on.map(r => rolePlural(r.role)))}, off for ${joinWords(off.map(r => rolePlural(r.role)).map(w => w.toLowerCase()))}. Switch it to use one answer for every role.`;
}

// ── Add a role ───────────────────────────────────────────────────────────────

function AddRole({ hidden, setUp, onAdd }: {
  hidden: RoleSetupConfig[];
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
      <div className="pt-1">
        <button type="button" onClick={() => setOpen(true)} className="gv-st-btn gv-st-outline">
          <Plus size={16} strokeWidth={2.6} aria-hidden />
          Add a role
        </button>
      </div>
    );
  }

  const target = picked ? hidden.find(r => r.role === picked) : null;
  const templates = target ? setUp.filter(s => s.role !== target.role) : [];
  const choice: React.CSSProperties = { borderRadius: 14, padding: '11px 13px', cursor: 'pointer', backgroundColor: '#FFFFFF', border: 'none', boxShadow: '0 1px 0 rgba(27,56,40,0.08), 0 8px 18px -14px rgba(27,56,40,0.45)' };

  return (
    <div
      ref={boxRef}
      className="rounded-2xl p-4"
      style={{ background: 'linear-gradient(150deg, rgba(238,217,138,0.30), rgba(238,217,138,0.10))' }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p style={TYPE.card}>
          {target ? `Set Up ${rolePlural(target.role)}` : 'Which Role?'}
        </p>
        <button type="button" onClick={close} aria-label="Cancel adding a role" className="flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 rounded-full" style={{ width: 40, height: 40, border: 'none', background: '#FFFFFF', cursor: 'pointer', color: INK }}>
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
              style={choice}
            >
              <RoleDisc role={r.role} tint={TINT_GREEN_BG} size={38} />
              <span className="min-w-0">
                <span className="block" style={{ ...TYPE.label, fontWeight: 700 }}>{rolePlural(r.role)}</span>
                <span className="block" style={{ ...TYPE.hint, overflowWrap: 'anywhere' }}>{ROLE_LINE[r.role]}</span>
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
            style={choice}
          >
            <EmojiDisc emoji="Sparkles" icon={FilePlus2} tint={TINT_GOLD_BG} size={38} />
            <span className="min-w-0">
              <span className="block" style={{ ...TYPE.label, fontWeight: 700 }}>Start from scratch</span>
              <span className="block" style={TYPE.hint}>An empty form, switched off, with your rules for every role</span>
            </span>
          </button>
          {templates.map(s => {
            const withQuestions = Array.isArray(s.custom_questions) && s.custom_questions.length > 0;
            const withPrice = roleHasPrice(target.role) && roleHasPrice(s.role) && !roleIsFree(s);
            if (!withQuestions && !withPrice) return null;
            return (
              <button
                key={s.role}
                type="button"
                onClick={() => { onAdd(target.role, s.role); close(); }}
                className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 active:scale-[0.99] transition-transform"
                style={choice}
              >
                <EmojiDisc emoji="Card index dividers" icon={Copy} tint={TINT_GREEN_BG} size={38} />
                <span className="min-w-0">
                  <span className="block" style={{ ...TYPE.label, fontWeight: 700, overflowWrap: 'anywhere' }}>Copy from {rolePlural(s.role)}</span>
                  <span className="block" style={TYPE.hint}>{withQuestions && withPrice ? 'Copies the questions and the prices' : withQuestions ? 'Copies the questions' : 'Copies the prices'}</span>
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1.5 self-start mt-1 focus:outline-none focus-visible:ring-2 rounded" style={{ ...TEXT_LINK, fontSize: TYPE_PX.hint }}>
            <ArrowLeft size={14} strokeWidth={2.5} aria-hidden />
            Pick another role
          </button>
        </div>
      )}
    </div>
  );
}

// ── What they rank: a small preview of the applicant's form per choice ───────

export function RankPreview({ value }: { value: string }) {
  const n = (i: number) => <span className="gvc-mini-n">{i}</span>;
  if (value === 'none') {
    return (
      <div className="gvc-mini" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <EmojiDisc emoji="Prohibited" icon={Ban} tint={TINT_GOLD_BG} size={36} />
        <span className="gvc-mini-row" style={{ color: INK_SOFT, textAlign: 'center' }}>No ranking step</span>
      </div>
    );
  }
  const rows: { com?: string; country?: { code: string; name: string } }[] =
    value === 'committees_and_countries' ? [{ com: 'DISEC', country: { code: 'fr', name: 'France' } }, { com: 'UNSC', country: { code: 'jp', name: 'Japan' } }]
    : value === 'committees_only' ? [{ com: 'DISEC' }, { com: 'UNHRC' }]
    : [{ country: { code: 'fr', name: 'France' } }, { country: { code: 'br', name: 'Brazil' } }];
  return (
    <div className="gvc-mini" aria-hidden>
      {rows.map((r, i) => (
        <span key={i} className="gvc-mini-row">
          {n(i + 1)}
          {r.com && <span style={{ fontWeight: 800 }}>{r.com}</span>}
          {r.com && r.country && <span style={{ color: INK_SOFT }}>·</span>}
          {r.country && <><CircleFlag code={r.country.code} size={18} decorative /><span>{r.country.name}</span></>}
        </span>
      ))}
    </div>
  );
}

// ── The section ──────────────────────────────────────────────────────────────

export function ApplicationsSection({
  conference: c, roles, counts, now, extraRoles, removedRoles = [],
  onRoleToggle, onEditRole, onAddRole, onSaveAll, linkCopied = false, copiedRole = null, onCopyLink,
}: {
  conference: Conference;
  roles: RoleSetupConfig[];
  /** Live applications per role (submitted or further); null while loading. */
  counts: Record<string, number> | null;
  now: number;
  /** Roles the organiser added on this browser (or has open right now). */
  extraRoles: readonly string[];
  /** Roles removed with "Remove this role" on this browser. */
  removedRoles?: readonly string[];
  onRoleToggle: (role: string, next: boolean) => void;
  onEditRole: (role: string, step?: string) => void;
  onAddRole: (role: string, copyFrom: string | null) => void;
  /** One value for every covered role (the page writes them in one update). */
  onSaveAll: (updates: Partial<RoleSetupConfig>, roles: string[]) => void;
  /** The page's copied-feedback for "Copy application link", and which role it was for. */
  linkCopied?: boolean;
  copiedRole?: string | null;
  onCopyLink?: (role: string) => void;
}) {
  const ordered = ROLE_ORDER.map(r => roles.find(x => x.role === r)).filter((x): x is RoleSetupConfig => !!x);
  const listed = listedRoles(ordered, counts, extraRoles, removedRoles);
  const hidden = ordered.filter(r => !listed.includes(r));
  const auto = generalAnswer(listed, 'auto_accept');
  const timing = generalAnswer(listed, 'payment_timing');
  const anyPaid = listed.some(r => roleHasPrice(r.role) && !roleIsFree(r));
  const showTiming = anyPaid && timing.roles.length > 0;
  const showAccept = auto.roles.length > 0 || showTiming;

  function saveAll(field: GeneralField, value: unknown) {
    const targets = listed.filter(r => inGeneralScope(field, r.role)).map(r => r.role);
    if (targets.length === 0) return;
    onSaveAll({ [field]: value } as Partial<RoleSetupConfig>, targets);
  }

  if (ordered.length === 0) {
    return (
      <div aria-busy="true" className="gvc-app">
        <style>{CSS}</style>
        <div className="gvc-cols">
          <div className="gv-fd-ph" style={{ height: 320 }} />
          <div className="gv-fd-ph" style={{ height: 140 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="gvc-app">
      <style>{CSS}</style>
      {/* The section's own heading with the applications count was removed
          (owner, 12 Oct 2026: "no need to have the top heading with the
          amount of delegates"); the h2 stays for screen readers. */}
      <h2 className="sr-only">Applications</h2>
      <div className="gvc-cols">
        {/* ── Who can apply ── */}
        <Group id="who-can-apply" title="Who Can Apply" emoji="Identification card" icon={Hand} tint={TINT_GOLD_BG}>
          {listed.map(cfg => {
            const plural = rolePlural(cfg.role);
            const count = counts?.[cfg.role];
            const detail = rowDetail(cfg, now);
            const copied = linkCopied && copiedRole === cfg.role;
            const fixes = roleSetupProblems(cfg).length;
            return (
              <div key={cfg.role} className="gvc-row" data-on={cfg.is_enabled ? 'true' : undefined} data-fix={fixes > 0 ? 'true' : undefined}>
                <span className="gvc-row-name flex items-center gap-2.5 min-w-0">
                  <RoleDisc role={cfg.role} tint={cfg.is_enabled ? TINT_GREEN_BG : TINT_GOLD_BG} size={50} />
                  <span style={{ ...TYPE.card, overflowWrap: 'anywhere' }}>{plural}</span>
                  <FixBadge n={fixes} />
                </span>
                <span className="gvc-row-detail min-w-0" style={{ ...TYPE.body, color: INK_SOFT, overflowWrap: 'anywhere' }}>
                  {detail.price && <><b style={{ color: INK, fontWeight: 800 }}>{rolePriceText(cfg, c.fee_currency, now)}</b> · </>}
                  <span style={{ color: TONE[detail.tone], fontWeight: detail.tone === 'muted' ? undefined : 700 }}>{detail.text}</span>
                </span>
                {/* Moved out of the pop-up's notice card (13 Oct 2026): the same link and preview. */}
                <span className="gvc-row-links">
                  {onCopyLink && (
                    <button type="button" className="gvc-link" onClick={() => onCopyLink(cfg.role)} aria-label={`Copy the application link for ${plural}`}>
                      {copied ? <Check size={15} strokeWidth={3} aria-hidden /> : <Copy size={15} strokeWidth={2.3} aria-hidden />}
                      {copied ? 'Link copied' : 'Copy application link'}
                    </button>
                  )}
                  <a href={`/conferences/${c.slug}/apply?role=${cfg.role}&preview=1`} target="_blank" rel="noopener noreferrer" className="gvc-link" aria-label={`Preview the form for ${plural}`}>
                    <Eye size={15} strokeWidth={2.3} aria-hidden />
                    Preview the form
                  </a>
                </span>
                <span className="gvc-row-count" style={{ ...TYPE.hint, whiteSpace: 'nowrap' }}>
                  {count === undefined ? '' : <><b style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: FOREST }}>{count}</b> applied</>}
                </span>
                <span className="gvc-row-edit">
                  <button type="button" aria-label={`Edit ${plural}`} onClick={() => onEditRole(cfg.role)} className="gv-st-btn gv-st-outline" style={{ minHeight: 38, padding: '0 12px' }}>
                    Edit<ChevronRight size={16} strokeWidth={2.4} aria-hidden />
                  </button>
                </span>
                {/* A role opens at any time: applications never wait for payments (owner, 12 Oct 2026). */}
                <span className="gvc-row-switch">
                  <Switch label={`${plural} taking applications`} checked={cfg.is_enabled} onChange={(next) => onRoleToggle(cfg.role, next)} />
                </span>
              </div>
            );
          })}
          <AddRole hidden={hidden} setUp={listed} onAdd={onAddRole} />
        </Group>

        {/* ── Accepting and paying (every role), full width under Who Can Apply ── */}
            {showAccept && (
              <Group title="Accepting and Paying" emoji="Door" icon={DoorOpen} aside={<EveryRole />}>
                <SwitchGrid>
                  {auto.roles.length > 0 && (
                    <SwitchRow
                      label="Accept everyone straight away"
                      desc={auto.mixed ? splitLine(auto, 'auto_accept') : 'Off: you review each application.'}
                      checked={auto.value === true}
                      mixed={auto.mixed}
                      onChange={(v) => saveAll('auto_accept', v)}
                    />
                  )}
                  {showTiming && (
                    <SwitchRow
                      label="Pay only after you accept them"
                      desc={timing.mixed ? splitLine(timing, 'payment_timing') : 'Off: they can pay as soon as they apply. Roles with a price only.'}
                      checked={timing.value === 'after_acceptance'}
                      mixed={timing.mixed}
                      onChange={(v) => saveAll('payment_timing', v ? 'after_acceptance' : 'anytime')}
                    />
                  )}
                </SwitchGrid>
              </Group>
            )}
      </div>
    </div>
  );
}

function EveryRole() {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ ...TYPE.hint, fontWeight: 700, color: '#6B4F12', background: 'rgba(238,217,138,0.4)', padding: '3px 10px', borderRadius: 8 }}>
      Every role
    </span>
  );
}
