'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

export function useCredits() {
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !session) {
      setBalance(null);
      return;
    }
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('credit_balance');
    if (!error && typeof data === 'number') {
      setBalance(data);
    }
    setLoading(false);
  }, [user, session]);

  useEffect(() => {
    const id = setTimeout(refresh, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  return { balance, loading, refresh };
}
