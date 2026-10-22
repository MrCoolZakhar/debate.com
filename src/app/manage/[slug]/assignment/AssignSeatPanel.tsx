'use client';

// ── "Choose who" for a seat, in the seat board's design (owner, 22 Oct 2026) ─
// The classic board's assign pop-up (the page's AssignModal: "+ Assign" on an
// open seat, a change of seat, a drag from seat to seat) keeps its structure
// and behaviour: who (ranked by the fit engine, best first), what they asked
// for with the fit score, which country, the allocation email choice, then
// Cancel and Assign. Only the look is new: the committee pop-up's white card
// with the committee ring half outside its top-left edge, avatars with the
// nationality flag on their border, bold names, the level, round flags, the
// importance dashes on a white disc and the score as a traffic-light
// percentage. Presentation only: the page's AssignModal owns every state and
// every write and passes them in.

import type { ReactNode } from 'react';
import { Check, Star } from 'lucide-react';
import { NEU } from '@/components/neu';
import { CountryName, committeeShortName } from '@/app/manage/[slug]/assignment/displayNames';
import {
  type AcceptedApp, type CommitteeData, type SlotRow,
  CommitteeLogo, CountryFlag, LevelBadge, effectiveLevel, slotLogoUrl,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  FitBadge, ImportanceDisc, PersonIdentity, RankNumber, SoftButton, WELL,
} from '@/app/manage/[slug]/assignment/seatBoardShared';
import {
  LIGHT_OPEN_ROW, LIGHT_PRIMARY, LIGHT_ROW, LightModalCard, LightModalHeader, ModalOverlay,
} from '@/app/manage/[slug]/assignment/CommitteeDetailModal';

/** Who to seat: the best fit gets a quiet "Best" mark (the old threshold, 20
 *  of the old scale, is 15 out of 100). */
const BEST_MARK_MIN = 15;

function roleWord(app: AcceptedApp): string {
  if (app.role === 'head-delegate' || app.is_head_delegate) return 'Head Delegate';
  if (app.role === 'observer') return 'Observer';
  return 'Delegate';
}

function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3" style={{ margin: '16px 0 8px' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NEU.ink }}>{children}</h3>
      {trailing}
    </div>
  );
}

const SELECTED: React.CSSProperties = { background: WELL, boxShadow: 'inset 0 0 0 1.5px #1B3828' };

export default function AssignSeatPanel({
  committee, moving, preSelectedApp, scored, selectedApp, onSelectApp,
  appPrefs, appScore, preSelectedSlot, emptySlots, selectedSlot, onSelectSlot,
  emailChoice, error, saving, onAssign, onClose,
}: {
  committee: CommitteeData;
  /** A move of a seated delegate ("Move Delegate"). */
  moving: boolean;
  preSelectedApp?: AcceptedApp | null;
  /** The people to choose from, already ranked best first (raw engine scores). */
  scored: { app: AcceptedApp; score: number }[];
  selectedApp: AcceptedApp | null;
  onSelectApp: (app: AcceptedApp) => void;
  appPrefs: AcceptedApp['application_preferences'];
  /** The selected person's raw fit score here, or null. */
  appScore: number | null;
  preSelectedSlot?: SlotRow | null;
  emptySlots: SlotRow[];
  selectedSlot: SlotRow | null;
  onSelectSlot: (slot: SlotRow) => void;
  /** The allocation email line (the page's checkbox or its "changed" sentence). */
  emailChoice: ReactNode;
  error: ReactNode;
  saving: boolean;
  onAssign: () => void;
  onClose: () => void;
}) {
  const canAssign = !saving && !!selectedApp && !!selectedSlot;
  const prefs = appPrefs.slice(0, 3);

  return (
    <ModalOverlay onClose={onClose}>
      <LightModalCard width={520}>
        <LightModalHeader committee={committee} eyebrow={moving ? 'Move Delegate' : 'Assign Delegate'} onClose={onClose} />

        {/* Who */}
        <SectionTitle trailing={!preSelectedApp && scored.length > 0 ? <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>Best fit first</span> : undefined}>
          Applicant
        </SectionTitle>
        {preSelectedApp ? (
          <div className="flex items-center gap-3" style={{ ...LIGHT_ROW, padding: '10px 12px' }}>
            <span className="flex-1 min-w-0">
              <PersonIdentity app={preSelectedApp} avatar={40} nameSize={15.5} userId={preSelectedApp.profiles?.id} />
            </span>
            <span className="flex flex-col items-end flex-shrink-0" style={{ gap: 4 }}>
              <LevelBadge level={effectiveLevel(preSelectedApp)} />
              <span style={{ fontSize: 12, color: NEU.inkSoft }}>{roleWord(preSelectedApp)}</span>
            </span>
          </div>
        ) : (
          <div
            role="listbox"
            aria-label="Choose who gets this seat"
            className="flex flex-col"
            style={{ gap: 4, maxHeight: 'min(260px, 34dvh)', overflowY: 'auto', padding: 4, borderRadius: 16, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.08)', overscrollBehavior: 'contain' }}
          >
            {scored.length === 0 ? (
              <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: NEU.inkSoft }}>Nobody is waiting for an allocation</p>
            ) : scored.map(({ app, score }, idx) => {
              const selected = selectedApp?.id === app.id;
              return (
                <div
                  key={app.id}
                  role="option"
                  aria-selected={selected}
                  tabIndex={0}
                  onClick={() => onSelectApp(app)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectApp(app); } }}
                  className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 transition-colors duration-150 hover:bg-[#FAF8F3]"
                  style={{ padding: '8px 10px', borderRadius: 12, cursor: 'pointer', ...(selected ? SELECTED : null) }}
                >
                  {/* A role="option" <div>, so the avatar's CV link is legal; nested keeps the pick working. */}
                  <span className="flex-1 min-w-0">
                    <PersonIdentity app={app} avatar={36} nameSize={14.5} lineSize={12} userId={app.profiles?.id} />
                  </span>
                  <span className="hidden sm:inline-flex flex-shrink-0"><LevelBadge level={effectiveLevel(app)} size={16} fontSize={12} /></span>
                  <span className="inline-flex items-center gap-1.5 flex-shrink-0">
                    {idx === 0 && score >= BEST_MARK_MIN && (
                      <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: '#8A6614' }}>
                        <Star size={14} strokeWidth={1.75} fill="#E8C863" aria-hidden="true" /> Best
                      </span>
                    )}
                    <FitBadge score={score} />
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* What they asked for, and the fit here */}
        {selectedApp && prefs.length > 0 && (
          <>
            <SectionTitle
              trailing={appScore !== null ? (
                <span className="inline-flex items-center gap-2">
                  <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>Fit here</span>
                  <FitBadge score={appScore} size="md" />
                </span>
              ) : undefined}
            >
              Preferences
            </SectionTitle>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {prefs.map((p, i) => {
                const here = p.conference_committee_id === committee.id;
                return (
                  <div
                    key={`${p.preference_order}-${p.conference_committee_id}-${p.country_code}`}
                    className="flex items-center gap-2.5 min-w-0"
                    title={`${p.conference_committees?.name ?? 'Unknown committee'}, ${p.country_name}`}
                  >
                    <RankNumber order={i + 1} size={20} />
                    <span className="flex-shrink-0" style={{ fontSize: 13.5, fontWeight: here ? 700 : 600, color: NEU.ink, minWidth: 64 }}>
                      {committeeShortName(p.conference_committees)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 min-w-0 flex-1">
                      <CountryFlag code={p.country_code} w={20} h={20} alt={p.country_name} />
                      <CountryName name={p.country_name} code={p.country_code} style={{ fontSize: 13.5, color: NEU.ink, fontWeight: here ? 600 : 400, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
                    </span>
                    {here && <span className="flex-shrink-0" style={{ fontSize: 12, fontWeight: 600, color: NEU.forest }}>This committee</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Which country */}
        <SectionTitle>Country</SectionTitle>
        {preSelectedSlot ? (
          <div className="flex items-center gap-3" style={{ ...LIGHT_ROW, padding: '9px 12px' }}>
            <CountryFlag code={preSelectedSlot.country_code} w={34} h={34} alt={preSelectedSlot.country_name} logoUrl={slotLogoUrl(committee, preSelectedSlot)} />
            <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 1 }}>
              <CountryName name={preSelectedSlot.country_name} code={preSelectedSlot.country_code} style={{ fontSize: 15, fontWeight: 700, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
              <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: NEU.inkSoft }}>
                <CommitteeLogo committee={committee} size={14} alt="" />
                {committeeShortName(committee)}
              </span>
            </span>
            <ImportanceDisc tier={preSelectedSlot.importance} />
          </div>
        ) : (
          <div
            role="listbox"
            aria-label="Choose the country"
            className="flex flex-col"
            style={{ gap: 4, maxHeight: 'min(220px, 30dvh)', overflowY: 'auto', padding: 4, borderRadius: 16, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.08)', overscrollBehavior: 'contain' }}
          >
            {emptySlots.length === 0 ? (
              <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: NEU.inkSoft }}>Every allocation here is filled</p>
            ) : emptySlots.map(slot => {
              const selected = selectedSlot?.id === slot.id;
              return (
                <div
                  key={slot.id}
                  role="option"
                  aria-selected={selected}
                  tabIndex={0}
                  onClick={() => onSelectSlot(slot)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSlot(slot); } }}
                  className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 transition-colors duration-150 hover:bg-[#FAF8F3]"
                  style={{ padding: '7px 10px', borderRadius: 12, cursor: 'pointer', ...(selected ? SELECTED : null) }}
                >
                  <CountryFlag code={slot.country_code} w={28} h={28} alt={slot.country_name} logoUrl={slotLogoUrl(committee, slot)} />
                  <CountryName name={slot.country_name} code={slot.country_code} className="flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 600, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
                  <ImportanceDisc tier={slot.importance} size={24} />
                  <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 18 }}>
                    {selected && <Check size={16} strokeWidth={1.75} style={{ color: NEU.forest }} aria-hidden />}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Allocation email */}
        <div style={{ ...LIGHT_OPEN_ROW, border: 'none', background: '#FAF8F3', padding: '10px 12px', marginTop: 16 }}>
          {emailChoice}
        </div>

        {error ? <div style={{ marginTop: 12 }}>{error}</div> : null}

        <div className="flex items-center justify-end gap-2.5" style={{ marginTop: 18 }}>
          <SoftButton onClick={onClose} style={{ height: 38, padding: '0 18px' }}>Cancel</SoftButton>
          <button
            type="button"
            onClick={onAssign}
            disabled={!canAssign}
            className="focus:outline-none focus-visible:ring-2 transition-transform duration-150 enabled:active:scale-[0.96]"
            style={canAssign ? LIGHT_PRIMARY : { ...LIGHT_PRIMARY, background: WELL, color: NEU.inkSoft, boxShadow: 'none', cursor: 'default' }}
          >
            {saving ? 'Assigning' : 'Assign'}
          </button>
        </div>
      </LightModalCard>
    </ModalOverlay>
  );
}
