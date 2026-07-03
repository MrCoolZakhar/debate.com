// MUN experience level is DERIVED from the number of conferences on the
// user's MUN CV (mun_cv_entries count). It is no longer user-editable.
//
//   0-1  Beginner
//   2-4  Intermediate
//   5-8  Advanced
//   9+   Expert
//
// The derived value is mirrored into profiles.mun_experience_level whenever
// CV entries change, because application flows read that column.

import type { SupabaseClient } from '@supabase/supabase-js';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface Band {
  level: ExperienceLevel;
  label: string;
  min: number; // first conference count in this band
}

const BANDS: Band[] = [
  { level: 'beginner',     label: 'Beginner',     min: 0 },
  { level: 'intermediate', label: 'Intermediate', min: 2 },
  { level: 'advanced',     label: 'Advanced',     min: 5 },
  { level: 'expert',       label: 'Expert',       min: 9 },
];

/** Ordered experience bands (beginner→expert). Single source of thresholds. */
export const EXPERIENCE_BANDS: readonly Band[] = BANDS;

export function deriveExperienceLevel(count: number): ExperienceLevel {
  if (count >= 9) return 'expert';
  if (count >= 5) return 'advanced';
  if (count >= 2) return 'intermediate';
  return 'beginner';
}

export interface ExperienceProgress {
  level: ExperienceLevel;
  label: string;
  /** Label of the next band, or null when already Expert. */
  nextLabel: string | null;
  /** Conferences still needed to reach the next band (0 when Expert). */
  remaining: number;
  /** 0..1 progress through the current band toward the next. 1 when Expert. */
  progress: number;
}

export function experienceProgress(count: number): ExperienceProgress {
  const level = deriveExperienceLevel(count);
  const idx = BANDS.findIndex((b) => b.level === level);
  const band = BANDS[idx];
  const next = BANDS[idx + 1] ?? null;
  if (!next) {
    return { level, label: band.label, nextLabel: null, remaining: 0, progress: 1 };
  }
  const span = next.min - band.min;
  return {
    level,
    label: band.label,
    nextLabel: next.label,
    remaining: next.min - count,
    progress: Math.min(1, Math.max(0, (count - band.min) / span)),
  };
}

/** Mirror the derived level into profiles.mun_experience_level (fire-and-forget safe). */
export async function syncExperienceLevel(
  supabase: SupabaseClient,
  userId: string,
  cvEntryCount: number,
): Promise<void> {
  await supabase
    .from('profiles')
    .update({ mun_experience_level: deriveExperienceLevel(cvEntryCount) })
    .eq('id', userId);
}
