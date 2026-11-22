// What a conference needs before it can be public (owner, 22 Nov 2026): a logo, a banner and
// at least one committee. The creation wizard asks for all three before the conference exists;
// this is the same rule for every later Publish (the manage header and the Settings switch), so
// an older conference without them is told what is missing instead of going live half set up.

import type { getAuthedClient } from '@/lib/supabase-auth';

type Client = ReturnType<typeof getAuthedClient>;

export interface PublishFacts {
  logo_url?: string | null;
  banner_url?: string | null;
}

/** The missing items, in plain words ("a logo", "a banner", "a committee"). */
export function publishMissing(conf: PublishFacts, committeeCount: number): string[] {
  const missing: string[] = [];
  if (!conf.logo_url?.trim()) missing.push('a logo');
  if (!conf.banner_url?.trim()) missing.push('a banner');
  if (committeeCount < 1) missing.push('a committee');
  return missing;
}

/** "Add a logo and a banner before publishing." / null when nothing is missing. */
export function publishBlockSentence(missing: string[]): string | null {
  if (missing.length === 0) return null;
  const list = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return `Add ${list} before publishing.`;
}

/**
 * Counts the committees and answers what is still missing. `error` is set when the count could
 * not be read; the caller then refuses with its own "try again" sentence (never publishes blind).
 */
export async function checkPublishReady(
  client: Client,
  conferenceId: string,
  conf: PublishFacts,
): Promise<{ missing: string[]; sentence: string | null; error: unknown | null }> {
  const { count, error } = await client
    .from('conference_committees')
    .select('id', { count: 'exact', head: true })
    .eq('conference_id', conferenceId);
  if (error) return { missing: [], sentence: null, error };
  const missing = publishMissing(conf, count ?? 0);
  return { missing, sentence: publishBlockSentence(missing), error: null };
}
