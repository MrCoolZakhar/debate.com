import fs from 'fs';
const [src, map, lockup, emblem, out] = process.argv.slice(2);
let html = fs.readFileSync(src, 'utf8');
const lock = 'data:image/webp;base64,' + fs.readFileSync(lockup).toString('base64');
let n = 0; const em0 = fs.readFileSync(emblem, "utf8").replace(/<\?xml[^>]*>/, '').replace('width="120" height="120"', 'width="40" height="40"');
const em = em0; html = html.replace("__MAP__", fs.readFileSync(map, "utf8")).replace("__LOCKUP__", lock).replace(/__EMBLEM__/g, () => { n++; return em.replaceAll("crisisSeal", "crisisSeal" + n); });
fs.writeFileSync(out, html);
console.log('bytes', html.length);
