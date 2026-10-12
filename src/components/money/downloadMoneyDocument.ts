// downloadMoneyDocument — make the PDF of a MoneyDoc and save it (prompt 98).
// @react-pdf/renderer and MoneyDocumentPdf are loaded here, with a dynamic
// import, only when someone presses Download, so no page carries the renderer.

import { createElement } from 'react';
import { docFileName, type MoneyDoc } from './moneyDocument';

/** The conference logo as a PNG data URL (the PDF takes PNG or JPEG only), or null when it cannot be read. */
async function logoAsPng(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo'));
    });
    img.src = url;
    await Promise.race([loaded, new Promise<void>((_, reject) => setTimeout(() => reject(new Error('logo timeout')), 6000))]);
    const size = 240;
    const scale = Math.min(size / (img.naturalWidth || size), size / (img.naturalHeight || size));
    const w = Math.max(1, Math.round((img.naturalWidth || size) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || size) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } catch {
    // A logo that cannot be read (CORS, a broken file) leaves the document without it; never a failed download.
    return null;
  }
}

/** Renders the PDF and saves it. Resolves false when the PDF could not be made. */
export async function downloadMoneyDocument(doc: MoneyDoc): Promise<boolean> {
  try {
    const [{ pdf }, { default: MoneyDocumentPdf }, logoSrc] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./MoneyDocumentPdf'),
      logoAsPng(doc.conference.logo_url),
    ]);
    const blob = await pdf(createElement(MoneyDocumentPdf, { doc, logoSrc }) as Parameters<typeof pdf>[0]).toBlob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = docFileName(doc);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 30_000);
    return true;
  } catch (e) {
    console.warn('[money document] the PDF could not be made', e);
    return false;
  }
}

export const DOWNLOAD_FAILED = 'The PDF could not be made. Try again in a moment.';
