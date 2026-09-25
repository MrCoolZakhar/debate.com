'use client';

// The two door emojis on /create. The page is a Server Component and cannot pass
// a lucide icon (a function) to Emoji3D, a Client Component: that failed the
// production build (25 Sep 2026). The icon is chosen here, on the client side.

import { Gavel, Globe } from 'lucide-react';
import { Emoji3D } from '@/components/neu';

const FALLBACK = { gavel: Gavel, globe: Globe } as const;

export default function CreateDoorEmoji({ name, fallback, color }: {
  name: string;
  fallback: keyof typeof FALLBACK;
  color: string;
}) {
  return <Emoji3D name={name} size={40} fallback={FALLBACK[fallback]} fallbackColor={color} />;
}
