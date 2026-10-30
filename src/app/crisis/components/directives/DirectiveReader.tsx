'use client';
// Gavelling Crisis: the backroom's directives, read ONE BY ONE. The directive in front is large (the "No. 13"
// badge overlapping its top edge, the TITLE first, the character beneath it, then the text), and the next
// directives of the lane wait to the right as smaller copies of it (same layout, each shorter and narrower, centred
// on the front card), every one BEHIND the one before it and peeking out on its right edge, so together they fill the
// space out to the page's right edge. A card's content sits in the part that peeks out, so no title is ever covered.
// Clicking one brings it to the front; pressing the front one, its Respond button or Enter opens the directive
// pop-up to answer it. The left and right arrow keys move along. The lane and the filters above decide which
// directives are in the stack, in queue order. Presentation and choices only: nothing here writes except the
// character's backroomer (CharacterBackroomer).

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Clock, MessageCircle, Pencil, Reply } from 'lucide-react';
import { dirNumber } from '@/lib/crisis/format';
import { KIND_LABEL, OUTCOME_LABEL, type Directive } from '@/lib/crisis/types';
import { Avatar, Btn, CK, ThemeTag, cabinetTint, waitLabel, waitSeverity } from '../../crisisKit';
import { CharacterLink } from '../character/CharacterProfileHost';
import CharacterBackroomer from './CharacterBackroomer';
import { CabinetLogo, NameStack, NumberBadge, StaffPic, shortName } from './directiveParts';
import { KIND_ICON, OUTCOME_STYLE, authorName, isBeingWritten, memberName, type Lane, type Names } from './directiveKit';

const WAIT_COLOR = { ok: CK.ink, late: CK.goldDeep, very: CK.danger } as const;

/** How tall each card in the stack is, as a share of the front card's height (shorter, one step at a time). */
const HEIGHTS = [0.88, 0.77, 0.67, 0.58];
/** The width of the strip each stacked card shows, and the part of its box that hides behind the card before it. */
const STRIP = 232;
const HIDDEN = 40;
const MAX_STACK = HEIGHTS.length;

/** How many stacked cards fit beside the front card, and how wide the front card is then (it takes what is left). */
export function stackLayout(stageW: number, available: number): { n: number; fw: number } {
  if (stageW < 900) return { n: 0, fw: stageW };
  const n = Math.max(0, Math.min(available, MAX_STACK, Math.floor((stageW * 0.45) / STRIP)));
  return { n, fw: stageW - n * STRIP };
}

function typingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute('role') === 'combobox' || !!el.closest('[role="listbox"],[role="dialog"],[role="alertdialog"]');
}

/** When a directive was sent or answered, in the words of its lane. */
function whenOf(d: Directive, lane: Lane, now: number): { text: string; sev: 'ok' | 'late' | 'very' | null } {
  if (lane === 'answered') return { text: `Answered ${waitLabel(d.answered_at, now)} ago`, sev: null };
  if (lane === 'waiting') return { text: `Asked ${waitLabel(d.answered_at, now)} ago`, sev: null };
  return { text: waitLabel(d.waiting_since, now), sev: waitSeverity(d.waiting_since, now) };
}

function Writing({ d, names, now, small }: { d: Directive; names: Names; now: number; small?: boolean }) {
  if (!isBeingWritten(d, now) || !d.drafting_member) return null;
  const m = names.members.get(d.drafting_member);
  return (
    <span className="inline-flex items-center" style={{ gap: 6, fontSize: small ? 11.5 : 13, fontWeight: 800, color: CK.goldDeep, lineHeight: 1.25 }}>
      <StaffPic member={m ?? null} size={small ? 18 : 22} />
      <Pencil size={small ? 11 : 13} strokeWidth={1.6} aria-hidden style={{ flex: 'none' }} />
      <span style={{ overflowWrap: 'anywhere' }}>Being written by {m?.display_name ?? 'a teammate'}</span>
    </span>
  );
}

/**
 * A smaller copy of the front card, further back in the stack: badge, title, character, the start of the text.
 * It sits BEHIND the card before it; only its right part shows (STRIP wide), and its content starts there.
 */
function NextCard({ d, k, fw, names, lane, now, onPick }: { d: Directive; k: number; fw: number; names: Names; lane: Lane; now: number; onPick: () => void }) {
  const cab = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const ch = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const who = authorName(d, names);
  const color = cab?.color ?? CK.red;
  const when = whenOf(d, lane, now);
  const KindIcon = KIND_ICON[d.kind];
  const pct = HEIGHTS[k - 1];
  const left = fw + (k - 1) * STRIP - HIDDEN;
  const style: CSSProperties = {
    position: 'absolute', left, width: STRIP + HIDDEN, zIndex: 30 - k,
    top: `calc(14px + (100% - 20px) * ${((1 - pct) / 2).toFixed(4)})`, height: `calc((100% - 20px) * ${pct})`,
  };
  return (
    <div className="rd-next" style={style}>
      <div style={{ position: 'relative', height: '100%', background: CK.card, borderRadius: 22, boxShadow: `${CK.shadowSm}, 0 16px 34px rgba(58,14,15,0.18)`, border: '1px solid rgba(27,56,40,0.14)', overflow: 'visible' }}>
        <NumberBadge n={dirNumber(d)} color={color} style={{ position: 'absolute', zIndex: 2, top: -9, left: HIDDEN + 14 }} />
        <button type="button" onClick={onPick} aria-label={`Read directive No. ${dirNumber(d)}: ${d.title}`}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform hover:-translate-y-0.5"
          style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', borderRadius: 'inherit', padding: `20px 16px 14px ${HIDDEN + 14}px`, fontFamily: CK.font, color: CK.ink, overflow: 'hidden' }}>
          <span style={{ display: 'block', flex: 'none', fontSize: 18, fontWeight: 800, lineHeight: 1.22, overflowWrap: 'anywhere' }}>{d.title}</span>
          <span className="flex items-center" style={{ flex: 'none', gap: 9, marginTop: 11 }}>
            <Avatar name={who} src={ch?.picture_url} size={38} color={color} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{shortName(who)}</span>
              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: CK.muted, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{ch?.title?.trim() || cab?.name || ''}</span>
            </span>
          </span>
          <span className="flex items-center flex-wrap" style={{ flex: 'none', gap: '4px 9px', marginTop: 10 }}>
            <KindIcon size={14} strokeWidth={1.5} aria-label={KIND_LABEL[d.kind]} style={{ color: CK.red, flex: 'none' }} />
            <CabinetLogo cabinet={cab} size={18} />
            <span className="inline-flex items-center" style={{ gap: 3, fontSize: 12, fontWeight: 800, color: when.sev ? WAIT_COLOR[when.sev] : CK.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
              <Clock size={12} strokeWidth={1.6} aria-hidden />{when.text}
            </span>
          </span>
          {isBeingWritten(d, now) && <span style={{ flex: 'none', marginTop: 8 }}><Writing d={d} names={names} now={now} small /></span>}
          {/* The start of the text, fading out where the card ends. */}
          <span className="rd-fade" style={{ display: 'block', flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 11, fontSize: 14, lineHeight: 1.55, fontWeight: 500, color: CK.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.body}</span>
        </button>
      </div>
    </div>
  );
}

/** The directive in front: large, with its text, a few facts, who looks after the character, and Respond. */
function FrontCard({ d, names, lane, now, all, index, total, onPrev, onNext, onRespond, onChanged }: {
  d: Directive; names: Names; lane: Lane; now: number; all: Directive[]; index: number; total: number;
  onPrev: () => void; onNext: () => void; onRespond: () => void; onChanged: () => void;
}) {
  const cab = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const ch = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const who = authorName(d, names);
  const color = cab?.color ?? CK.red;
  const KindIcon = KIND_ICON[d.kind];
  const when = whenOf(d, lane, now);
  const open = d.status === 'queued' || d.status === 'claimed';
  const outcome = d.outcome ? OUTCOME_STYLE[d.outcome] : null;
  const responsible = d.assigned_member_id ?? ch?.owner_member_id ?? null;

  const facts: ReactNode[] = [];
  facts.push(<span key="w">{d.word_count} words</span>);
  if (d.receiver?.trim()) facts.push(<span key="t">To {d.receiver}</span>);
  if (d.covert) facts.push(<span key="c" style={{ color: CK.redDeep }}>Covert</span>);
  facts.push(<span key="r">{responsible ? `With ${memberName(responsible, names)}` : 'Nobody has it yet'}</span>);

  const iconBtn = { width: 34, height: 34, borderRadius: '50%', border: 0, background: CK.well, color: CK.forest, cursor: 'pointer', flex: 'none' } as const;

  return (
    <article
      className="rd-front"
      aria-label={`Directive No. ${dirNumber(d)}: ${d.title}`}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest('button, a, input, textarea, [role="combobox"], [role="listbox"], [data-no-open]')) return;
        if (window.getSelection()?.toString()) return;
        onRespond();
      }}
      style={{
        position: 'absolute', left: 0, top: 14, bottom: 6, width: 'var(--fw)', zIndex: 30, display: 'flex', flexDirection: 'column', cursor: 'pointer',
        background: CK.card, borderRadius: 24, border: '1px solid rgba(27,56,40,0.14)', boxShadow: `${CK.shadow}, 0 22px 44px rgba(58,14,15,0.18), inset 6px 0 0 ${color}`,
        fontFamily: CK.font, color: CK.ink,
      }}
    >
      <NumberBadge n={dirNumber(d)} color={color} style={{ position: 'absolute', zIndex: 2, top: -9, left: 26 }} />

      <div style={{ flex: 'none', padding: '24px 26px 0 30px' }}>
        <p className="flex items-center flex-wrap" style={{ margin: 0, gap: '4px 12px', fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>
          <span className="inline-flex items-center" style={{ gap: 6 }}><KindIcon size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />{KIND_LABEL[d.kind]}</span>
          {d.themes.slice(0, 3).map((t) => <ThemeTag key={t} theme={t} />)}
          <span className="flex-1" />
          <span className="inline-flex items-center" style={{ gap: 4, fontSize: 13, fontWeight: 800, color: when.sev ? WAIT_COLOR[when.sev] : CK.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
            <Clock size={14} strokeWidth={1.6} aria-hidden />{when.text}
          </span>
        </p>
        <h2 style={{ margin: '8px 0 0', fontSize: 28, lineHeight: 1.18, fontWeight: 800, overflowWrap: 'anywhere' }}>{d.title}</h2>
        <div className="flex items-center" style={{ gap: 14, marginTop: 14 }}>
          <CharacterLink id={ch?.id} style={{ borderRadius: '50%', lineHeight: 0 }}><Avatar name={who} src={ch?.picture_url} size={58} color={color} /></CharacterLink>
          <div style={{ minWidth: 0, flex: 1 }}>
            <NameStack name={who} align="left" big={19} small={12.5} width={220} characterId={ch?.id} />
            {ch?.title && <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: CK.inkSoft, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{ch.title}</p>}
          </div>
          <span className="inline-flex items-center" style={{ gap: 7, flex: 'none', maxWidth: '40%' }}>
            <CabinetLogo cabinet={cab} size={26} />
            <b style={{ fontSize: 13.5, color, overflowWrap: 'anywhere' }}>{cab?.name ?? 'No cabinet'}</b>
          </span>
        </div>
        <div style={{ marginTop: 8 }}><Writing d={d} names={names} now={now} /></div>
      </div>

      {/* The text of the directive (scrolls when it is long), then the answer when there is one. */}
      <div className="rd-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 26px 12px 30px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.65, fontWeight: 500, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.body}</p>
        {d.reply && (
          <div style={{ background: outcome ? cabinetTint(outcome.color, 0.09) : CK.well, borderRadius: 16, padding: '11px 14px', boxShadow: outcome ? `inset 0 0 0 1px ${cabinetTint(outcome.color, 0.28)}` : 'none' }}>
            <p className="flex items-center" style={{ margin: 0, gap: 6, fontSize: 12.5, fontWeight: 800, color: outcome?.color ?? CK.inkSoft }}>
              {outcome ? <outcome.Icon size={15} strokeWidth={1.6} aria-hidden /> : <MessageCircle size={15} strokeWidth={1.6} aria-hidden />}
              {d.outcome ? OUTCOME_LABEL[d.outcome] : 'Reply'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.reply}</p>
          </div>
        )}
        <p className="flex flex-wrap items-center" style={{ margin: 'auto 0 0', gap: '2px 14px', fontSize: 12.5, fontWeight: 700, color: CK.muted }}>
          {facts.map((f, i) => <span key={i}>{f}</span>)}
        </p>
      </div>

      {/* The footer: who looks after the character on the left; the arrows, "3 of 12" and Respond on the right. */}
      <div className="flex items-center flex-wrap" data-no-open style={{ flex: 'none', gap: '8px 16px', padding: '12px 20px 14px 30px', boxShadow: `0 -1px 0 ${CK.hair}`, borderRadius: '0 0 24px 24px', background: CK.card }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          {ch && <CharacterBackroomer character={ch} names={names} all={all} onChanged={onChanged} />}
        </div>
        <span className="inline-flex items-center" style={{ gap: 8 }}>
          <button type="button" onClick={onPrev} disabled={total < 2} aria-label="Previous directive" title="Previous directive (left arrow)"
            className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.94] transition-transform disabled:opacity-40" style={iconBtn}>
            <ChevronLeft size={19} strokeWidth={1.6} />
          </button>
          <span className="inline-flex items-baseline" style={{ gap: 5, whiteSpace: 'nowrap' }}>
            <b style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{index + 1}</b>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>of {total}</span>
          </span>
          <button type="button" onClick={onNext} disabled={total < 2} aria-label="Next directive" title="Next directive (right arrow)"
            className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.94] transition-transform disabled:opacity-40" style={iconBtn}>
            <ChevronRight size={19} strokeWidth={1.6} />
          </button>
        </span>
        <Btn tone="green" icon={<Reply size={16} strokeWidth={1.5} />} onClick={onRespond}>{open ? 'Respond' : 'Open'}</Btn>
      </div>
    </article>
  );
}

export default function DirectiveReader({ queue, focusId, onFocus, onOpen, active, names, lane, now, all, onChanged }: {
  /** The lane, filtered and in queue order. */
  queue: Directive[];
  focusId: string | null;
  onFocus: (id: string) => void;
  /** Open the directive pop-up on this directive. */
  onOpen: (d: Directive) => void;
  /** False while the pop-up is open, so the keys belong to it. */
  active: boolean;
  names: Names;
  lane: Lane;
  now: number;
  all: Directive[];
  onChanged: () => void;
}) {
  const at = Math.max(0, queue.findIndex((x) => x.id === focusId));
  const front = queue[at];
  const total = queue.length;

  const move = (delta: 1 | -1) => {
    if (total < 2) return;
    onFocus(queue[(at + delta + total) % total].id);
  };
  const moveRef = useRef(move);
  const openRef = useRef<() => void>(() => {});
  useEffect(() => { moveRef.current = move; openRef.current = () => { if (front) onOpen(front); }; });

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (typingTarget(e.target) || document.querySelector('[data-gsel-popover], [data-crisis-popover]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); moveRef.current(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveRef.current(-1); }
      else if (e.key === 'Enter' && !(e.target as HTMLElement | null)?.closest?.('button, a, [role="combobox"]')) { e.preventDefault(); openRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  // The stage's width decides how many cards fit on the right and how wide the front card is.
  const stage = useRef<HTMLDivElement>(null);
  const hasFront = front !== undefined;
  const [stageW, setStageW] = useState(1200);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setStageW((cur) => (Math.abs(cur - el.clientWidth) >= 2 ? el.clientWidth : cur));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasFront]);

  const upcoming = Math.max(0, total - at - 1);
  const { n, fw } = stackLayout(stageW, upcoming);
  const stack = useMemo(() => queue.slice(at + 1, at + 1 + n), [queue, at, n]);
  if (!front) return null;

  return (
    <div ref={stage} className="rd-stage" style={{ ['--fw' as string]: `${fw}px` } as CSSProperties} role="region" aria-label="Directives, one by one">
      <style>{`
        .rd-stage { position: relative; overflow: hidden; width: 100%; height: clamp(470px, calc(100dvh - 232px), 800px); }
        .rd-next { transition: left 320ms cubic-bezier(0.22,1,0.36,1), height 320ms cubic-bezier(0.22,1,0.36,1), top 320ms cubic-bezier(0.22,1,0.36,1), width 320ms cubic-bezier(0.22,1,0.36,1); animation: rd-in 280ms cubic-bezier(0.22,1,0.36,1) backwards; }
        .rd-front { animation: rd-front 260ms cubic-bezier(0.22,1,0.36,1) backwards; }
        .rd-scroll { scrollbar-width: thin; }
        .rd-fade { -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%); mask-image: linear-gradient(180deg, #000 55%, transparent 100%); }
        @keyframes rd-front { from { opacity: 0.4; transform: translateX(26px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes rd-in { from { opacity: 0; } }
        @media (max-width: 899px) { .rd-stage { height: clamp(470px, calc(100dvh - 260px), 800px); } }
        @media (prefers-reduced-motion: reduce) { .rd-next, .rd-front { animation: none; transition: none; } }
      `}</style>
      <FrontCard
        key={front.id} d={front} names={names} lane={lane} now={now} all={all} index={at} total={total}
        onPrev={() => move(-1)} onNext={() => move(1)} onRespond={() => onOpen(front)} onChanged={onChanged}
      />
      {stack.map((d, i) => (
        <NextCard key={d.id} d={d} k={i + 1} fw={fw} names={names} lane={lane} now={now} onPick={() => onFocus(d.id)} />
      ))}
    </div>
  );
}
