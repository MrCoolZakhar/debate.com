// downloadCvPdf — make the PDF of a MUN CV and save it. @react-pdf/renderer and
// CvPdf are loaded here, with a dynamic import, only when someone presses
// Download PDF, so no page carries the renderer (same pattern as
// downloadMoneyDocument). It builds the PDF ONLY from the entries and profile
// the page already holds; nothing is read from the server except the two
// images the page already shows (the avatar and the round flag).

import { createElement } from 'react';
import { sortCvEntries, yearFromName } from '@/lib/cvOrder';
import { ENTRY_TYPE_MAP, type CVEntry } from '@/components/CVEntryModal';
import { committeeLabel, conferenceDisplay } from '@/app/account/cv/CVTimeline';
import { awardTier } from '@/app/account/accountUi';
import { getCircleFlagUrl, getCountryByName } from '@/lib/countries';
import type { CvPdfEntry, CvPdfModel } from './cvPdfModel';

export interface CvPdfInput {
  name: string;
  avatarUrl: string | null;
  /** Country name, or null (also null when the owner hides their nationality). */
  nationality: string | null;
  /** ONLY the entries a visitor to the public CV would see (never a hidden one). */
  entries: CVEntry[];
  /** The live public CV link, or '' when the CV is private. */
  shareUrl: string;
}

/** A square PNG data URL of an image (cover-fit), or null when it cannot be read (CORS, a broken file). */
async function imageAsPng(url: string | null, size: number): Promise<string | null> {
  if (!url) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image'));
    });
    img.src = url;
    await Promise.race([loaded, new Promise<void>((_, reject) => setTimeout(() => reject(new Error('image timeout')), 6000))]);
    const w = img.naturalWidth || size;
    const h = img.naturalHeight || size;
    const side = Math.min(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/png');
  } catch {
    // A picture that cannot be read leaves the PDF with an initials disc or no flag; never a failed download.
    return null;
  }
}

function entryModel(e: CVEntry): CvPdfEntry {
  const type = ENTRY_TYPE_MAP[e.entry_type] ?? ENTRY_TYPE_MAP.delegate;
  const isDelegation = e.entry_type === 'faculty-advisor';
  const awardNames = (e.entry_type === 'delegate' || e.entry_type === 'chair' || isDelegation)
    ? (e.awards.length > 0 ? e.awards : (e.award && e.award !== 'None' ? [e.award] : []))
    : [];
  const disp = conferenceDisplay(e.conference_name, e.event_date);
  const dated = e.event_date ? new Date(`${e.event_date}T00:00:00`) : null;
  const nameYear = yearFromName(e.conference_name);
  const year = dated ? String(dated.getFullYear()) : nameYear ? String(nameYear) : null;
  const dateLabel = dated
    ? dated.toLocaleDateString('en', { month: 'short', year: 'numeric' })
    : year;
  const showsCommittee = e.entry_type === 'delegate' || e.entry_type === 'chair';
  return {
    id: e.id,
    roleLabel: type.label.charAt(0) + type.label.slice(1).toLowerCase(),
    accent: type.chipInk,
    dateLabel,
    year,
    conference: disp.primary,
    conferenceFull: disp.secondary,
    committee: showsCommittee && e.committee ? committeeLabel(e.committee) : null,
    allocation: e.allocation?.trim() || null,
    description: e.description?.trim() || null,
    awards: awardNames.map((name) => ({ name, tier: isDelegation ? 'special' : awardTier(name) })),
    verified: e.source === 'gavelling_verified',
  };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** The one-line summary under the name. */
function summaryLine(entries: CVEntry[]): string {
  const awards = entries.reduce((sum, e) => sum + (e.awards.length > 0 ? e.awards.length : (e.award && e.award !== 'None' ? 1 : 0)), 0);
  const committees = new Set(entries.map((e) => (e.committee ?? '').trim().toLowerCase()).filter(Boolean)).size;
  const verified = entries.filter((e) => e.source === 'gavelling_verified').length;
  const parts = [plural(entries.length, 'conference', 'conferences'), plural(awards, 'award', 'awards')];
  if (committees > 0) parts.push(plural(committees, 'committee', 'committees'));
  if (verified > 0) parts.push(`${verified} verified by Gavelling`);
  return parts.join('  ·  ');
}

export function cvPdfFileName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() || 'Delegate';
  return `${clean} MUN CV.pdf`;
}

/** Renders the PDF and saves it. Resolves false when the PDF could not be made. */
export async function downloadCvPdf(input: CvPdfInput): Promise<boolean> {
  try {
    const origin = window.location.origin;
    const country = input.nationality ? getCountryByName(input.nationality) : undefined;
    const entries = sortCvEntries(input.entries);
    const [{ pdf }, { default: CvPdf }, avatarSrc, flagSrc] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./CvPdf'),
      imageAsPng(input.avatarUrl, 320),
      imageAsPng(getCircleFlagUrl(country?.code), 96),
    ]);
    const model: CvPdfModel = {
      name: input.name,
      nationality: country?.name ?? null,
      flagSrc,
      avatarSrc,
      summary: summaryLine(entries),
      shareUrl: input.shareUrl,
      entries: entries.map(entryModel),
    };
    const assets = { header: `${origin}/cv/cv-header.jpg`, lockup: `${origin}/cv/gavelling-lockup.png`, mark: `${origin}/cv/gavelling-mark.png` };
    const blob = await pdf(createElement(CvPdf, { model, assets }) as Parameters<typeof pdf>[0]).toBlob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = cvPdfFileName(input.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 30_000);
    return true;
  } catch (e) {
    console.warn('[cv pdf] the PDF could not be made', e);
    return false;
  }
}

export const CV_PDF_FAILED = 'The PDF could not be made. Try again in a moment.';
