import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

await sharp(path.join(publicDir, 'PeterPic.png'))
  .resize(600, 600, { fit: 'cover', position: 'top' })
  .jpeg({ quality: 82, progressive: true })
  .toFile(path.join(publicDir, 'PeterPic.jpg'));

await sharp(path.join(publicDir, 'Christian.png'))
  .resize(600, 600, { fit: 'cover', position: 'top' })
  .jpeg({ quality: 82, progressive: true })
  .toFile(path.join(publicDir, 'Christian.jpg'));

console.log('Done — check /public/PeterPic.jpg and /public/Christian.jpg');
