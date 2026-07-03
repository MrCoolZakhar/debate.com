'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LabConference, LabReview, ratingMap, VariantSwitcher } from './shared';
import VariantStagefront from './VariantStagefront';
import VariantRecord from './VariantRecord';
import VariantFirstGavel from './VariantFirstGavel';

export default function LandingLabClient() {
  const searchParams = useSearchParams();
  const raw = searchParams.get('v');
  const variant: 1 | 2 | 3 = raw === '2' ? 2 : raw === '3' ? 3 : 1;

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

  return (
    <>
      {variant === 1 && <VariantStagefront conferences={conferences} ratings={ratings} />}
      {variant === 2 && <VariantRecord conferences={conferences} ratings={ratings} reviews={reviews} />}
      {variant === 3 && <VariantFirstGavel conferences={conferences} ratings={ratings} reviews={reviews} />}
      <VariantSwitcher current={variant} />
    </>
  );
}
