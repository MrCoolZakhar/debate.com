'use client';

// "Open this committee" from a member's seat on the leader card: the
// committee's emblem and name, and the delegation's people sitting in it
// (country and name). The whole committee's roster of countries is a later
// phase (it needs a new read); this shows what the delegation already knows.

import { useEffect } from 'react';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { committeeDisplayName } from '@/lib/presetNames';
import { CommitteeDisc, FONT, INK, INK_SOFT, LIFT_SHADOW, LINE, RoundAvatar, STROKE } from './leaderKit';

export interface CommitteeSeatPerson {
  application_id: string;
  name: string;
  avatar_url: string | null;
  country_name: string | null;
  country_code: string | null;
  seatLogo: string | null;
}

export default function CommitteePopup({ name, abbreviation, emblem, people, onClose }: {
  name: string;
  abbreviation: string | null;
  emblem: string;
  people: CommitteeSeatPerson[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const short = (abbreviation ?? '').trim() || committeeDisplayName(name, abbreviation);
  const showFull = name.trim() !== short.trim();

  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 90, background: 'rgba(28,20,16,0.32)', padding: 16 }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={name}
          onClick={(e) => e.stopPropagation()}
          style={{ width: 460, maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#FFFFFF', borderRadius: 20, boxShadow: LIFT_SHADOW, padding: 24 }}
        >
          <div className="flex items-start gap-4">
            <CommitteeDisc src={emblem} size={56} />
            <div className="min-w-0 flex-1">
              <h2 className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.2 }}>{short}</h2>
              {showFull && <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: '3px 0 0 0' }}>{name}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ width: 44, height: 44, margin: -8, borderRadius: 10, border: 'none', background: 'transparent', color: INK, cursor: 'pointer' }}
            >
              <X size={20} strokeWidth={STROKE} aria-hidden />
            </button>
          </div>

          <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: INK_SOFT, margin: '22px 0 8px 0' }}>Your Delegation Here</p>
          <div className="flex flex-col">
            {people.map((p, i) => (
              <div key={p.application_id} className="flex items-center gap-3" style={{ padding: '10px 0', borderTop: i > 0 ? `1px solid ${LINE}` : 'none' }}>
                <RoundAvatar name={p.name} url={p.avatar_url} size={40} seed={p.application_id} />
                <div className="min-w-0 flex-1">
                  <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK, margin: 0 }}>{p.name}</p>
                  <p className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, margin: '2px 0 0 0' }}>
                    <CircleFlag code={p.country_code} logoUrl={p.seatLogo} label={p.country_name} size={16} decorative />
                    {p.country_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}
