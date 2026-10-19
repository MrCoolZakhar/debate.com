// Announce every URL in the live sitemap to IndexNow (Bing, Yandex, Naver,
// Seznam; Google does not use IndexNow) in one request. Run it after a deploy
// to production that changed many pages (blog rewrites, new hubs):
//
//   node scripts/indexnow-sitemap.mjs            # sends
//   node scripts/indexnow-sitemap.mjs --dry      # lists what it would send
//
// The key is public by design: IndexNow checks ownership by fetching
// https://gavelling.com/<key>.txt (public/<key>.txt). Same key as
// src/app/api/indexnow/route.ts. Bing Webmaster Tools shows the pings under
// IndexNow (site added 19 Oct 2026 by import from Search Console).

const KEY = '8b2d058420fbf3a0f241bf68224fb156';
const HOST = 'gavelling.com';
const dry = process.argv.includes('--dry');

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).filter((u) => u.startsWith(`https://${HOST}`));
console.log(`${urls.length} URLs in the live sitemap`);
if (dry) { console.log(urls.join('\n')); process.exit(0); }

// The protocol accepts up to 10,000 URLs per request.
for (let i = 0; i < urls.length; i += 10000) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(i, i + 10000) }),
  });
  console.log(`batch ${i / 10000 + 1}: HTTP ${res.status}`);
}
