// The MUN reference sheets in the website's own look (owner, 19 Oct 2026):
// a big word with small words fitted to its exact width (below it, "stack"),
// or beside it, matching its height ("side"); ivory paper, white cards, forest
// and a touch of gold, the Gavelling lockup. "How a committee runs" becomes a
// timeline. Same wording as the plain set (sheets.mjs).
//
//   node scripts/reference-sheets/render-styled.mjs
//
// Output: public/blog/reference/styled/<name>-<stack|side>.png and .webp

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SHEETS } from './sheets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'public/blog/reference/styled');
mkdirSync(out, { recursive: true });

const b64 = (p, type) => `data:${type};base64,${readFileSync(resolve(root, p)).toString('base64')}`;
const font = (f) => b64(`public/fonts/money-docs/${f}`, 'font/ttf');
const lockup = b64('public/gavelling-lockup.png', 'image/png');

const FOREST = '#1B3828';
const GOLD = '#EED98A';
const DEEP_GOLD = '#B6871F';
const INK = '#1C1410';
const SOFT = '#5A5046';
const IVORY = '#F2EDE1';
const RULE = '#E6DFCF';

// The big word and the small words for each sheet.
const HEAD = {
  'preambulatory-phrases': { big: 'Preambulatory', small: 'phrases that open the clauses of a Model UN resolution' },
  'operative-phrases': { big: 'Operative', small: 'phrases that say what the committee actually does' },
  motions: { big: 'Motions', small: 'what each one does, the vote it needs and what to say' },
  points: { big: 'Points', small: 'when to raise each one, and whether it may interrupt' },
  'committee-session-flow': { big: 'Committee', small: 'how a Model UN session runs, from first gavel to vote' },
  'roll-call-and-voting': { big: 'Voting', small: 'what every answer means at roll call and in the vote' },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function body(sheet) {
  if (sheet.kind === 'columns') {
    return `<section class="card"><div class="cols" style="column-count:${sheet.columns}">${sheet.items
      .map((i) => `<div class="item"><span class="dot"></span>${esc(i.text)}${i.mark ? `<sup>${esc(i.mark)}</sup>` : ''}</div>`)
      .join('')}</div></section>`;
  }
  if (sheet.kind === 'table') {
    return `<section class="card tablecard"><table><thead><tr>${sheet.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${sheet.rows
      .map((r) => `<tr>${r.map((c, i) => `<td class="c${i}">${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></section>`;
  }
  if (sheet.kind === 'flow') {
    // A horizontal timeline: one line, a numbered stop per step, labels
    // alternating above and below so nine steps fit across.
    return `<section class="timeline"><div class="line"></div>${sheet.steps
      .map((s, i) => `<div class="stop ${i % 2 ? 'down' : 'up'}" style="left:${(i / (sheet.steps.length - 1)) * 100}%">
        <div class="label"><b>${esc(s.title)}</b><span>${esc(s.text)}</span></div>
        <div class="knob">${i + 1}</div></div>`)
      .join('')}</section>`;
  }
  throw new Error(`unknown kind ${sheet.kind}`);
}

function header(sheet, layout) {
  const h = HEAD[sheet.name];
  return `<header class="head ${layout}">
    <div class="lockup">
      <div class="big" id="big">${esc(h.big)}</div>
      <div class="small" id="small">${esc(h.small)}</div>
    </div>
    <img class="logo" src="${lockup}" alt="Gavelling">
  </header>`;
}

function page(sheet, layout) {
  const timeline = sheet.kind === 'flow';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:400;src:url(${font('Inter-Regular.ttf')})}
@font-face{font-family:Inter;font-weight:700;src:url(${font('Inter-Bold.ttf')})}
@font-face{font-family:Inter;font-weight:800;src:url(${font('Inter-ExtraBold.ttf')})}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${IVORY}}
body{width:1600px;font-family:Inter;color:${INK};padding:64px 72px 44px;-webkit-font-smoothing:antialiased}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:40px}
.lockup{display:inline-flex}
.head.stack .lockup{flex-direction:column;align-items:flex-start}
.head.side .lockup{flex-direction:row;align-items:center;gap:22px}
.big{font-weight:800;font-size:132px;line-height:0.86;letter-spacing:-0.045em;color:${FOREST};white-space:nowrap}
.small{font-weight:700;color:${INK};white-space:nowrap;line-height:1.15}
.head.stack .small{margin-top:14px}
.head.side .small{white-space:normal;border-left:4px solid ${GOLD};padding-left:18px}
.logo{height:58px;width:auto;margin-top:6px;flex:none}
main{margin-top:44px}
.card{background:#fff;border-radius:22px;padding:36px 44px;box-shadow:0 1px 2px rgba(27,56,40,0.06),0 18px 40px -22px rgba(27,56,40,0.35)}
.cols{column-gap:44px}
.item{font-size:22px;line-height:1.8;break-inside:avoid;display:flex;align-items:center;gap:12px}
.dot{width:7px;height:7px;border-radius:50%;background:${GOLD};box-shadow:0 0 0 1.5px ${DEEP_GOLD} inset;flex:none}
.item sup{color:${FOREST};font-weight:800;font-size:15px;margin-left:-6px;align-self:flex-start;margin-top:6px}
.tablecard{padding:20px 40px 12px}
table{width:100%;border-collapse:collapse;font-size:19px;line-height:1.4}
th{text-align:left;font-size:14px;font-weight:700;color:${DEEP_GOLD};padding:14px 18px 12px 0;border-bottom:2px solid ${FOREST}}
td{padding:14px 18px 14px 0;border-bottom:1px solid ${RULE};vertical-align:top}
tr:last-child td{border-bottom:none}
td.c0{font-weight:800;color:${FOREST};white-space:nowrap}
td.c2,td.c3{white-space:nowrap}
.timeline{position:relative;height:400px;margin:0 56px}
.timeline .line{position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;border-radius:2px;background:${FOREST}}
.stop{position:absolute;top:50%;width:0}
.knob{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;background:${GOLD};border:4px solid ${FOREST};
  color:${FOREST};font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center}
.label{position:absolute;left:-118px;width:236px;text-align:center;display:flex;flex-direction:column;gap:6px;font-size:16px;line-height:1.4;color:${SOFT}}
.label b{color:${INK};font-size:20px;font-weight:800;line-height:1.2}
.stop.up .label{bottom:52px}
.stop.down .label{top:52px}
.stop.up .label::after,.stop.down .label::before{content:'';display:block;width:2px;height:18px;background:${FOREST};margin:0 auto;opacity:.35}
.stop.up .label::after{order:9}
.stop.down .label::before{order:-1}
.note{margin-top:26px;font-size:16px;color:${SOFT};line-height:1.5}
.note b{color:${FOREST}}
footer{margin-top:34px;display:flex;align-items:center;justify-content:space-between;font-size:16px;color:${SOFT}}
footer .site{font-weight:800;color:${FOREST};font-size:18px}
</style></head><body>
${header(sheet, layout)}
<main>${body(sheet)}</main>
${sheet.note ? `<p class="note">${sheet.note}</p>` : ''}
<footer><span class="site">gavelling.com</span><span>Free to share and print</span></footer>

</body></html>`;
}

// Fit the small words to the big word: the same width when stacked below,
// the same height (two lines) when beside it.
async function fitHeader(tab, layout) {
  await tab.evaluate((layout) => {
    const big = document.getElementById('big');
    const small = document.getElementById('small');
    const bigBox = big.getBoundingClientRect();
    if (layout === 'stack') {
      small.style.fontSize = '20px';
      const w = small.getBoundingClientRect().width;
      small.style.fontSize = `${(20 * bigBox.width) / w}px`;
      // Optical correction: Inter's side bearings make the big word look wider.
      const w2 = small.getBoundingClientRect().width;
      small.style.fontSize = `${parseFloat(small.style.fontSize) * (bigBox.width - 4) / w2}px`;
    } else {
      // Two lines beside the word, as tall as its cap height.
      const words = small.textContent.split(' ');
      const half = Math.ceil(words.length / 2);
      small.innerHTML = `${words.slice(0, half).join(' ')}<br>${words.slice(half).join(' ')}`;
      small.style.whiteSpace = 'nowrap';
      const target = parseFloat(getComputedStyle(big).fontSize) * 0.74;
      small.style.fontSize = '20px';
      const h = small.getBoundingClientRect().height;
      small.style.fontSize = `${(20 * target) / h}px`;
      // Never wider than the room left between the big word and the logo.
      const logo = document.querySelector('.logo').getBoundingClientRect();
      const room = 1600 - 72 - logo.width - 40 - (bigBox.right + 22 + 22);
      const sw = small.getBoundingClientRect().width;
      if (sw > room) small.style.fontSize = `${parseFloat(small.style.fontSize) * room / sw}px`;
    }
  }, layout);
}

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1600, height: 200 } });
const tab = await ctx.newPage();
for (const sheet of SHEETS) {
  for (const layout of ['stack', 'side']) {
    await tab.setContent(page(sheet, layout), { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    await fitHeader(tab, layout);
    const name = `${sheet.name}-${layout}`;
    const png = resolve(out, `${name}.png`);
    await tab.screenshot({ path: png, fullPage: true });
    await sharp(png).resize({ width: 1600 }).webp({ quality: 88 }).toFile(resolve(out, `${name}.webp`));
    console.log('drew', name);
  }
}
await browser.close();
