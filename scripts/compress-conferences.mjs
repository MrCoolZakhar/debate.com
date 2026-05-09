import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

await sharp(path.join(publicDir, 'WIP.png'))
  .resize(840, null, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85 })
  .toFile(path.join(publicDir, 'WIP.webp'));

console.log('Done — check /public/WIP.webp');
