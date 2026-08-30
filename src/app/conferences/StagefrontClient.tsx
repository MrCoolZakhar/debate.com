'use client';

// Production conferences landing: the owner-approved "Stagefront" composition,
// rendered by `/`. This thin client does the data fetch and renders the
// composition. The component still lives in the landing-lab/ directory for
// history — the design-lab route itself has been deleted, so VariantStagefront
// and landing-lab/shared are now production-only files despite the folder name.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDelegateFees, applyDelegateFee } from '@/lib/publicFees';
import { LabConference, LabReview, ratingMap } from './landing-lab/shared';
import VariantStagefront from './landing-lab/VariantStagefront';

export interface PlatformStats {
  total_conferences: number;
  published_conferences: number;
  countries: number;
}

export default function StagefrontClient() {
  const [conferences, setConferences] = useState<LabConference[]>([]);
  const [reviews, setReviews] = useState<LabReview[]>([]);
  // Real platform totals, including conferences still being set up. RLS hides
  // those rows from anon, so the numbers come from a counts-only definer RPC
  // rather than from the `conferences` rows the cards are built from.
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    async function fetchData() {
      const [confRes, reviewRes] = await Promise.all([
        supabase
          .from('conferences')
          .select('id, slug, full_name, acronym, city, country, start_date, end_date, fee_amount, fee_currency, expected_delegates, logo_url, banner_url')
          .eq('is_public', true)
          .order('start_date', { ascending: true }),
        supabase
          .from('conference_reviews')
          .select('conference_id, rating, review_text, display_name'),
      ]);
      const confs = (confRes.data as LabConference[]) ?? [];
      // Headline price must come from the delegate role config (phase-aware),
      // not the stale conferences.fee_amount column. Resolved BEFORE the first
      // setConferences so a card never flashes a wrong (often "Free") price.
      const fees = await fetchDelegateFees(supabase, confs.map(c => c.id));
      setConferences(confs.map(c => applyDelegateFee<LabConference>(c, fees)));
      setReviews((reviewRes.data as LabReview[]) ?? []);
    }
    fetchData();
    supabase.rpc('public_conference_stats').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setStats(row as PlatformStats);
    });
  }, []);

  const ratings = useMemo(() => ratingMap(reviews), [reviews]);

  return <VariantStagefront conferences={conferences} ratings={ratings} stats={stats} />;
}
