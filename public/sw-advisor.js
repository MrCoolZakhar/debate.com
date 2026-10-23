/*
 * Gavelling: faculty advisor alerts (23 Oct 2026).
 *
 * Registered ONLY by the advisor board (/advisor), with scope '/advisor', so it never
 * controls any other page of the site. It has NO fetch handler: no caching, no offline
 * behaviour, nothing between the site and the network. Two jobs:
 *   push               show "Maya speaks next" from the encrypted payload the
 *                      advisor-push edge function sent (src/lib/advisorBoard/push.ts);
 *   notificationclick  focus an open board, or open /advisor.
 *
 * Wording and first names come from this phone's own IndexedDB (written by the board in
 * its current language): names typed on this phone never leave it. Without them the
 * English wording below and the delegation's name are used.
 */

const DB_NAME = 'gavelling-advisor-push';
const STORE = 'kv';

const EN = {
  speaking: '{name} is speaking now',
  speaking_many: '{name} are speaking now',
  next: '{name} speaks next',
  next_many: '{name} speak next',
  soon: '{name} is {n} speakers away',
  soon_many: '{name} are {n} speakers away',
  test_title: 'Alerts are on for this phone',
  test_body: 'We will tell you here when your student is about to speak.',
};

function readLocal() {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const db = open.result;
          const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('local');
          req.onsuccess = () => { resolve(req.result || null); db.close(); };
          req.onerror = () => { resolve(null); db.close(); };
        } catch { resolve(null); }
      };
    } catch { resolve(null); }
  });
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

function joinNames(names, lang) {
  try { return new Intl.ListFormat(lang || 'en', { style: 'long', type: 'conjunction' }).format(names); }
  catch { return names.join(' & '); }
}

async function boardIsVisible() {
  try {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    return list.some((c) => c.visibilityState === 'visible' && new URL(c.url).pathname.startsWith('/advisor'));
  } catch { return false; }
}

async function showFor(data) {
  const local = (await readLocal()) || {};
  const t = Object.assign({}, EN, local.templates || {});
  const lang = local.lang || 'en';
  let title;
  let body;
  if (data.kind === 'test') {
    title = t.test_title;
    body = t.test_body;
  } else {
    const country = typeof data.country === 'string' ? data.country : '';
    const fromServer = Array.isArray(data.names) ? data.names.filter((n) => typeof n === 'string' && n.trim()) : [];
    const fromPhone = local.names && Array.isArray(local.names[data.seat]) ? local.names[data.seat] : [];
    const names = fromServer.length ? fromServer : fromPhone;
    const who = names.length ? joinNames(names, lang) : country;
    const many = names.length > 1;
    const ahead = Number(data.ahead) || 0;
    if (data.kind === 'speaking') title = fill(many ? t.speaking_many : t.speaking, { name: who });
    else if (ahead <= 1) title = fill(many ? t.next_many : t.next, { name: who });
    else title = fill(many ? t.soon_many : t.soon, { name: who, n: ahead });
    body = [names.length ? country : '', data.committee, data.conference].filter((x) => typeof x === 'string' && x).join(' · ');
  }
  // The board on screen already chimes and shows its banner: stay quiet there.
  const silent = await boardIsVisible();
  return self.registration.showNotification(title, {
    body,
    tag: 'gavelling-advisor|' + (typeof data.seat === 'string' ? data.seat : 'test'),
    renotify: true,
    silent,
    lang,
    dir: local.dir === 'rtl' ? 'rtl' : 'auto',
    icon: '/android-chrome-192x192.png',
    badge: '/gavelling-mark.png',
    timestamp: Date.now(),
    data: { url: '/advisor' },
  });
}

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(showFor(data || {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const board = list.find((c) => new URL(c.url).pathname.startsWith('/advisor'));
    if (board) return board.focus();
    return self.clients.openWindow('/advisor');
  })());
});
