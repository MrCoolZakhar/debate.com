#!/usr/bin/env node
// Renders every scripts/newsletter/art/<name>.html (files starting with "_" are
// shared parts) to scripts/newsletter/out/<edition>/<name>.jpg with headless Chrome.
//
//   node scripts/newsletter/render.mjs v2-05            (all images)
//   node scripts/newsletter/render.mjs v2-05 hero yield (only these)
//
// Each art file declares its size: <meta name="size" content="1120x700">.
// 1120 px wide = 2x the 560 px email column. JPEG via macOS `sips`, quality
// stepped down from 82 until the file is under 180 KB. No npm dependencies.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, statSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_BYTES = 180 * 1024;
const [edition = 'v2-05', ...only] = process.argv.slice(2);
const artDir = join(HERE, 'art');
const outDir = join(HERE, 'out', edition);
mkdirSync(outDir, { recursive: true });

const names = readdirSync(artDir)
  .filter(f => f.endsWith('.html') && !f.startsWith('_'))
  .map(f => f.slice(0, -5))
  .filter(n => !only.length || only.includes(n));

for (const name of names) {
  const file = join(artDir, `${name}.html`);
  const m = readFileSync(file, 'utf8').match(/<meta name="size" content="(\d+)x(\d+)"/);
  const [w, h] = m ? [m[1], m[2]] : ['1120', '700'];
  const png = join(outDir, `${name}.png`);
  const jpg = join(outDir, `${name}.jpg`);
  // Headless Chrome on macOS often writes the screenshot and then never exits, so
  // each run gets its own profile and is killed as soon as the PNG is on disk
  // (40 s cap, 3 tries).
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (existsSync(png)) rmSync(png);
    const profile = mkdtempSync(join(tmpdir(), 'nl-chrome-'));
    await shoot(profile, w, h, png, pathToFileURL(file).href);
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* helper still exiting; tmp is cleaned by the OS */ }
    if (existsSync(png) && statSync(png).size > 0) break;
    if (attempt === 3) throw new Error(`Chrome produced no screenshot for ${name}`);
  }
  let q = 82, size = Infinity;
  while (q >= 60) {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), png, '--out', jpg], { stdio: 'ignore' });
    size = statSync(jpg).size;
    if (size <= MAX_BYTES) break;
    q -= 4;
  }
  rmSync(png);
  console.log(`${name}.jpg  ${w}x${h}  q${q}  ${Math.round(size / 1024)} KB${size > MAX_BYTES ? '  (OVER 180 KB)' : ''}`);
}

function shoot(profile, w, h, png, url) {
  return new Promise(resolve => {
    const child = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
      '--allow-file-access-from-files', '--run-all-compositor-stages-before-draw',
      `--window-size=${w},${h}`, `--screenshot=${png}`, url,
    ], { stdio: 'ignore', detached: true });
    let last = -1;
    const started = Date.now();
    const timer = setInterval(() => {
      const size = existsSync(png) ? statSync(png).size : 0;
      const stable = size > 0 && size === last;
      last = size;
      if (stable || Date.now() - started > 40000) { clearInterval(timer); try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
    }, 500);
    child.on('exit', () => { clearInterval(timer); resolve(); });
  });
}
