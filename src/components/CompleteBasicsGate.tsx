'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import Portal from '@/components/Portal';
import { CountryField } from '@/components/CountryField';
import { DatePicker } from '@/components/DatePicker';
import { useModalEscape } from '@/components/ModalOverlay';
import { useScrollLock } from '@/hooks/useScrollLock';
import { GeoGuessNote, useNationalityPrefill } from '@/components/GeoCountryGuess';
import { getCountryByName } from '@/lib/countries';
import { ageAt } from '@/lib/age';
import { setBasicsGateStatus, useBasicsGateStatus } from '@/lib/basicsGateState';

// ── "Complete your account" gate: nationality and date of birth ──────────────
//
// Every account needs both: conferences allocate by nationality and several
// run age rules. E-mail sign-up asks for them, but Google/OAuth creates the
// account first and only then routes to /auth/onboarding, which a person can
// simply close. Asking again on the next visit is the only real closure, so
// this is mounted in the root layout.
//
// Blocking, not dismissable. Sign out is the only other way out. It asks only
// for what is missing, and writes only when the person presses the button.
// A nationality guessed from /api/geo is prefilled and labelled as a guess;
// it is never saved on its own.
//
// Precedence: this gate publishes its status to src/lib/basicsGateState.ts.
// CreditsWelcomeGate and SetupReminderGate render nothing while it is
// 'checking' or 'needed', so no modal ever opens on top of this one.
//
// Never shown on EXCLUDED routes: the auth flow (onboarding asks the same
// thing itself), legal pages, contact and unsubscribe (must stay reachable),
// every anonymous live-session surface (a chair must never get a modal over a
// live committee), the profile page (it has both fields AND account deletion,
// which must not require handing over a birth date first), and any /apply
// path (the apply flow has its own basics wall, so the gate would ask twice).

const EXCLUDED_PREFIXES = [
  '/auth', '/privacy', '/terms', '/contact', '/unsubscribe', '/api',
  '/chair', '/delegate', '/advisor', '/voting', '/join', '/create',
  '/account/profile',
];

function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  return pathname.split('/').includes('apply');
}

interface Missing {
  nationality: boolean;
  dob: boolean;
}

type BasicsRow = { nationality: string | null; date_of_birth: string | null };

export default function CompleteBasicsGate() {
  const pathname = usePathname();
  const excluded = isExcludedPath(pathname);
  const { user, session, loading: authLoading, signOut } = useAuth();
  const status = useBasicsGateStatus();
  const [missing, setMissing] = useState<Missing | null>(null);
  // The user id already known to be complete this page load. Set on a
  // complete read, a successful save, or a failed read (fail open).
  const okForRef = useRef<string | null>(null);
  // The user id a read is in flight for. Cleared on sign-out, which is how a
  // late result for a previous user gets dropped.
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const uid = user?.id ?? null;
    if (!uid || !session) {
      okForRef.current = null;
      inFlightRef.current = null;
      setMissing(null);
      setBasicsGateStatus('idle');
      return;
    }
    if (okForRef.current === uid) return;
    // Not checked on an excluded route. Leaving one re-runs this effect, so a
    // person who completed /auth/onboarding is re-read and never asked twice.
    if (excluded) return;
    if (inFlightRef.current === uid) return;
    inFlightRef.current = uid;
    setBasicsGateStatus('checking');
    const supabase = getAuthedClient(session.access_token);

    // No cancel-on-cleanup: a token refresh re-runs this effect mid-read, and
    // inFlightRef already blocks a second read (same as SetupReminderGate).
    (async () => {
      // A row we could not read is NOT a row with blanks in it. Raising the
      // gate on an RLS refusal, a network error, or a profiles row the signup
      // trigger has not committed yet would show an unskippable screen whose
      // save has nothing to update. So retry briefly, then fail open.
      let row: BasicsRow | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await supabase
          .from('profiles')
          .select('nationality, date_of_birth')
          .eq('id', uid)
          .maybeSingle();
        if (inFlightRef.current !== uid) return;
        if (!res.error && res.data) { row = res.data as BasicsRow; break; }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
      if (inFlightRef.current !== uid) return;
      inFlightRef.current = null;
      if (!row) {
        okForRef.current = uid;
        setBasicsGateStatus('ok');
        return;
      }
      const needNat = !row.nationality || !row.nationality.trim();
      const needDob = !row.date_of_birth;
      if (!needNat && !needDob) {
        okForRef.current = uid;
        setMissing(null);
        setBasicsGateStatus('ok');
        return;
      }
      setMissing({ nationality: needNat, dob: needDob });
      setBasicsGateStatus('needed');
    })();
  }, [authLoading, user, session, excluded]);

  if (excluded) return null;
  if (!user || !session) return null;
  if (status !== 'needed' || !missing) return null;

  return (
    <CompleteBasicsModal
      key={user.id}
      missing={missing}
      email={user.email ?? null}
      userId={user.id}
      accessToken={session.access_token}
      onSaved={() => {
        okForRef.current = user.id;
        setMissing(null);
        setBasicsGateStatus('ok');
      }}
      onSignOut={async () => {
        await signOut();
        window.location.href = '/';
      }}
    />
  );
}

const FIELD_INPUT_STYLE: React.CSSProperties = {
  backgroundColor: '#FAF8F3',
  border: '1px solid #8C7E68',
  borderRadius: 12,
  color: '#1C1410',
  fontFamily: OUTFIT,
  // 16px is the iOS no-zoom floor: anything smaller zooms the page on focus.
  fontSize: 16,
  paddingTop: 12,
  paddingBottom: 12,
};

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0EBDD]';

function CompleteBasicsModal({
  missing,
  email,
  userId,
  accessToken,
  onSaved,
  onSignOut,
}: {
  missing: Missing;
  email: string | null;
  userId: string;
  accessToken: string;
  onSaved: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [nationality, setNationality] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [hover, setHover] = useState(false);
  const guessed = useNationalityPrefill(nationality, setNationality, missing.nationality);

  useScrollLock(true);
  // Registered with a no-op on purpose. This gate cannot be dismissed, and
  // being top of the shared Escape stack stops a keypress from closing some
  // other dialog hidden behind it.
  useModalEscape(() => {}, true);

  const both = missing.nationality && missing.dob;
  const title = both
    ? 'Two things before you carry on'
    : missing.nationality
      ? 'What is your nationality?'
      : 'What is your date of birth?';
  const lead = both
    ? 'Conferences allocate seats by nationality, and some set an age range. Without these, an application can be turned down at allocation.'
    : missing.nationality
      ? 'Conferences allocate seats by nationality. Without it, an application can be turned down at allocation.'
      : 'Some conferences set an age range for their delegates. Without it, an application can be turned down at allocation.';
  const confirmOnly = !!guessed && !missing.dob;

  async function save() {
    if (saving || signingOut) return;
    setError('');
    const patch: { nationality?: string; date_of_birth?: string } = {};
    if (missing.nationality) {
      const country = getCountryByName(nationality);
      if (!country) { setError('Please choose your nationality from the list.'); return; }
      patch.nationality = country.name;
    }
    if (missing.dob) {
      if (!dob) { setError('Please enter your date of birth.'); return; }
      const age = ageAt(dob);
      if (age === null || age < 0 || age > 120) {
        setError('That date of birth does not look right. Please check it.');
        return;
      }
      if (age < 13) { setError('You need to be at least 13 to use Gavelling.'); return; }
      patch.date_of_birth = dob;
    }
    setSaving(true);
    // `.select('id')` is load-bearing: an update that matches zero rows (an
    // RLS refusal included) resolves with error === null. Without the row
    // check the gate would close with the fields still blank.
    const { data, error: saveError } = await getAuthedClient(accessToken)
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('id');
    setSaving(false);
    if (saveError || !data || data.length === 0) {
      setError('We could not save that. Please try again. If it keeps failing, sign out and sign back in.');
      return;
    }
    onSaved();
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await onSignOut();
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const busy = saving || signingOut;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="complete-basics-title"
        aria-describedby="complete-basics-lead"
        className="fixed inset-0 z-[9000] flex items-center justify-center px-4 py-4"
        style={{
          backgroundColor: 'rgba(28,20,16,0.42)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          animation: 'gvBasicsFade 220ms ease',
        }}
      >
        <style>{`@keyframes gvBasicsFade{from{opacity:0}to{opacity:1}}@keyframes gvBasicsPop{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:none}}`}</style>

        <form
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          noValidate
          className="relative w-full"
          style={{
            maxWidth: 440,
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            borderRadius: 26,
            backgroundColor: NEU.surface,
            boxShadow: NEU.out,
            padding: '26px 22px 20px',
            fontFamily: OUTFIT,
            animation: 'gvBasicsPop 260ms cubic-bezier(0.2,0.7,0.2,1)',
          }}
        >
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEU.deepGold }}>
            Finish your account
          </p>
          <h2
            id="complete-basics-title"
            style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, lineHeight: 1.18, letterSpacing: '-0.01em', color: NEU.ink, textWrap: 'balance' }}
          >
            {title}
          </h2>
          <p id="complete-basics-lead" style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.55, color: NEU.inkSoft, textWrap: 'pretty' }}>
            {lead}
          </p>

          {missing.nationality && (
            <div style={{ marginBottom: missing.dob ? 18 : 4 }}>
              <label htmlFor="complete-basics-nationality" className="block text-sm font-semibold mb-1.5" style={{ color: NEU.ink }}>
                Nationality
              </label>
              <CountryField
                id="complete-basics-nationality"
                value={nationality}
                onChange={(v) => { setNationality(v); setError(''); }}
                placeholder="Start typing a country..."
                inputStyle={FIELD_INPUT_STYLE}
                describedBy="complete-basics-nationality-note"
              />
              {guessed ? (
                <GeoGuessNote id="complete-basics-nationality-note" countryName={guessed} />
              ) : (
                <p id="complete-basics-nationality-note" className="text-xs mt-1.5" style={{ color: NEU.inkSoft }}>
                  Pick from the list. This is your nationality, not where you study.
                </p>
              )}
            </div>
          )}

          {missing.dob && (
            <div style={{ marginBottom: 4 }}>
              <label htmlFor="complete-basics-dob" className="block text-sm font-semibold mb-1.5" style={{ color: NEU.ink }}>
                Date of birth
              </label>
              <DatePicker
                id="complete-basics-dob"
                value={dob}
                onChange={(iso) => { setDob(iso); setError(''); }}
                max={todayIso}
                initialView="2005-06-15"
                placeholder="Select your date of birth"
                describedBy="complete-basics-dob-note"
              />
              <p id="complete-basics-dob-note" className="text-xs mt-1.5" style={{ color: NEU.inkSoft }}>
                You must be at least 13. Only your age is ever shown to a conference, never the date.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm mt-4" style={{ color: '#8B2020', lineHeight: 1.45 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className={`w-full mt-5 rounded-xl active:scale-[0.98] ${FOCUS_RING}`}
            style={{
              padding: '14px 20px',
              backgroundColor: NEU.forest,
              color: NEU.gold,
              fontFamily: OUTFIT,
              fontSize: 13.5,
              fontWeight: 800,
              letterSpacing: '0.08em',
              border: 'none',
              cursor: saving ? 'wait' : busy ? 'default' : 'pointer',
              opacity: busy ? 0.7 : 1,
              boxShadow: hover && !busy ? '0 10px 26px rgba(27,56,40,0.28)' : '0 8px 22px rgba(27,56,40,0.22)',
              transition: `box-shadow 200ms ${EASE}, transform 140ms ${EASE}`,
            }}
          >
            {saving ? 'SAVING…' : confirmOnly ? 'CONFIRM' : 'SAVE AND CONTINUE'}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2" style={{ marginTop: 16 }}>
            <p className="text-xs min-w-0" style={{ margin: 0, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>
              {email ? <>Signed in as <strong style={{ color: NEU.ink, fontWeight: 700 }}>{email}</strong>. </> : null}
              <Link href="/privacy" className={`rounded ${FOCUS_RING}`} style={{ color: NEU.inkSoft, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Privacy
              </Link>
            </p>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 rounded-lg ${FOCUS_RING}`}
              style={{
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                color: NEU.inkSoft,
                fontFamily: OUTFIT,
                fontSize: 13,
                fontWeight: 700,
                cursor: busy ? 'default' : 'pointer',
                opacity: signingOut ? 0.6 : 1,
              }}
            >
              <LogOut size={14} strokeWidth={2.4} aria-hidden />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}
