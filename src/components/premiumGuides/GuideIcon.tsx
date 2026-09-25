import { Gavel, Handshake, LayoutGrid, Scale, ScrollText, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import type { GuideIconName } from '@/lib/premiumGuides/types';

const ICONS: Record<GuideIconName, LucideIcon> = {
  Handshake,
  Trophy,
  Gavel,
  TrendingUp,
  ScrollText,
  LayoutGrid,
  Scale,
};

export default function GuideIcon({ name, size = 22, color }: { name: GuideIconName; size?: number; color?: string }) {
  const Icon = ICONS[name] ?? ScrollText;
  return <Icon size={size} strokeWidth={2.1} aria-hidden="true" style={color ? { color } : undefined} />;
}
