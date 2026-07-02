'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LabConference, VariantSwitcher } from './shared';
import VariantCentrefold from './VariantCentrefold';
import VariantFolio from './VariantFolio';
import VariantPanorama from './VariantPanorama';

export default function LandingLabClient() {
  const searchParams = useSearchParams();
  const raw = searchParams.get('v');
  const variant: 1 | 2 | 3 = raw === '2' ? 2 : raw === '3' ? 3 : 1;

  const [conferences, setConferences] = useState<LabConference[]>([]);

  useEffect(() => {
    async function fetchConferences() {
      const { data } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, city, country, start_date, end_date, fee_amount, fee_currency, expected_delegates, logo_url, banner_url')
        .eq('is_public', true)
        .order('start_date', { ascending: true });
      setConferences((data as LabConference[]) ?? []);
    }
    fetchConferences();
  }, []);

  return (
    <>
      {variant === 1 && <VariantCentrefold conferences={conferences} />}
      {variant === 2 && <VariantFolio conferences={conferences} />}
      {variant === 3 && <VariantPanorama conferences={conferences} />}
      <VariantSwitcher current={variant} />
    </>
  );
}
