'use client';
// Gavelling Crisis: the delegate's Cabinet page. Your own cabinet first (its logo and name, then its
// characters as cards with the round portrait hanging over the top edge). What you see of the OTHER
// cabinets is the Crisis Director's choice (Settings, otherCabinets): nothing, names and pictures, or
// full profiles. A delegate never sees another character's directives or performance, only a profile.

import { useMemo, useState } from 'react';
import { MapPin, ScrollText } from 'lucide-react';
import type { Cabinet, Character } from '@/lib/crisis/types';
import { Avatar, Card, CK, OverhangCard } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { STATUS_WORD, StatusIcon, statusColor } from '../character/characterStatus';
import CrisisDialog from '../delegate/CrisisDialog';

type Detail = 'names' | 'profiles';

/** The cabinet's logo and name: the short name big when there is one, the full name smaller beneath. */
function CabinetHeader({ cab, me }: { cab: Cabinet; me?: boolean }) {
  return (
    <div className="flex items-center" style={{ gap: 12, padding: '12px 16px', background: `color-mix(in srgb, ${cab.color} 14%, #fff)`, borderBottom: `3px solid ${cab.color}`, borderRadius: '22px 22px 0 0' }}>
      <Avatar name={cab.short_name || cab.name} src={cab.logo_url} size={44} color={cab.color} />
      <div className="min-w-0" style={{ flex: 1 }}>
        <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.2, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{cab.short_name || cab.name}</h2>
        {cab.short_name && cab.short_name !== cab.name && (
          <span style={{ display: 'block', marginTop: 1, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{cab.name}</span>
        )}
      </div>
      {me && <span style={{ fontSize: 12.5, fontWeight: 800, color: CK.red, flexShrink: 0 }}>Your cabinet</span>}
    </div>
  );
}

function CharacterCard({ c, color, detail, isYou, showStatus, onOpen }: {
  c: Character; color: string; detail: Detail; isYou: boolean; showStatus: boolean; onOpen: () => void;
}) {
  const gone = showStatus && (c.status === 'dead' || c.status === 'arrested');
  return (
    <OverhangCard
      name={c.name}
      src={c.picture_url}
      color={color}
      size={60}
      place="top"
      onClick={onOpen}
      style={{ background: gone ? CK.well : CK.card, boxShadow: `${CK.shadowSm}, inset 0 3px 0 ${color}`, textAlign: 'center', filter: gone ? 'grayscale(0.6)' : undefined }}
    >
      <span style={{ display: 'block', minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 15.5, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{c.name}</b>
        {isYou && <span style={{ display: 'block', marginTop: 1, fontSize: 12, fontWeight: 800, color: CK.red }}>You</span>}
        {c.title && <span style={{ display: 'block', marginTop: 1, fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{c.title}</span>}
      </span>
      {showStatus && (
        <span className="flex items-center justify-center gap-1.5" style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: statusColor(c.status), flexWrap: 'wrap' }}>
          <StatusIcon status={c.status} size={15} />
          {STATUS_WORD[c.status]}
          {c.status_note && <span style={{ fontWeight: 500, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{`· ${c.status_note}`}</span>}
        </span>
      )}
      {detail === 'profiles' && (c.location || c.bio) && (
        <span className="flex flex-col" style={{ marginTop: 8, gap: 3, fontSize: 12.5, color: CK.inkSoft, lineHeight: 1.45, textAlign: 'left' }}>
          {c.location && (
            <span className="flex items-start gap-1.5" style={{ overflowWrap: 'anywhere' }}>
              <MapPin size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2, color: CK.red }} />{c.location}
            </span>
          )}
          {c.bio && (
            <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }} title={c.bio}>{c.bio}</span>
          )}
        </span>
      )}
    </OverhangCard>
  );
}

/** One character's profile. Never directives, performance, goals or powers. */
function ProfileDialog({ c, color, detail, status, onClose }: { c: Character; color: string; detail: Detail; status: boolean; onClose: () => void }) {
  return (
    <CrisisDialog title="Profile" onClose={onClose} width={640}>
      <div className="grid gap-3.5">
        <OverhangCard name={c.name} src={c.picture_url} color={color} size={84} warm>
          <div className="min-w-0">
            <b style={{ display: 'block', fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{c.name}</b>
            {c.title && <span style={{ display: 'block', marginTop: 2, fontSize: 14.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{c.title}</span>}
            {status && (
              <span style={{ display: 'block', marginTop: 6, fontSize: 14, fontWeight: 800, color: statusColor(c.status) }}>
                {STATUS_WORD[c.status]}{c.status_note ? `. ${c.status_note}` : ''}
              </span>
            )}
          </div>
        </OverhangCard>
        {detail === 'profiles' && c.location && (
          <Fact icon={<MapPin size={16} strokeWidth={1.5} aria-hidden />} label="Location">{c.location}</Fact>
        )}
        {detail === 'profiles' && c.bio && (
          <Fact icon={<ScrollText size={16} strokeWidth={1.5} aria-hidden />} label="Bio">{c.bio}</Fact>
        )}
      </div>
    </CrisisDialog>
  );
}

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

export default function CabinetPage() {
  const v = useCrisis();
  const { core, cabinetId, characterId, settings } = v;
  const [openId, setOpenId] = useState<string | null>(null);
  const others: 'hidden' | Detail = settings.otherCabinets;

  const own = useMemo(
    () => core.characters.filter((c) => !!cabinetId && c.cabinet_id === cabinetId && c.status !== 'spare').sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)),
    [core.characters, cabinetId],
  );
  const ownCabinet = core.cabinets.find((c) => c.id === cabinetId) ?? null;
  const otherGroups = useMemo(() => {
    if (others === 'hidden') return [];
    return core.cabinets
      .filter((cab) => cab.id !== cabinetId)
      .map((cab) => ({ cab, list: core.characters.filter((c) => c.cabinet_id === cab.id && c.status !== 'spare').sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)) }))
      .filter((g) => g.list.length > 0);
  }, [core.cabinets, core.characters, cabinetId, others]);

  const open = openId ? core.characters.find((c) => c.id === openId) ?? null : null;
  const openIsOwn = !!open && !!cabinetId && open.cabinet_id === cabinetId;
  const openColor = open ? core.cabinets.find((c) => c.id === open.cabinet_id)?.color ?? CK.red : CK.red;

  const grid = { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', columnGap: 12 } as const;

  return (
    <div style={{ fontFamily: CK.font, paddingTop: 8 }}>
      <h1 className="flex items-center gap-2" style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: CK.ink }}>
        <ScrollText size={24} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />Cabinet
      </h1>

      <div className="flex flex-col" style={{ gap: 14 }}>
        {ownCabinet ? (
          <Card style={{ padding: 0 }}>
            <CabinetHeader cab={ownCabinet} me />
            <div style={{ padding: 14 }}>
              {own.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No characters in your cabinet yet.</p>
              ) : (
                <div style={grid}>
                  {own.map((c) => (
                    <CharacterCard key={c.id} c={c} color={ownCabinet.color} detail="profiles" isYou={c.id === characterId} showStatus onOpen={() => setOpenId(c.id)} />
                  ))}
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>You are not in a cabinet yet. Ask your Crisis Director.</p></Card>
        )}

        {otherGroups.length > 0 && (
          <section aria-label="Other cabinets" className="flex flex-col" style={{ gap: 14 }}>
            <h2 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: CK.ink }}>Other Cabinets</h2>
            {otherGroups.map(({ cab, list }) => (
              <Card key={cab.id} style={{ padding: 0 }}>
                <CabinetHeader cab={cab} />
                <div style={{ padding: 14 }}>
                  <div style={grid}>
                    {list.map((c) => (
                      <CharacterCard key={c.id} c={c} color={cab.color} detail={others === 'profiles' ? 'profiles' : 'names'} isYou={false} showStatus={false} onOpen={() => setOpenId(c.id)} />
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}
      </div>

      {open && (
        <ProfileDialog
          key={open.id}
          c={open}
          color={openColor}
          detail={openIsOwn || others === 'profiles' ? 'profiles' : 'names'}
          status={openIsOwn}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
