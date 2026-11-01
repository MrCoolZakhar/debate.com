'use client';
// Gavelling Crisis: "Cabinet Directives For You", the chair's approval card (docs/crisis/sql/017, 028).
// A cabinet directive waits here (status awaiting_chair) until the chair approves it (to the backroom), asks for changes
// (back to its author as a draft) or rejects it. Request changes and Reject ask for an optional note in place, inside the card
// (no pop-up on a pop-up). It is the same card as the pop-up on every chair page (ChairDirectivePrompt.tsx), so closing that
// pop-up leaves the directive here. Below the waiting ones: the directives with their author for changes.

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Gavel, PencilLine } from 'lucide-react';
import type { CrisisRef } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import type { Cabinet, Character, Directive, Member } from '@/lib/crisis/types';
import { Avatar, Card, CardTitle, CK, Skeleton } from '../../crisisKit';
import { NumberBadge } from '../directives/directiveParts';
import DirectiveDeepLink from '../notifications/DirectiveDeepLink';
import { statusColor, STATUS_WORDS, whenLabel, whenTitle } from '../delegate/directiveUi';
import { ChairDirectiveCard, directiveAuthor, type DirectiveAuthor } from './ChairDirectivePrompt';

/** A directive the chair sent back: it is with its author now, with the chair's note. */
function ChangesRow({ d, author, cabinetName }: { d: Directive; author: DirectiveAuthor; cabinetName: string | null }) {
  const note = (d.reply ?? '').trim();
  return (
    <li className="flex items-start" style={{ listStyle: 'none', gap: 12, padding: '11px 0', borderTop: `1px solid ${CK.hair}` }}>
      <Avatar name={author.name} src={author.picture_url} size={40} color={author.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, color: statusColor('changes_requested') }}>
          <PencilLine size={15} strokeWidth={1.5} aria-hidden />
          {STATUS_WORDS.changes_requested}, back with the author
        </span>
        <span className="flex items-start gap-2 flex-wrap" style={{ marginTop: 2 }}>
          <b style={{ flex: '1 1 180px', minWidth: 0, fontSize: 15, lineHeight: 1.3, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
          <NumberBadge n={dirNumber(d)} style={{ marginTop: 2 }} />
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 600, color: CK.muted, overflowWrap: 'anywhere' }}>
          {author.name}{cabinetName ? `, ${cabinetName}` : ''}
          <span title={whenTitle(d.updated_at)}>{` · ${whenLabel(d.updated_at)}`}</span>
        </span>
        {note && <p style={{ margin: '5px 0 0', fontSize: 13, lineHeight: 1.45, color: CK.inkSoft, overflowWrap: 'anywhere' }}><b>Your note: </b>{note}</p>}
      </div>
    </li>
  );
}

export default function ChairApproval({ cref, directives, cabinetId, characters, members, cabinets, onChanged }: {
  cref: CrisisRef;
  directives: Directive[] | null;
  cabinetId: string | null;
  characters: Character[];
  members: Member[];
  cabinets: Cabinet[];
  onChanged: () => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const onId = useCallback((id: string) => setFocusId(id), []);

  const mine = useMemo(
    () => (directives ?? []).filter((d) => d.kind === 'committee' && (!cabinetId || d.cabinet_id === cabinetId)),
    [directives, cabinetId],
  );
  const waiting = mine.filter((d) => d.status === 'awaiting_chair').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const changes = mine.filter((d) => d.status === 'changes_requested').sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const cabName = (d: Directive) => cabinets.find((c) => c.id === d.cabinet_id)?.name ?? null;
  const urgent = waiting.length > 0;

  return (
    <section aria-labelledby="chair-approval-title">
      <DirectiveDeepLink onId={onId} />
      <Card
        warm
        style={{ paddingTop: 14, boxShadow: urgent ? `${CK.shadow}, inset 0 0 0 1.5px rgba(142,36,36,0.38)` : CK.shadow }}
      >
        <CardTitle
          icon={<Gavel size={18} strokeWidth={1.5} />}
          sub={urgent ? 'Approve sends it to the backroom.' : undefined}
          right={directives !== null && (
            <span className="inline-flex items-baseline" style={{ gap: 6 }}>
              <b style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: urgent ? CK.red : CK.muted }}>{waiting.length}</b>
              <span style={{ fontSize: 13, fontWeight: 700, color: urgent ? CK.red : CK.inkSoft }}>waiting for you</span>
            </span>
          )}
        >
          <span id="chair-approval-title">Cabinet Directives For You</span>
        </CardTitle>
        {directives === null ? (
          <div className="grid gap-4"><Skeleton h={90} r={18} /></div>
        ) : (
          <>
            {waiting.length === 0 ? (
              <p className="flex items-center gap-2" style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>
                <CheckCircle2 size={17} strokeWidth={1.5} aria-hidden style={{ color: CK.ok }} />
                Nothing is waiting for you
              </p>
            ) : (
              <div className="grid" style={{ gap: 22, paddingTop: 6 }}>
                {waiting.map((d) => (
                  <ChairDirectiveCard
                    key={`${d.id}@${d.updated_at}`}
                    d={d}
                    author={directiveAuthor(d, characters, members, cabinets)}
                    cref={cref}
                    cabinetName={cabName(d)}
                    variant="inline"
                    focused={focusId === d.id}
                    onDone={onChanged}
                  />
                ))}
              </div>
            )}
            {changes.length > 0 && (
              <div style={{ marginTop: urgent ? 20 : 14 }}>
                <ul style={{ margin: 0, padding: 0 }} aria-label="Directives sent back for changes">
                  {changes.map((d) => <ChangesRow key={d.id} d={d} author={directiveAuthor(d, characters, members, cabinets)} cabinetName={cabName(d)} />)}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
