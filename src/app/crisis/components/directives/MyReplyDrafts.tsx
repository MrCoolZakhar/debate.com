'use client';
// Gavelling Crisis: "My drafts" in the backroom. Every directive keeps its own unsent reply on this device
// (replyDraft.ts); this lists them all, newest first, each with the start of what was written, so a staff
// member can jump back to any of them or throw one away. Nothing here writes to the crisis.

import { useEffect, useState } from 'react';
import { PencilLine, Trash2 } from 'lucide-react';
import { dirNumber, timeAgo } from '@/lib/crisis/format';
import { OUTCOME_LABEL, type Directive } from '@/lib/crisis/types';
import { Btn, Card, CK } from '../../crisisKit';
import { authorName, type Names } from './directiveKit';
import { countChanges, listReplyDrafts, REPLY_DRAFTS_EVENT, writeReplyDraft, type StoredReplyDraft } from './replyDraft';

/** The unsent reply drafts of this crisis on this device, kept current while the page is open. */
export function useReplyDraftList(crisisId: string): StoredReplyDraft[] {
  const [list, setList] = useState<StoredReplyDraft[]>([]);
  useEffect(() => {
    const read = () => setList(listReplyDrafts(crisisId));
    const first = window.setTimeout(read, 0);
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    window.addEventListener(REPLY_DRAFTS_EVENT, read);
    window.addEventListener('storage', read);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener(REPLY_DRAFTS_EVENT, read);
      window.removeEventListener('storage', read);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [crisisId]);
  return list;
}

/** The header button: icon, the words, and how many drafts there are as a bold number. */
export function MyDraftsButton({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{
        border: 0, gap: 6, padding: '7px 12px', borderRadius: 11, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 700,
        background: open ? CK.card : CK.well, color: open ? CK.forest : CK.inkSoft, boxShadow: open ? CK.shadowSm : 'none', whiteSpace: 'nowrap',
      }}
    >
      <PencilLine size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />
      My drafts
      <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13.5, color: CK.red }}>{count}</b>
    </button>
  );
}

const START_CHARS = 180;

function startOf(s: StoredReplyDraft): string {
  const text = s.draft.reply.trim().replace(/\s+/g, ' ');
  if (text) return text.length > START_CHARS ? `${text.slice(0, START_CHARS).trimEnd()}...` : text;
  const bits: string[] = [];
  if (s.draft.outcome) bits.push(`Outcome chosen: ${OUTCOME_LABEL[s.draft.outcome]}`);
  const n = countChanges(s.draft.effects);
  if (n > 0) bits.push(`${n} ${n === 1 ? 'change' : 'changes'} ready to send`);
  return bits.length ? `${bits.join('. ')}. No text yet` : 'Nothing written yet';
}

export function MyDraftsPanel({
  crisisId, drafts, directives, names, onOpen,
}: {
  crisisId: string;
  drafts: StoredReplyDraft[];
  /** Every directive the page has loaded (open and finished). */
  directives: Directive[];
  names: Names;
  onOpen: (d: Directive) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const byId = new Map(directives.map((d) => [d.id, d]));

  return (
    <Card style={{ padding: '12px 14px' }}>
      <section aria-label="My drafts">
        <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: CK.ink }}>My Drafts</h2>
        {drafts.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No unsent replies. A reply you start and leave shows up here.</p>
        ) : (
          <ul className="grid" style={{ gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
            {drafts.map((s) => {
              const d = byId.get(s.directiveId) ?? null;
              const done = d ? d.status === 'answered' || d.status === 'withdrawn' || d.status === 'rejected' : false;
              return (
                <li
                  key={s.directiveId}
                  className="flex items-start justify-between flex-wrap"
                  style={{ gap: 10, background: CK.well, borderRadius: 14, padding: '9px 12px' }}
                >
                  <div className="min-w-0" style={{ flex: '1 1 260px' }}>
                    <b style={{ display: 'block', fontSize: 14, lineHeight: 1.3, color: CK.ink, overflowWrap: 'anywhere' }}>
                      {d ? `${dirNumber(d)}: ${d.title}` : 'A directive that is not in the list'}
                    </b>
                    <span style={{ display: 'block', marginTop: 1, fontSize: 12, fontWeight: 600, color: CK.muted, overflowWrap: 'anywhere' }}>
                      {d ? `From ${authorName(d, names)}. ` : ''}{s.savedAt ? `Saved ${timeAgo(new Date(s.savedAt).toISOString())}` : 'Saved earlier'}{done ? '. Already dealt with' : ''}
                    </span>
                    <span
                      title={s.draft.reply.trim() || undefined}
                      className="line-clamp-2"
                      style={{ display: '-webkit-box', marginTop: 4, fontSize: 13, lineHeight: 1.4, color: CK.inkSoft, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                    >
                      {startOf(s)}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                    {confirming === s.directiveId ? (
                      <>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.ink }}>Discard this draft?</span>
                        <Btn tone="danger" size="sm" onClick={() => { writeReplyDraft(crisisId, s.directiveId, null); setConfirming(null); }}>Yes, discard it</Btn>
                        <Btn tone="ghost" size="sm" onClick={() => setConfirming(null)}>Keep it</Btn>
                      </>
                    ) : (
                      <>
                        {d && <Btn tone="green" size="sm" icon={<PencilLine size={14} strokeWidth={1.5} />} onClick={() => onOpen(d)}>Continue</Btn>}
                        <Btn tone="ghost" size="sm" icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={() => setConfirming(s.directiveId)}>Discard</Btn>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Card>
  );
}
