'use client';

// ─────────────────────────────────────────────────────────────────────────────
// WHO GETS IT — a bar, not a form.
//
// The thing this replaces was a seven-column grid of filter chips sitting in a
// panel below the editor: everything visible at once, nothing answering the
// only question anybody actually has, which is "so who is getting this?"
//
// The answer here is the FIRST thing on the screen and it never leaves it. The
// bar is sticky. It says, in a sentence a child can read, "Going to 247 people
// — delegates who haven't paid", and beside it a meter showing 247 of 685. One
// button opens the picker.
//
// Inside the picker there are three steps and they are ordered by how many
// people ever need them:
//
//   1  WHO           six big tiles — Everyone, then each role. Most sends stop
//                    here. Nothing is preselected, and nothing selected means
//                    everyone, which is stated on the tile rather than implied.
//   2  NARROW IT     the other six filters DO NOT EXIST until you ask for one.
//                    "+ Add a filter" offers them by name; picking one unfolds
//                    a single row. This is the whole fix for "too much
//                    information, too crammed" — the screen only ever shows the
//                    questions you have actually asked.
//   3  THE PEOPLE    one dot per person, in a stable order, dark when they are
//                    getting it. Filters light dots up and dim them down, so
//                    the count is something you SEE rather than something you
//                    are told. Below that, the same people as a grouped list
//                    you can remove individuals from, plus search-to-add.
//
// Every choice everywhere carries its own live count, which is the one part of
// the old panel that worked.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Plus, X, Search, Users, Send, AlertTriangle, Check, SlidersHorizontal,
} from 'lucide-react';
import { Emoji3D, NEU, NEU_GRADIENTS, OUTFIT, EASE } from '@/components/neu';
import { SOFT, AMBER_INK, GREEN_INK, RED, CARD_BORDER, CARD_SHADOW } from '@/app/manage/[slug]/live/tokens';
import ProfileLink from '@/components/ProfileLink';
import PopoverLayer from '@/components/email/PopoverLayer';
import Portal from '@/components/Portal';

const FOREST = '#1B3828';
const GOLD = '#EED98A';
const INK = '#1C1410';

export type AudienceSection = 'roles' | 'payment' | 'committees' | 'delegations' | 'attendance' | 'status' | 'aid';

export interface AudienceOption { value: string; label: string }

export interface AudienceSectionDef {
  key: AudienceSection;
  /** Panel heading, e.g. "Payment". */
  label: string;
  /** Fluent 3D emoji asset name for the "+ Add a filter" menu. */
  emoji: string;
  /** How this section reads inside the plain-English summary sentence, e.g.
   *  "who have {v}" → "who have paid". `{v}` is the joined option labels. */
  phrase: string;
  options: AudienceOption[];
  selected: Set<string>;
  /** Live reach for each option WITH the other filters applied. */
  counts: Record<string, number>;
}

export interface ReachPerson {
  id: string;
  name: string;
  /** Pre-joined one-liner. Still the fallback everywhere, so a caller that
   *  has not been taught the structured fields below still renders sensibly. */
  sub: string;
  avatarUrl: string | null;
  userId: string | null;
  registered: boolean;
  optedOut: boolean;
  manual: boolean;
  // ── The same facts, kept apart ────────────────────────────────────────────
  // RecipientRoster shows a person's address, delegation, allocation and role
  // on their own lines, which a single joined string cannot be split back
  // into. All OPTIONAL: the roster degrades to `sub` when they are absent, so
  // adding them is a pure improvement rather than a breaking change.
  email?: string | null;
  /** "Delegate", "Chair", "Faculty Advisor"… */
  roleLabel?: string | null;
  /** The school or society they came with. */
  delegation?: string | null;
  /** The committee they were allocated to, acronym preferred. */
  committee?: string | null;
  /** The country or seat they represent. */
  country?: string | null;
}

export interface ReachGroup {
  key: string;
  label: string;
  members: ReachPerson[];
  optedOut: number;
}

export type DotState = 'in' | 'opted' | 'out';

interface Props {
  /** Ordered; `roles` is treated as step 1 and the rest as optional narrowers. */
  sections: AudienceSectionDef[];
  onToggle: (section: AudienceSection, value: string) => void;
  onClearSection: (section: AudienceSection) => void;
  onClearAll: () => void;
  /** One entry per eligible person, in a STABLE order — the dot field only
   *  reads as "these people light up" if the dots never reshuffle. */
  dots: DotState[];
  reachCount: number;
  optedOutCount: number;
  groups: ReachGroup[];
  manualQuery: string;
  onManualQuery: (v: string) => void;
  manualMatches: { id: string; name: string; sub: string }[];
  onAddPerson: (id: string) => void;
  onRemovePerson: (id: string) => void;
  manualAddedCount: number;
  excludedCount: number;
  /** A saved audience was restored from the template. */
  restored: boolean;
  onSend: () => void;
  sendDisabled: boolean;
  sendBusyLabel: string | null;
}

/** Beyond this the field stops being one-dot-per-person and says so, rather
 *  than putting ten thousand nodes in the document. */
const MAX_DOTS = 900;

/** Sticky is a desktop affordance here. On a phone this bar is a third of the
 *  screen tall, and pinning a third of the screen is not "always visible", it
 *  is "always in the way". */
function useIsWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return wide;
}

const ROLE_EMOJI: Record<string, string> = {
  delegate: 'Person raising hand',
  chair: 'Studio microphone',
  'head-delegate': 'People holding hands',
  'faculty-advisor': 'Handshake',
  observer: 'Card index',
};

function joinLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** The sentence. This is the thing that has to survive the ten-year-old test,
 *  so it is built out of whole clauses rather than a chip salad. */
function describeAudience(sections: AudienceSectionDef[], manualAdded: number, excluded: number): string {
  const roles = sections.find(s => s.key === 'roles');
  const rolePart = roles && roles.selected.size > 0
    ? joinLabels(roles.options.filter(o => roles.selected.has(o.value)).map(o => o.label))
    : 'Everyone';

  const clauses: string[] = [];
  for (const s of sections) {
    if (s.key === 'roles' || s.selected.size === 0) continue;
    const labels = joinLabels(s.options.filter(o => s.selected.has(o.value)).map(o => o.label.toLowerCase()));
    clauses.push(s.phrase.replace('{v}', labels));
  }

  let out = rolePart + (clauses.length ? ' ' + clauses.join(', ') : '');
  if (manualAdded > 0) out += `, plus ${manualAdded} added by hand`;
  if (excluded > 0) out += `, minus ${excluded} you took off`;
  return out;
}

function BigNumber({ n }: { n: number }) {
  return (
    <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
      {n.toLocaleString()}
    </span>
  );
}

/** The meter: how much of the whole conference this send covers. Decorative
 *  fill only — the number beside it carries the meaning. */
function ReachMeter({ reach, total }: { reach: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (reach / total) * 100) : 0;
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ height: 10, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.10)', boxShadow: NEU.inSm, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
            transitionProperty: 'width',
            transitionDuration: '420ms',
            transitionTimingFunction: EASE,
          }}
        />
      </div>
      <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
        {reach.toLocaleString()} of {total.toLocaleString()} people
      </p>
    </div>
  );
}

function DotField({ dots }: { dots: DotState[] }) {
  const shown = dots.length > MAX_DOTS ? dots.slice(0, MAX_DOTS) : dots;
  return (
    <div>
      <div
        className="flex flex-wrap"
        style={{ gap: 4, padding: 12, borderRadius: 16, backgroundColor: 'rgba(27,56,40,0.045)', boxShadow: NEU.inSm }}
      >
        {shown.map((d, i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              flexShrink: 0,
              backgroundColor: d === 'in' ? FOREST : d === 'opted' ? 'rgba(126,81,40,0.28)' : 'rgba(27,56,40,0.13)',
              border: d === 'opted' ? `1px solid ${AMBER_INK}` : 'none',
              transitionProperty: 'background-color, border-color',
              transitionDuration: '260ms',
              transitionTimingFunction: EASE,
            }}
          />
        ))}
        {dots.length === 0 && (
          <span style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT }}>Nobody has applied yet.</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: FOREST }} /> getting it
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.13)' }} /> not this time
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: 'rgba(126,81,40,0.28)', border: `1px solid ${AMBER_INK}` }} /> said no to emails
        </span>
        {dots.length > MAX_DOTS && (
          <span style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
            showing the first {MAX_DOTS.toLocaleString()} of {dots.length.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

/** An informational badge. House rule (AGENTS.md → UI RULES): an "i"/hint
 *  affordance reveals on HOVER and FOCUS, never on click, and its panel is
 *  portaled so no ancestor's overflow can clip it.
 *
 *  This exists so a sentence that used to occupy a whole 29px line of the
 *  sticky bar — every time, whether or not anyone cared — becomes a glyph and
 *  a number. The words are not lost; they are one hover away. */
function HintChip({
  icon: Icon, label, tone, children,
}: {
  icon: typeof AlertTriangle;
  /** The number/word that stays visible. The prose lives in `children`. */
  label: string;
  tone: 'amber' | 'quiet';
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  /** A close DELAY so the pointer can travel from the chip into the panel. */
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => () => cancelClose(), []);
  const ink = tone === 'amber' ? AMBER_INK : SOFT;
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={typeof children === 'string' ? children : label}
        onMouseEnter={() => { cancelClose(); setOpen(true); }}
        onMouseLeave={scheduleClose}
        onFocus={() => { cancelClose(); setOpen(true); }}
        onBlur={scheduleClose}
        className="inline-flex items-center gap-1 focus:outline-none flex-shrink-0"
        style={{
          minHeight: 26, padding: '4px 9px', borderRadius: 999,
          border: `1px solid ${tone === 'amber' ? 'rgba(126,81,40,0.30)' : 'rgba(27,56,40,0.16)'}`,
          backgroundColor: tone === 'amber' ? 'rgba(126,81,40,0.09)' : 'transparent',
          fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, color: ink,
          fontVariantNumeric: 'tabular-nums', cursor: 'help',
        }}
      >
        <Icon size={11} strokeWidth={2.6} />
        {label}
      </button>
      <PopoverLayer anchorRef={ref} open={open} onClose={() => setOpen(false)} width={252} maxHeight={200} align="end">
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            padding: '10px 12px', borderRadius: 14,
            backgroundColor: NEU.surface, border: CARD_BORDER, boxShadow: CARD_SHADOW,
            fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.5, color: ink, textWrap: 'pretty',
          }}
        >
          {children}
        </div>
      </PopoverLayer>
    </>
  );
}

function StepHeading({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 24, height: 24, borderRadius: 999,
          background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
          color: GOLD, fontFamily: OUTFIT, fontSize: 12, fontWeight: 900,
          boxShadow: '0 3px 8px rgba(27,56,40,0.26)',
        }}
      >
        {n}
      </span>
      <span className="min-w-0">
        <span className="block" style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 900, color: INK, textWrap: 'balance' }}>
          {title}
        </span>
        {hint && (
          <span className="block" style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

export default function AudienceReach({
  sections, onToggle, onClearSection, onClearAll, dots, reachCount, optedOutCount, groups,
  manualQuery, onManualQuery, manualMatches, onAddPerson, onRemovePerson,
  manualAddedCount, excludedCount, restored, onSend, sendDisabled, sendBusyLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  /** Narrowers the person has explicitly asked for. A section with something
   *  already selected (a restored audience) counts as asked-for. */
  const [openNarrowers, setOpenNarrowers] = useState<Set<AudienceSection>>(new Set());
  const wide = useIsWide();
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const closeAddMenu = useCallback(() => setAddMenuOpen(false), []);
  const closeSearch = useCallback(() => onManualQuery(''), [onManualQuery]);

  /** Modal manners: Escape closes it, and the page behind it does not scroll
   *  while it is up (otherwise the wheel scrolls the builder out from under
   *  the dialog and you land somewhere else when you close it). */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const roleSection = sections.find(s => s.key === 'roles') ?? null;
  const narrowers = useMemo(() => sections.filter(s => s.key !== 'roles' && s.options.length > 0), [sections]);
  const activeNarrowers = useMemo(
    () => narrowers.filter(s => s.selected.size > 0 || openNarrowers.has(s.key)),
    [narrowers, openNarrowers]
  );
  const availableNarrowers = useMemo(
    () => narrowers.filter(s => !activeNarrowers.includes(s)),
    [narrowers, activeNarrowers]
  );

  const total = dots.length;
  const summary = describeAudience(sections, manualAddedCount, excludedCount);
  const anySelection = sections.some(s => s.selected.size > 0) || manualAddedCount > 0 || excludedCount > 0;

  function closeNarrower(key: AudienceSection) {
    onClearSection(key);
    setOpenNarrowers(s => { const n = new Set(s); n.delete(key); return n; });
  }

  const panelStyle: React.CSSProperties = {
    backgroundColor: NEU.surface,
    border: CARD_BORDER,
    boxShadow: CARD_SHADOW,
    borderRadius: 22,
  };

  return (
    <>
      <div
        className="mb-3"
        style={{
          // Sticky so "who gets it" is never off-screen. The picker no longer
          // unfolds inside this bar (it is a modal now), so the bar can stay
          // sticky in every state instead of dropping to static when opened.
          position: wide ? 'sticky' : 'relative',
          // 76, not 0: SiteNav is a `fixed top-0 h-[72px] z-40` floating pill
          // (src/components/SiteNav.tsx:109) that would otherwise sit straight
          // on top of the recipient count. This parks the bar just under it.
          //
          // ONLY WHEN STICKY. `top` on a `position: relative` box is not an
          // anchor, it is a 76px shove: the bar rendered 76px below its own
          // flow slot, leaving a hole above it and overlapping the palette
          // panel below. That is what it did on every phone (`!wide`) and at
          // every width while the old drop-down was open.
          ...(wide ? { top: 76 } : null),
          zIndex: 30,
        }}
      >
        <div style={panelStyle}>
          {/* ── The bar. One row, and it stays one row: it is pinned to the top
              of the screen, so every pixel it takes is a pixel of the email
              nobody can see. ── */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5" style={{ padding: '9px 13px' }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 38, height: 38, borderRadius: 13,
                background: `linear-gradient(135deg, ${NEU_GRADIENTS.gold[0]}40, ${NEU_GRADIENTS.gold[1]}33), ${NEU.surface}`,
                boxShadow: NEU.outSm,
              }}
            >
              <Emoji3D name="Busts in silhouette" size={21} fallback={Users} fallbackColor={FOREST} />
            </span>

            <div className="min-w-0 flex-1" style={{ minWidth: 190 }}>
              <p style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 900, color: INK, lineHeight: 1.3 }}>
                Going to <BigNumber n={reachCount} /> {reachCount === 1 ? 'person' : 'people'}
              </p>
              <span className="flex items-start gap-1.5 min-w-0">
                {/* One line while the bar is PINNED — its height comes
                    straight out of the email's. A phone's bar is not pinned,
                    so it gets two. Either way this is a SUMMARY, deliberately
                    bounded: the sentence in full is the `title`, and it is
                    restated unabridged as the modal's own subtitle one tap
                    away, so nothing here is the only copy of anything. */}
                <span
                  className={wide ? 'truncate' : ''}
                  style={{
                    fontFamily: OUTFIT, fontSize: 12, color: SOFT, lineHeight: 1.45, textWrap: 'pretty',
                    ...(wide ? null : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
                  }}
                  title={summary}
                >
                  {summary}
                </span>
                {optedOutCount > 0 && (
                  <HintChip icon={AlertTriangle} tone="amber" label={String(optedOutCount)}>
                    {optedOutCount} {optedOutCount === 1 ? 'person has' : 'people have'} turned off marketing emails. They are left off automatically and are not in the count.
                  </HintChip>
                )}
              </span>
            </div>

            <div className="hidden lg:block flex-shrink-0">
              <ReachMeter reach={reachCount} total={total} />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 focus:outline-none"
                style={{
                  minHeight: 44, padding: '11px 15px', borderRadius: 999,
                  border: CARD_BORDER, backgroundColor: '#FFFDF8',
                  fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em',
                  color: FOREST, cursor: 'pointer',
                  transitionProperty: 'background-color', transitionDuration: '180ms',
                }}
              >
                <SlidersHorizontal size={13} strokeWidth={2.6} />
                CHANGE WHO
              </button>
              <SendButton onClick={onSend} disabled={sendDisabled} count={reachCount} busy={sendBusyLabel} />
            </div>
          </div>
        </div>
      </div>

      {/* ── The picker. A MODAL, not a drop-down.
          As an inline unfold it was a 954px panel that shoved the whole
          builder 850px down the page — you changed the audience by losing
          sight of the email. As a dialog it covers the screen while you are in
          it and gives it all back when you leave. Everything that worked
          survives: the six role tiles, "+ Add a filter", the dot field, every
          per-option count and the running total (now in the footer, next to
          the way out). ── */}
      {open && (
        <Portal>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose who gets this email"
            onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}
            style={{
              position: 'fixed', inset: 0,
              // Below PopoverLayer's 200 ON PURPOSE: "+ Add a filter" and the
              // add-a-person typeahead portal themselves to the same layer and
              // have to float ABOVE this dialog, not behind it.
              zIndex: 120,
              backgroundColor: 'rgba(27,56,40,0.42)',
              display: 'flex',
              alignItems: wide ? 'center' : 'flex-end',
              justifyContent: 'center',
              padding: wide ? 24 : 0,
            }}
          >
            <div
              style={{
                ...panelStyle,
                width: '100%',
                maxWidth: 860,
                // A phone gets a bottom sheet: full width, square top corners
                // against the screen edge, and room left above it so the page
                // behind stays visible and the sheet reads as a layer.
                maxHeight: wide ? '86vh' : '92vh',
                borderRadius: wide ? 24 : '22px 22px 0 0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                className="flex items-center gap-3 flex-shrink-0"
                style={{ padding: '14px 16px', borderBottom: '1px solid rgba(27,56,40,0.1)' }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block" style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 900, color: INK, textWrap: 'balance' }}>
                    Who gets this email?
                  </span>
                  <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT }} title={summary}>
                    {summary}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="inline-flex items-center justify-center focus:outline-none flex-shrink-0"
                  style={{
                    width: 40, height: 40, borderRadius: 999,
                    border: CARD_BORDER, backgroundColor: '#FFFDF8', color: SOFT, cursor: 'pointer',
                  }}
                >
                  <X size={15} strokeWidth={2.6} />
                </button>
              </div>

              <div className="min-h-0 flex-1" style={{ overflowY: 'auto', padding: '16px 16px 20px' }}>
            {/* Step 3's dot field rides at the TOP: it is the count made
                visible, so it belongs next to the count, not below the
                controls that change it. */}
            <p className="mb-2" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, textWrap: 'pretty' }}>
              Every dot is one person. The dark ones are getting this email.
            </p>
            <DotField dots={dots} />

            {restored && anySelection && (
              <div
                className="flex flex-wrap items-center gap-2 mt-4"
                style={{ padding: '9px 12px', borderRadius: 14, backgroundColor: 'rgba(47,102,68,0.08)', border: '1px solid rgba(47,102,68,0.18)' }}
              >
                <Check size={13} strokeWidth={3} style={{ color: GREEN_INK, flexShrink: 0 }} />
                <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: GREEN_INK }}>
                  Picked up where you left off
                </span>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="ml-auto focus:outline-none"
                  style={{ minHeight: 32, padding: '6px 10px', borderRadius: 999, border: 'none', background: 'transparent', fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: GREEN_INK, cursor: 'pointer' }}
                >
                  START OVER
                </button>
              </div>
            )}

            {/* ── Step 1 · Who ──
                ONE LINE. This was a grid of 174×62 tiles, two rows of them on
                any real screen, roughly 140px of dialog spent on six choices
                that are each one word and one number long, which is most of
                why the list of actual people below needed scrolling to reach.
                The same six choices as chips wrap into one line (two at the
                narrowest), and every one of them is still a 40px-tall target
                carrying its emoji, its name and its live count. ── */}
            <div className="mt-6">
              <StepHeading n={1} title="Who is this for?" hint="Pick one or more. Most emails stop here." />
              {roleSection && (
                <div className="flex flex-wrap gap-1.5">
                  {[{ value: '__all__', label: 'Everyone' }, ...roleSection.options].map(o => {
                    const isAll = o.value === '__all__';
                    const active = isAll ? roleSection.selected.size === 0 : roleSection.selected.has(o.value);
                    const count = isAll ? total : (roleSection.counts[o.value] ?? 0);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={active}
                        title={`${o.label} · ${count.toLocaleString()} ${count === 1 ? 'person' : 'people'}`}
                        onClick={() => {
                          if (isAll) onClearSection('roles');
                          else onToggle('roles', o.value);
                        }}
                        className="inline-flex items-center gap-1.5 focus:outline-none"
                        style={{
                          minHeight: 40, padding: '8px 12px', borderRadius: 999,
                          border: active ? `1.5px solid ${FOREST}` : CARD_BORDER,
                          backgroundColor: active ? FOREST : '#FFFDF8',
                          boxShadow: active ? NEU.outSm : NEU.inSm,
                          cursor: 'pointer',
                          transitionProperty: 'border-color, background-color, box-shadow, color',
                          transitionDuration: '200ms',
                          transitionTimingFunction: EASE,
                        }}
                      >
                        <Emoji3D
                          name={isAll ? 'Busts in silhouette' : (ROLE_EMOJI[o.value] ?? 'Person raising hand')}
                          size={16}
                          fallback={Users}
                          fallbackColor={active ? GOLD : FOREST}
                        />
                        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: active ? GOLD : INK, whiteSpace: 'nowrap' }}>
                          {o.label}
                        </span>
                        <span
                          style={{
                            fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                            padding: '1px 6px', borderRadius: 999,
                            backgroundColor: active ? 'rgba(255,255,255,0.16)' : 'rgba(27,56,40,0.07)',
                            color: active ? GOLD : SOFT,
                          }}
                        >
                          {count.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Step 2 · Narrow it down ── */}
            <div className="mt-7">
              <StepHeading
                n={2}
                title="Narrow it down?"
                hint="Only if you need to. Nothing here is on until you turn it on."
              />

              <div className="flex flex-col gap-2">
                {activeNarrowers.map(s => (
                  <div
                    key={s.key}
                    style={{ padding: '11px 13px', borderRadius: 16, backgroundColor: '#FFFDF8', boxShadow: NEU.inSm, border: '1px solid rgba(27,56,40,0.09)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Emoji3D name={s.emoji} size={16} fallback={Users} fallbackColor={FOREST} />
                      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: SOFT }}>
                        {s.label.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => closeNarrower(s.key)}
                        title={`Remove the ${s.label.toLowerCase()} filter`}
                        className="ml-auto inline-flex items-center justify-center focus:outline-none"
                        style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: 'transparent', color: SOFT, cursor: 'pointer' }}
                      >
                        <X size={13} strokeWidth={2.6} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5" style={{ maxHeight: 132, overflowY: 'auto' }}>
                      {s.options.map(o => {
                        const active = s.selected.has(o.value);
                        const count = s.counts[o.value] ?? 0;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => onToggle(s.key, o.value)}
                            className="inline-flex items-center gap-1.5 focus:outline-none"
                            style={{
                              minHeight: 34, padding: '7px 12px', borderRadius: 999,
                              border: active ? `1px solid ${FOREST}` : CARD_BORDER,
                              backgroundColor: active ? FOREST : NEU.surface,
                              color: active ? GOLD : INK,
                              fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              transitionProperty: 'background-color, color, border-color',
                              transitionDuration: '180ms',
                            }}
                          >
                            {o.label}
                            <span
                              style={{
                                fontSize: 10.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                                padding: '1px 6px', borderRadius: 999,
                                backgroundColor: active ? 'rgba(255,255,255,0.16)' : 'rgba(27,56,40,0.07)',
                                color: active ? GOLD : SOFT,
                              }}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {availableNarrowers.length > 0 && (
                  <div>
                    <button
                      ref={addBtnRef}
                      type="button"
                      onClick={() => setAddMenuOpen(v => !v)}
                      className="inline-flex items-center gap-1.5 focus:outline-none"
                      style={{
                        minHeight: 40, padding: '9px 15px', borderRadius: 999,
                        border: `1.5px dashed rgba(27,56,40,0.28)`, backgroundColor: 'transparent',
                        fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
                        color: FOREST, cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} strokeWidth={2.8} style={{ transform: addMenuOpen ? 'rotate(45deg)' : 'none', transitionProperty: 'transform', transitionDuration: '220ms' }} />
                      ADD A FILTER
                    </button>
                    <PopoverLayer anchorRef={addBtnRef} open={addMenuOpen} onClose={closeAddMenu} width={260} maxHeight={300}>
                      <div className="flex flex-col" style={{ padding: 6, borderRadius: 18, ...panelStyle }}>
                        {availableNarrowers.map(s => (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => {
                              setOpenNarrowers(prev => new Set(prev).add(s.key));
                              setAddMenuOpen(false);
                            }}
                            className="flex items-center gap-2.5 text-left focus:outline-none"
                            style={{
                              minHeight: 42, padding: '9px 11px', borderRadius: 13,
                              border: 'none', background: 'transparent',
                              fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: INK, cursor: 'pointer',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.055)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Emoji3D name={s.emoji} size={18} fallback={Users} fallbackColor={FOREST} />
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </PopoverLayer>
                  </div>
                )}
              </div>
            </div>

            {/* ── Step 3 · The people ── */}
            <div className="mt-7">
              <StepHeading
                n={3}
                title="Check the list"
                hint="Add anyone who was missed, take off anyone who shouldn't get it."
              />

              <div className="relative mb-2.5" style={{ maxWidth: 420 }}>
                <Search size={14} strokeWidth={2.4} style={{ position: 'absolute', left: 13, top: 13, color: SOFT, pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  value={manualQuery}
                  onChange={e => onManualQuery(e.target.value)}
                  placeholder="Add someone by name or email…"
                  className="w-full focus:outline-none"
                  style={{
                    minHeight: 40, borderRadius: 999, padding: '10px 14px 10px 34px',
                    fontFamily: OUTFIT, fontSize: 12.5, color: INK,
                    backgroundColor: '#FFFDF8', border: '1px solid rgba(27,56,40,0.13)', boxShadow: NEU.inSm,
                  }}
                />
                <PopoverLayer anchorRef={searchRef} open={manualMatches.length > 0} onClose={closeSearch} width={420} maxHeight={240}>
                  <div style={{ borderRadius: 16, overflow: 'hidden', ...panelStyle }}>
                    {manualMatches.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onAddPerson(m.id)}
                        className="w-full text-left focus:outline-none"
                        style={{ minHeight: 40, padding: '9px 13px', border: 'none', background: 'transparent', fontFamily: OUTFIT, fontSize: 12.5, color: INK, cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.055)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {m.name}
                        <span style={{ color: SOFT }}> · {m.sub}</span>
                      </button>
                    ))}
                  </div>
                </PopoverLayer>
              </div>

              <div className="flex flex-col gap-1.5" style={{ maxHeight: 420, overflowY: 'auto' }}>
                {groups.length === 0 && (
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, padding: '10px 2px', textWrap: 'pretty' }}>
                    Nobody matches that yet. Loosen a filter above, or add someone by name.
                  </p>
                )}
                {groups.map(g => {
                  const isOpen = expandedGroups.has(g.key);
                  return (
                    <div key={g.key} style={{ borderRadius: 16, backgroundColor: '#FFFDF8', border: '1px solid rgba(27,56,40,0.09)' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedGroups(s => {
                          const n = new Set(s);
                          if (n.has(g.key)) n.delete(g.key); else n.add(g.key);
                          return n;
                        })}
                        aria-expanded={isOpen}
                        className="w-full flex items-center gap-2 text-left focus:outline-none"
                        style={{ minHeight: 44, padding: '10px 13px', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <ChevronDown
                          size={13}
                          strokeWidth={2.6}
                          className="flex-shrink-0"
                          style={{ color: SOFT, transform: isOpen ? 'rotate(180deg)' : 'none', transitionProperty: 'transform', transitionDuration: '220ms', transitionTimingFunction: EASE }}
                        />
                        <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: INK }}>{g.label}</span>
                        <span className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
                          {g.members.length}
                        </span>
                        {g.optedOut > 0 && (
                          <span className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: AMBER_INK, fontVariantNumeric: 'tabular-nums' }}>
                            · {g.optedOut} said no
                          </span>
                        )}
                      </button>
                      {isOpen && (
                        <div className="flex flex-col gap-1" style={{ padding: '0 10px 10px' }}>
                          {g.members.map(p => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between gap-2"
                              style={{ minHeight: 40, padding: '6px 10px', borderRadius: 12, backgroundColor: NEU.surface, border: '1px solid rgba(27,56,40,0.07)' }}
                              title={p.sub}
                            >
                              <ProfileLink userId={p.userId} name={p.name}>
                                <span className="flex items-center gap-2 min-w-0">
                                  {p.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={p.avatarUrl}
                                      alt=""
                                      className="rounded-full object-cover flex-shrink-0"
                                      style={{ width: 26, height: 26, outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: -1 }}
                                    />
                                  ) : (
                                    <span
                                      className="flex items-center justify-center rounded-full flex-shrink-0"
                                      style={{ width: 26, height: 26, backgroundColor: 'rgba(27,56,40,0.1)', color: FOREST, fontSize: 11, fontWeight: 800, fontFamily: OUTFIT }}
                                    >
                                      {p.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                  <span className="min-w-0">
                                    <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: p.optedOut ? SOFT : INK }}>
                                      {p.name}
                                      {!p.registered && (
                                        <span className="ml-1.5" style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, backgroundColor: 'rgba(154,138,120,0.16)', color: SOFT }}>
                                          NOT SIGNED UP
                                        </span>
                                      )}
                                      {/* Neutral information, so it is drawn
                                          in the neutral colour. It used to be
                                          a gold-tinted amber pill, which read
                                          as a warning about a person nothing
                                          is wrong with — and as ORANGE, which
                                          is not a colour this app owns. */}
                                      {p.manual && (
                                        <span className="ml-1.5" style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST }}>
                                          ADDED BY YOU
                                        </span>
                                      )}
                                    </span>
                                    <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT }}>
                                      {p.sub}
                                    </span>
                                  </span>
                                </span>
                              </ProfileLink>
                              {p.optedOut ? (
                                <span
                                  className="flex-shrink-0"
                                  /* Amber survives here because this IS a
                                     caution — the one place in this list where
                                     something is genuinely off. Retinted off
                                     the gold (#B6871F) it was mixed with and
                                     onto AMBER_INK's own hue, so it stops
                                     reading orange. */
                                  style={{ fontSize: 9, fontWeight: 800, fontFamily: OUTFIT, padding: '3px 7px', borderRadius: 999, backgroundColor: 'rgba(126,81,40,0.10)', color: AMBER_INK, border: '1px solid rgba(126,81,40,0.28)' }}
                                >
                                  SAID NO
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onRemovePerson(p.id)}
                                  title={p.manual ? 'Undo this manual add' : 'Leave this person off'}
                                  className="flex-shrink-0 inline-flex items-center justify-center focus:outline-none"
                                  style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(139,32,32,0.24)', background: 'transparent', color: RED, cursor: 'pointer' }}
                                >
                                  <X size={12} strokeWidth={2.8} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
              </div>

              <div
                className="flex items-center gap-3 flex-shrink-0"
                style={{ padding: '12px 16px', borderTop: '1px solid rgba(27,56,40,0.1)', backgroundColor: NEU.surface }}
              >
                <span className="min-w-0 flex-1" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: INK }}>
                  <BigNumber n={reachCount} /> {reachCount === 1 ? 'person' : 'people'}
                  <span style={{ fontWeight: 600, color: SOFT }}> of {total.toLocaleString()}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 focus:outline-none flex-shrink-0"
                  style={{
                    minHeight: 44, padding: '11px 22px', borderRadius: 999, border: 'none',
                    background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
                    color: GOLD, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, letterSpacing: '0.05em',
                    cursor: 'pointer', boxShadow: NEU.outSm,
                  }}
                >
                  <Check size={14} strokeWidth={3} />
                  DONE
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

/** The one irreversible button on the screen, so it is the one that looks
 *  most like an object: gold, lifted, and it says the number out loud. */
function SendButton({ onClick, disabled, count, busy }: { onClick: () => void; disabled: boolean; count: number; busy: string | null }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const g = NEU_GRADIENTS.gold;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      className="inline-flex items-center justify-center gap-2 focus:outline-none flex-shrink-0"
      style={{
        minHeight: 44, padding: '11px 20px', borderRadius: 999, border: 'none',
        background: disabled ? 'rgba(27,56,40,0.12)' : `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
        color: disabled ? NEU.muted : FOREST,
        fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, letterSpacing: '0.05em',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled ? 'none' : hovered ? `0 8px 20px ${g[1]}66, ${NEU.outSmHover}` : `0 5px 13px ${g[1]}4D, ${NEU.outSm}`,
        transform: disabled ? 'none' : pressed ? 'scale(0.96)' : hovered ? 'translateY(-2px)' : 'translateY(0)',
        transitionProperty: 'box-shadow, transform, background, color',
        transitionDuration: '220ms',
        transitionTimingFunction: EASE,
      }}
    >
      <Send size={15} strokeWidth={2.6} />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {busy ?? (count > 0 ? `SEND TO ${count.toLocaleString()}` : 'SEND')}
      </span>
    </button>
  );
}
