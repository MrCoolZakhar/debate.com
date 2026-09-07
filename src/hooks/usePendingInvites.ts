'use client';

/**
 * usePendingInvites — imported-delegate invitations the signed-in user has
 * waiting, matched by their email address, both as a count and as listable
 * rows.
 *
 * WHY IT IS ITS OWN QUERY
 * ProfileDropdown's "YOUR CONFERENCES" query reads `applications` the user
 * already owns (`user_id = auth.uid()`); an imported invitation has no
 * `user_id` yet (it was created against `invited_email` before this person
 * ever signed up), so it can never surface there. This is a separate read
 * against the SECURITY DEFINER `my_pending_import_invites()` function, which
 * does the email match itself and hands back pre-shaped rows.
 *
 * ROWS, NOT JUST A NUMBER
 * Invitations render as entries at the very top of the profile menu's
 * conference list (marked INVITED), so the conference behind each one has to
 * come back with it, exactly like `useDraftCount`'s drafts.
 *
 * `count` is therefore the number of LISTABLE invitations: the badge and the
 * list must never disagree.
 *
 * LAZY, LIKE THE CONFERENCE LIST
 * `enabled` is the caller's "the menu is open" flag. Nothing is fetched until
 * the menu is first opened, so an unopened nav costs no round trip, and the
 * result is then cached for the life of the mount.
 *
 * NO REFRESH EVENT
 * Unlike drafts, there is no in-app action that resolves an invitation
 * without leaving this component tree — accepting one is a full page
 * navigation to /invites/import/[token], so the menu remounts and refetches
 * on its own. No window event is needed here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

/** One pending imported-delegate invitation, with the conference it belongs to. */
export interface InviteSummary {
  id: string;
  role: string;
  slug: string;
  acronym: string;
  fullName: string;
  logoUrl: string | null;
  claimToken: string;
}

/** Where "accept this invitation" goes: the claim page for that token. */
export function inviteAcceptHref(i: InviteSummary): string {
  return `/invites/import/${i.claimToken}`;
}

interface RawInviteConference {
  slug: string;
  acronym: string;
  full_name: string;
  logo_url: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_tbd: boolean;
  city: string | null;
  country: string | null;
}

interface RawInviteAllocation {
  committee: string;
  abbreviation: string;
  country_name: string;
  country_code: string;
}

interface RawInvite {
  application_id: string;
  role: string;
  invited_name: string | null;
  claim_token: string;
  conference: RawInviteConference | null;
  allocation: RawInviteAllocation | null;
}

export function usePendingInvites(enabled: boolean = true) {
  const { user, session } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  // Whether the lazy first fetch has already been kicked off for this user.
  const fetched = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || !session) {
      setCount(null);
      setInvites([]);
      return;
    }
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('my_pending_import_invites');

    // An invitation whose conference we can no longer read is not listed at
    // all, same rule useDraftCount follows: "Accept" would have nowhere to go.
    const rows = ((data ?? []) as RawInvite[]).flatMap((r) => {
      if (!r.conference) return [];
      return [{
        id: r.application_id,
        role: r.role,
        slug: r.conference.slug,
        acronym: r.conference.acronym,
        fullName: r.conference.full_name,
        logoUrl: r.conference.logo_url,
        claimToken: r.claim_token,
      }];
    });

    // A failed read must degrade to "no badge, no rows", never to a wrong number.
    setInvites(error ? [] : rows);
    setCount(error ? 0 : rows.length);
    setLoading(false);
  }, [user, session]);

  // Reset the cache when the signed-in user changes (declared before the fetch
  // effect so it wins the first commit).
  useEffect(() => {
    fetched.current = false;
    setCount(null);
    setInvites([]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!enabled || fetched.current) return;
    if (!user || !session) return;
    fetched.current = true;
    void refresh();
  }, [enabled, user, session, refresh]);

  return { count, invites, loading, refresh };
}
