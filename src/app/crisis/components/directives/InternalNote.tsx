'use client';
// Gavelling Crisis: "Add internal note" in the side panel of a directive. The text becomes a note only staff see
// (the delegate never does; the answer status is not used). It is written at once, on its own, and the thread
// of the directive re-reads. Nothing else in the reply is written by it. It sits at the top of the panel as one
// line and opens to a text box; on an answered directive (no changes to make) it is the whole panel and fills it.

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { addNote, crisisError, type CrisisRef } from '@/lib/crisis/api';
import { Btn, CK, fieldStyle } from '../../crisisKit';

export default function InternalNote({ crisisRef, directiveId, onAdded, fill = false }: {
  crisisRef: CrisisRef;
  directiveId: string;
  /** The note landed: re-read the thread. */
  onAdded: () => void;
  /** The note is the whole panel: open, and as tall as the panel. */
  fill?: boolean;
}) {
  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);
  const [openState, setOpen] = useState(false);
  const open = fill || openState || !!text;

  const add = async () => {
    const body = text.trim();
    if (!body || working) return;
    setWorking(true);
    try { await addNote(crisisRef, directiveId, body, true); setText(''); setOpen(false); onAdded(); }
    catch (e) { notifyErr(crisisError(e, 'Could not add the note. Your text is kept, try again.'), 'crisis-directive'); }
    finally { setWorking(false); }
  };

  return (
    <section aria-label="Internal note" className="flex flex-col"
      style={{ flex: fill ? 1 : 'none', minHeight: 0, gap: 7, padding: '10px 14px', background: CK.card, boxShadow: `0 1px 0 ${CK.hair}`, fontFamily: CK.font }}>
      <div className="flex items-center" style={{ gap: 6 }}>
        <Lock size={14} strokeWidth={1.5} aria-hidden style={{ color: CK.goldDeep, flex: 'none' }} />
        <b style={{ fontSize: 13, color: CK.ink }}>Internal Note</b>
        <span style={{ fontSize: 12, fontWeight: 600, color: CK.muted, flex: 1, minWidth: 0 }}>Only staff see it</span>
        {!open && <Btn tone="ghost" size="sm" onClick={() => setOpen(true)}>Add internal note</Btn>}
      </div>
      {open && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={fill ? 6 : 2} maxLength={8000} aria-label="Internal note" autoFocus={!fill}
            placeholder="Write a note for the crisis team"
            style={{ ...fieldStyle, resize: 'none', background: CK.page, fontSize: 13, flex: fill ? 1 : 'none', minHeight: fill ? 120 : undefined }} />
          <div className="flex justify-end" style={{ gap: 6 }}>
            {!fill && !text && <Btn tone="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Btn>}
            <Btn tone="green" size="sm" icon={<Lock size={13} strokeWidth={1.5} />} onClick={add} disabled={!text.trim() || working}
              title="Only staff see an internal note. The answer status is not used.">Add internal note</Btn>
          </div>
        </>
      )}
    </section>
  );
}
