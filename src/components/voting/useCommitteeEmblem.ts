'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { committeeDisplayName, deriveCommitteeAcronym, getCommitteeDisplayName, matchPresetEmblem } from '@/lib/presetNames';
import { emblemMonogram } from '@/components/CommitteeIdentityBadge';

export interface VotingCommitteeIdentity {
  /** Emblem URL, or null for CommitteeEmblem's default (the UN emblem, then initials). */
  src: string | null;
  /** Acronym for a long name, otherwise the name. */
  primary: string;
  /** The full name when `primary` is an acronym. */
  secondary: string | null;
  monogram: string;
}

/**
 * The committee's identity for the voting header: the same resolution as the chair
 * page's masthead (CommitteeIdentityBadge), so both screens wear the same emblem.
 *   1. conference_committees.logo_url, then the conference's logo_url (conference
 *      sessions only; both tables have an anon SELECT policy)
 *   2. matchPresetEmblem(raw name)
 *   3. null: the UN emblem, then gold initials
 */
export function useCommitteeIdentity(
  code: string,
  rawName: string | null | undefined,
  isConference: boolean,
  language: string,
): VotingCommitteeIdentity {
  const [row, setRow] = useState<{ logoUrl: string | null; abbreviation: string | null }>({ logoUrl: null, abbreviation: null });

  useEffect(() => {
    let cancelled = false;
    if (!isConference) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('conference_committees')
          .select('logo_url, abbreviation, conferences(logo_url)')
          .eq('session_code', code.toUpperCase())
          .limit(1)
          .maybeSingle();
        if (cancelled || !data) return;
        const r = data as unknown as {
          logo_url: string | null;
          abbreviation: string | null;
          conferences: { logo_url: string | null } | { logo_url: string | null }[] | null;
        };
        const conf = Array.isArray(r.conferences) ? r.conferences[0] : r.conferences;
        setRow({ logoUrl: r.logo_url || conf?.logo_url || null, abbreviation: r.abbreviation ?? null });
      } catch { /* no row or no read access: preset match, then the UN emblem */ }
    })();
    return () => { cancelled = true; };
  }, [code, isConference]);

  const name = rawName ?? '';
  const abbreviation = isConference ? row.abbreviation : null;
  const fullName = getCommitteeDisplayName(name, language);
  const primary = committeeDisplayName(fullName, deriveCommitteeAcronym(name, abbreviation));
  return {
    src: (isConference ? row.logoUrl : null) ?? matchPresetEmblem(name, abbreviation),
    primary,
    secondary: primary !== fullName ? fullName : null,
    monogram: emblemMonogram(primary),
  };
}
