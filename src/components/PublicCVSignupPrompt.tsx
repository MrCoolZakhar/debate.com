'use client';

// ── "Want your own MUN CV?" — the public-CV signup prompt ────────────────────
//
// A stranger reading somebody's MUN CV is the single best-qualified visitor
// Gavelling ever gets: they already know what the product produces, because
// they are looking at one. This is the ask, and it is deliberately the ONLY
// thing on /cv/[id] that interrupts them.
//
// WHO SEES IT
//   Logged-out visitors only. Being logged out is also what rules out the
//   "don't show me this on my own profile" case — you cannot be signed in as
//   the owner of the page and be logged out at the same time — so there is no
//   second identity check to keep in sync. A signed-in visitor reading someone
//   else's CV does not see it either: they already have a CV.
//
// WHEN IT FIRES — after they have read the CV, not on arrival
//   Firing on load is the most annoying possible choice: it asks for a signup
//   before the visitor has seen the thing they would be signing up for, and it
//   covers the page they clicked a link to reach. So the trigger is
//   ENGAGEMENT: the prompt appears once the visitor has scrolled roughly
//   three-quarters of the way down the CV. By then they have read the
//   timeline, the pitch has already made itself, and the modal interrupts a
//   finished read rather than an unstarted one.
//
//   A CV with no entries is too short to scroll, so that condition can never
//   become true. For those pages only, the same "they have had time to read
//   it" moment is approximated with a 15s dwell. One rule — "wait until they
//   have got through it" — measured whichever way the page allows.
//
// HOW IT BEHAVES
//   • Dismissable four ways: the X, "Maybe later", the backdrop, and Escape
//     (through the shared escape stack in ModalOverlay, so it can never fight
//     another dialog).
//   • It never covers the CV again. The dismissal is written to localStorage,
//     which is the only storage a logged-out visitor has — there is no account
//     to hang a flag on. One dismissal silences it on EVERY CV, not just this
//     one, because "no thanks" is an answer about Gavelling, not about the
//     person whose page they happened to be on.
//   • Nothing is gated behind it. Closing it returns the visitor to a fully
//     readable page; there is no login wall on a public CV and there must
//     never be one.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ArrowRight, Trophy, Images, ClipboardCheck } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import Portal from '@/components/Portal';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useModalEscape } from '@/components/ModalOverlay';
import { useAuth } from '@/components/AuthProvider';

/** One dismissal silences the prompt on every public CV, permanently. */
const DISMISS_KEY = 'gv-cv-signup-prompt-dismissed';

/** Fraction of the page that must be behind the visitor before we ask. */
const SCROLL_TRIGGER = 0.75;

/** Fallback for a CV too short to scroll, where SCROLL_TRIGGER never trips. */
const DWELL_MS = 15_000;

// Every row here is a thing the product actually does today — checked against
// the code, not the marketing page:
//   • awards live on mun_cv_entries.awards[] and render on the public CV
//   • photos live on mun_cv_entries.photos[], uploaded from CVEntryModal
//   • organisers open an applicant's CV from the applications, assignment and
//     committees screens via <ProfileLink>
// Do not add a row here that one of those three sentences cannot be written
// for.
const BENEFITS = [
  {
    Icon: Trophy,
    bold: 'Every committee and award',
    muted: 'in one record that stays yours',
  },
  {
    Icon: Images,
    bold: 'Photos from each conference',
    muted: 'alongside the entry they belong to',
  },
  {
    Icon: ClipboardCheck,
    bold: 'Organisers can see it',
    muted: 'when they review your application',
  },
];

export default function PublicCVSignupPrompt() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  // Read straight out of localStorage in the initialiser rather than in an
  // effect. That is safe here specifically because `dismissed` does not reach
  // the rendered output — the first render is `null` on the server AND on the
  // client (`open` starts false either way), so there is nothing for hydration
  // to disagree about. It only gates the effect below.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // Private mode / storage disabled. Treat as "not dismissed" so the
      // prompt still works; it just cannot remember, which is the failure
      // mode we can live with.
      return false;
    }
  });

  const eligible = !authLoading && !user && !dismissed;

  // The engagement trigger. Only armed for a visitor who would actually be
  // shown the prompt, so a signed-in reader never even installs a listener.
  useEffect(() => {
    if (!eligible || open) return;

    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      setOpen(true);
    };

    // Measured defensively. `document.documentElement.scrollHeight` is the
    // obvious source and it is NOT reliable in this app — the root element
    // computes to height 0 and the real length sits on <body>, so reading only
    // the first one makes every CV look unscrollable and the trigger never
    // fires. Take the largest honest measurement of each.
    const onScroll = () => {
      const viewport = window.innerHeight || document.documentElement.clientHeight || 0;
      const full = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
        viewport,
      );
      if (full - viewport <= 0) return; // too short to scroll — the dwell covers it
      if ((window.scrollY + viewport) / full >= SCROLL_TRIGGER) fire();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    const dwell = setTimeout(fire, DWELL_MS);
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(dwell);
    };
  }, [eligible, open]);

  function close() {
    setOpen(false);
    setDismissed(true);
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage disabled — see above */ }
  }

  return open ? <Prompt onClose={close} /> : null;
}

// The card itself, split out so the hooks it needs (scroll lock, escape) mount
// with the modal and unmount with it, rather than running for every visitor.
function Prompt({ onClose }: { onClose: () => void }) {
  useScrollLock(true);
  useModalEscape(onClose);

  return (
    <Portal>
      <div
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gv-cv-prompt-title"
        className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4"
        style={{
          backgroundColor: 'rgba(28,20,16,0.42)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          animation: 'gvCvPromptFade 220ms ease',
        }}
      >
        <style>{`@keyframes gvCvPromptFade{from{opacity:0}to{opacity:1}}@keyframes gvCvPromptPop{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:none}}`}</style>

        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full text-center"
          style={{
            maxWidth: 420,
            // A short viewport (a phone in landscape, a small laptop) must not
            // trap the card's own content off-screen — it scrolls inside
            // itself rather than overflowing the locked page.
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            borderRadius: 26,
            backgroundColor: NEU.surface,
            boxShadow: NEU.out,
            padding: '0 clamp(20px, 6vw, 30px) 26px',
            animation: 'gvCvPromptPop 260ms cubic-bezier(0.2,0.7,0.2,1)',
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute flex items-center justify-center"
            style={{ top: 14, right: 14, width: 30, height: 30, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, border: 'none', color: NEU.muted, cursor: 'pointer' }}
          >
            <X size={15} strokeWidth={2.4} />
          </button>

          {/* Gavin, same greeting as the credits welcome — one mascot, one
              visual language across the two "hello, here is Gavelling" moments. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Otter.Tutorial.Intro.png"
            alt=""
            aria-hidden
            style={{ width: 170, height: 'auto', display: 'block', margin: '-40px auto -6px', filter: 'drop-shadow(0 10px 22px rgba(27,56,40,0.24))' }}
          />

          <h2 id="gv-cv-prompt-title" style={{ margin: '0 0 12px', lineHeight: 1.14, letterSpacing: '-0.01em' }}>
            <span style={{ fontFamily: OUTFIT, fontSize: 25, fontWeight: 900, color: NEU.ink }}>Want your own </span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 25, color: NEU.amber }}>MUN CV</span>
            <span style={{ fontFamily: OUTFIT, fontSize: 25, fontWeight: 900, color: NEU.ink }}>?</span>
          </h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.6, color: NEU.muted, margin: '0 0 20px' }}>
            This is a Gavelling profile. Yours is free, and it takes a minute to start.
          </p>

          <div style={{ borderRadius: 18, backgroundColor: NEU.base, boxShadow: NEU.in, padding: '4px 16px', marginBottom: 18, textAlign: 'left' }}>
            {BENEFITS.map((row, i) => (
              <div
                key={row.bold}
                className="flex items-center"
                style={{ gap: 12, padding: '12px 0', borderTop: i > 0 ? '1px solid #DDD4C0' : 'none' }}
              >
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
                >
                  <row.Icon size={16} strokeWidth={2.2} style={{ color: NEU.forest }} />
                </span>
                <p style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 700, color: NEU.ink }}>{row.bold}</span>{' '}
                  <span style={{ color: NEU.muted }}>{row.muted}</span>
                </p>
              </div>
            ))}
          </div>

          {/* No `next` override: /auth/signup already defaults to
              /auth/onboarding, which is the flow that walks a new delegate
              through adding their first conferences. */}
          <Link
            href="/auth/signup"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 w-full"
            style={{ borderRadius: 14, padding: '13px 18px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase', textDecoration: 'none', boxShadow: NEU.outSm }}
          >
            Register now <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
          <button
            onClick={onClose}
            style={{ marginTop: 12, background: 'none', border: 'none', color: NEU.muted, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            No thanks, just reading
          </button>
        </div>
      </div>
    </Portal>
  );
}
