// The data CvPdf draws. Plain values only (no components, no client imports),
// so the PDF file and a plain Node script can both use it.

export type CvPdfAwardTier = 'gold' | 'silver' | 'bronze' | 'special';

export interface CvPdfEntry {
  id: string;
  /** "Delegate", "Chair", "Faculty advisor"... */
  roleLabel: string;
  /** Readable accent colour for the role label. */
  accent: string;
  /** "Mar 2025", or the bare year when only the name carries one, or null. */
  dateLabel: string | null;
  /** The year heading this entry sits under, or null for "Earlier". */
  year: string | null;
  /** The conference as the on-screen CV shows it (acronym first). */
  conference: string;
  /** The spelled-out name, small beneath, when the acronym is shown. */
  conferenceFull: string | null;
  committee: string | null;
  /** The country or position (a delegate's allocation, a chair's dais seat, a role title). */
  allocation: string | null;
  description: string | null;
  awards: { name: string; tier: CvPdfAwardTier }[];
  /** source = gavelling_verified: Gavelling wrote the entry from a published award. */
  verified: boolean;
}

export interface CvPdfModel {
  name: string;
  /** Country name, or null when the owner hides it or there is none. */
  nationality: string | null;
  /** A PNG data URL of the round flag, or null. */
  flagSrc: string | null;
  /** A PNG data URL of the avatar, or null (the PDF draws an initials disc). */
  avatarSrc: string | null;
  /** "7 conferences · 3 awards · 4 committees · 4 verified by Gavelling" */
  summary: string;
  /** The live CV link shown in the footer, or '' when there is none to give. */
  shareUrl: string;
  /** Already ordered like the on-screen CV (newest first). */
  entries: CvPdfEntry[];
}

/** Where the images come from: URLs in the browser, file paths in a script. */
export interface CvPdfAssets {
  header: string;
  lockup: string;
  mark: string;
}
