'use client';
// Gavelling Crisis: what the chair's directive screens share (Front Room "Waiting for You" card, the Directives tab and the
// decision pop-up in ChairDirectivePrompt.tsx): who wrote a directive, how its state reads to a chair, one compact row, and a
// tiny module-level store that asks the pop-up to open ONE given directive (even one closed on this device).
//   openChairDirective(d)  a waiting directive opens the decision card, any other opens the same card read only.

import { useSyncExternalStore, type ReactNode } from 'react';
import { ChevronRight, XCircle } from 'lucide-react';
import { OUTCOME_LABEL, type Cabinet, type Character, type Directive, type DirectiveStatus, type Member } from '@/lib/crisis/types';
import { dirNumber, isChairSendBack } from '@/lib/crisis/format';
import { Avatar, CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { outcomeColor, outcomeIcon, statusColor, statusIcon, whenLabel, whenTitle } from '../delegate/directiveUi';
import { NumberBadge, ThemeIcons } from '../directives/directiveParts';
import { CabinetHead, CabinetStamp, cabinetColorOf, cabinetRing, isCabinetDirective, stampRoom } from '../directives/cabinetStamp';

// ───────────── the store ─────────────

let requested: Directive | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => { listeners.forEach((f) => f()); };

/** Ask the chair pop-up to show this directive now. It still never opens over another dialog. */
export function openChairDirective(d: Directive): void { requested = d; emit(); }
export function closeChairDirective(): void { if (!requested) return; requested = null; emit(); }
export function useRequestedChairDirective(): Directive | null {
  return useSyncExternalStore(subscribe, () => requested, () => null);
}

// ───────────── who wrote it ─────────────

export interface DirectiveAuthor { name: string; picture_url: string | null; color: string }

/** The author's character (else their own name), with their cabinet's colour. */
export function directiveAuthor(d: Directive, characters: Character[], members: Member[], cabinets: Cabinet[]): DirectiveAuthor {
  const ch = d.author_character_id ? characters.find((c) => c.id === d.author_character_id) : undefined;
  const cab = cabinets.find((c) => c.id === (ch?.cabinet_id ?? d.cabinet_id));
  const color = cab?.color ?? CK.red;
  if (ch) return { name: ch.name, picture_url: ch.picture_url, color };
  const m = d.author_member_id ? members.find((x) => x.id === d.author_member_id) : undefined;
  return { name: m?.display_name ?? 'A delegate', picture_url: m?.picture_url ?? null, color };
}

// ───────────── how a chair reads the state ─────────────

export type ChairGroup = 'waiting' | 'changes' | 'backroom' | 'answered' | 'rejected' | 'withdrawn';

/** The chair's own five groups. A directive the chair turned back (answered with the chair's send-back reply) is Rejected. */
export function chairGroup(d: Pick<Directive, 'status' | 'reply' | 'outcome'>): ChairGroup {
  const s: DirectiveStatus = d.status;
  if (s === 'awaiting_chair') return 'waiting';
  if (s === 'changes_requested') return 'changes';
  if (s === 'queued' || s === 'claimed' || s === 'clarify') return 'backroom';
  if (s === 'rejected' || isChairSendBack(d)) return 'rejected';
  if (s === 'answered') return 'answered';
  return 'withdrawn';
}

export const GROUP_WORDS: Record<ChairGroup, string> = {
  waiting: 'Waiting for you', changes: 'Changes asked for', backroom: 'In the backroom', answered: 'Answered', rejected: 'Rejected', withdrawn: 'Withdrawn',
};

/** The state in the chair's words, colour and icon. */
export function chairVerdict(d: Pick<Directive, 'status' | 'reply' | 'outcome'>, size = 15): { word: string; color: string; icon: ReactNode } {
  const g = chairGroup(d);
  if (g === 'rejected') return { word: GROUP_WORDS.rejected, color: CK.danger, icon: <XCircle size={size} strokeWidth={1.5} aria-hidden /> };
  const word = d.status === 'clarify' ? 'More detail needed' : GROUP_WORDS[g];
  return { word, color: statusColor(d.status), icon: statusIcon(d.status, size) };
}

// ───────────── one compact row ─────────────

/** A directive as one compact row that opens the chair pop-up. `list` is a plain row between hairlines (small cards);
 *  `card` is its own white card with the state on top (the Directives tab). */
export function ChairDirectiveRow({ d, variant = 'list', muted = false }: { d: Directive; variant?: 'list' | 'card'; muted?: boolean }) {
  const { core } = useCrisis();
  const a = directiveAuthor(d, core.characters, core.members, core.cabinets);
  const v = chairVerdict(d);
  const card = variant === 'card';
  const outcome = card && d.status === 'answered' && d.outcome && !isChairSendBack(d) ? d.outcome : null;
  const themes = card ? d.themes ?? [] : [];
  const cabinet = d.cabinet_id ? core.cabinets.find((c) => c.id === d.cabinet_id) ?? null : null;

  // A cabinet directive (design B, owner 1 Nov 2026): its own framed card in the cabinet's colour, the seal and name first, the title
  // big, the sender only as a small muted line, and the CABINET stamp poking out of the top right edge.
  if (isCabinetDirective(d)) {
    const color = cabinetColorOf(cabinet);
    const room = stampRoom('row');
    return (
      <button
        type="button"
        onClick={() => openChairDirective(d)}
        aria-label={`${d.title}, cabinet directive, ${v.word}, from ${a.name}`}
        className="cm-lift block text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{
          position: 'relative', overflow: 'visible', border: 0, cursor: 'pointer', fontFamily: CK.font, color: CK.ink, background: CK.card, borderRadius: 16,
          padding: '11px 12px 10px', margin: `${room.top + 4}px ${room.right}px 0 0`, width: `calc(100% - ${room.right}px)`,
          boxShadow: cabinetRing(color, 2, CK.shadowSm), opacity: muted ? 0.72 : 1,
        }}
      >
        <CabinetStamp size="row" />
        <span style={{ display: 'block', paddingRight: 84 }}><CabinetHead cabinet={cabinet} n={dirNumber(d)} sealSize={card ? 34 : 28} nameSize={13} /></span>
        {card && (
          <span className="flex items-center flex-wrap" style={{ gap: '2px 10px', marginTop: 6, fontSize: 12.5, fontWeight: 800 }}>
            <span className="inline-flex items-center gap-1.5" style={{ color: v.color }}>{v.icon}{v.word}</span>
            {outcome && <span className="inline-flex items-center gap-1.5" style={{ color: outcomeColor(outcome) }}>{outcomeIcon(outcome, 14)}{OUTCOME_LABEL[outcome]}</span>}
          </span>
        )}
        <b style={{ display: 'block', marginTop: 7, fontSize: card ? 17 : 16, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
        <span className="flex items-center flex-wrap" style={{ gap: '2px 8px', marginTop: 4, fontSize: 12.5, fontWeight: 600, color: CK.muted, overflowWrap: 'anywhere' }}>
          <span title={whenTitle(d.created_at)}>From {a.name} · Sent {whenLabel(d.created_at)}</span>
          {themes.length > 0 && <ThemeIcons themes={themes} />}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openChairDirective(d)}
      aria-label={`${d.title}, ${v.word}, from ${a.name}`}
      className={`${card ? 'cm-lift ' : ''}block text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]`}
      style={card
        ? { border: 0, cursor: 'pointer', fontFamily: CK.font, color: CK.ink, background: CK.card, borderRadius: 16, padding: '10px 12px', boxShadow: CK.shadowSm }
        : { border: 0, borderTop: `1px solid ${CK.hair}`, cursor: 'pointer', fontFamily: CK.font, color: CK.ink, background: 'transparent', padding: '9px 0' }}
    >
      <span className="flex items-start" style={{ gap: 10, opacity: muted ? 0.72 : 1 }}>
        <Avatar name={a.name} src={a.picture_url} size={card ? 42 : 34} color={a.color} />
        <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
          {card && (
            <span className="flex items-center flex-wrap" style={{ gap: '2px 10px', fontSize: 12.5, fontWeight: 800 }}>
              <span className="inline-flex items-center gap-1.5" style={{ color: v.color }}>{v.icon}{v.word}</span>
              {outcome && <span className="inline-flex items-center gap-1.5" style={{ color: outcomeColor(outcome) }}>{outcomeIcon(outcome, 14)}{OUTCOME_LABEL[outcome]}</span>}
            </span>
          )}
          <span className="flex items-start gap-2 flex-wrap" style={{ marginTop: card ? 2 : 0 }}>
            <b style={{ flex: '1 1 140px', minWidth: 0, fontSize: card ? 15 : 14, lineHeight: 1.28, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
            <NumberBadge n={dirNumber(d)} style={{ marginTop: 1 }} />
          </span>
          <span className="flex items-center flex-wrap" style={{ gap: '2px 8px', marginTop: 2, fontSize: 12.5, fontWeight: 600, color: CK.muted, overflowWrap: 'anywhere' }}>
            {card && <span>{a.name}</span>}
            <span title={whenTitle(d.created_at)}>Sent {whenLabel(d.created_at)}</span>
            {themes.length > 0 && <ThemeIcons themes={themes} />}
          </span>
        </span>
        <span aria-hidden style={{ flex: 'none', color: CK.muted, lineHeight: 0, paddingTop: 8 }}><ChevronRight size={16} strokeWidth={1.5} /></span>
      </span>
    </button>
  );
}

/** Overlapping round portraits of the people who wrote these directives (at most `max`, the rest are not drawn). */
export function AuthorStack({ list, max = 4, size = 26 }: { list: DirectiveAuthor[]; max?: number; size?: number }) {
  const shown = list.slice(0, max);
  if (shown.length === 0) return null;
  return (
    <span aria-hidden className="inline-flex items-center" style={{ paddingLeft: Math.round(size * 0.35) }}>
      {shown.map((a, i) => (
        <Avatar key={i} name={a.name} src={a.picture_url} size={size} color={a.color} style={{ marginLeft: -Math.round(size * 0.35), boxShadow: '0 0 0 2px #FBEDE7' }} />
      ))}
    </span>
  );
}
