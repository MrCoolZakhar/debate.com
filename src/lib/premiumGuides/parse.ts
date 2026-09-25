// The premium guide source grammar, parsed into Blocks.
//
//   ## Heading            a section (H2); the TOC lists these
//   ### Heading           a sub-heading (H3)
//   plain lines           a paragraph (consecutive lines join)
//   - item                bullet list
//   1. item               numbered list
//   [ ] item              checklist
//   > text                callout (consecutive lines join)
//   ~~~Title ... ~~~      a verbatim template (emails, scripts, clauses)
//   | a | b |             a table (header, |---| separator, rows)
//
// Inline: **bold** only. The renderer (GuideBlocks) escapes everything; no
// HTML from the source ever reaches the page as markup.

import type { Block } from './types';

export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*\*/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

export function parseGuide(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  const used = new Set<string>();
  const uniqueId = (text: string) => {
    const base = headingId(text) || 'section';
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { i++; continue; }

    if (line.startsWith('~~~')) {
      const title = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('~~~')) { body.push(lines[i].replace(/\s+$/, '')); i++; }
      i++; // closing fence
      while (body.length && !body[0].trim()) body.shift();
      while (body.length && !body[body.length - 1].trim()) body.pop();
      blocks.push({ t: 'template', title, lines: body });
      continue;
    }
    if (line.startsWith('### ')) { const text = line.slice(4).trim(); blocks.push({ t: 'h3', id: uniqueId(text), text }); i++; continue; }
    if (line.startsWith('## ')) { const text = line.slice(3).trim(); blocks.push({ t: 'h2', id: uniqueId(text), text }); i++; continue; }

    const collect = (re: RegExp) => {
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(re, '').trim());
        i++;
      }
      return items;
    };
    if (/^- /.test(line)) { blocks.push({ t: 'ul', items: collect(/^- /) }); continue; }
    if (/^\d+\.\s/.test(line)) { blocks.push({ t: 'ol', items: collect(/^\d+\.\s/) }); continue; }
    if (/^\[ ?\]\s/.test(line)) { blocks.push({ t: 'check', items: collect(/^\[ ?\]\s/) }); continue; }
    if (line.startsWith('>')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { parts.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      blocks.push({ t: 'note', text: parts.join(' ').trim() });
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const l = lines[i].trim();
        if (!/^\|[\s:|-]+\|?$/.test(l)) rows.push(tableCells(l));
        i++;
      }
      if (rows.length) blocks.push({ t: 'table', head: rows[0], rows: rows.slice(1) });
      continue;
    }

    const parts: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^(#{2,3} |- |\d+\.\s|\[ ?\]\s|>|\||~~~)/.test(l)) break;
      parts.push(l);
      i++;
    }
    blocks.push({ t: 'p', text: parts.join(' ') });
  }
  return blocks;
}

/** Words a reader reads (markup and template placeholders included as words). */
export function countWords(blocks: Block[]): number {
  const text: string[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'h2': case 'h3': case 'p': case 'note': text.push(b.text); break;
      case 'ul': case 'ol': case 'check': text.push(...b.items); break;
      case 'template': text.push(b.title, ...b.lines); break;
      case 'table': text.push(...b.head, ...b.rows.flat()); break;
    }
  }
  return text.join(' ').replace(/\*\*/g, '').split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}
