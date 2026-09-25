'use client';

// delegationsUi.tsx — Settings → Delegations. Everything an organiser decides
// about how delegations (schools, societies) run themselves, in one
// self-contained panel so it can move whole into a Delegations manage tab once
// that is split out of Assignment.
//
//   1. Delegation allocation swaps (moved here from the Conference tab; the
//      page still owns swapMode / saveSwapMode, unchanged, and passes them in)
//   2. Let delegation leaders import their delegates
//      (conferences.allow_delegation_import, off by default). The write is the
//      same verified pattern as saveSwapMode: an update with .select('id'),
//      exactly one row back counts as saved, no optimistic flip.

import { useState } from 'react';
import { UserPlus, Users2 } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { InfoHint, Segmented } from './applicationsUi';

const FONT = 'var(--font-brand), sans-serif';

export const SWAP_MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'off', label: 'OFF', desc: 'Only organizers manage allocations.' },
  { value: 'request', label: 'REQUEST', desc: 'Advisors and head delegates can request swaps; you approve them.' },
  { value: 'self_serve', label: 'SELF-SERVE', desc: "Advisors and head delegates can swap within their delegation; you're notified." },
];

const CARD: React.CSSProperties = {
  backgroundColor: '#FFFDF9',
  border: '1.5px solid #D8CDB6',
  borderRadius: '16px',
  padding: '24px',
  marginBottom: '20px',
  boxShadow: '0 1px 2px rgba(27,56,40,0.04)',
};

function Spinner() {
  return (
    <div
      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
      style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
      aria-hidden
    />
  );
}

/** The settings page's pill switch, with the switch role and a name. */
function Switch({ on, onChange, disabled, label }: {
  on: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => { if (!disabled) onChange(!on); }}
      disabled={disabled}
      className="relative flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2"
      style={{
        width: 44, height: 24,
        borderRadius: 9999,
        backgroundColor: on ? '#1B3828' : '#DDD4C0',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 200ms ease, opacity 200ms ease',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{
          width: 20, height: 20, top: 2, left: on ? 22 : 2,
          backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

export function DelegationsSettings({
  conferenceId, allowImport, onConferenceSaved,
  swapMode, swapModeSaving, swapModeError, onSwapModeChange,
}: {
  conferenceId: string;
  /** conferences.allow_delegation_import as the page last read it. */
  allowImport: boolean;
  /** Re-reads the conference after a verified write (refreshConferenceQuiet). */
  onConferenceSaved: () => Promise<void> | void;
  swapMode: string;
  swapModeSaving: boolean;
  swapModeError: string;
  onSwapModeChange: (mode: string) => void;
}) {
  // What the database last confirmed. Moves only after a verified write.
  const [importOn, setImportOn] = useState(allowImport);
  const [seenAllow, setSeenAllow] = useState(allowImport);
  if (seenAllow !== allowImport) {
    setSeenAllow(allowImport);
    setImportOn(allowImport);
  }
  const [importSaving, setImportSaving] = useState(false);
  const [importError, setImportError] = useState('');

  async function saveImport(next: boolean) {
    if (importSaving) return;
    setImportSaving(true);
    setImportError('');
    const fail = "Couldn't save, please refresh and try again.";
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setImportError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase
        .from('conferences')
        .update({ allow_delegation_import: next })
        .eq('id', conferenceId)
        .select('id');
      if (error || !data || data.length !== 1) {
        setImportError(error ? friendlyError(error, fail) : fail);
        return;
      }
      setImportOn(next);
      await onConferenceSaved();
    } catch (e) {
      setImportError(friendlyError(e, fail));
    } finally {
      setImportSaving(false);
    }
  }

  return (
    <>
      {/* ── Swaps ── */}
      <div style={CARD}>
        <p className="font-semibold text-base mb-1 flex items-center gap-2" style={{ color: '#1C1410', fontFamily: FONT }}>
          <Emoji3D name="Counterclockwise arrows button" size={20} fallback={Users2} fallbackColor="#1B3828" />
          Delegation allocation swaps
          <InfoHint
            label="About allocation swaps"
            text="Once you have allocated a delegation its seats, its head delegate and faculty advisor may want to move their own people between them, putting a stronger delegate onto a harder country, say. Off keeps every move with your team. Request lets them ask and you approve. Self-serve lets them rearrange inside their own delegation freely and notifies you; they can never take a seat from another delegation."
          />
        </p>
        <p className="text-sm mb-4" style={{ color: '#5A5046', fontFamily: FONT }}>
          Whether delegation leaders can trade allocations within their own delegation
        </p>
        <div className="flex items-center" style={{ gap: 8 }}>
          <div className="flex-1">
            <Segmented
              options={SWAP_MODE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              value={swapMode}
              disabled={swapModeSaving}
              onChange={(v) => onSwapModeChange(v)}
            />
          </div>
          {swapModeSaving && <Spinner />}
        </div>
        <p className="text-xs mt-2" style={{ color: '#9A8A78', fontFamily: FONT }}>
          {SWAP_MODE_OPTIONS.find(o => o.value === swapMode)?.desc}
        </p>
        {swapModeError && (
          <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: FONT }}>{swapModeError}</p>
        )}
      </div>

      {/* ── Leader imports ── */}
      <div style={CARD}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-base mb-1 flex items-center gap-2" style={{ color: '#1C1410', fontFamily: FONT }}>
              <Emoji3D name="Busts in silhouette" size={20} fallback={UserPlus} fallbackColor="#1B3828" />
              Let delegation leaders import their delegates
              <InfoHint
                label="About delegation imports"
                text="Faculty advisors and head delegates can add their delegates by name and email, up to the spots they pledged. Each import uses one of the leader's credits, which comes back to them if the delegate is rejected or withdraws, and every imported delegate still waits for your acceptance."
              />
            </p>
            <p className="text-sm" style={{ color: '#5A5046', fontFamily: FONT }}>
              Each imported delegate uses one of the leader&apos;s own credits
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {importSaving && <Spinner />}
            <Switch
              on={importOn}
              onChange={(next) => { void saveImport(next); }}
              disabled={importSaving}
              label="Let delegation leaders import their delegates"
            />
          </div>
        </div>
        {importError && (
          <p role="alert" className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: FONT }}>{importError}</p>
        )}
      </div>
    </>
  );
}
