'use client';

// Block-based email composer: paragraphs with non-editable token pills,
// button blocks with a destination picker, reorder/delete, and a branded
// HTML preview (desktop/mobile) rendered against a searchable applicant.
//
// Uncontrolled by design: it owns its own block/subject state, seeded once
// from initialSubject/initialBlocks, and reports every edit upward via
// onChange (undebounced) so the parent always has the latest value for its
// own Save/Send actions and its own debounced autosave-to-DB effect. Callers
// should remount it (change its `key`) when switching which template is
// being edited.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Monitor, Smartphone, Send } from 'lucide-react';
import {
  EMAIL_TOKEN_KEYS, EMAIL_TOKEN_LABELS, resolveTokens, splitResolvedText,
  type EmailTokenContext, type EmailTokenKey,
} from '@/lib/emailTokens';
import {
  type EmailBlock, type ButtonBlock, type ButtonDestination,
  BUTTON_DESTINATION_LABELS,
} from '@/lib/emailBlocks';
import { renderEmailHtml, type EmailRenderConference } from '@/lib/emailHtml';

const OUTFIT = "'Outfit', sans-serif";
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const CREAM = '#FAF8F3';
const BORDER = '#DDD4C0';
const INK = '#1C1410';

export interface PreviewCandidate {
  id: string;
  label: string;
  ctx: EmailTokenContext;
}

export interface EmailComposerValue {
  subject: string;
  blocks: EmailBlock[];
}

interface EmailComposerProps {
  conference: EmailRenderConference;
  initialSubject: string;
  initialBlocks: EmailBlock[];
  previewCandidates: PreviewCandidate[];
  onChange: (value: EmailComposerValue) => void;
}

type LocalBlock = EmailBlock & { _id: string };

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function withIds(blocks: EmailBlock[]): LocalBlock[] {
  return blocks.map(b => ({ ...b, _id: genId() }));
}

function stripIds(blocks: LocalBlock[]): EmailBlock[] {
  return blocks.map(b => {
    const rest = { ...b } as Partial<LocalBlock>;
    delete rest._id;
    return rest as EmailBlock;
  });
}

const ROLE_OPTIONS = [
  { value: 'delegate', label: 'Delegate' },
  { value: 'head-delegate', label: 'Head Delegate' },
  { value: 'chair', label: 'Chair' },
  { value: 'faculty-advisor', label: 'Faculty Advisor' },
  { value: 'observer', label: 'Observer' },
];

// ── contentEditable / token-pill DOM helpers ────────────────────────────────

function createPillNode(tokenKey: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.setAttribute('contenteditable', 'false');
  span.dataset.token = tokenKey;
  span.textContent = EMAIL_TOKEN_LABELS[tokenKey as EmailTokenKey] ?? tokenKey;
  Object.assign(span.style, {
    display: 'inline-block',
    backgroundColor: 'rgba(238,217,138,0.35)',
    color: '#8A6614',
    border: '1px solid rgba(182,135,31,0.4)',
    borderRadius: '999px',
    padding: '1px 10px',
    fontSize: '12.5px',
    fontWeight: '700',
    margin: '0 1px',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: 'default',
    fontFamily: OUTFIT,
  });
  return span;
}

function buildParagraphDom(container: HTMLElement, content: string) {
  container.innerHTML = '';
  const re = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > lastIndex) container.appendChild(document.createTextNode(content.slice(lastIndex, m.index)));
    container.appendChild(createPillNode(m[1]));
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) container.appendChild(document.createTextNode(content.slice(lastIndex)));
}

function serializeParagraphDom(el: HTMLElement): string {
  let out = '';
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const token = (node as HTMLElement).dataset.token;
      out += token ? `{{${token}}}` : ((node as HTMLElement).textContent ?? '');
    }
  });
  return out;
}

function insertTextAtRange(range: Range, text: string) {
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function insertPillAtRange(range: Range, tokenKey: string) {
  range.deleteContents();
  const pill = createPillNode(tokenKey);
  range.insertNode(pill);
  range.setStartAfter(pill);
  range.setEndAfter(pill);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// ── Small shared bits ────────────────────────────────────────────────────────

function HighlightedText({ text }: { text: string }) {
  const segments = splitResolvedText(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.unresolved ? (
          <span key={i} style={{ backgroundColor: 'rgba(182,135,31,0.18)', color: '#8A6614', padding: '0 3px', borderRadius: 3, fontWeight: 600 }}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

function BlockShell({
  index, total, onMoveUp, onMoveDown, onDelete, children,
}: {
  index: number; total: number; onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">{children}</div>
      <div className="flex flex-col gap-1 flex-shrink-0 pt-1">
        <button type="button" disabled={index === 0} onClick={onMoveUp}
          className="rounded-md focus:outline-none disabled:opacity-30" style={{ padding: 3, border: `1px solid ${BORDER}`, backgroundColor: 'transparent' }}>
          <ChevronUp size={13} style={{ color: INK }} />
        </button>
        <button type="button" disabled={index === total - 1} onClick={onMoveDown}
          className="rounded-md focus:outline-none disabled:opacity-30" style={{ padding: 3, border: `1px solid ${BORDER}`, backgroundColor: 'transparent' }}>
          <ChevronDown size={13} style={{ color: INK }} />
        </button>
        <button type="button" onClick={onDelete}
          className="rounded-md focus:outline-none" style={{ padding: 3, border: '1px solid rgba(139,32,32,0.3)', backgroundColor: 'transparent' }}>
          <Trash2 size={13} style={{ color: '#8B2020' }} />
        </button>
      </div>
    </div>
  );
}

function AddRow({ onAdd }: { onAdd: (type: 'paragraph' | 'button') => void }) {
  return (
    <div className="flex items-center gap-2 my-1.5">
      <div style={{ flex: 1, height: 1, backgroundColor: '#F0EDE6' }} />
      <button type="button" onClick={() => onAdd('paragraph')}
        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none transition-colors"
        style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: 'transparent', fontFamily: OUTFIT }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <Plus size={12} /> PARAGRAPH
      </button>
      <button type="button" onClick={() => onAdd('button')}
        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none transition-colors"
        style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: 'transparent', fontFamily: OUTFIT }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <Plus size={12} /> BUTTON
      </button>
      <div style={{ flex: 1, height: 1, backgroundColor: '#F0EDE6' }} />
    </div>
  );
}

function ParagraphEditor({
  blockId, initialContent, registerRef, onFocusBlock, onContentChange,
}: {
  blockId: string;
  initialContent: string;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onFocusBlock: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(initialContent);

  useEffect(() => {
    if (ref.current) buildParagraphDom(ref.current, mounted.current);
  }, []);

  function handleInput() {
    if (!ref.current) return;
    onContentChange(blockId, serializeParagraphDom(ref.current));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        insertTextAtRange(sel.getRangeAt(0), '\n');
        handleInput();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      insertTextAtRange(sel.getRangeAt(0), text);
      handleInput();
    }
  }

  return (
    <>
      <div
        ref={el => { ref.current = el; registerRef(blockId, el); }}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => onFocusBlock(blockId)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder="Write your message here..."
        className="paragraph-editor"
        style={{
          width: '100%', minHeight: 90, padding: '12px 14px', borderRadius: 12,
          border: `1px solid ${BORDER}`, backgroundColor: CREAM, color: INK,
          fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
          outline: 'none', cursor: 'text',
        }}
      />
      <style jsx>{`
        .paragraph-editor:empty:before {
          content: attr(data-placeholder);
          color: #9A8A78;
        }
      `}</style>
    </>
  );
}

function ButtonBlockEditor({ block, onPatch }: { block: ButtonBlock; onPatch: (patch: Partial<ButtonBlock>) => void }) {
  return (
    <div className="rounded-xl p-4" style={{ border: `1px solid ${BORDER}`, backgroundColor: CREAM }}>
      <div className="flex items-center justify-center mb-3">
        <span className="inline-block rounded-lg px-6 py-2.5 text-sm font-bold" style={{ backgroundColor: GOLD, color: FOREST, fontFamily: OUTFIT }}>
          {block.label || 'Button label'}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <input
          value={block.label}
          onChange={e => onPatch({ label: e.target.value })}
          placeholder="Button label"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
        />
        <select
          value={block.destination}
          onChange={e => onPatch({ destination: e.target.value as ButtonDestination })}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: '#FFFFFF', fontFamily: OUTFIT, cursor: 'pointer' }}
        >
          {(Object.keys(BUTTON_DESTINATION_LABELS) as ButtonDestination[]).map(d => (
            <option key={d} value={d}>{BUTTON_DESTINATION_LABELS[d]}</option>
          ))}
        </select>
        {block.destination === 'apply_page' && (
          <select
            value={block.role ?? ''}
            onChange={e => onPatch({ role: e.target.value || undefined })}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: '#FFFFFF', fontFamily: OUTFIT, cursor: 'pointer' }}
          >
            <option value="">Any role</option>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        )}
        {block.destination === 'custom' && (
          <input
            value={block.url ?? ''}
            onChange={e => onPatch({ url: e.target.value })}
            placeholder="https://..."
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
          />
        )}
      </div>
    </div>
  );
}

// ── EmailComposer ─────────────────────────────────────────────────────────────

export default function EmailComposer({ conference, initialSubject, initialBlocks, previewCandidates, onChange }: EmailComposerProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [blocks, setBlocks] = useState<LocalBlock[]>(() => withIds(initialBlocks));
  const [activeTarget, setActiveTarget] = useState<string>('subject');
  const [previewing, setPreviewing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    onChangeRef.current({ subject, blocks: stripIds(blocks) });
  }, [subject, blocks]);

  function registerBlockRef(id: string, el: HTMLDivElement | null) {
    blockRefs.current[id] = el;
  }

  function updateParagraphContent(id: string, content: string) {
    setBlocks(bs => bs.map(b => (b._id === id && b.type === 'paragraph' ? { ...b, content } : b)));
  }

  function updateButtonBlock(id: string, patch: Partial<ButtonBlock>) {
    setBlocks(bs => bs.map(b => (b._id === id && b.type === 'button' ? { ...b, ...patch } : b)));
  }

  function addBlock(type: 'paragraph' | 'button', afterIndex: number) {
    const newBlock: LocalBlock =
      type === 'paragraph'
        ? { type: 'paragraph', content: '', _id: genId() }
        : { type: 'button', label: '', destination: 'conference_page', _id: genId() };
    setBlocks(bs => {
      const next = [...bs];
      next.splice(afterIndex + 1, 0, newBlock);
      return next;
    });
    if (type === 'paragraph') setActiveTarget(newBlock._id);
  }

  function deleteBlock(id: string) {
    setBlocks(bs => bs.filter(b => b._id !== id));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks(bs => {
      const idx = bs.findIndex(b => b._id === id);
      const swapWith = idx + dir;
      if (idx < 0 || swapWith < 0 || swapWith >= bs.length) return bs;
      const next = [...bs];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  function handlePaletteInsert(tokenKey: string) {
    const token = `{{${tokenKey}}}`;
    if (activeTarget === 'subject') {
      const input = subjectRef.current;
      if (!input) { setSubject(s => s + token); return; }
      const s = input.selectionStart ?? subject.length;
      const e = input.selectionEnd ?? subject.length;
      const next = subject.slice(0, s) + token + subject.slice(e);
      setSubject(next);
      requestAnimationFrame(() => { input.focus(); input.setSelectionRange(s + token.length, s + token.length); });
      return;
    }
    const el = blockRefs.current[activeTarget];
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    let range: Range;
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    insertPillAtRange(range, tokenKey);
    updateParagraphContent(activeTarget, serializeParagraphDom(el));
  }

  const previewMatches = useMemo(() => {
    if (!previewSearch.trim()) return [];
    const q = previewSearch.trim().toLowerCase();
    return previewCandidates.filter(c => c.label.toLowerCase().includes(q)).slice(0, 6);
  }, [previewCandidates, previewSearch]);

  const previewCandidate = previewId ? previewCandidates.find(c => c.id === previewId) ?? null : null;

  const previewHtml = useMemo(
    () => renderEmailHtml({ blocks: stripIds(blocks), conference, ctx: previewCandidate?.ctx ?? {} }),
    [blocks, conference, previewCandidate]
  );

  return (
    <div>
      {/* Composer-level actions */}
      <div className="flex items-center justify-end mb-3">
        <button
          type="button"
          disabled
          title="Available once email delivery is connected."
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
          style={{
            border: `1px solid ${BORDER}`, color: '#9A8A78', backgroundColor: 'transparent',
            fontFamily: OUTFIT, opacity: 0.55, cursor: 'not-allowed',
          }}
        >
          <Send size={12} /> SEND TEST TO ME
        </button>
      </div>

      {/* Subject */}
      <div className="mb-4">
        <label className="block font-semibold text-sm mb-1.5" style={{ color: INK, fontFamily: OUTFIT }}>
          Subject
        </label>
        <input
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          onFocus={() => setActiveTarget('subject')}
          placeholder="e.g. Your allocation for TEIMUN 2026 is confirmed"
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: CREAM, fontFamily: OUTFIT }}
        />
      </div>

      {/* Token palette */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="block font-semibold text-sm" style={{ color: INK, fontFamily: OUTFIT }}>
          Message
        </label>
        <button
          type="button"
          onClick={() => setPreviewing(v => !v)}
          className="text-xs font-semibold focus:outline-none"
          style={{ color: FOREST, backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT }}
        >
          {previewing ? '← EDIT' : 'PREVIEW →'}
        </button>
      </div>

      {!previewing && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {EMAIL_TOKEN_KEYS.map(key => (
              <button
                key={key}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handlePaletteInsert(key)}
                className="rounded-full px-2.5 py-1 text-xs font-bold focus:outline-none"
                style={{ backgroundColor: 'rgba(238,217,138,0.28)', color: '#8A6614', border: '1px solid rgba(182,135,31,0.35)', fontFamily: OUTFIT }}
              >
                {EMAIL_TOKEN_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {blocks.length === 0 && <AddRow onAdd={type => addBlock(type, -1)} />}
            {blocks.map((block, i) => (
              <div key={block._id}>
                <BlockShell index={i} total={blocks.length} onMoveUp={() => moveBlock(block._id, -1)} onMoveDown={() => moveBlock(block._id, 1)} onDelete={() => deleteBlock(block._id)}>
                  {block.type === 'paragraph' ? (
                    <ParagraphEditor
                      blockId={block._id}
                      initialContent={block.content}
                      registerRef={registerBlockRef}
                      onFocusBlock={setActiveTarget}
                      onContentChange={updateParagraphContent}
                    />
                  ) : (
                    <ButtonBlockEditor block={block} onPatch={patch => updateButtonBlock(block._id, patch)} />
                  )}
                </BlockShell>
                <AddRow onAdd={type => addBlock(type, i)} />
              </div>
            ))}
          </div>
        </>
      )}

      {previewing && (
        <div className="rounded-xl px-4 py-4" style={{ border: `1px solid ${BORDER}`, backgroundColor: CREAM }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="relative flex-1 min-w-0">
              <input
                value={previewSearch}
                onChange={e => { setPreviewSearch(e.target.value); setPreviewId(null); }}
                placeholder="Search applicants to preview as..."
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
              />
              {previewSearch.trim() && !previewCandidate && previewMatches.length > 0 && (
                <div
                  className="absolute left-0 right-0 rounded-xl shadow-lg overflow-y-auto"
                  style={{ top: 'calc(100% + 4px)', maxHeight: 200, backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, zIndex: 10 }}
                >
                  {previewMatches.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setPreviewId(c.id); setPreviewSearch(c.label); }}
                      className="w-full text-left px-4 py-2.5 text-sm focus:outline-none"
                      style={{ color: INK, fontFamily: OUTFIT }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-1 rounded-lg p-1" style={{ border: `1px solid ${BORDER}`, backgroundColor: '#FFFFFF' }}>
              <button
                type="button"
                onClick={() => setPreviewWidth('desktop')}
                className="rounded-md p-1.5 focus:outline-none"
                style={{ backgroundColor: previewWidth === 'desktop' ? FOREST : 'transparent' }}
                title="Desktop"
              >
                <Monitor size={14} style={{ color: previewWidth === 'desktop' ? GOLD : INK }} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewWidth('mobile')}
                className="rounded-md p-1.5 focus:outline-none"
                style={{ backgroundColor: previewWidth === 'mobile' ? FOREST : 'transparent' }}
                title="Mobile"
              >
                <Smartphone size={14} style={{ color: previewWidth === 'mobile' ? GOLD : INK }} />
              </button>
            </div>
          </div>

          {!previewCandidate && (
            <p className="text-xs mb-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Search and select an applicant above to resolve fields, or preview unresolved.
            </p>
          )}

          <p className="font-semibold text-sm mb-3" style={{ color: INK, fontFamily: OUTFIT }}>
            <HighlightedText text={resolveTokens(subject, previewCandidate?.ctx ?? {})} />
          </p>

          <div className="flex justify-center">
            <iframe
              key={previewWidth}
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              title="Email preview"
              style={{
                width: previewWidth === 'desktop' ? 620 : 390,
                height: 640,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
