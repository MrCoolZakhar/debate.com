'use client';
// Gavelling Crisis: one directive as a queue row. WHO wrote it comes first: the character's name big,
// their title under it, the cabinet logo beside the cabinet name, and the portrait overhanging the
// top corner exactly like the organiser Live Status emblem (one third outside, never clipped).
// The responsible backroomer's picture overhangs the bottom edge at the right, with their name.
// Clicking the portrait opens the character (their directives, performance and points).
// Used by the backroom inbox and the "Waiting for a Reply" card on Command.

import { useState } from 'react';
import { Clock, MessageCircle } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { dirNumber } from '@/lib/crisis/format';
import { Avatar, CK, ThemeTag } from '../../crisisKit';
import CharacterModal from '../character/CharacterModal';
import { CabinetLogo, StaffPic } from './directiveParts';
import { KIND_ICON, authorName, type Names } from './directiveKit';

export const WAIT_COLOR = { ok: CK.ink, late: CK.goldDeep, very: CK.danger } as const;

const PORTRAIT = 52;
const OVERHANG = Math.round(PORTRAIT / 3);
const BACKROOMER_PIC = 30;

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
  /** Command's one-screen card: two lines, small portrait, backroomer inline. */
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

  if (compact) {
    const P = 34; const O = Math.round(P / 3);
    return (
      <div style={{ position: 'relative', overflow: 'visible', marginTop: O + 4, background: CK.card, borderRadius: 14, border: '1px solid rgba(27,56,40,0.12)', boxShadow: sev === 'very' ? `${CK.shadowSm}, 0 0 0 1px rgba(163,65,47,0.45)` : CK.shadowSm }}>
        <button type="button" onClick={() => ch && setCharacterOpen(true)} aria-label={`Open ${who}`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ position: 'absolute', zIndex: 2, top: -O, left: O, border: 0, padding: 0, borderRadius: '50%', background: 'transparent', cursor: ch ? 'pointer' : 'default', lineHeight: 0 }}>
          <Avatar name={who} src={ch?.picture_url} size={P} color={color} />
        </button>
        <button type="button" onClick={onOpen} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.99]"
          style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', borderRadius: 'inherit', cursor: 'pointer', fontFamily: CK.font, color: CK.ink, padding: `7px 10px 7px ${O + P + 10}px` }}>
          <span className="flex items-center" style={{ gap: 8 }}>
            <b style={{ fontSize: 13.5, fontWeight: 800, overflowWrap: 'break-word', minWidth: 0, flex: '1 1 auto' }}>{who}</b>
            <CabinetLogo cabinet={cab} size={14} />
            <span className="inline-flex items-center" style={{ gap: 3, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: waitColor, flex: 'none' }}>
              <Clock size={12} strokeWidth={1.6} aria-hidden />{whenLabel}
            </span>
            <StaffPic member={backroomer} size={20} />
          </span>
          <span title={d.title} style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            No. {dirNumber(d)} {d.title}
          </span>
        </button>
        {characterOpen && ch && <CharacterModal characterId={ch.id} initialTab="directives" onClose={() => setCharacterOpen(false)} />}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative', overflow: 'visible', background: CK.card, borderRadius: 18, border: '1px solid rgba(27,56,40,0.14)', minWidth: 0,
        marginTop: OVERHANG + 6, marginBottom: BACKROOMER_PIC / 2,
        boxShadow: selected ? `${CK.shadowSm}, 0 0 0 2px ${color}` : sev === 'very' ? `${CK.shadowSm}, 0 0 0 1px rgba(163,65,47,0.45)` : CK.shadowSm,
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
          style={{ position: 'absolute', zIndex: 2, top: -OVERHANG, left: OVERHANG, border: 0, padding: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', lineHeight: 0 }}
        >
          <Avatar name={who} src={ch.picture_url} size={PORTRAIT} color={color} />
        </button>
      ) : (
        <span style={{ position: 'absolute', zIndex: 2, top: -OVERHANG, left: OVERHANG, lineHeight: 0 }}>
          <Avatar name={who} size={PORTRAIT} color={color} />
        </span>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform active:scale-[0.99]"
        style={{
          display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', borderRadius: 'inherit', cursor: 'pointer',
          fontFamily: CK.font, color: CK.ink, padding: `10px 14px 6px ${OVERHANG + PORTRAIT + 12}px`,
        }}
      >
        <span className="flex flex-wrap items-start" style={{ gap: '2px 10px' }}>
          <span style={{ display: 'block', flex: '1 1 150px', minWidth: 'min(150px, 100%)' }}>
            <span style={{ display: 'block', fontSize: 16.5, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'break-word' }}>{who}</span>
            {ch?.title && <span style={{ display: 'block', marginTop: 1, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, lineHeight: 1.3, overflowWrap: 'break-word' }}>{ch.title}</span>}
            <span className="flex items-center" style={{ gap: 6, marginTop: 4 }}>
              <CabinetLogo cabinet={cab} size={18} />
              <span style={{ fontSize: 12, fontWeight: 700, color, overflowWrap: 'break-word', minWidth: 0 }}>{cab?.name ?? 'No cabinet'}</span>
            </span>
          </span>
          <span className="inline-flex items-center" style={{ gap: 4, flex: '0 0 auto', fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: waitColor }}>
            <Clock size={13} strokeWidth={1.6} aria-hidden />{whenLabel}
          </span>
        </span>

        <span className="flex items-start" style={{ gap: 6, marginTop: 8, fontSize: 13.5, fontWeight: 700, lineHeight: 1.35, overflowWrap: 'break-word' }}>
          <KindIcon size={15} strokeWidth={1.5} aria-label={d.kind} style={{ flex: 'none', marginTop: 2, color: CK.red }} />
          <span style={{ minWidth: 0 }}><span style={{ color: CK.muted, fontWeight: 600 }}>No. {dirNumber(d)} </span>{d.title}</span>
        </span>

        <span className="flex flex-wrap items-center" style={{ gap: '4px 8px', marginTop: 6 }}>
          {d.themes[0] && <ThemeTag theme={d.themes[0]} />}
          {delegateNote && <MessageCircle size={14} strokeWidth={1.5} aria-label="The delegate sent a note" style={{ color: '#3E6A9A' }} />}
        </span>

        {/* The backroomer's name; their picture hangs over the bottom edge beside it */}
        <span
          title="Responsible backroomer"
          style={{ display: 'block', minHeight: 20, marginTop: 4, paddingRight: BACKROOMER_PIC + 2, textAlign: 'right', fontSize: 12, fontWeight: 700, lineHeight: '20px', color: backroomer ? CK.inkSoft : CK.muted, overflowWrap: 'break-word' }}
        >
          {backroomer ? backroomer.display_name : 'Unclaimed'}
        </span>
      </button>

      <span aria-hidden title="Responsible backroomer" style={{ position: 'absolute', zIndex: 2, right: 12, bottom: -4, lineHeight: 0 }}>
        <StaffPic member={backroomer} size={BACKROOMER_PIC} />
      </span>

      {characterOpen && ch && <CharacterModal characterId={ch.id} initialTab="directives" onClose={() => setCharacterOpen(false)} />}
    </div>
  );
}
