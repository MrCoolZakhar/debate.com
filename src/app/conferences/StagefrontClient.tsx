'use client';

// Production conferences landing: the "Stagefront" composition promoted from the
// design lab (owner-approved at /conferences/landing-lab?v=1). This thin client
// mirrors the lab's data fetch and renders the composition without the lab's
// variant-switcher pill. The component itself still lives in landing-lab/ so the
// lab route and production stay one source of truth.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LabConference, LabReview, ratingMap } from './landing-lab/shared';
import VariantStagefront from './landing-lab/VariantStagefront';

export default function StagefrontClient() {
  const [conferences, setConferences] = useState<LabConference[]>([]);
  const [reviews, setReviews] = useState<LabReview[]>([]);

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
      setConferences((confRes.data as LabConference[]) ?? []);
      setReviews((reviewRes.data as LabReview[]) ?? []);
    }
    fetchData();
  }, []);

  const ratings = useMemo(() => ratingMap(reviews), [reviews]);

  return <VariantStagefront conferences={conferences} ratings={ratings} />;
}
