'use client';

// DelegationPopup: ONE pop-up for a delegation, opened from anywhere an
// organiser sees one (Applications → Delegations today; Assignment and
// Financials next). Tabs People / Seats / Payments / Documents (taste boards
// 3B and 3A, docs/conferences/delegations.md).
//
// A pop-up never opens another pop-up: a second step replaces the content in
// place with a back button, menus stay inside, confirms are asked in place.
//
// Header (owner, 20 and 21 Oct 2026): the emphasis is the delegation itself,
// its big round crest (DelegationCrest), its name large and bold on two rows
// (the main words big, a trailing "MUN Society" small beneath) with the
// country's round flag beside it, then "City, Country" smaller, the leaders as
// small avatars with their names, and Expected / Joined / Paid as a quiet
// compact row (a modest number with its word beside it, CLAUDE.md §8 rule 9).
//
// Data: pass `data` from a screen that already ran useDelegationsData (the
// Delegations tab does) so both read the same load; otherwise the pop-up runs
// the same hook itself and reads the delegations' members on its own.

import { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { ModalOverlay } from '@/components/ModalOverlay';
import type { DelegationMemberLite } from '../delegationRows';
import { ACCEPTED, memberName } from '../delegationRows';
import { useDelegationsData, type DelegationsData, type DelegationView } from './useDelegationsData';
import DelegationCrest from '@/components/DelegationCrest';
import { CircleFlag } from '@/components/CircleFlag';
import { BTN_CLASS, DelegationNameLines, FONT, HAIRLINE, INK, INK_SOFT, POPUP_BODY_BG, RoundAvatar, SkeletonRows, STROKE, placeOf } from './kit';
import { leaderCount, memberRank, shownLeaders } from './memberOrder';
import PeopleTab from './PeopleTab';
import SeatsTab from './SeatsTab';
import PaymentsTab from './PaymentsTab';
import DocumentsTab from './DocumentsTab';

export type DelegationTab = 'people' | 'seats' | 'payments' | 'documents';

const TABS: { key: DelegationTab; label: string }[] = [
  { key: 'people', label: 'People' },
  { key: 'seats', label: 'Allocations' },
  { key: 'payments', label: 'Payments' },
  { key: 'documents', label: 'Documents' },
];

export interface DelegationPopupConference {
  id: string;
  slug: string;
  fee_currency: string;
}

export interface DelegationPopupProps<M extends DelegationMemberLite = DelegationMemberLite> {
  conference: DelegationPopupConference;
  societyId: string;
  initialTab?: DelegationTab;
  onClose: () => void;
  /** The load of a screen that already has it. Omit and the pop-up reads its own. */
  data?: DelegationsData<M>;
  /** A write here changed applications (a role, a removal): the caller re-reads them. */
  onChanged?: () => void;
}

export default function DelegationPopup<M extends DelegationMemberLite>(props: DelegationPopupProps<M>) {
  if (props.data) return <PopupFrame {...props} data={props.data} />;
  return <StandalonePopup {...props} />;
}

function StandalonePopup<M extends DelegationMemberLite>(props: DelegationPopupProps<M>) {
  const data = useDelegationsData<M>({ conferenceId: props.conference.id, currency: props.conference.fee_currency });
  return <PopupFrame {...props} data={data} />;
}

/** A second step inside the pop-up: its title and body replace the tab content. */
export interface PopupStep {
  title: string;
  body: React.ReactNode;
}

/** The leaders a delegation screen names (memberOrder.shownLeaders): at most
 *  two, the creator always, then faculty advisors, then head delegates.
 *  `total` is every accepted leader, for a "+N more" beside them. */
export function leadersOf(row: DelegationView): { shown: { id: string; name: string; avatarUrl: string | null; role: string }[]; total: number } {
  const accepted = row.members.filter(m => ACCEPTED.has(m.status));
  const shown = shownLeaders(accepted, row.createdBy, memberName).map(m => {
    const rank = memberRank(m);
    return {
      id: m.id,
      name: memberName(m),
      avatarUrl: m.profiles?.avatar_url ?? null,
      role: rank === 0 ? 'Faculty advisor' : rank === 1 ? 'Head delegate' : 'Created the delegation',
    };
  });
  return { shown, total: leaderCount(accepted, row.createdBy) };
}

/** Expected / Joined / Paid: a modest number with its word, quiet beside the name. */
function CountsRow({ row }: { row: DelegationView }) {
  const counts: { n: string; word: string; title: string }[] = [
    ...(row.expected == null ? [] : [{ n: String(row.expected), word: 'expected', title: 'Expected size' }]),
    { n: String(row.registered), word: 'joined', title: 'People who joined the delegation' },
    { n: String(row.paid), word: 'paid', title: 'Delegate tickets paid' },
  ];
  return (
    <div className="flex items-baseline flex-wrap" style={{ gap: '6px 20px' }}>
      {counts.map(c => (
        <span key={c.word} className="inline-flex items-baseline" title={c.title} style={{ gap: 5 }}>
          <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{c.n}</span>
          <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{c.word}</span>
        </span>
      ))}
      {row.expected == null && <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>No expected size yet</span>}
    </div>
  );
}

function Header({ row, loading }: { row: DelegationView | null; loading: boolean }) {
  if (!row) {
    return (
      <div className="flex items-center gap-4 min-w-0">
        <span aria-hidden style={{ width: 96, height: 96, borderRadius: '50%', background: '#F1ECE1', flexShrink: 0 }} />
        <span style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, color: INK }}>{loading ? '' : 'Delegation'}</span>
      </div>
    );
  }
  const leaders = leadersOf(row).shown;
  const place = placeOf(row.city, row.countryCode);
  return (
    <div className="flex items-center gap-5 min-w-0">
      <DelegationCrest name={row.name} logoUrl={row.logoUrl} size={96} />
      <div className="flex flex-col min-w-0" style={{ gap: 6 }}>
        <div className="flex items-center min-w-0" style={{ gap: 12, fontFamily: FONT }}>
          <DelegationNameLines name={row.name} size={30} restSize={16} gap={2} />
          {place?.code && (
            <CircleFlag code={place.code} size={34} label={place.label} title={place.label} />
          )}
        </div>
        {place && (
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{place.label}</span>
        )}
        <div className="flex items-center flex-wrap" style={{ gap: '6px 14px', marginTop: 2 }}>
          {leaders.length === 0 ? (
            <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>No leader accepted yet</span>
          ) : leaders.map(l => (
            <span key={l.id} className="inline-flex items-center gap-2 min-w-0" title={l.role}>
              <RoundAvatar name={l.name} url={l.avatarUrl} size={28} seed={l.id} />
              <span className="flex flex-col min-w-0" style={{ lineHeight: 1.2 }}>
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: INK }}>{l.name}</span>
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: INK_SOFT }}>{l.role}</span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PopupFrame<M extends DelegationMemberLite>({
  conference, societyId, initialTab = 'people', onClose, data, onChanged,
}: DelegationPopupProps<M> & { data: DelegationsData<M> }) {
  const [tab, setTab] = useState<DelegationTab>(initialTab);
  const [step, setStep] = useState<PopupStep | null>(null);
  const row = data.rows.find(r => r.id === societyId) ?? null;

  function pickTab(next: DelegationTab) {
    setStep(null);
    setTab(next);
  }

  return (
    <ModalOverlay onClose={onClose} dialogRole={null} scrimColor="rgba(28,20,16,0.38)" paddingClassName="px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={row?.name ?? 'Delegation'}
        className="flex flex-col"
        style={{
          // A sensible width (owner, 21 Oct 2026: "too wide"): fills a 1440
          // screen's middle well and never stretches at 1920.
          width: 'min(1040px, calc(100vw - 32px))', height: 'min(800px, calc(100dvh - 48px))',
          background: '#FFFFFF', borderRadius: 22, boxShadow: '0 30px 80px rgba(27,56,40,0.30)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex flex-col" style={{ padding: '24px 28px 16px', gap: 18 }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between" style={{ gap: '16px 28px' }}>
              <Header row={row} loading={data.loading} />
              {row && <CountsRow row={row} />}
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className={BTN_CLASS}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#F4F0E6', color: INK, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={18} strokeWidth={STROKE} aria-hidden />
            </button>
          </div>
          <div role="tablist" aria-label="Delegation" className="inline-flex self-start" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#F1ECE1' }}>
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => pickTab(t.key)}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
                  style={{
                    height: 36, padding: '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    fontFamily: FONT, fontSize: 14, fontWeight: 500,
                    background: active ? '#FFFFFF' : 'transparent', color: active ? INK : INK_SOFT,
                    boxShadow: active ? '0 1px 3px rgba(27,56,40,0.12)' : 'none',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        {/* The tabs draw their sections as white cards on this body colour, with
            space between them, so sections never run together. */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ borderTop: `1px solid ${HAIRLINE}`, background: POPUP_BODY_BG }}>
          {step ? (
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '18px 24px 24px' }}>
              <button type="button" onClick={() => setStep(null)} className={`${BTN_CLASS} inline-flex items-center gap-2`}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: '#1B3828', marginBottom: 14 }}>
                <ArrowLeft size={18} strokeWidth={STROKE} aria-hidden /> Back
              </button>
              <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '18px 20px 20px', boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 6px 18px rgba(27,56,40,0.06)' }}>
                {step.title && <p style={{ fontFamily: FONT, fontSize: 18, fontWeight: 600, color: INK, marginBottom: 14 }}>{step.title}</p>}
                {step.body}
              </div>
            </div>
          ) : data.loading ? (
            <div style={{ padding: '24px 28px' }}><SkeletonRows rows={6} /></div>
          ) : data.loadFailed ? (
            <div style={{ padding: '24px 28px' }}>
              <p style={{ fontFamily: FONT, fontSize: 14, color: INK }}>This delegation could not be loaded.</p>
              <button type="button" onClick={() => { void data.reload(); }} className={BTN_CLASS}
                style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#1B3828', textDecoration: 'underline' }}>
                Try again
              </button>
            </div>
          ) : !row ? (
            <p style={{ padding: '24px 28px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>This delegation is no longer part of the conference.</p>
          ) : tab === 'people' ? (
            <PeopleTab conferenceId={conference.id} row={row} data={data} onChanged={onChanged} onStep={setStep} />
          ) : tab === 'seats' ? (
            <SeatsTab conference={conference} row={row} data={data} onStep={setStep} onChanged={onChanged} />
          ) : tab === 'payments' ? (
            <PaymentsTab row={row} data={data} currency={conference.fee_currency} slug={conference.slug} />
          ) : (
            <DocumentsTab conferenceId={conference.id} slug={conference.slug} row={row} data={data} />
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
