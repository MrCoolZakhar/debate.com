'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, ArrowRight, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE } from '@/components/neu';
import Portal from '@/components/Portal';
import VerifiedCheck from '@/components/VerifiedCheck';
import { LogoDisc } from '@/components/LogoDisc';
import { monogramFor } from '@/app/account/accountUi';
import { useModalEscape } from '@/components/ModalOverlay';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useBasicsGateBlocking } from '@/lib/basicsGateState';

// ── "Finish your conference set-up" entry reminder ───────────────────────────
//
// A conference earns its blue checkmark automatically once set-up is complete
// (conferences.is_verified, refresh_conference_verification). When an organiser
// enters Gavelling with an unverified conference, this shows them ONCE A DAY
// what is left, how long it takes, and sends them to it.
//
// Shows only when ALL of these hold:
//   • auth has loaded and there is a user + session
//   • the path is not a session/auth/manage/flow surface (see EXCLUDED below)
//   • profiles.welcome_token_seen is true, so it can never stack on the
//     credits welcome modal (CreditsWelcomeGate owns the first visit)
//   • profiles.setup_reminder_seen_at is null or older than 24 hours
//   • CompleteBasicsGate is not checking or open (useBasicsGateBlocking), so
//     it never stacks on the nationality / date of birth gate either
//   • my_incomplete_conferences() returns at least one conference
//
// Every dismissal (Later, X, Escape, Finish set-up, a step row) stamps
// setup_reminder_seen_at = now() so the next reminder is tomorrow at the earliest.

const EXCLUDED_PREFIXES = [
  '/auth', '/chair', '/delegate', '/advisor', '/voting', '/join',
  '/manage', '/unsubscribe', '/invites', '/drafts', '/api',
];
const EXCLUDED_SEGMENTS = ['/apply', '/pay'];

const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  return EXCLUDED_SEGMENTS.some((s) => pathname.includes(s));
}

function isDue(seenAt: string | null | undefined): boolean {
  if (!seenAt) return true;
  const t = Date.parse(seenAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t >= REMIND_AFTER_MS;
}

interface PendingStep {
  key: string;
  title: string;
  minutes: number;
  /** Relative to /manage/{slug}, e.g. '/settings?tab=conference'. */
  href: string;
}

interface IncompleteConference {
  id: string;
  slug: string;
  logo_url: string | null;
  display_name: string;
  minutes_left: number;
  pending: PendingStep[];
}

function headline(name: string, minutes: number): string {
  if (minutes <= 0) return `${name} is one refresh away from its checkmark`;
  if (minutes === 1) return `${name} is about a minute from its checkmark`;
  return `${name} is about ${minutes} minutes from its checkmark`;
}

function stepMinutes(minutes: number): string {
  if (minutes <= 0) return 'now';
  return `${minutes} min`;
}

export default function SetupReminderGate() {
  const pathname = usePathname();
  const { user, session, loading: authLoading } = useAuth();
  const basicsBlocking = useBasicsGateBlocking();
  const [conferences, setConferences] = useState<IncompleteConference[] | null>(null);
  const [open, setOpen] = useState(false);
  // Once we have decided (shown, or found nothing to show) a token refresh
  // re-running the effect must not fetch again or reopen the modal.
  const handledRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    if (handledRef.current) return;
    handledRef.current = true;
    const supabase = getAuthedClient(session.access_token);

    // No cancel-on-cleanup: a token refresh re-runs this effect mid-fetch and
    // the ref already blocks a second fetch, so dropping the first result
    // would silently suppress the reminder for the whole visit.
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('welcome_token_seen, setup_reminder_seen_at')
        .eq('id', user.id)
        .single();
      const row = profile as { welcome_token_seen?: boolean | null; setup_reminder_seen_at?: string | null } | null;
      if (!row) return;
      if (row.welcome_token_seen !== true) return;
      if (!isDue(row.setup_reminder_seen_at)) return;

      const { data } = await supabase.rpc('my_incomplete_conferences');
      const list = Array.isArray(data) ? (data as IncompleteConference[]) : [];
      if (list.length === 0) return;
      setConferences(list);
      setOpen(true);
    })();
  }, [authLoading, user, session]);

  function dismiss() {
    setOpen(false);
    if (user && session) {
      getAuthedClient(session.access_token)
        .from('profiles')
        .update({ setup_reminder_seen_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {});
    }
  }

  if (isExcludedPath(pathname)) return null;
  if (!user || !session) return null;
  if (!open || !conferences || conferences.length === 0) return null;
  if (basicsBlocking) return null;

  return <SetupReminderModal conferences={conferences} onClose={dismiss} />;
}

function SetupReminderModal({
  conferences,
  onClose,
}: {
  conferences: IncompleteConference[];
  onClose: () => void;
}) {
  const conf = conferences[0];
  const others = conferences.length - 1;
  const manageHref = `/manage/${conf.slug}`;
  const [ctaHover, setCtaHover] = useState(false);
  const [ctaPress, setCtaPress] = useState(false);

  useScrollLock(true);
  useModalEscape(onClose, true);

  return (
    <Portal>
      <div
        onClick={onClose}
        role="dialog"
        aria-modal
        aria-labelledby="setup-reminder-title"
        className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4 py-6"
        style={{
          backgroundColor: 'rgba(28,20,16,0.42)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          animation: 'gvSetupFade 220ms ease',
        }}
      >
        <style>{`@keyframes gvSetupFade{from{opacity:0}to{opacity:1}}@keyframes gvSetupPop{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:none}}`}</style>

        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full"
          style={{
            maxWidth: 440,
            borderRadius: 26,
            backgroundColor: NEU.surface,
            boxShadow: NEU.out,
            padding: '28px 26px 24px',
            fontFamily: OUTFIT,
            animation: 'gvSetupPop 260ms cubic-bezier(0.2,0.7,0.2,1)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute flex items-center justify-center focus:outline-none"
            style={{ top: 14, right: 14, width: 30, height: 30, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, border: 'none', color: NEU.inkSoft, cursor: 'pointer' }}
          >
            <X size={15} strokeWidth={2.4} />
          </button>

          {/* Grey seal becoming the blue one */}
          <div className="flex items-center justify-center" style={{ gap: 12, marginBottom: 14 }}>
            <span
              className="inline-flex items-center justify-center"
              style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
            >
              <VerifiedCheck verified={false} showUnverified size={32} title="Not verified yet" />
            </span>
            <ArrowRight size={16} strokeWidth={2.4} style={{ color: NEU.deepGold }} aria-hidden />
            <span
              className="inline-flex items-center justify-center"
              style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
            >
              <VerifiedCheck verified size={32} title="Verified" />
            </span>
          </div>

          <p
            className="text-center"
            style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEU.deepGold }}
          >
            Your checkmark
          </p>

          <div className="flex items-start justify-center" style={{ gap: 10, marginBottom: 8 }}>
            <LogoDisc
              src={conf.logo_url}
              alt=""
              size={32}
              fallbackText={monogramFor(conf.display_name)}
              style={{ marginTop: 2 }}
            />
            <h2
              id="setup-reminder-title"
              style={{ margin: 0, fontSize: 21, fontWeight: 900, lineHeight: 1.18, letterSpacing: '-0.01em', color: NEU.ink, maxWidth: 320 }}
            >
              {headline(conf.display_name, conf.minutes_left)}
            </h2>
          </div>

          <p className="text-center" style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.55, color: NEU.inkSoft }}>
            Conferences with the blue checkmark show delegates the set-up is complete. It is earned automatically.
          </p>

          {conf.pending.length > 0 && (
            <div style={{ borderRadius: 18, backgroundColor: NEU.base, boxShadow: NEU.in, padding: '2px 14px', marginBottom: 18 }}>
              {conf.pending.map((step, i) => (
                <Link
                  key={step.key}
                  href={`${manageHref}${step.href}`}
                  onClick={onClose}
                  className="flex items-center focus:outline-none"
                  style={{ gap: 10, padding: '11px 0', borderTop: i > 0 ? '1px solid #DDD4C0' : 'none', textDecoration: 'none' }}
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontSize: 11, fontWeight: 800, color: NEU.forest }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0" style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink, lineHeight: 1.35 }}>
                    {step.title}
                  </span>
                  <span className="flex-shrink-0" style={{ fontSize: 12, fontWeight: 700, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                    {stepMinutes(step.minutes)}
                  </span>
                  <ChevronRight size={15} strokeWidth={2.4} className="flex-shrink-0" style={{ color: NEU.muted }} aria-hidden />
                </Link>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center" style={{ gap: 10 }}>
            {/* The house primary (NeuButton): gold gradient, forest ink, a glow that
                lifts on hover and depresses on press. A flat dark slab read as
                generic here, and this is the one control the modal exists for. */}
            <Link
              href={manageHref}
              onClick={onClose}
              onMouseEnter={() => setCtaHover(true)}
              onMouseLeave={() => { setCtaHover(false); setCtaPress(false); }}
              onPointerDown={() => setCtaPress(true)}
              onPointerUp={() => setCtaPress(false)}
              className="inline-flex items-center justify-center gap-2 w-full sm:flex-1 focus:outline-none"
              style={{
                borderRadius: 999,
                padding: '13px 22px',
                background: `linear-gradient(135deg, ${NEU_GRADIENTS.gold[0]}, ${NEU_GRADIENTS.gold[1]})`,
                color: NEU.forest,
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                boxShadow: ctaHover
                  ? `0 6px 16px ${NEU_GRADIENTS.gold[0]}66, ${NEU.outSmHover}`
                  : `0 4px 10px ${NEU_GRADIENTS.gold[0]}4D, ${NEU.outSm}`,
                transform: ctaPress ? 'scale(0.96)' : ctaHover ? 'translateY(-2px)' : 'translateY(0)',
                transition: `box-shadow 260ms ${EASE}, transform 160ms ${EASE}`,
              }}
            >
              Finish set-up <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-full sm:w-auto focus:outline-none"
              style={{ borderRadius: 14, padding: '13px 18px', backgroundColor: NEU.base, boxShadow: NEU.inSm, border: 'none', color: NEU.inkSoft, fontFamily: OUTFIT, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
            >
              Later
            </button>
          </div>

          {others > 0 && (
            <p className="text-center" style={{ margin: '14px 0 0', fontSize: 12.5, color: NEU.inkSoft }}>
              <Link href="/my-conferences" onClick={onClose} className="focus:outline-none" style={{ color: NEU.inkSoft, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                and {others} more in your conferences
              </Link>
            </p>
          )}
        </div>
      </div>
    </Portal>
  );
}
