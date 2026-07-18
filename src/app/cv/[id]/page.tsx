import type { Metadata } from 'next';
import PublicCVClient from './PublicCVClient';

export const metadata: Metadata = {
  title: 'MUN CV · Gavelling',
  description: 'A Model UN delegate record on Gavelling.',
};

// Public, read-only MUN CV reached by a shareable link (/cv/<user-id>). The id
// is an unguessable UUID; data comes from the anon-callable get_public_cv RPC,
// which exposes only a safe profile subset + CV entries.
export default async function PublicCVPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicCVClient userId={id} />;
}
