'use client';
// "Open Gavelling Crisis" on the organiser Live Status card of a crisis committee's room. It finds the
// crisis from the room code (public crisis_for_room, cached per code) and renders nothing for any other room.

import { useEffect, useState } from 'react';
import { Siren } from 'lucide-react';
import { crisisForRoom } from '@/lib/crisis/api';

type Found = { conference_slug: string; crisis_slug: string; name: string } | null;
const cache = new Map<string, Promise<Found>>();

export default function CrisisLiveLink({ code }: { code: string }) {
  const [found, setFound] = useState<Found>(null);
  useEffect(() => {
    let cancelled = false;
    let p = cache.get(code);
    if (!p) { p = crisisForRoom(code); cache.set(code, p); }
    void p.then((f) => { if (!cancelled) setFound(f); });
    return () => { cancelled = true; };
  }, [code]);
  if (!found) return null;
  return (
    <a
      href={`/crisis/${found.conference_slug}/${found.crisis_slug}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-[7px] rounded-full focus:outline-none flex-shrink-0 whitespace-nowrap hover:bg-[rgba(142,36,36,0.08)]"
      style={{ color: '#8E2424', textDecoration: 'none' }}
      title={`Open ${found.name} in Gavelling Crisis`}
    >
      <Siren size={12} strokeWidth={1.8} />
      Open Gavelling Crisis
    </a>
  );
}
