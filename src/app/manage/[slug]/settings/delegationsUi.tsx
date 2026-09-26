'use client';

// delegationsUi.tsx — Settings → Delegations. Everything an organiser decides
// about how delegations (schools, societies) run themselves, in one
// self-contained panel so it can move whole into a Delegations manage tab once
// that is split out of Assignment.
//
//   1. Delegation Allocation Swaps (moved here from the Conference tab; the
//      page still owns swapMode / saveSwapMode, unchanged, and passes them in)
//   2. Let delegation leaders import their delegates
//      (conferences.allow_delegation_import, off by default). The write is the
//      same verified pattern as saveSwapMode: an update with .select('id'),
//      exactly one row back counts as saved, no optimistic flip.
//
// Hints (25 Sep 2026): ONE tooltip per "i", opened on hover or focus, drawn
// through a Portal ABOVE the icon so it never covers the options, closed on
// leave, on tapping elsewhere and on Escape. No native `title`, so no second
// tooltip. Each swap option has its own short "i".

import { useCallback, useEffect, useRef, useState } from 'react';
import { Info, UserPlus, Users2 } from 'lucide-react';
import Portal from '@/components/Portal';
import { Emoji3D, NEU } from '@/components/neu';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, clearErr } from '@/lib/appNotify';

const FONT = 'var(--font-brand), sans-serif';

export const SWAP_MODE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'Only your team can move delegates between seats.' },
  { value: 'request', label: 'Request', hint: 'Leaders ask for a swap and nothing changes until you approve it.' },
  { value: 'self_serve', label: 'Self-serve', hint: 'Leaders swap seats within their own delegation and you are notified. They can never take another delegation’s seat.' },
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

/** One small "i": a single hover / focus tooltip through a Portal, above the
 *  icon (below only when there is no room above), never a native title. */
function Hint({ label, text, size = 16 }: { label: string; text: string; size?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; above: boolean } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 20);
    const left = Math.max(10, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 10));
    // Above by default so the options underneath stay visible.
    const above = r.top > 120;
    const top = above ? r.top - 8 : r.bottom + 8;
    setPos({ top, left, width, above });
  }, []);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [pos]);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="img"
        aria-label={`${label}: ${text}`}
        onMouseEnter={place}
        onMouseLeave={() => setPos(null)}
        onFocus={place}
        onBlur={() => setPos(null)}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (pos) setPos(null); else place(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); } }}
        className="inline-flex items-center justify-center rounded-full flex-shrink-0 align-middle"
        style={{ width: size, height: size, backgroundColor: NEU.surface, boxShadow: NEU.inSm, color: NEU.inkSoft, cursor: 'help' }}
      >
        <Info size={size * 0.62} strokeWidth={2.8} aria-hidden />
      </span>
      {pos && (
        <Portal>
          <div
            role="tooltip"
            style={{
              position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 9000,
              transform: pos.above ? 'translateY(-100%)' : undefined,
              backgroundColor: '#1C1410', color: '#FAF8F3', borderRadius: 12, padding: '10px 12px',
              fontFamily: FONT, fontSize: 12.5, lineHeight: 1.5, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
            }}
          >
            {text}
          </div>
        </Portal>
      )}
    </>
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
  swapMode, swapModeSaving, onSwapModeChange,
}: {
  conferenceId: string;
  /** conferences.allow_delegation_import as the page last read it. */
  allowImport: boolean;
  /** Re-reads the conference after a verified write (refreshConferenceQuiet). */
  onConferenceSaved: () => Promise<void> | void;
  swapMode: string;
  swapModeSaving: boolean;
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

  async function saveImport(next: boolean) {
    if (importSaving) return;
    setImportSaving(true);
    clearErr('settings-delegations');
    const fail = "Couldn't save, please refresh and try again.";
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        notifyErr('Your session has expired, please refresh and sign in again.', 'settings-delegations');
        return;
      }
      const { data, error } = await supabase
        .from('conferences')
        .update({ allow_delegation_import: next })
        .eq('id', conferenceId)
        .select('id');
      if (error || !data || data.length !== 1) {
        notifyErr(error ? friendlyError(error, fail) : fail, 'settings-delegations');
        return;
      }
      setImportOn(next);
      await onConferenceSaved();
    } catch (e) {
      notifyErr(friendlyError(e, fail), 'settings-delegations');
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
          Delegation Allocation Swaps
          <Hint
            label="About allocation swaps"
            text="Lets a delegation's head delegate and faculty advisor move their own delegates between the seats you allocated to that delegation."
          />
        </p>
        <p className="text-sm mb-4" style={{ color: '#5A5046', fontFamily: FONT }}>
          Whether delegation leaders can trade allocations within their own delegation
        </p>
        <div className="flex items-start" style={{ gap: 8 }}>
          <div className="flex-1 grid gap-2" role="radiogroup" aria-label="Delegation allocation swaps" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {SWAP_MODE_OPTIONS.map(opt => {
              const active = swapMode === opt.value;
              return (
                <div key={opt.value} className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={swapModeSaving}
                    onClick={() => onSwapModeChange(opt.value)}
                    className="flex-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2"
                    style={{
                      padding: '10px 12px',
                      backgroundColor: active ? '#1B3828' : 'transparent',
                      color: active ? NEU.gold : NEU.ink,
                      border: active ? '1.5px solid #1B3828' : '1.5px solid rgba(27,56,40,0.28)',
                      fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
                      cursor: swapModeSaving ? 'not-allowed' : 'pointer',
                      opacity: swapModeSaving ? 0.7 : 1,
                      transition: 'background-color 140ms ease, color 140ms ease, border-color 140ms ease',
                    }}
                  >
                    {opt.label}
                  </button>
                  <Hint label={`About ${opt.label}`} text={opt.hint} size={15} />
                </div>
              );
            })}
          </div>
          {swapModeSaving && <div className="pt-3"><Spinner /></div>}
        </div>
      </div>

      {/* ── Leader imports ── */}
      <div style={CARD}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-base mb-1 flex items-center gap-2" style={{ color: '#1C1410', fontFamily: FONT }}>
              <Emoji3D name="Busts in silhouette" size={20} fallback={UserPlus} fallbackColor="#1B3828" />
              Let delegation leaders import their delegates
              <Hint
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
      </div>
    </>
  );
}
