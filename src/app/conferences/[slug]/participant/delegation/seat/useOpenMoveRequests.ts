'use client';

// Request Reshuffling (owner, 5 Nov 2026): the members of this delegation with
// an open seat-change request (a conference_requests row of kind 'swap_request'
// with metadata.action, made by delegation_request_move). RLS "Delegation
// leaders read society swap threads" lets every leader of the society read them.
// Re-read on gv-requests-changed, when the tab comes back and when `version`
// changes (the table's rows were read again), so the note clears once the
// organisers approve or decline.

import { useCallback, useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export function useOpenMoveRequests(conferenceId: string, societyId: string, version: unknown): Set<string> {
  const [apps, setApps] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    try {
      const c = await getFreshAuthedClient();
      if (!c) return;
      const { data, error } = await c.from('conference_requests')
        .select('metadata')
        .eq('conference_id', conferenceId)
        .eq('kind', 'swap_request')
        .eq('status', 'open')
        .eq('metadata->>society_id', societyId);
      if (error) return;
      const next = new Set<string>();
      for (const row of (data ?? []) as { metadata: Record<string, unknown> | null }[]) {
        const m = row.metadata ?? {};
        if (typeof m.action === 'string' && typeof m.app === 'string') next.add(m.app);
      }
      setApps(prev => (prev.size === next.size && [...next].every(id => prev.has(id)) ? prev : next));
    } catch { /* a failed read keeps what is shown */ }
  }, [conferenceId, societyId]);

  useEffect(() => { void load(); }, [load, version]);

  useEffect(() => {
    const onChanged = () => { void load(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('gv-requests-changed', onChanged);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('gv-requests-changed', onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return apps;
}
