'use client';

// ─────────────────────────────────────────────────────────────────────────────
// THE EMAIL BUILDER, three columns (owner, Oct 2026: "the email starts near
// the top", "bring back the left and right layout, simplified"):
//
//   TOP       one slim bar across the builder: Back, the email's name
//             (written in place) and Save.
//   LEFT      only the tools: Add (blocks, their details, files, starters,
//             each opening the Add menu on its own tab), Design, and See it
//             for real; then whatever block is selected, its few settings.
//   MIDDLE    the email itself at its real 600px width, edited in place, so
//             the sheet IS the live preview. Its subject line sits on top of
//             it like a real email's. "See it for real" swaps the sheet for
//             the true `renderEmailHtml` output in an iframe.
//   RIGHT     everything about sending: who gets it (the page's `reachSlot`),
//             the "Before you send" ticks, Send me a test, and Send at the
//             foot (the page's `sendSlot`).
//
// The sheet mirrors the CARD design that is actually sent (emailCard.ts, the
// twin of the database's gavelling_email_html): banner with the logo in a
// white circle over its edge, the centred light headline with its gold rule,
// forest pill buttons, the sign-off and "Made with Gavelling" under the card.
//
// Explanations live behind a "?" (HintDot) instead of being printed under
// every title. Owner, Oct 2026: "slightly dumb down the email writer";
// nothing was removed, it was folded away.
//
// WHAT IS DELIBERATELY NOT HERE: padding, margin, spacing, colour, font,
// width, alignment. The email theme owns all of that. Every control on this
// screen changes CONTENT — the three text sizes, bold/italic, a button's
// destination, an image and its alt text — because those are the only things
// the block model actually stores.
//
// Below 1180px it is one column: the email first, the sending column after
// it, the tools in a bar pinned to the bottom of the screen, and a selected
// block's settings in a sheet that rises above that bar.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Trash2, ChevronUp, ChevronDown, Monitor, Smartphone, Send, Bold, Italic,
  Image as ImageIcon, Plus, GripVertical, X, Check, Sparkles,
  UserRound, Upload, AlertTriangle,
  Sun, Moon, Link2,
} from 'lucide-react';
import {
  EMAIL_TOKEN_KEYS, resolveTokens, splitResolvedText,
  type EmailTokenContext, type EmailTokenKey,
} from '@/lib/emailTokens';
import {
  type EmailBlock, type ButtonBlock, type ButtonDestination, type ImageBlock, type ParagraphVariant,
  BUTTON_DESTINATION_LABELS, flattenBlocksToPlainText, calendarUrlFor,
} from '@/lib/emailBlocks';
import { renderEmailHtml, resolveEmailTheme, socialLinks, type EmailRenderConference } from '@/lib/emailHtml';
import {
  emailBannerUrl, emailDatesLabel, emailCardFor, secretariatSignature, EMAIL_ASSET_BASE,
} from '@/lib/emailCard';
import { companyLegalLines } from '@/lib/companyDetails';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { getAuthedClient } from '@/lib/supabase-auth';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { Emoji3D, NEU, NEU_GRADIENTS, OUTFIT, EASE } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import GSelect from '@/components/GSelect';
import { SOFT, AMBER_INK, GREEN_INK, RED, CARD_BORDER, CARD_SHADOW } from '@/app/manage/[slug]/live/tokens';
import {
  buildParagraphDom, serializeParagraphDom, insertTextAtRange, insertPillAtRange,
} from '@/components/email/paragraphDom';
import {
  PALETTE_ITEMS, STARTERS, blockForKind, type PaletteKind,
} from '@/components/email/blockKit';
import PopoverLayer from '@/components/email/PopoverLayer';
import {
  tokenIdentity, tokenShort, tokenLabel, TOKEN_FAMILY_LABEL, TOKEN_FAMILY_ORDER,
  type TokenFamily,
} from '@/components/email/tokenKit';
import TokenSuggest, {
  nudgeKeysFor, TYPEAHEAD_TRIGGER, type SuggestState, type CaretRect,
} from '@/components/email/TokenSuggest';
import ConferenceFilesPanel, {
  useConferenceFiles, blockForFile,
} from '@/components/email/ConferenceFilesPanel';
import DesignPanel, { type DesignControls } from '@/components/email/DesignPanel';
import type { ReachGroup } from '@/components/email/AudienceReach';
import { friendlyError } from '@/lib/friendlyError';

const FOREST = '#1B3828';
const GOLD = '#EED98A';
const INK = '#1C1410';

/** The desk the paper sits on: one step darker than the page so the sheet
 *  reads as an object ON something rather than a panel cut out of it. */
const DESK = '#E4DCC8';
const DESK_WELL = 'inset 5px 5px 12px rgba(27,56,40,0.16), inset -4px -4px 10px rgba(255,255,255,0.55)';

// ── MIRRORED FROM THE RENDERER ───────────────────────────────────────────────
// Lifted from `@/lib/emailHtml` so the canvas IS the email rather than an
// impression of it. This block plus VARIANT_CANVAS_STYLE below is the entire
// coupling: if the renderer's palette, type scale or chrome moves, re-sync
// HERE and nowhere else. The canvas cannot import them — they are module-
// private over there, and this file must never edit that one.
//
// The renderer also ships a dark-mode variant (media-query classes on the
// same markup). The canvas deliberately draws the LIGHT scheme only: it is an
// editing surface, and "See it for real" hands the real document to an iframe
// where the reader's own scheme applies.
// Since Oct 2026 these are the CARD design's numbers (src/lib/emailCard.ts,
// switched on 23 Sep 2026, and its SQL twin public.gavelling_email_html),
// because that is what `renderEmailHtml` actually sends. The canvas used to
// mirror the retired classic design (a serif headline, an accent spine, a
// footer band inside the card), so what was written did not look like what
// arrived.
const MAIL_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MAIL_INK = '#241E17';
const MAIL_INK_SOFT = '#574B40';
const MAIL_MUTED = '#6E6456';
const MAIL_CARD = '#FFFFFF';
const MAIL_CARD_BORDER = '#E4DCC8';
const MAIL_HAIRLINE = '#EDE6D6';
const MAIL_RULE = '#C9A63A';
const SHEET_WIDTH = 600;
const CONTENT_WIDTH = 528;
/** The card's side padding (36px), the same on every row. */
const MAIL_PAD = 36;


export interface PreviewCandidate {
  id: string;
  label: string;
  ctx: EmailTokenContext;
}

export interface EmailComposerValue {
  subject: string;
  blocks: EmailBlock[];
}

interface EmailComposerProps {
  conference: EmailRenderConference;
  conferenceId: string;
  initialSubject: string;
  initialBlocks: EmailBlock[];
  previewCandidates: PreviewCandidate[];
  onChange: (value: EmailComposerValue) => void;
  /** Token context for "Send test to me": real organizer-derived values where known, `[Label]` for the rest. */
  testSendContext: EmailTokenContext;
  accessToken: string | null;
  organizerEmail: string | null;
  /** "Who gets it", drawn at the top of the right-hand sending column (the
   *  page hands AudienceReach in `layout="column"`). Absent for an automatic
   *  email, whose audience is fixed by its event. */
  reachSlot?: React.ReactNode;
  /** The page's Send button, at the foot of the sending column. */
  sendSlot?: React.ReactNode;
  /** A quiet line under Send (the page's "N of 1,000 free emails used"). */
  sendingNote?: React.ReactNode;

  // ── The builder's own header ──────────────────────────────────────────────
  // These three exist so the page can STOP rendering a header row of its own.
  // It used to draw "← BACK … SAVE" in one strip and the ad-hoc Name field in
  // another below it, which between them put ~146px of chrome above the paper
  // before the paper had said anything. Handed in here they share one row with
  // the name, and the page's two blocks go away.
  /** The page's ← BACK control, verbatim. */
  backSlot?: React.ReactNode;
  /** The page's SAVE control (and anything beside it), verbatim. */
  actionsSlot?: React.ReactNode;
  /** The ad-hoc email's name. Event templates have no name of their own, so
   *  when `onNameChange` is absent the field is not rendered at all. */
  name?: string;
  onNameChange?: (v: string) => void;

  /** The conference's email theme, as a controlled view. Absent → the Design
   *  rail section is not offered. See `DesignControls` in DesignPanel. */
  design?: DesignControls;

  /** The audience, already grouped. No longer drawn here (the list is in the
   *  send confirmation now); kept so the page's call does not change. */
  recipients?: { groups: ReachGroup[]; reachCount: number };

  /** How many of the real recipients would get a ⚠field⚠ marker, and which
   *  fields (computed by the page from the live subject and blocks). Shown by
   *  the test send, because a test to the organiser fills every field with a
   *  stand-in and would otherwise look fine. The real send skips them. */
  unresolvedRecipients?: { affected: number; total: number; fields: { label: string; count: number }[] };

  /** The automatic email being written, when it is one (EVENT_REGISTRY key).
   *  "See it for real" and the test send then render exactly like the real
   *  send (queueEventEmail): the transactional card with this event's status
   *  icon and layout. Absent for a one-off broadcast, which is unchanged. */
  eventKey?: string | null;
}

type LocalBlock = EmailBlock & { _id: string };

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function withIds(blocks: EmailBlock[]): LocalBlock[] {
  return blocks.map(b => ({ ...b, _id: genId() }));
}

function stripIds(blocks: LocalBlock[]): EmailBlock[] {
  return blocks.map(b => {
    const rest = { ...b } as Partial<LocalBlock>;
    delete rest._id;
    return rest as EmailBlock;
  });
}

const ROLE_OPTIONS = [
  { value: 'delegate', label: 'Delegate' },
  { value: 'head-delegate', label: 'Head Delegate' },
  { value: 'chair', label: 'Chair' },
  { value: 'faculty-advisor', label: 'Faculty Advisor' },
  { value: 'observer', label: 'Observer' },
];

/** Editor typography per size preset — the renderer's own numbers, so what is
 *  typed is what is sent. Colour and family match too. */
const VARIANT_CANVAS_STYLE: Record<ParagraphVariant, React.CSSProperties> = {
  // A heading AFTER the first: emailCard's 19px bold forest row.
  heading: { fontFamily: MAIL_SANS, fontSize: 19, fontWeight: 700, lineHeight: 1.3, color: FOREST, padding: '12px 0 12px' },
  body: { fontFamily: MAIL_SANS, fontSize: 16, lineHeight: 1.6, color: MAIL_INK, paddingBottom: 12 },
  small: { fontFamily: MAIL_SANS, fontSize: 13, lineHeight: 1.65, color: MAIL_MUTED, paddingBottom: 12 },
};

/** The FIRST headline: emailCard's `headline()`, one large light sentence,
 *  centred, with a short gold rule under it (drawn by the block frame). */
const LEAD_CANVAS_STYLE: React.CSSProperties = {
  fontFamily: MAIL_SANS, fontSize: 29, fontWeight: 300, lineHeight: 1.25, letterSpacing: '-0.01em',
  color: FOREST, textAlign: 'center', padding: '4px 0 0',
};

const VARIANT_META: { value: ParagraphVariant; label: string; sample: number }[] = [
  { value: 'heading', label: 'Headline', sample: 18 },
  { value: 'body', label: 'Text', sample: 14 },
  { value: 'small', label: 'Small', sample: 11.5 },
];

/** Desktop-first: renders the three-zone layout on the server, corrects to the
 *  stacked one on mount. This screen is behind sign-in and client-rendered, so
 *  the one-frame correction is never seen by a crawler or a cold visitor. */
function useMinWidth(query: string): boolean {
  const [matches, setMatches] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

/** Three columns or one. 1180, not 1024: below it the manage rail plus a
 *  tools column and a sending column leave the email too narrow to write in. */
function useIsWide(): boolean {
  return useMinWidth('(min-width: 1180px)');
}

// ── Small shared bits ────────────────────────────────────────────────────────

function HighlightedText({ text }: { text: string }) {
  const segments = splitResolvedText(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.unresolved ? (
          <span key={i} style={{ backgroundColor: 'rgba(126,81,40,0.14)', color: AMBER_INK, padding: '0 3px', borderRadius: 3, fontWeight: 700 }}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

/** The one button shape this screen uses for a real action. Gradient fill,
 *  lift on hover, 0.96 on press — the live-status system's button, local so it
 *  can carry a size and an icon-only mode. */
function ActionButton({
  children, onClick, icon: Icon, tone = 'forest', disabled, size = 'md', title, style,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  icon?: typeof Send;
  tone?: 'forest' | 'gold' | 'quiet';
  disabled?: boolean;
  size?: 'sm' | 'md';
  title?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const g = tone === 'gold' ? NEU_GRADIENTS.gold : NEU_GRADIENTS.forest;
  const quiet = tone === 'quiet';
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      className="inline-flex items-center justify-center gap-1.5 focus:outline-none"
      style={{
        minHeight: size === 'sm' ? 34 : 40,
        padding: size === 'sm' ? '7px 13px' : '10px 18px',
        borderRadius: 999,
        border: quiet ? CARD_BORDER : 'none',
        background: disabled
          ? 'rgba(27,56,40,0.12)'
          : quiet
            ? (hovered ? 'rgba(27,56,40,0.06)' : 'transparent')
            : `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
        color: disabled ? NEU.muted : quiet ? FOREST : tone === 'gold' ? FOREST : GOLD,
        fontFamily: OUTFIT,
        fontSize: size === 'sm' ? 13 : 14,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled || quiet ? 'none' : hovered ? `0 7px 18px ${g[0]}59, ${NEU.outSmHover}` : `0 4px 11px ${g[0]}40, ${NEU.outSm}`,
        transform: disabled ? 'none' : pressed ? 'scale(0.96)' : hovered && !quiet ? 'translateY(-2px)' : 'translateY(0)',
        transitionProperty: 'box-shadow, transform, background-color, color',
        transitionDuration: '220ms',
        transitionTimingFunction: EASE,
        ...style,
      }}
    >
      {Icon && <Icon size={size === 'sm' ? 13 : 14} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

/** Small pressed-in track holding mutually exclusive choices.
 *
 *  An option may drop its `label` when its icon already says the whole thing
 *  (a monitor and a handset for laptop/phone width) — in which case `title` is
 *  REQUIRED, and carries both the tooltip and the accessible name. */
function Segmented<T extends string>({
  value, options, onChange, grow,
}: {
  value: T;
  options: (
    | { value: T; label: string; title?: string; icon?: typeof Monitor }
    | { value: T; label?: undefined; title: string; icon: typeof Monitor }
  )[];
  onChange: (v: T) => void;
  grow?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-0.5 ${grow ? 'w-full' : ''}`}
      style={{ padding: 3, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.055)', boxShadow: NEU.inSm }}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.title ?? o.label}
            aria-label={o.title ?? o.label}
            aria-pressed={active}
            onMouseDown={e => e.preventDefault()}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center justify-center gap-1.5 focus:outline-none ${grow ? 'flex-1' : ''}`}
            style={{
              // 34, not 30: with the track's own 3px inset that makes the
              // control 40px tall, the floor for a dense desktop hit area —
              // and an icon-only segment has no words to enlarge its target.
              minHeight: 34,
              // An icon-only option gets a near-square, so the track does not
              // end up with a 44px-wide button holding a 13px glyph.
              padding: o.label ? '5px 12px' : '5px 11px',
              borderRadius: 999,
              border: 'none',
              background: active ? `linear-gradient(135deg, ${FOREST}, #2E6041)` : 'transparent',
              color: active ? GOLD : SOFT,
              fontFamily: OUTFIT,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: active ? '0 3px 8px rgba(27,56,40,0.28)' : 'none',
              transitionProperty: 'background, color, box-shadow',
              transitionDuration: '200ms',
              transitionTimingFunction: EASE,
            }}
          >
            {o.icon && <o.icon size={13} strokeWidth={2.4} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A "?" that explains on hover and focus, never on click (AGENTS.md → UI
 *  RULES). This is where every sentence that used to be printed under a title
 *  now lives: one hover away instead of always on screen. Portaled through
 *  PopoverLayer so no panel's overflow can clip it. */
function HintDot({ text }: { text: string }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => { if (timer.current) clearTimeout(timer.current); }, []);
  const later = useCallback(() => { cancel(); timer.current = setTimeout(() => setOpen(false), 160); }, [cancel]);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => () => cancel(), [cancel]);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={text}
        onMouseDown={e => e.preventDefault()}
        onMouseEnter={() => { cancel(); setOpen(true); }}
        onMouseLeave={later}
        onFocus={() => { cancel(); setOpen(true); }}
        onBlur={later}
        className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none"
        style={{
          width: 20, height: 20, borderRadius: 999,
          border: '1px solid rgba(27,56,40,0.22)', backgroundColor: '#FFFDF8',
          color: SOFT, fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, lineHeight: 1, cursor: 'help',
        }}
      >
        ?
      </button>
      <PopoverLayer anchorRef={ref} open={open} onClose={close} width={250} maxHeight={220}>
        <div
          onMouseEnter={cancel}
          onMouseLeave={later}
          style={{
            padding: '10px 12px', borderRadius: 14,
            backgroundColor: NEU.surface, border: CARD_BORDER, boxShadow: CARD_SHADOW,
            fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.5, color: INK, textWrap: 'pretty',
          }}
        >
          {text}
        </div>
      </PopoverLayer>
    </>
  );
}

/** One short Title Case title per area, the explanation behind a "?". */
function PanelTitle({ children, hint, emoji }: { children: React.ReactNode; hint?: string; emoji?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {emoji && <Emoji3D name={emoji} size={22} fallback={Sparkles} fallbackColor={FOREST} />}
      <p style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 800, color: INK, textWrap: 'balance' }}>
        {children}
      </p>
      {hint && <HintDot text={hint} />}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1.5" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: SOFT }}>
      {children}
    </label>
  );
}

const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  padding: '10px 13px',
  fontSize: 16,
  fontFamily: OUTFIT,
  color: INK,
  backgroundColor: '#FFFDF8',
  border: '1px solid rgba(27,56,40,0.13)',
  boxShadow: NEU.inSm,
  outline: 'none',
  minHeight: 44,
};

/** A quiet pill in the message toolbar: a 3D emoji and a plain word. */
const TOOL_BUTTON_STYLE = (open: boolean): React.CSSProperties => ({
  minHeight: 42,
  padding: '7px 15px 7px 9px',
  borderRadius: 999,
  border: open ? `1.5px solid ${FOREST}` : '1.5px solid rgba(27,56,40,0.16)',
  backgroundColor: open ? 'rgba(238,217,138,0.34)' : '#FFFDF8',
  fontFamily: OUTFIT,
  fontSize: 14,
  fontWeight: 700,
  color: FOREST,
  cursor: 'pointer',
  boxShadow: open ? 'none' : NEU.outSm,
  transitionProperty: 'background-color, border-color, box-shadow',
  transitionDuration: '180ms',
  transitionTimingFunction: EASE,
});

// ── Paragraph editor: contentEditable at the real mail typography ────────────

function ParagraphEditor({
  blockId, initialContent, variant, lead, registerRef, onFocusBlock, onContentChange, onFormatState, onCaret,
}: {
  blockId: string;
  initialContent: string;
  variant: ParagraphVariant;
  /** The email's first headline, drawn as the card's big centred one. */
  lead?: boolean;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onFocusBlock: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onFormatState: (fmt: { bold: boolean; italic: boolean }) => void;
  /** Fired whenever the caret may have moved or the text may have changed,
   *  what the token suggestions listen to. Deliberately a plain notification:
   *  the analysis lives in the composer, so this editor stays the one thing
   *  it has always been, a contentEditable that round-trips stored text. */
  onCaret: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(initialContent);

  useEffect(() => {
    if (ref.current) buildParagraphDom(ref.current, mounted.current);
  }, []);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    onContentChange(blockId, serializeParagraphDom(ref.current));
    onCaret(blockId);
  }, [blockId, onContentChange, onCaret]);

  function refreshFormatState() {
    try {
      onFormatState({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic') });
    } catch {
      /* queryCommandState can throw on detached selections — keep last state */
    }
    onCaret(blockId);
  }

  // Marks go through execCommand so the browser handles node splitting,
  // toggling and native undo. Token pills are contenteditable=false atoms: a
  // selection can cover a whole pill but never part of one.
  function applyMark(cmd: 'bold' | 'italic') {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* <b>/<i> default is fine */ }
    document.execCommand(cmd);
    handleInput();
    refreshFormatState();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === 'b' || k === 'i') {
        e.preventDefault();
        applyMark(k === 'b' ? 'bold' : 'italic');
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        insertTextAtRange(sel.getRangeAt(0), '\n');
        handleInput();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      insertTextAtRange(sel.getRangeAt(0), text);
      handleInput();
    }
  }

  return (
    <>
      <div
        ref={el => { ref.current = el; registerRef(blockId, el); }}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => { onFocusBlock(blockId); refreshFormatState(); }}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshFormatState}
        onSelect={refreshFormatState}
        onMouseUp={refreshFormatState}
        onPaste={handlePaste}
        data-placeholder={lead ? 'Your headline' : variant === 'heading' ? 'A smaller heading' : variant === 'small' ? 'Small print' : 'Write your message here'}
        className="mail-paragraph"
        style={{
          whiteSpace: 'pre-wrap',
          outline: 'none',
          cursor: 'text',
          minHeight: lead ? 40 : variant === 'heading' ? 30 : 26,
          ...(lead ? LEAD_CANVAS_STYLE : VARIANT_CANVAS_STYLE[variant]),
        }}
      />
      <style jsx>{`
        .mail-paragraph:empty:before {
          content: attr(data-placeholder);
          color: #B4A793;
        }
      `}</style>
    </>
  );
}

// ── Image upload ─────────────────────────────────────────────────────────────
// Mirrors uploadBroadcastImage: the public conference-assets bucket, the
// bucket's own mime allow-list and 5MB cap enforced client-side for readable
// errors, a Date.now() path so upsert isn't needed, then getPublicUrl.

const EMAIL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function useImageUpload(conferenceId: string, accessToken: string | null) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<string | null> => {
    if (!EMAIL_IMAGE_TYPES.includes(file.type)) { setError('Attach a JPEG, PNG, WebP or GIF.'); return null; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return null; }
    if (!accessToken) { setError('Your session has expired. Refresh the page and try again.'); return null; }
    setUploading(true);
    setError(null);
    const supabase = getAuthedClient(accessToken);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `email-images/${conferenceId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('conference-assets')
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (upErr) { setError(friendlyError(upErr, "Couldn't upload the image. Please try a different one.")); return null; }
    const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
    return data.publicUrl;
  }, [accessToken, conferenceId]);

  return { upload, uploading, error, setError };
}

// ── EmailComposer ────────────────────────────────────────────────────────────

/** The tabs inside the one Add menu. Design and the recipient list have
 *  their own quiet buttons; everything that ADDS something to the email lives
 *  behind Add. */
type AddTab = 'blocks' | 'details' | 'files' | 'starters';

export default function EmailComposer({
  conference, conferenceId, initialSubject, initialBlocks, previewCandidates, onChange, unresolvedRecipients,
  testSendContext, accessToken, organizerEmail, reachSlot, sendSlot, sendingNote,
  backSlot, actionsSlot, name, onNameChange, design, eventKey,
}: EmailComposerProps) {
  /** How "See it for real" and the test send render: like the real send. */
  const renderAs = eventKey ? { variant: 'transactional' as const, event: eventKey, isDefault: false } : {};
  const [subject, setSubject] = useState(initialSubject);
  const [blocks, setBlocks] = useState<LocalBlock[]>(() => withIds(initialBlocks));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<string>('subject');
  const [fmt, setFmt] = useState({ bold: false, italic: false });
  // ── The tools ─────────────────────────────────────────────────────────────
  // One Add menu (blocks, their details, files, starters) and one Design
  // panel. On a wide screen each Add tab has its own button in the left
  // column and the menu opens beside the button that was pressed, so
  // `addAnchorRef` is pointed at that button just before it opens.
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<AddTab>('blocks');
  const [designOpen, setDesignOpen] = useState(false);
  const addAnchorRef = useRef<HTMLButtonElement | null>(null);
  const designBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const closeDesign = useCallback(() => setDesignOpen(false), []);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  // LIGHT BY DEFAULT, and a real switch rather than a surprise. The renderer
  // ships a dark-scheme variant, and an iframe inherits the READER'S scheme,
  // so on a machine set to dark, "See it for real" opened straight into the
  // dark email every time, which is not the version most people receive and
  // is not the one you want to be judging your own copy against.
  //
  // `color-scheme` set on the iframe ELEMENT propagates into the embedded
  // document (the email declares `<meta name="color-scheme" content="light
  // dark">`, so it opts in), which is what pins the preview without touching
  // the document itself. The dark version is one tap away and unmodified,
  // this is still the real email, not a lightened impression of it.
  const [previewScheme, setPreviewScheme] = useState<'light' | 'dark'>('light');

  // Token suggestions while writing. `nudgesOff` is session-scoped on purpose:
  // it is a "not now", not a setting, and there is no settings surface here.
  const [suggest, setSuggest] = useState<SuggestState | null>(null);
  const [nudgesOff, setNudgesOff] = useState(false);

  // One person drives BOTH the preview's token resolution and the test send —
  // the old screen asked twice, which is one question too many.
  const [asId, setAsId] = useState<string | null>(null);
  const [asOpen, setAsOpen] = useState(false);
  const [asQuery, setAsQuery] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Drag-to-place. `dragging` is what is in the air, `dropIndex` the gap it
  // would land in — rendered as a gold rule between blocks.
  const [dragging, setDragging] = useState<{ kind: 'new'; palette: PaletteKind } | { kind: 'move'; id: string } | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  // Hover reveal for the block toolbar and the between-blocks "+". Kept in
  // state rather than CSS :hover because the pieces below are RENDER HELPERS,
  // not components (see the note above `paletteTile`) — a styled-jsx hover
  // rule would not reliably scope to them.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverGap, setHoverGap] = useState<number | null>(null);

  const wide = useIsWide();
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const blockNodes = useRef<Record<string, HTMLDivElement | null>>({});
  /** One STABLE ref object per insertion gap. PopoverLayer measures its
   *  anchor through a ref, and a fresh `{ current }` literal each render would
   *  re-arm its scroll/resize listeners on every keystroke. */
  const gapBtnRefs = useRef<Record<number, { current: HTMLButtonElement | null }>>({});
  const gapRef = (index: number) => {
    if (!gapBtnRefs.current[index]) gapBtnRefs.current[index] = { current: null };
    return gapBtnRefs.current[index];
  };
  /** A block id waiting for its editor to exist so the caret can be put in it. */
  const pendingFocus = useRef<string | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  const asBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeAsPicker = useCallback(() => setAsOpen(false), []);

  // The Design rail section, when the page hands one over, is the live source
  // of truth for the sheet's chrome, otherwise fall back to the saved theme
  // on the conference row. This is what makes the canvas beside the panel
  // repaint as a colour is picked, instead of a debounce later.
  const savedTheme = useMemo(() => resolveEmailTheme(conference.email_theme), [conference.email_theme]);
  const theme = design?.theme ?? savedTheme;

  // Lazily loaded, and only once the Files section is actually opened: most
  // emails never touch it, and this is a joined query across every committee.
  const { files: conferenceFiles, error: filesError } = useConferenceFiles(
    conferenceId, accessToken, addOpen && addTab === 'files'
  );

  // The masthead, mirroring emailCard's `masthead()`: the banner (the email
  // image when one is set, else the conference banner) as a 4:1 strip with
  // the logo in a white circle over its lower edge, or a small centred logo
  // without one; then the conference name and "dates · place" beneath.
  // headerStyle and the accent colour are NOT read: the card design ignores
  // both, so drawing them here would show something that is never sent.
  const mastBanner = emailBannerUrl({ banner_url: conference.banner_url, email_theme: theme });
  const headerLogo = theme.showLogo ? conference.logo_url : null;
  // Mirrors `shortName` in emailHtml.ts: the masthead and the footer name the
  // EDITION, not just the series, so the preview matches what is sent.
  const confShortName =
    conferenceAcronymLabel({ acronym: conference.acronym, start_date: conference.start_date ?? null })
    || conference.acronym
    || conference.full_name;
  const mastMeta = [
    emailDatesLabel(conference.start_date, conference.end_date, conference.dates_tbd),
    [conference.city, conference.country].map(x => (x ?? '').trim()).filter(Boolean).join(', ') || null,
  ].filter(Boolean).join(' · ') || null;
  const heroIcon = eventKey ? emailCardFor(eventKey, false).icon : null;
  const signers = secretariatSignature(conference.display_secretariat);
  const showSignoff = !!eventKey || signers.length > 0;
  const socials = socialLinks(conference);
  const legalLines = useMemo(() => companyLegalLines(), []);
  // The first headline is the big centred one. The card uses the first
  // heading WITH words; the canvas uses the first heading block, so its look
  // does not jump while that block is still empty.
  const leadId = blocks.find(b => b.type === 'paragraph' && b.variant === 'heading')?._id ?? null;
  const firstButtonId = blocks.find(b => b.type === 'button')?._id ?? null;

  useEffect(() => { onChangeRef.current = onChange; });
  useEffect(() => { onChangeRef.current({ subject, blocks: stripIds(blocks) }); }, [subject, blocks]);

  /** Drains `pendingFocus` once the new paragraph's editor has registered its
   *  ref. A no-op on every other blocks change. */
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const el = blockRefs.current[id];
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
  }, [blocks]);

  const selected = blocks.find(b => b._id === selectedId) ?? null;

  function registerBlockRef(id: string, el: HTMLDivElement | null) {
    blockRefs.current[id] = el;
  }

  const updateParagraphContent = useCallback((id: string, content: string) => {
    setBlocks(bs => bs.map(b => (b._id === id && b.type === 'paragraph' ? { ...b, content } : b)));
  }, []);

  function patchButton(id: string, patch: Partial<ButtonBlock>) {
    setBlocks(bs => bs.map(b => (b._id === id && b.type === 'button' ? { ...b, ...patch } : b)));
  }

  function patchImage(id: string, patch: Partial<ImageBlock>) {
    setBlocks(bs => bs.map(b => (b._id === id && b.type === 'image' ? { ...b, ...patch } : b)));
  }

  function setVariant(id: string, variant: ParagraphVariant) {
    // 'body' is stored as an ABSENT variant so an untouched (or reverted)
    // paragraph keeps the exact stored shape older rows have.
    setBlocks(bs => bs.map(b => {
      if (b._id !== id || b.type !== 'paragraph') return b;
      const next = { ...b };
      if (variant === 'body') delete next.variant;
      else next.variant = variant;
      return next;
    }));
  }

  function insertBlocks(newBlocks: EmailBlock[], at: number) {
    const local = withIds(newBlocks);
    setBlocks(bs => {
      const next = [...bs];
      next.splice(Math.max(0, Math.min(at, bs.length)), 0, ...local);
      return next;
    });
    const first = local[0];
    setSelectedId(first._id);
    if (first.type === 'paragraph') {
      setActiveTarget(first._id);
      // NOT requestAnimationFrame. A frame can land before React has committed
      // the new ParagraphEditor, so `blockRefs.current[id]` is still undefined
      // and the caret never arrives, the new paragraph appears and does
      // nothing, which is exactly what "click below to add a line" must not do.
      // The effect below fires once the ref genuinely exists.
      pendingFocus.current = first._id;
    }
    setMode('edit');
    return local;
  }

  /** Clicking a palette tile: land it right after whatever is selected, or at
   *  the end. No dialog, no "where should this go" — the same answer a
   *  document editor gives. */
  function addFromPalette(kind: PaletteKind) {
    const at = selectedId ? blocks.findIndex(b => b._id === selectedId) + 1 : blocks.length;
    insertBlocks([blockForKind(kind)], at);
  }

  /** Clicking the blank paper below the last block. Focuses a trailing empty
   *  paragraph if there already is one rather than adding a second. */
  function appendAtTail() {
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'paragraph' && !last.content.trim()) {
      setSelectedId(last._id);
      setActiveTarget(last._id);
      blockRefs.current[last._id]?.focus();
      return;
    }
    insertBlocks([blockForKind('paragraph:body')], blocks.length);
  }

  /** A starter REPLACES an email that has no words in it yet (a new email
   *  opens with an empty headline and an empty line, which a starter should
   *  take the place of, not sit under). An email with anything in it keeps
   *  it, and the starter goes at the end. */
  function applyStarter(starterBlocks: EmailBlock[]) {
    const untouched = blocks.every(b => b.type === 'paragraph' && !b.content.trim());
    if (!untouched) { insertBlocks(starterBlocks, blocks.length); return; }
    setBlocks(withIds(starterBlocks));
    setSelectedId(null);
    setActiveTarget('subject');
    setMode('edit');
  }

  function deleteBlock(id: string) {
    setBlocks(bs => bs.filter(b => b._id !== id));
    setSelectedId(s => (s === id ? null : s));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks(bs => {
      const idx = bs.findIndex(b => b._id === id);
      const swapWith = idx + dir;
      if (idx < 0 || swapWith < 0 || swapWith >= bs.length) return bs;
      const next = [...bs];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  function handleTokenInsert(tokenKey: string) {
    const token = `{{${tokenKey}}}`;
    if (activeTarget === 'subject') {
      const input = subjectRef.current;
      if (!input) { setSubject(s => s + token); return; }
      const s = input.selectionStart ?? subject.length;
      const e = input.selectionEnd ?? subject.length;
      setSubject(subject.slice(0, s) + token + subject.slice(e));
      requestAnimationFrame(() => { input.focus(); input.setSelectionRange(s + token.length, s + token.length); });
      return;
    }
    const el = blockRefs.current[activeTarget];
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    let range: Range;
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) range = sel.getRangeAt(0);
    else {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    insertPillAtRange(range, tokenKey);
    updateParagraphContent(activeTarget, serializeParagraphDom(el));
  }

  // ── Tokens that come to you ────────────────────────────────────────────────
  // The Details rail is a place you go. This is the other half: the same
  // tokens, offered at the caret while you write. Two triggers, one layer
  // (see TokenSuggest), and both of them read-only until you pick something,
  // nothing below writes to a block unless a token is actually chosen.

  /** Where the caret is, in viewport coordinates. A collapsed range reports a
   *  zero rect in some engines, so fall back to the element it sits in. */
  function caretRect(el: HTMLElement): CaretRect | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !el.contains(sel.anchorNode)) return null;
    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    let box: DOMRect | null = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
    if (!box || (box.width === 0 && box.height === 0)) {
      const host = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as HTMLElement);
      box = (host ?? el).getBoundingClientRect();
    }
    return { left: box.left, top: box.top, bottom: box.bottom };
  }

  /** Everything typed in this block up to the caret. Pill atoms contribute
   *  their visible text, which is all the end-anchored nudge rules need. */
  function textBeforeCaret(el: HTMLElement): string {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !el.contains(sel.anchorNode)) return '';
    const r = sel.getRangeAt(0).cloneRange();
    r.setStart(el, 0);
    return r.toString();
  }

  const refreshSuggest = useCallback((blockId: string) => {
    const el = blockRefs.current[blockId];
    if (!el || document.activeElement !== el) { setSuggest(null); return; }
    const rect = caretRect(el);
    if (!rect) { setSuggest(null); return; }
    const before = textBeforeCaret(el);
    const trigger = TYPEAHEAD_TRIGGER.exec(before);
    if (trigger) { setSuggest({ mode: 'typeahead', target: blockId, query: trigger[1], rect }); return; }
    if (nudgesOff) { setSuggest(null); return; }
    const keys = nudgeKeysFor(before, serializeParagraphDom(el));
    setSuggest(keys.length > 0 ? { mode: 'nudge', target: blockId, query: '', rect, keys } : null);
  }, [nudgesOff]);

  /** The subject is a plain <input>, which has no caret rect worth measuring,
   *  so its typeahead hangs off the field itself. Nudges are never offered
   *  here: a subject line is short and read at a glance, and a chip bar under
   *  it would cover the sheet's own header. */
  function refreshSubjectSuggest(value: string, caret: number) {
    const input = subjectRef.current;
    if (!input) { setSuggest(null); return; }
    const trigger = TYPEAHEAD_TRIGGER.exec(value.slice(0, caret));
    if (!trigger) { setSuggest(null); return; }
    const r = input.getBoundingClientRect();
    setSuggest({ mode: 'typeahead', target: 'subject', query: trigger[1], rect: { left: r.left, top: r.top, bottom: r.bottom } });
  }

  const closeSuggest = useCallback(() => setSuggest(null), []);
  const silenceNudges = useCallback(() => { setNudgesOff(true); setSuggest(null); }, []);

  /** Drops the chosen token in, eating the `{{query` that opened the list. A
   *  nudge has no trigger text to eat, so it only inserts. */
  const pickSuggestion = useCallback((key: EmailTokenKey) => {
    const s = suggest;
    if (!s) return;
    const token = `{{${key}}}`;

    if (s.target === 'subject') {
      const input = subjectRef.current;
      const caret = input?.selectionStart ?? subject.length;
      const trigger = s.mode === 'typeahead' ? TYPEAHEAD_TRIGGER.exec(subject.slice(0, caret)) : null;
      const from = trigger ? caret - trigger[0].length : caret;
      const next = subject.slice(0, from) + token + subject.slice(caret);
      setSubject(next);
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(from + token.length, from + token.length);
      });
      setSuggest(null);
      return;
    }

    const el = blockRefs.current[s.target];
    if (!el) { setSuggest(null); return; }
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setSuggest(null); return; }
    const range = sel.getRangeAt(0);
    if (s.mode === 'typeahead' && range.startContainer.nodeType === Node.TEXT_NODE) {
      const before = (range.startContainer.textContent ?? '').slice(0, range.startOffset);
      const trigger = TYPEAHEAD_TRIGGER.exec(before);
      // insertPillAtRange deletes the range first, so extending the start back
      // over `{{query` is what removes it, no separate edit, no second undo
      // step, and the pill lands exactly where the trigger was typed.
      if (trigger) range.setStart(range.startContainer, range.startOffset - trigger[0].length);
    }
    insertPillAtRange(range, key);
    updateParagraphContent(s.target, serializeParagraphDom(el));
    setSuggest(null);
  }, [suggest, subject, updateParagraphContent]);

  // A suggestion is anchored to a caret that no longer exists once the mode
  // flips to preview or the selection jumps to another block.
  useEffect(() => { if (mode !== 'edit') setSuggest(null); }, [mode]);

  /** Applies a mark to whatever is selected inside one paragraph. Focusing the
   *  element first is what makes the toolbar buttons work at all — they use
   *  onMouseDown-preventDefault so the caret never leaves the paragraph, and
   *  execCommand then acts on that live selection (or, with nothing selected,
   *  arms the mark for the next keystroke, exactly like a word processor). */
  function applyMarkToBlock(id: string, cmd: 'bold' | 'italic') {
    const el = blockRefs.current[id];
    if (!el) return;
    el.focus();
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* default is fine */ }
    document.execCommand(cmd);
    updateParagraphContent(id, serializeParagraphDom(el));
    try { setFmt({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic') }); } catch { /* keep */ }
  }

  function applyMarkToSelected(cmd: 'bold' | 'italic') {
    if (!selected || selected.type !== 'paragraph') return;
    applyMarkToBlock(selected._id, cmd);
  }

  // ── Drag placement ─────────────────────────────────────────────────────────

  function computeDropIndex(clientY: number): number {
    const entries = blocks
      .map((b, i) => ({ i, el: blockNodes.current[b._id] }))
      .filter((e): e is { i: number; el: HTMLDivElement } => !!e.el);
    for (const { i, el } of entries) {
      const r = el.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return blocks.length;
  }

  function handleCanvasDragOver(e: React.DragEvent) {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragging.kind === 'new' ? 'copy' : 'move';
    setDropIndex(computeDropIndex(e.clientY));
  }

  function handleCanvasDrop(e: React.DragEvent) {
    if (!dragging) return;
    e.preventDefault();
    const target = dropIndex ?? computeDropIndex(e.clientY);
    if (dragging.kind === 'new') {
      insertBlocks([blockForKind(dragging.palette)], target);
    } else {
      setBlocks(bs => {
        const from = bs.findIndex(b => b._id === dragging.id);
        if (from < 0) return bs;
        const next = [...bs];
        const [moved] = next.splice(from, 1);
        next.splice(from < target ? target - 1 : target, 0, moved);
        return next;
      });
      setSelectedId(dragging.id);
    }
    setDragging(null);
    setDropIndex(null);
  }

  // ── Preview + test send ────────────────────────────────────────────────────

  const asCandidate = asId ? previewCandidates.find(c => c.id === asId) ?? null : null;
  const asMatches = useMemo(() => {
    const q = asQuery.trim().toLowerCase();
    if (!q) return previewCandidates.slice(0, 8);
    return previewCandidates.filter(c => c.label.toLowerCase().includes(q)).slice(0, 8);
  }, [previewCandidates, asQuery]);

  // Nobody picked: the conference's own name and dates are still known, so
  // only the per-person fields read as highlighted blanks.
  const previewCtx: EmailTokenContext = asCandidate?.ctx ?? {
    conference_name: testSendContext.conference_name ?? null,
    conference_dates: testSendContext.conference_dates ?? null,
  };

  // Re-rendering the iframe srcDoc on every keystroke flashes it white; a
  // short debounce keeps it instant without the churn.
  const [debouncedBlocks, setDebouncedBlocks] = useState<LocalBlock[]>(blocks);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBlocks(blocks), 250);
    return () => clearTimeout(t);
  }, [blocks]);

  /** The conference as the Design panel currently has it, so "See it for real"
   *  and the test send both show the colours being picked rather than the ones
   *  saved 700ms ago. Identical to `conference` when no Design panel is wired. */
  const previewConference = useMemo(
    () => (design ? { ...conference, email_theme: design.theme } : conference),
    [conference, design?.theme] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const previewHtml = useMemo(
    () => renderEmailHtml({ blocks: stripIds(debouncedBlocks), conference: previewConference, ctx: previewCtx, ...renderAs }),
    // previewCtx is derived from asCandidate; depending on the candidate keeps
    // this from re-rendering on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedBlocks, previewConference, asCandidate, eventKey]
  );

  async function handleSendTest() {
    if (!accessToken || !organizerEmail || sendingTest) return;
    setSendingTest(true);
    setTestMessage(null);
    const ctx = asCandidate?.ctx ?? testSendContext;
    const liveBlocks = stripIds(blocks);
    const supabase = getAuthedClient(accessToken);
    const { error } = await supabase.from('email_outbox').insert({
      conference_id: conferenceId,
      template_id: null,
      recipient_application_id: null,
      recipient_email: organizerEmail,
      subject: '[TEST] ' + resolveTokens(subject, ctx),
      body: resolveTokens(flattenBlocksToPlainText(liveBlocks, previewConference), ctx),
      body_html: renderEmailHtml({ blocks: liveBlocks, conference: previewConference, ctx, ...renderAs }),
      status: 'pending',
    });
    setSendingTest(false);
    if (error) { setTestMessage(friendlyError(error, "Couldn't send the test email. Please try again.")); return; }
    triggerEmailDelivery(supabase);
    const missing = unresolvedRecipients && unresolvedRecipients.affected > 0
      ? ` ${unresolvedRecipients.affected} of ${unresolvedRecipients.total} real recipients are missing ${unresolvedRecipients.fields.map(f => f.label).join(', ')} and will not be sent it.`
      : '';
    setTestMessage(`Test sent to ${organizerEmail}.${missing}`);
    setTimeout(() => setTestMessage(m => (m?.startsWith('Test sent') ? null : m)), 4500);
  }

  // ── Readiness checks (the properties panel's resting state) ────────────────

  const checks = useMemo(() => {
    const paragraphs = blocks.filter(b => b.type === 'paragraph' && b.content.trim());
    const images = blocks.filter((b): b is ImageBlock & { _id: string } => b.type === 'image');
    const buttons = blocks.filter((b): b is ButtonBlock & { _id: string } => b.type === 'button');
    return [
      { ok: subject.trim().length > 0, label: 'A subject line', fix: 'People see this first. Write one above.' },
      { ok: paragraphs.length > 0, label: 'Something to say', fix: 'Add at least one line of text.' },
      { ok: buttons.every(b => b.label.trim()), label: 'Every button has words', fix: 'A button with no words reads "Learn more".' },
      { ok: images.every(b => b.url && b.alt.trim()), label: 'Every picture described', fix: 'Some people never see the picture. The description is what they read instead.' },
    ];
  }, [blocks, subject]);

  // ── Pieces ─────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS, NOT COMPONENTS. They are defined in the closure (they need
  // a dozen callbacks each) and are therefore INVOKED — `paletteTile(item)`,
  // never `<PaletteTile item={item} />`. Rendering a closure-defined function
  // as JSX gives it a fresh component identity on every parent render, which
  // makes React unmount and remount the subtree; the paragraph editors below
  // build their contentEditable DOM once on mount, so a remount would wipe
  // whatever had just been typed. Calling them inlines the elements instead.
  // ─────────────────────────────────────────────────────────────────────────

  /** Where anything picked from the Add menu lands: right after whatever is
   *  selected, or at the end. */
  const insertIndex = () => (selectedId ? blocks.findIndex(b => b._id === selectedId) + 1 : blocks.length);

  const tileHover = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = NEU.outSmHover;
      e.currentTarget.style.transform = 'translateY(-2px)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = NEU.outSm;
      e.currentTarget.style.transform = 'translateY(0)';
    },
  };

  function paletteTile(item: (typeof PALETTE_ITEMS)[number]) {
    return (
      <button
        key={item.kind}
        type="button"
        draggable
        title={`${item.hint}. Click to add, or drag it onto the email.`}
        onDragStart={e => {
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', item.kind);
          setDragging({ kind: 'new', palette: item.kind });
        }}
        onDragEnd={() => { setDragging(null); setDropIndex(null); setAddOpen(false); }}
        onClick={() => { addFromPalette(item.kind); setAddOpen(false); }}
        className="flex flex-col items-center justify-center gap-1.5 w-full focus:outline-none"
        style={{
          minHeight: 84,
          padding: '10px 8px',
          borderRadius: 16,
          border: CARD_BORDER,
          backgroundColor: '#FFFDF8',
          boxShadow: NEU.outSm,
          cursor: 'grab',
          transitionProperty: 'box-shadow, transform',
          transitionDuration: '220ms',
          transitionTimingFunction: EASE,
        }}
        {...tileHover}
      >
        <Emoji3D name={item.emoji} size={30} fallback={item.icon} fallbackColor={FOREST} />
        <span style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: INK, textAlign: 'center' }}>
          {item.label}
        </span>
      </button>
    );
  }

  const ADD_TABS: { key: AddTab; label: string; emoji: string }[] = [
    { key: 'blocks', label: 'Blocks', emoji: 'Memo' },
    { key: 'details', label: 'Their details', emoji: 'Bust in silhouette' },
    { key: 'files', label: 'Files', emoji: 'Paperclip' },
    { key: 'starters', label: 'Starters', emoji: 'Clipboard' },
  ];

  /** The one Add menu. Four tabs, one panel at a time. While a block is being
   *  dragged out of it the menu turns see-through and lets the pointer pass,
   *  so it never sits between the tile and the paper it is being dropped on. */
  const addMenu = (
    <div
      style={{
        padding: 12, borderRadius: 22,
        backgroundColor: NEU.surface, border: CARD_BORDER, boxShadow: CARD_SHADOW,
        opacity: dragging?.kind === 'new' ? 0 : 1,
        pointerEvents: dragging?.kind === 'new' ? 'none' : 'auto',
        transitionProperty: 'opacity', transitionDuration: '160ms',
      }}
    >
      {/* The four tabs are drawn ONCE. On a wide screen the left column IS the
          tab row (each tool opens this menu on its own tab), so the menu shows
          only that tab's title; drawing its own row of four here as well is
          what made the tabs "appear double when clicked" (owner, Oct 2026).
          On a narrow screen the bottom bar has a single Add, so the tabs live
          here. */}
      {wide ? (() => {
        const t = ADD_TABS.find(x => x.key === addTab) ?? ADD_TABS[0];
        return <PanelTitle emoji={t.emoji}>{t.label}</PanelTitle>;
      })() : (
      <div className="grid grid-cols-2 gap-1.5 mb-3" role="tablist" aria-label="What to add">
        {ADD_TABS.map(t => {
          const active = addTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onMouseDown={e => e.preventDefault()}
              onClick={() => setAddTab(t.key)}
              className="inline-flex items-center gap-2 focus:outline-none"
              style={{
                minHeight: 42, padding: '6px 10px', borderRadius: 14,
                border: 'none',
                background: active ? `linear-gradient(135deg, ${FOREST}, #2E6041)` : 'rgba(27,56,40,0.05)',
                color: active ? GOLD : INK,
                fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                transitionProperty: 'background, color', transitionDuration: '180ms',
              }}
            >
              <Emoji3D name={t.emoji} size={20} fallback={Sparkles} fallbackColor={active ? GOLD : FOREST} />
              {t.label}
            </button>
          );
        })}
      </div>
      )}

      {addTab === 'blocks' && (
        <div className="grid grid-cols-3 gap-2">
          {PALETTE_ITEMS.map(item => paletteTile(item))}
        </div>
      )}

      {addTab === 'details' && (
        <>
          {/* Every token keeps its identity (emoji, short name, what it
              becomes) and its family; the family names are the only headings.
              What it becomes is the hover, not a printed line. */}
          <div className="flex flex-col gap-3">
            {TOKEN_FAMILY_ORDER.map(family => {
              const keys = EMAIL_TOKEN_KEYS.filter(k => tokenIdentity(k).family === family);
              if (keys.length === 0) return null;
              return (
                <div key={family}>
                  <p className="mb-1.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: SOFT }}>
                    {TOKEN_FAMILY_LABEL[family as TokenFamily]}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {keys.map(key => {
                      const id = tokenIdentity(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          title={id.becomes}
                          aria-label={`${tokenLabel(key)}. ${id.becomes}`}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { handleTokenInsert(key); setAddOpen(false); }}
                          className="flex items-center gap-2 w-full text-left focus:outline-none"
                          style={{
                            minHeight: 42,
                            padding: '6px 10px',
                            borderRadius: 999,
                            backgroundColor: 'rgba(238,217,138,0.34)',
                            border: '1px solid rgba(27,56,40,0.16)',
                            cursor: 'pointer',
                            transitionProperty: 'background-color',
                            transitionDuration: '180ms',
                            transitionTimingFunction: EASE,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(238,217,138,0.66)'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(238,217,138,0.34)'; }}
                        >
                          <Emoji3D name={id.emoji} size={18} fallback={id.icon} fallbackColor={FOREST} />
                          <span className="min-w-0 flex-1" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: FOREST, lineHeight: 1.2 }}>
                            {tokenShort(key)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
            Tip: type <strong style={{ color: FOREST }}>{'{{'}</strong> while writing and they come to you.
          </p>
        </>
      )}

      {addTab === 'files' && (
        <ConferenceFilesPanel
          files={conferenceFiles}
          error={filesError}
          wide
          onInsert={f => { insertBlocks([blockForFile(f)], insertIndex()); setAddOpen(false); }}
        />
      )}

      {addTab === 'starters' && (
        <div className="flex flex-col gap-2">
          {STARTERS.map(st => (
            <button
              key={st.id}
              type="button"
              title={`${st.hint}. Everything stays editable.`}
              onClick={() => { applyStarter(st.blocks); setAddOpen(false); }}
              className="flex items-center gap-3 text-left focus:outline-none w-full"
              style={{
                minHeight: 56,
                padding: '9px 12px',
                borderRadius: 16,
                border: CARD_BORDER,
                backgroundColor: '#FFFDF8',
                boxShadow: NEU.outSm,
                cursor: 'pointer',
                transitionProperty: 'box-shadow, transform',
                transitionDuration: '220ms',
                transitionTimingFunction: EASE,
              }}
              {...tileHover}
            >
              <span
                className="flex flex-col justify-center gap-1 flex-shrink-0"
                style={{ width: 34, height: 38, padding: 5, borderRadius: 8, backgroundColor: '#FFFFFF', boxShadow: NEU.inSm }}
              >
                {st.shape.map((k, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'block',
                      height: k === 'i' ? 8 : k === 'h' ? 3.5 : 2,
                      width: k === 'b' ? '58%' : k === 's' ? '70%' : '100%',
                      borderRadius: 2,
                      backgroundColor: k === 'b' ? NEU_GRADIENTS.gold[1] : k === 'i' ? 'rgba(27,56,40,0.22)' : k === 'h' ? FOREST : 'rgba(27,56,40,0.3)',
                    }}
                  />
                ))}
              </span>
              <Emoji3D name={st.emoji} size={22} fallback={Sparkles} fallbackColor={FOREST} />
              <span className="min-w-0 flex-1" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: INK, lineHeight: 1.25 }}>
                {st.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ── The sheet ──────────────────────────────────────────────────────────────

  /** The between-blocks insertion point: a hairline and a "+" that only appear
   *  when the pointer is in the gap (or the menu is open), so a finished email
   *  reads as an email rather than a form full of affordances. */
  function insertGap(index: number) {
    const open = insertAt === index;
    const shown = open || hoverGap === index;
    const btnRef = gapRef(index);
    return (
      <div
        className="relative"
        onMouseEnter={() => setHoverGap(index)}
        onMouseLeave={() => setHoverGap(g => (g === index ? null : g))}
        style={{ height: 16, marginTop: -8, marginBottom: -8, zIndex: open ? 6 : 2 }}
      >
        <div
          className="absolute inset-x-0 flex items-center justify-center"
          style={{ top: 0, height: 16, opacity: shown ? 1 : 0, transitionProperty: 'opacity', transitionDuration: '160ms' }}
        >
          <span style={{ flex: 1, height: 1, backgroundColor: 'rgba(27,56,40,0.22)' }} />
        </div>
        <button
          ref={btnRef}
          type="button"
          aria-label="Add a block here"
          onClick={() => setInsertAt(a => (a === index ? null : index))}
          className="absolute left-1/2 focus:outline-none"
          style={{
            top: -5, marginLeft: -13, width: 26, height: 26, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(27,56,40,0.22)',
            backgroundColor: open ? NEU_GRADIENTS.gold[0] : '#FFFDF8',
            color: FOREST, cursor: 'pointer',
            opacity: shown ? 1 : 0,
            pointerEvents: shown ? 'auto' : 'none',
            boxShadow: '0 2px 6px rgba(27,56,40,0.16)',
            transitionProperty: 'opacity, background-color, transform',
            transitionDuration: '160ms',
            transitionTimingFunction: EASE,
          }}
        >
          <Plus size={14} strokeWidth={2.6} style={{ transform: open ? 'rotate(45deg)' : 'none', transitionProperty: 'transform', transitionDuration: '200ms' }} />
        </button>
        {/* PORTALED, not absolutely positioned inside the sheet. The sheet
            carries `overflow: hidden` for its rounded corners, so this menu
            opened at the last gap was cut off by the paper's own bottom edge.
            PopoverLayer puts it in fixed viewport coordinates, flips it above
            the "+" when there is no room below, and clamps it to the window,
            the house rule, rather than loosening the sheet's overflow. */}
        <PopoverLayer
          anchorRef={btnRef}
          open={open}
          onClose={() => setInsertAt(a => (a === index ? null : a))}
          width={272}
          maxHeight={260}
        >
          <div
            className="flex gap-1.5 flex-wrap"
            style={{ padding: 8, borderRadius: 16, backgroundColor: NEU.surface, border: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            {PALETTE_ITEMS.map(item => (
              <button
                key={item.kind}
                type="button"
                onClick={() => { insertBlocks([blockForKind(item.kind)], index); setInsertAt(null); }}
                className="flex items-center gap-1.5 focus:outline-none"
                style={{
                  minHeight: 34, padding: '7px 10px', borderRadius: 999,
                  border: CARD_BORDER, backgroundColor: '#FFFDF8',
                  fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, color: INK, cursor: 'pointer',
                }}
              >
                <Emoji3D name={item.emoji} size={14} fallback={item.icon} fallbackColor={FOREST} />
                {item.label}
              </button>
            ))}
          </div>
        </PopoverLayer>
      </div>
    );
  }

  function blockFrame(block: LocalBlock, index: number) {
    const isSelected = selectedId === block._id;
    const toolsShown = isSelected || hoverId === block._id;
    return (
      <div
        ref={el => { blockNodes.current[block._id] = el; }}
        onMouseEnter={() => setHoverId(block._id)}
        onMouseLeave={() => setHoverId(h => (h === block._id ? null : h))}
        onClick={() => { setSelectedId(block._id); if (block.type === 'paragraph') setActiveTarget(block._id); }}
        className="relative"
        style={{
          borderRadius: 10,
          margin: '0 -10px',
          padding: '4px 10px 0 10px',
          outline: isSelected ? `2px solid ${NEU_GRADIENTS.gold[1]}` : '2px solid transparent',
          outlineOffset: 2,
          backgroundColor: isSelected ? 'rgba(238,217,138,0.14)' : 'transparent',
          transitionProperty: 'outline-color, background-color',
          transitionDuration: '180ms',
          transitionTimingFunction: EASE,
          cursor: block.type === 'paragraph' ? 'text' : 'pointer',
        }}
      >
        {/* ── THE BLOCK'S HANDLE ──────────────────────────────────────────
            This used to be a nine-control bar floating at `top: -17` over the
            block — i.e. HALF ON THE BLOCK'S OWN FIRST LINE and half on the one
            above it, revealed by mere hover, so moving the pointer across a
            finished email covered the words you were reading with a toolbar.
            That is the collision the owner reported.

            It is not repositioned, it is DOCKED. Everything it carried already
            had a stable home in the properties panel one column to the right —
            size, bold/italic, delete — and move up/down has now joined them
            there. Bold and italic also still answer to ⌘B / ⌘I with the caret
            exactly where it was, which is the only truly in-place way to mark
            a word anyway.

            What is left on the paper is the one thing that genuinely has to be
            ON the object: the drag handle. It lives in the SHEET'S OWN 40px
            LEFT MARGIN — the strip of paper the renderer guarantees is blank
            from the top of the email to the bottom — so it cannot overlap a
            glyph at any block, in any position, by construction rather than by
            a flip heuristic. One icon, no text. ── */}
        <span
          draggable
          onDragStart={e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', block._id);
            setDragging({ kind: 'move', id: block._id });
          }}
          onDragEnd={() => { setDragging(null); setDropIndex(null); }}
          onClick={e => { e.stopPropagation(); setSelectedId(block._id); }}
          role="button"
          tabIndex={-1}
          aria-label={`Drag to move: block ${index + 1} of ${blocks.length}`}
          title={`Drag to move: block ${index + 1} of ${blocks.length}`}
          className="absolute inline-flex items-center justify-center"
          style={{
            // -24, measured: blockFrame's own `margin: 0 -10px` already hangs
            // it 10px into the sheet's 36px paper margin, so the free strip is
            // 0…26px from the sheet's edge. -24 puts this 22px handle at 2…24.
            left: -24, top: 4, width: 22, height: 30, borderRadius: 8,
            backgroundColor: isSelected ? NEU_GRADIENTS.gold[0] : 'rgba(27,56,40,0.06)',
            color: isSelected ? FOREST : SOFT,
            cursor: 'grab',
            opacity: toolsShown ? 1 : 0,
            pointerEvents: toolsShown ? 'auto' : 'none',
            transitionProperty: 'opacity, background-color, color',
            transitionDuration: '160ms',
            transitionTimingFunction: EASE,
            zIndex: 5,
          }}
        >
          <GripVertical size={14} strokeWidth={2.2} />
        </span>

        {block.type === 'paragraph' && (
          <ParagraphEditor
            blockId={block._id}
            initialContent={block.content}
            variant={block.variant ?? 'body'}
            lead={block._id === leadId}
            registerRef={registerBlockRef}
            onFocusBlock={id => { setActiveTarget(id); setSelectedId(id); }}
            onContentChange={updateParagraphContent}
            onFormatState={setFmt}
            onCaret={refreshSuggest}
          />
        )}
        {block.type === 'paragraph' && block._id === leadId && (
          // The card's short gold rule under the headline.
          <div aria-hidden style={{ display: 'flex', justifyContent: 'center', padding: '18px 0 24px' }}>
            <span style={{ width: 44, height: 2, borderRadius: 1, backgroundColor: MAIL_RULE }} />
          </div>
        )}

        {/* A labelled-facts block, read-only for now.
            It cannot be created or edited here yet, but it MUST be shown: the
            default allocation, payment and receipt emails contain one, and
            turnOnDefaultEmail copies those blocks into the organiser's own
            template. Without this branch the block still survived a save (the
            per-type `&&` guards mean nothing is dropped from state) but showed
            as a blank card, so an organiser would be looking at an unexplained
            gap where their delegate sees committee and country. */}
        {block.type === 'facts' && (
          <div style={{ padding: '6px 0 22px' }}>
            {/* emailCard's detailRows: plain rows between hairlines, the
                label in grey on the left, the value bold on the right. */}
            <div style={{ borderTop: `1px solid ${MAIL_HAIRLINE}`, borderBottom: `1px solid ${MAIL_HAIRLINE}` }}>
              {block.items.map((it, i) => (
                <div
                  key={`${it.label}-${i}`}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${MAIL_HAIRLINE}`,
                    fontFamily: MAIL_SANS,
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1.4, color: MAIL_INK_SOFT }}>
                    {it.label}
                  </span>
                  <span style={{ fontSize: 16, lineHeight: 1.35, fontWeight: 700, color: '#1C1410', textAlign: 'right' }}>{it.value}</span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#6E6456', paddingTop: 7, textAlign: 'center' }}>
              Filled in for each person. Not editable yet.
            </p>
          </div>
        )}

        {block.type === 'button' && (
          <ButtonBlockCanvas
            block={block}
            selected={isSelected}
            asLink={block._id !== firstButtonId}
            onPatch={patch => patchButton(block._id, patch)}
          />
        )}

        {block.type === 'image' && (
          <div style={{ textAlign: 'center', padding: '10px 0 22px' }}>
            {block.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.url}
                alt={block.alt || ''}
                style={{ width: '100%', maxWidth: CONTENT_WIDTH, height: 'auto', display: 'block', margin: '0 auto', borderRadius: 12 }}
              />
            ) : (
              <span
                className="flex flex-col items-center justify-center gap-1"
                style={{
                  height: 132, borderRadius: 10,
                  border: '2px dashed rgba(27,56,40,0.22)',
                  backgroundColor: 'rgba(238,217,138,0.12)',
                  color: FOREST, fontFamily: OUTFIT, fontSize: 12, fontWeight: 700,
                }}
              >
                <Emoji3D name="Framed picture" size={26} fallback={ImageIcon} fallbackColor={FOREST} />
                Pick a picture in the panel
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  /** SUBJECT, on top of the email like a real email's subject line: who it is
   *  from, small, then the subject itself, large. Inside the sheet while
   *  writing; above the real email while previewing. */
  const subjectStrip = (
    <div
      className="flex items-center gap-3"
      style={{ padding: '12px 18px', backgroundColor: '#FFFFFF', borderBottom: `1px solid ${MAIL_HAIRLINE}` }}
    >
      <span title={`From ${confShortName}${conference.contact_email ? `, ${conference.contact_email}` : ''}`} className="flex-shrink-0">
        <LogoDisc
          src={conference.logo_url}
          alt={conference.acronym}
          size={34}
          fallbackText={conference.acronym.slice(0, 2)}
        />
      </span>
      <div className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5 flex-wrap" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, lineHeight: 1.3 }}>
          <label htmlFor="email-composer-subject" style={{ fontWeight: 700, color: SOFT }}>Subject</label>
          <span className="[overflow-wrap:anywhere]">from {confShortName}</span>
        </span>
        <input
          id="email-composer-subject"
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={e => {
            setSubject(e.target.value);
            refreshSubjectSuggest(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyUp={e => refreshSubjectSuggest(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onBlur={() => { if (suggest?.target === 'subject') setSuggest(null); }}
          onFocus={() => { setActiveTarget('subject'); setSelectedId(null); }}
          placeholder="What they see first in their inbox"
          className="w-full focus:outline-none"
          style={{
            fontFamily: OUTFIT, fontSize: 18, fontWeight: 700, color: INK,
            background: 'transparent', border: 'none', padding: '1px 0', minHeight: 30,
          }}
        />
      </div>
    </div>
  );

  const sheet = (
    <div style={{ width: '100%', maxWidth: SHEET_WIDTH, margin: '0 auto' }}>
    <div
      style={{
        borderRadius: 18,
        backgroundColor: MAIL_CARD,
        border: `1px solid ${MAIL_CARD_BORDER}`,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 18px 40px -20px rgba(27,56,40,0.36)',
      }}
    >
      {subjectStrip}

      {/* ── Chrome the renderer adds on its own (emailCard's masthead), drawn
          so the sheet is the whole email, and labelled ADDED FOR YOU so
          nobody hunts for the control that would edit it. ── */}
      <div className="relative" style={{ textAlign: 'center' }}>
        {mastBanner ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mastBanner}
              alt=""
              style={{ display: 'block', width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', backgroundColor: MAIL_CARD_BORDER }}
            />
            {headerLogo && (
              <div style={{ marginTop: -40, display: 'flex', justifyContent: 'center' }}>
                <span style={{ padding: 4, borderRadius: 999, backgroundColor: '#FFFFFF', display: 'inline-flex' }}>
                  <span style={{ width: 76, height: 76, borderRadius: 999, backgroundColor: '#FFFFFF', boxShadow: '0 3px 10px rgba(10,24,16,0.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={headerLogo} alt="" style={{ width: 59, height: 59, objectFit: 'contain' }} />
                  </span>
                </span>
              </div>
            )}
          </>
        ) : headerLogo ? (
          <div style={{ paddingTop: 30, display: 'flex', justifyContent: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: '#FFFFFF', boxShadow: '0 3px 10px rgba(10,24,16,0.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={headerLogo} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            </span>
          </div>
        ) : (
          <div style={{ height: 18 }} />
        )}
        <div style={{ padding: `${mastBanner && headerLogo ? 10 : 12}px ${MAIL_PAD}px 0`, fontFamily: MAIL_SANS }}>
          <div className="[overflow-wrap:anywhere]" style={{ fontSize: 15, lineHeight: 1.3, fontWeight: 800, letterSpacing: '0.02em', color: FOREST }}>
            {confShortName}
          </div>
          {mastMeta && (
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: MAIL_INK_SOFT, paddingTop: 2 }}>
              {mastMeta}
            </div>
          )}
        </div>
        {heroIcon && (
          <div style={{ paddingTop: 30, display: 'flex', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${EMAIL_ASSET_BASE}icons/${heroIcon}.png`} alt="" width={64} height={64} style={{ display: 'block', width: 64, height: 64 }} />
          </div>
        )}
        {/* No headline at all: the card uses the conference's name as one. */}
        {!leadId && blocks.length > 0 && (
          <div title="With no headline of your own, the conference's name is used. Add a Headline block to write your own." style={{ padding: `${heroIcon ? 22 : 28}px ${MAIL_PAD}px 0`, cursor: 'help' }}>
            <div style={{ fontFamily: MAIL_SANS, fontSize: 29, fontWeight: 300, lineHeight: 1.25, letterSpacing: '-0.01em', color: FOREST, opacity: 0.55 }}>
              {confShortName}
            </div>
            <div aria-hidden style={{ display: 'flex', justifyContent: 'center', paddingTop: 18 }}>
              <span style={{ width: 44, height: 2, borderRadius: 1, backgroundColor: MAIL_RULE }} />
            </div>
          </div>
        )}
        <span
          title="The top and the bottom are added to every email for you. The logo and the footer line are under Design."
          style={{
            position: 'absolute', left: 10, top: 10,
            padding: '3px 10px', borderRadius: 999,
            fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700,
            backgroundColor: 'rgba(255,253,248,0.94)', color: FOREST,
            border: '1px solid rgba(27,56,40,0.14)',
            cursor: 'help',
          }}
        >
          Added for you
        </span>
      </div>

      {/* Body */}
      <div
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        style={{ padding: `${leadId && blocks[0]?._id === leadId ? (heroIcon ? 22 : 28) : 24}px ${MAIL_PAD}px 0 ${MAIL_PAD}px`, minHeight: 160 }}
      >
        {blocks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{
              minHeight: 230, borderRadius: 14,
              border: dragging ? `2px dashed ${NEU_GRADIENTS.gold[1]}` : '2px dashed rgba(27,56,40,0.16)',
              backgroundColor: dragging ? 'rgba(238,217,138,0.16)' : 'transparent',
              padding: 20,
              transitionProperty: 'border-color, background-color',
              transitionDuration: '200ms',
            }}
          >
            <Emoji3D name="Inbox tray" size={44} fallback={Send} fallbackColor={FOREST} />
            <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: INK, textWrap: 'balance' }}>
              Your Email Starts Here
            </p>
            <p className="mt-1 mb-4" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: SOFT, maxWidth: 300, lineHeight: 1.5, textWrap: 'pretty' }}>
              Pick a first piece.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PALETTE_ITEMS.filter(i => i.kind !== 'paragraph:small').map(item => (
                <ActionButton key={item.kind} size="sm" tone="quiet" onClick={() => addFromPalette(item.kind)}>
                  <Emoji3D name={item.emoji} size={14} fallback={item.icon} fallbackColor={FOREST} />
                  {item.label}
                </ActionButton>
              ))}
            </div>
          </div>
        ) : (
          <>
            {blocks.map((block, i) => (
              <div key={block._id}>
                {dropIndex === i && dragging && (
                  <div style={{ height: 3, borderRadius: 999, backgroundColor: NEU_GRADIENTS.gold[1], margin: '4px 0', boxShadow: `0 0 8px ${NEU_GRADIENTS.gold[1]}` }} />
                )}
                {insertGap(i)}
                {blockFrame(block, i)}
              </div>
            ))}
            {dropIndex === blocks.length && dragging && (
              <div style={{ height: 3, borderRadius: 999, backgroundColor: NEU_GRADIENTS.gold[1], margin: '4px 0', boxShadow: `0 0 8px ${NEU_GRADIENTS.gold[1]}` }} />
            )}
            {insertGap(blocks.length)}
            {/* ── THE TAIL ──────────────────────────────────────────────────
                Blank paper under the last block, and clicking it starts a new
                line, the thing every document editor in the world does. It
                reuses the last block when that block is an empty paragraph,
                so leaning on the mouse cannot stack blank paragraphs down the
                page. ── */}
            <div
              onClick={appendAtTail}
              aria-hidden
              style={{ minHeight: 56, cursor: 'text', marginTop: 4 }}
            />
          </>
        )}
      </div>

      {/* ── The end of the card, emailCard's: the footer line, the sign-off
          (an automatic email, or a broadcast from a conference that named its
          secretariat), the conference's own social icons. ── */}
      {theme.footerLine.trim() && (
        <div style={{ padding: `0 ${MAIL_PAD}px 4px`, fontFamily: MAIL_SANS, fontSize: 13, lineHeight: 1.65, color: MAIL_MUTED, whiteSpace: 'pre-wrap' }}>
          {theme.footerLine}
        </div>
      )}
      {showSignoff ? (
        <div style={{ padding: `22px ${MAIL_PAD}px 32px` }}>
          <div style={{ borderTop: `1px solid ${MAIL_HAIRLINE}`, paddingTop: 22, fontFamily: MAIL_SANS, fontSize: 15, lineHeight: 1.6, color: MAIL_INK_SOFT }}>
            {(conference.contact_email ?? '').trim() && <p style={{ margin: '0 0 14px' }}>Reply to this email to reach the organisers.</p>}
            <p style={{ margin: 0 }}>Warm regards,</p>
            {signers.length > 0 ? (
              <>
                {signers.map(p => (
                  <p key={p.name} style={{ margin: '6px 0 0', lineHeight: 1.45, color: '#1C1410' }}>
                    <strong>{p.name}</strong>{p.title && <span style={{ color: MAIL_INK_SOFT }}>, {p.title}</span>}
                  </p>
                ))}
                <p style={{ margin: '6px 0 0', lineHeight: 1.45 }}>{confShortName}</p>
              </>
            ) : (
              <p style={{ margin: '6px 0 0', lineHeight: 1.45, color: '#1C1410' }}><strong>The {confShortName} team</strong></p>
            )}
          </div>
        </div>
      ) : (
        <div style={{ height: 32 }} />
      )}
      {socials.length > 0 && (
        <div className="flex justify-center flex-wrap" style={{ gap: 12, padding: `0 ${MAIL_PAD}px 30px` }}>
          {socials.map(x => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={x.icon} src={`${EMAIL_ASSET_BASE}social/${x.icon}.png`} alt={x.label} title={x.label} width={32} height={32} style={{ width: 32, height: 32 }} />
          ))}
        </div>
      )}
    </div>

      {/* Under the card, on the page, as sent. */}
      <div className="text-center" style={{ padding: '18px 16px 4px', fontFamily: MAIL_SANS, color: MAIL_MUTED }}>
        <div className="inline-flex items-center gap-1.5" style={{ fontSize: 12, lineHeight: '18px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gavel-mark.png" alt="" width={18} height={18} style={{ width: 18, height: 18, objectFit: 'contain' }} />
          <span>Made with <span style={{ textDecoration: 'underline' }}>Gavelling</span> for {confShortName}</span>
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.7, paddingTop: 6 }}>
          <span style={{ textDecoration: 'underline' }}>Email preferences</span>{' · '}<span style={{ textDecoration: 'underline' }}>Unsubscribe</span>
        </div>
        {legalLines.length > 0 && (
          <div style={{ fontSize: 10.5, lineHeight: 1.6, paddingTop: 6 }}>
            {legalLines.map(l => <div key={l}>{l}</div>)}
          </div>
        )}
      </div>
    </div>
  );

  // ── Sending (the right-hand column) ───────────────────────────────────────

  /** Everything about sending, top to bottom: who gets it, the ticks, the
   *  test to yourself, and Send at the foot. The recipient LIST is no longer
   *  here: it is in the confirmation Send opens, where the question "who is
   *  this going to?" is actually asked. */
  const sendPanel = (
    <div>
      {reachSlot && (
        <>
          {reachSlot}
          <div style={{ height: 1, backgroundColor: 'rgba(27,56,40,0.1)', margin: '16px 0 14px' }} />
        </>
      )}
      <PanelTitle emoji="Check mark button" hint="Click any part of the email to change it. When everything is ticked, send it from the bottom of this column.">
        Before You Send
      </PanelTitle>
      <div className="flex flex-col gap-1 mb-3">
        {checks.map(c => (
          <div
            key={c.label}
            title={c.ok ? undefined : c.fix}
            className="flex items-center gap-2.5"
            style={{ minHeight: 32, padding: '3px 2px' }}
          >
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 22, height: 22, borderRadius: 999,
                backgroundColor: c.ok ? GREEN_INK : 'rgba(126,81,40,0.16)',
                color: c.ok ? '#FFFFFF' : AMBER_INK,
              }}
            >
              {c.ok ? <Check size={13} strokeWidth={3.2} /> : <AlertTriangle size={12} strokeWidth={2.8} />}
            </span>
            <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: c.ok ? 600 : 700, color: c.ok ? GREEN_INK : INK, textWrap: 'pretty' }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {unresolvedRecipients && unresolvedRecipients.affected > 0 && (
        <p role="alert" className="mb-2" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: RED, lineHeight: 1.45, textWrap: 'pretty' }}>
          {unresolvedRecipients.affected} of {unresolvedRecipients.total} are missing {unresolvedRecipients.fields.map(f => `${f.label} (${f.count})`).join(', ')}, so they will not get this email.
        </p>
      )}
      <div className="flex items-center gap-2">
        <ActionButton icon={Send} tone="quiet" onClick={handleSendTest} disabled={sendingTest || !accessToken || !organizerEmail} style={{ flex: 1 }}>
          {sendingTest ? 'Sending…' : 'Send me a test'}
        </ActionButton>
        <HintDot text="Goes to your own inbox, so you can read it the way they will. Missing details are filled with stand-ins." />
      </div>
      {testMessage && (
        <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: testMessage.startsWith("Couldn't") ? RED : GREEN_INK, textWrap: 'pretty' }}>
          {testMessage}
        </p>
      )}
      {sendSlot && <div className="mt-4">{sendSlot}</div>}
      {sendingNote && <div className="mt-2.5 text-center">{sendingNote}</div>}
    </div>
  );

  // ── Properties ─────────────────────────────────────────────────────────────

  const properties = (
    <div>
      {selected?.type === 'paragraph' && (
        <>
          <PanelTitle emoji="Page facing up" hint="Three sizes, nothing else. The email's own theme handles the colours and spacing.">Text</PanelTitle>
          <FieldLabel>Size</FieldLabel>
          <div className="flex flex-col gap-1.5 mb-4">
            {VARIANT_META.map(v => {
              const active = (selected.variant ?? 'body') === v.value;
              return (
                <button
                  key={v.value}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setVariant(selected._id, v.value)}
                  className="flex items-center justify-between gap-2 focus:outline-none"
                  style={{
                    minHeight: 44, padding: '8px 13px', borderRadius: 13,
                    border: active ? `1.5px solid ${FOREST}` : '1px solid rgba(27,56,40,0.12)',
                    backgroundColor: active ? 'rgba(27,56,40,0.06)' : '#FFFDF8',
                    boxShadow: active ? 'none' : NEU.inSm,
                    cursor: 'pointer', textAlign: 'left',
                    transitionProperty: 'border-color, background-color',
                    transitionDuration: '180ms',
                  }}
                >
                  <span
                    style={{
                      fontFamily: MAIL_SANS,
                      fontSize: v.sample,
                      fontWeight: v.value === 'heading' ? 700 : 400,
                      color: v.value === 'small' ? MAIL_MUTED : v.value === 'heading' ? FOREST : MAIL_INK,
                    }}
                  >
                    {v.label}
                  </span>
                  {active && <Check size={14} strokeWidth={3} style={{ color: FOREST, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>

          <FieldLabel>Bold or italic</FieldLabel>
          <div className="flex gap-1.5 mb-4">
            {([['bold', Bold, 'Bold'], ['italic', Italic, 'Italic']] as const).map(([cmd, Icon, title]) => (
              <button
                key={cmd}
                type="button"
                title={`${title} (⌘${cmd === 'bold' ? 'B' : 'I'}). Select some words first.`}
                aria-label={title}
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyMarkToSelected(cmd)}
                className="flex-1 inline-flex items-center justify-center focus:outline-none"
                style={{
                  minHeight: 40, borderRadius: 12,
                  border: fmt[cmd] ? `1.5px solid ${FOREST}` : '1px solid rgba(27,56,40,0.12)',
                  backgroundColor: fmt[cmd] ? 'rgba(27,56,40,0.09)' : '#FFFDF8',
                  boxShadow: fmt[cmd] ? 'none' : NEU.inSm,
                  color: INK, cursor: 'pointer',
                }}
              >
                <Icon size={15} strokeWidth={2.6} />
              </button>
            ))}
          </div>
        </>
      )}

      {selected?.type === 'button' && (
        <ButtonProperties
          block={selected}
          onPatch={p => patchButton(selected._id, p)}
          /* An add_to_calendar button renders NOTHING at a conference with no
             confirmed dates, in the preview and in the real send alike. Say so
             here rather than let the organiser watch it silently vanish. */
          calendarUnavailable={!calendarUrlFor(conference)}
        />
      )}

      {selected?.type === 'image' && (
        <ImageProperties
          block={selected}
          conferenceId={conferenceId}
          accessToken={accessToken}
          onPatch={p => patchImage(selected._id, p)}
        />
      )}

      {selected && (
        <>
          <div style={{ height: 1, backgroundColor: 'rgba(27,56,40,0.1)', margin: '18px 0 12px' }} />
          {/* Move up / down. These came off the floating block toolbar when it
              was docked (see the note in `blockFrame`): a chevron pair is the
              one control on this screen that needs no label at all, so they
              are icons with titles, sitting beside the destructive action they
              are usually reached for alongside. */}
          <div className="flex items-center gap-1.5">
            {([[-1, ChevronUp, 'Move up'], [1, ChevronDown, 'Move down']] as const).map(([dir, Icon, label]) => {
              const idx = blocks.findIndex(b => b._id === selected._id);
              const blocked = dir === -1 ? idx <= 0 : idx < 0 || idx >= blocks.length - 1;
              return (
                <button
                  key={label}
                  type="button"
                  title={label}
                  aria-label={label}
                  disabled={blocked}
                  onClick={() => moveBlock(selected._id, dir)}
                  className="inline-flex items-center justify-center focus:outline-none disabled:opacity-30"
                  style={{
                    width: 40, height: 40, borderRadius: 999,
                    border: '1px solid rgba(27,56,40,0.14)', backgroundColor: '#FFFDF8',
                    color: FOREST, cursor: blocked ? 'default' : 'pointer',
                  }}
                >
                  <Icon size={15} strokeWidth={2.5} />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => deleteBlock(selected._id)}
              className="ml-auto inline-flex items-center gap-1.5 focus:outline-none"
              style={{
                minHeight: 40, padding: '9px 14px', borderRadius: 999,
                border: '1px solid rgba(139,32,32,0.28)', backgroundColor: 'transparent',
                fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700,
                color: RED, cursor: 'pointer',
              }}
            >
              <Trash2 size={14} strokeWidth={2.3} /> Remove
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ── Assembly ───────────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    backgroundColor: NEU.surface,
    border: CARD_BORDER,
    boxShadow: CARD_SHADOW,
    borderRadius: 22,
  };

  const asPicker = (
    <div>
      <button
        ref={asBtnRef}
        type="button"
        onClick={() => { setAsOpen(v => !v); setAsQuery(''); }}
        className="inline-flex items-center gap-1.5 focus:outline-none"
        style={{
          minHeight: 34, padding: '7px 12px', borderRadius: 999,
          border: CARD_BORDER, backgroundColor: '#FFFDF8',
          fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: INK, cursor: 'pointer', maxWidth: 260,
        }}
      >
        <UserRound size={13} strokeWidth={2.4} style={{ color: SOFT, flexShrink: 0 }} />
        <span className="min-w-0 text-left [overflow-wrap:anywhere]">As {asCandidate?.label ?? 'nobody in particular'}</span>
        <ChevronDown size={12} strokeWidth={2.6} style={{ color: SOFT, flexShrink: 0 }} />
      </button>
      <PopoverLayer anchorRef={asBtnRef} open={asOpen} onClose={closeAsPicker} width={260} maxHeight={310} align="end">
        <div style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', border: CARD_BORDER, boxShadow: CARD_SHADOW }}>
          <input
            autoFocus
            value={asQuery}
            onChange={e => setAsQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="w-full focus:outline-none"
            style={{ padding: '10px 13px', fontFamily: OUTFIT, fontSize: 16, color: INK, borderBottom: '1px solid rgba(27,56,40,0.1)', minHeight: 44 }}
          />
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => { setAsId(null); setAsOpen(false); }}
              className="w-full text-left focus:outline-none"
              style={{ padding: '9px 13px', minHeight: 40, fontFamily: OUTFIT, fontSize: 14, color: INK, fontWeight: asId === null ? 800 : 500, background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Nobody in particular
            </button>
            {asMatches.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setAsId(c.id); setAsOpen(false); }}
                className="w-full text-left [overflow-wrap:anywhere] focus:outline-none"
                style={{ padding: '9px 13px', minHeight: 40, fontFamily: OUTFIT, fontSize: 14, color: INK, fontWeight: asId === c.id ? 800 : 500, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverLayer>
    </div>
  );

  /** ONE slim bar right at the top of the builder, across all three columns
   *  (owner, Oct 2026: "have one tab right at the top, name it and save"):
   *  Back, the email's name written in place, and Save. The left column then
   *  holds only the tools, and the email still starts high on the screen. */
  const hasHeader = !!(backSlot || actionsSlot || onNameChange);
  const nameField = onNameChange ? (
        <input
          type="text"
          value={name ?? ''}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Name this email"
          aria-label="Name this email, just for you"
          title="Name this email, just for you. Only you see this name"
          className="gv-email-name w-full min-w-0 focus:outline-none"
          style={{
            height: 38, borderRadius: 11, padding: '0 10px',
            fontFamily: OUTFIT, fontSize: 16, fontWeight: 700, color: INK,
          }}
        />
  ) : null;
  const builderBar = hasHeader ? (
    <div
      className="flex items-center gap-2 sm:gap-3"
      style={{ ...panelStyle, borderRadius: 18, height: 54, padding: '0 8px 0 14px' }}
    >
      <style>{`
        .gv-email-name { background: transparent; border: 1px solid transparent; transition: background-color 160ms, border-color 160ms, box-shadow 160ms; }
        .gv-email-name::placeholder { color: ${SOFT}; font-weight: 600; }
        .gv-email-name:hover { background: rgba(27,56,40,0.04); }
        .gv-email-name:focus { background: #FFFDF8; border-color: rgba(27,56,40,0.16); box-shadow: ${NEU.inSm}; }
      `}</style>
      {backSlot && <div className="flex-shrink-0">{backSlot}</div>}
      {backSlot && nameField && <div aria-hidden style={{ width: 1, height: 22, backgroundColor: 'rgba(27,56,40,0.12)', flexShrink: 0 }} />}
      <div className="flex-1 min-w-0">{nameField}</div>
      {actionsSlot && <div className="flex-shrink-0">{actionsSlot}</div>}
    </div>
  ) : null;

  /** One tool in the left column: a 3D emoji and a plain word. */
  const toolButton = (
    key: string, label: string, emoji: string, active: boolean, onClick: (el: HTMLButtonElement) => void,
    ref?: React.RefObject<HTMLButtonElement | null>, opts?: { hasPopup?: boolean; compact?: boolean },
  ) => (
    <button
      key={key}
      ref={ref}
      type="button"
      aria-haspopup={opts?.hasPopup ? 'dialog' : undefined}
      aria-expanded={opts?.hasPopup ? active : undefined}
      aria-pressed={opts?.hasPopup ? undefined : active}
      onMouseDown={e => e.preventDefault()}
      onClick={e => onClick(e.currentTarget)}
      className={opts?.compact
        ? 'flex flex-col items-center justify-center gap-0.5 focus:outline-none flex-1 min-w-0'
        : 'w-full flex items-center gap-2.5 text-left focus:outline-none'}
      style={opts?.compact ? {
        minHeight: 54, padding: '5px 4px', borderRadius: 14, border: 'none',
        backgroundColor: active ? 'rgba(238,217,138,0.42)' : 'transparent',
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: FOREST, cursor: 'pointer',
      } : {
        ...TOOL_BUTTON_STYLE(active), borderRadius: 14, padding: '7px 12px 7px 9px',
      }}
    >
      <Emoji3D name={emoji} size={opts?.compact ? 24 : 22} fallback={Sparkles} fallbackColor={FOREST} />
      <span className={opts?.compact ? '' : 'min-w-0 flex-1'}>{label}</span>
    </button>
  );

  /** Opens the Add menu on one tab, beside the button that was pressed;
   *  pressing the same button again closes it. */
  const openAddTab = (tab: AddTab, el: HTMLButtonElement) => {
    if (addOpen && addTab === tab && addAnchorRef.current === el) { setAddOpen(false); return; }
    addAnchorRef.current = el;
    setAddTab(tab);
    setDesignOpen(false);
    setAddOpen(true);
  };

  const addPopover = (
    <PopoverLayer anchorRef={addAnchorRef} open={addOpen} onClose={closeAdd} width={352} maxHeight={560} side={wide ? 'right' : 'bottom'}>
      {addMenu}
    </PopoverLayer>
  );

  const designPopover = design ? (
    <PopoverLayer anchorRef={designBtnRef} open={designOpen} onClose={closeDesign} width={320} maxHeight={600} side={wide ? 'right' : 'bottom'}>
      <div style={{ padding: 16, borderRadius: 22, backgroundColor: NEU.surface, border: CARD_BORDER, boxShadow: CARD_SHADOW }}>
        <PanelTitle emoji="Artist palette" hint="Every email this conference sends uses this look. The email beside you changes as you pick.">
          Design
        </PanelTitle>
        <DesignPanel design={design} />
      </div>
    </PopoverLayer>
  ) : null;

  const toggleDesign = () => { setDesignOpen(v => !v); setAddOpen(false); };
  const toggleMode = () => { setMode(m => (m === 'edit' ? 'preview' : 'edit')); setAddOpen(false); setDesignOpen(false); };

  /** The left column on a wide screen: the header, then the tools, then the
   *  selected block's settings. */
  const toolsColumn = (
    <div className="flex flex-col gap-3">
      <div style={{ ...panelStyle, borderRadius: 18, padding: 10 }}>
        <p className="px-1 pb-1.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: SOFT }}>Add</p>
        <div className="flex flex-col gap-1.5">
          {ADD_TABS.map(t => toolButton(
            t.key, t.label, t.emoji, addOpen && addTab === t.key,
            el => openAddTab(t.key, el), undefined, { hasPopup: true },
          ))}
        </div>
        <div style={{ height: 1, backgroundColor: 'rgba(27,56,40,0.1)', margin: '10px 2px' }} />
        <div className="flex flex-col gap-1.5">
          {design && toolButton('design', 'Design', 'Artist palette', designOpen, toggleDesign, designBtnRef, { hasPopup: true })}
          {toolButton('mode', mode === 'edit' ? 'See it for real' : 'Back to writing', mode === 'edit' ? 'Eyes' : 'Pencil', mode === 'preview', toggleMode)}
        </div>
      </div>
      {selected && mode === 'edit' && (
        <div style={{ ...panelStyle, borderRadius: 18, padding: 14, position: 'relative' }}>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="Done with this block"
            title="Done with this block"
            className="absolute focus:outline-none inline-flex items-center justify-center"
            style={{ top: 10, right: 10, width: 32, height: 32, borderRadius: 999, border: CARD_BORDER, background: '#FFFDF8', color: SOFT, cursor: 'pointer' }}
          >
            <X size={14} strokeWidth={2.6} />
          </button>
          {properties}
        </div>
      )}
    </div>
  );

  /** The tools on a narrow screen: one bar pinned to the bottom of the
   *  screen (clear of the manage rail from md up). */
  const toolsBar = (
    <div
      className="fixed left-2 right-2 md:left-[104px] flex items-stretch gap-1"
      style={{
        bottom: 'max(8px, env(safe-area-inset-bottom))', zIndex: 44,
        ...panelStyle, borderRadius: 20, padding: 5,
      }}
    >
      {toolButton('add', 'Add', 'Sparkles', addOpen, el => openAddTab(addTab, el), undefined, { hasPopup: true, compact: true })}
      {design && toolButton('design', 'Design', 'Artist palette', designOpen, toggleDesign, designBtnRef, { hasPopup: true, compact: true })}
      {toolButton('mode', mode === 'edit' ? 'See it for real' : 'Write', mode === 'edit' ? 'Eyes' : 'Pencil', mode === 'preview', toggleMode, undefined, { compact: true })}
    </div>
  );

  const canvasColumn = (
    <div className="min-w-0">
      {/* Preview-only controls. They have no meaning while you are writing, so
          they do not take a row while you are writing. */}
      {mode === 'preview' && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Segmented
            value={previewWidth}
            onChange={setPreviewWidth}
            options={[
              { value: 'desktop' as const, title: 'Laptop width', icon: Monitor },
              { value: 'mobile' as const, title: 'Phone width', icon: Smartphone },
            ]}
          />
          <Segmented
            value={previewScheme}
            onChange={setPreviewScheme}
            options={[
              { value: 'light' as const, title: 'Light inbox', icon: Sun },
              { value: 'dark' as const, title: 'Dark inbox', icon: Moon },
            ]}
          />
          <div className="ml-auto">{asPicker}</div>
        </div>
      )}

      {/* Desk */}
      <div
        onDragOver={mode === 'edit' ? handleCanvasDragOver : undefined}
        onDrop={mode === 'edit' ? handleCanvasDrop : undefined}
        onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); setInsertAt(null); } }}
        style={{
          backgroundColor: DESK,
          borderRadius: 22,
          boxShadow: DESK_WELL,
          padding: wide ? '12px 12px 20px' : '8px 6px 16px',
          minHeight: 420,
        }}
      >
        {mode === 'edit' ? sheet : (
          <div className="flex flex-col items-center">
            {/* The subject stays where it is while the body is swapped for the
                real email, so it can still be edited while looking. */}
            <div style={{ width: previewWidth === 'desktop' ? '100%' : 390, maxWidth: previewWidth === 'desktop' ? 620 : '100%', marginBottom: 10, borderRadius: 14, overflow: 'hidden', border: `1px solid ${MAIL_CARD_BORDER}` }}>
              {subjectStrip}
            </div>
            <iframe
              key={previewWidth}
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              title="Email preview"
              style={{
                width: previewWidth === 'desktop' ? '100%' : 390,
                maxWidth: previewWidth === 'desktop' ? 620 : '100%',
                height: 760,
                border: 'none',
                borderRadius: 14,
                // Pins the embedded document's scheme instead of inheriting
                // the reader's. The email declares `color-scheme: light dark`,
                // so it opts into the propagation; nothing about the document
                // itself is rewritten, which is the whole point of this view.
                colorScheme: previewScheme,
                backgroundColor: previewScheme === 'dark' ? '#12100D' : '#FFFFFF',
                boxShadow: '0 1px 2px rgba(27,56,40,0.12), 0 14px 34px rgba(27,56,40,0.20)',
              }}
            />
          </div>
        )}
      </div>

      {mode === 'preview' && (
        <p className="mt-2 text-center" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, textWrap: 'pretty' }}>
          {asCandidate
            ? <>This is the real email, with {asCandidate.label}&apos;s details filled in.</>
            : <>This is the real email. Pick a person above to see their details filled in. <HighlightedText text={'⚠Highlighted⚠'} /> means nothing to fill it with.</>}
        </p>
      )}
    </div>
  );

  // The side columns stay in view while the email scrolls past them, each
  // scrolling on its own when it is taller than the window. 72 = the manage
  // layout's fixed 56px header plus a little air.
  const stickySide: React.CSSProperties = {
    position: 'sticky', top: 72, maxHeight: 'calc(100vh - 88px)', overflowY: 'auto',
    // Room for the cards' shadows inside the scroller.
    padding: 4, margin: -4,
  };

  return (
    <div style={wide ? undefined : { paddingBottom: 84 }}>
      {suggest && mode === 'edit' && (
        <TokenSuggest
          state={suggest}
          onPick={pickSuggestion}
          onClose={closeSuggest}
          onSilenceNudges={silenceNudges}
        />
      )}
      {addPopover}
      {designPopover}

      {builderBar && <div className={wide ? 'mb-3' : 'mb-2'}>{builderBar}</div>}

      {wide ? (
        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '184px minmax(0,1fr) 264px' }}>
          <div style={stickySide}>{toolsColumn}</div>
          {canvasColumn}
          <div style={stickySide}>
            <div style={{ ...panelStyle, padding: 16 }}>{sendPanel}</div>
          </div>
        </div>
      ) : (
        <>
          {canvasColumn}
          <div className="mt-4" style={{ ...panelStyle, padding: 16 }}>{sendPanel}</div>
          {toolsBar}
          {selected && mode === 'edit' && (
            <div
              style={{
                ...panelStyle,
                position: 'fixed', left: 8, right: 8,
                bottom: 'calc(max(8px, env(safe-area-inset-bottom)) + 74px)',
                zIndex: 45, maxHeight: '52vh', overflowY: 'auto', padding: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="absolute focus:outline-none inline-flex items-center justify-center"
                style={{ top: 10, right: 10, width: 36, height: 36, borderRadius: 999, border: CARD_BORDER, background: '#FFFDF8', color: SOFT, cursor: 'pointer' }}
              >
                <X size={15} strokeWidth={2.6} />
              </button>
              {properties}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── The button, edited where it lives ────────────────────────────────────────
// A button used to be the one block you could not touch on the paper: you
// clicked it, then read its words out of an input one column to the right and
// typed there. So the object you were changing and the field you were typing
// in were never the same thing.
//
// Now the pill itself is editable, at the exact size and colour it will be
// sent at, and selecting it floats its destination underneath, the two
// questions a button has ("what does it say", "where does it go"), answered
// in the place the button is. The properties panel still carries both, for
// keyboard reach and for the destinations that need a second field.
//
// It is a MODULE-LEVEL COMPONENT, not one of the closure render helpers above:
// it holds a contentEditable whose DOM is built once on mount, and a
// closure-defined function rendered as JSX gets a new identity every parent
// render, which would remount it and eat whatever had just been typed.

function ButtonBlockCanvas({
  block, selected, asLink, onPatch,
}: {
  block: ButtonBlock;
  selected: boolean;
  /** The card sends ONE button: the first is a forest pill with gold words,
   *  every later one becomes an underlined text link. Drawn the same here. */
  asLink: boolean;
  onPatch: (patch: Partial<ButtonBlock>) => void;
}) {
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const destBtnRef = useRef<HTMLButtonElement | null>(null);
  const [destOpen, setDestOpen] = useState(false);
  const closeDest = useCallback(() => setDestOpen(false), []);

  // Written imperatively, for the same reason ParagraphEditor does it: React
  // re-rendering children into a contentEditable while the caret is in it
  // collapses the selection to the start on every keystroke.
  //
  // The `activeElement` guard is what lets this ALSO track the label input in
  // the properties panel: an edit from over there lands here, while an edit
  // typed in here is left completely alone. Without the guard the two would be
  // two copies of one string, and whichever rendered last would win.
  useEffect(() => {
    const el = labelRef.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== block.label) el.textContent = block.label;
  }, [block.label]);

  const empty = !block.label.trim();

  return (
    <div style={{ textAlign: 'center', padding: asLink ? (selected ? '6px 0 8px 0' : '6px 0 18px 0') : (selected ? '18px 0 8px 0' : '18px 0 26px 0') }}>
      <span
        ref={labelRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="What the button says"
        spellCheck={false}
        data-placeholder="Learn more"
        className="mail-button-label"
        onInput={e => onPatch({ label: (e.currentTarget.textContent ?? '').replace(/\n/g, ' ') })}
        onKeyDown={e => {
          // A button label is one line by definition, the renderer draws it
          // on a single 20px line, so a break here would be invented and then
          // silently discarded at send time.
          if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
        }}
        onPaste={e => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ').trim();
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) insertTextAtRange(sel.getRangeAt(0), text);
          onPatch({ label: (e.currentTarget.textContent ?? '').replace(/\n/g, ' ') });
        }}
        title={asLink ? 'Only the first button is sent as a button. This one is sent as a link.' : undefined}
        style={asLink ? {
          display: 'inline-block',
          fontFamily: MAIL_SANS,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.5,
          color: FOREST,
          textDecoration: 'underline',
          outline: 'none',
          cursor: 'text',
          minWidth: 80,
          maxWidth: '100%',
        } : {
          display: 'inline-block',
          backgroundColor: FOREST,
          borderRadius: 999,
          padding: '15px 40px',
          fontFamily: MAIL_SANS,
          fontSize: 16,
          fontWeight: 700,
          lineHeight: '20px',
          color: GOLD,
          boxShadow: '0 8px 18px -8px rgba(27,56,40,0.6)',
          outline: 'none',
          cursor: 'text',
          minWidth: 120,
          maxWidth: '100%',
        }}
      />

      {selected && (
        <div className="flex items-center justify-center gap-1.5 flex-wrap" style={{ marginTop: 10 }}>
          <button
            ref={destBtnRef}
            type="button"
            onClick={e => { e.stopPropagation(); setDestOpen(v => !v); }}
            className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{
              minHeight: 34, padding: '7px 12px', borderRadius: 999,
              border: CARD_BORDER, backgroundColor: '#FFFDF8',
              fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: INK,
              cursor: 'pointer', maxWidth: 300,
            }}
          >
            <Link2 size={12} strokeWidth={2.5} style={{ color: SOFT, flexShrink: 0 }} />
            <span className="truncate">{BUTTON_DESTINATION_LABELS[block.destination]}</span>
            <ChevronDown size={12} strokeWidth={2.6} style={{ color: SOFT, flexShrink: 0 }} />
          </button>
          {block.destination === 'custom' && (
            <input
              value={block.url ?? ''}
              onChange={e => onPatch({ url: e.target.value })}
              onClick={e => e.stopPropagation()}
              placeholder="https://…"
              aria-label="Where this button goes"
              className="focus:outline-none"
              style={{
                minHeight: 38, width: 260, maxWidth: '100%', borderRadius: 999, padding: '7px 13px',
                fontFamily: OUTFIT, fontSize: 16, color: INK,
                backgroundColor: '#FFFDF8', border: '1px solid rgba(27,56,40,0.13)', boxShadow: NEU.inSm,
              }}
            />
          )}
          <PopoverLayer anchorRef={destBtnRef} open={destOpen} onClose={closeDest} width={288} maxHeight={320}>
            <div style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: NEU.surface, border: CARD_BORDER, boxShadow: CARD_SHADOW }}>
              {(Object.keys(BUTTON_DESTINATION_LABELS) as ButtonDestination[]).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { onPatch({ destination: d }); setDestOpen(false); }}
                  className="w-full flex items-center gap-2 text-left focus:outline-none"
                  style={{
                    minHeight: 40, padding: '9px 12px', border: 'none', background: 'transparent',
                    fontFamily: OUTFIT, fontSize: 12, color: INK, fontWeight: block.destination === d ? 800 : 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.055)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span className="min-w-0 flex-1" style={{ textWrap: 'pretty' }}>{BUTTON_DESTINATION_LABELS[d]}</span>
                  {block.destination === d && <Check size={13} strokeWidth={3} style={{ color: FOREST, flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </PopoverLayer>
        </div>
      )}

      <style jsx>{`
        .mail-button-label:empty:before {
          content: attr(data-placeholder);
          opacity: 0.55;
        }
      `}</style>
      {selected && empty && (
        <p className="flex items-center justify-center gap-1.5" style={{ marginTop: 6, fontFamily: OUTFIT, fontSize: 11, color: AMBER_INK, textWrap: 'pretty' }}>
          <AlertTriangle size={11} style={{ flexShrink: 0 }} />
          With no words it will read &ldquo;Learn more&rdquo;.
        </p>
      )}
    </div>
  );
}

// ── Property editors ─────────────────────────────────────────────────────────

function ButtonProperties({ block, onPatch, calendarUnavailable }: { block: ButtonBlock; onPatch: (patch: Partial<ButtonBlock>) => void; calendarUnavailable: boolean }) {
  return (
    <>
      <PanelTitle emoji="Ticket" hint="One button, one place to go. Its colour comes from Design.">Button</PanelTitle>
      <FieldLabel>What it says</FieldLabel>
      <input
        value={block.label}
        onChange={e => onPatch({ label: e.target.value })}
        placeholder="e.g. Open my conference"
        style={FIELD_STYLE}
        className="mb-4"
      />
      <FieldLabel>Where it goes</FieldLabel>
      <div className="mb-3">
        <GSelect<ButtonDestination>
          aria-label="Where it goes"
          value={block.destination}
          onChange={v => onPatch({ destination: v })}
          style={FIELD_STYLE}
          options={(Object.keys(BUTTON_DESTINATION_LABELS) as ButtonDestination[]).map(d => ({ value: d, label: BUTTON_DESTINATION_LABELS[d] }))}
        />
      </div>
      {block.destination === 'apply_page' && (
        <>
          <FieldLabel>Which role</FieldLabel>
          <div className="mb-3">
            <GSelect aria-label="Which role" value={block.role ?? ''} onChange={v => onPatch({ role: (v || undefined) as typeof block.role })} style={FIELD_STYLE}
              options={[{ value: '', label: 'Any role' }, ...ROLE_OPTIONS.map(r => ({ value: r.value as string, label: r.label }))]} />
          </div>
        </>
      )}
      {block.destination === 'custom' && (
        <>
          <FieldLabel>The link</FieldLabel>
          <input value={block.url ?? ''} onChange={e => onPatch({ url: e.target.value })} placeholder="https://…" style={FIELD_STYLE} className="mb-3" />
        </>
      )}
      {block.destination === 'add_to_calendar' && calendarUnavailable && (
        <p className="flex items-start gap-1.5 mb-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: AMBER_INK, lineHeight: 1.5, textWrap: 'pretty' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          This conference has no confirmed dates yet, so this button will not appear in the email at all. Set your dates in Settings and it comes back on its own.
        </p>
      )}
      {!block.label.trim() && (
        <p className="flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: AMBER_INK, lineHeight: 1.5, textWrap: 'pretty' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          With no words it will read &ldquo;Learn more&rdquo;.
        </p>
      )}
    </>
  );
}

function ImageProperties({
  block, conferenceId, accessToken, onPatch,
}: {
  block: ImageBlock;
  conferenceId: string;
  accessToken: string | null;
  onPatch: (patch: Partial<ImageBlock>) => void;
}) {
  const { upload, uploading, error, setError } = useImageUpload(conferenceId, accessToken);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  async function take(file: File) {
    const url = await upload(file);
    if (url) onPatch({ url });
  }

  return (
    <>
      <PanelTitle emoji="Framed picture" hint="Anything up to 5MB: JPEG, PNG, WebP or GIF.">Picture</PanelTitle>
      <input
        ref={fileRef}
        type="file"
        accept={EMAIL_IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) void take(f); e.target.value = ''; }}
      />
      <div
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          setError(null);
          const f = e.dataTransfer.files?.[0];
          if (f) void take(f);
        }}
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 mb-3"
        style={{
          minHeight: 132, borderRadius: 14, cursor: 'pointer', padding: 10,
          border: `2px dashed ${over ? NEU_GRADIENTS.gold[1] : 'rgba(27,56,40,0.16)'}`,
          backgroundColor: over ? 'rgba(238,217,138,0.2)' : '#FFFDF8',
          transitionProperty: 'border-color, background-color',
          transitionDuration: '180ms',
        }}
      >
        {block.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.url} alt={block.alt || ''} style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 8, display: 'block', outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: -1 }} />
        ) : (
          <>
            <Emoji3D name="Framed picture" size={30} fallback={ImageIcon} fallbackColor={FOREST} />
            <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK }}>
              {uploading ? 'Uploading…' : 'Drop a picture, or click'}
            </span>
          </>
        )}
      </div>
      <ActionButton size="sm" tone="quiet" icon={Upload} onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: '100%' }}>
        {uploading ? 'Uploading…' : block.url ? 'Choose another' : 'Choose a picture'}
      </ActionButton>
      {error && (
        <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: RED, textWrap: 'pretty' }}>{error}</p>
      )}

      <div className="mt-4">
        <FieldLabel>Describe it</FieldLabel>
        <input
          value={block.alt}
          onChange={e => onPatch({ alt: e.target.value })}
          placeholder="e.g. Delegates in the opening ceremony"
          style={{ ...FIELD_STYLE, borderColor: block.url && !block.alt.trim() ? 'rgba(126,81,40,0.55)' : 'rgba(27,56,40,0.13)' }}
        />
        {block.url && !block.alt.trim() && (
          <p className="mt-1.5 flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: AMBER_INK, lineHeight: 1.5, textWrap: 'pretty' }}>
            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
            Some people never see the picture. This is what they read instead.
          </p>
        )}
      </div>
    </>
  );
}
