'use client';
// Gavelling Crisis: the conversation of a directive in the backroom pop-up, as chat bubbles in time
// order, like the delegate sees it. The delegate is on the LEFT with the portrait (the directive
// first, then their clarifications); staff are on the RIGHT: replies the delegate sees in forest,
// INTERNAL notes in a dashed warm bubble with a lock and "Only staff", and the final answer with its
// outcome chip and the time it went out. Staff only: internal notes never reach the delegate.

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { OUTCOME_LABEL, type Character, type Directive, type DirectiveNote } from '@/lib/crisis/types';
import { Avatar, CK, cabinetTint } from '../../crisisKit';
import { whenLabel, whenTitle } from '../delegate/directiveUi';
import { StaffPic } from './directiveParts';
import { OUTCOME_STYLE, memberName, type Names } from './directiveKit';

type Side = 'delegate' | 'staff';
interface Item {
  key: string;
  side: Side;
  at: string | null;
  sort: number;
  who: string;
  /** Who the picture belongs to. */
  pic: ReactNode;
  body: string;
  internal?: boolean;
  /** The final answer carries its outcome chip. */
  outcome?: Directive['outcome'];
  /** A small label next to the name ("Directive", "Seen by the delegate"). */
  tag?: string;
  /** What staff see after the bubble (who answered). */
  foot?: string;
}

function Bubble({ item, accent }: { item: Item; accent: string }) {
  const staff = item.side === 'staff';
  const o = item.outcome ? OUTCOME_STYLE[item.outcome] : null;
  const answer = !!item.outcome;
  const bg = item.internal ? cabinetTint(CK.gold, 0.3) : answer && o ? cabinetTint(o.color, 0.1) : staff ? cabinetTint(CK.forest, 0.11) : CK.card;
  const edge = item.internal ? `inset 0 0 0 1.5px ${cabinetTint(CK.goldDeep, 0.5)}` : answer && o ? `inset 0 0 0 1px ${cabinetTint(o.color, 0.3)}` : staff ? 'none' : CK.shadowSm;
  return (
    <div className="flex" style={{ justifyContent: staff ? 'flex-end' : 'flex-start', gap: 8 }}>
      {!staff && <span style={{ flex: 'none', lineHeight: 0, alignSelf: 'flex-end' }}>{item.pic}</span>}
      <div style={{
        maxWidth: 'min(88%, 560px)', minWidth: 'min(180px, 100%)', padding: '9px 13px 10px',
        borderRadius: staff ? '18px 18px 5px 18px' : '18px 18px 18px 5px', background: bg, boxShadow: edge,
        ...(item.internal ? { outline: `1.5px dashed ${cabinetTint(CK.goldDeep, 0.65)}`, outlineOffset: -1.5, boxShadow: 'none' } : null),
        ...(!staff && item.key === 'directive' ? { boxShadow: `inset 4px 0 0 ${accent}, ${CK.shadowSm}` } : null),
      }}>
        <p className="flex items-center flex-wrap" style={{ margin: 0, gap: '1px 7px', fontSize: 11.5, fontWeight: 700, color: staff ? CK.forest : CK.red }}>
          <span style={{ overflowWrap: 'anywhere' }}>{item.who}</span>
          {item.internal && (
            <span className="inline-flex items-center" style={{ gap: 3, color: CK.goldDeep }}><Lock size={11} strokeWidth={1.8} aria-hidden />Only staff</span>
          )}
          {item.tag && <span style={{ fontWeight: 600, color: CK.muted }}>{item.tag}</span>}
          {item.at && <span title={whenTitle(item.at)} style={{ fontWeight: 500, color: CK.muted }}>{whenLabel(item.at)}</span>}
        </p>
        {answer && o && item.outcome && (
          <p className="inline-flex items-center" style={{ margin: '6px 0 0', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#fff', background: o.color, borderRadius: 999, padding: '3px 11px 3px 8px' }}>
            <o.Icon size={16} strokeWidth={1.6} aria-hidden />{OUTCOME_LABEL[item.outcome]}
          </p>
        )}
        <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.body}</p>
        {item.foot && (
          <p style={{ margin: '5px 0 0', fontSize: 11.5, fontWeight: 600, color: CK.muted }}>{item.foot}</p>
        )}
      </div>
      {staff && <span style={{ flex: 'none', lineHeight: 0, alignSelf: 'flex-end' }}>{item.pic}</span>}
    </div>
  );
}

export default function DirectiveThread({ d, notes, names, who, character, accent, skipDirective = false }: {
  d: Directive;
  notes: DirectiveNote[] | null;
  names: Names;
  who: string;
  character?: Character;
  accent: string;
  /** The directive itself is shown big above the thread, so its own bubble is left out. */
  skipDirective?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const authorPic = <Avatar name={who} src={character?.picture_url} size={30} color={accent} />;
    const t0 = new Date(d.created_at).getTime();
    const out: Item[] = [{ key: 'directive', side: 'delegate', at: d.created_at, sort: t0, who, pic: authorPic, body: d.body, tag: 'Directive' }];
    for (const n of notes ?? []) {
      const fromAuthor = !n.internal && !!n.member_id && n.member_id === d.author_member_id;
      const member = n.member_id ? names.members.get(n.member_id) : undefined;
      out.push({
        key: n.id, side: fromAuthor ? 'delegate' : 'staff', at: n.created_at, sort: new Date(n.created_at).getTime(),
        who: fromAuthor ? who : memberName(n.member_id, names, 'Staff'),
        pic: fromAuthor ? authorPic : <StaffPic member={member} size={30} />,
        body: n.body, internal: n.internal, tag: !fromAuthor && !n.internal ? 'Seen by the delegate' : undefined,
      });
    }
    if (d.reply) {
      const at = d.answered_at ?? d.updated_at;
      out.push({
        key: 'answer', side: 'staff', at, sort: at ? new Date(at).getTime() : t0 + 1, who: memberName(d.answered_by, names, 'Staff'),
        pic: <StaffPic member={d.answered_by ? names.members.get(d.answered_by) : null} size={30} />,
        body: d.reply, outcome: d.outcome ?? 'later', tag: d.status === 'answered' ? 'Answer' : 'Reply',
      });
    }
    return (skipDirective ? out.filter((x) => x.key !== 'directive') : out).sort((a, b) => a.sort - b.sort);
  }, [d, notes, names, who, character?.picture_url, accent, skipDirective]);

  // A new message scrolls into view (not on the first paint of a thread that is only the directive).
  const count = items.length;
  // Only a message that arrives while the thread is open scrolls; the directive stays at the top on opening.
  const seen = useRef<number | null>(null);
  const loaded = notes !== null;
  useEffect(() => {
    if (!loaded) return;
    const before = seen.current;
    seen.current = count;
    if (before !== null && count > before) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [count, loaded]);
  if (skipDirective && count === 0 && notes !== null) return null;

  return (
    <section aria-label="Conversation" className="flex flex-col" style={{ gap: 10 }}>
      {items.map((it) => <Bubble key={it.key} item={it} accent={accent} />)}
      {notes === null && <p style={{ margin: 0, fontSize: 12.5, color: CK.muted, textAlign: 'center' }}>Loading the notes</p>}
      <div ref={endRef} />
    </section>
  );
}
