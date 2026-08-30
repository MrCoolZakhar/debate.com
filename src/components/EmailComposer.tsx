'use client';

// ─────────────────────────────────────────────────────────────────────────────
// THE EMAIL BUILDER — a playing field, not a form.
//
// Three zones, left to right:
//
//   1  PALETTE      a slim icon rail (Blocks · Details · Starters) hinged to a
//                   panel of draggable tiles. Drag one onto the sheet, or click
//                   it and it lands after whatever is selected.
//   2  CANVAS       the email itself, at its real 600px width, on a pressed-in
//                   ivory desk. Paragraphs are edited IN PLACE at the exact
//                   Georgia sizes the renderer uses, buttons are the real gold
//                   pill, the banner and footer bands are drawn as the mail
//                   client will draw them. One toggle flips the same sheet to
//                   the true `renderEmailHtml` output in an iframe, desktop or
//                   phone — so "is this really what they get" is one click, and
//                   any drift between this canvas and the renderer is visible
//                   rather than hidden.
//   3  PROPERTIES   whatever is selected. Nothing selected → the send-readiness
//                   card (subject, checks, test send).
//
// WHAT IS DELIBERATELY NOT HERE: padding, margin, spacing, colour, font,
// width, alignment. The email theme owns all of that. Every control on this
// screen changes CONTENT — the three text sizes, bold/italic, a button's
// destination, an image and its alt text — because those are the only things
// the block model actually stores.
//
// Below 1024px the three zones become one column: the palette turns into a
// horizontally-scrolling strip of the same tiles, the sheet goes fluid, and the
// properties panel becomes a bottom sheet that rises when a block is selected.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Trash2, ChevronUp, ChevronDown, Monitor, Smartphone, Send, Bold, Italic,
  Image as ImageIcon, Plus, GripVertical, X, Check, Type, Sparkles, LayoutTemplate,
  Pencil, Eye, UserRound, Upload, AlertTriangle, CornerDownRight,
} from 'lucide-react';
import {
  EMAIL_TOKEN_KEYS, EMAIL_TOKEN_LABELS, resolveTokens, splitResolvedText,
  type EmailTokenContext, type EmailTokenKey,
} from '@/lib/emailTokens';
import {
  type EmailBlock, type ButtonBlock, type ButtonDestination, type ImageBlock, type ParagraphVariant,
  BUTTON_DESTINATION_LABELS, flattenBlocksToPlainText,
} from '@/lib/emailBlocks';
import { renderEmailHtml, resolveEmailTheme, type EmailRenderConference } from '@/lib/emailHtml';
import { getAuthedClient } from '@/lib/supabase-auth';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { Emoji3D, NEU, NEU_GRADIENTS, OUTFIT, EASE } from '@/components/neu';
import { SOFT, AMBER_INK, GREEN_INK, RED, CARD_BORDER, CARD_SHADOW } from '@/app/manage/[slug]/live/tokens';
import {
  buildParagraphDom, serializeParagraphDom, insertTextAtRange, insertPillAtRange,
} from '@/components/email/paragraphDom';
import {
  PALETTE_ITEMS, STARTERS, blockForKind, type PaletteKind,
} from '@/components/email/blockKit';
import PopoverLayer from '@/components/email/PopoverLayer';

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
const MAIL_SERIF = "Georgia, 'Times New Roman', Times, serif";
const MAIL_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MAIL_INK = '#241E17';
const MAIL_INK_SOFT = '#544B3E';
const MAIL_MUTED = '#6E6456';
const MAIL_CARD = '#FFFFFF';
const MAIL_FOOTER_BG = '#F7F4EC';
const MAIL_HAIRLINE = '#E7E1D3';
const MAIL_CHIP_BG = '#FAF8F3';
const SHEET_WIDTH = 600;
const BANNER_HEIGHT = 170;
const CONTENT_WIDTH = 520;

/** The renderer's `inkOn`, restated: pick whichever of near-black / white
 *  contrasts better with a conference's chosen fill. Approximate on purpose —
 *  it only decides the colour of preview text, never of a sent email. */
function inkOnColor(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6) return MAIL_INK;
  const lin = [0, 2, 4].map(i => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const cDark = (L + 0.05) / (0.0166 + 0.05);
  const cLight = 1.05 / (L + 0.05);
  return cDark >= cLight ? MAIL_INK : '#FFFFFF';
}

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
  /** Rendered inside the canvas toolbar's own row on wide screens — the page
   *  slots the audience summary here so "who gets it" is never off-screen. */
  reachSlot?: React.ReactNode;
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
  heading: { fontFamily: MAIL_SERIF, fontSize: 23, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em', color: MAIL_INK, padding: '2px 0 12px' },
  body: { fontFamily: MAIL_SANS, fontSize: 16, lineHeight: 1.7, color: MAIL_INK, paddingBottom: 20 },
  small: { fontFamily: MAIL_SANS, fontSize: 13, lineHeight: 1.65, color: MAIL_MUTED, paddingBottom: 18 },
};

const VARIANT_META: { value: ParagraphVariant; label: string; sample: number; serif: boolean }[] = [
  { value: 'heading', label: 'Headline', sample: 18, serif: true },
  { value: 'body', label: 'Text', sample: 14, serif: false },
  { value: 'small', label: 'Small', sample: 11.5, serif: false },
];

/** Desktop-first: renders the three-zone layout on the server, corrects to the
 *  stacked one on mount. This screen is behind sign-in and client-rendered, so
 *  the one-frame correction is never seen by a crawler or a cold visitor. */
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

// ── Small shared bits ────────────────────────────────────────────────────────

function HighlightedText({ text }: { text: string }) {
  const segments = splitResolvedText(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.unresolved ? (
          <span key={i} style={{ backgroundColor: 'rgba(182,135,31,0.22)', color: '#7A5A0F', padding: '0 3px', borderRadius: 3, fontWeight: 600 }}>
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
        fontSize: size === 'sm' ? 11.5 : 13,
        fontWeight: 800,
        letterSpacing: '0.05em',
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

/** Small pressed-in track holding mutually exclusive choices. */
function Segmented<T extends string>({
  value, options, onChange, grow,
}: {
  value: T;
  options: { value: T; label: string; icon?: typeof Monitor }[];
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
            onMouseDown={e => e.preventDefault()}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center justify-center gap-1.5 focus:outline-none ${grow ? 'flex-1' : ''}`}
            style={{
              minHeight: 30,
              padding: '5px 12px',
              borderRadius: 999,
              border: 'none',
              background: active ? `linear-gradient(135deg, ${FOREST}, #2E6041)` : 'transparent',
              color: active ? GOLD : SOFT,
              fontFamily: OUTFIT,
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '0.05em',
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

function PanelTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: SOFT }}>
        {children}
      </p>
      {hint && (
        <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: SOFT }}>
      {children}
    </label>
  );
}

const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  padding: '10px 13px',
  fontSize: 13.5,
  fontFamily: OUTFIT,
  color: INK,
  backgroundColor: '#FFFDF8',
  border: '1px solid rgba(27,56,40,0.13)',
  boxShadow: NEU.inSm,
  outline: 'none',
  minHeight: 40,
};

// ── Paragraph editor: contentEditable at the real mail typography ────────────

function ParagraphEditor({
  blockId, initialContent, variant, registerRef, onFocusBlock, onContentChange, onFormatState,
}: {
  blockId: string;
  initialContent: string;
  variant: ParagraphVariant;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onFocusBlock: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onFormatState: (fmt: { bold: boolean; italic: boolean }) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(initialContent);

  useEffect(() => {
    if (ref.current) buildParagraphDom(ref.current, mounted.current);
  }, []);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    onContentChange(blockId, serializeParagraphDom(ref.current));
  }, [blockId, onContentChange]);

  function refreshFormatState() {
    try {
      onFormatState({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic') });
    } catch {
      /* queryCommandState can throw on detached selections — keep last state */
    }
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
        data-placeholder={variant === 'heading' ? 'A headline…' : variant === 'small' ? 'Small print…' : 'Write here…'}
        className="mail-paragraph"
        style={{
          whiteSpace: 'pre-wrap',
          outline: 'none',
          cursor: 'text',
          minHeight: variant === 'heading' ? 30 : 26,
          ...VARIANT_CANVAS_STYLE[variant],
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
    if (!accessToken) { setError('Your session has expired — refresh the page and try again.'); return null; }
    setUploading(true);
    setError(null);
    const supabase = getAuthedClient(accessToken);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `email-images/${conferenceId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('conference-assets')
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (upErr) { setError("Couldn't upload the image: " + upErr.message); return null; }
    const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
    return data.publicUrl;
  }, [accessToken, conferenceId]);

  return { upload, uploading, error, setError };
}

// ── EmailComposer ────────────────────────────────────────────────────────────

export default function EmailComposer({
  conference, conferenceId, initialSubject, initialBlocks, previewCandidates, onChange,
  testSendContext, accessToken, organizerEmail, reachSlot,
}: EmailComposerProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [blocks, setBlocks] = useState<LocalBlock[]>(() => withIds(initialBlocks));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<string>('subject');
  const [fmt, setFmt] = useState({ bold: false, italic: false });
  const [paletteTab, setPaletteTab] = useState<'blocks' | 'details' | 'starters'>('blocks');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');

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
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  const asBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeAsPicker = useCallback(() => setAsOpen(false), []);

  const theme = useMemo(() => resolveEmailTheme(conference.email_theme), [conference.email_theme]);

  // Header shape, mirroring renderHeader/renderIdentityRow: with a banner the
  // identity row sits BELOW it on the white card; without one it becomes a
  // centred masthead painted in the accent colour.
  const useBannerHeader = theme.headerStyle === 'banner' && !!conference.banner_url;
  const headerLogo = theme.showLogo ? conference.logo_url : null;
  const distinctFullName = !!conference.acronym && !!conference.full_name && conference.full_name !== conference.acronym;
  const accentInk = inkOnColor(theme.accentColor);

  useEffect(() => { onChangeRef.current = onChange; });
  useEffect(() => { onChangeRef.current({ subject, blocks: stripIds(blocks) }); }, [subject, blocks]);

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
      requestAnimationFrame(() => blockRefs.current[first._id]?.focus());
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

  const previewCtx = asCandidate?.ctx ?? {};

  // Re-rendering the iframe srcDoc on every keystroke flashes it white; a
  // short debounce keeps it instant without the churn.
  const [debouncedBlocks, setDebouncedBlocks] = useState<LocalBlock[]>(blocks);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBlocks(blocks), 250);
    return () => clearTimeout(t);
  }, [blocks]);

  const previewHtml = useMemo(
    () => renderEmailHtml({ blocks: stripIds(debouncedBlocks), conference, ctx: previewCtx }),
    // previewCtx is derived from asCandidate; depending on the candidate keeps
    // this from re-rendering on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedBlocks, conference, asCandidate]
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
      body: resolveTokens(flattenBlocksToPlainText(liveBlocks, conference), ctx),
      body_html: renderEmailHtml({ blocks: liveBlocks, conference, ctx }),
      status: 'pending',
    });
    setSendingTest(false);
    if (error) { setTestMessage(`Couldn't send the test: ${error.message}`); return; }
    triggerEmailDelivery(supabase);
    setTestMessage(`Test sent to ${organizerEmail}`);
    setTimeout(() => setTestMessage(m => (m?.startsWith('Test sent') ? null : m)), 4500);
  }

  // ── Readiness checks (the properties panel's resting state) ────────────────

  const checks = useMemo(() => {
    const paragraphs = blocks.filter(b => b.type === 'paragraph' && b.content.trim());
    const images = blocks.filter((b): b is ImageBlock & { _id: string } => b.type === 'image');
    const buttons = blocks.filter((b): b is ButtonBlock & { _id: string } => b.type === 'button');
    return [
      { ok: subject.trim().length > 0, label: 'Subject line written', fix: 'People see this first — write one.' },
      { ok: paragraphs.length > 0, label: 'Something to say', fix: 'Add at least one block of text.' },
      { ok: buttons.every(b => b.label.trim()), label: 'Every button is labelled', fix: 'A button with no words renders as "Learn more".' },
      { ok: images.every(b => b.url && b.alt.trim()), label: 'Pictures described', fix: 'Alt text is what people on slow connections and screen readers get.' },
    ];
  }, [blocks, subject]);

  // ── Pieces ─────────────────────────────────────────────────────────────────

  const paletteRail: { key: 'blocks' | 'details' | 'starters'; label: string; icon: typeof Type }[] = [
    { key: 'blocks', label: 'Blocks', icon: LayoutTemplate },
    { key: 'details', label: 'Details', icon: Sparkles },
    { key: 'starters', label: 'Starters', icon: Type },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS, NOT COMPONENTS. They are defined in the closure (they need
  // a dozen callbacks each) and are therefore INVOKED — `paletteTile(item)`,
  // never `<PaletteTile item={item} />`. Rendering a closure-defined function
  // as JSX gives it a fresh component identity on every parent render, which
  // makes React unmount and remount the subtree; the paragraph editors below
  // build their contentEditable DOM once on mount, so a remount would wipe
  // whatever had just been typed. Calling them inlines the elements instead.
  // ─────────────────────────────────────────────────────────────────────────

  function paletteTile(item: (typeof PALETTE_ITEMS)[number]) {
    return (
      <button
        type="button"
        draggable
        onDragStart={e => {
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', item.kind);
          setDragging({ kind: 'new', palette: item.kind });
        }}
        onDragEnd={() => { setDragging(null); setDropIndex(null); }}
        onClick={() => addFromPalette(item.kind)}
        className="group flex items-center gap-2.5 w-full text-left focus:outline-none"
        style={{
          minHeight: 52,
          padding: '9px 11px',
          borderRadius: 16,
          border: CARD_BORDER,
          backgroundColor: NEU.surface,
          boxShadow: NEU.outSm,
          cursor: 'grab',
          transitionProperty: 'box-shadow, transform',
          transitionDuration: '220ms',
          transitionTimingFunction: EASE,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = NEU.outSmHover;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = NEU.outSm;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 34, height: 34, borderRadius: 12,
            background: `linear-gradient(135deg, ${NEU_GRADIENTS.gold[0]}40, ${NEU_GRADIENTS.gold[1]}2E), ${NEU.surface}`,
            boxShadow: NEU.outSm,
          }}
        >
          <Emoji3D name={item.emoji} size={20} fallback={item.icon} fallbackColor={FOREST} />
        </span>
        <span className="min-w-0">
          <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: INK }}>
            {item.label}
          </span>
          <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT }}>
            {item.hint}
          </span>
        </span>
      </button>
    );
  }

  const palettePanel = (
    <div>
      {paletteTab === 'blocks' && (
        <>
          <PanelTitle hint="Drag one onto the email, or click to drop it in.">BUILDING BLOCKS</PanelTitle>
          <div className={wide ? 'flex flex-col gap-2' : 'flex gap-2 overflow-x-auto pb-1'}>
            {PALETTE_ITEMS.map(item => (
              <div key={item.kind} className={wide ? '' : 'flex-shrink-0'} style={wide ? undefined : { width: 168 }}>
                {paletteTile(item)}
              </div>
            ))}
          </div>
        </>
      )}

      {paletteTab === 'details' && (
        <>
          <PanelTitle hint="Drop one in and every person reads their own name, country or committee.">
            PERSONAL DETAILS
          </PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {EMAIL_TOKEN_KEYS.map(key => (
              <button
                key={key}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleTokenInsert(key)}
                className="focus:outline-none"
                style={{
                  minHeight: 32,
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontFamily: OUTFIT,
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: '#7A5A0F',
                  backgroundColor: 'rgba(238,217,138,0.42)',
                  border: '1px solid rgba(182,135,31,0.42)',
                  cursor: 'pointer',
                  transitionProperty: 'background-color, transform',
                  transitionDuration: '180ms',
                  transitionTimingFunction: EASE,
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(238,217,138,0.68)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(238,217,138,0.42)'; }}
              >
                {EMAIL_TOKEN_LABELS[key as EmailTokenKey]}
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
            <CornerDownRight size={12} style={{ color: SOFT, flexShrink: 0, marginTop: 2 }} />
            Goes wherever your cursor is — click into the subject or a paragraph first.
          </p>
        </>
      )}

      {paletteTab === 'starters' && (
        <>
          <PanelTitle hint="A ready-made shape. Everything stays editable.">START FROM</PanelTitle>
          <div className={wide ? 'flex flex-col gap-2' : 'flex gap-2 overflow-x-auto pb-1'}>
            {STARTERS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => insertBlocks(s.blocks, blocks.length)}
                className="flex items-center gap-2.5 text-left focus:outline-none flex-shrink-0"
                style={{
                  width: wide ? '100%' : 190,
                  minHeight: 58,
                  padding: '10px 12px',
                  borderRadius: 16,
                  border: CARD_BORDER,
                  backgroundColor: NEU.surface,
                  boxShadow: NEU.outSm,
                  cursor: 'pointer',
                  transitionProperty: 'box-shadow, transform',
                  transitionDuration: '220ms',
                  transitionTimingFunction: EASE,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = NEU.outSmHover; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = NEU.outSm; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <span
                  className="flex flex-col justify-center gap-1 flex-shrink-0"
                  style={{ width: 34, height: 38, padding: 5, borderRadius: 8, backgroundColor: '#FFFDF8', boxShadow: NEU.inSm }}
                >
                  {s.shape.map((k, i) => (
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
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <Emoji3D name={s.emoji} size={15} fallback={Sparkles} fallbackColor={FOREST} />
                    <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: INK, lineHeight: 1.25 }}>{s.label}</span>
                  </span>
                  <span className="block" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT, lineHeight: 1.4, textWrap: 'pretty' }}>
                    {s.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
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
          <span style={{ flex: 1, height: 1, backgroundColor: 'rgba(182,135,31,0.5)' }} />
        </div>
        <button
          type="button"
          aria-label="Add a block here"
          onClick={() => setInsertAt(a => (a === index ? null : index))}
          className="absolute left-1/2 focus:outline-none"
          style={{
            top: -5, marginLeft: -13, width: 26, height: 26, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(182,135,31,0.5)',
            backgroundColor: open ? NEU_GRADIENTS.gold[0] : '#FFFDF8',
            color: '#7A5A0F', cursor: 'pointer',
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
        {open && (
          <div
            className="absolute left-1/2 flex gap-1.5 flex-wrap justify-center"
            style={{
              top: 24, marginLeft: -140, width: 280, padding: 8, borderRadius: 14,
              backgroundColor: NEU.surface, border: CARD_BORDER, boxShadow: CARD_SHADOW, zIndex: 8,
            }}
          >
            {PALETTE_ITEMS.map(item => (
              <button
                key={item.kind}
                type="button"
                onClick={() => { insertBlocks([blockForKind(item.kind)], index); setInsertAt(null); }}
                className="flex items-center gap-1.5 focus:outline-none"
                style={{
                  minHeight: 32, padding: '6px 10px', borderRadius: 999,
                  border: CARD_BORDER, backgroundColor: '#FFFDF8',
                  fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, color: INK, cursor: 'pointer',
                }}
              >
                <Emoji3D name={item.emoji} size={14} fallback={item.icon} fallbackColor={FOREST} />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function blockFrame(block: LocalBlock, index: number) {
    const isSelected = selectedId === block._id;
    const toolsShown = isSelected || hoverId === block._id;
    const variant = block.type === 'paragraph' ? (block.variant ?? 'body') : null;
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
        {/* The block's own toolbar. Floats ABOVE the block, anchored left — the
            gesture everyone already knows from a document editor. Revealed on
            hover as well as on selection, so it is discoverable without a
            click. For a paragraph it carries the three sizes and the two marks
            inline, because those are the controls people reach for mid-sentence
            and a trip to the side panel breaks the sentence. */}
        <div
          className="absolute flex items-center gap-0.5"
          style={{
            top: -17, left: -4, padding: 3, borderRadius: 999,
            backgroundColor: NEU.surface, border: CARD_BORDER, boxShadow: CARD_SHADOW,
            opacity: toolsShown ? 1 : 0,
            pointerEvents: toolsShown ? 'auto' : 'none',
            transitionProperty: 'opacity',
            transitionDuration: '160ms',
            zIndex: 5,
          }}
        >
          <span
            draggable
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', block._id);
              setDragging({ kind: 'move', id: block._id });
            }}
            onDragEnd={() => { setDragging(null); setDropIndex(null); }}
            title="Drag to move"
            className="inline-flex items-center justify-center"
            style={{ width: 26, height: 26, borderRadius: 999, cursor: 'grab', color: SOFT }}
          >
            <GripVertical size={13} />
          </span>
          <button type="button" title="Move up" disabled={index === 0} onClick={e => { e.stopPropagation(); moveBlock(block._id, -1); }}
            className="inline-flex items-center justify-center focus:outline-none disabled:opacity-30"
            style={{ width: 26, height: 26, borderRadius: 999, border: 'none', background: 'transparent', color: FOREST, cursor: 'pointer' }}>
            <ChevronUp size={14} strokeWidth={2.4} />
          </button>
          <button type="button" title="Move down" disabled={index === blocks.length - 1} onClick={e => { e.stopPropagation(); moveBlock(block._id, 1); }}
            className="inline-flex items-center justify-center focus:outline-none disabled:opacity-30"
            style={{ width: 26, height: 26, borderRadius: 999, border: 'none', background: 'transparent', color: FOREST, cursor: 'pointer' }}>
            <ChevronDown size={14} strokeWidth={2.4} />
          </button>

          {variant && (
            <>
              <span style={{ width: 1, height: 18, backgroundColor: 'rgba(27,56,40,0.14)', margin: '0 3px' }} />
              {VARIANT_META.map(v => (
                <button
                  key={v.value}
                  type="button"
                  title={v.label}
                  onMouseDown={e => e.preventDefault()}
                  onClick={e => { e.stopPropagation(); setVariant(block._id, v.value); }}
                  className="inline-flex items-center justify-center focus:outline-none"
                  style={{
                    minWidth: 26, height: 26, padding: '0 7px', borderRadius: 999, border: 'none',
                    background: variant === v.value ? FOREST : 'transparent',
                    color: variant === v.value ? GOLD : SOFT,
                    fontFamily: OUTFIT, fontSize: 10, fontWeight: 900, letterSpacing: '0.04em',
                    cursor: 'pointer',
                    transitionProperty: 'background, color', transitionDuration: '180ms',
                  }}
                >
                  {v.value === 'heading' ? 'H' : v.value === 'body' ? 'T' : 'S'}
                </button>
              ))}
              <span style={{ width: 1, height: 18, backgroundColor: 'rgba(27,56,40,0.14)', margin: '0 3px' }} />
              {([['bold', Bold], ['italic', Italic]] as const).map(([cmd, Icon]) => (
                <button
                  key={cmd}
                  type="button"
                  title={cmd === 'bold' ? 'Bold (⌘B)' : 'Italic (⌘I)'}
                  onMouseDown={e => e.preventDefault()}
                  onClick={e => { e.stopPropagation(); setSelectedId(block._id); setActiveTarget(block._id); applyMarkToBlock(block._id, cmd); }}
                  className="inline-flex items-center justify-center focus:outline-none"
                  style={{
                    width: 26, height: 26, borderRadius: 999, border: 'none',
                    background: isSelected && fmt[cmd] ? 'rgba(27,56,40,0.13)' : 'transparent',
                    color: FOREST, cursor: 'pointer',
                  }}
                >
                  <Icon size={13} strokeWidth={2.6} />
                </button>
              ))}
            </>
          )}

          <span style={{ width: 1, height: 18, backgroundColor: 'rgba(27,56,40,0.14)', margin: '0 3px' }} />
          <button type="button" title="Remove" onClick={e => { e.stopPropagation(); deleteBlock(block._id); }}
            className="inline-flex items-center justify-center focus:outline-none"
            style={{ width: 26, height: 26, borderRadius: 999, border: 'none', background: 'transparent', color: RED, cursor: 'pointer' }}>
            <Trash2 size={13} strokeWidth={2.3} />
          </button>
        </div>

        {block.type === 'paragraph' && (
          <ParagraphEditor
            blockId={block._id}
            initialContent={block.content}
            variant={block.variant ?? 'body'}
            registerRef={registerBlockRef}
            onFocusBlock={id => { setActiveTarget(id); setSelectedId(id); }}
            onContentChange={updateParagraphContent}
            onFormatState={setFmt}
          />
        )}

        {block.type === 'button' && (
          <div style={{ textAlign: 'center', padding: '10px 0 26px 0' }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: theme.buttonColor,
                border: '1px solid rgba(0,0,0,0.16)',
                borderRadius: 8,
                padding: '15px 34px',
                fontFamily: MAIL_SANS,
                fontSize: 15,
                fontWeight: 700,
                lineHeight: '20px',
                letterSpacing: '0.01em',
                color: inkOnColor(theme.buttonColor),
              }}
            >
              {block.label.trim() || 'Learn more'}
            </span>
          </div>
        )}

        {block.type === 'image' && (
          <div style={{ textAlign: 'center', padding: '2px 0 22px' }}>
            {block.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.url}
                alt={block.alt || ''}
                style={{ width: '100%', maxWidth: CONTENT_WIDTH, height: 'auto', display: 'block', margin: '0 auto', borderRadius: 10, outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: -1 }}
              />
            ) : (
              <span
                className="flex flex-col items-center justify-center gap-1"
                style={{
                  height: 132, borderRadius: 10,
                  border: '2px dashed rgba(182,135,31,0.45)',
                  backgroundColor: 'rgba(238,217,138,0.12)',
                  color: '#7A5A0F', fontFamily: OUTFIT, fontSize: 12, fontWeight: 700,
                }}
              >
                <Emoji3D name="Framed picture" size={26} fallback={ImageIcon} fallbackColor="#7A5A0F" />
                Pick a picture in the panel
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  const sheet = (
    <div
      style={{
        width: '100%',
        maxWidth: SHEET_WIDTH,
        margin: '0 auto',
        borderRadius: 14,
        backgroundColor: MAIL_CARD,
        border: `1px solid ${MAIL_HAIRLINE}`,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(27,56,40,0.12), 0 14px 34px rgba(27,56,40,0.20)',
      }}
    >
      {/* ── Chrome the renderer adds on its own: accent spine, optional banner,
          identity row. Drawn here so the sheet is the whole email rather than
          a floating middle, and labelled ADDED FOR YOU so nobody hunts for the
          control that would edit it (it lives in Design, not here). ── */}
      <div className="relative">
        <div style={{ height: 5, backgroundColor: theme.accentColor }} />
        {useBannerHeader && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={conference.banner_url ?? ''}
            alt=""
            style={{ display: 'block', width: '100%', height: BANNER_HEIGHT, objectFit: 'cover', objectPosition: 'center' }}
          />
        )}
        {useBannerHeader ? (
          <div className="flex items-center gap-3" style={{ padding: '22px 40px', borderBottom: `1px solid ${MAIL_HAIRLINE}`, backgroundColor: MAIL_CARD }}>
            {headerLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerLogo} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'contain', backgroundColor: MAIL_CHIP_BG, flexShrink: 0 }} />
            )}
            <span className="min-w-0">
              <span className="block" style={{ fontFamily: MAIL_SERIF, fontSize: 20, fontWeight: 700, lineHeight: 1.25, letterSpacing: '0.03em', color: MAIL_INK }}>
                {conference.acronym || conference.full_name}
              </span>
              {distinctFullName && (
                <span className="block" style={{ fontFamily: MAIL_SANS, fontSize: 12, lineHeight: 1.45, color: MAIL_MUTED, paddingTop: 4 }}>
                  {conference.full_name}
                </span>
              )}
            </span>
          </div>
        ) : (
          <div className="text-center" style={{ padding: '30px 32px', backgroundColor: theme.accentColor }}>
            {headerLogo && (
              <div style={{ paddingBottom: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={headerLogo} alt="" style={{ display: 'inline-block', width: 52, height: 52, borderRadius: 10, objectFit: 'contain', backgroundColor: MAIL_CHIP_BG }} />
              </div>
            )}
            <div style={{ fontFamily: MAIL_SERIF, fontSize: 20, fontWeight: 700, lineHeight: 1.25, letterSpacing: '0.03em', color: accentInk }}>
              {conference.acronym || conference.full_name}
            </div>
            {distinctFullName && (
              <div style={{ fontFamily: MAIL_SANS, fontSize: 12, lineHeight: 1.45, color: accentInk, opacity: 0.78, paddingTop: 4 }}>
                {conference.full_name}
              </div>
            )}
          </div>
        )}
        <span
          style={{
            position: 'absolute', left: 10, top: 11,
            padding: '3px 9px', borderRadius: 999,
            fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            backgroundColor: 'rgba(255,255,255,0.9)', color: SOFT,
          }}
        >
          ADDED FOR YOU
        </span>
      </div>

      {/* Body */}
      <div
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        style={{ padding: '34px 40px 8px 40px', minHeight: 200 }}
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
            <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: INK, textWrap: 'balance' }}>
              Your email starts here
            </p>
            <p className="mt-1 mb-4" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, maxWidth: 300, lineHeight: 1.5, textWrap: 'pretty' }}>
              Drag a block in from the left, or pick one of these.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PALETTE_ITEMS.filter(i => i.kind !== 'paragraph:small').map(item => (
                <ActionButton key={item.kind} size="sm" tone="quiet" onClick={() => addFromPalette(item.kind)}>
                  <Emoji3D name={item.emoji} size={14} fallback={item.icon} fallbackColor={FOREST} />
                  {item.label.toUpperCase()}
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
          </>
        )}
      </div>

      {/* Footer band — the renderer's, labelled as chrome. */}
      <div style={{ backgroundColor: MAIL_FOOTER_BG, borderTop: `1px solid ${MAIL_HAIRLINE}`, padding: '14px 40px 28px' }}>
        <span
          style={{
            display: 'inline-block', marginBottom: 12,
            padding: '3px 9px', borderRadius: 999,
            fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            backgroundColor: 'rgba(255,255,255,0.85)', color: SOFT,
          }}
        >
          ADDED FOR YOU
        </span>
        {theme.footerLine.trim() && (
          <div style={{ fontFamily: MAIL_SANS, fontSize: 14, lineHeight: 1.65, color: MAIL_INK_SOFT, paddingBottom: 14 }}>
            {theme.footerLine}
          </div>
        )}
        <div style={{ fontFamily: MAIL_SANS, fontSize: 13, lineHeight: 1.6, fontWeight: 700, color: MAIL_INK_SOFT }}>
          {conference.full_name}
        </div>
        <div style={{ fontFamily: MAIL_SANS, fontSize: 13, lineHeight: 1.6, color: MAIL_MUTED, paddingTop: 2, textDecoration: 'underline' }}>
          {conference.contact_email}
        </div>
        <div style={{ fontFamily: MAIL_SANS, fontSize: 12, lineHeight: 1.7, color: MAIL_MUTED, paddingTop: 14 }}>
          Sent to you by {conference.acronym || conference.full_name} through Gavelling, the platform it runs on.
          <br />
          <span style={{ textDecoration: 'underline' }}>Manage email preferences</span>
          {' · '}
          <span style={{ textDecoration: 'underline' }}>gavelling.com</span>
        </div>
      </div>
    </div>
  );

  // ── Properties ─────────────────────────────────────────────────────────────

  const properties = (
    <div>
      {!selected && (
        <>
          <PanelTitle hint="Click any part of the email to edit it here.">BEFORE YOU SEND</PanelTitle>
          <div className="flex flex-col gap-1.5 mb-4">
            {checks.map(c => (
              <div
                key={c.label}
                className="flex items-start gap-2"
                style={{
                  padding: '9px 11px', borderRadius: 12,
                  backgroundColor: c.ok ? 'rgba(47,102,68,0.08)' : '#FFFDF8',
                  boxShadow: c.ok ? 'none' : NEU.inSm,
                  border: c.ok ? '1px solid rgba(47,102,68,0.18)' : '1px solid rgba(27,56,40,0.09)',
                }}
              >
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 18, height: 18, borderRadius: 999, marginTop: 1,
                    backgroundColor: c.ok ? GREEN_INK : 'rgba(126,81,40,0.16)',
                    color: c.ok ? '#FFFFFF' : AMBER_INK,
                  }}
                >
                  {c.ok ? <Check size={11} strokeWidth={3.2} /> : <AlertTriangle size={10} strokeWidth={2.8} />}
                </span>
                <span className="min-w-0">
                  <span className="block" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: c.ok ? GREEN_INK : INK }}>
                    {c.label}
                  </span>
                  {!c.ok && (
                    <span className="block" style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, lineHeight: 1.45, textWrap: 'pretty' }}>
                      {c.fix}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, backgroundColor: 'rgba(27,56,40,0.1)', margin: '4px 0 14px' }} />

          <PanelTitle hint="Goes to your own inbox, so you can read it the way they will.">TRY IT ON YOURSELF</PanelTitle>
          <ActionButton icon={Send} onClick={handleSendTest} disabled={sendingTest || !accessToken || !organizerEmail} style={{ width: '100%' }}>
            {sendingTest ? 'SENDING…' : 'SEND ME A TEST'}
          </ActionButton>
          {testMessage && (
            <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: testMessage.startsWith("Couldn't") ? RED : GREEN_INK, textWrap: 'pretty' }}>
              {testMessage}
            </p>
          )}
        </>
      )}

      {selected?.type === 'paragraph' && (
        <>
          <PanelTitle hint="Three sizes, nothing else — the email's own theme handles the rest.">TEXT</PanelTitle>
          <FieldLabel>SIZE</FieldLabel>
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
                      fontFamily: v.serif ? MAIL_SERIF : MAIL_SANS,
                      fontSize: v.sample,
                      fontWeight: v.value === 'heading' ? 700 : 400,
                      color: v.value === 'small' ? MAIL_MUTED : MAIL_INK,
                    }}
                  >
                    {v.label}
                  </span>
                  {active && <Check size={14} strokeWidth={3} style={{ color: FOREST, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>

          <FieldLabel>EMPHASIS</FieldLabel>
          <div className="flex gap-1.5 mb-4">
            {([['bold', Bold, 'Bold'], ['italic', Italic, 'Italic']] as const).map(([cmd, Icon, title]) => (
              <button
                key={cmd}
                type="button"
                title={`${title} (⌘${cmd === 'bold' ? 'B' : 'I'})`}
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
          <p style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
            Select some words in the email first, then hit one of these.
          </p>
        </>
      )}

      {selected?.type === 'button' && (
        <ButtonProperties block={selected} onPatch={p => patchButton(selected._id, p)} />
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
          <button
            type="button"
            onClick={() => deleteBlock(selected._id)}
            className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{
              minHeight: 40, padding: '9px 14px', borderRadius: 999,
              border: '1px solid rgba(139,32,32,0.28)', backgroundColor: 'transparent',
              fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em',
              color: RED, cursor: 'pointer',
            }}
          >
            <Trash2 size={13} strokeWidth={2.3} /> REMOVE THIS BLOCK
          </button>
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
          fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: INK, cursor: 'pointer', maxWidth: 220,
        }}
      >
        <UserRound size={13} strokeWidth={2.4} style={{ color: SOFT, flexShrink: 0 }} />
        <span className="truncate">As {asCandidate?.label ?? 'nobody in particular'}</span>
        <ChevronDown size={12} strokeWidth={2.6} style={{ color: SOFT, flexShrink: 0 }} />
      </button>
      <PopoverLayer anchorRef={asBtnRef} open={asOpen} onClose={closeAsPicker} width={260} maxHeight={310} align="end">
        <div style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', border: CARD_BORDER, boxShadow: CARD_SHADOW }}>
          <input
            autoFocus
            value={asQuery}
            onChange={e => setAsQuery(e.target.value)}
            placeholder="Search people…"
            className="w-full focus:outline-none"
            style={{ padding: '10px 13px', fontFamily: OUTFIT, fontSize: 12.5, color: INK, borderBottom: '1px solid rgba(27,56,40,0.1)', minHeight: 40 }}
          />
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => { setAsId(null); setAsOpen(false); }}
              className="w-full text-left focus:outline-none"
              style={{ padding: '9px 13px', minHeight: 38, fontFamily: OUTFIT, fontSize: 12.5, color: INK, fontWeight: asId === null ? 800 : 500, background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Nobody in particular
            </button>
            {asMatches.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setAsId(c.id); setAsOpen(false); }}
                className="w-full text-left truncate focus:outline-none"
                style={{ padding: '9px 13px', minHeight: 38, fontFamily: OUTFIT, fontSize: 12.5, color: INK, fontWeight: asId === c.id ? 800 : 500, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverLayer>
    </div>
  );

  const canvasColumn = (
    <div className="min-w-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'edit' as const, label: 'WRITE', icon: Pencil },
            { value: 'preview' as const, label: 'SEE IT FOR REAL', icon: Eye },
          ]}
        />
        {mode === 'preview' && (
          <Segmented
            value={previewWidth}
            onChange={setPreviewWidth}
            options={[
              { value: 'desktop' as const, label: 'LAPTOP', icon: Monitor },
              { value: 'mobile' as const, label: 'PHONE', icon: Smartphone },
            ]}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          {asPicker}
          <ActionButton size="sm" tone="quiet" icon={Send} onClick={handleSendTest} disabled={sendingTest || !accessToken || !organizerEmail}>
            {sendingTest ? 'SENDING…' : 'TEST'}
          </ActionButton>
        </div>
      </div>

      {/* Subject — the inbox row, because that is literally where it lands */}
      <div className="mb-3 flex items-center gap-3" style={{ ...panelStyle, borderRadius: 18, padding: '12px 14px' }}>
        <span
          className="inline-flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ width: 38, height: 38, borderRadius: 999, backgroundColor: FOREST, boxShadow: NEU.outSm }}
        >
          {conference.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conference.logo_url} alt="" style={{ width: 38, height: 38, objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 900, color: GOLD }}>
              {conference.acronym.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', color: SOFT }}>
            {conference.acronym.toUpperCase()} · {conference.contact_email}
          </p>
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onFocus={() => { setActiveTarget('subject'); setSelectedId(null); }}
            placeholder="Write the subject line — this is the bit they see first"
            className="w-full focus:outline-none"
            style={{
              fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 800, color: INK,
              background: 'transparent', border: 'none', padding: '2px 0', minHeight: 30,
            }}
          />
        </div>
      </div>

      {/* Desk */}
      <div
        onDragOver={mode === 'edit' ? handleCanvasDragOver : undefined}
        onDrop={mode === 'edit' ? handleCanvasDrop : undefined}
        onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); setInsertAt(null); } }}
        style={{
          backgroundColor: DESK,
          borderRadius: 22,
          boxShadow: DESK_WELL,
          padding: wide ? '28px 24px' : '18px 12px',
          minHeight: 420,
        }}
      >
        {mode === 'edit' ? sheet : (
          <div className="flex justify-center">
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
                backgroundColor: '#FFFFFF',
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

  return (
    <div>
      {reachSlot}

      <div
        className="grid gap-4 items-start"
        style={wide ? { gridTemplateColumns: '256px minmax(0,1fr) 296px' } : { gridTemplateColumns: 'minmax(0,1fr)' }}
      >
        {/* ── 1 · PALETTE ── */}
        <div
          className={wide ? 'lg:sticky' : ''}
          style={{ ...panelStyle, top: 16, overflow: 'hidden', display: 'flex', flexDirection: wide ? 'row' : 'column' }}
        >
          {/* the slim rail */}
          <div
            className={wide ? 'flex flex-col gap-1' : 'flex flex-row gap-1'}
            style={{
              padding: 8,
              backgroundColor: 'rgba(27,56,40,0.05)',
              boxShadow: NEU.inSm,
              flexShrink: 0,
            }}
          >
            {paletteRail.map(t => {
              const active = paletteTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  title={t.label}
                  onClick={() => setPaletteTab(t.key)}
                  className="inline-flex flex-col items-center justify-center gap-0.5 focus:outline-none"
                  style={{
                    width: wide ? 44 : undefined,
                    flex: wide ? undefined : 1,
                    minWidth: 44,
                    height: 46,
                    borderRadius: 14,
                    border: 'none',
                    background: active ? `linear-gradient(135deg, ${FOREST}, #2E6041)` : 'transparent',
                    color: active ? GOLD : SOFT,
                    cursor: 'pointer',
                    boxShadow: active ? '0 3px 9px rgba(27,56,40,0.3)' : 'none',
                    transitionProperty: 'background, color, box-shadow',
                    transitionDuration: '220ms',
                    transitionTimingFunction: EASE,
                  }}
                >
                  <t.icon size={15} strokeWidth={2.4} />
                  <span style={{ fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.06em' }}>
                    {t.label.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="min-w-0 flex-1" style={{ padding: 14 }}>
            {palettePanel}
          </div>
        </div>

        {/* ── 2 · CANVAS ── */}
        {canvasColumn}

        {/* ── 3 · PROPERTIES ── */}
        {wide ? (
          <div className="lg:sticky" style={{ ...panelStyle, top: 16, padding: 16 }}>
            {properties}
          </div>
        ) : (
          <div
            style={{
              ...panelStyle,
              position: selected ? 'fixed' : 'static',
              left: selected ? 8 : undefined,
              right: selected ? 8 : undefined,
              bottom: selected ? 8 : undefined,
              zIndex: selected ? 45 : undefined,
              maxHeight: selected ? '58vh' : undefined,
              overflowY: selected ? 'auto' : undefined,
              padding: 16,
            }}
          >
            {selected && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="absolute focus:outline-none inline-flex items-center justify-center"
                style={{ top: 10, right: 10, width: 32, height: 32, borderRadius: 999, border: CARD_BORDER, background: '#FFFDF8', color: SOFT, cursor: 'pointer' }}
              >
                <X size={14} strokeWidth={2.6} />
              </button>
            )}
            {properties}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Property editors ─────────────────────────────────────────────────────────

function ButtonProperties({ block, onPatch }: { block: ButtonBlock; onPatch: (patch: Partial<ButtonBlock>) => void }) {
  return (
    <>
      <PanelTitle hint="One button, one place to go. The colour comes from your email theme.">BUTTON</PanelTitle>
      <FieldLabel>WHAT IT SAYS</FieldLabel>
      <input
        value={block.label}
        onChange={e => onPatch({ label: e.target.value })}
        placeholder="e.g. Open my conference"
        style={FIELD_STYLE}
        className="mb-4"
      />
      <FieldLabel>WHERE IT GOES</FieldLabel>
      <select
        value={block.destination}
        onChange={e => onPatch({ destination: e.target.value as ButtonDestination })}
        style={{ ...FIELD_STYLE, cursor: 'pointer' }}
        className="mb-3"
      >
        {(Object.keys(BUTTON_DESTINATION_LABELS) as ButtonDestination[]).map(d => (
          <option key={d} value={d}>{BUTTON_DESTINATION_LABELS[d]}</option>
        ))}
      </select>
      {block.destination === 'apply_page' && (
        <>
          <FieldLabel>WHICH ROLE</FieldLabel>
          <select value={block.role ?? ''} onChange={e => onPatch({ role: e.target.value || undefined })} style={{ ...FIELD_STYLE, cursor: 'pointer' }} className="mb-3">
            <option value="">Any role</option>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </>
      )}
      {block.destination === 'custom' && (
        <>
          <FieldLabel>THE LINK</FieldLabel>
          <input value={block.url ?? ''} onChange={e => onPatch({ url: e.target.value })} placeholder="https://…" style={FIELD_STYLE} className="mb-3" />
        </>
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
      <PanelTitle hint="Anything up to 5MB — JPEG, PNG, WebP or GIF.">PICTURE</PanelTitle>
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
        {uploading ? 'UPLOADING…' : block.url ? 'CHOOSE ANOTHER' : 'CHOOSE A PICTURE'}
      </ActionButton>
      {error && (
        <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: RED, textWrap: 'pretty' }}>{error}</p>
      )}

      <div className="mt-4">
        <FieldLabel>DESCRIBE IT</FieldLabel>
        <input
          value={block.alt}
          onChange={e => onPatch({ alt: e.target.value })}
          placeholder="e.g. Delegates in the opening ceremony"
          style={{ ...FIELD_STYLE, borderColor: block.url && !block.alt.trim() ? 'rgba(182,135,31,0.6)' : 'rgba(27,56,40,0.13)' }}
        />
        {block.url && !block.alt.trim() && (
          <p className="mt-1.5 flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: AMBER_INK, lineHeight: 1.5, textWrap: 'pretty' }}>
            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
            Some people never see the picture — this is what they read instead.
          </p>
        )}
      </div>
    </>
  );
}
