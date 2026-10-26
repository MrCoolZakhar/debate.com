'use client';
// Gavelling Crisis: "Waiting for a Reply" on Crisis Command, and the right-side drawer that opens a directive.

import { useMemo } from 'react';
import { Hourglass } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { CK, Card, Skeleton, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import DirectivePopup from '../directives/DirectivePopup';
import { buildNames, isOpenStatus, lastAnsweredByAuthor, sortDirectives } from '../directives/directiveKit';
import QueueRow from '../directives/QueueRow';
import { EmptyLine, LinkBtn } from './commandParts';

export function WaitingCard({ directives, base, now, onOpen }: {
  directives: Directive[] | null; base: string; now: number; onOpen: (d: Directive) => void;
}) {
  const { core, settings } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);

  const { open, top } = useMemo(() => {
    const all = directives ?? [];
    const openList = all.filter(isOpenStatus);
    const sorted = sortDirectives(openList, settings.queueOrder, 'open', lastAnsweredByAuthor(all));
    return { open: openList.length, top: sorted };
  }, [directives, settings.queueOrder]);

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
            <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{open}</b>
            <span style={{ fontSize: 12, fontWeight: 600, color: CK.inkSoft }}>open</span>
          </span>
        )}
      </div>
      {directives === null ? (
        <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={58} /><Skeleton h={58} /><Skeleton h={58} /></div>
      ) : (
        <>
          {/* Every open directive; the list scrolls inside the card, the footer button stays. */}
          {top.length === 0 ? <EmptyLine>Every directive has an answer.</EmptyLine> : (
            <div className="cmd-scroll flex flex-col" style={{ gap: 6 }}>
              {top.map((d) => (
                <QueueRow key={d.id} d={d} names={names} sev={waitSeverity(d.waiting_since, now)} whenLabel={waitLabel(d.waiting_since, now)} onOpen={() => onOpen(d)} compact />
              ))}
            </div>
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
export function DirectiveDrawer({ directive, onClose }: { directive: Directive; onClose: () => void }) {
  return <DirectivePopup directive={directive} onClose={onClose} onChanged={(what) => { if (what === 'answered') onClose(); }} />;
}
