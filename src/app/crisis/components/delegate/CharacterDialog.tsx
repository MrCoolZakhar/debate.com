'use client';
// Gavelling Crisis: "My Character". Bio, powers, location, status, and the secret goals, which stay
// hidden until the delegate presses the button (the dialog is thrown away on close, so they hide again).

import { useState } from 'react';
import { Eye, EyeOff, Lock, MapPin } from 'lucide-react';
import type { Character, CharacterStatus } from '@/lib/crisis/types';
import { Btn, CK, Skeleton } from '../../crisisKit';
import CrisisDialog from './CrisisDialog';
import { CharacterPicture } from './characterBits';

const STATUS_WORD: Record<CharacterStatus, string> = {
  active: 'Active', spare: 'Not in play', dead: 'Dead', arrested: 'Arrested', missing: 'Missing',
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 12, fontWeight: 700, color: CK.muted }}>{label}</dt>
      <dd style={{ margin: '2px 0 0', fontSize: 14.5, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{children}</dd>
    </div>
  );
}

export default function CharacterDialog({ me, goals, goalsLoaded, onClose }: {
  me: Character; goals: string; goalsLoaded: boolean; onClose: () => void;
}) {
  const [showGoals, setShowGoals] = useState(false);
  return (
    <CrisisDialog title="My Character" onClose={onClose} width={680}>
      <div className="flex items-center gap-4 flex-wrap">
        <CharacterPicture name={me.name} url={me.picture_url} size={96} />
        <div className="min-w-0">
          <b style={{ display: 'block', fontSize: 20, lineHeight: 1.2, color: CK.ink, overflowWrap: 'anywhere' }}>{me.name}</b>
          {me.title && <span style={{ display: 'block', marginTop: 2, fontSize: 14.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{me.title}</span>}
        </div>
      </div>

      <dl className="grid gap-4" style={{ margin: '18px 0 0' }}>
        <Fact label="Status">
          <span style={{ fontWeight: 700, color: me.status === 'active' ? CK.ok : CK.danger }}>
            {STATUS_WORD[me.status]}{me.status_note ? `. ${me.status_note}` : ''}
          </span>
        </Fact>
        {me.location && (
          <Fact label="Location">
            <span className="inline-flex items-center gap-1.5"><MapPin size={15} strokeWidth={1.5} aria-hidden />{me.location}</span>
          </Fact>
        )}
        {me.bio && <Fact label="Bio">{me.bio}</Fact>}
        {me.powers && <Fact label="Powers">{me.powers}</Fact>}
      </dl>

      <section aria-label="My secret goals" style={{ marginTop: 20, background: CK.redWash, borderRadius: 18, boxShadow: CK.shadowSm, padding: '14px 16px' }}>
        <h3 className="flex items-center gap-2" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: CK.ink }}>
          <span style={{ color: CK.red, lineHeight: 0 }}><Lock size={17} strokeWidth={1.5} aria-hidden /></span>
          My Secret Goals
        </h3>
        <p style={{ margin: '2px 0 10px', fontSize: 12.5, color: CK.inkSoft }}>Only you can see these.</p>
        {!showGoals ? (
          <Btn tone="red" icon={<Eye size={16} strokeWidth={1.5} />} onClick={() => setShowGoals(true)}>Show my secret goals</Btn>
        ) : (
          <>
            {!goalsLoaded ? <Skeleton h={48} r={12} /> : goals ? (
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{goals}</p>
            ) : <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>No secret goals were given to you.</p>}
            <div style={{ marginTop: 10 }}>
              <Btn tone="ghost" size="sm" icon={<EyeOff size={14} strokeWidth={1.5} />} onClick={() => setShowGoals(false)}>Hide my secret goals</Btn>
            </div>
          </>
        )}
      </section>
    </CrisisDialog>
  );
}
