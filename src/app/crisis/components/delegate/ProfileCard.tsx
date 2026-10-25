'use client';
// Gavelling Crisis: the delegate's profile card. The big round picture hangs over the card's top edge
// (half outside, never clipped), the name and title sit under it, and a click opens My Character.

import { ChevronRight } from 'lucide-react';
import type { Character, CharacterStatus } from '@/lib/crisis/types';
import { Card, CK, OverhangCard } from '../../crisisKit';

const STATUS_WORD: Record<CharacterStatus, string> = {
  active: 'Active', spare: 'Not in play', dead: 'Dead', arrested: 'Arrested', missing: 'Missing',
};
export { STATUS_WORD };

export const AVATAR_SIZE = 116;

export default function ProfileCard({ me, cabinetName, color, onOpen }: { me: Character | null; cabinetName: string | null; color: string; onOpen: () => void }) {
  if (!me) {
    return (
      <Card><p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>You have no character yet. Ask your Crisis Director to give you one.</p></Card>
    );
  }
  return (
    <OverhangCard name={me.name} src={me.picture_url} color={color} size={AVATAR_SIZE} place="top" warm onClick={onOpen} style={{ textAlign: 'center', paddingBottom: 14 }}>
      <span style={{ display: 'block' }}>
        <b style={{ display: 'block', fontSize: 21, lineHeight: 1.2, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{me.name}</b>
        {me.title && <span style={{ display: 'block', marginTop: 3, fontSize: 14, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{me.title}</span>}
        {cabinetName && (
          <span className="flex items-center justify-center" style={{ gap: 6, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {cabinetName}
          </span>
        )}
        {me.status !== 'active' && (
          <span style={{ display: 'block', marginTop: 6, fontSize: 13, fontWeight: 800, color: CK.danger }}>{STATUS_WORD[me.status]}</span>
        )}
        <span className="inline-flex items-center" style={{ gap: 2, marginTop: 10, fontSize: 13, fontWeight: 800, color: CK.red }}>
          Open my character<ChevronRight size={15} strokeWidth={1.6} aria-hidden />
        </span>
      </span>
    </OverhangCard>
  );
}
