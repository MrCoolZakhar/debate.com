'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { IdCard } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import Portal from '@/components/Portal';
import { useModalEscape } from '@/components/ModalOverlay';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useAuthModalOpen } from '@/lib/authModal';
import { setNameGateStatus, useBasicsGateStatus, useNameGateStatus } from '@/lib/basicsGateState';
import { joinName, nameProblem, nameProblemMessage, tidyName, toTitleCase, titleCaseSuggestion } from '@/lib/personName';
import { ErrorLine, FloatInput, GreenButton, Hint, KIT_CSS, TextButton } from '@/components/auth/authModalKit';

// ── "What's Your Name?" ───────────────────────────────────────────────────────
//
// Owner, 11 Oct 2026: accounts named "MUN Society Taiwan", "Chair ECOSOC",
// "GPS MUN". Organisers, chairs and certificates read profiles.display_name,
// so it must be a person. Sign-up and the profile page now refuse such names
// (src/lib/personName.ts); this gate asks the accounts made before that, ONCE
// per visit, with a quiet "Remind me later" that hides it for 7 days.
//
// It asks ONLY when nameProblem(display_name) says so: never for a one-word
// name (mononyms exist) or an all-capitals one. An organiser account named
// after its conference is asked too: the person managing it gives their name.
//
// Order: it waits for CompleteBasicsGate to say 'ok' and the auth modal to be
// closed, and publishes its own status through src/lib/basicsGateState.ts, so
// the credits welcome, the set-up reminder and "Your room is live" stay closed
// while it decides or is open. It also waits while any other modal is on
// screen (a purchase pop-up, a page dialog). A failed read fails open.
//
// The save is a row-counted update of display_name ONLY (a client-writable
// column, see CLAUDE.md "profiles column grants"); the live-name trigger
// carries it to every mirror ("A renamed profile shows everywhere").

const EXCLUDED_PREFIXES = [
  '/auth', '/privacy', '/terms', '/contact', '/unsubscribe', '/api', '/r',
  '/chair', '/delegate', '/advisor', '/voting', '/join', '/create/sessions',
  '/account/profile', '/invites', '/drafts',
];
const EXCLUDED_SEGMENTS = ['apply', 'pay'];

function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  const parts = pathname.split('/');
  return EXCLUDED_SEGMENTS.some((s) => parts.includes(s));
}

const LATER_KEY = (uid: string) => `gavelling-name-gate-later:${uid}`;
const LATER_MS = 7 * 24 * 60 * 60 * 1000;

function laterActive(uid: string): boolean {
  try {
    const raw = window.localStorage.getItem(LATER_KEY(uid));
    if (!raw) return false;
    const t = Number(raw);
    return Number.isFinite(t) && Date.now() - t < LATER_MS;
  } catch {
    return false;
  }
}

function rememberLater(uid: string): void {
  try { window.localStorage.setItem(LATER_KEY(uid), String(Date.now())); } catch { /* blocked storage: this visit only */ }
}

const PANEL_ATTR = 'data-gv-name-gate';

/** Any other modal layer on screen (the same test "Your room is live" uses). */
function otherModalOnScreen(): boolean {
  if (typeof document === 'undefined') return false;
  const mine = (el: Element) => !!el.closest(`[${PANEL_ATTR}]`);
  const dialogs = document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"]');
  for (const el of Array.from(dialogs)) {
    if (!mine(el) && (el as HTMLElement).getClientRects().length > 0) return true;
  }
  const layers = document.querySelectorAll('.fixed.inset-0');
  for (const el of Array.from(layers)) {
    if (mine(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents !== 'none' && cs.display !== 'none' && cs.visibility !== 'hidden') return true;
  }
  return false;
}

export default function NameGate() {
  const pathname = usePathname();
  const excluded = isExcludedPath(pathname);
  const auth = useAuth() as ReturnType<typeof useAuth> & { refreshProfile?: () => Promise<void> };
  const { user, session, loading: authLoading } = auth;
  const basics = useBasicsGateStatus();
  const status = useNameGateStatus();
  const authOpen = useAuthModalOpen();
  const [current, setCurrent] = useState<string | null>(null);
  const [otherModal, setOtherModal] = useState(true);
  // Per page load: the user already decided about (ok, saved, later, a failed read).
  const doneForRef = useRef<string | null>(null);
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const uid = user?.id ?? null;
    if (!uid || !session) {
      doneForRef.current = null;
      inFlightRef.current = null;
      setCurrent(null);
      setNameGateStatus('idle');
      return;
    }
    if (doneForRef.current === uid) return;
    // Waiting (on an excluded route, behind the auth modal or the basics gate)
    // never blocks the other gates: only a read in flight or an open gate does.
    if (excluded || authOpen || basics !== 'ok') {
      if (inFlightRef.current !== uid) setNameGateStatus(current ? 'needed' : 'idle');
      return;
    }
    if (current !== null) return;
    if (inFlightRef.current === uid) return;
    if (laterActive(uid)) {
      doneForRef.current = uid;
      setNameGateStatus('ok');
      return;
    }
    inFlightRef.current = uid;
    setNameGateStatus('checking');
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      let row: { display_name: string | null; is_demo: boolean | null } | null = null;
      for (let attempt = 0; attempt < 2 && !row; attempt++) {
        const res = await supabase.from('profiles').select('display_name, is_demo').eq('id', uid).maybeSingle();
        if (inFlightRef.current !== uid) return;
        if (!res.error && res.data) row = res.data as { display_name: string | null; is_demo: boolean | null };
        else if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
      }
      if (inFlightRef.current !== uid) return;
      inFlightRef.current = null;
      if (!row || row.is_demo || nameProblem(row.display_name) === null) {
        doneForRef.current = uid;
        setNameGateStatus('ok');
        return;
      }
      setCurrent(tidyName(row.display_name));
      setNameGateStatus('needed');
    })();
    // `current` is read only to skip a second read while the gate is open.
  }, [authLoading, user, session, excluded, authOpen, basics, current]);

  // Never on top of another modal: poll while the gate wants to open.
  const wanted = status === 'needed' && current !== null && !excluded && !authOpen && basics === 'ok';
  useEffect(() => {
    if (!wanted) return;
    const check = () => setOtherModal(otherModalOnScreen());
    check();
    const id = window.setInterval(check, 700);
    return () => window.clearInterval(id);
  }, [wanted]);

  const close = useCallback((uid: string, later: boolean) => {
    if (later) rememberLater(uid);
    doneForRef.current = uid;
    setCurrent(null);
    setNameGateStatus('ok');
  }, []);

  if (!wanted || otherModal || !user || !session) return null;

  return (
    <NameModal
      key={user.id}
      current={current ?? ''}
      userId={user.id}
      accessToken={session.access_token}
      onSaved={() => { void auth.refreshProfile?.(); close(user.id, false); }}
      onLater={() => close(user.id, true)}
      onEscape={() => close(user.id, false)}
    />
  );
}

const GATE_CSS = `
.gv-name-backdrop{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(0,0,0,0.45);animation:gvAuthFade 200ms ease}
.gv-name-panel{position:relative;width:100%;max-width:440px;max-height:calc(100dvh - 48px);overflow-y:auto;overscroll-behavior:contain;background:#FFFFFF;border-radius:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,0.5);padding:28px 28px 22px;font-family:var(--font-brand),sans-serif;color:#222222;animation:gvAuthRise 320ms cubic-bezier(0.2,0.8,0.2,1)}
.gv-name-disc{width:52px;height:52px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(238,217,138,0.32);box-shadow:inset 0 1px 0 rgba(255,255,255,0.8),0 0 0 1px rgba(182,135,31,0.18);margin-bottom:14px}
.gv-name-title{margin:0 0 8px;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.15;color:#222222;text-wrap:balance}
.gv-name-now{margin:0 0 4px;font-size:15px;line-height:1.5;color:#222222;overflow-wrap:anywhere}
.gv-name-now strong{font-weight:600}
.gv-name-why{margin:0 0 18px;font-size:14.5px;line-height:1.5;color:#6A6A6A;text-wrap:pretty}
.gv-name-later{display:flex;justify-content:center;margin-top:6px}
@media (max-width:743px){
  .gv-name-backdrop{align-items:flex-end;padding:0}
  .gv-name-panel{max-width:none;border-radius:22px 22px 0 0;max-height:calc(100dvh - 24px);padding:22px calc(20px + env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left));animation:gvNameSheet 320ms cubic-bezier(0.2,0.8,0.2,1)}
  .gv-name-title{font-size:24px}
}
@keyframes gvNameSheet{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
`;

function NameModal({
  current, userId, accessToken, onSaved, onLater, onEscape,
}: {
  current: string;
  userId: string;
  accessToken: string;
  onSaved: () => void;
  onLater: () => void;
  onEscape: () => void;
}) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [error, setError] = useState<{ text: string; first: boolean; last: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLFormElement>(null);
  const full = joinName(first, last);
  const suggestion = !error && nameProblem(full) === null ? titleCaseSuggestion(full) : null;

  useScrollLock(true);
  // Escape closes for this visit only; "Remind me later" is the 7-day choice.
  useModalEscape(onEscape, true);

  useEffect(() => {
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLInputElement>('input')?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  // Keep Tab inside the pop-up.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('input, button')).filter((el) => !(el as HTMLButtonElement).disabled);
    if (items.length === 0) return;
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    if (!tidyName(first)) { setError({ text: 'Enter your first name.', first: true, last: false }); return; }
    const problem = nameProblem(full);
    if (problem) {
      const inFirst = problem !== 'too_short' && nameProblem(first) !== null;
      const inLast = problem !== 'too_short' && !!tidyName(last) && nameProblem(last) !== null;
      setError({ text: nameProblemMessage(problem), first: inFirst || !inLast, last: inLast });
      return;
    }
    setSaving(true);
    // `.select('id')` is load-bearing: a refused or zero-row update resolves
    // with error === null, and the gate must not close on a name never saved.
    const { data, error: saveError } = await getAuthedClient(accessToken)
      .from('profiles')
      .update({ display_name: full })
      .eq('id', userId)
      .select('id');
    setSaving(false);
    if (saveError || !data || data.length === 0) {
      setError({ text: 'We could not save your name. Please try again.', first: false, last: false });
      return;
    }
    onSaved();
  }

  return (
    <Portal>
      <div className="gv-name-backdrop" {...{ [PANEL_ATTR]: '' }}>
        <style>{KIT_CSS}{GATE_CSS}</style>
        <form
          ref={panelRef}
          className="gv-name-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gv-name-title"
          aria-describedby="gv-name-now gv-name-why"
          onSubmit={(e) => void save(e)}
          onKeyDown={onKeyDown}
          noValidate
        >
          <div className="gv-name-disc" aria-hidden>
            <IdCard size={26} strokeWidth={2} fill="rgba(238,217,138,0.85)" style={{ color: '#1B3828' }} />
          </div>
          <h2 id="gv-name-title" className="gv-name-title">What&apos;s Your Name?</h2>
          <p id="gv-name-now" className="gv-name-now">
            {current ? <>Your account shows <strong>&ldquo;{current}&rdquo;</strong></> : 'Your account has no name yet'}
          </p>
          <p id="gv-name-why" className="gv-name-why">
            Organisers, chairs and certificates use it, so it should be you, not your society or role.
          </p>

          <div className="gv-auth-screen">
            <FloatInput
              id="gv-name-first"
              label="First name"
              value={first}
              onChange={(e) => { setFirst(e.target.value); setError(null); }}
              autoComplete="given-name"
              invalid={!!error?.first}
              aria-describedby="gv-name-note"
            />
            <FloatInput
              id="gv-name-last"
              label="Last name"
              value={last}
              onChange={(e) => { setLast(e.target.value); setError(null); }}
              autoComplete="family-name"
              invalid={!!error?.last}
              aria-describedby="gv-name-note"
            />
            {error ? (
              <ErrorLine id="gv-name-note">{error.text}</ErrorLine>
            ) : (
              <Hint id="gv-name-note">
                The way you&apos;d sign a certificate. Leave the last name empty if you only use one name.
                {suggestion && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="gv-inline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#222222] rounded"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 600 }}
                      onClick={() => { setFirst(toTitleCase(first)); setLast(toTitleCase(last)); }}
                    >
                      Use Title Case
                    </button>
                  </>
                )}
              </Hint>
            )}
            <div style={{ marginTop: 6 }}>
              <GreenButton busy={saving} busyText="Saving…">Save</GreenButton>
            </div>
          </div>
          <div className="gv-name-later">
            <TextButton quiet onClick={onLater}>Remind me later</TextButton>
          </div>
        </form>
      </div>
    </Portal>
  );
}
