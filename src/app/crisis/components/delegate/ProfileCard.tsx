'use client';
// Gavelling Crisis: the delegate's profile card (the small left column). The round portrait hangs over
// the card's top edge like the organiser Live Status emblem (one third outside, never clipped), the name,
// title and cabinet (logo and name) sit under it, and a click opens My Character.

import { ChevronRight } from 'lucide-react';
import type { Cabinet, Character } from '@/lib/crisis/types';
import { Card, CK, OverhangCard } from '../../crisisKit';
import { STATUS_WORD } from '../character/characterStatus';

export const AVATAR_SIZE = 96;

export default function ProfileCard({ me, cabinet, color, onOpen }: { me: Character | null; cabinet: Cabinet | null; color: string; onOpen: () => void }) {
  if (!me) {
    return (
      <Card><p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>You have no character yet. Ask your Crisis Director to give you one.</p></Card>
    );
  }
  return (
    <OverhangCard name={me.name} src={me.picture_url} color={color} size={AVATAR_SIZE} place="top" warm onClick={onOpen} style={{ textAlign: 'center', paddingBottom: 12 }}>
      <span style={{ display: 'block' }}>
        <b style={{ display: 'block', fontSize: 19, lineHeight: 1.2, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{me.name}</b>
        {me.title && <span style={{ display: 'block', marginTop: 2, fontSize: 13.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{me.title}</span>}
        {cabinet && (
          <span className="flex items-center justify-center" style={{ gap: 7, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>
            {cabinet.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cabinet.logo_url} alt="" width={22} height={22} draggable={false} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#FDFCF9' }} />
            ) : (
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            )}
            <span style={{ overflowWrap: 'anywhere' }}>{cabinet.name}</span>
          </span>
        )}
        {me.status !== 'active' && (
          <span style={{ display: 'block', marginTop: 6, fontSize: 13, fontWeight: 800, color: CK.danger }}>{STATUS_WORD[me.status]}</span>
        )}
        <span className="inline-flex items-center" style={{ gap: 2, marginTop: 8, fontSize: 12.5, fontWeight: 800, color: CK.red }}>
          My character<ChevronRight size={14} strokeWidth={1.6} aria-hidden />
        </span>
      </span>
    </OverhangCard>
  );
}
