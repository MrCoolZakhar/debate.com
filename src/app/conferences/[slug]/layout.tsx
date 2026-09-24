import FirstTouchCapture from '@/components/conferences/FirstTouchCapture';

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
