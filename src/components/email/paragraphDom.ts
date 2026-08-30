// contentEditable ⇄ stored-text plumbing for the email composer's paragraph
// blocks. EXTRACTED VERBATIM from the old EmailComposer when the builder UI
// was rebuilt — the UI around it changed completely, this did not, on purpose:
// the mark round-trip (`**bold**` / `*italic*`) and the token-pill atoms are
// the two places where a "small tidy-up" silently corrupts stored template
// content. See the flanking-rule notes in `@/lib/emailBlocks`.

import { EMAIL_TOKEN_LABELS, type EmailTokenKey } from '@/lib/emailTokens';
import { parseInlineMarks } from '@/lib/emailBlocks';

const OUTFIT = "'Outfit', sans-serif";


export function createPillNode(tokenKey: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.setAttribute('contenteditable', 'false');
  span.dataset.token = tokenKey;
  span.textContent = EMAIL_TOKEN_LABELS[tokenKey as EmailTokenKey] ?? tokenKey;
  Object.assign(span.style, {
    display: 'inline-block',
    // Pale gold fill with FOREST ink, which is the house pairing (a gold
    // button in `neu.tsx` carries forest text). It used to be #8A6614 ink on a
    // #B6871F-tinted rim — a warm brown on gold that composites to orange, a
    // colour this app does not own, on the most repeated object in the whole
    // builder. Forest on this fill also measures ~10.6:1 instead of ~4.6:1.
    backgroundColor: 'rgba(238,217,138,0.35)',
    color: '#1B3828',
    border: '1px solid rgba(27,56,40,0.20)',
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

/** Appends text to `parent`, turning each {{token}} into a pill node. */
function appendContentWithPills(parent: HTMLElement, content: string) {
  const re = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > lastIndex) parent.appendChild(document.createTextNode(content.slice(lastIndex, m.index)));
    parent.appendChild(createPillNode(m[1]));
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) parent.appendChild(document.createTextNode(content.slice(lastIndex)));
}

/** Rebuilds the editable DOM from stored text: bold (`**`) and italic (`*`)
 *  marks become <strong>/<em> wrappers (same parser as the renderer, so the
 *  editor and the sent email always agree on what is a mark), and token
 *  placeholders become pills. */
export function buildParagraphDom(container: HTMLElement, content: string) {
  container.innerHTML = '';
  for (const run of parseInlineMarks(content)) {
    if (!run.text) continue;
    let target: HTMLElement = container;
    if (run.bold) {
      const strong = document.createElement('strong');
      container.appendChild(strong);
      target = strong;
    }
    if (run.italic) {
      const em = document.createElement('em');
      target.appendChild(em);
      target = em;
    }
    appendContentWithPills(target, run.text);
  }
}

/** Collapses adjacent runs that carry identical marks (parseInlineMarks
 *  output is already merged; this normalizes derived run lists the same way
 *  so they can be compared). */
function mergeRuns(runs: { text: string; bold: boolean; italic: boolean }[]): { text: string; bold: boolean; italic: boolean }[] {
  const out: { text: string; bold: boolean; italic: boolean }[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.bold === r.bold && prev.italic === r.italic) prev.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

/** Serializes one element's children back to stored text, emitting `**`/`*`
 *  delimiters for bold/italic context introduced by this subtree. `bold` /
 *  `italic` say the surrounding context already carries the mark (so it is
 *  not re-emitted for nested duplicates execCommand can produce). */
function serializeChildren(el: Node, bold: boolean, italic: boolean): string {
  let out = '';
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const elem = node as HTMLElement;
    const token = elem.dataset.token;
    if (token) {
      out += `{{${token}}}`;
      return;
    }
    if (elem.tagName === 'BR') {
      out += '\n';
      return;
    }
    // execCommand emits <b>/<i> (styleWithCSS off), but some engines fall
    // back to styled spans mid-toggle — accept both spellings of each mark.
    const weight = elem.style.fontWeight;
    const addBold = !bold && (elem.tagName === 'B' || elem.tagName === 'STRONG' || weight === 'bold' || parseInt(weight, 10) >= 600);
    const addItalic = !italic && (elem.tagName === 'I' || elem.tagName === 'EM' || elem.style.fontStyle === 'italic');
    let inner = serializeChildren(elem, bold || addBold, italic || addItalic);
    if ((addBold || addItalic) && inner.trim()) {
      // Delimiters hug the text: whitespace moves outside them, because a
      // delimiter touching a space is (deliberately) not a valid mark.
      const lead = /^\s*/.exec(inner)![0];
      const trail = /\s*$/.exec(inner.slice(lead.length))![0];
      const core = inner.slice(lead.length, inner.length - trail.length);
      let wrapped = core;
      if (addItalic) wrapped = `*${wrapped}*`;
      if (addBold) wrapped = `**${wrapped}**`;
      // Prove the wrap round-trips before keeping it: reparsing the wrapped
      // text must yield exactly the core's runs with this element's marks
      // added (nested marks like <b><i>x</i></b> → ***x*** pass this; a
      // literal asterisk at the core's edge would fuse into an ambiguous
      // delimiter run and fails it). On failure the text is emitted unmarked
      // — dropping the styling for that edge case rather than corrupting it.
      const intended = mergeRuns(parseInlineMarks(core).map(r => ({ text: r.text, bold: r.bold || addBold, italic: r.italic || addItalic })));
      const actual = parseInlineMarks(wrapped);
      const same = actual.length === intended.length
        && actual.every((r, i) => r.text === intended[i].text && r.bold === intended[i].bold && r.italic === intended[i].italic);
      if (same) inner = lead + wrapped + trail;
    }
    out += inner;
  });
  return out;
}

export function serializeParagraphDom(el: HTMLElement): string {
  return serializeChildren(el, false, false);
}

export function insertTextAtRange(range: Range, text: string) {
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function insertPillAtRange(range: Range, tokenKey: string) {
  range.deleteContents();
  const pill = createPillNode(tokenKey);
  range.insertNode(pill);
  range.setStartAfter(pill);
  range.setEndAfter(pill);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
