'use client';
// Gavelling Crisis: one directive as a queue row (the one shared look for every directive row).
// The TITLE comes first, runs the full width of the card and is the biggest text on it; it wraps and is
// never cut. The number ("No. 13") is a small badge overlapping the top edge. Under the title: the
// character on the left (round portrait, surname in bold, the character's title beneath it), and on the
// right, small: theme, kind, cabinet logo, wait time, backroomer. Clicking the portrait opens the character.
// Used by the backroom inbox and the "Waiting for a Reply" card on Command.

import { Clock, MessageCircle, Pencil } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { dirNumber } from '@/lib/crisis/format';
import { Avatar, CK, ThemeTag } from '../../crisisKit';
import { CharacterLink, CharacterName } from '../character/CharacterProfileHost';
import { seatFitFontPx } from '@/lib/seatName';
import { CabinetLogo, NumberBadge, shortName, StaffPic } from './directiveParts';
import { KIND_ICON, authorName, writerOf, type Names } from './directiveKit';
import { useNow } from './useNow';

export const WAIT_COLOR = { ok: CK.ink, late: CK.goldDeep, very: CK.danger } as const;

export default function QueueRow({ d, names, whenLabel, sev, selected, delegateNote, onOpen, compact }: {
  d: Directive;
  names: Names;
  /** "14 min", "Answered 3 min ago". */
  whenLabel: string;
  /** Severity of the wait; null for answered and waiting-for-delegate rows. */
  sev: 'ok' | 'late' | 'very' | null;
  selected?: boolean;
  /** The delegate wrote back after a request for detail. */
  delegateNote?: boolean;
  onOpen: () => void;
  /** Command's one-screen card: smaller portrait and title, no backroomer name. */
  compact?: boolean;
}) {
  const now = useNow(60_000);
  const writer = writerOf(d, names, now);
  const cab = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const ch = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const who = authorName(d, names);
  const color = cab?.color ?? CK.red;
  const KindIcon = KIND_ICON[d.kind];
  const waitColor = sev ? WAIT_COLOR[sev] : CK.inkSoft;
  const responsible = (d.assigned_member_id ?? ch?.owner_member_id ?? null);
  const backroomer = responsible ? names.members.get(responsible) : undefined;

  const P = compact ? 30 : 42;              // portrait, inside the row (it no longer hangs over the top corner)
  const titleSize = compact ? 15 : 18;
  const short = shortName(who);
  const nameWidth = compact ? 120 : 160;
  const bigPx = seatFitFontPx(short, nameWidth, compact ? 13 : 14.5, { lines: 1, minPx: 10 });
  const under = ch?.title?.trim() || (short !== who.trim() ? who : '');
  const shadow = selected ? `${CK.shadowSm}, 0 0 0 2px ${color}` : sev === 'very' ? `${CK.shadowSm}, 0 0 0 1px rgba(163,65,47,0.45)` : CK.shadowSm;

  const portrait = <Avatar name={who} src={ch?.picture_url} size={P} color={color} />;

  return (
    <div
      style={{
        position: 'relative', overflow: 'visible', background: CK.card, borderRadius: compact ? 14 : 18, border: '1px solid rgba(27,56,40,0.14)', minWidth: 0,
        marginTop: 14, boxShadow: shadow,
      }}
    >
      <NumberBadge n={dirNumber(d)} color={color} style={{ position: 'absolute', zIndex: 2, top: -9, left: 12 }} />

      {/* The whole card opens the directive: one button laid over the content; the portrait is a second button above it. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open directive No. ${dirNumber(d)}: ${d.title}`}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform active:scale-[0.99]"
        style={{ position: 'absolute', inset: 0, zIndex: 1, width: '100%', border: 0, background: 'transparent', borderRadius: 'inherit', cursor: 'pointer', padding: 0 }}
      />

      <div style={{ position: 'relative', fontFamily: CK.font, color: CK.ink, padding: compact ? '14px 12px 9px' : '16px 14px 11px', pointerEvents: 'none' }}>
        {/* The title runs the whole width of the card. */}
        <span style={{ display: 'block', fontSize: titleSize, fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{d.title}</span>

        {/* Under it: the character (portrait, surname, title) on the left; wait, theme and backroomer small on the right. */}
        <span className="flex flex-wrap items-center" style={{ gap: '6px 10px', marginTop: compact ? 8 : 10 }}>
          <span className="flex items-center" style={{ gap: 8, flex: '1 1 130px', minWidth: 0 }}>
            {/* The portrait: its own button above the card's open button. */}
            <span style={{ flex: 'none', lineHeight: 0, position: 'relative', zIndex: 2, pointerEvents: 'auto' }}>
              <CharacterLink id={ch?.id} style={{ borderRadius: '50%', lineHeight: 0 }}>{portrait}</CharacterLink>
            </span>
            <span style={{ display: 'block', minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: bigPx, fontWeight: 800, lineHeight: 1.2, color: CK.ink, overflowWrap: 'normal', wordBreak: 'normal' }}>
                {ch ? <span style={{ position: 'relative', zIndex: 2, pointerEvents: 'auto' }}><CharacterName id={ch.id}>{short}</CharacterName></span> : short}
              </span>
              {under && <span style={{ display: 'block', marginTop: 1, fontSize: compact ? 11 : 11.5, fontWeight: 600, lineHeight: 1.25, color: CK.muted, overflowWrap: 'anywhere' }}>{under}</span>}
            </span>
          </span>
          <span className="flex flex-wrap items-center justify-end" style={{ gap: '4px 8px', marginLeft: 'auto' }}>
            {delegateNote && <MessageCircle size={14} strokeWidth={1.5} aria-label="The delegate sent a note" style={{ color: '#3E6A9A' }} />}
            {d.themes[0] && <ThemeTag theme={d.themes[0]} />}
            <KindIcon size={14} strokeWidth={1.5} aria-label={d.kind} style={{ flex: 'none', color: CK.red }} />
            <CabinetLogo cabinet={cab} size={compact ? 16 : 18} />
            <span className="inline-flex items-center" style={{ gap: 3, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: waitColor, flex: 'none' }}>
              <Clock size={12} strokeWidth={1.6} aria-hidden />{whenLabel}
            </span>
            {!compact && (
              <span title="Responsible backroomer" style={{ fontSize: 11.5, fontWeight: 700, color: backroomer ? CK.inkSoft : CK.muted, overflowWrap: 'anywhere' }}>
                {backroomer ? backroomer.display_name : 'Unclaimed'}
              </span>
            )}
            <StaffPic member={backroomer} size={compact ? 20 : 24} />
          </span>
        </span>
        {writer && (
          <span className="flex items-center" style={{ gap: 6, marginTop: compact ? 7 : 9, fontSize: compact ? 11.5 : 12, fontWeight: 800, color: CK.goldDeep, lineHeight: 1.25 }}>
            <StaffPic member={writer} size={compact ? 16 : 18} />
            <Pencil size={12} strokeWidth={1.6} aria-hidden style={{ flex: 'none' }} />
            <span style={{ overflowWrap: 'anywhere' }}>Being written by {writer.display_name}</span>
          </span>
        )}
      </div>

    </div>
  );
}
