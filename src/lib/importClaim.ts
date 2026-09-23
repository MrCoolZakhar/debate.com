'use client';

// Attach imported / invited applications (user_id null, invited_email set) to
// the signed-in account, once per browser session per account.
//
// The server decides everything: claim_my_imported_applications() matches only
// the account's VERIFIED address (auth.users.email_confirmed_at), never the
// profile copy. A confirmation, and a brand-new Google account, are already
// claimed by database triggers; this covers an EXISTING account whose address
// an organiser imports later. Cheap: the RPC returns at once when nothing is
// imported for the address.

import { useEffect } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

const KEY = 'gavelling-import-claim:';

export function useClaimImportedOnLoad(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    try {
      if (sessionStorage.getItem(KEY + userId)) return;
      sessionStorage.setItem(KEY + userId, '1');
    } catch { /* storage blocked: still try once for this mount */ }
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const { error } = await client.rpc('claim_my_imported_applications');
      if (error) {
        // Not answered: let the next page load try again.
        try { sessionStorage.removeItem(KEY + userId); } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
}
