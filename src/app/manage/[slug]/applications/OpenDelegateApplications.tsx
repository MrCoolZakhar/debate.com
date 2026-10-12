'use client';

// ─────────────────────────────────────────────────────────────────────────────
// OpenDelegateApplications: the empty Applications page's one next step
// (owner, 11 Oct 2026: "while it's still empty, add the option to open delegate
// applications directly on there").
//
// Shown by the page only while the conference has ZERO applications. It renders
// nothing when delegate applications are already open, except right after this
// card opened them, when it shows the public apply link with Copy.
//
// The write is exactly Settings → Applications' role switch (saveRoleConfig in
// settings/page.tsx): one `application_role_configs` UPDATE of `is_enabled` for
// the delegate row, row-counted with `.select(...)`, so an RLS refusal or a
// missing row is a failure, never a silent success. Nothing else is written.
//
// Before offering the button it checks what would refuse it, so the database
// rarely has to: the delegate row must exist (Settings seeds it), the payment
// gate (`trg_role_config_payment_gate`, mirrored by paymentGateBlocks) and the
// conference dates (TBD dates keep the conference off Explore). A dated window
// that has closed, or opens later, is explained and linked to the role's When
// step rather than rewritten here.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Loader2 } from 'lucide-react';
import { NEU, OUTFIT, NeuCard, Emoji3D } from '@/components/neu';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { paymentGateBlocks, type PaymentReadinessConference } from '@/lib/payments';
import { roleWindowState, useServerNow, formatWindowInstant } from '@/lib/applicationWindow';

export interface DelegateRoleWindow {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
}

type Conf = PaymentReadinessConference & {
  id: string;
  slug: string;
  is_public: boolean;
  dates_tbd: boolean;
  start_date: string | null;
};

const FOREST_BUTTON: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  minHeight: 48, padding: '0 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(90deg, #1B3828 0%, #2A5A3C 100%)', color: '#FFFFFF',
  fontFamily: OUTFIT, fontSize: 15, fontWeight: 700,
  boxShadow: '0 6px 16px rgba(27,56,40,0.25)',
};

const LINK: React.CSSProperties = { fontWeight: 700, textDecoration: 'underline', color: NEU.forest };

export default function OpenDelegateApplications({
  conference, delegate, onOpened, fallback,
}: {
  conference: Conf;
  /** The delegate row of application_role_configs, or null when it does not exist yet. */
  delegate: DelegateRoleWindow | null;
  /** Hands the stored row back so the page's role configs match the database. */
  onOpened: (row: DelegateRoleWindow) => void;
  /** Drawn instead when delegate applications are already open. */
  fallback: React.ReactNode;
}) {
  const now = useServerNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justOpened, setJustOpened] = useState(false);
  const [copied, setCopied] = useState(false);

  const slug = conference.slug;
  const state = roleWindowState(delegate, now);
  const applyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/conferences/${slug}/apply?role=delegate`
    : `/conferences/${slug}/apply?role=delegate`;

  // Already open and not opened from here: the plain empty state says enough.
  if (state === 'open' && !justOpened) return <>{fallback}</>;

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBusy(false);
      setError('Your session has expired. Please sign in again and try once more.');
      return;
    }
    const { data, error: err } = await supabase
      .from('application_role_configs')
      .update({ is_enabled: true })
      .eq('conference_id', conference.id)
      .eq('role', 'delegate')
      .select('role, is_enabled, applications_open_at, applications_close_at');
    setBusy(false);
    if (err || !data || data.length === 0) {
      setError(err
        ? friendlyError(err, "Couldn't open delegate applications. Please try again.")
        : "Couldn't open delegate applications. You may not have permission to change Settings.");
      return;
    }
    const row = data[0] as DelegateRoleWindow;
    onOpened(row);
    if (roleWindowState(row, now) === 'open') setJustOpened(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(applyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link. Select it and copy it by hand.");
    }
  }

  // What stops the button, first match wins, each with its one fix.
  const settingsRole = `/manage/${slug}/settings?tab=applications&role=delegate`;
  let blocker: { line: string; href: string; label: string } | null = null;
  if (!delegate) {
    blocker = { line: 'Set up delegate applications first.', href: settingsRole, label: 'Set up delegates' };
  } else if (paymentGateBlocks(conference)) {
    blocker = { line: 'Choose how delegates pay first. Even a free conference needs one.', href: `/manage/${slug}/financials?open=payment`, label: 'Set up payments' };
  } else if (conference.dates_tbd || !conference.start_date) {
    blocker = { line: 'Set your conference dates first.', href: `/manage/${slug}/settings?tab=general&focus=dates`, label: 'Add dates' };
  } else if (state === 'closed') {
    blocker = { line: 'Delegate applications closed on their closing date.', href: `${settingsRole}&step=when`, label: 'Change the dates' };
  } else if (state === 'not_open' && delegate.applications_open_at) {
    blocker = { line: `Delegate applications open on ${formatWindowInstant(delegate.applications_open_at)}.`, href: `${settingsRole}&step=when`, label: 'Change the dates' };
  }

  return (
    <NeuCard style={{ padding: '40px 24px' }}>
      <div className="flex flex-col items-center text-center">
        <Emoji3D name={justOpened ? 'Party popper' : 'Inbox tray'} size={56} />
        <p className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 20, color: NEU.ink }}>
          {justOpened ? 'Delegate Applications Are Open' : 'No Applications Yet'}
        </p>

        {justOpened ? (
          <>
            <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>
              Share this link with delegates
            </p>
            <div
              className="mt-4 flex items-center gap-2 w-full"
              style={{ maxWidth: 560, padding: '6px 6px 6px 16px', borderRadius: 12, backgroundColor: '#FFFFFF', boxShadow: '0 1px 0 rgba(27,56,40,0.08), 0 8px 24px -16px rgba(27,56,40,0.4)' }}
            >
              <span className="flex-1 min-w-0 text-start [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 500, color: NEU.ink }}>
                {applyUrl}
              </span>
              <button
                type="button"
                onClick={copy}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ ...FOREST_BUTTON, minHeight: 40, padding: '0 16px', fontSize: 14, flexShrink: 0 }}
              >
                {copied ? <Check size={16} strokeWidth={2.6} /> : <Copy size={16} strokeWidth={2.4} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {!conference.is_public && (
              <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.inkSoft }}>
                Your conference page is private, so only people with the link can find it.{' '}
                <Link href={`/manage/${slug}/settings?tab=visibility`} style={LINK}>Make it public</Link>
              </p>
            )}
          </>
        ) : blocker ? (
          <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft, maxWidth: 520 }}>
            {blocker.line}{' '}
            <Link href={blocker.href} style={LINK}>{blocker.label}</Link>
          </p>
        ) : (
          <>
            <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>
              Open delegate applications and they will appear here
            </p>
            <button
              type="button"
              onClick={open}
              disabled={busy}
              aria-busy={busy}
              className="mt-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]"
              style={{ ...FOREST_BUTTON, opacity: busy ? 0.75 : 1, cursor: busy ? 'default' : 'pointer' }}
            >
              {busy && <Loader2 size={17} className="animate-spin" />}
              Open delegate applications
            </button>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: '#8B2020', maxWidth: 520 }}>
            {error}
          </p>
        )}
      </div>
    </NeuCard>
  );
}
