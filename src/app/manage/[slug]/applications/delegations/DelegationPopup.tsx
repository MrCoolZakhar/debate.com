'use client';

// DelegationPopup: ONE pop-up for a delegation, opened from anywhere an
// organiser sees one (Applications → Delegations today; Assignment and
// Financials next). Tabs People / Seats / Payments / Documents (taste boards
// 3B and 3A, docs/conferences/delegations.md).
//
// A pop-up never opens another pop-up: a second step replaces the content in
// place with a back button, menus stay inside, confirms are asked in place.
//
// Header (owner, 20 Oct 2026, "looks very bland"): the big round crest
// (DelegationCrest), the name, "City, Country" with its round flag, the
// leaders as small avatars with their names, and ONE seats meter like the
// Delegations table (seats given against paid tickets, the part with a person
// on it darker) with one line under it.
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
import { BTN_CLASS, FONT, HAIRLINE, INK, INK_SOFT, PlaceLine, RoundAvatar, SeatMeter, SkeletonRows, STROKE, plural } from './kit';
import PeopleTab from './PeopleTab';
import SeatsTab from './SeatsTab';
import PaymentsTab from './PaymentsTab';
import DocumentsTab from './DocumentsTab';

export type DelegationTab = 'people' | 'seats' | 'payments' | 'documents';

const TABS: { key: DelegationTab; label: string }[] = [
  { key: 'people', label: 'People' },
  { key: 'seats', label: 'Seats' },
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

/** The delegation's accepted leaders (head delegates, then faculty advisors), each once. */
function leadersOf(row: DelegationView): { id: string; name: string; avatarUrl: string | null; role: string }[] {
  const heads: { id: string; name: string; avatarUrl: string | null; role: string }[] = [];
  const advisors: typeof heads = [];
  for (const m of row.members) {
    if (!ACCEPTED.has(m.status)) continue;
    const who = { id: m.id, name: memberName(m), avatarUrl: m.profiles?.avatar_url ?? null, role: '' };
    if (m.role === 'faculty-advisor') advisors.push({ ...who, role: 'Faculty advisor' });
    else if (m.is_head_delegate || m.role === 'head-delegate') heads.push({ ...who, role: 'Head delegate' });
  }
  return [...heads, ...advisors];
}

/** The one line under the seats meter (owner, 20 Oct 2026). */
function seatsLine(row: DelegationView): string {
  const parts = [
    `${row.seatsGiven} of ${plural(row.paid, 'paid ticket')} ${row.seatsGiven === 1 ? 'has' : 'have'} a seat`,
    `${plural(row.registered, 'person', 'people')} joined`,
  ];
  if (row.expected != null) parts.push(`expected size ${row.expected}`);
  return parts.join(' · ');
}

function Header({ row, loading }: { row: DelegationView | null; loading: boolean }) {
  if (!row) {
    return (
      <div className="flex items-center gap-4 min-w-0">
        <span aria-hidden style={{ width: 88, height: 88, borderRadius: '50%', background: '#F1ECE1', flexShrink: 0 }} />
        <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: INK }}>{loading ? '' : 'Delegation'}</span>
      </div>
    );
  }
  const leaders = leadersOf(row);
  return (
    <div className="flex items-center gap-5 min-w-0">
      <DelegationCrest name={row.name} logoUrl={row.logoUrl} size={88} />
      <div className="flex flex-col min-w-0" style={{ gap: 6 }}>
        <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', color: INK, lineHeight: 1.15 }}>
          {row.name}
        </span>
        <PlaceLine city={row.city} countryCode={row.countryCode} size={22} fontSize={15} />
        <div className="flex items-center flex-wrap" style={{ gap: '6px 14px' }}>
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
          width: 'min(1080px, calc(100vw - 32px))', height: 'min(780px, calc(100dvh - 48px))',
          background: '#FFFFFF', borderRadius: 22, boxShadow: '0 30px 80px rgba(27,56,40,0.30)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex flex-col" style={{ padding: '24px 28px 16px', gap: 18 }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between" style={{ gap: '16px 28px' }}>
              <Header row={row} loading={data.loading} />
              {row && (
                <div className="flex flex-col" style={{ gap: 8, width: 'min(330px, 100%)' }}>
                  <SeatMeter given={row.seatsGiven} filled={row.seatsFilled} paid={row.paid} height={10} />
                  <span style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}>{seatsLine(row)}</span>
                </div>
              )}
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
        <div className="flex-1 min-h-0 flex flex-col" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          {step ? (
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '18px 28px 24px' }}>
              <button type="button" onClick={() => setStep(null)} className={`${BTN_CLASS} inline-flex items-center gap-2`}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: '#1B3828', marginBottom: 14 }}>
                <ArrowLeft size={18} strokeWidth={STROKE} aria-hidden /> Back
              </button>
              {step.title && <p style={{ fontFamily: FONT, fontSize: 18, fontWeight: 600, color: INK, marginBottom: 14 }}>{step.title}</p>}
              {step.body}
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
