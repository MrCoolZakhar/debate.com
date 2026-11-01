'use client';
// Gavelling Crisis: "Waiting for You", the compact card in the Front Room's bottom right. The cabinet directives waiting for the
// chair's decision as small rows (portrait, title, number, when it was sent), then, muted, the ones back with their author for
// changes. A row opens that directive in the decision pop-up (chairDirectiveKit.openChairDirective), also one closed on this device.

import { useMemo } from 'react';
import { CheckCircle2, Gavel } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { Card, CardTitle, CK, Skeleton, Tick } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { AuthorStack, ChairDirectiveRow, directiveAuthor } from './chairDirectiveKit';

export default function ChairWaitingCard({ directives }: { directives: Directive[] | null }) {
  const { cabinetId, core } = useCrisis();

  const mine = useMemo(
    () => (directives ?? []).filter((d) => d.kind === 'committee' && (!cabinetId || d.cabinet_id === cabinetId)),
    [directives, cabinetId],
  );
  const waiting = useMemo(() => mine.filter((d) => d.status === 'awaiting_chair').sort((a, b) => a.created_at.localeCompare(b.created_at)), [mine]);
  const changes = useMemo(() => mine.filter((d) => d.status === 'changes_requested').sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [mine]);
  const authors = useMemo(() => waiting.map((d) => directiveAuthor(d, core.characters, core.members, core.cabinets)), [waiting, core.characters, core.members, core.cabinets]);
  const urgent = waiting.length > 0;

  return (
    <Card
      warm
      className="fr-pane fr-grow"
      style={{ paddingTop: 12, boxShadow: urgent ? `${CK.shadow}, inset 0 0 0 1.5px rgba(142,36,36,0.38)` : CK.shadow }}
    >
      <CardTitle
        icon={<Gavel size={18} strokeWidth={1.5} />}
        right={directives !== null && (
          <span className="inline-flex items-center" style={{ gap: 8 }}>
            <AuthorStack list={authors} />
            <span className="inline-flex items-baseline" style={{ gap: 6 }}>
              <b style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: urgent ? CK.red : CK.muted }}><Tick value={waiting.length} /></b>
              <span style={{ fontSize: 13, fontWeight: 700, color: urgent ? CK.red : CK.inkSoft }}>waiting</span>
            </span>
          </span>
        )}
      >
        Waiting for You
      </CardTitle>
      <div className="fr-body">
        {directives === null ? (
          <div className="grid gap-2"><Skeleton h={46} r={12} /><Skeleton h={46} r={12} /></div>
        ) : (
          <>
            {waiting.length === 0 ? (
              <p className="flex items-center gap-2" style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>
                <CheckCircle2 size={17} strokeWidth={1.5} aria-hidden style={{ color: CK.ok }} />
                Nothing is waiting for you
              </p>
            ) : (
              <div>{waiting.map((d) => <ChairDirectiveRow key={`${d.id}@${d.updated_at}`} d={d} />)}</div>
            )}
            {changes.length > 0 && (
              <div style={{ marginTop: waiting.length ? 12 : 10 }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 800, color: CK.muted }}>Back with the author for changes</p>
                <div>{changes.map((d) => <ChairDirectiveRow key={d.id} d={d} muted />)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
