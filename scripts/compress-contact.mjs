import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

await sharp(path.join(publicDir, 'Contact-Hero.png'))
  .resize(900, null, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85, alphaQuality: 100, effort: 6 })
  .toFile(path.join(publicDir, 'Contact-Hero.webp'));

console.log('Done — check /public/Contact-Hero.webp');
