'use client';

// ── The share card pop-up for a job listing (/jobs) ─────────────────────────
//
// The purchase pop-up shell (src/components/purchase/purchaseKit.tsx), one
// column, never a pop-up on a pop-up. It draws the listing as an image on a
// canvas, in the browser, in two sizes: Post (1080 x 1350) and Story
// (1080 x 1920), switched with two pills. The card, on the forest ground:
//   the conference's logo (a monogram disc when it has none or it cannot be
//   read), its short name, "Now hiring · <role>", the title large, the
//   committee, the dates and place, up to three offer chips, and at the foot a
//   QR code beside "Apply on Gavelling", "gavelling.com/jobs" and the
//   Gavelling lockup (the image, never typed, in its own colours on an ivory
//   capsule). The QR and Copy link both point at
//   `${SITE_URL}/jobs?listing=<id>&ref=share`.
//
// Text never overflows: every block is measured, wrapped and shrunk to fit,
// and the title takes whatever height is left between the header and the
// foot. The canvas never taints: the conference logo is fetched as a blob and
// drawn from an object URL (same origin), and any failure (CORS, a 404, a
// slow host, a decode error, a tainting probe) falls back to the monogram.
// `qrcode` is imported inside the pop-up only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Loader2 } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { BRAND_LOGO_SRC } from '@/components/BrandLogo';
import { friendlyError } from '@/lib/friendlyError';
import { SITE_URL } from '@/lib/seo';
import { JOB_ROLE_LABEL, jobOfferChips, type JobCard } from '@/lib/jobBoard';
import { jobDates, jobInitials, jobPlace } from './JobCard';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';
const IVORY = '#F4F1E8';
const IVORY_SOFT = 'rgba(244,241,232,0.74)';
const GOLD = '#EED98A';
const DANGER = '#9E2A12';

type SizeKey = 'post' | 'story';
const SIZES: Record<SizeKey, { w: number; h: number; label: string }> = {
  post: { w: 1080, h: 1350, label: 'Post' },
  story: { w: 1080, h: 1920, label: 'Story' },
};

/** The visible lockup inside public/gavelling-logo-ecosystem.png (1920 x 1080 canvas with padding). */
const LOCKUP_CROP = { x: 80, y: 305, w: 1690, h: 430 };

interface Assets {
  logo: HTMLImageElement | null;
  brand: HTMLImageElement | null;
  family: string;
}

export default function ShareCardPopup({ card, onClose }: { card: JobCard; onClose: () => void }) {
  const [size, setSize] = useState<SizeKey>('post');
  const [ready, setReady] = useState(false);
  const [drawErr, setDrawErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetsRef = useRef<Promise<Assets> | null>(null);
  const drawSeq = useRef(0);
  const busyRef = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const link = useMemo(
    () => `${SITE_URL}/jobs?listing=${encodeURIComponent(card.id)}&ref=share`,
    [card.id],
  );

  const draw = useCallback(async (which: SizeKey) => {
    const seq = ++drawSeq.current;
    setReady(false);
    setDrawErr('');
    try {
      if (!assetsRef.current) assetsRef.current = loadAssets(card.conference.logo_url);
      const assets = await assetsRef.current;
      const { w, h } = SIZES[which];
      // Drawn off screen, then copied in one go, so a slow draw never shows half a card.
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      await paintCard(off, which, card, link, assets);
      if (seq !== drawSeq.current) return;
      const target = canvasRef.current;
      if (!target) return;
      target.width = w;
      target.height = h;
      const ctx = target.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(off, 0, 0);
      setReady(true);
    } catch (e) {
      if (seq !== drawSeq.current) return;
      setDrawErr(friendlyError(e, 'We could not draw the card. Try again.'));
    }
  }, [card, link]);

  useEffect(() => { void draw(size); }, [draw, size]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    drawSeq.current += 1;
  }, []);

  async function download() {
    if (busyRef.current || !ready) return;
    busyRef.current = true;
    setBusy(true);
    setSaveErr('');
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('canvas');
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        try { canvas.toBlob(resolve, 'image/png'); } catch (err) { reject(err); }
      });
      if (!blob) throw new Error('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName(card);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setSaveErr(friendlyError(e, 'We could not save the image. Try again.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard');
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  const { w, h } = SIZES[size];

  return (
    <PurchaseShell tone="light" label="Share this listing" onClose={onClose} panelClass="gv-share" testId="job-share">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-share-col">
        <header className="gv-share-head">
          <h2 className="gv-share-title">Share This Listing</h2>
        </header>

        <div className="gv-share-switch" role="radiogroup" aria-label="Image size">
          {(Object.keys(SIZES) as SizeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={size === k}
              className="gv-share-pill"
              onClick={() => setSize(k)}
            >
              {SIZES[k].label}
            </button>
          ))}
        </div>

        <div className="gv-share-stage">
          <div
            className="gv-share-frame"
            style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(60vh * ${w} / ${h}))` }}
          >
            <canvas
              ref={canvasRef}
              width={w}
              height={h}
              className="gv-share-canvas"
              style={{ visibility: ready ? 'visible' : 'hidden' }}
              role="img"
              aria-label={`Share image for ${card.title}`}
            />
            {!ready && !drawErr && <div className="gv-share-skel" aria-hidden />}
            {drawErr && (
              <div className="gv-share-fail" role="alert">
                <p>{drawErr}</p>
                <button type="button" className="gv-share-second" onClick={() => { void draw(size); }}>Try again</button>
              </div>
            )}
          </div>
        </div>

        {saveErr && <p role="alert" className="gv-share-err">{saveErr}</p>}
        {copyFailed && (
          <div className="gv-share-manual">
            <p className="gv-share-manual-line">Copy the link yourself</p>
            <input
              readOnly
              value={link}
              className="gv-share-input"
              aria-label="Listing link"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}

        <div className="gv-share-actions">
          <button type="button" className="gv-share-second" onClick={() => { void copyLink(); }}>
            {copied
              ? <><Check size={16} strokeWidth={2.4} aria-hidden /> Copied</>
              : <><Copy size={16} strokeWidth={2.2} aria-hidden /> Copy link</>}
          </button>
          <button
            type="button"
            className="gv-share-main"
            onClick={() => { void download(); }}
            disabled={busy || !ready}
            aria-busy={busy || undefined}
          >
            {busy
              ? <><Loader2 size={17} className="animate-spin" aria-hidden /> Saving</>
              : <><Download size={17} strokeWidth={2.3} aria-hidden /> Download image</>}
          </button>
        </div>
      </div>
    </PurchaseShell>
  );
}

// ── Assets ──────────────────────────────────────────────────────────────────

async function loadAssets(logoUrl: string | null): Promise<Assets> {
  const family = (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'sans-serif';
  const fonts = (async () => {
    try {
      await Promise.all([500, 600, 700, 800].map((wt) => document.fonts.load(`${wt} 40px ${family}`)));
      await document.fonts.ready;
    } catch {
      // The system font is drawn instead; nothing to tell the person.
    }
  })();
  const [logo, brand] = await Promise.all([loadLogo(logoUrl), loadImage(BRAND_LOGO_SRC).catch(() => null), fonts]);
  return { logo, brand, family };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** The conference logo through fetch → blob → object URL, so it can never taint the canvas. Null on ANY failure. */
async function loadLogo(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  let objectUrl: string | null = null;
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') && blob.type !== '') return null;
    objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image'));
      img.src = objectUrl as string;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    // Probe: reading a pixel back throws on a tainted canvas.
    const probe = document.createElement('canvas');
    probe.width = 2;
    probe.height = 2;
    const pctx = probe.getContext('2d');
    if (!pctx) return null;
    pctx.drawImage(img, 0, 0, 2, 2);
    pctx.getImageData(0, 0, 1, 1);
    return img;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    // The decoded image stays drawable after the URL is revoked.
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl as string), 0);
  }
}

// ── Drawing ─────────────────────────────────────────────────────────────────

async function paintCard(canvas: HTMLCanvasElement, which: SizeKey, card: JobCard, link: string, a: Assets) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const { w: W, h: H } = SIZES[which];
  const story = which === 'story';
  const fam = a.family;
  const font = (wt: number, px: number) => `${wt} ${px}px ${fam}`;

  // Ground: flat forest with one soft glow in the top corner.
  ctx.fillStyle = FOREST;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.92, H * 0.04, 0, W * 0.92, H * 0.04, W * 0.95);
  glow.addColorStop(0, 'rgba(42,90,60,0.85)');
  glow.addColorStop(1, 'rgba(42,90,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const P = 88;
  const top = story ? 210 : P;
  const bottom = story ? 270 : P;
  const innerW = W - P * 2;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // ── Header: logo disc and the conference short name.
  const D = story ? 150 : 128;
  drawLogoDisc(ctx, a.logo, jobInitials(card.conference), P, top, D, font);
  const conf = card.conference;
  const nameText = (conf.short || conf.name || '').trim();
  const nameX = P + D + 32;
  const nameW = W - P - nameX;
  if (nameText) {
    const fit = fitText(ctx, nameText, { weight: 700, max: story ? 54 : 48, min: 24, maxLines: 2, maxW: nameW, maxH: D, lh: 1.12 }, font);
    const blockH = fit.lines.length * fit.size * 1.12;
    let y = top + (D - blockH) / 2 + fit.size * 0.9;
    ctx.fillStyle = IVORY;
    ctx.font = font(700, fit.size);
    for (const line of fit.lines) { ctx.fillText(line, nameX, y); y += fit.size * 1.12; }
  }

  // ── Foot: QR tile, the call to action and the lockup.
  const Q = story ? 300 : 248;
  const footTop = H - bottom - Q;
  const qr = await makeQr(link, Q - 36);
  roundRect(ctx, P, footTop, Q, Q, 28);
  ctx.fillStyle = IVORY;
  ctx.fill();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, P + 18, footTop + 18, Q - 36, Q - 36);
  ctx.imageSmoothingEnabled = true;

  const colX = P + Q + 40;
  const colW = W - P - colX;
  const cta = fitText(ctx, 'Apply on Gavelling', { weight: 800, max: story ? 58 : 52, min: 28, maxLines: 2, maxW: colW, maxH: 140, lh: 1.08 }, font);
  let cy = footTop + cta.size * 0.95;
  ctx.fillStyle = IVORY;
  ctx.font = font(800, cta.size);
  for (const line of cta.lines) { ctx.fillText(line, colX, cy); cy += cta.size * 1.08; }
  const url = fitText(ctx, 'gavelling.com/jobs', { weight: 600, max: story ? 38 : 34, min: 20, maxLines: 1, maxW: colW, maxH: 60, lh: 1.2 }, font);
  cy += url.size * 0.35;
  ctx.fillStyle = GOLD;
  ctx.font = font(600, url.size);
  ctx.fillText(url.lines[0] ?? '', colX, cy);

  if (a.brand) {
    const capH = story ? 92 : 80;
    const padX = 26;
    const padY = 16;
    const imgH = capH - padY * 2;
    let imgW = imgH * (LOCKUP_CROP.w / LOCKUP_CROP.h);
    let drawH = imgH;
    if (imgW + padX * 2 > colW) { imgW = colW - padX * 2; drawH = imgW * (LOCKUP_CROP.h / LOCKUP_CROP.w); }
    const capW = imgW + padX * 2;
    const capY = footTop + Q - capH;
    roundRect(ctx, colX, capY, capW, capH, capH / 2);
    ctx.fillStyle = IVORY;
    ctx.fill();
    ctx.drawImage(a.brand, LOCKUP_CROP.x, LOCKUP_CROP.y, LOCKUP_CROP.w, LOCKUP_CROP.h, colX + padX, capY + (capH - drawH) / 2, imgW, drawH);
  }

  // ── Middle: eyebrow, title, committee, dates and place, chips.
  const midTop = top + D + (story ? 110 : 64);
  const midBottom = footTop - (story ? 90 : 56);

  const eyebrowPx = story ? 38 : 34;
  const eyebrow = fitText(ctx, `Now hiring · ${JOB_ROLE_LABEL[card.role] ?? 'Team'}`, { weight: 600, max: eyebrowPx, min: 22, maxLines: 1, maxW: innerW, maxH: 80, lh: 1.25 }, font);
  const eyebrowH = eyebrow.size * 1.25;

  const metaPx = story ? 38 : 34;
  const committeeFit = card.committee?.trim()
    ? fitText(ctx, card.committee.trim(), { weight: 500, max: story ? 42 : 36, min: 22, maxLines: 2, maxW: innerW, maxH: 120, lh: 1.25 }, font)
    : null;
  const metaLines = [jobDates(conf), jobPlace(conf)].filter((s) => s && s.trim());
  const metaFits = metaLines.map((m) => fitText(ctx, m, { weight: 500, max: metaPx, min: 20, maxLines: 2, maxW: innerW, maxH: 110, lh: 1.25 }, font));

  const chips = jobOfferChips(card.offers).slice(0, 3).map((c) => c.label);
  const chipPx = story ? 32 : 29;
  const chipH = Math.round(chipPx * 2.15);
  const chipRows = layoutChips(ctx, chips, chipPx, innerW, font);
  const chipsH = chipRows.length ? chipRows.length * chipH + (chipRows.length - 1) * 14 : 0;

  const gapTitle = story ? 26 : 18;
  const gapAfterTitle = story ? 34 : 26;
  const gapMeta = story ? 34 : 24;
  const gapChips = story ? 44 : 32;
  const committeeH = committeeFit ? committeeFit.lines.length * committeeFit.size * 1.25 : 0;
  const metaH = metaFits.reduce((s, f) => s + f.lines.length * f.size * 1.25, 0);

  let includeCommittee = !!committeeFit;
  const fixedH = (withCommittee: boolean) =>
    eyebrowH + gapTitle + gapAfterTitle
    + (withCommittee ? committeeH + gapMeta : 0)
    + metaH + (chipsH ? gapChips + chipsH : 0);
  const titleMin = 40;
  let titleRoom = midBottom - midTop - fixedH(includeCommittee);
  if (includeCommittee && titleRoom < titleMin * 1.06 * 2) {
    includeCommittee = false;
    titleRoom = midBottom - midTop - fixedH(false);
  }
  const title = fitText(ctx, card.title.trim() || 'Open role', {
    weight: 800, max: story ? 136 : 112, min: titleMin, maxLines: 3, maxW: innerW, maxH: Math.max(titleRoom, titleMin * 1.06), lh: 1.06,
  }, font);
  const titleH = title.lines.length * title.size * 1.06;

  const contentH = fixedH(includeCommittee) + titleH;
  const spare = Math.max(0, midBottom - midTop - contentH);
  let y = midTop + (story ? spare * 0.4 : spare * 0.25);

  ctx.fillStyle = GOLD;
  ctx.font = font(600, eyebrow.size);
  ctx.fillText(eyebrow.lines[0] ?? '', P, y + eyebrow.size);
  y += eyebrowH + gapTitle;

  ctx.fillStyle = IVORY;
  ctx.font = font(800, title.size);
  for (const line of title.lines) { ctx.fillText(line, P, y + title.size * 0.9); y += title.size * 1.06; }
  y += gapAfterTitle;

  if (includeCommittee && committeeFit) {
    ctx.fillStyle = GOLD;
    ctx.font = font(500, committeeFit.size);
    for (const line of committeeFit.lines) { ctx.fillText(line, P, y + committeeFit.size * 0.95); y += committeeFit.size * 1.25; }
    y += gapMeta;
  }

  ctx.fillStyle = IVORY_SOFT;
  for (const f of metaFits) {
    ctx.font = font(500, f.size);
    for (const line of f.lines) { ctx.fillText(line, P, y + f.size * 0.95); y += f.size * 1.25; }
  }

  if (chipRows.length) {
    y += gapChips;
    for (const row of chipRows) {
      let x = P;
      for (const chip of row) {
        roundRect(ctx, x, y, chip.w, chipH, chipH / 2);
        ctx.fillStyle = 'rgba(238,217,138,0.14)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(238,217,138,0.55)';
        ctx.stroke();
        ctx.fillStyle = GOLD;
        ctx.font = font(600, chip.px);
        ctx.textBaseline = 'middle';
        ctx.fillText(chip.text, x + chip.pad, y + chipH / 2 + 1);
        ctx.textBaseline = 'alphabetic';
        x += chip.w + 14;
      }
      y += chipH + 14;
    }
  }
}

function drawLogoDisc(
  ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, initials: string,
  x: number, y: number, d: number, font: (wt: number, px: number) => string,
) {
  const r = d / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
  ctx.closePath();
  if (logo) {
    ctx.fillStyle = IVORY;
    ctx.fill();
    ctx.clip();
    // Contained with an inset so a square logo's corners stay inside the disc.
    const box = d * 0.74;
    const scale = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
    const lw = logo.naturalWidth * scale;
    const lh = logo.naturalHeight * scale;
    ctx.drawImage(logo, x + (d - lw) / 2, y + (d - lh) / 2, lw, lh);
  } else {
    ctx.fillStyle = GOLD;
    ctx.fill();
    let px = Math.round(d * 0.4);
    ctx.font = font(800, px);
    while (px > 12 && ctx.measureText(initials).width > d * 0.68) {
      px -= 2;
      ctx.font = font(800, px);
    }
    ctx.fillStyle = FOREST;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, x + r, y + r + px * 0.04);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

async function makeQr(text: string, px: number): Promise<HTMLCanvasElement> {
  const mod = await import('qrcode');
  const QR = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const c = document.createElement('canvas');
  await QR.toCanvas(c, text, {
    width: Math.round(px),
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: FOREST, light: IVORY },
  });
  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Words onto lines no wider than maxW; a word wider than a line is broken by characters. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(tryLine).width <= maxW) { line = tryLine; continue; }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxW) { line = word; continue; }
    let chunk = '';
    for (const ch of Array.from(word)) {
      if (ctx.measureText(chunk + ch).width > maxW && chunk) { lines.push(chunk); chunk = ch; } else chunk += ch;
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest size from max to min at which the text fits maxLines and maxH; at min, the last line ends with an ellipsis. */
function fitText(
  ctx: CanvasRenderingContext2D, text: string,
  o: { weight: number; max: number; min: number; maxLines: number; maxW: number; maxH: number; lh: number },
  font: (wt: number, px: number) => string,
): { size: number; lines: string[] } {
  for (let px = o.max; px >= o.min; px -= 2) {
    ctx.font = font(o.weight, px);
    const lines = wrapText(ctx, text, o.maxW);
    if (lines.length <= o.maxLines && lines.length * px * o.lh <= o.maxH) return { size: px, lines };
  }
  const px = o.min;
  ctx.font = font(o.weight, px);
  const fitLines = Math.max(1, Math.min(o.maxLines, Math.floor(o.maxH / (px * o.lh))));
  const all = wrapText(ctx, text, o.maxW);
  if (all.length <= fitLines) return { size: px, lines: all };
  const kept = all.slice(0, fitLines);
  let last = `${kept[fitLines - 1]} ${all.slice(fitLines).join(' ')}`;
  while (last.length > 1 && ctx.measureText(`${last}…`).width > o.maxW) last = last.slice(0, -1).trimEnd();
  kept[fitLines - 1] = `${last}…`;
  return { size: px, lines: kept };
}

function layoutChips(
  ctx: CanvasRenderingContext2D, labels: string[], basePx: number, maxW: number,
  font: (wt: number, px: number) => string,
): { text: string; w: number; px: number; pad: number }[][] {
  const rows: { text: string; w: number; px: number; pad: number }[][] = [];
  let row: { text: string; w: number; px: number; pad: number }[] = [];
  let used = 0;
  for (const label of labels) {
    let px = basePx;
    const pad = Math.round(basePx * 0.9);
    ctx.font = font(600, px);
    let text = label;
    while (px > 18 && ctx.measureText(text).width + pad * 2 > maxW) { px -= 1; ctx.font = font(600, px); }
    while (text.length > 1 && ctx.measureText(text).width + pad * 2 > maxW) text = `${text.slice(0, -2).trimEnd()}…`;
    const w = Math.ceil(ctx.measureText(text).width + pad * 2);
    if (row.length && used + 14 + w > maxW) { rows.push(row); row = []; used = 0; }
    row.push({ text, w, px, pad });
    used += (row.length > 1 ? 14 : 0) + w;
  }
  if (row.length) rows.push(row);
  return rows;
}

function fileName(card: JobCard): string {
  const slug = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const short = slug(card.conference.short || card.conference.name || '');
  const title = slug(card.title || '');
  const base = [short, title].filter(Boolean).join('-').slice(0, 90).replace(/-+$/g, '');
  return `${base || 'gavelling-job'}.png`;
}

const CSS = `
.gv-buy-panel.gv-share{max-width:560px;min-height:0}
.gv-buy-panel.gv-share .gv-buy-body{display:block}
.gv-share-col{display:flex;flex-direction:column;gap:18px;padding:30px 28px 26px;font-family:${FONT};color:${INK}}
.gv-share-head{padding-right:44px}
.gv-share-title{margin:0;font-size:clamp(22px,2.8vw,28px);font-weight:800;letter-spacing:-0.02em;line-height:1.12;color:${INK};text-wrap:balance}
.gv-share-switch{display:inline-flex;align-self:flex-start;gap:4px;padding:4px;border-radius:999px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.06),0 4px 14px rgba(27,56,40,0.07)}
.gv-share-pill{min-height:38px;padding:0 20px;border:none;border-radius:999px;background:transparent;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK_SOFT};transition:background-color 160ms ease,color 160ms ease}
.gv-share-pill:hover{color:${INK}}
.gv-share-pill[aria-checked="true"]{background:${FOREST};color:#FFFFFF}
.gv-share-stage{display:flex;justify-content:center}
.gv-share-frame{position:relative;max-width:100%;height:auto;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px -10px rgba(27,56,40,0.35)}
.gv-share-canvas{display:block;width:100%;height:100%}
.gv-share-skel{position:absolute;inset:0;background:linear-gradient(90deg,#E4DFD2 0%,#EEEADF 50%,#E4DFD2 100%);background-size:200% 100%;animation:gvShareSkel 1.3s ease-in-out infinite}
@keyframes gvShareSkel{0%{background-position:100% 0}100%{background-position:-100% 0}}
.gv-share-fail{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;text-align:center;background:#EEEADF;font-size:15px;line-height:1.5;color:${INK}}
.gv-share-fail p{margin:0}
.gv-share-err{margin:0;font-size:14px;line-height:1.45;color:${DANGER}}
.gv-share-manual{display:flex;flex-direction:column;gap:8px}
.gv-share-manual-line{margin:0;font-size:14.5px;color:${INK_SOFT}}
.gv-share-input{width:100%;height:46px;padding:0 14px;border-radius:12px;border:1.5px solid rgba(28,20,16,0.14);background:#FFFFFF;font-family:${FONT};font-size:15px;color:${INK}}
.gv-share-input:focus{outline:none;border-color:${FOREST};box-shadow:inset 0 0 0 1px ${FOREST}}
.gv-share-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap}
.gv-share-main{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 24px;border:none;border-radius:11px;cursor:pointer;font-family:${FONT};font-size:16px;font-weight:700;color:#FFFFFF;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);box-shadow:0 6px 16px rgba(27,56,40,0.22);transition:transform 120ms ease,opacity 160ms ease}
.gv-share-main:hover:not(:disabled){transform:translateY(-1px)}
.gv-share-main:disabled{opacity:0.65;cursor:default}
.gv-share-second{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:50px;padding:0 20px;border-radius:11px;border:1.5px solid ${INK};background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK}}
.gv-share :is(button,input):focus{outline:none}
.gv-share :is(button,input):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (max-width:743px){
  .gv-share-col{padding:calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}
  .gv-share-main,.gv-share-second{flex:1 1 auto}
}
`;
