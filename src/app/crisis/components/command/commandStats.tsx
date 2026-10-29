'use client';
// Gavelling Crisis: Statistics, a pop-up opened from the Command header. Two views in the one pop-up: how the backroom is doing
// (per backroomer: open, answered, average reply time, oldest waiting) and how the delegates are doing (per character:
// directives sent, approved, partly works, denied, waiting). Counts are a big number with the word beside it, never pills.

import { useMemo, useState } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';
import type { Cabinet, Character, Directive, Member } from '@/lib/crisis/types';
import { ROLE_LABEL } from '@/lib/crisis/types';
import { Avatar, Btn, CK, Segmented, Skeleton, waitLabel } from '../../crisisKit';
import CrisisDialog from '../delegate/CrisisDialog';
import { backroomStats, delegateStats, minutesLabel } from './commandData';

type View = 'backroom' | 'delegates';

/** A big number with the word beside it. */
function Stat({ n, word, color, width = 104 }: { n: number | string; word: string; color?: string; width?: number }) {
  return (
    <span className="inline-flex items-baseline" style={{ gap: 5, minWidth: width, whiteSpace: 'nowrap' }}>
      <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: color ?? CK.ink }}>{n}</b>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>{word}</span>
    </span>
  );
}

function Row({ name, sub, src, color, children }: { name: string; sub?: string; src: string | null; color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center flex-wrap" style={{ gap: '8px 14px', padding: '10px 0', borderTop: `1px solid ${CK.hair}` }}>
      <span className="flex items-center" style={{ gap: 10, flex: '1 1 190px', minWidth: 0 }}>
        <Avatar name={name} src={src} size={38} color={color} />
        <span style={{ minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 14, color: CK.ink, overflowWrap: 'anywhere' }}>{name}</b>
          {sub && <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{sub}</span>}
        </span>
      </span>
      <span className="flex flex-wrap items-baseline" style={{ gap: '6px 14px', flex: '2 1 380px' }}>{children}</span>
    </li>
  );
}

export function StatsButton({ onClick }: { onClick: () => void }) {
  return <Btn tone="ghost" size="sm" icon={<ChartNoAxesColumn size={14} strokeWidth={1.5} aria-hidden />} onClick={onClick}>Statistics</Btn>;
}

export default function StatsDialog({ directives, members, characters, cabinets, now, onClose }: {
  directives: Directive[] | null; members: Member[]; characters: Character[]; cabinets: Cabinet[]; now: number; onClose: () => void;
}) {
  const [view, setView] = useState<View>('backroom');
  const back = useMemo(() => (directives ? backroomStats(members, directives) : null), [members, directives]);
  const del = useMemo(() => (directives ? delegateStats(characters, directives) : null), [characters, directives]);
  const cabById = useMemo(() => new Map(cabinets.map((c) => [c.id, c])), [cabinets]);

  return (
    <CrisisDialog title="Statistics" eyebrow="How everyone is doing" onClose={onClose} width={860} step={view}>
      <div style={{ marginBottom: 6 }}>
        <Segmented<View> ariaLabel="Statistics view" value={view} onChange={setView} options={[{ value: 'backroom', label: 'Backroom' }, { value: 'delegates', label: 'Delegates' }]} />
      </div>
      {view === 'backroom' ? (
        back === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={52} /><Skeleton h={52} /></div>
        : back.length === 0 ? <p style={{ margin: '12px 0 0', fontSize: 14, color: CK.inkSoft }}>No backroomers yet.</p>
        : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {back.map((s) => (
              <Row key={s.member.id} name={s.member.display_name} sub={ROLE_LABEL[s.member.role]} src={s.member.picture_url} color={CK.forest2}>
                <Stat n={s.open} word="open" color={s.open >= 4 ? CK.red : CK.ink} />
                <Stat n={s.answered} word="answered" />
                <span className="inline-flex items-baseline" style={{ gap: 5, minWidth: 150 }}>
                  <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink, whiteSpace: 'nowrap' }}>
                    {s.avgReplyMin === null ? 'None' : minutesLabel(s.avgReplyMin)}
                  </b>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>average reply</span>
                </span>
                <span className="inline-flex items-baseline" style={{ gap: 5, minWidth: 130 }}>
                  <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink, whiteSpace: 'nowrap' }}>
                    {s.oldestWaiting ? waitLabel(s.oldestWaiting, now) : 'None'}
                  </b>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>oldest waiting</span>
                </span>
              </Row>
            ))}
          </ul>
        )
      ) : (
        del === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={52} /><Skeleton h={52} /></div>
        : del.length === 0 ? <p style={{ margin: '12px 0 0', fontSize: 14, color: CK.inkSoft }}>No characters yet.</p>
        : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {del.map((s) => {
              const cab = s.character.cabinet_id ? cabById.get(s.character.cabinet_id) : undefined;
              return (
                <Row key={s.character.id} name={s.character.name} sub={cab?.name} src={s.character.picture_url} color={cab?.color ?? CK.red}>
                  <Stat n={s.sent} word="sent" />
                  <Stat n={s.approved} word="approved" color={s.approved ? CK.ok : undefined} width={96} />
                  <Stat n={s.partial} word="partly works" width={118} />
                  <Stat n={s.denied} word="denied" color={s.denied ? CK.danger : undefined} width={86} />
                  <Stat n={s.waiting} word="waiting" color={s.waiting ? CK.warn : undefined} width={92} />
                </Row>
              );
            })}
          </ul>
        )
      )}
    </CrisisDialog>
  );
}
