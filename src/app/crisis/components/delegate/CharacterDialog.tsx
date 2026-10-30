'use client';
// Gavelling Crisis: "My Character". It always shows something: title, status, location, bio, powers,
// the character guide (a prominent button that opens the file in a new tab), and the secret goals,
// which stay hidden until the delegate presses the button (the dialog is thrown away on close).

import { useState } from 'react';
import { BookOpenText, Eye, EyeOff, ExternalLink, Lock, MapPin, ScrollText, Zap } from 'lucide-react';
import type { Character } from '@/lib/crisis/types';
import { Btn, CK, OverhangCard, Skeleton } from '../../crisisKit';
import CrisisDialog from './CrisisDialog';
import { STATUS_WORD } from './ProfileCard';

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section style={{ background: CK.card, borderRadius: 18, boxShadow: CK.shadowSm, padding: '12px 14px' }}>
      <h3 className="flex items-center gap-2" style={{ margin: 0, fontSize: 13, fontWeight: 800, color: CK.red }}>
        <span style={{ lineHeight: 0 }}>{icon}</span>{label}
      </h3>
      <div style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{children}</div>
    </section>
  );
}

const none = (text: string) => <span style={{ color: CK.inkSoft }}>{text}</span>;

export default function CharacterDialog({ me, color, goals, goalsLoaded, onClose }: {
  me: Character; color: string; goals: string; goalsLoaded: boolean; onClose: () => void;
}) {
  const [showGoals, setShowGoals] = useState(false);
  const guide = me.guide_url && /^https?:\/\//i.test(me.guide_url) ? me.guide_url : null;
  return (
    <CrisisDialog title="My Character" onClose={onClose} width={720}>
      <div className="grid gap-3.5">
        <OverhangCard name={me.name} src={me.picture_url} color={color} size={84} warm>
          <style>{'.crisis-guide-chip { position: absolute; top: 10px; right: 12px; } .crisis-guide-pad { padding-right: 150px; } @media (max-width: 600px) { .crisis-guide-chip { position: static; margin-bottom: 6px; } .crisis-guide-pad { padding-right: 0; } }'}</style>
          {guide && (
            <a
              href={guide}
              target="_blank"
              rel="noopener noreferrer"
              title={me.guide_name ? `Open ${me.guide_name}` : 'Open my character guide'}
              className="crisis-guide-chip inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
              style={{ gap: 6, textDecoration: 'none', background: CK.greenBtn, color: '#FFFFFF', borderRadius: 99, boxShadow: CK.shadowSm, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, fontFamily: CK.font }}
            >
              <BookOpenText size={14} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />Character guide<ExternalLink size={12} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, opacity: 0.8 }} />
            </a>
          )}
          <div className={`min-w-0 ${guide ? 'crisis-guide-pad' : ''}`}>
            <b style={{ display: 'block', fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{me.name}</b>
            <span style={{ display: 'block', marginTop: 2, fontSize: 14.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{me.title || 'No title yet'}</span>
            <span style={{ display: 'block', marginTop: 6, fontSize: 14, fontWeight: 800, color: me.status === 'active' ? CK.ok : CK.danger }}>
              {STATUS_WORD[me.status]}{me.status_note ? `. ${me.status_note}` : ''}
            </span>
          </div>
        </OverhangCard>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Fact icon={<MapPin size={16} strokeWidth={1.5} aria-hidden />} label="Location">{me.location || none('Not set')}</Fact>
          <Fact icon={<Zap size={16} strokeWidth={1.5} aria-hidden />} label="Powers">{me.powers || none('No powers written down yet')}</Fact>
        </div>
        <Fact icon={<ScrollText size={16} strokeWidth={1.5} aria-hidden />} label="Bio">{me.bio || none('No bio yet')}</Fact>

        <section aria-label="My secret goals" style={{ background: CK.redWash, borderRadius: 18, boxShadow: CK.shadowSm, padding: '14px 16px' }}>
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
      </div>
    </CrisisDialog>
  );
}
