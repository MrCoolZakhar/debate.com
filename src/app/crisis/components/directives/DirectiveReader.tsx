'use client';
// Gavelling Crisis: the backroom's "to reply" items, read ONE BY ONE. The item in front is large (the "No. 13"
// badge overlapping its top edge, the TITLE first, the character beneath it, then the text), and the next
// items of the lane wait to the right as smaller copies of it (same layout, each shorter and narrower, centred
// on the front card), every one BEHIND the one before it and peeking out on its right edge, so together they fill the
// space out to the page's right edge. A card's content sits in the part that peeks out, so no title is ever covered.
// Clicking one brings it to the front; pressing the front directive, its Respond button or Enter opens the directive
// pop-up to answer it. The left and right arrow keys move along. The lane and the filters above decide which
// items are in the stack, in queue order. An item is a directive, or (backroom only) a meeting request or a delegate who
// needs a new character: those are decided in place on their card (InboxExtraCards). A CABINET directive wears design B
// (cabinetStamp.tsx): framed in its cabinet's colour, the seal and name first, the big
// CABINET stamp poking out of its top right corner (the sender is not on the card). Presentation and choices only: nothing here writes. With `readOnly`
// (the chair's Directives page) the same reader shows each directive's state and its button only opens the directive.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Clock, Eye, MessageCircle, Pencil, Reply } from 'lucide-react';
import { dirNumber } from '@/lib/crisis/format';
import { KIND_LABEL, type Directive } from '@/lib/crisis/types';
import { Avatar, Btn, CK, agoLabel, cabinetTint, waitLabel, waitSeverity } from '../../crisisKit';
import { CharacterLink } from '../character/CharacterProfileHost';
import { CabinetLogo, NameStack, NumberBadge, StaffPic, ThemeTags, shortName } from './directiveParts';
import { KIND_ICON, authorName, isBeingWritten, isOpenStatus, memberName, outcomeView, writingAge, writtenByOther, type Lane, type Names } from './directiveKit';
import { CabinetCrest, CabinetFoot, CabinetName, cabinetColorOf, cabinetWash, crestIndent, isCabinetDirective } from './cabinetStamp';
import { ExtraFront, ExtraNextBody, MEETING_BLUE, MeetingBadge } from './InboxExtraCards';
import { isExtra, type ReaderItem } from './inboxItems';
import { FrontShell, HIDDEN, MAX_STACK, NavControls, NextShell, ResponsibleFoot, STRIP } from './readerParts';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { DirectiveBody, plainText } from './attachedImage';

/** What the chair's page tells the reader: how to say a directive's state, and what its button says. */
export interface ReaderReadOnly {
  stateOf: (d: Directive) => { word: string; color: string; icon: ReactNode };
  actionLabel: (d: Directive) => string;
  /** When it was sent or answered, in the chair's words (the backroom's wait clock means nothing to a chair). */
  when: (d: Directive, now: number) => string;
}

const WAIT_COLOR = { ok: CK.ink, late: CK.goldDeep, very: CK.danger } as const;

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
function whenOf(d: Directive, lane: Lane, now: number, readOnly?: ReaderReadOnly): { text: string; sev: 'ok' | 'late' | 'very' | null } {
  if (readOnly) return { text: readOnly.when(d, now), sev: null };
  if (lane === 'answered') return { text: `Answered ${agoLabel(d.answered_at, now)}`, sev: null };
  if (lane === 'waiting') return { text: `Asked ${agoLabel(d.answered_at, now)}`, sev: null };
  return { text: waitLabel(d.waiting_since, now), sev: waitSeverity(d.waiting_since, now) };
}

function Writing({ d, names, now, small }: { d: Directive; names: Names; now: number; small?: boolean }) {
  if (!isBeingWritten(d, now) || !d.drafting_member) return null;
  const m = names.members.get(d.drafting_member);
  return (
    <span className="inline-flex items-center" style={{ gap: 6, fontSize: small ? 11.5 : 13, fontWeight: 800, color: CK.goldDeep, lineHeight: 1.25 }}>
      <StaffPic member={m ?? null} size={small ? 18 : 22} />
      <Pencil size={small ? 11 : 13} strokeWidth={1.6} aria-hidden style={{ flex: 'none' }} />
      <span style={{ overflowWrap: 'anywhere' }}>Being written by {m?.display_name ?? 'a teammate'}, {writingAge(d, now)}</span>
    </span>
  );
}

/**
 * A smaller copy of the front card, further back in the stack: badge, title, character, the start of the text.
 * A cabinet directive is framed in its cabinet's colour, wears its seal and number on its top border and has the small stamp inside, beside the name.
 */
function DirectiveNext({ d, k, fw, names, lane, now, onPick, readOnly, openCounts, onChanged }: { d: Directive; k: number; fw: number; names: Names; lane: Lane; now: number; onPick: () => void; readOnly?: ReaderReadOnly; openCounts: Map<string, number>; onChanged: () => void }) {
  const { memberId } = useCrisis();
  const grey = writtenByOther(d, memberId, now);
  const cab = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const ch = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const who = authorName(d, names);
  const isCab = isCabinetDirective(d);
  const color = cab?.color ?? CK.red;
  const when = whenOf(d, lane, now, readOnly);
  const KindIcon = KIND_ICON[d.kind];
  // The responsible backroomer on the card's bottom row (open directives: press it to hand the directive to someone else).
  const ownerId = ch?.owner_member_id ?? null;
  const showFoot = !readOnly && (isOpenStatus(d) || !!(d.assigned_member_id ?? ownerId));
  return (
    <NextShell
      k={k} fw={fw} grey={grey} ring={isCab} color={color} onPick={onPick}
      padBottom={showFoot ? 46 : 14}
      foot={showFoot ? <ResponsibleFoot d={d} ownerId={ownerId} openCounts={openCounts} onChanged={onChanged} /> : undefined}
      tint={isCab ? cabinetWash(color) : undefined}
      label={`Read directive No. ${dirNumber(d)}: ${d.title}`}
      badge={isCab
        ? <CabinetCrest cabinet={cab} n={dirNumber(d)} sealSize={40} left={HIDDEN + 14} stamp="xs" />
        : <NumberBadge n={dirNumber(d)} color={color} style={{ position: 'absolute', zIndex: 2, top: -9, left: HIDDEN + 14 }} />}
    >
      {isCab ? (
        <>
          {/* The name beside the seal, then the title, then the start of the text; the kind and the wait on the bottom row (no submitter on the card). */}
          <CabinetName cabinet={cab} size={13.5} indent={crestIndent(40)} style={{ flex: 'none' }} />
          <span style={{ display: 'block', flex: 'none', marginTop: 6, fontSize: 18, fontWeight: 800, lineHeight: 1.22, overflowWrap: 'anywhere' }}>{d.title}</span>
        </>
      ) : (
        <>
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
        </>
      )}
      {readOnly && (() => { const st = readOnly.stateOf(d); return (
        <span className="inline-flex items-center" style={{ flex: 'none', gap: 5, marginTop: 8, fontSize: 12, fontWeight: 800, color: st.color }}>{st.icon}{st.word}</span>
      ); })()}
      {isBeingWritten(d, now) && <span style={{ flex: 'none', marginTop: 8 }}><Writing d={d} names={names} now={now} small /></span>}
      {/* The start of the text, fading out where the card ends. */}
      <span className="rd-fade" style={{ display: 'block', flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 11, fontSize: 14, lineHeight: 1.55, fontWeight: 500, color: CK.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{plainText(d.body)}</span>
      {isCab && (
        <div style={{ flex: 'none' }}>
          <CabinetFoot marginTop={6}>
            <KindIcon size={14} strokeWidth={1.5} aria-label={KIND_LABEL[d.kind]} style={{ color: CK.red, flex: 'none' }} />
            <span className="inline-flex items-center" style={{ gap: 3, fontSize: 12, fontWeight: 800, color: when.sev ? WAIT_COLOR[when.sev] : CK.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
              <Clock size={12} strokeWidth={1.6} aria-hidden />{when.text}
            </span>
          </CabinetFoot>
        </div>
      )}
    </NextShell>
  );
}

function NextCard({ item, k, fw, names, lane, now, onPick, readOnly, openCounts, onChanged }: { item: ReaderItem; k: number; fw: number; names: Names; lane: Lane; now: number; onPick: () => void; readOnly?: ReaderReadOnly; openCounts: Map<string, number>; onChanged: () => void }) {
  if (!isExtra(item)) return <DirectiveNext d={item} k={k} fw={fw} names={names} lane={lane} now={now} onPick={onPick} readOnly={readOnly} openCounts={openCounts} onChanged={onChanged} />;
  const meeting = item.extra === 'meeting';
  const asking = meeting && item.m.status === 'awaiting_delegates';
  return (
    <NextShell
      k={k} fw={fw} color={meeting ? MEETING_BLUE : CK.danger} onPick={onPick}
      ring={meeting} tint={meeting ? cabinetWash(MEETING_BLUE) : undefined}
      badge={meeting ? <span style={{ position: 'absolute', zIndex: 2, top: -11, left: HIDDEN + 14 }}><MeetingBadge small grey={asking} /></span> : undefined}
      grey={asking}
      label={meeting ? 'Read this meeting request' : `Give ${item.member.display_name} a new character`}
    >
      <ExtraNextBody item={item} now={now} />
    </NextShell>
  );
}

/** The directive in front: large, with its text, a few facts and Respond. */
function FrontCard({ d, names, lane, now, index, total, onPrev, onNext, onRespond, onTakeOver, readOnly, openCounts, onChanged }: {
  d: Directive; names: Names; lane: Lane; now: number; index: number; total: number;
  onPrev: () => void; onNext: () => void; onRespond: () => void; onTakeOver: () => void; readOnly?: ReaderReadOnly;
  openCounts: Map<string, number>; onChanged: () => void;
}) {
  const { memberId } = useCrisis();
  const takeable = !readOnly && writtenByOther(d, memberId, now) && (d.status === 'queued' || d.status === 'claimed');
  const state = readOnly ? readOnly.stateOf(d) : null;
  const cab = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const ch = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const who = authorName(d, names);
  const isCab = isCabinetDirective(d);
  const color = isCab ? cabinetColorOf(cab) : cab?.color ?? CK.red;
  const KindIcon = KIND_ICON[d.kind];
  const when = whenOf(d, lane, now, readOnly);
  const open = d.status === 'queued' || d.status === 'claimed';
  const isOpen = isOpenStatus(d);
  const outcome = outcomeView(d);
  const responsible = d.assigned_member_id ?? ch?.owner_member_id ?? null;

  const facts: ReactNode[] = [];
  facts.push(<span key="w">{d.word_count} words</span>);
  if (d.receiver?.trim()) facts.push(<span key="t">To {d.receiver}</span>);
  if (d.covert) facts.push(<span key="c" style={{ color: CK.redDeep }}>Covert</span>);
  // The backroom sees the responsible person on the card's bottom row (and can change it there); the chair's read-only reader keeps the sentence.
  if (!isCab && readOnly) facts.push(<span key="r">{responsible ? `Responsible for this directive: ${memberName(responsible, names)}` : 'Nobody responsible for this directive yet'}</span>);

  const waitClock = (
    <span className="inline-flex items-center" style={{ gap: 4, fontSize: 13, fontWeight: 800, color: when.sev ? WAIT_COLOR[when.sev] : CK.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
      <Clock size={14} strokeWidth={1.6} aria-hidden />{when.text}
    </span>
  );

  return (
    <FrontShell color={color} ring={isCab} tint={isCab ? cabinetWash(color) : undefined} label={`Directive No. ${dirNumber(d)}: ${d.title}`} onActivate={onRespond}>
      {isCab && <CabinetCrest cabinet={cab} n={dirNumber(d)} sealSize={56} left={30} stamp="card" />}
      {!isCab && <NumberBadge n={dirNumber(d)} color={color} style={{ position: 'absolute', zIndex: 2, top: -9, left: 26 }} />}

      <div style={{ flex: 'none', padding: isCab ? '30px 26px 0 30px' : '24px 26px 0 30px' }}>
        {isCab ? (
          <>
            <CabinetName cabinet={cab} size={15.5} indent={crestIndent(56)} />
            <h2 style={{ margin: '12px 0 0', fontSize: 30, lineHeight: 1.18, fontWeight: 800, overflowWrap: 'anywhere' }}>{d.title}</h2>
          </>
        ) : (
          <>
            <p className="flex items-center flex-wrap" style={{ margin: 0, gap: '4px 12px', fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>
              <span className="inline-flex items-center" style={{ gap: 6 }}><KindIcon size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />{KIND_LABEL[d.kind]}</span>
              <ThemeTags themes={d.themes} />
              <span className="flex-1" />
              {waitClock}
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
          </>
        )}
        <div className="flex items-center flex-wrap" style={{ marginTop: 8, gap: '4px 12px' }}>
          <Writing d={d} names={names} now={now} />
          {takeable && (
            <Btn tone="ghost" size="sm" onClick={onTakeOver}>Take over</Btn>
          )}
        </div>
      </div>

      {/* The text of the directive (scrolls when it is long), then the answer when there is one. */}
      <div className="rd-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 26px 12px 30px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <DirectiveBody body={d.body} thumb={300} asSpan style={{ margin: 0, fontSize: 16.5, lineHeight: 1.65, fontWeight: 500, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />
        {d.reply && (
          <div style={{ background: outcome ? cabinetTint(outcome.color, 0.09) : CK.well, borderRadius: 16, padding: '11px 14px', boxShadow: outcome ? `inset 0 0 0 1px ${cabinetTint(outcome.color, 0.28)}` : 'none' }}>
            <p className="flex items-center" style={{ margin: 0, gap: 6, fontSize: 12.5, fontWeight: 800, color: outcome?.color ?? CK.inkSoft }}>
              {outcome ? <outcome.Icon size={15} strokeWidth={1.6} aria-hidden /> : <MessageCircle size={15} strokeWidth={1.6} aria-hidden />}
              {outcome ? outcome.word : 'Reply'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.reply}</p>
          </div>
        )}
        <p className="flex flex-wrap items-center" style={{ margin: 'auto 0 0', gap: '2px 14px', fontSize: 12.5, fontWeight: 700, color: CK.muted }}>
          {facts.map((f, i) => <span key={i}>{f}</span>)}
        </p>
      </div>

      {/* The footer: the state (chair's reader) on the left; the arrows, "3 of 12" and Respond on the right. Who looks after a character is
          changed on the character's own page, never here. */}
      <div className="flex items-center flex-wrap" data-no-open style={{ flex: 'none', gap: '8px 16px', padding: '12px 20px 14px 30px', boxShadow: `0 -1px 0 ${CK.hair}`, borderRadius: '0 0 24px 24px', background: isCab ? 'transparent' : CK.card }}>
        <div className="flex flex-col" style={{ flex: '1 1 260px', minWidth: 0, gap: 8, alignItems: 'flex-start' }}>
          {!readOnly && (isOpen || !!responsible) && <ResponsibleFoot d={d} ownerId={ch?.owner_member_id ?? null} openCounts={openCounts} onChanged={onChanged} />}
          {isCab ? (
            <>
              {/* The kind, themes, wait and state (no submitter on the card). */}
              <div className="flex items-center flex-wrap" style={{ gap: '4px 14px', fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>
                <span className="inline-flex items-center" style={{ gap: 6 }}><KindIcon size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />{KIND_LABEL[d.kind]}</span>
                <ThemeTags themes={d.themes} />
                {waitClock}
                {state && <span className="inline-flex items-center" style={{ gap: 7, fontSize: 14, fontWeight: 800, color: state.color, overflowWrap: 'anywhere' }}>{state.icon}{state.word}</span>}
              </div>
            </>
          ) : (
            state && <span className="inline-flex items-center" style={{ gap: 7, fontSize: 15, fontWeight: 800, color: state.color, overflowWrap: 'anywhere' }}>{state.icon}{state.word}</span>
          )}
        </div>
        <NavControls index={index} total={total} onPrev={onPrev} onNext={onNext} />
        <Btn tone="green" icon={readOnly ? <Eye size={16} strokeWidth={1.5} /> : <Reply size={16} strokeWidth={1.5} />} onClick={onRespond}>{readOnly ? readOnly.actionLabel(d) : open ? 'Respond' : 'Open'}</Btn>
      </div>
    </FrontShell>
  );
}

const NO_COUNTS = new Map<string, number>();

export default function DirectiveReader({ queue, focusId, onFocus, onOpen, onTakeOver, active, names, lane, now, onChanged, readOnly, openCounts = NO_COUNTS }: {
  /** The lane, filtered and in queue order: directives, and in the backroom also meeting requests and characters to replace. */
  queue: ReaderItem[];
  focusId: string | null;
  onFocus: (id: string) => void;
  /** Open the directive pop-up on this directive. */
  onOpen: (d: Directive) => void;
  /** "Take over" on a directive a teammate was writing: moves the mark to you (markDrafting), then opens it. */
  onTakeOver: (d: Directive) => void;
  /** False while the pop-up is open, so the keys belong to it. */
  active: boolean;
  names: Names;
  lane: Lane;
  now: number;
  /** Something an extra card decided (a meeting answered, a character given): the caller re-reads. */
  onChanged: () => void;
  /** The chair's read-only reader: states instead of the backroomer picker, no "Take over". */
  readOnly?: ReaderReadOnly;
  /** How many open directives each staff member has (the list that hands a directive to someone else shows it). */
  openCounts?: Map<string, number>;
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
  useEffect(() => { moveRef.current = move; openRef.current = () => { if (front && !isExtra(front)) onOpen(front); }; });

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (typingTarget(e.target) || document.querySelector('[data-gsel-popover], [data-crisis-popover], [data-image-lightbox]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); moveRef.current(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveRef.current(-1); }
      else if (e.key === 'Enter' && !(e.target as HTMLElement | null)?.closest?.('button, a, [role="combobox"], [role="button"]')) { e.preventDefault(); openRef.current(); }
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
  const stackFit = stackLayout(stageW, upcoming);
  const n = stackFit.n;
  const fw = stackFit.fw;
  const stack = useMemo(() => queue.slice(at + 1, at + 1 + n), [queue, at, n]);
  if (!front) return null;

  return (
    <div ref={stage} className="rd-stage" style={{ ['--fw' as string]: `${fw}px` } as CSSProperties} role="region" aria-label="To reply, one by one">
      <style>{`
        .rd-stage { position: relative; z-index: 0; isolation: isolate; overflow-x: clip; overflow-y: visible; width: 100%; height: clamp(470px, calc(100dvh - 232px), 800px); }
        .rd-next { transition: left 320ms cubic-bezier(0.22,1,0.36,1), height 320ms cubic-bezier(0.22,1,0.36,1), top 320ms cubic-bezier(0.22,1,0.36,1), width 320ms cubic-bezier(0.22,1,0.36,1); animation: rd-in 280ms cubic-bezier(0.22,1,0.36,1) backwards; }
        .rd-front { animation: rd-front 260ms cubic-bezier(0.22,1,0.36,1) backwards; }
        .rd-scroll { scrollbar-width: thin; }
        .rd-fade { -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%); mask-image: linear-gradient(180deg, #000 55%, transparent 100%); }
        @keyframes rd-front { from { opacity: 0.4; transform: translateX(26px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes rd-in { from { opacity: 0; } }
        @media (max-width: 899px) { .rd-stage { height: clamp(470px, calc(100dvh - 260px), 800px); } }
        @media (prefers-reduced-motion: reduce) { .rd-next, .rd-front { animation: none; transition: none; } }
      `}</style>
      {isExtra(front) ? (
        <ExtraFront key={front.id} item={front} now={now} index={at} total={total} onPrev={() => move(-1)} onNext={() => move(1)} onChanged={onChanged} />
      ) : (
        <FrontCard
          key={front.id} d={front} names={names} lane={lane} now={now} index={at} total={total}
          onPrev={() => move(-1)} onNext={() => move(1)} onRespond={() => onOpen(front)} onTakeOver={() => onTakeOver(front)} readOnly={readOnly}
          openCounts={openCounts} onChanged={onChanged}
        />
      )}
      {stack.map((item, i) => (
        <NextCard key={item.id} item={item} k={i + 1} fw={fw} names={names} lane={lane} now={now} onPick={() => onFocus(item.id)} readOnly={readOnly} openCounts={openCounts} onChanged={onChanged} />
      ))}
    </div>
  );
}
