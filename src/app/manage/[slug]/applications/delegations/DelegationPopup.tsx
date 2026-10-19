'use client';

// DelegationPopup: ONE pop-up for a delegation, opened from anywhere an
// organiser sees one (Applications → Delegations today; Assignment and
// Financials next). Tabs People / Seats / Payments / Documents (taste boards
// 3B and 3A, docs/conferences/delegations.md).
//
// A pop-up never opens another pop-up: a second step replaces the content in
// place with a back button, menus stay inside, confirms are asked in place.
//
// Data: pass `data` from a screen that already ran useDelegationsData (the
// Delegations tab does) so both read the same load; otherwise the pop-up runs
// the same hook itself and reads the delegations' members on its own.

import { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { ModalOverlay } from '@/components/ModalOverlay';
import type { DelegationMemberLite } from '../delegationRows';
import { ACCEPTED } from '../delegationRows';
import { useDelegationsData, type DelegationsData, type DelegationView } from './useDelegationsData';
import { BTN_CLASS, Crest, FONT, HAIRLINE, INK, INK_SOFT, PlaceLine, SkeletonRows, STROKE, plural } from './kit';
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

function leadersLine(row: DelegationView): string | null {
  let heads = 0;
  let advisors = 0;
  for (const m of row.members) {
    if (!ACCEPTED.has(m.status)) continue;
    if (m.role === 'faculty-advisor') advisors += 1;
    else if (m.is_head_delegate || m.role === 'head-delegate') heads += 1;
  }
  const parts: string[] = [];
  if (heads > 0) parts.push(plural(heads, 'head delegate'));
  if (advisors > 0) parts.push(plural(advisors, 'advisor'));
  return parts.length > 0 ? parts.join(', ') : 'No leader accepted yet';
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
          width: 'min(1000px, calc(100vw - 32px))', height: 'min(700px, calc(100dvh - 48px))',
          background: '#FFFFFF', borderRadius: 22, boxShadow: '0 30px 80px rgba(27,56,40,0.30)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex flex-col" style={{ padding: '24px 28px 16px', gap: 16 }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {row ? <Crest name={row.name} logoUrl={row.logoUrl} size={48} /> : <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#F1ECE1' }} />}
              <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1.25 }}>
                  {row?.name ?? (data.loading ? '' : 'Delegation')}
                </span>
                {row && <PlaceLine city={row.city} countryCode={row.countryCode} extra={leadersLine(row)} />}
              </div>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className={BTN_CLASS}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#F4F0E6', color: INK, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={18} strokeWidth={STROKE} aria-hidden />
            </button>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div role="tablist" aria-label="Delegation" className="inline-flex" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#F1ECE1' }}>
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
            {row && tab === 'people' && !step && (
              <div className="flex flex-wrap" style={{ gap: 22, fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
                <span><b style={{ fontSize: 18, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{row.expected ?? 0}</b> expected</span>
                <span><b style={{ fontSize: 18, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{row.paid}</b> paid</span>
                <span><b style={{ fontSize: 18, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{row.registered}</b> joined</span>
              </div>
            )}
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
              <p style={{ fontFamily: FONT, fontSize: 18, fontWeight: 600, color: INK, marginBottom: 14 }}>{step.title}</p>
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
            <PeopleTab row={row} data={data} onChanged={onChanged} />
          ) : tab === 'seats' ? (
            <SeatsTab conference={conference} row={row} data={data} onStep={setStep} />
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
