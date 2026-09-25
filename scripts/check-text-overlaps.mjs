// Text overlap checker (npm run check:text-overlaps). Drives headless Chrome
// over CDP (Node 22 WebSocket, no packages). For each route x viewport it loads
// the page twice: with the real font (Albert Sans) and with a forced
// system-font baseline, and reports
// issues that exist ONLY with Schibsted: page-level horizontal overflow,
// clipped text (overflow hidden without an ellipsis), ellipsis truncation,
// and overlapping text boxes.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv.find((a) => a.startsWith('--base='))?.slice(7) || process.env.BASE || 'http://localhost:3000';
const DEFAULT_ROUTES = ['/', '/sessions', '/about', '/contact', '/conferences/explore', '/conferences/roles', '/organisers', '/blog', '/join', '/create', '/privacy', '/terms'];
const ROUTES = process.env.ROUTES ? process.env.ROUTES.split(',').filter(Boolean) : DEFAULT_ROUTES;
const OUT = process.env.OUT || '';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true },
];
const PORT = 9444;
const dir = mkdtempSync(join(process.env.TMPDIR || '/tmp', 'gv-overlaps-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--hide-scrollbars', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ver() { for (let i = 0; i < 50; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } } throw new Error('no chrome'); }

let ws, id = 0; const pending = new Map(); const events = [];
function send(method, params = {}, sessionId) {
  const msg = { id: ++id, method, params }; if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
}

const PROBE = `(() => {
  const vw = innerWidth;
  const out = { hscroll: Math.max(0, document.documentElement.scrollWidth - vw), clipped: [], ellipsis: [], overlaps: [] };
  const vis = (el, cs) => cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
  const label = (el) => (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
  const path = (el) => { const p = []; let e = el; for (let i = 0; e && i < 4; i++, e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')); return p.join('>'); };
  const leaves = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('[aria-hidden="true"], svg, script, style, noscript')) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    const cs = getComputedStyle(el); if (!vis(el, cs)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    // clipped text on the element itself
    const ox = cs.overflowX, ellip = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
    if (el.scrollWidth > el.clientWidth + 1 && (ox === 'hidden' || ox === 'clip')) {
      (ellip ? out.ellipsis : out.clipped).push({ text: label(el), path: path(el), over: el.scrollWidth - el.clientWidth });
    }
    if (el.scrollHeight > el.clientHeight + 2 && (cs.overflowY === 'hidden' || cs.overflowY === 'clip') && !ellip && el.clientHeight > 0) {
      out.clipped.push({ text: label(el), path: path(el), overY: el.scrollHeight - el.clientHeight });
    }
    // text escaping the viewport horizontally
    if (r.right > vw + 1 && cs.position !== 'fixed') out.clipped.push({ text: label(el), path: path(el), offscreen: Math.round(r.right - vw) });
    // is the text clipped by an ancestor with overflow hidden?
    let a = el.parentElement;
    for (let i = 0; a && i < 6; i++, a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflowX === 'hidden' || acs.overflowX === 'clip') {
        const ar = a.getBoundingClientRect();
        if (r.right > ar.right + 2 && r.left < ar.right && acs.textOverflow !== 'ellipsis') out.clipped.push({ text: label(el), path: path(el), byAncestor: Math.round(r.right - ar.right) });
        break;
      }
    }
    const rects = cs.display === 'inline' ? [...el.getClientRects()] : [r];
    for (const q of rects) if (q.width > 1 && q.height > 1) leaves.push({ el, r: { l: q.left, t: q.top + scrollY, rt: q.right, b: q.bottom + scrollY } });
  }
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const A = leaves[i], B = leaves[j];
    if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const w = Math.min(A.r.rt, B.r.rt) - Math.max(A.r.l, B.r.l), h = Math.min(A.r.b, B.r.b) - Math.max(A.r.t, B.r.t);
    if (w <= 2 || h <= 2) continue;
    const small = Math.min((A.r.rt - A.r.l) * (A.r.b - A.r.t), (B.r.rt - B.r.l) * (B.r.b - B.r.t));
    if (w * h > 0.25 * small) out.overlaps.push({ a: label(A.el), b: label(B.el), pa: path(A.el), pb: path(B.el) });
  }
  return out;
})()`;

const BASELINE_CSS = `*{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important}`;

async function run() {
  const v = await ver();
  ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } else events.push(d); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
  // suppress first-run gates / cookie / tutorial via localStorage set on origin
  await send('Page.navigate', { url: BASE + '/' }, s); await sleep(4000);
  const results = [];
  for (const route of ROUTES) for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile }, s);
    const one = {};
    for (const mode of ['schibsted', 'baseline']) {
      await send('Page.navigate', { url: BASE + route }, s);
      await sleep(route.includes('/chair/') || route.includes('/delegate/') ? 9000 : 5000);
      if (mode === 'baseline') await send('Runtime.evaluate', { expression: `(()=>{const st=document.createElement('style');st.textContent=${JSON.stringify(BASELINE_CSS)};document.head.appendChild(st)})()` }, s);
      await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true }, s);
      await sleep(600);
      const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true }, s);
      one[mode] = r.result.value;
    }
    const key = (x) => JSON.stringify([x.text || x.a, x.path || x.pa, x.b || '']);
    const baseKeys = { clipped: new Set(one.baseline.clipped.map(key)), ellipsis: new Set(one.baseline.ellipsis.map(key)), overlaps: new Set(one.baseline.overlaps.map(key)) };
    const fresh = {
      route, viewport: vp.name,
      hscroll: one.schibsted.hscroll, hscrollBaseline: one.baseline.hscroll,
      newClipped: one.schibsted.clipped.filter((x) => !baseKeys.clipped.has(key(x))),
      newEllipsis: one.schibsted.ellipsis.filter((x) => !baseKeys.ellipsis.has(key(x))),
      newOverlaps: one.schibsted.overlaps.filter((x) => !baseKeys.overlaps.has(key(x))),
      totals: { clipped: one.schibsted.clipped.length, ellipsis: one.schibsted.ellipsis.length, overlaps: one.schibsted.overlaps.length },
    };
    results.push(fresh);
    console.log(`${route} ${vp.name}: hscroll ${fresh.hscroll}(base ${fresh.hscrollBaseline}) newClipped ${fresh.newClipped.length} newEllipsis ${fresh.newEllipsis.length} newOverlaps ${fresh.newOverlaps.length}`);
  }
  if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
  for (const r of results) for (const k of ['newClipped', 'newEllipsis', 'newOverlaps']) for (const x of r[k]) console.log(`  ${r.route} ${r.viewport} ${k}: ${JSON.stringify(x).slice(0, 200)}`);
}
run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { try { ws.close(); } catch {} chrome.kill(); });
