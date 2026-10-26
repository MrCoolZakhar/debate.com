'use client';
// Gavelling Crisis: one directive as a queue row (the one shared look for every directive row).
// The TITLE comes first and is the biggest text on the card; it wraps and is never cut. The number
// ("No. 13") is a small badge overlapping the top edge. The character is on the left: the portrait
// overhangs the top corner (one third outside, as on the organiser Live Status card) with the name
// beneath it in two rows (surname big, full name small). Everything else sits small at the bottom
// right: wait time, cabinet logo, theme, kind, backroomer. Clicking the portrait opens the character.
// Used by the backroom inbox and the "Waiting for a Reply" card on Command.

import { useState } from 'react';
import { Clock, MessageCircle } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { dirNumber } from '@/lib/crisis/format';
import { Avatar, CK, ThemeTag } from '../../crisisKit';
import CharacterModal from '../character/CharacterModal';
import { CabinetLogo, NameStack, NumberBadge, StaffPic } from './directiveParts';
import { KIND_ICON, authorName, type Names } from './directiveKit';

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
  const [characterOpen, setCharacterOpen] = useState(false);
  const cab = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const ch = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const who = authorName(d, names);
  const color = cab?.color ?? CK.red;
  const KindIcon = KIND_ICON[d.kind];
  const waitColor = sev ? WAIT_COLOR[sev] : CK.inkSoft;
  const responsible = (d.assigned_member_id ?? ch?.owner_member_id ?? null);
  const backroomer = responsible ? names.members.get(responsible) : undefined;

  const P = compact ? 36 : 52;              // portrait
  const O = Math.round(P / 3);              // overhang
  const COL = compact ? 80 : 90;            // the fixed character column
  const titleSize = compact ? 16 : 18;
  const shadow = selected ? `${CK.shadowSm}, 0 0 0 2px ${color}` : sev === 'very' ? `${CK.shadowSm}, 0 0 0 1px rgba(163,65,47,0.45)` : CK.shadowSm;

  return (
    <div
      style={{
        position: 'relative', overflow: 'visible', background: CK.card, borderRadius: compact ? 14 : 18, border: '1px solid rgba(27,56,40,0.14)', minWidth: 0,
        marginTop: Math.max(O, 9) + 6, boxShadow: shadow,
      }}
    >
      {/* Portrait: its own button, a sibling of the row button (a button never holds a button) */}
      {ch ? (
        <button
          type="button"
          onClick={() => setCharacterOpen(true)}
          aria-label={`Open ${who}`}
          title={`Open ${who}`}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform hover:scale-105"
          style={{ position: 'absolute', zIndex: 2, top: -O, left: Math.round((COL - P) / 2), border: 0, padding: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', lineHeight: 0 }}
        >
          <Avatar name={who} src={ch.picture_url} size={P} color={color} />
        </button>
      ) : (
        <span style={{ position: 'absolute', zIndex: 2, top: -O, left: Math.round((COL - P) / 2), lineHeight: 0 }}>
          <Avatar name={who} size={P} color={color} />
        </span>
      )}

      <NumberBadge n={dirNumber(d)} color={color} style={{ position: 'absolute', zIndex: 2, top: -9, left: COL + 2 }} />

      <button
        type="button"
        onClick={onOpen}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform active:scale-[0.99]"
        style={{
          display: 'flex', alignItems: 'stretch', width: '100%', textAlign: 'left', border: 0, background: 'transparent', borderRadius: 'inherit', cursor: 'pointer',
          fontFamily: CK.font, color: CK.ink, padding: 0,
        }}
      >
        <span style={{ display: 'block', flex: 'none', width: COL, boxSizing: 'border-box', padding: `${P - O + 6}px 6px 8px`, minWidth: 0 }}>
          <NameStack name={who} big={compact ? 12 : 12.5} />
        </span>

        <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, padding: `${compact ? 14 : 16}px 12px 8px 2px` }}>
          <span style={{ display: 'block', fontSize: titleSize, fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{d.title}</span>
          <span className="flex flex-wrap items-center justify-end" style={{ gap: '4px 9px', marginTop: 'auto', paddingTop: 8 }}>
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
      </button>

      {characterOpen && ch && <CharacterModal characterId={ch.id} initialTab="directives" onClose={() => setCharacterOpen(false)} />}
    </div>
  );
}
