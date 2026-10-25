'use client';
// Gavelling Crisis: one directive as a queue row. The author's round picture overhangs the row's
// left corner (CLAUDE.md §8 rule 19), the cabinet colour rings it, and the wait carries its
// severity colour. Used by the backroom inbox and the "Waiting for a Reply" card on Command.

import { Clock, MessageCircle, UserRound } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { CK, OverhangCard, ThemeTag } from '../../crisisKit';
import { KIND_ICON, authorName, memberName, type Names } from './directiveKit';

export const WAIT_COLOR = { ok: CK.ink, late: CK.goldDeep, very: CK.danger } as const;

export default function QueueRow({ d, names, whenLabel, sev, selected, delegateNote, onOpen }: {
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
}) {
  const cab = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const ch = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const who = authorName(d, names);
  const color = cab?.color ?? CK.red;
  const KindIcon = KIND_ICON[d.kind];
  const waitColor = sev ? WAIT_COLOR[sev] : CK.inkSoft;
  return (
    <OverhangCard
      name={who}
      src={ch?.picture_url}
      color={color}
      size={40}
      onClick={onOpen}
      style={{
        borderRadius: 16, padding: '9px 12px 9px 46px',
        boxShadow: selected ? `${CK.shadowSm}, 0 0 0 2px ${color}` : sev === 'very' ? `${CK.shadowSm}, 0 0 0 1px rgba(163,65,47,0.45)` : CK.shadowSm,
      }}
    >
      <span className="flex items-start justify-between" style={{ gap: 10 }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>
            <span style={{ color }}>{cab?.name ?? 'No cabinet'}</span>
            <span style={{ color: CK.inkSoft, fontWeight: 600 }}> · {who}</span>
          </span>
          <span className="flex items-start" style={{ gap: 5, marginTop: 2, fontSize: 13.5, fontWeight: 700, overflowWrap: 'anywhere' }}>
            <KindIcon size={14} strokeWidth={1.5} aria-label={d.kind} style={{ flex: 'none', marginTop: 2, color: CK.red }} />
            <span><span style={{ color: CK.muted, fontWeight: 600 }}>No. {d.no} </span>{d.title}</span>
          </span>
        </span>
        <span className="inline-flex items-center" style={{ gap: 4, flex: 'none', fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: waitColor, whiteSpace: 'nowrap' }}>
          <Clock size={13} strokeWidth={1.6} aria-hidden />{whenLabel}
        </span>
      </span>
      <span className="flex items-center flex-wrap" style={{ gap: '4px 8px', marginTop: 6 }}>
        {d.themes[0] && <ThemeTag theme={d.themes[0]} />}
        <span className="inline-flex items-center" style={{ gap: 4, fontSize: 11.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
          <UserRound size={12} strokeWidth={1.5} aria-hidden />{memberName(d.assigned_member_id, names, 'Unclaimed')}
        </span>
        {delegateNote && <MessageCircle size={13} strokeWidth={1.5} aria-label="The delegate sent a note" style={{ color: '#3E6A9A' }} />}
      </span>
    </OverhangCard>
  );
}
