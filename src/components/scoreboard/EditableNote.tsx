'use client';

// ─────────────────────────────────────────────────────────────────────────────
// src/components/scoreboard/EditableNote.tsx
//
// A CHAIR COMMENT, READ BACK AND CORRECTED IN PLACE — the one way a note already
// written is edited outside the comment dock.
//
// The dock (`FeedbackLogPanel`) is where a note is written, beside the speech, in
// the moment. Reading the session back happens somewhere else entirely: the
// Scoreboard's History tab and a delegation's profile. A chair who spots a typo,
// or wants to sharpen a sentence before an awards conversation, had no way to
// change it there — the note was plain text. It is now the same text, and a click
// turns it into a textarea.
//
// OWNERSHIP IS THE WHOLE RULE. A `feedback` row belongs to the chair whose name is
// on it (AGENTS.md, chair roles: the dock claims a stored row only when
// `chair_name` matches, because matching on country + context alone once had one
// chair overwriting another's note while leaving their name on it). So only the
// author's own notes are editable here; every other chair's note renders exactly
// as it did and says whose it is on hover. The rule is repeated in the statement
// itself (`updateFeedbackContent`, `src/lib/feedbackEdit.ts`), so this is a
// courtesy in the UI and a condition in the database, not a hidden button
// (rule 15).
//
// OPTIMISTIC, THEN CHECKED. `save` (supplied by `ScoreboardPanel` through the
// context below) writes the new text into the panel's feedback rows at once, so
// the History tab and the profile both change together, then waits for the
// row-counted write. A write that did not land puts the old text back and leaves
// the editor open with what was typed and a short "not saved" line, so nothing a
// chair wrote is ever lost to a refused write.
//
// Content only: ratings stay in the dock, where the scale is.
// CHAIR-PRIVATE, like everything it renders inside (CLAUDE.md §2).
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { SOFT, RED, CARD_BORDER_COLOR } from '@/components/scoreboardTokens';
import { useT } from '@/contexts/LanguageContext';
import { TINT } from './SessionScoreboardParts';

export interface NoteEditing {
  /** This device's chair name (`?chairName=`). Only rows written under it are editable. */
  chairName: string;
  /** Optimistic write + row-counted confirmation. Resolves false when it did not land. */
  save: (id: string, content: string) => Promise<boolean>;
}

const NoteEditingContext = createContext<NoteEditing | null>(null);

export function NoteEditingProvider({ value, children }: { value: NoteEditing | null; children: React.ReactNode }) {
  return <NoteEditingContext.Provider value={value}>{children}</NoteEditingContext.Provider>;
}

export const useNoteEditing = (): NoteEditing | null => useContext(NoteEditingContext);

const fmt = (tpl: string, vars: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** The shared look of a note on both surfaces: a quiet amber rule down its inline start. */
const BASE: React.CSSProperties = {
  display: 'block',
  marginBlockStart: 3,
  paddingInlineStart: 9,
  borderInlineStart: `2px solid ${TINT.amber.fg}`,
  fontFamily: OUTFIT,
  fontSize: 12.5,
  lineHeight: 1.45,
  color: NEU.ink,
  textWrap: 'pretty',
};

export default function EditableNote({ id, content, author, style }: {
  id: string;
  content: string;
  /** The chair who wrote it. Empty on very old rows, which are then read-only. */
  author: string;
  style?: React.CSSProperties;
}) {
  const t = useT();
  const ctx = useNoteEditing();
  const mine = !!ctx && !!author && author === ctx.chairName;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [failed, setFailed] = useState(false);
  const saving = useRef(false);
  const skipBlur = useRef(false);
  const box = useRef<HTMLTextAreaElement | null>(null);

  // The draft only exists while the editor is open, and `open()` seeds it from
  // the text on screen at that moment. So a refetch landing under a chair who is
  // NOT editing simply re-renders the note, and one landing while they ARE
  // editing cannot take their sentence away mid-word. No syncing effect, and no
  // cascading render.
  //
  // Grow with the text rather than scroll: a note is two lines more often than ten.
  useLayoutEffect(() => {
    const el = box.current;
    if (!editing || !el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(260, el.scrollHeight)}px`;
  }, [editing, draft]);

  const open = () => {
    if (!mine) return;
    setDraft(content);
    setFailed(false);
    setEditing(true);
    // Focus and put the caret at the end, after the textarea exists.
    requestAnimationFrame(() => {
      const el = box.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const cancel = () => {
    skipBlur.current = true;
    setDraft(content);
    setFailed(false);
    setEditing(false);
  };

  const commit = async () => {
    if (!ctx || saving.current) return;
    const next = draft.trim();
    // An empty box is a cancel, never a write. Clearing a note would leave a row
    // that renders as nothing and could then never be reopened to fix.
    if (!next || next === content.trim()) { cancel(); return; }
    saving.current = true;
    const ok = await ctx.save(id, next);
    saving.current = false;
    if (ok) { setFailed(false); setEditing(false); }
    else setFailed(true); // stays open, with what they typed
  };

  const authorTag = author ? (
    <span style={{ color: SOFT, fontSize: 11, whiteSpace: 'nowrap' }}>{` · ${author}`}</span>
  ) : null;

  if (editing) {
    return (
      <span style={{ ...BASE, ...style }}>
        <textarea
          ref={box}
          value={draft}
          rows={1}
          aria-label={t('sb_note_edit_label')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (skipBlur.current) { skipBlur.current = false; return; } void commit(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
          }}
          className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{
            display: 'block', width: '100%', resize: 'none', overflow: 'auto',
            fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.45, color: NEU.ink,
            backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`,
            borderRadius: 8, padding: '5px 7px',
          }}
        />
        <span style={{ display: 'block', marginBlockStart: 2, fontSize: 10.5, color: failed ? RED : SOFT }}>
          {failed ? t('sb_note_save_failed') : t('sb_note_edit_hint')}
        </span>
      </span>
    );
  }

  if (!mine) {
    return (
      <span
        style={{ ...BASE, ...style }}
        title={author ? fmt(t('sb_note_readonly'), { name: author }) : undefined}
      >
        {content}
        {authorTag}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      title={t('sb_note_edit_hint')}
      className="gv-note-edit focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{ ...BASE, ...style, cursor: 'text', borderRadius: 4 }}
    >
      {content}
      {authorTag}
      <Pencil className="gv-note-pen" size={10} strokeWidth={2.4} aria-hidden style={{ marginInlineStart: 5, verticalAlign: 'middle', color: SOFT }} />
    </span>
  );
}
