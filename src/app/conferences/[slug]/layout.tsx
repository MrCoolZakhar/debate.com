import type { Metadata } from 'next';
import { cache } from 'react';
import FirstTouchCapture from '@/components/conferences/FirstTouchCapture';
import { supabase } from '@/lib/supabase';
import { conferenceIcons, type IconVersionInput } from '@/lib/conferenceIcon';

// The fields the conference's link icon draws (src/lib/conferenceIcon.ts).
// One small read per request, shared by every metadata call in it.
const readIconFields = cache(async (slug: string): Promise<IconVersionInput | null> => {
  try {
    const { data, error } = await supabase
      .from('conferences')
      .select('full_name, acronym, banner_url, logo_url, theme')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return null;
    return (data as IconVersionInput) ?? null;
  } catch {
    return null;
  }
});

// The conference's own square icon (its logo over its banner) for this page
// and every page under it, so Linktree, iMessage and a home screen show the
// conference instead of the gavel. Only `icons` here: titles, canonicals and
// Open Graph stay with each page's pageMetadata(). An unknown slug or a failed
// read returns nothing and the root icons stay.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const conf = await readIconFields(slug);
  return conf ? { icons: conferenceIcons(slug, conf) } : {};
}

// Mounts one thing around every page of a conference: the first-touch capture
// (where the visitor first came from, kept in their browser only; see
// src/lib/trafficSource.ts). Renders the page unchanged.
export default async function ConferenceSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <FirstTouchCapture slug={slug} />
      {children}
    </>
  );
}
