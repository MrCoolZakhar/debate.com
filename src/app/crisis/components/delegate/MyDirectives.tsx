'use client';
// Gavelling Crisis: "My Directives", newest first. Every directive is its own card: the author's picture
// hangs over its top-left corner, the kind has an icon, the status and the outcome are coloured with an
// icon, themes are coloured tags. A click opens the directive dialog.

import { useState } from 'react';
import { OUTCOME_LABEL, type Directive, type DirectiveNote } from '@/lib/crisis/types';
import type { CrisisRef } from '@/lib/crisis/api';
import { Card, CK, OverhangCard, Skeleton, ThemeTag } from '../../crisisKit';
import DirectiveDialog from './DirectiveDialog';
import { KIND_WORD, kindIcon, outcomeColor, outcomeIcon, statusColor, statusIcon, STATUS_WORDS, whenLabel } from './directiveUi';

export interface PersonRef { name: string; picture_url: string | null; color: string }

function firstLine(text: string): string {
  return text.split('\n').map((l) => l.trim()).find((l) => l) ?? '';
}

function DirectiveCard({ d, author, onOpen }: { d: Directive; author: PersonRef; onOpen: () => void }) {
  const reply = d.reply ? firstLine(d.reply) : '';
  const accent = d.outcome ? outcomeColor(d.outcome) : statusColor(d.status);
  const ask = d.status === 'clarify';
  return (
    <OverhangCard
      name={author.name}
      src={author.picture_url}
      color={author.color}
      size={52}
      onClick={onOpen}
      style={{ boxShadow: `${CK.shadow}, inset 4px 0 0 ${accent}${ask ? ', 0 0 0 2px rgba(47,95,143,0.35)' : ''}` }}
    >
      <span className="flex items-baseline justify-between gap-3 flex-wrap" style={{ fontSize: 12, fontWeight: 700, color: CK.muted }}>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ color: CK.red, lineHeight: 0 }}>{kindIcon(d.kind, 14)}</span>
          Directive {d.no}, {KIND_WORD[d.kind]}
        </span>
        <span>{whenLabel(d.created_at)}</span>
      </span>
      <b style={{ display: 'block', margin: '5px 0 0', fontSize: 18, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
      {d.themes.length > 0 && (
        <span className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
          {d.themes.map((t) => <ThemeTag key={t} theme={t} />)}
        </span>
      )}
      <span className="flex flex-wrap items-center gap-x-5 gap-y-1" style={{ marginTop: 10 }}>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, color: statusColor(d.status) }}>
          {statusIcon(d.status)}{STATUS_WORDS[d.status]}
        </span>
        {d.outcome && (
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 800, color: outcomeColor(d.outcome) }}>
            {outcomeIcon(d.outcome, 17)}{OUTCOME_LABEL[d.outcome]}
          </span>
        )}
      </span>
      {reply && (
        <span style={{ display: '-webkit-box', margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.45, color: CK.inkSoft, overflowWrap: 'anywhere', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          <b style={{ color: CK.red }}>Reply: </b>{reply}
        </span>
      )}
    </OverhangCard>
  );
}

export default function MyDirectives({
  cref, directives, notes, coauthors, personOf, memberName, myMemberId, onChanged,
}: {
  cref: CrisisRef;
  directives: Directive[] | null;
  notes: DirectiveNote[];
  coauthors: Array<{ directive_id: string; character_id: string }>;
  personOf: (characterId: string | null) => PersonRef;
  memberName: (memberId: string | null) => string | null;
  myMemberId: string | null;
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openOne = openId ? (directives ?? []).find((d) => d.id === openId) ?? null : null;

  return (
    <section aria-labelledby="my-directives-title">
      <h2 id="my-directives-title" style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800, color: CK.ink }}>My Directives</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: CK.inkSoft }}>Newest first. Answers show up here by themselves.</p>
      {directives === null ? (
        <div className="grid gap-4"><Skeleton h={110} r={22} /><Skeleton h={110} r={22} /></div>
      ) : directives.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>You have not sent a directive yet.</p></Card>
      ) : (
        <div className="grid gap-5">
          {directives.map((d) => <DirectiveCard key={d.id} d={d} author={personOf(d.author_character_id)} onOpen={() => setOpenId(d.id)} />)}
        </div>
      )}
      {openOne && (
        <DirectiveDialog
          key={openOne.id}
          cref={cref}
          d={openOne}
          notes={notes.filter((n) => n.directive_id === openOne.id)}
          withNames={coauthors
            .filter((c) => c.directive_id === openOne.id)
            .map((c) => personOf(c.character_id).name)
            .filter((n) => n !== '?')}
          myMemberId={myMemberId}
          author={personOf(openOne.author_character_id)}
          isAuthor={openOne.author_member_id === myMemberId}
          answeredBy={memberName(openOne.answered_by)}
          onChanged={onChanged}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
