'use client';

/**
 * CreateDelegationPrompt: what a DELEGATE sees when the delegation they typed
 * does not exist yet at this conference.
 *
 * Delegates cannot create a delegation. Only a Head Delegate or a Faculty
 * Advisor can, because the delegation is billed through them (the invoicing
 * step, and societies.spots_purchased). The apply flow used to stop a delegate
 * dead here with "ask your Head Delegate or Faculty Advisor to create it".
 * Often that person IS the applicant, so this offers the switch instead:
 *
 *  - NoDelegationMatch: an inline card under the name field when nothing
 *    matches, with a + button.
 *  - CreateDelegationButton: the same action as a plain button under the
 *    name field when the fuzzy matcher found names but none of them is
 *    theirs. It lives OUTSIDE the suggestion list on purpose: the list
 *    scrolls, closes on blur and is gone on a phone the moment the keyboard
 *    hides, so an action that only existed inside it was unreachable.
 *  - CreateDelegationRow: a mouse shortcut pinned to the foot of the open
 *    suggestion list, which covers CreateDelegationButton while it is open.
 *    Out of the tab order: the button is the keyboard path.
 *  - CreateDelegationDialog: the confirmation. Rendered through Portal at
 *    fixed viewport coordinates, so no ancestor overflow can clip it. It lists
 *    ONLY the roles this conference has open right now, and it tells the
 *    applicant plainly to check with their delegation first.
 *  - RoleSwitchedNotice: the line on the next screen confirming what happened.
 *
 * The switch itself (draft hand-over, role in the URL) lives in
 * ConferenceApplyClient's switchToDelegationRole, because it has to reset that
 * component's draft refs. This file only asks, and reports back.
 *
 * A Portal renders outside the page's themed wrapper, where --gv-* fall back
 * to Gavelling's :root palette. The caller passes themeCssVars(activeTheme) as
 * `themeStyle` so the dialog wears the conference's colours like the page.
 */

import { useEffect, useId, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import { Check, Info, Plus, X, Loader2 } from 'lucide-react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { getAuthedClient } from '@/lib/supabase-auth';

export type DelegationSwitchRole = 'head-delegate' | 'faculty-advisor';

const SWITCH_ROLES: DelegationSwitchRole[] = ['head-delegate', 'faculty-advisor'];

export const SWITCH_ROLE_LABEL: Record<DelegationSwitchRole, string> = {
  'head-delegate': 'Head Delegate',
  'faculty-advisor': 'Faculty Advisor',
};

const SWITCH_ROLE_SUB: Record<DelegationSwitchRole, string> = {
  'head-delegate': 'You lead the delegation and invite its delegates.',
  'faculty-advisor': 'You are the teacher or adviser responsible for the delegation.',
};

const DANGER = '#8B2020';
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gv-surface)]';

interface RoleWindow {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
}

/**
 * Open = switched on AND inside its application window. The apply page's own
 * wall only checks is_enabled (ConferenceApplyClient, "Applications are not
 * open"); the window half mirrors isRoleOpen() in ConferenceDetailClient.tsx,
 * which is what the public page uses to decide which roles to offer. Using
 * both means we never offer a role the conference page itself would not.
 */
function roleIsOpen(r: RoleWindow, now = new Date()): boolean {
  if (!r.is_enabled) return false;
  const openAt = r.applications_open_at ? new Date(r.applications_open_at) : null;
  const closeAt = r.applications_close_at ? new Date(r.applications_close_at) : null;
  if (closeAt && now > closeAt) return false;
  if (openAt && now < openAt) return false;
  return true;
}

// ── Inline card, under the name field ────────────────────────────────────────

export function NoDelegationMatch({
  name, onCreate, blockedReason,
}: {
  name: string;
  onCreate: () => void;
  /** When set, the switch is not possible right now and this says why. */
  blockedReason?: string | null;
}) {
  return (
    <div
      className="mt-3 rounded-2xl"
      style={{
        padding: '14px 14px 14px 16px',
        backgroundColor: 'color-mix(in srgb, var(--gv-main) 5%, transparent)',
        border: '1.5px dashed color-mix(in srgb, var(--gv-main) 22%, transparent)',
      }}
    >
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13.5, lineHeight: 1.4, color: NEU.ink, overflowWrap: 'anywhere' }}>
        No delegation called &quot;{name}&quot; yet.
      </p>
      <p style={{ fontFamily: OUTFIT, fontWeight: 500, fontSize: 12.5, lineHeight: 1.5, color: NEU.inkSoft, marginTop: 3 }}>
        Check the spelling, or ask your Head Delegate or Faculty Advisor for their invite link.
        If nobody has created it, you can.
      </p>
      {blockedReason ? (
        <p style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12, lineHeight: 1.45, color: DANGER, marginTop: 8 }}>
          {blockedReason}
        </p>
      ) : (
        <button
          type="button"
          onClick={onCreate}
          className={`mt-3 inline-flex items-center gap-2 rounded-full ${FOCUS}`}
          style={{
            minHeight: 40, padding: '0 16px 0 10px', border: 'none', cursor: 'pointer',
            backgroundColor: NEU.forest, color: 'var(--gv-on-main)',
            fontFamily: OUTFIT, fontWeight: 800, fontSize: 13,
            boxShadow: NEU.outSm,
          }}
        >
          <span
            aria-hidden
            className="flex items-center justify-center"
            style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: 'color-mix(in srgb, var(--gv-on-main) 18%, transparent)' }}
          >
            <Plus size={14} strokeWidth={2.8} />
          </span>
          Create this delegation
        </button>
      )}
    </div>
  );
}

// ── Button under the name field, when there are suggestions ─────────────────

/** A normal, focusable button. Rendered below the name field whenever the
 *  typed name could be a new delegation, independent of the suggestion list. */
export function CreateDelegationButton({
  name, onCreate, blockedReason,
}: {
  name: string;
  onCreate: () => void;
  blockedReason?: string | null;
}) {
  if (blockedReason) {
    return (
      <p className="mt-3" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12, lineHeight: 1.45, color: DANGER }}>
        {blockedReason}
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onCreate}
      className={`mt-3 w-full flex items-center gap-2.5 text-left rounded-xl ${FOCUS}`}
      style={{
        minHeight: 44, padding: '8px 14px 8px 10px', cursor: 'pointer',
        backgroundColor: 'color-mix(in srgb, var(--gv-main) 4%, transparent)',
        border: '1.5px dashed color-mix(in srgb, var(--gv-main) 24%, transparent)',
        color: 'var(--gv-main)', fontFamily: OUTFIT, fontWeight: 700, fontSize: 13,
      }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: NEU.forest, color: 'var(--gv-on-main)' }}
      >
        <Plus size={14} strokeWidth={2.8} />
      </span>
      <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
        Not in the list? Create &quot;{name}&quot;
      </span>
    </button>
  );
}

// ── Row pinned to the foot of the open suggestion list ──────────────────────

/** Mouse and touch only (tabIndex -1): CreateDelegationButton below the field
 *  is the keyboard path, and two tab stops for one action is one too many.
 *  Uses onMouseDown, like the suggestion rows above it: the name field closes
 *  the list on blur, and a click would arrive after the list is gone. Sticky,
 *  so it is on screen however far the list is scrolled. */
export function CreateDelegationRow({ name, onCreate }: { name: string; onCreate: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm focus:outline-none"
      style={{
        position: 'sticky', bottom: 0,
        color: 'var(--gv-main)', fontFamily: OUTFIT, fontWeight: 700,
        borderTop: '1px solid var(--gv-border)', backgroundColor: 'var(--gv-surface)', cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--gv-main) 5%, var(--gv-surface))'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--gv-surface)'; }}
      onMouseDown={(e) => { e.preventDefault(); onCreate(); }}
    >
      <Plus size={15} strokeWidth={2.6} style={{ flexShrink: 0 }} />
      <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
        Not in the list? Create &quot;{name}&quot;
      </span>
    </button>
  );
}

// ── Confirmation on the next screen ──────────────────────────────────────────

export function RoleSwitchedNotice({
  role, name, existing, autoFocus, onFocused, onDismiss,
}: {
  role: DelegationSwitchRole;
  name: string;
  /** The name now resolves to a delegation that already exists (picked, or
   *  the one the typed name is unmistakably the same as), so nothing new is
   *  created and the notice must not say it will be. */
  existing: boolean;
  /** Take focus once, right after the switch: the control the applicant
   *  used to get here is gone, and focus would otherwise fall to the page. */
  autoFocus?: boolean;
  onFocused?: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onFocusedRef = useRef(onFocused);
  useEffect(() => { onFocusedRef.current = onFocused; });
  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus({ preventScroll: true });
    onFocusedRef.current?.();
  }, [autoFocus]);
  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      className="flex items-start gap-3 rounded-2xl mb-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gv-surface)]"
      style={{
        padding: '12px 8px 12px 14px',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--gv-accent) 22%, transparent), color-mix(in srgb, var(--gv-main) 5%, transparent))',
        border: '1.5px solid color-mix(in srgb, var(--gv-accent) 50%, transparent)',
      }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: NEU.forest, marginTop: 1 }}
      >
        <Check size={15} strokeWidth={3} style={{ color: 'var(--gv-on-main)' }} />
      </span>
      <p className="min-w-0 flex-1" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 13, lineHeight: 1.45, color: NEU.ink, overflowWrap: 'anywhere' }}>
        You are now applying as {SWITCH_ROLE_LABEL[role]}. Your answers that apply to this role came with you.{' '}
        {existing ? (
          <>
            <span style={{ fontWeight: 800 }}>&quot;{name}&quot;</span> is already registered here, so you apply under it.
          </>
        ) : (
          <>
            <span style={{ fontWeight: 800 }}>&quot;{name}&quot;</span> is created when you submit.
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`flex items-center justify-center flex-shrink-0 rounded-full ${FOCUS}`}
        style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', color: NEU.inkSoft }}
      >
        <X size={15} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// ── The dialog ───────────────────────────────────────────────────────────────

type Option = { role: DelegationSwitchRole; blocked: string | null };

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; options: Option[] };

function CreateDelegationDialogBody({
  name, conferenceId, conferenceLabel, userId, accessToken, previewing,
  themeStyle, reducedMotion, onClose, onSwitch, onApplyIndependently,
}: {
  open: boolean;
  /** The delegation name as typed. */
  name: string;
  conferenceId: string;
  /** "HMUN 2026" style label for the copy. */
  conferenceLabel: string;
  userId: string;
  accessToken: string;
  /** Organiser preview: never reads the organiser's own applications. */
  previewing: boolean;
  themeStyle: CSSProperties;
  reducedMotion: boolean;
  onClose: () => void;
  /** Performs the switch. Resolves null on success, or a message to show. */
  onSwitch: (role: DelegationSwitchRole) => Promise<string | null>;
  onApplyIndependently: () => void;
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [picked, setPicked] = useState<DelegationSwitchRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descId = useId();
  // Live mirrors for the key listener, which is registered once per opening.
  // Synced in an effect, never written during render.
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    busyRef.current = busy;
    onCloseRef.current = onClose;
  });

  // Which of the two roles is open, and whether this applicant already holds
  // an application under one (save_application_draft and the "already
  // applied" wall would both refuse them there). Read-only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = getAuthedClient(accessToken);
      const { data: cfgs, error: cfgError } = await client
        .from('application_role_configs')
        .select('role, is_enabled, applications_open_at, applications_close_at')
        .eq('conference_id', conferenceId)
        .in('role', SWITCH_ROLES);
      let held = new Set<string>();
      let appError: unknown = null;
      if (!previewing) {
        const res = await client
          .from('applications')
          .select('role')
          .eq('conference_id', conferenceId)
          .eq('user_id', userId)
          .in('role', SWITCH_ROLES);
        appError = res.error;
        held = new Set(((res.data ?? []) as { role: string }[]).map(r => r.role));
      }
      if (cancelled) return;
      if (cfgError || appError) { setLoad({ status: 'error' }); return; }
      const openRoles = new Set(((cfgs ?? []) as RoleWindow[]).filter(r => roleIsOpen(r)).map(r => r.role));
      const options: Option[] = SWITCH_ROLES
        .filter(r => openRoles.has(r))
        .map(r => ({
          role: r,
          blocked: held.has(r) ? `You already have a ${SWITCH_ROLE_LABEL[r]} application at this conference.` : null,
        }));
      const usable = options.filter(o => !o.blocked);
      setPicked(usable.length === 1 ? usable[0].role : null);
      setLoad({ status: 'ready', options });
    })();
    return () => { cancelled = true; };
  }, [conferenceId, userId, accessToken, previewing, reloadKey]);

  // Escape closes, Tab stays inside, focus returns to where it came from,
  // and the page behind does not scroll.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const els = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  async function confirm() {
    if (!picked || busy) return;
    setBusy(true);
    setError('');
    const message = await onSwitch(picked);
    // On success the caller closes the dialog and changes the role; there is
    // nothing left to reset here.
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  const options = load.status === 'ready' ? load.options : [];
  const usable = options.filter(o => !o.blocked);
  const noneOpen = load.status === 'ready' && usable.length === 0;
  const roleWords = usable.length === 1
    ? `its ${SWITCH_ROLE_LABEL[usable[0].role]}`
    : 'its Head Delegate or Faculty Advisor';

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-6"
        style={{ ...themeStyle, zIndex: 10000, backgroundColor: 'rgba(16,28,21,0.45)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      >
        <style>{'@keyframes gvDlgIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }'}</style>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          className="w-full focus:outline-none"
          style={{
            maxWidth: 440,
            maxHeight: 'calc(100dvh - 24px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            borderRadius: 22,
            padding: '20px 18px 18px',
            backgroundColor: 'var(--gv-surface)',
            border: '1px solid var(--gv-border)',
            boxShadow: '0 24px 60px color-mix(in srgb, var(--gv-main) 28%, transparent)',
            fontFamily: OUTFIT,
            animation: reducedMotion ? 'none' : `gvDlgIn 220ms ${EASE}`,
          }}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.16em', color: NEU.muted, marginBottom: 4 }}>
                NEW DELEGATION
              </p>
              <h2 id={titleId} style={{ fontWeight: 900, fontSize: 19, lineHeight: 1.25, color: NEU.ink, overflowWrap: 'anywhere' }}>
                Create &quot;{name}&quot;?
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className={`flex items-center justify-center flex-shrink-0 rounded-full ${FOCUS}`}
              style={{ width: 36, height: 36, marginTop: -4, marginRight: -6, border: 'none', background: 'none', cursor: busy ? 'default' : 'pointer', color: NEU.inkSoft }}
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>

          <p id={descId} style={{ fontWeight: 500, fontSize: 13.5, lineHeight: 1.55, color: NEU.inkSoft, marginTop: 8 }}>
            Delegates join a delegation that already exists. To create one, you apply as {roleWords} instead.
          </p>

          {/* The reminder. Two delegations for one school is the failure this
              whole prompt is most likely to cause, so it is not small print. */}
          <div
            className="flex items-start gap-2.5 rounded-xl"
            style={{
              marginTop: 14, padding: '11px 12px',
              backgroundColor: 'color-mix(in srgb, var(--gv-accent) 16%, transparent)',
              border: '1px solid color-mix(in srgb, var(--gv-accent) 45%, transparent)',
            }}
          >
            <Info size={16} strokeWidth={2.4} style={{ color: NEU.ink, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontWeight: 500, fontSize: 12.5, lineHeight: 1.5, color: NEU.ink }}>
              <span style={{ fontWeight: 800 }}>Check with your delegation first.</span>{' '}
              If your school or society has already confirmed a delegation to {conferenceLabel}, join that one
              instead of creating a second. Ask them for their invite link.
            </p>
          </div>

          {load.status === 'loading' && (
            <p className="flex items-center gap-2" style={{ marginTop: 16, fontWeight: 600, fontSize: 13, color: NEU.inkSoft }}>
              <Loader2 size={15} className={reducedMotion ? '' : 'animate-spin'} />
              Checking which roles are open...
            </p>
          )}

          {load.status === 'error' && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.45, color: DANGER }}>
                We could not check which roles are open. Try again.
              </p>
              <button
                type="button"
                onClick={() => { setLoad({ status: 'loading' }); setReloadKey(k => k + 1); }}
                className={`mt-2 rounded-full ${FOCUS}`}
                style={{ minHeight: 36, padding: '0 14px', border: '1.5px solid var(--gv-border)', background: 'none', cursor: 'pointer', fontFamily: OUTFIT, fontWeight: 800, fontSize: 12.5, color: NEU.forest }}
              >
                Try again
              </button>
            </div>
          )}

          {noneOpen && (
            <p style={{ marginTop: 16, fontWeight: 600, fontSize: 13, lineHeight: 1.5, color: NEU.ink }}>
              {options.length === 0
                ? 'This conference is not taking Head Delegate or Faculty Advisor applications right now. '
                : ''}
              {options.map(o => o.blocked).filter(Boolean).join(' ')}
              {options.length === 0 ? '' : ' '}
              Ask your school or society to create the delegation, or apply as an independent delegate.
            </p>
          )}

          {load.status === 'ready' && usable.length > 0 && (
            <>
              <p style={{ marginTop: 16, marginBottom: 8, fontWeight: 800, fontSize: 10, letterSpacing: '0.16em', color: NEU.muted }}>
                APPLY AS
              </p>
              <div role="radiogroup" aria-label="Apply as" className="flex flex-col gap-2">
                {options.map(o => {
                  const on = picked === o.role;
                  const disabled = !!o.blocked || busy;
                  return (
                    <button
                      key={o.role}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={disabled}
                      onClick={() => { setPicked(o.role); setError(''); }}
                      className={`w-full flex items-start gap-3 text-left rounded-2xl ${FOCUS}`}
                      style={{
                        padding: '12px 14px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: o.blocked ? 0.55 : 1,
                        backgroundColor: on ? 'color-mix(in srgb, var(--gv-main) 7%, var(--gv-surface))' : 'var(--gv-surface)',
                        border: on ? '1.5px solid var(--gv-main)' : '1.5px solid var(--gv-border)',
                        transition: reducedMotion ? 'none' : `border-color 160ms ${EASE}, background-color 160ms ${EASE}`,
                      }}
                    >
                      <span
                        aria-hidden
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: 20, height: 20, borderRadius: 999, marginTop: 1,
                          border: on ? 'none' : '1.5px solid color-mix(in srgb, var(--gv-main) 30%, transparent)',
                          backgroundColor: on ? NEU.forest : 'transparent',
                        }}
                      >
                        {on && <Check size={12} strokeWidth={3.2} style={{ color: 'var(--gv-on-main)' }} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block" style={{ fontWeight: 800, fontSize: 14, color: NEU.ink }}>
                          {SWITCH_ROLE_LABEL[o.role]}
                        </span>
                        <span className="block" style={{ fontWeight: 500, fontSize: 12.5, lineHeight: 1.45, color: o.blocked ? DANGER : NEU.inkSoft, marginTop: 2 }}>
                          {o.blocked ?? SWITCH_ROLE_SUB[o.role]}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <ul className="flex flex-col gap-1.5" style={{ marginTop: 14, padding: 0, listStyle: 'none' }}>
                {[
                  'Your answers that apply to the new role come with you.',
                  'Switching costs nothing. You still send one application.',
                  `"${name}" is created when you submit, not before.`,
                ].map(line => (
                  <li key={line} className="flex items-start gap-2" style={{ fontWeight: 500, fontSize: 12.5, lineHeight: 1.45, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>
                    <Check size={14} strokeWidth={2.8} style={{ color: NEU.green, flexShrink: 0, marginTop: 2 }} />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {error && (
            <p role="alert" style={{ marginTop: 12, fontWeight: 600, fontSize: 12.5, lineHeight: 1.45, color: DANGER }}>
              {error}
            </p>
          )}

          {/* Actions. Stacked on a phone (primary on top, full width), side by
              side from sm up. */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2" style={{ marginTop: 18 }}>
            <button
              type="button"
              onClick={noneOpen ? onApplyIndependently : onClose}
              disabled={busy}
              className={`rounded-full ${FOCUS}`}
              style={{
                minHeight: 44, padding: '0 18px', cursor: busy ? 'default' : 'pointer',
                border: '1.5px solid var(--gv-border)', background: 'none',
                fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, color: NEU.forest,
              }}
            >
              {noneOpen ? 'Apply independently' : 'Not now'}
            </button>
            {noneOpen ? (
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full ${FOCUS}`}
                style={{
                  minHeight: 44, padding: '0 20px', border: 'none', cursor: 'pointer',
                  backgroundColor: NEU.forest, color: 'var(--gv-on-main)',
                  fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, boxShadow: NEU.outSm,
                }}
              >
                Close
              </button>
            ) : load.status === 'ready' && (
              <button
                type="button"
                onClick={confirm}
                disabled={!picked || busy}
                className={`inline-flex items-center justify-center gap-2 rounded-full ${FOCUS}`}
                style={{
                  minHeight: 44, padding: '0 20px', border: 'none',
                  cursor: !picked || busy ? 'default' : 'pointer',
                  backgroundColor: !picked ? 'color-mix(in srgb, var(--gv-main) 14%, transparent)' : NEU.forest,
                  color: !picked ? NEU.inkSoft : 'var(--gv-on-main)',
                  fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5,
                  boxShadow: picked ? NEU.outSm : 'none',
                }}
              >
                {busy && <Loader2 size={15} className={reducedMotion ? '' : 'animate-spin'} />}
                {busy ? 'Switching...' : picked ? `Switch to ${SWITCH_ROLE_LABEL[picked]}` : 'Pick a role'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** Mounts the dialog body only while it is open, so every opening starts from
 *  a clean state (checking roles, no error, nothing picked) without resetting
 *  state inside an effect. */
export function CreateDelegationDialog(props: ComponentProps<typeof CreateDelegationDialogBody>) {
  return props.open ? <CreateDelegationDialogBody {...props} /> : null;
}
