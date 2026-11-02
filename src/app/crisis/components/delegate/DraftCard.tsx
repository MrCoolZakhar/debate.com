'use client';
// Gavelling Crisis: a saved draft in "My Directives" (the dashboard section and the full page). A dashed outline and the word "Draft"
// tell it apart from a sent directive; a click opens it back in the Send a Directive form, the bin deletes it (asked in place).
// Drafts live in this browser only (draftStore.ts), and the hover hint says so.

import { useState } from 'react';
import { Clock, NotebookPen, Trash2 } from 'lucide-react';
import { timeAgo } from '@/lib/crisis/format';
import { CK } from '../../crisisKit';
import { plainText } from '../directives/attachedImage';
import { draftLabel, type DraftEntry } from './draftStore';
import { KIND_WORD, kindIcon } from './directiveUi';

const HINT = 'Drafts stay on this device. They are not sent to anyone until you send them';

export default function DraftCard({ entry, onOpen, onDelete }: { entry: DraftEntry; onOpen: () => void; onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  const d = entry.draft;
  const title = draftLabel(d);
  const body = plainText(d.body).trim();
  return (
    <div
      title={HINT}
      className="relative"
      style={{ minHeight: 96, borderRadius: 20, border: '2px dashed rgba(27,56,40,0.32)', background: 'rgba(255,255,255,0.55)', fontFamily: CK.font, color: CK.ink }}
    >
      {asking ? (
        <div className="flex items-center flex-wrap" style={{ gap: '6px 12px', padding: '14px 16px', minHeight: 96 }}>
          <span style={{ flex: '1 1 160px', fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere' }}>Delete the draft &quot;{title}&quot;?</span>
          <button type="button" onClick={onDelete} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ border: 0, background: 'transparent', cursor: 'pointer', fontFamily: CK.font, fontSize: 13, fontWeight: 800, color: CK.danger, textDecoration: 'underline' }}>Yes, delete it</button>
          <button type="button" onClick={() => setAsking(false)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ border: 0, background: 'transparent', cursor: 'pointer', fontFamily: CK.font, fontSize: 13, fontWeight: 800, color: CK.forest, textDecoration: 'underline' }}>Keep it</button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Draft: ${title}. Open it in the form`}
            className="block text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform active:scale-[0.99]"
            style={{ border: 0, background: 'transparent', cursor: 'pointer', fontFamily: CK.font, color: CK.ink, borderRadius: 18, padding: '12px 48px 12px 16px' }}
          >
            <span className="inline-flex items-center" style={{ gap: 6, fontSize: 12, fontWeight: 800, color: CK.red }}>
              <NotebookPen size={14} strokeWidth={1.6} aria-hidden />Draft
              <span className="inline-flex items-center" style={{ gap: 4, fontWeight: 700, color: CK.inkSoft }}>
                <span style={{ lineHeight: 0 }}>{kindIcon(d.kind, 12)}</span>{KIND_WORD[d.kind]}
              </span>
            </span>
            <b style={{ display: 'block', marginTop: 3, fontSize: 17, lineHeight: 1.28, fontWeight: 800, overflowWrap: 'anywhere' }}>{title}</b>
            <span className="inline-flex items-center" style={{ gap: 4, marginTop: 3, fontSize: 12, fontWeight: 700, color: CK.muted }}>
              <Clock size={12} strokeWidth={1.6} aria-hidden />Saved {timeAgo(new Date(entry.at).toISOString())}
            </span>
            {body && d.title.trim() && (
              <span className="line-clamp-2" style={{ display: 'block', marginTop: 3, fontSize: 12.5, lineHeight: 1.4, color: CK.inkSoft, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{body}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAsking(true)}
            aria-label={`Delete the draft ${title}`}
            title="Delete this draft"
            className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ top: 8, right: 10, border: 0, background: 'transparent', cursor: 'pointer', padding: 8, lineHeight: 0, color: CK.muted, borderRadius: 10 }}
          >
            <Trash2 size={17} strokeWidth={1.5} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
