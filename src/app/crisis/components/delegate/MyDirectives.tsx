'use client';
// Gavelling Crisis: "My Directives", newest first. Every card has the SAME height. The author's portrait
// hangs over the top-left corner (as on the organiser Live Status card) with the kind as a small tag in
// the empty space beneath it; the outcome (or the status while there is no answer) is a coloured tag with
// its icon that sticks out on the very top edge. The text is the first lines of the reply, or of the
// directive when there is no reply, clamped to the same number of lines. A click opens the conversation.

import { useState } from 'react';
import { dirNumber } from '@/lib/crisis/format';
import { OUTCOME_LABEL, type Directive, type DirectiveNote } from '@/lib/crisis/types';
import type { CrisisRef } from '@/lib/crisis/api';
import { Avatar, Card, CK, Skeleton } from '../../crisisKit';
import DirectiveDialog from './DirectiveDialog';
import DirectiveDeepLink from '../notifications/DirectiveDeepLink';
import { KIND_WORD, kindIcon, outcomeColor, outcomeIcon, statusColor, statusIcon, STATUS_WORDS } from './directiveUi';

export interface PersonRef { name: string; picture_url: string | null; color: string }

const CARD_HEIGHT = 112;
const PORTRAIT = 48;
const OVERHANG = PORTRAIT / 3;

function DirectiveCard({ d, author, onOpen }: { d: Directive; author: PersonRef; onOpen: () => void }) {
  const tagColor = d.outcome ? outcomeColor(d.outcome) : statusColor(d.status);
  const tagWord = d.outcome ? OUTCOME_LABEL[d.outcome] : STATUS_WORDS[d.status];
  const tagIcon = d.outcome ? outcomeIcon(d.outcome, 13) : statusIcon(d.status, 13);
  const reply = d.reply?.trim() ?? '';
  const text = reply || d.body.trim();
  const ask = d.status === 'clarify';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Directive ${dirNumber(d)}, ${d.title}. ${tagWord}`}
      className="relative text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform active:scale-[0.99]"
      style={{
        height: CARD_HEIGHT, display: 'flex', gap: 10, padding: 0, cursor: 'pointer', fontFamily: CK.font, color: CK.ink,
        background: CK.card, borderRadius: 20, border: '1px solid rgba(27,56,40,0.14)', overflow: 'visible',
        boxShadow: ask ? `${CK.shadow}, 0 0 0 2px rgba(47,95,143,0.35)` : CK.shadow,
      }}
    >
      <span aria-hidden style={{ position: 'absolute', zIndex: 2, top: -OVERHANG, left: 14 }}>
        <Avatar name={author.name} src={author.picture_url} size={PORTRAIT} color={author.color} />
      </span>
      <span
        title={tagWord}
        className="inline-flex items-center"
        style={{
          position: 'absolute', zIndex: 2, top: -11, right: 14, gap: 5, height: 22, padding: '0 9px', borderRadius: 9,
          background: tagColor, color: '#FFF', fontSize: 11.5, fontWeight: 800, boxShadow: '0 2px 6px rgba(27,56,40,0.22)', whiteSpace: 'nowrap',
        }}
      >
        {tagIcon}{tagWord}
      </span>

      <span className="flex flex-col items-center" style={{ width: 76, flexShrink: 0, paddingTop: PORTRAIT - OVERHANG + 6 }}>
        <span className="inline-flex items-center justify-center text-center" style={{ gap: 4, flexWrap: 'wrap', fontSize: 10.5, lineHeight: 1.2, fontWeight: 700, color: CK.red }}>
          <span style={{ lineHeight: 0 }}>{kindIcon(d.kind, 12)}</span>{KIND_WORD[d.kind]}
        </span>
      </span>

      <span className="flex flex-col min-w-0" style={{ flex: 1, padding: '15px 14px 10px 0' }}>
        <b title={d.title} className="line-clamp-2 xl:line-clamp-1" style={{ fontSize: 14.5, lineHeight: 1.3, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>
          {d.title}
        </b>
        <span
          title={text}
          className="line-clamp-2 xl:line-clamp-3"
          style={{ marginTop: 3, fontSize: 13, lineHeight: 1.42, color: CK.inkSoft, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
        >
          {reply && <b style={{ color: CK.red }}>Reply: </b>}{text}
        </span>
      </span>
    </button>
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
      <DirectiveDeepLink onId={setOpenId} />
      <h2 id="my-directives-title" style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: CK.ink }}>My Directives</h2>
      {directives === null ? (
        <div className="grid gap-6"><Skeleton h={CARD_HEIGHT} r={20} /><Skeleton h={CARD_HEIGHT} r={20} /></div>
      ) : directives.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>You have not sent a directive yet.</p></Card>
      ) : (
        <div className="grid" style={{ gap: 28 }}>
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
