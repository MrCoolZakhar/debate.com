// Dev only: restart the `next dev` worker when it grows too big (30 Oct 2026).
//
// On Peter's 8 GB MacBook a `next dev` server grew to 6 to 8 GB over a working
// session (it caused a kernel panic on 21 Oct 2026). Measured on 30 Oct: about
// 0.6 GB of that is the JS heap and the rest is Turbopack's native memory,
// which `experimental.turbopackMemoryLimit` does not hold (the same 18 pages
// ended at 2.6 GB with a 1 GB or a 2 GB target). What does hold is Next's own
// restart: a worker that exits with code 77 is started again by `next dev` on
// the same port, and the Turbopack disk cache brings it back at about 0.5 GB
// with pages served in 1 to 4 s.
//
// So every 30 s this checks the worker's memory and, after two readings in a
// row over the limit, exits with 77. The limit is 3/8 of the machine's RAM
// (3 GB on 8 GB, 6 GB on 16 GB), just under where Peter's memory guard
// starts warning. NEXT_DEV_RESTART_MB overrides it in MB; 0 turns it off.
// Never runs in production or `next build`: only inside the dev worker.

import { execFile } from 'node:child_process';
import os from 'node:os';

const RESTART_EXIT_CODE = 77; // next/dist/server/lib/utils.js
const CHECK_EVERY_MS = 30_000;
const MIN_UPTIME_S = 300;

function limitBytes(): number {
  const raw = process.env.NEXT_DEV_RESTART_MB;
  if (raw !== undefined && raw !== '') {
    const mb = Number(raw);
    return Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : 0;
  }
  return Math.floor((os.totalmem() * 3) / 8);
}

const UNITS: Record<string, number> = { B: 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3 };

/** Physical footprint as Activity Monitor and the memory guard count it
 *  (swapped and compressed pages included); RSS elsewhere or on failure. */
function readMemory(): Promise<number> {
  const rss = process.memoryUsage.rss();
  if (process.platform !== 'darwin') return Promise.resolve(rss);
  return new Promise((resolve) => {
    execFile(
      '/usr/bin/top',
      ['-l', '1', '-pid', String(process.pid), '-stats', 'mem'],
      { timeout: 5_000 },
      (err, stdout) => {
        const last = String(stdout ?? '').trim().split('\n').pop() ?? '';
        const m = /^([\d.]+)([BKMG])/.exec(last.replace(/[+-]/g, ''));
        resolve(err || !m ? rss : Number(m[1]) * UNITS[m[2]]);
      },
    );
  });
}

export function startDevMemoryRestart(): void {
  const limit = limitBytes();
  if (!limit) return;
  let over = 0;
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const used = await readMemory();
      over = used > limit ? over + 1 : 0;
      // A fresh worker re-reads its cache and one heavy page brings it to
      // about 2.2 GB, so never restart within 5 minutes of starting: a limit
      // set too low can then never turn into a restart every minute.
      if (over >= 2 && process.uptime() > MIN_UPTIME_S) {
        const gb = (n: number) => (n / 1024 ** 3).toFixed(1);
        console.warn(
          `\n⚠ Dev server is using ${gb(used)} GB (limit ${gb(limit)} GB), restarting it to free memory...\n`,
        );
        process.exit(RESTART_EXIT_CODE);
      }
    } finally {
      busy = false;
    }
  }, CHECK_EVERY_MS);
  timer.unref();
}
