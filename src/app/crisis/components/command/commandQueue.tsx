'use client';
// Gavelling Crisis: "Waiting for a Reply" on Crisis Command, and the right-side drawer that opens a directive.

import { useMemo } from 'react';
import { Hourglass, Pencil } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { CK, Card, Skeleton, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import DirectivePopup from '../directives/DirectivePopup';
import { buildNames, isOpenStatus, lastAnsweredByAuthor, sortDirectives } from '../directives/directiveKit';
import QueueRow from '../directives/QueueRow';
import AssignControl from './commandAssign';
import { beingWritten, isStaffRow, staffLoads } from './commandData';
import { EmptyLine, LinkBtn } from './commandParts';

export function WaitingCard({ directives, base, now, onOpen, onChanged }: {
  directives: Directive[] | null; base: string; now: number; onOpen: (d: Directive) => void;
  /** After a directive was moved to someone else: re-read the directives. */
  onChanged?: () => void;
}) {
  const { core, settings, ref } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);
  const staff = useMemo(() => core.members.filter(isStaffRow), [core.members]);

  // A directive someone is writing a reply to right now is being dealt with: it leaves the waiting list and is counted apart.
  const { waiting, writing, counts } = useMemo(() => {
    const all = directives ?? [];
    const openList = all.filter(isOpenStatus);
    const written = openList.filter((d) => beingWritten(d, now));
    const still = openList.filter((d) => !beingWritten(d, now));
    const sorted = sortDirectives(still, settings.queueOrder, 'open', lastAnsweredByAuthor(all));
    return {
      waiting: sorted,
      writing: written.length,
      counts: new Map(staffLoads(core.members, all, now).map((l) => [l.member.id, l.open.length])),
    };
  }, [directives, settings.queueOrder, now, core.members]);

  return (
    <Card warm className="cmd-card cmd-wait">
      {/* One line: the title left, the open count right (never wraps under the title). */}
      <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 10 }}>
        <h2 className="flex items-center" style={{ gap: 7, margin: 0, fontSize: 15, fontWeight: 800, color: CK.ink, whiteSpace: 'nowrap', minWidth: 0 }}>
          <span style={{ color: CK.red, lineHeight: 0 }}><Hourglass size={17} strokeWidth={1.5} /></span>
          Waiting for a Reply
        </h2>
        {directives !== null && (
          <span className="inline-flex items-baseline" style={{ gap: 5, whiteSpace: 'nowrap', flex: 'none' }}>
            <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{waiting.length}</b>
            <span style={{ fontSize: 12, fontWeight: 600, color: CK.inkSoft }}>open</span>
          </span>
        )}
      </div>
      {directives === null ? (
        <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={58} /><Skeleton h={58} /><Skeleton h={58} /></div>
      ) : (
        <>
          {/* Every open directive nobody is writing to yet; the list scrolls inside the card, the footer stays. */}
          {waiting.length === 0 ? <EmptyLine>{writing > 0 ? 'Everything open is being written.' : 'Every directive has an answer.'}</EmptyLine> : (
            <div className="cmd-scroll flex flex-col" style={{ gap: 6 }}>
              {waiting.map((d) => (
                <div key={d.id} style={{ position: 'relative' }}>
                  <QueueRow d={d} names={names} sev={waitSeverity(d.waiting_since, now)} whenLabel={waitLabel(d.waiting_since, now)} onOpen={() => onOpen(d)} compact />
                  {/* Change the backroomer right here: hangs on the top edge, opposite the number badge. */}
                  <span style={{ position: 'absolute', zIndex: 3, top: 3, right: 10, lineHeight: 0 }}>
                    <AssignControl cref={ref} directive={d} staff={staff} openCounts={counts} onChanged={() => onChanged?.()} />
                  </span>
                </div>
              ))}
            </div>
          )}
          {writing > 0 && (
            <p className="flex items-baseline" style={{ gap: 5, margin: '8px 0 0', flex: 'none', color: CK.inkSoft }}>
              <Pencil size={13} strokeWidth={1.5} aria-hidden style={{ alignSelf: 'center', color: CK.forest2 }} />
              <b style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{writing}</b>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>being written</span>
            </p>
          )}
          <div style={{ marginTop: 8, flex: 'none' }}>
            <LinkBtn href={`${base}/directives`} style={{ width: '100%', justifyContent: 'center' }}>
              See all in Directives
            </LinkBtn>
          </div>
        </>
      )}
    </Card>
  );
}

/** A directive opened from Command: the same pop-up the backroom uses (main pop-up + changes panel). */
export function DirectiveDrawer({ directive, directives, onSelect, onClose }: {
  directive: Directive; directives: Directive[] | null; onSelect: (id: string) => void; onClose: () => void;
}) {
  const { settings } = useCrisis();
  // The reader moves through the same open queue Waiting for a Reply shows; answering moves on to the next one.
  const queue = useMemo(() => {
    const all = directives ?? [];
    return sortDirectives(all.filter(isOpenStatus), settings.queueOrder, 'open', lastAnsweredByAuthor(all));
  }, [directives, settings.queueOrder]);
  const inQueue = queue.some((d) => d.id === directive.id) ? queue : [directive, ...queue];
  return (
    <DirectivePopup
      directive={directive}
      queue={inQueue}
      onSelect={onSelect}
      onClose={onClose}
      onChanged={(what) => {
        if (what !== 'answered') return;
        const at = inQueue.findIndex((x) => x.id === directive.id);
        const next = at < 0 ? null : (inQueue[at + 1] ?? inQueue[at - 1] ?? null);
        if (next) onSelect(next.id); else onClose();
      }}
    />
  );
}
