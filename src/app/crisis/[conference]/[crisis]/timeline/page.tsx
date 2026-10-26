import { redirect } from 'next/navigation';

// The timeline placeholder is gone: History is a tab of the Map page.
export default async function Page({ params }: { params: Promise<{ conference: string; crisis: string }> }) {
  const { conference, crisis } = await params;
  redirect(`/crisis/${conference}/${crisis}/map?tab=history`);
}
