'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CommitteeIdentityBadge: the masthead at the top of the chair's forest sidebar,
// and the ONE place the committee's identity is stated in that column. The sidebar
// now runs the full height of the viewport (the chair top bar starts at its right
// edge), so this block is the first thing at the top-left of the chair screen.
//
// Anatomy, top to bottom, no hairlines anywhere:
//   • The emblem, the hero of the column (EMBLEM px). Resolution is the caller's:
//     conference committee logo, then the conference logo, then the preset match
//     for the name, then the UN emblem (DEFAULT_EMBLEM). A logo that fails to load
//     drops to the UN emblem, and that failing drops to gold initials, so there is
//     never a broken image or an empty slot.
//   • Beside it: the acronym big with the full name small beneath (AGENTS.md UI
//     RULE, resolved by the caller via committeeDisplayName), and the topic. The
//     topic is smaller than the name, and always starts with a fixed "Topic:" label
//     (`topicLabel`, 16 Sep 2026) that is never part of the edit. For the Moderator
//     (`onTopicSave`) a click on the text, or the small pencil button beside it (17 Sep
//     2026), writes IN PLACE: the label keeps its spot and the topic becomes a bare
//     one-line field in the same type, growing to 3 lines, with only a gold hairline under
//     it. No panel, no plate, no change of shape. Enter or blur saves, Escape cancels, 150
//     characters max; only the text after the label edits. On a conference committee with 2+ topics a separate small "switch topic"
//     control (`onSwitchAgenda`) opens the agenda picker, so the text edits and the
//     picker stays one click away.
//   • QuorumRings: three half-circle bookmark tabs (Present, 2/3, 1/2+1) flush on the list
//     below, plus the quorum pill when a quorum rule is set. Observers are counted in both
//     numbers. Passed in as `present`/`total`; omit `present` to hide them. `seatField`
//     (the inline SeatAddField) sits to the right of the tabs on the same row. The topic is
//     clamped to 3 lines with the full text in a tooltip.
//
// Contrast on #1B3828: body ivory #EDE7D8 is 11:1; the full name at 78% ivory and
// the topic at 84% gold both clear 4.5:1. Committee artwork is arbitrary (the UN
// mark is bright cyan, the ICJ seal dark navy), so the emblem sits on a soft ivory
// glow and wears a light alpha-following rim, which lifts dark marks and leaves
// light ones alone.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight, PanelLeftClose, Pencil } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import QuorumRings from '@/components/QuorumRings';

export const DEFAULT_EMBLEM = '/logos/un.svg';

const EMBLEM = 84;

/** The topic's own line height in px (11.5px at 1.28), so the inline field can grow by lines. */
const TOPIC_LINE = 15;

/** Light rim (follows the artwork's alpha) plus a grounding shadow. */
const FLOAT_FILTER =
  'drop-shadow(0 0 0.75px rgba(255,255,255,0.55)) drop-shadow(0 3px 7px rgba(0,0,0,0.32))';

/** The committee emblem with its fallback chain. Also drawn, smaller, at the top of the
 *  collapsed sidebar column (SidebarFlagRail). */
export function CommitteeEmblem({ src, monogram, alt, size = EMBLEM, onLight = false }: {
  src: string | null; monogram: string; alt: string; size?: number;
  /** Drawn on the ivory page (the collapsed column), not on forest: an ink shadow, no glow. */
  onLight?: boolean;
}) {
  // Failures remembered per URL, so a later logo (the conference row arriving) gets a try.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const chain = [src, DEFAULT_EMBLEM].filter((s): s is string => !!s && !failed.has(s));
  const shown = chain[0] ?? null;
  return (
    <span
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {!onLight && <span
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -Math.round(size / 8.4),
          background: 'radial-gradient(circle at 50% 45%, rgba(237,231,216,0.16) 0%, rgba(237,231,216,0.06) 45%, rgba(237,231,216,0) 70%)',
        }}
      />}
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={shown}
          src={shown}
          alt={alt}
          width={size}
          height={size}
          decoding="async"
          draggable={false}
          onError={() => setFailed((prev) => { const n = new Set(prev); n.add(shown); return n; })}
          className="relative block"
          style={{ width: '100%', height: '100%', objectFit: 'contain', filter: onLight ? 'drop-shadow(0 1px 1.5px rgba(27,56,40,0.35)) drop-shadow(0 3px 8px rgba(27,56,40,0.18))' : FLOAT_FILTER }}
        />
      ) : (
        <span
          role="img"
          aria-label={alt}
          className="relative"
          style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: Math.round(size * 0.31), letterSpacing: '0.02em', color: onLight ? NEU.forest : NEU.gold }}
        >
          {monogram}
        </span>
      )}
    </span>
  );
}

/** Gold initials for an emblem that cannot load: up to three letters of the label. */
export function emblemMonogram(primary: string): string {
  return primary.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() || '?';
}

export default function CommitteeIdentityBadge({
  logoSrc,
  primary,
  secondary,
  topic,
  topicLabel,
  onTopicSave,
  topicMaxLength = 150,
  onSwitchAgenda,
  switchAgendaLabel,
  labels,
  onCollapse,
  collapseLabel,
  present,
  total = 0,
  quorumNeeded = null,
  seatField,
}: {
  /** When set, clicking the topic turns it into an inline editor (the Moderator, session
   *  not ended). Resolves false when the write was refused; the caller has already rolled
   *  its optimistic topic back, and the badge says so. */
  onTopicSave?: (next: string) => Promise<boolean>;
  topicMaxLength?: number;
  /** When set, a small "switch topic" control opens the agenda picker (a conference
   *  committee with 2+ topics). Separate from the text, which edits. */
  onSwitchAgenda?: () => void;
  switchAgendaLabel?: string;
  /** Translated copy for the editor. */
  labels?: { edit: string; add: string; field: string; failed: string };
  /** When set, a collapse button folds the sidebar away (the chair sidebar only). */
  onCollapse?: () => void;
  collapseLabel?: string;
  /** Resolved emblem URL, or null for the UN emblem default. */
  logoSrc: string | null;
  /** Big label: the acronym for a long name, otherwise the name itself. */
  primary: string;
  /** Full name, shown small beneath. Null when `primary` already IS the name. */
  secondary?: string | null;
  topic?: string | null;
  /** Translated "Topic:" label, shown before the topic and never editable. */
  topicLabel?: string;
  /** Delegations present, observers included. Omit to hide the quorum rings. */
  present?: number;
  /** Delegations on the roster, observers included. */
  total?: number;
  /** Delegations the quorum rule needs, or null when there is no rule. */
  quorumNeeded?: number | null;
  /** The inline seat field, drawn to the inline end of the quorum tabs. Omit for a
   *  Commenter or an ended session. */
  seatField?: ReactNode;
}) {
  const monogram = emblemMonogram(primary);
  const longPrimary = primary.length > 12;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // Escape and Enter both end the edit, and the blur that follows must not save again.
  const doneRef = useRef(false);

  // The field is the topic's own line, not a box over it: it starts one line tall and grows
  // with what is typed, to the same 3 lines the text itself is clamped to. Written straight
  // to the node (no state, nothing per keystroke re-rendering the masthead).
  const fitField = () => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TOPIC_LINE * 3)}px`;
  };

  useEffect(() => {
    if (!editing) return;
    const el = fieldRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    fitField();
  }, [editing]);

  // The editor's permission can go away mid-edit (gavel handed over, session ended): the
  // editor simply stops rendering, and `startEdit` re-seeds the draft next time.
  const isEditing = editing && !!onTopicSave;

  const startEdit = () => {
    if (!onTopicSave) return;
    doneRef.current = false;
    setFailed(false);
    setDraft(topic ?? '');
    setEditing(true);
  };
  const finish = (save: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    const next = draft.replace(/\s+/g, ' ').trim().slice(0, topicMaxLength);
    if (!save || !onTopicSave || !next || next === (topic ?? '').trim()) return;
    void onTopicSave(next).then((ok) => setFailed(!ok));
  };

  const topicStyle: React.CSSProperties = {
    fontFamily: OUTFIT,
    fontSize: 11.5,
    fontWeight: 500,
    lineHeight: 1.28,
    color: 'rgba(238,217,138,0.86)',
    margin: 0,
    textWrap: 'pretty',
  };

  // The fixed "Topic:" prefix. Outside the editable control, so a click on it edits nothing
  // and the textarea never contains it.
  const labelNode = topicLabel ? (
    <span style={{ fontWeight: 800, color: NEU.gold, letterSpacing: '0.01em' }}>{topicLabel} </span>
  ) : null;

  let topicNode: React.ReactNode = null;
  if (isEditing) {
    // WRITING IN PLACE, not in a panel (owner, 17 Sep 2026: "no big bubble, just inline
    // write"). The fixed label keeps its spot at the start of the line and the field takes
    // the rest of it, in the topic's own type and colour with nothing behind it but a gold
    // hairline, so the line does not move or change shape when the edit begins. It was a
    // 3-row textarea on a dark plate before.
    topicNode = (
      <div className="mt-0.5 flex items-start gap-1">
        {topicLabel && (
          <span className="shrink-0" style={{ ...topicStyle, fontWeight: 800, color: NEU.gold }}>{topicLabel}</span>
        )}
        <textarea
          ref={fieldRef}
          value={draft}
          rows={1}
          maxLength={topicMaxLength}
          aria-label={labels?.field}
          onChange={(e) => { setDraft(e.target.value.replace(/\n/g, ' ')); fitField(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
          }}
          onBlur={() => finish(true)}
          className="flex-1 min-w-0 resize-none overflow-hidden bg-transparent p-0 focus:outline-none"
          style={{
            ...topicStyle,
            color: '#F4EFE3',
            height: TOPIC_LINE,
            border: 'none',
            borderBottom: '1px solid rgba(238,217,138,0.7)',
          }}
        />
      </div>
    );
  } else if (onTopicSave) {
    // The label, then the topic as an INLINE control, so the two flow as one sentence
    // under the 3-line clamp. A span with role=button rather than a <button>: a button is
    // laid out as an inline-block and would break the text onto its own line.
    topicNode = (
      <p className="line-clamp-3 mt-0.5" style={topicStyle}>
        {labelNode}
        <span
          role="button"
          tabIndex={0}
          onClick={startEdit}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); } }}
          aria-label={`${topicLabel ?? ''} ${topic ?? ''}. ${labels?.edit ?? ''}`.trim()}
          title={topic ? `${topic}\n${labels?.edit ?? ''}`.trim() : labels?.edit}
          className="group/topic rounded cursor-text transition-colors hover:bg-[rgba(238,217,138,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70"
          style={{ color: topic ? topicStyle.color : 'rgba(238,217,138,0.6)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '0 2px' }}
        >
          {topic || labels?.add}
        </span>
        {/* The pencil is its own button and is always there (owner, 17 Sep 2026): the topic
            text still edits on a click, but a chair should not have to discover that. It is
            inline-flex, so it sits at the end of the topic's last line rather than on a line
            of its own. */}
        <button
          type="button"
          onClick={startEdit}
          aria-label={labels?.edit}
          title={labels?.edit}
          className="inline-flex items-center justify-center rounded ms-1 align-[-3px] opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70 transition-opacity"
          style={{ width: 16, height: 16, color: 'rgba(238,217,138,0.9)' }}
        >
          <Pencil size={10} aria-hidden />
        </button>
      </p>
    );
  } else if (topic) {
    topicNode = (
      <p className="line-clamp-3 mt-0.5" title={topic} style={topicStyle}>
        {labelNode}
        {topic}
      </p>
    );
  }

  return (
    // With the quorum tabs the bottom padding is 0: the tabs sit flush on the list below.
    <div className="shrink-0 relative" style={{ padding: typeof present === 'number' ? '14px 16px 0' : '14px 16px 12px', backgroundColor: 'rgba(255,255,255,0.035)' }}>
      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          aria-label={collapseLabel}
          title={collapseLabel}
          className="absolute top-2 end-2 w-7 h-7 rounded-lg flex items-center justify-center transition-[background-color,color,scale] duration-150 active:scale-[0.96] hover:bg-[rgba(237,231,216,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70"
          style={{ color: 'rgba(237,231,216,0.6)' }}
        >
          <PanelLeftClose size={16} aria-hidden className="rtl:-scale-x-100" />
        </button>
      )}
      <div className="flex items-start gap-3.5">
        <CommitteeEmblem src={logoSrc} monogram={monogram} alt={secondary ?? primary} />
        <div className="min-w-0 flex-1 flex flex-col gap-1" style={{ minHeight: EMBLEM, justifyContent: 'center', paddingInlineEnd: onCollapse ? 18 : 0 }}>
          <h2
            className={longPrimary ? 'line-clamp-2' : 'truncate'}
            // A `title` only when the label stands alone: with the full name ALSO
            // rendered beneath, it would make a screen reader announce it twice.
            title={secondary ? undefined : primary}
            style={{
              fontFamily: OUTFIT,
              fontWeight: 900,
              fontSize: longPrimary ? 20 : 27,
              lineHeight: 1.05,
              letterSpacing: longPrimary ? '-0.005em' : '0.005em',
              color: NEU.gold,
              margin: 0,
              textWrap: 'balance',
            }}
          >
            {primary}
          </h2>
          {secondary && (
            <p
              className="line-clamp-2"
              title={secondary}
              style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 500, lineHeight: 1.25, color: 'rgba(237,231,216,0.78)', margin: 0, textWrap: 'balance' }}
            >
              {secondary}
            </p>
          )}
          {topicNode}
          {failed && !isEditing && labels?.failed && (
            <p role="alert" className="m-0" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: '#F2C77E' }}>{labels.failed}</p>
          )}
          {onSwitchAgenda && !isEditing && (
            <button
              type="button"
              onClick={onSwitchAgenda}
              className="self-start inline-flex items-center gap-1 rounded-md px-1 py-0.5 -ms-1 transition-colors hover:bg-[rgba(238,217,138,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70"
              style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(238,217,138,0.72)' }}
            >
              <ArrowLeftRight size={11} aria-hidden />
              {switchAgendaLabel}
            </button>
          )}
        </div>
      </div>
      {typeof present === 'number' && (
        <div className="mt-2">
          <QuorumRings present={present} total={total} quorumNeeded={quorumNeeded} trailing={seatField} />
        </div>
      )}
    </div>
  );
}
