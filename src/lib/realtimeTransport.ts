// supabase-js builds its Realtime client inside createClient, and realtime-js throws
// "Unknown JavaScript runtime without WebSocket support" right there when the browser
// has no WebSocket (some bots, locked-down or privacy browsers, old embedded web views).
// That throw happened at page load and blanked the whole page (crash_alerts, Nov 2026,
// on public conference pages). Where WebSocket is missing we hand realtime a socket that
// is closed from the start: reads and writes over HTTP keep working, live updates simply
// never arrive, and realtime keeps retrying quietly in the background.

class ClosedSocket {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly readyState = 3;
  readonly protocol = '';
  readonly url: string;
  binaryType = 'arraybuffer';
  bufferedAmount = 0;
  extensions = '';
  onopen: ((ev: Event) => unknown) | null = null;
  onmessage: ((ev: MessageEvent) => unknown) | null = null;
  onclose: ((ev: CloseEvent) => unknown) | null = null;
  onerror: ((ev: Event) => unknown) | null = null;

  constructor(url: string) {
    this.url = url;
    // Report the failed connection the way a real socket would, after the caller has
    // attached its handlers, so realtime takes its normal reconnect-later path.
    setTimeout(() => {
      try { this.onerror?.({ type: 'error' } as Event); } catch { /* nothing to report to */ }
      try { this.onclose?.({ type: 'close', code: 1006, reason: 'WebSocket unavailable', wasClean: false } as CloseEvent); } catch { /* same */ }
    }, 0);
  }

  close(): void {}
  send(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}

/** Options to spread into createClient(): empty where WebSocket exists, a closed socket where it does not. */
export function realtimeFallback(): { realtime?: { transport: typeof WebSocket } } {
  if (typeof globalThis.WebSocket !== 'undefined') return {};
  return { realtime: { transport: ClosedSocket as unknown as typeof WebSocket } };
}
