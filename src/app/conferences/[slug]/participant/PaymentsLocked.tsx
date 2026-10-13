'use client';

// LockedPayButton — a pay button while the conference has not set up how it
// gets paid (prompt 108). Applications never wait for payments; only paying
// does. The button keeps its place and stays focusable, drawn disabled with a
// lock, and a small note opens on hover, focus or a tap:
//   "Payments have not been set up for this conference. Contact your
//    organizers if there are any doubts."
// "Contact" opens the participant dashboard's Ask the Organisers thread
// (/conferences/[slug]?ask=organisers; on the conference page itself it is
// opened in place through the gv-ask-organisers event).

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export const PAYMENTS_LOCKED_NOTE = 'Payments have not been set up for this conference. Contact your organizers if there are any doubts.';

/** conference_payments_ready(conference) from the server: true, false, or null while it is read (draw unlocked then). */
export function useConferencePaymentsReady(conferenceId: string | null): boolean | null {
  const [ready, setReady] = useState<{ id: string; v: boolean } | null>(null);
  useEffect(() => {
    if (!conferenceId) return;
    let alive = true;
    void (async () => {
      const c = await getFreshAuthedClient();
      if (!c || !alive) return;
      const { data, error } = await c.rpc('conference_payments_ready', { p_conference_id: conferenceId });
      if (alive && !error && typeof data === 'boolean') setReady({ id: conferenceId, v: data });
    })();
    return () => { alive = false; };
  }, [conferenceId]);
  return ready && ready.id === conferenceId ? ready.v : null;
}

export function askOrganisersHref(slug: string): string {
  return `/conferences/${slug}?ask=organisers`;
}

export default function LockedPayButton({ slug, label, className, style }: {
  slug: string;
  label: React.ReactNode;
  /** The look of the button it replaces (its classes), drawn disabled. */
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  const hideSoon = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 180); };

  const onContact = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Already on this conference's page: open the thread in place, no reload.
    if (typeof window !== 'undefined' && window.location.pathname === `/conferences/${slug}`) {
      e.preventDefault();
      window.history.replaceState(window.history.state, '', askOrganisersHref(slug));
      window.dispatchEvent(new Event('gv-ask-organisers'));
      setOpen(false);
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        type="button"
        className={className}
        aria-disabled="true"
        aria-describedby={tipId}
        onClick={() => setOpen(o => !o)}
        onFocus={show}
        onBlur={hideSoon}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        style={{ ...style, opacity: 0.55, cursor: 'not-allowed' }}
      >
        <Lock size={16} strokeWidth={2.4} aria-hidden /> {label}
      </button>
      <span
        id={tipId}
        role="tooltip"
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, zIndex: 40, width: 'max-content', maxWidth: 'min(300px, 80vw)',
          padding: '10px 12px', borderRadius: 12, background: '#1C1410', color: '#FFFFFF', fontSize: 13, fontWeight: 500, lineHeight: 1.45, textAlign: 'left',
          boxShadow: '0 10px 26px -12px rgba(0,0,0,0.55)', opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden', transition: 'opacity 140ms ease',
        }}
      >
        Payments have not been set up for this conference.{' '}
        <a href={askOrganisersHref(slug)} onClick={onContact} onFocus={show} onBlur={hideSoon}
          style={{ color: '#EED98A', fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3 }}>Contact</a>
        {' '}your organizers if there are any doubts.
      </span>
    </span>
  );
}

/** A link to /pay that draws itself locked while the conference has not set up
 *  payments (conference_payments_ready). Reads the answer itself, so big pages
 *  need no new hook of their own. */
export function PayLink({ conferenceId, slug, className, style, children, onMouseEnter, onMouseLeave }: {
  conferenceId: string;
  slug: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const ready = useConferencePaymentsReady(conferenceId);
  if (ready === false) return <LockedPayButton slug={slug} label={children} className={className} style={style} />;
  return (
    <Link href={`/conferences/${slug}/pay`} className={className} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </Link>
  );
}
