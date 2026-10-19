// Renders the MUN reference sheets (owner, 19 Oct 2026: plain black and white,
// a little Gavelling green, the mark, nothing that looks generated). Each sheet
// is typeset HTML in Inter, screenshotted by Playwright through the system
// Chrome. Output: public/blog/reference/<name>.png (and .webp).
//
//   node scripts/reference-sheets/render.mjs
//
// Edit sheets.mjs to change the wording; re-run to redraw every sheet.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SHEETS } from './sheets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'public/blog/reference');
mkdirSync(out, { recursive: true });

const font = (f) => `data:font/ttf;base64,${readFileSync(resolve(root, 'public/fonts/money-docs', f)).toString('base64')}`;
const mark = `data:image/png;base64,${readFileSync(resolve(root, 'public/gavel-mark.png')).toString('base64')}`;

const FOREST = '#1B3828';
const INK = '#111111';
const SOFT = '#5B5B5B';
const RULE = '#DADADA';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function body(sheet) {
  if (sheet.kind === 'columns') {
    return `<div class="cols" style="column-count:${sheet.columns}">${sheet.items
      .map((i) => `<div class="item">${esc(i.text)}${i.mark ? `<sup>${esc(i.mark)}</sup>` : ''}</div>`)
      .join('')}</div>`;
  }
  if (sheet.kind === 'table') {
    return `<table><thead><tr>${sheet.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${sheet.rows
      .map((r) => `<tr>${r.map((c, i) => `<td class="c${i}">${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
  }
  if (sheet.kind === 'flow') {
    return `<ol class="flow">${sheet.steps
      .map((s, i) => `<li><span class="n">${i + 1}</span><span class="t"><b>${esc(s.title)}</b><span>${esc(s.text)}</span></span></li>`)
      .join('')}</ol>`;
  }
  throw new Error(`unknown kind ${sheet.kind}`);
}

function page(sheet) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:400;src:url(${font('Inter-Regular.ttf')})}
@font-face{font-family:Inter;font-weight:700;src:url(${font('Inter-Bold.ttf')})}
@font-face{font-family:Inter;font-weight:800;src:url(${font('Inter-ExtraBold.ttf')})}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{width:${sheet.width ?? 1600}px;font-family:Inter;color:${INK};padding:64px 72px 40px;-webkit-font-smoothing:antialiased}
h1{font-size:46px;font-weight:800;letter-spacing:-0.02em;line-height:1.1}
.bar{width:56px;height:5px;background:${FOREST};margin:18px 0 14px}
.lead{font-size:19px;color:${SOFT};line-height:1.45;max-width:1100px}
main{margin-top:36px}
.cols{column-gap:48px;column-fill:balance}
.item{font-size:22px;line-height:1.75;break-inside:avoid}
.item sup{color:${FOREST};font-weight:700;font-size:15px;margin-left:3px}
table{width:100%;border-collapse:collapse;font-size:19px;line-height:1.4}
th{text-align:left;font-size:14px;font-weight:700;color:${FOREST};text-transform:none;padding:0 18px 12px 0;border-bottom:2px solid ${INK}}
td{padding:13px 18px 13px 0;border-bottom:1px solid ${RULE};vertical-align:top}
td.c0{font-weight:700;white-space:nowrap}
td.c2,td.c3{white-space:nowrap}
.flow{list-style:none;display:grid;grid-template-columns:repeat(${sheet.flowColumns ?? 2},1fr);grid-template-rows:repeat(${Math.ceil((sheet.steps?.length ?? 0) / (sheet.flowColumns ?? 2))},auto);grid-auto-flow:column;gap:22px 56px}
.flow li{display:flex;gap:18px;align-items:flex-start}
.flow .n{flex:none;width:40px;height:40px;border-radius:50%;border:2px solid ${FOREST};color:${FOREST};font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center}
.flow .t{display:flex;flex-direction:column;gap:4px;font-size:19px;line-height:1.45;color:${SOFT}}
.flow .t b{color:${INK};font-size:22px;font-weight:700}
.note{margin-top:28px;font-size:16px;color:${SOFT};line-height:1.5}
.note b{color:${FOREST}}
footer{margin-top:40px;padding-top:18px;border-top:1px solid ${RULE};display:flex;align-items:center;justify-content:space-between;font-size:16px;color:${SOFT}}
footer .brand{display:flex;align-items:center;gap:10px;font-weight:700;color:${FOREST};font-size:18px}
footer img{width:34px;height:34px}
</style></head><body>
<h1>${esc(sheet.title)}</h1>
<div class="bar"></div>
${sheet.lead ? `<p class="lead">${esc(sheet.lead)}</p>` : ''}
<main>${body(sheet)}</main>
${sheet.note ? `<p class="note">${sheet.note}</p>` : ''}
<footer><span class="brand"><img src="${mark}" alt="">gavelling.com</span><span>Free to share and print</span></footer>
</body></html>`;
}

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1600, height: 900 } });
const tab = await ctx.newPage();
for (const sheet of SHEETS) {
  await tab.setViewportSize({ width: sheet.width ?? 1600, height: 200 });
  await tab.setContent(page(sheet), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const png = resolve(out, `${sheet.name}.png`);
  await tab.screenshot({ path: png, fullPage: true });
  await sharp(png).resize({ width: 1600 }).webp({ quality: 88 }).toFile(resolve(out, `${sheet.name}.webp`));
  console.log('drew', sheet.name);
}
await browser.close();
