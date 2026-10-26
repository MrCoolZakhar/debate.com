import { redirect } from 'next/navigation';

// The timeline placeholder is gone: the History page replaces it.
export default async function Page({ params }: { params: Promise<{ conference: string; crisis: string }> }) {
  const { conference, crisis } = await params;
  redirect(`/crisis/${conference}/${crisis}/history`);
}
