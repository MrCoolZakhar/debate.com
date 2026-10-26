'use client';
// Reads `?d=<directive id>` (set by a notification) and tells the page which directive to open.

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function Reader({ onId }: { onId: (id: string) => void }) {
  const id = useSearchParams()?.get('d') ?? null;
  useEffect(() => { if (id) onId(id); }, [id, onId]);
  return null;
}

export default function DirectiveDeepLink({ onId }: { onId: (id: string) => void }) {
  return <Suspense fallback={null}><Reader onId={onId} /></Suspense>;
}
