'use client';

// "Open this committee" from a member's seat on the leader card: the
// committee's emblem and name, then who sits in it.
//   * While DELEGATIONS_V2_DB is on and the pop-up knows the committee's id:
//     the WHOLE committee across the conference (owner, 20 Oct 2026), read
//     through committee/committeeRoster (rpc my_committee_roster): round flag,
//     country, the delegate's name with their school small beneath; the
//     leader's own delegation's rows tinted; countries A to Z.
//   * Otherwise: the delegation's own people sitting in it (what the card
//     already knows).
// PopupShell is the frame the member pop-up (member/MemberDetailsPopup) uses too.

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { SkeletonBlock } from '@/components/Skeleton';
import { committeeDisplayName } from '@/lib/presetNames';
import { DELEGATIONS_V2_DB } from './v2';
import { useCommitteeRoster, type CommitteeRosterRow } from './committee/committeeRoster';
import { CommitteeDisc, FONT, INK, INK_SOFT, LIFT_SHADOW, LINE, RoundAvatar, STROKE } from './leaderKit';

export interface CommitteeSeatPerson {
  application_id: string;
  name: string;
  avatar_url: string | null;
  country_name: string | null;
  country_code: string | null;
  seatLogo: string | null;
}

/** The pop-up frame: a dimmed page, a white card, a close button; Escape and an outside press close it. */
export function PopupShell({ label, onClose, width = 460, head, children }: {
  label: string;
  onClose: () => void;
  width?: number;
  /** The top row, beside the close button. */
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          style={{ width, maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#FFFFFF', borderRadius: 20, boxShadow: LIFT_SHADOW, padding: 24 }}
        >
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">{head}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
              style={{ width: 44, height: 44, margin: -8, borderRadius: 10, border: 'none', background: 'transparent', color: INK, cursor: 'pointer' }}
            >
              <X size={20} strokeWidth={STROKE} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: FONT, fontSize: 13, fontWeight: 500, color: INK_SOFT, margin: '22px 0 8px 0' };

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function sortRoster(rows: CommitteeRosterRow[]): CommitteeRosterRow[] {
  return [...rows].sort((a, b) => collator.compare(a.country_name, b.country_name)
    || collator.compare(a.seat ?? '1', b.seat ?? '1')
    || collator.compare(a.display_name ?? '', b.display_name ?? ''));
}

export default function CommitteePopup({ committeeId, name, abbreviation, emblem, people, onClose }: {
  /** The conference committee; with it (and DELEGATIONS_V2_DB) the whole committee is listed. */
  committeeId?: string | null;
  name: string;
  abbreviation: string | null;
  emblem: string;
  people: CommitteeSeatPerson[];
  onClose: () => void;
}) {
  const roster = useCommitteeRoster(committeeId ?? null);
  const sorted = useMemo(() => (roster?.kind === 'ok' ? sortRoster(roster.rows) : null), [roster]);
  const ownSorted = useMemo(
    () => [...people].sort((a, b) => collator.compare(a.country_name ?? '', b.country_name ?? '') || collator.compare(a.name, b.name)),
    [people],
  );

  const short = (abbreviation ?? '').trim() || committeeDisplayName(name, abbreviation);
  const showFull = name.trim() !== short.trim();
  const whole = DELEGATIONS_V2_DB && !!committeeId;

  const ownList = (
    <div className="flex flex-col">
      {ownSorted.map((p, i) => (
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
  );

  let wholeList: React.ReactNode = null;
  if (whole) {
    if (roster === null) {
      wholeList = (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map(i => <SkeletonBlock key={i} height={44} radius={10} />)}
        </div>
      );
    } else if (roster.kind === 'error') {
      wholeList = (
        <>
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>The committee list could not be loaded. Here is your delegation in it.</p>
          <div style={{ marginTop: 8 }}>{ownList}</div>
        </>
      );
    } else if ((sorted ?? []).length === 0) {
      wholeList = <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>Nobody has an allocation here yet.</p>;
    } else {
      wholeList = (
        <div className="flex flex-col" style={{ gap: 2 }}>
          {(sorted ?? []).map((r, i) => (
            <div
              key={`${r.country_code ?? r.country_name}-${r.seat ?? ''}-${i}`}
              className="flex items-center gap-3"
              style={{
                padding: '9px 10px', borderRadius: 10,
                background: r.is_mine ? 'color-mix(in srgb, var(--gv-accent-light) 22%, transparent)' : 'transparent',
              }}
            >
              <CircleFlag code={r.country_code} logoUrl={r.country_logo_url} label={r.country_name} size={32} decorative />
              <div className="min-w-0 flex-1">
                <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.3 }}>
                  {r.country_name}
                  {r.is_mine && <span style={{ fontSize: 12, fontWeight: 600, color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', marginLeft: 6 }}>Your delegation</span>}
                </p>
                <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, color: r.display_name ? INK : INK_SOFT, margin: '1px 0 0 0', lineHeight: 1.35 }}>
                  {r.display_name ?? 'Open allocation'}
                </p>
                {r.society_name && (
                  <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT, margin: '1px 0 0 0', lineHeight: 1.35 }}>
                    {r.society_name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <PopupShell
      label={name}
      onClose={onClose}
      width={whole ? 520 : 460}
      head={(
        <div className="flex items-start gap-4">
          <CommitteeDisc src={emblem} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.2 }}>{short}</h2>
            {showFull && <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: '3px 0 0 0' }}>{name}</p>}
          </div>
        </div>
      )}
    >
      {whole ? (
        <>
          <p style={sectionTitle}>Everyone in This Committee</p>
          {wholeList}
        </>
      ) : (
        <>
          <p style={sectionTitle}>Your Delegation Here</p>
          {ownList}
        </>
      )}
    </PopupShell>
  );
}
